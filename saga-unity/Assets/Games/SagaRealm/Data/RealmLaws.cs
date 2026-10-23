using System;
using System.Collections.Generic;
using UnityEngine;

namespace Saga.Realm.Data
{
    /// <summary>
    /// tasks U-0182 법령(고돗 G-0321 `realm_laws.gd` 짝, 웹 짝 없음) — 득·실이 함께 오는 법령을 내린다. 한 번 내리면 거둘 수 없고, <see cref="GapMonths"/>달 뒤에야 다음 법령.
    /// 🏪 상업령 금 +15%·수확 −10% · 🌾 둔전령 군량 먹음 −20%·금 −10% · 🛡️ 징병령 징병 +25%·등용 −15%.
    /// 이 트랙엔 무장 충성·이탈·경험·관직이 없어(`RealmEventState`·`RealmOfficerTraits` 머리말) 고돗 ⚖️ 엄법령(이탈 −50%·경험 −10%)은 뺐고,
    /// 법전 칸 = 1 + 관직 단계 대신 **다스리는 성 수**(최대 <see cref="MaxSlots"/>) — 땅이 넓어야 법전이 넓다.
    /// 곱은 `RealmCityState` 월 결산(금·수확·군량)·징병·등용 자리에 하나씩 — 빈 법전이면 모두 1.
    /// </summary>
    public static class RealmLaws
    {
        public const int GapMonths = 6, MaxSlots = 3;

        public sealed class Law
        {
            public readonly string Key, Emoji, Ko, DescKo;
            public readonly float Gold, Harvest, Eat, Draft, Hire;
            public Law(string key, string emoji, string ko, string desc, float gold = 1f, float harvest = 1f, float eat = 1f, float draft = 1f, float hire = 1f)
            { Key = key; Emoji = emoji; Ko = ko; DescKo = desc; Gold = gold; Harvest = harvest; Eat = eat; Draft = draft; Hire = hire; }
            public string Name => RealmLocalization.T("law." + Key, Ko);
            public string Desc => RealmLocalization.T("law." + Key + ".desc", DescKo);
        }

        public static readonly Law[] All =
        {
            new Law("commerce", "🏪", "상업령", "금 +15% · 수확 −10%", gold: 1.15f, harvest: 0.9f),
            new Law("tuntian", "🌾", "둔전령", "군량 먹음 −20% · 금 −10%", gold: 0.9f, eat: 0.8f),
            new Law("draft", "🛡️", "징병령", "징병 +25% · 등용 −15%", draft: 1.25f, hire: 0.85f),
        };

        /// <summary>끄면 효과 없음·못 내림(고돗 `SAGA_LAWS=0` 짝).</summary>
        public static bool On = true;
        /// <summary>진단 — 성 수를 이 값으로(음수 = 진짜).</summary>
        public static int CitiesForTest = -1;

        [Serializable]
        private class Store { public List<string> laws = new List<string>(); public int lastAt = -999; }

        private static Store _s = new Store();

        public static event Action Changed;

        public static IReadOnlyList<string> Enacted => _s.laws;
        public static Law Get(string key) => Array.Find(All, l => l.Key == key);
        public static bool Has(string key) => _s.laws.Contains(key);

        public static int Slots => Mathf.Clamp(CitiesForTest >= 0 ? CitiesForTest : RealmCityState.ActiveCityIds.Count, 1, MaxSlots);
        public static int MonthIndex(int year, int month) => year * 12 + month;
        public static int NowIndex => MonthIndex(RealmCityState.Year, RealmCityState.Month);
        /// <summary>다음 법령까지 남은 달(0 = 지금 내릴 수 있음).</summary>
        public static int WaitMonths(int now) => Math.Max(0, _s.lastAt + GapMonths - now);

        private static float Mul(Func<Law, float> f)
        {
            if (!On) return 1f;
            float m = 1f;
            foreach (var k in _s.laws) { var l = Get(k); if (l != null) m *= f(l); }
            return m;
        }

        public static float GoldMul => Mul(l => l.Gold);
        public static float HarvestMul => Mul(l => l.Harvest);
        public static float EatMul => Mul(l => l.Eat);
        public static float DraftMul => Mul(l => l.Draft);
        public static float HireMul => Mul(l => l.Hire);

        /// <summary>못 내리면 이유 키, 되면 null.</summary>
        public static string Why(string key, int now)
        {
            if (!On) return "law.why_off";
            if (Get(key) == null) return "law.why_none";
            if (Has(key)) return "law.why_has";
            if (_s.laws.Count >= Slots) return "law.why_slots";
            if (WaitMonths(now) > 0) return "law.why_wait";
            return null;
        }

        public static string Enact(string key, int now)
        {
            string why = Why(key, now);
            if (why != null) return why;
            _s.laws.Add(key);
            _s.lastAt = now;
            Changed?.Invoke();
            return null;
        }

        public static string WhyText(string why, int now)
        {
            switch (why)
            {
                case "law.why_has": return RealmLocalization.T(why, "이미 내린 법령이다");
                case "law.why_slots": return string.Format(RealmLocalization.T(why, "법전이 가득 찼다 — 성 {0}곳이면 {0}개까지(최대 {1})"), Slots, MaxSlots);
                case "law.why_wait": return string.Format(RealmLocalization.T(why, "{0}달 뒤에야 다음 법령을 내릴 수 있다"), WaitMonths(now));
                case "law.why_off": return RealmLocalization.T(why, "법령이 꺼져 있다");
                default: return RealmLocalization.T("law.why_none", "내릴 수 없다");
            }
        }

        public static string Snapshot() => JsonUtility.ToJson(_s);

        public static void Restore(string json)
        {
            Store s = null;
            if (!string.IsNullOrEmpty(json)) { try { s = JsonUtility.FromJson<Store>(json); } catch (ArgumentException) { s = null; } }
            _s = s ?? new Store();
            if (_s.laws == null) _s.laws = new List<string>();
            _s.laws.RemoveAll(k => Get(k) == null);
            Changed?.Invoke();
        }

        public static void ResetForTest() => Restore(null);
    }
}
