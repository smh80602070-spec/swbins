using System;
using System.Collections.Generic;
using UnityEngine;

namespace Saga.Forest.Data
{
    /// <summary>
    /// tasks U-0173 가축 기르기(웹 사가마을 W-0299 `livestock.js` · 고돗 G-0311 짝) — 제작대 창 「🐔 우리」 로 **작은 우리**(하나)를 짓고 꼬꼬(닭)·매매(염소)
    /// 새끼를 들인다(<see cref="Max"/>마리까지). 날마다 열매 하나를 먹이면 다음 아침 달걀·산양젖(하트 3 이상이면 둘), 안 먹인 날은 없음·
    /// <see cref="LeaveDays"/>일 내리 굶으면 떠난다. 하루 한 번 쓰다듬으면 하트 +1(최대 <see cref="HeartMax"/>).
    ///
    /// **이 트랙 다름**: 금도 가방도 없어 화폐 = 열매. 웹 값은 웹 능금 40벨 = 열매 1 로 바꿨다(꼬꼬 400→10·매매 900→22·달걀 60→2·산양젖 150→4,
    /// 우리 솔방울 10·광석 2 → 12 — 빈 집 15 와 같은 셈). 산물은 가방이 없어 아침에 그 값만큼 열매로 넣고 알림에 이름·수를 적는다.
    /// 날 바뀜은 <see cref="ForestVisitors.Today"/>(실제 날짜) — `ForestLots.Tick` 과 같은 꼴, 빠진 날은 굶은 날로 센다(고돗과 같음). 손잡이 <see cref="On"/>.
    /// </summary>
    public static class ForestLivestock
    {
        public const int Max = 4, HeartMax = 5, HeartTwo = 3, LeaveDays = 3, PenFruit = 12, FeedFruit = 1;
        public static bool On = true;

        public class Kind
        {
            public string Key, Ko, Emoji, ProductKey, ProductKo, ProductEmoji;
            public int Price, ProductFruit;
            public string Name => ForestLocalization.T("stock.kind." + Key, Ko);
            public string Product => ForestLocalization.T("stock.product." + ProductKey, ProductKo);
        }

        public static readonly Kind[] Kinds =
        {
            new Kind { Key = "chick", Ko = "꼬꼬", Emoji = "🐔", Price = 10, ProductKey = "egg", ProductKo = "달걀", ProductEmoji = "🥚", ProductFruit = 2 },
            new Kind { Key = "goat", Ko = "매매", Emoji = "🐐", Price = 22, ProductKey = "milk", ProductKo = "산양젖", ProductEmoji = "🥛", ProductFruit = 4 },
        };

        [Serializable] public class Animal { public string kind, name; public bool fed, petted; public int heart, hungry; }
        [Serializable] private class Store { public bool pen; public List<Animal> list = new List<Animal>(); public int rolled = int.MinValue; }

        /// <summary>아침 굴림 결과 — 거둔 산물(종 key → 수)·바꾼 열매·떠난 이름.</summary>
        public class Morning
        {
            public readonly Dictionary<string, int> Got = new Dictionary<string, int>();
            public int Fruit;
            public readonly List<string> Left = new List<string>();
            public bool Any => Fruit > 0 || Left.Count > 0;
        }

        private static Store _s = new Store();
        public static event Action Changed;

        public static bool HasPen => _s.pen;
        public static IReadOnlyList<Animal> List => _s.list;
        public static int Count => _s.list.Count;
        public static Kind KindOf(string key) => Array.Find(Kinds, k => k.Key == key);

        /// <summary>우리 짓기 — 실패면 이유 키(stock.why_*), 되면 null.</summary>
        public static string BuildPen()
        {
            if (!On) return "stock.why_off";
            if (_s.pen) return "stock.why_pen_one";
            if (!ForestState.SpendFruit(PenFruit)) return "stock.why_fruit";
            _s.pen = true;
            Touch();
            return null;
        }

