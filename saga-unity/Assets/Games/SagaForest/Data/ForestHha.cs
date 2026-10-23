using System;
using UnityEngine;

namespace Saga.Forest.Data
{
    /// <summary>
    /// tasks U-0189 집 꾸미기 계절 심사(고돗 G-0330 `forest_hha.gd` 짝, 웹 짝 없음) — 집 평가(<see cref="ForestHomeState.Score"/>, 그대로)에
    /// 이번 계절 주제 가구 덤(🌸 봄 뜰 · ☀️ 여름 부엌 · 🍂 가을 사랑방 · ❄️ 겨울 안방 — 하나 +25·둘 이상 +40)을 더해 문턱 30·80·160·280·450 → ★1~5.
    /// 보상 = 별 × <see cref="FruitPerStar"/> 열매(고돗 금 300 = 열매 8, U-0177 과 같은 셈), 계절마다 가장 높은 별만큼 — 다시 심사해 오르면 차이만.
    /// 계절은 기기 날짜의 달(3~5 봄 …, 12월은 다음 해 겨울 열쇠). 이 트랙엔 「집 평가」 단추가 없어 가구를 놓을 때마다 심사한다(`ForestFurniturePlacer`).
    /// </summary>
    public static class ForestHha
    {
        public const int FruitPerStar = 8, ThemeOne = 25, ThemeTwo = 40;
        public static readonly int[] Steps = { 30, 80, 160, 280, 450 };

        /// <summary>끄면 심사 없음(고돗 `SAGA_HHA=0` 짝).</summary>
        public static bool On = true;
        /// <summary>진단 — 오늘 날짜(null = 기기 날짜).</summary>
        public static DateTime? TodayForTest;

        [Serializable]
        private class Store { public int key = -1; public int best; }

        private static Store _s = new Store();

        public static DateTime Today => TodayForTest ?? DateTime.Now;

        /// <summary>0 봄 · 1 여름 · 2 가을 · 3 겨울.</summary>
        public static int SeasonOf(int month) => month >= 3 && month <= 5 ? 0 : month >= 6 && month <= 8 ? 1 : month >= 9 && month <= 11 ? 2 : 3;

        /// <summary>계절 열쇠 — 12월은 다음 해 겨울(1·2월과 같은 열쇠).</summary>
        public static int KeyOf(DateTime d) => (d.Month == 12 ? d.Year + 1 : d.Year) * 4 + SeasonOf(d.Month);

        public static FurnitureSet ThemeOf(int season) => season == 0 ? FurnitureSet.Ddeul : season == 1 ? FurnitureSet.Buok : season == 2 ? FurnitureSet.Sarang : FurnitureSet.Anbang;

        public static string SeasonLabel(int season)
        {
            switch (season)
            {
                case 0: return ForestLocalization.T("hha.spring", "🌸 봄");
                case 1: return ForestLocalization.T("hha.summer", "☀️ 여름");
                case 2: return ForestLocalization.T("hha.autumn", "🍂 가을");
                default: return ForestLocalization.T("hha.winter", "❄️ 겨울");
            }
        }

        public static int ThemeCount(FurnitureSet theme)
        {
            int n = 0;
            foreach (var kv in ForestHomeState.AllPlacements())
            {
                var it = FurnitureItem.Get(kv.Value);
                if (it != null && it.Set == theme) n++;
            }
            return n;
        }

        public static int ThemeBonus(int count) => count >= 2 ? ThemeTwo : count == 1 ? ThemeOne : 0;

        public static int Stars(int score)
        {
            int s = 0;
            while (s < Steps.Length && score >= Steps[s]) s++;
            return s;
        }

        /// <summary>이번 계절 이미 받은 별(다른 계절이면 0).</summary>
        public static int BestNow => _s.key == KeyOf(Today) ? _s.best : 0;

        public struct Result { public int Season, Score, Bonus, Stars, Paid; }

        /// <summary>심사 — 오르면 차이만큼 열매를 준다.</summary>
        public static Result Judge()
        {
            var r = new Result();
            if (!On) return r;
            var d = Today;
            r.Season = SeasonOf(d.Month);
            r.Bonus = ThemeBonus(ThemeCount(ThemeOf(r.Season)));
            r.Score = ForestHomeState.Score().Total + r.Bonus;
            r.Stars = Stars(r.Score);
            int key = KeyOf(d);
            int best = _s.key == key ? _s.best : 0;
            if (r.Stars > best)
            {
                r.Paid = (r.Stars - best) * FruitPerStar;
                ForestState.AddFruit(r.Paid);
                _s.key = key;
                _s.best = r.Stars;
            }
            return r;
        }

        public static string Line(Result r)
        {
            string stars = new string('★', r.Stars) + new string('☆', Steps.Length - r.Stars);
            string theme = r.Bonus > 0 ? string.Format(ForestLocalization.T("hha.theme", "(주제 {0} +{1})"), FurnitureItem.SetName(ThemeOf(r.Season)), r.Bonus) : "";
            string pay = r.Paid > 0 ? string.Format(ForestLocalization.T("hha.paid", " 🍎 +{0}"), r.Paid) : "";
            return string.Format(ForestLocalization.T("hha.line", "{0} 심사 — {1} {2}점{3}{4}"), SeasonLabel(r.Season), stars, r.Score, theme, pay);
        }

        public static string Snapshot() => JsonUtility.ToJson(_s);

        public static void Restore(string json)
        {
            Store s = null;
            if (!string.IsNullOrEmpty(json)) { try { s = JsonUtility.FromJson<Store>(json); } catch (ArgumentException) { s = null; } }
            _s = s ?? new Store();
            _s.best = Mathf.Clamp(_s.best, 0, Steps.Length);
        }

        public static void ResetForTest() => Restore(null);
    }
}
