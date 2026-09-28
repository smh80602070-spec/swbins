using TMPro;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.InputSystem;
using UnityEngine.UI;
using Saga.Go.Combat;
using Saga.Go.Data;

namespace Saga.Go.UI
{
    /// <summary>
    /// PLAN.md 109-6b 도감 화면 — **B** 키·오른쪽 위 "도감" 버튼(지도 밑). `FieldSpawner` 가 Play 시작 때 붙인다(런타임 생성 → 런타임 리스너).
    /// - 위: 모은 수(등용 n/105 · 만남 m). 그 밑 시대 넷 탭(삼국지·한국사·일본사·세계사, 탭마다 등용/전체).
    /// - 칸: 그 시대 인물을 표 순서대로 8 줄 칸에. 세 단계 — 등용(원소 빛깔 칸·이름·원소·기질) / 만남(회색 칸·이름·"만남") /
    ///   안 만남(검은 그림자 칸 — 별과 "? ? ?" 만). 칸을 누르면 아래 한 줄에 자세히(등용 = 자질·한마디, 만남·안 만남 = 서는 지역).
    /// - 가로 PC(캔버스 1080×607)에도 들어가게 가운데 1040×580 안에 둔다. 지도와 겹치지 않게 열 때 지도를 닫는다.
    /// </summary>
    public class HeroDexUi : MonoBehaviour
    {
        public enum CardState { Hidden, Unseen, Seen, Got }

        public const int Cols = 8;
        public const float CardW = 124f;
        public const float CardH = 60f;
        public const float Gap = 4f;
        private const float GridTop = 185f;

        private static readonly HeroEra[] Eras = { HeroEra.ThreeKingdoms, HeroEra.Korea, HeroEra.Japan, HeroEra.World };
        private static readonly Color UnseenBg = new Color(0.03f, 0.03f, 0.04f, 0.96f);
        private static readonly Color UnseenFg = new Color(0.36f, 0.36f, 0.4f);
        private static readonly Color SeenBg = new Color(0.2f, 0.2f, 0.23f, 0.92f);
        private static readonly Color SeenFg = new Color(0.78f, 0.78f, 0.8f);

        public static HeroDexUi Instance { get; private set; }

        private GameObject _panel;
        private TextMeshProUGUI _title;
        private TextMeshProUGUI _detail;
        private readonly List<Button> _tabs = new List<Button>();
        private readonly List<Button> _cards = new List<Button>();
        private readonly List<string> _cardIds = new List<string>();
        private HeroEra _era = HeroEra.ThreeKingdoms;
        private string _selected;

        public bool IsOpen => _panel != null && _panel.activeSelf;
        public Button DexButton { get; private set; }
        public Button CloseButton { get; private set; }
        public HeroEra Era => _era;
        public string TitleText => _title.text;
        public string DetailText => _detail.text;
        // 109-14-4 무예 칸(오른쪽) — 진단이 진짜 단추를 누른다
        public bool TalentPanelShown => _talentRoot != null && _talentRoot.activeSelf;
        public Button TalentButton(int k) => _talentButtons[k];
        public Button ConButton => _conButton;
        public string TalentRowText(int k) => _talentRows[k].text;
        public string ConText => _conText.text;
        public string SelectedId => _selected;
        private GameObject _talentRoot;
        private TextMeshProUGUI _talentMats;
        private readonly TextMeshProUGUI[] _talentRows = new TextMeshProUGUI[3];
        private readonly Button[] _talentButtons = new Button[3];
        private TextMeshProUGUI _conText;
        private Button _conButton;
        // 109-14-5a 무기 칸(왼쪽) — 강화·벼림·바꾸기
        public Button WeaponButton(int i) => _weaponButtons[i];
        public string WeaponText => _weaponText.text;
        private TextMeshProUGUI _weaponText;
        private readonly Button[] _weaponButtons = new Button[3];
        public int TabCount => _tabs.Count;
        public Button TabButton(int i) => _tabs[i];
        public string TabText(int i) => _tabs[i].GetComponentInChildren<TextMeshProUGUI>().text;
        /// <summary>지금 시대 탭에서 켜진 칸 수(= 그 시대 인물 수).</summary>
        public int CardCount
        {
            get
            {
                int n = 0;
                foreach (var c in _cards) if (c.gameObject.activeSelf) n++;
                return n;
            }
        }
        public Button CardButton(int i) => _cards[i];
        public string CardHeroId(int i) => i < _cardIds.Count ? _cardIds[i] : null;
        public string CardText(int i) => _cards[i].GetComponentInChildren<TextMeshProUGUI>().text;
        public Color CardColor(int i) => _cards[i].GetComponent<Image>().color;
        public CardState StateOfCard(int i) => i < _cardIds.Count && _cards[i].gameObject.activeSelf ? StateOf(_cardIds[i]) : CardState.Hidden;

