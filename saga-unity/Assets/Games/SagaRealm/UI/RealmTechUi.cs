using TMPro;
using UnityEngine;
using UnityEngine.UI;
using Saga.Realm.Data;

namespace Saga.Realm.UI
{
    /// <summary>
    /// tasks U-0129 기술 나무 창(웹 사가천하 W-0290 `tech.cardHtml`) — `GameBootstrap` 가 Play 때 세운다(씬 재빌드 없음, 명마 창과 같은 꼴).
    /// 왼쪽 아래 기둥(명마·날기 위)에 "📜 연구" 단추 → 창: 연구점·달마다 몫(학자 수) · 갈래 넷 줄(이름·●○ 마디·다음 마디·효과·값) · 줄마다 연구 단추.
    /// </summary>
    public class RealmTechUi : MonoBehaviour
    {
        public static RealmTechUi Instance { get; private set; }

        private GameObject _panel;
        private Button _toggle;
        /// <summary>왼쪽 아래 「연구」 단추 — U-0154 ☰ 메뉴 화면이 대신 누른다(숨기기만).</summary>
        public Button ToggleButton => _toggle;
        private TextMeshProUGUI _toggleLabel, _title, _points;
        private readonly TextMeshProUGUI[] _rowText = new TextMeshProUGUI[4];
        private readonly Button[] _rowButton = new Button[4];
        private readonly TextMeshProUGUI[] _rowButtonLabel = new TextMeshProUGUI[4];

        public bool PanelOpen => _panel != null && _panel.activeSelf;
        public string RowText(int i) => _rowText[i] != null ? _rowText[i].text : "";
        public Button RowButton(int i) => _rowButton[i];
        public Button WonderButton { get; private set; }
        public Button TradeButton { get; private set; } // tasks U-0172

        public static RealmTechUi Install()
        {
            if (Instance != null) return Instance;
            return new GameObject("RealmTechUi").AddComponent<RealmTechUi>();
        }

        private void Awake()
        {
            Instance = this;
            Build();
            RealmTechData.Changed += Refresh;
            RealmCityState.Changed += Refresh;
        }

        private void OnDestroy()
        {
            RealmTechData.Changed -= Refresh;
            RealmCityState.Changed -= Refresh;
            if (Instance == this) Instance = null;
        }

        private void Build()
        {
            var canvas = RealmUiKit.NewCanvas("RealmTechUI");
            canvas.sortingOrder = 7;
            canvas.transform.SetParent(transform, false);

            // 왼쪽 아래 기둥 — 명마(100)·날기(222) 위 한 칸(같은 122 간격)
            _toggle = RealmUiKit.NewButton(canvas.transform, "", new Vector2(0f, 0f), new Vector2(20f, 344f), new Vector2(180f, 110f), Toggle);
            _toggleLabel = _toggle.GetComponentInChildren<TextMeshProUGUI>();

            _panel = RealmUiKit.NewPanel(canvas.transform, new Vector2(0.5f, 0.5f), new Vector2(1000f, 800f), new Color(0f, 0f, 0f, 0.86f));
            _panel.SetActive(false);
            _title = RealmUiKit.NewText(_panel.transform, "", new Vector2(0.5f, 1f), new Vector2(0f, -30f), new Vector2(900f, 56f), 30);
            _points = RealmUiKit.NewText(_panel.transform, "", new Vector2(0.5f, 1f), new Vector2(0f, -88f), new Vector2(900f, 44f), 22);
            for (int i = 0; i < 4; i++)
            {
                float y = -150f - 140f * i;
                _rowText[i] = RealmUiKit.NewText(_panel.transform, "", new Vector2(0f, 1f), new Vector2(30f, y), new Vector2(680f, 124f), 22);
                _rowText[i].alignment = TextAlignmentOptions.Left;
                string key = RealmTechData.Branches[i].Key;
                _rowButton[i] = RealmUiKit.NewButton(_panel.transform, "", new Vector2(1f, 1f), new Vector2(-30f, y - 22f), new Vector2(240f, 80f), () => Press(key));
                _rowButtonLabel[i] = _rowButton[i].GetComponentInChildren<TextMeshProUGUI>();
                _rowButtonLabel[i].fontSize = 22;
            }
            RealmUiKit.NewButton(_panel.transform, RealmLocalization.T("settings.close", "닫기"), new Vector2(0.5f, 0f), new Vector2(0f, 20f), new Vector2(300f, 66f), Close);
            // tasks U-0136 — 불가사의 창(학 갈래 「큰 도면」이 문, 창은 늘 열 수 있음)
            WonderButton = RealmUiKit.NewButton(_panel.transform, RealmLocalization.T("wonder.open", "🏛️ 불가사의"), new Vector2(0f, 0f), new Vector2(30f, 20f), new Vector2(240f, 66f), () => RealmWonderUi.Install().Open());
            // tasks U-0172 — 교역로 창(아래 오른쪽)
            TradeButton = RealmUiKit.NewButton(_panel.transform, RealmLocalization.T("trade.open", "🐫 교역"), new Vector2(1f, 0f), new Vector2(-30f, 20f), new Vector2(240f, 66f), () => RealmTradeUi.Install().Open());
            Refresh();
        }

        public void Toggle()
        {
            if (_panel == null) return;
            _panel.SetActive(!_panel.activeSelf);
            if (_panel.activeSelf) _panel.transform.SetAsLastSibling();
            Refresh();
        }

        public void Close() { if (_panel != null) _panel.SetActive(false); }

        public void Press(string branch)
        {
            var nd = RealmTechData.Research(branch, out string why);
            var b = RealmTechData.GetBranch(branch);
            RealmToast.Instance?.Show(nd != null ? $"{b.Emoji} 「{nd.Name}」 — {nd.Desc}" : why, 3f);
            Refresh();
        }

        public void Refresh()
        {
            if (_toggleLabel == null) return;
            _toggleLabel.text = string.Format(RealmLocalization.T("tech.toggle", "📜 연구\n{0}점"), RealmTechData.Points);
            if (!PanelOpen) return;
            _title.text = RealmLocalization.T("tech.title", "📜 기술 나무 — 갈래 안에선 차례대로");
            _points.text = string.Format(RealmLocalization.T("tech.points", "연구점 {0} · 달마다 +{1}(학자 {2})"), RealmTechData.Points, RealmTechData.PtsPerMonth(), RealmTechData.Scholars());
            for (int i = 0; i < 4; i++)
            {
                var b = RealmTechData.Branches[i];
                int n = RealmTechData.DoneCount(b.Key);
                string dots = "";
                for (int k = 0; k < b.Nodes.Length; k++) dots += k < n ? "●" : "○";
                var nd = RealmTechData.NextOf(b.Key);
                string why = RealmTechData.Why(b.Key);
                _rowText[i].text = $"{b.Emoji} <b>{b.Name}</b> <size=80%>{b.Desc}</size>  {dots} {n}/{b.Nodes.Length}\n<size=85%>" + (nd != null
                    ? string.Format(RealmLocalization.T("tech.next", "다음: {0} — {1} ({2}점)"), nd.Name, nd.Desc, nd.Cost)
                    : RealmLocalization.T("tech.all_done", "다 연구했다")) + "</size>";
                _rowButton[i].gameObject.SetActive(nd != null);
                _rowButton[i].interactable = why == null;
                if (nd != null) _rowButtonLabel[i].text = why == null
                    ? string.Format(RealmLocalization.T("tech.research", "연구 ({0}점)"), nd.Cost)
                    : string.Format(RealmLocalization.T("tech.short", "{0}/{1}점"), RealmTechData.Points, nd.Cost);
            }
        }
    }
}
