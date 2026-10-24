using System;
using System.Collections.Generic;
using UnityEngine;

namespace Saga.Realm.Data
{
    /// <summary>
    /// tasks U-0204 ① 지역 단위 전략 지도(웹 W-0400 `region-view.js`·고돗 G-0347 짝, 정본 `saga-web/saga-realm/PLAN.md` §5-17) —
    /// 한 화면 = 한 지역. 지역 = 성의 주(`RealmEnemyCity.ProvOf`, 웹 `data-city.js` prov) 묶음:
    ///   중국은 주 2~5개씩 「나라」(하북 유·기·병·청 · 중원 연·예·사예·옹·양(涼) · 강동 서·양(揚) · 형익 형·익 — 웹 30성 기준 6~10곳),
    ///   확장 지역은 주 하나 = 지역 하나(막북·교주·남중·임읍·천축 …). 웹에만 있는 주(한국·일본·서역 …)도 표에 둔다(유니티 성은 없음 — 0곳이면 천하도에 안 나옴).
    /// 이웃 = 성 잇기(적 성의 `AttackFromCityId` — 그 성을 어디서 치는가) 가 지역을 넘는 곳. 보는 지역(<see cref="View"/>)은 세이브 `viewRegion`
    /// (옛 세이브·빈 값 = 수도 지역). 손잡이 <see cref="On"/> 끄면 옛 흐름(내 성 전부 한 판).
    /// </summary>
    public static class RealmRegions
    {
        public sealed class Region
        {
            public readonly string Id, NameKo;
            public readonly string[] Provs;
            public Region(string id, string nameKo, params string[] provs) { Id = id; NameKo = nameKo; Provs = provs; }
            public string Name => RealmLocalization.T("region." + Id, NameKo);
        }

        public static readonly Region[] All =
        {
            new Region("hebei", "하북", "you", "ji", "bing", "qing"),
            new Region("zhongyuan", "중원", "yan", "yu", "si", "yong", "liang"),
            new Region("jiangdong", "강동", "xu", "yang"),
            new Region("jingyi", "형익", "jing", "yi"),
            new Region("mb", "막북", "mb"),
            new Region("jiao", "교주", "jiao"),
            new Region("nz", "남중", "nz"),
            new Region("cp", "임읍", "cp"),
            new Region("tz", "천축", "tz"),
            new Region("xi", "서역", "xi"),
            new Region("kr", "한국", "kr"),
            new Region("jp", "일본", "jp"),
        };

        /// <summary>끄면 옛 흐름(지도에 내 성 전부).</summary>
        public static bool On = true;

        /// <summary>시작 셋·정도(웹 표에 없는 성)의 주 — 나머지는 `RealmEnemyCity.ProvOf`.</summary>
        private static readonly Dictionary<string, string> ExtraProv = new Dictionary<string, string>
        {
            ["xuchang"] = "yu", ["chenliu"] = "yan", ["puyang"] = "yan", ["dingtao"] = "yan",
        };

        private static Dictionary<string, string[]> _neighbors;
        private static string _view = "";

        public static event Action Changed;

        public static Region Get(string id) => Array.Find(All, r => r.Id == id);

        public static string ProvOf(string cityId)
        {
            if (string.IsNullOrEmpty(cityId)) return "";
            return ExtraProv.TryGetValue(cityId, out var p) ? p : RealmEnemyCity.ProvOf(cityId);
        }

        /// <summary>성이 든 지역 id(주를 모르면 "").</summary>
        public static string RegionOf(string cityId)
        {
            string prov = ProvOf(cityId);
            if (prov.Length == 0) return "";
            foreach (var r in All) if (Array.IndexOf(r.Provs, prov) >= 0) return r.Id;
            return "";
        }

        /// <summary>이 트랙의 모든 성(시작 셋 + 적 성) — 지역 표 진단·천하도 셈.</summary>
        public static IEnumerable<string> AllCities()
        {
            foreach (var id in RealmCityData.AllCityIds) yield return id;
            foreach (var id in RealmEnemyCity.AllIds) yield return id;
        }

        public static List<string> CitiesIn(string regionId, IEnumerable<string> cityIds)
        {
            var list = new List<string>();
            foreach (var id in cityIds) if (RegionOf(id) == regionId) list.Add(id);
            return list;
        }

