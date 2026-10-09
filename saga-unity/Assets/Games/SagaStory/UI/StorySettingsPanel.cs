using TMPro;
using UnityEngine;
using UnityEngine.UI;
using Saga.Story.Data;

namespace Saga.Story.UI
{
    /// <summary>
    /// PLAN.md 67~69장 "접근성" — 효과음·진동·UI 크기·그래픽 품질·언어.
    /// STORY엔 GO/FOREST의 `EncounterUiKit` 같은 공용 부품이 없어(이
    /// 컴포넌트 하나만 쓸 것이라 새로 안 뽑는다 — `StoryChoiceUi.cs`
    /// 클래스 주석과 같은 판단) 캔버스/패널/텍스트/버튼 조립을 이 파일
    /// 안에 그대로 둔다(`Saga.Dungeon.UI.DungeonSettingsPanel.cs`와 같은 결).
    ///
    /// 화면 오른쪽 위 — "저장" 버튼(-30,-30,160×80) 바로 아래(-30,-130)가
    /// GO/FOREST와 같은 이유로 이 판에서도 유일하게 빈 자리다.
    ///
    /// 2026-09-14 "Localization" — 다섯째 줄로 언어(ko/en)를 추가하며 패널
    /// 자신의 글자를 전부 `StoryLocalization.T()`로 바꿨다(GO와 같은 결).
    /// </summary>
    public class StorySettingsPanel : MonoBehaviour
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
        // 2026-09-23 — Build()(에디터 전용)의 onClick.AddListener는 씬 저장 때 안 남아 실제
        // 플레이에선 설정 버튼이 전부 먹통이었다(StoryJobChoiceUi와 같은 발견). 버튼만
        // 직렬화하고 Awake()에서 건다. _rowButtons 순서 = RowHandlers() 순서.
        [SerializeField] private Button _toggleButton;
        [SerializeField] private Button _closeButton;
        [SerializeField] private Button[] _rowButtons;

        private void Awake()
        {
            if (_toggleButton != null) _toggleButton.onClick.AddListener(TogglePanel);
            if (_closeButton != null) _closeButton.onClick.AddListener(() => _panel.SetActive(false));
            var handlers = RowHandlers();
            if (_rowButtons == null) return;
            for (int i = 0; i < _rowButtons.Length && i < handlers.Length; i++)
            {
                if (_rowButtons[i] != null) _rowButtons[i].onClick.AddListener(handlers[i]);
            }
        }

        private UnityEngine.Events.UnityAction[] RowHandlers() => new UnityEngine.Events.UnityAction[]
        {
            ChooseSfx, ChooseVibration, ChooseUiScale, ChooseGraphicsQuality, ChooseLanguage, ChooseBgm,
        };

        public void Build()
        {
            var canvas = NewCanvas("StorySettingsUI");
            canvas.transform.SetParent(transform, false);

            _toggleButton = NewButton(canvas.transform, StoryLocalization.T("settings.title"),
                new Vector2(1f, 1f), new Vector2(-210f, -30f), new Vector2(160f, 80f)); // 110 ⑤b — 윗줄 저장 왼쪽
            _toggleLabel = _toggleButton.GetComponentInChildren<TextMeshProUGUI>();

            _panel = NewPanel(canvas.transform, new Vector2(0.5f, 0.5f), new Vector2(680f, 820f),
                new Color(0f, 0f, 0f, 0.8f));
            _panel.SetActive(false);

            _titleLabel = NewText(_panel.transform, StoryLocalization.T("settings.title"),
                new Vector2(0.5f, 1f), new Vector2(0f, -60f), new Vector2(500f, 60f), 32);

            _rowButtons = new Button[6];
            (_sfxNameLabel, _sfxValueLabel) = MakeRow(-140f, "settings.sfx", 0);
            (_vibrationNameLabel, _vibrationValueLabel) = MakeRow(-235f, "settings.vibration", 1);
            (_uiScaleNameLabel, _uiScaleValueLabel) = MakeRow(-330f, "settings.ui_scale", 2);
            (_qualityNameLabel, _qualityValueLabel) = MakeRow(-425f, "settings.graphics_quality", 3);
            (_languageNameLabel, _languageValueLabel) = MakeRow(-520f, "settings.language", 4);
            (_bgmNameLabel, _bgmValueLabel) = MakeRow(-615f, "settings.bgm", 5);

            _closeButton = NewButton(_panel.transform, StoryLocalization.T("settings.close"),
                new Vector2(0.5f, 0f), new Vector2(0f, 40f), new Vector2(300f, 70f));
            _closeLabel = _closeButton.GetComponentInChildren<TextMeshProUGUI>();

            Refresh();
        }

