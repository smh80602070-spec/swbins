using TMPro;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.InputSystem.UI;
using UnityEngine.UI;
using Saga.Realm.World;
using Saga.Realm.Player;
using Saga.Realm.UI;
using Saga.Realm.Data;
using Saga.Core;

namespace Saga.EditorTools
{
    /// <summary>
    /// VERTICAL_SLICE_REALM.md — TestCity 씬을 코드로 조립해 저장한다.
    /// `BuildTestStoryScene.cs`와 같은 결(멱등, 다시 실행하면 통째로 새로
    /// 짠다). REALM은 다섯 판 중 유일하게 실시간 이동·전투가 없는 턴제
    /// 경영이라(1절) 플레이어 GameObject·CharacterController·입력
    /// 액션 애셋이 아예 없다 — 카메라는 성 중심(원점)에 고정된 궤도
    /// 카메라 하나뿐이다.
    /// </summary>
    public static class BuildTestCityScene
    {
        private const string ScenePath = "Assets/Scenes/TestCity.unity";

        private static readonly Color SkyColor = new Color(0.55f, 0.75f, 0.92f);

        // 44장 "Environment/Building" 교체 — RealmCityBuilder.cs 주석 참고
        // (REALM은 Player/Enemy 우선순위가 안 맞아 바닥/성벽을 그 자리에 넣었다).
        private const string CityGroundMatPath = "Assets/Art/Environment/PBR/cobblestone_floor_01_URPLit.mat";
        private const string CityWallMatPath = "Assets/Art/Environment/PBR/castle_wall_slates_URPLit.mat";
        // 이어서(2026-09-14 후속) — 농장/저잣거리(곳간은 wallMaterial 재사용).
        private const string CityFarmMatPath = "Assets/Art/Environment/PBR/leafy_grass_URPLit.mat";
        private const string CityMarketMatPath = "Assets/Art/Environment/PBR/dark_wooden_planks_URPLit.mat";

        // 2026-09-14 "사운드" — RealmCommandUi.cs 클래스 주석 참고. FOREST/GO와
        // 같은 Kenney CC0 자산 트리(Assets/Art/Audio, 다섯 판 공유 원본).
        private const string ConfirmClipPath = "Assets/Art/Audio/Kenney_InterfaceSounds/confirmation_001.ogg";
        private const string ErrorClipPath = "Assets/Art/Audio/Kenney_InterfaceSounds/error_001.ogg";

        [MenuItem("Saga/Build TestCity Scene")]
        public static void Build()
        {
            // 2026-09-20 실제로 겪음 — `RealmCommandUi.Build()`가 설정 버튼
            // 이름을 `RealmLocalization.CurrentLanguage`(PlayerPrefs, 이
            // 배치 프로세스와 무관하게 디스크에 남는다)로 짓는다("Btn_설정"/
            // "Btn_Settings"). 직전에 실패해 "en"으로 멈춘 헤드리스 실행
            // 뒤 이 스크립트를 그대로 돌리면 씬에 영어 이름이 구워져
            // `PlaytestRealmSlice.CheckSettingsPanel()`이 "Btn_설정"을
            // 영영 못 찾는다 — `PlaytestRealmSlice.Run()`이 자기 실행 전에
            // "ko"로 고정하는 것과 같은 이유로 여기서도 고정한다.
            RealmLocalization.CurrentLanguage = "ko";
            var scene = EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);

            BuildLighting();
            var cityGo = BuildCity();
            var dioramaRig = BuildCamera();
            var worldMapGo = BuildWorldMap();
            var mapCameraRig = BuildWorldMapCamera();
            BuildPostProcessingVolume();
            BuildToneVolume();
            BuildEventSystem();
            BuildHudAndCommands();
            BuildGoalBoardUi();
            BuildDebugOverlay();
            BuildBootstrap();
            BuildActorBodies();
            BuildMapViewSwitcher(cityGo, dioramaRig, worldMapGo, mapCameraRig);

