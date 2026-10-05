using System.Collections.Generic;
using TMPro;
using UnityEngine;
using UnityEngine.InputSystem;
using UnityEngine.UI;
using Saga.Go.Data;

namespace Saga.Go.UI
{
    /// <summary>
    /// tasks U-0044 주간 도전 창(saga-godot `world/weekly_goals.gd`, 키 Z → 이 트랙은 Z 가 나는 탈것 내려가기라 U) — U 키 또는 위 오른쪽
    /// "주간 도전"(받을 게 있으면 ●N) 단추로 연다. 이번 주 도전 다섯 줄: 이름·설명·진척/목표·막대·받기 단추 + 다섯 다 받으면 "완주 보상".
    /// 0.5초마다 새로 채운 도전을 알린다(불러온 직후 첫 확인은 기준만 잡고 조용히). `WorldMapBuilder` 가 Play 때 붙인다 —
    /// 런타임 UI 라 람다 리스너를 쓴다(`HuntLogUi` 와 같은 결). 세이브는 `SaveState` 가 `WeeklyState` 를 알아서 담는다.
    /// </summary>
    public class WeeklyUi : MonoBehaviour
    {
        public static WeeklyUi Instance { get; private set; }

        public const float CheckSec = 0.5f;
        private const float RowTop = 280f, RowStep = 110f, BarW = 800f;

        private GameObject _panel;
        private TextMeshProUGUI _title, _rewardLine;
        private TextMeshProUGUI[] _rows;
        private Button[] _claim;
        private TextMeshProUGUI[] _claimText;
        private RectTransform[] _barFill;
        private float _check;

        public Button OpenButton { get; private set; }
        public Button BonusButton { get; private set; }
        public Button CloseButton { get; private set; }
        public int RowCount => GoWeekly.PerWeek;
        public Button ClaimButton(int i) => _claim[i];
        public string RowText(int i) => _rows[i].text;
        public string TitleText => _title.text;
        public string OpenLabel => OpenButton.GetComponentInChildren<TextMeshProUGUI>().text;
        public bool IsOpen => _panel != null && _panel.activeSelf;

        private void Awake() => Instance = this;

        private void OnDestroy()
        {
            WeeklyState.Changed -= OnChanged;
            if (Instance == this) Instance = null;
        }

        private void Start()
        {
            Build();
            WeeklyState.Changed += OnChanged;
            _panel.SetActive(false);
            Refresh();
        }

        private void OnChanged() => Refresh();

        private static void Center(RectTransform r) => r.pivot = new Vector2(0.5f, 0.5f);

