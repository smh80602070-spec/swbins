using System;
using System.Collections.Generic;
using UnityEngine;

namespace Saga.Realm.Data
{
    /// <summary>
    /// tasks U-0136 불가사의 경쟁(웹 W-0279 `wonder.js`·고돗 G-0243) — 큰 공사 여섯(웹 표 그대로: 달·금·인부·효과 key·pct). 기술 나무 학 갈래
    /// 「큰 도면」(<see cref="RealmTechData.WonderOpen"/>)이 문. 우리 성 하나에서 착공하면 금·인부(그 성 병력)가 나가고 달마다 −1, **먼저 다 지은 쪽만**
    /// 효과(<see cref="RealmTechData.Pct"/> 에 더함)·늦은 쪽은 금 반 환급·인부 귀환. 한 번에 하나만.
    /// 이 트랙엔 적 세력이 없어 **경쟁자 = 함락 안 된 적 성**: 첫 달 처리에서 12달이 지난 뒤, 병력 ≥ 인부×0.25×2.5 인 성이 hash(성@달)%6==0 인 달에만
    /// 착공(굴림 없음, 고돗과 같은 꼴 — 적 성 병력이 웹의 ¼ 쯤이라 인부도 ×0.25). 적이 지은 것은 그 성과 싸울 때만 뜻이 선다(수비·공격),
    /// 나머지(금·군량·계략·내정)는 적 성에 칸이 없어 빈 효과. 손잡이 <see cref="RivalOn"/>.
    /// </summary>
    public static class RealmWonder
    {
        public const float Refund = 0.5f, RivalMen = 0.25f, RivalGate = 2.5f;
        public const int RivalFrom = 12, MenSpare = 500;
        public static bool RivalOn = true;

        public class Def
        {
            public string Id, Ko, Emoji, Key, DescKo;
            public int Months, Gold, Men, Pct;
            public string Name => RealmLocalization.T("wonder." + Id, Ko);
            public string Desc => RealmLocalization.T("wonder." + Id + "_desc", DescKo);
        }

        public static readonly Def[] All =
        {
            new Def { Id = "wall", Ko = "만리 장벽", Emoji = "🧱", Months = 12, Gold = 4000, Men = 3000, Key = "defPct", Pct = 10, DescKo = "세력 전체 수비 +10%" },
            new Def { Id = "canal", Ko = "큰 물길", Emoji = "🛶", Months = 10, Gold = 3600, Men = 2500, Key = "goldPct", Pct = 8, DescKo = "세력 전체 금 수입 +8%" },
            new Def { Id = "star", Ko = "별 보는 대", Emoji = "🔭", Months = 8, Gold = 3000, Men = 1500, Key = "plotPct", Pct = 10, DescKo = "계략 성공률 +10%" },
            new Def { Id = "school", Ko = "큰 배움터", Emoji = "📚", Months = 9, Gold = 3200, Men = 1500, Key = "govPct", Pct = 8, DescKo = "내정(개간·상업·기술·치안) +8%" },
            new Def { Id = "farm", Ko = "너른 장원", Emoji = "🌾", Months = 7, Gold = 2600, Men = 2000, Key = "foodPct", Pct = 10, DescKo = "세력 전체 군량 +10%" },
            new Def { Id = "bridge", Ko = "큰 다리", Emoji = "🌉", Months = 6, Gold = 2400, Men = 2000, Key = "atkPct", Pct = 6, DescKo = "세력 전체 공격 +6%" },
        };

        public const string Me = "me";

        [Serializable] public class Built { public string id, by, city; public int year, month; }
        [Serializable] public class Job { public string by, id, city; public int left, gold, men; }
        [Serializable] private class Store { public List<Built> built = new List<Built>(); public List<Job> jobs = new List<Job>(); public int firstIdx = -1; }

        private static Store _s = new Store();
        public static event Action Changed;

        public static Def Get(string id) => Array.Find(All, d => d.Id == id);
        public static Built BuiltOf(string id) => _s.built.Find(b => b.id == id);
        public static Job JobOf(string by) => _s.jobs.Find(j => j.by == by);
        public static IReadOnlyList<Job> Jobs => _s.jobs;
        private static int MonthIdx => RealmCityState.Year * 12 + RealmCityState.Month;

        /// <summary>그 세력(우리 = "me", 적 = 적 성 id)이 다 지은 불가사의의 그 key 합(%).</summary>
        public static int PctOf(string by, string key)
        {
            int n = 0;
            foreach (var b in _s.built) { var d = Get(b.id); if (b.by == by && d != null && d.Key == key) n += d.Pct; }
            return n;
        }