            AssetDatabase.SaveAssets();
            EditorSceneManager.SaveScene(scene, ScenePath);
            Debug.Log($"[BuildTestCityScene] saved to {ScenePath}");
        }

        /// <summary>PLAN.md 66-2장(파이널 판타지 최신작 기준) 라이팅/무드 —
        /// golden-hour급으로 각도를 낮추고 색을 데워 Bloom(66-2 후처리)이
        /// 반응하게 한다. 차가운 톤 RimLight로 실루엣 강조(66-2장). 월드맵
        /// 카메라도 같은 Light를 공유하니 두 뷰 다 톤이 같이 바뀐다.</summary>
        private static void BuildLighting()
        {
            var sunGo = new GameObject("Light");
            var light = sunGo.AddComponent<Light>();
            light.type = LightType.Directional;
            light.intensity = 1.7f;
            light.color = new Color(1f, 0.88f, 0.72f);
            light.shadows = LightShadows.Soft;
            sunGo.transform.rotation = Quaternion.Euler(35f, -25f, 0f);

            var rimGo = new GameObject("RimLight");
            var rim = rimGo.AddComponent<Light>();
            rim.type = LightType.Directional;
            rim.intensity = 0.45f;
            rim.color = new Color(0.55f, 0.6f, 0.85f);
            rim.shadows = LightShadows.None;
            rimGo.transform.rotation = Quaternion.Euler(20f, 155f, 0f);

            RenderSettings.ambientMode = UnityEngine.Rendering.AmbientMode.Flat;
            RenderSettings.ambientLight = new Color(0.5f, 0.55f, 0.6f);
        }

        private static GameObject BuildCity()
        {
            var cityGo = new GameObject("City");
            var builder = cityGo.AddComponent<RealmCityBuilder>();
            var groundMat = AssetDatabase.LoadAssetAtPath<Material>(CityGroundMatPath);
            var wallMat = AssetDatabase.LoadAssetAtPath<Material>(CityWallMatPath);
            if (groundMat != null) SetPrivateField(builder, "groundMaterial", groundMat);
            if (wallMat != null) SetPrivateField(builder, "wallMaterial", wallMat);
            var farmMat = AssetDatabase.LoadAssetAtPath<Material>(CityFarmMatPath);
            var marketMat = AssetDatabase.LoadAssetAtPath<Material>(CityMarketMatPath);
            if (farmMat != null) SetPrivateField(builder, "farmMaterial", farmMat);
            if (marketMat != null) SetPrivateField(builder, "marketMaterial", marketMat);
            builder.Rebuild(); // Awake()는 Play 모드에서만 자동으로 도니 edit-time 저장을 위해 직접 부른다.
            return cityGo;
        }

        /// <summary>카메라 리그는 성 중심(원점)에 고정 — 쫓아갈 플레이어가
        /// 없다(RealmOrbitCamera.cs 클래스 주석 참고).</summary>
        private static GameObject BuildCamera()
        {
            var rigGo = new GameObject("RealmCameraRig");
            rigGo.transform.position = Vector3.zero;
            var orbitCam = rigGo.AddComponent<RealmOrbitCamera>();

            var camGo = new GameObject("RealmCamera");
            camGo.transform.SetParent(rigGo.transform, false);
            var cam = camGo.AddComponent<Camera>();
            cam.tag = "MainCamera";
            cam.clearFlags = CameraClearFlags.SolidColor;
            cam.backgroundColor = SkyColor;
            camGo.AddComponent<AudioListener>();
            camGo.AddComponent<UnityEngine.Rendering.Universal.UniversalAdditionalCameraData>()
                .renderPostProcessing = true;

            SetPrivateField(orbitCam, "cam", cam);
            return rigGo;
        }

