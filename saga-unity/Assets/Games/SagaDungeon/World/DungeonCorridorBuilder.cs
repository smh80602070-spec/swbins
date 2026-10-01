using Saga.Core;
using UnityEngine;

namespace Saga.Dungeon.World
{
    /// <summary>
    /// VERTICAL_SLICE_DUNGEON.md 다음 슬라이스 "오픈월드/필드" — 방
    /// 하나짜리 구조를 벗어나는 첫 조각. 웹판 saga-dungeon의 필드/바이옴
    /// 전체를 옮기는 대신(파급이 큰 작업, 이번 슬라이스 범위 밖 —
    /// VERTICAL_SLICE_DUNGEON.md "다음 슬라이스 후보" 참고) **방 두 개를
    /// 잇는 가장 작은 단위**만 짰다: `DungeonRoomBuilder.cs`의
    /// `OpenNorthDoor()`/`OpenSouthDoor()`로 두 방에 문을 뚫고, 그 사이를
    /// 이 복도로 잇는다. `DungeonRoomBuilder.cs`와 같은 결(primitive,
    /// Awake 중복 생성 방어, MarkStatic).
    ///
    /// "바이옴 5종" 슬라이스 — 복도 셋(Corridor·Corridor2·Corridor3)은
    /// 전부 `SagaBiome.Ruins`(무너진 통로)로 통일한다. 다섯 성격 중
    /// 방 넷(숲·늪·산·사당, `DungeonRoomBuilder.cs`)에 못 들어간 나머지
    /// 하나를 여기 배정한 것 — 좁은 통로(3m)엔 소품을 안 둔다(길 막힘
    /// 방지, 색 톤만 바뀐다).
    ///
    /// "환경/건물 GLB" 슬라이스 — CC0 Kenney Modular Cave Kit(SagaGo가
    /// 이미 쓰는 킷, `saga-godot/assets/dungeon/corridor.glb` 그대로
    /// 복사, `docs/ASSET_GUIDE.md` 실측 4.0×4.05×4.0, 바닥 중앙 피벗)를
    /// `corridorModel`이 채워져 있으면 순수 시각용으로 두 장 이어 붙인다
    /// (`Length`(8)가 타일 깊이(4.0)의 정확히 2배라 Z축은 전혀 안
    /// 늘림). **GLB 자체엔 콜라이더가 없다**(saga-godot `test_room.gd`
    /// 주석과 같은 이유) — 기존 primitive Floor/SideWalls를 그대로 두고
    /// 렌더러만 꺼서 보이지 않는 충돌체로 남긴다(saga-godot의
    /// StaticBody3D 분리 방식과 같은 결). `corridorModel`이 없으면(다른
    /// PC에 에셋이 아직 없는 경우) 예전처럼 primitive 색상 그대로 보인다
    /// — 씬이 안 깨짐.
    ///
    /// "방 셸 GLB" 슬라이스(뒤이음) — `DoorWidth`를 3→4.0으로 올려
    /// `corridor.glb` 실측 폭(4.0)과 **정확히** 일치시켰다 — 이제 X도
    /// 전혀 안 늘어나 완전히 무왜곡(균일 스케일 1)이 됐다. saga-godot
    /// `test_room.gd`의 `CORRIDOR_HALF_WIDTH`(2.0, 폭 4.0)와 같은 값 —
    /// 다만 방의 문 폭(`RoomDoorWidth`, `BuildTestDungeonScene.cs`,
    /// room-small.glb 배율을 따라 ≈7.33)보다는 좁다. saga-godot도
    /// `gate.glb`(4.4)와 `corridor.glb`(4.0) 사이에 같은 차이를 그대로
    /// 두고 "복도가 문보다 살짝 좁아 생기는 턱"으로 문서화해 뒀다 — 이
    /// 프로젝트도 같은 차이를 그대로 받아들인다(문턱에서 폭이 확
    /// 좁아지는 느낌이 심하면 다음에 조정).
    /// </summary>
    public class DungeonCorridorBuilder : MonoBehaviour
    {
        public const float DoorWidth = 4.0f; // "방 셸 GLB" — corridor.glb 실측 폭과 정확히 일치(3→4.0)
        private const float WallHeight = 4f;
        private const float WallThickness = 1f;

        private static readonly Color NeutralFloorColor = new Color(0.24f, 0.22f, 0.2f);
        private static readonly Color NeutralWallColor = new Color(0.16f, 0.15f, 0.14f);
        // 웹판 THEME_BIAS 색 수치가 없어(SagaBiome.cs 참고) 새로 잡음 — 무너진 잔해 톤.
        private static readonly Color RuinsFloorColor = new Color(0.25f, 0.23f, 0.20f);
        private static readonly Color RuinsWallColor = new Color(0.20f, 0.18f, 0.16f);

        [SerializeField] private SagaBiome biome = SagaBiome.None;

        // corridor.glb — 실측 4.0×4.05×4.0(바닥 중앙 피벗), BuildTestDungeonScene.cs가
        // AssetDatabase로 채워 준다(런타임 Awake()는 그 API를 못 씀).
        [SerializeField] private GameObject corridorModel;
        private const float CorridorModelDepth = 4.0f;

        // 44장 "Environment" 교체 — DungeonRoomBuilder.cs와 같은 결
        // (EnvironmentMaterial.cs 참고). 채워져 있으면 corridor.glb 대신 PBR
        // 재질을 바닥·벽·천장에 씌운다.
        [SerializeField] private Material floorMaterial;
        [SerializeField] private Material wallMaterial;
        private bool UsePbrEnvironment => floorMaterial != null && wallMaterial != null;