        /// <summary>우리 몫 — RealmTechData.Pct 가 더한다.</summary>
        public static int Pct(string key) => PctOf(Me, key);

        /// <summary>그 적 성과 싸울 때 적 쪽 배율(수비·공격만, 함락됐으면 1).</summary>
        public static float EnemyMul(string enemyId, string key)
        {
            var e = RealmWarState.Get(enemyId);
            if (e == null || e.Captured) return 1f;
            return 1f + PctOf(enemyId, key) / 100f;
        }

        private static bool Owns(string cityId)
        {
            foreach (var id in RealmCityState.ActiveCityIds) if (id == cityId) return true;
            return false;
        }

        private static string CityName(string id) => RealmCityData.Get(id)?.Name ?? RealmEnemyCity.Get(id)?.Name ?? id;
        private static string ByName(string by) => by == Me ? RealmLocalization.T("wonder.us", "우리") : CityName(by);

        /// <summary>우리가 이 성에서 짓기 — 못 하면 이유(null = 됨).</summary>
        public static string Why(string id, string cityId)
        {
            var d = Get(id);
            if (d == null) return RealmLocalization.T("wonder.why_none", "없는 불가사의");
            var b = BuiltOf(id);
            if (b != null) return string.Format(RealmLocalization.T("wonder.why_built", "이미 {0} 이(가) 지었습니다"), ByName(b.by));
            if (!RealmTechData.WonderOpen) return RealmLocalization.T("wonder.why_tech", "학 갈래 「큰 도면」을 먼저 연구해야 합니다");
            var mine = JobOf(Me);
            if (mine != null) return string.Format(RealmLocalization.T("wonder.why_busy", "이미 {0} 을(를) 짓는 중입니다"), Get(mine.id).Name);
            var c = RealmCityState.CityRecord(cityId);
            if (c == null || !Owns(cityId)) return RealmLocalization.T("wonder.why_city", "우리 성에서만 짓습니다");
            if (RealmCityState.Gold < d.Gold) return string.Format(RealmLocalization.T("wonder.why_gold", "금이 모자랍니다({0})"), d.Gold);
            if (c.Troops < d.Men + MenSpare) return string.Format(RealmLocalization.T("wonder.why_men", "인부(병력 {0})가 모자랍니다"), d.Men);
            return null;
        }

        public static string Start(string id, string cityId)
        {
            string why = Why(id, cityId);
            if (why != null) return why;
            var d = Get(id);
            RealmCityState.TrySpendGold(d.Gold);
            RealmCityState.CityRecord(cityId).Troops -= d.Men;
            _s.jobs.Add(new Job { by = Me, id = id, city = cityId, left = d.Months, gold = d.Gold, men = d.Men });
            Changed?.Invoke();
            return null;
        }

        private static void GiveBack(Job j, float frac)
        {
            if (j.by == Me)
            {
                if (frac > 0f) RealmCityState.AddGold(Mathf.RoundToInt(j.gold * frac));
                var c = RealmCityState.CityRecord(j.city);
                if (c != null && Owns(j.city)) c.Troops += j.men;
            }
            else
            {
                var e = RealmWarState.Get(j.by);
                if (e != null && !e.Captured) e.Troops += j.men;
            }
        }

        // ---- 달(RealmCityState.NextMonth) ----

