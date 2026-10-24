using System;
using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using Saga.Core;
using Saga.Dungeon.Data;
using Saga.Dungeon.UI;

namespace Saga.Dungeon.World
{
    /// <summary>
    /// PLAN.md 101-2 5.5 "난입(亂入) — 15분 생존 파도". 웹판 §5.5(`saga-web/
    /// saga-dungeon/PLAN.md` 170행, 2026-09-19 기준 웹도 미착수)는 "모루골
    /// 결사비 옆 표식"으로 들어가는 별도 모드를 전제한다. 이 트랙엔 웹판이
    /// 말하는 "모루골"에 해당하는 자리가 실제로 있다(Room1 — 마을 셋이 사방으로
    /// 뻗는 별형 구조의 중심, `Editor/BuildTestDungeonScene.cs` 참고)이라
    /// <see cref="HordeGate"/>를 그 방 빈 구석에 세운다. 다만 "방 하나에서
    /// 파도"는 편도 진행 중인 Room1을 그대로 쓸 수 없어(이미 잡졸 넷·POI
    /// 셋이 있다) **별도의 고정 방(HordeArena) 하나를 새로 짓고 표식을 밟으면
    /// 그 방으로 즉시 텔레포트**하는 쪽으로 재해석했다 — 웹판도 "방 크기를
    /// 표준 그대로 쓴 것"(101-2 실기 확인 대기 항목)이라 이 트랙이 이미 쓰는
    /// `DungeonRoomBuilder` 표준 20×20 방을 그대로 재사용해도 뜻이 갈리지 않는다.
    ///
    /// 레벨업 3택은 새 시스템을 안 만들고 5.1 <see cref="BlessingState"/>를
    /// 그대로 재사용한다("난입 한정"의 뜻은 실행 전/후로 <see cref="BlessingState.
    /// SnapshotIds"/>·<see cref="BlessingState.Restore"/>로 갈아 끼우는 것으로
    /// 구현했다 — 회차 진행 중 쌓아 둔 축복은 난입 동안 잠깐 비워지고, 난입이
    /// 끝나면 원래대로 돌아온다). 웹판 "10분 이상 생존 시 부적 1"은 부적
    /// 인벤토리가 없어(5.3 <see cref="SigilState"/>와 같은 이유) 금 보너스로
    /// 대체했다.
    /// </summary>
    public class HordeRunner : MonoBehaviour
    {
        private const string RoomId = "horde";
        private const float WaveIntervalSec = 30f;      // 웹판 그대로.
        private const float SurvivalGoalSec = 15f * 60f; // 웹판 "15분".
        private const float WaveClearHealFraction = 0.15f; // "체력 회복은 파도 클리어 보너스만" — 우물(0.4)보다 작게, 반복 보상이라서.
        private const float GoldPerSurvivalSecond = 0.8f;  // 웹판 §5.8 "초당 금0.8"(101-2 실기 확인 대기 항목 재사용).
        private const float LongSurvivalBonusThresholdSec = 10f * 60f; // 웹판 "10분 이상".
        private const int LongSurvivalBonusGold = 60; // 부적 인벤토리가 없어 대체한 고정 보너스.

        private static readonly Vector3 ArenaPlayerEntryOffset = new Vector3(0f, 0f, -8f);

        [SerializeField] private GameObject gruntModel; // character-d.

        public static HordeRunner Instance { get; private set; }

        public bool IsActive { get; private set; }
        public int Wave { get; private set; }
        public int KillCount { get; private set; }
        public float TimeLeft => Mathf.Max(0f, SurvivalGoalSec - _survivalTimer);

        private readonly System.Random _rng = new System.Random(20260824); // 루트 CLAUDE.md 진단 시드 관례.
        private readonly List<DungeonEnemy> _liveHordeEnemies = new List<DungeonEnemy>();

        private Transform _player;
        private CharacterController _playerController;
        private BlessingChoiceUi _blessingChoiceUi;
        private SessionCard _sessionCard;

        private float _survivalTimer;
        private float _waveTimer;
        private List<string> _savedBlessingIds;
        private Vector3 _returnPos;

        private void Awake()
        {
            Instance = this;
            var playerGo = GameObject.FindWithTag("Player");
            _player = playerGo != null ? playerGo.transform : null;
            _playerController = playerGo != null ? playerGo.GetComponent<CharacterController>() : null;
        }