        /// <summary>복도 길이(z축) — 두 방의 벽 바깥면 사이 거리는
        /// BuildTestDungeonScene.cs가 방 간격을 잡을 때 이 값을 그대로
        /// 씀.</summary>
        public const float Length = 8f;

        private void Awake()
        {
            if (transform.childCount > 0) return;
            Build();
        }

        public void Build()
        {
            BuildFloor();
            BuildSideWalls();
            BuildVisualModel();
            MarkStatic();
        }

        private (Color floor, Color wall) Colors() =>
            biome == SagaBiome.Ruins ? (RuinsFloorColor, RuinsWallColor) : (NeutralFloorColor, NeutralWallColor);

        private void MarkStatic()
        {
            foreach (Transform t in GetComponentsInChildren<Transform>(true))
            {
                t.gameObject.isStatic = true;
            }
        }

        private void BuildFloor()
        {
            var floor = GameObject.CreatePrimitive(PrimitiveType.Cube);
            floor.name = "Floor";
            floor.transform.SetParent(transform, false);
            floor.transform.localPosition = new Vector3(0f, -0.5f, 0f);
            floor.transform.localScale = new Vector3(DoorWidth, 1f, Length);
            var renderer = floor.GetComponent<MeshRenderer>();
            if (UsePbrEnvironment) renderer.sharedMaterial = EnvironmentMaterial.MakeTiled(floorMaterial, DoorWidth, Length);
            else if (corridorModel != null) renderer.enabled = false; // GLB가 보여줄 자리 — 콜라이더만 남김.
            else renderer.sharedMaterial = MakeMaterial(Colors().floor);
        }

        private void BuildSideWalls()
        {
            float wallY = WallHeight * 0.5f;
            float offsetX = DoorWidth * 0.5f + WallThickness * 0.5f;
            var wallColor = Colors().wall;

            SpawnWall("Wall_E", new Vector3(offsetX, wallY, 0f), new Vector3(WallThickness, WallHeight, Length), wallColor);
            SpawnWall("Wall_W", new Vector3(-offsetX, wallY, 0f), new Vector3(WallThickness, WallHeight, Length), wallColor);
        }

        private void SpawnWall(string name, Vector3 pos, Vector3 size, Color color)
        {
            var wall = GameObject.CreatePrimitive(PrimitiveType.Cube);
            wall.name = name;
            wall.transform.SetParent(transform, false);
            wall.transform.localPosition = pos;
            wall.transform.localScale = size;
            var renderer = wall.GetComponent<MeshRenderer>();
            if (UsePbrEnvironment) renderer.sharedMaterial = EnvironmentMaterial.MakeTiled(wallMaterial, Mathf.Max(size.x, size.z), size.y);
            else if (corridorModel != null) renderer.enabled = false; // GLB가 보여줄 자리 — 콜라이더만 남김.
            else renderer.sharedMaterial = MakeMaterial(color);
        }

        /// <summary>corridor.glb 타일 두 장을 이어 붙인다(위 클래스 주석 —
        /// Length(8)가 타일 깊이(4.0)의 정확히 2배, DoorWidth(4.0)도 타일
        /// 실측 폭과 정확히 같아 스케일이 전혀 필요 없다). 비어 있으면
        /// 아무 것도 안 함(위 BuildFloor/BuildSideWalls가 이미 예전 색을
        /// 보여줌).</summary>
        private void BuildVisualModel()
        {
            // "Environment" PBR 경로 — DungeonRoomBuilder.cs와 같은 결.
            // corridor.glb 타일 대신 천장 하나로 마저 닫는다.
            if (UsePbrEnvironment)
            {
                BuildCeiling();
                return;
            }

            if (corridorModel == null) return;

            var tint = Colors().wall; // 통로 전체를 한 톤으로(폐허 색, 방과 달리 성격 하나뿐)

            for (int i = 0; i < 2; i++)
            {
                float tileCenterZ = -Length * 0.5f + CorridorModelDepth * (i + 0.5f);
                var tile = Object.Instantiate(corridorModel, transform, false);
                tile.name = $"Tile_{i + 1}";
                tile.transform.localPosition = new Vector3(0f, 0f, tileCenterZ);
                CharacterVisual.Tint(tile, tint);
            }
        }

        /// <summary>PBR 환경 경로 전용 — DungeonRoomBuilder.BuildCeiling()과
        /// 같은 이유(콜라이더 없는 시각 전용 천장).</summary>
        private void BuildCeiling()
        {
            var ceiling = GameObject.CreatePrimitive(PrimitiveType.Cube);
            ceiling.name = "Ceiling";
            ceiling.transform.SetParent(transform, false);
            ceiling.transform.localPosition = new Vector3(0f, WallHeight, 0f);
            ceiling.transform.localScale = new Vector3(DoorWidth, 1f, Length);
            ceiling.GetComponent<MeshRenderer>().sharedMaterial =
                EnvironmentMaterial.MakeTiled(wallMaterial, DoorWidth, Length);
            Object.DestroyImmediate(ceiling.GetComponent<Collider>());
        }

        private static Material MakeMaterial(Color color)
        {
            var mat = new Material(Shader.Find("Universal Render Pipeline/Lit")) { name = "DungeonCorridor (generated)" };
            mat.color = color;
            return mat;
        }
    }
}
