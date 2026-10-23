using System;
using System.Collections.Generic;
using UnityEngine;

namespace Saga.Realm.Data
{
    /// <summary>
    /// tasks U-0172 교역로(웹 W-0301 `traderoute.js` 수치 그대로 · 고돗 G-0310 짝) — 우리 성에서 우리 성까지 우리 땅만 밟는 길이 이어지면
    /// 금 <see cref="Cost"/> 로 상단을 띄운다(<see cref="Months"/>달, <see cref="Max"/>개까지). 이어진 달마다 (두 성 상업 합) × <see cref="Rate"/> ×
    /// 금 배율(기술·불가사의 goldPct) 금이 들어오고, 길이 끊기면 그 달 상단을 잃는다.
    /// 이 트랙엔 이웃 그래프·화친·적 진이 없어 길 = 시작 셋 웹 LINKS(복양–진류·진류–허창) + 적 성 표의 출진 나무 간선, 지나갈 수 있는 성 = 우리 성뿐.
    /// 손잡이 <see cref="On"/>.
    /// </summary>
    public static class RealmTrade
    {
        public const int Cost = 300, Months = 12, Max = 2;
        public const float Rate = 0.1f;
        public static bool On = true;

        [Serializable] public class Route { public string from, to; public int left, gold; }
        [Serializable] private class Store { public List<Route> routes = new List<Route>(); }

        private static Store _s = new Store();
        public static IReadOnlyList<Route> Routes => _s.routes;
        public static event Action Changed;

        private static readonly string[][] StartLinks = { new[] { "puyang", "chenliu" }, new[] { "chenliu", "xuchang" } };

        public static string CityName(string id) => RealmCityData.Get(id)?.Name ?? RealmEnemyCity.Get(id)?.Name ?? id;

        /// <summary>진단 — 이 성을 우리 것이 아닌 것으로(성 잃기 규칙이 아직 없어 끊김을 이걸로 본다).</summary>
        public static string BlockedForTest;

        private static bool Owns(string cityId)
        {
            if (cityId == BlockedForTest) return false;
            foreach (var id in RealmCityState.ActiveCityIds) if (id == cityId) return true;
            return false;
        }

        /// <summary>그 성의 이웃 — 시작 셋 LINKS + 적 성 출진 나무(양쪽).</summary>
        public static List<string> Neighbors(string cityId)
        {
            var n = new List<string>();
            foreach (var l in StartLinks)
            {
                if (l[0] == cityId) n.Add(l[1]);
                else if (l[1] == cityId) n.Add(l[0]);
            }
            foreach (var id in RealmEnemyCity.AllIds)
            {
                var d = RealmEnemyCity.Get(id);
                if (d == null) continue;
                if (d.Id == cityId && !string.IsNullOrEmpty(d.AttackFromCityId)) n.Add(d.AttackFromCityId);
                else if (d.AttackFromCityId == cityId) n.Add(d.Id);
            }
            return n;
        }

        /// <summary>교역 길 — 성 id 목록 [from … to], 우리 땅만. 못 이으면 null.</summary>
        public static List<string> Path(string from, string to)
        {
            if (string.IsNullOrEmpty(from) || from == to || !Owns(from) || !Owns(to)) return null;
            var prev = new Dictionary<string, string> { [from] = null };
            var q = new Queue<string>();
            q.Enqueue(from);
            while (q.Count > 0)
            {
                string cur = q.Dequeue();
                if (cur == to)
                {
                    var outp = new List<string>();
                    for (string k = to; k != null; k = prev[k]) outp.Insert(0, k);
                    return outp;
                }
                foreach (var n in Neighbors(cur))
                {
                    if (prev.ContainsKey(n) || !Owns(n)) continue;
                    prev[n] = cur;
                    q.Enqueue(n);
                }
            }
            return null;
        }

        /// <summary>한 달 수입(순수 계산).</summary>
        public static int IncomeOf(string from, string to)
        {
            var a = RealmCityState.CityRecord(from);
            var b = RealmCityState.CityRecord(to);
            if (a == null || b == null) return 0;
            return Mathf.RoundToInt((a.Comm + b.Comm) * Rate * RealmTechData.Mul("goldPct"));
        }

