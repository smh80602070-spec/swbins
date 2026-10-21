using TMPro;
using UnityEngine;
using UnityEngine.UI;
using Saga.Go.Data;

namespace Saga.Go.UI
{
    /// <summary>
    /// 메뉴 허브(saga-godot "왼쪽 가운데 메뉴") — 사냥 기록(K)·주간 도전(U)·재출항(N)·신수 알(I)·도움말(F1) 단추를 오른쪽 가장자리에 줄줄이 두면
    /// 오른쪽 아래 전투 단추·낚시 단추·대사 줄과 겹쳐서(`UiLayoutCheck`), 위 오른쪽 **"메뉴" 단추 하나**로 합친다. 누르면 화면을 덮는 아이콘 격자(U-0154 `MenuGrid`)가 뜨고 칸을 누르면
    /// 이 화면이 닫히며 그 창이 열린다. 줄 글은 각 창의 단추 글(받을 게 있으면 ●N)을 그대로 읽어 ● 도 함께 보인다. 각 창의 키와 `OpenButton` 은 그대로
    /// (원래 단추는 숨기기만 한다 — 진단·키가 계속 쓴다). `WorldMapBuilder` 가 Play 때 붙인다.
    /// </summary>
    public class MenuHubUi : MonoBehaviour
    {
        public static MenuHubUi Instance { get; private set; }

        private Saga.Core.MenuGrid _grid;
        private float _tick;

        public Button OpenButton { get; private set; }
        public Button CloseButton => _grid.CloseButton;
        public bool IsOpen => _grid != null && _grid.IsOpen;
        public int EntryCount => _grid.EntryCount;
        public Button EntryButton(int i) => _grid.EntryButton(i);
        public string EntryText(int i) => _grid.EntryText(i);
        public string OpenLabel => OpenButton.GetComponentInChildren<TextMeshProUGUI>().text;

        private void Awake() => Instance = this;
        private void OnDestroy() { if (Instance == this) Instance = null; }

        private void Start()
        {
            Build();
            Refresh();
        }

        private void Build()
        {
            var canvas = EncounterUiKit.NewCanvas("MenuHubUI");
            canvas.sortingOrder = 7;
            var t = canvas.transform;

            // 위 오른쪽 — 일시정지(왼쪽)와 저장(오른쪽 모서리) 사이 빈 틈. 전투·낚시 단추·대사 줄과도 안 겹친다.
            OpenButton = EncounterUiKit.NewButton(t, GoLocalization.T("menu.button", "메뉴"), new Vector2(1f, 1f), new Vector2(-215f, -40f), new Vector2(160f, 60f), null);
            OpenButton.onClick.AddListener(Toggle);

            // U-0154 — 줄 목록 대신 화면을 덮는 아이콘 격자(SagaCore.MenuGrid). 칸 순서·키는 예전 다섯 줄 그대로.
            _grid = Saga.Core.MenuGrid.Create(t, GoLocalization.T("menu.title", "메뉴"), GoLocalization.T("dex.close", "닫는다"));
            _grid.Register("F1", () => HelpUi.Instance != null ? HelpUi.Instance.OpenLabel : "", () => HelpUi.Instance?.Open(), () => HelpUi.Instance != null, "ui_circle_question_mark");
            _grid.Register("K", () => HuntLogUi.Instance != null ? HuntLogUi.Instance.OpenLabel : "", () => HuntLogUi.Instance?.Open(), () => HuntLogUi.Instance != null, "ui_scroll_text");
            _grid.Register("U", () => WeeklyUi.Instance != null ? WeeklyUi.Instance.OpenLabel : "", () => WeeklyUi.Instance?.Open(), () => WeeklyUi.Instance != null, "ui_clipboard_list");
            _grid.Register("N", () => CycleUi.Instance != null ? CycleUi.Instance.OpenLabel : "", () => CycleUi.Instance?.Open(), () => CycleUi.Instance != null, "ui_rotate_ccw");
            _grid.Register("I", () => EggUi.Instance != null ? EggUi.Instance.OpenLabel : "", () => EggUi.Instance?.Open(), () => EggUi.Instance != null, "ui_sparkles");
        }

        public void Toggle() { if (IsOpen) Close(); else Open(); }
        public void Open() {
            if (!IsOpen) Saga.Go.Audio.GoSfx.Play("ui_open"); // U-0048
            if (_grid == null) return; _grid.Open(); }
        public void Close() {
            if (IsOpen) Saga.Go.Audio.GoSfx.Play("ui_close"); // U-0048
            if (_grid != null) _grid.Close(); }

        /// <summary>칸 글·허브 단추의 ● 를 새로 하고, 각 창이 만든 원래 단추는 숨긴다(이 허브가 대신 연다).</summary>
        public void Refresh()
        {
            if (_grid == null) return;
            _grid.Refresh();
            HideOriginals();
            var open = OpenButton.GetComponentInChildren<TextMeshProUGUI>();
            open.text = GoLocalization.T("menu.button", "메뉴") + (_grid.AnyBadge ? " ●" : "");
            open.color = _grid.AnyBadge ? new Color(1f, 0.88f, 0.4f) : Color.white;
        }

        private static void HideOriginals()
        {
            if (HelpUi.Instance != null && HelpUi.Instance.OpenButton != null) HelpUi.Instance.OpenButton.gameObject.SetActive(false);
            if (HuntLogUi.Instance != null && HuntLogUi.Instance.OpenButton != null) HuntLogUi.Instance.OpenButton.gameObject.SetActive(false);
            if (WeeklyUi.Instance != null && WeeklyUi.Instance.OpenButton != null) WeeklyUi.Instance.OpenButton.gameObject.SetActive(false);
            if (CycleUi.Instance != null && CycleUi.Instance.OpenButton != null) CycleUi.Instance.OpenButton.gameObject.SetActive(false);
            if (EggUi.Instance != null && EggUi.Instance.OpenButton != null) EggUi.Instance.OpenButton.gameObject.SetActive(false);
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
