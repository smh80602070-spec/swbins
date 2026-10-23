using UnityEngine;
using Saga.Forest.Data;
using Saga.Forest.World;

namespace Saga.EditorTools
{
    /// <summary>
    /// tasks U-0173 가축 기르기(웹 W-0299 · 고돗 G-0311) 진단 — `PlaytestForestHeadless` 입주 조건(movein) 뒤에 부른다(한 프레임 안, 날짜는 강제).
    /// 다섯 줄: ① 우리 짓기(열매 모자람·값·하나만·울타리 여덟 조각·자리에 막는 것 없음) ② 들이기(우리 없으면 거절·값·넷까지·몸 수)
    /// ③ 먹이·쓰다듬기(열매 1·하루 한 번·하트 +1·열매 없으면 거절) ④ 아침(처음 본 날은 적기만·먹은 짐승 산물 = 열매·하트 3 이면 둘·사흘 굶으면 떠남·
    /// 빠진 날은 굶은 날) ⑤ 세이브 칸·왕복·옛 세이브 빈 것·제작대 단추 → 창·겹침 0. 끝나면 열매·가축·날짜를 시작 때로.
    /// </summary>
    public static class PlaytestForestLivestock
    {
        private const string T = "[PlaytestForestHeadless] livestock";
        private static bool _ok, _step;

