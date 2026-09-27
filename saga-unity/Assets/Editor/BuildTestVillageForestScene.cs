using TMPro;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.InputSystem.UI;
using UnityEngine.UI;
using Saga.Forest.World;
using Saga.Forest.Player;
using Saga.Forest.UI;
using Saga.Forest.Data;
using Saga.Core;

namespace Saga.EditorTools
{
    /// <summary>
    /// VERTICAL_SLICE_FOREST.md(saga-godot 설계를 그대로 참고) — 이 판
    /// 첫 슬라이스의 TestVillageForest 씬을 코드로 조립해 저장한다.
    /// `BuildTestDungeonScene.cs`와 같은 결(멱등 — 다시 실행하면 씬을
    /// 통째로 새로 짠다). 완료 조건(그 문서 4절): 걷는다 → 나무를 흔들어
    /// 과일을 줍는다 → 주민에게 말을 건다 → 집 안으로 들어간다(곡률
    /// 꺼짐 확인) → 다시 나온다(곡률 켜짐 확인) → 저장한다 → 다시
    /// 켜서 이어진다.
    /// </summary>
    public static class BuildTestVillageForestScene
    {
        private const string ScenePath = "Assets/Scenes/TestVillageForest.unity";
        private const string InputActionsPath = "Assets/InputSystem_Actions.inputactions";

        // GO가 이미 검증해 둔 나무 GLB·캐릭터 GLB를 그대로 재사용
        // (VERTICAL_SLICE_FOREST.md 2절 "새 자산을 안 구하고 GO가 검증해
        // 둔 나무 GLB를 재사용할 수 있다"). 2026-09-21 PLAN.md 102-4 —
        // Kenney tree_oak.glb 대신 GO가 쓰는 procgen 나무 풀(Assets/Art/
        // Generated/SagaGo/) 중 하나를 고정으로 쓴다(변종 풀이 아니라
        // 씨앗 하나만 — 과일나무는 "흔들 수 있는 나무"라는 플레이어
        // 인지가 걸려 있어 모양을 흔들면 안 된다, GO의 장식 숲과 다른
        // 이유). 스케일도 GO와 같은 procgen 튜닝(GeneratedTreeScale=1.0,
        // ForestFruitTree.TreeScale)을 그대로 맞춘다 — FOREST가 GO와
        // 세계 축척이 달라도(1.8m vs 3.4m) 예전 tree_oak×4.5 그대로
        // 재사용했던 전례와 같은 판단.
        // 101-2 5.8① "채집 손맛 — 효과음 3종 라운드로빈"(ForestGatherFeel.cs) —
        // 새 에셋 없이 이미 임포트된 Kenney Interface Sounds 3종을 돌려쓴다.
        private static readonly string[] GatherClipPaths =
        {
            "Assets/Art/Audio/Kenney_InterfaceSounds/confirmation_001.ogg",
            "Assets/Art/Audio/Kenney_InterfaceSounds/confirmation_002.ogg",
            "Assets/Art/Audio/Kenney_InterfaceSounds/confirmation_003.ogg",
        };

        private const string TreeGlbPath = "Assets/Art/Generated/SagaGo/tree_s1_01.glb";
        private const string TreeMaterialPath = "Assets/Art/Generated/SagaGo/TriplanarDetail_Bark.mat";
        private const string VillagerGlbPath = "Assets/Art/Characters/character-b.glb";
        private const string PlayerGlbPath = "Assets/Art/Characters/character-a.glb";

        // 44장 "Player" 교체 — Dungeon/GO가 이미 쓰는 Maria 재사용
        // (BuildTestVillageScene.cs와 같은 결). FOREST는 원래 1.8m 실측
        // 스케일이라(GO의 3.4m와 달리) Maria 실측 높이(1.83m)와 거의
        // 그대로 맞는다 — 그래도 정확한 비율로 다시 잰다.
        private const string MariaBodyFbxPath = "Assets/Art/CharactersRealistic/Maria WProp J J Ong.fbx";
        private const string MariaControllerPath = "Assets/Animators/Maria.controller";
        private const float MariaNativeHeight = 1.83f;
        private const float PlayerTargetHeight = 1.8f;

        private static readonly Vector3 PlayerSpawn = new Vector3(0f, 0.1f, -15f);
        private static readonly Vector3 FruitTreeSpawn = new Vector3(-10f, 0f, 5f);
        private static readonly Vector3 VillagerSpawn = new Vector3(10f, 0f, 5f);
        private static readonly Vector3 HouseSpawn = new Vector3(15f, 0f, -10f);
        // 집 안(가구 자리 여섯+가구전)이 이미 빽빽해 벽지/장판 좌판은 집
        // 밖에 둔다 — 동쪽 벽(HouseSpawn.x+2)에서 2m, 출입 트리거
        // (HouseSpawn+(0,0,-2.5), 반경 1.4)에서도 4.7m 떨어져 안전.
        private static readonly Vector3 FinishStallSpawn = new Vector3(19f, 0f, -10f);

        private static GameObject _treeGlb, _villagerGlb, _playerGlb;

        [MenuItem("Saga/Build TestVillageForest Scene")]
        public static void Build()
        {
            var scene = EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);

            LoadModels();
            BuildLighting();
            var groundGo = BuildGround();
            BuildFruitTree();
            BuildVillager();
            BuildEraFolk();
            var houseGo = BuildHouse();
            BuildHomeFurniture(houseGo);
            BuildFinishStall();
            BuildCreatures();
            BuildMuseum();
            BuildTownScoreBoard();
            BuildDeliveryCounter();
            BuildDeliveryMailboxes();
            BuildLandmarks();
            BuildZoneProps();
            BuildWishStone();
            var (playerGo, playerTransform) = BuildPlayer();
            BuildCurveDriver(playerTransform);
            BuildPostProcessingVolume();
            BuildToneVolume();
            BuildEventSystem();
            BuildDialogueUi();
            BuildHostileEncounterUi();
            BuildDebugOverlay();
            BuildSaveButton();
            BuildSettingsUi();
            BuildGoalBoardUi();
            BuildMobileHud();
            BuildBootstrap();

            AssetDatabase.SaveAssets();
            EditorSceneManager.SaveScene(scene, ScenePath);
            Debug.Log($"[BuildTestVillageForestScene] saved to {ScenePath} — ground childCount={groundGo.transform.childCount}");
        }

