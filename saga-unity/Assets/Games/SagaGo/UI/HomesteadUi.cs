using TMPro;
using UnityEngine;
using UnityEngine.InputSystem;
using UnityEngine.UI;
using Saga.Go.Data;
using Saga.Go.World;

namespace Saga.Go.UI
{
    /// <summary>
    /// tasks U-0032 쉼터 마당 창(saga-godot `world/homestead.gd` 화면, 키 T → 이 트랙은 J) — 마당 둘레(<see cref="GoHomestead.PromptM"/>m) 안에서 "쉼터 (J)" 단추나 J 로 연다.
    /// 소품 열둘(금) 중 하나를 골라 "여기에 놓기"(서 있는 자리·돌림 4방향) · "가까운 것 치우기"(절반 환불) · "수확"(쌓인 금).
    /// 위에 마당 등급·안락도·시간당 금·쌓인 금을 보인다. 0.5초마다 새로 고친다. 런타임 UI 라 람다 리스너를 쓴다(`HuntLogUi` 와 같은 결).
    /// </summary>
    public class HomesteadUi : MonoBehaviour
    {
        public static HomesteadUi Instance { get; private set; }

        public const float RefreshSec = 0.5f;

        private GameObject _panel;
        private TextMeshProUGUI _title, _info;
        private Button[] _itemBtn;
        private TextMeshProUGUI[] _itemText;
        private float _refresh;

        public string PickId { get; private set; } = "flowers";
        public int Rot { get; private set; }
        public Button PromptButton { get; private set; }
        public Button PlaceButton { get; private set; }
        public Button RemoveButton { get; private set; }
        public Button HarvestButton { get; private set; }
        public Button RotateButton { get; private set; }
        public Button CloseButton { get; private set; }
        public Button ItemButton(int i) => _itemBtn[i];
        public string TitleText => _title.text;
        public string InfoText => _info.text;
        public string PromptLabel => PromptButton.GetComponentInChildren<TextMeshProUGUI>().text;
        public bool PromptShown => PromptButton != null && PromptButton.gameObject.activeSelf;
        public bool IsOpen => _panel != null && _panel.activeSelf;

        private void Awake() => Instance = this;
        private void OnDestroy() { HomeState.Changed -= OnChanged; if (Instance == this) Instance = null; }

        private void Start()
        {
            Build();
            HomeState.Changed += OnChanged;
            _panel.SetActive(false);
            Refresh();
        }

        private void OnChanged() => Refresh();
        private static void Center(RectTransform r) => r.pivot = new Vector2(0.5f, 0.5f);

        private void Build()
        {
            int n = GoHomestead.Items.Length;
            _itemBtn = new Button[n]; _itemText = new TextMeshProUGUI[n];
            var canvas = EncounterUiKit.NewCanvas("HomesteadUI");
            canvas.sortingOrder = 8;
            var t = canvas.transform;
            var mid = new Vector2(0.5f, 0.5f);

            PromptButton = EncounterUiKit.NewButton(t, GoLocalization.T("home.prompt", "쉼터 (J)"), new Vector2(0.5f, 0f), new Vector2(0f, 150f), new Vector2(260f, 52f), null);
            PromptButton.onClick.AddListener(Open);

            _panel = new GameObject("HomesteadPanel", typeof(RectTransform));
            _panel.transform.SetParent(t, false);
            var pr = (RectTransform)_panel.transform;
            pr.anchorMin = Vector2.zero; pr.anchorMax = Vector2.one;
            pr.offsetMin = pr.offsetMax = Vector2.zero;
            _panel.AddComponent<Image>().color = new Color(0.03f, 0.03f, 0.04f, 0.93f);

            _title = EncounterUiKit.NewText(_panel.transform, "", mid, new Vector2(0f, 390f), new Vector2(1100f, 40f), 26);
            _title.fontStyle = FontStyles.Bold; Center(_title.rectTransform);
            _info = EncounterUiKit.NewText(_panel.transform, "", mid, new Vector2(0f, 335f), new Vector2(1100f, 50f), 18);
            Center(_info.rectTransform);

            for (int i = 0; i < n; i++)
            {
                int k = i;
                float x = (i % 2 == 0) ? -270f : 270f;
                float y = 250f - (i / 2) * 62f;
                _itemBtn[i] = EncounterUiKit.NewButton(_panel.transform, "", mid, new Vector2(x, y), new Vector2(520f, 54f), null);
                Center((RectTransform)_itemBtn[i].transform);
                _itemText[i] = _itemBtn[i].GetComponentInChildren<TextMeshProUGUI>();
                _itemText[i].fontSize = 18;
                _itemBtn[i].onClick.AddListener(() => Pick(GoHomestead.Items[k].Id));
            }

            RotateButton = Btn(GoLocalization.T("home.rotate", "돌리기"), new Vector2(-480f, -190f), 200f, Rotate);
            PlaceButton = Btn(GoLocalization.T("home.place", "여기에 놓기"), new Vector2(-240f, -190f), 220f, PlaceHere);
            RemoveButton = Btn(GoLocalization.T("home.remove", "가까운 것 치우기"), new Vector2(40f, -190f), 280f, RemoveNearby);
            HarvestButton = Btn(GoLocalization.T("home.harvest", "수확"), new Vector2(330f, -190f), 200f, Harvest);
            CloseButton = Btn(GoLocalization.T("dex.close", "닫는다"), new Vector2(0f, -405f), 200f, Close);
        }

