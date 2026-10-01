using Saga.Core;
using UnityEngine;
using Saga.Realm.Data;

namespace Saga.Realm.World
{
    /// <summary>
    /// VERTICAL_SLICE_REALM.md 2절 "3D로 뭘 새로 얹나"·2-1절 "디오라마로
    /// 재구성"(saga-godot REALM 참고, 개념만 — city3d.js "장식이 아니라
    /// 읽는 화면": 성벽·인구 등을 소품 개수로 그대로 세운다) — Unity
    /// 관용구로 새로 지었다. GLB 자산 없음(8장 우선순위 밖, 성 디오라마는
    /// primitive로 충분하다는 GO/DUNGEON 초기 판단과 같은 결) — 전부
    /// Cube/Cylinder 조합.
    ///
    /// `RealmCityState.Changed`를 구독해 값이 바뀔 때마다 다시 짓는다
    /// (realm_city.gd의 "성 숫자가 바뀔 때만 다시 짓는다"와 같은 습관이되,
    /// 이 슬라이스는 성이 하나뿐이라 sig() 캐시 없이 매번 다시 지어도
    /// 소품 수가 적어 무해하다).
    ///
    /// "성벽 3단" 슬라이스(2026-09-22, PLAN.md 103-1 변형 배가 마지막 항목) —
    /// `record.Wall`(명령 "성벽 보수"로 `def.BaseWall`~`def.BaseWall*2`까지
    /// 오르는 실제 방어 수치, `RealmCityState.CapOf("wall", def)`)를 그대로
    /// 디오라마에 반영한다. 새 지오메트리 없이 기존 Cube/Cylinder를 더 크게·
    /// 더 많이 배치하는 것만으로 3단을 표현했다(GO `LandmarksBuilder`·DUNGEON
    /// `DungeonRoomBuilder`와 같은 원칙) — 담장 높이/두께·망루 크기가
    /// 단계별로 커지고, 2단부터 망루에 지붕 갓, 3단부터 벽 중앙 보조 망루
    /// 셋(북·동·서)과 남문 양옆 문루 한 쌍이 늘어난다.
    /// </summary>
    public class RealmCityBuilder : MonoBehaviour
    {
        private const int MaxFarms = 10;
        private const int MaxMarkets = 10;
        private const int MaxGranaries = 6;

        private static readonly Color GroundColor = new Color(0.42f, 0.55f, 0.32f);
        private static readonly Color WallColor = new Color(0.55f, 0.52f, 0.46f);
        private static readonly Color KeepColor = new Color(0.6f, 0.42f, 0.28f);
        private static readonly Color FarmColor = new Color(0.62f, 0.68f, 0.22f);
        private static readonly Color MarketColor = new Color(0.75f, 0.35f, 0.18f);
        private static readonly Color GranaryColor = new Color(0.45f, 0.32f, 0.18f);
        private static readonly Color FlagColor = new Color(0.85f, 0.75f, 0.15f);

        // 44장 "Environment/Building" 교체(2026-09-14) — REALM은 Player/Enemy
        // 개념 자체가 안 맞는 경영 게임이라(클래스 주석의 "8장 우선순위 밖"
        // 판단 그대로) 44장 표를 그대로 적용할 수 없었다. 이 게임에서
        // "환경"에 해당하는 건 성 디오라마의 바닥·성벽/망루/천수각 —
        // GO/DUNGEON이 primitive에 EnvironmentMaterial.MakeTiled로 PBR 재질을
        // 씌운 것과 같은 방식을 그대로 옮겼다(REALM 소품은 전부 Unity 기본
        // primitive라 GLB 아틀라스 UV 문제 자체가 없다 — 클래스 주석 "GLB
        // 자산 없음"). 바닥=cobblestone_floor_01(성 안뜰 포장), 성벽/망루/
        // 천수각=castle_wall_slates. 농장·저잣거리·곳간·깃발은 색상 소품
        // 그대로 둔다(DUNGEON이 Props/Vegetation을 보류한 것과 같은 범위).
        [SerializeField] private Material groundMaterial;
        [SerializeField] private Material wallMaterial;

