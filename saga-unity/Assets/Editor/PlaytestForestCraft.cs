using System.Linq;
using UnityEngine;
using Saga.Forest.Data;
using Saga.Forest.World;

namespace Saga.EditorTools
{
    /// <summary>
    /// tasks U-0095 제작대·채집 손(웹 사가마을 W-0103) 진단 — `PlaytestForestHeadless` 시나리오 뒤에 부른다(한 프레임 안).
    /// ① Lv.1 배율 = 1(쿨 ×1·+0%·새 것 ×1 — 지금 채집 수치 그대로) ② 열매 모자라면 승급 안 됨·열매 그대로 ③ 승급 → 3택 셋 축 서로 다름·열매 −30
    /// ④ 축마다 그 배율만·상한(쿨 ×0.6·60%·×2) ⑤ 거절 = 열매 +10·레벨 오름 ⑥ 세이브 왕복(Lv·고른 축·남은 3택)·옛 세이브(칸 없음) = Lv.1
    /// ⑦ 눈 밝은 손 ×2 면 새 것이 반 넘게(씨앗 고정 1000번) · 넉넉한 손 60% ⑧ 제작대 소품·창(열기·승급·고르기) ⑨ ko/en.
    /// 끝나면 손·열매·세이브 JSON 을 시작 때로.
    /// </summary>
    public static class PlaytestForestCraft
    {
        private const string T = "[PlaytestForestHeadless] craft";
        private static bool _ok;

