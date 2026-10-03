using System.Collections.Generic;
using TMPro;
using UnityEngine;
using UnityEngine.InputSystem;
using UnityEngine.UI;
using Saga.Go.Combat;
using Saga.Go.Data;
using Saga.Go.World;

namespace Saga.Go.UI
{
    /// <summary>
    /// PLAN.md 109-14-6 요리 창(웹 사가고 ⑲-6 요리 시트) — G 키 또는 "요리" 단추(솥 곁이거나 요리를 가졌을 때 보인다)로 연다.
    /// 재료 한 줄 · 켜진 효과 · 요리 여덟 줄(이름·재료/필요·숙련·효과 + 조리·자동·먹기 단추) · 조리하면 아래에 바늘 막대(맛있는 칸·보통 칸) + 불 끄기.
    /// 먹기는 가장 좋은 품질부터(회복 대상은 `FieldCombat.Eat` 이 고른다). `WorldMapBuilder` 가 Play 때 붙인다 — 런타임 UI 라 람다 리스너를 쓴다.
    /// </summary>
    public class CookingUi : MonoBehaviour
    {
        public static CookingUi Instance { get; private set; }
        /// <summary>진단 — 0 이상이면 불 끌 때 바늘을 이 자리로 본다.</summary>
        public static float NeedleForTest = -1f;

        private const float RowTop = 238f, RowStep = 62f, BarW = 800f;

        private GameObject _panel;
        private TextMeshProUGUI _title, _buffs;
        // U-0030 재료 줄 — 재료마다 그림 + "이름 개수" 글자(그림 없는 재료는 글자만). 옛 한 줄 글은 MatsText 로 이어 준다.
        private readonly Image[] _matIcons = new Image[GoCooking.Items.Length];
        private readonly TextMeshProUGUI[] _matTexts = new TextMeshProUGUI[GoCooking.Items.Length];
        private string _matsLine = "";
        private readonly TextMeshProUGUI[] _rows = new TextMeshProUGUI[8];
        private readonly Button[] _cook = new Button[8], _auto = new Button[8], _eat = new Button[8];
        private GameObject _needleRoot;
        private RectTransform _needle, _okZone, _bestZone;
        private TextMeshProUGUI _needleText;
        private int _cooking = -1;
        private float _t0;

        public Button OpenButton { get; private set; }
        public Button StopButton { get; private set; }
        public Button CloseButton { get; private set; }
        public Button CookButton(int i) => _cook[i];
        public Button AutoButton(int i) => _auto[i];
        public Button EatButton(int i) => _eat[i];
        public string RowText(int i) => _rows[i].text;
        public string MatsText => _matsLine;
        public string BuffText => _buffs.text;
        public bool IsOpen => _panel != null && _panel.activeSelf;
        public int Cooking => _cooking;

        private void Awake() => Instance = this;
        private void OnDestroy()
        {
            CookState.Changed -= OnChanged;
            if (Instance == this) Instance = null;
        }

        private void Start()
        {
            Build();
            CookState.Changed += OnChanged;
            _panel.SetActive(false);
        }

        private void OnChanged()
        {
            if (IsOpen) Refresh();
        }

        private static void Center(RectTransform r) => r.pivot = new Vector2(0.5f, 0.5f);

