using System.Collections.Generic;
using UnityEngine;
using Saga.Core.Region;
using Saga.Go.Data;
using Saga.Go.UI;

namespace Saga.Go.World
{
    /// <summary>
    /// tasks U-0032 쉼터 마당 월드(saga-godot `world/homestead.gd`) — 마당 중심(<see cref="GoHomestead.Center"/>)에 표지(등롱 하나 + 비석 여덟 줄)를 세우고,
    /// <see cref="HomeState"/> 의 놓은 소품을 서 있게 한다(충돌 없음). 모델은 `Resources/Regions/Pieces` 의 것을 CelToon 으로 바꿔 쓰고 없는 모양은 도형이다.
    /// 놓기·치우기·수확은 여기 있고 화면(`HomesteadUi`)과 진단이 함께 부른다. `WorldMapBuilder` 가 Play 때 붙인다.
    /// </summary>
    public class HomesteadField : MonoBehaviour
    {
        public static HomesteadField Instance { get; private set; }

        private Transform _marker, _itemsRoot, _player;
        private readonly Dictionary<string, GameObject> _prefabs = new Dictionary<string, GameObject>();
        private readonly Dictionary<Material, Material> _matCache = new Dictionary<Material, Material>();
        private readonly Dictionary<Color, Material> _colorMats = new Dictionary<Color, Material>();

        public Vector3 Center => GoHomestead.Center;
        public int PlacedObjects => _itemsRoot != null ? _itemsRoot.childCount : 0;
        public int MarkerObjects => _marker != null ? _marker.childCount : 0;
        public Transform Player => _player;

        private void Awake()
        {
            Instance = this;
            _marker = new GameObject("HomesteadMarker").transform; _marker.SetParent(transform, false);
            _itemsRoot = new GameObject("HomesteadItems").transform; _itemsRoot.SetParent(transform, false);
        }

        private void Start()
        {
            ResolvePlayer();
            BuildMarker();
            Rebuild();
            HomeState.Changed += Rebuild;
        }

        private void OnDestroy()
        {
            HomeState.Changed -= Rebuild;
            if (Instance == this) Instance = null;
        }

        private void ResolvePlayer()
        {
            var go = GameObject.FindWithTag("Player");
            _player = go != null ? go.transform : null;
        }

        public bool Near => Dist() <= GoHomestead.PromptM;
        public bool Inside => Dist() <= GoHomestead.Radius;

        private float Dist()
        {
            if (_player == null) ResolvePlayer();
            if (_player == null) return float.MaxValue;
            var c = Center;
            return new Vector2(_player.position.x - c.x, _player.position.z - c.z).magnitude;
        }

        // ---- 땅·모델 ----

        public static float GroundY(float x, float z)
        {
            if (Physics.Raycast(new Vector3(x, 200f, z), Vector3.down, out RaycastHit hit, 400f, ~0, QueryTriggerInteraction.Ignore)) return hit.point.y;
            return 0f;
        }

        private Material ColorMat(Color c)
        {
            if (!_colorMats.TryGetValue(c, out var m)) _colorMats[c] = m = RegionMaterials.Toon(null, c);
            return m;
        }

        private GameObject Shape(PrimitiveType t, Transform parent, Vector3 pos, Vector3 scale, Color c)
        {
            var g = GameObject.CreatePrimitive(t);
            Destroy(g.GetComponent<Collider>());
            g.transform.SetParent(parent, false);
            g.transform.localPosition = pos; g.transform.localScale = scale;
            g.GetComponent<MeshRenderer>().sharedMaterial = ColorMat(c);
            return g;
        }

