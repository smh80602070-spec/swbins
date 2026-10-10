using TMPro;
using System.Collections.Generic;
using System.Reflection;
using Unity.Cinemachine;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.UI;
using Saga.Core;
using Saga.Dungeon.Cinematics;
using Saga.Dungeon.Data;
using Saga.Dungeon.Player;
using Saga.Dungeon.UI;
using Saga.Dungeon.World;

namespace Saga.EditorTools
{
    /// <summary>`PlaytestDungeonHeadless` 의 일부(partial) — tasks U-0010 분할.</summary>
    public static partial class PlaytestDungeonHeadless
    {
        /// <summary>PLAN.md 44~49장 디버그 화면(2026-09-14, GO와 같은 결) —
        /// 레벨/층/적 수/사명/좌표 줄이 실제로 채워지는지 본다.</summary>
        private static void CheckDebugHud()
        {
            var hudGo = GameObject.Find("DebugUI");
            var hud = hudGo != null ? hudGo.GetComponent<DebugHud>() : null;
            var labelGo = hudGo != null ? hudGo.transform.Find("Label") : null;
            var label = labelGo != null ? labelGo.GetComponent<TextMeshProUGUI>() : null;
            if (hud == null || label == null)
            {
                Debug.LogError("[PlaytestDungeonHeadless] DebugUI/Label을 못 찾음");
                _hadError = true;
                return;
            }

            var method = typeof(DebugHud).GetMethod("Refresh", BindingFlags.NonPublic | BindingFlags.Instance);
            method.Invoke(hud, null);

            if (!label.text.Contains("lv ") || !label.text.Contains("floor ") || !label.text.Contains("quest:") || !label.text.Contains("pos:"))
            {
                Debug.LogError($"[PlaytestDungeonHeadless] 디버그 오버레이 내용 이상 text=\"{label.text}\"");
                _hadError = true;
            }
            else
            {
                Debug.Log($"[PlaytestDungeonHeadless] debug hud OK - \"{label.text.Replace("\n", " | ")}\"");
            }
        }

