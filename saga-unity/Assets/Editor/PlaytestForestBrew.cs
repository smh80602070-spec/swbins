using UnityEngine;
using Saga.Forest.Data;
using Saga.Forest.World;

namespace Saga.EditorTools
{
    /// <summary>
    /// tasks U-0180 물약 양조(고돗 G-0320 짝) 진단 — `PlaytestForestHeadless` 가 유적(relics) 뒤에 부른다(한 프레임 안, 날짜는 넣는다).
    /// ① 주머니(버섯 = 약초·꽃·곤충·화석, 갈래마다 9) ② 달이기 규칙(약초 없음·재료 없음 거절·쓰면 줄고·이름 밝혀짐·새로 마시면 바뀜·다음 날 없음)
    /// ③ 효과(기운 = 과일 +1·꽃향 = 하트 +1 하루 상한 4 그대로·탁함 = 헛방) ④ 창(제작대 단추·줄 ❔/이름·단추 흐림·누르면 마심) ⑤ 세이브 칸·왕복·옛 세이브 ⑥ 손잡이.
    /// 끝나면 양조·열매·하트를 시작 때로.
    /// </summary>
    public static class PlaytestForestBrew
    {
        private const string T = "[PlaytestForestHeadless] brew";
        private static bool _ok, _step;

