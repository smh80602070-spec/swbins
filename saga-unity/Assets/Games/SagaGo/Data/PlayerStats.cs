using System;

namespace Saga.Go.Data
{
    /// <summary>
    /// PLAN.md 59~61장 Stats/EXP/Level Up — PartyState.cs와 같은 자리
    /// (static, 씬 안에서만 유지). 부대원 수(PartyState)·장비(Inventory)와
    /// 별도 축으로 "내 캐릭터가 자란다"는 감각을 준다 — 셋을 합친 값을
    /// BanditEncounter가 DuelRules에 넘긴다.
    /// </summary>
    public static class PlayerStats
    {
        public const float AtkPerLevel = 6f;
        public const float DefPerLevel = 4f;
        private const int ExpBase = 80;
        private const float ExpGrowth = 1.35f;

        public static int Level { get; private set; } = 1;
        public static long Exp { get; private set; }
        public static long ExpToNext => ExpForLevel(Level);

        public static float AtkBonus => (Level - 1) * AtkPerLevel;
        public static float DefBonus => (Level - 1) * DefPerLevel;

        /// <summary>레벨업마다 한 번씩(경험치가 커서 여러 번 오를 수 있다) — (newLevel)</summary>
        public static event Action<int> LeveledUp;

        // U-0052 Lv.30 까지는 옛 식(80×1.35^(L−1)) 그대로 — 세이브 호환. 그 뒤로는 문턱이 레벨마다 ×1.08 로만 커진다
        // (웹 사가종횡 "Lv.25 까지 그대로, 그 뒤 완만" 과 같은 꺾기). 옛 식은 Lv.58 에서 int 를 넘어 AddExp 가 끝나지 않았다.
        public const int CurveBendLevel = 30;
        private const double LateGrowth = 1.08;
        // 레벨 상한이 아니라 AddExp 루프 안전장치 — UI 에 "최대 레벨" 로 쓰지 않는다.
        public const int LoopGuardLevel = 200;
        private static readonly long[] Thresholds = BuildThresholds();

        private static long[] BuildThresholds()
        {
            var t = new long[LoopGuardLevel + 1];
            for (int l = 1; l <= LoopGuardLevel; l++)
                t[l] = l <= CurveBendLevel
                    ? Mathf_RoundToInt(ExpBase * Mathf_Pow(ExpGrowth, l - 1))
                    : (long)Math.Round(t[l - 1] * LateGrowth, MidpointRounding.AwayFromZero);
            return t;
        }

        public static long ExpForLevel(int level) => Thresholds[Math.Min(LoopGuardLevel, Math.Max(1, level))];

        public static void AddExp(long amount)
        {
            if (amount <= 0) return;
            double scaled = Math.Round(amount * (double)(1f + CycleState.Bonus) * (1f + EggState.BuddyBonus("exp")), MidpointRounding.AwayFromZero); // U-0045 회차마다 경험치 +5%(회차 0 은 그대로)
            amount = scaled >= long.MaxValue ? long.MaxValue : Math.Max(1L, (long)scaled);
            Exp = Exp > long.MaxValue - amount ? long.MaxValue : Exp + amount;
            while (Exp >= ExpToNext && Level < LoopGuardLevel)
            {
                Exp -= ExpToNext;
                Level++;
                LeveledUp?.Invoke(Level);
            }
        }

        public static void Restore(int level, long exp)
        {
            Level = Math.Max(1, level);
            Exp = Math.Max(0L, exp);
        }

        // PartyState.cs처럼 UnityEngine을 안 끌어오는 순수 데이터 클래스로
        // 두려고 Mathf 대신 최소 반올림/거듭제곱만 System.Math로 직접 계산.
        private static int Mathf_RoundToInt(float v) => (int)Math.Round(v, MidpointRounding.AwayFromZero);
        private static float Mathf_Pow(float b, float e) => (float)Math.Pow(b, e);
    }
}