        /// <summary>PLAN.md 104-1 ②(2026-09-16) — GO
        /// `PlaytestHeadless.CheckSettingsPanel()`과 같은 결로 존재 확인만
        /// 하던 걸 TogglePanel()·ChooseSfx() 실제 호출 + 라벨 텍스트
        /// 확인으로 바꿨다(RealmCommandUi 사례 재발 방지 — 그쪽 클래스
        /// 주석 참고).</summary>
        private static void CheckSettingsPanel()
        {
            var panel = Object.FindFirstObjectByType<DungeonSettingsPanel>();
            if (panel == null)
            {
                Debug.LogError("[PlaytestDungeonHeadless] DungeonSettingsPanel 컴포넌트를 못 찾음");
                _hadError = true;
                return;
            }

            var panelGoField = typeof(DungeonSettingsPanel).GetField("_panel", BindingFlags.NonPublic | BindingFlags.Instance);
            var panelGo = panelGoField.GetValue(panel) as GameObject;
            if (panelGo == null)
            {
                Debug.LogError("[PlaytestDungeonHeadless] DungeonSettingsPanel._panel이 null — 씬 재로드 후 참조가 안 살아남음");
                _hadError = true;
                return;
            }

            var toggleMethod = typeof(DungeonSettingsPanel).GetMethod("TogglePanel", BindingFlags.NonPublic | BindingFlags.Instance);
            toggleMethod.Invoke(panel, null); // 열기 — 여기서 NRE가 나면 그대로 테스트 실패로 드러난다.
            if (!panelGo.activeSelf)
            {
                Debug.LogError("[PlaytestDungeonHeadless] TogglePanel() 호출 후에도 설정 패널이 안 열림");
                _hadError = true;
                return;
            }
            toggleMethod.Invoke(panel, null); // 닫기
            if (panelGo.activeSelf)
            {
                Debug.LogError("[PlaytestDungeonHeadless] TogglePanel() 두 번째 호출 후에도 설정 패널이 안 닫힘");
                _hadError = true;
                return;
            }

            var sfxValueLabelField = typeof(DungeonSettingsPanel).GetField("_sfxValueLabel", BindingFlags.NonPublic | BindingFlags.Instance);
            var sfxValueLabel = sfxValueLabelField.GetValue(panel) as TextMeshProUGUI;
            if (sfxValueLabel == null)
            {
                Debug.LogError("[PlaytestDungeonHeadless] DungeonSettingsPanel._sfxValueLabel이 null");
                _hadError = true;
                return;
            }

            bool sfxBefore = DungeonSettingsState.SfxOn;
            var chooseSfxMethod = typeof(DungeonSettingsPanel).GetMethod("ChooseSfx", BindingFlags.NonPublic | BindingFlags.Instance);
            chooseSfxMethod.Invoke(panel, null); // 실제 버튼 핸들러 — 상태를 뒤집고 Refresh()까지 그대로 탄다.
            string expectedText = DungeonLocalization.T(DungeonSettingsState.SfxOn ? "state.on" : "state.off");
            if (DungeonSettingsState.SfxOn == sfxBefore || sfxValueLabel.text != expectedText)
            {
                Debug.LogError($"[PlaytestDungeonHeadless] ChooseSfx() 이후 라벨이 실제로 안 바뀜 text=\"{sfxValueLabel.text}\"(기대=\"{expectedText}\")");
                _hadError = true;
                return;
            }
            chooseSfxMethod.Invoke(panel, null); // 원상복귀

            bool vibBefore = DungeonSettingsState.VibrationOn;
            DungeonSettingsState.VibrationOn = !vibBefore;
            if (DungeonSettingsState.VibrationOn == vibBefore)
            {
                Debug.LogError("[PlaytestDungeonHeadless] 진동 토글이 안 바뀜");
                _hadError = true;
                return;
            }

            DungeonSettingsState.UiScaleMultiplier = 1.15f;
            var scaler = Saga.Core.SagaUi.FirstGameScaler(); // Ⅱ 단추 등 메뉴 캔버스는 뺀다(110 ⑤c)
            float expected = Saga.Core.SagaUi.GameReference.x / 1.15f; // 110 ⑤b 기준 1600×900
            if (scaler == null || Mathf.Abs(scaler.referenceResolution.x - expected) > 1f)
            {
                Debug.LogError($"[PlaytestDungeonHeadless] UI 크기가 캔버스에 안 먹음 — got={(scaler == null ? "null" : scaler.referenceResolution.x.ToString())}");
                _hadError = true;
                return;
            }
            DungeonSettingsState.UiScaleMultiplier = 1f;

            DungeonSettingsState.HighGraphicsQuality = false;
            if (!Mathf.Approximately(QualitySettings.shadowDistance, 15f) || QualitySettings.antiAliasing != 0)
            {
                Debug.LogError($"[PlaytestDungeonHeadless] 그래픽 품질(절약)이 QualitySettings에 안 먹음 — shadowDistance={QualitySettings.shadowDistance} aa={QualitySettings.antiAliasing}");
                _hadError = true;
                return;
            }
            DungeonSettingsState.HighGraphicsQuality = true;

            string langBefore = DungeonLocalization.CurrentLanguage;
            string qualityLabelBefore = DungeonSettingsState.GraphicsQualityLabel();
            DungeonLocalization.CycleLanguage();
            if (DungeonLocalization.CurrentLanguage == langBefore
                || DungeonSettingsState.GraphicsQualityLabel() == qualityLabelBefore)
            {
                Debug.LogError("[PlaytestDungeonHeadless] 언어 전환이 실제 문구를 안 바꿈");
                _hadError = true;
                return;
            }
            DungeonLocalization.CurrentLanguage = langBefore;

            Debug.Log("[PlaytestDungeonHeadless] settings panel OK - sfx/vibration/ui-scale/graphics-quality/language all verified");
        }

