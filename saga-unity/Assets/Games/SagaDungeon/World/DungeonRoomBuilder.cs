using Saga.Core;
using UnityEngine;

namespace Saga.Dungeon.World
{
    /// <summary>
    /// VERTICAL_SLICE_DUNGEON.md "방 크기" — saga-dungeon 웹판
    /// `ROOM_W=560, ROOM_H=360`(논리 픽셀, 플레이어 반지름 13px 기준)와
    /// 같은 비율을 Unity 미터로 옮겼다(CharacterController 반지름 0.4m
    /// 기준 20m×14m 출발). **"오픈월드/필드"부터 door를 지원한다** —
    /// `Build()`는 여전히 완전히 막힌 방을 짓고, `OpenNorthDoor()`/
    /// `OpenSouthDoor()`를 따로 불러야 그 방향 벽에 문이 뚫린다(기본
    /// 동작은 안 바뀜 — 기존 첫 방처럼 문이 필요 없는 호출부는 그대로
    /// 완전히 막힌 방을 받는다).
    ///
    /// "바이옴 5종" 슬라이스 — `SagaBiome.cs` 참고. `biome`이
    /// `SagaBiome.None`(기본값)이면 예전 색 그대로(회귀 없음), 채워져
    /// 있으면 바닥/벽 색과 방 구석 소품(`BuildDecor()`)이 바뀐다.
    /// `BuildTestDungeonScene.cs`가 다른 필드들과 같은 결(`SetPrivateField`)
    /// 로 방마다 배정한다(Room1=숲·Room2=늪·Room3=산·Room4=사당 — 방 안
    /// 콘텐츠와 어울리게 고른 배정, 근거는 그 파일 주석 참고).
    ///
    /// "환경/건물 GLB" 슬라이스 — 문(OpenNorthDoor/OpenSouthDoor)이
    /// 뚫릴 때 `gateModel`(CC0 Kenney Modular Cave Kit `gate.glb`, 실측
    /// 4.4×4.4×1.4 바닥 중앙 피벗)이 채워져 있으면 문 폭에 맞춰 아치를
    /// 세운다 — "아치는 앞뒤 대칭이라 방향 안 따짐"(saga-godot
    /// `test_room.gd` 주석과 같은 결). 문은 실제로 지나다니는 자리라
    /// 콜라이더는 안 붙인다. **이 슬라이스에선 room-small.glb(방 셸)를
    /// 안 썼다** — 실측 12×4.4×12가 그때 방 치수(20×14×4)와 비율이
    /// 축마다 달라(비균등 스케일) 벽 질감이 뒤틀릴 걸로 봤었다.
    ///
    /// "방 셸 GLB" 슬라이스(뒤이음) — **비균등 스케일 문제를 "방을
    /// room-small.glb 원본 비율(정사각형)에 맞추고, 기존 20m 폭은 그대로
    /// 지키는 균일 스케일"로 풀었다.** room-small.glb는 정사각(12×12)
    /// 이라 X만 20으로 늘리면 Z도 저절로 20이 된다(균일 스케일 =
    /// 20/12 = 5/3, 왜곡 없음) — `RoomDepth`를 14→20으로 올린 게
    /// 그래서다(폭은 그대로 20, 기존 스폰 좌표는 전부 X 기준이라 안
    /// 건드림, 깊이만 넉넉해짐). `roomModel`이 채워져 있으면 이 균일
    /// 배율(`RoomScale`)로 셸을 세우고 기존 primitive Floor/Wall은
    /// `MeshRenderer.enabled=false`로 안 보이는 충돌체로만 남긴다
    /// (`DungeonCorridorBuilder.cs`의 `corridorModel`과 같은 결). 문 폭
    /// (`RoomDoorWidth`, `BuildTestDungeonScene.cs`)도 이 배율을 그대로
    /// 따라 `gateModel`(4.4)×5/3 ≈ 7.33으로 넓어졌다 — **셸의 문 구멍이
    /// 실제로 이 폭인지는 사람이 직접 봐야 확인됨**(saga-godot
    /// `test_room.gd`의 `GATE_HALF_WIDTH`가 room-small.glb의 실제 문
    /// 구멍 폭과 같다고 가정한 추론, 메시를 직접 열어 본 게 아니다).
    ///
    /// "마을 여러 개 — 셋째·넷째" 슬라이스 — `OpenEastDoor()`/`OpenWestDoor()`
    /// 추가(모루골=Room1이 중심, 위성 마을이 사방으로 뻗는 별형 구조를
    /// 이으려면 X축 벽에도 문이 필요했다). 아치도 그 방향엔 Y축 90도
    /// 회전이 필요해 `BuildGateArch()`에 `rotate90` 매개변수를 더했다.
    ///
    /// "방 셸 — 티어별 마모 3단" 슬라이스(2026-09-22) — PLAN.md 103-1 변형
    /// 배가 대상. `DungeonFloorRunner`가 층2~100까지 갈아치우며 재사용하는
    /// `ProcRoom` 하나가 몇 층을 내려가든 항상 같은 톤이던 걸, 새 지오메트리
    /// 없이 재질 톤·거칠기만 3단으로 눌러 깊을수록 낡아 보이게 했다
    /// (`EnvironmentMaterial.MakeTiled(..., wearTier)`, `SetWearTier()`).
    /// Room1~4(고정 층1)는 항상 tier 0.
    /// </summary>
    public class DungeonRoomBuilder : MonoBehaviour
    {
        public const float RoomWidth = 20f;
        public const float RoomDepth = 20f; // "방 셸 GLB" — room-small.glb 정사각 비율을 지키려 14→20.
        private const float WallHeight = 4f;
        private const float WallThickness = 1f;

