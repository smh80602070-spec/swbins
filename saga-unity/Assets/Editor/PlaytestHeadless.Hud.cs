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
    // R-4(2026-10-09) — PlaytestHeadless.cs 1500줄 상한이라 화면·HUD 점검 다섯(디버그 HUD·설정 창·HUD/행동 단추 번역·목표판·정리 카드)을 떼어 냄(같은 partial 클래스, 부르는 쪽 그대로).
    public static partial class PlaytestHeadless
    {
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
    }
}
