using System.Collections.Generic;
using UnityEngine;
using Saga.Core.Region;
using Saga.Go.Player;

namespace Saga.Go.World
{
    /// <summary>
    /// U-0039 — GO 마을집(`House_2`) 한 채에 들어갈 수 있는 방. 숲 `ForestHouse` 의 "포켓 공간" 선례를 GO 에 맞춰 줄였다:
    /// 방(`Resources/World/int_hanok_01`, K-0026)을 마을과 안 겹치는 먼 자리에 세워 두고, 문 앞 근접 → 순간이동 / 방 안 출구 근접 → 복귀.
    /// 입력 키는 안 만든다(자동). 방 규약(K-0026): 문 = 남쪽 가운데, 빈 노드 `spawn_in`·`door_out`·`light_*`. 방 GLB 는 1.7m 사람 기준이라
    /// 이 판 사람 키(3.4m)에 맞춰 <see cref="RoomScale"/> 배. 충돌체는 GLB 에 없어 바닥·벽 박스를 덧붙인다(천장은 안 닫는다 — 카메라가 위에서 내려다본다).
    /// 안전장치: 방에서 떨어지거나 너무 멀어지면 밖으로 복귀 · 방 안에서 저장하면 밖 복귀 자리로 치환(<see cref="SavePosition"/>).
    /// </summary>
    public class GoHouseInterior : MonoBehaviour
    {
        public const string RoomPath = "World/int_hanok_01";
        public const float RoomScale = 2f;                       // 3.4 / 1.7
        public static readonly Vector3 PocketOffset = new Vector3(0f, 0f, 1000f);
        public const float EnterRadius = 1.8f, ExitRadius = 1.2f, MinLandingGap = 2.6f, Cooldown = 1.5f, LostDistance = 60f;

        public static GoHouseInterior Instance { get; private set; }

        public bool Inside { get; private set; }
        public Vector3 DoorOutdoor { get; private set; }       // 문 앞 벽면(밖) — 여기 다가가면 들어간다
        public Vector3 LandingOutdoor { get; private set; }    // 나올 때 서는 자리(재진입 반경 밖)
        public Vector3 LandingIndoor { get; private set; }     // 들어오면 서는 자리
        public Vector3 ExitIndoor { get; private set; }        // 방 안 문 자리 — 여기 다가가면 나간다
        public Bounds RoomBounds { get; private set; }
        public int LightCount { get; private set; }
        public Transform Room { get; private set; }

        private Transform _player;
        private PlayerController _pc;
        private float _cooldown;

        /// <summary>마을집이 서고 방 GLB 가 있으면 방을 세운다(없으면 아무것도 안 한다). `GameBootstrap.Start` 가 부른다.</summary>
        public static GoHouseInterior Install()
        {
            if (Instance != null) return Instance;
            var house = GameObject.Find("House_2");
            var room = Resources.Load<GameObject>(RoomPath);
            if (house == null || room == null) return null;
            var wall = house.transform.Find("Wall");
            var col = wall != null ? wall.GetComponent<BoxCollider>() : null;
            if (col == null) return null;
            var go = new GameObject("HouseInterior");
            var gi = go.AddComponent<GoHouseInterior>();
            gi.Build(house.transform, col.bounds, room);
            return gi;
        }

        /// <summary>저장할 플레이어 위치 — 방 안이면 밖 복귀 자리(불러오면 포켓 공간에 떨어지지 않게).</summary>
        public static Vector3 SavePosition(Vector3 current) => Instance != null && Instance.Inside ? Instance.LandingOutdoor : current;

        private void Awake() { Instance = this; }
        private void OnDestroy() { if (Instance == this) Instance = null; }

        private void Build(Transform house, Bounds wallBounds, GameObject roomPrefab)
        {
            float groundY = wallBounds.min.y;
            DoorOutdoor = new Vector3(wallBounds.center.x, groundY, wallBounds.min.z);
            LandingOutdoor = DoorOutdoor + new Vector3(0f, 0.1f, -4.5f);

            Room = Object.Instantiate(roomPrefab, house.position + PocketOffset, Quaternion.identity, transform).transform;
            Room.name = "Room";
            Room.localScale = Vector3.one * RoomScale;
            foreach (var c in Room.GetComponentsInChildren<Collider>(true)) Destroy(c);
            ToonMaterials(Room);

            var rs = Room.GetComponentsInChildren<Renderer>(true);
            Bounds b = rs[0].bounds;
            foreach (var r in rs) b.Encapsulate(r.bounds);
            RoomBounds = b;

            // 문·시작 자리(K-0026 빈 노드) — 없으면 크기에서 짐작(문 = 남쪽 가운데)
            Vector3 door = new Vector3(b.center.x, b.min.y, b.min.z + 0.4f);
            var doorNode = FindDeep(Room, "door_out");
            if (doorNode != null) door = new Vector3(doorNode.position.x, b.min.y, doorNode.position.z);
            ExitIndoor = door;
            Vector3 spawn = door + Vector3.forward * MinLandingGap;
            var spawnNode = FindDeep(Room, "spawn_in");
            if (spawnNode != null && Flat(spawnNode.position - door) >= MinLandingGap) spawn = new Vector3(spawnNode.position.x, b.min.y, spawnNode.position.z);
            LandingIndoor = spawn + Vector3.up * 0.1f;

            BuildColliders(b);
            BuildLights();
        }