        private void Start()
        {
            _blessingChoiceUi = UnityEngine.Object.FindFirstObjectByType<BlessingChoiceUi>();
            _sessionCard = UnityEngine.Object.FindFirstObjectByType<SessionCard>();
        }

        private void OnDestroy()
        {
            if (Instance == this) Instance = null;
        }

        /// <summary><see cref="HordeGate"/>가 표식을 밟았을 때 부른다. 이미 진행
        /// 중이면 무시(재입장 방지).</summary>
        public void StartRun(Vector3 enterFromPos)
        {
            if (IsActive || _player == null) return;

            IsActive = true;
            Wave = 0;
            KillCount = 0;
            _survivalTimer = 0f;
            _waveTimer = 0f;
            _returnPos = enterFromPos;
            _liveHordeEnemies.Clear();

            // "난입 한정" — 회차 축복을 잠깐 비우고 난입 전용으로 새로 쌓는다.
            _savedBlessingIds = BlessingState.SnapshotIds();
            BlessingState.Restore(null);

            HeroState.LeveledUp += OnLeveledUp;
            HeroState.Died += OnHeroDiedDuringHorde;
            DungeonEnemy.AnyDied += OnEnemyDied;

            TeleportPlayer(transform.TransformPoint(ArenaPlayerEntryOffset));
            DialogueLabel.Instance?.Show(
                DungeonLocalization.T("horde.start", "⚔ 난입 시작 — 15분 생존, 30초마다 파도가 몰려온다"), 4f);
            SpawnWave();
        }

        private void Update()
        {
            if (!IsActive) return;

            _survivalTimer += Time.deltaTime;
            _waveTimer += Time.deltaTime;
            if (_waveTimer >= WaveIntervalSec)
            {
                _waveTimer -= WaveIntervalSec;
                SpawnWave();
            }

            if (_survivalTimer >= SurvivalGoalSec)
            {
                EndRun(survived: true);
            }
        }

        private void SpawnWave()
        {
            Wave++;
            int count = DungeonFormulas.HordeEnemyCount(Wave);
            int tier = DungeonFormulas.HordeTier(Wave);

            var waveEnemies = new List<DungeonEnemy>(count);
            for (int i = 0; i < count; i++)
            {
                Vector3 localOffset = RingOffset(i, count);
                var enemy = SpawnHordeGrunt(localOffset, tier);
                waveEnemies.Add(enemy);
                _liveHordeEnemies.Add(enemy);
            }

            string msg = string.Format(
                DungeonLocalization.T("horde.wave_start", "🌊 파도 {0} — 적 {1}(티어 {2})"), Wave, count, tier);
            DialogueLabel.Instance?.Show(msg, 3f);

            StartCoroutine(WatchWaveClear(waveEnemies));
        }

        /// <summary>파도 하나가(다른 파도와 겹쳐 있어도, 이 목록만) 전부
        /// 죽으면 체력 회복 보너스 — 웹판 "체력 회복은 파도 클리어 보너스만".</summary>
        private IEnumerator WatchWaveClear(List<DungeonEnemy> waveEnemies)
        {
            while (IsActive)
            {
                bool anyAlive = false;
                for (int i = 0; i < waveEnemies.Count; i++)
                {
                    if (waveEnemies[i] != null) { anyAlive = true; break; }
                }
                if (!anyAlive) break;
                yield return null;
            }

            if (!IsActive) yield break;
            int healAmount = Mathf.RoundToInt(HeroState.HpMax * WaveClearHealFraction);
            HeroState.HealBy(healAmount);
            DialogueLabel.Instance?.Show(
                string.Format(DungeonLocalization.T("horde.wave_clear", "파도 클리어! — 체력 {0} 회복"), healAmount), 3f);
        }

        private DungeonEnemy SpawnHordeGrunt(Vector3 localOffset, int tier)
        {
            var go = new GameObject("Enemy_Horde");
            go.SetActive(false);
            go.transform.SetParent(transform, false);
            go.transform.localPosition = localOffset;
            var enemy = go.AddComponent<DungeonEnemy>();
            enemy.SetSpawnContext(RoomId, gruntModel);
            enemy.ConfigureCombat(
                DungeonFormulas.EnemyHp(tier, false), DungeonFormulas.EnemyDmg(tier, false),
                DungeonFormulas.RewardExp(tier, false), DungeonFormulas.RewardGold(tier, false),
                "wp_axe", null, false, "황건적",
                new Color(0.72f, 0.64f, 0.3f), 1f);
            go.SetActive(true);
            EnemyRiseIn.Attach(enemy); // tasks U-0159(웹 W-0327 ②) — 물결 적은 땅에서 솟는다
            return enemy;
        }

