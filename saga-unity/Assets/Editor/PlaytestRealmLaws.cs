using System.Text.RegularExpressions;
using UnityEngine;
using Saga.Realm.Data;
using Saga.Realm.UI;

namespace Saga.EditorTools
{
    /// <summary>
    /// tasks U-0182 법령(고돗 G-0321 짝) 진단 — `PlaytestRealmSlice` 교역로(trade) 뒤에 부른다(한 프레임 안).
    /// ① 곱(빈 법전 = 1 · 상업령·둔전령·징병령 득실이 곱해짐) ② 반포 규칙(법전 칸 = 성 수 최대 3 · 6달 간격 · 같은 법령 거절)
    /// ③ 달 결산(진짜 NextMonth — 금 +15%·수확 −10%·군량 먹음 −20%) ④ 창(☰ 칸 단추·줄·반포·시행 중 흐림)
    /// ⑤ 저장 왕복·옛 세이브 빈 법전 ⑥ 손잡이. 끝나면 세이브 JSON·손잡이를 시작 때로.
    /// </summary>
    public static class PlaytestRealmLaws
    {
        private const string T = "[PlaytestRealmSlice] laws";
        private static bool _ok, _step;

        public static bool Run()
        {
            _ok = true;
            string json0 = RealmSaveState.ToJson();
            try
            {
                RealmLaws.ResetForTest();
                RealmLaws.CitiesForTest = 3;

                // ① 곱
                Begin();
                if (RealmLaws.GoldMul != 1f || RealmLaws.HarvestMul != 1f || RealmLaws.EatMul != 1f || RealmLaws.DraftMul != 1f || RealmLaws.HireMul != 1f) Fail("빈 법전인데 곱");
                int now = RealmLaws.NowIndex;
                RealmLaws.Enact("commerce", now);
                RealmLaws.Enact("tuntian", now + 6);
                RealmLaws.Enact("draft", now + 12);
                if (!Near(RealmLaws.GoldMul, 1.15f * 0.9f) || !Near(RealmLaws.HarvestMul, 0.9f) || !Near(RealmLaws.EatMul, 0.8f) || !Near(RealmLaws.DraftMul, 1.25f) || !Near(RealmLaws.HireMul, 0.85f))
                    Fail($"셋 곱 금 {RealmLaws.GoldMul} 수확 {RealmLaws.HarvestMul} 먹음 {RealmLaws.EatMul} 징병 {RealmLaws.DraftMul} 등용 {RealmLaws.HireMul}");
                End($"mul OK - 빈 법전 1 · 셋이면 금 ×{RealmLaws.GoldMul:0.###}·수확 ×0.9·먹음 ×0.8·징병 ×1.25·등용 ×0.85");

                // ② 반포 규칙
                Begin();
                RealmLaws.ResetForTest();
                RealmLaws.CitiesForTest = 1;
                if (RealmLaws.Enact("commerce", now) != null) Fail("빈 법전에 못 내림");
                if (RealmLaws.Enact("commerce", now + 20) != "law.why_has") Fail("같은 법령 또 내림");
                if (RealmLaws.Enact("draft", now + 20) != "law.why_slots") Fail("성 하나인데 둘째 법령");
                RealmLaws.CitiesForTest = 5;
                if (RealmLaws.Slots != RealmLaws.MaxSlots) Fail($"성 다섯 법전 {RealmLaws.Slots} ≠ 3");
                if (RealmLaws.Enact("draft", now + 5) != "law.why_wait" || RealmLaws.WaitMonths(now + 5) != 1) Fail("5달 만에 내림");
                if (RealmLaws.Enact("draft", now + 6) != null) Fail("6달 뒤 못 내림");
                End("rule OK - 성 하나 = 법전 1(성 다섯도 3) · 같은 법령·가득 참·6달 안 거절 · 6달 뒤 반포");

                // ③ 달 결산(진짜 NextMonth, 수확 달 6월로)
                Begin();
                string j6 = Regex.Replace(json0, "\"month\":\\d+", "\"month\":6");
                string city = RealmCityState.ActiveCityIds[0];
                var (gB, fB, eB) = Month(j6, city, null);
                var (gC, fC, _) = Month(j6, city, "commerce");
                var (_, fT, eT) = Month(j6, city, "tuntian");
                if (gB <= 0 || Mathf.Abs(gC - Mathf.RoundToInt(gB * 1.15f)) > 1) Fail($"상업령 금 +{gC} ≠ {gB}×1.15");
                float hB = fB + eB, hC = fC + eB;
                if (hB <= 0f || Mathf.Abs(hC / hB - 0.9f) > 0.02f) Fail($"상업령 수확 {hC} ≠ {hB}×0.9");
                if (eB <= 0 || (eT >= eB || Mathf.Abs(fT - fB - (eB - eT)) > 0)) Fail($"둔전령 먹음 {eT}(평소 {eB}) · 군량 {fT} vs {fB}");
                End($"month OK - 진짜 다음 달: 금 +{gB} → 상업령 +{gC} · 수확 {hB} → {hC} · 먹음 {eB} → 둔전령 {eT}");
                RealmSaveState.ApplyJson(json0);

                // ④ 창
                Begin();
                RealmLaws.ResetForTest();
                RealmLaws.CitiesForTest = 3;
                var ui = RealmLawUi.Instance;
                if (ui == null || ui.ToggleButton == null) Fail("법령 단추 없음");
                else
                {
                    ui.Open();
                    if (!ui.PanelOpen || !ui.RowText(0).Contains(RealmLaws.All[0].Name) || !ui.RowButton(0).interactable) Fail($"창·줄「{ui.RowText(0)}」");
                    ui.RowButton(0).onClick.Invoke();
                    if (!RealmLaws.Has("commerce") || ui.RowButton(0).interactable || ui.RowButton(1).interactable) Fail("반포 뒤 시행 중·6달 기다림이 단추에 안 보임");
                    ui.Close();
                }
                End("panel OK - 📜 법령 단추·창 줄·반포 → 시행 중·다른 줄 기다림 흐림");

                // ⑤ 저장
                Begin();
                string j = RealmSaveState.ToJson();
                if (!j.Contains("\"lawsJson\"")) Fail("세이브에 lawsJson 없음");
                RealmLaws.Restore(null);
                if (RealmLaws.Enacted.Count != 0) Fail("옛 세이브인데 법령 남음");
                RealmSaveState.ApplyJson(j);
                if (!RealmLaws.Has("commerce") || RealmLaws.WaitMonths(RealmLaws.NowIndex) != RealmLaws.GapMonths) Fail("저장 왕복(법령·간격)");
                End("save OK - lawsJson 왕복(법령·6달 간격)·옛 세이브 빈 법전");

                // ⑥ 손잡이
                Begin();
                RealmLaws.On = false;
                if (RealmLaws.GoldMul != 1f || RealmLaws.Enact("draft", RealmLaws.NowIndex + 99) != "law.why_off") Fail("껐는데 효과·반포");
                End("off OK - 손잡이 끄면 효과·반포 없음");
            }
            finally
            {
                RealmLaws.On = true;
                RealmLaws.CitiesForTest = -1;
                RealmSaveState.ApplyJson(json0);
                RealmLawUi.Instance?.Close();
            }
            return _ok;
        }

        /// <summary>세이브에서 다시 시작해 법령 하나(없으면 빈 법전)로 진짜 다음 달 — (금 수입, 그 성 군량 변화, 그 성 먹은 군량).</summary>
        private static (int income, int dFood, int eat) Month(string json, string city, string law)
        {
            RealmSaveState.ApplyJson(json);
            RealmLaws.ResetForTest();
            if (law != null) RealmLaws.Enact(law, RealmLaws.NowIndex);
            var r = RealmCityState.CityRecord(city);
            r.Food = 1000000;
            r.Troops = Mathf.Max(r.Troops, 5000); // 먹음이 0 이면 둔전령을 못 본다
            int eat = Mathf.RoundToInt(r.Troops / 1000f * RealmCityState.FoodPer1000 * RealmLaws.EatMul);
            int f0 = r.Food;
            string s = RealmCityState.NextMonth();
            var m = Regex.Match(s, "\\+(\\d+)-");
            int income = m.Success ? int.Parse(m.Groups[1].Value) : -1;
            return (income, RealmCityState.CityRecord(city).Food - f0, eat);
        }

        private static bool Near(float a, float b) => Mathf.Abs(a - b) < 0.001f;

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
