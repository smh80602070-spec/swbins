using System.Collections.Generic;
using UnityEngine;
using Saga.Core;
using Saga.Forest.Data;
using Saga.Forest.World;

namespace Saga.EditorTools
{
    /// <summary>
    /// tasks U-0223 밭 작물 진단 — `PlaytestForestHeadless` 가축(U-0173) 뒤에 부른다(한 프레임 안, 날짜·날씨는 강제).
    /// 일곱 줄: ① 짓기(열매 모자람·값·하나만·칸 넷·자리에 막는 것 없음) ② 씨(밭 없으면·빈 칸 물 거절·열매 1·열매 없으면 거절)
    /// ③ 자람(처음 본 날은 적기만·물 준 칸만 자람·하루 두 번 물 = 한 번·물 준 날 3 → 다 자람·단계 모델 바뀜) ④ 빠진 날 몰아 셈(첫 날만)·비 = 저절로 물
    /// ⑤ 거둠(덜 자람 거절·열매 +4·빈 두둑) ⑥ 세이브 칸·왕복·옛 세이브 빈 것·「오늘」 줄·제작대 단추 → 창·겹침 0 ⑦ 끔.
    /// 끝나면 열매·밭·날짜·날씨를 시작 때로.
    /// </summary>
    public static class PlaytestForestCrops
    {
        private const string T = "[PlaytestForestHeadless] crops";
        private static bool _ok, _step;

