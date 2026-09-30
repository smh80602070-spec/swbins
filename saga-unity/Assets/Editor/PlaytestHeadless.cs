using TMPro;
using System.Reflection;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.UI;
using Saga.Core;
using Saga.Go.Audio;
using Saga.Go.Data;
using Saga.Go.Player;
using Saga.Go.UI;
using Saga.Go.World;

namespace Saga.EditorTools
{
    /// <summary>
    /// PlayerController.Awake() 같은 런타임 코드가 실제로 예외 없이 도는지
    /// 배치 모드에서 몇 프레임 재생해 확인한다 — saga-godot의 "--headless
    /// --quit-after N --verbose"와 같은 목적. 씬을 열고 Play 모드로 들어가
    /// FramesToRun만큼 프레임을 돌린 뒤 스스로 멈추고 EditorApplication.Exit로
    /// 종료한다(콘솔 오류/예외가 있었으면 exit code 1).
    ///
    /// 주의 — 이 메서드를 -executeMethod로 부를 때는 -quit을 같이 주지
    /// 않는다. -quit이 있으면 Run()이 반환하자마자(Play 모드가 실제로
    /// 시작하기도 전에) Unity가 종료해 버린다 — 종료는 이 스크립트가
    /// EditorApplication.Exit()로 직접 한다.
    ///
    /// 2026-09-11 — 이 PC의 Unity 6000.3.23f1 `-batchmode -nographics`
    /// 조합은 Play 모드 진입 중 도메인 리로드(어셈블리 리로드) 단계에서
    /// 멈춘다(ExitingEditMode에서 EnteredPlayMode로 영영 안 넘어감 — 빈
    /// 씬으로도 재현, TestVillage 씬 내용물과 무관함을 확인). Enter Play
    /// Mode Options로 도메인·씬 리로드를 끄면 정상 진입한다(PingExit.cs로
    /// 격리 재현, 지금은 지움). **주의 — 이 값은 실제로
    /// ProjectSettings/EditorSettings.asset에 저장된다**(처음엔 "Exit()로
    /// 바로 끝나면 저장 안 된다"고 잘못 적었었다 — 그건 프로젝트 충돌로
    /// 아예 실행이 안 된 케이스를 보고 낸 오판이었다, 실제로 Play 모드
    /// 진입에 성공하면 그대로 저장돼 사람이 여는 평소 에디터의 Play 버튼
    /// 동작까지 바꿔 버린다). 그래서 Run() 시작에 원래 값을 저장해 뒀다가
    /// 끝나기 직전(Exit 직전)에 반드시 되돌린다 — 헤드리스 실행 동안만
    /// 켜져 있어야 한다.
    /// </summary>
    public static class PlaytestHeadless
    {
        private const string ScenePath = "Assets/Scenes/TestVillage.unity";
        private const int FramesToRun = 10;

        private static int _framesSeen;
        private static bool _hadError;
        private static bool _origEnterPlayModeOptionsEnabled;
        private static EnterPlayModeOptions _origEnterPlayModeOptions;

        [MenuItem("Saga/Playtest TestVillage (Headless)")]
        public static void Run()
        {
            _origEnterPlayModeOptionsEnabled = EditorSettings.enterPlayModeOptionsEnabled;
            _origEnterPlayModeOptions = EditorSettings.enterPlayModeOptions;
            EditorSettings.enterPlayModeOptionsEnabled = true;
            EditorSettings.enterPlayModeOptions =
                EnterPlayModeOptions.DisableDomainReload | EnterPlayModeOptions.DisableSceneReload;

            EditorSceneManager.OpenScene(ScenePath);
            _framesSeen = 0;
            _hadError = false;
            Application.logMessageReceived += OnLog;
            EditorApplication.playModeStateChanged += OnStateChanged;
            EditorApplication.isPlaying = true;
        }

        /// <summary>
        /// UnityEditor.Search.SearchInit.IndexationOnStartup()의
        /// ArgumentOutOfRangeException은 이 프로젝트에 SearchDatabase 인덱스
        /// 에셋이 하나도 없을 때 터지는 엔진 내부 버그다(2026-09-11 확인 —
        /// `-quit`만 준 순수 컴파일 배치에서도 똑같이 뜨고, 우리 코드와 전혀
        /// 무관하다). Play 모드 진입 시점과 우연히 겹쳐 찍히므로 걸러낸다 —
        /// 안 걸러내면 매번 FAIL로 오판된다(실제 PlayerController.Awake() 등은
        /// 예외 없이 돎).
        /// </summary>
        private static void OnLog(string condition, string stackTrace, LogType type)
        {
            if (type != LogType.Error && type != LogType.Exception) return;
            if (stackTrace.Contains("UnityEditor.Search.SearchInit.IndexationOnStartup")) return;

            _hadError = true;
            Debug.LogError($"[PlaytestHeadless] runtime error: {condition}\n{stackTrace}");
        }

        private static void OnStateChanged(PlayModeStateChange state)
        {
            if (state == PlayModeStateChange.EnteredPlayMode)
            {
                EditorApplication.update += CountFrames;
            }
            else if (state == PlayModeStateChange.EnteredEditMode)
            {
                Application.logMessageReceived -= OnLog;
                EditorApplication.playModeStateChanged -= OnStateChanged;
                EditorSettings.enterPlayModeOptionsEnabled = _origEnterPlayModeOptionsEnabled;
                EditorSettings.enterPlayModeOptions = _origEnterPlayModeOptions;
                Debug.Log(_hadError
                    ? "[PlaytestHeadless] FAIL - runtime error(s) logged"
                    : $"[PlaytestHeadless] OK - {FramesToRun} frames, no errors");
                EditorApplication.Exit(_hadError ? 1 : 0);
            }
        }

