using UnityEngine;
using Saga.Story.Data;
using Saga.Story.UI;

namespace Saga.Story.World
{
    /// <summary>
    /// PLAN.md 109-16 시나리오 「이름 없는 떠돌이」의 귀 — 반 초마다 <see cref="StoryScenario.Poll"/>(사명·전직·레벨은 상태를 읽으면 되고, 비경 완주만 <see cref="StoryLabyrinthRunner.CompleteRun"/> 이 알린다).
    /// 장면 신호는 <see cref="StoryScenarioUi"/> 로, 장 시작·끝 알림은 <see cref="DialogueLabel"/> 로. **들판** = 비경 회차 중이 아닐 때(관문 대장은 두목이 살아 있는 내내 '진행 중'이라 조건에 못 쓴다).
    /// `GameBootstrap.Start()` → <see cref="Install"/>(Play 때, 씬 재빌드 없이).
    /// </summary>
    public class StoryScenarioRunner : MonoBehaviour
    {
        public const float PollSec = 0.5f;
        public static StoryScenarioRunner Instance { get; private set; }

        private float _left;

        public static StoryScenarioRunner Install()
        {
            if (Instance != null) return Instance;
            return new GameObject("StoryScenarioRunner").AddComponent<StoryScenarioRunner>();
        }

        private void Awake()
        {
            Instance = this;
            gameObject.AddComponent<StoryScenarioUi>();
            StoryScenario.InFieldProvider = InField;
            StoryScenario.ScenePlay += OnScenePlay;
            StoryScenario.ChapterStarted += OnChapterStarted;
            StoryScenario.ChapterFinished += OnChapterFinished;
            StoryJobState.JobChosen += OnJobChosen;
            StoryJobState.LeveledUp += OnLeveledUp;
        }

        private void Start() => StoryScenario.Check();

        private void OnDestroy()
        {
            StoryScenario.InFieldProvider = null;
            StoryScenario.ScenePlay -= OnScenePlay;
            StoryScenario.ChapterStarted -= OnChapterStarted;
            StoryScenario.ChapterFinished -= OnChapterFinished;
            StoryScenario.AbortScene();
            StoryJobState.JobChosen -= OnJobChosen;
            StoryJobState.LeveledUp -= OnLeveledUp;
            if (Instance == this) Instance = null;
        }

        private void Update()
        {
            _left -= Time.unscaledDeltaTime;
            if (_left > 0f) return;
            _left = PollSec;
            StoryScenario.Poll();
        }

        private static bool InField() =>
            GameObject.FindWithTag("Player") != null && !StoryLabyrinthState.InRun;

        private void OnScenePlay(StoryScenario.SceneRequest request)
        {
            var ui = StoryScenarioUi.Instance;
            if (ui == null) { StoryScenario.AbortScene(); return; }
            ui.Play(request);
        }

        private void OnChapterStarted(StoryScenarioData.Chapter c) =>
            DialogueLabel.Instance?.Show(StoryScenario.ChapterFullTitle(c) + "\n" + StoryScenario.ChapterBlurb(c), 6f);

        private void OnChapterFinished(StoryScenarioData.Chapter c, string message) => DialogueLabel.Instance?.Show(message, 6f);

        private void OnJobChosen(string job) => StoryScenario.Check();
        private void OnLeveledUp(int level) => StoryScenario.Check();
    }
}