        private (TextMeshProUGUI name, TextMeshProUGUI value) MakeRow(float y, string nameKey, int rowIndex)
        {
            var name = NewText(_panel.transform, StoryLocalization.T(nameKey), new Vector2(0f, 1f),
                new Vector2(60f, y), new Vector2(260f, 70f), 26);
            name.alignment = TextAlignmentOptions.Left;
            var button = NewButton(_panel.transform, "", new Vector2(1f, 1f), new Vector2(-60f, y),
                new Vector2(260f, 70f));
            _rowButtons[rowIndex] = button;
            return (name, button.GetComponentInChildren<TextMeshProUGUI>());
        }

        private void ChooseSfx() { StorySettingsState.SfxOn = !StorySettingsState.SfxOn; Refresh(); }
        private void ChooseVibration() { StorySettingsState.VibrationOn = !StorySettingsState.VibrationOn; Refresh(); }
        private void ChooseUiScale() { StorySettingsState.CycleUiScale(); Refresh(); }
        private void ChooseGraphicsQuality() { StorySettingsState.CycleGraphicsQuality(); Refresh(); }
        private void ChooseLanguage() { StoryLocalization.CycleLanguage(); StoryLocalization.RelocalizeScene(); Refresh(); }

        /// <summary>110 ⑤c-2c — 씬에 구운 글(빌더 = 한국어)을 지금 언어로, 이 창의 글도 한 번 새로(예전엔 값을 바꿀 때만).</summary>
        private void Start() { EnsureRoundRow(); EnsureVoiceRow(); StoryLocalization.RelocalizeScene(); Refresh(); }
        private void ChooseBgm() { StorySettingsState.BgmOn = !StorySettingsState.BgmOn; Refresh(); }

