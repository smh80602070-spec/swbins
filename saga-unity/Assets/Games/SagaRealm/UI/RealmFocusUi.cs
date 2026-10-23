using TMPro;
using UnityEngine;
using UnityEngine.UI;
using Saga.Realm.Data;

namespace Saga.Realm.UI
{
    /// <summary>
    /// tasks U-0193 국가 방침 창(고돗 G-0336 `realm_focus_button.gd` 짝) — `GameBootstrap` 가 Play 때 세운다(씬 재빌드 없음, 법령 창과 같은 꼴).
    /// 왼쪽 아래 기둥(법령 위) "🎯 방침" 단추 — ☰ 메뉴 칸이 대신 누른다(숨기기만). 창: 진행 중 방침 줄 · 방침 일곱 줄(나무 순, 들여쓰기·덤·상태) · 줄마다 「고른다」.
    /// </summary>
    public class RealmFocusUi : MonoBehaviour
    {
        public static RealmFocusUi Instance { get; private set; }

        private GameObject _panel;
        private Button _toggle;
        public Button ToggleButton => _toggle;
        private TextMeshProUGUI _toggleLabel, _title, _info;
        private readonly TextMeshProUGUI[] _rowText = new TextMeshProUGUI[7];
        private readonly Button[] _rowButton = new Button[7];
        private readonly TextMeshProUGUI[] _rowButtonLabel = new TextMeshProUGUI[7];

        public bool PanelOpen => _panel != null && _panel.activeSelf;
        public string RowText(int i) => _rowText[i] != null ? _rowText[i].text : "";
        public Button RowButton(int i) => _rowButton[i];
        public string InfoText => _info != null ? _info.text : "";

        public static RealmFocusUi Install()
        {
            if (Instance != null) return Instance;
            return new GameObject("RealmFocusUi").AddComponent<RealmFocusUi>();
        }

        private void Awake()
        {
            Instance = this;
            Build();
            RealmFocus.Changed += Refresh;
            RealmCityState.Changed += Refresh;
        }

        private void OnDestroy()
        {
            RealmFocus.Changed -= Refresh;
            RealmCityState.Changed -= Refresh;
            if (Instance == this) Instance = null;
        }

        private void Build()
        {
            var canvas = RealmUiKit.NewCanvas("RealmFocusUI");
            canvas.sortingOrder = 7;
            canvas.transform.SetParent(transform, false);

            // 왼쪽 아래 기둥 — 법령(466) 위 한 칸(같은 122 간격). ☰ 메뉴가 숨긴다.
            _toggle = RealmUiKit.NewButton(canvas.transform, "", new Vector2(0f, 0f), new Vector2(20f, 588f), new Vector2(180f, 110f), Toggle);
            _toggleLabel = _toggle.GetComponentInChildren<TextMeshProUGUI>();

            _panel = RealmUiKit.NewPanel(canvas.transform, new Vector2(0.5f, 0.5f), new Vector2(1100f, 860f), new Color(0f, 0f, 0f, 0.95f));
            _panel.SetActive(false);
            _title = RealmUiKit.NewText(_panel.transform, "", new Vector2(0.5f, 1f), new Vector2(0f, -30f), new Vector2(1000f, 56f), 30);
            _info = RealmUiKit.NewText(_panel.transform, "", new Vector2(0.5f, 1f), new Vector2(0f, -88f), new Vector2(1000f, 44f), 22);
            for (int i = 0; i < RealmFocus.All.Length; i++)
            {
                float y = -150f - 88f * i;
                _rowText[i] = RealmUiKit.NewText(_panel.transform, "", new Vector2(0f, 1f), new Vector2(30f, y), new Vector2(820f, 80f), 21);
                _rowText[i].alignment = TextAlignmentOptions.Left;
                string id = RealmFocus.All[i].Id;
                _rowButton[i] = RealmUiKit.NewButton(_panel.transform, "", new Vector2(1f, 1f), new Vector2(-30f, y - 8f), new Vector2(200f, 64f), () => Press(id));
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

        public void Press(string id)
        {
            string why = RealmFocus.Pick(id);
            var f = RealmFocus.Get(id);
            RealmToast.Instance?.Show(why == null
                ? string.Format(RealmLocalization.T("focus.picked", "{0} 방침 「{1}」 — {2}달 뒤 {3}"), f.Emoji, f.Name, f.Months, f.Text)
                : why, 3f);
            Refresh();
        }

        public void Refresh()
        {
            if (_toggleLabel == null) return;
            var cur = RealmFocus.Get(RealmFocus.Current);
            _toggleLabel.text = cur != null
                ? string.Format(RealmLocalization.T("focus.toggle_cur", "🎯 방침\n{0} {1}달"), cur.Emoji, RealmFocus.Left)
                : string.Format(RealmLocalization.T("focus.toggle", "🎯 방침\n{0}/{1}"), RealmFocus.Done.Count, RealmFocus.MaxDone);
            if (!PanelOpen) return;
            _title.text = RealmLocalization.T("focus.title", "🎯 국가 방침 — 한 번에 하나, 끝나면 덤이 영구");
            _info.text = cur != null
                ? string.Format(RealmLocalization.T("focus.info_cur", "진행 중: {0} {1} — {2}달 남음 · 완수 {3}/{4}"), cur.Emoji, cur.Name, RealmFocus.Left, RealmFocus.Done.Count, RealmFocus.MaxDone)
                : string.Format(RealmLocalization.T("focus.info", "진행 중인 방침 없음 · 완수 {0}/{1} · 부국·강병은 갈림길"), RealmFocus.Done.Count, RealmFocus.MaxDone);
            for (int i = 0; i < RealmFocus.All.Length; i++)
            {
                var f = RealmFocus.All[i];
                _rowText[i].text = RealmFocus.Line(f);
                bool can = RealmFocus.Why(f.Id) == null;
                _rowButton[i].interactable = can;
                _rowButtonLabel[i].text = RealmFocus.IsDone(f.Id) ? RealmLocalization.T("focus.btn_done", "완수")
                    : RealmFocus.Current == f.Id ? RealmLocalization.T("focus.btn_cur", "진행 중") : RealmLocalization.T("focus.btn_pick", "고른다");
            }
        }
    }
}
