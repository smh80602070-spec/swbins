using System;
using UnityEngine;

namespace Saga.Forest.Data
{
    /// <summary>
    /// tasks U-0229 ① 별똥별 소원(고돗 G-0381 역이식). 밤 = 시스템 시계 21~4시(고돗과 같음 — 이 판엔 낮밤 순환이 없음) · 마을 밖(존 안)에서
    /// 25~60초마다 별똥별 + 3초 「🌠 소원 빌기」 단추 · 한 밤 다섯까지 · 이튿날 마을에 처음 들 때 빈 수만큼 열매 +20 씩(이 판 돈 = 열매 — 고돗 "별 조각"·금 대신).
    /// 밤 열쇠 = 그 밤의 날짜(새벽 4시 전이면 전날). 세이브 `starsJson`(버전 그대로 — 옛 세이브 null → 빈 소원 0). 손잡이 `SAGA_FOREST_STARS=0`.
    /// </summary>
    public static class ForestStars
    {
        public const int NightFrom = 21, NightTo = 4, MaxWishes = 5, FruitPerWish = 20;
        public const float MinGap = 25f, MaxGap = 60f, ButtonSec = 3f;

        public static bool On = Environment.GetEnvironmentVariable("SAGA_FOREST_STARS") != "0";
        /// <summary>진단이 시각을 붙든다 — 없으면 지금.</summary>
        public static Func<DateTime> NowFn = () => DateTime.Now;

        [Serializable] private class Store { public int night = int.MinValue; public int wishes; public int pendingNight = int.MinValue; public int pending; }
        private static Store _s = new Store();

        public static bool IsNight(DateTime t) => t.Hour >= NightFrom || t.Hour < NightTo;
        /// <summary>그 밤 열쇠(2000-01-01 부터 며칠째, 새벽은 전날).</summary>
        public static int NightKey(DateTime t)
        {
            int day = (int)(t.Date - new DateTime(2000, 1, 1)).TotalDays;
            return t.Hour < NightTo ? day - 1 : day;
        }

        /// <summary>n 번째 별똥별까지의 틈(초, 순수 — 그 밤·순번으로 결정).</summary>
        public static float GapOf(int night, int n)
        {
            uint h = 2166136261u;
            foreach (int v in new[] { night, n }) for (int k = 0; k < 4; k++) { h ^= (uint)((v >> (8 * k)) & 0xff); h *= 16777619u; }
            return Mathf.Lerp(MinGap, MaxGap, (h & 0xFFFF) / 65535f);
        }

        /// <summary>이 밤 빈 소원 수.</summary>
        public static int WishesTonight => _s.night == NightKey(NowFn()) ? _s.wishes : 0;
        /// <summary>받을 차례가 된 소원(이전 밤에 빈 것).</summary>
        public static int Pending => _s.pending + (_s.night != int.MinValue && _s.night != NightKey(NowFn()) ? _s.wishes : 0);

        /// <summary>소원 하나 — 이 밤 다섯 안이면 참.</summary>
        public static bool Wish()
        {
            var now = NowFn();
            if (!On || !IsNight(now)) return false;
            int key = NightKey(now);
            if (_s.night != key) { RollOver(); _s.night = key; _s.wishes = 0; }
            if (_s.wishes >= MaxWishes) return false;
            _s.wishes++;
            return true;
        }

        /// <summary>밤이 바뀌면 지난 밤 소원을 받을 차례로 옮긴다.</summary>
        private static void RollOver()
        {
            if (_s.night == int.MinValue || _s.wishes <= 0) return;
            _s.pending += _s.wishes; _s.pendingNight = _s.night; _s.wishes = 0;
        }

        /// <summary>마을에 들었다 — 지난 밤(들) 소원이 있으면 열매로 받는다(받은 열매, 없으면 0). 같은 밤 안이면 아직 안 줌.</summary>
        public static int ClaimOnVillage()
        {
            var now = NowFn();
            int key = NightKey(now);
            if (_s.night != int.MinValue && _s.night != key) { RollOver(); _s.night = int.MinValue; }
            if (_s.pending <= 0) return 0;
            int fruit = _s.pending * FruitPerWish;
            _s.pending = 0;
            ForestState.AddFruit(fruit);
            return fruit;
        }

        public static string Snapshot() => JsonUtility.ToJson(_s);
        public static void Restore(string json)
        {
            _s = new Store();
            if (string.IsNullOrEmpty(json)) return;
            try { _s = JsonUtility.FromJson<Store>(json) ?? new Store(); } catch { _s = new Store(); }
        }
        public static void ResetForTest() => _s = new Store();
    }
}
