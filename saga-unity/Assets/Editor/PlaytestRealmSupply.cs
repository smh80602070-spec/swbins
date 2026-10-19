using System.Collections.Generic;
using UnityEngine;
using Saga.Realm.Data;

namespace Saga.EditorTools
{
    /// <summary>
    /// tasks U-0134 진·보급선(웹 W-0278) 진단 — `PlaytestRealmSlice` 기술 나무(tech) 뒤에 부른다(한 프레임 안, 싸움 결과는 진단 자리 RealmWar.FightForTest 로 고정).
    /// 다섯 줄: ① 맞먹는 적(날이 저묾) → 진(성 병력 0·진 병력·치중) · 손잡이 끄면 옛 그대로 물러남 ② 달마다 치중 먹음·사기 ×0.94·진 그대로·다음 달 다시 침
    /// ③ 보급로 끊김(출진 성이 우리 것 아님) 사기 ×0.85 더 · 약한 적이면 다음 달 함락 ④ 퇴각 — 사기 0.60 밑·군량 바닥(20% 흩어짐)·공격 명령 = 진 풀기(병력·치중 성으로)
    /// ⑤ 계략 ✂️ 보급 끊기(목록·250금·적 성 2달 −5%) · 세이브 왕복·옛 세이브 진 없음. 끝나면 세이브 JSON·난수 상태를 시작 때로.
    /// </summary>
    public static class PlaytestRealmSupply
    {
        private const string T = "[PlaytestRealmSlice] supply";
        private static bool _ok, _step;

        public static bool Run()
        {
            _ok = true;
            string json0 = RealmSaveState.ToJson();
            var rand0 = Random.state;
            bool on0 = RealmCamp.CampOn;
            try
            {
                RealmWar.FightForTest = Dusk;
                RealmCamp.ResetForTest();
                RealmCityState.NextMonth(); // 이번 달 명령 칸을 비운다(장수가 나갈 수 있게)
                Pick(out string from, out string to);
                if (from == null) { Fail("칠 적 성이 있는 우리 성이 없음"); return false; }
                var city = RealmCityState.CityRecord(from);
                var enemy = RealmWarState.Get(to);

                // ① 진 치기 · 손잡이
                Begin();
                Arm(city, enemy, 10000, 10000);
                RealmCamp.CampOn = false;
                var r0 = RealmWarState.Attack(from, to);
                if (!r0.Ok) Fail($"출진 막힘: {r0.Message}");
                else if (RealmCamp.From(from) != null || city.Troops <= 0) Fail("손잡이 끈데 진을 침·병력 안 돌아옴");
                RealmCamp.CampOn = true;
                RealmCityState.NextMonth();
                RealmCamp.ResetForTest();
                Arm(city, enemy, 10000, 10000);
                var r1 = RealmWarState.Attack(from, to);
                var camp = RealmCamp.From(from);
                if (!r1.Ok || camp == null || camp.to != to || city.Troops != 0 || camp.troops < RealmCamp.MinTroops || camp.food <= 0) Fail($"진 안 섬 ok={r1.Ok} 병력 {city.Troops} 진 {camp?.troops}·치중 {camp?.food} — {r1.Message}");
                End($"pitch OK - 맞먹는 적(1만 대 1만) 날이 저묾 → 진(병력 {camp?.troops}·치중 {camp?.food}) · 손잡이 끄면 물러남");
                if (camp == null) return false;

                // ② 달 처리
                Begin();
                enemy.Troops = camp.troops;
                float m0 = camp.morale;
                int food0 = camp.food, eat = Mathf.RoundToInt(camp.troops / 1000f * RealmCityState.FoodPer1000);
                RealmCityState.NextMonth();
                camp = RealmCamp.From(from);
                if (camp == null) Fail("맞먹는 적인데 진이 사라짐(이겼거나 물러남)");
                else if (camp.food != food0 - eat || camp.months != 2 || !Mathf.Approximately(camp.morale, m0 * RealmCamp.Decay) || !RealmCamp.Connected(camp)) Fail($"치중 {food0}→{camp.food}(먹음 {eat})·달 {camp.months}·사기 {camp.morale}/{m0 * RealmCamp.Decay}");
                End($"month OK - 치중 −{eat}·사기 ×0.94·2달째 다시 침·보급 이어짐");
                if (camp == null) return false;

                // ③ 끊김 · 함락
                Begin();
                enemy.Troops = camp.troops;
                camp.food = 100000;
                camp.morale = 1f;
                camp.from = "test_nowhere";
                if (RealmCamp.Connected(camp)) Fail("우리 성 아닌 곳에서 나간 진이 이어짐");
                RealmCityState.NextMonth();
                var cut = RealmCamp.From("test_nowhere");
                if (cut == null || !Mathf.Approximately(cut.morale, RealmCamp.CutMorale * RealmCamp.Decay)) Fail($"끊긴 진 사기 {cut?.morale} ≠ {RealmCamp.CutMorale * RealmCamp.Decay}");
                if (cut != null) cut.from = from;
                RealmWar.FightForTest = Won;
                RealmCityState.NextMonth();
                RealmWar.FightForTest = Dusk;
                if (RealmCamp.From(from) != null || !enemy.Captured) Fail($"이겼는데 함락 안 됨 · 진 {RealmCamp.From(from) != null}");
                End("supply OK - 끊김 사기 ×0.85×0.94 · 다음 달 이기면 진이 함락(성 편입)");

                // ④ 퇴각
                Begin();
                RealmCamp.ResetForTest();
                var army = new RealmArmy { Troops = 4000, Start = 4000, Train = 50, Tech = 100, Morale = 0.62f };
                Pick(out from, out string to2);
                if (to2 == null) Fail("둘째 적 성 없음");
                else
                {
                    RealmWarState.Get(to2).Captured = false;
                    RealmWarState.Get(to2).Troops = 8000;
                    city = RealmCityState.CityRecord(from);
                    city.Food = 1_000_000; // 굶주림으로 병력이 줄면 되돌아온 병력 셈이 흔들린다
                    int t0 = city.Troops;
                    RealmCamp.Pitch(from, to2, army, 50000);
                    RealmCityState.NextMonth();
                    if (RealmCamp.From(from) != null || city.Troops != t0 + 4000) Fail($"사기 0.62×0.94 인데 안 물러남·병력 {city.Troops - t0}");
                    army.Morale = 1f;
                    t0 = city.Troops;
                    RealmCamp.Pitch(from, to2, army, 0);
                    RealmCityState.NextMonth();
                    if (RealmCamp.From(from) != null || city.Troops != t0 + 3200) Fail($"군량 0 인데 20% 흩어져 물러나지 않음 {city.Troops - t0}");
                    t0 = city.Troops;
                    RealmCamp.Pitch(from, to2, army, 777);
                    var w = RealmWarState.Attack(from, to2);
                    if (!w.Ok || RealmCamp.From(from) != null || city.Troops != t0 + 4000) Fail($"공격 명령이 진을 안 풂 {w.Message}");
                }
                End("retreat OK - 사기 0.60 밑 퇴각·군량 바닥 20% 흩어져 퇴각·공격 명령 = 진 풀기(병력·치중 성으로)");

                // ⑤ 계략 · 저장
                Begin();
                var plot = RealmPlotData.Get("cut");
                if (plot == null || plot.Gold != 250 || System.Array.IndexOf(RealmPlotData.AllKeys, "cut") < 0) Fail("보급 끊기 계략이 목록에 없음·250금 아님");
                if (to2 != null)
                {
                    var e2 = RealmWarState.Get(to2);
                    e2.Troops = 10000;
                    RealmCamp.CutEnemy(to2);
                    RealmCityState.NextMonth();
                    int a = e2.Troops;
                    RealmCityState.NextMonth();
                    int b = e2.Troops;
                    RealmCityState.NextMonth();
                    if (a != 9500 || b != 9025 || e2.Troops != 9025 || RealmCamp.CutLeft(to2) != 0) Fail($"끊긴 적 성 병력 {a}·{b}·{e2.Troops} ≠ 9500·9025·9025");
                    RealmCamp.Pitch(from, to2, army, 1234);
                    string j = RealmSaveState.ToJson();
                    if (!j.Contains("\"campJson\"")) Fail("세이브에 campJson 없음");
                    RealmCamp.Restore(null);
                    if (RealmCamp.Camps.Count != 0) Fail("옛 세이브(없음)인데 진이 남음");
                    RealmSaveState.ApplyJson(j);
                    var back = RealmCamp.From(from);
                    if (back == null || back.food != 1234 || back.to != to2) Fail("저장 왕복에 진이 안 돌아옴");
                }
                End("plot OK - ✂️ 보급 끊기 250금·적 성 2달 −5%(1만→9500→9025)·세이브 왕복·옛 세이브 진 없음");
            }
            finally
            {
                RealmWar.FightForTest = null;
                RealmSaveState.ApplyJson(json0);
                RealmCamp.CampOn = on0;
                Random.state = rand0;
            }
            return _ok;
        }