        /// <summary>파도 규모(최대 40)가 방 하나에 다 들어가게 반지름을 늘려 가는
        /// 동심원 배치 — `DungeonFloorRunner`류의 고정 오프셋 배열과 달리 개수가
        /// 매 파도 달라져 절차적으로 계산해야 한다.</summary>
        private Vector3 RingOffset(int index, int total)
        {
            float angle = (float)(index * (2.0 * Math.PI / Math.Max(1, total)) + _rng.NextDouble() * 0.2);
            float radius = Mathf.Min(8.5f, 3f + total * 0.08f);
            return new Vector3(Mathf.Cos(angle) * radius, 0f, Mathf.Sin(angle) * radius + 2f); // +2 — 남쪽 진입 지점(-8)과 안 겹치게.
        }

        private void OnEnemyDied(DungeonEnemy enemy)
        {
            if (!IsActive || enemy.RoomId != RoomId) return;
            KillCount++;
        }

        private void OnLeveledUp(int newLevel)
        {
            if (!IsActive || _blessingChoiceUi == null || _blessingChoiceUi.IsShowing) return;
            var offer = BlessingState.RollChoice(_rng);
            int wave = Wave;
            _blessingChoiceUi.Show(offer, BlessingState.Choose, () => BlessingState.Reject(wave));
        }

        private void OnHeroDiedDuringHorde(int lostGold)
        {
            if (!IsActive) return;
            EndRun(survived: false);
        }

        /// <summary>15분 생존(성공) 또는 사망(실패) 둘 다 여기로 모인다 —
        /// 웹판 "15분 생존 또는 사망으로 끝".</summary>
        private void EndRun(bool survived)
        {
            IsActive = false;
            HeroState.LeveledUp -= OnLeveledUp;
            HeroState.Died -= OnHeroDiedDuringHorde;
            DungeonEnemy.AnyDied -= OnEnemyDied;

            for (int i = _liveHordeEnemies.Count - 1; i >= 0; i--)
            {
                if (_liveHordeEnemies[i] != null) Destroy(_liveHordeEnemies[i].gameObject);
            }
            _liveHordeEnemies.Clear();

            int survivalSec = Mathf.RoundToInt(_survivalTimer);
            int rewardGold = Mathf.RoundToInt(_survivalTimer * GoldPerSurvivalSecond);
            if (_survivalTimer >= LongSurvivalBonusThresholdSec) rewardGold += LongSurvivalBonusGold;
            HeroState.AddGold(rewardGold);
            HordeState.RecordRun(survivalSec);
            // PLAN.md 101-2 5.6 "목표판·세션 카드·일일/주간"(2026-09-21) — 일일 풀의
            // "난입 완주"는 실제 완주(survived)만 센다, 중도 사망은 안 침.
            if (survived) DungeonDailyTaskState.ReportProgress(DungeonDailyTaskState.Kind.HordeSurvive, 1);

            // "난입 한정" — 원래 회차 축복으로 되돌린다.
            BlessingState.Restore(_savedBlessingIds);
            HeroState.FullHeal();
            TeleportPlayer(_returnPos);

            string title = survived
                ? DungeonLocalization.T("horde.card_title_survived", "난입 완주!")
                : DungeonLocalization.T("horde.card_title_died", "난입 — 쓰러졌다");
            string waveLine = string.Format(DungeonLocalization.T("horde.card_wave", "파도 {0} · 처치 {1}"), Wave, KillCount);
            string rewardLine = string.Format(DungeonLocalization.T("horde.card_reward", "생존 {0}초 — 금 {1} 획득"), survivalSec, rewardGold);
            _sessionCard?.Show(title, waveLine, rewardLine);
        }

        private void TeleportPlayer(Vector3 targetWorldPos)
        {
            if (_player == null) return;
            ZoneCut.Cover("dungeon.horde"); // tasks U-0225 구역 넘김 막
            if (_playerController != null) _playerController.enabled = false;
            _player.position = targetWorldPos;
            if (_playerController != null) _playerController.enabled = true;
        }
    }
}
