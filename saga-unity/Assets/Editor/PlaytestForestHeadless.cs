using TMPro;
using System.Reflection;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.UI;
using Saga.Core;
using Saga.Forest.Data;
using Saga.Forest.UI;
using Saga.Forest.World;

namespace Saga.EditorTools
{
    /// <summary>
    /// `PlaytestDungeonHeadless.cs`와 같은 결, 씬 경로만 다르다 —
    /// TestVillageForest 씬을 배치 모드에서 몇 프레임 재생해 런타임
    /// 예외가 없는지 확인한다. **주의 — -executeMethod로 부를 때 -quit을
    /// 같이 주지 않는다**(Run() 자신이 EditorApplication.Exit로 끝낸다).
    /// </summary>
    public static class PlaytestForestHeadless
    {
        private const string ScenePath = "Assets/Scenes/TestVillageForest.unity";
        private const int FramesToRun = 10;

        private static int _framesSeen;
        private static bool _hadError;
        private static int _pinDay;
        private static bool _origEnterPlayModeOptionsEnabled;
        private static EnterPlayModeOptions _origEnterPlayModeOptions;

        [MenuItem("Saga/Playtest TestVillageForest (Headless)")]
        public static void Run()
        {
            _origEnterPlayModeOptionsEnabled = EditorSettings.enterPlayModeOptionsEnabled;
            _origEnterPlayModeOptions = EditorSettings.enterPlayModeOptions;
            EditorSettings.enterPlayModeOptionsEnabled = true;
            EditorSettings.enterPlayModeOptions =
                EnterPlayModeOptions.DisableDomainReload | EnterPlayModeOptions.DisableSceneReload;

            ForestSaveState.DeleteForTest(); // 이전 헤드리스 실행이 남긴 세이브 무시(ForestSaveState.cs 주석 참고).
            EditorSceneManager.OpenScene(ScenePath);
            _framesSeen = 0;
            _hadError = false;
            Application.logMessageReceived += OnLog;
            // 오늘의 방문 손님이 마을 사람(루미)이면 그 사람이 광장에 나가 씬에서 숨어 마을 사람·시대 진단이 날짜 따라 깨진다 — 마을 사람이 아닌 손님 날로 붙든다
            _pinDay = 9001; while (!string.IsNullOrEmpty(Saga.Forest.Data.ForestVisitors.WhoOn(_pinDay).FolkId)) _pinDay++;
            Saga.Forest.Data.ForestVisitors.ForceDayForTest(_pinDay);
            EditorApplication.playModeStateChanged += OnStateChanged;
            EditorApplication.isPlaying = true;
        }

        private static void OnLog(string condition, string stackTrace, LogType type)
        {
            if (type != LogType.Error && type != LogType.Exception) return;
            if (stackTrace.Contains("UnityEditor.Search.SearchInit.IndexationOnStartup")) return;

            _hadError = true;
            Debug.LogError($"[PlaytestForestHeadless] runtime error: {condition}\n{stackTrace}");
        }

        private static void OnStateChanged(PlayModeStateChange state)
        {
            if (state == PlayModeStateChange.EnteredPlayMode)
            {
                EditorApplication.update += CountFrames;
            }
            else if (state == PlayModeStateChange.EnteredEditMode)
            {
                Saga.Forest.Data.ForestVisitors.ForceDayForTest(null);
                Application.logMessageReceived -= OnLog;
                EditorApplication.playModeStateChanged -= OnStateChanged;
                EditorSettings.enterPlayModeOptionsEnabled = _origEnterPlayModeOptionsEnabled;
                EditorSettings.enterPlayModeOptions = _origEnterPlayModeOptions;
                Debug.Log(_hadError
                    ? "[PlaytestForestHeadless] FAIL - runtime error(s) logged"
                    : $"[PlaytestForestHeadless] OK - {FramesToRun} frames, no errors");
                EditorApplication.Exit(_hadError ? 1 : 0);
            }
        }

        private static void CountFrames()
        {
            _framesSeen++;
            // PLAN.md 109-16 — 새 판 첫 장면(이사 오던 날)이 다른 진단 앞에서 상자를 열지 않게 끈다. 시나리오 진단이 스스로 켜고 되돌린다.
            if (_framesSeen == 1) { Saga.Forest.Data.ForestTutorial.Enabled = false; ForestScenario.Enabled = false; ForestScenario.AbortScene(); ForestScenarioUi.Instance?.Hide(); }
            // PLAN.md 44~49장 디버그 화면(2026-09-14, GO/DUNGEON과 같은 결) —
            // 좌표 줄이 실제로 채워지는지 본다. 0.5초 FPS 타이머를 기다리는
            // 대신(배치 모드는 몇 프레임 안엔 절대 안 찬다) private
            // Refresh()를 리플렉션으로 직접 부른다.
            if (_framesSeen == 3)
            {
                CheckDebugHud();
                CheckSettingsPanel();
                PlaytestSettingsVoice.Check("PlaytestForestHeadless", typeof(Saga.Forest.UI.ForestSettingsPanel)); // U-0075 음성 줄
                CheckButtonWiring();
                CheckActionButtonLocalization();
                CheckGoalBoardAndSessionCard();
                CheckMuseum();
                CheckGatherFeel();
                CheckTownScore();
                CheckDelivery();
                CheckFestival();
                if (!PlaytestForestZones.Run()) _hadError = true; // PLAN.md 108 ② 고정 특색 지역
                if (!PlaytestForestZoneProps.Run()) _hadError = true; // PLAN.md 108 끝줄 존 전용 소품
                if (!PlaytestForestEras.Run()) _hadError = true; // PLAN.md 109-4 세 시대 — 마을 사람 여섯·존 소품 시대 조각
                if (!PlaytestForestVisitors.Run()) _hadError = true; // PLAN.md 109-12-1 떠돌이 방문객
                Saga.Forest.Data.ForestVisitors.ForceDayForTest(_pinDay); // 방문객 진단이 날짜를 풀었으니 다시 붙든다
                { var vr = Object.FindFirstObjectByType<Saga.Forest.World.ForestVisitorRunner>(); if (vr != null) vr.Rebuild(); } // 숨은 마을 사람 되살리기
                if (!PlaytestAnonymousCrowd.RunForest("PlaytestForestHeadless")) _hadError = true; // U-0042 이름 없는 군중(299 목록 없으면 0명)
                if (!PlaytestForestMount.Run()) _hadError = true; // PLAN.md 109-15 탈것·비행 — 탈것·점수 손잡이·자리·세이브를 되돌린다.
                if (!PlaytestForestScenario.Run()) _hadError = true; // PLAN.md 109-16 시나리오 — 과일·집·도감·손님·택배·행사를 되돌린다.
                if (!PlaytestNpcModels.Forest()) _hadError = true; // PLAN.md 106-4 FOREST 몫 — 숲지기 사실 모델
            }
            if (_framesSeen >= FramesToRun)
            {
                EditorApplication.update -= CountFrames;
                EditorApplication.isPlaying = false;
            }
        }

