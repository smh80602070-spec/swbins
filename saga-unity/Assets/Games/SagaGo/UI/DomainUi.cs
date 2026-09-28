using TMPro;
using UnityEngine;
using UnityEngine.UI;
using Saga.Go.Combat;
using Saga.Go.Data;
using Saga.Go.World;

namespace Saga.Go.UI
{
    /// <summary>
    /// PLAN.md 109-14-9 숨은 터 화면(웹 사가고 ⑲-9 입구 카드·도전 줄·보상 나무 카드) — 입구 11m 안에 서면 카드(종류·보상·터 기운·원기·단계 셋 + 닫기),
    /// 도전 중엔 왼쪽 미니맵 위에 한 줄(단계·파도·남은 초·보스 체력) + 물러나기, 보상 나무 7.4m 안이면 받기 카드(원기 값 · 받기 · 두고 나가기).
    /// `WorldMapBuilder` 가 Play 때 붙인다 — 런타임 UI 라 람다 리스너를 쓴다.
    /// </summary>
    public class DomainUi : MonoBehaviour
    {
        public static DomainUi Instance { get; private set; }

        private GameObject _card, _tree, _hud;
        private TextMeshProUGUI _cardTitle, _cardInfo, _hudText, _treeText;
        private readonly Button[] _stage = new Button[3];
        private string _cardSite, _dismissed;
        private float _wait;

        public bool CardShown => _card != null && _card.activeSelf;
        public bool TreeShown => _tree != null && _tree.activeSelf;
        public bool HudShown => _hud != null && _hud.activeSelf;
        public string CardInfo => _cardInfo.text;
        public string HudText => _hudText.text;
        public Button StageButton(int i) => _stage[i];
        public Button CardClose { get; private set; }
        public Button ClaimButton { get; private set; }
        public Button TreeLeaveButton { get; private set; }
        public Button LeaveButton { get; private set; }

        private void Awake() => Instance = this;
        private void OnDestroy() { if (Instance == this) Instance = null; }

        private void Start() => Build();

        private static void Center(RectTransform r) => r.pivot = new Vector2(0.5f, 0.5f);

        private static GameObject Panel(Transform parent, string name, Vector2 anchor, Vector2 pos, Vector2 size, Color c)
        {
            var go = new GameObject(name, typeof(RectTransform));
            go.transform.SetParent(parent, false);
            var r = (RectTransform)go.transform;
            r.anchorMin = r.anchorMax = r.pivot = anchor;
            r.anchoredPosition = pos;
            r.sizeDelta = size;
            go.AddComponent<Image>().color = c;
            return go;
        }

