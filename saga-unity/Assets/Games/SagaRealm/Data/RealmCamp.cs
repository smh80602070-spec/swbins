using System;
using System.Collections.Generic;
using UnityEngine;

namespace Saga.Realm.Data
{
    /// <summary>
    /// tasks U-0134 진·보급선(웹 W-0278 `supplyline.js`·`war.js` 진영, 고돗 G-0239 본보기) — 이 트랙엔 진도 이웃 그래프도 없어
    /// 못 떨군 공격(날이 저묾)은 그대로 물러났다. 이제 <see cref="CampOn"/> 이면 그 성 앞에 **진**(병력·사기·치중·달)을 치고, 달마다
    /// 치중을 먹고(모자라면 20% 흩어져 물러남) 보급로를 본다 — 출진한 성이 우리 것이고 그 적 성이 거기서 칠 수 있는 자리면 이어짐
    /// (이 트랙의 길 = `RealmEnemyCity.TargetsFrom` 나무, 적 AI 진이 없어 "적 진이 선 성" 막힘은 없다). 끊기면 사기 ×0.85·병력 −5%.
    /// 그다음 사기 ×0.94, 사기 0.60·병력 500 밑이면 퇴각, 아니면 다시 친다(이기면 함락, 무너지면 퇴각, 또 저물면 진 그대로).
    /// 계략 ✂️ 보급 끊기 — 웹은 적 진의 보급을 끊지만 이 트랙엔 적 진이 없어 **그 적 성의 보급**을 2달 끊는다(달마다 병력 −5%, 진과 같은 값).
    /// 우리 진은 같은 성에서 공격 명령을 다시 내리면 풀린다(남은 병력·치중이 성으로, 고돗 포위 풀기와 같음).
    /// </summary>
    public static class RealmCamp
    {
        public const float Decay = 0.94f, Quit = 0.60f, CutMorale = 0.85f, CutTroops = 0.05f, HungerLoss = 0.2f;
        public const int MinTroops = 500, CutMonths = 2;

        /// <summary>진 손잡이 — 끄면 옛 그대로(못 떨구면 물러남).</summary>
        public static bool CampOn = true;

        [Serializable]
        public class Camp
        {
            public string from, to;
            public int troops, food, train, tech, months;
            public float morale = 1f;
            public List<string> officers = new List<string>();
        }

        [Serializable]
        private class Store
        {
            public List<Camp> camps = new List<Camp>();
            public List<string> cutIds = new List<string>();
            public List<int> cutLeft = new List<int>();
        }

        private static Store _s = new Store();

        public static IReadOnlyList<Camp> Camps => _s.camps;
        public static Camp From(string fromCityId) => _s.camps.Find(c => c.from == fromCityId);
        public static Camp Against(string enemyId) => _s.camps.Find(c => c.to == enemyId);

        public static event Action Changed;

        private static string EnemyName(string id) => RealmEnemyCity.Get(id)?.Name ?? id;
        private static string CityName(string id) => RealmCityData.Get(id)?.Name ?? id;

        // ---- 진 치기·풀기 ----

        public static Camp Pitch(string from, string to, RealmArmy atk, int food)
        {
            var c = new Camp { from = from, to = to, troops = atk.Troops, food = Mathf.Max(0, food), train = atk.Train, tech = atk.Tech, morale = atk.Morale, months = 1 };
            c.officers.AddRange(atk.OfficerIds);
            _s.camps.RemoveAll(x => x.from == from);
            _s.camps.Add(c);
            Changed?.Invoke();
            return c;
        }

        /// <summary>진을 풀고 남은 병력·치중을 출진한 성으로(그 성이 이제 우리 것이 아니면 흩어진다).</summary>
        public static string Withdraw(string fromCityId, string why = null)
        {
            var c = From(fromCityId);
            if (c == null) return null;
            Return(c);
            string reason = why ?? RealmLocalization.T("camp.why_order", "명을 받아");
            return string.Format(RealmLocalization.T("camp.withdraw", "⛺ {0} 앞 진을 풀었다({1}) — 병력 {2}·치중 {3} 이 {4}(으)로"),
                EnemyName(c.to), reason, c.troops, c.food, CityName(c.from));
        }

        private static void Return(Camp c)
        {
            _s.camps.Remove(c);
            var city = RealmCityState.CityRecord(c.from);
            if (city != null && Owns(c.from)) { city.Troops += c.troops; city.Food += c.food; }
            Changed?.Invoke();
        }

        private static bool Owns(string cityId)
        {
            foreach (var id in RealmCityState.ActiveCityIds) if (id == cityId) return true;
            return false;
        }

        /// <summary>보급로 — 출진한 성이 우리 것이고 그 적 성을 거기서 칠 수 있으면 이어짐(이 트랙 길 나무).</summary>
        public static bool Connected(Camp c) => c != null && Owns(c.from) && RealmEnemyCity.TargetsFrom(c.from).Contains(c.to);

        /// <summary>진이 이 치중으로 버티는 달 수.</summary>
        public static int MonthsLeft(Camp c)
        {
            int eat = Mathf.RoundToInt(c.troops / 1000f * RealmCityState.FoodPer1000);
            return eat <= 0 ? 99 : c.food / eat;
        }

        // ---- 계략 ✂️ 보급 끊기(적 성) ----

        public static int CutLeft(string enemyId)
        {
            int i = _s.cutIds.IndexOf(enemyId);
            return i < 0 ? 0 : _s.cutLeft[i];
        }