        private static void CheckDebugHud()
        {
            var hudGo = GameObject.Find("DebugUI");
            var hud = hudGo != null ? hudGo.GetComponent<DebugHud>() : null;
            var labelGo = hudGo != null ? hudGo.transform.Find("Label") : null;
            var label = labelGo != null ? labelGo.GetComponent<TextMeshProUGUI>() : null;
            if (hud == null || label == null)
            {
                Debug.LogError("[PlaytestForestHeadless] DebugUI/Label을 못 찾음");
                _hadError = true;
                return;
            }

            var method = typeof(DebugHud).GetMethod("Refresh", BindingFlags.NonPublic | BindingFlags.Instance);
            method.Invoke(hud, null);

            if (!label.text.Contains("pos:"))
            {
                Debug.LogError($"[PlaytestForestHeadless] 디버그 오버레이에 좌표가 안 보임 text=\"{label.text}\"");
                _hadError = true;
            }
            else
            {
                Debug.Log($"[PlaytestForestHeadless] debug hud OK - \"{label.text.Replace("\n", " | ")}\"");
            }
        }

        /// <summary>PLAN.md 104-1 ②(2026-09-16) — GO
        /// `PlaytestHeadless.CheckSettingsPanel()`과 같은 결로 존재 확인만
        /// 하던 걸 TogglePanel()·ChooseSfx() 실제 호출 + 라벨 텍스트
        /// 확인으로 바꿨다(RealmCommandUi 사례 재발 방지 — 그쪽 클래스
        /// 주석 참고).</summary>
        private static void CheckSettingsPanel()
        {
            var panel = Object.FindFirstObjectByType<ForestSettingsPanel>();
            if (panel == null)
            {
                Debug.LogError("[PlaytestForestHeadless] ForestSettingsPanel 컴포넌트를 못 찾음");
                _hadError = true;
                return;
            }

            var panelGoField = typeof(ForestSettingsPanel).GetField("_panel", BindingFlags.NonPublic | BindingFlags.Instance);
            var panelGo = panelGoField.GetValue(panel) as GameObject;
            if (panelGo == null)
            {
                Debug.LogError("[PlaytestForestHeadless] ForestSettingsPanel._panel이 null — 씬 재로드 후 참조가 안 살아남음");
                _hadError = true;
                return;
            }

            var toggleMethod = typeof(ForestSettingsPanel).GetMethod("TogglePanel", BindingFlags.NonPublic | BindingFlags.Instance);
            toggleMethod.Invoke(panel, null); // 열기 — 여기서 NRE가 나면 그대로 테스트 실패로 드러난다.
            if (!panelGo.activeSelf)
            {
                Debug.LogError("[PlaytestForestHeadless] TogglePanel() 호출 후에도 설정 패널이 안 열림");
                _hadError = true;
                return;
            }
            toggleMethod.Invoke(panel, null); // 닫기
            if (panelGo.activeSelf)
            {
                Debug.LogError("[PlaytestForestHeadless] TogglePanel() 두 번째 호출 후에도 설정 패널이 안 닫힘");
                _hadError = true;
                return;
            }

            var sfxValueLabelField = typeof(ForestSettingsPanel).GetField("_sfxValueLabel", BindingFlags.NonPublic | BindingFlags.Instance);
            var sfxValueLabel = sfxValueLabelField.GetValue(panel) as TextMeshProUGUI;
            if (sfxValueLabel == null)
            {
                Debug.LogError("[PlaytestForestHeadless] ForestSettingsPanel._sfxValueLabel이 null");
                _hadError = true;
                return;
            }

            bool sfxBefore = ForestSettingsState.SfxOn;
            var chooseSfxMethod = typeof(ForestSettingsPanel).GetMethod("ChooseSfx", BindingFlags.NonPublic | BindingFlags.Instance);
            chooseSfxMethod.Invoke(panel, null); // 실제 버튼 핸들러 — 상태를 뒤집고 Refresh()까지 그대로 탄다.
            string expectedText = ForestLocalization.T(ForestSettingsState.SfxOn ? "state.on" : "state.off");
            if (ForestSettingsState.SfxOn == sfxBefore || sfxValueLabel.text != expectedText)
            {
                Debug.LogError($"[PlaytestForestHeadless] ChooseSfx() 이후 라벨이 실제로 안 바뀜 text=\"{sfxValueLabel.text}\"(기대=\"{expectedText}\")");
                _hadError = true;
                return;
            }
            chooseSfxMethod.Invoke(panel, null); // 원상복귀

            bool vibBefore = ForestSettingsState.VibrationOn;
            ForestSettingsState.VibrationOn = !vibBefore;
            if (ForestSettingsState.VibrationOn == vibBefore)
            {
                Debug.LogError("[PlaytestForestHeadless] 진동 토글이 안 바뀜");
                _hadError = true;
                return;
            }

            ForestSettingsState.UiScaleMultiplier = 1.15f;
            var scaler = Saga.Core.SagaUi.FirstGameScaler(); // Ⅱ 단추 등 메뉴 캔버스는 뺀다(110 ⑤c)
            float expected = Saga.Core.SagaUi.GameReference.x / 1.15f; // 110 ⑤b 기준 1600×900
            if (scaler == null || Mathf.Abs(scaler.referenceResolution.x - expected) > 1f)
            {
                Debug.LogError($"[PlaytestForestHeadless] UI 크기가 캔버스에 안 먹음 — got={(scaler == null ? "null" : scaler.referenceResolution.x.ToString())}");
                _hadError = true;
                return;
            }
            ForestSettingsState.UiScaleMultiplier = 1f;

            ForestSettingsState.HighGraphicsQuality = false;
            if (!Mathf.Approximately(QualitySettings.shadowDistance, 15f) || QualitySettings.antiAliasing != 0)
            {
                Debug.LogError($"[PlaytestForestHeadless] 그래픽 품질(절약)이 QualitySettings에 안 먹음 — shadowDistance={QualitySettings.shadowDistance} aa={QualitySettings.antiAliasing}");
                _hadError = true;
                return;
            }
            ForestSettingsState.HighGraphicsQuality = true;

            string langBefore = ForestLocalization.CurrentLanguage;
            string qualityLabelBefore = ForestSettingsState.GraphicsQualityLabel();
            ForestLocalization.CycleLanguage();
            if (ForestLocalization.CurrentLanguage == langBefore
                || ForestSettingsState.GraphicsQualityLabel() == qualityLabelBefore)
            {
                Debug.LogError("[PlaytestForestHeadless] 언어 전환이 실제 문구를 안 바꿈");
                _hadError = true;
                return;
            }
            ForestLocalization.CurrentLanguage = langBefore;

            Debug.Log("[PlaytestForestHeadless] settings panel OK - sfx/vibration/ui-scale/graphics-quality/language all verified");
        }