        /// <summary>모델이 없는 소품은 도형으로 — 갈대·꽃덤불·정원석·느티나무·소나무·좌판.</summary>
        private GameObject BuildShape(string id)
        {
            var root = new GameObject("Shape_" + id).transform;
            var green = new Color(0.22f, 0.45f, 0.2f); var trunk = new Color(0.36f, 0.25f, 0.15f);
            switch (id)
            {
                case "reed":
                    for (int i = 0; i < 6; i++) Shape(PrimitiveType.Cylinder, root, new Vector3(Mathf.Sin(i * 1.7f) * 0.35f, 0.8f, Mathf.Cos(i * 1.7f) * 0.35f), new Vector3(0.05f, 0.8f + 0.12f * (i % 3), 0.05f), new Color(0.55f, 0.6f, 0.3f));
                    break;
                case "flowers":
                    Shape(PrimitiveType.Sphere, root, new Vector3(0f, 0.45f, 0f), new Vector3(1.3f, 0.9f, 1.3f), green);
                    for (int i = 0; i < 5; i++) Shape(PrimitiveType.Sphere, root, new Vector3(Mathf.Sin(i * 1.26f) * 0.5f, 0.85f, Mathf.Cos(i * 1.26f) * 0.5f), Vector3.one * 0.25f, i % 2 == 0 ? new Color(0.95f, 0.45f, 0.6f) : new Color(0.95f, 0.85f, 0.3f));
                    break;
                case "rock":
                    Shape(PrimitiveType.Sphere, root, new Vector3(0f, 0.35f, 0f), new Vector3(1.2f, 0.7f, 0.95f), new Color(0.5f, 0.5f, 0.52f));
                    break;
                case "tree":
                    Shape(PrimitiveType.Cylinder, root, new Vector3(0f, 2f, 0f), new Vector3(0.7f, 2f, 0.7f), trunk);
                    Shape(PrimitiveType.Sphere, root, new Vector3(0f, 5.2f, 0f), new Vector3(4.6f, 3.6f, 4.6f), green);
                    break;
                case "pine":
                    Shape(PrimitiveType.Cylinder, root, new Vector3(0f, 1.2f, 0f), new Vector3(0.6f, 1.2f, 0.6f), trunk);
                    for (int i = 0; i < 3; i++) Shape(PrimitiveType.Sphere, root, new Vector3(0f, 3f + i * 1.6f, 0f), new Vector3(3.4f - i * 0.9f, 1.8f, 3.4f - i * 0.9f), new Color(0.12f, 0.32f, 0.2f));
                    break;
                case "stall":
                    Shape(PrimitiveType.Cube, root, new Vector3(0f, 0.9f, 0f), new Vector3(2.4f, 0.2f, 1.4f), trunk);
                    for (int i = 0; i < 4; i++) Shape(PrimitiveType.Cylinder, root, new Vector3(i % 2 == 0 ? -1.1f : 1.1f, 1.6f, i < 2 ? -0.6f : 0.6f), new Vector3(0.1f, 1.6f, 0.1f), trunk);
                    Shape(PrimitiveType.Cube, root, new Vector3(0f, 3.3f, 0f), new Vector3(2.8f, 0.15f, 1.8f), new Color(0.75f, 0.25f, 0.2f));
                    break;
                default:
                    Shape(PrimitiveType.Cube, root, new Vector3(0f, 0.5f, 0f), Vector3.one, new Color(0.6f, 0.6f, 0.6f));
                    break;
            }
            return root.gameObject;
        }

        private GameObject Make(GoHomestead.Item it)
        {
            if (!string.IsNullOrEmpty(it.Model))
            {
                if (!_prefabs.TryGetValue(it.Model, out var prefab)) _prefabs[it.Model] = prefab = Resources.Load<GameObject>(it.Model);
                if (prefab != null)
                {
                    var g = Instantiate(prefab);
                    foreach (var r in g.GetComponentsInChildren<Renderer>(true))
                    {
                        var mats = r.sharedMaterials; bool any = false;
                        for (int i = 0; i < mats.Length; i++)
                        {
                            var m = RegionMaterials.FromGltf(mats[i], _matCache, out _);
                            if (m != null && m != mats[i]) { mats[i] = m; any = true; }
                        }
                        if (any) r.sharedMaterials = mats;
                    }
                    return g;
                }
            }
            return BuildShape(it.Id);
        }

        // ---- 마당 그리기 ----

