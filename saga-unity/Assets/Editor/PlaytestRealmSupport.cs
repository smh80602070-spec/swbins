using System.Linq;
using UnityEngine;
using Saga.Realm.Data;
using U = Saga.Realm.Data.RealmTactics;

namespace Saga.EditorTools
{
    /// <summary>
    /// tasks U-0231 진단 — `PlaytestRealmSlice` 국가 방침 뒤(한 프레임 안, U-0224 일꾼 줄 곁).
    /// recommend: ① 240달 중 약 열에 하나 결정적 ② 천거 달에 지금 성 숨은 인재가 드러남·줄 ③ 숨은 인재가 없으면 무사 ④ 끔
    /// support: ⑤ 3/7/12 = C/B/A ⑥ 이웃 짝이면 명중 +·맞는 쪽 짝 곁이면 회피 +(가장 큰 하나) ⑦ 판 끝 이웃 쌍 +1·판마다 한 번 ⑧ RTS 판 안 셈 ⑨ 저장 왕복·옛 세이브 빔 ⑩ 끔.
    /// 끝나면 세이브 JSON 을 시작 때로.
    /// </summary>
    public static class PlaytestRealmSupport
    {
        private const string T = "[PlaytestRealmSlice]";

        public static bool Run()
        {
            bool ok = true;
            void Fail(string what, string why) { ok = false; Debug.LogError($"{T} {what} FAIL - {why}"); }
            string json0 = RealmSaveState.ToJson();
            bool rOn = RealmRecommend.On, sOn = RealmSupport.On, srpg0 = U.Srpg;
            try
            {
                // ① ~ ④ 천거
                RealmRecommend.On = true;
                int rolls = 0, firstY = 0, firstM = 0;
                for (int y = 194; y < 214; y++)
                    for (int m = 1; m <= 12; m++)
                        if (RealmRecommend.Rolls(y, m)) { rolls++; if (firstY == 0) { firstY = y; firstM = m; } }
                if (rolls < 12 || rolls > 40) Fail("recommend", $"240달 중 {rolls}(약 24 기대)");
                if (RealmRecommend.Rolls(200, 5) != RealmRecommend.Rolls(200, 5)) Fail("recommend", "같은 달 다르게 굴림");
                // 숨은 인재 표가 있는 성에 우리 장수 하나를 두고, 앞 단계(수색)가 찾아 둔 그 성 사람은 다시 숨긴다 — 지금 성(허창)은 숨은 인재가 없다
                string city = null;
                foreach (var cid in RealmCityData.AllCityIds)
                    foreach (var hid in RealmOfficerPool.HiddenAt(cid))
                        if (city == null && !RealmCityState.RosterIds.Contains(hid) && !RealmCityState.IsDead(hid)) city = cid;
                if (city == null) city = "chenliu";
                foreach (var hid in RealmOfficerPool.HiddenAt(city)) RealmCityState.ForgetFoundForTest(hid);
                RealmCityState.SetOfficerCityForTest(RealmCityState.RosterIds[0], city);
                int hidden = RealmOfficerPool.HiddenAt(city).Count(id => !RealmCityState.FoundIds.Contains(id) && !RealmCityState.RosterIds.Contains(id) && !RealmCityState.IsDead(id));
                int found0 = RealmCityState.FoundIds.Count;
                string line = RealmCityState.Recommend(firstY, firstM, city);
                if (hidden == 0) Fail("recommend", $"{city} 에 숨은 인재가 없음(다 등용됨?)");
                if (hidden > 0 && (line == null || RealmCityState.FoundIds.Count != found0 + 1)) Fail("recommend", $"천거 달인데 안 드러남(숨은 {hidden}) 줄 {line}");
                // 숨은 인재를 다 찾을 때까지 → 없으면 null
                for (int i = 0; i < 40 && RealmCityState.Recommend(firstY, firstM, city) != null; i++) { }
                if (RealmCityState.Recommend(firstY, firstM, city) != null) Fail("recommend", "숨은 인재가 없는데 천거");
                RealmRecommend.On = false;
                if (RealmCityState.Recommend(firstY, firstM, city) != null) Fail("recommend", "끔인데 천거");
                if (ok) Debug.Log($"{T} recommend OK - 240달 중 {rolls} · 천거 달 {firstY}년 {firstM}월에 「{line}」 · 숨은 인재 없으면 무사 · 끔");

                // ⑤ ~ ⑩ 지원
                RealmSupport.On = true; RealmSupport.ResetForTest(); U.Srpg = true;
                if (RealmSupport.RankOf(2) != -1 || RealmSupport.RankOf(3) != 0 || RealmSupport.RankOf(7) != 1 || RealmSupport.RankOf(12) != 2) Fail("support", "3/7/12 문턱");
                string a = RealmCityState.RosterIds[0], c = "sup_test_b";
                var b = U.MakeBoard("sup|1", "plain", false);
                b.Units.Clear();
                var ua = new U.Unit { Uid = "a", Id = a, Side = "me", Hp = 10, Max = 10, X = 2, Y = 2, Atk = 40, Def = 40, Rng = 1, Mov = 3 };
                var uc = new U.Unit { Uid = "c", Id = c, Side = "me", Hp = 10, Max = 10, X = 2, Y = 3, Atk = 40, Def = 40, Rng = 1, Mov = 3 };
                var uf = new U.Unit { Uid = "f", Id = "foe1", Side = "foe", Hp = 10, Max = 10, X = 3, Y = 2, Atk = 40, Def = 40, Rng = 1, Mov = 3 };
                b.Units.AddRange(new[] { ua, uc, uf });
                int h0 = U.HitAt(b, ua, uf, ua.X, ua.Y), e0 = U.HitAt(b, uf, ua, uf.X, uf.Y);
                RealmSupport.SetForTest(a, c, 12);
                int h1 = U.HitAt(b, ua, uf, ua.X, ua.Y), e1 = U.HitAt(b, uf, ua, uf.X, uf.Y);
                if (h1 - h0 != 15 || e0 - e1 != 15) Fail("support", $"A 짝 이웃 명중 {h0}→{h1}·맞을 확률 {e0}→{e1}(±15)");
                uc.X = 5; uc.Y = 5;
                if (U.HitAt(b, ua, uf, ua.X, ua.Y) != h0) Fail("support", "짝이 멀리 있는데 보정");
                uc.X = 2; uc.Y = 3;
                // ⑦ 판 끝
                RealmSupport.SetForTest(a, c, 2);
                var ups = RealmSupport.OnBattleEnd(b);
                if (RealmSupport.Points(a, c) != 3 || ups.Count != 1) Fail("support", $"판 끝 이웃 +1 → {RealmSupport.Points(a, c)}·단계 오름 {ups.Count}");
                if (!RealmSupport.LineFor(a).Contains("C")) Fail("support", $"장수 줄 「{RealmSupport.LineFor(a)}」");
                // ⑧ RTS 판
                b.IsSrpg = false;
                RealmSupport.OnBattleEnd(b);
                if (RealmSupport.Points(a, c) != 3 || U.HitAt(b, ua, uf, ua.X, ua.Y) != U.HitChance(ua, uf, U.CoverAt(b, uf.X, uf.Y))) Fail("support", "RTS 판에서 셈·보정");
                b.IsSrpg = true;
                // ⑨ 저장 왕복
                string js = RealmSupport.Snapshot();
                RealmSupport.ResetForTest(); RealmSupport.Restore(js);
                if (RealmSupport.Points(a, c) != 3) Fail("support", "저장 왕복");
                RealmSupport.Restore(null);
                if (RealmSupport.Points(a, c) != 0) Fail("support", "옛 세이브 null 이 비지 않음");
                // ⑩ 끔
                RealmSupport.SetForTest(a, c, 12);
                RealmSupport.On = false;
                if (U.HitAt(b, ua, uf, ua.X, ua.Y) != h0 || RealmSupport.OnBattleEnd(b).Count != 0 || RealmSupport.Points(a, c) != 12) Fail("support", "끔인데 보정·셈");
                if (ok) Debug.Log($"{T} support OK - 3/7/12 = C/B/A · A 짝 이웃 명중 {h0}→{h1}·맞을 확률 {e0}→{e1} · 판 끝 이웃 +1(C 오름)·장수 줄 · RTS 안 셈 · 저장 · 끔");
            }
            finally
            {
                RealmRecommend.On = rOn; RealmSupport.On = sOn; U.Srpg = srpg0;
                RealmSaveState.ApplyJson(json0);
            }
            return ok;
        }
    }
}
