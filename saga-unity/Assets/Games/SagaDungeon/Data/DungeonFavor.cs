using System;
using UnityEngine;

namespace Saga.Dungeon.Data
{
    /// <summary>
    /// tasks U-0194 2나락 신의 가호(고돗 G-0335 `dungeon_blessing.gd` 짝, 웹 짝 없음 — 하데스 2 신 계보 구조만) — 축복 3택을 신 계보로 읽는다.
    /// 고돗은 은사 열일곱을 다섯 신으로 묶어 "한 신 은사 3개·6개" 로 단을 매기지만, 이 트랙 축복은 축 셋(공·수·선)마다 하나씩만 들고 고르면 바뀐다
    /// (<see cref="BlessingState"/> 머리말) — 그래서 축 = 신(⚔️ 무신 공 · 🛡️ 지신 수 · 🌪️ 풍신 선) 셋, 단은 **그 신 은사를 고른 횟수** 3 → 1단·6 → 2단.
    /// 덤 = 그 축 배율에 단마다 ×(1 + <see cref="TierBonus"/>)(<see cref="BlessingState"/> 의 공·수·선 배율에 곱 — 고른 적 없으면 1).
    /// 횟수는 보스층 3택(`GameBootstrap.OnFloorDescended`)에서 고를 때만 센다(무리 사냥 3택은 그 판 동안만 갈아 끼우는 것이라 뺌). 세이브 내내 남는다.
    /// </summary>
    public static class DungeonFavor
    {
        public static readonly string[] Emoji = { "⚔️", "🛡️", "🌪️" };
        public static readonly string[] NameKo = { "무신", "지신", "풍신" };
        public static readonly int[] Steps = { 3, 6 };
        public const float TierBonus = 0.08f;

        /// <summary>끄면 가호 없음(고돗 `SAGA_BLESSING=0` 짝).</summary>
        public static bool On = true;

        [Serializable]
        private class Store { public int[] picks = new int[3]; }

        private static Store _s = new Store();

        public static string Name(BlessingState.Axis a) => DungeonLocalization.T("favor.god" + (int)a, NameKo[(int)a]);
        public static int Picks(BlessingState.Axis a) => _s.picks[(int)a];

        public static int TierOf(int picks) { int t = 0; foreach (int s in Steps) if (picks >= s) t++; return t; }
        public static int Tier(BlessingState.Axis a) => On ? TierOf(Picks(a)) : 0;

        /// <summary>그 축 배율에 곱하는 가호 덤(0단 = 1).</summary>
        public static float Mul(BlessingState.Axis a) => 1f + TierBonus * Tier(a);

        /// <summary>보스층 3택에서 고름 — 그 신 횟수 +1. 단이 오르면 새 단(아니면 −1).</summary>
        public static int OnPick(BlessingState.Axis a)
        {
            if (!On) return -1;
            int before = Tier(a);
            _s.picks[(int)a]++;
            int after = Tier(a);
            return after > before ? after : -1;
        }

        /// <summary>3택 카드 셋째 줄 — "⚔️ 무신 2/3 → 가호 1단!"(이 카드를 고르면 닿을 때) · 아니면 "⚔️ 무신 1/3" · 다 오르면 "⚔️ 무신 가호 2단".</summary>
        public static string CardLine(BlessingState.Axis a)
        {
            if (!On) return "";
            int i = (int)a, p = Picks(a), t = TierOf(p);
            if (t >= Steps.Length) return string.Format(DungeonLocalization.T("favor.card_max", "{0} {1} 가호 {2}단"), Emoji[i], Name(a), t);
            int need = Steps[t];
            return p + 1 >= need
                ? string.Format(DungeonLocalization.T("favor.card_up", "{0} {1} {2}/{3} → 가호 {4}단!"), Emoji[i], Name(a), p, need, t + 1)
                : string.Format(DungeonLocalization.T("favor.card", "{0} {1} {2}/{3}"), Emoji[i], Name(a), p, need);
        }

        public static string UpLine(BlessingState.Axis a, int tier) =>
            string.Format(DungeonLocalization.T("favor.up", "{0} {1}의 가호 {2}단 — {3} +{4:0}%"), Emoji[(int)a], Name(a), tier, AxisWhat(a), TierBonus * 100f * tier);

        private static string AxisWhat(BlessingState.Axis a) => a == BlessingState.Axis.Atk ? DungeonLocalization.T("favor.what0", "공격")
            : a == BlessingState.Axis.Def ? DungeonLocalization.T("favor.what1", "막기") : DungeonLocalization.T("favor.what2", "회전베기 쿨");

        public static string Snapshot() => JsonUtility.ToJson(_s);

        public static void Restore(string json)
        {
            Store s = null;
            if (!string.IsNullOrEmpty(json)) { try { s = JsonUtility.FromJson<Store>(json); } catch (ArgumentException) { s = null; } }
            if (s == null || s.picks == null || s.picks.Length != 3) s = new Store();
            for (int i = 0; i < 3; i++) s.picks[i] = Mathf.Max(0, s.picks[i]);
            _s = s;
        }

        public static void ResetForTest() => Restore(null);
    }
}
