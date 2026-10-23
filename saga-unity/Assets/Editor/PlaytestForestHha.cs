using System;
using UnityEngine;
using Saga.Forest.Data;

namespace Saga.EditorTools
{
    /// <summary>
    /// tasks U-0189 집 꾸미기 계절 심사(고돗 G-0330 짝) 진단 — `PlaytestForestHeadless` 가 물약(brew) 뒤에 부른다(한 프레임 안, 날짜는 넣는다).
    /// ① 계절·열쇠(3~5 봄 … · 12월 = 다음 해 겨울) ② 주제 덤(그 계절 갈래 하나 +25·둘 +40·다른 갈래 0) ③ 별·열매(문턱 30·80·160·280·450 · 별 × 8 · 같은 계절 다시 = 차이만 · 새 계절 = 처음부터)
    /// ④ 알림 줄 ⑤ 세이브 칸·왕복·옛 세이브 ⑥ 손잡이. 끝나면 가구 배치·열매·심사 기록을 시작 때로.
    /// </summary>
    public static class PlaytestForestHha
    {
        private const string T = "[PlaytestForestHeadless] hha";
        private static bool _ok, _step;

        public static bool Run()
        {
            _ok = true;
            int fruit0 = ForestState.FruitCount;
            var (px, py, pid) = ForestHomeState.SnapshotPlacements();
            string hha0 = ForestHha.Snapshot();
            try
            {
                ForestHha.ResetForTest();
                ForestHha.TodayForTest = new DateTime(2026, 10, 15);

                // ① 계절
                Begin();
                int[] months = { 1, 2, 3, 5, 6, 8, 9, 11, 12 };
                int[] want = { 3, 3, 0, 0, 1, 1, 2, 2, 3 };
                for (int i = 0; i < months.Length; i++) if (ForestHha.SeasonOf(months[i]) != want[i]) Fail($"{months[i]}월 계절 {ForestHha.SeasonOf(months[i])} ≠ {want[i]}");
                if (ForestHha.KeyOf(new DateTime(2026, 12, 20)) != ForestHha.KeyOf(new DateTime(2027, 1, 5))) Fail("12월이 다음 해 겨울 열쇠가 아님");
                if (ForestHha.KeyOf(new DateTime(2026, 2, 20)) == ForestHha.KeyOf(new DateTime(2027, 1, 5))) Fail("다른 해 겨울이 같은 열쇠");
                End("season OK - 3~5 봄·6~8 여름·9~11 가을·12~2 겨울 · 12월 = 다음 해 겨울 열쇠");

                // ② 주제 덤(10월 = 가을 = 사랑방)
                Begin();
                Place();
                int b0 = ForestHha.Judge().Bonus;
                Place("bangseok");                       // 안방 — 덤 없음
                int bOther = ForestHha.Judge().Bonus;
                Place("bangseok", "jokja");              // 사랑방 하나
                int b1 = ForestHha.Judge().Bonus;
                Place("bangseok", "jokja", "seoan");     // 사랑방 둘
                int b2 = ForestHha.Judge().Bonus;
                if (b0 != 0 || bOther != 0 || b1 != ForestHha.ThemeOne || b2 != ForestHha.ThemeTwo) Fail($"덤 빈 {b0}·다른 {bOther}·하나 {b1}·둘 {b2}");
                End($"theme OK - 가을 사랑방: 빈 0·안방만 0·하나 +{b1}·둘 +{b2}");

                // ③ 별·열매
                Begin();
                if (ForestHha.Stars(29) != 0 || ForestHha.Stars(30) != 1 || ForestHha.Stars(160) != 3 || ForestHha.Stars(9999) != 5) Fail("별 문턱");
                ForestHha.ResetForTest();
                ForestState.Restore(0);
                Place("jokja");                          // 1200/50 + 2 + 25 = 51 → ★1
                var r1 = ForestHha.Judge();
                var r1b = ForestHha.Judge();
                Place("jokja", "seoan", "mungab", "badukpan", "byeongpung", "geomungo"); // 사랑방 여섯 — 계열 +45·덤 +40
                var r2 = ForestHha.Judge();
                int paid = ForestState.FruitCount;
                if (r1.Stars != 1 || r1.Paid != 8 || r1b.Paid != 0) Fail($"첫 심사 ★{r1.Stars}·{r1.Paid} / 다시 {r1b.Paid}");
                if (r2.Stars <= r1.Stars || r2.Paid != (r2.Stars - r1.Stars) * ForestHha.FruitPerStar || paid != r2.Stars * ForestHha.FruitPerStar) Fail($"오름 ★{r2.Stars}·{r2.Paid} · 열매 합 {paid}");
                ForestHha.TodayForTest = new DateTime(2027, 1, 10);   // 겨울 — 새 계절, 주제 안방
                var r3 = ForestHha.Judge();
                if (r3.Season != 3 || r3.Bonus != 0 || r3.Paid != r3.Stars * ForestHha.FruitPerStar) Fail($"새 계절 ★{r3.Stars}·{r3.Paid}·덤 {r3.Bonus}");
                End($"stars OK - ★{r1.Stars} 열매 +{r1.Paid} · 다시 0 · 사랑방 여섯 ★{r2.Stars}(차이 +{r2.Paid}) · 겨울 새 계절 ★{r3.Stars} +{r3.Paid}(주제 안방이라 덤 0)");

                // ④ 알림 줄
                Begin();
                string line = ForestHha.Line(r2);
                if (!line.Contains("★") || !line.Contains(r2.Score.ToString()) || !line.Contains("+" + r2.Paid)) Fail($"줄「{line}」");
                End($"line OK「{line}」");

                // ⑤ 세이브
                Begin();
                string snap = ForestHha.Snapshot();
                if (!ForestSaveState.ToJson().Contains("\"hhaJson\"")) Fail("세이브에 hhaJson 없음");
                ForestHha.Restore(null);
                if (ForestHha.BestNow != 0) Fail("옛 세이브인데 받은 별");
                ForestHha.Restore(snap);
                if (ForestHha.BestNow != r3.Stars) Fail($"세이브 왕복 {ForestHha.BestNow} ≠ {r3.Stars}");
                End("save OK - hhaJson 왕복(계절 열쇠·받은 별)·옛 세이브 0");

                // ⑥ 손잡이
                Begin();
                ForestHha.On = false;
                ForestHha.ResetForTest();
                int f = ForestState.FruitCount;
                var r4 = ForestHha.Judge();
                if (r4.Paid != 0 || ForestState.FruitCount != f) Fail("껐는데 열매");
                End("off OK - 손잡이 끄면 심사·열매 없음");
            }
            finally
            {
                ForestHha.On = true;
                ForestHha.TodayForTest = null;
                ForestHomeState.RestorePlacements(px, py, pid);
                ForestHha.Restore(hha0);
                ForestState.Restore(fruit0);
            }
            return _ok;
        }

        /// <summary>집 안 칸에 이 가구들을 차례로(앞 줄부터) — 나머지는 비운다.</summary>
        private static void Place(params string[] ids)
        {
            var xs = new int[ids.Length]; var ys = new int[ids.Length];
            for (int i = 0; i < ids.Length; i++) { xs[i] = -2 + i % 5; ys[i] = -1 + i / 5; }
            ForestHomeState.RestorePlacements(xs, ys, ids);
        }

        private static void Begin() => _step = true;
        private static void End(string line) { if (_step) Debug.Log($"{T} {line}"); }

        private static void Fail(string why)
        {
            _ok = false;
            _step = false;
            Debug.LogError($"{T} FAIL - {why}");
        }
    }
}
