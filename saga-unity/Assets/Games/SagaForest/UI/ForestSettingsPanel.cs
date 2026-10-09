using TMPro;
using UnityEngine;
using UnityEngine.UI;
using Saga.Forest.Data;

namespace Saga.Forest.UI
{
    /// <summary>
    /// `Saga.Go.UI.GoSettingsPanel.cs`와 같은 결(다섯 판이 각자 복사해
    /// 쓰는 관례) — 효과음·진동·UI 크기·그래픽 품질·언어. 화면 오른쪽 위,
    /// "저장" 버튼(-30,-30,160×80) 바로 아래(-30,-130)에 자리를 잡는다 —
    /// GO와 똑같이 그 자리가 이 판에서도 유일하게 빈 오른쪽 위 자리다
    /// (`BuildTestVillageForestScene.cs`의 Save/DebugUI 위치 참고).
    ///
    /// 2026-09-14 "Localization" — 다섯째 줄로 언어(ko/en)를 추가하며 패널
    /// 자신의 글자를 전부 `ForestLocalization.T()`로 바꿨다(GO와 같은 결).
    /// </summary>
    public class ForestSettingsPanel : MonoBehaviour
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
            var canvas = EncounterUiKit.NewCanvas("ForestSettingsUI");
            canvas.transform.SetParent(transform, false);

            var toggleButton = EncounterUiKit.NewButton(canvas.transform, ForestLocalization.T("settings.title"),
                new Vector2(1f, 1f), new Vector2(-30f, -130f), new Vector2(160f, 80f), TogglePanel);
            _toggleLabel = toggleButton.GetComponentInChildren<TextMeshProUGUI>();

            _panel = EncounterUiKit.NewPanel(canvas.transform, new Vector2(0.5f, 0.5f), new Vector2(680f, 820f),
                new Color(0f, 0f, 0f, 0.8f));
            _panel.SetActive(false);

            _titleLabel = EncounterUiKit.NewText(_panel.transform, ForestLocalization.T("settings.title"),
                new Vector2(0.5f, 1f), new Vector2(0f, -60f), new Vector2(500f, 60f), 32);

            (_sfxNameLabel, _sfxValueLabel) = MakeRow(-140f, "settings.sfx", ChooseSfx);
            (_vibrationNameLabel, _vibrationValueLabel) = MakeRow(-235f, "settings.vibration", ChooseVibration);
            (_uiScaleNameLabel, _uiScaleValueLabel) = MakeRow(-330f, "settings.ui_scale", ChooseUiScale);
            (_qualityNameLabel, _qualityValueLabel) = MakeRow(-425f, "settings.graphics_quality", ChooseGraphicsQuality);
            (_languageNameLabel, _languageValueLabel) = MakeRow(-520f, "settings.language", ChooseLanguage);
            (_bgmNameLabel, _bgmValueLabel) = MakeRow(-615f, "settings.bgm", ChooseBgm);

            var closeButton = EncounterUiKit.NewButton(_panel.transform, ForestLocalization.T("settings.close"),
                new Vector2(0.5f, 0f), new Vector2(0f, 40f), new Vector2(300f, 70f), ClosePanel);
            _closeLabel = closeButton.GetComponentInChildren<TextMeshProUGUI>();

            Refresh();
        }

        private (TextMeshProUGUI name, TextMeshProUGUI value) MakeRow(float y, string nameKey, UnityEngine.Events.UnityAction onClick)
        {
            var name = EncounterUiKit.NewText(_panel.transform, ForestLocalization.T(nameKey), new Vector2(0f, 1f),
                new Vector2(60f, y), new Vector2(260f, 70f), 26);
            name.alignment = TextAlignmentOptions.Left;
            var button = EncounterUiKit.NewButton(_panel.transform, "", new Vector2(1f, 1f), new Vector2(-60f, y),
                new Vector2(260f, 70f), onClick);
            return (name, button.GetComponentInChildren<TextMeshProUGUI>());
        }

        private void ChooseSfx() { ForestSettingsState.SfxOn = !ForestSettingsState.SfxOn; Refresh(); }
        private void ChooseVibration() { ForestSettingsState.VibrationOn = !ForestSettingsState.VibrationOn; Refresh(); }
        private void ChooseUiScale() { ForestSettingsState.CycleUiScale(); Refresh(); }
        private void ChooseGraphicsQuality() { ForestSettingsState.CycleGraphicsQuality(); Refresh(); }
        private void ChooseLanguage() { ForestLocalization.CycleLanguage(); ForestLocalization.RelocalizeScene(); Refresh(); }

        /// <summary>110 ⑤c-2c — 씬에 구운 글(빌더 = 한국어)을 지금 언어로, 이 창의 글도 한 번 새로(예전엔 값을 바꿀 때만).</summary>
        private void Start() { EnsureVoiceRow(); ForestLocalization.RelocalizeScene(); Refresh(); }
        private void ChooseBgm() { ForestSettingsState.BgmOn = !ForestSettingsState.BgmOn; Refresh(); }

        /// <summary>U-0075 — 음성 줄을 붙이고 줄 전체를 82 간격으로 다시 놓는다(예전 95 간격 여섯 줄 판엔 일곱째 자리가 없었다 —
        /// 첫 줄 −130, 일곱째 −622, 닫기 위 끝보다 위). 단추는 실행 때 만들어 리스너를 바로 건다.</summary>
        private void EnsureVoiceRow()
        {
            if (!Application.isPlaying || _panel == null || _voiceValueLabel != null) return;
            _voiceNameLabel = EncounterUiKit.NewText(_panel.transform, ForestLocalization.T("settings.voice", "음성"), new Vector2(0f, 1f),
                new Vector2(60f, -130f), new Vector2(260f, 70f), 26);
            _voiceNameLabel.alignment = TextAlignmentOptions.Left;
            var button = EncounterUiKit.NewButton(_panel.transform, "", new Vector2(1f, 1f), new Vector2(-60f, -130f), new Vector2(260f, 70f), null);
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

            _toggleLabel.text = ForestLocalization.T("settings.title");
            _titleLabel.text = ForestLocalization.T("settings.title");
            _closeLabel.text = ForestLocalization.T("settings.close");
            _sfxNameLabel.text = ForestLocalization.T("settings.sfx");
            _vibrationNameLabel.text = ForestLocalization.T("settings.vibration");
            _uiScaleNameLabel.text = ForestLocalization.T("settings.ui_scale");
            _qualityNameLabel.text = ForestLocalization.T("settings.graphics_quality");
            _languageNameLabel.text = ForestLocalization.T("settings.language");
            _bgmNameLabel.text = ForestLocalization.T("settings.bgm");

            _sfxValueLabel.text = ForestLocalization.T(ForestSettingsState.SfxOn ? "state.on" : "state.off");
            _vibrationValueLabel.text = ForestLocalization.T(ForestSettingsState.VibrationOn ? "state.on" : "state.off");
            _uiScaleValueLabel.text = ForestSettingsState.UiScaleLabel();
            _qualityValueLabel.text = ForestSettingsState.GraphicsQualityLabel();
            _languageValueLabel.text = ForestLocalization.LanguageLabel();
            _bgmValueLabel.text = ForestLocalization.T(ForestSettingsState.BgmOn ? "state.on" : "state.off");
            if (_voiceValueLabel != null)
            {
                _voiceNameLabel.text = ForestLocalization.T("settings.voice", "음성");
                _voiceValueLabel.text = ForestLocalization.T(Saga.Core.SagaVoice.Enabled ? "state.on" : "state.off");
            }
        }
    }
}
