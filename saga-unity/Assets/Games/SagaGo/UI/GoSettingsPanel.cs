using TMPro;
using UnityEngine;
using UnityEngine.UI;
using Saga.Go.Data;

namespace Saga.Go.UI
{
    /// <summary>
    /// PLAN.md 67~69장 "접근성" — 효과음·진동·UI 크기·그래픽 품질·언어를 한
    /// 팝업에서 고른다. `RealmCommandUi.cs`와 같은 결로 자기 UI를 스스로
    /// 짓는 컴포넌트(kit는 `EncounterUiKit` 재사용 — 전투 사건과 같은 벌).
    /// 화면 오른쪽 위, "저장" 버튼(-30,-30,160×80) 바로 아래(-30,-130)에
    /// 자리를 잡는다 — `BuildTestVillageScene.cs`가 Save/DebugUI 위치를
    /// 이미 그렇게 잡아 둬서, 그 아래가 이 판에서 유일하게 빈 오른쪽 위
    /// 자리다(`BuildSettingsUi()` 클래스 주석 참고).
    ///
    /// 2026-09-14 "Localization" — 다섯째 줄로 언어(ko/en)를 추가하며 패널
    /// 자신의 글자(제목·행 이름·닫기·토글 버튼)를 전부 `GoLocalization.T()`로
    /// 바꿨다 — 언어를 바꾸면 Refresh() 한 번으로 이 패널 전체가 다시
    /// 그려진다(패널 키(680×720)도 행 하나만큼 늘렸다).
    /// </summary>
    public class GoSettingsPanel : MonoBehaviour
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
            var canvas = EncounterUiKit.NewCanvas("GoSettingsUI");
            canvas.transform.SetParent(transform, false);

            var toggleButton = EncounterUiKit.NewButton(canvas.transform, GoLocalization.T("settings.title"),
                new Vector2(1f, 1f), new Vector2(-30f, -130f), new Vector2(160f, 80f), TogglePanel);
            _toggleLabel = toggleButton.GetComponentInChildren<TextMeshProUGUI>();

            _panel = EncounterUiKit.NewPanel(canvas.transform, new Vector2(0.5f, 0.5f), new Vector2(680f, 820f),
                new Color(0f, 0f, 0f, 0.8f));
            _panel.SetActive(false);

            _titleLabel = EncounterUiKit.NewText(_panel.transform, GoLocalization.T("settings.title"),
                new Vector2(0.5f, 1f), new Vector2(0f, -60f), new Vector2(500f, 60f), 32);

            (_sfxNameLabel, _sfxValueLabel) = MakeRow(-140f, "settings.sfx", ChooseSfx);
            (_vibrationNameLabel, _vibrationValueLabel) = MakeRow(-235f, "settings.vibration", ChooseVibration);
            (_uiScaleNameLabel, _uiScaleValueLabel) = MakeRow(-330f, "settings.ui_scale", ChooseUiScale);
            (_qualityNameLabel, _qualityValueLabel) = MakeRow(-425f, "settings.graphics_quality", ChooseGraphicsQuality);
            (_languageNameLabel, _languageValueLabel) = MakeRow(-520f, "settings.language", ChooseLanguage);
            (_bgmNameLabel, _bgmValueLabel) = MakeRow(-615f, "settings.bgm", ChooseBgm);

            var closeButton = EncounterUiKit.NewButton(_panel.transform, GoLocalization.T("settings.close"),
                new Vector2(0.5f, 0f), new Vector2(0f, 40f), new Vector2(300f, 70f), ClosePanel);
            _closeLabel = closeButton.GetComponentInChildren<TextMeshProUGUI>();

