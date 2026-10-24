using System;
using System.Collections.Generic;
using TMPro;
using UnityEngine;
using UnityEngine.InputSystem;
using UnityEngine.UI;

namespace Saga.Core
{
    /// <summary>
    /// tasks U-0213 「오늘」 창(고돗 G-0351 `goals_panel.gd`·웹 W-0380 짝) — 판마다 흩어진 일일·주간 거리를 창 하나에.
    /// 판 어댑터(<see cref="ITodaySource"/>)가 기존 값만 읽어 줄을 주고, 받기는 판 기존 함수. 창은 「오늘」 줄 · 둘째 묶음(이번 주·시즌 등) · 받기 단추 ·
    /// 갈림까지 남은 시간. 시간은 안 멈춘다(일시정지와 별개). Esc 는 `SagaFlowRunner` 가 <see cref="CloseOpen"/> 을 먼저 부른다(☰ 격자와 같은 결).
    /// 창 짓기는 <see cref="Create"/> 에서 바로(에디터 진단이 Play 없이도 줄을 잰다). 1만리는 ☰ 격자 칸이, 다른 세 판은 <see cref="AddHudButton"/> 80×80 이 연다.
    /// </summary>
    public class TodayPanel : MonoBehaviour
    {
        public static readonly Vector2 HudButtonSize = new Vector2(80f, 80f);
        private const int MaxRows = 16;
        private const float PanelW = 1000f, RowStep = 42f, HeadStep = 48f, Gap = 10f, TopY = -84f;

        private struct RowUi { public TextMeshProUGUI Text; public Button Claim; public TextMeshProUGUI ClaimText; }

        private ITodaySource _src;
        private RectTransform _panel;
        private TextMeshProUGUI _title, _todayHead, _weekHead;
        private readonly RowUi[] _rows = new RowUi[MaxRows];
        private readonly List<TodayRow> _today = new List<TodayRow>(), _week = new List<TodayRow>();
        private readonly List<int> _rowClaim = new List<int>();
        private float _tick;

        private static readonly List<TodayPanel> Opened = new List<TodayPanel>();

        public static TodayPanel Instance { get; private set; }
        public ITodaySource Source => _src;
        public Button HudButton { get; private set; }
        public Button CloseButton { get; private set; }
        public bool IsOpen => _panel != null && _panel.gameObject.activeSelf;
        public int TodayCount => _today.Count;
        public int WeekCount => _week.Count;
        /// <summary>보이는 줄(오늘 → 둘째 묶음 순) i 의 글·받기 단추(없으면 null).</summary>
        public string RowText(int i) => _rows[i].Text.text;
        public Button ClaimButton(int i) => _rows[i].Claim.gameObject.activeSelf ? _rows[i].Claim : null;
        public string TodayHeadText => _todayHead.text;
        public string WeekHeadText => _weekHead.text;

        /// <summary>판 어댑터로 창을 짓는다(처음엔 닫힘). parent 를 주면 그 밑에(판 씬과 같이 사라진다).</summary>
        public static TodayPanel Create(ITodaySource source, Transform parent = null)
        {
            SagaUi.EnsureEventSystem();
            var canvas = SagaUi.NewHudCanvas("TodayCanvas", 40, parent); // 이야기 장면 상자(30) 위 · 일시정지(90) 밑 — 판 시즌·문파 단추와 같은 층
            var p = canvas.gameObject.AddComponent<TodayPanel>();
            p._src = source;
            p.Build();
            Instance = p;
            return p;
        }

        private void OnDestroy()
        {
            Opened.Remove(this);
            if (Instance == this) Instance = null;
        }

        /// <summary>오른쪽 위 기준 80×80 단추(📅) — 판 HUD 빈자리에. 누르면 열고 닫는다.</summary>
        public Button AddHudButton(Vector2 at)
        {
            HudButton = SagaUi.NewButton(transform, "Btn_오늘", "📅", new Vector2(1f, 1f), at, HudButtonSize, SagaUi.ButtonIdle, 40f);
            HudButton.onClick.AddListener(Toggle);
            return HudButton;
        }