        public static CardState StateOf(string id)
        {
            if (HeroDexState.IsRecruited(id)) return CardState.Got;
            return HeroDexState.IsSeen(id) ? CardState.Seen : CardState.Unseen;
        }

        private void Awake() => Instance = this;

        private void Start()
        {
            Build();
            HeroDexState.Changed += OnChanged;
            PartyState.PowerChanged += OnPower;
            _panel.SetActive(false);
        }

        private void OnDestroy()
        {
            HeroDexState.Changed -= OnChanged;
            PartyState.PowerChanged -= OnPower;
            if (Instance == this) Instance = null;
        }

        private void OnPower(float atk, float def) => OnChanged();

        private void OnChanged()
        {
            if (IsOpen) Refresh();
        }

        private void Build()
        {
            var canvas = EncounterUiKit.NewCanvas("HeroDexUI");
            canvas.sortingOrder = 7;
            var t = canvas.transform;

            DexButton = EncounterUiKit.NewButton(t, GoLocalization.T("dex.button", "도감"), new Vector2(1f, 1f), new Vector2(-30f, -330f), new Vector2(160f, 80f), null);
            DexButton.onClick.AddListener(Toggle);

            _panel = new GameObject("DexPanel", typeof(RectTransform));
            _panel.transform.SetParent(t, false);
            var pr = (RectTransform)_panel.transform;
            pr.anchorMin = Vector2.zero; pr.anchorMax = Vector2.one;
            pr.offsetMin = pr.offsetMax = Vector2.zero;
            _panel.AddComponent<Image>().color = new Color(0.02f, 0.03f, 0.05f, 0.93f);
            var mid = new Vector2(0.5f, 0.5f);

            _title = EncounterUiKit.NewText(_panel.transform, "", mid, new Vector2(0f, 268f), new Vector2(1000f, 44f), 28);
            _title.fontStyle = FontStyles.Bold;
            Center(_title.rectTransform);

            float tabW = 250f;
            for (int i = 0; i < Eras.Length; i++)
            {
                var tab = EncounterUiKit.NewButton(_panel.transform, "", mid, new Vector2((i - 1.5f) * (tabW + 6f), 222f), new Vector2(tabW, 44f), null);
                Center((RectTransform)tab.transform);
                tab.GetComponentInChildren<TextMeshProUGUI>().fontSize = 22;
                var era = Eras[i];
                tab.onClick.AddListener(() => SelectEra(era));
                _tabs.Add(tab);
            }

            int maxCards = 0;
            foreach (var era in Eras) maxCards = Mathf.Max(maxCards, EraHeroes(era).Count);
            for (int i = 0; i < maxCards; i++)
            {
                int col = i % Cols, row = i / Cols;
                float x = (col - (Cols - 1) * 0.5f) * (CardW + Gap);
                float y = GridTop - row * (CardH + Gap) - CardH * 0.5f;
                var card = EncounterUiKit.NewButton(_panel.transform, "", mid, new Vector2(x, y), new Vector2(CardW, CardH), null);
                Center((RectTransform)card.transform);
                var label = card.GetComponentInChildren<TextMeshProUGUI>();
                label.fontSize = 17;
                label.lineSpacing = -5f; // TMP: em/100 더하기(옛 UI.Text 배수 0.95)
                int k = i;
                card.onClick.AddListener(() => Select(k));
                _cards.Add(card);
            }

            _detail = EncounterUiKit.NewText(_panel.transform, "", mid, new Vector2(0f, -196f), new Vector2(1020f, 96f), 19);
            Center(_detail.rectTransform);

            BuildTalentPanel(mid);
            BuildWeaponPanel(mid);

            CloseButton = EncounterUiKit.NewButton(_panel.transform, GoLocalization.T("dex.close", "닫는다"), mid, new Vector2(0f, -272f), new Vector2(200f, 48f), null);
            Center((RectTransform)CloseButton.transform);
            CloseButton.onClick.AddListener(Close);
        }

