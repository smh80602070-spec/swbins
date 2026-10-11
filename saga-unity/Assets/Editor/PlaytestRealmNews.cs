using System.Collections.Generic;
using System.Linq;
using UnityEngine;
using Saga.Realm.Data;

namespace Saga.EditorTools
{
    /// <summary>
    /// tasks U-0094 영내 소식(웹 사가천하 W-0105) 진단 — `PlaytestRealmSlice` 세 시대 단계 끝(전 성이 우리 것)에 부른다(한 프레임 안).
    /// ① 표 열둘·키 겹침 0·대사 두 벌·갈래 셋이 서로 다른 축(금만 / 병사·훈련만 / 치안만) ② 씨앗 굴림 — 성마다 12%·한 달 한 장·성 없으면 없음
    /// ③ 월간 추첨: 기존 사건(18%)이 먼저, 빈 달에 소식 — 600달에 소식·사건 둘 다 나옴·손잡이 끄면 소식 0 ④ Resolve 금/병/민심이 그 축만
    /// ⑤ 말하는 이 = 태수(`GovernorOf`)·용맹이면 거친 말 ⑥ 서술(제목·본문·갈래 셋 빈칸 없음) ⑦ ko/en.
    /// 끝나면 금·성 값·사건 상태를 시작 때로.
    /// </summary>
    public static class PlaytestRealmNews
    {
        private const string T = "[PlaytestRealmSlice] news";
        private static bool _ok;