        // 이어서(2026-09-14 후속) — 농장/저잣거리/곳간까지 확장. 깃발·천수각
        // 지붕은 그대로 색상 소품(깃발은 텍스처를 씌울 만한 표면이 아니고,
        // 천수각 지붕은 벽과 재질이 겹치면 실루엣이 안 갈린다 — 클래스 상단
        // 주석과 같은 이유로 이번에도 보류).
        [SerializeField] private Material farmMaterial;    // leafy_grass
        [SerializeField] private Material marketMaterial;  // dark_wooden_planks

        // "성벽 3단" — 담장 높이/두께·망루 크기의 단계별 배율(0=기본).
        private static readonly float[] WallHeightByTier = { 1.6f, 2.1f, 2.6f };
        private static readonly float[] WallThickByTier = { 0.5f, 0.65f, 0.8f };
        private static readonly float[] TowerScaleByTier = { 1f, 1.25f, 1.55f };

        private bool _synced;

        private void Awake()
        {
            RealmCityState.Changed += Rebuild;
        }

        private void Update()
        {
            // ForestFurnitureAnchor.cs와 같은 이유 — GameBootstrap.Start()의
            // RealmSaveState.TryLoad()보다 이 Awake가 먼저 돌 수 있어, 첫
            // Update 프레임에 한 번만 로드된 값 기준으로 짓는다.
            if (_synced) return;
            _synced = true;
            Rebuild();
        }

        private void OnDestroy()
        {
            RealmCityState.Changed -= Rebuild;
        }

        /// <summary>edit-time 씬 빌드가 직접 부른다(Awake는 Play 모드에서만
        /// 자동으로 돈다 — StoryTerrainBuilder.cs와 같은 이유).</summary>
        public void Rebuild()
        {
            for (int i = transform.childCount - 1; i >= 0; i--)
            {
                DestroyImmediate(transform.GetChild(i).gameObject);
            }

            var record = RealmCityState.CityRecord(RealmCityState.CurrentCity);
            if (record == null) return; // 씬 첫 로드 등 아직 상태가 없을 때 — 다음 Changed에서 다시 지음.
            var def = RealmCityData.Get(RealmCityState.CurrentCity);

            BuildGround();
            BuildWallAndTowers(WallTier(record.Wall, def));
            BuildKeep();
            BuildRosterFlags();
            BuildCountedProps("Farm", Mathf.Clamp(record.Agri / 90, 0, MaxFarms), FarmColor,
                PrimitiveType.Cube, new Vector3(1.4f, 0.3f, 1.4f), radius: 5.5f, y: 0.15f, pbrMaterial: farmMaterial);
            BuildCountedProps("Market", Mathf.Clamp(record.Comm / 80, 0, MaxMarkets), MarketColor,
                PrimitiveType.Cube, new Vector3(1.0f, 0.9f, 1.0f), radius: 7.5f, y: 0.45f, pbrMaterial: marketMaterial);
            BuildCountedProps("Granary", Mathf.Clamp(record.Food / 400, 0, MaxGranaries), GranaryColor,
                PrimitiveType.Cylinder, new Vector3(1.1f, 1.4f, 1.1f), radius: 9.2f, y: 0.7f, pbrMaterial: wallMaterial);
        }

        private static GameObject Spawn(string name, Transform parent, PrimitiveType type, Vector3 localPos,
            Vector3 scale, Color color, Material pbrMaterial = null)
        {
            var go = GameObject.CreatePrimitive(type);
            go.name = name;
            go.transform.SetParent(parent, false);
            go.transform.localPosition = localPos;
            go.transform.localScale = scale;
            if (pbrMaterial != null)
            {
                go.GetComponent<MeshRenderer>().sharedMaterial = pbrMaterial;
            }
            else
            {
                var mat = new Material(Shader.Find("Universal Render Pipeline/Lit")) { name = $"{name} (generated)" };
                mat.color = color;
                go.GetComponent<MeshRenderer>().sharedMaterial = mat;
            }
            return go;
        }

        private void BuildGround()
        {
            var mat = groundMaterial != null ? EnvironmentMaterial.MakeTiled(groundMaterial, 14f, 14f) : null;
            Spawn("Ground", transform, PrimitiveType.Cylinder, new Vector3(0f, -0.05f, 0f),
                new Vector3(14f, 0.1f, 14f), GroundColor, mat);
        }

