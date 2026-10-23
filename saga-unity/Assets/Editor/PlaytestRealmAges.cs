using System.Text.RegularExpressions;
using UnityEngine;
using Saga.Realm.Data;
using Saga.Realm.UI;

namespace Saga.EditorTools
{
    /// <summary>
    /// tasks U-0187 국세 올리기(고돗 G-0329 짝) 진단 — `PlaytestRealmSlice` 법령(laws) 뒤에 부른다(한 프레임 안).
    /// ① 표·곱(난세 1 · 단계마다 ×1.05 겹침) ② 올리기 규칙(성·기술 모자람·금 모자람·금을 냄·꼭대기) ③ 진짜 NextMonth 금 수입·수확 ×1.05
    /// ④ 법령 창 맨 위 줄·단추 ⑤ 저장 왕복·옛 세이브 난세 ⑥ 손잡이. 끝나면 세이브 JSON·손잡이를 시작 때로.
    /// </summary>
    public static class PlaytestRealmAges
    {
        private const string T = "[PlaytestRealmSlice] ages";
        private static bool _ok, _step;

        public static bool Run()
        {
            _ok = true;
            string json0 = RealmSaveState.ToJson();
            try
            {
                RealmAges.ResetForTest();
                RealmLaws.ResetForTest();

                // ① 표·곱
                Begin();
                if (RealmAges.Level != 0 || RealmAges.Mul != 1f || RealmAges.Current.Key != "chaos") Fail("시작이 난세·×1 아님");
                var a1 = RealmAges.All[1]; var a3 = RealmAges.All[3];
                if (a1.Cities != 4 || a1.Techs != 4 || a1.Gold != 1500 || a3.Cities != 12 || a3.Techs != 15 || a3.Gold != 6000) Fail("문턱 표");
                End("table OK - 난세 ×1 · 기틀 성 4·기술 4·금 1500 … 성세 성 12·기술 15·금 6000");

                // ② 올리기 규칙
                Begin();
                Gold(100000);
                RealmAges.CitiesForTest = 3; RealmAges.TechsForTest = 4;
                if (RealmAges.Advance() != "age.why_short") Fail("성 3 인데 오름");
                RealmAges.CitiesForTest = 4;
                Gold(1000);
                if (RealmAges.Advance() != "age.why_gold") Fail("금 1000 인데 오름");
                Gold(2000);
                if (RealmAges.Advance() != null || RealmAges.Level != 1 || RealmCityState.Gold != 500 || Mathf.Abs(RealmAges.Mul - 1.05f) > 1e-4f) Fail($"기틀: 단계 {RealmAges.Level}·금 {RealmCityState.Gold}·×{RealmAges.Mul}");
                RealmAges.CitiesForTest = 99; RealmAges.TechsForTest = 99; Gold(100000);
                RealmAges.Advance(); RealmAges.Advance();
                if (RealmAges.Level != 3 || Mathf.Abs(RealmAges.Mul - 1.05f * 1.05f * 1.05f) > 1e-4f || RealmAges.Advance() != "age.why_top") Fail($"성세·꼭대기 {RealmAges.Level}·×{RealmAges.Mul}");
                End($"rule OK - 성 모자람·금 모자람 거절 · 기틀 금 1500 냄·×1.05 · 성세 ×{RealmAges.Mul:0.000}·꼭대기 거절");

                // ③ 진짜 다음 달(수확 달 6월)
                Begin();
                string j6 = Regex.Replace(json0, "\"month\":\\d+", "\"month\":6");
                string city = RealmCityState.ActiveCityIds[0];
                var (g0, h0) = Month(j6, city, 0);
                var (g1, h1) = Month(j6, city, 1);
                if (g0 <= 0 || Mathf.Abs(g1 - Mathf.RoundToInt(g0 * 1.05f)) > 1) Fail($"금 +{g1} ≠ {g0}×1.05");
                if (h0 <= 0 || Mathf.Abs(h1 / (float)h0 - 1.05f) > 0.02f) Fail($"수확 {h1} ≠ {h0}×1.05");
                End($"month OK - 진짜 다음 달: 금 +{g0} → 기틀 +{g1} · 수확 {h0} → {h1}");
                RealmSaveState.ApplyJson(json0);

                // ④ 창
                Begin();
                RealmAges.ResetForTest(); RealmLaws.ResetForTest();
                RealmAges.CitiesForTest = 5; RealmAges.TechsForTest = 5; Gold(5000);
                var ui = RealmLawUi.Instance;
                if (ui == null) Fail("법령 창 없음");
                else
                {
                    ui.Open();
                    if (!ui.AgeText.Contains(RealmAges.All[0].Name) || !ui.AgeText.Contains(RealmAges.All[1].Name) || ui.AgeButton == null || !ui.AgeButton.interactable) Fail($"국세 줄「{ui.AgeText}」·단추");
                    ui.AgeButton.onClick.Invoke();
                    if (RealmAges.Level != 1 || ui.AgeButton.interactable) Fail("단추로 오르기·다음 문턱 흐림");
                    if (ui.RowText(0) == "") Fail("법령 줄이 사라짐");
                    ui.Close();
                }
                End("panel OK - 법령 창 맨 위 국세 줄·올리기 단추 → 기틀·다음 문턱 흐림·법령 줄 그대로");

                // ⑤ 저장
                Begin();
                string j = RealmSaveState.ToJson();
                if (!j.Contains("\"ageJson\"")) Fail("세이브에 ageJson 없음");
                RealmAges.Restore(null);
                if (RealmAges.Level != 0) Fail("옛 세이브인데 단계");
                RealmSaveState.ApplyJson(j);
                if (RealmAges.Level != 1) Fail("저장 왕복");
                End("save OK - ageJson 왕복·옛 세이브 난세");

                // ⑥ 손잡이
                Begin();
                RealmAges.On = false;
                if (RealmAges.Mul != 1f || RealmAges.Advance() != "age.why_off") Fail("껐는데 곱·오름");
                End("off OK - 손잡이 끄면 곱 1·못 올림");
            }
            finally
            {
                RealmAges.On = true;
                RealmAges.CitiesForTest = -1; RealmAges.TechsForTest = -1;
                RealmSaveState.ApplyJson(json0);
                RealmLawUi.Instance?.Close();
            }
            return _ok;
        }

        /// <summary>세이브에서 다시 시작해 국세 단계 lv 로 진짜 다음 달 — (금 수입, 그 성 수확).</summary>
        private static (int income, int harvest) Month(string json, string city, int lv)
        {
            RealmSaveState.ApplyJson(json);
            RealmAges.ResetForTest(); RealmLaws.ResetForTest();
            RealmAges.CitiesForTest = 99; RealmAges.TechsForTest = 99;
            for (int i = 0; i < lv; i++) { Gold(100000); RealmAges.Advance(); }
            var r = RealmCityState.CityRecord(city);
            r.Food = 1000000;
            r.Troops = 0; // 먹음 0 — 군량 변화 = 수확
            int f0 = r.Food;
            string s = RealmCityState.NextMonth();
            var m = Regex.Match(s, "\\+(\\d+)-");
            return (m.Success ? int.Parse(m.Groups[1].Value) : -1, RealmCityState.CityRecord(city).Food - f0);
        }

        private static void Gold(int n)
        {
            RealmCityState.TrySpendGold(RealmCityState.Gold);
            RealmCityState.AddGold(n);
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