        public static bool Run()
        {
            _ok = true;
            int fruit0 = ForestState.FruitCount;
            string crop0 = ForestCrops.Snapshot();
            var wx0 = SkyWeatherRules.ForcedWeather;
            var runner = ForestCropRunner.Instance != null ? ForestCropRunner.Instance : ForestCropRunner.Install();
            const int D = 93000;
            try
            {
                SkyWeatherRules.ForcedWeather = SkyWeatherRules.Kind.Clear;
                ForestCrops.ResetForTest();

                // ① 짓기
                Begin();
                ForestState.Restore(100);
                if (ForestCrops.Sow(0) != "crop.why_no_field") Fail("밭 없이 씨 뿌림");
                ForestState.Restore(5);
                if (ForestCrops.Build() != "crop.why_fruit" || ForestCrops.HasField || ForestState.FruitCount != 5) Fail("열매 모자란데 지어짐");
                ForestState.Restore(100);
                if (ForestCrops.Build() != null || !ForestCrops.HasField || ForestState.FruitCount != 100 - ForestCrops.FieldFruit) Fail($"짓기 실패(열매 {ForestState.FruitCount})");
                if (ForestCrops.Build() != "crop.why_one") Fail("밭이 둘");
                int plots = 0;
                if (runner.Field != null) foreach (Transform c in runner.Field.transform) if (c.name.StartsWith("Plot_")) plots++;
                if (runner.Field == null || plots != ForestCrops.Plots) Fail($"칸 {plots} ≠ {ForestCrops.Plots}");
                var hits = Physics.OverlapBox(runner.Center + Vector3.up * 1.2f, new Vector3(ForestCropRunner.Half + 0.15f, 0.8f, ForestCropRunner.Half + 0.15f), Quaternion.identity, ~0, QueryTriggerInteraction.Ignore);
                string block = "";
                foreach (var h in hits) if (!h.CompareTag("Player")) block += h.name + " ";
                if (block.Length > 0) Fail($"밭 자리에 막는 것: {block}");
                var pen = ForestLivestockRunner.Instance;
                if (pen != null && Vector2.Distance(new Vector2(pen.Center.x, pen.Center.z), new Vector2(runner.Center.x, runner.Center.z)) < ForestLivestockRunner.Half + ForestCropRunner.Half + 0.5f) Fail($"우리와 겹침 {pen.Center} · {runner.Center}");
                End($"field OK - 열매 {ForestCrops.FieldFruit} · 모자라면·둘째 거절 · 칸 {plots} · 자리 {runner.Center} 빔(우리 {(pen != null ? pen.Center.ToString() : "-")} 와 떨어짐)");

                // ② 씨
                Begin();
                if (ForestCrops.Water(0) != "crop.why_bare") Fail("빈 칸에 물");
                ForestState.Restore(3);
                for (int i = 0; i < 3; i++) if (ForestCrops.Sow(i) != null) Fail($"칸 {i} 씨 실패");
                if (ForestState.FruitCount != 0) Fail($"씨값 열매 {ForestState.FruitCount} ≠ 0");
                if (ForestCrops.Sow(3) != "crop.why_fruit") Fail("열매 없이 씨 뿌림");
                ForestState.Restore(10);
                if (ForestCrops.Sow(3) != null || ForestCrops.Sow(3) != "crop.why_sown") Fail("넷째 칸 씨·두 번 뿌림");
                if (ForestCrops.StageOf(0) != ForestCrops.Stage.Seed || runner.ModelAt(0) != null) Fail($"씨 단계 {ForestCrops.StageOf(0)} 모델 {runner.ModelAt(0)}");
                End($"sow OK - 씨 열매 {ForestCrops.SeedFruit} · 밭 없으면·빈 칸 물·열매 없음·두 번 거절 · 씨 단계는 두둑만");

                // ③ 자람
                Begin();
                ForestVisitors.ForceDayForTest(D);
                if (runner.CheckDay() != null) Fail("처음 본 날에 자람");
                if (ForestCrops.Water(0) != null || ForestCrops.Water(0) != "crop.why_watered") Fail("물 하루 한 번");
                ForestCrops.Water(1);
                ForestVisitors.ForceDayForTest(D + 1);
                string l1 = runner.CheckDay();
                if (ForestCrops.PlotAt(0).grown != 1 || ForestCrops.PlotAt(1).grown != 1 || ForestCrops.PlotAt(2).grown != 0 || l1 == null) Fail($"첫 아침 자람 {ForestCrops.PlotAt(0).grown}/{ForestCrops.PlotAt(1).grown}/{ForestCrops.PlotAt(2).grown}「{l1}」");
                if (ForestCrops.PlotAt(0).watered) Fail("아침 뒤 물이 남음");
                if (runner.ModelAt(0) != "wheat_sprout_01" || runner.ModelAt(2) != null) Fail($"싹 모델 {runner.ModelAt(0)}·물 안 준 칸 {runner.ModelAt(2)}");
                if (runner.CheckDay() != null) Fail("같은 날 두 번 굴림");
                ForestCrops.Water(0);
                ForestVisitors.ForceDayForTest(D + 2);
                runner.CheckDay();
                if (ForestCrops.StageOf(0) != ForestCrops.Stage.Growing || runner.ModelAt(0) != "wheat_growing_01") Fail($"자람 {ForestCrops.StageOf(0)} {runner.ModelAt(0)}");
                ForestCrops.Water(0);
                ForestVisitors.ForceDayForTest(D + 3);
                string l3 = runner.CheckDay();
                if (ForestCrops.StageOf(0) != ForestCrops.Stage.Ripe || runner.ModelAt(0) != "wheat_ripe_01" || l3 == null || !l3.Contains("🌾")) Fail($"다 자람 {ForestCrops.StageOf(0)} {runner.ModelAt(0)}「{l3}」");
                if (ForestCrops.StageOf(1) != ForestCrops.Stage.Sprout || ForestCrops.StageOf(2) != ForestCrops.Stage.Seed) Fail($"물 안 준 날 자람 {ForestCrops.StageOf(1)}/{ForestCrops.StageOf(2)}");
                if (ForestCrops.Water(0) != "crop.why_ripe") Fail("다 자란 칸에 물");
                End($"grow OK - 처음 날 적기만 · 물 준 칸만 · 두 번 물 = 한 번 · 물 준 날 {ForestCrops.GrowDays} → 다 자람 · 모델 두둑→sprout→growing→ripe「{l3?.Replace("\n", " / ")}」");

                // ④ 빠진 날·비
                Begin();
                ForestCrops.Water(1);
                ForestVisitors.ForceDayForTest(D + 8); // 닷새 빠짐 — 첫 날만 물 받은 날
                runner.CheckDay();
                if (ForestCrops.PlotAt(1).grown != 2 || ForestCrops.PlotAt(2).grown != 0) Fail($"빠진 날 몰아 셈 {ForestCrops.PlotAt(1).grown}(2)·{ForestCrops.PlotAt(2).grown}(0)");
                if (runner.CheckRain() != null) Fail("맑은 날 비 물");
                SkyWeatherRules.ForcedWeather = SkyWeatherRules.Kind.Rain;
                string rain = runner.CheckRain();
                if (rain == null || !ForestCrops.PlotAt(1).watered || !ForestCrops.PlotAt(2).watered || ForestCrops.PlotAt(0).watered) Fail($"비 물「{rain}」");
                if (runner.CheckRain() != null) Fail("비 알림이 거듭");
                SkyWeatherRules.ForcedWeather = SkyWeatherRules.Kind.Clear;
                End($"skip OK - 빠진 날 몰아 셈(첫 날만 물) · 비 = 씨 뿌린 칸 저절로 물(다 자란 칸 빼고, 한 번만)「{rain}」");

                // ⑤ 거둠
                Begin();
                ForestState.Restore(0);
                if (ForestCrops.Harvest(1) != "crop.why_unripe") Fail("덜 자란 칸 거둠");
                if (ForestCrops.Harvest(0) != null || ForestState.FruitCount != ForestCrops.HarvestFruit || ForestCrops.StageOf(0) != ForestCrops.Stage.Empty || runner.ModelAt(0) != null) Fail($"거둠 열매 {ForestState.FruitCount}·{ForestCrops.StageOf(0)}·{runner.ModelAt(0)}");
                End($"harvest OK - 덜 자람 거절 · 열매 +{ForestCrops.HarvestFruit} · 빈 두둑으로");

                // ⑥ 세이브·「오늘」·창
                Begin();
                string snap = ForestCrops.Snapshot();
                if (!ForestSaveState.ToJson().Contains("\"cropJson\"")) Fail("세이브에 cropJson 없음");
                ForestCrops.Restore(null);
                if (ForestCrops.HasField || runner.Field != null) Fail("옛 세이브(없음)인데 밭이 남음");
                var today = new List<TodayRow>(); var week = new List<TodayRow>();
                new Saga.Forest.UI.ForestTodaySource().Rows(today, week);
                int rowsNoField = today.Count;
                ForestCrops.Restore(snap);
                if (!ForestCrops.HasField || ForestCrops.PlotAt(1).grown != 2 || !ForestCrops.PlotAt(1).watered || ForestCrops.StageOf(0) != ForestCrops.Stage.Empty || runner.ModelAt(1) != "wheat_growing_01") Fail("세이브 왕복");
                today.Clear(); week.Clear();
                new Saga.Forest.UI.ForestTodaySource().Rows(today, week);
                string want = string.Format(ForestLocalization.T("today.crop_water", "💧 밭 물 주기 {0}/{1}"), ForestCrops.WateredCount, ForestCrops.GrowingCount);
                string got = today.Count > 0 ? today[today.Count - 1].Text : "";
                if (today.Count != rowsNoField + 1 || got != want) Fail($"「오늘」 줄 {rowsNoField}→{today.Count}「{got}」≠「{want}」");
                var wb = ForestWorkbench.Instance;
                if (wb == null || wb.CropButton == null) Fail("제작대 창에 밭 단추 없음");
                else
                {
                    wb.Toggle();
                    int wbBad = OverlapsOf((RectTransform)wb.CropButton.transform);
                    wb.CropButton.onClick.Invoke();
                    if (!runner.IsOpen || !runner.InfoText(1).Contains("2/" + ForestCrops.GrowDays)) Fail($"밭 창이 안 열림·둘째 줄「{runner.InfoText(1)}」");
                    else
                    {
                        int bad = Overlaps(runner.Root);
                        if (bad != 0 || wbBad != 0) Fail($"밭 창 겹침·밖 {bad} · 제작대 창 {wbBad}");
                    }
                    runner.Close();
                    wb.Close();
                }
                End($"save OK - cropJson 칸·왕복(밭·자람·물·모델)·옛 세이브 빈 것 · 「오늘」「{got}」(밭 없으면 줄 없음) · 제작대 「🌾 밭」 → 창·겹침 0");

                // ⑦ 끔
                Begin();
                ForestCrops.On = false;
                ForestState.Restore(50);
                string s0 = ForestCrops.Snapshot();
                ForestVisitors.ForceDayForTest(D + 20);
                if (ForestCrops.Sow(0) != "crop.why_off" || ForestCrops.Water(1) != "crop.why_off" || ForestCrops.Harvest(1) != "crop.why_off" || runner.CheckDay() != null || ForestCrops.Snapshot() != s0 || ForestState.FruitCount != 50) Fail("꺼도 움직임");
                ForestCrops.On = true;
                End("off OK - 끄면 씨·물·거둠·아침 굴림 없음");
            }
            finally
            {
                ForestCrops.On = true;
                SkyWeatherRules.ForcedWeather = wx0;
                ForestVisitors.ForceDayForTest(null);
                ForestCrops.Restore(crop0);
                ForestState.Restore(fruit0);
                if (runner != null) runner.Close();
            }
            return _ok;
        }

