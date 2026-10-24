using System.Collections.Generic;
using TMPro;
using UnityEngine;
using UnityEngine.UI;
using Saga.Realm.Data;

namespace Saga.Realm.UI
{
    /// <summary>
    /// tasks U-0204 「🗺 천하도」 창(웹 W-0400 천하도 카드·고돗 G-0347 짝) — `GameBootstrap` 가 Play 때 세운다(씬 재빌드 없음, 방침 창과 같은 꼴).
    /// 왼쪽 아래 기둥(방침 위) 단추 — ☰ 메뉴 칸이 대신 누른다(숨기기만). 창: 이 트랙에 성이 있는 지역마다 한 줄
    /// 「지역 · 내 성 n · 적 성 m · ⚔(맞닿은 적)」 + 「보기」(누르면 그 지역으로 · 지도가 꺼져 있으면 켠다). 전체 지형 그림 없음.
    /// </summary>
    public class RealmRegionUi : MonoBehaviour
    {
        public static RealmRegionUi Instance { get; private set; }

        private GameObject _panel;
        private Button _toggle;
        public Button ToggleButton => _toggle;
        private TextMeshProUGUI _toggleLabel, _title;
        private readonly List<string> _ids = new List<string>();
        private readonly List<TextMeshProUGUI> _rowText = new List<TextMeshProUGUI>();
        private readonly List<Button> _rowButton = new List<Button>();

        public bool PanelOpen => _panel != null && _panel.activeSelf;
        public int RowCount => _ids.Count;
        public string RowId(int i) => _ids[i];
        public string RowText(int i) => _rowText[i] != null ? _rowText[i].text : "";
        public Button RowButton(int i) => _rowButton[i];
        public string ToggleText => _toggleLabel != null ? _toggleLabel.text : "";

        public static RealmRegionUi Install()
        {
            if (Instance != null) return Instance;
            return new GameObject("RealmRegionUi").AddComponent<RealmRegionUi>();
        }

        private void Awake()
        {
            Instance = this;
            Build();
            RealmRegions.Changed += Refresh;
            RealmCityState.Changed += Refresh;
        }

        private void OnDestroy()
        {
            RealmRegions.Changed -= Refresh;
            RealmCityState.Changed -= Refresh;
            if (Instance == this) Instance = null;
        }

        private void Build()
        {
            var canvas = RealmUiKit.NewCanvas("RealmRegionUI");
            canvas.sortingOrder = 7;
            canvas.transform.SetParent(transform, false);

            // 왼쪽 아래 기둥 — 방침(588) 위 한 칸(같은 122 간격). ☰ 메뉴가 숨긴다.
            _toggle = RealmUiKit.NewButton(canvas.transform, "", new Vector2(0f, 0f), new Vector2(20f, 710f), new Vector2(180f, 110f), Toggle);
            _toggleLabel = _toggle.GetComponentInChildren<TextMeshProUGUI>();

            _panel = RealmUiKit.NewPanel(canvas.transform, new Vector2(0.5f, 0.5f), new Vector2(1100f, 940f), new Color(0f, 0f, 0f, 0.95f));
            _panel.SetActive(false);
            _title = RealmUiKit.NewText(_panel.transform, "", new Vector2(0.5f, 1f), new Vector2(0f, -30f), new Vector2(1000f, 56f), 30);
            foreach (var r in RealmRegions.All)
            {
                var (mine, enemy, _) = RealmRegions.Counts(r.Id);
                if (mine + enemy == 0) continue; // 이 트랙에 성이 없는 지역(한국·일본·서역 …)
                float y = -110f - 84f * _ids.Count;
                string id = r.Id;
                _ids.Add(id);
                var t = RealmUiKit.NewText(_panel.transform, "", new Vector2(0f, 1f), new Vector2(30f, y), new Vector2(800f, 76f), 24);
                t.alignment = TextAlignmentOptions.Left;
                _rowText.Add(t);
                _rowButton.Add(RealmUiKit.NewButton(_panel.transform, RealmLocalization.T("region.view", "보기"), new Vector2(1f, 1f), new Vector2(-30f, y - 6f), new Vector2(200f, 64f), () => Pick(id)));
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

        /// <summary>그 지역으로 — 지도가 꺼져 있으면 켠다. 창은 닫는다.</summary>
        public void Pick(string regionId)
        {
            RealmRegions.SetView(regionId);
            if (!RealmMapState.ViewingMap) RealmMapState.Toggle();
            Close();
            Refresh();
        }

        private void Refresh()
        {
            var view = RealmRegions.Get(RealmRegions.View);
            string vname = view != null ? view.Name : "";
            if (_toggleLabel != null) _toggleLabel.text = RealmLocalization.T("region.button", "🗺 천하도") + "\n" + vname;
            if (_toggle != null && !RealmRegions.On) _toggle.gameObject.SetActive(false); // 켜짐·숨김은 ☰ 메뉴 몫(원래 단추를 숨긴다)
            if (_title != null) _title.text = string.Format(RealmLocalization.T("region.title", "🗺 천하도 — 지금 {0}"), vname);
            for (int i = 0; i < _ids.Count; i++)
            {
                var r = RealmRegions.Get(_ids[i]);
                var (mine, enemy, front) = RealmRegions.Counts(_ids[i]);
                string here = _ids[i] == RealmRegions.View ? " ◀" : "";
                _rowText[i].text = string.Format(RealmLocalization.T("region.row", "{0} · 내 성 {1} · 적 성 {2}"), r.Name, mine, enemy)
                    + (front ? " · ⚔" : "") + here;
            }
        }
    }
}
