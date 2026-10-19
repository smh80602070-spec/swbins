using System.Linq;
using UnityEngine;
using Saga.Forest.Data;
using Saga.Forest.World;

namespace Saga.EditorTools
{
    /// <summary>
    /// tasks U-0127 입주 조건(웹 사가마을 W-0284) 진단 — `PlaytestForestHeadless` 제작대(craft) 뒤에 부른다(한 프레임 안, 날짜는 강제).
    /// 다섯 줄: ① 빈 집 짓기(열매 모자라면 안 됨·값·집 모습 하나) ② 태그 둘이면 다음 날도 안 옴 ③ 셋이면 같은 날은 안 오고 다음 날 어울리는 손님이
    /// 눌러앉음(눌러앉은 명단·집 주인) ④ 하루 한 명(조건 맞는 집 둘 → 이틀에 걸쳐)·산 집엔 못 넣음 ⑤ 넷째 집 거절·세이브 왕복·창 열기.
    /// 끝나면 열매·집·창고·단골 명단·날짜를 시작 때로.
    /// </summary>
    public static class PlaytestForestMoveIn
    {
        private const string T = "[PlaytestForestHeadless] movein";
        private static bool _ok, _step;

        public static bool Run()
        {
            _ok = true;
            int fruit0 = ForestState.FruitCount;
            string lots0 = ForestLots.Snapshot();
            var stock0 = ForestHomeState.SnapshotStock();
            var b = ForestVisitors.SnapshotBonds();
            var runner = ForestLotRunner.Instance != null ? ForestLotRunner.Instance : ForestLotRunner.Install();
            const int D = 90000;
            try
            {
                ForestLots.ResetForTest();
                ForestVisitors.RestoreBonds(null, null, null, int.MinValue, null, false);
                foreach (var id in new[] { "seoan", "mulhang", "bangseok", "visit_wisp", "geomungo", "hwaro", "visit_alien", "soban", "hwabun" })
                    ForestHomeState.AddStock(id, 2);

                // ① 짓기
                Begin();
                ForestState.Restore(10);
                if (ForestLots.Build() != "lot.why_fruit" || ForestLots.Count != 0 || ForestState.FruitCount != 10) Fail("열매 모자란데 지어짐");
                ForestState.Restore(100);
                if (ForestLots.Build() != null || ForestLots.Count != 1 || ForestState.FruitCount != 100 - ForestLots.BuildFruit) Fail($"짓기 실패(열매 {ForestState.FruitCount})");
                if (runner.Houses.Count != 1 || runner.Houses[0] == null || runner.Houses[0].GetComponentsInChildren<MeshRenderer>().Length < 4) Fail("빈 집 모습이 안 섬");
                End($"build OK - 열매 {ForestLots.BuildFruit} 로 빈 집 0→1·모자라면 거절·집 모습");

                // ② 태그 둘
                Begin();
                ForestVisitors.ForceDayForTest(D);
                runner.CheckDay(); // 처음 본 날 — 적기만
                if (ForestLots.Put(0, "seoan") != null || ForestLots.Put(0, "mulhang") != null) Fail("가구 넣기 실패");
                if (ForestLots.TagsOf(0).Count != 2) Fail($"태그 {ForestLots.TagsOf(0).Count} ≠ 2");
                ForestVisitors.ForceDayForTest(D + 1);
                if (runner.CheckDay() != null || ForestVisitors.SettledList.Count != 0) Fail("태그 둘인데 눌러앉음");
                End("tags2 OK - 서재·부엌 둘이면 다음 날에도 안 옴");

                // ③ 셋 → 다음 날
                Begin();
                ForestLots.Put(0, "bangseok");
                if (ForestLots.ReadyFor(0) != "fox") Fail($"서재·부엌·안방에 어울리는 손님 {ForestLots.ReadyFor(0)} ≠ fox");
                if (runner.CheckDay() != null) Fail("같은 날 눌러앉음");
                ForestVisitors.ForceDayForTest(D + 2);
                string who = runner.CheckDay();
                if (who != "fox" || !ForestVisitors.IsSettled("fox") || ForestLots.List[0].who != "fox") Fail($"다음 날 눌러앉은 손님 {who}");
                End("settle OK - 태그 셋이면 다음 날 여우 화상이 눌러앉음(같은 날은 안 옴)");

                // ④ 하루 한 명·산 집
                Begin();
                if (ForestLots.Put(0, "hwabun") != "lot.why_lived") Fail("산 집에 가구가 들어감");
                ForestLots.Build(); ForestLots.Build();
                ForestLots.Put(1, "visit_wisp"); ForestLots.Put(1, "geomungo"); ForestLots.Put(1, "hwaro");
                ForestLots.Put(2, "visit_alien"); ForestLots.Put(2, "geomungo"); ForestLots.Put(2, "soban");
                if (ForestLots.ReadyFor(1) == null || ForestLots.ReadyFor(2) == null) Fail($"집 둘 다 준비 안 됨({ForestLots.ReadyFor(1)}·{ForestLots.ReadyFor(2)})");
                int n0 = ForestVisitors.SettledList.Count;
                ForestVisitors.ForceDayForTest(D + 3);
                runner.CheckDay();
                if (ForestVisitors.SettledList.Count != n0 + 1) Fail($"하루에 {ForestVisitors.SettledList.Count - n0} 명");
                ForestVisitors.ForceDayForTest(D + 4);
                runner.CheckDay();
                if (ForestVisitors.SettledList.Count != n0 + 2 || ForestLots.List.Any(l => string.IsNullOrEmpty(l.who))) Fail("이튿날 둘째 집이 안 참");
                End($"oneaday OK - 준비된 집 둘 → 하루 한 명씩({ForestLots.List[1].who}·{ForestLots.List[2].who})·산 집엔 못 넣음");

                // ⑤ 넷째·세이브·창
                Begin();
                ForestState.Restore(100);
                if (ForestLots.Build() != "lot.why_max" || ForestLots.Count != 3 || ForestState.FruitCount != 100) Fail("넷째 집이 지어짐");
                string snap = ForestLots.Snapshot();
                string j = ForestSaveState.ToJson();
                ForestLots.ResetForTest();
                ForestSaveState.ApplyJson(j);
                if (ForestLots.Snapshot() != snap || ForestLots.Count != 3) Fail("세이브 왕복");
                if (runner.Houses.Count != 3) Fail($"집 모습 {runner.Houses.Count} ≠ 3");
                runner.Open();
                if (!runner.IsOpen) Fail("빈 집 창이 안 열림");
                runner.Close();
                End("save OK - 넷째 집 거절·세이브 왕복(집 셋·주인·가구)·집 모습 셋·창");
            }
            finally
            {
                ForestVisitors.ForceDayForTest(null);
                ForestHomeState.RestoreStock(stock0.Keys, stock0.Counts);
                ForestVisitors.RestoreBonds(b.BondKeys, b.BondCounts, b.Settled, b.GiftDay, b.GiftGot, b.AskSettle);
                ForestLots.Restore(lots0);
                ForestState.Restore(fruit0);
                if (runner != null) runner.Close();
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
