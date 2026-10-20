using UnityEngine;
using Saga.Forest.Data;
using Saga.Forest.World;

namespace Saga.EditorTools
{
    /// <summary>
    /// tasks U-0143 관계 하트(웹 village-folk.js) 진단 — `PlaytestForestHeadless` 입주 조건(movein) 뒤에 부른다(한 프레임 안, 날짜는 강제).
    /// ① 하루 상한 +4·벌은 상한 없음·다음 날 다시 ② 말 걸기 하루 한 번 +1 ③ 0~10 묶음·문턱 꼬리 ④ 숲지기 실제 말: +1·5♥ 고유 대화·10♥ 기념품 한 번(과일 +80)
    /// ⑤ 여우 화상 부탁(사기) 완수 +2 ⑥ 눌러앉은 손님 선물 뒤 5♥ 고유 대화 ⑦ 세이브 왕복·옛 세이브(null) 0.
    /// 끝나면 하트·손님 기록·단골·사연·열매·날짜를 시작 때로.
    /// </summary>
    public static class PlaytestForestHearts
    {
        private const string T = "[PlaytestForestHeadless] hearts";
        private static bool _ok, _step;

        public static bool Run()
        {
            _ok = true;
            string hearts0 = ForestHearts.Snapshot();
            int fruit0 = ForestState.FruitCount;
            var rec0 = ForestVisitors.Snapshot();
            var b = ForestVisitors.SnapshotBonds();
            string[] stories0 = ForestVisitors.SnapshotStories();
            var stock0 = ForestHomeState.SnapshotStock(); // 여우에게 산 가구
            const int D = 91000;
            try
            {
                ForestHearts.ResetForTest();
                ForestVisitors.ForceDayForTest(D);
                ForestFestivalState.ForceDayForTest(15); // 세배(1일) 아닌 날

                // ① 하루 상한
                Begin();
                if (ForestHearts.Bump("x", 3) != 3 || ForestHearts.Bump("x", 3) != 1 || ForestHearts.Of("x") != 4) Fail($"하루 상한 4 — {ForestHearts.Of("x")}");
                if (ForestHearts.Bump("x", -2) != -2 || ForestHearts.Of("x") != 2) Fail("벌이 상한에 걸림");
                if (ForestHearts.Bump("x", 1) != 0) Fail("상한 뒤 또 오름");
                ForestVisitors.ForceDayForTest(D + 1);
                if (ForestHearts.Bump("x", 3) != 3 || ForestHearts.Of("x") != 5) Fail("다음 날 다시 안 오름");
                End("cap OK - 하루 +4 상한·벌은 상한 없음·다음 날 다시");

                // ② 말 걸기 하루 한 번
                Begin();
                if (ForestHearts.Talk("y") != 1 || ForestHearts.Talk("y") != 0) Fail("말 걸기 하루 두 번");
                ForestVisitors.ForceDayForTest(D + 2);
                if (ForestHearts.Talk("y") != 1 || ForestHearts.Of("y") != 2) Fail("다음 날 말 걸기");
                End("talk OK - 하루 한 번 +1");

                // ③ 묶음·꼬리
                Begin();
                for (int d = 0; d < 4; d++) { ForestVisitors.ForceDayForTest(D + 10 + d); ForestHearts.Bump("z", 4); }
                if (ForestHearts.Of("z") != ForestHearts.Max) Fail($"상한 10 넘음 {ForestHearts.Of("z")}");
                if (ForestHearts.Next("z") != null || !ForestHearts.Tail("z").Contains("10/10")) Fail("가득인데 다음 문턱");
                var n = ForestHearts.Next("y");
                if (n == null || n.Value.At != 3 || !ForestHearts.Tail("y").Contains("3♥")) Fail($"2♥ 다음 문턱 {ForestHearts.Tail("y")}");
                End("bounds OK - 0~10·문턱 3·5·7·10 꼬리");

                // ④ 숲지기 실제 말
                Begin();
                var keeper = Object.FindFirstObjectByType<ForestVillager>();
                if (keeper == null) Fail("숲지기 없음");
                else
                {
                    ForestVisitors.ForceDayForTest(D + 20);
                    ForestHearts.Bump(ForestHearts.KeeperId, 4);
                    ForestVisitors.ForceDayForTest(D + 21);
                    string l = keeper.Talk();
                    if (ForestHearts.Of(ForestHearts.KeeperId) != 5 || !l.Contains("5/10") || !l.Contains(ForestHearts.UniqLine(ForestHearts.KeeperId) ?? "@@")) Fail($"숲지기 5♥ 고유 대화 — {l}");
                    for (int d = 0; d < 2; d++) { ForestVisitors.ForceDayForTest(D + 22 + d); ForestHearts.Bump(ForestHearts.KeeperId, 4); }
                    ForestVisitors.ForceDayForTest(D + 24);
                    ForestState.Restore(0);
                    l = keeper.Talk();
                    if (!ForestHearts.HasMemento(ForestHearts.KeeperId) || ForestState.FruitCount != ForestHearts.MementoFruit) Fail($"10♥ 기념품 — 과일 {ForestState.FruitCount} · {l}");
                    keeper.Talk();
                    if (ForestState.FruitCount != ForestHearts.MementoFruit) Fail("기념품이 두 번");
                }
                End("keeper OK - 말 +1·5♥ 고유 대화·10♥ 기념품 한 번(과일 +80)");

                // ⑤ 여우 화상 — 부탁(사기) 완수 +2
                Begin();
                int fd = D + 30;
                while (ForestVisitors.WhoOn(fd).Key != "fox" && fd < D + 400) fd++;
                ForestVisitors.ForceDayForTest(fd);
                ForestVisitors.ResetForTest();
                ForestState.Restore(100000);
                ForestVisitors.Talk(); // 물건 권함
                int fox0 = ForestHearts.Of("fox");
                ForestVisitors.Talk(); // 삼
                if (!ForestVisitors.Rec.Done || ForestHearts.Of("fox") != fox0 + 2) Fail($"부탁 완수 하트 {ForestHearts.Of("fox") - fox0} ≠ 2");
                End("done OK - 손님 부탁 완수 +2");

                // ⑥ 눌러앉은 손님 — 선물 뒤 5♥ 고유 대화
                Begin();
                ForestVisitors.RestoreBonds(null, null, new[] { "sailor" }, int.MinValue, null, false);
                ForestVisitors.RestoreStories(new[] { "sailor" });
                ForestVisitors.ForceDayForTest(fd + 1);
                ForestHearts.Bump("sailor", 4);
                ForestVisitors.ForceDayForTest(fd + 2);
                ForestHearts.Bump("sailor", 1);
                ForestVisitors.TalkSettled("sailor"); // 오늘 선물
                string s5 = ForestVisitors.TalkSettled("sailor");
                if (!s5.Contains(ForestHearts.UniqLine("sailor") ?? "@@")) Fail($"눌러앉은 손님 5♥ — {s5}");
                End("settled OK - 선물 뒤 5♥ 고유 대화");

                // ⑦ 세이브
                Begin();
                string snap = ForestHearts.Snapshot();
                string j = ForestSaveState.ToJson();
                ForestHearts.ResetForTest();
                ForestSaveState.ApplyJson(j);
                if (ForestHearts.Snapshot() != snap || ForestHearts.Of("sailor") != 5 || !ForestHearts.HasMemento(ForestHearts.KeeperId)) Fail("세이브 왕복");
                ForestSaveState.ApplyJson(j.Replace("\"heartsJson\":", "\"heartsJsonOld\":"));
                if (ForestHearts.Of("sailor") != 0 || ForestHearts.Of(ForestHearts.KeeperId) != 0) Fail("옛 세이브(칸 없음)가 0 이 아님");
                End("save OK - 왕복·옛 세이브 0");
            }
            finally
            {
                ForestVisitors.ForceDayForTest(null);
                ForestFestivalState.ForceDayForTest(null);
                ForestHearts.Restore(hearts0);
                ForestVisitors.Restore(rec0.Day, rec0.Key, rec0.Got, rec0.Done, rec0.Offered, rec0.Met, rec0.B1, rec0.B2);
                ForestVisitors.RestoreBonds(b.BondKeys, b.BondCounts, b.Settled, b.GiftDay, b.GiftGot, b.AskSettle);
                ForestVisitors.RestoreStories(stories0);
                ForestState.Restore(fruit0);
                ForestHomeState.RestoreStock(stock0.Keys, stock0.Counts);
            }
            return _ok;
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