        /// <summary>2026-09-15 "저장 버튼 언어 전환 반응" — GO/DUNGEON/STORY에
        /// 이어 FOREST도 같은 문제(씬 빌드 시점 언어로 굳음)가 있었다.
        /// `LocalizedButtonLabel`(폴링, Update()는 private이라 리플렉션).</summary>
        private static void CheckActionButtonLocalization()
        {
            var go = GameObject.Find("SaveButton");
            var localized = go != null ? go.GetComponent<LocalizedButtonLabel>() : null;
            var label = go != null ? go.GetComponentInChildren<TextMeshProUGUI>() : null;
            if (localized == null || label == null)
            {
                Debug.LogError("[PlaytestForestHeadless] SaveButton/LocalizedButtonLabel을 못 찾음");
                _hadError = true;
                return;
            }

            string langBefore = ForestLocalization.CurrentLanguage;
            var method = typeof(LocalizedButtonLabel).GetMethod("Update", BindingFlags.NonPublic | BindingFlags.Instance);

            ForestLocalization.CurrentLanguage = "en";
            method.Invoke(localized, null);
            if (label.text != "Save")
            {
                Debug.LogError($"[PlaytestForestHeadless] 저장 버튼 영어 전환이 안 먹음 text=\"{label.text}\"(기대=Save)");
                _hadError = true;
                ForestLocalization.CurrentLanguage = langBefore;
                return;
            }
            ForestLocalization.CurrentLanguage = langBefore;
            method.Invoke(localized, null);
            if (label.text != (langBefore == "en" ? "Save" : "저장"))
            {
                Debug.LogError($"[PlaytestForestHeadless] 저장 버튼이 원래 언어로 안 돌아옴 text=\"{label.text}\"(기대=저장)");
                _hadError = true;
            }

            Debug.Log("[PlaytestForestHeadless] action button localization OK");
        }

        /// <summary>PLAN.md 101-2 "공통 선행" A·B(FOREST 세 번째 이식) —
        /// `PlaytestHeadless.CheckGoalBoardAndSessionCard()`(GO)·
        /// `PlaytestDungeonHeadless`(DUNGEON)와 완전히 같은 기준 — GoalBoard
        /// 세 줄이 실제로 채워지는지, Awake()의 IGoalSource 자동 재탐색이
        /// 동작하는지, SessionCard 가 뜨고 스스로 닫히는지를 직접 확인한다 —
        /// 존재 확인만으로 끝내지 않는다.</summary>
        private static void CheckGoalBoardAndSessionCard()
        {
            var board = Object.FindFirstObjectByType<GoalBoard>();
            if (board == null)
            {
                Debug.LogError("[PlaytestForestHeadless] GoalBoard 컴포넌트를 못 찾음");
                _hadError = true;
                return;
            }

            var sourceField = typeof(GoalBoard).GetField("_source", BindingFlags.NonPublic | BindingFlags.Instance);
            if (sourceField.GetValue(board) == null)
            {
                Debug.LogError("[PlaytestForestHeadless] GoalBoard._source가 null — Awake() 자동 재탐색 실패");
                _hadError = true;
                return;
            }

            var labelField = typeof(GoalBoard).GetField("_label", BindingFlags.NonPublic | BindingFlags.Instance);
            var label = labelField.GetValue(board) as TextMeshProUGUI;
            if (label == null || !label.text.Contains(Saga.Core.SagaUi.L("지금", "Now") + " —") || !label.text.Contains(Saga.Core.SagaUi.L("이번 세션", "This session") + " —") || !label.text.Contains(Saga.Core.SagaUi.L("이번 주", "This week") + " —"))
            {
                Debug.LogError($"[PlaytestForestHeadless] GoalBoard 세 줄이 안 채워짐 text=\"{(label == null ? "null" : label.text.Replace("\n", " | "))}\"");
                _hadError = true;
                return;
            }

            var card = Object.FindFirstObjectByType<SessionCard>();
            if (card == null)
            {
                Debug.LogError("[PlaytestForestHeadless] SessionCard 컴포넌트를 못 찾음");
                _hadError = true;
                return;
            }
            if (card.IsShowing)
            {
                Debug.LogError("[PlaytestForestHeadless] SessionCard가 세션 시작부터 떠 있음(기본은 숨김)");
                _hadError = true;
                return;
            }

            card.Show("테스트", "줄1", "줄2");
            if (!card.IsShowing)
            {
                Debug.LogError("[PlaytestForestHeadless] SessionCard.Show() 호출 후에도 안 뜸");
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
                Debug.LogError("[PlaytestForestHeadless] SessionCard가 만료 후에도 자동으로 안 닫힘");
                _hadError = true;
                return;
            }

            if (Object.FindFirstObjectByType<ForestSessionTracker>() == null)
            {
                Debug.LogError("[PlaytestForestHeadless] ForestSessionTracker 컴포넌트를 못 찾음");
                _hadError = true;
                return;
            }

            Debug.Log("[PlaytestForestHeadless] goal board / session card OK - 3 lines filled, source auto-found, card shows and auto-closes");
        }

