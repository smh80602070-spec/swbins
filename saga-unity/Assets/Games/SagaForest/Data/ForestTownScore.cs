using System;

namespace Saga.Forest.Data
{
    /// <summary>
    /// PLAN.md 101-2 5.8② "채집 손맛 표준 + 마을 평가 재설계"의 뒷부분
    /// (웹판 `saga-web/saga-forest/PLAN.md` 177행) — 웹판은 마을 전체의
    /// 잡초·꽃·심은 나무·집 꾸미기·사고 기증 다섯 축을 `town.js beauty()`
    /// 로 합산해 별 5개로 보여준다. 이 트랙엔 잡초·꽃·나무 심기 자체가
    /// 없다(마을 바닥은 `ForestGroundBuilder`가 고정 지형으로 깔 뿐 자라는
    /// 식생이 없음) — 실제로 값이 자라는 축은 둘뿐이다: 집 꾸미기
    /// (<see cref="ForestHomeState.Score"/>, 101-2 이전부터 있던
    /// `home.js score()` 그대로의 이식)와 마을 번들 기증
    /// (<see cref="ForestMuseumState"/>, 101-2 5.3). 그 둘만 합쳐 별로
    /// 매긴다.
    ///
    /// 등급 경계는 웹판 `town.js BEAUTY_GRADES`(0/60/100/150/200, 다섯
    /// 단계)를 그대로 재사용한다 — 5.8②의 웹 구현 자신이 "새 0~100
    /// 눈금을 따로 만들면 두 표가 어긋날 위험이 있어 기존 걸 재사용하는
    /// 쪽을 골랐다"고 적어 둔 것과 같은 판단(다만 이 트랙엔 그 표 자체가
    /// 없어 값만 그대로 빌려 쓴다).
    ///
    /// 웹판의 "별이 떨어질 조건" 경고는 옮기지 않는다 — 잡초처럼 시간이
    /// 지나며 점수를 깎는 축이 이 트랙엔 하나도 없어(집 꾸미기·박물관
    /// 기증 둘 다 늘기만 한다) 별이 내려갈 일 자체가 없다.
    /// </summary>
    public static class ForestTownScore
    {
        private static readonly int[] Grades = { 0, 60, 100, 150, 200 };
        private const int MuseumPointsPerItem = 5; // 4갈래×3개=12개 만점 60점 — 집 꾸미기 점수대(대략 0~200)와 겹치게 맞춤.

        public static int MuseumDiscoveredTotal()
        {
            int total = 0;
            foreach (ForestMuseumState.Category c in Enum.GetValues(typeof(ForestMuseumState.Category)))
            {
                total += ForestMuseumState.DiscoveredCountOf(c);
            }
            return total;
        }

        public static int MuseumPoints() => MuseumDiscoveredTotal() * MuseumPointsPerItem;

        /// <summary>PLAN.md 109-12-2(웹 §5.11) — 눌러앉은 손님 하나에 +6.</summary>
        public static int Total() => ForestHomeState.Score().Total + MuseumPoints() + ForestVisitors.GuestPoints();

        /// <summary>평가판 셋째 줄 — 눌러앉은 손님이 있을 때만(없으면 null).</summary>
        public static string GuestLine()
        {
            int n = ForestVisitors.SettledList.Count;
            return n <= 0 ? null : string.Format(ForestLocalization.T("town_score.guest_line", "이웃 손님 {0}명 (+{1}점)"), n, ForestVisitors.GuestPoints());
        }

        /// <summary>1~5 — Grades 경계를 넘은 최고 단계 + 1(웹판 `beauty().stars
        /// = level + 1`과 같은 식).</summary>
        public static int Stars()
        {
            int total = Total();
            int level = 0;
            for (int i = Grades.Length - 1; i >= 0; i--)
            {
                if (total >= Grades[i]) { level = i; break; }
            }
            return level + 1;
        }

        /// <summary>깃대 상호작용 시트에 낼 조건 2줄(웹판 5줄 중 이 트랙에
        /// 실제로 있는 두 축만) — 제목은 <see cref="ForestTownScoreBoard"/>가 붙인다.</summary>
        public static (string home, string museum) ConditionLines()
        {
            var home = ForestHomeState.Score();
            int museumItems = MuseumDiscoveredTotal();
            string homeLine = string.Format(ForestLocalization.T("town_score.home_line", "집 꾸미기 {0}개 (+{1}점)"), home.Count, home.Total);
            string museumLine = string.Format(ForestLocalization.T("town_score.museum_line", "박물관 기증 {0}/12 (+{1}점)"), museumItems, MuseumPoints());
            return (homeLine, museumLine);
        }
    }
}
