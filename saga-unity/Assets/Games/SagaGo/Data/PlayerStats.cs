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
        public static int Exp { get; private set; }
        public static int ExpToNext => ExpForLevel(Level);

        public static float AtkBonus => (Level - 1) * AtkPerLevel;
        public static float DefBonus => (Level - 1) * DefPerLevel;

        /// <summary>레벨업마다 한 번씩(경험치가 커서 여러 번 오를 수 있다) — (newLevel)</summary>
        public static event Action<int> LeveledUp;

        private static int ExpForLevel(int level) => Mathf_RoundToInt(ExpBase * Mathf_Pow(ExpGrowth, level - 1));

        public static void AddExp(int amount)
        {
            if (amount <= 0) return;
            amount = System.Math.Max(1, Mathf_RoundToInt(amount * (1f + CycleState.Bonus) * (1f + EggState.BuddyBonus("exp")))); // U-0045 회차마다 경험치 +5%(회차 0 은 그대로)
            Exp += amount;
            while (Exp >= ExpToNext)
            {
                Exp -= ExpToNext;
                Level++;
                LeveledUp?.Invoke(Level);
            }
        }

        public static void Restore(int level, int exp)
        {
            Level = Math.Max(1, level);
            Exp = Math.Max(0, exp);
        }

        // PartyState.cs처럼 UnityEngine을 안 끌어오는 순수 데이터 클래스로
        // 두려고 Mathf 대신 최소 반올림/거듭제곱만 System.Math로 직접 계산.
        private static int Mathf_RoundToInt(float v) => (int)Math.Round(v, MidpointRounding.AwayFromZero);
        private static float Mathf_Pow(float b, float e) => (float)Math.Pow(b, e);
    }
}
