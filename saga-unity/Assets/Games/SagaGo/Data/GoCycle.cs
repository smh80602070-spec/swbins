using System;
using System.Collections.Generic;

namespace Saga.Go.Data
{
    /// <summary>
    /// tasks U-0045 별배 재출항 = 회차 표(saga-godot `data/cycle.gd`) — 이야기를 끝낸 뒤 다시 도는 길. 이야기·도감·인물·무기는 그대로 두고 세계를 새로 연다.
    /// 영구: 회차마다 공격력·경험치 +5%, 천하 등급 상한 +2(문턱은 24 다음 3레벨마다). 고돗의 "모험 등급 40 이상" 조건은 이 트랙에서
    /// 이야기 41장 마지막 문턱이 레벨 85 라 늘 참이어서 두지 않았다.
    /// </summary>
    public static class GoCycle
    {
        public const int MaxCycle = 5;
        public const float BonusPerCycle = 0.05f;
        public const int WorldCapPerCycle = 2;
        public const int WlStepBeyond = 3;
        public const int RewardGold = 20000, RewardGuide = 2, RewardKnot = 3, RewardExp = 200;

        public static GoHunt.Reward Reward()
        {
            var m = new int[5];
            m[(int)GoTalent.Mat.Guide] = RewardGuide; m[(int)GoTalent.Mat.Knot] = RewardKnot;
            return new GoHunt.Reward { Gold = RewardGold, Mats = m };
        }

        public static string RewardText() =>
            GoHunt.RewardText(Reward()) + " · " + string.Format(GoLocalization.T("weekly.r_exp", "경험치 {0}"), RewardExp);
    }

    /// <summary>회차 상태 — 0(처음)~<see cref="GoCycle.MaxCycle"/>. 세이브 필드 `cycleN`(버전 그대로, 옛 세이브는 0).</summary>
    public static class CycleState
    {
        public static int Cycle { get; private set; }
        public static event Action Changed;

        /// <summary>영구 보너스 비율(공격력·경험치) — 회차 0 은 0.</summary>
        public static float Bonus => GoCycle.BonusPerCycle * Cycle;

        public static bool StoryDone => StoryState.Done;

        /// <summary>재출항할 수 없는 까닭(가능하면 빈 글).</summary>
        public static string Blocker()
        {
            if (Cycle >= GoCycle.MaxCycle)
                return string.Format(GoLocalization.T("cycle.why.max", "이미 마지막 회차({0})다"), GoCycle.MaxCycle);
            if (!StoryDone)
                return string.Format(GoLocalization.T("cycle.why.story", "이야기를 끝까지 마쳐야 한다 (지금 {0}/{1}장)"), StoryState.Ch, GoStory.Chapters.Length);
            return "";
        }

        public struct Result
        {
            public bool Ok;
            public string Error;
            public int Chests, Cycle;
        }

        /// <summary>재출항한다 — 못 하면 <see cref="Result.Error"/>. 되살린 상자 수·새 회차를 돌려준다.</summary>
        public static Result Advance()
        {
            string err = Blocker();
            if (err.Length > 0) return new Result { Ok = false, Error = err, Cycle = Cycle };
            Cycle++;

            // ① 열어 둔 상자 되살림 — `chest_*` 만 지운다(다른 월드 이벤트는 그대로). 상자는 매 프레임 겉모습을 맞춰 즉시 닫힌다.
            int chests = 0;
            var keep = new List<string>();
            foreach (var id in WorldEventState.TriggeredIds)
            {
                if (id.StartsWith("chest_")) chests++;
                else keep.Add(id);
            }
            WorldEventState.Restore(keep);
            // ② 채집 자리 회복 ③ 주간 숨은 터 횟수·밤의 잔불 초기화 ④ 낮춘 천하 등급 풀기
            CookState.ClearGather();
            DomainState.ResetWeekly();
            NightEchoState.Restore("", null);
            AdventureState.RestoreSave(false, AdventureState.Paid);
            // ⑤ 보상
            var r = GoCycle.Reward();
            GoldState.Add(r.Gold);
            TalentState.Add(r.Mats);
            PlayerStats.AddExp(GoCycle.RewardExp);
            AdventureState.Rescale();
            Changed?.Invoke();
            return new Result { Ok = true, Chests = chests, Cycle = Cycle };
        }

        // ---- 세이브 ----

        /// <summary>불러오기·새 게임·진단 — 범위 밖은 눌러 담는다(옛 세이브 0).</summary>
        public static void Restore(int cycle)
        {
            Cycle = Math.Max(0, Math.Min(cycle, GoCycle.MaxCycle));
            AdventureState.Rescale();
            Changed?.Invoke();
        }

        public static void ResetForTest() => Restore(0);
    }
}
