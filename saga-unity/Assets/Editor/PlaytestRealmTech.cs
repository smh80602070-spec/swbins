using UnityEngine;
using Saga.Realm.Data;
using Saga.Realm.UI;

namespace Saga.EditorTools
{
    /// <summary>
    /// tasks U-0129 기술 나무(웹 사가천하 W-0290) 진단 — `PlaytestRealmSlice` 격자 전술(tactics) 뒤에 부른다(한 프레임 안).
    /// 다섯 줄: ① 연구점 — 12달 누적(1 + 학자 ≤4)·"다음 달" 이 실제로 더함 ② 차례대로만(앞 마디가 문)·모자라면 거절·점 차감 ③ 조선 비용 −20%·훈련은
    /// 그대로 → 조련 틀 뒤 −20%·명령 금이 실제로 그만큼 빠짐(물가 성일 때) ④ 효과 — 금·군량 배율·계략 성공률 오름·학 3마디 문·연구 0 이면 전부 ×1
    /// ⑤ 세이브 왕복·옛 세이브 0·순서 어긴 저장은 앞에서 끊음·창(열기·줄 넷·연구 단추). 끝나면 세이브 JSON 으로 되돌린다.
    /// </summary>
    public static class PlaytestRealmTech
    {
        private const string T = "[PlaytestRealmSlice] tech";
        private static bool _ok, _step;

