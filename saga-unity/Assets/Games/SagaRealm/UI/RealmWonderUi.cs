using TMPro;
using UnityEngine;
using UnityEngine.UI;
using Saga.Realm.Data;

namespace Saga.Realm.UI
{
    /// <summary>
    /// tasks U-0136 불가사의 창(웹 W-0279 성 창 「🏛️ 불가사의」 칸) — 기술 창 아래 왼쪽 단추가 연다. 여섯 줄: 이름·비용(금·인부·달)·효과·
    /// 진행(완공한 쪽 / 짓는 쪽들 %) + 「짓기」(지금 성에서, 못 지으면 이유를 토스트). 기술 창과 같은 꼴(RealmUiKit, Play 때 짓기).
    /// </summary>
    public class RealmWonderUi : MonoBehaviour
    {
        public static RealmWonderUi Instance { get; private set; }

        private GameObject _panel;
        private TextMeshProUGUI _title;
        private readonly TextMeshProUGUI[] _rowText = new TextMeshProUGUI[6];
        private readonly Button[] _rowButton = new Button[6];

        public bool PanelOpen => _panel != null && _panel.activeSelf;
        public string RowText(int i) => _rowText[i] != null ? _rowText[i].text : "";
        public Button RowButton(int i) => _rowButton[i];
        public RectTransform Root => _panel != null ? (RectTransform)_panel.transform : null;

        public static RealmWonderUi Install()
        {
            if (Instance != null) return Instance;
            return new GameObject("RealmWonderUi").AddComponent<RealmWonderUi>();
        }

        private void Awake()
        {
            Instance = this;
            Build();
            RealmWonder.Changed += Refresh;
            RealmCityState.Changed += Refresh;
            RealmTechData.Changed += Refresh;
        }

        private void OnDestroy()
        {
            RealmWonder.Changed -= Refresh;
            RealmCityState.Changed -= Refresh;
            RealmTechData.Changed -= Refresh;
            if (Instance == this) Instance = null;
        }

        private void Build()
        {
            var canvas = RealmUiKit.NewCanvas("RealmWonderUI");
            canvas.sortingOrder = 8; // 기술 창(7) 위
            canvas.transform.SetParent(transform, false);
            _panel = RealmUiKit.NewPanel(canvas.transform, new Vector2(0.5f, 0.5f), new Vector2(1000f, 800f), new Color(0f, 0f, 0f, 0.9f));
            _panel.SetActive(false);
            _title = RealmUiKit.NewText(_panel.transform, "", new Vector2(0.5f, 1f), new Vector2(0f, -24f), new Vector2(900f, 60f), 26);
            for (int i = 0; i < RealmWonder.All.Length; i++)
            {
                float y = -100f - 100f * i;
                _rowText[i] = RealmUiKit.NewText(_panel.transform, "", new Vector2(0f, 1f), new Vector2(30f, y), new Vector2(690f, 94f), 20);
                _rowText[i].alignment = TextAlignmentOptions.Left;
                string id = RealmWonder.All[i].Id;
                _rowButton[i] = RealmUiKit.NewButton(_panel.transform, RealmLocalization.T("wonder.build", "짓기"), new Vector2(1f, 1f), new Vector2(-30f, y - 10f), new Vector2(220f, 74f), () => Press(id));
            }
            RealmUiKit.NewButton(_panel.transform, RealmLocalization.T("settings.close", "닫기"), new Vector2(0.5f, 0f), new Vector2(0f, 20f), new Vector2(300f, 66f), Close);
            Refresh();
        }

        public void Open()
        {
            _panel.SetActive(true);
            _panel.transform.SetAsLastSibling();
            Refresh();
        }

        public void Close() { if (_panel != null) _panel.SetActive(false); }

        public void Press(string id)
        {
            string city = RealmCityState.CurrentCity;
            string why = RealmWonder.Start(id, city);
            var d = RealmWonder.Get(id);
            RealmToast.Instance?.Show(why ?? string.Format(RealmLocalization.T("wonder.started", "{0} {1} — {2}달 공사를 시작했다(금 {3}·인부 {4})"), d.Emoji, d.Name, d.Months, d.Gold, d.Men), 3f);
            Refresh();
        }

        public void Refresh()
        {
            if (!PanelOpen) return;
            _title.text = RealmLocalization.T("wonder.title", "🏛️ 불가사의 — 먼저 다 지은 쪽만 효과 · 늦으면 금 반 환급") +
                (RealmTechData.WonderOpen ? "" : "\n" + RealmLocalization.T("wonder.why_tech", "학 갈래 「큰 도면」을 먼저 연구해야 합니다"));
            string city = RealmCityState.CurrentCity;
            for (int i = 0; i < RealmWonder.All.Length; i++)
            {
                var d = RealmWonder.All[i];
                _rowText[i].text = string.Format(RealmLocalization.T("wonder.row", "{0} {1} — 금 {2}·인부 {3}·{4}달\n{5} · {6}"),
                    d.Emoji, d.Name, d.Gold, d.Men, d.Months, d.Desc, RealmWonder.RaceLine(d.Id));
                _rowButton[i].interactable = RealmWonder.Why(d.Id, city) == null;
            }
        }
    }
}
