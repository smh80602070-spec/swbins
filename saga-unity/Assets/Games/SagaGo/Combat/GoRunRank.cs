using System;
using System.Collections.Generic;
using UnityEngine;
using Saga.Go.Data;

namespace Saga.Go.Combat
{
    /// <summary>
    /// tasks U-0174 — 웹 사가만리 W-0379 `go-rank.js` · 고돗 G-0313 `go_rank.gd` "무리 토벌 한 판 등급"의 이 트랙 판.
    /// 들판 무리(`FieldSpawner` 무리 id — 수호장·숨은 터·이야기·인물은 안 셈) 하나를 첫 타격부터 무리 전원이 한꺼번에 쓰러질 때까지 한 판으로 세어 S~D.
    /// 무리마다 따로 센다(고돗과 같음 — 웹의 "두 무리면 한 판" 한계 없음). 맞붙지 않은 채 <see cref="IdleSec"/>초면 버림 · 전멸(`FieldCombat.Wiped`)이면 버림.
    /// 식은 4종횡 `StoryRunRank` 사본(트랙 안 판끼리 코드 공유 없음): 급 t — 피격 0/≤3+(t−1)/≤8+2(t−1) → 3/2/1 · 연타 ≥20/≥10/≥5 → 3/2/1 ·
    /// 시간 ≤180·360초×(1+0.25(t−1)) → 2/1 · 처치 ≥15 → +1 · 7↑ S · 5↑ A · 3↑ B · 1↑ C · 0 D. 급 = 무리 한가운데 지역 위험도(1~3, 웹 거리 등급 자리).
    /// **이 트랙 다름**: 들판 적은 금을 안 떨군다(경험만) → 덤 = 그 판에 쓰러뜨린 적 경험 합 × S 0.5·A 0.2·B 0.1 을 경험으로. 웹 S 단사 덤은 단사가 없어 뺌(고돗과 같음).
    /// 장판·소환·바람 자리 틱(<see cref="FieldCombat.ZoneTicking"/>)은 판을 열기만 하고 연타로 안 센다(웹 'zone'·고돗 dot 와 같은 결). 최고 기록은 무리별(세이브 `rankCamps`·`rankGrades`).
    /// </summary>
    public static class GoRunRank
    {
        public const float IdleSec = 20f;
        public const int KillBonusAt = 15;
        public static bool On = true;
        private static readonly string Order = "DCBAS";

        public readonly struct Result
        {
            public readonly string Camp, Rank, PrevBest;
            public readonly int Pt, Hits, ComboMax, Sec, Kills, Tier, Bonus;
            public readonly bool Best;
            public Result(string camp, string rank, int pt, int hits, int comboMax, int sec, int kills, int tier, int bonus = 0, bool best = false, string prevBest = null)
            {
                Camp = camp; Rank = rank; Pt = pt; Hits = hits; ComboMax = comboMax; Sec = sec; Kills = kills; Tier = tier;
                Bonus = bonus; Best = best; PrevBest = prevBest;
            }
        }

        private class Run { public float T0, Last; public int Hits, Combo, ComboMax, Kills, Exp; }

        private static readonly Dictionary<string, Run> _runs = new Dictionary<string, Run>();
        private static readonly Dictionary<string, string> _best = new Dictionary<string, string>();
        private static HashSet<string> _camps;
        private static bool _hooked;

        /// <summary>진단 — 시각을 붙든다(null 이면 Time.time).</summary>
        public static float? NowForTest;
        private static float Now => NowForTest ?? Time.time;

        public static Result? Last { get; private set; }
        public static bool Counting(string camp) => camp != null && _runs.ContainsKey(camp);

        public static bool IsCamp(string groupId)
        {
            if (_camps == null)
            {
                _camps = new HashSet<string>();
                foreach (var g in FieldSpawner.GroupMembers()) _camps.Add(g.id);
            }
            return groupId != null && _camps.Contains(groupId);
        }

        /// <summary>`FieldSpawner.Start` 가 부른다 — 정적 사건이라 한 번만 건다.</summary>
        public static void Hook()
        {
            if (_hooked) return;
            _hooked = true;
            FieldEnemy.Struck += OnStruck;
            FieldEnemy.Killed += OnKilled;
            FieldCombat.Wiped += OnWiped;
        }

        /// <summary>급 1~5 → 등급. **순수 함수**(4종횡 식 그대로).</summary>
        public static Result RankOf(string camp, float sec, int hits, int comboMax, int kills, int tier)
        {
            int t = Mathf.Clamp(tier, 1, 5);
            float tm = 1f + 0.25f * (t - 1);
            int pt = (hits == 0 ? 3 : hits <= 3 + (t - 1) ? 2 : hits <= 8 + 2 * (t - 1) ? 1 : 0)
                   + (comboMax >= 20 ? 3 : comboMax >= 10 ? 2 : comboMax >= 5 ? 1 : 0)
                   + (sec <= 180f * tm ? 2 : sec <= 360f * tm ? 1 : 0)
                   + (kills >= KillBonusAt ? 1 : 0);
            string rank = pt >= 7 ? "S" : pt >= 5 ? "A" : pt >= 3 ? "B" : pt >= 1 ? "C" : "D";
            return new Result(camp, rank, pt, hits, comboMax, Mathf.RoundToInt(sec), kills, t);
        }

        public static float BonusMul(string rank) => rank == "S" ? 0.5f : rank == "A" ? 0.2f : rank == "B" ? 0.1f : 0f;
        public static bool Better(string a, string b) => Order.IndexOf(a ?? "", StringComparison.Ordinal) > Order.IndexOf(b ?? "", StringComparison.Ordinal);
        public static string BestOf(string camp) => camp != null && _best.TryGetValue(camp, out var r) ? r : "";

