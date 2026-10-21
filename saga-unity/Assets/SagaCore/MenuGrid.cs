using System;
using System.Collections.Generic;
using TMPro;
using UnityEngine;
using UnityEngine.InputSystem;
using UnityEngine.UI;

namespace Saga.Core
{
    /// <summary>
    /// U-0154(웹 W-0253~0255 짝) — ☰ 메뉴 화면. 화면을 덮는 판 색 옷 카드 격자(가로 화면 5열·세로 3열) 하나에 큰 아이콘 + 이름(+ ●N) 칸을 둔다.
    /// 칸은 각 창의 여는 동작을 그대로 부른다(창·키·진단은 안 바꾼다 — 원래 단추는 부르는 쪽이 숨기기만). 열려도 시간은 안 멈춘다(일시정지와 별개).
    /// 칸 그림은 `Resources/Icons/icon128/&lt;icon&gt;_g0`, 없으면 이름만. 틀은 U-0153 스킨(card), 없으면 단색.
    /// </summary>
    public class MenuGrid : MonoBehaviour
    {
        private struct Entry { public string Hint; public Func<string> Label; public Action Open; public Func<bool> Exists; public string Icon; public Button Btn; public TextMeshProUGUI Text; }

        public static readonly Vector2 Cell = new Vector2(260f, 200f);
        private const float Gap = 24f;

        private readonly List<Entry> _entries = new List<Entry>();
        private GameObject _panel;
        private RectTransform _grid;
        private TextMeshProUGUI _title;
        private float _tick;
        private bool _narrow;

        public Button CloseButton { get; private set; }
        public bool IsOpen => _panel != null && _panel.activeSelf;
        public int EntryCount => _entries.Count;
        public Button EntryButton(int i) => _entries[i].Btn;
        public string EntryText(int i) => _entries[i].Text.text;
        /// <summary>보이는 칸 중 하나라도 ● 가 있으면 true — 부르는 쪽이 ☰ 단추에 ● 를 단다.</summary>
        public bool AnyBadge { get; private set; }
        public int Columns => _narrow ? 3 : 5;

        /// <summary>판 HUD 캔버스 밑에 메뉴 화면을 만든다(처음엔 닫힘). title = 화면 맨 위 글, closeLabel = 닫기 단추 글.</summary>
        public static MenuGrid Create(Transform canvas, string title, string closeLabel)
        {
            var root = SagaUi.Fill(canvas, "MenuGrid");
            var g = root.gameObject.AddComponent<MenuGrid>();
            g.Build(title, closeLabel);
            return g;
        }

        private void Build(string title, string closeLabel)
        {
            _panel = gameObject;
            var dim = gameObject.AddComponent<Image>();
            dim.color = new Color(0.03f, 0.03f, 0.04f, 0.92f);
            var mid = new Vector2(0.5f, 0.5f);
            _title = SagaUi.NewText(transform, title, 34f, SagaUi.Gold, new Vector2(0.5f, 1f), new Vector2(0f, -60f), new Vector2(800f, 56f));
            _title.fontStyle = FontStyles.Bold;
            _grid = SagaUi.NewRect(transform, "Cells", mid, new Vector2(0f, 10f), Vector2.zero);
            CloseButton = SagaUi.NewButton(transform, "Close", closeLabel, new Vector2(0.5f, 0f), new Vector2(0f, 50f), new Vector2(240f, 64f), SagaUi.ButtonIdle, 26f);
            CloseButton.onClick.AddListener(Close);
            _panel.SetActive(false);
        }

        /// <summary>칸 하나. hint = 키 표기(F1·K 등, 없으면 null), label = 창 단추 글(●N 그대로), icon = 아이콘 키(없으면 null).</summary>
        public void Register(string hint, Func<string> label, Action open, Func<bool> exists, string icon)
        {
            var cell = SagaUi.NewPanel(_grid, "Cell_" + _entries.Count, new Vector2(0.5f, 0.5f), Vector2.zero, Cell, SagaUi.Panel, "card");
            var btn = cell.gameObject.AddComponent<Button>();
            btn.targetGraphic = cell;
            var sprite = string.IsNullOrEmpty(icon) ? null : Resources.Load<Sprite>("Icons/icon128/" + icon + "_g0");
            if (sprite != null)
            {
                var img = SagaUi.NewRect(cell.transform, "Icon", new Vector2(0.5f, 1f), new Vector2(0f, -66f), new Vector2(96f, 96f)).gameObject.AddComponent<Image>();
                img.sprite = sprite;
                img.preserveAspect = true;
                img.raycastTarget = false;
            }
            var text = SagaUi.NewText(cell.transform, "", 22f, SagaUi.Ink, new Vector2(0.5f, 0f), new Vector2(0f, sprite != null ? 46f : 100f), new Vector2(Cell.x - 24f, sprite != null ? 70f : 120f));
            text.fontStyle = FontStyles.Bold;
            Action o = open;
            btn.onClick.AddListener(() => { Close(); o(); });
            _entries.Add(new Entry { Hint = hint, Label = label, Open = open, Exists = exists, Icon = icon, Btn = btn, Text = text });
            Layout();
        }

        /// <summary>보이는 칸만 줄 맞춰 놓는다 — 가로 5열·세로 3열, 가운데 정렬.</summary>
        private void Layout()
        {
            _narrow = SagaUi.IsNarrow();
            var shown = new List<Entry>();
            foreach (var e in _entries) if (e.Btn.gameObject.activeSelf) shown.Add(e);
            int cols = Columns, rows = Mathf.Max(1, (shown.Count + cols - 1) / cols);
            for (int i = 0; i < shown.Count; i++)
            {
                int r = i / cols, c = i % cols;
                int inRow = Mathf.Min(cols, shown.Count - r * cols);
                float x = (c - (inRow - 1) * 0.5f) * (Cell.x + Gap);
                float y = ((rows - 1) * 0.5f - r) * (Cell.y + Gap);
                ((RectTransform)shown[i].Btn.transform).anchoredPosition = new Vector2(x, y);
            }
        }

        public void Toggle() { if (IsOpen) Close(); else Open(); }
        public void Open() { if (_panel == null) return; _panel.SetActive(true); _panel.transform.SetAsLastSibling(); Refresh(); }
        public void Close() { if (_panel != null) _panel.SetActive(false); }

        /// <summary>칸 글(창 단추 글 + [키])·보임을 새로 하고 ● 여부를 센다. 닫혀 있어도 부른다(☰ 단추의 ●).</summary>
        public void Refresh()
        {
            bool any = false;
            foreach (var e in _entries)
            {
                bool exists = e.Exists == null || e.Exists();
                e.Btn.gameObject.SetActive(exists);
                if (!exists) continue;
                string label = e.Label != null ? e.Label() : "";
                if (label.Contains("●")) any = true;
                e.Text.text = string.IsNullOrEmpty(e.Hint) ? label : $"{label}\n<size=16><color=#b9c2cc>[{e.Hint}]</color></size>";
            }
            AnyBadge = any;
            Layout();
        }

        private void Update()
        {
            if (!IsOpen) return;
            var kb = Keyboard.current;
            if (kb != null && kb.escapeKey.wasPressedThisFrame) { Close(); return; }
            _tick -= Time.unscaledDeltaTime;
            if (_tick > 0f) return;
            _tick = 0.5f;
            Refresh();
        }
    }
}
