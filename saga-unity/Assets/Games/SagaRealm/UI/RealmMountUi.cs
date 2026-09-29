using System.Collections.Generic;
using System.Globalization;
using TMPro;
using UnityEngine;
using UnityEngine.InputSystem;
using UnityEngine.UI;
using Saga.Realm.Data;

namespace Saga.Realm.UI
{
    /// <summary>
    /// PLAN.md 109-15 명마·비행 — 화면·입력. 왼쪽 아래(아래 다섯 명령 줄 왼쪽 옆):
    /// **"명마" 단추** = 명마 패널(우리 장수 목록 — 줄마다 누르면 말 없음 → 쓸 수 있는 다음 말 → … 돌아가며 얹는다, 웹 "장수 카드의 🐎 단추")
    /// · **"날기" 단추**(국토 지도를 보고 있고 날 탈것이 열렸을 때만) = 날기/내리기. 키: **H** = 날기/내리기 · **Shift+H** = 학·용 고르기.
    /// 나는 동안 카메라 연출은 `RealmWorldMapCamera.Tick`. 지도를 떠나거나 탈것이 못 쓰게 되면 저절로 내린다.
    /// 로스터가 많으면 패널이 두 줄 × 열 칸이라 넘치는 장수는 "외 n명"으로 접는다(장착 자체는 다 된다 — 패널이 좁을 뿐).
    /// `GameBootstrap.Start()` 가 Play 때 붙인다(씬 재빌드 없음).
    /// </summary>
    public class RealmMountUi : MonoBehaviour
    {
        public const int RowsPerColumn = 9;
        public const int MaxRows = RowsPerColumn * 2;

        public static RealmMountUi Instance { get; private set; }

        private Button _mountsToggle, _flyToggle;
        private TextMeshProUGUI _mountsLabel, _flyLabel, _title, _more;
        private GameObject _panel;
        private Transform _rowsRoot;
        private readonly List<(string officerId, Button button, TextMeshProUGUI label)> _rows = new List<(string, Button, TextMeshProUGUI)>();
        private float _refreshWait;
        private string _lastLang;

        public Button MountsButton => _mountsToggle;
        public Button FlyButton => _flyToggle;
        public bool PanelOpen => _panel != null && _panel.activeSelf;
        public string FlyLabel => _flyLabel != null ? _flyLabel.text : "";
        public string MoreText => _more != null ? _more.text : "";
        public IReadOnlyList<(string officerId, Button button, TextMeshProUGUI label)> Rows => _rows;

        public static RealmMountUi Install()
        {
            if (Instance != null) return Instance;
            return new GameObject("RealmMountUi").AddComponent<RealmMountUi>();
        }

        private void Awake()
        {
            Instance = this;
            Build();
            RealmMounts.Changed += OnChanged;
            RealmCityState.Changed += OnChanged;
            RealmMapState.Changed += OnChanged;
        }

        private void OnDestroy()
        {
            RealmMounts.Changed -= OnChanged;
            RealmCityState.Changed -= OnChanged;
            RealmMapState.Changed -= OnChanged;
            if (Instance == this) Instance = null;
        }

        // ---- 화면 ----

        private void Build()
        {
            var canvas = RealmUiKit.NewCanvas("RealmMountUI");
            canvas.sortingOrder = 7;
            canvas.transform.SetParent(transform, false);

            // 왼쪽 아래(아래 다섯 명령 줄의 왼쪽 옆 — 오른쪽 열은 맨 아래 일기토 단추까지 차 있다) — 명마는 아래, 날기는 그 위.
            _mountsToggle = RealmUiKit.NewButton(canvas.transform, "", new Vector2(0f, 0f), new Vector2(20f, 100f), new Vector2(180f, 110f), OnMountsClicked);
            _mountsLabel = _mountsToggle.GetComponentInChildren<TextMeshProUGUI>();
            _flyToggle = RealmUiKit.NewButton(canvas.transform, "", new Vector2(0f, 0f), new Vector2(20f, 222f), new Vector2(180f, 110f), OnFlyClicked);
            _flyLabel = _flyToggle.GetComponentInChildren<TextMeshProUGUI>();
            _flyToggle.gameObject.SetActive(false);

            _panel = RealmUiKit.NewPanel(canvas.transform, new Vector2(0.5f, 0.5f), new Vector2(1080f, 860f), new Color(0f, 0f, 0f, 0.86f));
            _panel.SetActive(false);
            _title = RealmUiKit.NewText(_panel.transform, "", new Vector2(0.5f, 1f), new Vector2(0f, -20f), new Vector2(1000f, 96f), 26);
            var root = new GameObject("Rows", typeof(RectTransform));
            root.transform.SetParent(_panel.transform, false);
            var rr = (RectTransform)root.transform;
            rr.anchorMin = Vector2.zero; rr.anchorMax = Vector2.one; rr.sizeDelta = Vector2.zero; rr.anchoredPosition = Vector2.zero;
            _rowsRoot = root.transform;
            _more = RealmUiKit.NewText(_panel.transform, "", new Vector2(0.5f, 0f), new Vector2(0f, 110f), new Vector2(700f, 40f), 22);
            RealmUiKit.NewButton(_panel.transform, RealmLocalization.T("settings.close", "닫기"), new Vector2(0.5f, 0f), new Vector2(0f, 30f), new Vector2(300f, 70f), ClosePanel);
        }