        private static Material _treeMaterial;

        private static void LoadModels()
        {
            _treeGlb = AssetDatabase.LoadAssetAtPath<GameObject>(TreeGlbPath);
            _treeMaterial = AssetDatabase.LoadAssetAtPath<Material>(TreeMaterialPath);
            _villagerGlb = AssetDatabase.LoadAssetAtPath<GameObject>(VillagerGlbPath);
            _playerGlb = AssetDatabase.LoadAssetAtPath<GameObject>(PlayerGlbPath);
            if (_treeGlb == null || _villagerGlb == null || _playerGlb == null)
            {
                Debug.LogWarning("[BuildTestVillageForestScene] tree_s1_01.glb/character-b.glb/character-a.glb 중 일부를 못 찾음 — primitive 폴백으로 대체됨.");
            }
            if (_treeMaterial == null)
            {
                Debug.LogWarning("[BuildTestVillageForestScene] TriplanarDetail_Bark.mat 을 못 찾음 — " +
                    "Saga/Build Vegetation Triplanar Materials 를 먼저 실행할 것.");
            }
        }

        /// <summary>PLAN.md 66-2장(파이널 판타지 최신작 기준) 라이팅/무드 —
        /// golden-hour급으로 각도를 낮추고 색을 데워 Bloom(66-2 후처리)이
        /// 반응하게 한다. 차가운 톤 RimLight로 실루엣 강조(66-2장).</summary>
        private static void BuildLighting()
        {
            var sunGo = new GameObject("Light");
            var light = sunGo.AddComponent<Light>();
            light.type = LightType.Directional;
            light.intensity = 1.7f; // 던전보다 밝게 — 낮의 야외 숲마을.
            light.color = new Color(1f, 0.9f, 0.75f);
            light.shadows = LightShadows.Soft;
            sunGo.transform.rotation = Quaternion.Euler(30f, -30f, 0f);

            var rimGo = new GameObject("RimLight");
            var rim = rimGo.AddComponent<Light>();
            rim.type = LightType.Directional;
            rim.intensity = 0.45f;
            rim.color = new Color(0.6f, 0.7f, 0.9f);
            rim.shadows = LightShadows.None;
            rimGo.transform.rotation = Quaternion.Euler(15f, 150f, 0f);

            var skyFogGo = new GameObject("SkyFog");
            skyFogGo.AddComponent<ForestSkyFogBuilder>().Build();
        }

        // PLAN 102-5 "바닥 한 색" — GO BuildTestVillageScene.BuildTerrain()과
        // 같은 결(간단한 디테일 오버레이만, 전면 스플랫팅은 범위 밖). 마을
        // 잔디와 톤이 맞는 Poly Haven leafy_grass의 AO 맵을 그대로 재사용.
        private const string ForestDetailTexPath =
            "Assets/Art/Environment/PBR/PolyHaven_LeafyGrass/leafy_grass_ao_1k.jpg";

        private static GameObject BuildGround()
        {
            var go = new GameObject("Ground");
            var builder = go.AddComponent<ForestGroundBuilder>();

            var detailTex = AssetDatabase.LoadAssetAtPath<Texture2D>(ForestDetailTexPath);
            if (detailTex != null)
            {
                SetPrivateField(builder, "detailTexture", detailTex);
            }
            else
            {
                Debug.LogWarning($"[BuildTestVillageForestScene] {ForestDetailTexPath} 를 못 찾음 — 지형이 예전처럼 정점색만으로 칠해짐.");
            }
            // ForestGroundBuilder.Awake()는 Play 모드에서만 자동으로 돈다(원래
            // 이 함수가 여기서 Build()를 직접 부르지 않던 것과 같은 결) —
            // 필드만 채워 두면 Play 시작 때 이 값 그대로 굽는다.
            return go;
        }

        private static AudioClip[] _gatherClips;

        private static AudioClip[] LoadGatherClips()
        {
            if (_gatherClips != null) return _gatherClips;
            var clips = new AudioClip[GatherClipPaths.Length];
            for (int i = 0; i < GatherClipPaths.Length; i++)
            {
                clips[i] = AssetDatabase.LoadAssetAtPath<AudioClip>(GatherClipPaths[i]);
            }
            _gatherClips = clips;
            return _gatherClips;
        }

        private static void BuildFruitTree()
        {
            var go = new GameObject("FruitTree");
            go.transform.position = FruitTreeSpawn;
            var tree = go.AddComponent<ForestFruitTree>();
            SetPrivateField(tree, "treeModel", _treeGlb);
            SetPrivateField(tree, "treeMaterial", _treeMaterial);
            SetPrivateField(tree, "gatherClips", LoadGatherClips());
        }

        private static void BuildVillager()
        {
            var go = new GameObject("Villager_Keeper");
            go.transform.position = VillagerSpawn;
            var villager = go.AddComponent<ForestVillager>();
            SetPrivateField(villager, "modelPrefab", _villagerGlb);
            // PLAN.md 106-4 FOREST 몫 — 숲지기 사실 모델(없으면 null → Kenney). 굽기: Saga/Setup NPC Character Imports.
            SetPrivateField(villager, "rigPrefab", AssetDatabase.LoadAssetAtPath<GameObject>(SetupNpcCharacterImports.PrefabPath("PeasantMan")));
        }

        /// <summary>PLAN.md 109-4 — 마을 광장 둘레 시대 섞인 사람 여섯(`ForestEras.FolkList`). 몸이 없는 PC 는 캡슐.
        /// 굽기: `SetupNpcCharacterImports.SetupForestEraBodies`.</summary>
        private static void BuildEraFolk()
        {
            var root = new GameObject("EraFolk").transform;
            for (int i = 0; i < ForestEras.FolkList.Length; i++)
            {
                var f = ForestEras.FolkList[i];
                var go = new GameObject($"EraFolk_{f.Id}");
                go.transform.SetParent(root, false);
                go.transform.position = new Vector3(f.Start.x, 0f, f.Start.y);
                var folk = go.AddComponent<ForestEraFolk>();
                var prefab = AssetDatabase.LoadAssetAtPath<GameObject>(SetupNpcCharacterImports.PrefabPath(f.Body));
                if (prefab == null) Debug.LogWarning($"[BuildTestVillageForestScene] 시대 사람 몸 없음: {f.Body} — 캡슐로 대신");
                folk.Init(i, prefab);
                folk.BuildVisual();
            }
        }

