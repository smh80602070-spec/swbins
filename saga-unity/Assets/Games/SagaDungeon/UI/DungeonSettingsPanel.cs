using TMPro;
using UnityEngine;
using UnityEngine.UI;
using Saga.Dungeon.Data;

namespace Saga.Dungeon.UI
{
    /// <summary>
    /// PLAN.md 67~69장 "접근성" — 효과음·진동·UI 크기·그래픽 품질·언어.
    /// `Saga.Realm.UI.RealmCommandUi.cs`와 같은 결로 자기 UI를 스스로
    /// 짓는다 — DUNGEON엔 GO/FOREST의 `EncounterUiKit` 같은 공용 부품이
    /// 없어(이 컴포넌트 하나만 쓸 것이라 새로 안 뽑는다, 이 저장소
    /// "N=1이면 안 뽑는다" 원칙 — `StoryChoiceUi.cs`와 같은 판단) 캔버스/
    /// 패널/텍스트/버튼 조립을 이 파일 안에 그대로 둔다.
    ///
    /// 화면 오른쪽 위 — "저장" 버튼(-30,-30,160×80) 바로 아래를 미니맵
    /// (-30,-130,140×220)이 이미 차지하고 있어(`BuildTestDungeonScene.cs`),
    /// 그 아래(-30,-370)에 20px 틈을 두고 둔다.
    ///
    /// 2026-09-14 "Localization" — 다섯째 줄로 언어(ko/en)를 추가하며 패널
    /// 자신의 글자를 전부 `DungeonLocalization.T()`로 바꿨다(GO와 같은 결).
    /// </summary>
    public class DungeonSettingsPanel : MonoBehaviour
    {
        // PLAN.md 104-1 ③ — Build()를 부르는 게 에디터 스크립트뿐이라(런타임 재호출 없음)
        // 씬 저장→재로드 후에도 참조가 남으려면 [SerializeField]가 필수(REALM/LocalizedButtonLabel과 같은 함정).
        [SerializeField] private GameObject _panel;
        [SerializeField] private TextMeshProUGUI _toggleLabel;
        [SerializeField] private TextMeshProUGUI _titleLabel;
        [SerializeField] private TextMeshProUGUI _closeLabel;
        [SerializeField] private TextMeshProUGUI _sfxNameLabel;
        [SerializeField] private TextMeshProUGUI _sfxValueLabel;
        [SerializeField] private TextMeshProUGUI _vibrationNameLabel;
        [SerializeField] private TextMeshProUGUI _vibrationValueLabel;
        [SerializeField] private TextMeshProUGUI _uiScaleNameLabel;
        [SerializeField] private TextMeshProUGUI _uiScaleValueLabel;
        [SerializeField] private TextMeshProUGUI _qualityNameLabel;
        [SerializeField] private TextMeshProUGUI _qualityValueLabel;
        [SerializeField] private TextMeshProUGUI _languageNameLabel;
        [SerializeField] private TextMeshProUGUI _languageValueLabel;
        [SerializeField] private TextMeshProUGUI _bgmNameLabel;
        [SerializeField] private TextMeshProUGUI _bgmValueLabel;
        // U-0075 — 대사 음성 켬/끔(SagaVoice.Enabled, 다섯 판 공용 PlayerPrefs). 씬에 구운 창엔 없어 실행 때만 만든다(회귀 줄과 같은 꼴).
        private TextMeshProUGUI _voiceNameLabel, _voiceValueLabel;

        public void Build()
        {
            var canvas = NewCanvas("DungeonSettingsUI");
            canvas.transform.SetParent(transform, false);

            var toggleButton = NewButton(canvas.transform, DungeonLocalization.T("settings.title"),
                new Vector2(1f, 1f), new Vector2(-210f, -30f), new Vector2(160f, 80f), TogglePanel); // 110 ⑤b — 윗줄 저장 왼쪽
            _toggleLabel = toggleButton.GetComponentInChildren<TextMeshProUGUI>();

            _panel = NewPanel(canvas.transform, new Vector2(0.5f, 0.5f), new Vector2(680f, 820f),
                new Color(0f, 0f, 0f, 0.8f));
            _panel.SetActive(false);

            _titleLabel = NewText(_panel.transform, DungeonLocalization.T("settings.title"),
                new Vector2(0.5f, 1f), new Vector2(0f, -60f), new Vector2(500f, 60f), 32);

            (_sfxNameLabel, _sfxValueLabel) = MakeRow(-140f, "settings.sfx", ChooseSfx);
            (_vibrationNameLabel, _vibrationValueLabel) = MakeRow(-235f, "settings.vibration", ChooseVibration);
            (_uiScaleNameLabel, _uiScaleValueLabel) = MakeRow(-330f, "settings.ui_scale", ChooseUiScale);
            (_qualityNameLabel, _qualityValueLabel) = MakeRow(-425f, "settings.graphics_quality", ChooseGraphicsQuality);
            (_languageNameLabel, _languageValueLabel) = MakeRow(-520f, "settings.language", ChooseLanguage);
            (_bgmNameLabel, _bgmValueLabel) = MakeRow(-615f, "settings.bgm", ChooseBgm);

            var closeButton = NewButton(_panel.transform, DungeonLocalization.T("settings.close"),
                new Vector2(0.5f, 0f), new Vector2(0f, 40f), new Vector2(300f, 70f), ClosePanel);
            _closeLabel = closeButton.GetComponentInChildren<TextMeshProUGUI>();

            Refresh();
        }

