using System.Collections.Generic;
using System.Text;
using TMPro;
using UnityEngine;
using UnityEngine.InputSystem;
using UnityEngine.UI;
using Saga.Go.Data;

namespace Saga.Go.UI
{
    /// <summary>
    /// PLAN.md 109-14-25 업적 창(웹 사가만리 ⑲-25 업적 시트) — Y 키 또는 위 오른쪽 "업적"(받을 게 있으면 ●N) 단추로 연다.
    /// 갈래 탭 다섯(받을 게 있으면 ●N) · 업적마다 별·진척 글·막대·다음 보상 + 받기 단추 · 모두 받기. 0.5초마다 새로 닿은 단계를 알린다
    /// (불러온 직후 첫 확인은 기준만 잡고 조용히). `WorldMapBuilder` 가 Play 때 붙인다 — 런타임 UI 라 람다 리스너를 쓴다.
    /// </summary>
    public class AchieveUi : MonoBehaviour
    {
        public static AchieveUi Instance { get; private set; }

        public const int MaxRows = 5;
        private const float RowTop = 235f, RowStep = 72f, BarW = 800f;
        public const float CheckSec = 0.5f;

        private GameObject _panel;
        private TextMeshProUGUI _title;
        private readonly Button[] _tabs = new Button[5];
        private readonly TextMeshProUGUI[] _tabText = new TextMeshProUGUI[5];
        private readonly TextMeshProUGUI[] _rows = new TextMeshProUGUI[MaxRows];
        private readonly Button[] _claim = new Button[MaxRows];
        private readonly TextMeshProUGUI[] _claimText = new TextMeshProUGUI[MaxRows];
        private readonly RectTransform[] _barFill = new RectTransform[MaxRows];
        private readonly GameObject[] _rowRoot = new GameObject[MaxRows];
        private readonly GameObject[] _barBg = new GameObject[MaxRows];
        private float _check;

        public GoAchieve.Cat Tab { get; private set; } = GoAchieve.Cat.World;
        public Button OpenButton { get; private set; }
        public Button AllButton { get; private set; }
        public Button CloseButton { get; private set; }
        public Button TabButton(int i) => _tabs[i];
        public Button ClaimButton(int i) => _claim[i];
        public string RowText(int i) => _rows[i].text;
        public bool RowShown(int i) => _rowRoot[i].activeSelf;
        public string TabLabel(int i) => _tabText[i].text;
        public string TitleText => _title.text;
        public string OpenLabel => OpenButton.GetComponentInChildren<TextMeshProUGUI>().text;
        public bool IsOpen => _panel != null && _panel.activeSelf;

        private void Awake() => Instance = this;

        private void OnDestroy()
        {
            AchieveState.Changed -= OnChanged;
            if (Instance == this) Instance = null;
        }

        private void Start()
        {
            Build();
            AchieveState.Changed += OnChanged;
            _panel.SetActive(false);
            Refresh();
        }

        private void OnChanged() => Refresh();

        private static void Center(RectTransform r) => r.pivot = new Vector2(0.5f, 0.5f);