        public static bool Run()
        {
            _ok = true;
            int fruit0 = ForestState.FruitCount;
            string stock0 = ForestLivestock.Snapshot();
            var runner = ForestLivestockRunner.Instance != null ? ForestLivestockRunner.Instance : ForestLivestockRunner.Install();
            const int D = 91000;
            try
            {
                ForestLivestock.ResetForTest();

                // ① 짓기
                Begin();
                ForestState.Restore(100);
                if (ForestLivestock.Buy("chick") != "stock.why_no_pen") Fail("우리 없이 들임");
                ForestState.Restore(5);
                if (ForestLivestock.BuildPen() != "stock.why_fruit" || ForestLivestock.HasPen || ForestState.FruitCount != 5) Fail("열매 모자란데 지어짐");
                ForestState.Restore(100);
                if (ForestLivestock.BuildPen() != null || !ForestLivestock.HasPen || ForestState.FruitCount != 100 - ForestLivestock.PenFruit) Fail($"짓기 실패(열매 {ForestState.FruitCount})");
                if (ForestLivestock.BuildPen() != "stock.why_pen_one") Fail("우리가 둘");
                int pieces = 0;
                if (runner.Pen != null) foreach (Transform c in runner.Pen.transform) if (c.name.StartsWith("pen_")) pieces++;
                if (runner.Pen == null || pieces != 8) Fail($"울타리 조각 {pieces} ≠ 8");
                var hits = Physics.OverlapBox(runner.Center + Vector3.up * 1.2f, new Vector3(ForestLivestockRunner.Half, 0.8f, ForestLivestockRunner.Half), Quaternion.identity, ~0, QueryTriggerInteraction.Ignore);
                string block = "";
                foreach (var h in hits) if (!h.CompareTag("Player")) block += h.name + " ";
                if (block.Length > 0) Fail($"우리 자리에 막는 것: {block}");
                End($"pen OK - 열매 {ForestLivestock.PenFruit} · 모자라면·둘째 거절 · 울타리 8조각(문 하나) · 자리 {runner.Center} 빔");

                // ② 들이기
                Begin();
                ForestState.Restore(100);
                foreach (var k in new[] { "chick", "goat", "chick", "goat" })
                    if (ForestLivestock.Buy(k) != null) Fail($"{k} 들이기 실패");
                if (ForestState.FruitCount != 100 - 2 * (10 + 22)) Fail($"값 열매 {ForestState.FruitCount} ≠ {100 - 64}");
                if (ForestLivestock.Buy("chick") != "stock.why_max" || ForestLivestock.Count != 4) Fail("다섯째가 들어옴");
                if (runner.Bodies.Count != 4) Fail($"몸 {runner.Bodies.Count} ≠ 4");
                if (ForestLivestock.List[2].name == ForestLivestock.List[0].name) Fail("같은 종 둘째 이름이 같음");
                End($"buy OK - 꼬꼬 10·매매 22 · 넷까지 · 몸 넷 · 둘째 이름「{ForestLivestock.List[2].name}」");

                // ③ 먹이·쓰다듬기
                Begin();
                ForestState.Restore(1);
                if (ForestLivestock.Feed(0) != null || ForestState.FruitCount != 0 || !ForestLivestock.List[0].fed) Fail("먹이 실패");
                if (ForestLivestock.Feed(0) != "stock.why_fed") Fail("하루 두 번 먹임");
                if (ForestLivestock.Feed(2) != "stock.why_feed") Fail("열매 없이 먹임");
                if (ForestLivestock.Pet(0) != null || ForestLivestock.List[0].heart != 1 || ForestLivestock.Pet(0) != "stock.why_petted") Fail("쓰다듬기 하트·하루 한 번");
                End("care OK - 먹이 열매 1·하루 한 번·열매 없으면 거절 · 쓰다듬기 하트 +1·하루 한 번");

                // ④ 아침
                Begin();
                ForestState.Restore(50);
                ForestVisitors.ForceDayForTest(D);
                if (runner.CheckDay() != null) Fail("처음 본 날에 거둠");
                ForestLivestock.Feed(1); // 매매 하나도(넣은 순서 꼬꼬·매매·꼬꼬·매매)
                ForestVisitors.ForceDayForTest(D + 1);
                int f = ForestState.FruitCount;
                string l1 = runner.CheckDay();
                if (ForestState.FruitCount != f + 2 + 4 || l1 == null || !l1.Contains("🥚") || !l1.Contains("🥛")) Fail($"첫 아침 열매 +{ForestState.FruitCount - f}(6)「{l1}」");
                if (runner.CheckDay() != null) Fail("같은 날 두 번 굴림");
                ForestLivestock.Pet(0); ForestLivestock.Feed(0); // 하트 2
                ForestVisitors.ForceDayForTest(D + 2);
                runner.CheckDay();
                ForestLivestock.Pet(0); ForestLivestock.Feed(0); // 하트 3
                ForestVisitors.ForceDayForTest(D + 3);
                f = ForestState.FruitCount;
                string l3 = runner.CheckDay();
                if (ForestState.FruitCount != f + 4 || ForestLivestock.Count != 2 || l3 == null || !l3.Contains("🐐")) Fail($"하트 3 달걀 둘(+4 → +{ForestState.FruitCount - f})·사흘 굶은 둘 떠남(남은 {ForestLivestock.Count})「{l3}」");
                ForestVisitors.ForceDayForTest(D + 7); // 나흘 빠짐 — 굶은 날로
                runner.CheckDay();
                if (ForestLivestock.Count != 0) Fail($"나흘 빠졌는데 {ForestLivestock.Count} 남음");
                End($"morning OK - 처음 날 적기만 · 먹은 짐승 산물 = 열매(달걀 2·산양젖 4) · 하트 3 이면 둘 · 사흘 굶으면 떠남 · 빠진 날은 굶은 날「{l3?.Replace("\n", " / ")}」");

                // ⑤ 세이브·창
                Begin();
                ForestState.Restore(100);
                ForestLivestock.Buy("goat");
                ForestLivestock.Pet(0);
                string snap = ForestLivestock.Snapshot();
                if (!ForestSaveState.ToJson().Contains("\"livestockJson\"")) Fail("세이브에 livestockJson 없음");
                ForestLivestock.Restore(null);
                if (ForestLivestock.HasPen || ForestLivestock.Count != 0 || runner.Pen != null) Fail("옛 세이브(없음)인데 우리가 남음");
                ForestLivestock.Restore(snap);
                if (!ForestLivestock.HasPen || ForestLivestock.Count != 1 || ForestLivestock.List[0].heart != 1 || runner.Pen == null || runner.Bodies.Count != 1) Fail("세이브 왕복");
                var wb = ForestWorkbench.Instance;
                if (wb == null || wb.StockButton == null) Fail("제작대 창에 우리 단추 없음");
                else
                {
                    wb.StockButton.onClick.Invoke();
                    if (!runner.IsOpen || !runner.InfoText(0).Contains(ForestLivestock.List[0].name)) Fail($"우리 창이 안 열림·첫 줄「{runner.InfoText(0)}」");
                    else
                    {
                        int bad = Overlaps(runner.Root);
                        if (bad != 0) Fail($"우리 창 겹침·밖 {bad}");
                    }
                    runner.Close();
                }
                End("save OK - livestockJson 칸·왕복(우리·마리·하트)·옛 세이브 빈 것·제작대 「🐔 우리」 → 창·겹침 0");
            }
            finally
            {
                ForestVisitors.ForceDayForTest(null);
                ForestLivestock.Restore(stock0);
                ForestState.Restore(fruit0);
                if (runner != null) runner.Close();
            }
            return _ok;
        }

        private static int Overlaps(RectTransform root)
        {
            if (root == null) return 1;
            var rects = new System.Collections.Generic.List<Rect>();
            var c = new Vector3[4];
            Rect Local(RectTransform t)
            {
                t.GetWorldCorners(c);
                Vector3 a = root.InverseTransformPoint(c[0]), b = root.InverseTransformPoint(c[2]);
                return Rect.MinMaxRect(a.x, a.y, b.x, b.y);
            }
            Rect box = Local(root);
            int bad = 0;
            foreach (RectTransform t in root)
            {
                if (!t.gameObject.activeSelf) continue;
                Rect r = Local(t);
                if (r.xMin < box.xMin - 0.5f || r.xMax > box.xMax + 0.5f || r.yMin < box.yMin - 0.5f || r.yMax > box.yMax + 0.5f) bad++;
                foreach (var o in rects) if (r.xMin < o.xMax - 0.5f && o.xMin < r.xMax - 0.5f && r.yMin < o.yMax - 0.5f && o.yMin < r.yMax - 0.5f) bad++;
                rects.Add(r);
            }
            return bad;
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