        private void BuildMarker()
        {
            var c = Center;
            var lamp = Resources.Load<GameObject>("Regions/Pieces/stone_lantern_01");
            var stele = Resources.Load<GameObject>("Regions/Pieces/stele_01");
            if (lamp != null)
            {
                var l = Instantiate(lamp, _marker);
                l.transform.position = new Vector3(c.x, GroundY(c.x, c.z), c.z);
                l.transform.localScale = Vector3.one * 0.8f;
            }
            for (int i = 0; i < 8; i++)
            {
                float a = Mathf.PI * 2f * i / 8f;
                float x = c.x + Mathf.Cos(a) * GoHomestead.Radius, z = c.z + Mathf.Sin(a) * GoHomestead.Radius;
                GameObject s = stele != null ? Instantiate(stele, _marker) : BuildShape("rock");
                s.transform.SetParent(_marker, false);
                s.transform.position = new Vector3(x, GroundY(x, z), z);
                s.transform.rotation = Quaternion.Euler(0f, -a * Mathf.Rad2Deg, 0f);
                s.transform.localScale = Vector3.one * 0.9f;
            }
        }

        /// <summary>놓은 소품을 다시 세운다 — 세이브를 불러왔거나 놓기·치우기 뒤.</summary>
        public void Rebuild()
        {
            if (_itemsRoot == null) return;
            for (int i = _itemsRoot.childCount - 1; i >= 0; i--)
            {
                var old = _itemsRoot.GetChild(i);
                old.SetParent(null);   // Destroy 는 프레임 끝에 일어나므로 먼저 떼어 낸다(세는 수가 어긋나지 않게)
                Destroy(old.gameObject);
            }
            foreach (var e in HomeState.Items)
            {
                var it = GoHomestead.Find(e.id);
                if (it == null) continue;
                var g = Make(it);
                g.name = "Home_" + e.id;
                g.transform.SetParent(_itemsRoot, false);
                g.transform.position = new Vector3(e.x, GroundY(e.x, e.z), e.z);
                g.transform.rotation = Quaternion.Euler(0f, e.r * 90f, 0f);
                g.transform.localScale = Vector3.one * it.Scale;
            }
        }

        // ---- 행동 (화면 단추·진단이 함께 부른다) ----

        /// <summary>서 있는 자리에 놓는다 — 오류 글(성공이면 "").</summary>
        public string PlaceHere(string pickId, int rot)
        {
            if (_player == null) ResolvePlayer();
            if (_player == null) return GoLocalization.T("home.err.noplayer", "플레이어가 없다");
            var p = _player.position;
            string err = HomeState.Place(pickId, p.x, p.z, rot, Center);
            if (err.Length > 0) { Toast(err); return err; }
            Toast(string.Format(GoLocalization.T("home.placed", "{0} 을(를) 놓았다 — 안락도 {1}"), GoHomestead.Find(pickId).Name, HomeState.Comfort()));
            return "";
        }

        /// <summary>곁(3m 안)의 가장 가까운 소품을 치운다 — 치운 id(없으면 "").</summary>
        public string RemoveNearby()
        {
            if (_player == null) ResolvePlayer();
            if (_player == null) return "";
            var p = _player.position;
            string id = HomeState.RemoveNear(p.x, p.z, GoHomestead.RemoveReach);
            if (id.Length == 0) { Toast(string.Format(GoLocalization.T("home.err.nothing", "곁에 치울 소품이 없다 ({0}m 안)"), (int)GoHomestead.RemoveReach)); return ""; }
            var it = GoHomestead.Find(id);
            Toast(string.Format(GoLocalization.T("home.removed", "{0} 을(를) 치웠다 — 금 {1} 돌려받음"), it.Name, Mathf.FloorToInt(it.Cost * GoHomestead.Refund)));
            return id;
        }

        /// <summary>수확 — 받은 금.</summary>
        public int HarvestNow()
        {
            int n = HomeState.Harvest();
            Toast(n > 0 ? string.Format(GoLocalization.T("home.harvested", "🏡 쉼터에서 금 {0} 을(를) 거뒀다"), n) : GoLocalization.T("home.nothing_yet", "아직 쌓인 금이 없다"));
            return n;
        }

        private static void Toast(string text)
        {
            if (DialogueLabel.Instance != null && !string.IsNullOrEmpty(text)) DialogueLabel.Instance.Show(text, 2.2f);
        }
    }
}
