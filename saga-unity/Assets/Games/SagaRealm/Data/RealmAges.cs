using System;
using UnityEngine;

namespace Saga.Realm.Data
{
    /// <summary>
    /// tasks U-0187 국세(國勢) 올리기(고돗 G-0329 `realm_ages.gd` 짝, 웹 짝 없음) — 단계 넷 🌫️ 난세 → 🧱 기틀 → 🏯 치세 → 🌅 성세.
    /// 다음 단계 = 우리 성 수(4·7·12) + 연구한 기술 마디(4·9·15) + 금(1500·3000·6000, 낸다). 단계마다 금 수입·수확 ×1.05(겹쳐 곱).
    /// 이 트랙엔 무장 경험이 없어 고돗 성세 "경험 ×1.1" 은 뺐다. 곱은 법령(<see cref="RealmLaws"/>)과 같은 월 결산 자리 — 난세면 1.
    /// 이름은 "시대"(인물 시대·시간 틈)와 안 겹치게 국세. 창은 법령 창 맨 위 줄(새 HUD 단추 없음).
    /// </summary>
    public static class RealmAges
    {
        public sealed class Age
        {
            public readonly string Key, Emoji, Ko;
            public readonly int Cities, Techs, Gold;
            public Age(string key, string emoji, string ko, int cities, int techs, int gold) { Key = key; Emoji = emoji; Ko = ko; Cities = cities; Techs = techs; Gold = gold; }
            public string Name => RealmLocalization.T("age." + Key, Ko);
        }

        /// <summary>[0] 은 시작 단계(문턱 없음), [i] 는 i 단계로 오르는 문턱.</summary>
        public static readonly Age[] All =
        {
            new Age("chaos", "🌫️", "난세", 0, 0, 0),
            new Age("base", "🧱", "기틀", 4, 4, 1500),
            new Age("order", "🏯", "치세", 7, 9, 3000),
            new Age("golden", "🌅", "성세", 12, 15, 6000),
        };

        public const float StepMul = 1.05f;

        /// <summary>끄면 곱 1·못 올림(고돗 `SAGA_AGES=0` 짝).</summary>
        public static bool On = true;
        /// <summary>진단 — 성 수·기술 마디 수를 이 값으로(음수 = 진짜).</summary>
        public static int CitiesForTest = -1, TechsForTest = -1;

        [Serializable]
        private class Store { public int age; }

        private static Store _s = new Store();

        public static event Action Changed;

        public static int Level => _s.age;
        public static Age Current => All[Mathf.Clamp(_s.age, 0, All.Length - 1)];
        public static Age Next => _s.age + 1 < All.Length ? All[_s.age + 1] : null;

        public static float Mul => On ? Mathf.Pow(StepMul, _s.age) : 1f;

        public static int Cities => CitiesForTest >= 0 ? CitiesForTest : RealmCityState.ActiveCityIds.Count;

        public static int Techs
        {
            get
            {
                if (TechsForTest >= 0) return TechsForTest;
                int n = 0;
                foreach (var b in RealmTechData.Branches) n += RealmTechData.DoneCount(b.Key);
                return n;
            }
        }

        /// <summary>못 올리면 이유 키, 되면 null.</summary>
        public static string Why()
        {
            if (!On) return "age.why_off";
            var nx = Next;
            if (nx == null) return "age.why_top";
            if (Cities < nx.Cities || Techs < nx.Techs) return "age.why_short";
            if (RealmCityState.Gold < nx.Gold) return "age.why_gold";
            return null;
        }

        public static string Advance()
        {
            string why = Why();
            if (why != null) return why;
            if (!RealmCityState.TrySpendGold(Next.Gold)) return "age.why_gold";
            _s.age++;
            Changed?.Invoke();
            return null;
        }

        /// <summary>법령 창 맨 위 두 줄.</summary>
        public static string Line()
        {
            var c = Current;
            string head = string.Format(RealmLocalization.T("age.head", "{0} 국세 {1} · 금·수확 ×{2:0.00}"), c.Emoji, c.Name, Mul);
            var nx = Next;
            if (nx == null) return head + "\n" + RealmLocalization.T("age.top", "가장 높은 국세다");
            string need = string.Format(RealmLocalization.T("age.need", "▶ {0} 올리기 — 성 {1} · 기술 {2} · 금 {3}"), nx.Name, nx.Cities, nx.Techs, nx.Gold);
            if (Why() == "age.why_short" || Why() == "age.why_gold")
                need += string.Format(RealmLocalization.T("age.short", " (모자람 — 성 {0}/{1} · 기술 {2}/{3} · 금 {4}/{5})"), Cities, nx.Cities, Techs, nx.Techs, RealmCityState.Gold, nx.Gold);
            return head + "\n" + need;
        }

        public static string WhyText(string why)
        {
            switch (why)
            {
                case "age.why_top": return RealmLocalization.T(why, "가장 높은 국세다");
                case "age.why_short": return RealmLocalization.T(why, "성이나 기술이 모자란다");
                case "age.why_gold": return RealmLocalization.T(why, "금이 모자란다");
                case "age.why_off": return RealmLocalization.T(why, "국세가 꺼져 있다");
                default: return RealmLocalization.T("age.why_none", "올릴 수 없다");
            }
        }

        public static string Snapshot() => JsonUtility.ToJson(_s);

        public static void Restore(string json)
        {
            Store s = null;
            if (!string.IsNullOrEmpty(json)) { try { s = JsonUtility.FromJson<Store>(json); } catch (ArgumentException) { s = null; } }
            _s = s ?? new Store();
            _s.age = Mathf.Clamp(_s.age, 0, All.Length - 1);
            Changed?.Invoke();
        }

        public static void ResetForTest() => Restore(null);
    }
}
