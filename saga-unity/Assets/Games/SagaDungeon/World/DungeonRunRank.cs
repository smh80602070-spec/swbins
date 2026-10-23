using System;
using System.Collections.Generic;
using UnityEngine;
using Saga.Dungeon.Data;
using Saga.Dungeon.Player;

namespace Saga.Dungeon.World
{
    /// <summary>
    /// tasks U-0169 — 웹 사가나락 W-0378 "던전 한 판 결과 등급"(4종횡 W-0289 공용 식)의 이 트랙 판.
    /// 이 트랙은 던전을 나오는 일이 없어(층이 이어진다) **판 = 한 층**: 그 층 첫 타격에 열고, 계단으로 내려가면 살아 나옴,
    /// 쓰러지면 등급만. <see cref="DungeonFloorRunner.JumpToFloor"/>(세이브·은총·진단)는 판을 버린다. 시련·난입 중엔 세지 않는다.
    /// 식은 4종횡 `StoryRunRank.RankOf` 사본(트랙 안 판끼리 코드 공유 없음): 급 t(1~5) — 피격 0/≤3+(t−1)/≤8+2(t−1) → 3/2/1 ·
    /// 연타 ≥20/≥10/≥5 → 3/2/1 · 시간 ≤180·360초×(1+0.25(t−1)) → 2/1 · 처치 ≥15 → +1 · 7↑ S · 5↑ A · 3↑ B · 1↑ C · 0 D.
    /// 급 = 층 1~4·5~9·10~19·20~39·40~ → 1~5(웹 dg-rank 그대로). 덤 = 그 판에 번 금 × S 0.5·A 0.2·B 0.1, S 는 급 보석 하나 더
    /// (<see cref="HeroState.SocketIfBetter"/> — 더 센 것만, 새 아이템 없음). 최고 기록은 급별(세이브 `rankTiers`·`rankGrades`).
    /// </summary>
    public static class DungeonRunRank
    {
        public const int MinKills = 3, KillBonusAt = 15;
        private static readonly string Order = "DCBAS";
        private static readonly string[] TierGems = { "gem_jade", "gem_jade", "gem_sapphire", "gem_sapphire", "gem_ruby" };

        public readonly struct Result
        {
            public readonly string Rank, PrevBest, Gem;
            public readonly int Pt, Hits, ComboMax, Sec, Kills, Tier, Bonus;
            public readonly bool Best, Dead;
            public Result(string rank, int pt, int hits, int comboMax, int sec, int kills, int tier,
                int bonus = 0, string gem = null, bool best = false, bool dead = false, string prevBest = null)
            {
                Rank = rank; Pt = pt; Hits = hits; ComboMax = comboMax; Sec = sec; Kills = kills; Tier = tier;
                Bonus = bonus; Gem = gem; Best = best; Dead = dead; PrevBest = prevBest;
            }
        }

        private static bool _on, _hooked;
        private static float _t0;
        private static int _hits, _combo, _comboMax, _kills, _floor, _gold0;
        private static readonly Dictionary<int, string> _best = new Dictionary<int, string>();

        public static bool Active => _on;
        public static Result? Last { get; private set; }

        /// <summary>층 → 급 1~5(웹 dg-rank).</summary>
        public static int TierOf(int floor) => floor >= 40 ? 5 : floor >= 20 ? 4 : floor >= 10 ? 3 : floor >= 5 ? 2 : 1;

        /// <summary>통계 → 등급. **순수 함수**(4종횡 식 그대로).</summary>
        public static Result RankOf(float sec, int hits, int comboMax, int kills, int tier)
        {
            int t = Mathf.Clamp(tier, 1, 5);
            float tm = 1f + 0.25f * (t - 1);
            int pt = (hits == 0 ? 3 : hits <= 3 + (t - 1) ? 2 : hits <= 8 + 2 * (t - 1) ? 1 : 0)
                   + (comboMax >= 20 ? 3 : comboMax >= 10 ? 2 : comboMax >= 5 ? 1 : 0)
                   + (sec <= 180f * tm ? 2 : sec <= 360f * tm ? 1 : 0)
                   + (kills >= KillBonusAt ? 1 : 0);
            string rank = pt >= 7 ? "S" : pt >= 5 ? "A" : pt >= 3 ? "B" : pt >= 1 ? "C" : "D";
            return new Result(rank, pt, hits, comboMax, Mathf.RoundToInt(sec), kills, t);
        }

        /// <summary>덤 배율(살아 나온 판) — S 0.5 · A 0.2 · B 0.1.</summary>
        public static float BonusMul(string rank) => rank == "S" ? 0.5f : rank == "A" ? 0.2f : rank == "B" ? 0.1f : 0f;

        public static bool Better(string a, string b) => Order.IndexOf(a ?? "", StringComparison.Ordinal) > Order.IndexOf(b ?? "", StringComparison.Ordinal);

        public static string BestOf(int tier) => _best.TryGetValue(tier, out var r) ? r : "";

        /// <summary>`DungeonFloorRunner.Awake` 가 부른다 — 정적 사건이라 한 번만 건다.</summary>
        public static void Hook()
        {
            if (_hooked) return;
            _hooked = true;
            PlayerCombat.Struck += () => OnHit(Time.time);
            HeroState.Hurt += OnHurt;
            DungeonEnemy.AnyDied += _ => OnKill();
        }

        private static bool Busy => TrialRunner.Busy || (HordeRunner.Instance != null && HordeRunner.Instance.IsActive);

