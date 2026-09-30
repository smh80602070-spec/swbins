using System;
using System.Collections.Generic;

namespace Saga.Forest.Data
{
    /// <summary>
    /// PLAN.md 101-2 5.6 "축제 하루 — 행사 8을 놀이로". 웹판 §5.6
    /// (`saga-web/saga-forest/PLAN.md` 157행)은 설날·대보름·삼짇날·단오·
    /// 칠석·백중·한가위·동지 8개(음력 날짜)를 전제하지만, 이 트랙엔 낚시·
    /// 부엌·주민 5명(<see cref="World.ForestVillager"/>는 숲지기 1명뿐)·
    /// 음력 계산 자체가 없다 — 사용자와 상의해 **셋만** 골라 재해석했다
    /// (2026-09-21 결정): 세배(숲지기에게 말 걸기, 원문 그대로 축소)·
    /// 꽃놀이(제한시간 안에 채집 자리 4곳 모두 찾기, "꽃 8종류"를 이
    /// 트랙의 실제 갈래 수 4로 좁힘)·소원(다음 채집 배율, "별똥별"을
    /// 고정 소원돌 하나로). 나머지 다섯(대보름·단오·백중·한가위·동지)은
    /// 각각 새 오브젝트(모닥불)·시스템(낚시·연타·사진·부엌) 없이는 못
    /// 옮겨 스코프 밖에 남겼다.
    ///
    /// 음력 날짜 계산도 이 트랙 밖이라(새 라이브러리 없이는 불가) **매달
    /// 고정 일자**로 재해석했다 — 1일=세배·8일=꽃놀이·15일=소원, 실제
    /// 달력(`DateTime.Now`)이 매달 그 날짜에 반복된다(GO/DUNGEON 일과판이
    /// 날짜 해시를 쓰는 것과 달리 여긴 결정적 날짜 하나뿐이라 해시가
    /// 필요 없다). 하루 1회, 도장/주간 사다리 없음(웹판 "보상: 행사 가구
    /// 1(연 8종)"도 가구 자산이 없어 과일로 대체 — 소원만 보상이 즉시
    /// 과일이 아니라 24시간 채집 배율 버프, DUNGEON `SigilState`처럼 순수
    /// 함수로 판정).
    /// </summary>
    public static class ForestFestivalState
    {
        public enum Kind { Sebae, FlowerHunt, Wish }

        private struct FestivalDef
        {
            public Kind Kind;
            public int Day;
            public string Name;
        }

        private static readonly FestivalDef[] Defs =
        {
            new FestivalDef { Kind = Kind.Sebae, Day = 1, Name = "세배" },
            new FestivalDef { Kind = Kind.FlowerHunt, Day = 8, Name = "꽃놀이" },
            new FestivalDef { Kind = Kind.Wish, Day = 15, Name = "소원" },
        };

        private const int SebaeReward = 5;      // 웹판 "세뱃돈" 뜻 — 이 트랙 통화(과일)로.
        private const int FlowerHuntReward = 8;
        private const float WishMultiplier = 1.5f; // 웹판 "다음 날 채집 ×1.5" 그대로.
        private const int WishHours = 24;          // "다음 날"을 이 트랙의 실제 24시간으로.

        private const float FlowerHuntWindowSec = 60f; // 웹판 "1분 안에".

        private static string _doneDate = ""; // yyyy-MM-dd — 오늘 이미 치른 행사.
        private static long _wishActiveUntilTicks;

        private const int CategoryCount = 4; // ForestMuseumState.Category 값 개수(Insect/Mushroom/Fossil/Flower).
        private static readonly HashSet<ForestMuseumState.Category> _flowerHuntVisited = new HashSet<ForestMuseumState.Category>();
        private static float _flowerHuntWindowStart = -999f;

        // 헤드리스 진단 전용 — 실제 달력 날짜가 며칠이든 결정적으로 확인할 수
        // 있게(`ForestGatherStreak.ResetForTest()`와 같은 결). 실제 게임 코드
        // 경로에선 안 쓴다.
        private static int? _forcedDayForTest;
        public static void ForceDayForTest(int? day) => _forcedDayForTest = day;
        private static int CurrentDay => _forcedDayForTest ?? DateTime.Now.Day;

        /// <summary>PLAN.md 109-16 시나리오 fest 단계 동안 그 행사를 오늘 열린 것으로 친다(기념 놀이 — 그날이 아니어도, 오늘 이미 치렀어도). `ForestScenario` 가 앉히고 걷는다.</summary>
        public static Kind? MemorialKind;

        public static Kind? TodayKind()
        {
            if (MemorialKind.HasValue) return MemorialKind;
            int day = CurrentDay;
            foreach (var d in Defs) if (d.Day == day) return d.Kind;
            return null;
        }

        public static bool IsDoneToday() => _doneDate == DateTime.Now.ToString("yyyy-MM-dd");

        /// <summary>110 ⑤c-2c — 화면에 보이는 축제 이름(festival.name.&lt;종류&gt;, 없으면 Label).</summary>
        public static string DisplayLabel(Kind kind) => ForestLocalization.T($"festival.name.{kind.ToString().ToLowerInvariant()}", Label(kind));

