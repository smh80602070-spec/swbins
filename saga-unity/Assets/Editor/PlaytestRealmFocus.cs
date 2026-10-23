using System.Text.RegularExpressions;
using UnityEngine;
using Saga.Realm.Data;
using Saga.Realm.UI;

namespace Saga.EditorTools
{
    /// <summary>
    /// tasks U-0193 국가 방침 나무(고돗 G-0336 짝) 진단 — `PlaytestRealmSlice` 법령(laws) 뒤에 부른다(한 프레임 안).
    /// ① 나무(근본 먼저 · 한 번에 하나 · 부국 고르면 강병 닫힘 · 둔전 확장 또는 조련 뒤 인재 · 대계) ② 달 끝(진짜 NextMonth — 3달 뒤 근본 완수·금 +300·알림 줄)
    /// ③ 곱(끝낸 것 없으면 1 · 부국 금 수입 ×1.1 진짜 NextMonth · 대계 계략·수확 · 강병·조련·인재 곱) ④ 창(☰ 칸 단추·줄·고른다)
    /// ⑤ 저장 왕복·옛 세이브·없는 방침 버림 ⑥ 손잡이. 끝나면 세이브 JSON·손잡이를 시작 때로.
    /// </summary>
    public static class PlaytestRealmFocus
    {
        private const string T = "[PlaytestRealmSlice] focus";
        private static bool _ok, _step;