        /// <summary>내 쪽 타격 하나 — 판이 없으면 지금 층으로 연다.</summary>
        public static void OnHit(float now)
        {
            if (Busy) return;
            if (!_on)
            {
                _on = true; _t0 = now; _hits = 0; _combo = 0; _comboMax = 0; _kills = 0;
                _floor = DungeonFloorRunner.Instance != null ? DungeonFloorRunner.Instance.CurrentFloor : 1;
                _gold0 = HeroState.GoldEarned;
            }
            _combo++;
            if (_combo > _comboMax) _comboMax = _combo;
        }

        public static void OnHurt()
        {
            if (!_on || Busy) return;
            _hits++;
            _combo = 0;
        }

        public static void OnKill()
        {
            if (!_on || Busy) return;
            _kills++;
        }

        /// <summary>판을 버린다(층 건너뛰기·은총·불러오기) — 등급 없음.</summary>
        public static void Cancel() => _on = false;

        /// <summary>판을 닫는다 — 계단(dead=false)·쓰러짐(dead=true). 처치 3 미만이면 null.</summary>
        public static Result? Finish(float now, bool dead)
        {
            if (!_on) return null;
            if (dead && Busy) return null; // 시련·난입에서 쓰러짐은 그쪽 판 — 층 판은 그대로 둔다
            _on = false;
            if (_kills < MinKills) return null;
            int tier = TierOf(_floor);
            var b = RankOf(now - _t0, _hits, _comboMax, _kills, tier);
            int bonus = 0;
            string gem = null;
            if (!dead)
            {
                bonus = Mathf.RoundToInt(Mathf.Max(0, HeroState.GoldEarned - _gold0) * BonusMul(b.Rank));
                if (bonus > 0) HeroState.AddGold(bonus);
                if (b.Rank == "S" && HeroState.SocketIfBetter(TierGems[tier - 1])) gem = TierGems[tier - 1];
            }
            string prev = BestOf(tier);
            if (prev == "") prev = null;
            bool best = prev == null || Better(b.Rank, prev);
            if (best) _best[tier] = b.Rank;
            var r = new Result(b.Rank, b.Pt, b.Hits, b.ComboMax, b.Sec, b.Kills, tier, bonus, gem, best, dead, prev);
            Last = r;
            if (dead) DungeonSeason.Skip(); else DungeonSeason.Record(r.Rank, tier); // tasks U-0195 시즌 — 살아 나온 판만
            return r;
        }

        /// <summary>한 줄 — "⭐ 이번 판 등급 A — 피격 3 · 연타 12 · 2:40".</summary>
        public static string Line(Result r) =>
            string.Format(DungeonLocalization.T("runrank.line", "⭐ 이번 판 등급 {0} — 피격 {1} · 연타 {2} · {3}:{4:00}"), r.Rank, r.Hits, r.ComboMax, r.Sec / 60, r.Sec % 60);

        /// <summary>둘째 줄 — 덤·보석·최고 기록·쓰러짐(없으면 빈 글).</summary>
        public static string Line2(Result r)
        {
            var p = new List<string>();
            if (r.Bonus > 0) p.Add(string.Format(DungeonLocalization.T("runrank.bonus", "등급 덤 금 +{0}"), r.Bonus));
            if (r.Gem != null) p.Add(string.Format(DungeonLocalization.T("runrank.gem", "💎 {0} 박음"), GemData.Get(r.Gem)?.Name ?? r.Gem));
            if (r.Best) p.Add(r.PrevBest != null
                ? string.Format(DungeonLocalization.T("runrank.best", "🏆 최고 기록 {0} → {1}"), r.PrevBest, r.Rank)
                : string.Format(DungeonLocalization.T("runrank.first", "🏆 첫 기록 {0}"), r.Rank));
            if (r.Dead) p.Add(DungeonLocalization.T("runrank.dead", "쓰러져 덤 없음"));
            return string.Join(" · ", p);
        }

        /// <summary>내려가는 글·쓰러짐 글에 붙일 두 줄(앞에 줄바꿈) — 등급이 없으면 빈 글.</summary>
        public static string Append(Result? r)
        {
            if (!r.HasValue) return "";
            string l2 = Line2(r.Value);
            string l3 = !r.Value.Dead ? DungeonSeason.LastLine : ""; // tasks U-0195 시즌 셋째 줄
            return "\n" + Line(r.Value) + (l2.Length > 0 ? "\n" + l2 : "") + (l3.Length > 0 ? "\n" + l3 : "");
        }

        // ── 세이브(버전 그대로 — 옛 세이브는 null → 빈 기록)
        public static int[] SnapshotTiers() { var a = new int[_best.Count]; _best.Keys.CopyTo(a, 0); return a; }
        public static string[] SnapshotGrades(int[] tiers) { var a = new string[tiers.Length]; for (int i = 0; i < a.Length; i++) a[i] = _best[tiers[i]]; return a; }

        public static void Restore(int[] tiers, string[] grades)
        {
            _best.Clear();
            _on = false;
            if (tiers == null || grades == null) return;
            for (int i = 0; i < tiers.Length && i < grades.Length; i++)
            {
                string g = grades[i];
                if (tiers[i] < 1 || tiers[i] > 5 || string.IsNullOrEmpty(g) || g.Length != 1 || Order.IndexOf(g, StringComparison.Ordinal) < 0) continue;
                _best[tiers[i]] = g;
            }
        }

        /// <summary>진단 — 판 상태를 비운다(최고 기록은 그대로).</summary>
        public static void ClearForTest() { _on = false; Last = null; }
    }
}