        /// <summary>켜진 자식끼리 겹침·창 밖 수(가축 진단과 같은 셈).</summary>
        private static int Overlaps(RectTransform root)
        {
            if (root == null) return 1;
            var rects = new List<Rect>();
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

        /// <summary>한 단추가 같은 창의 켜진 다른 자식과 겹치거나 창 밖으로 나간 수.</summary>
        private static int OverlapsOf(RectTransform me)
        {
            var root = me.parent as RectTransform;
            if (root == null) return 1;
            var c = new Vector3[4];
            Rect Local(RectTransform t)
            {
                t.GetWorldCorners(c);
                Vector3 a = root.InverseTransformPoint(c[0]), b = root.InverseTransformPoint(c[2]);
                return Rect.MinMaxRect(a.x, a.y, b.x, b.y);
            }
            Rect box = Local(root), r = Local(me);
            int bad = r.xMin < box.xMin - 0.5f || r.xMax > box.xMax + 0.5f || r.yMin < box.yMin - 0.5f || r.yMax > box.yMax + 0.5f ? 1 : 0;
            foreach (RectTransform t in root)
            {
                if (t == me || !t.gameObject.activeSelf) continue;
                Rect o = Local(t);
                if (r.xMin < o.xMax - 0.5f && o.xMin < r.xMax - 0.5f && r.yMin < o.yMax - 0.5f && o.yMin < r.yMax - 0.5f) bad++;
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
