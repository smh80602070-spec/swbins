using UnityEngine;
using Saga.Forest.Data;
using Saga.Forest.UI;

namespace Saga.Forest.World
{
    /// <summary>
    /// FOREST "가구 자유 배치"(2026-09-13, `ForestFurnitureAnchor.cs`의
    /// 뒤를 잇는다 — 고정 자리 여섯 개별 GameObject 대신 방 전체를 격자로
    /// 보는 컴포넌트 하나). 플레이어가 지금 서 있는 칸(`ForestHomeState
    /// .WorldToCell`)에 다가가면(칸 중심에서 `ProximityRadius` 안) 비었으면
    /// 놓고 있으면 거둔다 — 이 트랙의 기존 관례("다가가면 반응")를 그대로
    /// 격자 전체로 넓힌 것뿐, 새 입력 동사는 안 만들었다.
    ///
    /// 쿨다운을 **칸별이 아니라 이 컴포넌트 전체에 하나**로 뒀다 —
    /// 걸어서 여러 칸을 빠르게 지나가도 한 번에 하나씩만 뒤집힌다(원작
    /// `ForestFurnitureAnchor.cs`는 자리마다 쿨다운이 따로였는데, 그건
    /// 자리가 여섯뿐이라 무해했지만 격자가 열여덟 칸으로 늘며 굳이 자리별로
    /// 쿨다운을 각각 관리할 이유가 없어졌다 — 오히려 전역 쿨다운 하나가
    /// "방을 가로지르며 여기저기 놓임" 사고를 막아 준다).
    /// </summary>
    public class ForestFurniturePlacer : MonoBehaviour
    {
        private const float ProximityRadius = 0.45f; // TileSize(1m)의 절반보다 좁게 — 칸 사이에 죽은 영역을 둔다.
        private const float CooldownSec = 1f;
        private const float ToastSec = 3f;

        [SerializeField] private Transform indoorRoom; // 격자 좌표의 기준(로컬 원점).

        private Transform _player;
        private Transform _visualsRoot;
        private bool _synced;
        private float _cooldownLeft;

        public void SetIndoorRoom(Transform room) => indoorRoom = room;

        private void Awake()
        {
            var playerGo = GameObject.FindWithTag("Player");
            _player = playerGo != null ? playerGo.transform : null;

            var visualsGo = new GameObject("FurnitureVisuals");
            visualsGo.transform.SetParent(transform, false);
            _visualsRoot = visualsGo.transform;

            ForestHomeState.Changed += RebuildVisuals;
        }

        private void OnDestroy()
        {
            ForestHomeState.Changed -= RebuildVisuals;
        }

        private void Update()
        {
            // ForestFurnitureAnchor.cs와 같은 이유 — GameBootstrap.Start()의
            // 로드보다 이 Awake가 먼저 돌 수 있어, 첫 Update 프레임에 한
            // 번만 로드된 값 기준으로 짓는다.
            if (!_synced)
            {
                _synced = true;
                RebuildVisuals();
            }

            if (_cooldownLeft > 0f) _cooldownLeft -= Time.deltaTime;
            if (_player == null || indoorRoom == null || _cooldownLeft > 0f) return;

            Vector3 localPos = indoorRoom.InverseTransformPoint(_player.position);
            var cell = ForestHomeState.WorldToCell(localPos);
            Vector3 cellCenterLocal = ForestHomeState.CellToLocal(cell);
            if (Vector3.Distance(localPos, cellCenterLocal) > ProximityRadius) return;
            if (!ForestHomeState.IsValidCell(cell)) return;

            _cooldownLeft = CooldownSec;
            string current = ForestHomeState.CellItem(cell);
            if (!string.IsNullOrEmpty(current))
            {
                string pickedId = ForestHomeState.PickUp(cell);
                var item = FurnitureItem.Get(pickedId);
                DialogueLabel.Instance?.Show(
                    string.Format(ForestLocalization.T("furniture.placer.pickup", "{0}을(를) 창고로 거두었다."),
                        item != null ? item.Name : pickedId),
                    ToastSec);
            }
            else
            {
                string placedId = ForestHomeState.TryPlaceAny(cell);
                if (placedId == null)
                {
                    DialogueLabel.Instance?.Show(
                        ForestLocalization.T("furniture.placer.empty_storage", "놓을 가구가 창고에 없다 — 가구전에서 먼저 사야 한다."),
                        ToastSec);
                    return;
                }
                var item = FurnitureItem.Get(placedId);
                var (total, count, _, _) = ForestHomeState.Score();
                DialogueLabel.Instance?.Show(
                    string.Format(ForestLocalization.T("furniture.placer.placed", "{0}을(를) 놓았다 — 집 평가: {1}({2}점, 가구 {3}개)"),
                        item != null ? item.Name : placedId, FurnitureItem.GradeName(total), total, count),
                    ToastSec);
            }
        }