        private void Build()
        {
            var canvas = EncounterUiKit.NewCanvas("CookingUI");
            canvas.sortingOrder = 8;
            var t = canvas.transform;
            var mid = new Vector2(0.5f, 0.5f);

            OpenButton = EncounterUiKit.NewButton(t, GoLocalization.T("cook.button", "요리"), new Vector2(1f, 1f), new Vector2(-200f, -330f), new Vector2(160f, 80f), null);
            OpenButton.onClick.AddListener(Toggle);

            _panel = new GameObject("CookPanel", typeof(RectTransform));
            _panel.transform.SetParent(t, false);
            var pr = (RectTransform)_panel.transform;
            pr.anchorMin = Vector2.zero; pr.anchorMax = Vector2.one;
            pr.offsetMin = pr.offsetMax = Vector2.zero;
            _panel.AddComponent<Image>().color = new Color(0.03f, 0.03f, 0.04f, 0.93f);

            _title = EncounterUiKit.NewText(_panel.transform, "", mid, new Vector2(0f, 390f), new Vector2(1200f, 40f), 26);
            _title.fontStyle = FontStyles.Bold;
            Center(_title.rectTransform);
            const float MatCell = 138f, MatIcon = 34f;
            for (int i = 0; i < _matTexts.Length; i++)
            {
                float cx = (i - (_matTexts.Length - 1) * 0.5f) * MatCell;
                var ig = new GameObject("MatIcon", typeof(RectTransform));
                ig.transform.SetParent(_panel.transform, false);
                var ir = (RectTransform)ig.transform;
                ir.anchorMin = ir.anchorMax = ir.pivot = mid;
                ir.anchoredPosition = new Vector2(cx - 45f, 342f);
                ir.sizeDelta = new Vector2(MatIcon, MatIcon);
                _matIcons[i] = ig.AddComponent<Image>();
                _matIcons[i].raycastTarget = false;
                _matIcons[i].preserveAspect = true;
                _matIcons[i].enabled = false;
                _matTexts[i] = EncounterUiKit.NewText(_panel.transform, "", mid, new Vector2(cx + 17f, 342f), new Vector2(MatCell - 38f, 34f), 15);
                _matTexts[i].enableAutoSizing = true;
                _matTexts[i].fontSizeMin = 11f;
                _matTexts[i].fontSizeMax = 15f;
                _matTexts[i].textWrappingMode = TextWrappingModes.NoWrap;
                _matTexts[i].alignment = TextAlignmentOptions.MidlineLeft;
                Center(_matTexts[i].rectTransform);
            }
            _buffs = EncounterUiKit.NewText(_panel.transform, "", mid, new Vector2(0f, 302f), new Vector2(1400f, 30f), 16);
            Center(_buffs.rectTransform);

            for (int i = 0; i < 8; i++)
            {
                float y = RowTop - i * RowStep;
                _rows[i] = EncounterUiKit.NewText(_panel.transform, "", mid, new Vector2(-250f, y), new Vector2(820f, 56f), 16);
                _rows[i].alignment = TextAlignmentOptions.MidlineLeft;
                _rows[i].lineSpacing = -6f;
                Center(_rows[i].rectTransform);
                int k = i;
                _cook[i] = Btn(GoLocalization.T("cook.btn_cook", "조리"), new Vector2(260f, y), 140f, () => StartCook(k));
                _auto[i] = Btn(GoLocalization.T("cook.btn_auto", "자동"), new Vector2(410f, y), 140f, () => AutoCook(k));
                _eat[i] = Btn("", new Vector2(580f, y), 180f, () => Eat(k));
            }

            _needleRoot = new GameObject("Needle", typeof(RectTransform));
            _needleRoot.transform.SetParent(_panel.transform, false);
            _needleText = EncounterUiKit.NewText(_needleRoot.transform, "", mid, new Vector2(0f, -240f), new Vector2(1000f, 30f), 17);
            Center(_needleText.rectTransform);
            Bar(_needleRoot.transform, new Vector2(0f, -280f), new Vector2(BarW, 28f), new Color(0.2f, 0.2f, 0.22f));
            _okZone = Bar(_needleRoot.transform, new Vector2(0f, -280f), new Vector2(10f, 28f), new Color(0.85f, 0.7f, 0.25f));
            _bestZone = Bar(_needleRoot.transform, new Vector2(0f, -280f), new Vector2(10f, 28f), new Color(1f, 0.4f, 0.2f));
            _needle = Bar(_needleRoot.transform, new Vector2(0f, -280f), new Vector2(6f, 44f), Color.white);
            StopButton = EncounterUiKit.NewButton(_needleRoot.transform, GoLocalization.T("cook.btn_stop", "불 끄기"), mid, new Vector2(0f, -336f), new Vector2(260f, 52f), null);
            Center((RectTransform)StopButton.transform);
            StopButton.onClick.AddListener(Stop);
            _needleRoot.SetActive(false);

            CloseButton = EncounterUiKit.NewButton(_panel.transform, GoLocalization.T("dex.close", "닫는다"), mid, new Vector2(0f, -405f), new Vector2(200f, 44f), null);
            Center((RectTransform)CloseButton.transform);
            CloseButton.onClick.AddListener(Close);
        }

