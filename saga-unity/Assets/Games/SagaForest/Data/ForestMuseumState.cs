using System;
using System.Collections.Generic;

namespace Saga.Forest.Data
{
    /// <summary>
    /// PLAN.md 101-2 5.3 FOREST "마을 번들 — 모으면 마을이 변한다". 웹판
    /// §5.3(`saga-web/saga-forest/PLAN.md` 114행)은 곤충·물고기·화석·조개
    /// 4갈래를 사고(박물관) 건물에 기증하는 것을 전제한다. 이 트랙엔 사고
    /// 건물도 가방도 없다(`ForestState.cs` 클래스 주석 — HeroState 대응
    /// 없음, 돈도 과일로 대신 쓴다) — 그리고 호수·강이 없어(`ForestGroundBuilder`
    /// "판정은 항상 평면 좌표로") 물고기·조개 갈래는 옮길 대상 자체가 없다.
    /// 대신 이미 있는 네 바이옴 존(`ForestBiomeData.Zones`)에 하나씩 어울리는
    /// 갈래로 바꿨다: 어둑숲→곤충, 버섯숲→버섯, 바위 지대→화석, 꽃밭→화초.
    /// "채집 = 기증"으로 합쳤다 — 가방이 없어 들고 다닐 수 없으니 발견한
    /// 순간 바로 도감에 기록된다(DUNGEON `BestiaryState`와 같은 결).
    /// </summary>
    public static class ForestMuseumState
    {
        public enum Category { Insect, Mushroom, Fossil, Flower }

        public static readonly Dictionary<Category, string[]> Items = new Dictionary<Category, string[]>
        {
            [Category.Insect] = new[] { "반짝벌레", "그림자나비", "야행풍뎅이" },
            [Category.Mushroom] = new[] { "자주버섯", "방울버섯", "도깨비갓버섯" },
            [Category.Fossil] = new[] { "나선화석", "이빨화석", "발자국화석" },
            [Category.Flower] = new[] { "별꽃", "은방울꽃", "노을꽃" },
        };

        private static readonly HashSet<string> Discovered = new HashSet<string>();
        private static readonly HashSet<Category> BundleDone = new HashSet<Category>();
        private static bool _allDone;

        /// <summary>그 갈래가 막 다 채워진 순간(한 번만) — 마을 시설 하나를 짓는 신호.</summary>
        public static event Action<Category> BundleCompleted;

        /// <summary>네 갈래가 다 채워진 순간(딱 한 번) — 깃발.</summary>
        public static event Action AllBundlesCompleted;

        public static string[] ItemsOf(Category c) => Items[c];

        /// <summary>PLAN.md 109-12-1 — 갈래 이름(방문객 부탁 글).</summary>
        public static string CategoryName(Category c) => c switch
        {
            Category.Insect => ForestLocalization.T("museum.cat.insect", "곤충"),
            Category.Mushroom => ForestLocalization.T("museum.cat.mushroom", "버섯"),
            Category.Fossil => ForestLocalization.T("museum.cat.fossil", "화석"),
            _ => ForestLocalization.T("museum.cat.flower", "꽃"),
        };

        // 110 ⑤c-2c-2 — 한국어 이름이 세이브 키라 그대로 두고, 화면 글만 번역 표 `museum.item.<id>` 로.
        private static readonly Dictionary<string, string> ItemKeys = new Dictionary<string, string>
        {
            ["반짝벌레"] = "glowbug", ["그림자나비"] = "shadow_moth", ["야행풍뎅이"] = "night_beetle",
            ["자주버섯"] = "purple_cap", ["방울버섯"] = "bell_cap", ["도깨비갓버섯"] = "goblin_cap",
            ["나선화석"] = "spiral_fossil", ["이빨화석"] = "tooth_fossil", ["발자국화석"] = "footprint_fossil",
            ["별꽃"] = "star_flower", ["은방울꽃"] = "silver_bell", ["노을꽃"] = "sunset_flower",
        };

        public static string DisplayName(string item) =>
            item != null && ItemKeys.TryGetValue(item, out var id) ? ForestLocalization.T("museum.item." + id, item) : item;

        public static bool IsDiscovered(string item) => Discovered.Contains(item);

        public static int DiscoveredCountOf(Category c)
        {
            int n = 0;
            foreach (var it in Items[c]) if (Discovered.Contains(it)) n++;
            return n;
        }

        public static bool IsBundleDone(Category c) => BundleDone.Contains(c);

        public static bool AllBundlesDone => _allDone;

        /// <summary>처음 보는 항목이면 true(도감에 새로 기록됨) — `ForestCollectSpot`이
        /// 채집할 때마다 부른다. 이 갈래가 막 다 채워졌으면 `BundleCompleted`,
        /// 네 갈래가 다 채워졌으면 `AllBundlesCompleted`까지 같은 호출 안에서 쏜다.</summary>
        public static bool Record(Category category, string item)
        {
            if (string.IsNullOrEmpty(item)) return false;
            bool isNew = Discovered.Add(item);
            if (isNew && !BundleDone.Contains(category) && DiscoveredCountOf(category) >= Items[category].Length)
            {
                BundleDone.Add(category);
                BundleCompleted?.Invoke(category);
                if (!_allDone && BundleDone.Count >= Items.Count)
                {
                    _allDone = true;
                    AllBundlesCompleted?.Invoke();
                }
            }
            return isNew;
        }

        public static string[] Snapshot()
        {
            var arr = new string[Discovered.Count];
            Discovered.CopyTo(arr);
            return arr;
        }

        /// <summary>SaveState 전용 — 이벤트는 안 쏜다(로드는 "막 완성한 순간"이
        /// 아니다). `World/ForestBootstrap.cs`가 로드 직후 `IsBundleDone`·
        /// `AllBundlesDone`을 직접 훑어 이미 완성된 시설을 소리 없이 다시
        /// 세운다(이벤트 없이 상태만 보고 짓는 쪽 — DUNGEON PROJECT_STATE.md
        /// "Restore()가 이벤트를 안 쏘면 낡은 시각 상태가 남는다" 함정을
        /// 이벤트에 의존하지 않는 쪽으로 피했다).</summary>
        public static void Restore(string[] names)
        {
            Discovered.Clear();
            BundleDone.Clear();
            _allDone = false;
            if (names != null)
            {
                foreach (var n in names) if (!string.IsNullOrEmpty(n)) Discovered.Add(n);
            }
            foreach (Category c in Enum.GetValues(typeof(Category)))
            {
                if (DiscoveredCountOf(c) >= Items[c].Length) BundleDone.Add(c);
            }
            _allDone = BundleDone.Count >= Items.Count;
        }
    }
}
