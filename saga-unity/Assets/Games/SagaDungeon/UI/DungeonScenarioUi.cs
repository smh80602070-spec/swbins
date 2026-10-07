using TMPro;
using UnityEngine;
using Saga.Core;
using UnityEngine.EventSystems;
using UnityEngine.InputSystem;
using UnityEngine.UI;
using Saga.Dungeon.Data;

namespace Saga.Dungeon.UI
{
    /// <summary>
    /// PLAN.md 109-16 시나리오 장면 상자(웹 사가나락 `scenario.js` #scnbox) — 칸(마을·갈림길)에서만 뜬다. 누르면(또는 Space·Enter) 다음 줄, 마지막에서 누르면 닫힌다.
    /// 고르기 장면(망루성 성주의 이름)은 마지막 줄 뒤에 답 단추 둘이 나온다(1·2 키). 건너뛰기(Esc)는 고르기 앞까지만 간다.
    /// 씬 빌더가 아니라 `DungeonScenarioRunner` 가 Play 때 지어 리스너가 런타임 리스너다 — 씬 재빌드 없이 붙는다.
    /// </summary>
    public class DungeonScenarioUi : MonoBehaviour
    {
        /// <summary>판 어디를 눌러도 알려 주는 얇은 틀 — `Button` 이 아니라 배치 점검이 판 전체를 단추 하나로 치지 않는다.</summary>
        private class TapCatcher : MonoBehaviour, IPointerClickHandler
        {
            public System.Action OnTap;
            public void OnPointerClick(PointerEventData eventData) => OnTap?.Invoke();
        }

        public static DungeonScenarioUi Instance { get; private set; }

        private GameObject _panel;
        private TextMeshProUGUI _title, _who, _text, _page;
        private Button _nextButton, _skipButton;
        private TextMeshProUGUI _nextText, _skipText;
        private readonly Button[] _pickButtons = new Button[2];
        private readonly TextMeshProUGUI[] _pickTexts = new TextMeshProUGUI[2];
        private TextMeshProUGUI _prompt;

        private DungeonScenarioData.Scene _scene;
        private string _sceneTitle;
        private int _line;
        private bool _picking;

        public bool IsOpen => _panel != null && _panel.activeSelf;
        public string SceneId => _scene?.Id;
        public int LineIndex => _line;
        public bool Picking => _picking;
        public string WhoText => _who != null ? _who.text : null;
        public string BodyText => _text != null ? _text.text : null;
        public string TitleText => _title != null ? _title.text : null;
        public Button NextButton => _nextButton;
        public Button SkipButton => _skipButton;
        public Button PickButton(int i) => _pickButtons[i];

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
            else if (_picking && SagaPad.Pressed(SagaPad.Btn.Attack, kb?.digit1Key)) Pick(0); // 패드 X
            else if (_picking && SagaPad.Pressed(SagaPad.Btn.Interact, kb?.digit2Key)) Pick(1); // 패드 Y
        }

        public void Play(DungeonScenario.SceneRequest request)
        {
            _scene = request.Scene;
            _sceneTitle = request.Title;
            _line = 0;
            _picking = false;
            _panel.SetActive(true);
            Paint();
        }

        /// <summary>진단 — 열려 있으면 그냥 닫는다(본 장면으로 적지 않는다).</summary>
        public void Hide()
        {
            _scene = null;
            _picking = false;
            if (_panel != null) _panel.SetActive(false);
        }

        public void Next()
        {
            if (!IsOpen || _picking) return;
            if (_line < _scene.Lines.Length - 1) { _line++; Paint(); }
            else if (_scene.Choice != null) ToChoice();
            else Close(null);
        }

        public void Skip()
        {
            if (!IsOpen || _picking) return;
            if (_scene.Choice != null) ToChoice(); else Close(null);
        }

        private void ToChoice()
        {
            _line = _scene.Lines.Length - 1;
            _picking = true;
            Paint();
        }

        public void Pick(int i)
        {
            if (!IsOpen || !_picking || _scene.Choice == null || i < 0 || i >= _scene.Choice.Options.Length) return;
            Close(_scene.Choice.Options[i].Key);
        }

        private void Close(string picked)
        {
            string id = _scene.Id;
            _scene = null;
            _picking = false;
            _panel.SetActive(false);
            DungeonScenario.SceneFinished(id, picked);
        }