        private static readonly Color NeutralFloorColor = new Color(0.28f, 0.26f, 0.24f);
        private static readonly Color NeutralWallColor = new Color(0.16f, 0.15f, 0.14f);

        [SerializeField] private SagaBiome biome = SagaBiome.None;

        // 소품(BuildDecor) 클러스터 중심 — 기존 방 콘텐츠(적·상자·행상 등)와
        // 안 겹치는 빈 구석을 방마다 BuildTestDungeonScene.cs가 따로 잡는다.
        [SerializeField] private Vector3 decorOffset = new Vector3(-8f, 0f, 5f);

        // gate.glb — 실측 4.4×4.4×1.4(바닥 중앙 피벗), BuildTestDungeonScene.cs가
        // AssetDatabase로 채워 준다(런타임 Awake()는 그 API를 못 씀).
        [SerializeField] private GameObject gateModel;
        public const float GateModelWidth = 4.4f;

        // room-small.glb — 실측 12×4.4×12(바닥 중앙 피벗), 정사각형이라
        // RoomWidth(20)/원본(12) 배율(5/3)을 X·Y·Z에 똑같이 적용하면
        // 왜곡 없이 20×20(=RoomWidth×RoomDepth)이 나온다.
        [SerializeField] private GameObject roomModel;
        private const float RoomModelNativeSize = 12f;
        public const float RoomScale = RoomWidth / RoomModelNativeSize; // 20/12 ≈ 1.667

        // 44장 "Environment" 교체 — 채워져 있으면 room-small.glb 셸(Kenney
        // 단색 아틀라스)과 primitive 색상 둘 다 대신 실제 PBR 재질(Poly Haven,
        // EnvironmentMaterial.cs)을 바닥·벽에 씌운다. gateModel(문 아치)은
        // 이번 슬라이스 범위 밖 — 별도 소품이라 그대로 둔다.
        [SerializeField] private Material floorMaterial;
        [SerializeField] private Material wallMaterial;
        private bool UsePbrEnvironment => floorMaterial != null && wallMaterial != null;

        // PLAN.md 103-1 "DUNGEON 방 셸 — 티어별 마모 3단"(2026-09-22) — 0=깨끗·
        // 1=때탄·2=폐허. `DungeonFloorRunner`가 층이 깊어질 때 `SetWearTier()`로
        // 갈아 끼운다(재질 인스턴스만 새로 굽는다 — 지오메트리는 그대로).
        [SerializeField] private int wearTier = 0;