        /// <summary>길이 이어진 이웃 지역(대칭).</summary>
        public static string[] Neighbors(string regionId)
        {
            if (_neighbors == null) BuildNeighbors();
            return _neighbors.TryGetValue(regionId ?? "", out var n) ? n : Array.Empty<string>();
        }

        private static void BuildNeighbors()
        {
            var sets = new Dictionary<string, SortedSet<string>>();
            void Link(string a, string b)
            {
                if (a.Length == 0 || b.Length == 0 || a == b) return;
                if (!sets.TryGetValue(a, out var sa)) sets[a] = sa = new SortedSet<string>();
                if (!sets.TryGetValue(b, out var sb)) sets[b] = sb = new SortedSet<string>();
                sa.Add(b); sb.Add(a);
            }
            foreach (var id in RealmEnemyCity.AllIds)
            {
                var d = RealmEnemyCity.Get(id);
                if (d != null && !string.IsNullOrEmpty(d.AttackFromCityId)) Link(RegionOf(id), RegionOf(d.AttackFromCityId));
            }
            _neighbors = new Dictionary<string, string[]>();
            foreach (var kv in sets) _neighbors[kv.Key] = new List<string>(kv.Value).ToArray();
        }

        /// <summary>수도 지역 — 시작 성(허창)을 가졌으면 그 지역, 아니면 지금 성의 지역.</summary>
        public static string CapitalRegion()
        {
            string cap = RealmCityState.OwnsCity(RealmCityData.StartingCityId) ? RealmCityData.StartingCityId : RealmCityState.CurrentCity;
            string r = RegionOf(cap);
            return r.Length > 0 ? r : All[1].Id;
        }

        /// <summary>지금 보는 지역(빈 값이면 수도 지역).</summary>
        public static string View => _view.Length > 0 && Get(_view) != null ? _view : CapitalRegion();

        public static void SetView(string regionId)
        {
            if (Get(regionId) == null) return;
            if (_view == regionId) return;
            _view = regionId;
            Changed?.Invoke();
        }

        /// <summary>지도에 짓는 내 성 — 켜면 보는 지역 것만, 끄면 전부.</summary>
        public static List<string> VisibleOwned()
        {
            var own = RealmCityState.ActiveCityIds;
            if (!On) return new List<string>(own);
            return CitiesIn(View, own);
        }

        /// <summary>지도에 회색으로 짓는 적 성(보는 지역 안, 아직 안 함락) — 끄면 없음.</summary>
        public static List<string> VisibleEnemies()
        {
            var list = new List<string>();
            if (!On) return list;
            foreach (var id in RealmEnemyCity.AllIds)
                if (!RealmCityState.OwnsCity(id) && RegionOf(id) == View && RealmCityData.Get(id) != null) list.Add(id);
            return list;
        }

        /// <summary>천하도 카드 한 줄 — "중원 · 내 성 3 · 적 성 5 · ⚔"(맞닿은 적이 있으면 ⚔).</summary>
        public static (int mine, int enemy, bool front) Counts(string regionId)
        {
            int mine = 0, enemy = 0;
            bool front = false;
            foreach (var id in AllCities())
            {
                if (RegionOf(id) != regionId) continue;
                if (RealmCityState.OwnsCity(id)) mine++;
                else
                {
                    enemy++;
                    var d = RealmEnemyCity.Get(id);
                    if (d != null && RealmCityState.OwnsCity(d.AttackFromCityId)) front = true;
                }
            }
            return (mine, enemy, front);
        }

        private static string _lastCurrent = "";

        /// <summary>지도 짓기 첫머리 — 지금 성이 바뀌었고 그 성이 다른 지역이면 그 지역으로(첫 관찰은 세이브 값을 지킨다). 이벤트 없음(짓는 중).</summary>
        public static void FollowCurrent()
        {
            string c = RealmCityState.CurrentCity ?? "";
            if (_lastCurrent.Length == 0) { _lastCurrent = c; return; }
            if (c == _lastCurrent) return;
            _lastCurrent = c;
            if (!On || !RealmCityState.OwnsCity(c)) return;
            string r = RegionOf(c);
            if (r.Length > 0) _view = r;
        }

        public static string Snapshot() => _view;
        public static void Restore(string view) { _view = view ?? ""; _lastCurrent = ""; Changed?.Invoke(); }
        public static void ResetForTest() { _view = ""; _lastCurrent = ""; On = true; _neighbors = null; }
    }
}
