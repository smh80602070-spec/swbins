using System.Collections.Generic;
using System.Text;
using TMPro;
using UnityEngine;
using UnityEngine.InputSystem;
using UnityEngine.UI;
using Saga.Go.Combat;
using Saga.Go.Data;

namespace Saga.Go.UI
{
    /// <summary>
    /// tasks U-0031 사냥 기록 창(saga-godot `world/hunt_log.gd`, 키 H → 이 트랙은 H 가 탈것이라 K) — K 키 또는 위 오른쪽 "사냥 기록"(받을 게 있으면 ●N) 단추로 연다.
    /// 종마다 한 줄: 이름(처음 잡기 전엔 "???")·별 세 개·처치 수/다음 단계·다음 보상 + 받기 단추 · 모두 받기. 0.5초마다 새로 닿은 단계를 알린다
    /// (불러온 직후 첫 확인은 기준만 잡고 조용히). `WorldMapBuilder` 가 Play 때 붙인다 — 런타임 UI 라 람다 리스너를 쓴다(`AchieveUi` 와 같은 결).
    /// </summary>
    public class HuntLogUi : MonoBehaviour
    {
        public static HuntLogUi Instance { get; private set; }

        public const float CheckSec = 0.5f;
        private const float RowTop = 330f, RowStep = 50f, BarW = 800f;

        private GameObject _panel;
        private TextMeshProUGUI _title;
        private TextMeshProUGUI[] _rows;
        private Button[] _claim;
        private TextMeshProUGUI[] _claimText;
        private RectTransform[] _barFill;
        private float _check;

        public Button OpenButton { get; private set; }
        public Button AllButton { get; private set; }
        public Button CloseButton { get; private set; }
        public int RowCount => GoHunt.Species.Length;
        public Button ClaimButton(int i) => _claim[i];
        public string RowText(int i) => _rows[i].text;
        public string TitleText => _title.text;
        public string OpenLabel => OpenButton.GetComponentInChildren<TextMeshProUGUI>().text;
        public bool IsOpen => _panel != null && _panel.activeSelf;

        private void Awake() => Instance = this;

        private void OnDestroy()
        {
            HuntState.Changed -= OnChanged;
            if (Instance == this) Instance = null;
        }

        private void Start()
        {
            Build();
            HuntState.Changed += OnChanged;
            _panel.SetActive(false);
            Refresh();
        }

        private void OnChanged() => Refresh();

        private static void Center(RectTransform r) => r.pivot = new Vector2(0.5f, 0.5f);