        private static void Center(RectTransform r) => r.pivot = new Vector2(0.5f, 0.5f);

        /// <summary>109-14-4 — 격자 오른쪽(x 655) 무예 칸: 재료 한 줄 · 무예 셋(글 + 올리기 단추) · 깨달음(글 + 열기 단추).</summary>
        private void BuildTalentPanel(Vector2 mid)
        {
            const float X = 655f, W = 270f;
            _talentRoot = new GameObject("TalentPanel", typeof(RectTransform));
            _talentRoot.transform.SetParent(_panel.transform, false);
            var head = EncounterUiKit.NewText(_talentRoot.transform, GoLocalization.T("talent.title", "무예 · 깨달음"), mid, new Vector2(X, 180f), new Vector2(W, 34f), 22);
            head.fontStyle = FontStyles.Bold;
            Center(head.rectTransform);
            _talentMats = EncounterUiKit.NewText(_talentRoot.transform, "", mid, new Vector2(X, 140f), new Vector2(W, 48f), 15);
            Center(_talentMats.rectTransform);
            for (int k = 0; k < 3; k++)
            {
                float y = 88f - k * 92f;
                _talentRows[k] = EncounterUiKit.NewText(_talentRoot.transform, "", mid, new Vector2(X, y), new Vector2(W, 30f), 17);
                Center(_talentRows[k].rectTransform);
                var b = EncounterUiKit.NewButton(_talentRoot.transform, "", mid, new Vector2(X, y - 38f), new Vector2(W, 44f), null);
                Center((RectTransform)b.transform);
                b.GetComponentInChildren<TextMeshProUGUI>().fontSize = 15;
                int kk = k;
                b.onClick.AddListener(() => UpTalent(kk));
                _talentButtons[k] = b;
            }
            _conText = EncounterUiKit.NewText(_talentRoot.transform, "", mid, new Vector2(X, -190f), new Vector2(W, 52f), 15);
            Center(_conText.rectTransform);
            _conButton = EncounterUiKit.NewButton(_talentRoot.transform, "", mid, new Vector2(X, -236f), new Vector2(W, 40f), null);
            Center((RectTransform)_conButton.transform);
            _conButton.GetComponentInChildren<TextMeshProUGUI>().fontSize = 15;
            _conButton.onClick.AddListener(UnlockCon);
            _talentRoot.SetActive(false);
        }

        /// <summary>109-14-5a — 격자 왼쪽(x −655) 무기 칸: 종류·이름·Lv·공격·부옵션·효과·강화석 글 + 강화·벼림·바꾸기 단추. 무예 칸과 같이 뜨고 진다.</summary>
        private void BuildWeaponPanel(Vector2 mid)
        {
            const float X = -655f, W = 270f;
            var head = EncounterUiKit.NewText(_talentRoot.transform, GoLocalization.T("weapon.title", "무기"), mid, new Vector2(X, 180f), new Vector2(W, 34f), 22);
            head.fontStyle = FontStyles.Bold;
            Center(head.rectTransform);
            _weaponText = EncounterUiKit.NewText(_talentRoot.transform, "", mid, new Vector2(X, 70f), new Vector2(W, 170f), 16);
            Center(_weaponText.rectTransform);
            string[] names = { GoLocalization.T("weapon.btn_up", "강화"), GoLocalization.T("weapon.btn_asc", "벼림"), GoLocalization.T("weapon.btn_swap", "바꾸기") };
            for (int i = 0; i < 3; i++)
            {
                var b = EncounterUiKit.NewButton(_talentRoot.transform, names[i], mid, new Vector2(X, -50f - i * 52f), new Vector2(W, 44f), null);
                Center((RectTransform)b.transform);
                b.GetComponentInChildren<TextMeshProUGUI>().fontSize = 15;
                int k = i;
                b.onClick.AddListener(() => WeaponAction(k));
                _weaponButtons[i] = b;
            }
        }