        /// <summary>띄울 수 있나 — 못 하면 이유, 되면 null.</summary>
        public static string Why(string from, string to)
        {
            if (!On) return RealmLocalization.T("trade.why_off", "교역로가 꺼져 있습니다");
            if (!Owns(from)) return RealmLocalization.T("trade.why_mine", "우리 성에서만 띄웁니다");
            if (_s.routes.Count >= Max) return string.Format(RealmLocalization.T("trade.why_max", "상단은 {0}개까지"), Max);
            if (_s.routes.Exists(r => (r.from == from && r.to == to) || (r.from == to && r.to == from))) return RealmLocalization.T("trade.why_dup", "이미 오가는 길입니다");
            if (RealmCityState.Gold < Cost) return string.Format(RealmLocalization.T("trade.why_gold", "금이 모자랍니다(금 {0})"), Cost);
            if (Path(from, to) == null) return RealmLocalization.T("trade.why_path", "우리 땅으로 이어진 길이 없습니다");
            return null;
        }

        /// <summary>상단을 띄운다 — 못 하면 이유, 되면 null.</summary>
        public static string Start(string from, string to)
        {
            string w = Why(from, to);
            if (w != null) return w;
            RealmCityState.TrySpendGold(Cost);
            _s.routes.Add(new Route { from = from, to = to, left = Months, gold = 0 });
            Changed?.Invoke();
            return null;
        }

        /// <summary>그 성에서 띄울 만한 상대 — 이어진 우리 성 중 벌이 큰 순 n 개.</summary>
        public static List<string> Candidates(string from, int n = 3)
        {
            var outp = new List<string>();
            foreach (var id in RealmCityState.ActiveCityIds)
                if (id != from && Path(from, id) != null) outp.Add(id);
            outp.Sort((a, b) => { int c = IncomeOf(from, b).CompareTo(IncomeOf(from, a)); return c != 0 ? c : string.CompareOrdinal(a, b); });
            if (outp.Count > n) outp.RemoveRange(n, outp.Count - n);
            return outp;
        }

        /// <summary>한 줄 — "허창 ↔ 진류".</summary>
        public static string Pair(string from, string to) => CityName(from) + " ↔ " + CityName(to);

        // ---- 달(RealmCityState.NextMonth) ----

        /// <summary>이어진 상단은 금, 끊긴 상단은 잃음, 다 간 상단은 돌아옴. 돌려주는 줄은 달 요약에.</summary>
        public static List<string> Monthly()
        {
            var lines = new List<string>();
            if (!On || _s.routes.Count == 0) return lines;
            var keep = new List<Route>();
            foreach (var r in _s.routes)
            {
                if (Path(r.from, r.to) == null)
                {
                    lines.Add(string.Format(RealmLocalization.T("trade.lost", "✂️ {0} 교역로가 끊겨 상단을 잃었다"), Pair(r.from, r.to)));
                    continue;
                }
                int g = IncomeOf(r.from, r.to);
                RealmCityState.AddGold(g);
                r.gold += g;
                if (--r.left > 0) keep.Add(r);
                else lines.Add(string.Format(RealmLocalization.T("trade.back", "🐫 {0} 상단이 돌아왔다 — 모두 금 {1}"), Pair(r.from, r.to), r.gold));
            }
            _s.routes = keep;
            Changed?.Invoke();
            return lines;
        }

        // ---- 세이브(RealmSaveState tradeJson) ----

        public static string Snapshot() => JsonUtility.ToJson(_s);

        public static void Restore(string json)
        {
            _s = new Store();
            if (!string.IsNullOrEmpty(json))
            {
                try { _s = JsonUtility.FromJson<Store>(json) ?? new Store(); }
                catch (Exception) { _s = new Store(); }
            }
            if (_s.routes == null) _s.routes = new List<Route>();
            Changed?.Invoke();
        }

        public static void ResetForTest() => Restore(null);
    }
}