        public static bool Run()
        {
            _ok = true;
            int fruit0 = ForestState.FruitCount;
            string brew0 = ForestBrew.Snapshot(), hearts0 = ForestHearts.Snapshot();
            const int D = 93000;
            try
            {
                ForestBrew.ResetForTest();

                // ① 주머니
                Begin();
                for (int i = 0; i < 2; i++) ForestBrew.OnGather(ForestMuseumState.Category.Mushroom);
                ForestBrew.OnGather(ForestMuseumState.Category.Flower);
                ForestBrew.OnGather(ForestMuseumState.Category.Insect);
                if (ForestBrew.Herbs != 2 || ForestBrew.Count(ForestBrew.Mat.Flower) != 1 || ForestBrew.Count(ForestBrew.Mat.Insect) != 1 || ForestBrew.Count(ForestBrew.Mat.Fossil) != 0)
                    Fail($"주머니 약초 {ForestBrew.Herbs}·꽃 {ForestBrew.Count(ForestBrew.Mat.Flower)}·곤충 {ForestBrew.Count(ForestBrew.Mat.Insect)}");
                for (int i = 0; i < 20; i++) ForestBrew.OnGather(ForestMuseumState.Category.Mushroom);
                if (ForestBrew.Herbs != ForestBrew.PouchMax) Fail($"약초 {ForestBrew.Herbs} ≠ 상한 {ForestBrew.PouchMax}");
                End($"pouch OK - 버섯 = 약초·꽃·곤충 하나씩 · 상한 {ForestBrew.PouchMax}");

                // ② 규칙
                Begin();
                ForestBrew.SetPouchForTest(0, 2, 1, 0);
                if (ForestBrew.Brew(ForestBrew.Mat.Flower, D) != "brew.why_herb") Fail("약초 없는데 달임");
                ForestBrew.SetPouchForTest(3, 2, 1, 0);
                if (ForestBrew.Brew(ForestBrew.Mat.Fossil, D) != "brew.why_mat") Fail("화석 없는데 달임");
                if (ForestBrew.Known(ForestBrew.Mat.Flower) || !ForestBrew.RecipeLine(ForestBrew.Mat.Flower).StartsWith("❔")) Fail("처음인데 이름이 보임");
                if (ForestBrew.Brew(ForestBrew.Mat.Flower, D) != null) Fail("꽃 달이기 거절");
                if (ForestBrew.Herbs != 2 || ForestBrew.Count(ForestBrew.Mat.Flower) != 1) Fail("쓴 만큼 안 줄어듦");
                if (!ForestBrew.Known(ForestBrew.Mat.Flower) || ForestBrew.ActiveOn(D) != ForestBrew.Potion.Scent) Fail("이름 안 밝혀짐·꽃향 아님");
                ForestBrew.Brew(ForestBrew.Mat.Insect, D);
                if (ForestBrew.ActiveOn(D) != ForestBrew.Potion.Murky) Fail("새로 마셨는데 안 바뀜");
                if (ForestBrew.ActiveOn(D + 1) != ForestBrew.Potion.None) Fail("다음 날에도 남음");
                End("rule OK - 약초·재료 없으면 거절 · 쓰면 줄고 이름 밝혀짐 · 새로 마시면 바뀜 · 다음 날 없음");

                // ③ 효과(오늘 날짜로)
                Begin();
                int today = ForestVisitors.Today;
                ForestState.Restore(5);
                ForestBrew.SetPouchForTest(3, 1, 1, 1);
                ForestBrew.Brew(ForestBrew.Mat.Fruit, today);
                if (ForestState.FruitCount != 4 || ForestBrew.FruitBonus != 1 || ForestBrew.HeartBonus != 0) Fail($"기운: 열매 {ForestState.FruitCount}≠4·과일 덤 {ForestBrew.FruitBonus}");
                ForestBrew.Brew(ForestBrew.Mat.Flower, today);
                ForestHearts.ResetForTest();
                int g1 = ForestHearts.Bump("brew_test", 1);
                int g2 = ForestHearts.Bump("brew_test", 3);
                int down = ForestHearts.Bump("brew_test", -1);
                if (g1 != 2 || g2 != 2 || down != -1 || ForestBrew.FruitBonus != 0) Fail($"꽃향: +1 → {g1}(2)·+3 → {g2}(상한 4 남은 2)·−1 → {down}");
                ForestBrew.Brew(ForestBrew.Mat.Fossil, today);
                if (ForestBrew.FruitBonus != 0 || ForestBrew.HeartBonus != 0) Fail("탁한 물약인데 효과");
                End($"effect OK - 기운 과일 +1 · 꽃향 하트 +1 → {g1}·상한 4 그대로(+3 → {g2})·내림은 그대로 · 탁함 헛방");

                // ④ 창
                Begin();
                var bench = ForestWorkbench.Instance;
                var panel = ForestBrewPanel.Instance;
                if (bench == null || bench.BrewButton == null) Fail("제작대 ⚗️ 물약 단추 없음");
                if (panel == null) Fail("물약 창 없음");
                else
                {
                    ForestBrew.ResetForTest();
                    ForestBrew.SetPouchForTest(1, 0, 1, 0);
                    panel.Open();
                    if (!panel.IsOpen) Fail("창이 안 열림");
                    if (!panel.Line(2).Contains("❔")) Fail($"곤충 줄 ❔ 아님: {panel.Line(2)}");
                    if (panel.BrewButton(1).interactable || !panel.BrewButton(2).interactable) Fail("꽃 0 인데 단추 켜짐·곤충 1 인데 꺼짐");
                    panel.PressBrew(2);
                    if (ForestBrew.Active != ForestBrew.Potion.Murky || panel.Line(2).Contains("❔")) Fail($"누른 뒤 {ForestBrew.Active} · 줄 {panel.Line(2)}");
                    if (panel.BrewButton(2).interactable) Fail("약초 다 썼는데 단추 켜짐");
                    panel.Close();
                }
                End("panel OK - 제작대 단추 · ❔ 줄 · 재료 없으면 흐림 · 누르면 마시고 이름 밝혀짐");

                // ⑤ 세이브
                Begin();
                ForestBrew.SetPouchForTest(4, 3, 2, 1);
                string snap = ForestBrew.Snapshot();
                if (!ForestSaveState.ToJson().Contains("\"brewJson\"")) Fail("세이브에 brewJson 없음");
                ForestBrew.Restore(null);
                if (ForestBrew.Herbs != 0 || ForestBrew.Known(ForestBrew.Mat.Insect) || ForestBrew.Active != ForestBrew.Potion.None) Fail("옛 세이브인데 양조가 남음");
                ForestBrew.Restore(snap);
                if (ForestBrew.Herbs != 4 || ForestBrew.Count(ForestBrew.Mat.Fossil) != 1 || !ForestBrew.Known(ForestBrew.Mat.Insect) || ForestBrew.Active != ForestBrew.Potion.Murky) Fail("세이브 왕복");
                End("save OK - brewJson 칸·왕복(주머니·밝힌 것·오늘 물약)·옛 세이브 빈 것");

                // ⑥ 손잡이
                Begin();
                ForestBrew.On = false;
                int h = ForestBrew.Herbs;
                ForestBrew.OnGather(ForestMuseumState.Category.Mushroom);
                if (ForestBrew.Herbs != h || ForestBrew.Brew(ForestBrew.Mat.Flower, ForestVisitors.Today) != "brew.why_off" || ForestBrew.Active != ForestBrew.Potion.None) Fail("껐는데 쌓이거나 효과");
                End("off OK - 손잡이 끄면 주머니·달이기·효과 없음");
            }
            finally
            {
                ForestBrew.On = true;
                ForestBrew.Restore(brew0);
                ForestHearts.Restore(hearts0);
                ForestState.Restore(fruit0);
            }
            return _ok;
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
