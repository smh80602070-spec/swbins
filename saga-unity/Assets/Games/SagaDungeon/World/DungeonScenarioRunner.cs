using UnityEngine;
using Saga.Dungeon.Cinematics;
using Saga.Dungeon.Data;
using Saga.Dungeon.UI;

namespace Saga.Dungeon.World
{
    /// <summary>
    /// PLAN.md 109-16 시나리오 「이름이 지워지는 나라」의 귀 — 웹 `scenario.js init()` 결. 적이 쓰러질 때·갇힌 인물을 구할 때·층에 닿을 때를 <see cref="DungeonScenario"/> 에 알리고,
    /// 반 초마다 <see cref="DungeonScenario.Poll"/>(칸으로 돌아온 순간을 잡는다). 장면 신호는 <see cref="DungeonScenarioUi"/> 로, 장 시작·끝·고르기 알림은 <see cref="DialogueLabel"/> 로.
    /// **칸 안** = 지역 추적기가 지역 번호를 아는 자리(굴혈 방·능묘 속은 아님) + 컷·시련·난입 중이 아닐 때.
    /// 씬 빌더가 아니라 `GameBootstrap.Start()` → <see cref="Install"/>(Play 때).
    /// </summary>
    public class DungeonScenarioRunner : MonoBehaviour
    {
        public const float PollSec = 0.5f;
        public static DungeonScenarioRunner Instance { get; private set; }

        private DungeonScenarioUi _ui;
        private DungeonRegionTracker _tracker;
        private float _left;

        public static DungeonScenarioRunner Install()
        {
            if (Instance != null) return Instance;
            return new GameObject("DungeonScenarioRunner").AddComponent<DungeonScenarioRunner>();
        }

        private void Awake()
        {
            Instance = this;
            _ui = gameObject.AddComponent<DungeonScenarioUi>();
            DungeonScenario.InTownProvider = InTown;
            DungeonScenario.ScenePlay += OnScenePlay;
            DungeonScenario.ChapterStarted += OnChapterStarted;
            DungeonScenario.ChapterFinished += OnChapterFinished;
            DungeonScenario.Notify = OnNotify;
            DungeonEnemy.AnyDied += OnEnemyDied;
            DungeonCaptive.Freed += OnFreed;
        }

        private void Start()
        {
            _tracker = DungeonRegionTracker.Instance;
            var floors = DungeonFloorRunner.Instance;
            if (floors != null) floors.FloorDescended += OnFloor;
            DungeonScenario.Check();
        }

        private void OnDestroy()
        {
            DungeonScenario.InTownProvider = null;
            DungeonScenario.ScenePlay -= OnScenePlay;
            DungeonScenario.ChapterStarted -= OnChapterStarted;
            DungeonScenario.ChapterFinished -= OnChapterFinished;
            DungeonScenario.Notify = null;
            DungeonScenario.AbortScene();
            DungeonEnemy.AnyDied -= OnEnemyDied;
            DungeonCaptive.Freed -= OnFreed;
            var floors = DungeonFloorRunner.Instance;
            if (floors != null) floors.FloorDescended -= OnFloor;
            if (Instance == this) Instance = null;
        }

        private void Update()
        {
            _left -= Time.deltaTime;
            if (_left > 0f) return;
            _left = PollSec;
            Tick();
        }

        /// <summary>한 번 — 굴혈에 있으면 그 층을 알리고, 장면 대기 중이면 다시 물어본다. 진단이 부른다.</summary>
        public void Tick()
        {
            var floors = DungeonFloorRunner.Instance;
            _tracker = _tracker != null ? _tracker : DungeonRegionTracker.Instance;
            if (floors != null && _tracker != null && _tracker.Current < 0) DungeonScenario.OnFloor(floors.CurrentFloor);
            DungeonScenario.Poll();
        }

        private bool InTown()
        {
            _tracker = _tracker != null ? _tracker : DungeonRegionTracker.Instance;
            if (_tracker == null || _tracker.Current < 0) return false;
            if (DungeonCutscenes.Playing || TrialRunner.Busy) return false;
            var horde = HordeRunner.Instance;
            return horde == null || !horde.IsActive;
        }

        private void OnScenePlay(DungeonScenario.SceneRequest request)
        {
            if (_ui == null) { DungeonScenario.AbortScene(); return; }
            _ui.Play(request);
        }

        private void OnChapterStarted(DungeonScenarioData.Chapter c) =>
            DialogueLabel.Instance?.Show(
                string.Format(DungeonLocalization.T("dscen.chapter_fmt", "제{0}장 · {1}"), c.No, DungeonScenario.ChapterTitle(c))
                + "\n" + DungeonScenario.ChapterBlurb(c), 6f);

        private void OnChapterFinished(DungeonScenarioData.Chapter c, string message) => DialogueLabel.Instance?.Show(message, 6f);

        private void OnNotify(string message) => DialogueLabel.Instance?.Show(message, 3f);

        private void OnEnemyDied(DungeonEnemy e) => DungeonScenario.OnKill();
        private void OnFreed() => DungeonScenario.OnRescue();
        private void OnFloor(int floor) => DungeonScenario.OnFloor(floor);
    }
}