        private void Awake()
        {
            // 이미 저장된 씬을 실제 Play로 열면 Awake가 다시 불려 Build()를
            // 또 돌리는데, 편집기 빌드 스크립트가 이미 자식들을 만들어 둔
            // 뒤라 그대로 두면 바닥·벽이 두 벌씩 겹쳐 생긴다 — SagaGo의
            // NpcBuilder.cs와 같은 방어(2026-09-12에 이미 6곳에서 빠뜨렸다가
            // 고친 패턴 — 새로 짜는 컴포넌트엔 처음부터 넣는다).
            if (transform.childCount > 0) return;
            Build();
        }

        public void Build()
        {
            BuildFloor();
            BuildWalls();
            BuildRoomVisualModel();
            BuildDecor();
            MarkStatic();
        }

        /// <summary>PLAN.md 103-1 "DUNGEON 방 셸 — 티어별 마모 3단" —
        /// `DungeonFloorRunner`가 층을 내려갈 때마다 부른다. 지오메트리는 이미
        /// 지어져 있으니 바닥·벽·천장·문 아치의 재질 인스턴스만 새로 굽는다
        /// (PBR 경로 전용 — Kenney 셸/primitive 색상 경로는 마모 개념이 없다).</summary>
        public void SetWearTier(int tier)
        {
            tier = Mathf.Clamp(tier, 0, 2);
            if (tier == wearTier) return;
            wearTier = tier;
            if (UsePbrEnvironment) RefreshEnvironmentMaterials();
        }

        private void RefreshEnvironmentMaterials()
        {
            var floor = transform.Find("Floor");
            if (floor != null)
            {
                floor.GetComponent<MeshRenderer>().sharedMaterial =
                    EnvironmentMaterial.MakeTiled(floorMaterial, RoomWidth, RoomDepth, wearTier);
            }

            var ceiling = transform.Find("Ceiling");
            if (ceiling != null)
            {
                ceiling.GetComponent<MeshRenderer>().sharedMaterial =
                    EnvironmentMaterial.MakeTiled(wallMaterial, RoomWidth, RoomDepth, wearTier);
            }

            foreach (Transform child in transform)
            {
                if (child.name.EndsWith("_Gate"))
                {
                    var archMat = EnvironmentMaterial.MakeTiled(wallMaterial, GateModelWidth, GateModelWidth, wearTier);
                    foreach (var r in child.GetComponentsInChildren<Renderer>()) r.sharedMaterial = archMat;
                }
                else if (child.name.StartsWith("Wall_"))
                {
                    var size = child.localScale;
                    child.GetComponent<MeshRenderer>().sharedMaterial =
                        EnvironmentMaterial.MakeTiled(wallMaterial, Mathf.Max(size.x, size.z), size.y, wearTier);
                }
            }
        }

        /// <summary>"방 셸 GLB" — room-small.glb를 균일 배율(`RoomScale`)로
        /// 세운다. 비어 있으면(다른 PC에 에셋이 아직 없는 경우) 아무 것도
        /// 안 함 — Floor/Wall이 이미 예전 색을 보여주고 있다(씬이 안 깨짐).</summary>
        private void BuildRoomVisualModel()
        {
            // "Environment" PBR 경로 — 바닥·벽이 이미 실제 재질로 덮였으니
            // Kenney 셸 대신 천장만 마저 닫는다(셸은 바닥+벽+천장이 한
            // 메시라 부분적으로 못 끈다 — 통째로 대체).
            if (UsePbrEnvironment)
            {
                BuildCeiling();
                return;
            }

            if (roomModel == null) return;

            var shell = Object.Instantiate(roomModel, transform, false);
            shell.name = "Shell";
            shell.transform.localScale = Vector3.one * RoomScale;
            CharacterVisual.Tint(shell, Colors().wall);
        }