        /// <summary>PLAN.md 67~69장 "Localization" 2차(2026-09-14) — PlayerHud의
        /// 체력/경험치/돈/공격력/층 표시가 실제로 영어 문구를 보여주는지 본다.</summary>
        private static void CheckPlayerHudLocalization()
        {
            var hudGo = GameObject.Find("PlayerHudUI");
            var hud = hudGo != null ? hudGo.GetComponent<PlayerHud>() : null;
            var label = hudGo != null ? hudGo.GetComponentInChildren<TextMeshProUGUI>() : null;
            if (hud == null || label == null)
            {
                Debug.LogError("[PlaytestDungeonHeadless] PlayerHudUI/Label을 못 찾음");
                _hadError = true;
                return;
            }

            string langBefore = DungeonLocalization.CurrentLanguage;
            var method = typeof(PlayerHud).GetMethod("Refresh", BindingFlags.NonPublic | BindingFlags.Instance);

            DungeonLocalization.CurrentLanguage = "en";
            method.Invoke(hud, null);
            if (!label.text.Contains("HP") || !label.text.Contains("EXP") || !label.text.Contains("ATK"))
            {
                Debug.LogError($"[PlaytestDungeonHeadless] PlayerHud 영어 전환이 안 먹음 text=\"{label.text}\"");
                _hadError = true;
                DungeonLocalization.CurrentLanguage = langBefore;
                return;
            }
            DungeonLocalization.CurrentLanguage = langBefore;
            method.Invoke(hud, null);

            Debug.Log("[PlaytestDungeonHeadless] player hud localization OK");
        }

        /// <summary>2026-09-15 "모바일 액션 버튼 언어 전환 반응" —
        /// `LocalizedButtonLabel`(폴링, Update()는 private이라 리플렉션)이
        /// 씬 빌드 시점 이후에도 언어를 따라가는지 본다.</summary>
        private static void CheckActionButtonLocalization()
        {
            var go = GameObject.Find("AttackButton");
            var localized = go != null ? go.GetComponent<LocalizedButtonLabel>() : null;
            var label = go != null ? go.GetComponentInChildren<TextMeshProUGUI>() : null;
            if (localized == null || label == null)
            {
                Debug.LogError("[PlaytestDungeonHeadless] AttackButton/LocalizedButtonLabel을 못 찾음");
                _hadError = true;
                return;
            }

            string langBefore = DungeonLocalization.CurrentLanguage;
            var method = typeof(LocalizedButtonLabel).GetMethod("Update", BindingFlags.NonPublic | BindingFlags.Instance);

            DungeonLocalization.CurrentLanguage = "en";
            method.Invoke(localized, null);
            if (label.text != "Attack")
            {
                Debug.LogError($"[PlaytestDungeonHeadless] 액션 버튼 영어 전환이 안 먹음 text=\"{label.text}\"(기대=Attack)");
                _hadError = true;
                DungeonLocalization.CurrentLanguage = langBefore;
                return;
            }
            DungeonLocalization.CurrentLanguage = langBefore;
            method.Invoke(localized, null);
            if (label.text != (langBefore == "en" ? "Attack" : "공격"))
            {
                Debug.LogError($"[PlaytestDungeonHeadless] 액션 버튼이 원래 언어로 안 돌아옴 text=\"{label.text}\"(기대=공격)");
                _hadError = true;
            }

            Debug.Log("[PlaytestDungeonHeadless] action button localization OK");
        }