        private static void CountFrames()
        {
            _framesSeen++;
            // 67장 "사운드"(2026-09-14) — GoAudio.PlaySfx가 헤드리스(-nographics,
            // 오디오 장치 없을 수 있음)에서도 예외 없이 도는지 한 번 확인한다.
            // BanditEncounter.cs가 실제로 쓰는 것과 같은 클립.
            if (_framesSeen == 3)
            {
                // 109-14-7 — 옛 진단들은 적 체력·금 값을 잰다: 천하 0·여정 보상 없이(여정 진단만 켜 본다)
                Saga.Go.Data.AdventureState.OffForTest = true;
                Saga.Go.Data.AdventureState.Rescale();
                Saga.Go.Data.DailyTaskState.OffForTest = true; // 109-14-8 — 날짜마다 다른 일과 보상이 옛 진단 값에 끼지 않게(일과 진단만 켠다)
                Saga.Go.Combat.GoKits.OffForTest = true; // 109-14-11 — 옛 진단은 109-8 모양 그대로(스킬표 진단만 켠다)
                Saga.Go.Data.StoryState.OffForTest = true; // 109-14-12 — 이야기 인물 혼잣말·임무 적·대화 멈춤이 옛 진단에 끼지 않게(이야기 진단만 켠다)
                var clip = AssetDatabase.LoadAssetAtPath<AudioClip>("Assets/Art/Audio/Kenney_RPGSounds/chop.ogg");
                GoAudio.PlaySfx(clip);
                CheckDebugHud();
                CheckSettingsPanel();
                CheckButtonWiring();
                CheckPlayerHudLocalization();
                CheckActionButtonLocalization();
                CheckGoalBoardAndSessionCard();
                // PLAN.md 101-2 GO ①⑥⑧(2026-09-20) 전용 진단 — 컴파일+기존
                // 회귀만으로 검증했던 것을 이 세션에서 메운다.
                CheckBeaconTower();
                CheckDropOnLossAndRecovery(); // CheckBanditLootMarker보다 먼저 — 그건 cleared=true로 이 인카운터를 Destroy한다.
                CheckBanditHitstop();
                CheckGroundDecal();
                // CheckBanditLootMarker보다 먼저 — DUNGEON에서 겪은 것과 같은
                // 함정(PlaytestDungeonHeadless.cs 참고)을 피하려고 이 체크를
                // 세션의 첫 레벨업으로 만든다. CheckBanditLootMarker의
                // FinishFight()가 PlayerStats.AddExp()를 불러 레벨업을 유발할
                // 수 있어, 그 뒤에 이 체크가 돌면 배치 모드 프레임 시간
                // 편차로 두 레벨업 컷이 겹쳐 간헐적으로 실패할 수 있다.
                CheckLevelUpCut();
                CheckPerkChoice();
                CheckBanditLootMarker();
                CheckBondProgress(); // CheckBanditLootMarker 뒤 — "산적"이 실제로 등용된 뒤라야 BondState에 등록돼 있다.
                CheckWeaponVisual();
                CheckPropsMaterials();
                CheckRaidBoss();
                CheckShrineTrial();
                // PLAN.md 107-1 들판 전투 — 일일 과제(세이브 되돌림) 앞, 다른 진단 뒤(처치 경험치가 첫 레벨업이 되지 않게).
                if (!PlaytestGoGuardian.Run("PlaytestHeadless")) _hadError = true; // PLAN.md 107-7 수호장 + 106-9 등장 컷(여기서 한 번 틀어 둔다)
                Saga.Go.Combat.FieldCombat.CritOffForTest = true; // 109-14-5a — 피해값을 딱 맞춰 보는 진단들은 치명타 없이(무기 진단만 켜 본다)
                if (!PlaytestGoFieldCombat.Run("PlaytestHeadless")) _hadError = true;
                if (!PlaytestGoElementalFoe.Run("PlaytestHeadless")) _hadError = true; // PLAN.md 107-5 원소 쓰는 적
                if (!PlaytestGoTraversal.Run("PlaytestHeadless")) _hadError = true; // PLAN.md 107 ② 이동
                if (!PlaytestGoWorldMap.Run("PlaytestHeadless")) _hadError = true; // PLAN.md 107-3 지역 지도(세이브 되돌림 포함)
                if (!PlaytestGoRegionTraits.Run("PlaytestHeadless")) _hadError = true; // PLAN.md 108 고정 특색 지역(읽기만)
                if (!PlaytestGoSlopesBiome.Run("PlaytestHeadless")) _hadError = true; // PLAN.md 107-3 경사·고개·바이옴
                if (!PlaytestGoVegetation.Run("PlaytestHeadless")) _hadError = true; // PLAN.md 107-3 식생 바이옴(읽기만)
                if (!PlaytestGoRegionProps.Run("PlaytestHeadless")) _hadError = true; // PLAN.md 108 ① 지역 전용 소품(읽기만)
                if (!PlaytestGoEras.Run("PlaytestHeadless")) _hadError = true; // PLAN.md 109-1 세 시대 사람·적(읽기만)
                if (!PlaytestNpcModels.Go()) _hadError = true; // PLAN.md 106-4 GO 몫 — 마을 사람 사실 모델(읽기만)
                if (!PlaytestMobileGraphics.Run()) _hadError = true; // 2026-09-24 폰 발열 점검(읽기만)
                if (!PlaytestGoTreasure.Run("PlaytestHeadless")) _hadError = true; // PLAN.md 107-4 보물 상자(세이브·상자 기록 되돌림 포함)
                if (!PlaytestGoRegionMission.Run("PlaytestHeadless")) _hadError = true; // PLAN.md 107-8 지역 사명 사슬(사명·지도·수호장·상자 기록·세이브 되돌림)
                if (!PlaytestGoPartyBodies.Run("PlaytestHeadless")) _hadError = true; // PLAN.md 107-6 동료 모델
                if (!PlaytestGoHeroes.Run("PlaytestHeadless")) _hadError = true; // PLAN.md 109-6 도감 105·싸워서 등용(동행·인연·경험치 되돌림)
                if (!PlaytestGoHeroDex.Run("PlaytestHeadless")) _hadError = true; // PLAN.md 109-6b 도감 화면(동행·만남·세이브 되돌림)
                if (!PlaytestGoHeroLooks.Run("PlaytestHeadless")) _hadError = true; // PLAN.md 109-7 인물 105 몸 배정(표·105 벌 입혀 보기·교체·들판)
                if (!PlaytestGoSkillShapes.Run("PlaytestHeadless")) _hadError = true; // PLAN.md 109-8 스킬 모양 넷·교체 연출(동행·적·자리 되돌림)
                if (!PlaytestGoOrbs.Run("PlaytestHeadless")) _hadError = true; // PLAN.md 109-14-3a 수집 구슬·봉헌(구슬·봉수대·돈·세이브 되돌림)
                if (!PlaytestGoSight.Run("PlaytestHeadless")) _hadError = true; // PLAN.md 109-14-3b 원소 시야
                if (!PlaytestGoTalent.Run("PlaytestHeadless")) _hadError = true;
                if (!PlaytestGoWeapons.Run("PlaytestHeadless")) _hadError = true; // PLAN.md 109-14-5a 무기·치명타(무기·강화석·돈·세이브 되돌림) // PLAN.md 109-14-4 무예 단계·깨달음(동행·재료·돈·세이브 되돌림)
                if (!PlaytestGoArtifacts.Run("PlaytestHeadless")) _hadError = true; // PLAN.md 109-14-5b 보패(보패·연마석·동행·돈·세이브 되돌림)
                if (!PlaytestGoCooking.Run("PlaytestHeadless")) _hadError = true; // PLAN.md 109-14-6 채집·요리(요리·동행·세이브·자리 되돌림)
                if (!PlaytestGoAdventure.Run("PlaytestHeadless")) _hadError = true; // PLAN.md 109-14-7 여정·천하 등급(레벨·돈·세이브 되돌림)
                if (!PlaytestGoDaily.Run("PlaytestHeadless")) _hadError = true; // PLAN.md 109-14-8 일일 의뢰(일과·돈·세이브 되돌림)
                if (!PlaytestGoDomain.Run("PlaytestHeadless")) _hadError = true; // PLAN.md 109-14-9 숨은 터·원기·주간 보스(원기·돈·보패·재료·세이브 되돌림)
                if (!PlaytestGoFieldBoss.Run("PlaytestHeadless")) _hadError = true; // PLAN.md 109-14-10 들판 보스 보상 꽃(수호장·원기·돈·세이브 되돌림)
                if (!PlaytestGoKits.Run("PlaytestHeadless")) _hadError = true; // PLAN.md 109-14-11 고유·갈래 스킬(동행·들판·스위치 되돌림)
                if (!PlaytestGoStory.Run("PlaytestHeadless")) _hadError = true; // PLAN.md 109-14-12 이야기 임무 1~2장(진행·수호장·원기·돈·재료·세이브·자리 되돌림)
                if (!PlaytestGoAim.Run("PlaytestHeadless")) _hadError = true; // PLAN.md 109-14-22 활 조준·과녁 잠금(동행·상자·이야기 되돌림)
                if (!PlaytestGoWorldQuests.Run("PlaytestHeadless")) _hadError = true; // PLAN.md 109-14-21 세계 임무 셋·따라가는 줄(이야기·임무·줄·돈·재료 되돌림)
                if (!PlaytestGoMapMarks.Run("PlaytestHeadless")) _hadError = true; // PLAN.md 109-14-23 map marks
                if (!PlaytestGoFishing.Run("PlaytestHeadless")) _hadError = true; // PLAN.md 109-14-24 낚시(낚시터·흐름·조합·세이브·화면 — 가방·무기·돈·시각·세이브 되돌림)
                if (!PlaytestGoAchieve.Run("PlaytestHeadless")) _hadError = true; // PLAN.md 109-14-25 업적(표·보상·신호·받기·알림·세이브·화면 — 업적·돈·재료·구슬·이야기·레벨·세이브 되돌림)
                if (!PlaytestGoDispatch.Run("PlaytestHeadless")) _hadError = true; // PLAN.md 109-14-26 탐사 파견(표·흐름·알림·세이브·화면 — 동행·탐사·돈·재료·레벨·지도·세이브 되돌림)
                if (!PlaytestGoFrost.Run("PlaytestHeadless")) _hadError = true; // PLAN.md 109-14-27a 서리봉 고원(표·지역·땅·발견·드나드는 길·세이브 — 발견·돈·연마석·경험·자리·세이브 되돌림)
                if (!PlaytestGoBeasts.Run("PlaytestHeadless")) _hadError = true; // PLAN.md 109-14-1b 새 원소 괴물 넷(표·제 괴물로 옮김·몸·인물 졸개·고원 무리)
                if (!PlaytestGoNight.Run("PlaytestHeadless")) _hadError = true; // PLAN.md 109-14-56b 결말 뒤 밤의 잔불
                if (!PlaytestGoMount.Run("PlaytestHeadless")) _hadError = true; // PLAN.md 109-15 탈것·비행
                if (!PlaytestGoKnots.Run("PlaytestHeadless")) _hadError = true; // PLAN.md 109-14-52 8부 무대 여섯 매듭·먹구름 눈
                if (!PlaytestGoAreas.Run("PlaytestHeadless")) _hadError = true; // PLAN.md 109-14-37 지도 밖 독립 땅 은하 나루(표·지역·땅·돌기둥·발견·세이브)
                if (!PlaytestGoStoryAllies.Run("PlaytestHeadless")) _hadError = true; // PLAN.md 109-14-15 이야기 동료·고유 스킬 둘·편성(동행·진행·돈·들판 되돌림)
                if (!PlaytestGoPresets.Run("PlaytestHeadless")) _hadError = true; // PLAN.md 109-14-18 편성 1~4·싸우는 중 막기(동행·편성·들판·적 되돌림)
                if (!PlaytestGoPeaks.Run("PlaytestHeadless")) _hadError = true; // PLAN.md 109-9 정상 발견·순간이동·건물 가림 카메라(기록·돈·세이브 되돌림)
                // 반드시 마지막 — DailyTaskState 진단이 SaveState.TryLoad()로
                // 세이브 파일을 v9 모양으로 잠깐 바꿔치기해 로드하는데, 이건
                // 살아있는 PartyState/Inventory/GoldState 등을 그 v9 기본값으로
                // 되돌린다(finally에서 파일 자체는 원복하지만 이미 메모리에
                // 반영된 상태까지는 안 되돌아온다) — 그 뒤에 다른 체크가 이어지면
                // 그 체크들이 지워진 상태를 보게 된다.
                CheckDailyTasks();
            }
            if (_framesSeen >= FramesToRun)
            {
                EditorApplication.update -= CountFrames;
                EditorApplication.isPlaying = false;
            }
        }

        /// <summary>PLAN.md 44~49장 디버그 화면 확장(2026-09-14, DebugHud.cs
        /// 클래스 주석 참고) — 레벨/사명/좌표 세 줄이 실제로 채워지는지
        /// 본다. 0.5초(unscaled) 타이머를 기다리는 대신(배치 모드는 프레임이
        /// 실시간보다 훨씬 빨리 돌아 몇 프레임 안엔 절대 안 찬다 — 다른
        /// Playtest들이 이미 겪은 함정과 같은 종류) private Refresh()를
        /// 리플렉션으로 직접 불러 판정 경로만 본다.</summary>
        private static void CheckDebugHud()
        {
            var hudGo = GameObject.Find("DebugUI");
            var hud = hudGo != null ? hudGo.GetComponent<DebugHud>() : null;
            var labelGo = hudGo != null ? hudGo.transform.Find("Label") : null;
            var label = labelGo != null ? labelGo.GetComponent<TextMeshProUGUI>() : null;
            if (hud == null || label == null)
            {
                Debug.LogError("[PlaytestHeadless] DebugUI/Label을 못 찾음");
                _hadError = true;
                return;
            }

            var method = typeof(DebugHud).GetMethod("Refresh", BindingFlags.NonPublic | BindingFlags.Instance);
            method.Invoke(hud, null);

            if (!label.text.Contains("lv ") || !label.text.Contains("quest:") || !label.text.Contains("pos:"))
            {
                Debug.LogError($"[PlaytestHeadless] 디버그 오버레이에 레벨/사명/좌표가 안 보임 text=\"{label.text}\"");
                _hadError = true;
            }
            else
            {
                Debug.Log($"[PlaytestHeadless] debug hud OK - \"{label.text.Replace("\n", " | ")}\"");
            }
        }

