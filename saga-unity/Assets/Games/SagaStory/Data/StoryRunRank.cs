using System;
using UnityEngine;

namespace Saga.Story.Data
{
    /// <summary>
    /// tasks U-0093 — 웹 사가종횡 W-0104 "사냥터 한 판 결과 등급"(던파의 판 등급, `js/runrank.js`)의 이 트랙 판.
    /// 이 트랙엔 사냥터가 하나라 **판** = 지난 판 끝(첫 타격·두목 처치·쓰러짐) 뒤 첫 타격부터 다음 **두목 처치** 또는 **쓰러짐**까지.
    /// 등급은 순수 함수 <see cref="RankOf(float,int,int,int,int)"/>(웹 식 그대로). 연타 = 타격마다 +1, 맞으면 0(웹도 콤보가 원래 없어 이렇게 셈).
    /// 처치 3 미만 판은 등급 없음.
    ///
    /// **tasks U-0128(웹 W-0289) 넓힘** — 급 t(1~5): 피격 0/≤3+(t−1)/≤8+2(t−1) → 3/2/1 · 연타 ≥20/≥10/≥5 → 3/2/1 ·
    /// 시간 ≤180·360초×(1+0.25(t−1)) → 2/1 · 처치 ≥15 → +1(합 9) · 7↑ S · 5↑ A · 3↑ B · 1↑ C · 0 은 D.
    /// 살아 나온 판(두목 처치)만 덤 — S ×1.5 + 기억 조각 1 · A ×1.2 · B ×1.1 · C·D 없음. 최고 기록(등급 글자)은 세이브 `rankBest`.
    /// **이 트랙 다름**: 사냥터가 하나라 웹 "사냥터 need → 급"은 **회차**(1~5, 넘으면 5 — 회차가 오를수록 적이 거칠다)로,
    /// 금이 없어 덤의 밑은 **이 판에 잡아서 얻은 경험치**(회차 배율 든 값), 최고 기록은 사냥터 하나뿐이라 한 칸.
    /// </summary>
    public static class StoryRunRank
    {
        public const int MinKills = 3, KillBonusAt = 15, ShardOnS = 1;
        private static readonly string Order = "DCBAS";

        public readonly struct Result
        {
            public readonly string Rank;
            public readonly int Pt, Hits, ComboMax, Sec, Kills, Tier;
            // U-0128 — 덤·최고 기록(RankOf 만 부르면 0·false)
            public readonly int BonusExp, Shard;
            public readonly bool Best, Dead;
            public readonly string PrevBest;
            public Result(string rank, int pt, int hits, int comboMax, int sec, int kills = 0, int tier = 1,
                int bonusExp = 0, int shard = 0, bool best = false, bool dead = false, string prevBest = null)
            {
                Rank = rank; Pt = pt; Hits = hits; ComboMax = comboMax; Sec = sec; Kills = kills; Tier = tier;
                BonusExp = bonusExp; Shard = shard; Best = best; Dead = dead; PrevBest = prevBest;
            }
        }

        private static bool _on;
        private static float _t0, _exp;
        private static int _hits, _combo, _comboMax, _kills;
        private static string _best = "";

        /// <summary>판이 닫힐 때(등급 있을 때만) — 화면 한 줄은 GameBootstrap 이 띄운다.</summary>
        public static event Action<Result> Finished;
        public static Result? Last { get; private set; }
        /// <summary>최고 기록 등급 글자(없으면 빈 글) — 세이브 `rankBest`.</summary>
        public static string Best => _best;

        /// <summary>급 1~5 — 지금 회차(넘으면 5).</summary>
        public static int TierNow => Mathf.Clamp(StoryRound.Round, 1, 5);

        /// <summary>U-0093 식 — 급 1·처치 셈 없음(이제 0점은 D).</summary>
        public static Result RankOf(float sec, int hits, int comboMax) => RankOf(sec, hits, comboMax, 0, 1);

        /// <summary>통계 → 등급. **순수 함수**(웹 rankOf 그대로).</summary>
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

