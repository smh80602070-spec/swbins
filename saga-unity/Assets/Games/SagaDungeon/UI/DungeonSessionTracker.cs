using UnityEngine;
using Saga.Core;
using Saga.Dungeon.Data;
using Saga.Dungeon.World;

namespace Saga.Dungeon.UI
{
    /// <summary>
    /// PLAN.md 101-2 "다섯 게임 × 웹 §5 후보" — DUNGEON 두 번째 이식(GO
    /// 이식을 그대로 따른다, "UI 뼈대만" 범위). <see cref="IGoalSource"/>
    /// 세 줄 중 "지금"=가장 가까운 살아있는 적(DungeonEnemy.Active 그대로
    /// 재사용 — 이 판의 핵심 루프가 GO의 "숨은 보물 찾기"와 달리 근접
    /// 전투라 대상을 바꿨다). "이번 세션"·"이번 주"는 5.6(2026-09-21,
    /// 재검토 이어 마무리)부터 <see cref="DungeonDailyTaskState"/>가 채운다
    /// — GO의 ④ 일과판과 같은 구조를 이 트랙의 반복 시스템(걷기·적 처치·
    /// 부적 층 클리어·난입 완주)에 맞춰 다시 짰다(클래스 주석 참고).
    ///
    /// 무입력 5분 또는 앱 백그라운드 전환을 세션 끝으로 보고
    /// <see cref="SessionCard"/>를 띄운다(GO와 동일).
    /// </summary>
    public class DungeonSessionTracker : MonoBehaviour, IGoalSource
    {
        private const float IdleSecondsForSummary = 300f;
        private const float MoveEpsilon = 0.05f;

        private Transform _player;
        private Vector3 _lastPlayerPos;
        private float _walkedMeters;
        private float _walkedMetersSinceDailyReport; // DungeonDailyTaskState.ReportProgress는 int만 받아 정수 m 단위로만 넘긴다 — 나머지는 여기 이월.
        private int _sessionStartGold;
        private float _idleTimer;
        private bool _summaryShown;
        private SessionCard _sessionCard;

        /// <summary>Awake() 순서와 무관하게 나중에 넘겨도 된다.</summary>
        public void Init(SessionCard sessionCard)
        {
            _sessionCard = sessionCard;
        }

        private void Awake()
        {
            var playerGo = GameObject.FindWithTag("Player");
            _player = playerGo != null ? playerGo.transform : null;
            _lastPlayerPos = _player != null ? _player.position : Vector3.zero;
            _sessionStartGold = HeroState.Gold;

            // Init()으로 받은 참조도 plain private 필드라 씬 재로드 후엔
            // null이 된다(GoalBoard.cs 클래스 주석과 같은 함정, GO
            // GoSessionTracker.cs와 같은 방어) — SessionCard 는 씬에
            // 하나뿐이라 스스로 다시 찾는다.
            if (_sessionCard == null) _sessionCard = Object.FindFirstObjectByType<SessionCard>();
        }

        private void Update()
        {
            if (_player == null) return;

            float moved = Vector3.Distance(_lastPlayerPos, _player.position);
            if (moved > MoveEpsilon)
            {
                _walkedMeters += moved;
                _walkedMetersSinceDailyReport += moved;
                int wholeMeters = Mathf.FloorToInt(_walkedMetersSinceDailyReport);
                if (wholeMeters > 0)
                {
                    DungeonDailyTaskState.ReportProgress(DungeonDailyTaskState.Kind.Walk, wholeMeters);
                    _walkedMetersSinceDailyReport -= wholeMeters;
                }
                _idleTimer = 0f;
                _summaryShown = false;
            }
            else
            {
                _idleTimer += Time.unscaledDeltaTime;
            }
            _lastPlayerPos = _player.position;

            if (_idleTimer >= IdleSecondsForSummary && !_summaryShown)
            {
                _summaryShown = true;
                ShowSummary();
            }
        }

        private void OnApplicationPause(bool paused)
        {
            if (paused && !_summaryShown)
            {
                _summaryShown = true;
                ShowSummary();
            }
        }

        private void ShowSummary()
        {
            if (_sessionCard == null) return;
            int goldGained = HeroState.Gold - _sessionStartGold;
            string goldStr = goldGained >= 0 ? $"+{goldGained}" : goldGained.ToString();
            _sessionCard.Show(Saga.Core.SagaUi.L("이번 세션 정리", "Session Summary"),
                string.Format(Saga.Core.SagaUi.L("이동 {0:F0}m", "Walked {0:F0}m"), _walkedMeters),
                string.Format(Saga.Core.SagaUi.L("금 {0}", "Gold {0}"), goldStr),
                string.Format(Saga.Core.SagaUi.L("다음: {0}", "Next: {0}"), GoalLineNow()));
        }

        public string GoalLineNow()
        {
            var tut = DungeonTutorial.Line(); // tasks U-0013 — 첫걸음 사명이 첫 줄을 쓴다(끝나면 null)
            if (tut != null) return tut;
            if (_player == null) return "-";
            var nearest = DungeonEnemy.FindNearest(_player.position, float.MaxValue);
            return nearest == null ? DungeonLocalization.T("goal.no_enemy", "가까운 적 없음")
                : string.Format(DungeonLocalization.T("goal.nearest_enemy", "가장 가까운 적까지 {0:F0}m"), Vector3.Distance(_player.position, nearest.transform.position));
        }

        public string GoalLineSession() => DungeonDailyTaskState.SessionLineText();

        public string GoalLineWeek() => DungeonDailyTaskState.WeekLineText();
    }
}
