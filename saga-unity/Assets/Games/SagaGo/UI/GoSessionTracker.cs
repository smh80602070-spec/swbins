using UnityEngine;
using Saga.Core;
using Saga.Go.Data;
using Saga.Go.World;

namespace Saga.Go.UI
{
    /// <summary>
    /// PLAN.md 101-2 "다섯 게임 × 웹 §5 후보" — GO 첫 이식(④ 일과판+마무리
    /// 카드). <see cref="IGoalSource"/> 세 줄: "지금"=가장 가까운 은닉
    /// 보물, "이번 세션"=<see cref="DailyTaskState"/>의 오늘의 일과 3 중
    /// 남은 것, "이번 주"=일과 도장이 쌓이는 주간 사다리(2026-09-19,
    /// 101-2 서두 결정으로 착수 — 자세한 설계 재해석 이유는
    /// DailyTaskState.cs 클래스 주석 참고).
    ///
    /// 무입력 5분 또는 앱 백그라운드 전환을 세션 끝으로 보고
    /// <see cref="SessionCard"/>를 띄운다(웹판 §5 ④의 "5분 무입력" 그대로,
    /// visibilitychange 대신 OnApplicationPause 사용 — 모바일 대응).
    /// </summary>
    public class GoSessionTracker : MonoBehaviour, IGoalSource
    {
        private const float IdleSecondsForSummary = 300f;
        private const float MoveEpsilon = 0.05f;

        private Transform _player;
        private Vector3 _lastPlayerPos;
        private float _walkedMeters;
        private float _walkedMetersSinceDailyReport; // DailyTaskState.ReportProgress는 int만 받아 정수 m 단위로만 넘긴다 — 나머지는 여기 이월.
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
            _sessionStartGold = GoldState.Gold;

            // Init()으로 받은 참조도 plain private 필드라 씬 재로드 후엔
            // null이 된다(GoalBoard.cs 클래스 주석과 같은 함정) — SessionCard
            // 는 씬에 하나뿐이라 스스로 다시 찾는다.
            if (_sessionCard == null) _sessionCard = Object.FindFirstObjectByType<SessionCard>();

            // PLAN.md 101-2 ⑥ "인연" — 인연 등급이 오를 때마다 짧은 토스트.
            BondState.LeveledUp += OnBondLeveledUp;
        }

        private void OnDestroy()
        {
            BondState.LeveledUp -= OnBondLeveledUp;
        }

        private void OnBondLeveledUp(string heroId, int level)
        {
            DialogueLabel.Instance?.Show(
                string.Format(GoLocalization.T("event.bond_levelup", "{0}과(와) 인연이 깊어졌다 — 인연 Lv.{1}. 전투력 +{2}%."),
                    heroId, level, Mathf.RoundToInt(BondState.AtkBonusPerLevel * 100)), 4f);
        }

        private void Update()
        {
            if (_player == null) return;

            float moved = Vector3.Distance(_lastPlayerPos, _player.position);
            if (moved > MoveEpsilon)
            {
                _walkedMeters += moved;
                BondState.ReportWalked(moved); // PLAN.md 101-2 ⑥ "인연" — "함께 걸은 거리".
                _walkedMetersSinceDailyReport += moved;
                int wholeMeters = Mathf.FloorToInt(_walkedMetersSinceDailyReport);
                if (wholeMeters > 0)
                {
                    DailyTaskState.ReportProgress(DailyTaskState.Kind.Walk, wholeMeters);
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
            int goldGained = GoldState.Gold - _sessionStartGold;
            string goldStr = goldGained >= 0 ? $"+{goldGained}" : goldGained.ToString();
            _sessionCard.Show(Saga.Core.SagaUi.L("이번 세션 정리", "Session Summary"),
                string.Format(Saga.Core.SagaUi.L("이동 {0:F0}m", "Walked {0:F0}m"), _walkedMeters),
                string.Format(Saga.Core.SagaUi.L("금 {0}", "Gold {0}"), goldStr),
                string.Format(Saga.Core.SagaUi.L("다음: {0}", "Next: {0}"), GoalLineNow()));
        }

        /// <summary>PLAN.md 101-2 ① "봉수대" — 불을 올리기 전까지는 봉수대
        /// 자신이 다른 발견형 랜드마크와 같은 자격의 최근접 후보다. 불을
        /// 올린 뒤로는(WorldEventState가 걸러 자동으로 후보에서 빠진다)
        /// 대신 아직 못 찾은 세 갈래(숨은 보물·산신당·동쪽 숲 유적)가
        /// 후보로 들어온다 — 웹판 48절 "가 보기 전까지 안 뜬다"의 예외를
        /// 봉수대만 허용한다는 규칙을, 미니맵이 없는 이 트랙에서는
        /// "목표판이 그 역할을 대신한다"로 재해석한 것.</summary>
        public string GoalLineNow()
        {
            if (_player == null) return "-";

            float nearestDist = float.MaxValue;
            string nearestLabel = null;

            void Consider(Vector3 pos, string label)
            {
                float d = Vector3.Distance(_player.position, pos);
                if (d < nearestDist)
                {
                    nearestDist = d;
                    nearestLabel = label;
                }
            }

            if (!WorldEventState.IsTriggered(BeaconTower.EventId))
            {
                var beacon = Object.FindFirstObjectByType<BeaconTower>();
                if (beacon != null) Consider(beacon.transform.position, GoLocalization.T("goal.beacon", "봉수대"));
            }
            else
            {
                foreach (var t in Object.FindObjectsByType<HiddenTreasure>(FindObjectsSortMode.None))
                    Consider(t.transform.position, GoLocalization.T("goal.treasure", "숨은 보물"));
                foreach (var s in Object.FindObjectsByType<MountainShrine>(FindObjectsSortMode.None))
                    Consider(s.transform.position, GoLocalization.T("goal.shrine", "산신당"));
                foreach (var r in Object.FindObjectsByType<EastGroveRelic>(FindObjectsSortMode.None))
                    Consider(r.transform.position, GoLocalization.T("goal.relic", "동쪽 숲 유적"));
            }

            return nearestLabel == null
                ? GoLocalization.T("goal.all_found", "발견할 곳을 전부 찾음")
                : string.Format(GoLocalization.T("goal.distance", "{0}까지 {1:F0}m"), nearestLabel, nearestDist);
        }

        public string GoalLineSession() => DailyTaskState.SessionLineText();

        public string GoalLineWeek() => DailyTaskState.WeekLineText();
    }
}