        private void Build()
        {
            var mid = new Vector2(0.5f, 0.5f);
            var top = new Vector2(0.5f, 1f);
            _panel = SagaUi.NewPanel(transform, "TodayPanel", mid, Vector2.zero, new Vector2(PanelW, 600f), new Color(0.07f, 0.07f, 0.09f, 0.97f), "window").rectTransform;
            SagaUi.Lift(_panel.gameObject, SagaUi.WindowOrder);
            _title = SagaUi.NewText(_panel, SagaUi.L("📅 오늘", "📅 Today"), 34f, SagaUi.Gold, top, new Vector2(0f, -40f), new Vector2(PanelW - 80f, 52f));
            _title.fontStyle = FontStyles.Bold;
            _todayHead = Head("TodayHead");
            _weekHead = Head("WeekHead");
            for (int i = 0; i < MaxRows; i++)
            {
                int k = i;
                var t = SagaUi.NewText(_panel, "", 22f, SagaUi.Ink, top, Vector2.zero, new Vector2(760f, 38f), TextAlignmentOptions.MidlineLeft);
                t.rectTransform.pivot = new Vector2(0f, 0.5f);
                t.textWrappingMode = TextWrappingModes.NoWrap;
                t.enableAutoSizing = true;
                t.fontSizeMin = 14f;
                t.fontSizeMax = 22f;
                t.name = "Row" + i;
                var b = SagaUi.NewButton(_panel, "Btn_받기" + i, SagaUi.L("받기", "Claim"), top, Vector2.zero, new Vector2(150f, 36f), SagaUi.ButtonAccent, 20f);
                b.onClick.AddListener(() => ClaimRow(k));
                _rows[i] = new RowUi { Text = t, Claim = b, ClaimText = b.GetComponentInChildren<TextMeshProUGUI>() };
            }
            CloseButton = SagaUi.NewButton(_panel, "Btn_닫기", SagaUi.L("닫기", "Close"), new Vector2(0.5f, 0f), new Vector2(0f, 48f), new Vector2(240f, 64f), SagaUi.ButtonIdle, 26f);
            CloseButton.onClick.AddListener(Close);
            _panel.gameObject.SetActive(false);
        }

        private TextMeshProUGUI Head(string name)
        {
            var h = SagaUi.NewText(_panel, "", 24f, SagaUi.Gold, new Vector2(0.5f, 1f), Vector2.zero, new Vector2(PanelW - 80f, 36f), TextAlignmentOptions.MidlineLeft);
            h.name = name;
            h.fontStyle = FontStyles.Bold;
            h.textWrappingMode = TextWrappingModes.NoWrap;
            h.enableAutoSizing = true;
            h.fontSizeMin = 16f;
            h.fontSizeMax = 24f;
            return h;
        }

        public void Toggle() { if (IsOpen) Close(); else Open(); }

        public void Open()
        {
            if (_panel == null) return;
            _panel.gameObject.SetActive(true);
            if (!Opened.Contains(this)) Opened.Add(this);
            Refresh();
        }

        public void Close()
        {
            if (_panel != null) _panel.gameObject.SetActive(false);
            Opened.Remove(this);
        }

        /// <summary>열린 「오늘」 창이 있으면 닫고 true — `SagaFlow` 의 Esc 가 부른다(창을 닫는 Esc 가 일시정지까지 열지 않게).</summary>
        public static bool CloseOpen()
        {
            bool any = false;
            for (int i = Opened.Count - 1; i >= 0; i--)
            {
                var p = Opened[i];
                if (p != null && p.IsOpen) { p.Close(); any = true; }
            }
            Opened.RemoveAll(p => p == null || !p.IsOpen);
            return any;
        }

        /// <summary>지금 받을 수 있는 줄 수(1만리 ☰ 칸의 ●N). 창이 닫혀 있어도 센다.</summary>
        public int ClaimableCount()
        {
            if (_src == null) return 0;
            _today.Clear(); _week.Clear();
            _src.Rows(_today, _week);
            int n = 0;
            foreach (var r in _today) if (r.ClaimId >= 0 && r.Claimable) n++;
            foreach (var r in _week) if (r.ClaimId >= 0 && r.Claimable) n++;
            return n;
        }

        private void ClaimRow(int i)
        {
            if (_src == null || i < 0 || i >= _rowClaim.Count || _rowClaim[i] < 0) return;
            _src.Claim(_rowClaim[i]);
            Refresh();
        }