        private void Build()
        {
            var canvas = EncounterUiKit.NewCanvas("AchieveUI");
            canvas.sortingOrder = 8;
            var t = canvas.transform;
            var mid = new Vector2(0.5f, 0.5f);

            OpenButton = EncounterUiKit.NewButton(t, GoLocalization.T("ach.button", "업적"), new Vector2(1f, 1f), new Vector2(-30f, -414f), new Vector2(160f, 50f), null); // 도감(−330~−410) 밑·전투 폭발 단추(아래에서 430) 위 사이 틈
            OpenButton.onClick.AddListener(Toggle);

            _panel = new GameObject("AchievePanel", typeof(RectTransform));
            _panel.transform.SetParent(t, false);
            var pr = (RectTransform)_panel.transform;
            pr.anchorMin = Vector2.zero; pr.anchorMax = Vector2.one;
            pr.offsetMin = pr.offsetMax = Vector2.zero;
            _panel.AddComponent<Image>().color = new Color(0.03f, 0.03f, 0.04f, 0.93f);

            _title = EncounterUiKit.NewText(_panel.transform, "", mid, new Vector2(-120f, 390f), new Vector2(1000f, 40f), 26);
            _title.fontStyle = FontStyles.Bold;
            Center(_title.rectTransform);
            AllButton = EncounterUiKit.NewButton(_panel.transform, GoLocalization.T("ach.claim_all", "모두 받기"), mid, new Vector2(560f, 390f), new Vector2(260f, 48f), null);
            Center((RectTransform)AllButton.transform);
            AllButton.GetComponentInChildren<TextMeshProUGUI>().fontSize = 20;
            AllButton.onClick.AddListener(ClaimAll);

            for (int i = 0; i < 5; i++)
            {
                int k = i;
                _tabs[i] = EncounterUiKit.NewButton(_panel.transform, "", mid, new Vector2((i - 2) * 238f, 322f), new Vector2(230f, 50f), null);
                Center((RectTransform)_tabs[i].transform);
                _tabText[i] = _tabs[i].GetComponentInChildren<TextMeshProUGUI>();
                _tabText[i].fontSize = 18;
                _tabs[i].onClick.AddListener(() => SelectTab((GoAchieve.Cat)k));
            }

            for (int i = 0; i < MaxRows; i++)
            {
                int k = i;
                float y = RowTop - i * RowStep;
                var root = new GameObject("Row" + i, typeof(RectTransform));
                root.transform.SetParent(_panel.transform, false);
                var rr = (RectTransform)root.transform;
                rr.anchorMin = rr.anchorMax = mid;
                rr.sizeDelta = Vector2.zero;
                _rowRoot[i] = root;
                _rows[i] = EncounterUiKit.NewText(root.transform, "", mid, new Vector2(-230f, y), new Vector2(820f, 52f), 17);
                _rows[i].alignment = TextAlignmentOptions.MidlineLeft;
                _rows[i].lineSpacing = -6f;
                Center(_rows[i].rectTransform);
                var bg = new GameObject("BarBg", typeof(RectTransform));
                bg.transform.SetParent(root.transform, false);
                var br = (RectTransform)bg.transform;
                br.anchorMin = br.anchorMax = mid;
                br.pivot = new Vector2(0f, 0.5f);
                br.anchoredPosition = new Vector2(-230f - 410f, y - 33f);
                br.sizeDelta = new Vector2(BarW, 6f);
                bg.AddComponent<Image>().color = new Color(0.2f, 0.2f, 0.22f);
                _barBg[i] = bg;
                var fill = new GameObject("BarFill", typeof(RectTransform));
                fill.transform.SetParent(bg.transform, false);
                var fr = (RectTransform)fill.transform;
                fr.anchorMin = new Vector2(0f, 0f); fr.anchorMax = new Vector2(0f, 1f);
                fr.pivot = new Vector2(0f, 0.5f);
                fr.anchoredPosition = Vector2.zero;
                fr.sizeDelta = new Vector2(0f, 0f);
                fill.AddComponent<Image>().color = new Color(1f, 0.82f, 0.3f);
                _barFill[i] = fr;
                _claim[i] = EncounterUiKit.NewButton(root.transform, GoLocalization.T("ach.claim", "받기"), mid, new Vector2(330f, y), new Vector2(200f, 48f), null);
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

        public void SelectTab(GoAchieve.Cat c)
        {
            Tab = c;
            Refresh();
        }

        private List<GoAchieve.Entry> RowsOfTab()
        {
            var l = new List<GoAchieve.Entry>();
            foreach (var a in GoAchieve.All) if (a.Cat == Tab) l.Add(a);
            return l;
        }

        public void Claim(int row)
        {
            var l = RowsOfTab();
            if (row < 0 || row >= l.Count) return;
            string t = AchieveState.Claim(l[row].Id);
            if (t.Length > 0) Toast(string.Format(GoLocalization.T("ach.got", "업적을 받았다 — {0}"), t));
            Refresh();
        }

        public void ClaimAll()
        {
            int n = AchieveState.ClaimAll();
            if (n > 0) Toast(string.Format(GoLocalization.T("ach.got_all", "업적 {0} 단계를 받았다"), n));
            Refresh();
        }

        private static void Toast(string text)
        {
            if (DialogueLabel.Instance != null && !string.IsNullOrEmpty(text)) DialogueLabel.Instance.Show(text, 2.5f);
        }

        /// <summary>새로 닿은 단계를 알린다 — 알린 목록(진단도 부른다).</summary>
        public List<(GoAchieve.Entry a, int tier)> CheckNow()
        {
            var list = AchieveState.Check();
            foreach (var (a, tier) in list)
                Toast(string.Format(GoLocalization.T("ach.notice", "업적 — {0} {1}/{2} (Y 에서 받기)"), a.Name, tier, a.Tiers.Length));
            return list;
        }

        // ---- 글 ----

        public static string ProgressText(AchieveState.Status x)
        {
            var a = x.A;
            if (x.Tier >= a.Tiers.Length) return string.Format(GoLocalization.T("ach.done", "{0} {1} — 모두 이룸"), a.Unit, x.Value);
            return $"{a.Unit} {Mathf.Min(x.Value, a.Tiers[x.Tier])}/{a.Tiers[x.Tier]}";
        }

        public static string Stars(AchieveState.Status x)
        {
            var sb = new StringBuilder();
            for (int i = 0; i < x.A.Tiers.Length; i++) sb.Append(i < x.Tier ? '★' : '☆');
            return sb.ToString();
        }

        public void Refresh()
        {
            if (_panel == null) return;
            int claimable = AchieveState.Claimable();
            var open = OpenButton.GetComponentInChildren<TextMeshProUGUI>();
            open.text = GoLocalization.T("ach.button", "업적") + (claimable > 0 ? " ●" + claimable : "");
            open.color = claimable > 0 ? new Color(1f, 0.88f, 0.4f) : Color.white;
            if (!IsOpen) return;
            _title.text = string.Format(GoLocalization.T("ach.title", "업적 — {0}/{1} 단계"), AchieveState.TiersDone(), GoAchieve.TotalTiers);
            AllButton.interactable = claimable > 0;
            AllButton.GetComponentInChildren<TextMeshProUGUI>().text = GoLocalization.T("ach.claim_all", "모두 받기") + (claimable > 0 ? " ●" + claimable : "");
            for (int i = 0; i < 5; i++)
            {
                var c = (GoAchieve.Cat)i;
                int n = AchieveState.ClaimableIn(c);
                _tabText[i].text = GoAchieve.CatName(c) + (n > 0 ? " ●" + n : "");
                _tabText[i].color = c == Tab ? new Color(1f, 0.88f, 0.4f) : Color.white;
            }
            var list = RowsOfTab();
            for (int i = 0; i < MaxRows; i++)
            {
                bool on = i < list.Count;
                _rowRoot[i].SetActive(on);
                if (!on) continue;
                var x = AchieveState.StatusOf(list[i]);
                var a = x.A;
                bool full = x.Tier >= a.Tiers.Length;
                int goal = full ? a.Tiers[a.Tiers.Length - 1] : a.Tiers[x.Tier];
                string next = x.Claim > 0 ? GoAchieve.RewardText(GoAchieve.RewardOf(a, x.Got)) : full ? "" : GoAchieve.RewardText(GoAchieve.RewardOf(a, x.Tier));
                _rows[i].text = $"<b>{a.Name}</b>  <color=#ffd54a>{Stars(x)}</color>\n<size=14>{ProgressText(x)}</size>"
                    + (next.Length > 0 ? $"\n<size=13><color=#b9c2cc>{next}</color></size>" : "");
                _barFill[i].sizeDelta = new Vector2(BarW * Mathf.Clamp01(x.Value / (float)goal), 0f);
                _claim[i].interactable = x.Claim > 0;
                _claimText[i].text = x.Claim > 0
                    ? GoLocalization.T("ach.claim", "받기") + (x.Claim > 1 ? " ×" + x.Claim : "")
                    : full ? GoLocalization.T("ach.end", "끝") : GoLocalization.T("ach.claim", "받기");
            }
        }

        private void Update()
        {
            var kb = Keyboard.current;
            if (kb != null)
            {
                if (kb.yKey.wasPressedThisFrame) Toggle();
                else if (kb.escapeKey.wasPressedThisFrame && IsOpen) Close();
            }
            _check -= Time.unscaledDeltaTime;
            if (_check <= 0f) { _check = CheckSec; CheckNow(); Refresh(); }
        }
    }
}