        /// <summary>PLAN.md 103-1 "성벽 3단" — `record.Wall`을 `def.BaseWall`
        /// (0단)~`def.BaseWall*2`(`RealmCityState.CapOf("wall", def)`, 3단
        /// 문턱)로 삼등분한다. def가 없으면(방어적으로만) 0단.</summary>
        private static int WallTier(int wall, RealmCityDef def)
        {
            if (def == null || def.BaseWall <= 0) return 0;
            float ratio = (float)wall / def.BaseWall;
            return ratio >= 1.67f ? 2 : ratio >= 1.33f ? 1 : 0;
        }

        /// <summary>담장 넷(남쪽만 문 폭만큼 비워 둔다) + 모서리 망루 넷 —
        /// realm_city.gd의 "대·누각·담장" 정적 실루엣과 같은 자리. 2단부터
        /// 같은 자리에 크기만 키우고 망루에 지붕 갓이 붙으며, 3단은 벽
        /// 중앙 보조 망루 셋(북·동·서)·남문 문루 한 쌍까지 늘어난다.</summary>
        private void BuildWallAndTowers(int wallTier)
        {
            const float r = 11f;
            float wallH = WallHeightByTier[wallTier];
            float wallThick = WallThickByTier[wallTier];
            float towerScale = TowerScaleByTier[wallTier];
            const float gateHalf = 1.4f; // 남쪽 벽 가운데 문 폭.

            Material WallMat(float widthMeters, float heightMeters) =>
                wallMaterial != null ? EnvironmentMaterial.MakeTiled(wallMaterial, widthMeters, heightMeters) : null;

            Spawn("Wall_North", transform, PrimitiveType.Cube, new Vector3(0f, wallH / 2f, r),
                new Vector3(r * 2f, wallH, wallThick), WallColor, WallMat(r * 2f, wallH));
            Spawn("Wall_East", transform, PrimitiveType.Cube, new Vector3(r, wallH / 2f, 0f),
                new Vector3(wallThick, wallH, r * 2f), WallColor, WallMat(r * 2f, wallH));
            Spawn("Wall_West", transform, PrimitiveType.Cube, new Vector3(-r, wallH / 2f, 0f),
                new Vector3(wallThick, wallH, r * 2f), WallColor, WallMat(r * 2f, wallH));
            // 남쪽 벽 — 문 폭만큼 가운데를 비우고 좌우 두 조각.
            float southSegLen = r - gateHalf;
            float southSegCenter = gateHalf + southSegLen / 2f;
            Spawn("Wall_South_East", transform, PrimitiveType.Cube, new Vector3(southSegCenter, wallH / 2f, -r),
                new Vector3(southSegLen, wallH, wallThick), WallColor, WallMat(southSegLen, wallH));
            Spawn("Wall_South_West", transform, PrimitiveType.Cube, new Vector3(-southSegCenter, wallH / 2f, -r),
                new Vector3(southSegLen, wallH, wallThick), WallColor, WallMat(southSegLen, wallH));

            SpawnTower("Tower_NE", new Vector3(r, 0f, r), towerScale, wallTier);
            SpawnTower("Tower_NW", new Vector3(-r, 0f, r), towerScale, wallTier);
            SpawnTower("Tower_SE", new Vector3(r, 0f, -r), towerScale, wallTier);
            SpawnTower("Tower_SW", new Vector3(-r, 0f, -r), towerScale, wallTier);

            if (wallTier >= 2)
            {
                float midScale = towerScale * 0.8f;
                SpawnTower("Tower_MidNorth", new Vector3(0f, 0f, r), midScale, wallTier);
                SpawnTower("Tower_MidEast", new Vector3(r, 0f, 0f), midScale, wallTier);
                SpawnTower("Tower_MidWest", new Vector3(-r, 0f, 0f), midScale, wallTier);

                float gateTowerX = gateHalf + 0.6f;
                SpawnTower("Tower_GateEast", new Vector3(gateTowerX, 0f, -r), midScale, wallTier);
                SpawnTower("Tower_GateWest", new Vector3(-gateTowerX, 0f, -r), midScale, wallTier);
            }
        }