        /// <summary>PLAN.md 101-2 5.3 "마을 번들"(2026-09-20 추가) — 네
        /// `ForestCollectSpot`이 실제로 존별로 하나씩 있는지, 걸어서 가까이
        /// 가면(리플렉션으로 `Update()`를 직접 불러 쿨다운·거리 판정까지
        /// 실제로 타는지) 처음 발견이 기록되고 같은 프레임 중복 호출은 안
        /// 늘어나는지 확인한다. 나머지 항목은 `ForestMuseumState.Record()`를
        /// 직접 불러 번들 완성·시설 스폰·전체 완성 깃발까지 빠르게 훑는다
        /// (DUNGEON `CheckSigilState`처럼 순수 상태 API를 직접 두드리는 결).</summary>
        private static void CheckMuseum()
        {
            var spots = Object.FindObjectsByType<ForestCollectSpot>(FindObjectsSortMode.None);
            if (spots.Length != 4)
            {
                Debug.LogError($"[PlaytestForestHeadless] ForestCollectSpot이 4개가 아님 — {spots.Length}");
                _hadError = true;
                return;
            }

            var categoryField = typeof(ForestCollectSpot).GetField("category", BindingFlags.NonPublic | BindingFlags.Instance);
            ForestCollectSpot insectSpot = null;
            foreach (var s in spots)
            {
                if ((ForestMuseumState.Category)categoryField.GetValue(s) == ForestMuseumState.Category.Insect) insectSpot = s;
            }
            if (insectSpot == null)
            {
                Debug.LogError("[PlaytestForestHeadless] 곤충(Insect) 채집 자리를 못 찾음");
                _hadError = true;
                return;
            }

            var playerGo = GameObject.FindWithTag("Player");
            if (playerGo == null)
            {
                Debug.LogError("[PlaytestForestHeadless] 마을 번들 검증용 player를 못 찾음");
                _hadError = true;
                return;
            }
            playerGo.transform.position = insectSpot.transform.position;

            var updateMethod = typeof(ForestCollectSpot).GetMethod("Update", BindingFlags.NonPublic | BindingFlags.Instance);
            int before = ForestMuseumState.DiscoveredCountOf(ForestMuseumState.Category.Insect);
            updateMethod.Invoke(insectSpot, null);
            int afterFirst = ForestMuseumState.DiscoveredCountOf(ForestMuseumState.Category.Insect);
            updateMethod.Invoke(insectSpot, null); // 같은 프레임 — 쿨다운에 걸려 늘면 안 됨.
            int afterSecond = ForestMuseumState.DiscoveredCountOf(ForestMuseumState.Category.Insect);

            if (afterFirst != before + 1 || afterSecond != afterFirst)
            {
                Debug.LogError($"[PlaytestForestHeadless] 채집 자리 발견 카운트가 이상함 — before={before} afterFirst={afterFirst}(기대 {before + 1}) afterSecond={afterSecond}(기대 {afterFirst}, 쿨다운)");
                _hadError = true;
                return;
            }

            // 나머지는 상태 API로 빠르게 채워 번들 완성·시설 스폰·전체 완성을 확인한다.
            foreach (var item in ForestMuseumState.ItemsOf(ForestMuseumState.Category.Insect))
            {
                ForestMuseumState.Record(ForestMuseumState.Category.Insect, item);
            }
            if (!ForestMuseumState.IsBundleDone(ForestMuseumState.Category.Insect) || GameObject.Find("Decor_FireflyJar") == null)
            {
                Debug.LogError("[PlaytestForestHeadless] 곤충 번들 완성인데 IsBundleDone/시설(Decor_FireflyJar)이 없음");
                _hadError = true;
                return;
            }

            foreach (var item in ForestMuseumState.ItemsOf(ForestMuseumState.Category.Mushroom))
            {
                ForestMuseumState.Record(ForestMuseumState.Category.Mushroom, item);
            }
            foreach (var item in ForestMuseumState.ItemsOf(ForestMuseumState.Category.Fossil))
            {
                ForestMuseumState.Record(ForestMuseumState.Category.Fossil, item);
            }
            if (GameObject.Find("Decor_MushroomCap") == null || GameObject.Find("Decor_FossilStele") == null)
            {
                Debug.LogError("[PlaytestForestHeadless] 버섯/화석 번들 시설이 안 생김");
                _hadError = true;
                return;
            }
            if (ForestMuseumState.AllBundlesDone)
            {
                Debug.LogError("[PlaytestForestHeadless] 화초 갈래를 아직 안 채웠는데 AllBundlesDone==true");
                _hadError = true;
                return;
            }

            foreach (var item in ForestMuseumState.ItemsOf(ForestMuseumState.Category.Flower))
            {
                ForestMuseumState.Record(ForestMuseumState.Category.Flower, item);
            }
            if (!ForestMuseumState.AllBundlesDone || GameObject.Find("Decor_MuseumFlagPole") == null)
            {
                Debug.LogError("[PlaytestForestHeadless] 네 번째 번들 완성 후 AllBundlesDone/깃발(Decor_MuseumFlagPole)이 없음");
                _hadError = true;
                return;
            }

            Debug.Log("[PlaytestForestHeadless] museum bundle OK - 채집 자리 발견+쿨다운, 갈래별 시설 스폰, 네 갈래 완성 시 깃발까지 확인");
        }

