using System;
using System.Collections.Generic;
using TMPro;
using UnityEngine;
using UnityEngine.InputSystem;
using UnityEngine.UI;
using Saga.Go.Data;

namespace Saga.Go.UI
{
    /// <summary>
    /// 메뉴 허브(saga-godot "왼쪽 가운데 메뉴") — 사냥 기록(K)·주간 도전(U)·재출항(N)·신수 알(I)·도움말(F1) 단추를 오른쪽 가장자리에 줄줄이 두면
    /// 오른쪽 아래 전투 단추·낚시 단추·대사 줄과 겹쳐서(`UiLayoutCheck`), 위 오른쪽 **"메뉴" 단추 하나**로 합친다. 누르면 다섯 줄 목록이 뜨고 줄을 누르면
    /// 이 창이 닫히며 그 창이 열린다. 줄 글은 각 창의 단추 글(받을 게 있으면 ●N)을 그대로 읽어 ● 도 함께 보인다. 각 창의 키와 `OpenButton` 은 그대로
    /// (원래 단추는 숨기기만 한다 — 진단·키가 계속 쓴다). `WorldMapBuilder` 가 Play 때 붙인다.
    /// </summary>
    public class MenuHubUi : MonoBehaviour
    {
        public static MenuHubUi Instance { get; private set; }

        private struct Entry { public string Hint; public Func<string> Label; public Action Open; public Func<bool> Exists; public Button Btn; public TextMeshProUGUI Text; }

        private GameObject _panel;
        private readonly List<Entry> _entries = new List<Entry>();
        private float _tick;

        public Button OpenButton { get; private set; }
        public Button CloseButton { get; private set; }
        public bool IsOpen => _panel != null && _panel.activeSelf;
        public int EntryCount => _entries.Count;
        public Button EntryButton(int i) => _entries[i].Btn;
        public string EntryText(int i) => _entries[i].Text.text;
        public string OpenLabel => OpenButton.GetComponentInChildren<TextMeshProUGUI>().text;

        private void Awake() => Instance = this;
        private void OnDestroy() { if (Instance == this) Instance = null; }

        private void Start()
        {
            Build();
            _panel.SetActive(false);
            Refresh();
        }

        private static void Center(RectTransform r) => r.pivot = new Vector2(0.5f, 0.5f);

        private void Add(Transform panel, int index, string hint, Func<string> label, Action open, Func<bool> exists)
        {
            var mid = new Vector2(0.5f, 0.5f);
            var btn = EncounterUiKit.NewButton(panel, "", mid, new Vector2(0f, 170f - index * 84f), new Vector2(520f, 68f), null);
            Center((RectTransform)btn.transform);
            var text = btn.GetComponentInChildren<TextMeshProUGUI>(); text.fontSize = 22;
            btn.onClick.AddListener(() => { Close(); open(); });
            _entries.Add(new Entry { Hint = hint, Label = label, Open = open, Exists = exists, Btn = btn, Text = text });
        }

