using System.Text;
using TMPro;
using UnityEngine;
using UnityEngine.InputSystem;
using UnityEngine.UI;
using Saga.Go.Data;

namespace Saga.Go.UI
{
    /// <summary>
    /// tasks U-0045 별배 재출항 창(saga-godot `world/cycle_screen.gd`, 키 N) — N 키 또는 위 오른쪽 "재출항" 단추로 연다. 지금 회차·영구 보너스·
    /// 이야기 진행·재출항하면 일어나는 일·보상을 한 화면에 적고, "재출항" 단추는 조건이 되어야 켜진다. 되돌릴 수 없어 **두 번 눌러야** 한다
    /// (첫 번째는 "정말?" 로 바뀌고 4초 안에 한 번 더). `WorldMapBuilder` 가 Play 때 붙인다 — 런타임 UI 라 람다 리스너를 쓴다(`HuntLogUi` 와 같은 결).
    /// </summary>
    public class CycleUi : MonoBehaviour
    {
        public static CycleUi Instance { get; private set; }

        public const float ConfirmSec = 4f;

        private GameObject _panel;
        private TextMeshProUGUI _title, _body;
        private float _armedLeft, _tick;

        public Button OpenButton { get; private set; }
        public Button ActionButton { get; private set; }
        public Button CloseButton { get; private set; }
        public bool IsOpen => _panel != null && _panel.activeSelf;
        public bool Armed => _armedLeft > 0f;
        public string TitleText => _title.text;
        public string BodyText => _body.text;
        public string ActionLabel => ActionButton.GetComponentInChildren<TextMeshProUGUI>().text;
        public string OpenLabel => OpenButton.GetComponentInChildren<TextMeshProUGUI>().text;

        private void Awake() => Instance = this;

        private void OnDestroy()
        {
            CycleState.Changed -= OnChanged;
            if (Instance == this) Instance = null;
        }

        private void Start()
        {
            Build();
            CycleState.Changed += OnChanged;
            _panel.SetActive(false);
            Refresh();
        }

        private void OnChanged() => Refresh();

        private static void Center(RectTransform r) => r.pivot = new Vector2(0.5f, 0.5f);

        private void Build()
        {
            var canvas = EncounterUiKit.NewCanvas("CycleUI");
            canvas.sortingOrder = 8;
            var t = canvas.transform;
            var mid = new Vector2(0.5f, 0.5f);

            OpenButton = EncounterUiKit.NewButton(t, GoLocalization.T("cycle.button", "재출항"), new Vector2(1f, 1f), new Vector2(-200f, -310f), new Vector2(160f, 50f), null); // 둘째 열, 주간 도전 밑
            OpenButton.onClick.AddListener(Toggle);

            _panel = new GameObject("CyclePanel", typeof(RectTransform));
            _panel.transform.SetParent(t, false);
            var pr = (RectTransform)_panel.transform;
            pr.anchorMin = Vector2.zero; pr.anchorMax = Vector2.one;
            pr.offsetMin = pr.offsetMax = Vector2.zero;
            _panel.AddComponent<Image>().color = new Color(0.03f, 0.03f, 0.04f, 0.94f);

            _title = EncounterUiKit.NewText(_panel.transform, "", mid, new Vector2(0f, 390f), new Vector2(1100f, 44f), 28);
            _title.fontStyle = FontStyles.Bold;
            Center(_title.rectTransform);
            _body = EncounterUiKit.NewText(_panel.transform, "", mid, new Vector2(0f, 40f), new Vector2(1100f, 620f), 21);
            _body.alignment = TextAlignmentOptions.TopLeft;
            _body.enableAutoSizing = true; _body.fontSizeMin = 14f; _body.fontSizeMax = 21f;
            Center(_body.rectTransform);

            ActionButton = EncounterUiKit.NewButton(_panel.transform, GoLocalization.T("cycle.go", "재출항"), mid, new Vector2(-130f, -405f), new Vector2(300f, 52f), null);
            Center((RectTransform)ActionButton.transform);
            ActionButton.onClick.AddListener(Press);
            CloseButton = EncounterUiKit.NewButton(_panel.transform, GoLocalization.T("dex.close", "닫는다"), mid, new Vector2(170f, -405f), new Vector2(200f, 44f), null);
            Center((RectTransform)CloseButton.transform);
            CloseButton.onClick.AddListener(Close);
        }

        // ---- 동작 ----

        public void Toggle() { if (IsOpen) Close(); else Open(); }

        public void Open()
        {
            if (_panel == null) return;
            _armedLeft = 0f;
            _panel.SetActive(true);
            Refresh();
        }