        /// <summary>PLAN.md 101-2 5.8① "채집 손맛" — `ForestGatherFeel`이
        /// 채집이 성사될 때마다 정확히 한 번 트리거되고, 3연속 안에
        /// 리듬 보너스가 실제로 지급되는지 값으로 확인한다(팝업·범프·
        /// 효과음 자체는 시각/청각이라 실기 확인 몫 — `CheckMuseum()`의
        /// insectSpot과 겹치지 않게 버섯 자리를 따로 쓴다, 그쪽 쿨다운
        /// 검증과 안 부딪히도록).</summary>
        private static void CheckGatherFeel()
        {
            var spots = Object.FindObjectsByType<ForestCollectSpot>(FindObjectsSortMode.None);
            var categoryField = typeof(ForestCollectSpot).GetField("category", BindingFlags.NonPublic | BindingFlags.Instance);
            ForestCollectSpot mushroomSpot = null;
            foreach (var s in spots)
            {
                if ((ForestMuseumState.Category)categoryField.GetValue(s) == ForestMuseumState.Category.Mushroom) mushroomSpot = s;
            }
            if (mushroomSpot == null)
            {
                Debug.LogError("[PlaytestForestHeadless] 버섯(Mushroom) 채집 자리를 못 찾음");
                _hadError = true;
                return;
            }

            var playerGo = GameObject.FindWithTag("Player");
            playerGo.transform.position = mushroomSpot.transform.position;

            var updateMethod = typeof(ForestCollectSpot).GetMethod("Update", BindingFlags.NonPublic | BindingFlags.Instance);
            var cooldownField = typeof(ForestCollectSpot).GetField("_cooldownLeft", BindingFlags.NonPublic | BindingFlags.Instance);

            ForestGatherFeel.ResetForTest();
            for (int i = 0; i < 3; i++)
            {
                cooldownField.SetValue(mushroomSpot, 0f); // 실기 손맛은 쿨다운 2초를 기다리지만, 여긴 리듬 보너스 값만 본다.
                updateMethod.Invoke(mushroomSpot, null);
            }

            if (ForestGatherFeel.TriggerCount != 3 || ForestGatherFeel.BonusCount != 1)
            {
                Debug.LogError($"[PlaytestForestHeadless] 채집 손맛 카운터가 이상함 — TriggerCount={ForestGatherFeel.TriggerCount}(기대 3) BonusCount={ForestGatherFeel.BonusCount}(기대 1, 3연속째)");
                _hadError = true;
                return;
            }

            Debug.Log("[PlaytestForestHeadless] gather feel OK - 채집마다 한 번씩 트리거, 3연속째 리듬 보너스 지급 확인");
        }

        /// <summary>PLAN.md 101-2 5.8② "마을 평가" — `CheckMuseum()`이 이 시점까지
        /// 네 갈래를 전부 채워 둬 박물관 점수(12개×5점=60점)가 고정값이라,
        /// 그 상태에서 별점이 정확히 2(등급 60 문턱)인지부터 확인하고, 가구를
        /// 잔뜩 채워 넣어 5(등급 200 문턱)까지 오르는지 본다(등급이 절대
        /// 안 내려가는 것도 이 트랙엔 잡초류 감소 축이 없다는 뜻 그대로).</summary>
        private static void CheckTownScore()
        {
            int museumTotal = ForestTownScore.MuseumDiscoveredTotal();
            if (museumTotal != 12 || ForestTownScore.MuseumPoints() != 60)
            {
                Debug.LogError($"[PlaytestForestHeadless] 박물관 점수가 이상함 — discovered={museumTotal}(기대 12) points={ForestTownScore.MuseumPoints()}(기대 60)");
                _hadError = true;
                return;
            }

            int starsBefore = ForestTownScore.Stars();
            if (starsBefore != 2)
            {
                Debug.LogError($"[PlaytestForestHeadless] 가구 없는 상태의 별점이 이상함 — stars={starsBefore}(기대 2, 총점 60)");
                _hadError = true;
                return;
            }

            ForestState.AddFruit(200);
            int placed = 0;
            for (int x = -ForestHomeState.GridHalfExtent; x <= ForestHomeState.GridHalfExtent; x++)
            {
                for (int y = -ForestHomeState.GridHalfExtent; y <= ForestHomeState.GridHalfExtent; y++)
                {
                    if (!ForestHomeState.TryBuy("bangseok")) continue;
                    if (ForestHomeState.TryPlaceAny(new Vector2Int(x, y)) != null) placed++;
                }
            }

            int starsAfter = ForestTownScore.Stars();
            if (placed < 5 || starsAfter != 5)
            {
                Debug.LogError($"[PlaytestForestHeadless] 가구를 채운 뒤 별점이 이상함 — placed={placed}(5 이상 기대) stars={starsAfter}(기대 5) total={ForestTownScore.Total()}");
                _hadError = true;
                return;
            }
            if (starsAfter <= starsBefore)
            {
                Debug.LogError($"[PlaytestForestHeadless] 점수가 늘었는데 별점이 그대로/줄어듦 — before={starsBefore} after={starsAfter}");
                _hadError = true;
                return;
            }

            var (homeLine, museumLine) = ForestTownScore.ConditionLines();
            if (string.IsNullOrEmpty(homeLine) || string.IsNullOrEmpty(museumLine) ||
                !homeLine.Contains(placed.ToString()) || !museumLine.Contains("12"))
            {
                Debug.LogError($"[PlaytestForestHeadless] 조건 문구가 이상함 — homeLine=\"{homeLine}\" museumLine=\"{museumLine}\"");
                _hadError = true;
                return;
            }

            var boardGo = GameObject.Find("TownScoreBoard");
            if (boardGo == null || boardGo.GetComponent<ForestTownScoreBoard>() == null)
            {
                Debug.LogError("[PlaytestForestHeadless] TownScoreBoard 오브젝트/컴포넌트를 못 찾음");
                _hadError = true;
                return;
            }

            Debug.Log($"[PlaytestForestHeadless] town score OK - 박물관 고정 60점에서 별2 확인, 가구 {placed}개 채워 별5(총점 {ForestTownScore.Total()}) 도달, 조건 문구·보드 오브젝트 확인");
        }

