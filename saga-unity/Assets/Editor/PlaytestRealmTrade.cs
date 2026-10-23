using UnityEngine;
using Saga.Realm.Data;
using Saga.Realm.UI;

namespace Saga.EditorTools
{
    /// <summary>
    /// tasks U-0172 교역로(웹 W-0301 · 고돗 G-0310) 진단 — `PlaytestRealmSlice` 불가사의(wonder) 뒤에 부른다(한 프레임 안).
    /// 다섯 줄: ① 길(허창→진류→복양 · 적 성 막힘 · 함락한 소패까지 이어짐) ② 띄우기(금 300 나감·같은 길·둘까지·금 모자람·남의 성 거절)
    /// ③ 달(달마다 (상업 합)×0.1×금 배율·12달째 돌아옴) ④ 끊김(길 가운데 성을 잃으면 그 달 상단을 잃고 금 없음)
    /// ⑤ 저장 왕복·옛 세이브 빈 것·기술 창 단추 → 교역로 창·후보 줄·겹침 0. 끝나면 세이브 JSON 을 시작 때로.
    /// </summary>
    public static class PlaytestRealmTrade
    {
        private const string T = "[PlaytestRealmSlice] trade";
        private static bool _ok, _step;

        public static bool Run()
        {
            _ok = true;
            string json0 = RealmSaveState.ToJson();
            try
            {
                RealmTrade.ResetForTest();
                RealmTrade.BlockedForTest = null;
                const string xu = "xuchang", ch = "chenliu", pu = "puyang", xp = RealmEnemyCity.XiaopeiId;

                // ① 길
                Begin();
                var p = RealmTrade.Path(xu, pu);
                if (p == null || string.Join(">", p) != "xuchang>chenliu>puyang") Fail($"허창→복양 길 {(p == null ? "없음" : string.Join(">", p))}");
                bool xpOurs = RealmCityState.CityRecord(xp) != null;
                if (!xpOurs)
                {
                    if (RealmTrade.Path(xu, xp) != null) Fail("함락 안 한 소패까지 길이 남");
                    RealmCityState.AbsorbCity(xp, 3600, 800, 40, 100);
                }
                p = RealmTrade.Path(pu, xp);
                if (p == null || string.Join(">", p) != "puyang>chenliu>xuchang>xiaopei") Fail($"복양→소패 길 {(p == null ? "없음" : string.Join(">", p))}");
                End($"path OK - 허창>진류>복양 · {(xpOurs ? "소패 이미 우리 것" : "함락 안 한 소패 막힘")} · 함락 뒤 복양>진류>허창>소패");

                // ② 띄우기
                Begin();
                Gold(100);
                if (RealmTrade.Start(xu, pu) == null) Fail("금 100 인데 띄워짐");
                Gold(10000);
                string foe = null;
                foreach (var id in RealmEnemyCity.AllIds) if (RealmCityState.CityRecord(id) == null) { foe = id; break; }
                if (foe != null && RealmTrade.Why(foe, xu) == null) Fail("남의 성에서 띄워짐");
                if (RealmTrade.Start(xu, pu) != null || RealmCityState.Gold != 10000 - RealmTrade.Cost) Fail($"띄우기 금 {RealmCityState.Gold}");
                if (RealmTrade.Start(pu, xu) == null) Fail("같은 길을 거꾸로 또 띄움");
                if (RealmTrade.Start(ch, xp) != null) Fail("둘째 상단이 안 뜸");
                if (RealmTrade.Start(xu, ch) == null || RealmTrade.Routes.Count != 2) Fail($"셋째가 뜸 {RealmTrade.Routes.Count}");
                End("start OK - 금 300 나감 · 금 모자람·남의 성·같은 길(거꾸로)·셋째 거절");

                // ③ 달
                Begin();
                int inc = RealmTrade.IncomeOf(xu, pu) + RealmTrade.IncomeOf(ch, xp);
                var a = RealmCityState.CityRecord(xu); var b = RealmCityState.CityRecord(pu);
                int want = Mathf.RoundToInt((a.Comm + b.Comm) * RealmTrade.Rate * RealmTechData.Mul("goldPct"));
                if (RealmTrade.IncomeOf(xu, pu) != want || want <= 0) Fail($"허창↔복양 수입 {RealmTrade.IncomeOf(xu, pu)} ≠ {want}");
                int g0 = RealmCityState.Gold;
                RealmTrade.Monthly();
                if (RealmCityState.Gold != g0 + inc || RealmTrade.Routes[0].left != RealmTrade.Months - 1) Fail($"한 달 금 +{RealmCityState.Gold - g0}(≠{inc})·남은 달 {RealmTrade.Routes[0].left}");
                string back = "";
                for (int i = 1; i < RealmTrade.Months; i++) { var ls = RealmTrade.Monthly(); if (ls.Count > 0) back = ls[0]; }
                if (RealmTrade.Routes.Count != 0 || !back.Contains("🐫")) Fail($"12달째 안 돌아옴 {RealmTrade.Routes.Count}·{back}");
                End($"month OK - 달마다 금 +{inc}(상업 합×0.1×금 배율) · 12달째 돌아옴「{back}」");

                // ④ 끊김
                Begin();
                Gold(10000);
                RealmTrade.Start(pu, xp);
                RealmTrade.BlockedForTest = xu; // 길 가운데 허창을 잃음
                g0 = RealmCityState.Gold;
                var lost = RealmTrade.Monthly();
                if (RealmTrade.Routes.Count != 0 || RealmCityState.Gold != g0 || lost.Count != 1 || !lost[0].Contains("✂️")) Fail($"끊김 상단 {RealmTrade.Routes.Count}·금 +{RealmCityState.Gold - g0}·줄 {lost.Count}");
                RealmTrade.BlockedForTest = null;
                End("cut OK - 길 가운데 성을 잃으면 그 달 상단을 잃고 금 없음");

                // ⑤ 저장·창
                Begin();
                Gold(10000);
                RealmTrade.Start(xu, pu);
                string j = RealmSaveState.ToJson();
                if (!j.Contains("\"tradeJson\"")) Fail("세이브에 tradeJson 없음");
                RealmTrade.Restore(null);
                if (RealmTrade.Routes.Count != 0) Fail("옛 세이브(없음)인데 상단이 남음");
                RealmSaveState.ApplyJson(j);
                if (RealmTrade.Routes.Count != 1 || RealmTrade.Routes[0].to != pu) Fail("저장 왕복에 상단이 안 돌아옴");
                var tech = RealmTechUi.Instance;
                if (tech == null || tech.TradeButton == null) Fail("기술 창에 교역 단추 없음");
                else
                {
                    RealmCityState.SetCurrentCity(xu);
                    tech.TradeButton.onClick.Invoke();
                    var ui = RealmTradeUi.Instance;
                    string cn = RealmTrade.CityName(pu);
                    if (ui == null || !ui.PanelOpen || !ui.RoutesText.Contains(cn) || ui.RowText(0) == "") Fail($"교역로 창이 안 열림·상단 줄·후보 줄「{ui?.RoutesText}」「{ui?.RowText(0)}」");
                    else
                    {
                        int bad = Overlaps(ui.Root);
                        if (bad != 0) Fail($"교역로 창 겹침·밖 {bad}");
                        ui.Close();
                    }
                }
                End("save OK - tradeJson 왕복·옛 세이브 빈 것·기술 창 단추 → 창(상단 줄·후보)·겹침 0");
            }
            finally
            {
                RealmTrade.BlockedForTest = null;
                RealmSaveState.ApplyJson(json0);
                RealmTradeUi.Instance?.Close();
            }
            return _ok;
        }

        private static void Gold(int n)
        {
            RealmCityState.TrySpendGold(RealmCityState.Gold);
            RealmCityState.AddGold(n);
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