        public void Close() { _armedLeft = 0f; if (_panel != null) _panel.SetActive(false); }

        /// <summary>"재출항" 단추 — 첫 번째는 확인으로 바뀌고, 4초 안의 두 번째에 실제로 한다.</summary>
        public void Press()
        {
            if (CycleState.Blocker().Length > 0) { _armedLeft = 0f; Refresh(); return; }
            if (!Armed) { _armedLeft = ConfirmSec; Refresh(); return; }
            _armedLeft = 0f;
            var r = CycleState.Advance();
            if (r.Ok) Toast(string.Format(GoLocalization.T("cycle.done", "별배가 다시 떠난다 — {0}회차! 되살아난 상자 {1}개 · {2}"), r.Cycle, r.Chests, GoCycle.RewardText()));
            else Toast(r.Error);
            Refresh();
        }

        private static void Toast(string text)
        {
            if (DialogueLabel.Instance != null && !string.IsNullOrEmpty(text)) DialogueLabel.Instance.Show(text, 4f);
        }

        // ---- 글 ----

        public static string BodyFor()
        {
            var sb = new StringBuilder();
            int cyc = CycleState.Cycle;
            sb.Append(string.Format(GoLocalization.T("cycle.now", "지금: 공격력·경험치 +{0}% · 천하 등급 상한 {1}"), Mathf.RoundToInt(CycleState.Bonus * 100f), GoAdventure.WlMax)).Append("\n\n");
            sb.Append(string.Format(GoLocalization.T("cycle.story", "이야기: {0}/{1}장{2}"), StoryState.Ch, GoStory.Chapters.Length,
                StoryState.Done ? " " + GoLocalization.T("cycle.story_done", "(끝)") : "")).Append("\n\n");
            sb.Append(GoLocalization.T("cycle.effects", "재출항하면: 열어 둔 상자가 되살아나고 · 채집 자리가 돌아오고 · 주간 숨은 터 횟수와 밤의 잔불이 새로 시작하고 · 낮춘 천하 등급이 풀린다. 이야기·도감·인물·무기는 그대로.")).Append("\n\n");
            sb.Append(string.Format(GoLocalization.T("cycle.reward", "재출항 보상: {0}"), GoCycle.RewardText())).Append("\n\n");
            sb.Append(string.Format(GoLocalization.T("cycle.perm", "회차마다 영구: 공격력·경험치 +{0}% · 천하 등급 상한 +{1} (최대 {2}회차)"), Mathf.RoundToInt(GoCycle.BonusPerCycle * 100f), GoCycle.WorldCapPerCycle, GoCycle.MaxCycle)).Append("\n\n");
            string why = CycleState.Blocker();
            if (why.Length > 0) sb.Append("<color=#ff9a8a>").Append(why).Append("</color>");
            else sb.Append("<color=#9be59b>").Append(string.Format(GoLocalization.T("cycle.ready", "재출항할 수 있다 — 다음은 {0}회차"), cyc + 1)).Append("</color>");
            return sb.ToString();
        }

        public void Refresh()
        {
            if (_panel == null) return;
            var open = OpenButton.GetComponentInChildren<TextMeshProUGUI>();
            bool can = CycleState.Blocker().Length == 0;
            open.text = GoLocalization.T("cycle.button", "재출항") + (can ? " ●" : "");
            open.color = can ? new Color(1f, 0.88f, 0.4f) : Color.white;
            if (!IsOpen) return;
            _title.text = string.Format(GoLocalization.T("cycle.title", "별배 재출항 — {0}/{1}회차"), CycleState.Cycle, GoCycle.MaxCycle);
            _body.text = BodyFor();
            ActionButton.interactable = can;
            ActionButton.GetComponentInChildren<TextMeshProUGUI>().text = Armed
                ? GoLocalization.T("cycle.confirm", "정말 재출항? (한 번 더)")
                : GoLocalization.T("cycle.go", "재출항");
        }

        private void Update()
        {
            var kb = Keyboard.current;
            if (kb != null)
            {
                if (kb.nKey.wasPressedThisFrame) Toggle();
                else if (kb.escapeKey.wasPressedThisFrame && IsOpen) Close();
            }
            _tick -= Time.unscaledDeltaTime;
            if (_tick <= 0f) { _tick = 1f; Refresh(); } // 이야기를 끝내면 단추에 ● 가 뜬다
            if (_armedLeft > 0f)
            {
                _armedLeft -= Time.unscaledDeltaTime;
                if (_armedLeft <= 0f) { _armedLeft = 0f; Refresh(); }
            }
        }
    }
}