        private static GameObject BuildHouse()
        {
            var go = new GameObject("House");
            go.transform.position = HouseSpawn;
            var house = go.AddComponent<ForestHouse>();
            house.Build(); // Awake()는 Play 모드에서만 저절로 불려 edit-time엔 명시로 불러야 한다.
            return go;
        }

        // "집 꾸미기(가구)" 슬라이스(2026-09-12) → **자유 배치로 재설계
        // (2026-09-13)** — IndoorRoom(ForestHouse.Awake()가 이미 지어 둔 실내,
        // +500m 포켓) 안에 좌판 하나 + 격자 배치 컴포넌트 하나를 놓는다.
        // 좌판 좌표는 `ForestHomeState.StallLocalPos`(단일 출처, 격자
        // 유효성 판정도 이 값을 그대로 쓴다)를 그대로 따른다 — 여기서
        // 따로 상수를 안 둔다.
        private static void BuildHomeFurniture(GameObject houseGo)
        {
            var indoorRoom = houseGo.transform.Find("IndoorRoom");
            if (indoorRoom == null)
            {
                Debug.LogError("[BuildTestVillageForestScene] House 안에 IndoorRoom을 못 찾음 — ForestHouse.Awake() 순서 확인 필요.");
                return;
            }

            var stallGo = new GameObject("FurnitureStall");
            stallGo.transform.SetParent(indoorRoom, false);
            stallGo.transform.localPosition = ForestHomeState.StallLocalPos;
            stallGo.AddComponent<ForestFurnitureStall>();

            var placerGo = new GameObject("FurniturePlacer");
            placerGo.transform.SetParent(indoorRoom, false);
            var placer = placerGo.AddComponent<ForestFurniturePlacer>();
            placer.SetIndoorRoom(indoorRoom);
        }

        // FOREST 다음 조각 — 벽지/장판 좌판(도배전). House.RepaintFinish()가
        // 실내를 다시 칠하려면 House를 찾아야 하는데, 집 안(포켓 공간)과
        // 달리 이건 평범한 야외 오브젝트라 Awake()에서
        // FindFirstObjectByType로 바로 찾을 수 있다.
        private static void BuildFinishStall()
        {
            var go = new GameObject("FinishStall");
            go.transform.position = FinishStallSpawn;
            go.AddComponent<ForestFinishStall>();
        }

        // "몬스터·퓨전 콘텐츠" 슬라이스 — Awake()가 Play 모드에서만 저절로
        // 불려도 되는 컴포넌트라(GO AnimalBuilder.cs와 같은 결 — 아무도 edit-time에
        // 그 자식을 즉시 찾을 필요가 없다) 명시적 Build() 호출 없이 AddComponent만.
        private static void BuildCreatures()
        {
            var go = new GameObject("Creatures");
            var builder = go.AddComponent<ForestCreatureBuilder>();

            // PLAN.md 108 후속 — 종마다 사실 모델(`SetupForestCreatureModels` 가 구운 프리팹). 없는 칸은 도형 폴백.
            var kinds = ForestCreatureBuilder.KindOrder;
            var models = new GameObject[kinds.Length];
            int found = 0;
            for (int i = 0; i < kinds.Length; i++)
            {
                models[i] = AssetDatabase.LoadAssetAtPath<GameObject>(SetupForestCreatureModels.PrefabPath(kinds[i]));
                if (models[i] != null) found++;
            }
            SetPrivateField(builder, "models", models);
            if (found < kinds.Length)
            {
                Debug.LogWarning($"[BuildTestVillageForestScene] 짐승 모델 {found}/{kinds.Length} — 나머지는 도형(Saga/Setup Forest Creature Models 먼저)");
            }
        }

        /// <summary>PLAN.md 101-2 5.3 "마을 번들"(2026-09-20) — 네 바이옴 존
        /// (`ForestBiomeData.Zones`) 중심에서 살짝 비껴 둔다(그 존의 창조물
        /// den 둘과 안 겹치는 자리 — `ForestCreatureBuilder.cs` 좌표 주석
        /// 참고, 존마다 den 두 개가 중심과 대각선 방향으로 퍼져 있어 반대
        /// 대각선으로 6m씩 옮기면 셋 다 안 겹친다).</summary>
        private static void BuildMuseum()
        {
            BuildCollectSpot(ForestMuseumState.Category.Insect, new Vector3(-19f, 0f, -14f),
                new Color(0.55f, 0.85f, 0.95f)); // 어둑숲 — 반짝벌레류, 차가운 빛.
            BuildCollectSpot(ForestMuseumState.Category.Mushroom, new Vector3(-19f, 0f, 14f),
                new Color(0.75f, 0.35f, 0.6f)); // 버섯숲.
            BuildCollectSpot(ForestMuseumState.Category.Fossil, new Vector3(19f, 0f, 14f),
                new Color(0.55f, 0.5f, 0.42f)); // 바위 지대.
            BuildCollectSpot(ForestMuseumState.Category.Flower, new Vector3(19f, 0f, -14f),
                new Color(0.95f, 0.6f, 0.75f)); // 꽃밭.
        }

        // 마을 중심 통행로(플레이어 스폰(-15z)과 네 존·집·주민이 흩어진
        // 본 마을 사이) — 다른 오브젝트와 안 겹치는 빈 자리.
        private static readonly Vector3 TownScoreBoardSpawn = new Vector3(0f, 0f, -5f);
        private static readonly Vector3 DeliveryCounterSpawn = new Vector3(-5f, 0f, -5f);
        // TownScoreBoard(0,-5)·DeliveryCounter(-5,-5)와 같은 통행로 위, 반대편 빈 자리.
        private static readonly Vector3 WishStoneSpawn = new Vector3(5f, 0f, -5f);

        private static void BuildTownScoreBoard()
        {
            var go = new GameObject("TownScoreBoard");
            go.transform.position = TownScoreBoardSpawn;
            go.AddComponent<ForestTownScoreBoard>();
        }

        private static void BuildDeliveryCounter()
        {
            var go = new GameObject("DeliveryCounter");
            go.transform.position = DeliveryCounterSpawn;
            go.AddComponent<ForestDeliveryCounter>();
        }