        public static string Label(Kind kind)
        {
            foreach (var d in Defs) if (d.Kind == kind) return d.Name;
            return kind.ToString();
        }

        /// <summary>세배·소원처럼 "행동 1회 = 완료"인 행사를 오늘 처음 치를 때만
        /// true. 오늘이 그 행사 날이 아니거나 이미 치렀으면 false(보상 없음).</summary>
        public static bool TryComplete(Kind kind, out int fruitReward)
        {
            fruitReward = 0;
            bool memorial = MemorialKind == kind;
            if (TodayKind() != kind || (IsDoneToday() && !memorial)) return false;

            if (!memorial) _doneDate = DateTime.Now.ToString("yyyy-MM-dd"); // 기념 놀이는 오늘 치른 것으로 안 적는다
            switch (kind)
            {
                case Kind.Sebae:
                    fruitReward = SebaeReward;
                    ForestState.AddFruit(fruitReward);
                    break;
                case Kind.FlowerHunt:
                    fruitReward = FlowerHuntReward;
                    ForestState.AddFruit(fruitReward);
                    break;
                case Kind.Wish:
                    _wishActiveUntilTicks = DateTime.Now.AddHours(WishHours).Ticks;
                    break;
            }
            ForestScenario.OnFestival(kind); // PLAN.md 109-16 — 시나리오 fest 단계
            return true;
        }

        /// <summary><see cref="World.ForestCollectSpot"/>가 채집이 성사될 때마다
        /// 부른다 — 꽃놀이 날이 아니거나 이미 오늘 치렀으면 조용히 무시(0
        /// 반환). 60초 창 안에 갈래 4개(Insect/Mushroom/Fossil/Flower)를
        /// 전부 채웠으면 그 자리에서 완료 처리하고 보상을 돌려준다. 창이
        /// 만료되면 다음 채집이 새 창을 연다(재시도 자유 — 원문에 "실패
        /// 시 벌칙" 없음).</summary>
        public static int ReportCollectSpotGather(ForestMuseumState.Category category)
        {
            if (TodayKind() != Kind.FlowerHunt || (IsDoneToday() && MemorialKind != Kind.FlowerHunt)) return 0;

            float now = UnityEngine.Time.time;
            if (now - _flowerHuntWindowStart > FlowerHuntWindowSec)
            {
                _flowerHuntWindowStart = now;
                _flowerHuntVisited.Clear();
            }
            _flowerHuntVisited.Add(category);
            if (_flowerHuntVisited.Count < CategoryCount) return 0;

            TryComplete(Kind.FlowerHunt, out int reward);
            _flowerHuntVisited.Clear();
            return reward;
        }

        public static bool WishActive => DateTime.Now.Ticks < _wishActiveUntilTicks;

        /// <summary><see cref="World.ForestFruitTree"/>·<see cref="World.ForestGatherFeel"/>가
        /// 과일을 지급하기 전에 곱한다 — 소원 버프가 없으면 1(무변화).</summary>
        public static float FruitMultiplier => WishActive ? WishMultiplier : 1f;

        private static string Instruction(Kind kind) => kind switch
        {
            Kind.Sebae => "숲지기에게 말을 걸어 세배를 하자",
            Kind.FlowerHunt => "1분 안에 채집 자리 넷을 모두 찾아보자",
            Kind.Wish => "소원돌에 소원을 빌어보자",
            _ => "",
        };

        /// <summary>목표판 "이번 주" 줄 — 오늘이 행사날이면 안내, 아니면 다음
        /// 행사까지 D-day(웹판 "행사날 부팅 시 목표판 첫 줄 고정"의 뜻을
        /// 이 트랙의 셋째 줄로 옮긴 것).</summary>
        public static string GoalLineText()
        {
            var today = TodayKind();
            if (today.HasValue && !IsDoneToday())
                return string.Format(ForestLocalization.T("festival.today_line", "오늘은 {0}! {1}"), DisplayLabel(today.Value),
                    ForestLocalization.T($"festival.how.{today.Value.ToString().ToLowerInvariant()}", Instruction(today.Value)));

            for (int i = 1; i <= 31; i++)
            {
                // 강제된 날짜가 있으면(진단) 그 날짜를 기준으로, 아니면 실제 오늘 기준으로.
                int day = _forcedDayForTest.HasValue
                    ? ((_forcedDayForTest.Value - 1 + i) % 31) + 1
                    : DateTime.Now.AddDays(i).Day;
                foreach (var d in Defs)
                {
                    if (d.Day == day) return string.Format(ForestLocalization.T("festival.next_line", "다음 축제: {0}(D-{1})"), DisplayLabel(d.Kind), i);
                }
            }
            return "-";
        }

        // ---- 저장/복원 (ForestSaveState.cs 전용) ----

        public static string SnapshotDoneDate() => _doneDate;
        public static long SnapshotWishUntilTicks() => _wishActiveUntilTicks;

        public static void Restore(string doneDate, long wishUntilTicks)
        {
            _doneDate = doneDate ?? "";
            _wishActiveUntilTicks = wishUntilTicks;
        }
    }
}