        private void WeaponAction(int k)
        {
            if (_selected == null) return;
            string wid = WeaponState.Equipped(_selected);
            if (k == 0) WeaponState.Up(wid);
            else if (k == 1) WeaponState.Ascend(wid);
            else
            {
                var list = WeaponState.ChoicesFor(_selected);
                int i = list.IndexOf(wid);
                WeaponState.Equip(_selected, list[(i + 1) % list.Count]);
            }
            Saga.Go.Combat.FieldCombat.Instance?.RebuildParty(); // 체력% 부옵션
            Refresh();
        }

        private void RefreshWeapon()
        {
            string wid = WeaponState.Equipped(_selected);
            var md = WeaponState.ModsOf(_selected);
            var w = md.Weapon;
            string sub = w.Sub != null ? $"{GoWeapons.StatName(w.Sub)} +{GoWeapons.SubAt(w, md.Lv) * 100f:0.#}%" : "";
            string pas = w.Pas != null ? $"{GoWeapons.PassiveName(w.Pas)} +{md.PasV * 100f:0.#}%" : "";
            _weaponText.text = string.Format(GoLocalization.T("weapon.panel", "{0} · ★{1} {2}\nLv {3}/{4} · 벼림 {5} · 울림 {6}\n공격 {7:0}{8}{9}\n강화석 {10} · 가진 {0} {11}자루"),
                GoWeapons.TypeName(w.Type), w.Rarity, w.Name, md.Lv, GoWeapons.Cap(md.Asc), md.Asc, md.Ref, md.Atk,
                sub.Length > 0 ? "\n" + sub : "", pas.Length > 0 ? "\n" + pas : "", WeaponState.Ore, WeaponState.ChoicesFor(_selected).Count);
            bool up = WeaponState.CanUp(wid, out string uwhy, out var uc);
            _weaponButtons[0].GetComponentInChildren<TextMeshProUGUI>().text = up
                ? string.Format(GoLocalization.T("weapon.btn_up_cost", "강화 — 강화석 {0} · 금 {1}"), uc.ore, uc.gold) : uwhy;
            _weaponButtons[0].interactable = up;
            bool asc = WeaponState.CanAscend(wid, out string awhy, out int ag);
            _weaponButtons[1].GetComponentInChildren<TextMeshProUGUI>().text = asc
                ? string.Format(GoLocalization.T("weapon.btn_asc_cost", "벼림 — 금 {0}"), ag) : awhy;
            _weaponButtons[1].interactable = asc;
            _weaponButtons[2].interactable = WeaponState.ChoicesFor(_selected).Count > 1;
        }

        private void UpTalent(int k)
        {
            if (_selected == null) return;
            var kind = (GoTalent.Kind)k;
            if (TalentState.Up(_selected, kind) && GoHeroes.TryGet(_selected, out var h))
                DialogueLabel.Instance?.Show(string.Format(GoLocalization.T("talent.up", "{0} {1} {2}단 — 피해 ×{3:0.00}"),
                    GoHeroes.Name(h), GoTalent.KindName(kind), TalentState.Level(_selected, kind), TalentState.Mul(_selected, kind)), 3f);
            Refresh();
        }

        private void UnlockCon()
        {
            if (_selected == null) return;
            if (TalentState.UnlockCon(_selected) && GoHeroes.TryGet(_selected, out var h))
            {
                int c = TalentState.Con(_selected);
                DialogueLabel.Instance?.Show(string.Format(GoLocalization.T("talent.con_up", "{0} 깨달음 {1} — {2}"), GoHeroes.Name(h), c, GoTalent.ConText(c)), 3.5f);
                Saga.Go.Combat.FieldCombat.Instance?.RebuildParty(); // ④ 최대 체력
            }
            Refresh();
        }

