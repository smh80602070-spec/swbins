using System.Text;
using TMPro;
using UnityEngine;
using UnityEngine.InputSystem;
using UnityEngine.UI;
using Saga.Go.Data;

namespace Saga.Go.UI
{
    /// <summary>
    /// tasks U-0043 도움말 창(saga-godot `world/help_guide.gd`) — F1 또는 위 오른쪽 "도움말" 단추로 연다. <see cref="GoHelp"/> 표의 갈래 셋을
    /// 가로 세 칸으로 보여 준다(키는 노란 굵은 글, 뒤에 설명). Esc·"닫는다"·F1 로 닫는다. `WorldMapBuilder` 가 Play 때 붙인다 —
    /// 런타임 UI 라 람다 리스너를 쓴다(`HuntLogUi` 와 같은 결). 세이브에 아무것도 쓰지 않는다.
    /// </summary>
    public class HelpUi : MonoBehaviour
    {
        public static HelpUi Instance { get; private set; }

        private const float ColW = 500f, ColX = 520f, ColTop = 320f; // 논리 폭 1600 → 가운데 ±520·폭 500 이면 ±770 안

        private GameObject _panel;
        private TextMeshProUGUI _title;
        private TextMeshProUGUI[] _cols;

        public Button OpenButton { get; private set; }
        public Button CloseButton { get; private set; }
        public int ColumnCount => _cols?.Length ?? 0;
        public string TitleText => _title.text;
        public string ColumnText(int i) => _cols[i].text;
        public bool IsOpen => _panel != null && _panel.activeSelf;
        public string OpenLabel => OpenButton != null ? OpenButton.GetComponentInChildren<TextMeshProUGUI>().text : "";

        private void Awake() => Instance = this;

        private void OnDestroy() { if (Instance == this) Instance = null; }

        private void Start()
        {
            Build();
            _panel.SetActive(false);
        }

        private static void Center(RectTransform r) => r.pivot = new Vector2(0.5f, 0.5f);

        private void Build()
        {
            var canvas = EncounterUiKit.NewCanvas("HelpUI");
            canvas.sortingOrder = 9; // 사냥 기록(8) 위
            var t = canvas.transform;
            var mid = new Vector2(0.5f, 0.5f);

            OpenButton = EncounterUiKit.NewButton(t, GoLocalization.T("help.button", "도움말"), new Vector2(1f, 1f), new Vector2(-200f, -190f), new Vector2(160f, 50f), null); // 둘째 열, 사냥 기록 밑
            OpenButton.onClick.AddListener(Toggle);

            _panel = new GameObject("HelpPanel", typeof(RectTransform));
            _panel.transform.SetParent(t, false);
            var pr = (RectTransform)_panel.transform;
            pr.anchorMin = Vector2.zero; pr.anchorMax = Vector2.one;
            pr.offsetMin = pr.offsetMax = Vector2.zero;
            _panel.AddComponent<Image>().color = new Color(0.03f, 0.03f, 0.04f, 0.95f);

            _title = EncounterUiKit.NewText(_panel.transform, GoLocalization.T("help.title", "도움말 — 조작 (F1)"), mid, new Vector2(0f, 400f), new Vector2(1000f, 44f), 28);
            _title.fontStyle = FontStyles.Bold;
            Center(_title.rectTransform);

            int n = GoHelp.Sections.Length;
            _cols = new TextMeshProUGUI[n];
            for (int i = 0; i < n; i++)
            {
                float x = (i - (n - 1) / 2f) * ColX;
                _cols[i] = EncounterUiKit.NewText(_panel.transform, "", mid, new Vector2(x, ColTop - 350f), new Vector2(ColW, 700f), 19);
                _cols[i].alignment = TextAlignmentOptions.TopLeft;
                _cols[i].enableAutoSizing = true; _cols[i].fontSizeMin = 13f; _cols[i].fontSizeMax = 19f; // 줄이 길어도 칸 안에 들어오게
                Center(_cols[i].rectTransform);
            }

            CloseButton = EncounterUiKit.NewButton(_panel.transform, GoLocalization.T("dex.close", "닫는다"), mid, new Vector2(0f, -405f), new Vector2(200f, 44f), null);
            Center((RectTransform)CloseButton.transform);
            CloseButton.onClick.AddListener(Close);
        }

        // ---- 동작 ----

        public void Toggle() { if (IsOpen) Close(); else Open(); }

        public void Open()
        {
            if (_panel == null) return;
            Refresh();
            _panel.SetActive(true);
        }

        public void Close() { if (_panel != null) _panel.SetActive(false); }

        // ---- 글 ----

        /// <summary>갈래 하나의 본문 — "<b><color>키</color></b>  설명" 줄을 쌓는다.</summary>
        public static string SectionText(GoHelp.Section s)
        {
            var sb = new StringBuilder();
            sb.Append("<size=24><b><color=#8fd3ff>").Append(GoHelp.SectionName(s)).Append("</color></b></size>\n\n");
            foreach (var l in s.Lines)
            {
                var (keys, text) = GoHelp.Read(l);
                if (keys.Length > 0) sb.Append("<b><color=#ffd54a>").Append(keys).Append("</color></b>  ");
                sb.Append(text).Append("\n\n");
            }
            return sb.ToString();
        }

        public void Refresh()
        {
            if (_cols == null) return;
            _title.text = GoLocalization.T("help.title", "도움말 — 조작 (F1)");
            for (int i = 0; i < _cols.Length; i++) _cols[i].text = SectionText(GoHelp.Sections[i]);
            OpenButton.GetComponentInChildren<TextMeshProUGUI>().text = GoLocalization.T("help.button", "도움말");
        }

        private void Update()
        {
            var kb = Keyboard.current;
            if (kb == null) return;
            if (kb.f1Key.wasPressedThisFrame) Toggle();
            else if (kb.escapeKey.wasPressedThisFrame && IsOpen) Close();
        }
    }
}