        private void Paint()
        {
            var line = _scene.Lines[_line];
            _title.text = _sceneTitle;
            _who.text = DungeonScenario.CastEmoji(line.Who) + " " + DungeonScenario.CastName(line.Who);
            _who.color = line.Who == "me" ? new Color(0.6f, 0.85f, 1f) : new Color(1f, 0.85f, 0.4f);
            _text.text = DungeonScenario.LineText(_scene.Id, _line);
            _page.text = _picking ? "" : string.Format(DungeonLocalization.T("dscen.page", "{0} / {1}"), _line + 1, _scene.Lines.Length);
            _nextText.text = DungeonLocalization.T("dscen.next", "다음");
            _skipText.text = DungeonLocalization.T("dscen.skip", "건너뛰기");
            _nextButton.gameObject.SetActive(!_picking);
            _skipButton.gameObject.SetActive(!_picking);
            _prompt.gameObject.SetActive(_picking);
            for (int i = 0; i < _pickButtons.Length; i++)
            {
                bool show = _picking && _scene.Choice != null && i < _scene.Choice.Options.Length;
                _pickButtons[i].gameObject.SetActive(show);
                if (show) _pickTexts[i].text = DungeonScenario.OptionLabel(_scene.Choice, _scene.Choice.Options[i]);
            }
            if (_picking) _prompt.text = DungeonScenario.ChoicePrompt(_scene.Choice);
        }

        private void Build()
        {
            var canvasGo = new GameObject("DungeonScenarioCanvas");
            canvasGo.transform.SetParent(transform, false);
            var canvas = canvasGo.AddComponent<Canvas>();
            canvas.renderMode = RenderMode.ScreenSpaceOverlay;
            canvas.sortingOrder = 30;
            var scaler = canvasGo.AddComponent<CanvasScaler>();
            scaler.uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize;
            Saga.Core.SagaUi.ApplyGameScaler(scaler);
            DungeonSettingsState.ApplyUiScale(scaler);
            canvasGo.AddComponent<GraphicRaycaster>();

            _panel = new GameObject("ScenarioPanel", typeof(RectTransform));
            _panel.transform.SetParent(canvasGo.transform, false);
            var prt = (RectTransform)_panel.transform;
            prt.anchorMin = prt.anchorMax = prt.pivot = new Vector2(0.5f, 0.5f);
            prt.sizeDelta = new Vector2(1300f, 720f); // 화면의 30% 를 넘겨 모달로 친다(뒤 단추와 겹침은 설계)
            _panel.AddComponent<Image>().color = new Color(0f, 0f, 0f, 0.88f);
            _panel.AddComponent<TapCatcher>().OnTap = Next; // 상자 아무 데나 누르면 다음 줄 — 단추가 아니라 눌림만 받는다

            _title = NewText(_panel.transform, "", new Vector2(0.5f, 1f), new Vector2(0f, -16f), new Vector2(1240f, 40f), 28);
            _title.color = new Color(1f, 1f, 1f, 0.6f);
            _who = NewText(_panel.transform, "", new Vector2(0.5f, 1f), new Vector2(0f, -70f), new Vector2(1240f, 48f), 34);
            _text = NewText(_panel.transform, "", new Vector2(0.5f, 1f), new Vector2(0f, -130f), new Vector2(1200f, 256f), 32);
            _text.alignment = TextAlignmentOptions.TopLeft;
            _page = NewText(_panel.transform, "", new Vector2(0f, 0f), new Vector2(120f, 40f), new Vector2(200f, 40f), 24);
            _page.color = new Color(1f, 1f, 1f, 0.6f);
            _prompt = NewText(_panel.transform, "", new Vector2(0.5f, 0f), new Vector2(0f, 190f), new Vector2(1240f, 50f), 32);

            _nextButton = NewButton(_panel.transform, "", new Vector2(1f, 0f), new Vector2(-150f, 50f), new Vector2(240f, 70f), new Color(0.3f, 0.45f, 0.8f, 0.7f), 28);
            _nextButton.onClick.AddListener(Next);
            _nextText = _nextButton.GetComponentInChildren<TextMeshProUGUI>();
            _skipButton = NewButton(_panel.transform, "", new Vector2(1f, 0f), new Vector2(-410f, 50f), new Vector2(240f, 70f), new Color(1f, 1f, 1f, 0.16f), 26);
            _skipButton.onClick.AddListener(Skip);
            _skipText = _skipButton.GetComponentInChildren<TextMeshProUGUI>();
            for (int i = 0; i < _pickButtons.Length; i++)
            {
                int idx = i;
                _pickButtons[i] = NewButton(_panel.transform, "", new Vector2(0.5f, 0f), new Vector2(0f, 120f - i * 74f), new Vector2(900f, 64f), new Color(0.3f, 0.45f, 0.8f, 0.7f), 28);
                _pickButtons[i].onClick.AddListener(() => Pick(idx));
                _pickTexts[i] = _pickButtons[i].GetComponentInChildren<TextMeshProUGUI>();
            }
            _panel.SetActive(false);
        }

        private static TextMeshProUGUI NewText(Transform parent, string content, Vector2 anchor, Vector2 pos, Vector2 size, int fontSize)
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
            text.text = content;
            text.raycastTarget = false;
            return text;
        }

        private static Button NewButton(Transform parent, string label, Vector2 anchor, Vector2 pos, Vector2 size, Color color, int fontSize)
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
            NewText(go.transform, label, new Vector2(0.5f, 0.5f), Vector2.zero, size, fontSize);
            return button;
        }
    }
}