        /// <summary>무리 급 = 한가운데 지역 위험도.</summary>
        public static int TierOf(string camp)
        {
            string region = FieldSpawner.GroupRegion(camp);
            return region == null ? 1 : Mathf.Clamp(GoWorldMap.DangerOf(region), 1, 5);
        }

        /// <summary>오래 멍한 판을 버린다.</summary>
        private static void Prune(float now)
        {
            List<string> drop = null;
            foreach (var kv in _runs) if (now - kv.Value.Last > IdleSec) (drop ??= new List<string>()).Add(kv.Key);
            if (drop != null) foreach (var k in drop) _runs.Remove(k);
        }

        /// <summary>내 쪽 타격 하나(`FieldEnemy.TakeHit`) — 그 무리 판이 없으면 연다.</summary>
        public static void OnStruck(FieldEnemy e)
        {
            if (!On || e == null || !IsCamp(e.GroupId)) return;
            float now = Now;
            Prune(now);
            if (!_runs.TryGetValue(e.GroupId, out var r)) _runs[e.GroupId] = r = new Run { T0 = now };
            r.Last = now;
            if (FieldCombat.ZoneTicking) return;
            r.Combo++;
            if (r.Combo > r.ComboMax) r.ComboMax = r.Combo;
        }

        /// <summary>내 편이 실제로 피해를 받음(`FieldCombat.ReceiveStrike`, 다 막으면 안 옴) — 세던 판 모두에.</summary>
        public static void OnHurt()
        {
            if (!On || _runs.Count == 0) return;
            float now = Now;
            Prune(now);
            foreach (var r in _runs.Values) { r.Hits++; r.Combo = 0; r.Last = now; }
        }

        /// <summary>쓰러짐 — 그 무리가 한꺼번에 다 쓰러졌으면 판을 닫는다(덤·기록·알림).</summary>
        public static void OnKilled(FieldEnemy e)
        {
            if (!On || e == null || !_runs.TryGetValue(e.GroupId ?? "", out var r)) return;
            float now = Now;
            r.Kills++;
            r.Exp += e.ExpReward;
            r.Last = now;
            if (!FieldSpawner.GroupWiped(e.GroupId)) return;
            var res = Finish(e.GroupId, now);
            if (res.HasValue) Saga.Go.UI.DialogueLabel.Instance?.Show(Text(res.Value), 4f);
        }

        /// <summary>전멸 — 세던 것 모두 버림.</summary>
        public static void OnWiped() => _runs.Clear();

        private static Result? Finish(string camp, float now)
        {
            if (!_runs.TryGetValue(camp, out var r)) return null;
            _runs.Remove(camp);
            int tier = TierOf(camp);
            var b = RankOf(camp, now - r.T0, r.Hits, r.ComboMax, r.Kills, tier);
            int bonus = Mathf.RoundToInt(r.Exp * BonusMul(b.Rank));
            if (bonus > 0) PlayerStats.AddExp(bonus);
            string prev = BestOf(camp);
            if (prev == "") prev = null;
            bool best = prev == null || Better(b.Rank, prev);
            if (best) _best[camp] = b.Rank;
            var res = new Result(camp, b.Rank, b.Pt, b.Hits, b.ComboMax, b.Sec, b.Kills, tier, bonus, best, prev);
            Last = res;
            return res;
        }

        /// <summary>"★ 토벌 등급 A — 피격 1 · 연타 14 · 0:42"</summary>
        public static string Line(Result r) =>
            string.Format(GoLocalization.T("rank.line", "★ 토벌 등급 {0} — 피격 {1} · 연타 {2} · {3}:{4:00}"), r.Rank, r.Hits, r.ComboMax, r.Sec / 60, r.Sec % 60);

        /// <summary>둘째 줄 — 덤·최고 기록(없으면 빈 글).</summary>
        public static string Line2(Result r)
        {
            var p = new List<string>();
            if (r.Bonus > 0) p.Add(string.Format(GoLocalization.T("rank.bonus", "등급 덤 경험 +{0}"), r.Bonus));
            if (r.Best) p.Add(r.PrevBest != null
                ? string.Format(GoLocalization.T("rank.best", "🏆 최고 기록 {0} → {1}"), r.PrevBest, r.Rank)
                : string.Format(GoLocalization.T("rank.first", "🏆 첫 기록 {0}"), r.Rank));
            return string.Join(" · ", p);
        }

        public static string Text(Result r)
        {
            string l2 = Line2(r);
            return Line(r) + (l2.Length > 0 ? "\n" + l2 : "");
        }

        // ── 세이브(버전 그대로 — 옛 세이브는 null → 빈 기록)
        public static List<string> SnapshotCamps() => new List<string>(_best.Keys);
        public static List<string> SnapshotGrades(List<string> camps) { var a = new List<string>(); foreach (var c in camps) a.Add(_best[c]); return a; }

        public static void Restore(List<string> camps, List<string> grades)
        {
            _best.Clear();
            _runs.Clear();
            if (camps == null || grades == null) return;
            for (int i = 0; i < camps.Count && i < grades.Count; i++)
            {
                string g = grades[i];
                if (string.IsNullOrEmpty(camps[i]) || string.IsNullOrEmpty(g) || g.Length != 1 || Order.IndexOf(g, StringComparison.Ordinal) < 0) continue;
                _best[camps[i]] = g;
            }
        }

        /// <summary>진단 — 세던 판을 비운다(최고 기록은 그대로).</summary>
        public static void ClearForTest() { _runs.Clear(); Last = null; }
    }
}
