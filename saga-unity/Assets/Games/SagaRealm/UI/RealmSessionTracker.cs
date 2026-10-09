using System.Linq;
using UnityEngine;
using Saga.Core;
using Saga.Realm.Data;

namespace Saga.Realm.UI
{
    /// <summary>
    /// PLAN.md 101-2 "공통 선행" A·B — REALM 이식(다섯 번째, 2026-09-17).
    /// GO/DUNGEON/FOREST/STORY 는 "무입력 5분→세션 카드"가 통했지만, REALM 은
    /// 캐릭터·이동이 없는 턴제 경영이라 그 트리거가 안 맞는다(PROJECT_STATE
    /// 검토 결과 — 사용자 확정: "월간 요약 카드"로 변형). "지금"="이번 세션"
    /// 은 그대로 두고, "이번 주"자리는 의미만 "다음 이정표"(101-2 REALM
    /// 5-4)로 바꿔 채운다. 트리거는 무입력 대신 <see cref="RealmCityState.NextMonth"/>
    /// 로 달이 실제로 넘어간 시점(RealmCityState.Changed) — Restore()(세이브
    /// 로드)도 같은 이벤트를 쏘지만 달이 한 번에 여러 달 건너뛰므로 델타가
    /// 1이 아니면 카드를 띄우지 않고 조용히 동기화만 한다.
    /// </summary>
    public class RealmSessionTracker : MonoBehaviour, IGoalSource
    {
        private int _sessionStartGold;
        private int _sessionStartCaptured;
        private int _lastYear;
        private int _lastMonth;
        private SessionCard _sessionCard;

        /// <summary>Awake() 순서와 무관하게 나중에 넘겨도 된다.</summary>
        public void Init(SessionCard sessionCard)
        {
            _sessionCard = sessionCard;
        }

        private void Awake()
        {
            _sessionStartGold = RealmCityState.Gold;
            _sessionStartCaptured = CapturedCount();
            _lastYear = RealmCityState.Year;
            _lastMonth = RealmCityState.Month;

            // GoSessionTracker.Awake() 와 같은 함정 — Init()으로 받은 참조도
            // plain private 필드라 씬 재로드 후엔 null이 된다. SessionCard 는
            // 씬에 하나뿐이라 스스로 다시 찾는다.
            if (_sessionCard == null) _sessionCard = Object.FindFirstObjectByType<SessionCard>();

            RealmCityState.Changed += OnCityStateChanged;
            RealmVictoryState.Achieved += OnVictoryAchieved;
        }

        private void OnDestroy()
        {
            RealmCityState.Changed -= OnCityStateChanged;
            RealmVictoryState.Achieved -= OnVictoryAchieved;
        }

        private void OnCityStateChanged()
        {
            // 101-2 5-1 "인물 특성·야망"(2026-09-20) — 매달 정산뿐 아니라
            // 금·문답·전투가 바뀔 때마다 곧바로 달성 여부를 본다(재진입
            // 안전 — RealmOfficerTraits.cs 클래스 주석 참고).
            RealmOfficerTraits.CheckAmbitions();
            // 101-2 5-5 "승리 조건"(2026-09-20) — 같은 자리, 같은 이유(재진입
            // 안전 — RealmVictoryState.cs 클래스 주석 참고).
            RealmVictoryState.CheckResult();

            int deltaMonths = (RealmCityState.Year - _lastYear) * 12 + (RealmCityState.Month - _lastMonth);
            _lastYear = RealmCityState.Year;
            _lastMonth = RealmCityState.Month;

            // 정확히 한 달만 넘어갔을 때만 "다음 달" 버튼으로 자연스럽게
            // 진행한 것으로 본다 — 세이브 로드(Restore)는 여러 달을 한 번에
            // 되돌리거나 되감아 델타가 1이 아니라 걸러진다.
            if (deltaMonths == 1)
            {
                ShowSummary();
                // 101-2 5-2 "관계·이벤트 체인"(2026-09-20) — 월간 카드도
                // 세션 카드와 같은 게이트를 쓴다(같은 이유: 세이브 로드로
                // 여러 달을 건너뛸 때는 안 낸다).
                RealmEventState.RollForMonth();
                // 101-2 5-8 "허창 자리 계승"(2026-09-20) — 같은 게이트.
                RealmSuccessionState.RollForMonth();
            }
        }

        private static int CapturedCount() => RealmVictoryState.CapturedCount();

        /// <summary>godot이 기존 정복 승리의 5초 토스트도 결과 카드로 올린
        /// 것과 같은 결(HISTORY.md 2026-09-17) — 월간 요약과 같은 카드를
        /// 재사용한다. 판이 끝났다는 사실 자체는 <see cref="RealmVictoryState.IsOver"/>가
        /// 계속 들고 있으니, 이 카드는 5초 뒤 사라져도 무방하다.</summary>
        private void OnVictoryAchieved(RealmVictoryState.Kind kind)
        {
            if (_sessionCard == null) return;
            string title = kind == RealmVictoryState.Kind.Conquest
                ? RealmLocalization.T("victory.title_conquest", "🏆 정복 승리")
                : RealmLocalization.T("victory.title_culture", "🏆 문화 승리");
            // godot 결과 카드 스펙(HISTORY.md 2026-09-17) — "걸린 달·성·인물·
            // 기록" 중 이 슬라이스가 가진 값(연월·함락 성·로스터)만 3줄로.
            _sessionCard.Show(title,
                string.Format(RealmLocalization.T("victory.card_date", "{0}년 {1}월"), RealmCityState.Year, RealmCityState.Month),
                string.Format(RealmLocalization.T("victory.card_captured", "함락 {0}/{1}성"), CapturedCount(), RealmEnemyCity.AllIds.Length),
                string.Format(RealmLocalization.T("victory.card_roster", "로스터 {0}명"), RealmCityState.RosterIds.Count));
            RealmToast.Instance?.Show(RealmRound.ReadyLine(), 7f); // 109-16b 회차 — 다음 달 단추가 다음 회차
        }