        /// <summary>내 쪽 타격 하나(적이 피해를 받음) — 판이 없으면 연다.</summary>
        public static void OnHit(float now)
        {
            if (!_on) { _on = true; _t0 = now; _hits = 0; _combo = 0; _comboMax = 0; _kills = 0; _exp = 0f; }
            _combo++;
            if (_combo > _comboMax) _comboMax = _combo;
        }

        public static void OnHurt()
        {
            if (!_on) return;
            _hits++;
            _combo = 0;
        }

        /// <summary>처치 — 잡아서 얻은 경험치를 판에 더하고, 두목이면 판을 닫는다(살아 나옴).</summary>
        public static void OnKill(bool boss, float now, float exp = 0f)
        {
            if (!_on) return;
            _kills++;
            _exp += Mathf.Max(0f, exp);
            if (boss) Finish(now);
        }

        /// <summary>판을 닫는다(쓰러짐 = dead · 두목 처치) — 등급이 나오면 덤·최고 기록을 매기고 <see cref="Finished"/>.</summary>
        public static Result? Finish(float now, bool dead = false)
        {
            if (!_on) return null;
            _on = false;
            StoryCampfire.OnRunClosed(); // tasks U-0170 — 모닥불 온기는 한 판만
            if (_kills < MinKills) return null;
            var b = RankOf(now - _t0, _hits, _comboMax, _kills, TierNow);
            int bonus = 0, shard = 0;
            if (!dead)
            {
                bonus = Mathf.RoundToInt(_exp * BonusMul(b.Rank));
                if (bonus > 0) StoryJobState.GainExp(bonus);
                if (b.Rank == "S") { shard = ShardOnS; StoryLabyrinthState.AddShards(shard); }
            }
            string prev = string.IsNullOrEmpty(_best) ? null : _best;
            bool best = prev == null || Better(b.Rank, prev);
            if (best) _best = b.Rank;
            var r = new Result(b.Rank, b.Pt, b.Hits, b.ComboMax, b.Sec, b.Kills, b.Tier, bonus, shard, best, dead, prev);
            Last = r;
            Finished?.Invoke(r);
            return r;
        }

        /// <summary>한 줄 — "이번 판 등급 A — 피격 3 · 연타 12 · 2:40".</summary>
        public static string Line(Result r) =>
            string.Format(StoryLocalization.T("runrank.line", "이번 판 등급 {0} — 피격 {1} · 연타 {2} · {3}:{4:00}"), r.Rank, r.Hits, r.ComboMax, r.Sec / 60, r.Sec % 60);

        /// <summary>둘째 줄 — 덤·최고 기록·쓰러짐(없으면 빈 글).</summary>
        public static string Line2(Result r)
        {
            var p = new System.Collections.Generic.List<string>();
            if (r.BonusExp > 0) p.Add(string.Format(StoryLocalization.T("runrank.bonus", "등급 덤 경험치 +{0}"), r.BonusExp));
            if (r.Shard > 0) p.Add(string.Format(StoryLocalization.T("runrank.shard", "🧩 기억 조각 +{0}"), r.Shard));
            if (r.Best) p.Add(r.PrevBest != null
                ? string.Format(StoryLocalization.T("runrank.best", "🏆 최고 기록 {0} → {1}"), r.PrevBest, r.Rank)
                : string.Format(StoryLocalization.T("runrank.first", "🏆 첫 기록 {0}"), r.Rank));
            if (r.Dead) p.Add(StoryLocalization.T("runrank.dead", "쓰러져 덤 없음"));
            return string.Join(" · ", p);
        }

        public static bool Active => _on;

        /// <summary>세이브 — 옛 세이브(null)는 빈 칸.</summary>
        public static void RestoreBest(string rank) => _best = !string.IsNullOrEmpty(rank) && rank.Length == 1 && Order.IndexOf(rank, StringComparison.Ordinal) >= 0 ? rank : "";

        /// <summary>진단 — 판 상태를 비운다(최고 기록은 그대로).</summary>
        public static void ClearForTest() { _on = false; Last = null; }
    }
}