        /// <summary>PLAN.md 101-2 5.6 "축제 하루"(2026-09-21) — 소원(칠석 재해석).</summary>
        private static void BuildWishStone()
        {
            var go = new GameObject("WishStone");
            go.transform.position = WishStoneSpawn;
            go.AddComponent<ForestWishStone>();
        }

        /// <summary>PLAN.md 101-2 5.7 "택배 사슬"(2026-09-20) — 네 바이옴 존 중심에서
        /// 원점 반대 방향(x축)으로 8m 더 나가 둔다. 존마다 이미 den 둘(중심·중심에서
        /// 대각선 6~7m)과 도감 채집 자리(대각선 6m)가 있어, 이 셋과 안 겹치는
        /// 유일한 축 방향이 순수 x축 바깥쪽이다(`ForestCreatureBuilder.cs`
        /// 좌표 주석과 `BuildMuseum()` 대각선 오프셋 참고).</summary>
        private static void BuildDeliveryMailboxes()
        {
            for (int i = 0; i < ForestBiomeData.Zones.Length; i++)
            {
                var center = ForestBiomeData.Zones[i].Center;
                float x = center.x + (center.x >= 0f ? 8f : -8f);
                BuildDeliveryMailbox(i, new Vector3(x, 0f, center.y));
            }
        }

        private static void BuildDeliveryMailbox(int zoneIndex, Vector3 pos)
        {
            var go = new GameObject($"DeliveryMailbox_{ForestBiomeData.Zones[zoneIndex].DisplayName}");
            go.transform.position = pos;
            var mailbox = go.AddComponent<ForestDeliveryMailbox>();
            SetPrivateField(mailbox, "zoneIndex", zoneIndex);
        }

        // PLAN.md 108 ② 존 명소 넷 — 전부 CC0 GLB(Kenney), 코드 도형 아님.
        private const string AltarGlbPath = "Assets/Art/Shrine/altar-stone.glb";
        private const string LanternGlbPath = "Assets/Art/Props/lantern.glb";
        private const string RockLargeGlbPath = "Assets/Art/Rocks/rock_largeA.glb";
        private const string RockSmallGlbPath = "Assets/Art/Rocks/rock_smallA.glb";
        private const string PillarGlbPath = "Assets/Art/Buildings/pillar-stone.glb";

        /// <summary>PLAN.md 108 ② — 존마다 명소 하나(`ForestBiomeData.Zone.LandmarkPos`, 존 중심에서 바깥 z 로 7m).
        /// 모양은 "Visual" 아래(땅 휨 따라 `ForestLandmark` 가 내린다), 충돌체는 뿌리 쪽 "Colliders" 아래(안 움직인다).</summary>
        private static void BuildLandmarks()
        {
            for (int i = 0; i < ForestBiomeData.Zones.Length; i++)
            {
                var z = ForestBiomeData.Zones[i];
                var go = new GameObject($"Landmark_{z.Key}");
                go.transform.position = new Vector3(z.LandmarkPos.x, 0f, z.LandmarkPos.y);
                var visual = new GameObject("Visual").transform;
                visual.SetParent(go.transform, false);
                var cols = new GameObject("Colliders").transform;
                cols.SetParent(go.transform, false);
                switch (z.Key)
                {
                    case "dark_forest": // 이끼 돌제단 + 등불 둘(차가운 빛)
                        LandmarkPiece(visual, AltarGlbPath, Vector3.zero, 0f, 1.1f, Vector3.one);
                        LandmarkPiece(visual, LanternGlbPath, new Vector3(-1.7f, 0f, 0.5f), 0f, 1.5f, Vector3.one);
                        LandmarkPiece(visual, LanternGlbPath, new Vector3(1.7f, 0f, 0.5f), 0f, 1.5f, Vector3.one);
                        LandmarkLight(visual, new Vector3(0f, 1.8f, 0.6f), new Color(0.55f, 0.8f, 1f), 1.6f, 7f);
                        LandmarkBox(cols, new Vector3(0f, 0.55f, 0f), new Vector3(2.2f, 1.1f, 1.4f));
                        break;
                    case "rocky": // 거인 선돌 + 곁돌 셋
                        LandmarkPiece(visual, RockLargeGlbPath, Vector3.zero, 20f, 4.2f, new Vector3(0.7f, 1f, 0.7f));
                        LandmarkPiece(visual, RockSmallGlbPath, new Vector3(1.8f, 0f, 0.6f), 40f, 0.6f, Vector3.one);
                        LandmarkPiece(visual, RockSmallGlbPath, new Vector3(-1.5f, 0f, 1.1f), 130f, 0.5f, Vector3.one);
                        LandmarkPiece(visual, RockSmallGlbPath, new Vector3(0.4f, 0f, -1.9f), 250f, 0.7f, Vector3.one);
                        LandmarkCapsule(cols, Vector3.zero, 1.0f, 4.2f);
                        break;
                    case "mushroom_forest": // 요정 돌고리(작은 돌 여덟) + 가운데 보랏빛
                        for (int k = 0; k < 8; k++)
                        {
                            float a = k * Mathf.PI * 2f / 8f;
                            LandmarkPiece(visual, RockSmallGlbPath, new Vector3(Mathf.Cos(a), 0f, Mathf.Sin(a)) * 2.2f, k * 47f, 0.45f + (k % 3) * 0.1f, Vector3.one);
                        }
                        LandmarkLight(visual, new Vector3(0f, 0.7f, 0f), new Color(0.8f, 0.5f, 1f), 1.4f, 5f);
                        break; // 고리 안으로 걸어 들어갈 수 있게 충돌체 없음
                    default: // "flower_field" — 옛 돌기둥터(셋은 서고 하나는 부러짐)
                        for (int k = 0; k < 4; k++)
                        {
                            var p = new Vector3(k % 2 == 0 ? -1.8f : 1.8f, 0f, k < 2 ? -1.8f : 1.8f);
                            LandmarkPiece(visual, PillarGlbPath, p, k * 90f, k == 3 ? 1.1f : 2.6f, Vector3.one);
                            LandmarkCapsule(cols, p, 0.35f, k == 3 ? 1.1f : 2.6f);
                        }
                        break;
                }
                SetPrivateField(go.AddComponent<ForestLandmark>(), "zoneIndex", i);
            }
        }