        /// <summary>VERTICAL_SLICE_REALM.md 2-8절 — 지도 자체(바닥+성표
        /// 셋). 기본은 꺼 둔다(RealmMapViewSwitcher.Apply()가 시작할 때
        /// ViewingMap=false에 맞춰 다시 끈다 — 여기서 먼저 꺼 두는 건
        /// 씬을 저장한 그대로 열어도 처음부터 디오라마만 보이게 하기
        /// 위함, Play 안 돌린 에디터 미리보기에도 적용된다).</summary>
        private static GameObject BuildWorldMap()
        {
            var go = new GameObject("WorldMap");
            var map = go.AddComponent<RealmWorldMap>();
            map.Rebuild();
            go.SetActive(false);
            return go;
        }

        /// <summary>2-10절 — 드래그 궤도 카메라, 지도 중심(원점)을 돈다.
        /// 디오라마 카메라와 마찬가지로 태그는 MainCamera지만 기본
        /// 비활성이라 Camera.main은 활성 쪽(디오라마)만 찾는다.</summary>
        private static GameObject BuildWorldMapCamera()
        {
            var rigGo = new GameObject("WorldMapCameraRig");
            var mapCam = rigGo.AddComponent<RealmWorldMapCamera>();

            var camGo = new GameObject("WorldMapCamera");
            camGo.transform.SetParent(rigGo.transform, false);
            var cam = camGo.AddComponent<Camera>();
            cam.tag = "MainCamera";
            cam.clearFlags = CameraClearFlags.SolidColor;
            cam.backgroundColor = SkyColor;
            cam.farClipPlane = 2000f; // 지도 반경(최대 420)이 디오라마보다 훨씬 커서 기본 1000으로도 충분하지만 여유를 둔다.
            camGo.AddComponent<AudioListener>();
            camGo.AddComponent<UnityEngine.Rendering.Universal.UniversalAdditionalCameraData>()
                .renderPostProcessing = true;

            SetPrivateField(mapCam, "cam", cam);
            rigGo.SetActive(false);
            return rigGo;
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
                Debug.LogWarning("[BuildTestCityScene] FF16Volume_PC.asset 을 못 찾음 — " +
                                  "Saga > Build FF16 Volume Profiles 를 먼저 돌릴 것.");
            }

