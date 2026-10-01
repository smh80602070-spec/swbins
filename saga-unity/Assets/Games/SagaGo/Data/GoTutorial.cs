using System.Collections.Generic;
using UnityEngine;
using Saga.Core;

namespace Saga.Go.Data
{
    /// <summary>
    /// 첫 10분 사명 — GO(tasks U-0013). 목표판 첫 줄(`GoSessionTracker.GoalLineNow`)에 다섯 단계가 차례로 뜬다:
    /// 걷기(시작 자리에서 30m) → 인물 등용 → 보물 상자 → 원소 반응 → 저장. 판정은 기존 상태를 읽는다(폴링).
    /// 세이브 `tutDone`(v29) — 옛 세이브는 마이그레이션이 전부 끝난 것으로 채운다.
    /// </summary>
    public static class GoTutorial
    {
        public const float WalkMeters = 30f;

        private static Transform _player;
        private static Vector3 _start;
        private static bool _started;

        public static readonly TutorialSteps Steps = new TutorialSteps(
            new TutorialSteps.Step { Id = "walk", Ko = "걸어서 시작한 곳에서 30m 떨어져 보세요", En = "Walk 30 m away from where you started", Done = Walked },
            new TutorialSteps.Step { Id = "recruit", Ko = "역사 인물을 만나 등용해 보세요", En = "Meet and recruit a hero", Done = () => PartyState.MemberIds.Count >= 1 },
            new TutorialSteps.Step { Id = "chest", Ko = "보물 상자를 열어 보세요", En = "Open a treasure chest", Done = AnyChestOpened },
            new TutorialSteps.Step { Id = "react", Ko = "원소 반응을 한 번 일으켜 보세요", En = "Trigger an elemental reaction once", Done = () => AchieveState.Stat("react") >= 1 },
            new TutorialSteps.Step { Id = "save", Ko = "일시정지(Ⅱ)로 저장해 보세요", En = "Save the game with Pause (Ⅱ)", Done = () => SagaFlow.LastAutoSaveReason != null });

        public static bool Enabled { get => Steps.Enabled; set => Steps.Enabled = value; }

        /// <summary>목표판 첫 줄 — 끝났거나 꺼졌으면 null.</summary>
        public static string Line() => Steps.Line();

        public static List<string> Ids() => Steps.Ids();
        public static List<string> AllIds() => Steps.AllIds();
        public static void Restore(IEnumerable<string> ids) { Steps.Restore(ids); _started = false; }

        private static bool Walked()
        {
            if (_player == null)
            {
                var go = GameObject.FindWithTag("Player");
                if (go == null) return false;
                _player = go.transform;
            }
            if (!_started) { _start = _player.position; _started = true; return false; }
            var d = _player.position - _start;
            d.y = 0f;
            return d.magnitude >= WalkMeters;
        }

        private static bool AnyChestOpened()
        {
            foreach (var c in GoTreasure.Chests) if (WorldEventState.IsTriggered(GoTreasure.EventKey(c))) return true;
            return false;
        }
    }
}