        /// <summary>PLAN.md 104-1 ②(2026-09-16) — 이전엔 GameObject.Find로
        /// 패널 "존재"만 보고 GoSettingsState 등 정적 API만 불러 검증했다.
        /// 그건 RealmCommandUi가 실제로는 [SerializeField] 누락으로 버튼을
        /// 누르면 죽는데도 안 잡히던 것과 같은 구멍이다(2026-09-15 발견,
        /// `PlaytestRealmSlice.CheckCommandUiPanelsWork()` 참고) — 정적
        /// 상태만 바뀌어도 통과해 버려서 화면 라벨이 실제로 갱신되는지는
        /// 한 번도 안 봤다. GoSettingsPanel._panel/_sfxValueLabel도 같은
        /// 패턴(Build()를 에디터가 한 번만 부름)이라 이번 세션에
        /// [SerializeField]로 승격했고, 여기서 TogglePanel()·ChooseSfx()를
        /// 리플렉션으로 직접 불러 패널이 실제로 열리고 라벨이 실제로
        /// 바뀌는지까지 본다.</summary>
        private static void CheckSettingsPanel()
        {
            var panel = Object.FindFirstObjectByType<GoSettingsPanel>();
            if (panel == null)
            {
                Debug.LogError("[PlaytestHeadless] GoSettingsPanel 컴포넌트를 못 찾음");
                _hadError = true;
                return;
            }

            var panelGoField = typeof(GoSettingsPanel).GetField("_panel", BindingFlags.NonPublic | BindingFlags.Instance);
            var panelGo = panelGoField.GetValue(panel) as GameObject;
            if (panelGo == null)
            {
                Debug.LogError("[PlaytestHeadless] GoSettingsPanel._panel이 null — 씬 재로드 후 참조가 안 살아남음");
                _hadError = true;
                return;
            }

            var toggleMethod = typeof(GoSettingsPanel).GetMethod("TogglePanel", BindingFlags.NonPublic | BindingFlags.Instance);
            toggleMethod.Invoke(panel, null); // 열기 — 여기서 NRE가 나면 그대로 테스트 실패로 드러난다.
            if (!panelGo.activeSelf)
            {
                Debug.LogError("[PlaytestHeadless] TogglePanel() 호출 후에도 설정 패널이 안 열림");
                _hadError = true;
                return;
            }
            toggleMethod.Invoke(panel, null); // 닫기 — 다른 검사에 영향 안 주게.
            if (panelGo.activeSelf)
            {
                Debug.LogError("[PlaytestHeadless] TogglePanel() 두 번째 호출 후에도 설정 패널이 안 닫힘");
                _hadError = true;
                return;
            }

            var sfxValueLabelField = typeof(GoSettingsPanel).GetField("_sfxValueLabel", BindingFlags.NonPublic | BindingFlags.Instance);
            var sfxValueLabel = sfxValueLabelField.GetValue(panel) as TextMeshProUGUI;
            if (sfxValueLabel == null)
            {
                Debug.LogError("[PlaytestHeadless] GoSettingsPanel._sfxValueLabel이 null");
                _hadError = true;
                return;
            }

            bool sfxBefore = GoSettingsState.SfxOn;
            var chooseSfxMethod = typeof(GoSettingsPanel).GetMethod("ChooseSfx", BindingFlags.NonPublic | BindingFlags.Instance);
            chooseSfxMethod.Invoke(panel, null); // 실제 버튼 핸들러 — 상태를 뒤집고 Refresh()까지 그대로 탄다.
            string expectedText = GoLocalization.T(GoSettingsState.SfxOn ? "state.on" : "state.off");
            if (GoSettingsState.SfxOn == sfxBefore || sfxValueLabel.text != expectedText)
            {
                Debug.LogError($"[PlaytestHeadless] ChooseSfx() 이후 라벨이 실제로 안 바뀜 text=\"{sfxValueLabel.text}\"(기대=\"{expectedText}\")");
                _hadError = true;
                return;
            }
            chooseSfxMethod.Invoke(panel, null); // 원상복귀

            bool vibBefore = GoSettingsState.VibrationOn;
            GoSettingsState.VibrationOn = !vibBefore;
            if (GoSettingsState.VibrationOn == vibBefore)
            {
                Debug.LogError("[PlaytestHeadless] 진동 토글이 안 바뀜");
                _hadError = true;
                return;
            }

            GoSettingsState.UiScaleMultiplier = 1.15f;
            var scaler = Saga.Core.SagaUi.FirstGameScaler(); // Ⅱ 단추 등 메뉴 캔버스는 뺀다(110 ⑤c)
            float expected = Saga.Core.SagaUi.GameReference.x / 1.15f; // 110 ⑤b 기준 1600×900
            if (scaler == null || Mathf.Abs(scaler.referenceResolution.x - expected) > 1f)
            {
                Debug.LogError($"[PlaytestHeadless] UI 크기가 캔버스에 안 먹음 — got={(scaler == null ? "null" : scaler.referenceResolution.x.ToString())}");
                _hadError = true;
                return;
            }
            GoSettingsState.UiScaleMultiplier = 1f; // 다른 검사에 영향 없게 기본값으로 되돌린다.

            GoSettingsState.HighGraphicsQuality = false;
            if (!Mathf.Approximately(QualitySettings.shadowDistance, 15f) || QualitySettings.antiAliasing != 0)
            {
                Debug.LogError($"[PlaytestHeadless] 그래픽 품질(절약)이 QualitySettings에 안 먹음 — shadowDistance={QualitySettings.shadowDistance} aa={QualitySettings.antiAliasing}");
                _hadError = true;
                return;
            }
            GoSettingsState.HighGraphicsQuality = true; // 원래(기본) 값으로 되돌린다.

            // 2026-09-14 "Localization" — 언어를 실제로 바꾸면 라벨 문구도
            // 실제로 바뀌는지 본다(API만 값을 바꾸고 표는 그대로인 오탐을 막음).
            string langBefore = GoLocalization.CurrentLanguage;
            string qualityLabelBefore = GoSettingsState.GraphicsQualityLabel();
            GoLocalization.CycleLanguage();
            if (GoLocalization.CurrentLanguage == langBefore
                || GoSettingsState.GraphicsQualityLabel() == qualityLabelBefore)
            {
                Debug.LogError("[PlaytestHeadless] 언어 전환이 실제 문구를 안 바꿈");
                _hadError = true;
                return;
            }
            GoLocalization.CurrentLanguage = langBefore; // 다른 검사에 영향 없게 되돌린다.

            Debug.Log("[PlaytestHeadless] settings panel OK - sfx/vibration/ui-scale/graphics-quality/language all verified");
        }

        /// <summary>PLAN.md 67~69장 "Localization" 2차(2026-09-14) — PlayerHud의
        /// 경험치/돈 표시가 실제로 영어 문구를 보여주는지 본다(단순 T() 호출
        /// 성공이 아니라 string.Format 인자 순서가 실제로 맞는지까지).</summary>
        private static void CheckPlayerHudLocalization()
        {
            var hudGo = GameObject.Find("PlayerHudUI");
            var hud = hudGo != null ? hudGo.GetComponent<PlayerHud>() : null;
            var label = hudGo != null ? hudGo.GetComponentInChildren<TextMeshProUGUI>() : null;
            if (hud == null || label == null)
            {
                Debug.LogError("[PlaytestHeadless] PlayerHudUI/Label을 못 찾음");
                _hadError = true;
                return;
            }

            string langBefore = GoLocalization.CurrentLanguage;
            var method = typeof(PlayerHud).GetMethod("Refresh", BindingFlags.NonPublic | BindingFlags.Instance);

            GoLocalization.CurrentLanguage = "en";
            method.Invoke(hud, null);
            if (!label.text.Contains("EXP") || !label.text.Contains("Gold"))
            {
                Debug.LogError($"[PlaytestHeadless] PlayerHud 영어 전환이 안 먹음 text=\"{label.text}\"");
                _hadError = true;
                GoLocalization.CurrentLanguage = langBefore;
                return;
            }
            GoLocalization.CurrentLanguage = langBefore;
            method.Invoke(hud, null); // 다른 검사에 영향 없게 원래 언어로 다시 그린다.

            Debug.Log("[PlaytestHeadless] player hud localization OK");
        }

        /// <summary>2026-09-15 "저장 버튼 언어 전환 반응" — DUNGEON/STORY에
        /// 이어 GO도 같은 문제(씬 빌드 시점 언어로 굳음)가 있었다.
        /// `LocalizedButtonLabel`(폴링, Update()는 private이라 리플렉션).</summary>
        private static void CheckActionButtonLocalization()
        {
            var go = GameObject.Find("SaveButton");
            var localized = go != null ? go.GetComponent<LocalizedButtonLabel>() : null;
            var label = go != null ? go.GetComponentInChildren<TextMeshProUGUI>() : null;
            if (localized == null || label == null)
            {
                Debug.LogError("[PlaytestHeadless] SaveButton/LocalizedButtonLabel을 못 찾음");
                _hadError = true;
                return;
            }

            string langBefore = GoLocalization.CurrentLanguage;
            var method = typeof(LocalizedButtonLabel).GetMethod("Update", BindingFlags.NonPublic | BindingFlags.Instance);

            GoLocalization.CurrentLanguage = "en";
            method.Invoke(localized, null);
            if (label.text != "Save")
            {
                Debug.LogError($"[PlaytestHeadless] 저장 버튼 영어 전환이 안 먹음 text=\"{label.text}\"(기대=Save)");
                _hadError = true;
                GoLocalization.CurrentLanguage = langBefore;
                return;
            }
            GoLocalization.CurrentLanguage = langBefore;
            method.Invoke(localized, null);
            if (label.text != (langBefore == "en" ? "Save" : "저장"))
            {
                Debug.LogError($"[PlaytestHeadless] 저장 버튼이 원래 언어로 안 돌아옴 text=\"{label.text}\"(기대=저장)");
                _hadError = true;
            }

            Debug.Log("[PlaytestHeadless] action button localization OK");
        }

        /// <summary>PLAN.md 101-2 "공통 선행" A·B(2026-09-16, GO 첫 이식) —
        /// GoalBoard 세 줄이 실제로 채워지는지, Awake()의 IGoalSource
        /// 자동 재탐색이 실제로 동작하는지(104-1 ③에서 고친 것과 같은
        /// 함정을 새 코드에서 되풀이하지 않았는지), SessionCard 가 뜨고
        /// 스스로 닫히는지를 직접 확인한다 — 존재 확인만으로 끝내지 않는다
        /// (104-1 ②와 같은 기준).</summary>
        private static void CheckGoalBoardAndSessionCard()
        {
            var board = Object.FindFirstObjectByType<GoalBoard>();
            if (board == null)
            {
                Debug.LogError("[PlaytestHeadless] GoalBoard 컴포넌트를 못 찾음");
                _hadError = true;
                return;
            }

            var sourceField = typeof(GoalBoard).GetField("_source", BindingFlags.NonPublic | BindingFlags.Instance);
            if (sourceField.GetValue(board) == null)
            {
                Debug.LogError("[PlaytestHeadless] GoalBoard._source가 null — Awake() 자동 재탐색 실패");
                _hadError = true;
                return;
            }

            var labelField = typeof(GoalBoard).GetField("_label", BindingFlags.NonPublic | BindingFlags.Instance);
            var label = labelField.GetValue(board) as TextMeshProUGUI;
            if (label == null || !label.text.Contains(Saga.Core.SagaUi.L("지금", "Now") + " —") || !label.text.Contains(Saga.Core.SagaUi.L("이번 세션", "This session") + " —") || !label.text.Contains(Saga.Core.SagaUi.L("이번 주", "This week") + " —"))
            {
                Debug.LogError($"[PlaytestHeadless] GoalBoard 세 줄이 안 채워짐 text=\"{(label == null ? "null" : label.text.Replace("\n", " | "))}\"");
                _hadError = true;
                return;
            }

            var card = Object.FindFirstObjectByType<SessionCard>();
            if (card == null)
            {
                Debug.LogError("[PlaytestHeadless] SessionCard 컴포넌트를 못 찾음");
                _hadError = true;
                return;
            }
            if (card.IsShowing)
            {
                Debug.LogError("[PlaytestHeadless] SessionCard가 세션 시작부터 떠 있음(기본은 숨김)");
                _hadError = true;
                return;
            }

            card.Show("테스트", "줄1", "줄2");
            if (!card.IsShowing)
            {
                Debug.LogError("[PlaytestHeadless] SessionCard.Show() 호출 후에도 안 뜸");
                _hadError = true;
                return;
            }

            // 5초를 실제로 안 기다리고 _closeTimer를 만료 직전으로 돌린 뒤
            // Update()를 한 번 더 불러 자동 닫힘 경로를 확인한다.
            var closeTimerField = typeof(SessionCard).GetField("_closeTimer", BindingFlags.NonPublic | BindingFlags.Instance);
            closeTimerField.SetValue(card, 0.0001f);
            var updateMethod = typeof(SessionCard).GetMethod("Update", BindingFlags.NonPublic | BindingFlags.Instance);
            updateMethod.Invoke(card, null);
            if (card.IsShowing)
            {
                Debug.LogError("[PlaytestHeadless] SessionCard가 만료 후에도 자동으로 안 닫힘");
                _hadError = true;
                return;
            }

            if (Object.FindFirstObjectByType<GoSessionTracker>() == null)
            {
                Debug.LogError("[PlaytestHeadless] GoSessionTracker 컴포넌트를 못 찾음");
                _hadError = true;
                return;
            }

            Debug.Log("[PlaytestHeadless] goal board / session card OK - 3 lines filled, source auto-found, card shows and auto-closes");
        }