        public static bool Run()
        {
            _ok = true;
            int fruit0 = ForestState.FruitCount;
            int lv0 = ForestHandState.Level; var perks0 = ForestHandState.SnapshotPerks(); bool pend0 = ForestHandState.Pending;
            string m = "";
            try
            {
                // ① Lv.1
                ForestHandState.Restore(1, null, 0);
                if (ForestHandState.CooldownMul != 1f || ForestHandState.BonusFruitChance != 0f || ForestHandState.NewItemMul != 1f) Fail("Lv.1 배율이 1 이 아님");

                // ② 열매 모자람
                ForestState.Restore(10);
                if (ForestHandState.Upgrade() != "hand.why_fruit" || ForestState.FruitCount != 10 || ForestHandState.Pending) Fail("열매 모자란데 승급됨");

                // ③ 승급 → 3택
                ForestState.Restore(500);
                if (ForestHandState.Upgrade() != null || ForestState.FruitCount != 470 || !ForestHandState.Pending) Fail($"승급 실패(열매 {ForestState.FruitCount})");
                var offer = ForestHandState.Offer(new System.Random(20260824));
                if (offer.Distinct().Count() != 3) Fail("3택 축 겹침");
                if (ForestHandState.Upgrade() != "hand.why_pending") Fail("고르기 전에 또 승급됨");

                // ④ 축 — 빠른 손 둘 + 넉넉한 손 하나(Lv.4)
                ForestHandState.Choose(ForestHandState.Axis.Speed);
                if (Mathf.Abs(ForestHandState.CooldownMul - 0.8f) > 1e-4f || ForestHandState.BonusFruitChance != 0f || ForestHandState.NewItemMul != 1f || ForestHandState.Level != 2) Fail("빠른 손 배율");
                ForestHandState.Upgrade(); ForestHandState.Choose(ForestHandState.Axis.Speed);
                ForestHandState.Upgrade(); ForestHandState.Choose(ForestHandState.Axis.Yield);
                if (ForestHandState.Level != 4 || Mathf.Abs(ForestHandState.CooldownMul - 0.64f) > 1e-4f || Mathf.Abs(ForestHandState.BonusFruitChance - 0.3f) > 1e-4f) Fail($"Lv.4 배율 쿨 {ForestHandState.CooldownMul}·열매 {ForestHandState.BonusFruitChance}");
                if (ForestHandState.Upgrade() != "hand.why_max") Fail("최고 단계 뒤에도 승급");
                if (ForestState.FruitCount != 500 - 30 - 60 - 100) Fail($"승급 값 합 {500 - ForestState.FruitCount} ≠ 190");
                // 상한
                ForestHandState.Restore(4, new[] { 0, 0, 0 }, 0);
                if (Mathf.Abs(ForestHandState.CooldownMul - 0.6f) > 1e-4f) Fail("쿨 하한 0.6");
                ForestHandState.Restore(4, new[] { 1, 1, 1 }, 0);
                if (Mathf.Abs(ForestHandState.BonusFruitChance - 0.6f) > 1e-4f) Fail("열매 상한 60%");
                ForestHandState.Restore(4, new[] { 2, 2, 2 }, 0);
                if (Mathf.Abs(ForestHandState.NewItemMul - 2f) > 1e-4f) Fail("새 것 상한 ×2");
                m += " 승급 30·60·100 · 축 셋 · 상한";

                // ⑤ 거절
                ForestHandState.Restore(1, null, 0);
                ForestState.Restore(100);
                ForestHandState.Upgrade();
                ForestHandState.Decline();
                if (ForestState.FruitCount != 100 - 30 + 10 || ForestHandState.Level != 2 || ForestHandState.CooldownMul != 1f) Fail($"거절 열매 {ForestState.FruitCount}·Lv.{ForestHandState.Level}");

                // ⑥ 세이브 왕복·옛 세이브
                ForestHandState.Upgrade();   // 남은 3택 하나
                string j = ForestSaveState.ToJson();
                int lv = ForestHandState.Level; var perks = ForestHandState.SnapshotPerks(); bool pend = ForestHandState.Pending;
                ForestHandState.Restore(1, null, 0);
                ForestSaveState.ApplyJson(j);
                if (ForestHandState.Level != lv || !ForestHandState.SnapshotPerks().SequenceEqual(perks) || ForestHandState.Pending != pend) Fail("세이브 왕복");
                string legacy = System.Text.RegularExpressions.Regex.Replace(j, ",\"handLv\":[0-9]+,\"handPerks\":\\[[^\\]]*\\],\"handPending\":[0-9]+", "");
                if (legacy == j) Fail("옛 세이브 흉내 — 손 칸을 못 지움");
                ForestSaveState.ApplyJson(legacy);
                if (ForestHandState.Level != 1 || ForestHandState.Pending || ForestHandState.SnapshotPerks().Length != 0) Fail("옛 세이브 = Lv.1 아님");
                ForestSaveState.ApplyJson(j);
                m += " · 세이브 왕복·옛 세이브";

                // ⑦ 확률
                var pool = new[] { "a", "b", "c", "d", "e", "f", "g", "h", "i", "j" };
                System.Func<string, bool> disc = it => it != "a";   // 새 것은 a 하나
                var rng = new System.Random(20260824);
                ForestHandState.Restore(4, new[] { 2, 2, -1 }, 0);   // ×2 상한(1.5² = 2.25 → 2)
                int fresh = 0;
                for (int i = 0; i < 1000; i++) if (ForestHandState.PickItem(pool, disc, rng) == "a") fresh++;
                if (fresh < 500) Fail($"눈 밝은 손 ×2 인데 새 것 {fresh}/1000");
                ForestHandState.Restore(1, null, 0);
                int fresh1 = 0;
                for (int i = 0; i < 1000; i++) if (ForestHandState.PickItem(pool, disc, rng) == "a") fresh1++;
                if (fresh1 > 150) Fail($"Lv.1 인데 새 것 {fresh1}/1000(기대 약 100)");
                ForestHandState.Restore(4, new[] { 1, 1, -1 }, 0);
                int bonus = 0;
                for (int i = 0; i < 1000; i++) bonus += ForestHandState.BonusFruit(rng);
                if (bonus < 540 || bonus > 660) Fail($"넉넉한 손 60% 인데 {bonus}/1000");
                m += $" · 새 것 {fresh}·{fresh1}/1000 · 열매 +1 {bonus}/1000";

                // ⑧ 제작대
                var wb = ForestWorkbench.Instance;
                if (wb == null) Fail("제작대 없음(ForestBootstrap Install)");
                else
                {
                    ForestHandState.Restore(1, null, 0);
                    ForestState.Restore(200);
                    wb.Toggle();
                    if (!wb.IsOpen) Fail("창이 안 열림");
                    wb.PressUpgrade();
                    if (!ForestHandState.Pending || wb.Offer == null || wb.Offer.Count != 3) Fail("창 승급 뒤 3택 없음");
                    else
                    {
                        var a = wb.Offer[0];
                        wb.PressAxis(0);
                        if (ForestHandState.Level != 2 || ForestHandState.CountOf(a) != 1) Fail("창에서 고른 축이 안 먹음");
                    }
                    wb.Close();
                    m += " · 제작대 창 ○";
                }

                // ⑨ ko/en
                foreach (var lang in new[] { "ko", "en" })
                {
                    var ta = Resources.Load<TextAsset>($"Localization/forest_{lang}");
                    foreach (var k in new[] { "hand.title", "hand.status", "hand.upgrade", "hand.speed", "hand.yield", "hand.eye", "hand.decline", "hand.hint" })
                        if (ta == null || !ta.text.Contains($"\"{k}\"")) Fail($"{lang} 키 {k} 없음");
                }
            }
            finally
            {
                ForestHandState.Restore(lv0, perks0, pend0 ? 1 : 0);
                ForestState.Restore(fruit0);
                ForestWorkbench.Instance?.Close();
            }
            if (_ok) Debug.Log($"{T} OK - Lv.1 배율 1 · 열매 모자람 · 승급 3택 축 셋 · 배율·상한 · 거절 +10 · 세이브 왕복·옛 세이브 · 새 것·열매 확률 · 제작대 창 · ko/en |{m}");
            return _ok;
        }

        private static void Fail(string why)
        {
            _ok = false;
            Debug.LogError($"{T} FAIL - {why}");
        }
    }
}