        public static string CutEnemy(string enemyId)
        {
            int i = _s.cutIds.IndexOf(enemyId);
            if (i < 0) { _s.cutIds.Add(enemyId); _s.cutLeft.Add(CutMonths); }
            else _s.cutLeft[i] = CutMonths;
            Changed?.Invoke();
            return string.Format(RealmLocalization.T("plot.cut_effect", "{0} 보급로를 {1}달 끊었다 — 달마다 병력 −5%"), EnemyName(enemyId), CutMonths);
        }

        // ---- 달 처리(RealmCityState.NextMonth 끝) ----

        /// <summary>끊긴 적 성 병력을 줄이고, 우리 진마다 치중·보급·사기를 보고 다시 친다. 돌려주는 줄(없으면 빈 목록)은 달 요약에 붙는다.</summary>
        public static List<string> Monthly()
        {
            var lines = new List<string>();
            for (int i = _s.cutIds.Count - 1; i >= 0; i--)
            {
                var e = RealmWarState.Get(_s.cutIds[i]);
                if (e != null && !e.Captured) e.Troops = Mathf.Max(0, e.Troops - Mathf.RoundToInt(e.Troops * CutTroops));
                if (--_s.cutLeft[i] <= 0 || e == null || e.Captured) { _s.cutIds.RemoveAt(i); _s.cutLeft.RemoveAt(i); }
            }
            foreach (var c in new List<Camp>(_s.camps))
            {
                string line = Resolve(c);
                if (line != null) lines.Add(line);
            }
            if (lines.Count > 0 || _s.cutIds.Count > 0) Changed?.Invoke();
            return lines;
        }

        private static string Resolve(Camp c)
        {
            var enemy = RealmWarState.Get(c.to);
            var def = RealmEnemyCity.Get(c.to);
            if (enemy == null || def == null) { _s.camps.Remove(c); return null; }
            if (enemy.Captured) { Return(c); return null; }

            int eat = Mathf.RoundToInt(c.troops / 1000f * RealmCityState.FoodPer1000);
            if (c.food < eat)
            {
                c.troops = Mathf.Max(0, c.troops - Mathf.RoundToInt(c.troops * HungerLoss));
                c.food = 0;
                return Withdraw(c.from, RealmLocalization.T("camp.why_food", "군량이 떨어져"));
            }
            c.food -= eat;

            string supply = "";
            if (!Connected(c))
            {
                c.morale *= CutMorale;
                c.troops = Mathf.Max(0, c.troops - Mathf.RoundToInt(c.troops * CutTroops));
                supply = RealmLocalization.T("camp.cut", " · 보급로 끊김(사기 ×0.85·병력 −5%)");
            }

            c.morale *= Decay;
            if (c.morale < Quit || c.troops < MinTroops) return Withdraw(c.from, RealmLocalization.T("camp.why_tired", "군이 지쳐")) + supply;

            c.months++;
            var atk = new RealmArmy { Troops = c.troops, Start = c.troops, Train = c.train, Tech = c.tech, OfficerIds = new List<string>(c.officers), Morale = c.morale };
            var defArmy = new RealmArmy { Troops = enemy.Troops, Start = enemy.Troops, Train = enemy.Train, Tech = enemy.Tech, OfficerIds = new List<string>(), Morale = 1f };
            var r = RealmWar.Fight(atk, defArmy, enemy, def.Land, 1f, RealmWonder.EnemyMul(c.to, "defPct"), RealmTechData.Mul("atkPct"), RealmWonder.EnemyMul(c.to, "atkPct")); // tasks U-0136
            enemy.Troops = defArmy.Troops;
            c.troops = atk.Troops;
            c.morale = atk.Morale;
            string head = string.Format(RealmLocalization.T("camp.siege", "🏕️ {0} {1}달째 에워쌈 — 사기 {2:0}"), def.Name, c.months, c.morale * 100f) + supply;
            if (r.Won)
            {
                _s.camps.Remove(c);
                enemy.Captured = true;
                RealmCityState.AbsorbCity(c.to, enemy.Wall, enemy.Troops, enemy.Train, enemy.Tech);
                var from = RealmCityState.CityRecord(c.from);
                if (from != null) from.Food += c.food; // 남은 치중만 돌아가고 병력은 새 성을 지킨다(AbsorbCity 가 적 남은 병력으로 세움 — Attack 승리와 같음)
                Changed?.Invoke();
                return head + string.Format(RealmLocalization.T("camp.won", " — {0} 함락! 이제 우리 성"), def.Name);
            }
            if (!r.Dusk) return head + " — " + Withdraw(c.from, RealmLocalization.T("camp.why_routed", "무너져"));
            return head + string.Format(RealmLocalization.T("camp.hold", " — 승부가 안 났다, 진을 그대로(병력 {0}·치중 {1}달치)"), c.troops, MonthsLeft(c));
        }

        // ---- 저장 ----

        public static string Snapshot() => JsonUtility.ToJson(_s);

        public static void Restore(string json)
        {
            Store s = null;
            if (!string.IsNullOrEmpty(json)) { try { s = JsonUtility.FromJson<Store>(json); } catch (ArgumentException) { s = null; } }
            _s = s ?? new Store();
            if (_s.camps == null) _s.camps = new List<Camp>();
            if (_s.cutIds == null || _s.cutLeft == null || _s.cutIds.Count != _s.cutLeft.Count) { _s.cutIds = new List<string>(); _s.cutLeft = new List<int>(); }
            foreach (var c in _s.camps) if (c.officers == null) c.officers = new List<string>();
            Changed?.Invoke();
        }

        public static void ResetForTest()
        {
            Restore(null);
            CampOn = true;
        }
    }
}
