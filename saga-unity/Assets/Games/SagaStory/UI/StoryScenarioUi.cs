using TMPro;
using UnityEngine;
using Saga.Core;
using UnityEngine.EventSystems;
using UnityEngine.InputSystem;
using UnityEngine.UI;
using Saga.Story.Data;

namespace Saga.Story.UI
{
    /// <summary>
    /// PLAN.md 109-16 시나리오 장면 상자(웹 사가종횡 `scenario.js` #scnbox) — 들판에 서 있을 때만 뜬다. 누르면(또는 Space·Enter) 다음 줄, 마지막에서 누르면 닫힌다(Esc·건너뛰기 = 바로 닫음).
    /// `StoryScenarioRunner` 가 Play 때 지어 씬 재빌드 없이 붙는다. 판 눌림은 `IPointerClickHandler` — `Button` 이면 배치 점검이 판 전체를 단추 하나로 센다.
    /// </summary>
    public class StoryScenarioUi : MonoBehaviour
    {
        private class TapCatcher : MonoBehaviour, IPointerClickHandler
        {
            public System.Action OnTap;
            public void OnPointerClick(PointerEventData eventData) => OnTap?.Invoke();
        }

        public static StoryScenarioUi Instance { get; private set; }

        private GameObject _panel;
        private TextMeshProUGUI _title, _who, _text, _page, _nextText, _skipText;
        private Button _nextButton, _skipButton;
        private TextMeshProUGUI _prompt;
        private readonly System.Collections.Generic.List<Button> _choiceButtons = new System.Collections.Generic.List<Button>();
        private StoryScenarioData.Scene _scene;
        private string _sceneTitle;
        private int _line;

        public bool IsOpen => _panel != null && _panel.activeSelf;
        public string SceneId => _scene?.Id;
        public int LineIndex => _line;
        public string WhoText => _who != null ? _who.text : null;
        public string BodyText => _text != null ? _text.text : null;
        public string TitleText => _title != null ? _title.text : null;
        public Button NextButton => _nextButton;
        public Button SkipButton => _skipButton;
        /// <summary>장면 끝 고르기가 떠 있다 — 단추를 눌러야 닫힌다(건너뛰기는 첫 답).</summary>
        public bool Choosing => IsOpen && _scene != null && _scene.Choice != null && _line == _scene.Lines.Length - 1;
        public int ChoiceCount => Choosing ? _scene.Choice.Options.Length : 0;
        public Button ChoiceButton(int i) => _choiceButtons[i];
        public string PromptText => _prompt != null ? _prompt.text : null;

        private void Awake()
        {
            Instance = this;
            Build();
        }

        private void OnDestroy()
        {
            if (Instance == this) Instance = null;
        }

        private void Update()
        {
            if (!IsOpen) return;
            var kb = Keyboard.current;
            if (kb == null && !SagaPad.Connected) return; // tasks U-0018 — 패드 A 다음 · B 건너뛰기
            if (SagaPad.Pressed(SagaPad.Btn.Confirm, kb?.spaceKey) || (kb != null && kb.enterKey.wasPressedThisFrame)) Next();
            else if (SagaPad.Pressed(SagaPad.Btn.Cancel, kb?.escapeKey)) Skip();
        }

        public void Play(StoryScenario.SceneRequest request)
        {
            _scene = request.Scene;
            _sceneTitle = request.Title;
            _line = 0;
            _panel.SetActive(true);
            Paint();
        }

        /// <summary>진단 — 열려 있으면 그냥 닫는다(본 장면으로 적지 않는다).</summary>
        public void Hide()
        {
            _scene = null;
            if (_panel != null) _panel.SetActive(false);
        }

        public void Next()
        {
            if (!IsOpen) return;
            if (_line < _scene.Lines.Length - 1) { _line++; Paint(); }
            else if (_scene.Choice == null) Close();
        }

        public void Skip()
        {
            if (IsOpen) Close();
        }

        private void Pick(int i)
        {
            if (!Choosing || i < 0 || i >= _scene.Choice.Options.Length) return;
            StoryScenario.Choose(_scene.Choice.Id, _scene.Choice.Options[i].Key);
            Close();
        }

        private void Close()
        {
            string id = _scene.Id;
            _scene = null;
            _panel.SetActive(false);
            StoryScenario.SceneFinished(id);
        }

        private void Paint()
        {
            var line = _scene.Lines[_line];
            _title.text = _sceneTitle;
            _who.text = StoryScenario.CastEmoji(line.Who) + " " + StoryScenario.CastName(line.Who);
            _who.color = line.Who == "me" ? new Color(0.6f, 0.85f, 1f) : new Color(1f, 0.85f, 0.4f);
            _text.text = StoryScenario.LineText(_scene.Id, _line);
            _page.text = string.Format(StoryLocalization.T("sscen.page", "{0} / {1}"), _line + 1, _scene.Lines.Length);
            _nextText.text = StoryLocalization.T("sscen.next", "다음");
            _skipText.text = StoryLocalization.T("sscen.skip", "건너뛰기");
            bool choosing = Choosing;
            _nextButton.gameObject.SetActive(!choosing);
            _prompt.gameObject.SetActive(choosing);
            for (int i = 0; i < _choiceButtons.Count; i++)
            {
                bool on = choosing && i < _scene.Choice.Options.Length;
                _choiceButtons[i].gameObject.SetActive(on);
                if (!on) continue;
                var rt = (RectTransform)_choiceButtons[i].transform;
                int n = _scene.Choice.Options.Length;
                rt.anchoredPosition = new Vector2((i - (n - 1) * 0.5f) * 410f, 165f);
                _choiceButtons[i].GetComponentInChildren<TextMeshProUGUI>().text = StoryScenario.ChoiceLabel(_scene.Choice, _scene.Choice.Options[i]);
            }
            if (choosing) _prompt.text = "▶ " + StoryScenario.ChoicePrompt(_scene.Choice);
        }

