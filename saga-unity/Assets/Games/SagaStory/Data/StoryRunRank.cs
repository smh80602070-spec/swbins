using System;
using UnityEngine;

namespace Saga.Story.Data
{
    /// <summary>
    /// tasks U-0093 — 웹 사가종횡 W-0104 "사냥터 한 판 결과 등급"(던파의 판 등급, `js/runrank.js`)의 이 트랙 판.
    /// 이 트랙엔 사냥터가 하나라 **판** = 지난 판 끝(첫 타격·두목 처치·쓰러짐) 뒤 첫 타격부터 다음 **두목 처치** 또는 **쓰러짐**까지.
    /// 등급은 순수 함수 <see cref="RankOf"/>(웹 식 그대로): 피격 0/≤3/≤8 → 3/2/1 · 최대 연타 ≥20/≥10/≥5 → 3/2/1 · 시간 ≤180/≤360초 → 2/1,
    /// 합 7↑ S · 5↑ A · 3↑ B · 그 밖 C. 연타 = 타격마다 +1, 맞으면 0(웹도 콤보가 원래 없어 이렇게 셈). 처치 3 미만 판은 등급 없음. 세이브 안 함.
    /// </summary>
    public static class StoryRunRank
    {
        public const int MinKills = 3;

        public readonly struct Result
        {
            public readonly string Rank;
            public readonly int Pt, Hits, ComboMax, Sec;
            public Result(string rank, int pt, int hits, int comboMax, int sec) { Rank = rank; Pt = pt; Hits = hits; ComboMax = comboMax; Sec = sec; }
        }

        private static bool _on;
        private static float _t0;
        private static int _hits, _combo, _comboMax, _kills;

        /// <summary>판이 닫힐 때(등급 있을 때만) — 화면 한 줄은 GameBootstrap 이 띄운다.</summary>
        public static event Action<Result> Finished;
        public static Result? Last { get; private set; }

        /// <summary>통계 → 등급. **순수 함수**(웹 rankOf 그대로).</summary>
        public static Result RankOf(float sec, int hits, int comboMax)
        {
            int pt = (hits == 0 ? 3 : hits <= 3 ? 2 : hits <= 8 ? 1 : 0)
                   + (comboMax >= 20 ? 3 : comboMax >= 10 ? 2 : comboMax >= 5 ? 1 : 0)
                   + (sec <= 180f ? 2 : sec <= 360f ? 1 : 0);
            string rank = pt >= 7 ? "S" : pt >= 5 ? "A" : pt >= 3 ? "B" : "C";
            return new Result(rank, pt, hits, comboMax, Mathf.RoundToInt(sec));
        }

        /// <summary>내 쪽 타격 하나(적이 피해를 받음) — 판이 없으면 연다.</summary>
        public static void OnHit(float now)
        {
            if (!_on) { _on = true; _t0 = now; _hits = 0; _combo = 0; _comboMax = 0; _kills = 0; }
            _combo++;
            if (_combo > _comboMax) _comboMax = _combo;
        }

        public static void OnHurt()
        {
            if (!_on) return;
            _hits++;
            _combo = 0;
        }

        /// <summary>처치 — 두목이면 판을 닫는다.</summary>
        public static void OnKill(bool boss, float now)
        {
            if (!_on) return;
            _kills++;
            if (boss) Finish(now);
        }

        /// <summary>판을 닫는다(쓰러짐·두목 처치) — 등급이 나오면 <see cref="Finished"/>.</summary>
        public static Result? Finish(float now)
        {
            if (!_on) return null;
            _on = false;
            if (_kills < MinKills) return null;
            var r = RankOf(now - _t0, _hits, _comboMax);
            Last = r;
            Finished?.Invoke(r);
            return r;
        }

        /// <summary>한 줄 — "⭐ 이번 판 등급 A — 피격 3 · 연타 12 · 2:40".</summary>
        public static string Line(Result r) =>
            string.Format(StoryLocalization.T("runrank.line", "이번 판 등급 {0} — 피격 {1} · 연타 {2} · {3}:{4:00}"), r.Rank, r.Hits, r.ComboMax, r.Sec / 60, r.Sec % 60);

        public static bool Active => _on;

        /// <summary>진단 — 판 상태를 비운다.</summary>
        public static void ClearForTest() { _on = false; Last = null; }
    }
}