        private (TextMeshProUGUI name, TextMeshProUGUI value) MakeRow(float y, string nameKey, UnityEngine.Events.UnityAction onClick)
        {
            var name = NewText(_panel.transform, DungeonLocalization.T(nameKey), new Vector2(0f, 1f),
                new Vector2(60f, y), new Vector2(260f, 70f), 26);
            name.alignment = TextAlignmentOptions.Left;
            var button = NewButton(_panel.transform, "", new Vector2(1f, 1f), new Vector2(-60f, y),
                new Vector2(260f, 70f), onClick);
            return (name, button.GetComponentInChildren<TextMeshProUGUI>());
        }

        private void ChooseSfx() { DungeonSettingsState.SfxOn = !DungeonSettingsState.SfxOn; Refresh(); }
        private void ChooseVibration() { DungeonSettingsState.VibrationOn = !DungeonSettingsState.VibrationOn; Refresh(); }
        private void ChooseUiScale() { DungeonSettingsState.CycleUiScale(); Refresh(); }
        private void ChooseGraphicsQuality() { DungeonSettingsState.CycleGraphicsQuality(); Refresh(); }
        private void ChooseLanguage() { DungeonLocalization.CycleLanguage(); DungeonLocalization.RelocalizeScene(); Refresh(); }

        /// <summary>110 ⑤c-2c — 씬에 구운 글(빌더 = 한국어)을 지금 언어로, 이 창의 글도 한 번 새로(예전엔 값을 바꿀 때만).</summary>
        private void Start() { EnsureVoiceRow(); DungeonLocalization.RelocalizeScene(); Refresh(); }
        private void ChooseBgm() { DungeonSettingsState.BgmOn = !DungeonSettingsState.BgmOn; Refresh(); }

        /// <summary>U-0075 — 음성 줄을 붙이고 줄 전체를 82 간격으로 다시 놓는다(예전 95 간격 여섯 줄 판엔 일곱째 자리가 없었다 —
        /// 첫 줄 −130, 일곱째 −622, 닫기 위 끝보다 위). 단추는 실행 때 만들어 리스너를 바로 건다.</summary>
        private void EnsureVoiceRow()
        {
            if (!Application.isPlaying || _panel == null || _voiceValueLabel != null) return;
            _voiceNameLabel = NewText(_panel.transform, DungeonLocalization.T("settings.voice", "음성"), new Vector2(0f, 1f),
                new Vector2(60f, -130f), new Vector2(260f, 70f), 26);
            _voiceNameLabel.alignment = TextAlignmentOptions.Left;
            var button = NewButton(_panel.transform, "", new Vector2(1f, 1f), new Vector2(-60f, -130f), new Vector2(260f, 70f), null);
            _voiceValueLabel = button.GetComponentInChildren<TextMeshProUGUI>();
            button.onClick.AddListener(ChooseVoice);
            var rows = new[] { (_sfxNameLabel, _sfxValueLabel), (_vibrationNameLabel, _vibrationValueLabel), (_uiScaleNameLabel, _uiScaleValueLabel), (_qualityNameLabel, _qualityValueLabel), (_languageNameLabel, _languageValueLabel), (_bgmNameLabel, _bgmValueLabel), (_voiceNameLabel, _voiceValueLabel) };
            for (int i = 0; i < rows.Length; i++)
            {
                if (rows[i].Item1 == null || rows[i].Item2 == null) continue;
                float y = -130f - 82f * i;
                var n = rows[i].Item1.rectTransform; n.anchoredPosition = new Vector2(n.anchoredPosition.x, y);
                if (rows[i].Item2.transform.parent is RectTransform v) v.anchoredPosition = new Vector2(v.anchoredPosition.x, y);
            }
        }

        private void ChooseVoice() { Saga.Core.SagaVoice.Enabled = !Saga.Core.SagaVoice.Enabled; Refresh(); }

        private void TogglePanel() => _panel.SetActive(!_panel.activeSelf);
        // 영속 리스너는 람다를 못 건다(SagaCore/ButtonWiring.cs) — 이름 있는 메서드로.
        private void ClosePanel() => _panel.SetActive(false);