        private void Build()
        {
            var canvasGo = new GameObject("StoryScenarioCanvas");
            canvasGo.transform.SetParent(transform, false);
            var canvas = canvasGo.AddComponent<Canvas>();
            canvas.renderMode = RenderMode.ScreenSpaceOverlay;
            canvas.sortingOrder = 30;
            var scaler = canvasGo.AddComponent<CanvasScaler>();
            scaler.uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize;
            Saga.Core.SagaUi.ApplyGameScaler(scaler);
            StorySettingsState.ApplyUiScale(scaler);
            canvasGo.AddComponent<GraphicRaycaster>();

            _panel = new GameObject("ScenarioPanel", typeof(RectTransform));
            _panel.transform.SetParent(canvasGo.transform, false);
            var prt = (RectTransform)_panel.transform;
            prt.anchorMin = prt.anchorMax = prt.pivot = new Vector2(0.5f, 0.5f);
            prt.sizeDelta = new Vector2(1300f, 720f); // 화면의 30% 를 넘겨 모달로 친다
            _panel.AddComponent<Image>().color = new Color(0f, 0f, 0f, 0.88f);
            _panel.AddComponent<TapCatcher>().OnTap = Next;

            _title = NewText(_panel.transform, new Vector2(0.5f, 1f), new Vector2(0f, -16f), new Vector2(1240f, 40f), 28);
            _title.color = new Color(1f, 1f, 1f, 0.6f);
            _who = NewText(_panel.transform, new Vector2(0.5f, 1f), new Vector2(0f, -70f), new Vector2(1240f, 48f), 34);
            _text = NewText(_panel.transform, new Vector2(0.5f, 1f), new Vector2(0f, -130f), new Vector2(1200f, 256f), 32);
            _text.alignment = TextAlignmentOptions.TopLeft;
            _page = NewText(_panel.transform, new Vector2(0f, 0f), new Vector2(120f, 40f), new Vector2(200f, 40f), 24);
            _page.color = new Color(1f, 1f, 1f, 0.6f);

            _nextButton = NewButton(_panel.transform, new Vector2(1f, 0f), new Vector2(-150f, 50f), new Vector2(240f, 70f), new Color(0.3f, 0.45f, 0.8f, 0.7f), 28);
            _nextButton.onClick.AddListener(Next);
            _nextText = _nextButton.GetComponentInChildren<TextMeshProUGUI>();
            _skipButton = NewButton(_panel.transform, new Vector2(1f, 0f), new Vector2(-410f, 50f), new Vector2(240f, 70f), new Color(1f, 1f, 1f, 0.16f), 26);
            _skipButton.onClick.AddListener(Skip);
            _skipText = _skipButton.GetComponentInChildren<TextMeshProUGUI>();
            // 장면 끝 고르기 — 본문 아래 안내 줄 + 답 단추 셋 자리(답이 둘이면 둘만 켠다)
            _prompt = NewText(_panel.transform, new Vector2(0.5f, 0f), new Vector2(0f, 250f), new Vector2(1200f, 50f), 30);
            _prompt.color = new Color(1f, 0.9f, 0.5f);
            for (int i = 0; i < 3; i++)
            {
                var cb = NewButton(_panel.transform, new Vector2(0.5f, 0f), Vector2.zero, new Vector2(390f, 78f), new Color(0.3f, 0.45f, 0.8f, 0.75f), 28);
                int idx = i;
                cb.onClick.AddListener(() => Pick(idx));
                _choiceButtons.Add(cb);
            }
            _panel.SetActive(false);
        }

        private static TextMeshProUGUI NewText(Transform parent, Vector2 anchor, Vector2 pos, Vector2 size, int fontSize)
        {
            var go = new GameObject("Text", typeof(RectTransform));
            go.transform.SetParent(parent, false);
            var rect = (RectTransform)go.transform;
            rect.anchorMin = rect.anchorMax = rect.pivot = anchor;
            rect.anchoredPosition = pos;
            rect.sizeDelta = size;
            var text = go.AddComponent<TextMeshProUGUI>();
            text.fontSize = fontSize;
            text.alignment = TextAlignmentOptions.Center;
            text.color = Color.white;
            text.textWrappingMode = TextWrappingModes.Normal;
            text.raycastTarget = false;
            return text;
        }

        private static Button NewButton(Transform parent, Vector2 anchor, Vector2 pos, Vector2 size, Color color, int fontSize)
        {
            var go = new GameObject("Btn", typeof(RectTransform));
            go.transform.SetParent(parent, false);
            var rect = (RectTransform)go.transform;
            rect.anchorMin = rect.anchorMax = rect.pivot = anchor;
            rect.anchoredPosition = pos;
            rect.sizeDelta = size;
            var img = go.AddComponent<Image>();
            img.color = color;
            var button = go.AddComponent<Button>();
            button.targetGraphic = img;
            NewText(go.transform, new Vector2(0.5f, 0.5f), Vector2.zero, size, fontSize);
            return button;
        }
    }
}
