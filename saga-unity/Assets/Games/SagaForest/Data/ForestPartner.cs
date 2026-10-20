using System;
using System.Collections.Generic;
using UnityEngine;

namespace Saga.Forest.Data
{
    /// <summary>
    /// tasks U-0144 동반자(웹 사가마을 W-0288 `js/partner.js`·고돗 G-0232) — 관계 하트(<see cref="ForestHearts"/>) 끝에 함께 살기.
    ///
    ///   청하기   하트 10 인 눌러앉은 손님에게, 그날 선물·사연을 다 받은 뒤 다가서면 "함께 살겠소?" — 물러났다 다시 오면
    ///            표시 물건 값(웹 홍매 460 → 가구 값 셈 ÷100 = 과일 5)을 치르고 승낙. 한 명만(이미 있으면 청하지 않는다).
    ///   아침     날이 바뀐 뒤 그 사람에게 처음 다가서면 한 가지 — 날짜 해시로 뜰 손질(열매 +2) · 아침밥(열매 +4) ·
    ///            선물(좋아하는 태그의 가구 하나, `ForestLots.LikesOf`). 같은 날 두 번 안 한다.
    ///   기념일   함께 산 지 30일마다 — 그날 첫 말에 기념 대사·열매 6(웹 금 300 ÷ 50), 같은 날 다시 오면 대사만.
    ///   집 안    집 안 방 오른쪽 벽 곁에 동반자가 서 있다(`ForestVisitorRunner` — 밖 제자리에도 그대로).
    ///   헤어지기 집 안 동반자 곁 단추(두 번 눌러 확인) — 그 사람 하트 절반.
    ///
    /// **이 트랙 다름**: 가방이 없어 "홍매 한 송이를 건넨다"를 그 값 치르기로(웹 값 → 가구 값 셈), 경험이 없어 아침밥은 열매.
    /// 웹 "잡초 둘 뽑기"는 이 판에 잡초가 없어 열매 줍기로. 후보는 눌러앉은 손님만(숲지기는 집 안에 세울 몸이 없다).
    /// 세이브 `partnerJson`(버전 그대로 — 옛 세이브 null → 없음). 날짜는 <see cref="ForestVisitors.Today"/>.
    /// </summary>
    public static class ForestPartner
    {
        public const int TokenFruit = 5, AnnivDays = 30, AnnivFruit = 6, WaterFruit = 2, MealFruit = 4;
        public enum Morning { Water = 0, Meal = 1, Gift = 2 }

        [Serializable]
        private class Store { public string id = ""; public int since; public int last; public int anniv; public int annivDay = int.MinValue; public string askKey = ""; public int askDay = int.MinValue; }
        private static Store _s = new Store();

        public static event Action Changed;

        public static string Id => string.IsNullOrEmpty(_s.id) ? null : _s.id;
        public static bool Has => Id != null;
        public static bool IsPartner(string key) => Has && _s.id == key;
        public static int Since => _s.since;
        public static int Lived => Has ? ForestVisitors.Today - _s.since : 0;

        /// <summary>청할 수 있나 — 못 하면 이유 키.</summary>
        public static string WhyNot(string key)
        {
            if (Has) return "partner.why_has";
            if (!ForestVisitors.IsSettled(key)) return "partner.why_settled";
            if (ForestHearts.Of(key) < ForestHearts.Max) return "partner.why_heart";
            return null;
        }

        public static bool CanPropose(string key) => WhyNot(key) == null;

        /// <summary>말 걸기(눌러앉은 손님 평소 줄 자리) — 청하기 두 걸음. 첫 다가섬은 청, 다시 오면 값 치르고 승낙. 해당 없으면 null.</summary>
        public static string Ask(string key, string who)
        {
            if (!CanPropose(key)) return null;
            int day = ForestVisitors.Today;
            if (_s.askKey != key || _s.askDay != day)
            {
                _s.askKey = key;
                _s.askDay = day;
                return who + " — " + string.Format(ForestLocalization.T("partner.ask",
                    "💞 그대 곁에서 살고 싶소… 마음의 꽃값(과일 {0}개)을 들고 물러났다 다시 오시오"), TokenFruit);
            }
            if (!ForestState.SpendFruit(TokenFruit))
                return who + " — " + string.Format(ForestLocalization.T("partner.ask_short", "과일 {0}개가 있어야 하오(지금 {1}개)"), TokenFruit, ForestState.FruitCount);
            _s.id = key;
            _s.since = day;
            _s.last = day;
            _s.anniv = 0;
            _s.annivDay = int.MinValue;
            _s.askKey = "";
            Changed?.Invoke();
            return who + " — " + ForestLocalization.T("partner.accept", "❤️ 이 마음을... 내게? 좋소, 그대 곁에서 살겠소. 💞 (아침마다 한 가지를 거들어 드리리다)");
        }