        /// <summary>PBR 환경 경로 전용 — 셸이 없으니 천장을 별도 primitive로
        /// 닫는다. 시각용일 뿐 콜라이더는 안 둔다(카메라가 방 안에서만
        /// 도니 막을 이유가 없다 — corridor.glb가 콜라이더 없는 것과 같은 결).</summary>
        private void BuildCeiling()
        {
            var ceiling = GameObject.CreatePrimitive(PrimitiveType.Cube);
            ceiling.name = "Ceiling";
            ceiling.transform.SetParent(transform, false);
            ceiling.transform.localPosition = new Vector3(0f, WallHeight, 0f);
            ceiling.transform.localScale = new Vector3(RoomWidth, 1f, RoomDepth);
            ceiling.GetComponent<MeshRenderer>().sharedMaterial =
                EnvironmentMaterial.MakeTiled(wallMaterial, RoomWidth, RoomDepth, wearTier);
            Object.DestroyImmediate(ceiling.GetComponent<Collider>());
        }

        private (Color floor, Color wall) Colors() => biome switch
        {
            // 웹판 THEME_BIAS 색 수치가 없어 새로 잡음(SagaBiome.cs 참고) —
            // 이끼 낀 바닥·거뭇한 나무껍질 벽.
            SagaBiome.Forest => (new Color(0.20f, 0.27f, 0.16f), new Color(0.17f, 0.14f, 0.09f)),
            // 진창 바닥·눅눅한 이끼벽.
            SagaBiome.Swamp => (new Color(0.16f, 0.23f, 0.20f), new Color(0.13f, 0.17f, 0.16f)),
            // 회색 암반 바닥·짙은 화강암 벽.
            SagaBiome.Mountain => (new Color(0.34f, 0.33f, 0.32f), new Color(0.22f, 0.21f, 0.20f)),
            // 볕에 바랜 석재 바닥·붉은 단청 기둥벽(제단 방 정체성).
            SagaBiome.Shrine => (new Color(0.36f, 0.30f, 0.20f), new Color(0.30f, 0.18f, 0.15f)),
            // 무너진 잔해 — 회갈색으로 어둡게.
            SagaBiome.Ruins => (new Color(0.25f, 0.23f, 0.20f), new Color(0.20f, 0.18f, 0.16f)),
            _ => (NeutralFloorColor, NeutralWallColor),
        };

        /// <summary>PLAN.md 76장 Mobile Performance Pass — 방은 절대 안
        /// 움직이니 정적 배칭·오클루전 컬링 대상으로 표시한다.</summary>
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
            floor.transform.localScale = new Vector3(RoomWidth, 1f, RoomDepth);
            var renderer = floor.GetComponent<MeshRenderer>();
            if (UsePbrEnvironment) renderer.sharedMaterial = EnvironmentMaterial.MakeTiled(floorMaterial, RoomWidth, RoomDepth, wearTier);
            else if (roomModel != null) renderer.enabled = false; // 셸이 보여줄 자리 — 콜라이더만 남김.
            else renderer.sharedMaterial = MakeMaterial(Colors().floor);
        }

        private void BuildWalls()
        {
            float halfW = RoomWidth * 0.5f;
            float halfD = RoomDepth * 0.5f;
            float wallY = WallHeight * 0.5f;
            var wallColor = Colors().wall;

            SpawnWall("Wall_North", new Vector3(0f, wallY, halfD + WallThickness * 0.5f),
                new Vector3(RoomWidth + WallThickness * 2f, WallHeight, WallThickness), wallColor);
            SpawnWall("Wall_South", new Vector3(0f, wallY, -halfD - WallThickness * 0.5f),
                new Vector3(RoomWidth + WallThickness * 2f, WallHeight, WallThickness), wallColor);
            SpawnWall("Wall_East", new Vector3(halfW + WallThickness * 0.5f, wallY, 0f),
                new Vector3(WallThickness, WallHeight, RoomDepth), wallColor);
            SpawnWall("Wall_West", new Vector3(-halfW - WallThickness * 0.5f, wallY, 0f),
                new Vector3(WallThickness, WallHeight, RoomDepth), wallColor);
        }