        private void Build()
        {
            var canvas = EncounterUiKit.NewCanvas("DomainUI");
            canvas.sortingOrder = 6;
            var t = canvas.transform;
            var mid = new Vector2(0.5f, 0.5f);

            _card = Panel(t, "DomainCard", mid, Vector2.zero, new Vector2(760f, 430f), new Color(0.03f, 0.03f, 0.06f, 0.92f));
            _cardTitle = EncounterUiKit.NewText(_card.transform, "", mid, new Vector2(0f, 170f), new Vector2(720f, 44f), 26);
            _cardTitle.fontStyle = FontStyles.Bold;
            Center(_cardTitle.rectTransform);
            _cardInfo = EncounterUiKit.NewText(_card.transform, "", mid, new Vector2(0f, 60f), new Vector2(720f, 160f), 18);
            Center(_cardInfo.rectTransform);
            for (int i = 0; i < 3; i++)
            {
                int k = i;
                _stage[i] = EncounterUiKit.NewButton(_card.transform, "", mid, new Vector2((i - 1) * 240f, -90f), new Vector2(225f, 70f), null);
                Center((RectTransform)_stage[i].transform);
                _stage[i].GetComponentInChildren<TextMeshProUGUI>().fontSize = 17;
                _stage[i].onClick.AddListener(() => EnterStage(k));
            }
            CardClose = EncounterUiKit.NewButton(_card.transform, GoLocalization.T("dex.close", "닫는다"), mid, new Vector2(0f, -175f), new Vector2(200f, 50f), null);
            Center((RectTransform)CardClose.transform);
            CardClose.onClick.AddListener(() => { _dismissed = _cardSite; _card.SetActive(false); });
            _card.SetActive(false);

            _hud = Panel(t, "DomainHud", new Vector2(0f, 1f), new Vector2(22f, -245f), new Vector2(460f, 62f), new Color(0.03f, 0.03f, 0.06f, 0.7f));
            _hudText = EncounterUiKit.NewText(_hud.transform, "", new Vector2(0f, 0.5f), new Vector2(10f, 0f), new Vector2(330f, 58f), 16);
            _hudText.rectTransform.pivot = new Vector2(0f, 0.5f);
            LeaveButton = EncounterUiKit.NewButton(_hud.transform, GoLocalization.T("domain.btn_leave", "물러나기"), new Vector2(1f, 0.5f), new Vector2(-6f, 0f), new Vector2(110f, 50f), null);
            LeaveButton.GetComponentInChildren<TextMeshProUGUI>().fontSize = 15;
            LeaveButton.onClick.AddListener(() => DomainField.Instance?.Leave());
            _hud.SetActive(false);

            _tree = Panel(t, "DomainTreeCard", mid, new Vector2(0f, -40f), new Vector2(640f, 250f), new Color(0.03f, 0.06f, 0.04f, 0.92f));
            _treeText = EncounterUiKit.NewText(_tree.transform, "", mid, new Vector2(0f, 50f), new Vector2(600f, 110f), 19);
            Center(_treeText.rectTransform);
            ClaimButton = EncounterUiKit.NewButton(_tree.transform, "", mid, new Vector2(-150f, -70f), new Vector2(270f, 64f), null);
            Center((RectTransform)ClaimButton.transform);
            ClaimButton.onClick.AddListener(Claim);
            TreeLeaveButton = EncounterUiKit.NewButton(_tree.transform, GoLocalization.T("domain.btn_tree_leave", "두고 나가기"), mid, new Vector2(150f, -70f), new Vector2(270f, 64f), null);
            Center((RectTransform)TreeLeaveButton.transform);
            TreeLeaveButton.onClick.AddListener(() => DomainField.Instance?.Leave());
            _tree.SetActive(false);
        }

        private void EnterStage(int stage)
        {
            var df = DomainField.Instance;
            if (df == null || _cardSite == null) return;
            foreach (var s in GoDomain.Sites) if (s.Id == _cardSite) { if (df.Enter(s, stage)) _card.SetActive(false); break; }
            Refresh();
        }

        private void Claim()
        {
            var df = DomainField.Instance;
            if (df == null) return;
            string text = df.Claim(out string why);
            if (text == null && DialogueLabel.Instance != null) DialogueLabel.Instance.Show(why, 2.5f);
            Refresh();
        }

        private static string Mmss(long sec) => string.Format(GoLocalization.T("domain.mmss", "{0}분 {1}초"), sec / 60, sec % 60);

        public static string ResinLine()
        {
            long n = DomainState.ResinNextSec;
            return string.Format(GoLocalization.T("domain.resin", "원기 {0}/{1}"), DomainState.Resin, GoDomain.ResinMax)
                + (n > 0 ? " " + string.Format(GoLocalization.T("domain.resin_next", "(다음 1 까지 {0})"), Mmss(n)) : "");
        }

        private void Update()
        {
            _wait -= Time.unscaledDeltaTime;
            if (_wait > 0f) return;
            _wait = 0.25f;
            Refresh();
        }