        /// <summary>U-0075 — 음성 줄을 붙이고 줄 전체를 82 간격으로 다시 놓는다(예전 95 간격 여섯 줄 판엔 일곱째 자리가 없었다 —
        /// 첫 줄 −130, 여덟째(회귀) −704, 닫기 위 끝보다 위). 단추는 실행 때 만들어 리스너를 바로 건다.</summary>
        private void EnsureVoiceRow()
        {
            if (!Application.isPlaying || _panel == null || _voiceValueLabel != null) return;
            _voiceNameLabel = NewText(_panel.transform, StoryLocalization.T("settings.voice", "음성"), new Vector2(0f, 1f),
                new Vector2(60f, -130f), new Vector2(260f, 70f), 26);
            _voiceNameLabel.alignment = TextAlignmentOptions.Left;
            var button = NewButton(_panel.transform, "", new Vector2(1f, 1f), new Vector2(-60f, -130f), new Vector2(260f, 70f));
            _voiceValueLabel = button.GetComponentInChildren<TextMeshProUGUI>();
            button.onClick.AddListener(ChooseVoice);
            var rows = new[] { (_sfxNameLabel, _sfxValueLabel), (_vibrationNameLabel, _vibrationValueLabel), (_uiScaleNameLabel, _uiScaleValueLabel), (_qualityNameLabel, _qualityValueLabel), (_languageNameLabel, _languageValueLabel), (_bgmNameLabel, _bgmValueLabel), (_voiceNameLabel, _voiceValueLabel), (_roundNameLabel, _roundValueLabel) };
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

        private void Refresh()
        {
            if (_sfxValueLabel == null) return;

            _toggleLabel.text = StoryLocalization.T("settings.title");
            _titleLabel.text = StoryLocalization.T("settings.title");
            _closeLabel.text = StoryLocalization.T("settings.close");
            _sfxNameLabel.text = StoryLocalization.T("settings.sfx");
            _vibrationNameLabel.text = StoryLocalization.T("settings.vibration");
            _uiScaleNameLabel.text = StoryLocalization.T("settings.ui_scale");
            _qualityNameLabel.text = StoryLocalization.T("settings.graphics_quality");
            _languageNameLabel.text = StoryLocalization.T("settings.language");
            _bgmNameLabel.text = StoryLocalization.T("settings.bgm");

            _sfxValueLabel.text = StoryLocalization.T(StorySettingsState.SfxOn ? "state.on" : "state.off");
            _vibrationValueLabel.text = StoryLocalization.T(StorySettingsState.VibrationOn ? "state.on" : "state.off");
            _uiScaleValueLabel.text = StorySettingsState.UiScaleLabel();
            _qualityValueLabel.text = StorySettingsState.GraphicsQualityLabel();
            _languageValueLabel.text = StoryLocalization.LanguageLabel();
            _bgmValueLabel.text = StoryLocalization.T(StorySettingsState.BgmOn ? "state.on" : "state.off");
            if (_voiceValueLabel != null)
            {
                _voiceNameLabel.text = StoryLocalization.T("settings.voice", "음성");
                _voiceValueLabel.text = StoryLocalization.T(Saga.Core.SagaVoice.Enabled ? "state.on" : "state.off");
            }
            RefreshRound();
        }

        // ── tasks U-0024 회차 — 일곱째 줄 "🔁 회귀". 씬에 구운 패널이라 줄을 더하면 씬을 다시 지어야 하므로, 켜질 때(Play) 코드로 줄 하나를
        // 붙이고 창을 그만큼 늘린다(구운 줄·닫기 단추는 그대로). 한 번 눌러 조건·미리보기를 보고, 6초 안에 한 번 더 누르면 시작.
        private Button _roundButton;
        private TextMeshProUGUI _roundNameLabel, _roundValueLabel;
        private float _roundArmUntil;

        private void EnsureRoundRow()
        {
            if (!Application.isPlaying || _panel == null || _roundButton != null) return;
            var rect = (RectTransform)_panel.transform;
            rect.sizeDelta = new Vector2(rect.sizeDelta.x, rect.sizeDelta.y + 95f);
            const float y = -710f;
            _roundNameLabel = NewText(_panel.transform, StoryLocalization.T("round.title", "🔁 회귀"), new Vector2(0f, 1f),
                new Vector2(60f, y), new Vector2(260f, 70f), 26);
            _roundNameLabel.alignment = TextAlignmentOptions.Left;
            _roundButton = NewButton(_panel.transform, "", new Vector2(1f, 1f), new Vector2(-60f, y), new Vector2(260f, 70f));
            _roundValueLabel = _roundButton.GetComponentInChildren<TextMeshProUGUI>();
            _roundButton.onClick.AddListener(ChooseRound);
        }

        private void RefreshRound()
        {
            if (_roundButton == null) return;
            _roundNameLabel.text = StoryLocalization.T("round.title", "🔁 회귀");
            _roundValueLabel.text = StoryRound.StateLabel();
        }

        private void ChooseRound()
        {
            string why = StoryRound.Why();
            if (why != null) { RoundToast(why, 4f); return; }
            if (Time.unscaledTime < _roundArmUntil)
            {
                _roundArmUntil = 0f;
                if (StoryRound.StartNext(true, out string startWhy))
                    RoundToast(string.Format(StoryLocalization.T("round.started", "🔁 {0}회차 — 적 ×{1:0.0#} · 경험치 ×{2:0.0#}"), StoryRound.Round, StoryRound.FoeMul(), StoryRound.GainMul()), 4f);
                else RoundToast(startWhy, 4f);
            }
            else
            {
                _roundArmUntil = Time.unscaledTime + StoryRound.ArmSeconds;
                RoundToast(StoryRound.Preview() + StoryLocalization.T("round.confirm", " — 한 번 더 누르면 시작"), StoryRound.ArmSeconds);
            }
            RefreshRound();
        }

        private static void RoundToast(string text, float seconds) => DialogueLabel.Instance?.Show(text, seconds);

        private static Canvas NewCanvas(string name)
        {
            var go = new GameObject(name);
            var canvas = go.AddComponent<Canvas>();
            canvas.renderMode = RenderMode.ScreenSpaceOverlay;
            var scaler = go.AddComponent<CanvasScaler>();
            scaler.uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize;
            Saga.Core.SagaUi.ApplyGameScaler(scaler);
            StorySettingsState.ApplyUiScale(scaler);
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

        private static Button NewButton(Transform parent, string label, Vector2 anchor, Vector2 pos, Vector2 size)
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

            NewText(go.transform, label, new Vector2(0.5f, 0.5f), Vector2.zero, size, 26);

            return button;
        }
    }
}