        /// <summary>"바이옴 5종" — 방 구석에 성격을 드러내는 소품 클러스터
        /// 하나(primitive뿐, GLB는 다음 슬라이스). Unity 기본 primitive엔
        /// 원뿔이 없어 나무는 원기둥(줄기)+구(수관)로 대신한다. 물리
        /// 충돌·트리거를 안 쓰는 DUNGEON 관례대로 콜라이더는 다 지운다
        /// (`DungeonTrove.cs`·`DungeonPuzzle.cs`와 같은 결).</summary>
        private void BuildDecor()
        {
            switch (biome)
            {
                case SagaBiome.Forest:
                    BuildTree(decorOffset);
                    BuildTree(decorOffset + new Vector3(1.3f, 0f, 0.8f));
                    BuildTree(decorOffset + new Vector3(-1.1f, 0f, 1.1f));
                    break;
                case SagaBiome.Swamp:
                    BuildWaterPatch(decorOffset);
                    BuildReed(decorOffset + new Vector3(0.6f, 0f, -0.4f));
                    BuildReed(decorOffset + new Vector3(-0.5f, 0f, 0.5f));
                    BuildReed(decorOffset + new Vector3(0.2f, 0f, 0.9f));
                    break;
                case SagaBiome.Mountain:
                    BuildRock(decorOffset, 1.1f);
                    BuildRock(decorOffset + new Vector3(1.2f, 0f, 0.6f), 0.8f);
                    BuildRock(decorOffset + new Vector3(-0.9f, 0f, 0.7f), 0.7f);
                    break;
                case SagaBiome.Shrine:
                    BuildLantern(decorOffset);
                    break;
            }
        }

        private void BuildTree(Vector3 pos)
        {
            var trunk = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
            trunk.name = "Decor_TreeTrunk";
            trunk.transform.SetParent(transform, false);
            trunk.transform.localScale = new Vector3(0.3f, 1.2f, 0.3f);
            trunk.transform.localPosition = pos + new Vector3(0f, 1.2f, 0f);
            trunk.GetComponent<MeshRenderer>().sharedMaterial = MakeMaterial(new Color(0.30f, 0.20f, 0.12f));
            Object.DestroyImmediate(trunk.GetComponent<Collider>());

            var foliage = GameObject.CreatePrimitive(PrimitiveType.Sphere);
            foliage.name = "Decor_TreeFoliage";
            foliage.transform.SetParent(transform, false);
            foliage.transform.localScale = new Vector3(1.6f, 1.6f, 1.6f);
            foliage.transform.localPosition = pos + new Vector3(0f, 2.6f, 0f);
            foliage.GetComponent<MeshRenderer>().sharedMaterial = MakeMaterial(new Color(0.16f, 0.40f, 0.18f));
            Object.DestroyImmediate(foliage.GetComponent<Collider>());
        }

        private void BuildWaterPatch(Vector3 pos)
        {
            var patch = GameObject.CreatePrimitive(PrimitiveType.Cube);
            patch.name = "Decor_WaterPatch";
            patch.transform.SetParent(transform, false);
            patch.transform.localScale = new Vector3(3.2f, 0.05f, 3.2f);
            patch.transform.localPosition = pos + new Vector3(0f, -0.44f, 0f); // 바닥보다 살짝 낮게 — 고인 물
            patch.GetComponent<MeshRenderer>().sharedMaterial = MakeMaterial(new Color(0.10f, 0.18f, 0.20f));
            Object.DestroyImmediate(patch.GetComponent<Collider>());
        }

        private void BuildReed(Vector3 pos)
        {
            var reed = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
            reed.name = "Decor_Reed";
            reed.transform.SetParent(transform, false);
            reed.transform.localScale = new Vector3(0.08f, 0.7f, 0.08f);
            reed.transform.localPosition = pos + new Vector3(0f, 0.7f, 0f);
            reed.GetComponent<MeshRenderer>().sharedMaterial = MakeMaterial(new Color(0.30f, 0.38f, 0.16f));
            Object.DestroyImmediate(reed.GetComponent<Collider>());
        }