        private void Build()
        {
            var canvas = EncounterUiKit.NewCanvas("MenuHubUI");
            canvas.sortingOrder = 7;
            var t = canvas.transform;
            var mid = new Vector2(0.5f, 0.5f);

            // 위 오른쪽 — 일시정지(왼쪽)와 저장(오른쪽 모서리) 사이 빈 틈. 전투·낚시 단추·대사 줄과도 안 겹친다.
            OpenButton = EncounterUiKit.NewButton(t, GoLocalization.T("menu.button", "메뉴"), new Vector2(1f, 1f), new Vector2(-215f, -40f), new Vector2(160f, 60f), null);
            OpenButton.onClick.AddListener(Toggle);

            _panel = new GameObject("MenuPanel", typeof(RectTransform));
            _panel.transform.SetParent(t, false);
            var pr = (RectTransform)_panel.transform;
            pr.anchorMin = Vector2.zero; pr.anchorMax = Vector2.one;
            pr.offsetMin = pr.offsetMax = Vector2.zero;
            _panel.AddComponent<Image>().color = new Color(0.03f, 0.03f, 0.04f, 0.92f);
            var title = EncounterUiKit.NewText(_panel.transform, GoLocalization.T("menu.title", "메뉴"), mid, new Vector2(0f, 300f), new Vector2(800f, 48f), 30);
            title.fontStyle = FontStyles.Bold; Center(title.rectTransform);

            int i = 0;
            Add(_panel.transform, i++, "F1", () => HelpUi.Instance != null ? HelpUi.Instance.OpenLabel : "", () => HelpUi.Instance?.Open(), () => HelpUi.Instance != null);
            Add(_panel.transform, i++, "K", () => HuntLogUi.Instance != null ? HuntLogUi.Instance.OpenLabel : "", () => HuntLogUi.Instance?.Open(), () => HuntLogUi.Instance != null);
            Add(_panel.transform, i++, "U", () => WeeklyUi.Instance != null ? WeeklyUi.Instance.OpenLabel : "", () => WeeklyUi.Instance?.Open(), () => WeeklyUi.Instance != null);
            Add(_panel.transform, i++, "N", () => CycleUi.Instance != null ? CycleUi.Instance.OpenLabel : "", () => CycleUi.Instance?.Open(), () => CycleUi.Instance != null);
            Add(_panel.transform, i++, "I", () => EggUi.Instance != null ? EggUi.Instance.OpenLabel : "", () => EggUi.Instance?.Open(), () => EggUi.Instance != null);

            CloseButton = EncounterUiKit.NewButton(_panel.transform, GoLocalization.T("dex.close", "닫는다"), mid, new Vector2(0f, -405f), new Vector2(200f, 44f), null);
            Center((RectTransform)CloseButton.transform);
            CloseButton.onClick.AddListener(Close);
        }

        public void Toggle() { if (IsOpen) Close(); else Open(); }
        public void Open() { if (_panel == null) return; _panel.SetActive(true); Refresh(); }
        public void Close() { if (_panel != null) _panel.SetActive(false); }

        /// <summary>줄 글·허브 단추의 ● 를 새로 하고, 각 창이 만든 원래 단추는 숨긴다(이 허브가 대신 연다).</summary>
        public void Refresh()
        {
            if (_panel == null) return;
            bool any = false;
            foreach (var e in _entries)
            {
                bool exists = e.Exists();
                e.Btn.gameObject.SetActive(exists);
                if (!exists) continue;
                string label = e.Label();
                if (label.Contains("●")) any = true;
                e.Text.text = $"{label}   <size=16><color=#b9c2cc>[{e.Hint}]</color></size>";
            }
            HideOriginals();
            var open = OpenButton.GetComponentInChildren<TextMeshProUGUI>();
            open.text = GoLocalization.T("menu.button", "메뉴") + (any ? " ●" : "");
            open.color = any ? new Color(1f, 0.88f, 0.4f) : Color.white;
        }

        private static void HideOriginals()
        {
            if (HelpUi.Instance != null && HelpUi.Instance.OpenButton != null) HelpUi.Instance.OpenButton.gameObject.SetActive(false);
            if (HuntLogUi.Instance != null && HuntLogUi.Instance.OpenButton != null) HuntLogUi.Instance.OpenButton.gameObject.SetActive(false);
            if (WeeklyUi.Instance != null && WeeklyUi.Instance.OpenButton != null) WeeklyUi.Instance.OpenButton.gameObject.SetActive(false);
            if (CycleUi.Instance != null && CycleUi.Instance.OpenButton != null) CycleUi.Instance.OpenButton.gameObject.SetActive(false);
            if (EggUi.Instance != null && EggUi.Instance.OpenButton != null) EggUi.Instance.OpenButton.gameObject.SetActive(false);
        }

        private void Update()
        {
            var kb = Keyboard.current;
            if (kb != null && IsOpen && kb.escapeKey.wasPressedThisFrame) Close();
            _tick -= Time.unscaledDeltaTime;
            if (_tick > 0f) return;
            _tick = 0.5f;
            Refresh();
        }
    }
}