        /// <summary>PLAN.md 101-2 5.7 "택배 사슬"(2026-09-20 추가) — 순수 상태 API
        /// (`ForestDeliveryState`)를 직접 두드려 오배송 거절·정상 배송·사슬
        /// 보너스(3배달째)·파손(달리다 깨짐, 사슬 끊김)·시간초과(보상 절반)를
        /// 값으로 확인한 뒤(`CheckMuseum`처럼 순수 API 직접 호출), 씬에 접수대
        /// 1개·우체통 4개가 실제로 서 있는지와 목표판 "지금" 줄이 배달 중일 때
        /// 바뀌는지까지 마지막에 확인한다.</summary>
        private static void CheckDelivery()
        {
            ForestDeliveryState.ResetForTest();

            if (!ForestDeliveryState.TryPickup(ForestDeliveryState.Kind.Normal, 0) || ForestDeliveryState.TargetIndex != 0)
            {
                Debug.LogError("[PlaytestForestHeadless] 택배 접수(보통, 목적지 0)가 실패함");
                _hadError = true;
                return;
            }
            if (ForestDeliveryState.TryDeliver(1, out _, out _, out _, out _))
            {
                Debug.LogError("[PlaytestForestHeadless] 목적지가 다른 우체통인데도 배송이 성사됨");
                _hadError = true;
                return;
            }
            if (!ForestDeliveryState.Carrying)
            {
                Debug.LogError("[PlaytestForestHeadless] 오배송 거절 후 소포를 잃어버림(Carrying이 false)");
                _hadError = true;
                return;
            }
            ForestDeliveryState.TryDeliver(0, out int reward1, out bool broke1, out bool late1, out bool chainBonus1);
            if (reward1 != 4 || broke1 || late1 || chainBonus1 || ForestDeliveryState.DeliveredCount != 1)
            {
                Debug.LogError($"[PlaytestForestHeadless] 1차 배송 결과가 이상함 — reward={reward1}(기대4) broke={broke1} late={late1} chain={chainBonus1} delivered={ForestDeliveryState.DeliveredCount}(기대1)");
                _hadError = true;
                return;
            }

            ForestDeliveryState.TryPickup(ForestDeliveryState.Kind.Normal, 1);
            ForestDeliveryState.TryDeliver(1, out int reward2, out _, out _, out bool chainBonus2);
            ForestDeliveryState.TryPickup(ForestDeliveryState.Kind.Normal, 2);
            ForestDeliveryState.TryDeliver(2, out int reward3, out _, out _, out bool chainBonus3);
            if (reward2 != 4 || chainBonus2 || reward3 != 6 || !chainBonus3 || ForestDeliveryState.DeliveredCount != 3)
            {
                Debug.LogError($"[PlaytestForestHeadless] 사슬 보너스(3배달째)가 이상함 — reward2={reward2}(기대4) chain2={chainBonus2}(기대false) reward3={reward3}(기대6) chain3={chainBonus3}(기대true) delivered={ForestDeliveryState.DeliveredCount}(기대3)");
                _hadError = true;
                return;
            }

            ForestDeliveryState.TryPickup(ForestDeliveryState.Kind.Fragile, 3);
            ForestDeliveryState.NotifyRunning(true); // 달리는 중 — 파손 조건.
            ForestDeliveryState.TryDeliver(3, out int reward4, out bool broke4, out _, out _);
            if (reward4 != 0 || !broke4 || ForestDeliveryState.Chain != 0 || ForestDeliveryState.DeliveredCount != 3)
            {
                Debug.LogError($"[PlaytestForestHeadless] 파손(달리기) 처리가 이상함 — reward4={reward4}(기대0) broke4={broke4}(기대true) chain={ForestDeliveryState.Chain}(기대0) delivered={ForestDeliveryState.DeliveredCount}(기대3, 안 늘어야 함)");
                _hadError = true;
                return;
            }

            ForestDeliveryState.TryPickup(ForestDeliveryState.Kind.Timed, 0);
            var deadlineField = typeof(ForestDeliveryState).GetField("_deadline", BindingFlags.NonPublic | BindingFlags.Static);
            deadlineField.SetValue(null, Time.time - 1f); // 실제로 45초를 안 기다리고 시간초과를 강제한다.
            ForestDeliveryState.TryDeliver(0, out int reward5, out bool broke5, out bool late5, out _);
            if (reward5 != 3 || broke5 || !late5 || ForestDeliveryState.DeliveredCount != 4)
            {
                Debug.LogError($"[PlaytestForestHeadless] 시간초과(보상 절반) 처리가 이상함 — reward5={reward5}(기대3) broke5={broke5}(기대false) late5={late5}(기대true) delivered={ForestDeliveryState.DeliveredCount}(기대4)");
                _hadError = true;
                return;
            }

            if (ForestDeliveryState.Snapshot() != 4)
            {
                Debug.LogError($"[PlaytestForestHeadless] Snapshot()이 DeliveredCount와 안 맞음 — {ForestDeliveryState.Snapshot()}(기대4)");
                _hadError = true;
                return;
            }
            ForestDeliveryState.Restore(10);
            if (ForestDeliveryState.DeliveredCount != 10 || ForestDeliveryState.Carrying || ForestDeliveryState.Chain != 0)
            {
                Debug.LogError($"[PlaytestForestHeadless] Restore(10) 이후 상태가 이상함 — delivered={ForestDeliveryState.DeliveredCount}(기대10) carrying={ForestDeliveryState.Carrying}(기대false) chain={ForestDeliveryState.Chain}(기대0)");
                _hadError = true;
                return;
            }

            var counterGo = GameObject.Find("DeliveryCounter");
            var mailboxes = Object.FindObjectsByType<ForestDeliveryMailbox>(FindObjectsSortMode.None);
            if (counterGo == null || counterGo.GetComponent<ForestDeliveryCounter>() == null || mailboxes.Length != 4)
            {
                Debug.LogError($"[PlaytestForestHeadless] 접수대/우체통 오브젝트가 이상함 — counter={(counterGo == null ? "null" : "ok")} mailboxes={mailboxes.Length}(기대4)");
                _hadError = true;
                return;
            }

            var tracker = Object.FindFirstObjectByType<ForestSessionTracker>();
            ForestDeliveryState.TryPickup(ForestDeliveryState.Kind.Normal, 0);
            string goalLine = tracker != null ? tracker.GoalLineNow() : "";
            ForestDeliveryState.ResetForTest();
            if (!goalLine.StartsWith(ForestLocalization.T("goal.delivery").Split('{')[0]))
            {
                Debug.LogError($"[PlaytestForestHeadless] 소포를 든 상태에서 GoalLineNow()가 택배를 안 알려줌 — \"{goalLine}\"");
                _hadError = true;
                return;
            }

            Debug.Log("[PlaytestForestHeadless] delivery chain OK - 오배송 거절, 정상 배송, 3배달째 사슬 보너스, 파손, 시간초과, 세이브 round-trip, 씬 오브젝트, 목표판 연동까지 확인");
        }

