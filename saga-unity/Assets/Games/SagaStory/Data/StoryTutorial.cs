using System.Collections.Generic;
using UnityEngine;
using Saga.Core;

namespace Saga.Story.Data
{
    /// <summary>
    /// 첫 10분 사명 — STORY(tasks U-0020). 목표판 첫 줄(`StorySessionTracker.GoalLineNow`)에 다섯 단계가 차례로 뜬다:
    /// 걷기(시작 자리에서 30m) → 첫 처치 → 레벨 2 → 무예 올리기 → 저장. 판정은 기존 상태를 읽는다(폴링).
    /// 세이브 `tutDone`(버전 그대로) — 없는 세이브(null)는 옛 세이브라 전부 끝난 것으로 본다.
    /// </summary>
    public static class StoryTutorial
    {
        public const float WalkMeters = 30f;

        private static Transform _player;
        private static Vector3 _start;
        private static bool _started;

        public static readonly TutorialSteps Steps = new TutorialSteps(
            new TutorialSteps.Step { Id = "walk", Ko = "걸어서 시작한 곳에서 30m 떨어져 보세요", En = "Walk 30 m away from where you started", Done = Walked },
            new TutorialSteps.Step { Id = "kill", Ko = "적을 한 마리 쓰러뜨려 보세요", En = "Defeat an enemy", Done = () => StoryQuestState.Kills >= 1 },
            new TutorialSteps.Step { Id = "level", Ko = "레벨 2 까지 올려 보세요", En = "Reach level 2", Done = () => StoryJobState.Level >= 2 },
            new TutorialSteps.Step { Id = "skill", Ko = "무예 창에서 무예를 하나 올려 보세요", En = "Raise a martial skill in the skill window", Done = () => StorySkillState.SpSpent >= 1 },
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
    }
}
