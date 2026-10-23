using TMPro;
using UnityEngine;
using UnityEngine.UI;
using Saga.Realm.Data;

namespace Saga.Realm.UI
{
    /// <summary>
    /// tasks U-0182 법령 창(고돗 G-0321 `realm_law_button.gd` 짝) — `GameBootstrap` 가 Play 때 세운다(씬 재빌드 없음, 기술 창과 같은 꼴).
    /// 왼쪽 아래 기둥(연구 위) "📜 법령" 단추 — ☰ 메뉴 칸이 대신 누른다(숨기기만). 창: 법전 칸·다음 법령까지 · 법령 셋 줄(이름·득실·내림 여부) · 줄마다 「반포」.
    /// </summary>
    public class RealmLawUi : MonoBehaviour
    {
        public static RealmLawUi Instance { get; private set; }

        private GameObject _panel;
        private Button _toggle;
        public Button ToggleButton => _toggle;
        private TextMeshProUGUI _toggleLabel, _title, _info;
        private readonly TextMeshProUGUI[] _rowText = new TextMeshProUGUI[3];
        private readonly Button[] _rowButton = new Button[3];
        private readonly TextMeshProUGUI[] _rowButtonLabel = new TextMeshProUGUI[3];

        public bool PanelOpen => _panel != null && _panel.activeSelf;
        public string RowText(int i) => _rowText[i] != null ? _rowText[i].text : "";
        public Button RowButton(int i) => _rowButton[i];

        public static RealmLawUi Install()
        {
            if (Instance != null) return Instance;
            return new GameObject("RealmLawUi").AddComponent<RealmLawUi>();
        }

        private void Awake()
        {
            Instance = this;
            Build();
            RealmLaws.Changed += Refresh;
            RealmCityState.Changed += Refresh;
        }

        private void OnDestroy()
        {
            RealmLaws.Changed -= Refresh;
            RealmCityState.Changed -= Refresh;
            if (Instance == this) Instance = null;
        }

        private void Build()
        {
            var canvas = RealmUiKit.NewCanvas("RealmLawUI");
            canvas.sortingOrder = 7;
            canvas.transform.SetParent(transform, false);

            // 왼쪽 아래 기둥 — 연구(344) 위 한 칸(같은 122 간격). ☰ 메뉴가 숨긴다.
            _toggle = RealmUiKit.NewButton(canvas.transform, "", new Vector2(0f, 0f), new Vector2(20f, 466f), new Vector2(180f, 110f), Toggle);
            _toggleLabel = _toggle.GetComponentInChildren<TextMeshProUGUI>();

            _panel = RealmUiKit.NewPanel(canvas.transform, new Vector2(0.5f, 0.5f), new Vector2(1000f, 640f), new Color(0f, 0f, 0f, 0.95f)); // tasks U-0185 — 0.86 이면 뒤 안내 글이 법령 줄 밑으로 비쳤다(촬영)
            _panel.SetActive(false);
            _title = RealmUiKit.NewText(_panel.transform, "", new Vector2(0.5f, 1f), new Vector2(0f, -30f), new Vector2(900f, 56f), 30);
            _info = RealmUiKit.NewText(_panel.transform, "", new Vector2(0.5f, 1f), new Vector2(0f, -88f), new Vector2(900f, 44f), 22);
            for (int i = 0; i < 3; i++)
            {
                float y = -150f - 130f * i;
                _rowText[i] = RealmUiKit.NewText(_panel.transform, "", new Vector2(0f, 1f), new Vector2(30f, y), new Vector2(680f, 114f), 22);
                _rowText[i].alignment = TextAlignmentOptions.Left;
                string key = RealmLaws.All[i].Key;
                _rowButton[i] = RealmUiKit.NewButton(_panel.transform, "", new Vector2(1f, 1f), new Vector2(-30f, y - 22f), new Vector2(240f, 80f), () => Press(key));
                _rowButtonLabel[i] = _rowButton[i].GetComponentInChildren<TextMeshProUGUI>();
                _rowButtonLabel[i].fontSize = 22;
            }
            RealmUiKit.NewButton(_panel.transform, RealmLocalization.T("settings.close", "닫기"), new Vector2(0.5f, 0f), new Vector2(0f, 20f), new Vector2(300f, 66f), Close);
            Refresh();
        }

        public void Toggle()
        {
            if (_panel == null) return;
            _panel.SetActive(!_panel.activeSelf);
            if (_panel.activeSelf) _panel.transform.SetAsLastSibling();
            Refresh();
        }

        public void Open() { if (_panel != null && !_panel.activeSelf) Toggle(); }
        public void Close() { if (_panel != null) _panel.SetActive(false); }

        public void Press(string key)
        {
            int now = RealmLaws.NowIndex;
            string why = RealmLaws.Enact(key, now);
            var l = RealmLaws.Get(key);
            RealmToast.Instance?.Show(why == null
                ? string.Format(RealmLocalization.T("law.enacted", "📜 {0} {1} 반포 — {2} (거둘 수 없다)"), l.Emoji, l.Name, l.Desc)
                : RealmLaws.WhyText(why, now), 3f);
            Refresh();
        }

        public void Refresh()
        {
            if (_toggleLabel == null) return;
            _toggleLabel.text = string.Format(RealmLocalization.T("law.toggle", "📜 법령\n{0}/{1}"), RealmLaws.Enacted.Count, RealmLaws.Slots);
            if (!PanelOpen) return;
            int now = RealmLaws.NowIndex;
            _title.text = RealmLocalization.T("law.title", "📜 법령 — 한 번 내리면 거둘 수 없다");
            int wait = RealmLaws.WaitMonths(now);
            _info.text = string.Format(RealmLocalization.T("law.info", "법전 {0}/{1}(다스리는 성 수, 최대 {2}) · {3}"), RealmLaws.Enacted.Count, RealmLaws.Slots, RealmLaws.MaxSlots,
                wait > 0 ? string.Format(RealmLocalization.T("law.wait", "다음 법령까지 {0}달"), wait) : RealmLocalization.T("law.ready", "지금 내릴 수 있다"));
            for (int i = 0; i < 3; i++)
            {
                var l = RealmLaws.All[i];
                bool has = RealmLaws.Has(l.Key);
                _rowText[i].text = $"{l.Emoji} <b>{l.Name}</b>" + (has ? RealmLocalization.T("law.has_tag", " <color=#ffd060>· 시행 중</color>") : "") + $"\n<size=85%>{l.Desc}</size>";
                string why = RealmLaws.Why(l.Key, now);
                _rowButton[i].interactable = why == null;
                _rowButtonLabel[i].text = has ? RealmLocalization.T("law.in_force", "시행 중") : RealmLocalization.T("law.enact", "반포");
            }
        }
    }
}
