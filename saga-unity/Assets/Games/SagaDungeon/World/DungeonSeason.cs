using System;
using System.Collections.Generic;
using UnityEngine;
using Saga.Dungeon.Data;

namespace Saga.Dungeon.World
{
    /// <summary>
    /// tasks U-0195 2나락 로컬 시즌·래더(고돗 G-0334 `dungeon_season.gd` 짝, 웹 짝 없음 — 디아블로·PoE 시즌 구조만, 서버 없음) — 한 판 등급(<see cref="DungeonRunRank"/>) 위에.
    /// 시즌 = 한 주(월요일 0시, 이 기기 시계) · 번호 = 1970-01-01 부터 날 수 + 3 을 7 로 나눈 몫(그날이 목요일). 살아 나온 등급 판만 (D1·C2·B3·A4·S5) × 급(1~5) 점,
    /// 이번 시즌 좋은 판 <see cref="Keep"/> 개 합 = 시즌 점수 → 🥉 청동 10·🥈 백은 25·🥇 황금 45·💎 백금 70·👑 왕좌 100.
    /// 넘어감 = 판을 기록할 때·게임을 켤 때·창을 열 때 번호가 **커졌으면** 지난 시즌을 닫는다 — 닿은 단계 금 100·300·700·1500·3000, 지난 기록 넷, 래더 비움.
    /// 번호가 줄면(시계를 뒤로) 아무것도 안 한다(고돗 R-5 2803703e — 앞뒤로 돌려 덤을 거듭 받던 구멍). 처음 켠 기기는 번호만 잡는다(덤 없음).
    /// </summary>
    public static class DungeonSeason
    {
        public const int Keep = 5, PastKeep = 4;
        private const string Order = "DCBAS";
        public static readonly int[] Need = { 10, 25, 45, 70, 100 };
        public static readonly string[] TierKo = { "청동", "백은", "황금", "백금", "왕좌" };
        public static readonly string[] TierEmoji = { "🥉", "🥈", "🥇", "💎", "👑" };
        public static readonly int[] Gold = { 100, 300, 700, 1500, 3000 };

        /// <summary>끄면 기록·넘어감 없음(고돗 `SAGA_SEASON=0` 짝).</summary>
        public static bool On = true;
        /// <summary>진단 — 오늘(null = 기기 시계).</summary>
        public static DateTime? NowForTest;

        [Serializable] public class Run { public int pts; public string rank; public int tier; }
        [Serializable] public class Past { public int id; public int score; public int tierIdx; }
        [Serializable] private class Store { public int id = -1; public List<Run> runs = new List<Run>(); public List<Past> past = new List<Past>(); }

        private static Store _s = new Store();

        /// <summary>마지막 기록 줄(판 등급 알림 셋째 줄) — 쓰러진 판·끔이면 빈 글.</summary>
        public static string LastLine { get; private set; } = "";

        public static int IdOf(DateTime d) => ((int)(d.Date - new DateTime(1970, 1, 1)).TotalDays + 3) / 7;
        public static int NowId => IdOf(NowForTest ?? DateTime.Now);
        public static int Id => _s.id;
        public static IReadOnlyList<Run> Runs => _s.runs;
        public static IReadOnlyList<Past> PastSeasons => _s.past;

        public static int PtsOf(string rank, int tier) => (Order.IndexOf(rank ?? "", StringComparison.Ordinal) + 1) * Mathf.Clamp(tier, 1, 5);

        public static int Score { get { int n = 0; foreach (var r in _s.runs) n += r.pts; return n; } }

        /// <summary>점수 → 단계(−1 = 아직 없음).</summary>
        public static int TierIdx(int score) { int t = -1; for (int i = 0; i < Need.Length; i++) if (score >= Need[i]) t = i; return t; }

        public static string TierName(int idx) => idx < 0 ? DungeonLocalization.T("season.none", "단계 없음") : TierEmoji[idx] + " " + DungeonLocalization.T("season.tier" + idx, TierKo[idx]);

        /// <summary>번호가 커졌으면 지난 시즌을 닫는다 — 받은 금(없으면 0)과 알림 줄. 번호가 같거나 줄면 아무것도 안 함.</summary>
        public static int Roll(out string line)
        {
            line = "";
            if (!On) return 0;
            int now = NowId;
            if (_s.id < 0) { _s.id = now; return 0; }
            if (now <= _s.id) return 0;
            int score = Score, t = TierIdx(score), gold = t >= 0 ? Gold[t] : 0;
            _s.past.Insert(0, new Past { id = _s.id, score = score, tierIdx = t });
            if (_s.past.Count > PastKeep) _s.past.RemoveRange(PastKeep, _s.past.Count - PastKeep);
            _s.runs.Clear();
            _s.id = now;
            if (gold > 0) HeroState.AddGold(gold);
            line = t >= 0
                ? string.Format(DungeonLocalization.T("season.closed", "🏆 지난 시즌 {0}({1}점) — 금 +{2} · 새 시즌"), TierName(t), score, gold)
                : string.Format(DungeonLocalization.T("season.closed_none", "🏆 지난 시즌 {0}점 — 단계 없음 · 새 시즌"), score);
            return gold;
        }

        /// <summary>살아 나온 등급 판 하나 — 넘어감 먼저, 그다음 래더(좋은 판 다섯). 알림 줄을 <see cref="LastLine"/> 에.</summary>
        public static string Record(string rank, int tier)
        {
            LastLine = "";
            if (!On) return "";
            Roll(out string rolled);
            int before = TierIdx(Score);
            int pts = PtsOf(rank, tier);
            _s.runs.Add(new Run { pts = pts, rank = rank, tier = tier });
            _s.runs.Sort((a, b) => b.pts.CompareTo(a.pts));
            if (_s.runs.Count > Keep) _s.runs.RemoveRange(Keep, _s.runs.Count - Keep);
            int score = Score, after = TierIdx(score);
            string next = after >= Need.Length - 1 ? "" : string.Format(DungeonLocalization.T("season.next", " · {0}까지 {1}"), TierName(after + 1), Need[after + 1] - score);
            LastLine = (rolled.Length > 0 ? rolled + "\n" : "")
                + string.Format(DungeonLocalization.T("season.line", "🏅 시즌 +{0}점 → {1}점 {2}{3}"), pts, score, after > before ? TierName(after) + "!" : TierName(after), next);
            return LastLine;
        }

        /// <summary>쓰러진 판 — 시즌 줄 없음.</summary>
        public static void Skip() => LastLine = "";

        public static string Snapshot() => JsonUtility.ToJson(_s);

        public static void Restore(string json)
        {
            Store s = null;
            if (!string.IsNullOrEmpty(json)) { try { s = JsonUtility.FromJson<Store>(json); } catch (ArgumentException) { s = null; } }
            _s = s ?? new Store();
            _s.runs = (_s.runs ?? new List<Run>()).FindAll(r => r != null && r.pts > 0);
            _s.past = _s.past ?? new List<Past>();
            if (_s.runs.Count > Keep) _s.runs.RemoveRange(Keep, _s.runs.Count - Keep);
            if (_s.past.Count > PastKeep) _s.past.RemoveRange(PastKeep, _s.past.Count - PastKeep);
            LastLine = "";
        }

        public static void ResetForTest() => Restore(null);
    }
}