        private void ShowSummary()
        {
            if (_sessionCard == null) return;
            int goldGained = RealmCityState.Gold - _sessionStartGold;
            string goldStr = goldGained >= 0 ? $"+{goldGained}" : goldGained.ToString();
            _lastTitle = string.Format(RealmLocalization.T("summary.title", "{0}년 {1}월 정리"), RealmCityState.Year, RealmCityState.Month);
            _lastLines = new[]
            {
                string.Format(RealmLocalization.T("summary.gold", "금 {0}({1})"), RealmCityState.Gold, goldStr),
                GoalLineSession(),
                string.Format(RealmLocalization.T("summary.next", "다음: {0}"), GoalLineWeek()),
            };
            _sessionCard.Show(_lastTitle, _lastLines);
        }

        // U-0071 — "다음 달" 에 이달 사건 창이 같은 순간 가운데에 떠 정리 카드가 고르기 단추를 덮었다.
        // 사건이 먼저: 사건 창이 열릴 때 카드를 접어 두고(HoldSummary), 고른 뒤 같은 카드를 결과 한 줄과 함께 다시 띄운다.
        private string _lastTitle;
        private string[] _lastLines;
        private bool _held;

        /// <summary>정리 카드가 떠 있으면 접고 참(나중에 <see cref="ReleaseSummary"/>).</summary>
        public bool HoldSummary()
        {
            if (_sessionCard == null || !_sessionCard.IsShowing || _lastTitle == null) return false;
            _sessionCard.Hide();
            _held = true;
            return true;
        }

        /// <summary>접어 둔 정리 카드를 다시 띄운다 — <paramref name="extra"/>(사건 결과)를 마지막 줄로. 접은 게 없으면 거짓.</summary>
        public bool ReleaseSummary(string extra)
        {
            if (!_held || _sessionCard == null) return false;
            _held = false;
            var lines = new System.Collections.Generic.List<string>(_lastLines);
            if (!string.IsNullOrEmpty(extra)) lines.Add(extra);
            _sessionCard.Show(_lastTitle, lines.ToArray());
            return true;
        }

        public string GoalLineNow()
        {
            var cityDef = RealmCityData.Get(RealmCityState.CurrentCity);
            string cityName = cityDef != null ? cityDef.Name : RealmCityState.CurrentCity;
            string round = RealmRound.Round > 1 ? string.Format(RealmLocalization.T("round.hud", " · {0}회차"), RealmRound.Round) : "";
            return string.Format(RealmLocalization.T("goal.viewing", "{0} 조망 중 · 금 {1}"), cityName, RealmCityState.Gold) + round;
        }

        public string GoalLineSession()
        {
            int goldGained = RealmCityState.Gold - _sessionStartGold;
            string goldStr = goldGained >= 0 ? $"+{goldGained}" : goldGained.ToString();
            int capturedGained = CapturedCount() - _sessionStartCaptured;
            return string.Format(RealmLocalization.T("goal.session", "함락 +{0}성 · 금 {1}"), capturedGained, goldStr);
        }

        /// <summary>다른 네 판은 "이번 주"(주간 사다리)지만 REALM 은 주 단위
        /// 개념이 없어 "다음 이정표"(적국 함락 진행)로 의미를 바꿨다
        /// (GoalBoard.cs 라벨 자체는 공용이라 안 바꾼다). 101-2 5-5(2026-09-20)
        /// — godot 목표판 셋째 줄 스펙(§5-5 "가장 가까운 승리 조건 + 진척 %")
        /// 대로 정복/문화 중 더 가까운 쪽으로 갈아 끼웠다.</summary>
        public string GoalLineWeek()
        {
            if (RealmVictoryState.IsOver)
            {
                return (RealmVictoryState.Result == RealmVictoryState.Kind.Conquest
                    ? RealmLocalization.T("victory.done_conquest", "정복 승리 — 판 끝")
                    : RealmLocalization.T("victory.done_culture", "문화 승리 — 판 끝"))
                    + (RealmRound.CanNext ? RealmLocalization.T("round.goal_next", " · 다음 달 = 다음 회차") : "");
            }
            string stage = RealmScenario.StageLine(); // tasks U-0026 — 열린 성 차지 단계가 있으면 그 목표가 먼저
            if (stage != null) return stage;
            var (name, progress) = RealmVictoryState.ClosestProgress();
            return $"{name} {Mathf.RoundToInt(progress * 100f)}%";
        }
    }
}