        /// <summary>PLAN.md 108 끝줄 — 존 전용 소품(GO 지역 소품과 같은 Poly Haven 스캔, `ForestZoneProps`).</summary>
        private static void BuildZoneProps()
        {
            var go = new GameObject("ZoneProps");
            var builder = go.AddComponent<ForestZonePropsBuilder>();
            var ids = new System.Collections.Generic.List<string>();
            foreach (var c in ForestZoneProps.Clusters)
                foreach (var p in c.Pieces)
                {
                    int hash = p.Model.IndexOf('#');
                    string id = hash >= 0 ? p.Model.Substring(0, hash) : p.Model;
                    if (!ids.Contains(id)) ids.Add(id);
                }
            var models = new GameObject[ids.Count];
            var lods = new GameObject[ids.Count];
            for (int i = 0; i < ids.Count; i++)
            {
                models[i] = AssetDatabase.LoadAssetAtPath<GameObject>($"Assets/Art/Props/PolyHaven/{ids[i]}/{ids[i]}_1k.gltf");
                lods[i] = AssetDatabase.LoadAssetAtPath<GameObject>($"Assets/Art/Props/PolyHaven/{ids[i]}/{ids[i]}_lod1.glb");
                if (models[i] == null) Debug.LogWarning($"[BuildTestVillageForestScene] Poly Haven 모델 없음: {ids[i]}");
            }
            builder.Init(ids.ToArray(), models, lods);
            builder.Build();
        }

        /// <summary>GLB 하나를 키 `height`(축 배율 `axis` 뒤)로 맞춰 바닥이 `localPos.y` 에 닿게 놓는다. 딸린 충돌체는 지운다.</summary>
        private static void LandmarkPiece(Transform parent, string path, Vector3 localPos, float yaw, float height, Vector3 axis)
        {
            var prefab = AssetDatabase.LoadAssetAtPath<GameObject>(path);
            if (prefab == null)
            {
                Debug.LogWarning($"[BuildTestVillageForestScene] 명소 모델을 못 찾음 — {path}");
                return;
            }
            var inst = Object.Instantiate(prefab, parent, false);
            inst.name = System.IO.Path.GetFileNameWithoutExtension(path);
            inst.transform.localPosition = localPos;
            inst.transform.localRotation = Quaternion.Euler(0f, yaw, 0f);
            foreach (var c in inst.GetComponentsInChildren<Collider>()) Object.DestroyImmediate(c);
            if (path == RockLargeGlbPath || path == RockSmallGlbPath)
            {
                // Kenney 바위 재질은 금속·주황/청록 단색 — 사진 돌 재질로 갈아 끼운다(`RockStoneMaterial`).
                var stone = RockStoneMaterial.LoadOrCreate();
                if (stone != null)
                {
                    foreach (var r in inst.GetComponentsInChildren<MeshRenderer>())
                    {
                        var mats = r.sharedMaterials;
                        for (int i = 0; i < mats.Length; i++) mats[i] = stone;
                        r.sharedMaterials = mats;
                    }
                }
            }
            var b = WorldBounds(inst);
            if (b.size.y > 0.001f) inst.transform.localScale = Vector3.Scale(axis, Vector3.one * (height / b.size.y));
            b = WorldBounds(inst);
            inst.transform.position += Vector3.up * (parent.TransformPoint(localPos).y - b.min.y);
        }

        private static Bounds WorldBounds(GameObject go)
        {
            var rs = go.GetComponentsInChildren<Renderer>();
            if (rs.Length == 0) return new Bounds(go.transform.position, Vector3.zero);
            var b = rs[0].bounds;
            for (int i = 1; i < rs.Length; i++) b.Encapsulate(rs[i].bounds);
            return b;
        }

        private static void LandmarkLight(Transform parent, Vector3 localPos, Color color, float intensity, float range)
        {
            var go = new GameObject("LandmarkLight");
            go.transform.SetParent(parent, false);
            go.transform.localPosition = localPos;
            var l = go.AddComponent<Light>();
            l.type = LightType.Point;
            l.color = color;
            l.intensity = intensity;
            l.range = range;
            l.shadows = LightShadows.None;
        }

        private static void LandmarkBox(Transform parent, Vector3 center, Vector3 size)
        {
            var c = new GameObject("Box").AddComponent<BoxCollider>();
            c.transform.SetParent(parent, false);
            c.center = center;
            c.size = size;
        }

        private static void LandmarkCapsule(Transform parent, Vector3 pos, float radius, float height)
        {
            var c = new GameObject("Capsule").AddComponent<CapsuleCollider>();
            c.transform.SetParent(parent, false);
            c.transform.localPosition = pos;
            c.radius = radius;
            c.height = height;
            c.center = new Vector3(0f, height * 0.5f, 0f);
        }

        private static void BuildCollectSpot(ForestMuseumState.Category category, Vector3 pos, Color color)
        {
            var go = new GameObject($"CollectSpot_{category}");
            go.transform.position = pos;
            var spot = go.AddComponent<ForestCollectSpot>();
            SetPrivateField(spot, "category", category);
            SetPrivateField(spot, "pool", ForestMuseumState.ItemsOf(category));
            SetPrivateField(spot, "spotColor", color);
            SetPrivateField(spot, "gatherClips", LoadGatherClips());
        }

        private static (GameObject playerGo, Transform playerTransform) BuildPlayer()
        {
            var playerGo = new GameObject("Player");
            playerGo.tag = "Player";
            playerGo.transform.position = PlayerSpawn;

            var controller = playerGo.AddComponent<CharacterController>();
            controller.radius = 0.4f;
            controller.height = 1.8f;
            controller.center = new Vector3(0f, 0.9f, 0f);

            Animator playerAnimator;
            Transform visual = BuildPlayerVisual(playerGo.transform, out playerAnimator);
            var visualGo = visual.gameObject;

            var rigGo = new GameObject("CameraRig");
            rigGo.transform.SetParent(playerGo.transform, false);
            rigGo.transform.localPosition = new Vector3(0f, 0.9f, 0f);
            var cameraRig = rigGo.AddComponent<CameraRig>();

            var camGo = new GameObject("PlayerCamera");
            camGo.transform.SetParent(rigGo.transform, false);
            var cam = camGo.AddComponent<Camera>();
            cam.tag = "MainCamera";
            cam.clearFlags = CameraClearFlags.SolidColor;
            cam.backgroundColor = ForestSkyFogBuilder.HorizonColor; // golden-hour 톤 — 던전(검정)과 다르게 야외.
            camGo.AddComponent<AudioListener>();
            camGo.AddComponent<UnityEngine.Rendering.Universal.UniversalAdditionalCameraData>()
                .renderPostProcessing = true;

            var inputActions = AssetDatabase.LoadAssetAtPath<UnityEngine.InputSystem.InputActionAsset>(InputActionsPath);
            if (inputActions == null)
            {
                Debug.LogWarning($"[BuildTestVillageForestScene] {InputActionsPath} 를 못 찾음 — Move/Sprint 입력이 안 먹는다.");
            }

            var pc = playerGo.AddComponent<PlayerController>();
            SetPrivateField(pc, "visual", visualGo.transform);
            SetPrivateField(pc, "animator", playerAnimator);
            SetPrivateField(pc, "cameraRig", cameraRig);
            SetPrivateField(pc, "inputActions", inputActions);
            playerGo.AddComponent<BlobShadow>(); // PLAN.md 102-2 "Shadows" — Mobile만 켜진다.

            return (playerGo, playerGo.transform);
        }