        /// <summary>망루 하나 — 기존 모서리 망루 수치(반지름 1.2·반높이 1.1)를
        /// `scale`로 키운다. `wallTier`(0=1단)가 1 이상(2단부터)이면 지붕 갓
        /// (Keep과 같은 결의 얇은 Cylinder, 새 지오메트리 없음)을 얹는다.</summary>
        private void SpawnTower(string name, Vector3 groundPos, float scale, int wallTier)
        {
            Material WallMat(float widthMeters, float heightMeters) =>
                wallMaterial != null ? EnvironmentMaterial.MakeTiled(wallMaterial, widthMeters, heightMeters) : null;

            float halfHeight = 1.1f * scale;
            float radius = 1.2f * scale;
            var pos = groundPos + new Vector3(0f, halfHeight, 0f);
            Spawn(name, transform, PrimitiveType.Cylinder, pos, new Vector3(radius, halfHeight, radius), WallColor,
                WallMat(radius, halfHeight * 2f));

            if (wallTier >= 1)
            {
                var capPos = groundPos + new Vector3(0f, halfHeight * 2f + 0.15f, 0f);
                Spawn(name + "_Cap", transform, PrimitiveType.Cylinder, capPos,
                    new Vector3(radius * 1.3f, 0.15f, radius * 1.3f), KeepColor);
            }
        }

        private void BuildKeep()
        {
            var mat = wallMaterial != null ? EnvironmentMaterial.MakeTiled(wallMaterial, 3.2f, 2.8f) : null;
            Spawn("Keep", transform, PrimitiveType.Cube, new Vector3(0f, 1.4f, 0f),
                new Vector3(3.2f, 2.8f, 3.2f), KeepColor, mat);
            Spawn("KeepRoof", transform, PrimitiveType.Cylinder, new Vector3(0f, 3.2f, 0f),
                new Vector3(2.4f, 0.9f, 2.4f), KeepColor);
        }

        /// <summary>로스터 깃발 — city3d.js의 "로스터 깃발"(무장 수)을
        /// 그대로. 여러 성으로 확장한 뒤로는 **이 성에 배치된** 무장
        /// 수만 센다(전체 로스터가 아니라) — "무장 성 소속"이 실제로
        /// 눈에 보이는 유일한 자리라 의미 있게 맞췄다.</summary>
        private void BuildRosterFlags()
        {
            int count = 0;
            foreach (var id in RealmCityState.RosterIds)
            {
                if (RealmCityState.OfficerCityId(id) == RealmCityState.CurrentCity) count++;
            }
            for (int i = 0; i < count; i++)
            {
                float angle = (i / (float)Mathf.Max(1, count)) * 40f - 20f;
                Vector3 pos = new Vector3(Mathf.Sin(angle * Mathf.Deg2Rad) * 4.5f, 0.9f, 4.5f);
                Spawn($"Flag_{i}", transform, PrimitiveType.Cube, pos, new Vector3(0.12f, 1.8f, 0.5f), FlagColor);
            }
        }

        private void BuildCountedProps(string label, int count, Color color, PrimitiveType type, Vector3 scale,
            float radius, float y, Material pbrMaterial = null)
        {
            if (count <= 0) return;
            var root = new GameObject($"{label}s");
            root.transform.SetParent(transform, false);
            // 소품 하나하나가 전부 같은 크기라 재질 인스턴스도 하나만 구워
            // 공유한다(LandmarksBuilder.BuildBridge와 같은 이유).
            var tiled = pbrMaterial != null ? EnvironmentMaterial.MakeTiled(pbrMaterial, scale.x, scale.z) : null;
            for (int i = 0; i < count; i++)
            {
                float angle = (360f / count) * i;
                Vector3 pos = new Vector3(Mathf.Sin(angle * Mathf.Deg2Rad) * radius, y,
                    Mathf.Cos(angle * Mathf.Deg2Rad) * radius);
                Spawn($"{label}_{i}", root.transform, type, pos, scale, color, tiled);
            }
        }
    }
}