        private Button Btn(string label, Vector2 pos, float w, UnityEngine.Events.UnityAction a)
        {
            var b = EncounterUiKit.NewButton(_panel.transform, label, new Vector2(0.5f, 0.5f), pos, new Vector2(w, 48f), null);
            Center((RectTransform)b.transform);
            b.GetComponentInChildren<TextMeshProUGUI>().fontSize = 16;
            b.onClick.AddListener(a);
            return b;
        }

        private static RectTransform Bar(Transform parent, Vector2 pos, Vector2 size, Color c)
        {
            var go = new GameObject("Bar", typeof(RectTransform));
            go.transform.SetParent(parent, false);
            var r = (RectTransform)go.transform;
            r.anchorMin = r.anchorMax = r.pivot = new Vector2(0.5f, 0.5f);
            r.anchoredPosition = pos;
            r.sizeDelta = size;
            go.AddComponent<Image>().color = c;
            return r;
        }

        public void Toggle()
        {
            if (IsOpen) Close();
            else Open();
        }

        public void Open()
        {
            if (_panel == null) return;
            _cooking = -1;
            _panel.SetActive(true);
            Refresh();
        }

        public void Close()
        {
            _cooking = -1;
            if (_panel != null) _panel.SetActive(false);
        }

        private void StartCook(int i)
        {
            if (!CookState.CanCook(i, CookField.PlayerAtPot(), out string why)) { Toast(why); return; }
            _cooking = i;
            _t0 = Time.unscaledTime;
            Refresh();
        }

        private void Stop()
        {
            if (_cooking < 0) return;
            int i = _cooking;
            _cooking = -1;
            var r = GoCooking.Recipes[i];
            float needle = NeedleForTest >= 0f ? NeedleForTest : GoCooking.NeedleAt(Time.unscaledTime - _t0);
            int q = GoCooking.QualityAt(r, needle);
            string got = CookState.Cook(i, q, CookField.PlayerAtPot());
            Toast(got != null ? string.Format(GoLocalization.T("cook.done", "{0} 완성"), GoCooking.DishName(r.Id, q)) : Why(i));
            Refresh();
        }

        private void AutoCook(int i)
        {
            string got = CookState.AutoCook(i, CookField.PlayerAtPot());
            Toast(got != null ? string.Format(GoLocalization.T("cook.auto_done", "자동 조리 — {0}"), GoCooking.DishName(GoCooking.Recipes[i].Id, 1)) : Why(i));
            Refresh();
        }

        private static string Why(int i)
        {
            CookState.CanCook(i, CookField.PlayerAtPot(), out string why);
            return why ?? "";
        }

        private void Eat(int i)
        {
            var fc = FieldCombat.Instance;
            string why = GoLocalization.T("cook.why.nobody", "먹일 사람이 없다");
            string text = fc != null ? fc.Eat(i, out why) : null;
            Toast(text ?? why);
            Refresh();
        }

        private static void Toast(string text)
        {
            if (DialogueLabel.Instance != null && !string.IsNullOrEmpty(text)) DialogueLabel.Instance.Show(text, 2.5f);
        }

