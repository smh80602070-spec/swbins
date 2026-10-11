using System;
using System.Collections.Generic;
using UnityEngine;

namespace Saga.Forest.Data
{
    /// <summary>
    /// tasks U-0095 — 웹 사가마을 W-0103 "제작대 + 도구 승급 3택"(마인크래프트 참고, 재미표준 D)의 이 트랙 판.
    /// 이 트랙엔 잠자리채·삽 같은 도구가 없어(다가가면 저절로 채집) 도구 대신 **채집 손** 하나를 Lv.1→4 로 승급한다(열매 30·60·100).
    /// 승급마다 서로 다른 축 셋 중 하나: <see cref="Axis.Speed"/> 빠른 손(두 채집 쿨 ×0.8, 하한 ×0.6) ·
    /// <see cref="Axis.Yield"/> 넉넉한 손(열매 나무 +1 확률 30%, 상한 60%) · <see cref="Axis.Eye"/> 눈 밝은 손(채집 자리에서 도감에 없는 것 확률 ×1.5, 상한 ×2 —
    /// 이 트랙엔 희귀 등급이 없어 "새 것"이 희귀 자리). 거절하면 열매 10 을 돌려받고 레벨만 오른다(웹: 승급은 되고 축만 빈다).
    /// Lv.1(아무것도 안 고름)은 지금 채집 수치와 같다. 세이브 `handLv`·`handPerks`·`handPending`(버전 그대로 — 옛 세이브는 Lv.1·없음).
    /// </summary>
    public static class ForestHandState
    {
        public enum Axis { Speed = 0, Yield = 1, Eye = 2 }

        public const int MaxLv = 4;
        public static readonly int[] UpgradeCost = { 30, 60, 100 };   // Lv.1→2, 2→3, 3→4
        public const int DeclineRefund = 10;

        public static int Level { get; private set; } = 1;
        /// <summary>승급 값을 치르고 아직 축을 안 고른 상태(창이 다시 연다).</summary>
        public static bool Pending { get; private set; }
        private static readonly List<int> Perks = new List<int>();   // 레벨마다 고른 축(-1 = 거절)
        public static IReadOnlyList<int> PerkList => Perks;
        public static event Action Changed;

        public static int CountOf(Axis a) { int n = 0; foreach (var p in Perks) if (p == (int)a) n++; return n; }
        public static float CooldownMul => Mathf.Max(0.6f, Mathf.Pow(0.8f, CountOf(Axis.Speed)));
        public static float BonusFruitChance => Mathf.Min(0.6f, 0.3f * CountOf(Axis.Yield));
        public static float NewItemMul => Mathf.Min(2f, Mathf.Pow(1.5f, CountOf(Axis.Eye)));

        /// <summary>다음 승급 값(최고 단계면 0).</summary>
        public static int NextCost => Level >= MaxLv ? 0 : UpgradeCost[Level - 1];

        /// <summary>승급 — 열매를 치르고 3택을 연다. 못 하면 이유 키(되면 null).</summary>
        public static string Upgrade()
        {
            if (Pending) return "hand.why_pending";
            if (Level >= MaxLv) return "hand.why_max";
            if (!ForestState.SpendFruit(NextCost)) return "hand.why_fruit";
            Pending = true;
            Changed?.Invoke();
            return null;
        }

        /// <summary>3택 — 셋 다 다른 축(셋뿐이라 늘 셋 다), 순서만 섞는다.</summary>
        public static Axis[] Offer(System.Random rng = null)
        {
            var a = new[] { Axis.Speed, Axis.Yield, Axis.Eye };
            for (int i = a.Length - 1; i > 0; i--)
            {
                int j = rng != null ? rng.Next(i + 1) : UnityEngine.Random.Range(0, i + 1);
                (a[i], a[j]) = (a[j], a[i]);
            }
            return a;
        }

        public static bool Choose(Axis a)
        {
            if (!Pending) return false;
            Perks.Add((int)a);
            Level++;
            Pending = false;
            Changed?.Invoke();
            return true;
        }

        public static bool Decline()
        {
            if (!Pending) return false;
            Perks.Add(-1);
            Level++;
            Pending = false;
            ForestState.AddFruit(DeclineRefund);
            Changed?.Invoke();
            return true;
        }

        /// <summary>열매 나무 한 번 — 넉넉한 손이면 확률로 +1.</summary>
        public static int BonusFruit(System.Random rng) => BonusFruitChance > 0f && rng.NextDouble() < BonusFruitChance ? 1 : 0;

        /// <summary>채집 자리 고르기 — 눈 밝은 손이면 확률(1 − 1/배율)로 도감에 없는 것 중에서(없으면 그냥).</summary>
        public static string PickItem(string[] pool, Func<string, bool> discovered, System.Random rng)
        {
            float mul = NewItemMul;
            if (mul > 1f && rng.NextDouble() < 1f - 1f / mul)
            {
                var fresh = new List<string>();
                foreach (var it in pool) if (!discovered(it)) fresh.Add(it);
                if (fresh.Count > 0) return fresh[rng.Next(fresh.Count)];
            }
            return pool[rng.Next(pool.Length)];
        }

        public static string AxisName(Axis a) => a switch
        {
            Axis.Speed => ForestLocalization.T("hand.speed", "빠른 손 — 채집 쿨 ×0.8"),
            Axis.Yield => ForestLocalization.T("hand.yield", "넉넉한 손 — 열매 +1 확률 30%"),
            _ => ForestLocalization.T("hand.eye", "눈 밝은 손 — 새 것 확률 ×1.5"),
        };

        public static void Restore(int lv, int[] perks, int pending)
        {
            Perks.Clear();
            if (perks != null) foreach (var p in perks) if (p >= -1 && p <= 2 && Perks.Count < MaxLv - 1) Perks.Add(p);
            Level = Mathf.Clamp(lv <= 0 ? 1 : lv, 1, MaxLv);
            if (Perks.Count > Level - 1) Perks.RemoveRange(Level - 1, Perks.Count - (Level - 1));
            while (Perks.Count < Level - 1) Perks.Add(-1);
            Pending = pending != 0 && Level < MaxLv;
            Changed?.Invoke();
        }

        public static int[] SnapshotPerks() => Perks.ToArray();
    }
}
