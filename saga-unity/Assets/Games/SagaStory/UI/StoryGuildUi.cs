using TMPro;
using UnityEngine;
using UnityEngine.UI;
using Saga.Core;
using Saga.Story.Data;

namespace Saga.Story.UI
{
    /// <summary>
    /// tasks U-0192 4종횡 문파 창(고돗 G-0333 `guild_button.gd` 짝) — 일시정지 단추 왼쪽 🏯 단추 → 창: 지금 문파 줄 · 오늘의 의뢰 줄 · 셋 들기(든 곳은 흐림) · 나가기 · 닫기.
    /// 이 판엔 ☰ 메뉴 격자가 없어 단추 하나로. `GameBootstrap.Start` 가 붙인다(씬 재빌드 없음). 사람 몸·말 걸기 없음(새 NPC 에셋 없음).
    /// </summary>
    public class StoryGuildUi : MonoBehaviour
    {
        /// <summary>오른쪽 위 — 일시정지(오른쪽에서 386, 80 폭)보다 100 더 안쪽.</summary>
        public static readonly Vector2 ButtonAt = new Vector2(-486f, -30f);

        public static StoryGuildUi Instance { get; private set; }
        public Button OpenButton { get; private set; }
        public Button LeaveButton { get; private set; }
        public Button CloseButton { get; private set; }
        public readonly Button[] JoinButtons = new Button[3];
        public TextMeshProUGUI RankLabel { get; private set; }
        public TextMeshProUGUI HuntLabel { get; private set; }
        private GameObject _panel;

        public bool IsOpen => _panel != null && _panel.activeSelf;

        public static StoryGuildUi Install()
        {
            if (Instance != null) return Instance;
            return new GameObject("StoryGuildUi").AddComponent<StoryGuildUi>();
        }

        private void Awake()
        {
            Instance = this;
            SagaUi.EnsureEventSystem();
            var canvas = SagaUi.NewHudCanvas("StoryGuildCanvas", 40, transform); // 이야기 장면 상자(30) 위 · 일시정지(90) 밑
            OpenButton = SagaUi.NewButton(canvas.transform, "Btn_문파", "🏯", new Vector2(1f, 1f), ButtonAt, new Vector2(80f, 80f), SagaUi.ButtonIdle, 40f);
            OpenButton.onClick.AddListener(Toggle);

            _panel = SagaUi.NewPanel(canvas.transform, "GuildPanel", new Vector2(0.5f, 0.5f), Vector2.zero, new Vector2(860f, 600f), SagaUi.Panel).gameObject;
            var title = SagaUi.NewText(_panel.transform, StoryLocalization.T("guild.title", "🏯 문파"), 40f, SagaUi.Gold, new Vector2(0.5f, 1f), new Vector2(0f, -50f), new Vector2(800f, 60f));
            title.raycastTarget = false;
            RankLabel = SagaUi.NewText(_panel.transform, "", 28f, SagaUi.Ink, new Vector2(0.5f, 1f), new Vector2(0f, -120f), new Vector2(800f, 60f));
            HuntLabel = SagaUi.NewText(_panel.transform, "", 24f, SagaUi.InkDim, new Vector2(0.5f, 1f), new Vector2(0f, -180f), new Vector2(800f, 50f));
            for (int i = 0; i < StoryGuild.All.Length; i++)
            {
                int k = i;
                var g = StoryGuild.All[i];
                JoinButtons[i] = SagaUi.NewButton(_panel.transform, "Btn_" + g.Id, $"{g.Emoji} {StoryGuild.Name(i)}\n<size=70%>{StoryGuild.FxName(i)} +</size>",
                    new Vector2(0.5f, 0.5f), new Vector2((i - 1) * 260f, -10f), new Vector2(240f, 130f), SagaUi.ButtonIdle, 30f);
                JoinButtons[i].onClick.AddListener(() => Join(k));
            }
            LeaveButton = SagaUi.NewButton(_panel.transform, "Btn_나가기", StoryLocalization.T("guild.leave", "나가기(공 0)"), new Vector2(0.5f, 0f), new Vector2(-150f, 60f), new Vector2(260f, 80f), SagaUi.ButtonIdle, 28f);
            LeaveButton.onClick.AddListener(() => { StoryGuild.Leave(); Refresh(); });
            CloseButton = SagaUi.NewButton(_panel.transform, "Btn_닫기", StoryLocalization.T("guild.close", "닫기"), new Vector2(0.5f, 0f), new Vector2(150f, 60f), new Vector2(260f, 80f), SagaUi.ButtonIdle, 28f);
            CloseButton.onClick.AddListener(Close);
            _panel.SetActive(false);
            OpenButton.gameObject.SetActive(StoryGuild.On);
        }

        private void OnDestroy() { if (Instance == this) Instance = null; }

        /// <summary>이야기 장면·고르기 창이 떠 있으면 🏯 를 숨기고 안 연다(장면 글이 창 위로 비친다 — 자동 퀘스트 Popup 과 같은 꼴).</summary>
        public static bool Popup()
        {
            var sc = StoryScenarioUi.Instance;
            return (sc != null && sc.IsOpen) || (StoryPickUi.Instance != null && StoryPickUi.Instance.IsShowing)
                || (StoryChoiceUi.Instance != null && StoryChoiceUi.Instance.IsShowing);
        }

        private void Update()
        {
            bool show = StoryGuild.On && !Popup();
            if (OpenButton.gameObject.activeSelf != show) OpenButton.gameObject.SetActive(show);
            if (!show && IsOpen) Close();
        }

        public void Toggle() { if (IsOpen) Close(); else Open(); }

        public void Open()
        {
            if (!StoryGuild.On || Popup()) return;
            _panel.SetActive(true);
            Refresh();
        }

        public void Close() => _panel.SetActive(false);

        public void Join(int i)
        {
            string why = StoryGuild.Join(StoryGuild.All[i].Id);
            if (why.Length > 0) DialogueLabel.Instance?.Show(why, 2f);
            Refresh();
        }

        public void Refresh()
        {
            if (RankLabel == null) return;
            RankLabel.text = StoryGuild.RankText();
            HuntLabel.text = StoryGuild.HuntLine();
            string mine = StoryGuild.Joined;
            for (int i = 0; i < JoinButtons.Length; i++) JoinButtons[i].interactable = StoryGuild.All[i].Id != mine;
            LeaveButton.interactable = mine.Length > 0;
        }
    }
}