            var platform = go.AddComponent<PlatformVolumeProfile>();
            platform.pcProfile = pcProfile;
            platform.mobileProfile = mobileProfile;
            volume.sharedProfile = pcProfile; // .profile은 씬에 저장 안 되는 런타임 복사본용(Volume.cs 참고)
        }

        /// <summary>PLAN.md 102-1-2 "판별 색보정 LUT" — 성 톤(저채도). 공유
        /// GlobalVolume 위에 우선순위 더 높은 두 번째 Volume 으로 겹쳐
        /// 낀다(`BuildGameToneLuts.cs`, ColorLookup만 담아 다른 값은 안
        /// 건드림). PC·Mobile 둘 다 적용(102-2 표).</summary>
        private static void BuildToneVolume()
        {
            var toneProfile = AssetDatabase.LoadAssetAtPath<UnityEngine.Rendering.VolumeProfile>(
                BuildGameToneLuts.RealmProfilePath);
            if (toneProfile == null)
            {
                Debug.LogWarning("[BuildTestCityScene] " + BuildGameToneLuts.RealmProfilePath +
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

        private static void BuildMapViewSwitcher(GameObject dioramaRoot, GameObject dioramaCameraRig,
            GameObject worldMapRoot, GameObject worldMapCameraRig)
        {
            var go = new GameObject("RealmMapViewSwitcher");
            var switcher = go.AddComponent<RealmMapViewSwitcher>();
            SetPrivateField(switcher, "dioramaRoot", dioramaRoot);
            SetPrivateField(switcher, "dioramaCameraRig", dioramaCameraRig);
            SetPrivateField(switcher, "worldMapRoot", worldMapRoot);
            SetPrivateField(switcher, "worldMapCameraRig", worldMapCameraRig);
        }

        private static void BuildEventSystem()
        {
            var esGo = new GameObject("EventSystem");
            esGo.AddComponent<EventSystem>();
            esGo.AddComponent<InputSystemUIInputModule>();
        }

        private static void BuildHudAndCommands()
        {
            var hudCanvasGo = new GameObject("RealmHudUI");
            var canvas = hudCanvasGo.AddComponent<Canvas>();
            canvas.renderMode = RenderMode.ScreenSpaceOverlay;
            var scaler = hudCanvasGo.AddComponent<CanvasScaler>();
            scaler.uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize;
            Saga.Core.SagaUi.ApplyGameScaler(scaler);
            hudCanvasGo.AddComponent<GraphicRaycaster>();

            var textGo = new GameObject("Label", typeof(RectTransform));
            textGo.transform.SetParent(hudCanvasGo.transform, false);
            var rect = (RectTransform)textGo.transform;
            rect.anchorMin = new Vector2(0f, 1f);
            rect.anchorMax = new Vector2(0f, 1f);
            rect.pivot = new Vector2(0f, 1f);
            rect.anchoredPosition = new Vector2(20f, -20f);
            rect.sizeDelta = new Vector2(760f, 340f);

            var text = textGo.AddComponent<TextMeshProUGUI>();
            text.fontSize = 26;
            text.alignment = TextAlignmentOptions.TopLeft;
            text.color = Color.white;
            text.text = "";

            var hud = hudCanvasGo.AddComponent<RealmHud>();
            SetPrivateField(hud, "label", text);

            var toastGo = new GameObject("ToastLabel", typeof(RectTransform));
            toastGo.transform.SetParent(hudCanvasGo.transform, false);
            var toastRect = (RectTransform)toastGo.transform;
            toastRect.anchorMin = new Vector2(0.5f, 0f);
            toastRect.anchorMax = new Vector2(0.5f, 0f);
            toastRect.pivot = new Vector2(0.5f, 0f);
            toastRect.anchoredPosition = new Vector2(0f, 260f);
            toastRect.sizeDelta = new Vector2(900f, 90f);
            var toastText = toastGo.AddComponent<TextMeshProUGUI>();
            toastText.fontSize = 28;
            toastText.alignment = TextAlignmentOptions.Center;
            toastText.color = Color.white;
            var toast = hudCanvasGo.AddComponent<RealmToast>();
            SetPrivateField(toast, "label", toastText);

            var commandsGo = new GameObject("RealmCommands");
            var commandUi = commandsGo.AddComponent<RealmCommandUi>();
            var confirmClip = AssetDatabase.LoadAssetAtPath<AudioClip>(ConfirmClipPath);
            var errorClip = AssetDatabase.LoadAssetAtPath<AudioClip>(ErrorClipPath);
            if (confirmClip != null) SetPrivateField(commandUi, "confirmClip", confirmClip);
            if (errorClip != null) SetPrivateField(commandUi, "errorClip", errorClip);
            commandUi.Build();
        }

        /// <summary>화면 오른쪽 위 — 디버그 빌드에서만 렌더러 이름·FPS·연월·
        /// 금·현재 도시(DebugHud.cs 클래스 주석 참고, GO와 같은 결). 왼쪽
        /// 위는 이미 `RealmHud`가 차지하고 있어(BuildHudAndCommands) 겹치지
        /// 않게 오른쪽 위로 뒀다 — REALM만 있는 배치.</summary>
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
            rect.anchorMin = new Vector2(1f, 1f);
            rect.anchorMax = new Vector2(1f, 1f);
            rect.pivot = new Vector2(1f, 1f);
            rect.anchoredPosition = new Vector2(-20f, -20f);
            rect.sizeDelta = new Vector2(500f, 120f);

            var text = textGo.AddComponent<TextMeshProUGUI>();
            text.fontSize = 22;
            text.alignment = TextAlignmentOptions.TopRight;
            text.color = new Color(1f, 1f, 1f, 0.8f);
            text.text = "";

            var overlay = canvasGo.AddComponent<DebugHud>();
            SetPrivateField(overlay, "label", text);
        }

        private static void BuildBootstrap()
        {
            var go = new GameObject("GameBootstrap");
            var bootstrap = go.AddComponent<GameBootstrap>();

            // 67장 "사운드" BGM(2026-09-15) — docs/ASSET_GUIDE.md 참고.
            var bgmClip = AssetDatabase.LoadAssetAtPath<AudioClip>("Assets/Art/Audio/CC0_BGM/realm_war_theme.ogg");
            if (bgmClip == null) Debug.LogWarning("[BuildTestCityScene] BGM 클립을 못 찾음 — 소리 없이 동작.");
            SetPrivateField(bootstrap, "bgmClip", bgmClip);
        }

        /// <summary>PLAN.md 101-2 "공통 선행" A·B — 목표판 3줄 + 세션 마무리
        /// 카드(REALM 다섯 번째·마지막 이식, GO·DUNGEON·FOREST·STORY의
        /// `BuildGoalBoardUi()`와 같은 배선). GoalBoard·SessionCard 는
        /// Awake()가 자기 UI를 다시 짓는 SagaCore 공용 컴포넌트라
        /// [SerializeField] 배선이 필요 없다 — RealmSessionTracker(이 판
        /// 전용, Saga.Realm.UI) 하나가 IGoalSource 를 구현하면서 SessionCard
        /// 표시도 같이 맡는다(트리거는 무입력 대신 월간, 클래스 주석 참고).</summary>
        private static void BuildGoalBoardUi()
        {
            var cardGo = new GameObject("SessionCard");
            var sessionCard = cardGo.AddComponent<SessionCard>();

            var trackerGo = new GameObject("RealmSessionTracker");
            var tracker = trackerGo.AddComponent<RealmSessionTracker>();
            tracker.Init(sessionCard);

            var boardGo = new GameObject("GoalBoard");
            var board = boardGo.AddComponent<GoalBoard>();
            board.Init(tracker);
        }

        private const string MariaControllerPath = "Assets/Animators/Maria.controller";
        // PLAN.md 109-13-2b — 지도·싸움터 인물이 입는 사실 몸(무장 = 갑옷·두건 사내, 재야 = 베옷·무도복·여인). 몸은 전부 Humanoid 라
        // 주인공 Maria.controller 로 리타깃(GO `PartyBodies` 와 같은 방식). 프리팹이 없는 PC 는 그 몸만 빠지고, 다 없으면 대역 도형.
        internal static readonly string[] OfficerBodyNames = { "Dreyar", "CastleGuard02", "Heraklios", "Paladin" };
        internal static readonly string[] WandererBodyNames = { "PeasantMan", "Brady", "PeasantGirl", "Kachujin", "Eve" };

        private static void BuildActorBodies()
        {
            var go = new GameObject("RealmBodies");
            var bodies = go.AddComponent<RealmBodies>();
            bodies.Init(LoadBodies(OfficerBodyNames), LoadBodies(WandererBodyNames),
                AssetDatabase.LoadAssetAtPath<RuntimeAnimatorController>(MariaControllerPath));
        }

        private static GameObject[] LoadBodies(string[] names)
        {
            var list = new System.Collections.Generic.List<GameObject>();
            foreach (var n in names)
            {
                var prefab = AssetDatabase.LoadAssetAtPath<GameObject>(SetupNpcCharacterImports.PrefabPath(n));
                if (prefab != null) list.Add(prefab);
                else Debug.LogWarning($"[BuildTestCityScene] {n} 몸 프리팹 없음(로컬 전용 — Saga/Setup NPC Character Imports) — 그 몸은 뺀다");
            }
            return list.ToArray();
        }

        private static void SetPrivateField(object target, string fieldName, object value)
        {
            var field = target.GetType().GetField(fieldName,
                System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Instance);
            if (field == null)
            {
                Debug.LogError($"[BuildTestCityScene] {target.GetType().Name}에 필드 '{fieldName}'이 없다.");
                return;
            }
            field.SetValue(target, value);
        }
    }
}