        /// <summary>Maria(Humanoid, Animator 포함) → 실패 시 character-a →
        /// 실패 시 primitive capsule 순으로 폴백(BuildTestVillageScene.cs와
        /// 같은 결). 이 게임엔 전투가 없어 animator는 Speed만 쓴다.</summary>
        private static Transform BuildPlayerVisual(Transform parent, out Animator animator)
        {
            animator = null;

            var mariaBody = AssetDatabase.LoadAssetAtPath<GameObject>(MariaBodyFbxPath);
            if (mariaBody != null)
            {
                var maria = (GameObject)PrefabUtility.InstantiatePrefab(mariaBody, parent);
                maria.name = "Visual";
                maria.transform.localPosition = Vector3.zero;
                maria.transform.localRotation = Quaternion.identity;
                maria.transform.localScale = Vector3.one * (PlayerTargetHeight / MariaNativeHeight);

                animator = maria.GetComponent<Animator>();
                if (animator == null)
                {
                    animator = maria.AddComponent<Animator>();
                }
                var controller = AssetDatabase.LoadAssetAtPath<UnityEditor.Animations.AnimatorController>(MariaControllerPath);
                if (controller == null)
                {
                    Debug.LogWarning($"[BuildTestVillageForestScene] {MariaControllerPath} 를 못 찾음 — Maria 시각화는 되지만 애니메이션이 안 돎.");
                }
                animator.runtimeAnimatorController = controller;

                BuildTestCharacterRealisticScene.ApplySkinSplit(maria);
                return maria.transform;
            }

            Debug.LogWarning($"[BuildTestVillageForestScene] {MariaBodyFbxPath} 를 못 찾음(로컬 전용 자산, mixamo.com에서 받아야 함) — character-a로 폴백.");
            return _playerGlb != null
                ? CharacterVisual.Spawn(_playerGlb, parent, PlayerTargetHeight, Color.white)
                : CharacterVisual.SpawnFallbackCapsule(parent, PlayerTargetHeight, Color.white);
        }

        /// <summary>곡률 중심을 매 프레임 플레이어 위치로 갱신 —
        /// ForestWorldCurveDriver.cs 참고.</summary>
        private static void BuildCurveDriver(Transform playerTransform)
        {
            var go = new GameObject("ForestWorldCurveDriver");
            var driver = go.AddComponent<ForestWorldCurveDriver>();
            SetPrivateField(driver, "player", playerTransform);
        }

        /// <summary>PLAN.md 66-2장(파이널 판타지 최신작 기준) "다음에 할 일"
        /// ① 라이팅/색보정/후처리 — BuildFF16VolumeProfiles.cs가 지어 둔
        /// 공유 자산(PC/Mobile) 중 플랫폼에 맞는 쪽을 PlatformVolumeProfile이
        /// 골라 낀다. 에디터 프리뷰는 기본으로 PC 프로파일을 미리 꽂아 둔다.</summary>
        private static void BuildPostProcessingVolume()
        {
            var go = new GameObject("GlobalVolume");
            var volume = go.AddComponent<UnityEngine.Rendering.Volume>();
            volume.isGlobal = true;
            volume.weight = 1f;

            var pcProfile = AssetDatabase.LoadAssetAtPath<UnityEngine.Rendering.VolumeProfile>(
                BuildFF16VolumeProfiles.PcProfilePath);
            var mobileProfile = AssetDatabase.LoadAssetAtPath<UnityEngine.Rendering.VolumeProfile>(
                BuildFF16VolumeProfiles.MobileProfilePath);
            if (pcProfile == null)
            {
                Debug.LogWarning("[BuildTestVillageForestScene] FF16Volume_PC.asset 을 못 찾음 — " +
                                  "Saga > Build FF16 Volume Profiles 를 먼저 돌릴 것.");
            }

            var platform = go.AddComponent<PlatformVolumeProfile>();
            platform.pcProfile = pcProfile;
            platform.mobileProfile = mobileProfile;
            volume.sharedProfile = pcProfile; // .profile은 씬에 저장 안 되는 런타임 복사본용(Volume.cs 참고)
        }

        /// <summary>PLAN.md 102-1-2 "판별 색보정 LUT" — 들판 톤(황금시각).
        /// 공유 GlobalVolume 위에 우선순위 더 높은 두 번째 Volume 으로
        /// 겹쳐 낀다(`BuildGameToneLuts.cs`, ColorLookup만 담아 다른 값은
        /// 안 건드림). PC·Mobile 둘 다 적용(102-2 표).</summary>
        private static void BuildToneVolume()
        {
            var toneProfile = AssetDatabase.LoadAssetAtPath<UnityEngine.Rendering.VolumeProfile>(
                BuildGameToneLuts.ForestProfilePath);
            if (toneProfile == null)
            {
                Debug.LogWarning("[BuildTestVillageForestScene] " + BuildGameToneLuts.ForestProfilePath +
                                  " 를 못 찾음 — Saga > Build Game Tone LUTs 를 먼저 돌릴 것.");
                return;
            }
            var go = new GameObject("ToneVolume");
            var volume = go.AddComponent<UnityEngine.Rendering.Volume>();
            volume.isGlobal = true;
            volume.weight = 1f;
            volume.priority = 1f;
            volume.sharedProfile = toneProfile;
        }

