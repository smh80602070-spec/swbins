using System;
using System.Collections.Generic;
using TMPro;
using UnityEngine;
using UnityEngine.UI;
using Saga.Realm.Data;

namespace Saga.Realm.UI
{
    /// <summary>
    /// U-0154 — 5천하 ☰ 메뉴 화면(웹 W-0254 짝). 오른쪽 위 기둥(서고·문답·지도·설정·저장·전술·일기토)과 왼쪽 아래(명마·연구)에 흩어진 창 단추 중
    /// 창을 여는 다섯(서고·문답·지도·명마·연구)을 화면을 덮는 아이콘 격자(`SagaCore.MenuGrid`) 하나로 모은다. 아래 다섯 명령(명령·성·계략·공격·다음 달)과
    /// 설정·저장·전술/일기토/전술판 토글은 HUD 에 그대로 — 자주 쓰는 것·바로 바뀌는 토글이라서. 칸은 원래 단추의 onClick 을 그대로 부르고,
    /// 원래 단추는 숨기기만 한다(진단·키가 계속 쓴다). 씬에 구운 HUD 는 그대로 두고 `RealmCommandUi.Start` 가 붙인다(씬 재빌드 없음).
    /// </summary>
    public class RealmMenuHub : MonoBehaviour
    {
        public static RealmMenuHub Instance { get; private set; }

        private struct Slot { public Func<Button> Find; }

        private Saga.Core.MenuGrid _grid;
        private readonly List<Slot> _slots = new List<Slot>();
        private TextMeshProUGUI _openLabel;
        private float _tick;

        public Button OpenButton { get; private set; }
        public bool IsOpen => _grid != null && _grid.IsOpen;
        public int EntryCount => _grid != null ? _grid.EntryCount : 0;
        public Button EntryButton(int i) => _grid.EntryButton(i);
        public Saga.Core.MenuGrid Grid => _grid;

        private void Awake() => Instance = this;
        private void OnDestroy() { if (Instance == this) Instance = null; }

        /// <summary>오른쪽 위 기둥 맨 위(서고 자리)에 ☰ 단추, 같은 캔버스에 격자. 남은 기둥 단추는 빈 칸 없이 위로 당긴다(같은 120px 간격 — 112 칸 + 틈).</summary>
        public void Init(Transform canvas, TextMeshProUGUI archive, TextMeshProUGUI quiz, TextMeshProUGUI map, TextMeshProUGUI[] column)
        {
            OpenButton = RealmUiKit.NewButton(canvas, RealmLocalization.T("menu.button", "☰ 메뉴"), new Vector2(1f, 1f), new Vector2(-110f, -20f), new Vector2(180f, 104f), Toggle);
            OpenButton.name = "Btn_Menu";
            _openLabel = OpenButton.GetComponentInChildren<TextMeshProUGUI>();
            for (int i = 0; i < column.Length; i++)
            {
                var b = column[i] != null ? column[i].GetComponentInParent<Button>() : null;
                if (b != null) ((RectTransform)b.transform).anchoredPosition = new Vector2(-110f, -132f - 112f * i);
            }

            _grid = Saga.Core.MenuGrid.Create(canvas, RealmLocalization.T("menu.title", "메뉴"), RealmLocalization.T("settings.close", "닫기"));
            Add(() => ButtonOf(archive), "ui_book_open");
            Add(() => ButtonOf(quiz), "ui_circle_question_mark");
            Add(() => ButtonOf(map), "ui_map");
            Add(() => RealmMountUi.Instance != null ? RealmMountUi.Instance.MountsButton : null, "ui_footprints");
            Add(() => RealmTechUi.Instance != null ? RealmTechUi.Instance.ToggleButton : null, "ui_scroll");
            Add(() => RealmLawUi.Instance != null ? RealmLawUi.Instance.ToggleButton : null, "ui_scroll"); // tasks U-0182 법령
            Add(() => RealmFocusUi.Instance != null ? RealmFocusUi.Instance.ToggleButton : null, "ui_flag"); // tasks U-0193 방침
            Add(() => RealmRegionUi.Instance != null && RealmRegions.On ? RealmRegionUi.Instance.ToggleButton : null, "ui_map"); // tasks U-0204 천하도
            Refresh();
        }

        private static Button ButtonOf(TextMeshProUGUI label) => label != null ? label.GetComponentInParent<Button>(true) : null;

        private void Add(Func<Button> find, string icon)
        {
            _slots.Add(new Slot { Find = find });
            _grid.Register(null, () => { var b = find(); var t = b != null ? b.GetComponentInChildren<TextMeshProUGUI>(true) : null; return t != null ? t.text : ""; },
                () => find()?.onClick.Invoke(), () => find() != null, icon);
        }

        public void Toggle() { if (IsOpen) Close(); else Open(); }
        public void Open() { if (_grid != null) { _grid.Open(); HideOriginals(); } }
        public void Close() { if (_grid != null) _grid.Close(); }

        /// <summary>칸 글을 새로 하고 원래 단추를 숨긴다 — 명마·연구 창은 RealmCommandUi 보다 늦게 붙을 수 있어 늘 다시 본다.</summary>
        public void Refresh()
        {
            if (_grid == null) return;
            _grid.Refresh();
            HideOriginals();
            if (_openLabel != null) _openLabel.text = RealmLocalization.T("menu.button", "☰ 메뉴") + (_grid.AnyBadge ? " ●" : "");
        }

        private void HideOriginals()
        {
            foreach (var s in _slots)
            {
                var b = s.Find();
                if (b != null && b.gameObject.activeSelf) b.gameObject.SetActive(false);
            }
        }

        private void Update()
        {
            _tick -= Time.unscaledDeltaTime;
            if (_tick > 0f) return;
            _tick = 0.5f;
            Refresh();
        }
    }
}
