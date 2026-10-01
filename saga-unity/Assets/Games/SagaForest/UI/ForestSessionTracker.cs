using UnityEngine;
using Saga.Core;
using Saga.Forest.Data;
using Saga.Forest.World;

namespace Saga.Forest.UI
{
    /// <summary>
    /// PLAN.md 101-2 "다섯 게임 × 웹 §5 후보" — FOREST 세 번째 이식(GO·
    /// DUNGEON 이식을 그대로 따른다, "UI 뼈대만" 범위). <see cref="IGoalSource"/>
    /// 세 줄 중 실제 값이 있는 것만 채운다("지금"=가장 가까운 `ForestFruitTree`
    /// — 이 판은 GO/DUNGEON과 달리 나무가 무제한 채집이라 "다 찾음" 상태가
    /// 없다, 그냥 가장 가까운 나무까지 거리. "이번 세션"=걸은 거리·이번
    /// 세션에 주운 과일 — `ForestState.FruitCount`엔 아직 금 경제가 없어
    /// (`ForestState.cs` 클래스 주석 참고) GO/DUNGEON의 "금"을 "과일"로
    /// 바꿔 그대로 옮겼다), "이번 주"는 5.6(2026-09-21)부터
    /// <see cref="ForestFestivalState"/>가 채운다 — 오늘이 행사날이면
    /// 안내, 아니면 다음 행사까지 D-day.
    ///
    /// 무입력 5분 또는 앱 백그라운드 전환을 세션 끝으로 보고
    /// <see cref="SessionCard"/>를 띄운다(GO·DUNGEON과 동일).
    /// </summary>
    public class ForestSessionTracker : MonoBehaviour, IGoalSource
    {
        private const float IdleSecondsForSummary = 300f;
        private const float MoveEpsilon = 0.05f;

        private Transform _player;
        private Vector3 _lastPlayerPos;
        private float _walkedMeters;
        private int _sessionStartFruit;
        private int _sessionStartDeliveries;
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
            _sessionStartFruit = ForestState.FruitCount;
            _sessionStartDeliveries = ForestDeliveryState.DeliveredCount;

            // Init()으로 받은 참조도 plain private 필드라 씬 재로드 후엔
            // null이 된다(GoalBoard.cs 클래스 주석과 같은 함정, GO·DUNGEON과
            // 같은 방어) — SessionCard 는 씬에 하나뿐이라 스스로 다시 찾는다.
            if (_sessionCard == null) _sessionCard = Object.FindFirstObjectByType<SessionCard>();
        }

        private void Update()
        {
            if (_player == null) return;

            float moved = Vector3.Distance(_lastPlayerPos, _player.position);
            if (moved > MoveEpsilon)
            {
                _walkedMeters += moved;
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
            int fruitGained = ForestState.FruitCount - _sessionStartFruit;
            int delivered = ForestDeliveryState.DeliveredCount - _sessionStartDeliveries;
            _sessionCard.Show(Saga.Core.SagaUi.L("이번 세션 정리", "Session Summary"),
                string.Format(Saga.Core.SagaUi.L("이동 {0:F0}m", "Walked {0:F0}m"), _walkedMeters),
                string.Format(Saga.Core.SagaUi.L("과일 +{0} · 택배 {1}건", "Fruit +{0} · Deliveries {1}"), fruitGained, delivered),
                string.Format(Saga.Core.SagaUi.L("다음: {0}", "Next: {0}"), GoalLineNow()));
        }

        public string GoalLineNow()
        {
            var tut = ForestTutorial.Line(); // tasks U-0023 — 첫걸음 사명이 첫 줄을 쓴다(끝나면 null)
            if (tut != null) return tut;
            if (_player == null) return "-";

            // PLAN.md 109-16 — 시나리오가 열려 있으면 그 장·단계 한 줄이 먼저(소포를 들고 있을 땐 그 거리가 먼저).
            if (!ForestDeliveryState.Carrying)
            {
                string story = ForestScenario.HudLine();
                if (story.Length > 0) return story;
            }

            // 101-2 5.7 "택배 사슬" — 소포를 들고 있으면 그 목적지까지 거리를 우선 보여준다.
            if (ForestDeliveryState.Carrying)
            {
                var zone = ForestBiomeData.Zones[ForestDeliveryState.TargetIndex];
                float dist = Vector2.Distance(new Vector2(_player.position.x, _player.position.z), zone.Center);
                return string.Format(ForestLocalization.T("goal.delivery", "택배 → {0}까지 {1:F0}m"), zone.DisplayName, dist);
            }

            var trees = Object.FindObjectsByType<ForestFruitTree>(FindObjectsSortMode.None);
            if (trees.Length == 0) return "-";

            ForestFruitTree nearest = null;
            float nearestDist = float.MaxValue;
            foreach (var t in trees)
            {
                float d = Vector3.Distance(_player.position, t.transform.position);
                if (d < nearestDist)
                {
                    nearestDist = d;
                    nearest = t;
                }
            }
            return nearest == null ? "-" : string.Format(ForestLocalization.T("goal.nearest_tree", "가장 가까운 나무까지 {0:F0}m"), nearestDist);
        }

        public string GoalLineSession()
        {
            int fruitGained = ForestState.FruitCount - _sessionStartFruit;
            int delivered = ForestDeliveryState.DeliveredCount - _sessionStartDeliveries;
            return string.Format(ForestLocalization.T("goal.session", "이동 {0:F0}m · 과일 +{1} · 택배 {2}건"), _walkedMeters, fruitGained, delivered);
        }

        public string GoalLineWeek() => ForestFestivalState.GoalLineText();
    }
}