        /// <summary>PLAN.md 101-2 GO ① "봉수대"(2026-09-20) — 존재 확인에서
        /// 끝내지 않는다(104-1 ② 기준): 점등 전엔 목표판이 봉수대 자신을
        /// 가리키는지, 점등하면 WorldEventState가 실제로 켜지고 보상이
        /// 지급되는지, 그 뒤로 목표판이 다른 발견형 랜드마크로 넘어가는지,
        /// 두 번째 점등이 조용히 무시되는지(중복 보상 방지)까지 본다.</summary>
        private static void CheckBeaconTower()
        {
            var beacon = Object.FindFirstObjectByType<BeaconTower>();
            var tracker = Object.FindFirstObjectByType<GoSessionTracker>();
            if (beacon == null || tracker == null)
            {
                Debug.LogError($"[PlaytestHeadless] 봉수대 검증용 컴포넌트를 못 찾음(beacon={beacon != null}, tracker={tracker != null})");
                _hadError = true;
                return;
            }
            if (WorldEventState.IsTriggered(BeaconTower.EventId))
            {
                Debug.LogError("[PlaytestHeadless] 봉수대 — 검증 시작 전인데 이미 불이 켜져 있음");
                _hadError = true;
                return;
            }

            string beaconLabel = GoLocalization.T("goal.beacon", "봉수대");
            string goalBefore = tracker.GoalLineNow();
            if (!goalBefore.Contains(beaconLabel))
            {
                Debug.LogError($"[PlaytestHeadless] 봉수대 — 점등 전 목표판이 봉수대를 안 가리킴 text=\"{goalBefore}\"");
                _hadError = true;
                return;
            }

            var playerCollider = GameObject.FindWithTag("Player")?.GetComponent<Collider>();
            var onTriggerEnter = typeof(BeaconTower).GetMethod("OnTriggerEnter", BindingFlags.NonPublic | BindingFlags.Instance);

            int expBefore = PlayerStats.Exp;
            int goldBefore = GoldState.Gold;
            onTriggerEnter.Invoke(beacon, new object[] { playerCollider });

            if (!WorldEventState.IsTriggered(BeaconTower.EventId) || GoldState.Gold == goldBefore || PlayerStats.Exp == expBefore)
            {
                Debug.LogError($"[PlaytestHeadless] 봉수대 — 점등 보상이 안 지급됨(lit={WorldEventState.IsTriggered(BeaconTower.EventId)}, gold {goldBefore}->{GoldState.Gold}, exp {expBefore}->{PlayerStats.Exp})");
                _hadError = true;
                return;
            }

            string goalAfter = tracker.GoalLineNow();
            if (goalAfter.Contains(beaconLabel))
            {
                Debug.LogError($"[PlaytestHeadless] 봉수대 — 점등 후에도 목표판이 여전히 봉수대를 가리킴 text=\"{goalAfter}\"");
                _hadError = true;
                return;
            }

            int goldAfterFirst = GoldState.Gold;
            onTriggerEnter.Invoke(beacon, new object[] { playerCollider }); // 중복 점등 방지 확인.
            if (GoldState.Gold != goldAfterFirst)
            {
                Debug.LogError($"[PlaytestHeadless] 봉수대 — 두 번째 점등에서도 보상이 또 지급됨(gold {goldAfterFirst}->{GoldState.Gold})");
                _hadError = true;
                return;
            }

            Debug.Log($"[PlaytestHeadless] beacon tower OK - 점등 보상 지급, 목표판 전환(\"{goalBefore}\"→\"{goalAfter}\"), 중복 점등 방지 확인");
        }

        /// <summary>PLAN.md 101-2 GO ⑧ "패배 비용과 회수"(2026-09-20) —
        /// BanditEncounter의 진짜 패배 경로(dealt&gt;0, cleared=false)를
        /// 직접 태워 소지금 15%가 그 자리에 남는지, DropMarker가 실제로
        /// 하나 생기는지, 창 안 회수가 금을 돌려주는지, 만료된 뒤에는
        /// 회수가 실패하고 목록에서도 지워지는지 전부 본다. 반드시
        /// CheckBanditLootMarker()보다 먼저 돈다 — 그건 cleared=true로
        /// 끝내며 이 BanditEncounter를 Destroy한다.</summary>
        private static void CheckDropOnLossAndRecovery()
        {
            var encounter = Object.FindFirstObjectByType<BanditEncounter>();
            if (encounter == null)
            {
                Debug.LogError("[PlaytestHeadless] 패배 비용·회수 검증용 BanditEncounter를 못 찾음");
                _hadError = true;
                return;
            }

            var beType = typeof(BanditEncounter);
            var startFight = beType.GetMethod("StartFight", BindingFlags.NonPublic | BindingFlags.Instance);
            var duelField = beType.GetField("_duel", BindingFlags.NonPublic | BindingFlags.Instance);
            var finishFight = beType.GetMethod("FinishFight", BindingFlags.NonPublic | BindingFlags.Instance);

            // ---- 사이클 1: 밀린 패배(dealt>0) → 15% 드롭·마커 생성 → 창 안 회수 ----
            startFight.Invoke(encounter, null);
            var duel = (DuelRules)duelField.GetValue(encounter);
            duel.Dealt = 1f; // "한 대도 못 때리고 물러난 것은 패배로 안 친다" 경계 밖(진짜 패배).
            duel.Cleared = false;

            int goldBefore = GoldState.Gold;
            int expectedDrop = Mathf.Min(DropState.GoldCap, Mathf.RoundToInt(goldBefore * DropState.GoldFraction));
            finishFight.Invoke(encounter, null);

            if (expectedDrop <= 0)
            {
                Debug.LogError($"[PlaytestHeadless] 패배 비용 — 소지금이 너무 적어(gold={goldBefore}) 드롭 검증을 못 함");
                _hadError = true;
                return;
            }
            if (GoldState.Gold != goldBefore - expectedDrop)
            {
                Debug.LogError($"[PlaytestHeadless] 패배 비용 — 소지금 15%가 안 깎임(gold {goldBefore}->{GoldState.Gold}, 기대 -{expectedDrop})");
                _hadError = true;
                return;
            }
            if (DropState.ActiveDrops.Count != 1 || DropState.ActiveDrops[0].Gold != expectedDrop)
            {
                Debug.LogError($"[PlaytestHeadless] 패배 비용 — DropState 항목이 기대와 다름(count={DropState.ActiveDrops.Count})");
                _hadError = true;
                return;
            }
            var drop = DropState.ActiveDrops[0];
            if (Object.FindObjectsByType<DropMarker>(FindObjectsSortMode.None).Length != 1)
            {
                Debug.LogError("[PlaytestHeadless] 패배 비용 — DropMarker가 정확히 1개 생성되지 않음");
                _hadError = true;
                return;
            }

            int goldBeforeRecover = GoldState.Gold;
            if (!DropState.TryRecover(drop.Id, out int recoveredGold) || recoveredGold != expectedDrop)
            {
                Debug.LogError($"[PlaytestHeadless] 패배 비용 — 창 안 회수가 실패함(recovered={recoveredGold}, 기대={expectedDrop})");
                _hadError = true;
                return;
            }
            GoldState.Add(recoveredGold); // DropMarker.Update()가 실제로 하는 것과 같은 순서.
            if (GoldState.Gold != goldBeforeRecover + expectedDrop || DropState.ActiveDrops.Count != 0)
            {
                Debug.LogError($"[PlaytestHeadless] 패배 비용 — 회수 후 상태가 기대와 다름(gold {goldBeforeRecover}->{GoldState.Gold}, 남은 드롭={DropState.ActiveDrops.Count})");
                _hadError = true;
                return;
            }

            // ---- 사이클 2: 만료 뒤엔 회수도 실패하고 목록에서도 지워진다 ----
            startFight.Invoke(encounter, null);
            duel = (DuelRules)duelField.GetValue(encounter);
            duel.Dealt = 1f;
            duel.Cleared = false;
            finishFight.Invoke(encounter, null);

            if (DropState.ActiveDrops.Count != 1)
            {
                Debug.LogError($"[PlaytestHeadless] 패배 비용 — 두 번째 패배에서 짐이 안 생김(count={DropState.ActiveDrops.Count})");
                _hadError = true;
                return;
            }
            string secondId = DropState.ActiveDrops[0].Id;
            DropState.Expire(secondId); // DropMarker.Update()가 창을 넘겼을 때 스스로 부르는 것과 같은 경로.
            if (DropState.TryRecover(secondId, out _) || DropState.ActiveDrops.Count != 0)
            {
                Debug.LogError("[PlaytestHeadless] 패배 비용 — 만료된 짐이 여전히 회수되거나 목록에 남음");
                _hadError = true;
                return;
            }

            Debug.Log("[PlaytestHeadless] drop recovery OK - 패배 시 15% 드롭·마커 생성·창 안 회수·만료 뒤 재회수 방지 확인");
        }

        /// <summary>PLAN.md 101-2 GO ⑥ "인연"(2026-09-20) — CheckBanditLootMarker()가
        /// 방금 실제로 등용시킨 "산적"으로 PartyState.Recruit→BondState.
        /// EnsureMember 배선 자체를 확인하고, 거리 누적→등급 상승→
        /// LeveledUp 이벤트→AtkMultiplier 반영을 본다. 승수(토벌 승리) 경로는
        /// ReportWin()이 등록된 전원에게 똑같이 매겨지는 특성상 "산적"은
        /// 이미 거리로 1등급이 돼 있어 문턱 통과가 안 보이므로, 거리를 하나도
        /// 안 쌓은 새 합성 id를 하나 더 등록해 따로 확인한다(세이브 대상
        /// 아님, 이 프로세스 안에서만 존재). 반드시 CheckBanditLootMarker()
        /// 뒤에 돈다.</summary>
        private static void CheckBondProgress()
        {
            const string heroId = "산적";
            const string winTestId = "__test_bond_win__";
            const string winTestId2 = "__test_bond_win2__";

            if (BondState.LevelFor(heroId) != 0)
            {
                Debug.LogError($"[PlaytestHeadless] 인연 — 검증 시작 전인데 \"{heroId}\"가 이미 등급 0이 아님(level={BondState.LevelFor(heroId)})");
                _hadError = true;
                return;
            }

            BondState.EnsureMember(winTestId);

            int leveledUpCount = 0;
            int lastLeveledLevel = -1;
            void OnLeveledUp(string id, int level) { leveledUpCount++; lastLeveledLevel = level; }
            BondState.LeveledUp += OnLeveledUp;
            try
            {
                float atkMulBefore = BondState.AtkMultiplier;
                BondState.ReportWalked(2100f); // 2.1km — heroId·winTestId 둘 다 1등급 문턱(2km)을 넘긴다.

                if (BondState.LevelFor(heroId) != 1 || BondState.LevelFor(winTestId) != 1)
                {
                    Debug.LogError($"[PlaytestHeadless] 인연 — 2.1km 걸었는데 1등급이 아님({heroId}={BondState.LevelFor(heroId)}, {winTestId}={BondState.LevelFor(winTestId)})");
                    _hadError = true;
                    return;
                }
                if (leveledUpCount != 2 || lastLeveledLevel != 1)
                {
                    Debug.LogError($"[PlaytestHeadless] 인연 — LeveledUp 이벤트 횟수가 안 맞음(count={leveledUpCount}, 기대 2)");
                    _hadError = true;
                    return;
                }

                float atkMulAfter = BondState.AtkMultiplier;
                float expectedMul = atkMulBefore + BondState.AtkBonusPerLevel * 2; // 둘 다 1등급씩.
                if (!Mathf.Approximately(atkMulAfter, expectedMul))
                {
                    Debug.LogError($"[PlaytestHeadless] 인연 — 등급 상승이 AtkMultiplier에 안 반영됨({atkMulBefore:F3}→{atkMulAfter:F3}, 기대={expectedMul:F3})");
                    _hadError = true;
                    return;
                }

                BondState.EnsureMember(winTestId2);
                BondState.ReportWin();
                BondState.ReportWin();
                BondState.ReportWin();
                if (BondState.LevelFor(winTestId2) != 1)
                {
                    Debug.LogError($"[PlaytestHeadless] 인연 — 승수 3(문턱)인데 1등급이 아님(level={BondState.LevelFor(winTestId2)})");
                    _hadError = true;
                    return;
                }

                Debug.Log($"[PlaytestHeadless] bond OK - 거리 2.1km→인연 Lv.1(2명), LeveledUp 2회, AtkMultiplier 반영({atkMulBefore:F2}→{atkMulAfter:F2}), 승수 3→Lv.1 확인");
            }
            finally
            {
                BondState.LeveledUp -= OnLeveledUp;
            }
        }