        public static Morning MorningOf(int day) => (Morning)((int)(ForestVisitors.Hash01(day, 7331) * 3) % 3);

        public static bool IsAnniversary => Has && Lived > 0 && Lived % AnnivDays == 0;

        /// <summary>동반자에게 다가섬 — 날 바뀐 첫 말이면 아침 한 가지(+ 기념일), 기념일 다시 오면 대사만. 해당 없으면 null.</summary>
        public static string Talk(string key, string who)
        {
            if (!IsPartner(key)) return null;
            int day = ForestVisitors.Today;
            if (_s.last != day)
            {
                _s.last = day;
                string text = who + " — " + DoMorning(key, day);
                if (IsAnniversary)
                {
                    _s.anniv = Lived / AnnivDays;
                    _s.annivDay = day;
                    ForestState.AddFruit(AnnivFruit);
                    text += " · " + string.Format(ForestLocalization.T("partner.anniv", "💞 함께 산 지 {0}일째요. 그날의 마음을 아직 간직하고 있소. (과일 +{1})"), Lived, AnnivFruit);
                }
                return text;
            }
            if (IsAnniversary && _s.annivDay == day)
                return who + " — " + string.Format(ForestLocalization.T("partner.anniv_again", "💞 오늘로 {0}일이구려. 내일도 함께하오."), Lived);
            return null;
        }

        private static string DoMorning(string key, int day)
        {
            switch (MorningOf(day))
            {
                case Morning.Water:
                    ForestState.AddFruit(WaterFruit);
                    return string.Format(ForestLocalization.T("partner.water", "🌿 아침에 뜰을 손질하다 열매를 주워 왔소 (과일 +{0})"), WaterFruit);
                case Morning.Meal:
                    ForestState.AddFruit(MealFruit);
                    return string.Format(ForestLocalization.T("partner.meal", "🍚 아침밥을 차렸소 — 남은 건 싸 두었소 (과일 +{0})"), MealFruit);
                default:
                    var it = GiftItem(key, day);
                    if (it == null)
                    {
                        ForestState.AddFruit(WaterFruit);
                        return string.Format(ForestLocalization.T("partner.water", "🌿 아침에 뜰을 손질하다 열매를 주워 왔소 (과일 +{0})"), WaterFruit);
                    }
                    ForestHomeState.AddStock(it.Id, 1);
                    return string.Format(ForestLocalization.T("partner.gift", "🎁 「{0}」을(를) 구해 왔소 — 집 창고에 넣어 두었소"), it.Name);
            }
        }

        /// <summary>좋아하는 태그의 가구 하나(날짜 해시). 없으면 null.</summary>
        public static FurnitureItem GiftItem(string key, int day)
        {
            var likes = ForestLots.LikesOf(key);
            var pool = new List<FurnitureItem>();
            foreach (var f in FurnitureItem.Catalog) if (Array.IndexOf(likes, ForestLots.TagOf(f.Id)) >= 0) pool.Add(f);
            if (pool.Count == 0) return null;
            return pool[(int)(ForestVisitors.Hash01(day * 3 + 1, 4441) * pool.Count) % pool.Count];
        }

        /// <summary>헤어진다 — 하트 절반(내림). 없으면 null.</summary>
        public static string BreakUp(string who)
        {
            if (!Has) return null;
            string key = _s.id;
            int h = ForestHearts.Of(key);
            ForestHearts.Bump(key, -(h - h / 2));
            _s = new Store();
            Changed?.Invoke();
            return who + " — " + string.Format(ForestLocalization.T("partner.break", "...그렇구려. 그동안 고마웠소. 💔 (♥ {0}/{1})"), ForestHearts.Of(key), ForestHearts.Max);
        }

        public static string Snapshot() => JsonUtility.ToJson(_s);

        public static void Restore(string json)
        {
            Store s = null;
            if (!string.IsNullOrEmpty(json)) { try { s = JsonUtility.FromJson<Store>(json); } catch (ArgumentException) { s = null; } }
            _s = s ?? new Store();
            if (Has && ForestVisitors.IndexOf(_s.id) < 0) _s = new Store();
            Changed?.Invoke();
        }

        public static void ResetForTest() => Restore(null);
    }
}
