using UnityEngine;
using Saga.Realm.Data;
using Saga.Realm.UI;

namespace Saga.EditorTools
{
    /// <summary>
    /// tasks U-0136 불가사의 경쟁(웹 W-0279) 진단 — `PlaytestRealmSlice` 진·보급선(supply) 뒤에 부른다(한 프레임 안).
    /// 다섯 줄: ① 문(큰 도면)·금·인부 모자람 거절 ② 착공(금·인부 나감)·한 번에 하나·달마다 −1·완공 효과가 Pct 에·인부 귀환
    /// ③ 경쟁 — 적 성이 먼저 지으면 우리 것은 금 반 환급·인부 귀환, 적 장벽은 그 성 수비 ×1.1 ④ 적 착공(12달 문 뒤 hash 달에, 병력에서 인부)
    /// ⑤ 저장 왕복·옛 세이브 빈 것·기술 창 단추 → 불가사의 창 여섯 줄·겹침 0. 끝나면 세이브 JSON 을 시작 때로.
    /// </summary>
    public static class PlaytestRealmWonder
    {
        private const string T = "[PlaytestRealmSlice] wonder";
        private static bool _ok, _step;

        public static bool Run()
        {
            _ok = true;
            string json0 = RealmSaveState.ToJson();
            try
            {
                RealmWonder.ResetForTest();
                RealmWonder.RivalOn = false;
                string city = RealmCityState.CurrentCity;
                var rec = RealmCityState.CityRecord(city);

                // ① 문·모자람
                Begin();
                RealmTechData.Restore(0, null);
                if (RealmWonder.Why("bridge", city) == null) Fail("큰 도면 없이 지어짐");
                RealmTechData.Restore(0, new[] { "l1", "l2", "l3" });
                if (!RealmTechData.WonderOpen) Fail("l1~l3 연구했는데 문이 안 열림");
                rec.Troops = 10000;
                Gold(100);
                if (RealmWonder.Why("bridge", city) == null) Fail("금 100 인데 지어짐");
                Gold(10000);
                rec.Troops = 2200;
                if (RealmWonder.Why("bridge", city) == null) Fail("인부 2000+500 모자란데 지어짐");
                End("gate OK - 큰 도면(l3) 문·금·인부(+500 여유) 모자라면 거절");

                // ② 착공·완공
                Begin();
                rec.Troops = 10000;
                Gold(10000);
                int atk0 = RealmTechData.Pct("atkPct");
                if (RealmWonder.Start("bridge", city) != null || RealmCityState.Gold != 10000 - 2400 || rec.Troops != 8000) Fail($"착공 금 {RealmCityState.Gold}·병력 {rec.Troops}");
                if (RealmWonder.Start("farm", city) == null) Fail("짓는 중인데 또 착공");
                for (int i = 0; i < 5; i++) RealmWonder.Monthly();
                if (RealmWonder.BuiltOf("bridge") != null) Fail("5달에 완공(6달)");
                RealmWonder.Monthly();
                var b = RealmWonder.BuiltOf("bridge");
                if (b == null || b.by != RealmWonder.Me || RealmTechData.Pct("atkPct") != atk0 + 6 || rec.Troops != 10000) Fail($"완공 {b?.by}·공격 {RealmTechData.Pct("atkPct")}/{atk0 + 6}·병력 {rec.Troops}");
                if (RealmWonder.Why("bridge", city) == null) Fail("다 지은 것을 또 지음");
                End("build OK - 금 2400·인부 2000 나감·한 번에 하나·6달째 완공·공격 +6% 가 Pct 에·인부 귀환");

                // ③ 경쟁
                Begin();
                string enemy = null;
                foreach (var id in RealmEnemyCity.AllIds) { enemy = id; break; }
                var er = RealmWarState.Get(enemy);
                er.Captured = false;
                Gold(10000);
                RealmWonder.Start("farm", city);
                RealmWonder.RivalStartForTest(enemy, "farm", 2);
                int g = RealmCityState.Gold;
                RealmWonder.Monthly(); RealmWonder.Monthly();
                var f = RealmWonder.BuiltOf("farm");
                if (f == null || f.by != enemy || RealmWonder.JobOf(RealmWonder.Me) != null || RealmCityState.Gold != g + 1300 || rec.Troops != 10000) Fail($"늦은 우리: 지은 쪽 {f?.by}·금 +{RealmCityState.Gold - g}(1300)·병력 {rec.Troops}");
                if (RealmWonder.Pct("foodPct") != 0) Fail("적이 지은 장원이 우리 몫에 듦");
                RealmWonder.RivalStartForTest(enemy, "wall", 1);
                RealmWonder.Monthly();
                if (!Mathf.Approximately(RealmWonder.EnemyMul(enemy, "defPct"), 1.1f)) Fail($"적 장벽 수비 {RealmWonder.EnemyMul(enemy, "defPct")}");
                End("race OK - 적이 먼저 → 우리 금 반(1300)·인부 귀환 · 적 몫은 우리 Pct 밖 · 적 장벽 = 그 성 수비 ×1.1");

                // ④ 적 착공
                Begin();
                RealmWonder.ResetForTest();
                RealmTechData.Restore(0, null);
                er.Troops = 5000;
                RealmWonder.SetFirstForTest(12);
                int t0 = er.Troops, months = 0;
                while (RealmWonder.JobOf(enemy) == null && months < 36) { RealmCityState.NextMonth(); months++; er.Captured = false; }
                var job = RealmWonder.JobOf(enemy);
                if (job == null) Fail("36달 동안 적 성이 착공 안 함");
                else if (job.men <= 0 || er.Troops > t0 - job.men + 1) Fail($"적 인부 {job.men}·병력 {t0}→{er.Troops}");
                End($"rival OK - 12달 뒤 {months}달째 {enemy} 착공({job?.id}, 인부 {job?.men} = 웹 ×0.25)");

                // ⑤ 저장·창
                Begin();
                string j = RealmSaveState.ToJson();
                if (!j.Contains("\"wonderJson\"")) Fail("세이브에 wonderJson 없음");
                RealmWonder.Restore(null);
                if (RealmWonder.Jobs.Count != 0) Fail("옛 세이브(없음)인데 공사가 남음");
                RealmSaveState.ApplyJson(j);
                if (RealmWonder.JobOf(enemy) == null) Fail("저장 왕복에 적 공사가 안 돌아옴");
                var tech = RealmTechUi.Instance;
                if (tech == null || tech.WonderButton == null) Fail("기술 창에 불가사의 단추 없음");
                else
                {
                    tech.WonderButton.onClick.Invoke();
                    var ui = RealmWonderUi.Instance;
                    if (ui == null || !ui.PanelOpen || !ui.RowText(5).Contains(RealmWonder.All[5].Name)) Fail("불가사의 창이 안 열림·여섯째 줄");
                    else
                    {
                        int bad = Overlaps(ui.Root);
                        if (bad != 0) Fail($"불가사의 창 겹침·밖 {bad}");
                        ui.Close();
                    }
                }
                End("save OK - wonderJson 왕복·옛 세이브 빈 것·기술 창 단추 → 창 여섯 줄·겹침 0");
            }
            finally
            {
                RealmSaveState.ApplyJson(json0);
                RealmWonder.RivalOn = true;
                RealmWonderUi.Instance?.Close();
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