        /// <summary>PLAN.md 101-3 C hitstop(2026-09-17, DUNGEON·STORY 다음
        /// GO 차례) — `BanditEncounter.OnDuelEvent("hit")`를 리플렉션으로
        /// 직접 불러(`CheckGoalBoardAndSessionCard`의 `Update()` 직접 호출과
        /// 같은 결) `StartCoroutine()` 첫 세그먼트가 같은 프레임에 동기
        /// 실행된다는 점으로 Animator.speed==0을 확인한다. player·foe 각각
        /// 리깅 모델(Maria/Abe)이 이 PC에 없으면 폴백이라 null일 수 있다
        /// (DUNGEON `CheckHitstop`과 같은 "null 허용" — 실제로 이 세션에서
        /// player는 null, foe(Abe)는 있었다) — 최소 한쪽은 있어야 코드
        /// 경로 자체는 확인된다.</summary>
        private static void CheckBanditHitstop()
        {
            var encounter = Object.FindFirstObjectByType<BanditEncounter>();
            if (encounter == null)
            {
                Debug.LogError("[PlaytestHeadless] BanditEncounter 컴포넌트를 못 찾음");
                _hadError = true;
                return;
            }

            var startFight = typeof(BanditEncounter).GetMethod("StartFight", BindingFlags.NonPublic | BindingFlags.Instance);
            startFight.Invoke(encounter, null);

            var playerAnimatorField = typeof(BanditEncounter).GetField("_playerAnimator", BindingFlags.NonPublic | BindingFlags.Instance);
            var playerAnimator = playerAnimatorField.GetValue(encounter) as Animator;
            var visualField = typeof(BanditEncounter).GetField("_visual", BindingFlags.NonPublic | BindingFlags.Instance);
            var foeAnimator = (visualField.GetValue(encounter) as Transform)?.GetComponent<Animator>();

            if (playerAnimator == null && foeAnimator == null)
            {
                Debug.Log("[PlaytestHeadless] hitstop 검증 스킵 — player·foe 둘 다 Animator가 null(폴백 모델, 정상 케이스)");
                return;
            }

            var onDuelEvent = typeof(BanditEncounter).GetMethod("OnDuelEvent", BindingFlags.NonPublic | BindingFlags.Instance);
            onDuelEvent.Invoke(encounter, new object[] { new DuelRules.DuelEvent { T = "hit", Dmg = 1f } });

            if ((playerAnimator != null && playerAnimator.speed != 0f) || (foeAnimator != null && foeAnimator.speed != 0f))
            {
                Debug.LogError($"[PlaytestHeadless] hitstop이 hit 이벤트 직후 Animator를 안 멈춤 — player.speed={(playerAnimator != null ? playerAnimator.speed.ToString() : "null")} foe.speed={(foeAnimator != null ? foeAnimator.speed.ToString() : "null")}");
                _hadError = true;
                return;
            }
            Debug.Log($"[PlaytestHeadless] bandit hitstop OK - hit 이벤트 직후 확인(player={(playerAnimator != null)}, foe={(foeAnimator != null)})");
        }

        /// <summary>PLAN.md 101-3 G "지형 반응"(2026-09-17 추가) — DUNGEON
        /// `PlaytestDungeonHeadless.CheckGroundDecal()`과 같은 결. `hit`
        /// 이벤트가 실제로 `GroundDecal.Spawn(HitMark)`을 부르는지, 그리고
        /// "최대 32" 캡이 지켜지는지 본다(발자국은 씬이 짧게 도는 헤드리스
        /// 특성상 플레이어가 거의 안 움직여 여기선 안 본다 — 히트마크와
        /// 스폰 함수 자체가 같아 캡 검증엔 충분하다).</summary>
        private static void CheckGroundDecal()
        {
            var encounter = Object.FindFirstObjectByType<BanditEncounter>();
            if (encounter == null)
            {
                Debug.LogError("[PlaytestHeadless] 지형 데칼 검증용 BanditEncounter를 못 찾음");
                _hadError = true;
                return;
            }

            int before = GroundDecal.ActiveCount;
            var onDuelEvent = typeof(BanditEncounter).GetMethod("OnDuelEvent", BindingFlags.NonPublic | BindingFlags.Instance);
            onDuelEvent.Invoke(encounter, new object[] { new DuelRules.DuelEvent { T = "hit", Dmg = 1f } });

            if (GroundDecal.ActiveCount <= before)
            {
                Debug.LogError($"[PlaytestHeadless] 타격 지형 데칼이 안 생김 — before={before} after={GroundDecal.ActiveCount}");
                _hadError = true;
                return;
            }

            for (int i = 0; i < 40; i++)
            {
                GroundDecal.Spawn(Vector3.zero, GroundDecal.Kind.HitMark);
            }

            if (GroundDecal.ActiveCount > 32)
            {
                Debug.LogError($"[PlaytestHeadless] 지형 데칼 최대 32 캡이 안 지켜짐 — ActiveCount={GroundDecal.ActiveCount}");
                _hadError = true;
                return;
            }

            Debug.Log($"[PlaytestHeadless] ground decal OK - hit마다 생성 확인, 캡 이후 ActiveCount={GroundDecal.ActiveCount}(<=32)");
        }

        /// <summary>PLAN.md 101-3 G "성장 연출"(2026-09-17 추가) — DUNGEON
        /// `CameraRig.PlayLevelUpCut()`과 같은 결. `PlayerStats.AddExp()`가
        /// `LeveledUp`을 동기 호출하고 `GameBootstrap.OnLeveledUp()`이 그
        /// 자리에서 `StartCoroutine()`을 불러 같은 프레임에 `_zoom`이 이미
        /// 움직여 있다. **`CheckBanditLootMarker`보다 반드시 먼저 돈다**(위
        /// `CountFrames()` 주석 참고).</summary>
        private static void CheckLevelUpCut()
        {
            var cameraRig = Object.FindFirstObjectByType<CameraRig>();
            if (cameraRig == null)
            {
                Debug.LogError("[PlaytestHeadless] 성장 연출 검증용 CameraRig를 못 찾음");
                _hadError = true;
                return;
            }

            var zoomField = typeof(CameraRig).GetField("_zoom", BindingFlags.NonPublic | BindingFlags.Instance);
            float zoomBefore = (float)zoomField.GetValue(cameraRig);

            PlayerStats.AddExp(PlayerStats.ExpToNext + 1);

            float zoomAfter = (float)zoomField.GetValue(cameraRig);
            if (Mathf.Approximately(zoomAfter, zoomBefore))
            {
                Debug.LogError($"[PlaytestHeadless] 레벨업 직후 카메라 줌이 안 바뀜 — zoom={zoomAfter}");
                _hadError = true;
                return;
            }
            Debug.Log($"[PlaytestHeadless] level-up cut OK - 레벨업 직후 zoom {zoomBefore:F2}→{zoomAfter:F2}");
        }

        /// <summary>PLAN.md 101-2 ⑦ "승급 3택"(2026-09-19 추가) — 직전
        /// <see cref="CheckLevelUpCut"/>의 강제 레벨업이 GameBootstrap 배선을
        /// 타고 실제로 카드를 띄웠는지부터 본다(STORY `StoryJobChoiceUi`
        /// 검증과 같은 결 — 위젯 자체와 게임 상태를 나눠 본다). 그 다음
        /// 버튼 클릭을 흉내 내 하나를 고르고(배율만 바뀌고 기초 능력치는
        /// 그대로인지), 새로 하나 더 굴려 거절 경로(골드 +10)까지 확인한다.
        /// 마지막으로 RollChoice()를 여러 번 굴려 매번 축 셋이 다 다른지 본다.</summary>
        private static void CheckPerkChoice()
        {
            var ui = Object.FindFirstObjectByType<PerkChoiceUi>();
            if (ui == null)
            {
                Debug.LogError("[PlaytestHeadless] 승급 3택 검증용 PerkChoiceUi를 못 찾음");
                _hadError = true;
                return;
            }

            if (!ui.IsShowing)
            {
                Debug.LogError("[PlaytestHeadless] 승급 3택 — 레벨업 후에도 카드가 안 뜸(GameBootstrap 배선 확인)");
                _hadError = true;
                return;
            }

            var uiType = typeof(PerkChoiceUi);
            var offerField = uiType.GetField("_offer", BindingFlags.NonPublic | BindingFlags.Instance);
            var offer = (PerkState.PerkDef[])offerField.GetValue(ui);
            if (offer == null || offer.Length != 3)
            {
                Debug.LogError($"[PlaytestHeadless] 승급 3택 — 뜬 카드가 3장이 아님(count={offer?.Length ?? -1})");
                _hadError = true;
                return;
            }

            float atkStatBefore = PartyState.Atk;
            float atkBonusBefore = PlayerStats.AtkBonus;
            var chosenAxis = offer[0].Axis;
            float multBefore = chosenAxis == PerkState.Axis.Atk ? PerkState.AtkMultiplier
                : chosenAxis == PerkState.Axis.Def ? PerkState.DefMultiplier : PerkState.KiMultiplier;

            var chooseIndex = uiType.GetMethod("ChooseIndex", BindingFlags.NonPublic | BindingFlags.Instance);
            chooseIndex.Invoke(ui, new object[] { 0 }); // 버튼 onClick과 같은 경로.

            if (ui.IsShowing)
            {
                Debug.LogError("[PlaytestHeadless] 승급 3택 — 카드 선택 후에도 패널이 안 닫힘");
                _hadError = true;
                return;
            }
            if (!PerkState.HasPerk(chosenAxis))
            {
                Debug.LogError($"[PlaytestHeadless] 승급 3택 — 고른 축({chosenAxis})에 특성이 안 앉음");
                _hadError = true;
                return;
            }
            float multAfter = chosenAxis == PerkState.Axis.Atk ? PerkState.AtkMultiplier
                : chosenAxis == PerkState.Axis.Def ? PerkState.DefMultiplier : PerkState.KiMultiplier;
            if (!(multAfter > multBefore))
            {
                Debug.LogError($"[PlaytestHeadless] 승급 3택 — 선택 후 배율이 안 오름({multBefore:F2}→{multAfter:F2})");
                _hadError = true;
                return;
            }
            if (!Mathf.Approximately(PartyState.Atk, atkStatBefore) || !Mathf.Approximately(PlayerStats.AtkBonus, atkBonusBefore))
            {
                Debug.LogError("[PlaytestHeadless] 승급 3택 — 특성 선택이 기초 능력치를 직접 바꿈(배율로만 적용돼야 함)");
                _hadError = true;
                return;
            }

            // 거절 경로 — 새 카드를 하나 더 굴려 직접 띄운 뒤 거절 버튼(private
            // Reject())을 흉내 낸다. onRejected로 PerkState.Reject를 그대로
            // 넘겨 실제 배선과 같은 경로(골드 +10)를 태운다.
            int goldBefore = GoldState.Gold;
            var rejectOffer = PerkState.RollChoice();
            ui.Show(rejectOffer, PerkState.Choose, PerkState.Reject);
            var rejectMethod = uiType.GetMethod("Reject", BindingFlags.NonPublic | BindingFlags.Instance);
            rejectMethod.Invoke(ui, null);
            if (ui.IsShowing || GoldState.Gold != goldBefore + PerkState.RejectGoldReward)
            {
                Debug.LogError($"[PlaytestHeadless] 승급 3택 — 거절 경로 실패(showing={ui.IsShowing}, gold {goldBefore}->{GoldState.Gold})");
                _hadError = true;
                return;
            }

            // 축 분포 — 여러 번 굴려도 매번 공/수/보 셋이 서로 다른지.
            for (int i = 0; i < 50; i++)
            {
                var rolled = PerkState.RollChoice();
                var axes = new System.Collections.Generic.HashSet<PerkState.Axis>();
                foreach (var p in rolled) axes.Add(p.Axis);
                if (rolled.Length != 3 || axes.Count != 3)
                {
                    Debug.LogError($"[PlaytestHeadless] 승급 3택 — {i}번째 굴림에서 축이 안 겹쳐야 하는데 겹침(distinct={axes.Count})");
                    _hadError = true;
                    return;
                }
            }

            Debug.Log($"[PlaytestHeadless] perk choice OK - 레벨업 카드 표시·선택({chosenAxis} {multBefore:F2}→{multAfter:F2})·거절(+{PerkState.RejectGoldReward} gold)·축 분포 50회 확인");
        }