        private Button Btn(string label, Vector2 pos, float w, UnityEngine.Events.UnityAction act)
        {
            var b = EncounterUiKit.NewButton(_panel.transform, label, new Vector2(0.5f, 0.5f), pos, new Vector2(w, 52f), null);
            Center((RectTransform)b.transform);
            b.onClick.AddListener(act);
            return b;
        }

        // ---- 동작 ----

        public void Toggle() { if (IsOpen) Close(); else Open(); }

        public void Open()
        {
            if (_panel == null) return;
            var f = HomesteadField.Instance;
            if (f == null || !f.Near) return;   // 마당 둘레에서만 연다
            _panel.SetActive(true);
            Refresh();
        }

        public void Close() { if (_panel != null) _panel.SetActive(false); }

        public void Pick(string id) { if (GoHomestead.Find(id) == null) return; PickId = id; Refresh(); }
        public void Rotate() { Rot = (Rot + 1) % 4; Refresh(); }
        public void PlaceHere() { HomesteadField.Instance?.PlaceHere(PickId, Rot); Refresh(); }
        public void RemoveNearby() { HomesteadField.Instance?.RemoveNearby(); Refresh(); }
        public void Harvest() { HomesteadField.Instance?.HarvestNow(); Refresh(); }

        // ---- 글 ----

        public static string InfoLine()
        {
            var tier = GoHomestead.Tiers[HomeState.Tier()];
            return string.Format(GoLocalization.T("home.info", "{0} · 안락도 {1} · 시간당 금 {2} · 쌓인 금 {3} · 소품 {4}/{5}"),
                tier.Name, HomeState.Comfort(), tier.Income, HomeState.Pending(), HomeState.Count, GoHomestead.MaxItems);
        }

        public void Refresh()
        {
            if (_panel == null) return;
            var f = HomesteadField.Instance;
            int pend = HomeState.Pending();
            bool show = !IsOpen && f != null && f.Near;
            PromptButton.gameObject.SetActive(show);
            PromptButton.GetComponentInChildren<TextMeshProUGUI>().text = GoLocalization.T("home.prompt", "쉼터 (J)") + (pend >= 100 ? " ●" + pend : "");
            if (!IsOpen) return;
            _title.text = string.Format(GoLocalization.T("home.title", "쉼터 마당 — 돌림 {0}°"), Rot * 90);
            _info.text = InfoLine();
            for (int i = 0; i < GoHomestead.Items.Length; i++)
            {
                var it = GoHomestead.Items[i];
                bool on = it.Id == PickId;
                _itemText[i].text = (on ? "▶ " : "") + $"{it.Name}  <size=15>금 {it.Cost} · 안락도 {it.Comfort}</size>";
                _itemText[i].color = on ? new Color(1f, 0.88f, 0.4f) : Color.white;
            }
            HarvestButton.interactable = pend > 0;
            PlaceButton.interactable = f != null && f.Inside;
            RemoveButton.interactable = HomeState.Count > 0;
        }

        private void Update()
        {
            var kb = Keyboard.current;
            var f = HomesteadField.Instance;
            if (kb != null)
            {
                if (kb.jKey.wasPressedThisFrame && (IsOpen || (f != null && f.Near))) Toggle();
                else if (kb.escapeKey.wasPressedThisFrame && IsOpen) Close();
            }
            _refresh -= Time.unscaledDeltaTime;
            if (_refresh <= 0f) { _refresh = RefreshSec; Refresh(); }
        }
    }
}