        public static bool Run()
        {
            _ok = true;
            string json0 = RealmSaveState.ToJson();
            try
            {
                RealmFocus.ResetForTest();

                // ① 나무
                Begin();
                if (RealmFocus.Pick("rich") == null) Fail("근본 없이 부국");
                if (RealmFocus.Pick("root") != null || RealmFocus.Current != "root" || RealmFocus.Left != 3) Fail("근본 고르기");
                if (RealmFocus.Pick("root") == null) Fail("진행 중 또 고름");
                Finish();
                if (!RealmFocus.IsDone("root")) Fail("근본 완수 안 됨");
                if (RealmFocus.Pick("rich") != null) Fail("근본 뒤 부국");
                if (RealmFocus.Why("army") == null) Fail("부국 진행 중인데 강병 열림");
                Finish();
                if (RealmFocus.Pick("army") == null || !RealmFocus.Locked("army")) Fail("부국 뒤 강병 안 닫힘");
                if (RealmFocus.Pick("talent") == null) Fail("둔전 확장 없이 인재");
                RealmFocus.Pick("farm"); Finish();
                if (RealmFocus.Pick("talent") != null) Fail("둔전 확장 뒤 인재");
                Finish();
                if (RealmFocus.Pick("grand") != null) Fail("인재 뒤 대계");
                Finish();
                if (RealmFocus.Done.Count != RealmFocus.MaxDone) Fail($"완수 {RealmFocus.Done.Count} ≠ {RealmFocus.MaxDone}");
                End($"tree OK - 근본 먼저·한 번에 하나·부국 → 강병 닫힘(「{RealmFocus.Why("army")}」)·둔전 확장 뒤 인재·대계 · 완수 {RealmFocus.Done.Count}");

                // ② 달 끝(진짜 NextMonth)
                Begin();
                RealmSaveState.ApplyJson(json0);
                RealmFocus.ResetForTest();
                RealmFocus.Pick("root");
                string m1 = RealmCityState.NextMonth(), m2 = RealmCityState.NextMonth();
                bool early = m1.Contains("나라의 근본") || m2.Contains("나라의 근본") || RealmFocus.Left != 1;
                string mid = RealmSaveState.ToJson();               // 근본 1달 남은 자리
                string m3 = RealmCityState.NextMonth();
                int gWith = RealmCityState.Gold;
                RealmSaveState.ApplyJson(mid);
                RealmFocus.ResetForTest();                          // 같은 달을 방침 없이
                RealmCityState.NextMonth();
                int dg = gWith - RealmCityState.Gold;
                if (early) Fail("3달 전에 끝남");
                if (!m3.Contains("나라의 근본") || dg != 300) Fail($"근본 완수 금 차이 {dg} ≠ 300 「{m3}」");
                End($"month OK - 3달 뒤 근본 완수(앞 두 달은 진행) · 같은 달 방침 없이보다 금 +{dg} · 「{Last(m3)}」");

                // ③ 곱
                Begin();
                RealmFocus.ResetForTest();
                if (RealmFocus.Mul("gold") != 1f || RealmFocus.Mul("food") != 1f || RealmFocus.Mul("draft") != 1f || RealmFocus.Mul("train") != 1f || RealmFocus.Mul("hire") != 1f || RealmFocus.Mul("plot") != 1f) Fail("끝낸 것 없는데 곱");
                int iB = MonthIncome(json0, false), iR = MonthIncome(json0, true);
                if (iB <= 0 || Mathf.Abs(iR - Mathf.RoundToInt(iB * 1.1f)) > 1) Fail($"부국 금 +{iR} ≠ {iB}×1.1");
                RealmFocus.Restore("{\"done\":[\"root\",\"army\",\"drill\",\"talent\",\"grand\"],\"cur\":\"\",\"left\":0}");
                if (!Near(RealmFocus.Mul("draft"), 1.15f) || !Near(RealmFocus.Mul("train"), 1.1f) || !Near(RealmFocus.Mul("hire"), 1.15f) || !Near(RealmFocus.Mul("plot"), 1.1f) || !Near(RealmFocus.Mul("gold"), 1.05f) || !Near(RealmFocus.Mul("food"), 1.05f))
                    Fail($"강병 길 곱 징병 {RealmFocus.Mul("draft")} 훈련 {RealmFocus.Mul("train")} 등용 {RealmFocus.Mul("hire")} 계략 {RealmFocus.Mul("plot")} 금 {RealmFocus.Mul("gold")}");
                End($"mul OK - 없으면 1 · 부국 금 수입 {iB}→{iR}(진짜 NextMonth) · 강병 길 징병 ×1.15·훈련 ×1.1·등용 ×1.15·대계 계략 ×1.1·금·수확 ×1.05");

                // ④ 창
                Begin();
                RealmSaveState.ApplyJson(json0);
                RealmFocus.ResetForTest();
                var ui = RealmFocusUi.Instance;
                if (ui == null || ui.ToggleButton == null) Fail("창·단추 없음");
                else
                {
                    ui.ToggleButton.onClick.Invoke();
                    if (!ui.PanelOpen || !ui.RowText(0).Contains("나라의 근본") || !ui.RowButton(0).interactable || ui.RowButton(1).interactable) Fail($"창 줄「{ui.RowText(0)}」");
                    ui.RowButton(0).onClick.Invoke();
                    if (RealmFocus.Current != "root" || !ui.RowText(0).Contains("⏳") || !ui.InfoText.Contains("나라의 근본")) Fail($"고른다 —「{ui.RowText(0)}」·「{ui.InfoText}」");
                    End($"ui OK -「{ui.RowText(0)}」·「{ui.RowText(1)}」·「{ui.InfoText}」");
                    ui.Close();
                }

                // ⑤ 저장
                Begin();
                RealmFocus.Restore("{\"done\":[\"root\",\"rich\"],\"cur\":\"farm\",\"left\":2}");
                string snap = RealmFocus.Snapshot();
                if (!RealmSaveState.ToJson().Contains("\"focusJson\"")) Fail("세이브에 focusJson 없음");
                RealmFocus.Restore(null);
                if (RealmFocus.Done.Count != 0 || RealmFocus.Current.Length != 0) Fail("옛 세이브인데 방침");
                RealmFocus.Restore(snap);
                if (RealmFocus.Done.Count != 2 || RealmFocus.Current != "farm" || RealmFocus.Left != 2) Fail("왕복");
                RealmFocus.Restore("{\"done\":[\"ghost\",\"root\"],\"cur\":\"nope\",\"left\":3}");
                if (RealmFocus.Done.Count != 1 || RealmFocus.Current.Length != 0 || RealmFocus.Left != 0) Fail("없는 방침을 받음");
                End("save OK - focusJson 왕복(끝낸 것·진행·남은 달)·옛 세이브 = 없음·없는 방침 버림");

                // ⑥ 손잡이
                Begin();
                RealmFocus.Restore(snap);
                RealmFocus.On = false;
                if (RealmFocus.Mul("gold") != 1f || RealmFocus.Pick("army") == null || RealmFocus.Monthly(out _).Count != 0) Fail("껐는데 방침");
                End("off OK - 끄면 곱 1·못 고름·달 끝 그대로");
            }
            finally
            {
                RealmFocus.On = true;
                RealmSaveState.ApplyJson(json0);
                RealmFocusUi.Instance?.Close();
            }
            return _ok;
        }

        /// <summary>진행 중 방침을 달 끝 없이 마저 끝낸다(나무 시험용).</summary>
        private static void Finish() { int n = 0; while (RealmFocus.Current.Length > 0 && n++ < 10) RealmFocus.Monthly(out _); }

        /// <summary>세이브에서 다시 시작해 (부국 끝냄 여부)로 진짜 다음 달 — 금 수입.</summary>
        private static int MonthIncome(string json, bool rich)
        {
            RealmSaveState.ApplyJson(json);
            RealmFocus.Restore(rich ? "{\"done\":[\"root\",\"rich\"],\"cur\":\"\",\"left\":0}" : null);
            return Income(RealmCityState.NextMonth());
        }

        private static int Income(string s) { var m = Regex.Match(s, "\\+(\\d+)-"); return m.Success ? int.Parse(m.Groups[1].Value) : -1; }
        private static string Last(string s) { var l = s.Split('\n'); foreach (var x in l) if (x.Contains("방침")) return x; return l[l.Length - 1]; }
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