        public static bool Run()
        {
            _ok = true;
            string json0 = RealmSaveState.ToJson();
            try
            {
                RealmTechData.Restore(0, null);

                // ① 연구점
                Begin();
                int per = RealmTechData.PtsPerMonth();
                if (per != RealmTechData.BasePts + RealmTechData.Scholars() || RealmTechData.Scholars() > RealmTechData.ScholarMax) Fail($"달마다 {per}");
                for (int i = 0; i < 12; i++) RealmTechData.Monthly();
                if (RealmTechData.Points != per * 12) Fail($"12달 {RealmTechData.Points} ≠ {per * 12}");
                int p0 = RealmTechData.Points;
                RealmCityState.NextMonth();
                if (RealmTechData.Points != p0 + per) Fail($"다음 달이 연구점을 안 더함 {RealmTechData.Points - p0}");
                End($"points OK - 달마다 {per}(학자 {RealmTechData.Scholars()}) · 12달 {per * 12} · 다음 달 +{per}");

                // ② 차례
                Begin();
                RealmTechData.Restore(5, null);
                if (RealmTechData.Research("trade", out _) != null) Fail("5점에 6점 마디가 열림");
                RealmTechData.AddPointsForTest(1);
                var n1 = RealmTechData.Research("trade", out _);
                if (n1 == null || n1.Id != "t1" || RealmTechData.Points != 0) Fail("t1 연구·점 차감");
                RealmTechData.AddPointsForTest(9);
                var n2 = RealmTechData.Research("trade", out _);
                if (n2 == null || n2.Id != "t2" || RealmTechData.NextOf("trade").Id != "t3" || RealmTechData.DoneCount("trade") != 2) Fail("차례 t2 → 다음 t3");
                End("order OK - 5점 거절·t1(6)·t2(9) 차례대로·점 차감·다음 t3");

                // ③ 비용
                Begin();
                int ships = RealmOrderData.Get("ships").Gold, train = RealmOrderData.Get("train").Gold;
                if (RealmTechData.Cost("ships", ships) != Mathf.RoundToInt(ships * 0.8f) || RealmTechData.Cost("train", train) != train) Fail("나루 짓기 뒤 비용");
                RealmTechData.Restore(0, new[] { "m1", "m2", "m3" });
                if (RealmTechData.Cost("train", train) != Mathf.RoundToInt(train * 0.8f) || RealmTechData.Cost("ships", ships) != ships) Fail("조련 틀 뒤 비용");
                int g0 = RealmCityState.Gold;
                var r = RealmCityState.ExecuteOrder("train");
                if (r.Ok && g0 - RealmCityState.Gold != Mathf.RoundToInt(train * 0.8f)) Fail($"훈련 명령 금 {g0 - RealmCityState.Gold} ≠ {Mathf.RoundToInt(train * 0.8f)}");
                End($"cost OK - 조선 {ships}→{Mathf.RoundToInt(ships * 0.8f)} · 훈련 {train}→{Mathf.RoundToInt(train * 0.8f)}" + (r.Ok ? "(명령 금 실제 차감)" : "(이 성 훈련 못 함 — 식만)"));

                // ④ 효과
                Begin();
                RealmTechData.Restore(0, null);
                if (RealmTechData.Mul("goldPct") != 1f || RealmTechData.Mul("foodPct") != 1f || RealmTechData.Pct("atkPct") != 0 || RealmTechData.WonderOpen) Fail("연구 0 인데 배율 ≠ 1");
                float plot0 = RealmWarState.PreviewPlotChance(RealmCityState.CurrentCity);
                RealmTechData.Restore(0, new[] { "t1", "t2", "t3", "f1", "f2", "l1", "l2", "l3", "l4" });
                if (Mathf.Abs(RealmTechData.Mul("goldPct") - 1.10f) > 1e-4f || Mathf.Abs(RealmTechData.Mul("foodPct") - 1.10f) > 1e-4f) Fail("금·군량 배율");
                if (!RealmTechData.WonderOpen || !RealmTechData.HasRule("study") || RealmTechData.PtsPerMonth() != per + 1) Fail("학 문·글 모으기");
                float plot1 = RealmWarState.PreviewPlotChance(RealmCityState.CurrentCity);
                if (plot0 > 0f && plot0 < 0.9f && !(plot1 > plot0)) Fail($"계략 성공률 {plot0:0.000} → {plot1:0.000}");
                End($"effects OK - 연구 0 = ×1 · 금·군량 ×1.10 · 큰 도면 문·글 모으기 +1 · 계략 {plot0:0.00}→{plot1:0.00}");

                // ⑤ 세이브·창
                Begin();
                RealmTechData.Restore(7, new[] { "f1", "m1", "m2" });
                string j = RealmSaveState.ToJson();
                RealmTechData.Restore(0, null);
                RealmSaveState.ApplyJson(j);
                if (RealmTechData.Points != 7 || RealmTechData.DoneCount("farm") != 1 || RealmTechData.DoneCount("mil") != 2) Fail("세이브 왕복");
                RealmSaveState.ApplyJson(System.Text.RegularExpressions.Regex.Replace(j, ",\"techPts\":\\d+,\"techDone\":\\[[^\\]]*\\]", ""));
                if (RealmTechData.Points != 0 || RealmTechData.DoneIds.Count != 0) Fail("옛 세이브가 0 이 아님");
                RealmTechData.Restore(0, new[] { "f2", "f1" , "t2" });
                if (RealmTechData.DoneCount("farm") != 2 || RealmTechData.DoneCount("trade") != 0) Fail("순서 어긴 저장(t1 없이 t2)이 안 끊김");
                var ui = RealmTechUi.Instance != null ? RealmTechUi.Instance : RealmTechUi.Install();
                RealmTechData.Restore(6, null);
                if (!ui.PanelOpen) ui.Toggle();
                if (!ui.PanelOpen || !ui.RowText(0).Contains("0/6") || ui.RowButton(0) == null || !ui.RowButton(0).interactable) Fail($"창 — 열림 {ui.PanelOpen} · 첫 줄 {ui.RowText(0)}");
                ui.Press("farm");
                if (RealmTechData.DoneCount("farm") != 1 || !ui.RowText(0).Contains("1/6")) Fail("창 연구 단추");
                ui.Close();
                End("save OK - 세이브 왕복·옛 세이브 0·순서 어긴 저장 끊음·창(줄 넷·연구 단추)");
            }
            finally
            {
                RealmSaveState.ApplyJson(json0);
                if (RealmTechUi.Instance != null) RealmTechUi.Instance.Close();
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
