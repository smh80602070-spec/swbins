using System.Text;
using TMPro;
using UnityEngine;
using UnityEngine.InputSystem;
using UnityEngine.UI;
using Saga.Go.Data;

namespace Saga.Go.UI
{
    /// <summary>
    /// tasks U-0046 신수 알·동행 창(saga-godot `world/egg_incubator.gd`, 키 I) — I 키 또는 위 오른쪽 "신수 알" 단추로 연다. 세 칸:
    /// 부화기(칸 1~3, 레벨로 열림 — 걸음/필요 m·"되돌리기") · 알 주머니(최대 9 — "부화기에 넣기") · 신수 도감(11 — 보너스·친밀·"동행"/"내보내기").
    /// `WorldMapBuilder` 가 Play 때 붙인다 — 런타임 UI 라 람다 리스너를 쓴다(`HuntLogUi` 와 같은 결). 걸음 세기는 `EggWalker`.
    /// </summary>
    public class EggUi : MonoBehaviour
    {
        public static EggUi Instance { get; private set; }

        private const float ColX = 510f, RowTop = 270f, RowStep = 46f, ColW = 480f, Gap = 10f; // 열 폭 480 — 가운데 −510·0·510 → ±750 안(논리 폭 1600)
        private static readonly int IncRows = GoEggs.SlotRank.Length, BagRows = GoEggs.BagMax, PetRows = 11;

        private GameObject _panel;
        private TextMeshProUGUI _title;
        private Row[] _inc, _bag, _pet;
        private float _tick;

        private struct Row { public TextMeshProUGUI Text; public Button Btn; public TextMeshProUGUI BtnText; public GameObject Root; }

        public Button OpenButton { get; private set; }
        public Button CloseButton { get; private set; }
        public bool IsOpen => _panel != null && _panel.activeSelf;
        public string TitleText => _title.text;
        public string OpenLabel => OpenButton.GetComponentInChildren<TextMeshProUGUI>().text;
        public string IncText(int i) => _inc[i].Text.text;
        public string BagText(int i) => _bag[i].Text.text;
        public string PetText(int i) => _pet[i].Text.text;
        public Button IncButton(int i) => _inc[i].Btn;
        public Button BagButton(int i) => _bag[i].Btn;
        public Button PetButton(int i) => _pet[i].Btn;
        public bool BagRowShown(int i) => _bag[i].Root.activeSelf;
        public bool IncRowShown(int i) => _inc[i].Root.activeSelf;

        private void Awake() => Instance = this;

        private void OnDestroy()
        {
            EggState.Changed -= OnChanged;
            if (Instance == this) Instance = null;
        }

        private void Start()
        {
            Build();
            EggState.Changed += OnChanged;
            _panel.SetActive(false);
            Refresh();
        }

        private void OnChanged() { if (_panel != null && IsOpen) Refresh(); else RefreshButton(); }

        private static void Center(RectTransform r) => r.pivot = new Vector2(0.5f, 0.5f);

        private Row NewRow(Transform parent, string name, float x, float y, float textW, float btnW, string btnLabel, UnityEngine.Events.UnityAction onClick)
        {
            var mid = new Vector2(0.5f, 0.5f);
            var root = new GameObject(name, typeof(RectTransform));
            root.transform.SetParent(parent, false);
            var rr = (RectTransform)root.transform; rr.anchorMin = rr.anchorMax = mid; rr.sizeDelta = Vector2.zero;
            float left = x - ColW / 2f; // 열 왼쪽 끝
            var text = EncounterUiKit.NewText(root.transform, "", mid, new Vector2(left + textW / 2f, y), new Vector2(textW, 42f), 17);
            text.alignment = TextAlignmentOptions.MidlineLeft; Center(text.rectTransform);
            text.enableAutoSizing = true; text.fontSizeMin = 11f; text.fontSizeMax = 17f; // 긴 줄(신수 보너스·친밀)이 칸 밖으로 안 나가게
            var btn = EncounterUiKit.NewButton(root.transform, btnLabel, mid, new Vector2(left + textW + Gap + btnW / 2f, y), new Vector2(btnW, 38f), null);
            Center((RectTransform)btn.transform);
            var bt = btn.GetComponentInChildren<TextMeshProUGUI>(); bt.fontSize = 15;
            btn.onClick.AddListener(onClick);
            return new Row { Text = text, Btn = btn, BtnText = bt, Root = root };
        }