        private void Refresh()
        {
            if (_sfxValueLabel == null) return;

            _toggleLabel.text = DungeonLocalization.T("settings.title");
            _titleLabel.text = DungeonLocalization.T("settings.title");
            _closeLabel.text = DungeonLocalization.T("settings.close");
            _sfxNameLabel.text = DungeonLocalization.T("settings.sfx");
            _vibrationNameLabel.text = DungeonLocalization.T("settings.vibration");
            _uiScaleNameLabel.text = DungeonLocalization.T("settings.ui_scale");
            _qualityNameLabel.text = DungeonLocalization.T("settings.graphics_quality");
            _languageNameLabel.text = DungeonLocalization.T("settings.language");
            _bgmNameLabel.text = DungeonLocalization.T("settings.bgm");

            _sfxValueLabel.text = DungeonLocalization.T(DungeonSettingsState.SfxOn ? "state.on" : "state.off");
            _vibrationValueLabel.text = DungeonLocalization.T(DungeonSettingsState.VibrationOn ? "state.on" : "state.off");
            _uiScaleValueLabel.text = DungeonSettingsState.UiScaleLabel();
            _qualityValueLabel.text = DungeonSettingsState.GraphicsQualityLabel();
            _languageValueLabel.text = DungeonLocalization.LanguageLabel();
            _bgmValueLabel.text = DungeonLocalization.T(DungeonSettingsState.BgmOn ? "state.on" : "state.off");
            if (_voiceValueLabel != null)
            {
                _voiceNameLabel.text = DungeonLocalization.T("settings.voice", "음성");
                _voiceValueLabel.text = DungeonLocalization.T(Saga.Core.SagaVoice.Enabled ? "state.on" : "state.off");
            }
        }

        // GO `UI/EncounterUiKit.cs`와 같은 넷(캔버스/패널/텍스트/버튼) —
        // 이 컴포넌트 하나만 써서 kit로 안 뽑고 그대로 둔다(클래스 주석 참고).
        private static Canvas NewCanvas(string name)
        {
            var go = new GameObject(name);
            var canvas = go.AddComponent<Canvas>();
            canvas.renderMode = RenderMode.ScreenSpaceOverlay;
            var scaler = go.AddComponent<CanvasScaler>();
            scaler.uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize;
            Saga.Core.SagaUi.ApplyGameScaler(scaler);
            DungeonSettingsState.ApplyUiScale(scaler);
            go.AddComponent<GraphicRaycaster>();
            return canvas;
        }

        private static GameObject NewPanel(Transform parent, Vector2 anchor, Vector2 size, Color color)
        {
            var go = new GameObject("Panel", typeof(RectTransform));
            go.transform.SetParent(parent, false);
            var rect = (RectTransform)go.transform;
            rect.anchorMin = anchor;
            rect.anchorMax = anchor;
            rect.pivot = anchor;
            rect.sizeDelta = size;
            rect.anchoredPosition = Vector2.zero;
            var img = go.AddComponent<Image>();
            img.color = color;
            return go;
        }

        private static TextMeshProUGUI NewText(Transform parent, string content, Vector2 anchor, Vector2 pos, Vector2 size, int fontSize)
        {
            var go = new GameObject("Text", typeof(RectTransform));
            go.transform.SetParent(parent, false);
            var rect = (RectTransform)go.transform;
            rect.anchorMin = anchor;
            rect.anchorMax = anchor;
            rect.pivot = anchor;
            rect.anchoredPosition = pos;
            rect.sizeDelta = size;

            var text = go.AddComponent<TextMeshProUGUI>();
            text.fontSize = fontSize;
            text.alignment = TextAlignmentOptions.Center;
            text.color = Color.white;
            text.textWrappingMode = TextWrappingModes.Normal;
            text.text = content;
            return text;
        }

        private static Button NewButton(Transform parent, string label, Vector2 anchor, Vector2 pos, Vector2 size, UnityEngine.Events.UnityAction onClick)
        {
            var go = new GameObject($"Btn_{label}", typeof(RectTransform));
            go.transform.SetParent(parent, false);
            var rect = (RectTransform)go.transform;
            rect.anchorMin = anchor;
            rect.anchorMax = anchor;
            rect.pivot = anchor;
            rect.anchoredPosition = pos;
            rect.sizeDelta = size;

            var img = go.AddComponent<Image>();
            img.color = new Color(1f, 1f, 1f, 0.18f);
            var button = go.AddComponent<Button>();
            button.targetGraphic = img;
            // 에디터 빌드면 영속 리스너, Play 중이면 런타임 리스너 — SagaCore/ButtonWiring.cs(2026-09-23 먹통 버그).
            Saga.Core.ButtonWiring.Wire(button, onClick);

            NewText(go.transform, label, new Vector2(0.5f, 0.5f), Vector2.zero, size, 26);

            return button;
        }
    }
}