            Refresh();
        }

        /// <summary>왼쪽 항목명 + 오른쪽(버튼 안에) 현재 값 — 버튼을 누를
        /// 때마다 다음 값으로 순환한다. 항목명도 언어에 따라 바뀌어야 해서
        /// (닫기·토글 버튼처럼) 이름 Text도 같이 돌려준다.</summary>
        private (TextMeshProUGUI name, TextMeshProUGUI value) MakeRow(float y, string nameKey, UnityEngine.Events.UnityAction onClick)
        {
            var name = EncounterUiKit.NewText(_panel.transform, GoLocalization.T(nameKey), new Vector2(0f, 1f),
                new Vector2(60f, y), new Vector2(260f, 70f), 26);
            name.alignment = TextAlignmentOptions.Left;
            var button = EncounterUiKit.NewButton(_panel.transform, "", new Vector2(1f, 1f), new Vector2(-60f, y),
                new Vector2(260f, 70f), onClick);
            return (name, button.GetComponentInChildren<TextMeshProUGUI>());
        }

        private void ChooseSfx() { GoSettingsState.SfxOn = !GoSettingsState.SfxOn; Refresh(); }
        private void ChooseVibration() { GoSettingsState.VibrationOn = !GoSettingsState.VibrationOn; Refresh(); }
        private void ChooseUiScale() { GoSettingsState.CycleUiScale(); Refresh(); }
        private void ChooseGraphicsQuality() { GoSettingsState.CycleGraphicsQuality(); Refresh(); }
        private void ChooseLanguage() { GoLocalization.CycleLanguage(); GoLocalization.RelocalizeScene(); Refresh(); }

        /// <summary>110 ⑤c-2c — 씬에 구운 글(빌더 = 한국어)을 지금 언어로, 이 창의 글도 한 번 새로(예전엔 값을 바꿀 때만).</summary>
        private void Start() { EnsureVoiceRow(); GoLocalization.RelocalizeScene(); Refresh(); }
        private void ChooseBgm() { GoSettingsState.BgmOn = !GoSettingsState.BgmOn; Refresh(); }

        /// <summary>U-0075 — 음성 줄을 붙이고 줄 전체를 82 간격으로 다시 놓는다(예전 95 간격 여섯 줄 판엔 일곱째 자리가 없었다 —
        /// 첫 줄 −130, 일곱째 −622, 닫기 위 끝보다 위). 단추는 실행 때 만들어 리스너를 바로 건다.</summary>
        private void EnsureVoiceRow()
        {
            if (!Application.isPlaying || _panel == null || _voiceValueLabel != null) return;
            _voiceNameLabel = EncounterUiKit.NewText(_panel.transform, GoLocalization.T("settings.voice", "음성"), new Vector2(0f, 1f),
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

            _toggleLabel.text = GoLocalization.T("settings.title");
            _titleLabel.text = GoLocalization.T("settings.title");
            _closeLabel.text = GoLocalization.T("settings.close");
            _sfxNameLabel.text = GoLocalization.T("settings.sfx");
            _vibrationNameLabel.text = GoLocalization.T("settings.vibration");
            _uiScaleNameLabel.text = GoLocalization.T("settings.ui_scale");
            _qualityNameLabel.text = GoLocalization.T("settings.graphics_quality");
            _languageNameLabel.text = GoLocalization.T("settings.language");
            _bgmNameLabel.text = GoLocalization.T("settings.bgm");

            _sfxValueLabel.text = GoLocalization.T(GoSettingsState.SfxOn ? "state.on" : "state.off");
            _vibrationValueLabel.text = GoLocalization.T(GoSettingsState.VibrationOn ? "state.on" : "state.off");
            _uiScaleValueLabel.text = GoSettingsState.UiScaleLabel();
            _qualityValueLabel.text = GoSettingsState.GraphicsQualityLabel();
            _languageValueLabel.text = GoLocalization.LanguageLabel();
            _bgmValueLabel.text = GoLocalization.T(GoSettingsState.BgmOn ? "state.on" : "state.off");
            if (_voiceValueLabel != null)
            {
                _voiceNameLabel.text = GoLocalization.T("settings.voice", "음성");
                _voiceValueLabel.text = GoLocalization.T(Saga.Core.SagaVoice.Enabled ? "state.on" : "state.off");
            }
        }
    }
}