        /// <summary>PLAN.md 101-3 F "죽음"(2026-09-17 추가) — DUNGEON
        /// `CheckLootMarker()`와 같은 결. `_duel.Cleared`를 강제로 true로
        /// 만든 뒤 `FinishFight()`를 직접 불러 승리 경로(보상+`LootMarker.
        /// Spawn()`+`Destroy(gameObject)`)를 실제로 태운다.</summary>
        private static void CheckBanditLootMarker()
        {
            var encounter = Object.FindFirstObjectByType<BanditEncounter>();
            if (encounter == null)
            {
                Debug.LogError("[PlaytestHeadless] 유품 마커 검증용 BanditEncounter를 못 찾음");
                _hadError = true;
                return;
            }

            var startFight = typeof(BanditEncounter).GetMethod("StartFight", BindingFlags.NonPublic | BindingFlags.Instance);
            startFight.Invoke(encounter, null);

            var duelField = typeof(BanditEncounter).GetField("_duel", BindingFlags.NonPublic | BindingFlags.Instance);
            var duel = (DuelRules)duelField.GetValue(encounter);
            duel.Cleared = true;

            int before = LootMarker.SpawnCount;
            var finishFight = typeof(BanditEncounter).GetMethod("FinishFight", BindingFlags.NonPublic | BindingFlags.Instance);
            finishFight.Invoke(encounter, null);

            if (LootMarker.SpawnCount != before + 1)
            {
                Debug.LogError($"[PlaytestHeadless] 유품 마커가 안 생김 — SpawnCount {before} → {LootMarker.SpawnCount}");
                _hadError = true;
                return;
            }
            Debug.Log("[PlaytestHeadless] loot marker OK - 승리 시 LootMarker.Spawn 호출 확인(픽업 경로는 이후 자연 프레임에서 같이 검증됨)");
        }

        /// <summary>PLAN.md 101-3 G "장비 가시화"(2026-09-17 추가) — DUNGEON
        /// `CheckWeaponVisual()`과 같은 결. `Inventory.AddItem("wp_relic")`
        /// (2등급, 카탈로그 최고 공격력이라 이 시점까지 무슨 무기가 장착돼
        /// 있었든 확실히 자동 장착된다)을 불러 칼날 크기가 커지는지 본다.</summary>
        private static void CheckWeaponVisual()
        {
            var weaponVisual = Object.FindFirstObjectByType<WeaponVisual>();
            if (weaponVisual == null)
            {
                Debug.LogError("[PlaytestHeadless] 무기 가시화 검증용 WeaponVisual을 못 찾음");
                _hadError = true;
                return;
            }

            var bladeField = typeof(WeaponVisual).GetField("_blade", BindingFlags.NonPublic | BindingFlags.Instance);
            var blade = (Transform)bladeField.GetValue(weaponVisual);
            if (blade == null)
            {
                Debug.LogError("[PlaytestHeadless] 무기 칼날(blade) 메시가 안 생김");
                _hadError = true;
                return;
            }

            float lengthBefore = blade.localScale.y;
            Inventory.AddItem("wp_relic");
            float lengthAfter = blade.localScale.y;

            if (lengthAfter <= lengthBefore)
            {
                Debug.LogError($"[PlaytestHeadless] 무기 등급 갱신이 칼날 크기에 안 반영됨 — {lengthBefore:F2}→{lengthAfter:F2}");
                _hadError = true;
                return;
            }
            Debug.Log($"[PlaytestHeadless] weapon visual OK - 무기 교체 시 칼날 길이 {lengthBefore:F2}→{lengthAfter:F2}(등급 갱신 반영)");
        }

        /// <summary>PLAN.md 102-4(2026-09-23) "Props 재질 분리" — `BuildPropsMaterialSplit.cs`
        /// 산출물이 씬에 실제로 걸렸는지 확인한다: lantern은 재질 이름·금속 속성만(텍스처는
        /// 원본 그대로라 색 검증은 의미 없다 — 애초에 나무 성분이 없어 안 바뀐다), stall은
        /// 서브메시 둘(양쪽 다 삼각형 있음)·재질 둘(이름으로 구분)·**서로 다른 텍스처**(둘 다
        /// `_BaseMap`이 같으면 분리가 실패해 둘 다 원본 그대로 남은 것 — "색이 지워질 위험"과
        /// 정반대로 "안 갈렸다"는 회귀를 잡는다).</summary>
        private static void CheckPropsMaterials()
        {
            var lantern = GameObject.Find("Lantern_House2");
            var stall = GameObject.Find("MarketStall");
            if (lantern == null || stall == null)
            {
                Debug.LogError($"[PlaytestHeadless] props 재질 검증용 오브젝트를 못 찾음 — lantern={lantern != null} stall={stall != null}");
                _hadError = true;
                return;
            }

            var lanternMat = lantern.GetComponent<MeshRenderer>().sharedMaterial;
            if (lanternMat == null || lanternMat.name != "LanternMetal" ||
                !lanternMat.HasProperty("metallicFactor") || lanternMat.GetFloat("metallicFactor") < 0.5f)
            {
                Debug.LogError($"[PlaytestHeadless] lantern 재질 이상 — {lanternMat?.name} metallicFactor={(lanternMat != null && lanternMat.HasProperty("metallicFactor") ? lanternMat.GetFloat("metallicFactor").ToString("F2") : "?")}(기대 LanternMetal/≥0.5)");
                _hadError = true;
                return;
            }

            var stallFilter = stall.GetComponent<MeshFilter>();
            var stallRenderer = stall.GetComponent<MeshRenderer>();
            var mesh = stallFilter.sharedMesh;
            if (mesh.subMeshCount != 2 || stallRenderer.sharedMaterials.Length != 2 ||
                stallRenderer.sharedMaterials[0].name != "StallRedWood" || stallRenderer.sharedMaterials[1].name != "StallRedCanopy")
            {
                Debug.LogError($"[PlaytestHeadless] stall 재질 분리 이상 — 서브메시={mesh.subMeshCount} 재질=[{string.Join(",", System.Array.ConvertAll(stallRenderer.sharedMaterials, m => m?.name))}]");
                _hadError = true;
                return;
            }
            if (mesh.GetTriangles(0).Length == 0 || mesh.GetTriangles(1).Length == 0)
            {
                Debug.LogError($"[PlaytestHeadless] stall 서브메시 한쪽이 비어있음 — wood={mesh.GetTriangles(0).Length / 3}tri canopy={mesh.GetTriangles(1).Length / 3}tri");
                _hadError = true;
                return;
            }
            // wood는 URP/Lit(dark_wooden_planks 템플릿, `_BaseMap`), canopy는 glTFast의
            // glTF PBR Shader Graph(`baseColorTexture`) — 두 재질이 셰이더 자체가 다르다.
            var woodTex = GetBaseTexture(stallRenderer.sharedMaterials[0]);
            var canopyTex = GetBaseTexture(stallRenderer.sharedMaterials[1]);
            if (woodTex == null || canopyTex == null || woodTex == canopyTex)
            {
                Debug.LogError($"[PlaytestHeadless] stall 텍스처가 안 갈림 — wood={woodTex?.name} canopy={canopyTex?.name}(erasure 의심)");
                _hadError = true;
                return;
            }
            Debug.Log($"[PlaytestHeadless] props materials OK - lantern metallicFactor={lanternMat.GetFloat("metallicFactor"):F2}, stall wood {mesh.GetTriangles(0).Length / 3}tri(tex={woodTex.name})/canopy {mesh.GetTriangles(1).Length / 3}tri(tex={canopyTex.name}) 분리 유지");
        }

        private static Texture GetBaseTexture(Material m)
        {
            if (m == null) return null;
            if (m.HasProperty("_BaseMap")) return m.GetTexture("_BaseMap");
            if (m.HasProperty("baseColorTexture")) return m.GetTexture("baseColorTexture");
            return null;
        }