        /// <summary>새끼 들이기 — 실패면 이유 키, 되면 null.</summary>
        public static string Buy(string kind)
        {
            var K = KindOf(kind);
            if (!On) return "stock.why_off";
            if (K == null) return "stock.why_none";
            if (!_s.pen) return "stock.why_no_pen";
            if (_s.list.Count >= Max) return "stock.why_max";
            if (!ForestState.SpendFruit(K.Price)) return "stock.why_fruit";
            int n = _s.list.FindAll(a => a.kind == kind).Count;
            _s.list.Add(new Animal { kind = kind, name = K.Name + (n > 0 ? " " + (n + 1) : "") });
            Touch();
            return null;
        }

        public static string Feed(int i)
        {
            if (i < 0 || i >= Count) return "stock.why_none";
            var a = _s.list[i];
            if (a.fed) return "stock.why_fed";
            if (!ForestState.SpendFruit(FeedFruit)) return "stock.why_feed";
            a.fed = true;
            Touch();
            return null;
        }

        public static string Pet(int i)
        {
            if (i < 0 || i >= Count) return "stock.why_none";
            var a = _s.list[i];
            if (a.petted) return "stock.why_petted";
            a.petted = true;
            a.heart = Mathf.Min(HeartMax, a.heart + 1);
            Touch();
            return null;
        }

        /// <summary>날이 넘어갔으면 굴린다 — 처음 본 날은 적기만. 빠진 날마다 한 번(첫 날만 어제 먹이를 보고, 나머지는 굶은 날).</summary>
        public static Morning Tick(int today)
        {
            var m = new Morning();
            if (!On) return m;
            if (_s.rolled == int.MinValue) { _s.rolled = today; Touch(); return m; }
            if (today <= _s.rolled) return m;
            int days = Mathf.Min(today - _s.rolled, LeaveDays + 1);
            _s.rolled = today;
            for (int d = 0; d < days; d++) RollOne(m);
            ForestState.AddFruit(m.Fruit); // 산물 값 — 가방이 없어 열매로
            Touch();
            return m;
        }

        private static void RollOne(Morning m)
        {
            var keep = new List<Animal>();
            foreach (var a in _s.list)
            {
                var K = KindOf(a.kind);
                if (a.fed && K != null)
                {
                    int n = a.heart >= HeartTwo ? 2 : 1;
                    m.Got.TryGetValue(K.Key, out int had);
                    m.Got[K.Key] = had + n;
                    m.Fruit += n * K.ProductFruit;
                    a.hungry = 0;
                }
                else a.hungry++;
                a.fed = false;
                a.petted = false;
                if (a.hungry >= LeaveDays) m.Left.Add(a.name); else keep.Add(a);
            }
            _s.list = keep;
        }

        /// <summary>알림 한 줄(없으면 null).</summary>
        public static string Line(Morning m)
        {
            if (m == null || !m.Any) return null;
            var parts = new List<string>();
            foreach (var K in Kinds) if (m.Got.TryGetValue(K.Key, out int n)) parts.Add($"{K.ProductEmoji} {K.Product} {n}");
            string s = parts.Count > 0 ? string.Format(ForestLocalization.T("stock.morning", "🐔 우리 — 아침에 거뒀다: {0} (열매 +{1})"), string.Join(" · ", parts), m.Fruit) : "";
            if (m.Left.Count > 0) s += (s.Length > 0 ? "\n" : "") + string.Format(ForestLocalization.T("stock.left", "🐐 사흘 굶은 {0} 이(가) 우리를 떠났다"), string.Join("·", m.Left));
            return s;
        }

        // ---- 저장 ----

        public static string Snapshot() => JsonUtility.ToJson(_s);

        public static void Restore(string json)
        {
            Store s = null;
            if (!string.IsNullOrEmpty(json)) { try { s = JsonUtility.FromJson<Store>(json); } catch (ArgumentException) { s = null; } }
            _s = s ?? new Store();
            if (_s.list == null) _s.list = new List<Animal>();
            _s.list.RemoveAll(a => a == null || KindOf(a.kind) == null);
            if (_s.list.Count > Max) _s.list.RemoveRange(Max, _s.list.Count - Max);
            foreach (var a in _s.list) { if (a.name == null) a.name = KindOf(a.kind).Name; a.heart = Mathf.Clamp(a.heart, 0, HeartMax); a.hungry = Mathf.Max(0, a.hungry); }
            Touch();
        }

        public static void ResetForTest() => Restore(null);

        private static void Touch() => Changed?.Invoke();
    }
}