        private void RebuildVisuals()
        {
            if (_visualsRoot == null) return;
            for (int i = _visualsRoot.childCount - 1; i >= 0; i--)
            {
                Object.Destroy(_visualsRoot.GetChild(i).gameObject);
            }

            foreach (var kv in ForestHomeState.AllPlacements())
            {
                SpawnVisual(kv.Key, kv.Value);
            }
        }

        private void SpawnVisual(Vector2Int cell, string itemId)
        {
            var item = FurnitureItem.Get(itemId);
            if (item == null) return;
            if (TrySpawnModel(cell, itemId)) return; // U-0033 — 자체툴 실내 물건 3D. 없으면 아래 도형.

            var visual = GameObject.CreatePrimitive(item.IsCylinder ? PrimitiveType.Cylinder : PrimitiveType.Cube);
            visual.name = $"Furniture_{cell.x}_{cell.y}";
            visual.transform.SetParent(_visualsRoot, false);

            float sizeScale = Mathf.Lerp(0.3f, 0.8f, Mathf.InverseLerp(400f, 5200f, item.Value));
            Vector3 scale = item.IsCylinder
                ? new Vector3(sizeScale * 0.7f, sizeScale, sizeScale * 0.7f)
                : new Vector3(sizeScale, sizeScale * 0.8f, sizeScale * 0.6f);
            visual.transform.localScale = scale;
            visual.transform.localPosition = ForestHomeState.CellToLocal(cell) + new Vector3(0f, scale.y * 0.5f, 0f);

            var mat = new Material(Shader.Find("Universal Render Pipeline/Lit")) { name = "ForestFurniture (generated)" };
            mat.color = SetColor(item.Set);
            visual.GetComponent<MeshRenderer>().sharedMaterial = mat;
            Object.Destroy(visual.GetComponent<Collider>());
        }

        private const float ModelMaxSize = 0.9f; // 한 칸(1m) 안에 — 가장 넓은 변이 이를 넘으면 줄인다.

        /// <summary>U-0033 — 가구 id 에 맞는 GLB 가 있으면 그것을(툰 재질·콜라이더 없음·바닥을 칸 높이에) 세운다. 없으면 false.</summary>
        private bool TrySpawnModel(Vector2Int cell, string itemId)
        {
            var prefab = ForestFurnitureModels.Load(itemId);
            if (prefab == null) return false;
            var go = Object.Instantiate(prefab, _visualsRoot);
            go.name = $"Furniture_{cell.x}_{cell.y}";
            go.transform.localRotation = Quaternion.identity;
            go.transform.localScale = Vector3.one;
            foreach (var c in go.GetComponentsInChildren<Collider>(true)) Object.Destroy(c);

            var cache = new System.Collections.Generic.Dictionary<Material, Material>();
            var mats = new System.Collections.Generic.List<Material>();
            Bounds b = default;
            bool any = false;
            foreach (var r in go.GetComponentsInChildren<Renderer>(true))
            {
                r.GetSharedMaterials(mats);
                bool changed = false;
                for (int i = 0; i < mats.Count; i++)
                {
                    var made = Saga.Core.Region.RegionMaterials.FromGltf(mats[i], cache, out _);
                    if (made != null && made != mats[i]) { mats[i] = made; changed = true; }
                }
                if (changed) r.SetSharedMaterials(mats);
                if (!any) { b = r.bounds; any = true; } else b.Encapsulate(r.bounds);
            }
            if (!any) { Object.Destroy(go); return false; }

            float wide = Mathf.Max(b.size.x, b.size.z);
            float k = wide > ModelMaxSize ? ModelMaxSize / wide : 1f;
            go.transform.localScale = Vector3.one * k;
            // 줄인 뒤 바닥(b.min.y 는 월드값 — 부모 변환 없이 지역으로 바꿔 계산)이 칸 높이에 닿도록.
            float bottomLocal = (b.min.y - go.transform.position.y) * k;
            go.transform.localPosition = ForestHomeState.CellToLocal(cell) + new Vector3(0f, -bottomLocal, 0f);
            return true;
        }

        // 웹판 `data-village.js` FURN_SETS 색 그대로(안방·사랑방·부엌·뜰).
        private static Color SetColor(FurnitureSet set) => set switch
        {
            FurnitureSet.Anbang => new Color(0.788f, 0.541f, 0.290f),
            FurnitureSet.Sarang => new Color(0.478f, 0.416f, 0.604f),
            FurnitureSet.Buok => new Color(0.659f, 0.353f, 0.235f),
            FurnitureSet.Ddeul => new Color(0.353f, 0.604f, 0.353f),
            FurnitureSet.Janchi => new Color(0.816f, 0.271f, 0.353f), // 109-12-1 — 웹 잔치 #d0455a
            _ => Color.gray,
        };
    }
}