        private static void BuildEventSystem()
        {
            var esGo = new GameObject("EventSystem");
            esGo.AddComponent<EventSystem>();
            esGo.AddComponent<InputSystemUIInputModule>();
        }

        private static void BuildDialogueUi()
        {
            var canvasGo = new GameObject("DialogueUI");
            var canvas = canvasGo.AddComponent<Canvas>();
            canvas.renderMode = RenderMode.ScreenSpaceOverlay;
            var scaler = canvasGo.AddComponent<CanvasScaler>();
            scaler.uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize;
            Saga.Core.SagaUi.ApplyGameScaler(scaler);
            canvasGo.AddComponent<GraphicRaycaster>();

            var textGo = new GameObject("Label", typeof(RectTransform));
            textGo.transform.SetParent(canvasGo.transform, false);
            var rect = (RectTransform)textGo.transform;
            rect.anchorMin = new Vector2(0.5f, 1f);
            rect.anchorMax = new Vector2(0.5f, 1f);
            rect.pivot = new Vector2(0.5f, 1f);
            rect.anchoredPosition = new Vector2(0f, -80f);
            rect.sizeDelta = new Vector2(920f, 160f);

            var text = textGo.AddComponent<TextMeshProUGUI>();
            text.fontSize = 32;
            text.alignment = TextAlignmentOptions.Center;
            text.color = Color.white;
            text.textWrappingMode = TextWrappingModes.Normal;
            text.text = "";

            var dialogueLabel = canvasGo.AddComponent<DialogueLabel>();
            SetPrivateField(dialogueLabel, "label", text);
            textGo.SetActive(false);
        }

        // 67장 "사운드" 첫 슬라이스(2026-09-14, ForestAudio.cs 참고) — Kenney
        // Interface Sounds(누름)·RPG Sounds(해소) CC0, docs/ASSET_GUIDE.md 참고.
        private const string PressClipPath = "Assets/Art/Audio/Kenney_RPGSounds/chop.ogg";
        private const string ResolveClipPath = "Assets/Art/Audio/Kenney_InterfaceSounds/confirmation_001.ogg";

        /// <summary>44장 "전투 콘텐츠"(2026-09-14) — 포자괴물과 대치했을 때
        /// 뜨는 "밀어내기" 미니게임 UI. BuildDialogueUi()와 같은 패턴(자체
        /// Canvas 하나).</summary>
        private static void BuildHostileEncounterUi()
        {
            var canvasGo = new GameObject("HostileEncounterUI");
            var canvas = canvasGo.AddComponent<Canvas>();
            canvas.renderMode = RenderMode.ScreenSpaceOverlay;
            var scaler = canvasGo.AddComponent<CanvasScaler>();
            scaler.uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize;
            Saga.Core.SagaUi.ApplyGameScaler(scaler);
            canvasGo.AddComponent<GraphicRaycaster>();

            var pressClip = AssetDatabase.LoadAssetAtPath<AudioClip>(PressClipPath);
            var resolveClip = AssetDatabase.LoadAssetAtPath<AudioClip>(ResolveClipPath);
            if (pressClip == null || resolveClip == null)
            {
                Debug.LogWarning("[BuildTestVillageForestScene] 밀어내기 SFX 클립을 못 찾음 — 소리 없이 동작.");
            }

            var ui = canvasGo.AddComponent<ForestHostileEncounterUi>();
            ui.Build(canvasGo.transform, pressClip, resolveClip);
        }

        /// <summary>화면 왼쪽 위 — 디버그 빌드에서만 렌더러 이름·FPS·좌표
        /// (DebugHud.cs 클래스 주석 참고, GO와 같은 결).</summary>
        private static void BuildDebugOverlay()
        {
            var canvasGo = new GameObject("DebugUI");
            var canvas = canvasGo.AddComponent<Canvas>();
            canvas.renderMode = RenderMode.ScreenSpaceOverlay;
            var scaler = canvasGo.AddComponent<CanvasScaler>();
            scaler.uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize;
            Saga.Core.SagaUi.ApplyGameScaler(scaler);
            canvasGo.AddComponent<GraphicRaycaster>();

            var textGo = new GameObject("Label", typeof(RectTransform));
            textGo.transform.SetParent(canvasGo.transform, false);
            var rect = (RectTransform)textGo.transform;
            rect.anchorMin = new Vector2(0f, 1f);
            rect.anchorMax = new Vector2(0f, 1f);
            rect.pivot = new Vector2(0f, 1f);
            rect.anchoredPosition = new Vector2(20f, -20f);
            rect.sizeDelta = new Vector2(600f, 120f);

            var text = textGo.AddComponent<TextMeshProUGUI>();
            text.fontSize = 22;
            text.alignment = TextAlignmentOptions.TopLeft;
            text.color = new Color(1f, 1f, 1f, 0.8f);
            text.text = "";

            var overlay = canvasGo.AddComponent<DebugHud>();
            SetPrivateField(overlay, "label", text);
        }

        private static void BuildSaveButton()
        {
            var canvasGo = new GameObject("SaveUI");
            var canvas = canvasGo.AddComponent<Canvas>();
            canvas.renderMode = RenderMode.ScreenSpaceOverlay;
            var scaler = canvasGo.AddComponent<CanvasScaler>();
            scaler.uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize;
            Saga.Core.SagaUi.ApplyGameScaler(scaler);
            canvasGo.AddComponent<GraphicRaycaster>();

            var btnGo = new GameObject("SaveButton", typeof(RectTransform));
            btnGo.transform.SetParent(canvasGo.transform, false);
            var rect = (RectTransform)btnGo.transform;
            rect.anchorMin = new Vector2(1f, 1f);
            rect.anchorMax = new Vector2(1f, 1f);
            rect.pivot = new Vector2(1f, 1f);
            rect.anchoredPosition = new Vector2(-30f, -30f);
            rect.sizeDelta = new Vector2(160f, 80f);

            var img = btnGo.AddComponent<Image>();
            img.color = new Color(0f, 0f, 0f, 0.25f);
            var button = btnGo.AddComponent<Button>();
            button.targetGraphic = img;
            // 2026-09-23 — 예전 onClick.AddListener(람다)는 씬 저장 때 사라져 폰에서 먹통이었다.
            var saver = btnGo.AddComponent<ForestSaveButton>();
            ButtonWiring.Wire(button, saver.Save);

            var textGo = new GameObject("Text", typeof(RectTransform));
            textGo.transform.SetParent(btnGo.transform, false);
            var textRect = (RectTransform)textGo.transform;
            textRect.anchorMin = Vector2.zero;
            textRect.anchorMax = Vector2.one;
            textRect.offsetMin = Vector2.zero;
            textRect.offsetMax = Vector2.zero;
            var text = textGo.AddComponent<TextMeshProUGUI>();
            text.fontSize = 26;
            text.alignment = TextAlignmentOptions.Center;
            text.color = Color.white;
            text.text = ForestLocalization.T("action.save", "저장");

            var localized = btnGo.AddComponent<LocalizedButtonLabel>();
            localized.Init("action.save", "저장");
        }