        /// <summary>PLAN.md 101-2 5.6 "축제 하루"(2026-09-21) — 실제 달력
        /// 날짜가 며칠이든 결정적으로 확인할 수 있게
        /// <see cref="ForestFestivalState.ForceDayForTest"/>로 날짜를
        /// 고정한다(`CheckDailyTasks()`(GO)가 날짜 문자열을 직접 넘기는
        /// 것과 같은 결). 세배(1일)·꽃놀이(8일)·소원(15일) 셋 다 완료
        /// 1회·중복 거절·목표판 D-day 문구까지 값으로 확인한다.</summary>
        private static void CheckFestival()
        {
            var playerGo = GameObject.FindWithTag("Player");
            if (playerGo == null)
            {
                Debug.LogError("[PlaytestForestHeadless] 축제 검증용 player를 못 찾음");
                _hadError = true;
                return;
            }

            // ---- 세배(1일) — 숲지기에게 말 걸기 ----
            ForestFestivalState.ForceDayForTest(1);
            var villager = Object.FindFirstObjectByType<ForestVillager>();
            if (villager == null)
            {
                Debug.LogError("[PlaytestForestHeadless] ForestVillager를 못 찾음(축제 검증)");
                _hadError = true;
                return;
            }
            playerGo.transform.position = villager.transform.position;
            var villagerUpdate = typeof(ForestVillager).GetMethod("Update", BindingFlags.NonPublic | BindingFlags.Instance);
            var villagerCooldown = typeof(ForestVillager).GetField("_cooldownLeft", BindingFlags.NonPublic | BindingFlags.Instance);

            int fruitBefore = ForestState.FruitCount;
            villagerCooldown.SetValue(villager, 0f);
            villagerUpdate.Invoke(villager, null);
            int fruitAfterSebae = ForestState.FruitCount;
            if (fruitAfterSebae != fruitBefore + 5 || !ForestFestivalState.IsDoneToday())
            {
                Debug.LogError($"[PlaytestForestHeadless] 세배 보상이 이상함 — fruit {fruitBefore}->{fruitAfterSebae}(기대 +5) doneToday={ForestFestivalState.IsDoneToday()}(기대 true)");
                _hadError = true;
                return;
            }

            villagerCooldown.SetValue(villager, 0f);
            villagerUpdate.Invoke(villager, null); // 같은 날 재시도 — 보상 중복 지급 안 됨.
            if (ForestState.FruitCount != fruitAfterSebae)
            {
                Debug.LogError($"[PlaytestForestHeadless] 세배를 같은 날 두 번 받음 — fruit {fruitAfterSebae}->{ForestState.FruitCount}");
                _hadError = true;
                return;
            }

            // _doneDate는 세 행사가 공유하는 "오늘 치른 행사 있음" 플래그다
            // (실제 플레이에선 하루에 행사날이 하나뿐이라 문제가 안 되지만,
            // 이 진단은 forceDay로 하루 안에 세 날짜를 다 훑으므로 단계마다
            // 리셋해야 한다 — Restore()를 세이브 복원이 아니라 진단 리셋
            // 용도로도 쓴다, GO GatherStreak.ResetForTest()류와 같은 결).
            ForestFestivalState.Restore("", 0);

            // ---- 꽃놀이(8일) — 채집 자리 넷을 60초 안에 모두 ----
            ForestFestivalState.ForceDayForTest(8);
            ForestGatherFeel.ResetForTest(); // 리듬 보너스가 4번째(완성 시점)에 안 겹치게 스트릭을 비운다.
            var spots = Object.FindObjectsByType<ForestCollectSpot>(FindObjectsSortMode.None);
            if (spots.Length != 4)
            {
                Debug.LogError($"[PlaytestForestHeadless] ForestCollectSpot이 4개가 아님(축제 검증) — {spots.Length}");
                _hadError = true;
                return;
            }
            var spotUpdate = typeof(ForestCollectSpot).GetMethod("Update", BindingFlags.NonPublic | BindingFlags.Instance);
            var spotCooldown = typeof(ForestCollectSpot).GetField("_cooldownLeft", BindingFlags.NonPublic | BindingFlags.Instance);

            int fruitBeforeFourth = 0;
            for (int i = 0; i < spots.Length; i++)
            {
                if (i == spots.Length - 1) fruitBeforeFourth = ForestState.FruitCount;
                playerGo.transform.position = spots[i].transform.position;
                spotCooldown.SetValue(spots[i], 0f);
                spotUpdate.Invoke(spots[i], null);
            }
            int fruitAfterFlowerHunt = ForestState.FruitCount;
            if (fruitAfterFlowerHunt != fruitBeforeFourth + 8 || !ForestFestivalState.IsDoneToday())
            {
                Debug.LogError($"[PlaytestForestHeadless] 꽃놀이 완성 보상이 이상함 — 4번째 채집 전후 fruit {fruitBeforeFourth}->{fruitAfterFlowerHunt}(기대 +8) doneToday={ForestFestivalState.IsDoneToday()}(기대 true)");
                _hadError = true;
                return;
            }
            if (ForestFestivalState.ReportCollectSpotGather(ForestMuseumState.Category.Insect) != 0)
            {
                Debug.LogError("[PlaytestForestHeadless] 꽃놀이를 같은 날 두 번 완성 처리함");
                _hadError = true;
                return;
            }

            ForestFestivalState.Restore("", 0); // 위 주석과 같은 이유 — 꽃놀이 완료가 다음 단계를 막지 않게.

            // ---- 소원(15일) — 소원돌, 다음 채집 배율 ----
            ForestFestivalState.ForceDayForTest(15);
            var wishStone = Object.FindFirstObjectByType<ForestWishStone>();
            if (wishStone == null)
            {
                Debug.LogError("[PlaytestForestHeadless] ForestWishStone을 못 찾음(축제 검증)");
                _hadError = true;
                return;
            }
            if (ForestFestivalState.WishActive || ForestFestivalState.FruitMultiplier != 1f)
            {
                Debug.LogError($"[PlaytestForestHeadless] 소원을 빌기 전인데 배율이 이미 켜져 있음 — active={ForestFestivalState.WishActive} mul={ForestFestivalState.FruitMultiplier}");
                _hadError = true;
                return;
            }
            playerGo.transform.position = wishStone.transform.position;
            var wishUpdate = typeof(ForestWishStone).GetMethod("Update", BindingFlags.NonPublic | BindingFlags.Instance);
            var wishCooldown = typeof(ForestWishStone).GetField("_cooldownLeft", BindingFlags.NonPublic | BindingFlags.Instance);
            wishCooldown.SetValue(wishStone, 0f);
            wishUpdate.Invoke(wishStone, null);
            if (!ForestFestivalState.WishActive || ForestFestivalState.FruitMultiplier != 1.5f)
            {
                Debug.LogError($"[PlaytestForestHeadless] 소원 완료 후 배율이 안 켜짐 — active={ForestFestivalState.WishActive} mul={ForestFestivalState.FruitMultiplier}(기대 1.5)");
                _hadError = true;
                return;
            }
            if (ForestFestivalState.TryComplete(ForestFestivalState.Kind.Wish, out int again))
            {
                Debug.LogError($"[PlaytestForestHeadless] 소원을 같은 날 두 번 빎(again reward={again})");
                _hadError = true;
                return;
            }

            var fruitTree = Object.FindFirstObjectByType<ForestFruitTree>();
            var treeUpdate = typeof(ForestFruitTree).GetMethod("Update", BindingFlags.NonPublic | BindingFlags.Instance);
            var treeCooldown = typeof(ForestFruitTree).GetField("_cooldownLeft", BindingFlags.NonPublic | BindingFlags.Instance);
            playerGo.transform.position = fruitTree.transform.position;
            int fruitBeforeWishGather = ForestState.FruitCount;
            treeCooldown.SetValue(fruitTree, 0f);
            treeUpdate.Invoke(fruitTree, null);
            if (ForestState.FruitCount != fruitBeforeWishGather + 2)
            {
                Debug.LogError($"[PlaytestForestHeadless] 소원 배율(×1.5)이 나무 채집에 안 먹음 — fruit {fruitBeforeWishGather}->{ForestState.FruitCount}(기대 +2)");
                _hadError = true;
                return;
            }

            // ---- 목표판 D-day 문구 — 행사날이 아닌 날 ----
            ForestFestivalState.ForceDayForTest(20);
            string goalLine = ForestFestivalState.GoalLineText();
            string wantLine = string.Format(ForestLocalization.T("festival.next_line"), ForestLocalization.T("festival.name.sebae"), 12);
            if (goalLine != wantLine)
            {
                Debug.LogError($"[PlaytestForestHeadless] 축제 D-day 문구가 이상함 — \"{goalLine}\"(기대 \"{wantLine}\")");
                _hadError = true;
                return;
            }

            ForestFestivalState.ForceDayForTest(null);
            Debug.Log("[PlaytestForestHeadless] festival OK - 세배·꽃놀이·소원 완료 1회·같은 날 중복 거절·소원 배율·목표판 D-day 문구까지 확인");
        }

        /// <summary>2026-09-23 "모바일 버튼 먹통" 회귀 — 씬의 버튼 전부에 리스너가 있는지 +
        /// 설정 버튼을 진짜 onClick으로 열고 닫아 본다(ButtonWiringCheck.cs 주석 참고).</summary>
        private static void CheckButtonWiring()
        {
            const string Tag = "PlaytestForestHeadless";
            bool ok = ButtonWiringCheck.CheckNoDeadButtons(Tag);
            var settings = Object.FindFirstObjectByType<ForestSettingsPanel>();
            var root = settings != null ? settings.transform : null;
            var panel = settings != null
                ? typeof(ForestSettingsPanel).GetField("_panel", BindingFlags.NonPublic | BindingFlags.Instance).GetValue(settings) as GameObject
                : null;
            ok &= ButtonWiringCheck.PressOpensAndCloses(Tag, "설정 버튼",
                ButtonWiringCheck.FindByLabel(root, ForestLocalization.T("settings.title")),
                ButtonWiringCheck.FindByLabel(root, ForestLocalization.T("settings.close")), panel);
            if (!ok) _hadError = true;
        }

    }
}