        private void BuildRock(Vector3 pos, float scale)
        {
            var rock = GameObject.CreatePrimitive(PrimitiveType.Sphere);
            rock.name = "Decor_Rock";
            rock.transform.SetParent(transform, false);
            rock.transform.localScale = new Vector3(scale * 1.3f, scale * 0.8f, scale);
            rock.transform.localPosition = pos + new Vector3(0f, scale * 0.4f, 0f);
            rock.GetComponent<MeshRenderer>().sharedMaterial = MakeMaterial(new Color(0.42f, 0.41f, 0.40f));
            Object.DestroyImmediate(rock.GetComponent<Collider>());
        }

        private void BuildLantern(Vector3 pos)
        {
            var baseCube = GameObject.CreatePrimitive(PrimitiveType.Cube);
            baseCube.name = "Decor_LanternBase";
            baseCube.transform.SetParent(transform, false);
            baseCube.transform.localScale = new Vector3(0.6f, 1.6f, 0.6f);
            baseCube.transform.localPosition = pos + new Vector3(0f, 0.8f, 0f);
            baseCube.GetComponent<MeshRenderer>().sharedMaterial = MakeMaterial(new Color(0.32f, 0.28f, 0.22f));
            Object.DestroyImmediate(baseCube.GetComponent<Collider>());

            var top = GameObject.CreatePrimitive(PrimitiveType.Cube);
            top.name = "Decor_LanternTop";
            top.transform.SetParent(transform, false);
            top.transform.localScale = new Vector3(0.9f, 0.3f, 0.9f);
            top.transform.localPosition = pos + new Vector3(0f, 1.75f, 0f);
            top.GetComponent<MeshRenderer>().sharedMaterial = MakeMaterial(new Color(0.55f, 0.15f, 0.1f)); // 단청 붉은빛
            Object.DestroyImmediate(top.GetComponent<Collider>());

            var lightGo = new GameObject("Decor_LanternLight");
            lightGo.transform.SetParent(transform, false);
            lightGo.transform.localPosition = pos + new Vector3(0f, 1.9f, 0f);
            var light = lightGo.AddComponent<Light>();
            light.type = LightType.Point;
            light.color = new Color(1f, 0.75f, 0.45f);
            light.range = 6f;
            light.intensity = 1.5f;
        }

        /// <summary>벽을 문 폭만큼 갈라 둘로 나눈다 — 편집기 빌드 스크립트가
        /// `Build()` 직후에 부른다(런타임 X, `Object.DestroyImmediate` 사용).
        /// "마을 여러 개 — 셋째·넷째" 슬라이스 — 북/남(장축 X)뿐이던 문을
        /// 동/서(장축 Z)로도 열 수 있게 `OpenDoorOnWall()`을 축 매개변수로
        /// 일반화했다(기존 두 메서드의 동작·시그니처는 안 바뀜).</summary>
        public void OpenNorthDoor(float doorWidth) => OpenDoorOnWall("Wall_North", doorWidth, splitAlongX: true);

        public void OpenSouthDoor(float doorWidth) => OpenDoorOnWall("Wall_South", doorWidth, splitAlongX: true);

        public void OpenEastDoor(float doorWidth) => OpenDoorOnWall("Wall_East", doorWidth, splitAlongX: false);

        public void OpenWestDoor(float doorWidth) => OpenDoorOnWall("Wall_West", doorWidth, splitAlongX: false);