        /// <summary>PLAN.md 101-2 "공통 선행" A·B(DUNGEON 두 번째 이식) —
        /// `PlaytestHeadless.CheckGoalBoardAndSessionCard()`(GO)와 완전히
        /// 같은 기준 — GoalBoard 세 줄이 실제로 채워지는지, Awake()의
        /// IGoalSource 자동 재탐색이 동작하는지, SessionCard 가 뜨고
        /// 스스로 닫히는지를 직접 확인한다 — 존재 확인만으로 끝내지 않는다.</summary>
        private static void CheckGoalBoardAndSessionCard()
        {
            var board = Object.FindFirstObjectByType<GoalBoard>();
            if (board == null)
            {
                Debug.LogError("[PlaytestDungeonHeadless] GoalBoard 컴포넌트를 못 찾음");
                _hadError = true;
                return;
            }

            var sourceField = typeof(GoalBoard).GetField("_source", BindingFlags.NonPublic | BindingFlags.Instance);
            if (sourceField.GetValue(board) == null)
            {
                Debug.LogError("[PlaytestDungeonHeadless] GoalBoard._source가 null — Awake() 자동 재탐색 실패");
                _hadError = true;
                return;
            }

            var labelField = typeof(GoalBoard).GetField("_label", BindingFlags.NonPublic | BindingFlags.Instance);
            var label = labelField.GetValue(board) as TextMeshProUGUI;
            if (label == null || !label.text.Contains(Saga.Core.SagaUi.L("지금", "Now") + " —") || !label.text.Contains(Saga.Core.SagaUi.L("이번 세션", "This session") + " —") || !label.text.Contains(Saga.Core.SagaUi.L("이번 주", "This week") + " —"))
            {
                Debug.LogError($"[PlaytestDungeonHeadless] GoalBoard 세 줄이 안 채워짐 text=\"{(label == null ? "null" : label.text.Replace("\n", " | "))}\"");
                _hadError = true;
                return;
            }

            var card = Object.FindFirstObjectByType<SessionCard>();
            if (card == null)
            {
                Debug.LogError("[PlaytestDungeonHeadless] SessionCard 컴포넌트를 못 찾음");
                _hadError = true;
                return;
            }
            if (card.IsShowing)
            {
                Debug.LogError("[PlaytestDungeonHeadless] SessionCard가 세션 시작부터 떠 있음(기본은 숨김)");
                _hadError = true;
                return;
            }

            card.Show("테스트", "줄1", "줄2");
            if (!card.IsShowing)
            {
                Debug.LogError("[PlaytestDungeonHeadless] SessionCard.Show() 호출 후에도 안 뜸");
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
                Debug.LogError("[PlaytestDungeonHeadless] SessionCard가 만료 후에도 자동으로 안 닫힘");
                _hadError = true;
                return;
            }

            if (Object.FindFirstObjectByType<DungeonSessionTracker>() == null)
            {
                Debug.LogError("[PlaytestDungeonHeadless] DungeonSessionTracker 컴포넌트를 못 찾음");
                _hadError = true;
                return;
            }

            Debug.Log("[PlaytestDungeonHeadless] goal board / session card OK - 3 lines filled, source auto-found, card shows and auto-closes");
        }

        /// <summary>tasks U-0082 — 주인공 밑 횃불 점광 하나(그림자 없음)·방 앰비언트·2나락 LUT 세기.</summary>
        private static void CheckHeroTorch()
        {
            var pc = Object.FindFirstObjectByType<PlayerController>();
            int n = 0; Light t = null;
            if (pc != null) foreach (var l in pc.GetComponentsInChildren<Light>(true)) if (l.name == HeroTorch.ObjectName) { n++; t = l; }
            if (n != 1 || t.type != LightType.Point || t.shadows != LightShadows.None
                || !Mathf.Approximately(t.range, HeroTorch.HeroTorchRange) || !Mathf.Approximately(t.intensity, HeroTorch.HeroTorchIntensity))
            {
                Debug.LogError($"[PlaytestDungeonHeadless] 주인공 횃불 {n}개·{t?.type}·그림자 {t?.shadows}·{t?.range}m·{t?.intensity}(점광 하나·그림자 없음·{HeroTorch.HeroTorchRange}m·{HeroTorch.HeroTorchIntensity}이어야)");
                _hadError = true;
                return;
            }
            if (RenderSettings.ambientMode != UnityEngine.Rendering.AmbientMode.Flat || RenderSettings.ambientLight != HeroTorch.RoomAmbient)
            {
                Debug.LogError($"[PlaytestDungeonHeadless] 방 앰비언트 {RenderSettings.ambientMode} {RenderSettings.ambientLight} ≠ {HeroTorch.RoomAmbient}");
                _hadError = true;
                return;
            }
            var tone = AssetDatabase.LoadAssetAtPath<UnityEngine.Rendering.VolumeProfile>(BuildGameToneLuts.DungeonProfilePath);
            if (tone == null || !tone.TryGet<UnityEngine.Rendering.Universal.ColorLookup>(out var lut) || !Mathf.Approximately(lut.contribution.value, BuildGameToneLuts.DungeonContribution))
            {
                Debug.LogError($"[PlaytestDungeonHeadless] 2나락 LUT 세기가 {BuildGameToneLuts.DungeonContribution} 이 아님");
                _hadError = true;
                return;
            }
            Debug.Log($"[PlaytestDungeonHeadless] hero torch OK - 점광 1·{t.range}m·{t.intensity}·그림자 없음 · 앰비언트 {RenderSettings.ambientLight} · LUT 세기 {lut.contribution.value}");
        }
    }
}
