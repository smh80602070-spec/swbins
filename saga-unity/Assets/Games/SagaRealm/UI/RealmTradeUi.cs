using System.Collections.Generic;
using TMPro;
using UnityEngine;
using UnityEngine.UI;
using Saga.Realm.Data;

namespace Saga.Realm.UI
{
    /// <summary>
    /// tasks U-0172 교역로 창(웹 W-0301 성 창 「🐫 교역로」 칸 · 고돗 G-0310 ☰ 「🐫 교역」 창) — 기술 창 아래 오른쪽 단추가 연다.
    /// 위: 다니는 상단(둘까지, 길·달마다 금·남은 달) · 아래: 지금 성에서 벌이 큰 우리 성 셋 + 「띄우기」(못 띄우면 이유를 토스트).
    /// 불가사의 창과 같은 꼴(RealmUiKit, Play 때 짓기).
    /// </summary>
    public class RealmTradeUi : MonoBehaviour
    {
        public static RealmTradeUi Instance { get; private set; }
        public const int Picks = 3;

        private GameObject _panel;
        private TextMeshProUGUI _title, _routes, _hint;
        private readonly TextMeshProUGUI[] _rowText = new TextMeshProUGUI[Picks];
        private readonly Button[] _rowButton = new Button[Picks];
        private readonly string[] _rowTo = new string[Picks];

        public bool PanelOpen => _panel != null && _panel.activeSelf;
        public string RoutesText => _routes != null ? _routes.text : "";
        public string RowText(int i) => _rowText[i] != null && _rowText[i].gameObject.activeSelf ? _rowText[i].text : "";
        public Button RowButton(int i) => _rowButton[i];
        public RectTransform Root => _panel != null ? (RectTransform)_panel.transform : null;

        public static RealmTradeUi Install()
        {
            if (Instance != null) return Instance;
            return new GameObject("RealmTradeUi").AddComponent<RealmTradeUi>();
        }

        private void Awake()
        {
            Instance = this;
            Build();
            RealmTrade.Changed += Refresh;
            RealmCityState.Changed += Refresh;
        }

        private void OnDestroy()
        {
            RealmTrade.Changed -= Refresh;
            RealmCityState.Changed -= Refresh;
            if (Instance == this) Instance = null;
        }

        private void Build()
        {
            var canvas = RealmUiKit.NewCanvas("RealmTradeUI");
            canvas.sortingOrder = 8; // 기술 창(7) 위 — 불가사의 창과 같은 층(둘이 함께 열리지 않음)
            canvas.transform.SetParent(transform, false);
            _panel = RealmUiKit.NewPanel(canvas.transform, new Vector2(0.5f, 0.5f), new Vector2(1000f, 800f), new Color(0f, 0f, 0f, 0.9f));
            _panel.SetActive(false);
            _title = RealmUiKit.NewText(_panel.transform, "", new Vector2(0.5f, 1f), new Vector2(0f, -24f), new Vector2(900f, 60f), 26);
            _routes = RealmUiKit.NewText(_panel.transform, "", new Vector2(0f, 1f), new Vector2(30f, -100f), new Vector2(940f, 150f), 22);
            _routes.alignment = TextAlignmentOptions.Left;
            _hint = RealmUiKit.NewText(_panel.transform, "", new Vector2(0f, 1f), new Vector2(30f, -270f), new Vector2(940f, 50f), 20);
            _hint.alignment = TextAlignmentOptions.Left;
            for (int i = 0; i < Picks; i++)
            {
                float y = -340f - 110f * i;
                _rowText[i] = RealmUiKit.NewText(_panel.transform, "", new Vector2(0f, 1f), new Vector2(30f, y), new Vector2(690f, 94f), 20);
                _rowText[i].alignment = TextAlignmentOptions.Left;
                int k = i;
                _rowButton[i] = RealmUiKit.NewButton(_panel.transform, RealmLocalization.T("trade.start", "띄우기"), new Vector2(1f, 1f), new Vector2(-30f, y - 10f), new Vector2(220f, 74f), () => Press(k));
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

        public void Press(int i)
        {
            string from = RealmCityState.CurrentCity, to = _rowTo[i];
            if (string.IsNullOrEmpty(to)) return;
            string why = RealmTrade.Start(from, to);
            RealmToast.Instance?.Show(why ?? string.Format(RealmLocalization.T("trade.started", "🐫 상단을 띄웠다 — {0} · 달마다 금 {1}"), RealmTrade.Pair(from, to), RealmTrade.IncomeOf(from, to)), 3f);
            Refresh();
        }

        public void Refresh()
        {
            if (!PanelOpen) return;
            _title.text = string.Format(RealmLocalization.T("trade.title", "🐫 교역로 {0}/{1} — 금 {2} · {3}달 · 우리 땅으로 이어진 성끼리"),
                RealmTrade.Routes.Count, RealmTrade.Max, RealmTrade.Cost, RealmTrade.Months);
            var lines = new List<string>();
            foreach (var r in RealmTrade.Routes)
                lines.Add(string.Format(RealmLocalization.T("trade.row_on", "{0} — 달마다 금 {1} · {2}달 남음 · 지금까지 {3}"),
                    RealmTrade.Pair(r.from, r.to), RealmTrade.IncomeOf(r.from, r.to), r.left, r.gold));
            _routes.text = lines.Count > 0 ? string.Join("\n", lines) : RealmLocalization.T("trade.none", "다니는 상단이 없습니다");
            string from = RealmCityState.CurrentCity;
            var cs = RealmTrade.Candidates(from, Picks);
            _hint.text = cs.Count > 0
                ? string.Format(RealmLocalization.T("trade.from", "{0} 에서 띄울 만한 길"), RealmTrade.CityName(from))
                : RealmLocalization.T("trade.no_path", "이 성에서 우리 땅으로 이어진 성이 없습니다");
            for (int i = 0; i < Picks; i++)
            {
                bool has = i < cs.Count;
                _rowTo[i] = has ? cs[i] : null;
                _rowText[i].gameObject.SetActive(has);
                _rowButton[i].gameObject.SetActive(has);
                if (!has) continue;
                _rowText[i].text = string.Format(RealmLocalization.T("trade.row_pick", "{0}\n달마다 금 {1} × {2}달"),
                    RealmTrade.Pair(from, cs[i]), RealmTrade.IncomeOf(from, cs[i]), RealmTrade.Months);
                _rowButton[i].interactable = RealmTrade.Why(from, cs[i]) == null;
            }
        }
    }
}