        /// <summary>PLAN.md 67~69장 "접근성" — 효과음·진동·UI 크기·그래픽
        /// 품질. "저장" 버튼(-30,-30,160×80) 바로 아래가 GO와 같은 이유로
        /// 이 판에서도 유일하게 빈 오른쪽 위 자리다.</summary>
        private static void BuildSettingsUi()
        {
            var go = new GameObject("ForestSettingsPanel");
            var panel = go.AddComponent<ForestSettingsPanel>();
            panel.Build();
        }

        /// <summary>PLAN.md 101-2 "공통 선행" A·B — 목표판 3줄 + 세션 마무리
        /// 카드(FOREST 세 번째 이식, GO·DUNGEON의 `BuildGoalBoardUi()`와
        /// 완전히 같은 배선). GoalBoard·SessionCard 는 Awake()가 자기 UI를
        /// 다시 짓는 SagaCore 공용 컴포넌트라 [SerializeField] 배선이
        /// 필요 없다 — ForestSessionTracker(이 판 전용, Saga.Forest.UI)
        /// 하나가 IGoalSource 를 구현하면서 SessionCard 표시도 같이 맡는다.
        /// Player가 이미 씬에 있어야 하니 BuildPlayer() 뒤에서만 부른다.</summary>
        private static void BuildGoalBoardUi()
        {
            var cardGo = new GameObject("SessionCard");
            var sessionCard = cardGo.AddComponent<SessionCard>();

            var trackerGo = new GameObject("ForestSessionTracker");
            var tracker = trackerGo.AddComponent<ForestSessionTracker>();
            tracker.Init(sessionCard);

            var boardGo = new GameObject("GoalBoard");
            var board = boardGo.AddComponent<GoalBoard>();
            board.Init(tracker);
        }

        private static void BuildMobileHud()
        {
            var canvasGo = new GameObject("MobileHUD");
            var canvas = canvasGo.AddComponent<Canvas>();
            canvas.renderMode = RenderMode.ScreenSpaceOverlay;
            var scaler = canvasGo.AddComponent<CanvasScaler>();
            scaler.uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize;
            Saga.Core.SagaUi.ApplyGameScaler(scaler);
            canvasGo.AddComponent<GraphicRaycaster>();

            var baseGo = new GameObject("JoystickBase", typeof(RectTransform));
            baseGo.transform.SetParent(canvasGo.transform, false);
            var baseRect = (RectTransform)baseGo.transform;
            baseRect.anchorMin = new Vector2(0f, 0f);
            baseRect.anchorMax = new Vector2(0f, 0f);
            baseRect.pivot = new Vector2(0.5f, 0.5f);
            baseRect.anchoredPosition = new Vector2(140f, 220f);
            baseRect.sizeDelta = new Vector2(140f, 140f);
            var baseImg = baseGo.AddComponent<Image>();
            baseImg.color = new Color(1f, 1f, 1f, 0.18f);

            var knobGo = new GameObject("Knob", typeof(RectTransform));
            knobGo.transform.SetParent(baseGo.transform, false);
            var knobRect = (RectTransform)knobGo.transform;
            knobRect.anchorMin = knobRect.anchorMax = new Vector2(0.5f, 0.5f);
            knobRect.pivot = new Vector2(0.5f, 0.5f);
            knobRect.sizeDelta = new Vector2(64f, 64f);
            var knobImg = knobGo.AddComponent<Image>();
            knobImg.color = new Color(1f, 1f, 1f, 0.55f);

            var joystick = baseGo.AddComponent<VirtualJoystick>();
            SetPrivateField(joystick, "knob", knobRect);
            SetPrivateField(joystick, "radius", 60f);
        }

        private static void BuildBootstrap()
        {
            var go = new GameObject("ForestBootstrap");
            var bootstrap = go.AddComponent<ForestBootstrap>();

            // 67장 "사운드" BGM(2026-09-15) — docs/ASSET_GUIDE.md 참고.
            var bgmClip = AssetDatabase.LoadAssetAtPath<AudioClip>("Assets/Art/Audio/CC0_BGM/forest_peaceful_town.ogg");
            if (bgmClip == null) Debug.LogWarning("[BuildTestVillageForestScene] BGM 클립을 못 찾음 — 소리 없이 동작.");
            SetPrivateField(bootstrap, "bgmClip", bgmClip);

            // PLAN.md 109-12-1 떠돌이 방문객 — 다른 판 씬이 이미 쓰는 몸을 빌린다(`ForestVisitors.List` 의 Body, 도깨비불은 몸 없음).
            var names = new System.Collections.Generic.List<string>();
            var models = new System.Collections.Generic.List<GameObject>();
            foreach (var v in ForestVisitors.List)
            {
                if (string.IsNullOrEmpty(v.Body) || names.Contains(v.Body)) continue;
                names.Add(v.Body);
                models.Add(AssetDatabase.LoadAssetAtPath<GameObject>(SetupNpcCharacterImports.PrefabPath(v.Body)));
            }
            SetPrivateField(bootstrap, "visitorBodyNames", names.ToArray());
            SetPrivateField(bootstrap, "visitorBodyModels", models.ToArray());
        }

        private static void SetPrivateField(object target, string fieldName, object value)
        {
            var field = target.GetType().GetField(fieldName,
                System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Instance);
            if (field == null)
            {
                Debug.LogError($"[BuildTestVillageForestScene] {target.GetType().Name}에 필드 '{fieldName}'이 없다.");
                return;
            }
            field.SetValue(target, value);
        }
    }
}