        private void Build()
        {
            int n = GoHunt.Species.Length;
            _rows = new TextMeshProUGUI[n]; _claim = new Button[n]; _claimText = new TextMeshProUGUI[n]; _barFill = new RectTransform[n];
            var canvas = EncounterUiKit.NewCanvas("HuntLogUI");
            canvas.sortingOrder = 8;
            var t = canvas.transform;
            var mid = new Vector2(0.5f, 0.5f);

            OpenButton = EncounterUiKit.NewButton(t, GoLocalization.T("hunt.button", "사냥 기록"), new Vector2(1f, 1f), new Vector2(-200f, -130f), new Vector2(160f, 50f), null); // 둘째 열(설정·지도·도감·업적 왼쪽) — 오른쪽 아래 전투 단추와 안 겹치게
            OpenButton.onClick.AddListener(Toggle);

            _panel = new GameObject("HuntPanel", typeof(RectTransform));
            _panel.transform.SetParent(t, false);
            var pr = (RectTransform)_panel.transform;
            pr.anchorMin = Vector2.zero; pr.anchorMax = Vector2.one;
            pr.offsetMin = pr.offsetMax = Vector2.zero;
            _panel.AddComponent<Image>().color = new Color(0.03f, 0.03f, 0.04f, 0.93f);

            _title = EncounterUiKit.NewText(_panel.transform, "", mid, new Vector2(-120f, 390f), new Vector2(1000f, 40f), 26);
            _title.fontStyle = FontStyles.Bold;
            Center(_title.rectTransform);
            AllButton = EncounterUiKit.NewButton(_panel.transform, GoLocalization.T("hunt.claim_all", "모두 받기"), mid, new Vector2(560f, 390f), new Vector2(260f, 48f), null);
            Center((RectTransform)AllButton.transform);
            AllButton.GetComponentInChildren<TextMeshProUGUI>().fontSize = 20;
            AllButton.onClick.AddListener(ClaimAll);

            for (int i = 0; i < n; i++)
            {
                int k = i;
                float y = RowTop - i * RowStep;
                var root = new GameObject("Row" + i, typeof(RectTransform));
                root.transform.SetParent(_panel.transform, false);
                var rr = (RectTransform)root.transform;
                rr.anchorMin = rr.anchorMax = mid;
                rr.sizeDelta = Vector2.zero;
                _rows[i] = EncounterUiKit.NewText(root.transform, "", mid, new Vector2(-230f, y), new Vector2(820f, 34f), 17);
                _rows[i].alignment = TextAlignmentOptions.MidlineLeft;
                Center(_rows[i].rectTransform);
                var bg = new GameObject("BarBg", typeof(RectTransform));
                bg.transform.SetParent(root.transform, false);
                var br = (RectTransform)bg.transform;
                br.anchorMin = br.anchorMax = mid;
                br.pivot = new Vector2(0f, 0.5f);
                br.anchoredPosition = new Vector2(-230f - 410f, y - 19f);
                br.sizeDelta = new Vector2(BarW, 5f);
                bg.AddComponent<Image>().color = new Color(0.2f, 0.2f, 0.22f);
                var fill = new GameObject("BarFill", typeof(RectTransform));
                fill.transform.SetParent(bg.transform, false);
                var fr = (RectTransform)fill.transform;
                fr.anchorMin = new Vector2(0f, 0f); fr.anchorMax = new Vector2(0f, 1f);
                fr.pivot = new Vector2(0f, 0.5f);
                fr.anchoredPosition = Vector2.zero;
                fr.sizeDelta = Vector2.zero;
                fill.AddComponent<Image>().color = new Color(0.55f, 0.85f, 0.5f);
                _barFill[i] = fr;
                _claim[i] = EncounterUiKit.NewButton(root.transform, GoLocalization.T("hunt.claim", "받기"), mid, new Vector2(330f, y - 2f), new Vector2(200f, 40f), null);
                Center((RectTransform)_claim[i].transform);
                _claimText[i] = _claim[i].GetComponentInChildren<TextMeshProUGUI>();
                _claimText[i].fontSize = 17;
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
            if (row < 0 || row >= GoHunt.Species.Length) return;
            string t = HuntState.Claim(GoHunt.Species[row]);
            if (t.Length > 0) Toast(string.Format(GoLocalization.T("hunt.got", "사냥 기록을 받았다 — {0}"), t));
            Refresh();
        }

        public void ClaimAll()
        {
            int n = HuntState.ClaimAll();
            if (n > 0) Toast(string.Format(GoLocalization.T("hunt.got_all", "사냥 기록 {0} 단계를 받았다"), n));
            Refresh();
        }

        private static void Toast(string text)
        {
            if (DialogueLabel.Instance != null && !string.IsNullOrEmpty(text)) DialogueLabel.Instance.Show(text, 2.5f);
        }

        /// <summary>새로 닿은 단계를 알린다 — 알린 목록(진단도 부른다).</summary>
        public List<(FieldEnemy.Kind k, int tier)> CheckNow()
        {
            var list = HuntState.Check();
            foreach (var (k, tier) in list)
                Toast(string.Format(GoLocalization.T("hunt.notice", "사냥 기록 — {0} {1}/{2} (K 에서 받기)"), FieldEnemy.KindName(k), tier, GoHunt.TiersOf(k).Length));
            return list;
        }

        // ---- 글 ----

        public static string Stars(FieldEnemy.Kind k)
        {
            var sb = new StringBuilder();
            int reached = HuntState.TierReached(k);
            for (int i = 0; i < GoHunt.TiersOf(k).Length; i++) sb.Append(i < reached ? '★' : '☆');
            return sb.ToString();
        }

        /// <summary>줄 글 — 처음 잡기 전엔 이름이 "???" 이고 진척만 보인다.</summary>
        public static string LineText(FieldEnemy.Kind k)
        {
            int kills = HuntState.Kills(k), reached = HuntState.TierReached(k);
            var tiers = GoHunt.TiersOf(k);
            string name = kills > 0 ? FieldEnemy.KindName(k) : GoLocalization.T("hunt.unknown", "???");
            bool full = reached >= tiers.Length;
            string prog = full
                ? string.Format(GoLocalization.T("hunt.done", "{0} 마리 — 모두 이룸"), kills)
                : string.Format(GoLocalization.T("hunt.progress", "{0}/{1} 마리"), Mathf.Min(kills, tiers[reached]), tiers[reached]);
            int claimed = HuntState.ClaimedTiers(k);
            string next = reached > claimed ? GoHunt.RewardText(GoHunt.RewardsOf(k)[claimed]) : full ? "" : GoHunt.RewardText(GoHunt.RewardsOf(k)[reached]);
            return $"<b>{name}</b>  <color=#ffd54a>{Stars(k)}</color>  <size=15>{prog}</size>" + (next.Length > 0 ? $"  <size=13><color=#b9c2cc>{next}</color></size>" : "");
        }

        public void Refresh()
        {
            if (_panel == null) return;
            int claimable = HuntState.ClaimableTotal();
            var open = OpenButton.GetComponentInChildren<TextMeshProUGUI>();
            open.text = GoLocalization.T("hunt.button", "사냥 기록") + (claimable > 0 ? " ●" + claimable : "");
            open.color = claimable > 0 ? new Color(1f, 0.88f, 0.4f) : Color.white;
            if (!IsOpen) return;
            _title.text = string.Format(GoLocalization.T("hunt.title", "사냥 기록 — {0}/{1}종 · {2}/{3} 단계"), HuntState.FoundCount(), GoHunt.Species.Length, HuntState.TiersDone(), HuntState.TotalTiers());
            AllButton.interactable = claimable > 0;
            AllButton.GetComponentInChildren<TextMeshProUGUI>().text = GoLocalization.T("hunt.claim_all", "모두 받기") + (claimable > 0 ? " ●" + claimable : "");
            for (int i = 0; i < GoHunt.Species.Length; i++)
            {
                var k = GoHunt.Species[i];
                int kills = HuntState.Kills(k), reached = HuntState.TierReached(k), claimed = HuntState.ClaimedTiers(k);
                var tiers = GoHunt.TiersOf(k);
                bool full = reached >= tiers.Length;
                int goal = full ? tiers[tiers.Length - 1] : tiers[reached];
                _rows[i].text = LineText(k);
                _barFill[i].sizeDelta = new Vector2(BarW * Mathf.Clamp01(kills / (float)goal), 0f);
                int can = reached - claimed;
                _claim[i].interactable = can > 0;
                _claimText[i].text = can > 0
                    ? GoLocalization.T("hunt.claim", "받기") + (can > 1 ? " ×" + can : "")
                    : (claimed >= tiers.Length ? GoLocalization.T("hunt.end", "끝") : GoLocalization.T("hunt.claim", "받기"));
            }
        }

        private void Update()
        {
            var kb = Keyboard.current;
            if (kb != null)
            {
                if (kb.kKey.wasPressedThisFrame) Toggle();
                else if (kb.escapeKey.wasPressedThisFrame && IsOpen) Close();
            }
            _check -= Time.unscaledDeltaTime;
            if (_check <= 0f) { _check = CheckSec; CheckNow(); Refresh(); }
        }
    }
}
