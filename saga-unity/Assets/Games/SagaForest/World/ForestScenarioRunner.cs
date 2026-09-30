using UnityEngine;
using Saga.Forest.Data;
using Saga.Forest.UI;

namespace Saga.Forest.World
{
    /// <summary>
    /// PLAN.md 109-16 시나리오 「하늘 금 우체통」의 귀 — 반 초마다 <see cref="ForestScenario.Poll"/>(선 구역을 알리고 장면 대기를 다시 묻는다). 채집·명소·행사는 그쪽 코드가 <see cref="ForestScenario"/> 에 직접 알린다.
    /// 장면 신호는 <see cref="ForestScenarioUi"/> 로, 장 시작·끝 알림은 <see cref="DialogueLabel"/> 로. **마을 어디서나** 뜨되 조우 화면이 열려 있을 땐 아니다.
    /// `ForestBootstrap.Start()` → <see cref="Install"/>(Play 때, 씬 재빌드 없이).
    /// </summary>
    public class ForestScenarioRunner : MonoBehaviour
    {
        public const float PollSec = 0.5f;
        public static ForestScenarioRunner Instance { get; private set; }

        private float _left;

        public static ForestScenarioRunner Install()
        {
            if (Instance != null) return Instance;
            return new GameObject("ForestScenarioRunner").AddComponent<ForestScenarioRunner>();
        }

        private void Awake()
        {
            Instance = this;
            gameObject.AddComponent<ForestScenarioUi>();
            ForestScenario.InTownProvider = InTown;
            ForestScenario.ZoneProvider = CurrentZone;
            ForestScenario.ScenePlay += OnScenePlay;
            ForestScenario.ChapterStarted += OnChapterStarted;
            ForestScenario.ChapterFinished += OnChapterFinished;
            ForestScenario.Notify = OnNotify;
        }

        private void Start() => ForestScenario.Check();

        private void OnDestroy()
        {
            ForestScenario.InTownProvider = null;
            ForestScenario.ZoneProvider = null;
            ForestScenario.ScenePlay -= OnScenePlay;
            ForestScenario.ChapterStarted -= OnChapterStarted;
            ForestScenario.ChapterFinished -= OnChapterFinished;
            ForestScenario.Notify = null;
            ForestScenario.AbortScene();
            if (Instance == this) Instance = null;
        }

        private void Update()
        {
            _left -= Time.unscaledDeltaTime;
            if (_left > 0f) return;
            _left = PollSec;
            ForestScenario.Poll();
        }

        private static bool InTown()
        {
            if (GameObject.FindWithTag("Player") == null) return false;
            var encounter = ForestHostileEncounterUi.Instance;
            return encounter == null || !encounter.IsActive;
        }

        private static int CurrentZone()
        {
            var tracker = ForestZoneTracker.Instance;
            if (tracker != null && tracker.CurrentZone >= 0) return tracker.CurrentZone;
            var player = GameObject.FindWithTag("Player");
            return player != null ? ForestBiomeData.ZoneAt(player.transform.position.x, player.transform.position.z) : -1;
        }

        private void OnScenePlay(ForestScenario.SceneRequest request)
        {
            var ui = ForestScenarioUi.Instance;
            if (ui == null) { ForestScenario.AbortScene(); return; }
            ui.Play(request);
        }

        private void OnChapterStarted(ForestScenarioData.Chapter c) =>
            DialogueLabel.Instance?.Show(ForestScenario.SeasonName(c.Season) + "\n" + ForestScenario.ChapterFullTitle(c) + "\n" + ForestScenario.ChapterBlurb(c), 6f);

        private void OnChapterFinished(ForestScenarioData.Chapter c, string message) => DialogueLabel.Instance?.Show(message, 6f);

        private void OnNotify(string message) => DialogueLabel.Instance?.Show(message, 3f);
    }
}