        private void Update()
        {
            if (_player == null) { Resolve(); if (_player == null) return; }
            if (_cooldown > 0f) { _cooldown -= Time.deltaTime; return; }
            Vector3 p = _player.position;
            if (!Inside)
            {
                if (Mathf.Abs(p.y - DoorOutdoor.y) < 3f && Flat(p - DoorOutdoor) < EnterRadius) Enter();
            }
            else
            {
                bool lost = p.y < RoomBounds.min.y - 20f || Flat(p - RoomBounds.center) > LostDistance;
                if (lost || Flat(p - ExitIndoor) < ExitRadius) Exit();
            }
        }

        private void Resolve()
        {
            var go = GameObject.FindWithTag("Player");
            if (go == null) return;
            _player = go.transform;
            _pc = go.GetComponent<PlayerController>();
        }

        /// <summary>들어간다 — 진단도 부른다.</summary>
        public void Enter()
        {
            if (Inside || _player == null) return;
            Move(LandingIndoor);
            Inside = true;
            _cooldown = Cooldown;
        }

        /// <summary>나온다 — 진단도 부른다.</summary>
        public void Exit()
        {
            if (!Inside || _player == null) return;
            Move(LandingOutdoor);
            Inside = false;
            _cooldown = Cooldown;
        }

        private void Move(Vector3 pos)
        {
            if (_pc != null) _pc.Teleport(pos);
            else _player.position = pos;
        }

        /// <summary>바닥 박스 + 네 벽 박스(방 경계 바깥에 붙여 가구와 안 겹친다). 천장은 안 닫는다.</summary>
        private void BuildColliders(Bounds b)
        {
            var root = new GameObject("RoomColliders").transform;
            root.SetParent(transform, false);
            const float t = 0.6f;
            float h = Mathf.Max(b.size.y, 6f);
            Box(root, "Floor", new Vector3(b.center.x, b.min.y - t * 0.5f, b.center.z), new Vector3(b.size.x + 2f, t, b.size.z + 2f));
            Box(root, "WallS", new Vector3(b.center.x, b.min.y + h * 0.5f, b.min.z - t * 0.5f), new Vector3(b.size.x + 2f, h, t));
            Box(root, "WallN", new Vector3(b.center.x, b.min.y + h * 0.5f, b.max.z + t * 0.5f), new Vector3(b.size.x + 2f, h, t));
            Box(root, "WallW", new Vector3(b.min.x - t * 0.5f, b.min.y + h * 0.5f, b.center.z), new Vector3(t, h, b.size.z + 2f));
            Box(root, "WallE", new Vector3(b.max.x + t * 0.5f, b.min.y + h * 0.5f, b.center.z), new Vector3(t, h, b.size.z + 2f));
        }

        private static void Box(Transform parent, string name, Vector3 center, Vector3 size)
        {
            var go = new GameObject(name);
            go.transform.SetParent(parent, false);
            go.transform.position = center;
            go.AddComponent<BoxCollider>().size = size;
        }

        /// <summary>`light_*` 빈 노드마다 점광 — 지붕·천장이 햇빛을 가려 방이 어두우니 따뜻한 점광으로 채운다. 없으면 가운데 하나.</summary>
        private void BuildLights()
        {
            var spots = new List<Vector3>();
            foreach (var t in Room.GetComponentsInChildren<Transform>(true)) if (t.name.StartsWith("light_")) spots.Add(t.position);
            if (spots.Count == 0) spots.Add(RoomBounds.center + Vector3.up * (RoomBounds.extents.y * 0.6f));
            foreach (var pos in spots)
            {
                var l = new GameObject("RoomLight").AddComponent<Light>();
                l.transform.SetParent(transform, false);
                l.transform.position = pos;
                l.type = LightType.Point;
                l.color = new Color(1f, 0.88f, 0.7f);
                l.range = Mathf.Max(RoomBounds.size.x, RoomBounds.size.z) * 0.9f;
                l.intensity = 2.2f;
                l.shadows = LightShadows.None;
            }
            LightCount = spots.Count;
        }

        private static void ToonMaterials(Transform root)
        {
            var cache = new Dictionary<Material, Material>();
            var mats = new List<Material>();
            foreach (var r in root.GetComponentsInChildren<Renderer>(true))
            {
                r.GetSharedMaterials(mats);
                bool changed = false;
                for (int i = 0; i < mats.Count; i++)
                {
                    var made = RegionMaterials.FromGltf(mats[i], cache, out _);
                    if (made != null && made != mats[i]) { mats[i] = made; changed = true; }
                }
                if (changed) r.SetSharedMaterials(mats);
            }
        }

        private static Transform FindDeep(Transform root, string name)
        {
            foreach (var t in root.GetComponentsInChildren<Transform>(true)) if (t.name == name) return t;
            return null;
        }

        private static float Flat(Vector3 v) => new Vector2(v.x, v.z).magnitude;
    }
}