        private void OpenDoorOnWall(string wallName, float doorWidth, bool splitAlongX)
        {
            var wall = transform.Find(wallName);
            if (wall == null) return;

            Vector3 pos = wall.localPosition;
            Vector3 size = wall.localScale;
            float wallLength = splitAlongX ? size.x : size.z;
            float segLength = (wallLength - doorWidth) * 0.5f;
            if (segLength <= 0f)
            {
                Debug.LogWarning($"[DungeonRoomBuilder] {wallName} — 문 폭({doorWidth})이 벽 길이({wallLength})보다 넓다.");
                return;
            }

            Object.DestroyImmediate(wall.gameObject);

            float offset = doorWidth * 0.5f + segLength * 0.5f;
            var wallColor = Colors().wall;
            if (splitAlongX)
            {
                SpawnWall(wallName + "_W", new Vector3(pos.x - offset, pos.y, pos.z), new Vector3(segLength, size.y, size.z), wallColor);
                SpawnWall(wallName + "_E", new Vector3(pos.x + offset, pos.y, pos.z), new Vector3(segLength, size.y, size.z), wallColor);
            }
            else
            {
                SpawnWall(wallName + "_S", new Vector3(pos.x, pos.y, pos.z - offset), new Vector3(size.x, size.y, segLength), wallColor);
                SpawnWall(wallName + "_N", new Vector3(pos.x, pos.y, pos.z + offset), new Vector3(size.x, size.y, segLength), wallColor);
            }

            BuildGateArch(wallName, new Vector3(pos.x, 0f, pos.z), doorWidth, rotate90: !splitAlongX);

            MarkStatic();
        }

        /// <summary>"환경/건물 GLB" — 문 자리에 gate.glb 아치를 세운다(위
        /// 클래스 주석 참고). 콜라이더 없음 — 실제로 지나다니는 자리.
        /// "마을 여러 개 — 셋째·넷째" — 동/서 문은 아치를 Y축으로 90도
        /// 돌려 문 폭 축(원래 로컬 X)이 벽의 장축(Z)에 맞게 한다.</summary>
        private void BuildGateArch(string wallName, Vector3 doorFloorPos, float doorWidth, bool rotate90)
        {
            if (gateModel == null) return;

            var gate = Object.Instantiate(gateModel, transform, false);
            gate.name = wallName + "_Gate";
            gate.transform.localPosition = doorFloorPos;
            if (rotate90) gate.transform.localRotation = Quaternion.Euler(0f, 90f, 0f);
            // 문 폭이 곧 RoomScale×GateModelWidth로 설계돼(BuildTestDungeonScene.cs
            // RoomDoorWidth) 이 나눗셈이 자동으로 RoomScale과 같아진다 — 균일
            // 스케일, 왜곡 없음(방 셸 GLB 슬라이스 전엔 X만 줄이는 비균등이었음).
            float scale = doorWidth / GateModelWidth;
            gate.transform.localScale = Vector3.one * scale;

            // 44장 "Building" 교체 — PBR 경로에서는 Kenney 아치의 단색
            // 아틀라스(colormap.png) 대신 벽과 같은 PBR 재질을 씌운다(실측
            // 4.4×4.4 기준 타일 — DungeonRoomBuilder 클래스 주석의 gate.glb
            // 실측값). 메시 UV가 아틀라스 전용이라 결과가 정확한 스톤
            // 텍스처는 아니지만, 최소한 밋밋한 단색 아치보다는 낫다.
            if (UsePbrEnvironment)
            {
                var archMat = EnvironmentMaterial.MakeTiled(wallMaterial, GateModelWidth, GateModelWidth, wearTier);
                foreach (var r in gate.GetComponentsInChildren<Renderer>())
                {
                    r.sharedMaterial = archMat;
                }
            }
        }

        private void SpawnWall(string name, Vector3 pos, Vector3 size, Color color)
        {
            var wall = GameObject.CreatePrimitive(PrimitiveType.Cube);
            wall.name = name;
            wall.transform.SetParent(transform, false);
            wall.transform.localPosition = pos;
            wall.transform.localScale = size;
            var renderer = wall.GetComponent<MeshRenderer>();
            if (UsePbrEnvironment) renderer.sharedMaterial = EnvironmentMaterial.MakeTiled(wallMaterial, Mathf.Max(size.x, size.z), size.y, wearTier);
            else if (roomModel != null) renderer.enabled = false; // 셸이 보여줄 자리 — 콜라이더만 남김(문 갈라짐 후 재생성분도 포함).
            else renderer.sharedMaterial = MakeMaterial(color);
        }

        private static Material MakeMaterial(Color color)
        {
            var mat = new Material(Shader.Find("Universal Render Pipeline/Lit")) { name = "DungeonRoom (generated)" };
            mat.color = color;
            return mat;
        }
    }
}