        /// <summary>PLAN.md 101-2 ③ "75초 토벌"(2026-09-19) — `RareWolfEncounter`에
        /// 건 raid 모드(`DuelRules.Raid`)를 두 사이클로 확인한다. 첫 사이클은
        /// 저스트 회피(0.25s 창 안=완전 회피+기 보너스, 밖="early")·예고 중
        /// 아무 것도 안 눌러도 절반만 맞는지(수동 mitigation)를 `DuelRules`의
        /// public 필드를 직접 조작해(Act/Step은 public이라 리플렉션 불필요)
        /// 결정적으로 본다. 두 번째 사이클은 `RareWolfEncounter.StartFight()`를
        /// 다시 불러 깨끗한 `_duel`을 받은 뒤, `Hp`를 75%·50%·25% 문턱 바로
        /// 위로 세팅하고 실제 `DoAct("quick")`(private, 버튼 클릭과 같은 경로)를
        /// 태워 부위 파괴 보상(골드)·완파 보너스까지 실제 배선을 확인한다.</summary>
        private static void CheckRaidBoss()
        {
            var rareWolf = Object.FindFirstObjectByType<RareWolfEncounter>();
            if (rareWolf == null)
            {
                Debug.LogError("[PlaytestHeadless] 75초 토벌 검증용 RareWolfEncounter를 못 찾음");
                _hadError = true;
                return;
            }

            var rwType = typeof(RareWolfEncounter);
            var startFight = rwType.GetMethod("StartFight", BindingFlags.NonPublic | BindingFlags.Instance);
            var duelField = rwType.GetField("_duel", BindingFlags.NonPublic | BindingFlags.Instance);
            var doAct = rwType.GetMethod("DoAct", BindingFlags.NonPublic | BindingFlags.Instance);

            // ---- 사이클 1: raid 플래그·저스트 회피·수동 mitigation ----
            startFight.Invoke(rareWolf, null);
            var duel = (DuelRules)duelField.GetValue(rareWolf);

            if (!duel.Raid || !Mathf.Approximately(duel.Left, DuelRules.RaidTimeSec))
            {
                Debug.LogError($"[PlaytestHeadless] 75초 토벌 — raid 모드가 안 켜짐(Raid={duel.Raid}, Left={duel.Left})");
                _hadError = true;
                return;
            }

            duel.Tell = DuelRules.JustWindowSec + 0.1f; // 저스트 창보다 이르다.
            var early = duel.Act("dodge");
            if (early.Ok || early.Reason != "early")
            {
                Debug.LogError($"[PlaytestHeadless] 75초 토벌 — 저스트 창 밖 회피가 실패(early)해야 하는데 Ok={early.Ok} Reason={early.Reason}");
                _hadError = true;
                return;
            }

            duel.Tell = DuelRules.JustWindowSec - 0.05f; // 저스트 창 안.
            var just = duel.Act("dodge");
            if (!just.Ok || !duel.Dodged)
            {
                Debug.LogError($"[PlaytestHeadless] 75초 토벌 — 저스트 창 안 회피가 실패함(Ok={just.Ok})");
                _hadError = true;
                return;
            }
            float kiBefore = duel.Ki;
            var justEvents = duel.Step(0.2f); // Tell을 0 밑으로 밀어 heavy 판정.
            var justHeavy = justEvents.Find(e => e.T == "heavy");
            float expectedKi = Mathf.Min(DuelRules.KiMax, kiBefore + DuelRules.KiMax * DuelRules.JustKiBonus * duel.KiMul);
            if (justHeavy.T != "heavy" || justHeavy.Dmg != 0f || !justHeavy.Dodged || !Mathf.Approximately(duel.Ki, expectedKi))
            {
                Debug.LogError($"[PlaytestHeadless] 75초 토벌 — 저스트 회피가 완전 회피+기 보너스로 안 이어짐(dmg={justHeavy.Dmg}, ki {kiBefore:F1}→{duel.Ki:F1}, 기대={expectedKi:F1})");
                _hadError = true;
                return;
            }

            duel.Tell = DuelRules.TellSec; // 새 예고 — 이번엔 아무 것도 안 누른다.
            var passiveEvents = duel.Step(DuelRules.TellSec + 0.05f);
            var passiveHeavy = passiveEvents.Find(e => e.T == "heavy");
            float expectedHeavy = Mathf.Round(duel.FoeAtk * DuelRules.HeavyMul * DuelRules.PassiveMitigation);
            if (passiveHeavy.T != "heavy" || passiveHeavy.Dodged || !Mathf.Approximately(passiveHeavy.Dmg, expectedHeavy))
            {
                Debug.LogError($"[PlaytestHeadless] 75초 토벌 — 예고 중 아무 것도 안 누르면 절반만 맞아야 하는데 dmg={passiveHeavy.Dmg}(기대 {expectedHeavy})");
                _hadError = true;
                return;
            }

            // ---- 사이클 2: 부위 파괴 보상 — 실제 DoAct("quick") 경로 ----
            startFight.Invoke(rareWolf, null); // 깨끗한 _duel로 다시.
            duel = (DuelRules)duelField.GetValue(rareWolf);
            int fullBreakBonusGold = (int)rwType.GetField("FullBreakBonusGold", BindingFlags.NonPublic | BindingFlags.Static).GetValue(null);
            float[] thresholds = { 0.75f, 0.50f, 0.25f };

            for (int i = 0; i < thresholds.Length; i++)
            {
                duel.Hp = duel.FoeHp * thresholds[i] + 2f; // 문턱 바로 위(margin은 quick 한 방 dmg보다 작아야 넘어간다).
                duel.Cd = 0f; // 이전 반복의 QuickCd가 남아 있으면 이번 quick이 "cd"로 조용히 실패한다.
                int goldBefore = GoldState.Gold;
                doAct.Invoke(rareWolf, new object[] { "quick" });
                int expectedGold = goldBefore + DuelRules.PartRewardGold + (i == thresholds.Length - 1 ? fullBreakBonusGold : 0);
                if (GoldState.Gold != expectedGold || !duel.PartBroken[i])
                {
                    Debug.LogError($"[PlaytestHeadless] 75초 토벌 — {i}번째 부위 파괴 보상 실패(gold {goldBefore}->{GoldState.Gold}, 기대 {expectedGold}, broken={duel.PartBroken[i]})");
                    _hadError = true;
                    return;
                }
            }

            Debug.Log($"[PlaytestHeadless] raid boss OK - raid 모드(75s)·저스트 회피(완전 회피+기)·수동 mitigation(절반)·부위 3 파괴 보상+완파 보너스 전부 확인");
        }

        /// <summary>PLAN.md 101-2 GO ② "사당 시련"(2026-09-20) — 파도 3을
        /// 공유 타이머로 잇는 OnWaveOver() 전환(클리어 시 남은 시간을 그대로
        /// 다음 파도로), 최종 클리어 보상·인장 조각 3개=인장 1(이정표
        /// 보너스), 실패 시 소지금 손실+10분 잠금, 잠금 중 재입장 차단까지
        /// 본다. ShrineTrialState 자체는 인카운터 없이도 조각→인장 산술을
        /// 먼저 단위로 확인한다(3회째 true, Stamps+1).</summary>
        private static void CheckShrineTrial()
        {
            int stampsBefore = ShrineTrialState.Stamps;
            bool r1 = ShrineTrialState.ReportClear();
            bool r2 = ShrineTrialState.ReportClear();
            bool r3 = ShrineTrialState.ReportClear();
            if (r1 || r2 || !r3 || ShrineTrialState.Stamps != stampsBefore + 1)
            {
                Debug.LogError($"[PlaytestHeadless] 사당 시련 — 조각 3개=인장 1 산술이 안 맞음(r1={r1} r2={r2} r3={r3}, stamps {stampsBefore}->{ShrineTrialState.Stamps})");
                _hadError = true;
                return;
            }

            var encounter = Object.FindFirstObjectByType<ShrineTrialEncounter>();
            if (encounter == null)
            {
                Debug.LogError("[PlaytestHeadless] 사당 시련 검증용 ShrineTrialEncounter를 못 찾음");
                _hadError = true;
                return;
            }

            var seType = typeof(ShrineTrialEncounter);
            var startTrial = seType.GetMethod("StartTrial", BindingFlags.NonPublic | BindingFlags.Instance);
            var onWaveOver = seType.GetMethod("OnWaveOver", BindingFlags.NonPublic | BindingFlags.Instance);
            var duelField = seType.GetField("_duel", BindingFlags.NonPublic | BindingFlags.Instance);
            var waveIndexField = seType.GetField("_waveIndex", BindingFlags.NonPublic | BindingFlags.Instance);

            if (!ShrineTrialState.CanEnter())
            {
                Debug.LogError("[PlaytestHeadless] 사당 시련 — 검증 시작 전인데 이미 못 들어가는 상태(잠금/일일 한도)");
                _hadError = true;
                return;
            }

            // ---- 진입 1: 파도 3 전부 클리어 → 시간 이월·최종 보상 ----
            startTrial.Invoke(encounter, null);
            int expBefore = PlayerStats.Exp;
            int levelBefore = PlayerStats.Level;
            int goldBefore = GoldState.Gold;

            for (int wave = 0; wave < 2; wave++)
            {
                var duel = (DuelRules)duelField.GetValue(encounter);
                duel.Cleared = true;
                float leftBefore = duel.Left;
                onWaveOver.Invoke(encounter, null);

                int waveIndexNow = (int)waveIndexField.GetValue(encounter);
                var nextDuel = (DuelRules)duelField.GetValue(encounter);
                if (waveIndexNow != wave + 1 || nextDuel == duel || !Mathf.Approximately(nextDuel.Left, leftBefore))
                {
                    Debug.LogError($"[PlaytestHeadless] 사당 시련 — 파도 {wave} 클리어가 다음 파도로 안 이어짐(waveIndex={waveIndexNow}, left {leftBefore}->{nextDuel.Left})");
                    _hadError = true;
                    return;
                }
            }

            // 마지막 파도(2) 클리어 — 시련 전체 종료.
            var finalDuel = (DuelRules)duelField.GetValue(encounter);
            finalDuel.Cleared = true;
            onWaveOver.Invoke(encounter, null);

            int waveIndexAfter = (int)waveIndexField.GetValue(encounter);
            bool visualActiveAfter = encounter.transform.Find("Visual").gameObject.activeSelf;
            // exp는 이 헤드리스 실행에서 이미 여러 체크가 레벨업 문턱 가까이
            // 올려놨을 수 있어(PlayerStats.Exp가 레벨업마다 랩어라운드된다,
            // PlayerStats.AddExp() 참고) 정확한 값 대신 "레벨업했거나 딱
            // ClearExpReward만큼 늘었거나"로 느슨하게 본다 — CheckBanditLootMarker
            // 등 기존 체크들도 같은 이유로 exp 정확값은 안 잰다. gold는 안
            // 랩되니 정확히 잰다.
            bool expOk = PlayerStats.Level > levelBefore || PlayerStats.Exp == expBefore + ClearExpConst(seType);
            if (waveIndexAfter != 0 || visualActiveAfter
                || !expOk
                || GoldState.Gold != goldBefore + ClearGoldConst(seType))
            {
                Debug.LogError($"[PlaytestHeadless] 사당 시련 — 최종 클리어 보상·정리가 기대와 다름(waveIndex={waveIndexAfter}, visual={visualActiveAfter}, exp {expBefore}->{PlayerStats.Exp}, gold {goldBefore}->{GoldState.Gold})");
                _hadError = true;
                return;
            }

            // ---- 진입 2: 실패(밀림) → 소지금 손실 + 10분 잠금 ----
            startTrial.Invoke(encounter, null);
            var failDuel = (DuelRules)duelField.GetValue(encounter);
            failDuel.Cleared = false;
            failDuel.Dealt = 5f; // "한 대도 못 때리고 물러난 것은 실패로 안 친다" 경계 밖(진짜 실패).
            int goldBeforeFail = GoldState.Gold;
            onWaveOver.Invoke(encounter, null);

            // GoldState.TrySpend는 부분 차감이 없다(모자라면 아예 0을 뺀다) — DropState.TryDrop과 다른 결.
            int expectedGoldAfterFail = goldBeforeFail >= FailGoldConst(seType) ? goldBeforeFail - FailGoldConst(seType) : goldBeforeFail;
            if (GoldState.Gold != expectedGoldAfterFail || !ShrineTrialState.IsLocked || ShrineTrialState.CanEnter())
            {
                Debug.LogError($"[PlaytestHeadless] 사당 시련 — 실패 비용·잠금이 기대와 다름(gold {goldBeforeFail}->{GoldState.Gold}, 기대 {expectedGoldAfterFail}, locked={ShrineTrialState.IsLocked}, canEnter={ShrineTrialState.CanEnter()})");
                _hadError = true;
                return;
            }

            Debug.Log("[PlaytestHeadless] shrine trial OK - 조각3=인장1, 파도 3 시간 이월, 최종 클리어 보상, 실패 비용+10분 잠금(재입장 차단) 전부 확인");
        }