        /// <summary>진단도 부른다 — 카드·줄·나무 카드를 지금 상태로.</summary>
        public void Refresh()
        {
            if (_card == null) return;
            var df = DomainField.Instance;
            var fc = FieldCombat.Instance;
            if (df == null || fc == null) return;
            var run = df.Current;
            // 입구 카드
            var near = run == null ? DomainField.SiteNear(fc.transform.position) : null;
            if (near == null) { _dismissed = null; _cardSite = null; _card.SetActive(false); }
            else
            {
                var s = near.Value;
                if (_cardSite != s.Id) { _cardSite = s.Id; if (_dismissed != s.Id) _card.SetActive(true); }
                if (_card.activeSelf) FillCard(s);
            }
            // 도전 줄
            _hud.SetActive(run != null);
            if (run != null)
            {
                string line = $"{run.Site.Name} {GoDomain.Stages[run.Stage].N}";
                if (run.Phase == "wait") line += " · " + GoLocalization.T("domain.hud_wait", "곧 시작");
                else if (run.Phase == "fight")
                {
                    if (run.Site.Kind != GoDomain.Kind.Weekly) line += " · " + string.Format(GoLocalization.T("domain.wave", "파도 {0}/{1}"), run.Wave + 1, GoDomain.Waves(run.Site.Kind).Length);
                    line += " · " + string.Format(GoLocalization.T("domain.hud_left", "{0}초"), Mathf.Max(0, Mathf.CeilToInt(run.Left)));
                    foreach (var e in run.Foes)
                        if (e != null && e.IsWeeklyBoss && e.Alive)
                            line += "\n" + string.Format(GoLocalization.T("domain.hud_boss", "먹구름 이무기 {0}%{1}"), Mathf.CeilToInt(e.Hp / e.MaxHp * 100f), e.ShieldHp > 0f ? " · " + GoLocalization.T("domain.hud_shield", "뇌 방패") : "");
                }
                else line += " · " + GoLocalization.T("domain.hud_tree", "보상 나무");
                _hudText.text = line;
            }
            // 보상 나무 카드
            bool tree = run != null && run.Phase == "tree" && run.Asked;
            _tree.SetActive(tree);
            if (tree)
            {
                int cost = DomainState.CostOf(run.Site.Kind);
                _treeText.text = string.Format(GoLocalization.T("domain.tree_card", "보상 나무 — {0} · 원기 {1} 로 받는다\n{2}"), GoDomain.LootName(run.Site.Kind), cost, ResinLine());
                ClaimButton.GetComponentInChildren<TextMeshProUGUI>().text = string.Format(GoLocalization.T("domain.btn_claim", "받기 (원기 {0})"), cost);
                ClaimButton.interactable = DomainState.Resin >= cost;
            }
        }

        private void FillCard(GoDomain.Site s)
        {
            _cardTitle.text = $"{s.Name} · {GoDomain.KindName(s.Kind)}";
            string cost = s.Kind == GoDomain.Kind.Weekly
                ? string.Format(GoLocalization.T("domain.cost_weekly", "받을 때 원기 {0}(이번 주 {1}번 — 처음 {2}번은 {3})"), DomainState.CostOf(s.Kind), DomainState.WeeklyUsed, GoDomain.WeeklyHalfN, GoDomain.WeeklyHalf)
                : string.Format(GoLocalization.T("domain.cost", "받을 때 원기 {0}"), DomainState.CostOf(s.Kind));
            _cardInfo.text = string.Format(GoLocalization.T("domain.card", "보상 {0} · 터 기운: {1}\n{2} · 제한 {3}초 · 원판을 벗어나면 실패(원기는 안 쓴다)\n{4} · {5}"),
                GoDomain.LootName(s.Kind), GoDomain.LeyText(s.Kind),
                s.Kind == GoDomain.Kind.Weekly ? GoLocalization.T("domain.one_boss", "보스 하나") : GoLocalization.T("domain.two_waves", "파도 둘"),
                Mathf.RoundToInt(GoDomain.LimitOf(s.Kind)), cost, ResinLine());
            var df = DomainField.Instance;
            for (int i = 0; i < 3; i++)
            {
                bool open = GoDomain.StageOpen(i, DomainField.Rank);
                _stage[i].GetComponentInChildren<TextMeshProUGUI>().text = open
                    ? string.Format(GoLocalization.T("domain.btn_stage", "단계 {0} 도전"), GoDomain.Stages[i].N)
                    : string.Format(GoLocalization.T("domain.btn_stage_locked", "단계 {0} — 여정 {1}"), GoDomain.Stages[i].N, GoDomain.Stages[i].Ar);
                _stage[i].interactable = open && df != null && !df.Running;
            }
        }
    }
}
