using System.Collections.Generic;

namespace Saga.Forest.Data
{
    /// <summary>계열 — saga-forest 웹판 `js/data-village.js`의 `FURN_SETS`
    /// (안방·사랑방·부엌·뜰). 셋 이상 같은 계열을 놓으면 집 평가에 보탬이
    /// 된다(`ForestHomeState.Score()`).</summary>
    public enum FurnitureSet { Anbang, Sarang, Buok, Ddeul, Janchi }

    /// <summary>
    /// FOREST "집 꾸미기(가구)" 슬라이스(2026-09-12, saga-unity 열한 번째
    /// 세션) — saga-forest 웹판 `js/data-village.js`의 `FURNITURE`(14종)를
    /// 그대로 옮겼다. **재해석 둘**:
    /// (1) FOREST엔 아직 금 경제가 없다(HeroState.Gold 대응 없음, 채집한
    /// 과일 개수뿐) — `Value`(웹판 '냥' 가격, 집 평가 점수 계산에만 쓴다,
    /// `HOME_GRADES` 문턱과 원작 그대로 맞아떨어지게)와 `FruitCost`(실제
    /// 구매가, 과일로 낸다 — Value/100 반올림, 새로 잡은 값)를 분리했다.
    /// (2) 원작은 날짜 해시로 매일 4점만 진열하는데, 이 슬라이스엔 day/
    /// 시간 시스템 자체가 없어(VERTICAL_SLICE_FOREST.md "제외" 참고)
    /// 진열을 날짜로 못 가른다 — `World/ForestFurnitureStall.cs`가 14종
    /// 전체를 상시 룰렛(GO `LuckyCairn.cs`와 같은 결)으로 대신한다.
    /// </summary>
    public class FurnitureItem
    {
        public readonly string Id;
        private readonly string _name;
        /// <summary>Localization — RealmCityData.Name 등과 같은 결(T(key, fallback)).</summary>
        public string Name => ForestLocalization.T("furniture." + Id, _name);
        public readonly FurnitureSet Set;
        public readonly int Value;      // 집 평가 점수 계산용(웹판 '냥' 값 그대로) — 실제 통화 아님.
        public readonly int FruitCost;  // 실제 구매가(과일 개수).
        public readonly bool IsCylinder; // 시각 형태만(원기둥/상자) — 실제 GLB 없음(PLAN.md 8장 placeholder).

        private FurnitureItem(string id, string name, FurnitureSet set, int value, bool isCylinder)
        {
            Id = id;
            _name = name;
            Set = set;
            Value = value;
            FruitCost = System.Math.Max(1, (int)System.Math.Round(value / 100.0));
            IsCylinder = isCylinder;
        }

        // 웹판 FURNITURE 순서 그대로(가격 오름차순).
        public static readonly FurnitureItem[] Catalog =
        {
            new FurnitureItem("bangseok",   "방석",     FurnitureSet.Anbang, 400,  true),
            new FurnitureItem("hwabun",     "화분",     FurnitureSet.Ddeul,  700,  true),
            new FurnitureItem("deungjan",   "등잔",     FurnitureSet.Anbang, 800,  true),
            new FurnitureItem("soban",      "소반",     FurnitureSet.Anbang, 900,  false),
            new FurnitureItem("mulhang",    "물항아리", FurnitureSet.Buok,   1100, true),
            new FurnitureItem("jokja",      "족자",     FurnitureSet.Sarang, 1200, false),
            new FurnitureItem("seoan",      "서안",     FurnitureSet.Sarang, 1400, false),
            new FurnitureItem("hwaro",      "화로",     FurnitureSet.Buok,   1500, true),
            new FurnitureItem("mungab",     "문갑",     FurnitureSet.Sarang, 1800, false),
            new FurnitureItem("bandaji",    "반닫이",   FurnitureSet.Anbang, 2200, false),
            new FurnitureItem("dokja",      "도자기",   FurnitureSet.Anbang, 2600, true),
            new FurnitureItem("badukpan",   "바둑판",   FurnitureSet.Sarang, 3000, false),
            new FurnitureItem("byeongpung", "병풍",     FurnitureSet.Sarang, 3600, false),
            new FurnitureItem("geomungo",   "거문고",   FurnitureSet.Sarang, 5200, false),
        };

        /// <summary>PLAN.md 109-12-1 떠돌이 방문객 보상(웹 `fest:'visit'`) — 가구전 룰렛(`Catalog`)엔 없다. 웹 값·세트(잔치) 그대로.</summary>
        public static readonly FurnitureItem[] VisitorGifts =
        {
            new FurnitureItem("visit_sailor", "선장의 궤짝",     FurnitureSet.Janchi, 2400, false),
            new FurnitureItem("visit_wisp",   "도깨비 등롱",     FurnitureSet.Janchi, 2400, true),
            new FurnitureItem("visit_angler", "명인의 어탁",     FurnitureSet.Janchi, 2000, false),
            new FurnitureItem("visit_bug",    "나비 표본 액자",  FurnitureSet.Janchi, 2000, false),
            new FurnitureItem("visit_future", "시간의 탁상시계", FurnitureSet.Janchi, 3000, true),
        };

        /// <summary>가구전 물건 + 방문객 가구(창고에서 놓을 때).</summary>
        public static IEnumerable<FurnitureItem> All
        {
            get
            {
                foreach (var item in Catalog) yield return item;
                foreach (var item in VisitorGifts) yield return item;
            }
        }

        private static readonly Dictionary<string, FurnitureItem> ById = Build();

        private static Dictionary<string, FurnitureItem> Build()
        {
            var map = new Dictionary<string, FurnitureItem>();
            foreach (var item in All) map[item.Id] = item;
            return map;
        }

        public static FurnitureItem Get(string id) => id != null && ById.TryGetValue(id, out var item) ? item : null;

        public static string SetName(FurnitureSet set) => set switch
        {
            FurnitureSet.Anbang => ForestLocalization.T("furniture.set.anbang", "안방"),
            FurnitureSet.Sarang => ForestLocalization.T("furniture.set.sarang", "사랑방"),
            FurnitureSet.Buok => ForestLocalization.T("furniture.set.buok", "부엌"),
            FurnitureSet.Ddeul => ForestLocalization.T("furniture.set.ddeul", "뜰"),
            FurnitureSet.Janchi => ForestLocalization.T("furniture.set.janchi", "잔치"),
            _ => "",
        };

        /// <summary>웹판 `HOME_GRADES` 그대로(점수 문턱·이름). Key는 Localization
        /// 조회용(Name은 ko 원문 fallback).</summary>
        public static readonly (int At, string Key, string Name)[] Grades =
        {
            (0, "grade0", "휑한 방"), (30, "grade1", "살림이 든 방"), (80, "grade2", "정갈한 집"),
            (160, "grade3", "아취 있는 집"), (280, "grade4", "이름난 집"), (450, "grade5", "명가(名家)"),
        };

        public static string GradeName(int total)
        {
            var grade = Grades[0];
            foreach (var g in Grades)
            {
                if (total >= g.At) grade = g;
            }
            return ForestLocalization.T("home." + grade.Key, grade.Name);
        }
    }
}