        /// <summary>적 착공 → 남은 달 −1 → 완공(먼저 센 쪽)·늦은 쪽 환급. 돌려주는 줄은 달 요약에.</summary>
        public static List<string> Monthly()
        {
            var lines = new List<string>();
            if (_s.firstIdx < 0) _s.firstIdx = MonthIdx;
            if (RivalOn) RivalStep(lines);
            var done = new List<Job>();
            foreach (var j in new List<Job>(_s.jobs))
            {
                if (j.by != Me) { var e = RealmWarState.Get(j.by); if (e == null || e.Captured) { _s.jobs.Remove(j); continue; } } // 함락된 적 성 — 공사도 끝
                if (--j.left <= 0) done.Add(j);
            }
            done.Sort((a, b) => a.by == Me ? -1 : b.by == Me ? 1 : string.CompareOrdinal(a.by, b.by)); // 같은 달이면 우리 먼저, 다음은 id 순
            foreach (var j in done)
            {
                if (!_s.jobs.Contains(j)) continue;
                _s.jobs.Remove(j);
                var d = Get(j.id);
                if (BuiltOf(j.id) != null) { GiveBack(j, Refund); continue; }
                _s.built.Add(new Built { id = j.id, by = j.by, city = j.city, year = RealmCityState.Year, month = RealmCityState.Month });
                GiveBack(j, 0f);
                lines.Add(string.Format(RealmLocalization.T("wonder.done", "🏛️ {0} 이(가) {1} {2} 을(를) 다 지었다 — {3}"), ByName(j.by), d.Emoji, d.Name, d.Desc));
                foreach (var k in new List<Job>(_s.jobs))
                {
                    if (k.id != j.id) continue;
                    GiveBack(k, Refund);
                    _s.jobs.Remove(k);
                    if (k.by == Me) lines.Add(string.Format(RealmLocalization.T("wonder.lost", "😞 {0} — {1} 이(가) 먼저 지었다. 들인 금의 반을 돌려받았다"), d.Name, ByName(j.by)));
                }
            }
            if (lines.Count > 0) Changed?.Invoke();
            return lines;
        }

        private static void RivalStep(List<string> lines)
        {
            if (MonthIdx - _s.firstIdx < RivalFrom) return;
            foreach (var id in RealmEnemyCity.AllIds)
            {
                var def = RealmEnemyCity.Get(id);
                var e = RealmWarState.Get(id);
                if (def == null) continue;
                if (e == null || e.Captured || JobOf(def.Id) != null) continue;
                if (Hash(def.Id, MonthIdx) % 6 != 0) continue;
                var free = new List<Def>();
                foreach (var d in All) if (BuiltOf(d.Id) == null && e.Troops >= d.Men * RivalMen * RivalGate) free.Add(d);
                if (free.Count == 0) continue;
                var w = free[Hash(def.Id + "@w", MonthIdx) % free.Count];
                int men = Mathf.RoundToInt(w.Men * RivalMen);
                e.Troops -= men;
                _s.jobs.Add(new Job { by = def.Id, id = w.Id, city = def.Id, left = w.Months, gold = 0, men = men });
                lines.Add(string.Format(RealmLocalization.T("wonder.rival", "{0} {1} 이(가) {2} 을(를) 짓기 시작했다({3}달)"), w.Emoji, def.Name, w.Name, w.Months));
            }
        }

        private static int Hash(string s, int n)
        {
            unchecked
            {
                int h = n;
                foreach (char ch in s) h = h * 31 + ch;
                return h & 0x7fffffff;
            }
        }

        /// <summary>진행률 한 줄(창) — 완공한 쪽 또는 짓는 쪽들 %.</summary>
        public static string RaceLine(string id)
        {
            var b = BuiltOf(id);
            if (b != null) return string.Format(RealmLocalization.T("wonder.line_built", "{0} 완공"), ByName(b.by));
            var d = Get(id);
            var parts = new List<string>();
            foreach (var j in _s.jobs) if (j.id == id) parts.Add($"{ByName(j.by)} {Mathf.RoundToInt((1f - j.left / (float)d.Months) * 100f)}%");
            return parts.Count > 0 ? string.Join(" · ", parts) : RealmLocalization.T("wonder.line_none", "아무도 안 짓는 중");
        }

        // ---- 저장 ----

        public static string Snapshot() => JsonUtility.ToJson(_s);

        public static void Restore(string json)
        {
            Store s = null;
            if (!string.IsNullOrEmpty(json)) { try { s = JsonUtility.FromJson<Store>(json); } catch (ArgumentException) { s = null; } }
            _s = s ?? new Store();
            if (_s.built == null) _s.built = new List<Built>();
            if (_s.jobs == null) _s.jobs = new List<Job>();
            Changed?.Invoke();
        }

        /// <summary>진단 — 적 성 착공을 바로 넣는다(굴림·문턱 없이).</summary>
        public static void RivalStartForTest(string enemyId, string id, int left)
        {
            _s.jobs.RemoveAll(j => j.by == enemyId);
            _s.jobs.Add(new Job { by = enemyId, id = id, city = enemyId, left = left, gold = 0, men = 0 });
        }

        /// <summary>진단 — 첫 달 기준을 옮긴다(적 착공 12달 문).</summary>
        public static void SetFirstForTest(int monthsAgo) => _s.firstIdx = MonthIdx - monthsAgo;

        public static void ResetForTest()
        {
            Restore(null);
            RivalOn = true;
        }
    }
}
