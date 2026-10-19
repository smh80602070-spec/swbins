using UnityEngine;
using Saga.Story.Data;

namespace Saga.EditorTools
{
    /// <summary>
    /// tasks U-0128 4종횡 판 등급 넓히기(웹 W-0289) 진단 — `PlaytestStorySlice` 가 무예 3택·판 등급(pick3) 뒤에 부른다(한 프레임 안).
    /// 여섯 줄: ① 0점 D·1점 C ② 처치 15 +1 ③ 급 5 면 시간·피격을 봐줌 ④ 쓰러진 판 = 등급은 매기되 덤 없음 ⑤ 살아 나온 판 덤(S 경험치 ×1.5 +
    /// 기억 조각 1 · A ×1.2) ⑥ 최고 기록(첫 기록·낮으면 그대로·높으면 갱신)·세이브 왕복·옛 세이브 빈 칸. 끝나면 세이브 JSON 을 시작 때로.
    /// </summary>
    public static class PlaytestStoryRunRank2
    {
        private const string T = "[PlaytestStorySlice] runrank2";
        private static bool _ok, _step;

        public static bool Run()
        {
            _ok = true;
            string json0 = StorySaveState.ToJson();
            try
            {
                // ① D
                Begin();
                if (StoryRunRank.RankOf(600f, 20, 0, 0, 1).Rank != "D") Fail("0점이 D 아님");
                if (StoryRunRank.RankOf(600f, 6, 0, 0, 1).Rank != "C") Fail("1점이 C 아님");
                End("d OK - 0점 D · 1점 C(S~B 문턱 그대로)");

                // ② 처치 15
                Begin();
                if (StoryRunRank.RankOf(400f, 9, 4, 14, 1).Pt != 0 || StoryRunRank.RankOf(400f, 9, 4, 15, 1).Rank != "C") Fail("처치 15 +1 아님");
                End("kills OK - 처치 15 마리면 +1(14 는 0)");

                // ③ 급
                Begin();
                var t1 = StoryRunRank.RankOf(420f, 5, 0, 0, 1);
                var t5 = StoryRunRank.RankOf(420f, 5, 0, 0, 5);
                if (t1.Rank != "C" || t5.Rank != "B" || t5.Tier != 5) Fail($"급 보정 1급 {t1.Rank}({t1.Pt}) · 5급 {t5.Rank}({t5.Pt})");
                End($"tier OK - 같은 판(420초·피격 5) 1급 {t1.Rank} → 5급 {t5.Rank}(시간 ×2·피격 +4 봐줌)");

                StoryRunRank.RestoreBest("");
                // ④ 쓰러짐
                Begin();
                int sh0 = StoryLabyrinthState.MemoryShards;
                var dead = Run(0, 20, 60f, true, 100f);
                if (!dead.HasValue || dead.Value.Rank != "S" || !dead.Value.Dead || dead.Value.BonusExp != 0 || dead.Value.Shard != 0 || StoryLabyrinthState.MemoryShards != sh0)
                    Fail($"쓰러진 판 {(dead.HasValue ? $"{dead.Value.Rank} 덤 {dead.Value.BonusExp} 조각 {dead.Value.Shard}" : "없음")}");
                else if (!StoryRunRank.Line2(dead.Value).Contains(StoryLocalization.T("runrank.dead", "쓰러져 덤 없음"))) Fail("둘째 줄에 쓰러짐 없음");
                End("dead OK - 쓰러진 판은 S 라도 덤 0·조각 0·둘째 줄 \"쓰러져 덤 없음\"");

                // ⑤ 덤
                Begin();
                var s = Run(0, 20, 60f, false, 100f);
                if (!s.HasValue || s.Value.Rank != "S" || s.Value.BonusExp != 200 || s.Value.Shard != 1 || StoryLabyrinthState.MemoryShards != sh0 + 1)
                    Fail($"S 덤 {(s.HasValue ? $"{s.Value.Rank} 경험치 {s.Value.BonusExp} 조각 {s.Value.Shard}" : "없음")} ≠ 200·1");
                var a = Run(2, 10, 60f, false, 100f);
                if (!a.HasValue || a.Value.Rank != "A" || a.Value.BonusExp != 80 || a.Value.Shard != 0) Fail($"A 덤 {(a.HasValue ? $"{a.Value.Rank} {a.Value.BonusExp}" : "없음")} ≠ 80");
                End("bonus OK - 살아 나온 판 판 경험치 400 → S +200·조각 +1 · A +80");

                // ⑥ 최고 기록·세이브
                Begin();
                StoryRunRank.RestoreBest("");
                var f = Run(2, 10, 60f, false, 0f);
                if (!f.HasValue || !f.Value.Best || f.Value.PrevBest != null || StoryRunRank.Best != "A") Fail("첫 기록이 안 남음");
                var lo = Run(9, 0, 600f, false, 0f);
                if (!lo.HasValue || lo.Value.Best || StoryRunRank.Best != "A") Fail($"낮은 판 {(lo.HasValue ? lo.Value.Rank : "-")} 이 최고 기록을 바꿈");
                var hi = Run(0, 20, 60f, false, 0f);
                if (!hi.HasValue || !hi.Value.Best || hi.Value.PrevBest != "A" || StoryRunRank.Best != "S") Fail("높은 판이 최고 기록을 안 바꿈");
                else if (!StoryRunRank.Line2(hi.Value).Contains("A → S")) Fail($"둘째 줄 {StoryRunRank.Line2(hi.Value)}");
                string j = StorySaveState.ToJson();
                StoryRunRank.RestoreBest("");
                StorySaveState.ApplyJson(j);
                if (StoryRunRank.Best != "S") Fail($"세이브 왕복 최고 기록 {StoryRunRank.Best}");
                StorySaveState.ApplyJson(System.Text.RegularExpressions.Regex.Replace(j, ",\"rankBest\":\"[^\"]*\"", ""));
                if (StoryRunRank.Best != "") Fail("옛 세이브(칸 없음)에 최고 기록이 남음");
                End("best OK - 첫 기록·낮은 판 그대로·높은 판 A → S·세이브 왕복·옛 세이브 빈 칸");
            }
            finally
            {
                StoryRunRank.ClearForTest();
                StorySaveState.ApplyJson(json0);
            }
            return _ok;
        }

        /// <summary>판 하나 — 피격 hits · 최대 연타 combo · sec 초 · 처치 넷(잡몹 셋 + 마지막) · 마리마다 경험치 exp.</summary>
        private static StoryRunRank.Result? Run(int hits, int combo, float sec, bool dead, float exp)
        {
            StoryRunRank.ClearForTest();
            for (int i = 0; i < combo; i++) StoryRunRank.OnHit(0f);
            for (int i = 0; i < hits; i++) { StoryRunRank.OnHurt(); StoryRunRank.OnHit(0f); }
            for (int i = 0; i < 3; i++) StoryRunRank.OnKill(false, 1f, exp);
            if (dead) { StoryRunRank.OnKill(false, 1f, exp); return StoryRunRank.Finish(sec, dead: true); }
            StoryRunRank.OnKill(true, sec, exp);
            return StoryRunRank.Last;
        }

        private static void Begin() => _step = true;
        private static void End(string line) { if (_step) Debug.Log($"{T} {line}"); }

        private static void Fail(string msg)
        {
            Debug.LogError($"{T}: {msg}");
            _ok = false;
            _step = false;
        }
    }
}
