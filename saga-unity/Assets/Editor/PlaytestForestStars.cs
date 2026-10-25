using System;
using UnityEngine;
using Saga.Forest.Data;
using Saga.Forest.World;

namespace Saga.EditorTools
{
    /// <summary>
    /// tasks U-0229 진단 — `PlaytestForestHeadless` 끝 무렵(한 프레임 안).
    /// stars: ① 틈 25~60 결정적 ② 마을 안·낮엔 별똥별 없음 ③ 밤 마을 밖이면 별똥별·단추 → 소원 ④ 한 밤 다섯 ⑤ 이튿날 마을에 들면 열매 +20×다섯 한 번 ⑥ 저장 왕복 ⑦ 끔
    /// birthday: ⑧ 주민마다 하루·겹침 없음·28일 안 ⑨ 그날 첫 말 걸기 +3(상한 넘어도) · 다른 날 +1 ⑩ 「오늘」 줄 ⑪ 끔.
    /// 끝나면 시각·날짜·열매·소원·하트를 되돌린다.
    /// </summary>
    public static class PlaytestForestStars
    {
        private const string T = "[PlaytestForestHeadless]";

        public static bool Run()
        {
            bool ok = true;
            void Fail(string why) { ok = false; Debug.LogError($"{T} stars FAIL - {why}"); }
            var sky = ForestStarSky.Instance;
            if (sky == null) { Debug.LogError($"{T} stars FAIL - ForestStarSky 없음"); return false; }
            int fruit0 = ForestState.FruitCount;
            string stars0 = ForestStars.Snapshot(), hearts0 = ForestHearts.Snapshot();
            bool sOn = ForestStars.On, bOn = ForestBirthdays.On;
            var now0 = ForestStars.NowFn;
            try
            {
                ForestStars.On = true; ForestBirthdays.On = true;
                ForestStars.ResetForTest();
                var night = new DateTime(2026, 10, 25, 22, 0, 0);
                ForestStars.NowFn = () => night;
                // ①
                int key = ForestStars.NightKey(night);
                float g = ForestStars.GapOf(key, 0);
                if (g < 25f || g > 60f || g != ForestStars.GapOf(key, 0)) Fail($"틈 {g}");
                if (ForestStars.NightKey(new DateTime(2026, 10, 26, 2, 0, 0)) != key) Fail("새벽 2시가 전날 밤이 아님");
                // ② 마을 안
                int s0 = sky.Streaks;
                for (int i = 0; i < 70; i++) sky.Step(1f, -1);
                if (sky.Streaks != s0) Fail("마을 안인데 별똥별");
                // ③ 마을 밖
                for (int i = 0; i < 61 && sky.Streaks == s0; i++) sky.Step(1f, 2);
                if (sky.Streaks != s0 + 1 || !sky.ButtonShown) Fail($"밤 마을 밖 61초에 별똥별 {sky.Streaks - s0}·단추 {sky.ButtonShown}");
                sky.PressWish();
                if (ForestStars.WishesTonight != 1 || sky.ButtonShown) Fail($"소원 {ForestStars.WishesTonight}");
                // 단추는 3초 뒤 사라짐
                sky.Shoot(); sky.Step(3.2f, 2);
                if (sky.ButtonShown) Fail("단추가 3초 뒤에도 남음");
                // ④ 다섯
                for (int i = 0; i < 10; i++) ForestStars.Wish();
                if (ForestStars.WishesTonight != 5) Fail($"한 밤 소원 {ForestStars.WishesTonight}(다섯)");
                // 낮
                ForestStars.NowFn = () => new DateTime(2026, 10, 26, 12, 0, 0);
                if (ForestStars.Wish()) Fail("낮에 소원");
                int s1 = sky.Streaks;
                for (int i = 0; i < 70; i++) sky.Step(1f, 2);
                if (sky.Streaks != s1) Fail("낮에 별똥별");
                if (ok) Debug.Log($"{T} stars night OK - 틈 {g:0.0}초 · 마을 안·낮 없음 · 밤 마을 밖 별똥별·3초 단추 · 한 밤 다섯");
                // ⑤ 이튿날 마을
                ForestState.Restore(10);
                if (ForestStars.Pending != 5) Fail($"받을 소원 {ForestStars.Pending}");
                sky.Step(0.1f, 2); sky.Step(0.1f, -1);
                if (sky.LastClaim != 100 || ForestState.FruitCount != 110) Fail($"마을에 들어 열매 {sky.LastClaim}·{ForestState.FruitCount}");
                sky.Step(0.1f, 2); sky.Step(0.1f, -1);
                if (sky.LastClaim != 0 || ForestState.FruitCount != 110) Fail("소원 열매를 두 번 줌");
                // ⑥ 저장 왕복
                ForestStars.NowFn = () => night;
                ForestStars.Wish(); ForestStars.Wish();
                string js = ForestStars.Snapshot();
                ForestStars.ResetForTest(); ForestStars.Restore(js);
                if (ForestStars.WishesTonight != 2) Fail($"저장 왕복 소원 {ForestStars.WishesTonight}");
                ForestStars.Restore(null);
                if (ForestStars.WishesTonight != 0 || ForestStars.Pending != 0) Fail("옛 세이브 null 이 비지 않음");
                // ⑦ 끔
                ForestStars.On = false;
                int s2 = sky.Streaks;
                for (int i = 0; i < 70; i++) sky.Step(1f, 2);
                if (sky.Streaks != s2 || ForestStars.Wish()) Fail("끔인데 별똥별·소원");
                if (ok) Debug.Log($"{T} stars claim OK - 이튿날 마을에 들면 열매 +100(20×5) 한 번 · 저장 왕복·옛 세이브 빔 · 끔 0");

                // ⑧ 생일
                var people = ForestBirthdays.People();
                var slots = new System.Collections.Generic.HashSet<int>();
                foreach (var p in people)
                {
                    var (m, d) = ForestBirthdays.BirthdayOf(p);
                    if (m < 1 || m > 12 || d < 1 || d > 28 || !slots.Add(ForestBirthdays.SlotOf(p))) { ok = false; Debug.LogError($"{T} birthday FAIL - {p} 생일 {m}/{d}"); }
                }
                // ⑨ 그날 첫 말 걸기
                string who = ForestHearts.KeeperId;
                var (bm, bdd) = ForestBirthdays.BirthdayOf(who);
                int bday = (int)(new DateTime(2026, bm, bdd) - new DateTime(2000, 1, 1)).TotalDays;
                ForestHearts.Restore(null);
                ForestVisitors.ForceDayForTest(bday);
                ForestHearts.Bump(who, 4); // 하루 상한까지 채워 둠
                int h0 = ForestHearts.Of(who);
                int got = ForestHearts.Talk(who);
                if (got != 3 || ForestHearts.Of(who) != h0 + 3) { ok = false; Debug.LogError($"{T} birthday FAIL - 생일 첫 말 걸기 +{got}(상한 넘어 +3 기대)"); }
                ForestVisitors.ForceDayForTest(bday + 1);
                int got2 = ForestHearts.Talk(who);
                if (got2 != 1) { ok = false; Debug.LogError($"{T} birthday FAIL - 다음 날 말 걸기 +{got2}"); }
                // ⑩ 오늘 줄
                ForestVisitors.ForceDayForTest(bday);
                var today = ForestBirthdays.Today(bday);
                if (!today.Contains(who)) { ok = false; Debug.LogError($"{T} birthday FAIL - 오늘 생일 목록에 숲지기 없음"); }
                if (!ForestHearts.Tail(who).Contains("🎂")) { ok = false; Debug.LogError($"{T} birthday FAIL - 하트 꼬리에 🎂 없음"); }
                // ⑪ 끔
                ForestBirthdays.On = false;
                ForestVisitors.ForceDayForTest(bday + 365 * 4); // 같은 날짜(윤년 셈 무관하게 첫 말 걸기 새로)
                if (ForestBirthdays.IsBirthday(who, bday)) { ok = false; Debug.LogError($"{T} birthday FAIL - 끔인데 생일"); }
                if (ok) Debug.Log($"{T} birthday OK - 주민 {people.Count} 생일 겹침 없음·28일 안 · 숲지기 {bm}/{bdd} 첫 말 걸기 +3(상한 넘어) · 다음 날 +1 · 오늘 목록 · 끔");
            }
            finally
            {
                ForestStars.On = sOn; ForestBirthdays.On = bOn; ForestStars.NowFn = now0;
                ForestVisitors.ForceDayForTest(null);
                ForestStars.Restore(stars0);
                ForestHearts.Restore(hearts0);
                ForestState.Restore(fruit0);
            }
            return ok;
        }
    }
}