        private void OnMountsClicked() => TogglePanel();
        private void OnFlyClicked() => ToggleFly();
        private void ClosePanel() => _panel.SetActive(false);

        public void TogglePanel()
        {
            if (_panel == null) return;
            _panel.SetActive(!_panel.activeSelf);
            if (_panel.activeSelf) RefreshPanel();
        }

        private void OnChanged()
        {
            RefreshButtons();
            if (PanelOpen) RefreshPanel();
        }

        private static string HorseName(string officerId)
        {
            var m = RealmMounts.MountOf(officerId);
            return m != null ? m.Name : RealmLocalization.T("mount.no_horse_row", "말 없음");
        }

        private void RefreshButtons()
        {
            _lastLang = RealmLocalization.CurrentLanguage;
            if (_mountsLabel != null) _mountsLabel.text = RealmLocalization.T("command.mounts", "명마");
            bool canFly = !RealmMounts.OffForTest && RealmMounts.Selected() != null && RealmMapState.ViewingMap;
            if (_flyToggle != null && _flyToggle.gameObject.activeSelf != canFly) _flyToggle.gameObject.SetActive(canFly);
            if (_flyLabel != null && canFly)
            {
                var m = RealmMounts.Flying ?? RealmMounts.Selected();
                _flyLabel.text = (RealmMounts.IsFlying ? RealmLocalization.T("mount.btn_land", "내리기") : RealmLocalization.T("mount.btn_fly", "날기")) + "\n" + m.Name;
            }
        }

        private void RefreshPanel()
        {
            if (_title != null)
            {
                _title.text = string.Format(RealmLocalization.T("mount.panel_title", "명마 — 장수를 눌러 말을 얹는다 (한 필은 한 사람만)\n다스리는 성 {0}곳 · 농마 2 · 갈색 말 4 · 흰 말 7 · (학 5 · 푸른 용 9 = 날기)"), RealmMounts.CityCount());
            }
            for (int i = _rowsRoot.childCount - 1; i >= 0; i--)
            {
                var old = _rowsRoot.GetChild(i).gameObject;
                old.SetActive(false);
                old.transform.SetParent(null, false);
                Destroy(old);
            }
            _rows.Clear();
            int shown = 0, total = RealmCityState.RosterIds.Count;
            foreach (var id in RealmCityState.RosterIds)
            {
                if (shown >= MaxRows) break;
                int col = shown / RowsPerColumn, row = shown % RowsPerColumn;
                var o = RealmOfficerPool.Get(id);
                string captured = id;
                var b = RealmUiKit.NewButton(_rowsRoot, "", new Vector2(0.5f, 1f), new Vector2(-270f + col * 540f, -130f - row * 72f), new Vector2(520f, 64f), () => OnRowClicked(captured));
                var label = b.GetComponentInChildren<TextMeshProUGUI>();
                label.fontSize = 24;
                label.text = $"{(o != null ? o.Name : id)}  —  {HorseName(id)}";
                _rows.Add((id, b, label));
                shown++;
            }
            if (_more != null) _more.text = total > shown ? string.Format(RealmLocalization.T("mount.more", "외 {0}명"), total - shown) : "";
        }

        private void OnRowClicked(string officerId)
        {
            string why = RealmMounts.CycleEquip(officerId);
            if (why != null) RealmToast.Instance?.Show("🐎 " + why, 4f);
            else if (PanelOpen) RefreshPanel();
        }

        // ---- 날기 ----

        public bool ToggleFly()
        {
            if (RealmMounts.IsFlying)
            {
                RealmMounts.Land();
                RealmToast.Instance?.Show(RealmLocalization.T("mount.landed", "🕊️ 내렸다"), 3f);
                return true;
            }
            if (!RealmMounts.TryFly(RealmMapState.ViewingMap, out string why)) { RealmToast.Instance?.Show("🕊️ " + why, 4f); return false; }
            RealmToast.Instance?.Show(string.Format(RealmLocalization.T("mount.flying", "🕊️ {0}을(를) 타고 국토를 난다 — 돌아보기 ×{1} (H 로 내림)"), RealmMounts.Flying.Name, RealmMounts.Flying.Fly.ToString("0.#", CultureInfo.InvariantCulture)), 4f);
            return true;
        }

        public bool CycleFly()
        {
            var m = RealmMounts.CycleFly();
            if (m == null) { RealmToast.Instance?.Show(RealmLocalization.T("mount.no_fly_short", "🕊️ 아직 날 것이 없다"), 3f); return false; }
            RealmToast.Instance?.Show(string.Format(RealmLocalization.T("mount.fly_sel", "🕊️ {0} (돌아보기 ×{1})"), m.Name, m.Fly.ToString("0.#", CultureInfo.InvariantCulture)), 3f);
            return true;
        }

        private void Update()
        {
            var kb = Keyboard.current;
            if (kb != null && kb.hKey.wasPressedThisFrame)
            {
                if (kb.leftShiftKey.isPressed || kb.rightShiftKey.isPressed) CycleFly();
                else ToggleFly();
            }
            if (RealmMounts.IsFlying)
            {
                if (!RealmMapState.ViewingMap || RealmMounts.OffForTest || !RealmMounts.Unlocked(RealmMounts.Flying)) RealmMounts.Land(); // 디오라마로 돌아가면 내린다
            }
            _refreshWait -= Time.deltaTime;
            if (_refreshWait <= 0f || RealmLocalization.CurrentLanguage != _lastLang) { _refreshWait = 0.25f; RefreshButtons(); }
        }
    }
}