        public static bool Run()
        {
            _ok = true;
            var snaps = RealmCityState.SnapshotCities();
            int gold0 = RealmCityState.Gold;
            bool on0 = RealmEventState.NewsEnabled;
            string m = "";
            try
            {
                RealmEventState.ClearForTest();
                // ① 표
                if (RealmNews.All.Length != 12) Fail($"소식 {RealmNews.All.Length} ≠ 12");
                if (RealmNews.All.Select(n => n.Key).Distinct().Count() != RealmNews.All.Length) Fail("키 겹침");
                foreach (var n in RealmNews.All)
                {
                    if (string.IsNullOrEmpty(n.Rough) || string.IsNullOrEmpty(n.Gentle) || n.Rough == n.Gentle) Fail($"{n.Key} 대사 두 벌");
                    if (n.Util.Gold <= 0 || n.Util.Troops + n.Util.Train + n.Util.Sec != 0) Fail($"{n.Key} 금 갈래 축");
                    if (n.Atk.Troops + n.Atk.Train <= 0 || n.Atk.Gold + n.Atk.Sec != 0) Fail($"{n.Key} 병 갈래 축");
                    if (n.Def.Sec <= 0 || n.Def.Gold + n.Def.Troops + n.Def.Train != 0) Fail($"{n.Key} 민심 갈래 축");
                    if (!n.Text.Contains("{0}")) Fail($"{n.Key} 본문에 성 자리 없음");
                }

                // ② 씨앗 굴림
                var cities = RealmCityState.ActiveCityIds;
                var rng = new System.Random(20260824);
                int hit = 0, months = 2000;
                for (int i = 0; i < months; i++)
                    if (RealmNews.Roll(() => (float)rng.NextDouble(), k => rng.Next(k)) != null) hit++;
                float expect = 1f - Mathf.Pow(1f - RealmNews.Chance, Mathf.Min(RealmNews.MaxCitiesPerMonth, cities.Count));
                float got = hit / (float)months;
                if (Mathf.Abs(got - expect) > 0.05f) Fail($"굴림 비율 {got:0.000} ≠ 기대 {expect:0.000}(성 {cities.Count}, 넷까지)");
                if (RealmNews.Roll(() => 0.99f, k => 0) != null) Fail("12% 밖인데 소식이 뜸");
                string first = RealmNews.Roll(() => 0f, k => 0);
                if (first != RealmNews.All[0].Key + "|" + cities[0]) Fail($"첫 성 첫 소식 키 {first}");
                m += $" 굴림 {got:0.00}(기대 {expect:0.00}·성 {cities.Count})";

                // ③ 월간 추첨 — 기존 사건 먼저, 빈 달에 소식
                int news = 0, other = 0, none = 0;
                for (int i = 0; i < 600; i++)
                {
                    RealmEventState.ClearForTest();
                    RealmEventState.RollForMonth();
                    var c = RealmEventState.Current;
                    if (!c.HasValue) none++;
                    else if (c.Value.Kind == RealmEventState.Kind.News) news++;
                    else other++;
                }
                if (news == 0 || other == 0) Fail($"월간 추첨 소식 {news}·사건 {other}");
                RealmEventState.NewsEnabled = false;
                for (int i = 0; i < 200; i++)
                {
                    RealmEventState.ClearForTest();
                    RealmEventState.RollForMonth();
                    if (RealmEventState.Current.HasValue && RealmEventState.Current.Value.Kind == RealmEventState.Kind.News) { Fail("끈 채 소식이 뜸"); break; }
                }
                RealmEventState.NewsEnabled = true;
                m += $" · 600달 소식 {news}·사건 {other}·없음 {none}";

                // ④ Resolve 축
                string city = cities[0];
                string key = "harvest|" + city;
                var h = RealmNews.Get("harvest");
                var rec = RealmCityState.CityRecord(city);
                int g = RealmCityState.Gold, tr = rec.Troops, tn = rec.Train, sc = rec.Sec;
                RealmEventState.Resolve(new RealmEventState.Card(RealmEventState.Kind.News, key), RealmEventState.Choice.A);
                if (RealmCityState.Gold != g + h.Util.Gold || rec.Troops != tr || rec.Train != tn || rec.Sec != sc) Fail("금 갈래가 다른 축을 건드림");
                g = RealmCityState.Gold;
                RealmEventState.Resolve(new RealmEventState.Card(RealmEventState.Kind.News, key), RealmEventState.Choice.B);
                if (RealmCityState.Gold != g || rec.Troops != tr + h.Atk.Troops || rec.Sec != sc) Fail("병 갈래 축");
                tr = rec.Troops;
                int secBefore = rec.Sec;
                RealmEventState.Resolve(new RealmEventState.Card(RealmEventState.Kind.News, key), RealmEventState.Choice.C);
                if (RealmCityState.Gold != g || rec.Troops != tr || rec.Sec != Mathf.Min(100, secBefore + h.Def.Sec)) Fail("민심 갈래 축");
                if (RealmEventState.Current.HasValue) Fail("응답 뒤 카드가 남음");

                // ⑤ 말하는 이·말투
                string sp = RealmNews.SpeakerOf(city);
                if (sp == null) Fail("말하는 이 없음");
                else
                {
                    string gov = RealmActorPlan.GovernorOf(city);
                    if (gov != null && sp != gov) Fail($"말하는 이 {sp} ≠ 태수 {gov}");
                    bool brave = RealmOfficerTraits.Has(sp, RealmOfficerTraits.Trait.Brave);
                    string line = RealmNews.LineOf(h, sp);
                    if (line != (brave ? h.Rough : h.Gentle)) Fail("말투가 특성과 안 맞음");
                    m += $" · {city} 태수 {RealmOfficerPool.Get(sp)?.Name}({(brave ? "거친 말" : "점잖은 말")})";
                }

                // ⑥ 서술
                foreach (var n in RealmNews.All)
                {
                    var (title, body, a, b, c) = RealmEventState.Describe(new RealmEventState.Card(RealmEventState.Kind.News, n.Key + "|" + city));
                    if (string.IsNullOrEmpty(title) || string.IsNullOrEmpty(body) || string.IsNullOrEmpty(a) || string.IsNullOrEmpty(b) || string.IsNullOrEmpty(c) || body.Contains("{0}")) { Fail($"{n.Key} 서술 빔"); break; }
                }

                // ⑧ 토스트 겹침(U-0097) — 카드가 떠 있으면 토스트가 위 띠로, 카드 판과 화면에서 안 겹침 · 닫히면 원래 자리
                var toast = Saga.Realm.UI.RealmToast.Instance;
                var cmd = Object.FindFirstObjectByType<Saga.Realm.UI.RealmCommandUi>();
                var panelGo = cmd != null ? typeof(Saga.Realm.UI.RealmCommandUi).GetField("_eventPanel", System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Instance)?.GetValue(cmd) as GameObject : null;
                if (toast == null || panelGo == null) Fail($"토스트 {toast != null}·카드 판 {panelGo != null} 없음");
                else
                {
                    RealmEventState.ClearForTest();
                    for (int i = 0; i < 300 && !(RealmEventState.Current.HasValue && RealmEventState.Current.Value.Kind == RealmEventState.Kind.News); i++) { RealmEventState.ClearForTest(); RealmEventState.RollForMonth(); }
                    toast.Show("시험 토스트", 2f);
                    Canvas.ForceUpdateCanvases();
                    if (!toast.Raised) Fail("카드가 떠 있는데 토스트가 아래 띠로 안 옮김");
                    var a1 = ScreenRect(toast.LabelRect);
                    var a2 = ScreenRect((RectTransform)panelGo.transform);
                    if (!panelGo.activeInHierarchy) Fail("소식 카드가 떴는데 카드 판이 안 켜짐");
                    else if (a1.Overlaps(a2)) Fail($"토스트 {a1} 가 카드 판 {a2} 와 겹침");
                    RealmEventState.ClearForTest();
                    toast.Show("시험 토스트", 2f);
                    if (toast.Raised) Fail("카드가 없는데 아래 띠에 남음");
                    m += $" · 토스트 아래 띠(겹침 0, 토스트 {a1.yMin:0}~{a1.yMax:0} · 카드 {a2.yMin:0}~{a2.yMax:0})";
                }

                // ⑦ ko/en
                foreach (var lang in new[] { "ko", "en" })
                {
                    var ta = Resources.Load<TextAsset>($"Localization/realm_{lang}");
                    foreach (var k in new[] { "news.title", "news.says", "news.hint.gold", "news.hint.troops", "news.hint.train", "news.hint.sec", "news.done" })
                        if (ta == null || !ta.text.Contains($"\"{k}\"")) Fail($"{lang} 키 {k} 없음");
                }
            }
            finally
            {
                RealmEventState.NewsEnabled = on0;
                RealmEventState.ClearForTest();
                foreach (var s in snaps)
                {
                    var r = RealmCityState.CityRecord(s.CityId);
                    if (r == null) continue;
                    RealmCityState.AdjustCity(s.CityId, sec: s.Sec - r.Sec, troops: s.Troops - r.Troops, train: s.Train - r.Train);
                }
                int dg = RealmCityState.Gold - gold0;
                if (dg > 0) RealmCityState.TrySpendGold(dg); else if (dg < 0) RealmCityState.AddGold(-dg);
            }
            if (_ok) Debug.Log($"{T} OK - 소식 12·대사 두 벌·갈래 축 셋 · 굴림 성마다 12%·한 달 한 장 · 사건 먼저·빈 달에 소식·손잡이 · Resolve 축 · 태수 말투 · 서술 · ko/en |{m}");
            return _ok;
        }

        private static Rect ScreenRect(RectTransform rt)
        {
            var c = new Vector3[4];
            rt.GetWorldCorners(c);   // 오버레이 캔버스 — 월드 코너 = 화면 좌표
            return Rect.MinMaxRect(c[0].x, c[0].y, c[2].x, c[2].y);
        }

        private static void Fail(string why)
        {
            _ok = false;
            Debug.LogError($"{T} FAIL - {why}");
        }
    }
}