        private void Build()
        {
            int n = GoWeekly.PerWeek;
            _rows = new TextMeshProUGUI[n]; _claim = new Button[n]; _claimText = new TextMeshProUGUI[n]; _barFill = new RectTransform[n];
            var canvas = EncounterUiKit.NewCanvas("WeeklyUI");
            canvas.sortingOrder = 8;
            var t = canvas.transform;
            var mid = new Vector2(0.5f, 0.5f);

            OpenButton = EncounterUiKit.NewButton(t, GoLocalization.T("weekly.button", "주간 도전"), new Vector2(1f, 1f), new Vector2(-30f, -594f), new Vector2(160f, 50f), null); // 도움말(−534) 밑
            OpenButton.onClick.AddListener(Toggle);

            _panel = new GameObject("WeeklyPanel", typeof(RectTransform));
            _panel.transform.SetParent(t, false);
            var pr = (RectTransform)_panel.transform;
            pr.anchorMin = Vector2.zero; pr.anchorMax = Vector2.one;
            pr.offsetMin = pr.offsetMax = Vector2.zero;
            _panel.AddComponent<Image>().color = new Color(0.03f, 0.03f, 0.04f, 0.93f);

            _title = EncounterUiKit.NewText(_panel.transform, "", mid, new Vector2(-120f, 390f), new Vector2(1000f, 40f), 26);
            _title.fontStyle = FontStyles.Bold;
            Center(_title.rectTransform);
            BonusButton = EncounterUiKit.NewButton(_panel.transform, GoLocalization.T("weekly.bonus", "완주 보상"), mid, new Vector2(560f, 390f), new Vector2(260f, 48f), null);
            Center((RectTransform)BonusButton.transform);
            BonusButton.GetComponentInChildren<TextMeshProUGUI>().fontSize = 20;
            BonusButton.onClick.AddListener(ClaimBonus);
            _rewardLine = EncounterUiKit.NewText(_panel.transform, "", mid, new Vector2(0f, 335f), new Vector2(1400f, 30f), 16);
            _rewardLine.color = new Color(0.72f, 0.76f, 0.8f);
            Center(_rewardLine.rectTransform);

            for (int i = 0; i < n; i++)
            {
                int k = i;
                float y = RowTop - i * RowStep;
                var root = new GameObject("Row" + i, typeof(RectTransform));
                root.transform.SetParent(_panel.transform, false);
                var rr = (RectTransform)root.transform;
                rr.anchorMin = rr.anchorMax = mid;
                rr.sizeDelta = Vector2.zero;
                _rows[i] = EncounterUiKit.NewText(root.transform, "", mid, new Vector2(-230f, y), new Vector2(820f, 70f), 19);
                _rows[i].alignment = TextAlignmentOptions.MidlineLeft;
                Center(_rows[i].rectTransform);
                var bg = new GameObject("BarBg", typeof(RectTransform));
                bg.transform.SetParent(root.transform, false);
                var br = (RectTransform)bg.transform;
                br.anchorMin = br.anchorMax = mid;
                br.pivot = new Vector2(0f, 0.5f);
                br.anchoredPosition = new Vector2(-230f - 410f, y - 44f);
                br.sizeDelta = new Vector2(BarW, 6f);
                bg.AddComponent<Image>().color = new Color(0.2f, 0.2f, 0.22f);
                var fill = new GameObject("BarFill", typeof(RectTransform));
                fill.transform.SetParent(bg.transform, false);
                var fr = (RectTransform)fill.transform;
                fr.anchorMin = new Vector2(0f, 0f); fr.anchorMax = new Vector2(0f, 1f);
                fr.pivot = new Vector2(0f, 0.5f);
                fr.anchoredPosition = Vector2.zero;
                fr.sizeDelta = Vector2.zero;
                fill.AddComponent<Image>().color = new Color(0.55f, 0.75f, 0.95f);
                _barFill[i] = fr;
                _claim[i] = EncounterUiKit.NewButton(root.transform, GoLocalization.T("weekly.claim", "받기"), mid, new Vector2(330f, y - 4f), new Vector2(200f, 44f), null);
                Center((RectTransform)_claim[i].transform);
                _claimText[i] = _claim[i].GetComponentInChildren<TextMeshProUGUI>();
                _claimText[i].fontSize = 18;
                _claim[i].onClick.AddListener(() => Claim(k));
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
            _panel.SetActive(true);
            Refresh();
        }

        public void Close() { if (_panel != null) _panel.SetActive(false); }

        public void Claim(int row)
        {
            var picks = WeeklyState.Picks();
            if (row < 0 || row >= picks.Length) return;
            string t = WeeklyState.Claim(picks[row]);
            if (t.Length > 0) Toast(string.Format(GoLocalization.T("weekly.got", "주간 도전 보상을 받았다 — {0}"), t));
            Refresh();
        }

        public void ClaimBonus()
        {
            string t = WeeklyState.ClaimBonus();
            if (t.Length > 0) Toast(string.Format(GoLocalization.T("weekly.got_bonus", "주간 도전 완주! — {0}"), t));
            Refresh();
        }

        private static void Toast(string text)
        {
            if (DialogueLabel.Instance != null && !string.IsNullOrEmpty(text)) DialogueLabel.Instance.Show(text, 2.5f);
        }

        /// <summary>새로 채운 도전을 알린다 — 알린 id 목록(진단도 부른다).</summary>
        public List<string> CheckNow()
        {
            var list = WeeklyState.Check();
            foreach (var id in list)
                Toast(string.Format(GoLocalization.T("weekly.notice", "주간 도전 — {0} 달성 (U 에서 받기)"), GoWeekly.Get(id).Name));
            return list;
        }

        // ---- 글 ----

        /// <summary>줄 글 — 이름(굵게)·설명·진척.</summary>
        public static string LineText(string id)
        {
            var g = GoWeekly.Get(id);
            int p = Mathf.Min(WeeklyState.Progress(id), g.Target);
            string tail = WeeklyState.Claimed(id)
                ? GoLocalization.T("weekly.claimed", "받음")
                : string.Format("{0}/{1}", p, g.Target);
            return $"<b>{g.Name}</b>  <size=15><color=#b9c2cc>{g.Desc}</color></size>\n<size=16><color=#ffd54a>{tail}</color></size>";
        }

        public void Refresh()
        {
            if (_panel == null) return;
            var picks = WeeklyState.Picks();
            int claimable = WeeklyState.Claimable().Count;
            int total = claimable + (WeeklyState.BonusReady ? 1 : 0);
            var open = OpenButton.GetComponentInChildren<TextMeshProUGUI>();
            open.text = GoLocalization.T("weekly.button", "주간 도전") + (total > 0 ? " ●" + total : "");
            open.color = total > 0 ? new Color(1f, 0.88f, 0.4f) : Color.white;
            if (!IsOpen) return;
            _title.text = string.Format(GoLocalization.T("weekly.title", "주간 도전 — 이번 주 {0}/{1} (월요일 새벽 4시에 새로)"), WeeklyState.ClaimedCount(), GoWeekly.PerWeek);
            _rewardLine.text = string.Format(GoLocalization.T("weekly.reward_line", "도전마다 {0} · 다섯 다 받으면 {1}"), GoWeekly.GoalRewardText(), GoWeekly.BonusRewardText());
            BonusButton.interactable = WeeklyState.BonusReady;
            BonusButton.GetComponentInChildren<TextMeshProUGUI>().text = WeeklyState.BonusClaimed
                ? GoLocalization.T("weekly.bonus_done", "완주 보상 받음")
                : GoLocalization.T("weekly.bonus", "완주 보상");
            for (int i = 0; i < picks.Length; i++)
            {
                string id = picks[i];
                var g = GoWeekly.Get(id);
                bool claimed = WeeklyState.Claimed(id), done = WeeklyState.Done(id);
                _rows[i].text = LineText(id);
                _barFill[i].sizeDelta = new Vector2(BarW * Mathf.Clamp01(claimed ? 1f : WeeklyState.Progress(id) / (float)g.Target), 0f);
                _claim[i].interactable = done && !claimed;
                _claimText[i].text = claimed ? GoLocalization.T("weekly.claimed", "받음") : GoLocalization.T("weekly.claim", "받기");
            }
        }

        private void Update()
        {
            var kb = Keyboard.current;
            if (kb != null)
            {
                if (kb.uKey.wasPressedThisFrame) Toggle();
                else if (kb.escapeKey.wasPressedThisFrame && IsOpen) Close();
            }
            _check -= Time.unscaledDeltaTime;
            if (_check <= 0f) { _check = CheckSec; CheckNow(); Refresh(); }
        }
    }
}