        /// <summary>줄·머리·남은 시간을 새로 한다(열려 있을 때 0.5초마다).</summary>
        public void Refresh()
        {
            if (_src == null || _panel == null) return;
            _today.Clear(); _week.Clear();
            _src.Rows(_today, _week);
            var now = DateTime.Now;
            string head = _src.TodayTitle; // tasks U-0215 — 네 판 "오늘", 5천하 "이번 달 · ○년 ○월"(갈림 없음 → 남은 시간 글 없음)
            _title.text = "📅 " + head;
            _todayHead.text = HeadText(head, _src.NextReset(false, now), now);
            _weekHead.text = HeadText(_src.WeekTitle, _src.NextReset(true, now), now);

            _rowClaim.Clear();
            float y = TopY;
            Place(_todayHead.rectTransform, ref y, HeadStep);
            int used = 0;
            foreach (var r in _today) if (used < MaxRows) Fill(used++, r, ref y);
            y -= Gap;
            _weekHead.gameObject.SetActive(_week.Count > 0);
            if (_week.Count > 0)
            {
                Place(_weekHead.rectTransform, ref y, HeadStep);
                foreach (var r in _week) if (used < MaxRows) Fill(used++, r, ref y);
            }
            for (int i = used; i < MaxRows; i++)
            {
                _rows[i].Text.gameObject.SetActive(false);
                _rows[i].Claim.gameObject.SetActive(false);
            }
            _panel.sizeDelta = new Vector2(PanelW, Mathf.Max(420f, -y + 110f));
        }

        private static void Place(RectTransform rt, ref float y, float step)
        {
            rt.anchoredPosition = new Vector2(0f, y - step * 0.5f);
            y -= step;
        }

        private void Fill(int i, TodayRow r, ref float y)
        {
            var ui = _rows[i];
            float cy = y - RowStep * 0.5f;
            ui.Text.gameObject.SetActive(true);
            ui.Text.text = r.Text;
            ui.Text.color = r.Done ? SagaUi.InkDim : SagaUi.Ink;
            ui.Text.rectTransform.anchoredPosition = new Vector2(-PanelW * 0.5f + 40f, cy);
            bool hasClaim = r.ClaimId >= 0;
            ui.Claim.gameObject.SetActive(hasClaim);
            if (hasClaim)
            {
                ((RectTransform)ui.Claim.transform).anchoredPosition = new Vector2(PanelW * 0.5f - 40f - 75f, cy);
                ui.Claim.interactable = r.Claimable;
                ui.ClaimText.text = r.Done ? SagaUi.L("받음", "Claimed") : SagaUi.L("받기", "Claim");
            }
            _rowClaim.Add(r.ClaimId);
            y -= RowStep;
        }

        /// <summary>"오늘 · 새로까지 3시간 12분" — 갈림이 없으면 머리만.</summary>
        public static string HeadText(string head, DateTime next, DateTime now)
        {
            if (next == DateTime.MinValue || next <= now) return head;
            return head + "  <size=75%><color=#b9c2cc>" + string.Format(SagaUi.L("· 새로까지 {0}", "· resets in {0}"), LeftText(next - now)) + "</color></size>";
        }

        /// <summary>남은 시간 글 — 하루 넘으면 일·시간, 아니면 시간·분.</summary>
        public static string LeftText(TimeSpan left)
        {
            if (left < TimeSpan.Zero) left = TimeSpan.Zero;
            if (left.TotalDays >= 1) return string.Format(SagaUi.L("{0}일 {1}시간", "{0}d {1}h"), (int)left.TotalDays, left.Hours);
            return string.Format(SagaUi.L("{0}시간 {1}분", "{0}h {1}m"), left.Hours, left.Minutes);
        }

        /// <summary>다음 날 갈림 — 현지 시각 hour 시(새벽 4시면 4).</summary>
        public static DateTime NextDaily(DateTime now, int hour)
        {
            var d = now.AddHours(-hour).Date;
            return d.AddDays(1).AddHours(hour);
        }

        /// <summary>다음 주 갈림 — 현지 월요일 hour 시.</summary>
        public static DateTime NextMonday(DateTime now, int hour)
        {
            var d = now.AddHours(-hour).Date;
            int n = ((int)DayOfWeek.Monday - (int)d.DayOfWeek + 7) % 7;
            if (n == 0) n = 7;
            return d.AddDays(n).AddHours(hour);
        }

        private void Update()
        {
            if (!IsOpen) return;
            var kb = Keyboard.current;
            if (SagaFlowRunner.Instance == null && kb != null && kb.escapeKey.wasPressedThisFrame) { Close(); return; }
            _tick -= Time.unscaledDeltaTime;
            if (_tick > 0f) return;
            _tick = 0.5f;
            Refresh();
        }
    }
}