        private void RefreshTalent()
        {
            bool show = _selected != null && TalentState.Trainable(_selected);
            _talentRoot.SetActive(show);
            if (!show) return;
            RefreshWeapon();
            _talentMats.text = string.Format(GoLocalization.T("talent.mats", "쪽지 {0} · 교본 {1} · 비전 {2}\n매듭 {3} · 비늘 {4} · 금 {5}"),
                TalentState.Count(GoTalent.Mat.Note), TalentState.Count(GoTalent.Mat.Guide), TalentState.Count(GoTalent.Mat.Secret),
                TalentState.Count(GoTalent.Mat.Knot), TalentState.Count(GoTalent.Mat.Scale), GoldState.Gold);
            int cap = GoTalent.CapOf(PlayerStats.Level);
            for (int k = 0; k < 3; k++)
            {
                var kind = (GoTalent.Kind)k;
                int lv = TalentState.Level(_selected, kind);
                _talentRows[k].text = string.Format(GoLocalization.T("talent.row", "{0} {1}/{2}단 ×{3:0.00}"), GoTalent.KindName(kind), lv, cap, TalentState.Mul(_selected, kind));
                bool ok = TalentState.CanUp(_selected, kind, out string why, out var c);
                var label = _talentButtons[k].GetComponentInChildren<TextMeshProUGUI>();
                label.text = ok || why == GoLocalization.T("talent.why.gold", "금 부족") || (c.Books > 0 && why != null && why.StartsWith(GoTalent.MatName(c.Book)))
                    ? string.Format(GoLocalization.T("talent.btn_up", "올리기 — 금 {0} · {1} {2}{3}"), c.Gold, GoTalent.MatName(c.Book), c.Books,
                        c.Scale > 0 ? " · " + GoTalent.MatName(GoTalent.Mat.Scale) + " " + c.Scale : "") + (ok ? "" : "\n" + why)
                    : why;
                _talentButtons[k].interactable = ok;
            }
            int con = TalentState.Con(_selected);
            string dots = new string('◆', con) + new string('◇', GoTalent.ConMax - con);
            _conText.text = string.Format(GoLocalization.T("talent.con_line", "깨달음 {0}\n{1}"), dots,
                con < GoTalent.ConMax ? string.Format(GoLocalization.T("talent.con_next", "다음: {0}"), GoTalent.ConText(con + 1)) : GoLocalization.T("talent.con_all", "모두 열림"));
            bool cok = TalentState.CanUnlockCon(_selected, out string cwhy);
            _conButton.GetComponentInChildren<TextMeshProUGUI>().text = cok ? GoLocalization.T("talent.btn_con", "깨달음 열기 — 인연 매듭 1") : cwhy;
            _conButton.interactable = cok;
        }

        private static List<GoHeroes.Hero> EraHeroes(HeroEra era)
        {
            var list = new List<GoHeroes.Hero>();
            foreach (var h in GoHeroes.All) if (h.Era == era) list.Add(h);
            return list;
        }

        private void Update()
        {
            var kb = Keyboard.current;
            if (kb != null && kb.bKey.wasPressedThisFrame) Toggle();
        }

        public void Toggle()
        {
            if (IsOpen) Close(); else Open();
        }

        public void Open()
        {
            if (WorldMapUi.Instance != null && WorldMapUi.Instance.IsOpen) WorldMapUi.Instance.Close();
            _panel.SetActive(true);
            Refresh();
        }

        public void Close() => _panel.SetActive(false);

        public void SelectEra(HeroEra era)
        {
            _era = era;
            _selected = null;
            Refresh();
        }

        /// <summary>칸 누름 — 아래 한 줄에 그 사람 자세히.</summary>
        public void Select(int i)
        {
            if (i < 0 || i >= _cardIds.Count || !_cards[i].gameObject.activeSelf) return;
            _selected = _cardIds[i];
            Refresh();
        }

