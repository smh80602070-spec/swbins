using System.Collections.Generic;

namespace Saga.Go.Data
{
    /// <summary>
    /// PLAN.md 109-14-21 세계 임무 진행(웹 `save.wq = { steps, done, track }`) — 임무마다 단계(−1 = 안 맡음)·끝남. 따라가는 줄은 `StoryState.Track`.
    /// 세이브 `wqSteps`·`wqDone`·`wqTrack`(버전 그대로 — 옛 세이브는 아무것도 안 맡은 채). 임무 적·제단 불은 저장 안 함(불러오면 그 단계 처음).
    /// </summary>
    public static class WorldQuestState
    {
        private static readonly int[] _step = { -1, -1, -1 };
        private static readonly bool[] _done = new bool[3];

        public static int Count => GoWorldQuests.Quests.Length;
        public static int Step(int q) => q >= 0 && q < _step.Length ? _step[q] : -1;
        public static bool Done(int q) => q >= 0 && q < _done.Length && _done[q];
        /// <summary>맡아서 진행 중(끝나지 않음).</summary>
        public static bool Taken(int q) => Step(q) >= 0 && !Done(q);
        /// <summary>맡을 수 있나 — 안 맡았고 안 끝났고 여정 등급이 닿았다(맡길 사람 머리 위 푸른 !).</summary>
        public static bool Available(int q) => q >= 0 && q < _step.Length && _step[q] < 0 && !_done[q] && PlayerStats.Level >= GoWorldQuests.Quests[q].Ar;

        public static GoStory.Step Current(int q) => Taken(q) ? GoWorldQuests.Quests[q].Steps[_step[q]] : null;

        /// <summary>맡는다(첫 단계 = 맡길 사람과의 대화).</summary>
        public static bool Take(int q)
        {
            if (!Available(q)) return false;
            _step[q] = 0;
            return true;
        }

        /// <summary>단계를 끝낸다 — 마지막이면 보상을 주고 끝(보상 글), 아니면 null.</summary>
        public static string Advance(int q)
        {
            if (!Taken(q)) return null;
            var w = GoWorldQuests.Quests[q];
            _step[q]++;
            if (_step[q] < w.Steps.Length) return null;
            _done[q] = true;
            GoldState.Add(w.Gold);
            TalentState.Add(w.Mats);
            return GoWorldQuests.RewardText(w);
        }

        public static List<int> SnapshotSteps() => new List<int>(_step);
        public static List<bool> SnapshotDone() => new List<bool>(_done);

        /// <summary>불러오기·새 게임·진단 — 없으면(옛 세이브) 아무것도 안 맡은 채.</summary>
        public static void Restore(List<int> steps, List<bool> done)
        {
            for (int i = 0; i < _step.Length; i++)
            {
                _done[i] = done != null && i < done.Count && done[i];
                int n = GoWorldQuests.Quests[i].Steps.Length;
                _step[i] = steps != null && i < steps.Count ? System.Math.Max(-1, System.Math.Min(steps[i], n - 1)) : -1;
                if (_done[i]) _step[i] = n;
            }
        }
    }
}