        // 싸움 결과 고정 — 날이 저묾(양쪽 10% 손실)·함락(적 0).
        private static RealmWar.FightResult Dusk(RealmArmy a, RealmArmy d, RealmEnemyRecord w)
        {
            int la = a.Troops / 10, ld = d.Troops / 10;
            a.Troops -= la; d.Troops -= ld;
            return new RealmWar.FightResult(false, true, la, ld, w.Wall, w.Wall, false, true);
        }

        private static RealmWar.FightResult Won(RealmArmy a, RealmArmy d, RealmEnemyRecord w)
        {
            int ld = d.Troops;
            d.Troops = 0;
            return new RealmWar.FightResult(true, false, 0, ld, w.Wall, w.Wall, false);
        }

        /// <summary>칠 적 성이 있는 우리 성 — 무장 있는 곳·아직 안 떨군 곳 먼저, 슬라이스 뒤쪽이라 다 떨궜으면 떨군 곳을 진단 동안만 되살린다(끝에 세이브 JSON 으로 되돌림).</summary>
        private static void Pick(out string from, out string to)
        {
            from = null; to = null;
            int best = -1;
            foreach (var id in RealmCityState.ActiveCityIds)
            {
                string t = RealmEnemyCity.TargetFrom(id);
                if (t == null) continue;
                bool officer = false; // 출진엔 다치지 않은 무장이 있어야 한다(MarchBlock)
                foreach (var o in RealmCityState.RosterIds) if (RealmCityState.OfficerCityId(o) == id && !RealmCityState.IsHurt(o)) { officer = true; break; }
                int score = (officer ? 2 : 0) + (RealmWarState.Get(t).Captured ? 0 : 1);
                if (score > best) { best = score; from = id; to = t; }
            }
        }

        private static void Arm(RealmCityRecord city, RealmEnemyRecord enemy, int ours, int theirs)
        {
            city.Troops = ours;
            city.Food = 1_000_000;
            enemy.Troops = theirs;
            enemy.Captured = false;
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