        private void Build()
        {
            var canvas = EncounterUiKit.NewCanvas("EggUI");
            canvas.sortingOrder = 8;
            var t = canvas.transform;
            var mid = new Vector2(0.5f, 0.5f);

            OpenButton = EncounterUiKit.NewButton(t, GoLocalization.T("egg.button", "신수 알"), new Vector2(1f, 1f), new Vector2(-200f, -370f), new Vector2(160f, 50f), null); // 둘째 열, 재출항 밑
            OpenButton.onClick.AddListener(Toggle);

            _panel = new GameObject("EggPanel", typeof(RectTransform));
            _panel.transform.SetParent(t, false);
            var pr = (RectTransform)_panel.transform;
            pr.anchorMin = Vector2.zero; pr.anchorMax = Vector2.one;
            pr.offsetMin = pr.offsetMax = Vector2.zero;
            _panel.AddComponent<Image>().color = new Color(0.03f, 0.03f, 0.04f, 0.95f);

            _title = EncounterUiKit.NewText(_panel.transform, "", mid, new Vector2(0f, 400f), new Vector2(1500f, 44f), 26);
            _title.fontStyle = FontStyles.Bold; Center(_title.rectTransform);

            _inc = new Row[IncRows]; _bag = new Row[BagRows]; _pet = new Row[PetRows];
            Header(-ColX, GoLocalization.T("egg.h_inc", "부화기"));
            Header(0f, GoLocalization.T("egg.h_bag", "알 주머니"));
            Header(ColX, GoLocalization.T("egg.h_pets", "신수 도감"));
            for (int i = 0; i < IncRows; i++) { int k = i; _inc[i] = NewRow(_panel.transform, "Inc" + i, -ColX, RowTop - i * RowStep, 340f, 130f, GoLocalization.T("egg.back", "되돌리기"), () => StopInc(k)); }
            for (int i = 0; i < BagRows; i++) { int k = i; _bag[i] = NewRow(_panel.transform, "Bag" + i, 0f, RowTop - i * RowStep, 320f, 150f, GoLocalization.T("egg.start", "부화기에 넣기"), () => StartBag(k)); }
            for (int i = 0; i < PetRows; i++) { int k = i; _pet[i] = NewRow(_panel.transform, "Pet" + i, ColX, RowTop - i * RowStep, 360f, 110f, GoLocalization.T("egg.buddy", "동행"), () => PickBuddy(k)); }

            CloseButton = EncounterUiKit.NewButton(_panel.transform, GoLocalization.T("dex.close", "닫는다"), mid, new Vector2(0f, -405f), new Vector2(200f, 44f), null);
            Center((RectTransform)CloseButton.transform);
            CloseButton.onClick.AddListener(Close);
        }

        private void Header(float x, string text)
        {
            var h = EncounterUiKit.NewText(_panel.transform, text, new Vector2(0.5f, 0.5f), new Vector2(x, RowTop + 55f), new Vector2(ColW, 36f), 22);
            h.fontStyle = FontStyles.Bold; h.color = new Color(0.56f, 0.83f, 1f); Center(h.rectTransform);
        }

        // ---- 동작 ----

        public void Toggle() { if (IsOpen) Close(); else Open(); }

        public void Open() {
            if (!IsOpen) Saga.Go.Audio.GoSfx.Play("ui_open"); // U-0048
            if (_panel == null) return; _panel.SetActive(true); Refresh(); }

        public void Close() {
            if (IsOpen) Saga.Go.Audio.GoSfx.Play("ui_close"); // U-0048
            if (_panel != null) _panel.SetActive(false); }

        public void StartBag(int i)
        {
            string err = EggState.Start(i);
            if (err.Length > 0) Toast(err);
            Refresh();
        }

        public void StopInc(int i)
        {
            string err = EggState.Stop(i);
            if (err.Length > 0) Toast(err);
            Refresh();
        }

        public void PickBuddy(int i)
        {
            if (i < 0 || i >= GoEggs.Pets.Length) return;
            var p = GoEggs.Pets[i];
            string err = EggState.Buddy == p.Id ? EggState.SetBuddy("") : EggState.SetBuddy(p.Id);
            if (err.Length > 0) Toast(err);
            else if (EggState.Buddy == p.Id) Toast(string.Format(GoLocalization.T("egg.buddy_set", "{0}이(가) 따라온다 — {1}"), p.Name, GoEggs.BonusLabel(p)));
            Refresh();
        }

        private static void Toast(string text)
        {
            if (DialogueLabel.Instance != null && !string.IsNullOrEmpty(text)) DialogueLabel.Instance.Show(text, 3f);
        }

        // ---- 글 ----

