using System;
using UnityEngine;
using Saga.Core;

namespace Saga.Story.Data
{
    /// <summary>
    /// tasks U-0208 4종횡 동료 우정(1만리 U-0199 `GoFriendship`·2나락 U-0201 `DungeonBond` 짝 — 공용 셈·글 <see cref="Friendship"/>, 고돗 4종횡엔 동료 없음).
    /// 교대 동료 셋(<see cref="StoryPartyState.Roster"/> ⚔ 선봉 = 무 · 🏹 유격 = 지 · 🛡 호법 = 덕 — 자리 이름뿐)은 공격 배율·서명뿐이었다 → 자리마다 점수:
    /// 그 동료가 나와 있을 때 처치 +<see cref="KillPts"/> · 두목·숨은 우두머리 +<see cref="BossPts"/> · 그 동료로 교대해 서명 발동 +<see cref="SwapPts"/>.
    /// 단이 오르면 공용 알림 · 지기(Lv 9)에 처음 닿으면 그 동료가 나와 있을 때 공격 ×<see cref="KnotAtkMul"/>(이 판엔 돈이 없어 금 대신, 한 번 닿으면 유지)
    /// · HUD 동료 이름 옆 꼬리표(💛6). 세이브 `bondJson`(버전 그대로, null = 0). 글 키는 `sbond.*`(공용 `friend.*` 를 이 판 표에서 `sbond.*` 로 읽는다).
    /// `SAGA_STORY_BOND=0` 이면 점수·꼬리표·지기 곱 없음.
    /// </summary>
    public static class StoryBond
    {
        public const float KillPts = 1f, BossPts = 10f, SwapPts = 2f, KnotAtkMul = 1.05f;
        /// <summary>R-5(U-0208 뒤) — 교대 점수는 싸움 중일 때만: 마지막 처치 뒤 이 초 안. 적 없이 교대만 되풀이해 지기에 닿는 길을 막는다.</summary>
        public const float SwapFightSec = 10f;
        private static float _lastKillAt = float.NegativeInfinity;
        private static readonly int[] Trait = { 0, 1, 3 };            // 선봉 무 · 유격 지 · 호법 덕
        private static readonly string[] NameKo = { "선봉", "유격", "호법" };
        private const int N = 3;

        private static bool _on = true;
        /// <summary>끄면 점수·꼬리표·지기 곱 없음(진단 손잡이 · 환경 `SAGA_STORY_BOND=0`).</summary>
        public static bool On
        {
            get => _on && Environment.GetEnvironmentVariable("SAGA_STORY_BOND") != "0";
            set => _on = value;
        }

        [Serializable] private class Store { public float[] pts = new float[N]; public bool[] knot = new bool[N]; }

        private static Store _s = new Store();

        private static string T(string k, string ko) =>
            StoryLocalization.T(k.StartsWith("friend.", StringComparison.Ordinal) ? "sbond." + k.Substring(7) : k, ko);

        private static int Clamp(int i) => Mathf.Clamp(i, 0, N - 1);

        public static string Name(int i) { i = Clamp(i); return T("sbond.name." + StoryPartyState.Roster[i].Id, NameKo[i]); }
        public static float Pts(int i) => _s.pts[Clamp(i)];
        public static int Level(int i) => Friendship.LevelOf(Pts(i));
        public static bool Knot(int i) => _s.knot[Clamp(i)];
        public static string Line(int i) => Friendship.Line(Trait[Clamp(i)], Level(i), "", T);

        /// <summary>지기 곱 — 나와 있는 동료가 지기에 한 번 닿았으면 ×1.05(<see cref="StoryPartyState.AtkMultiplier"/> 가 곱한다).</summary>
        public static float AtkMul => AtkMulOf(StoryPartyState.ActiveIndex);
        public static float AtkMulOf(int i) => On && Knot(i) ? KnotAtkMul : 1f;

        /// <summary>HUD 꼬리표 — " 💛6"(Lv 0·꺼짐이면 빈 글).</summary>
        public static string Tag(int i)
        {
            if (!On) return "";
            int lv = Level(i);
            return lv <= 0 ? "" : " " + Friendship.TierEmoji[Friendship.TierOf(lv)] + lv;
        }

        /// <summary>오름 알림 — 공용 <see cref="Friendship.UpLine"/> 과 같은 꼴, 영어 표면 이름 뒤 와/과를 안 붙인다.</summary>
        public static string UpLine(int i, int lv)
        {
            string nm = StoryLocalization.CurrentLanguage == "en" ? Name(i) : Friendship.WithWa(Name(i));
            return string.Format(T("friend.up", "{0} {1}의 우정 Lv.{2} · {3} — \"{4}\""),
                Friendship.TierEmoji[Friendship.TierOf(lv)], nm, lv, Friendship.TierName(lv, T), Friendship.Line(Trait[Clamp(i)], lv, "", T));
        }

        /// <summary>한 자리에 점수 — 단이 오르면 알림 글(없으면 "").</summary>
        public static string Add(int i, float amount)
        {
            if (!On || amount <= 0f) return "";
            i = Clamp(i);
            int lv0 = Friendship.LevelOf(_s.pts[i]);
            _s.pts[i] += amount;
            int lv1 = Friendship.LevelOf(_s.pts[i]);
            if (lv1 <= lv0) return "";
            string msg = UpLine(i, lv1);
            if (Friendship.TierOf(lv1) >= Friendship.KnotTier && !_s.knot[i])
            {
                _s.knot[i] = true;
                msg += string.Format(T("sbond.knot_atk", " · 나와 있을 때 공격 ×{0:0.00}"), KnotAtkMul);
            }
            return msg;
        }

        /// <summary>처치(<c>StoryEnemy.Die</c> — 들판·비경·숨은 우두머리) — 나와 있는 동료 +1(두목·숨은 우두머리 +10).</summary>
        public static string OnKill(bool boss) { _lastKillAt = Time.time; return Add(StoryPartyState.ActiveIndex, boss ? BossPts : KillPts); }

        /// <summary>교대 성사 뒤(<c>StoryPlayerController.TriggerPartySwap</c>) — 새로 나온 동료 +2.</summary>
        public static string OnSwap() => Time.time - _lastKillAt <= SwapFightSec ? Add(StoryPartyState.ActiveIndex, SwapPts) : "";

        public static void ForgetKillForTest() => _lastKillAt = float.NegativeInfinity;

        public static string Snapshot() => JsonUtility.ToJson(_s);

        public static void Restore(string json)
        {
            Store s = null;
            if (!string.IsNullOrEmpty(json)) { try { s = JsonUtility.FromJson<Store>(json); } catch (ArgumentException) { s = null; } }
            if (s == null || s.pts == null || s.pts.Length != N || s.knot == null || s.knot.Length != N) s = new Store();
            for (int i = 0; i < N; i++) s.pts[i] = Mathf.Max(0f, s.pts[i]);
            _s = s;
            _lastKillAt = float.NegativeInfinity;
        }

        public static void ResetForTest() => Restore(null);
    }
}
