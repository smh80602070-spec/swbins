using TMPro;
using UnityEngine;
using UnityEngine.UI;
using Saga.Story.Data;

namespace Saga.Story.UI
{
    /// <summary>
    /// PLAN.md 51장 "STORY 확장 — 전직·SP 투자 UI" — `StoryChoiceUi.cs`가
    /// 두 선택지 전용(N=1이면 안 뽑는다 원칙으로 그대로 둠)이라, 넷 중 하나를
    /// 고르는 이 화면은 따로 만든다. `Saga.Story.UI.StorySettingsPanel.cs`와
    /// 같은 결로 자기 UI를 스스로 짓는다(캔버스/패널/텍스트/버튼 헬퍼도
    /// 그대로 복사).
    /// </summary>
    public class StoryJobChoiceUi : MonoBehaviour
    {
        public static StoryJobChoiceUi Instance { get; private set; }

        // PLAN.md 104-1 ③ — Build()를 부르는 게 에디터 스크립트뿐이라(런타임 재호출 없음)
        // 씬 저장→재로드 후에도 참조가 남으려면 [SerializeField]가 필수(REALM/LocalizedButtonLabel과 같은 함정).
        [SerializeField] private GameObject _panel;
        [SerializeField] private TextMeshProUGUI _titleLabel;
        [SerializeField] private TextMeshProUGUI _closeLabel;
        // 2026-09-23 — Build()(에디터 전용)에서 onClick.AddListener로 건 리스너는 런타임
        // 전용이라 씬 저장 때 안 남는다: 저장된 TestField.unity의 버튼 onClick이 전부 비어
        // 있었다(실제 플레이에서 전직 버튼이 먹통). 버튼 참조만 직렬화해 두고 Awake()에서 건다.
        [SerializeField] private Button[] _jobButtons;
        [SerializeField] private Button _closeButton;
        private System.Action<string> _onChosen;

        public bool IsShowing => _panel != null && _panel.activeSelf;

        private void Awake()
        {
            Instance = this;
            WireButtons();
            ApplyLayout();
        }

        /// <summary>
        /// 판·직업 단추 자리 한 곳 — <see cref="Build"/>(씬 빌더)와 <see cref="Awake"/> 가 같이 부른다(씬을 다시 안 지어도 실행 때 맞는다).
        /// PLAN.md 110 ⑤c-3: 판 640·간격 100 이면 넷째 직업 단추가 아래 닫기에 파고들었다 → 판 720·첫 단추 -190·간격 95.
        /// </summary>
        private void ApplyLayout()
        {
            if (_panel != null) ((RectTransform)_panel.transform).sizeDelta = new Vector2(680f, 720f);
            if (_jobButtons == null) return;
            for (int i = 0; i < _jobButtons.Length; i++)
                if (_jobButtons[i] != null) ((RectTransform)_jobButtons[i].transform).anchoredPosition = new Vector2(0f, -190f - 95f * i);
        }

        private void WireButtons()
        {
            if (_jobButtons != null)
            {
                for (int i = 0; i < _jobButtons.Length && i < StoryCombat.JobOrder.Length; i++)
                {
                    string key = StoryCombat.JobOrder[i];
                    if (_jobButtons[i] != null) _jobButtons[i].onClick.AddListener(() => Choose(key));
                }
            }
            if (_closeButton != null) _closeButton.onClick.AddListener(() => _panel.SetActive(false));
        }

        public void Build()
        {
            Instance = this;

            var canvas = NewCanvas("StoryJobChoiceUI");
            canvas.transform.SetParent(transform, false);

            _panel = NewPanel(canvas.transform, new Vector2(0.5f, 0.5f), new Vector2(680f, 640f),
                new Color(0f, 0f, 0f, 0.85f));
            _panel.SetActive(false);

            _titleLabel = NewText(_panel.transform, "", new Vector2(0.5f, 1f),
                new Vector2(0f, -60f), new Vector2(600f, 100f), 28);

            _jobButtons = new Button[StoryCombat.JobOrder.Length];
            float y = -220f;
            for (int i = 0; i < StoryCombat.JobOrder.Length; i++)
            {
                _jobButtons[i] = NewButton(_panel.transform, JobLabel(StoryCombat.JobOrder[i]), new Vector2(0.5f, 1f),
                    new Vector2(0f, y), new Vector2(520f, 80f));
                y -= 100f;
            }

            _closeButton = NewButton(_panel.transform, StoryLocalization.T("settings.close"),
                new Vector2(0.5f, 0f), new Vector2(0f, 40f), new Vector2(300f, 70f));
            _closeLabel = _closeButton.GetComponentInChildren<TextMeshProUGUI>();
            ApplyLayout();
        }

        private static string JobLabel(string jobKey)
        {
            var info = StoryCombat.JobsTier1[jobKey];
            return StoryLocalization.T($"job.{jobKey}", info.Name);
        }

        public void Show(string prompt, System.Action<string> onChosen)
        {
            if (_panel == null) return;
            _titleLabel.text = prompt;
            if (_closeLabel != null) _closeLabel.text = StoryLocalization.T("settings.close");
            _onChosen = onChosen;
            _panel.SetActive(true);
        }

        private void Choose(string jobKey)
        {
            _panel.SetActive(false);
            _onChosen?.Invoke(jobKey);
        }

        // Saga.Story.UI.StorySettingsPanel.cs와 같은 넷(캔버스/패널/텍스트/버튼) —
        // 이 컴포넌트 하나만 써서 kit로 안 뽑고 그대로 둔다(같은 판단).
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