        private void RefreshButton()
        {
            if (OpenButton == null) return;
            var open = OpenButton.GetComponentInChildren<TextMeshProUGUI>();
            int idle = EggState.BagCount > 0 && EggState.IncCount < EggState.Slots ? 1 : 0;
            open.text = GoLocalization.T("egg.button", "신수 알") + (idle > 0 ? " ●" : "");
            open.color = idle > 0 ? new Color(1f, 0.88f, 0.4f) : Color.white;
        }

        public static string PetLine(GoEggs.Pet p)
        {
            bool own = EggState.Owns(p.Id);
            if (!own) return $"<color=#7f8790>???  <size=14>{string.Format(GoLocalization.T("egg.rarity", "희귀 ★{0}"), p.Rarity)}</size></color>";
            string mark = EggState.Buddy == p.Id ? "<color=#ffd54a>▶</color> " : "";
            return $"{mark}<b>{p.Name}</b>  <size=14><color=#b9c2cc>{GoEggs.BonusLabel(p)} · {string.Format(GoLocalization.T("egg.friend", "친밀 {0}/{1}"), EggState.BuddyLevelOf(p.Id), GoEggs.BuddyMaxLevel)}</color></size>";
        }

        public void Refresh()
        {
            if (_panel == null) return;
            RefreshButton();
            if (!IsOpen) return;
            var buddy = GoEggs.Find(EggState.Buddy);
            string buddyText = buddy == null ? GoLocalization.T("egg.no_buddy", "동행 없음")
                : string.Format(GoLocalization.T("egg.buddy_now", "동행 {0} (친밀 {1}/{2})"), buddy.Value.Name, EggState.BuddyLevel, GoEggs.BuddyMaxLevel);
            _title.text = string.Format(GoLocalization.T("egg.title", "신수 알 — 도감 {0}/{1} · {2} · 걸은 거리 {3}m"), EggState.OwnedCount, GoEggs.Pets.Length, buddyText, Mathf.RoundToInt(EggState.WalkTotal));

            int slots = EggState.Slots;
            for (int i = 0; i < IncRows; i++)
            {
                bool open = i < slots, has = i < EggState.IncCount;
                _inc[i].Root.SetActive(true);
                if (!open) { _inc[i].Text.text = $"<color=#7f8790>{string.Format(GoLocalization.T("egg.slot_locked", "칸 {0} — 레벨 {1} 에 열린다"), i + 1, GoEggs.SlotRank[i])}</color>"; _inc[i].Btn.gameObject.SetActive(false); continue; }
                _inc[i].Btn.gameObject.SetActive(has);
                if (!has) { _inc[i].Text.text = $"<color=#7f8790>{string.Format(GoLocalization.T("egg.slot_empty", "칸 {0} — 비었다"), i + 1)}</color>"; continue; }
                var e = EggState.IncAt(i); var tier = GoEggs.TierOf(e.Tier).Value;
                _inc[i].Text.text = $"<b>{tier.Name}</b>  <size=15><color=#ffd54a>{Mathf.Min(Mathf.RoundToInt(e.Walked), (int)tier.Need)}/{(int)tier.Need}m</color></size>";
            }
            for (int i = 0; i < BagRows; i++)
            {
                bool has = i < EggState.BagCount;
                _bag[i].Root.SetActive(has);
                if (!has) continue;
                var tier = GoEggs.TierOf(EggState.BagAt(i)).Value;
                _bag[i].Text.text = $"<b>{tier.Name}</b>  <size=14><color=#b9c2cc>{string.Format(GoLocalization.T("egg.need", "{0}m 걸으면 부화"), (int)tier.Need)}</color></size>";
                _bag[i].Btn.interactable = EggState.IncCount < slots;
            }
            for (int i = 0; i < PetRows; i++)
            {
                var p = GoEggs.Pets[i];
                _pet[i].Text.text = PetLine(p);
                bool own = EggState.Owns(p.Id);
                _pet[i].Btn.gameObject.SetActive(own);
                _pet[i].BtnText.text = EggState.Buddy == p.Id ? GoLocalization.T("egg.buddy_off", "내보내기") : GoLocalization.T("egg.buddy", "동행");
            }
        }

        private void Update()
        {
            var kb = Keyboard.current;
            if (kb != null)
            {
                if (kb.iKey.wasPressedThisFrame) Toggle();
                else if (kb.escapeKey.wasPressedThisFrame && IsOpen) Close();
            }
            _tick -= Time.unscaledDeltaTime;
            if (_tick <= 0f) { _tick = 0.5f; Refresh(); } // 걸음이 쌓이는 막대·단추 ●
        }
    }
}