        private static int ClearExpConst(System.Type t) => (int)t.GetField("ClearExpReward", BindingFlags.NonPublic | BindingFlags.Static).GetValue(null);
        private static int ClearGoldConst(System.Type t) => (int)t.GetField("ClearGoldReward", BindingFlags.NonPublic | BindingFlags.Static).GetValue(null);
        private static int FailGoldConst(System.Type t) => (int)t.GetField("FailGoldCost", BindingFlags.NonPublic | BindingFlags.Static).GetValue(null);

        /// <summary>PLAN.md 101-2 ④ 일과판(2026-09-19, GO 첫 실장) — 날짜 해시
        /// 선택의 결정성("같은 날은 같은 셋"), 진행→완료→도장 누적, 도장 7=
        /// 주간 보상 실제 지급, 저장/로드 왕복, v9 이하 파일 마이그레이션까지
        /// private 필드를 리플렉션으로 통제해 확인한다(SessionCard._closeTimer
        /// 조작과 같은 결 — 실제 달력 날짜가 몇이든, 오늘 실제로 어떤 셋이
        /// 뽑히든 결과가 안정적이게).</summary>
        private static void CheckDailyTasks()
        {
            var t = typeof(DailyTaskState);
            var selectForDate = t.GetMethod("SelectForDate", BindingFlags.NonPublic | BindingFlags.Static);
            var checkAllDone = t.GetMethod("CheckAllDone", BindingFlags.NonPublic | BindingFlags.Static);
            var selectedField = t.GetField("_selected", BindingFlags.NonPublic | BindingFlags.Static);
            var progressField = t.GetField("_progress", BindingFlags.NonPublic | BindingFlags.Static);
            var doneField = t.GetField("_done", BindingFlags.NonPublic | BindingFlags.Static);
            var dateField = t.GetField("_date", BindingFlags.NonPublic | BindingFlags.Static);
            var stampGrantedField = t.GetField("_dayStampGranted", BindingFlags.NonPublic | BindingFlags.Static);
            var stampsField = t.GetField("_stamps", BindingFlags.NonPublic | BindingFlags.Static);

            // 결정성 — 같은 날짜 문자열은 항상 같은 셋.
            selectForDate.Invoke(null, new object[] { "2026-09-19" });
            var firstSelected = (int[])selectedField.GetValue(null);
            selectForDate.Invoke(null, new object[] { "2026-01-01" }); // 다른 날짜로 한 번 흔든 뒤
            selectForDate.Invoke(null, new object[] { "2026-09-19" }); // 되돌아와도 같은지
            var secondSelected = (int[])selectedField.GetValue(null);
            bool sameSelection = firstSelected.Length == secondSelected.Length;
            if (sameSelection)
            {
                for (int i = 0; i < firstSelected.Length; i++)
                {
                    if (firstSelected[i] != secondSelected[i]) { sameSelection = false; break; }
                }
            }
            if (!sameSelection || firstSelected.Length != 4) // 109-14-8 갈래 넷에서 하나씩
            {
                Debug.LogError($"[PlaytestHeadless] 일과 — 날짜 해시가 비결정적이거나 하루 4개가 아님(count={firstSelected.Length}, 결정적={sameSelection})");
                _hadError = true;
                return;
            }

            // 진행 → 완료 → 도장 1 누적(오늘 실제로 뽑힌 게 어떤 조합이든
            // 상관없이 "셋 다 완료하면 도장"만 확인 — Kind는 안 건드린다).
            int n = firstSelected.Length;
            stampsField.SetValue(null, 0);
            stampGrantedField.SetValue(null, false);
            progressField.SetValue(null, new int[n]);
            var done = new bool[n];
            doneField.SetValue(null, done);

            int goldBefore = GoldState.Gold;
            int expBefore = PlayerStats.Exp;

            for (int i = 0; i < n; i++) done[i] = true;
            checkAllDone.Invoke(null, null);

            if (DailyTaskState.Stamps != 1)
            {
                Debug.LogError($"[PlaytestHeadless] 일과 — 셋 다 완료했는데 도장이 안 오름(stamps={DailyTaskState.Stamps})");
                _hadError = true;
                return;
            }
            if (goldBefore != GoldState.Gold || expBefore != PlayerStats.Exp)
            {
                Debug.LogError("[PlaytestHeadless] 일과 — 도장 1개(7 아님)인데 주간 보상이 지급됨");
                _hadError = true;
                return;
            }

            // 도장 6개를 더 쌓아 7번째에서 주간 보상(금+100·경험치+150) 지급 확인.
            // 경험치는 PlayerStats.Exp가 "현재 레벨 안에서의 경험치"라 레벨업이
            // 끼면 그대로 더해지지 않는다(넘친 만큼 다음 레벨로 넘어가며 줄어듦) —
            // 그래서 경험치는 델타 대신 레벨업 이벤트 카운트로 "실제로 지급은
            // 됐다"만 확인한다(정확한 exp 산술은 PlayerStats.AddExp 자체의 책임,
            // 여기서 재검증하지 않는다).
            int levelUpCount = 0;
            void CountLevelUp(int _) => levelUpCount++;
            PlayerStats.LeveledUp += CountLevelUp;
            for (int i = 0; i < 6; i++)
            {
                stampGrantedField.SetValue(null, false);
                checkAllDone.Invoke(null, null);
            }
            PlayerStats.LeveledUp -= CountLevelUp;
            if (DailyTaskState.Stamps != DailyTaskState.StampsPerReward)
            {
                Debug.LogError($"[PlaytestHeadless] 일과 — 도장이 {DailyTaskState.StampsPerReward}까지 안 쌓임(stamps={DailyTaskState.Stamps})");
                _hadError = true;
                return;
            }
            bool expProgressed = PlayerStats.Exp != expBefore || levelUpCount > 0;
            if (GoldState.Gold != goldBefore + 100 || !expProgressed)
            {
                Debug.LogError($"[PlaytestHeadless] 일과 — 도장 {DailyTaskState.StampsPerReward} 주간 보상 미지급(gold {goldBefore}->{GoldState.Gold}, exp {expBefore}->{PlayerStats.Exp}, levelUps={levelUpCount})");
                _hadError = true;
                return;
            }

            // 저장/로드 왕복(+ 구버전 v9 마이그레이션)은 실제
            // persistentDataPath/save.json을 두 번 덮어쓴다(온전한 왕복 저장 한
            // 번, v9 모양 가짜 한 번) — GameBootstrap.Start()가 부팅마다
            // SaveState.TryLoad()를 부르기 때문에, 이 파일을 원래 모습(테스트
            // 시작 전 상태, 파일이 아예 없었을 수도 있음)으로 되돌리지 않으면
            // **다음번 헤드리스 실행**이 이 테스트가 남긴 세이브를 이어받아
            // CheckWeaponVisual 등 앞선 체크가 간헐적으로 깨진다(실제로 겪음,
            // 2026-09-19). 그래서 두 조작 전체를 try/finally로 감싸고, try
            // 안의 모든 실패 경로(return 포함)에서도 finally가 반드시 돈다.
            string savePath = System.IO.Path.Combine(Application.persistentDataPath, "save.json");
            string originalSaveJson = System.IO.File.Exists(savePath) ? System.IO.File.ReadAllText(savePath) : null;
            try
            {
                // 저장/로드 왕복 — 지금 상태(도장 7·오늘 날짜)를 저장했다가
                // 메모리에서 지운 뒤 다시 불러 복원되는지.
                string savedDate = DailyTaskState.CurrentDate;
                int savedStamps = DailyTaskState.Stamps;
                if (!SaveState.Save())
                {
                    Debug.LogError("[PlaytestHeadless] 일과 — SaveState.Save() 실패(Player 태그를 못 찾았나)");
                    _hadError = true;
                    return;
                }
                dateField.SetValue(null, "");
                selectedField.SetValue(null, System.Array.Empty<int>());
                progressField.SetValue(null, System.Array.Empty<int>());
                doneField.SetValue(null, System.Array.Empty<bool>());
                stampsField.SetValue(null, 0);
                if (!SaveState.TryLoad())
                {
                    Debug.LogError("[PlaytestHeadless] 일과 — SaveState.TryLoad() 실패");
                    _hadError = true;
                    return;
                }
                if (DailyTaskState.CurrentDate != savedDate || DailyTaskState.Stamps != savedStamps)
                {
                    Debug.LogError($"[PlaytestHeadless] 일과 — 저장/로드 왕복 불일치(date {savedDate}->{DailyTaskState.CurrentDate}, stamps {savedStamps}->{DailyTaskState.Stamps})");
                    _hadError = true;
                    return;
                }

                // 구버전(v9, 일과 필드 없음) 로드 — 마이그레이션이 예외 없이
                // 빈 날짜·도장 0으로 채우는지.
                const string v9Json = "{\"version\":9,\"playerPos\":[0,0,0],\"partyMembers\":[],\"level\":1,\"exp\":0," +
                    "\"ownedItems\":[],\"equippedWeapon\":null,\"equippedArmor\":null,\"questBanditStage\":0," +
                    "\"caveTreasureFound\":false,\"gold\":100,\"merchantSold\":false,\"gatheredSpots\":[]," +
                    "\"shrineBlessed\":false,\"rareWolfDefeated\":false,\"worldFlags\":[]}";
                System.IO.File.WriteAllText(savePath, v9Json);
                stampsField.SetValue(null, -1); // 로드 전 값과 확실히 다르게 표시
                if (!SaveState.TryLoad())
                {
                    Debug.LogError("[PlaytestHeadless] 일과 — v9 세이브 로드(마이그레이션) 실패");
                    _hadError = true;
                    return;
                }
                if (DailyTaskState.CurrentDate != "" || DailyTaskState.Stamps != 0)
                {
                    Debug.LogError($"[PlaytestHeadless] 일과 — v9 마이그레이션 결과가 기대와 다름(date=\"{DailyTaskState.CurrentDate}\" stamps={DailyTaskState.Stamps})");
                    _hadError = true;
                    return;
                }
            }
            finally
            {
                if (originalSaveJson != null) System.IO.File.WriteAllText(savePath, originalSaveJson);
                else if (System.IO.File.Exists(savePath)) System.IO.File.Delete(savePath);
            }

            Debug.Log("[PlaytestHeadless] daily tasks OK - deterministic pick, stamp/weekly reward, save/load round-trip, v9 migration all verified");
        }

        /// <summary>2026-09-23 "모바일 버튼 먹통" 회귀 — 씬의 버튼 전부에 리스너가 있는지 +
        /// 설정 버튼을 진짜 onClick으로 열고 닫아 본다(ButtonWiringCheck.cs 주석 참고).</summary>
        private static void CheckButtonWiring()
        {
            const string Tag = "PlaytestHeadless";
            bool ok = ButtonWiringCheck.CheckNoDeadButtons(Tag);
            var settings = Object.FindFirstObjectByType<GoSettingsPanel>();
            var root = settings != null ? settings.transform : null;
            var panel = settings != null
                ? typeof(GoSettingsPanel).GetField("_panel", BindingFlags.NonPublic | BindingFlags.Instance).GetValue(settings) as GameObject
                : null;
            ok &= ButtonWiringCheck.PressOpensAndCloses(Tag, "설정 버튼",
                ButtonWiringCheck.FindByLabel(root, GoLocalization.T("settings.title")),
                ButtonWiringCheck.FindByLabel(root, GoLocalization.T("settings.close")), panel);
            if (!ok) _hadError = true;
        }

    }
}
