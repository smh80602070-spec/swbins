using UnityEngine;
using Saga.Forest.Data;
using Saga.Forest.World;

namespace Saga.EditorTools
{
    /// <summary>
    /// tasks U-0144 동반자(웹 partner.js·고돗 G-0232) 진단 — `PlaytestForestHeadless` 관계 하트(hearts) 뒤에 부른다(한 프레임 안, 날짜는 강제).
    /// ① 청할 조건(눌러앉음·하트 10) ② 두 걸음 청하기·과일 모자람·승낙(과일 5) ③ 한 명만 ④ 아침 한 가지(같은 날 한 번·셋 다 나옴·결정적)
    /// ⑤ 30일 기념(과일 +6·다시 오면 대사만) ⑥ 집 안 몸·실제 말(아침) ⑦ 헤어지기 단추 두 번(하트 절반·집 안 몸 사라짐) ⑧ 세이브 왕복·옛 세이브.
    /// 끝나면 동반자·하트·단골·사연·손님 기록·열매·창고·날짜·손님 몸을 시작 때로.
    /// </summary>
    public static class PlaytestForestPartner
    {
        private const string T = "[PlaytestForestHeadless] partner";
        private static bool _ok, _step;

        public static bool Run()
        {
            _ok = true;
            string partner0 = ForestPartner.Snapshot(), hearts0 = ForestHearts.Snapshot();
            int fruit0 = ForestState.FruitCount;
            var rec0 = ForestVisitors.Snapshot();
            var b = ForestVisitors.SnapshotBonds();
            string[] stories0 = ForestVisitors.SnapshotStories();
            var stock0 = ForestHomeState.SnapshotStock();
            var runner = ForestVisitorRunner.Instance;
            const int D = 92000;
            try
            {
                ForestPartner.ResetForTest();
                ForestHearts.ResetForTest();
                ForestVisitors.RestoreBonds(null, null, new[] { "sailor", "fox", "angler" }, int.MinValue, null, false);
                ForestVisitors.RestoreStories(new[] { "sailor", "fox", "angler" });
                for (int d = 0; d < 3; d++) { ForestVisitors.ForceDayForTest(D + d); ForestHearts.Bump("sailor", 4); ForestHearts.Bump("fox", 4); }
                ForestHearts.Bump("angler", 4);
                ForestVisitors.ForceDayForTest(D + 3);

                // ① 조건
                Begin();
                if (ForestPartner.WhyNot("wisp") != "partner.why_settled" || ForestPartner.WhyNot("angler") != "partner.why_heart" || !ForestPartner.CanPropose("sailor"))
                    Fail($"조건 {ForestPartner.WhyNot("wisp")}·{ForestPartner.WhyNot("angler")}·{ForestPartner.WhyNot("sailor")}");
                if (ForestPartner.Ask("angler", "a") != null) Fail("하트 4 인데 청함");
                End("cond OK - 눌러앉은 손님·하트 10 만");

                // ② 두 걸음
                Begin();
                ForestState.Restore(0);
                string ask = ForestPartner.Ask("sailor", "s");
                if (ask == null || ForestPartner.Has) Fail("첫 다가섬에 청이 안 나옴/곧바로 삶");
                ForestPartner.Ask("sailor", "s");
                if (ForestPartner.Has) Fail("과일 없이 승낙");
                ForestState.Restore(12);
                ForestPartner.Ask("sailor", "s");
                if (!ForestPartner.IsPartner("sailor") || ForestState.FruitCount != 12 - ForestPartner.TokenFruit) Fail($"승낙 — 과일 {ForestState.FruitCount}");
                End("propose OK - 청 → 과일 모자람 → 과일 5 치르고 승낙");

                // ③ 한 명만
                Begin();
                if (ForestPartner.WhyNot("fox") != "partner.why_has" || ForestPartner.Ask("fox", "f") != null) Fail("둘째 동반자");
                End("one OK - 한 명만");

                // ④ 아침
                Begin();
                if (ForestPartner.Talk("sailor", "s") != null) Fail("같은 날 아침");
                bool[] seen = new bool[3];
                for (int d = 0; d < 40; d++) seen[(int)ForestPartner.MorningOf(D + 4 + d)] = true;
                if (!seen[0] || !seen[1] || !seen[2] || ForestPartner.MorningOf(D + 7) != ForestPartner.MorningOf(D + 7)) Fail("아침 셋이 안 나옴");
                int gd = D + 4;
                while (ForestPartner.MorningOf(gd) != ForestPartner.Morning.Gift && gd < D + 40) gd++;
                ForestVisitors.ForceDayForTest(gd);
                var gift = ForestPartner.GiftItem("sailor", gd);
                int st0 = gift != null ? ForestHomeState.StockCount(gift.Id) : 0;
                if (gift == null || ForestPartner.Talk("sailor", "s") == null || ForestHomeState.StockCount(gift.Id) != st0 + 1) Fail($"아침 선물 {gift?.Id}");
                if (ForestPartner.Talk("sailor", "s") != null) Fail("아침이 하루 두 번");
                End($"morning OK - 같은 날 한 번·셋 다·선물 {gift?.Id}(좋아하는 태그)");

                // ⑤ 30일
                Begin();
                ForestVisitors.ForceDayForTest(ForestPartner.Since + ForestPartner.AnnivDays);
                ForestState.Restore(0);
                string an = ForestPartner.Talk("sailor", "s");
                var mk = ForestPartner.MorningOf(ForestVisitors.Today);
                int expect = ForestPartner.AnnivFruit + (mk == ForestPartner.Morning.Water ? ForestPartner.WaterFruit : mk == ForestPartner.Morning.Meal ? ForestPartner.MealFruit : 0);
                if (an == null || !an.Contains("30") || ForestState.FruitCount != expect) Fail($"30일 기념 — 과일 {ForestState.FruitCount}≠{expect} · {an}");
                if (ForestPartner.Talk("sailor", "s") == null || ForestState.FruitCount != expect) Fail("기념일 두 번째 말");
                End("anniv OK - 30일 과일 +6·다시 오면 대사만");

                // ⑥ 집 안 몸·실제 말
                Begin();
                ForestVisitors.ForceDayForTest(ForestPartner.Since + ForestPartner.AnnivDays + 1);
                var house = Object.FindFirstObjectByType<ForestHouse>();
                if (runner == null || house == null) Fail("손님 러너·집 없음");
                else
                {
                    runner.Rebuild();
                    var pn = runner.PartnerNpc;
                    if (pn == null || Vector3.Distance(pn.transform.position, house.PartnerSpot) > 0.05f || pn.GetComponent<ForestPartnerButton>() == null) Fail("집 안 동반자 몸");
                    else
                    {
                        pn.CheckTalk(pn.transform.position + new Vector3(6f, 0f, 0f));
                        string l = pn.CheckTalk(pn.transform.position + new Vector3(1.2f, 0f, 0f));
                        if (l == null || !l.Contains("♥")) Fail($"집 안 동반자 말 — {l}");
                    }
                }
                End("home OK - 집 안 오른쪽 벽 곁 몸·말(아침)·단추");

                // ⑦ 세이브(헤어지기 전)
                Begin();
                string snap = ForestPartner.Snapshot();
                string j = ForestSaveState.ToJson();
                ForestPartner.ResetForTest();
                ForestSaveState.ApplyJson(j);
                if (ForestPartner.Snapshot() != snap || !ForestPartner.IsPartner("sailor")) Fail("세이브 왕복");
                ForestSaveState.ApplyJson(j.Replace("\"partnerJson\":", "\"partnerJsonOld\":"));
                if (ForestPartner.Has) Fail("옛 세이브(칸 없음)에 동반자");
                ForestSaveState.ApplyJson(j);
                End("save OK - 왕복·옛 세이브 없음");

                // ⑧ 헤어지기
                Begin();
                var btn = runner != null && runner.PartnerNpc != null ? runner.PartnerNpc.GetComponent<ForestPartnerButton>() : null;
                if (btn == null) Fail("헤어지기 단추 없음");
                else
                {
                    if (btn.Press() != null || !btn.Confirming || !ForestPartner.Has) Fail("한 번 누름에 헤어짐");
                    string br = btn.Press();
                    if (br == null || ForestPartner.Has || ForestHearts.Of("sailor") != 5) Fail($"헤어지기 — 하트 {ForestHearts.Of("sailor")} · {br}");
                    runner.Rebuild();
                    if (runner.PartnerNpc != null) Fail("헤어졌는데 집 안 몸");
                }
                End("break OK - 두 번 눌러 헤어짐·하트 10→5·집 안 몸 사라짐");
            }
            finally
            {
                ForestVisitors.ForceDayForTest(null);
                ForestPartner.Restore(partner0);
                ForestHearts.Restore(hearts0);
                ForestVisitors.Restore(rec0.Day, rec0.Key, rec0.Got, rec0.Done, rec0.Offered, rec0.Met, rec0.B1, rec0.B2);
                ForestVisitors.RestoreBonds(b.BondKeys, b.BondCounts, b.Settled, b.GiftDay, b.GiftGot, b.AskSettle);
                ForestVisitors.RestoreStories(stories0);
                ForestState.Restore(fruit0);
                ForestHomeState.RestoreStock(stock0.Keys, stock0.Counts);
                if (runner != null) runner.Rebuild();
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