        public void Refresh()
        {
            var all = HeroDexState.CountOf(null);
            _title.text = string.Format(GoLocalization.T("dex.title", "도감 — 등용 {0}/{1} · 만남 {2}"), all.Got, all.Total, all.Seen);
            for (int i = 0; i < Eras.Length; i++)
            {
                var c = HeroDexState.CountOf(Eras[i]);
                var txt = _tabs[i].GetComponentInChildren<TextMeshProUGUI>();
                txt.text = $"{GoHeroes.EraName(Eras[i])} {c.Got}/{c.Total}";
                bool on = Eras[i] == _era;
                txt.color = on ? new Color(1f, 0.88f, 0.5f) : new Color(0.75f, 0.75f, 0.8f);
                _tabs[i].GetComponent<Image>().color = on ? new Color(1f, 0.8f, 0.4f, 0.3f) : new Color(1f, 1f, 1f, 0.08f);
            }

            var heroes = EraHeroes(_era);
            _cardIds.Clear();
            for (int i = 0; i < _cards.Count; i++)
            {
                var card = _cards[i];
                if (i >= heroes.Count) { card.gameObject.SetActive(false); continue; }
                var h = heroes[i];
                _cardIds.Add(h.Id);
                card.gameObject.SetActive(true);
                var img = card.GetComponent<Image>();
                var label = card.GetComponentInChildren<TextMeshProUGUI>();
                switch (StateOf(h.Id))
                {
                    case CardState.Got:
                        var el = GoHeroes.ElementOf(h);
                        img.color = Color.Lerp(new Color(0.08f, 0.08f, 0.1f, 0.95f), GoElements.ColorOf(el), 0.45f);
                        label.color = Color.white;
                        label.text = $"{GoHeroes.Stars(h.Rarity)} {GoHeroes.Name(h)}\n{GoElements.NameOf(el)} · {GoHeroes.TraitName(h.Trait)}";
                        break;
                    case CardState.Seen:
                        img.color = SeenBg;
                        label.color = SeenFg;
                        label.text = $"{GoHeroes.Stars(h.Rarity)} {GoHeroes.Name(h)}\n{GoLocalization.T("dex.seen", "만남")}";
                        break;
                    default:
                        img.color = UnseenBg;
                        label.color = UnseenFg;
                        label.text = $"{GoHeroes.Stars(h.Rarity)}\n? ? ?";
                        break;
                }
                if (h.Id == _selected) img.color = Color.Lerp(img.color, new Color(1f, 0.85f, 0.45f, 1f), 0.35f);
            }
            _detail.text = Detail(_selected);
            RefreshTalent();
        }

        public static string Detail(string id)
        {
            if (id == null || !GoHeroes.TryGet(id, out var h))
                return GoLocalization.T("dex.hint", "칸을 누르면 자세히 · 들판에서 겨뤄 본 사람은 그림자에서 벗어나고, 이겨서 굴복시키면 동행이 된다");
            string region = GoWorldMap.RegionName(GoHeroes.RegionOf(id));
            var el = GoHeroes.ElementOf(h);
            switch (StateOf(id))
            {
                case CardState.Got:
                    return string.Format(GoLocalization.T("dex.detail.got", "{0} · {1} 원소 · 기질 {2}\n무력 {3} · 지력 {4} · 통솔 {5} — \"{6}\""),
                        GoHeroes.Label(h), GoElements.NameOf(el), GoHeroes.TraitName(h.Trait), h.Might, h.Wisdom, h.Command, GoHeroes.Quote(h));
                case CardState.Seen:
                    return string.Format(GoLocalization.T("dex.detail.seen", "{0} · {1} 원소 — 만났지만 아직 동행이 아니다\n{2}에 선다 · 이겨서 굴복시키면 동행"),
                        GoHeroes.Label(h), GoElements.NameOf(el), region);
                default:
                    return string.Format(GoLocalization.T("dex.detail.unseen", "아직 만나지 않은 사람 — {0} {1}\n{2} 어딘가에 선다"),
                        GoHeroes.Stars(h.Rarity), GoHeroes.EraName(h.Era), region);
            }
        }
    }
}
