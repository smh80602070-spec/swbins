using System;
using System.Collections.Generic;
using UnityEngine;

namespace Saga.Forest.Data
{
    /// <summary>
    /// tasks U-0180 물약 양조(고돗 G-0320 `forest_brew.gd` 짝, 웹 짝 없음) — 약초 1 + 재료 하나를 섞어 달이면 곧바로 마셔 오늘 하루 효과 하나.
    /// 처음엔 무엇이 될지 모르고(❔) 한 번 달이면 이름이 밝혀진다. 새로 마시면 바뀐다.
    /// 이 트랙은 채집 = 기증이라 가방이 없다 → 유적 조각(U-0177)처럼 **양조 주머니**를 따로 둔다: 버섯 채집 = 약초, 꽃·곤충·화석 채집 = 그 재료 하나씩(갈래마다 최대 <see cref="PouchMax"/>),
    /// 열매는 원래 열매(<see cref="ForestState.FruitCount"/>)를 쓴다. 효과: 🍯 기운(열매 — 과일나무 흔들 때 +1) · 🌸 꽃향(꽃 — 주민 하트 오를 때 +1, 하루 상한 4 그대로) ·
    /// 💧 탁한 물약(곤충·화석 — 헛방). 고돗의 🐚 물빛(조개 — 낚시 입질 창)은 이 트랙에 조개·낚시가 없어 뺐다.
    /// </summary>
    public static class ForestBrew
    {
        public enum Mat { Fruit, Flower, Insect, Fossil }
        public enum Potion { None, Vigor, Scent, Murky }

        public const int PouchMax = 9;
        public static readonly Mat[] Mats = { Mat.Fruit, Mat.Flower, Mat.Insect, Mat.Fossil };

        /// <summary>끄면 주머니에 안 쌓이고 효과도 없음(고돗 `SAGA_BREW=0` 짝).</summary>
        public static bool On = true;

        [Serializable]
        private class Store { public int herb; public int flower, insect, fossil; public List<int> known = new List<int>(); public int potion; public int day = -1; }

        private static Store _s = new Store();

        public static event Action Changed;

        public static Potion Recipe(Mat m) => m == Mat.Fruit ? Potion.Vigor : m == Mat.Flower ? Potion.Scent : Potion.Murky;

        public static int Herbs => _s.herb;

        public static int Count(Mat m) => m == Mat.Fruit ? ForestState.FruitCount : m == Mat.Flower ? _s.flower : m == Mat.Insect ? _s.insect : _s.fossil;

        public static bool Known(Mat m) => _s.known.Contains((int)m);

        public static Potion ActiveOn(int today) => On && _s.day == today ? (Potion)_s.potion : Potion.None;
        public static Potion Active => ActiveOn(ForestVisitors.Today);

        /// <summary>`ForestFruitTree` — 기운이면 +1.</summary>
        public static int FruitBonus => Active == Potion.Vigor ? 1 : 0;
        /// <summary>`ForestHearts.Bump` — 오를 때 꽃향이면 +1(상한은 그쪽이 그대로 자른다).</summary>
        public static int HeartBonus => Active == Potion.Scent ? 1 : 0;

        /// <summary>`ForestCollectSpot` 채집 꼬리 — 버섯이면 약초, 꽃·곤충·화석이면 그 재료. 주머니가 차면 그대로.</summary>
        public static void OnGather(ForestMuseumState.Category c)
        {
            if (!On) return;
            switch (c)
            {
                case ForestMuseumState.Category.Mushroom: _s.herb = Math.Min(PouchMax, _s.herb + 1); break;
                case ForestMuseumState.Category.Flower: _s.flower = Math.Min(PouchMax, _s.flower + 1); break;
                case ForestMuseumState.Category.Insect: _s.insect = Math.Min(PouchMax, _s.insect + 1); break;
                case ForestMuseumState.Category.Fossil: _s.fossil = Math.Min(PouchMax, _s.fossil + 1); break;
            }
            Changed?.Invoke();
        }

        /// <summary>달이기 — 못 하면 이유 키, 되면 null(곧바로 마심·이름 밝혀짐).</summary>
        public static string Brew(Mat m, int today)
        {
            if (!On) return "brew.why_off";
            if (_s.herb < 1) return "brew.why_herb";
            if (Count(m) < 1) return "brew.why_mat";
            _s.herb--;
            switch (m)
            {
                case Mat.Fruit: ForestState.SpendFruit(1); break;
                case Mat.Flower: _s.flower--; break;
                case Mat.Insect: _s.insect--; break;
                case Mat.Fossil: _s.fossil--; break;
            }
            if (!_s.known.Contains((int)m)) _s.known.Add((int)m);
            _s.potion = (int)Recipe(m);
            _s.day = today;
            Changed?.Invoke();
            return null;
        }

        public static string MatName(Mat m)
        {
            switch (m)
            {
                case Mat.Fruit: return ForestLocalization.T("brew.mat.fruit", "🍎 열매");
                case Mat.Flower: return ForestLocalization.T("brew.mat.flower", "🌸 꽃");
                case Mat.Insect: return ForestLocalization.T("brew.mat.insect", "🐞 곤충");
                default: return ForestLocalization.T("brew.mat.fossil", "🪨 화석");
            }
        }

        public static string PotionName(Potion p)
        {
            switch (p)
            {
                case Potion.Vigor: return ForestLocalization.T("brew.p.vigor", "🍯 기운 물약 — 과일나무 흔들 때 열매 +1");
                case Potion.Scent: return ForestLocalization.T("brew.p.scent", "🌸 꽃향 물약 — 주민 하트가 오를 때 +1");
                case Potion.Murky: return ForestLocalization.T("brew.p.murky", "💧 탁한 물약 — 아무 일도 없다");
                default: return ForestLocalization.T("brew.p.none", "오늘 마신 물약 없음");
            }
        }

        /// <summary>창 줄 — 밝혀졌으면 물약 이름, 아니면 ❔.</summary>
        public static string RecipeLine(Mat m) => Known(m) ? PotionName(Recipe(m)) : ForestLocalization.T("brew.unknown", "❔ 무엇이 될지 모른다");

        public static string Snapshot() => JsonUtility.ToJson(_s);

        public static void Restore(string json)
        {
            Store s = null;
            if (!string.IsNullOrEmpty(json)) { try { s = JsonUtility.FromJson<Store>(json); } catch (ArgumentException) { s = null; } }
            _s = s ?? new Store();
            if (_s.known == null) _s.known = new List<int>();
            _s.herb = Mathf.Clamp(_s.herb, 0, PouchMax);
            _s.flower = Mathf.Clamp(_s.flower, 0, PouchMax);
            _s.insect = Mathf.Clamp(_s.insect, 0, PouchMax);
            _s.fossil = Mathf.Clamp(_s.fossil, 0, PouchMax);
            Changed?.Invoke();
        }

        public static void ResetForTest() => Restore(null);

        /// <summary>진단 — 주머니를 이 값으로.</summary>
        public static void SetPouchForTest(int herb, int flower, int insect, int fossil)
        {
            _s.herb = herb; _s.flower = flower; _s.insect = insect; _s.fossil = fossil;
        }
    }
}