        public void Refresh()
        {
            bool pot = CookField.PlayerAtPot();
            _title.text = GoLocalization.T("cook.title", "요리") + " — " + (pot ? GoLocalization.T("cook.at_pot", "솥 곁 — 조리할 수 있다") : GoLocalization.T("cook.away", "역참 곁 솥에서 조리 · 먹기는 어디서나"));
            var mats = new List<string>();
            for (int i = 0; i < GoCooking.Items.Length; i++)
            {
                var it = GoCooking.Items[i];
                string cell = $"{it.Name} {CookState.Count(it.Id)}";
                mats.Add(cell);
                _matTexts[i].text = cell;
                var icon = GoItemIcons.Material(it.Id);
                _matIcons[i].sprite = icon;
                _matIcons[i].enabled = icon != null;
            }
            _matsLine = string.Join(" · ", mats);
            var buffs = new List<string>();
            foreach (var (cat, ri, q, left) in CookState.Buffs())
                buffs.Add(string.Format(GoLocalization.T("cook.buff_left", "{0} {1} {2}초"), GoCooking.CatName(cat), GoCooking.DishName(GoCooking.Recipes[ri].Id, q), Mathf.CeilToInt(left)));
            _buffs.text = buffs.Count > 0 ? GoLocalization.T("cook.buffs", "켜진 효과") + " · " + string.Join(" · ", buffs) : "";

            for (int i = 0; i < 8; i++)
            {
                var r = GoCooking.Recipes[i];
                var ing = new List<string>();
                foreach (var (item, n) in r.Ing) ing.Add($"{GoCooking.ItemName(item)} {CookState.Count(item)}/{n}");
                _rows[i].text = $"<b>{r.Name}</b>  <size=14>{string.Join(" · ", ing)} · " + string.Format(GoLocalization.T("cook.prof", "숙련 {0}/{1}"), Mathf.Min(GoCooking.ProfMax, CookState.Prof(r.Id)), GoCooking.ProfMax)
                    + $"</size>\n<size=14><color=#b9c2cc>{GoCooking.EffectText(r, 1)}</color></size>";
                bool can = CookState.CanCook(i, pot, out _);
                _cook[i].interactable = can && _cooking < 0;
                _auto[i].gameObject.SetActive(CookState.CanAuto(r.Id));
                _auto[i].interactable = can && _cooking < 0;
                int have = 0;
                for (int q = 0; q < 3; q++) have += CookState.Count(GoCooking.DishId(r.Id, q));
                int best = CookState.BestDish(i);
                _eat[i].GetComponentInChildren<TextMeshProUGUI>().text = have > 0
                    ? string.Format(GoLocalization.T("cook.btn_eat", "먹기 ×{0} ({1})"), have, GoCooking.QualityName(best))
                    : GoLocalization.T("cook.btn_eat_none", "요리 없음");
                _eat[i].interactable = have > 0;
            }

            _needleRoot.SetActive(_cooking >= 0);
            if (_cooking >= 0)
            {
                var r = GoCooking.Recipes[_cooking];
                _needleText.text = string.Format(GoLocalization.T("cook.needle", "{0} — 바늘이 맛있는 칸에 올 때 불을 끈다"), r.Name);
                _okZone.anchoredPosition = new Vector2((r.Zone - 0.5f) * BarW, -280f);
                _okZone.sizeDelta = new Vector2(GoCooking.NormalHalf * 2f * BarW, 28f);
                _bestZone.anchoredPosition = new Vector2((r.Zone - 0.5f) * BarW, -280f);
                _bestZone.sizeDelta = new Vector2(GoCooking.PerfectHalf * 2f * BarW, 28f);
            }
        }

        private void Update()
        {
            if (OpenButton != null) OpenButton.gameObject.SetActive(IsOpen || CookField.PlayerAtPot() || CookState.HasDish());
            var kb = Keyboard.current;
            if (kb != null)
            {
                if (kb.gKey.wasPressedThisFrame) Toggle();
                else if (kb.escapeKey.wasPressedThisFrame && IsOpen) Close();
            }
            if (_cooking >= 0 && _needle != null)
                _needle.anchoredPosition = new Vector2((GoCooking.NeedleAt(Time.unscaledTime - _t0) - 0.5f) * BarW, -280f);
        }
    }
}
