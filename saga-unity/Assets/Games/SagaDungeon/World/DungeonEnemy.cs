using System;
using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using Saga.Dungeon.Audio;
using Saga.Dungeon.Cinematics;
using Saga.Dungeon.Data;
using Saga.Dungeon.UI;
using Saga.Core;

namespace Saga.Dungeon.World
{
    /// <summary>
    /// VERTICAL_SLICE_DUNGEON.md 다음 슬라이스 "몬스터 무리"+"엘리트/보스" —
    /// 황건적(saga-dungeon 웹판 `js/data-enemy.js` tier1). 체력·공격력은
    /// `js/dungeon.js`의 실제 공식(`enemyHp`/`enemyDmg`, 1층·평 난이도
    /// 기준)을 그대로 옮겼다: 잡졸 HP=24·공격력=5, 두목(boss=true)은
    /// 같은 공식의 7배/2.2배 배율로 HP=168·공격력=11(dungeon.js:64-65).
    /// 몬스터 수는 `makeRoom('fight', ...)` 공식(dungeon.js:333, floor=1
    /// 기준 `min(12, 4 + rand(0~3))` = 4~7마리)에서 무작위 롤 없이 최소값
    /// 4마리를 결정적으로 씀(BuildTestDungeonScene.cs 참고). **원래 상수로
    /// 박혀 있던 체력·공격력·보상을 `[SerializeField]`로 바꿔 두목 변형을
    /// 하나의 컴포넌트로 같이 받게 했다** — GO의 `Gatherable.cs`와 같은
    /// 이유(자리마다 값이 다른 재사용 컴포넌트는 상수로 못 박지 못하고
    /// 편집기 빌드 스크립트가 `[SerializeField]`에 값을 채워 씬에
    /// 직렬화해 둔다, Awake는 Play 때만 돈다). GO의 BanditEncounter.cs와
    /// 달리 **선택지 화면이 없는 실시간 전투**다 — saga-dungeon 웹판
    /// 정체성 자체가 이동+근접 판정이라 GO의 턴제 UI 화면을 베끼지 않는다
    /// (VERTICAL_SLICE_DUNGEON.md "왜 GO와 다르게 설계하는가" 참고).
    /// </summary>
    public class DungeonEnemy : MonoBehaviour
    {
        [SerializeField] private float hp = 24f;
        [SerializeField] private float dmg = 5f;
        [SerializeField] private float aggroRadius = 8f;
        [SerializeField] private float chaseSpeed = 3.5f;
        [SerializeField] private float attackRange = 2.3f;
        [SerializeField] private float attackInterval = 1.0f;

        [SerializeField] private int rewardExp = 20;
        [SerializeField] private int rewardGold = 8;
        [SerializeField] private string rewardItemId = "wp_axe";

        // "세공·행상 재고 굴리기·도감" 슬라이스 — 비어 있으면(기본값) 보석을
        // 안 준다. 잡졸·정예는 그대로 두고 미니보스·두목에만 채운다
        // (BuildTestDungeonScene.cs 참고).
        [SerializeField] private string rewardGemId;

        [SerializeField] private bool isBoss;
        [SerializeField] private string displayName = "황건적";

        // PLAN.md 101-2 5.4 "월드 보스" — isBoss는 미니보스("황건 살수")도
        // true라 따로 뒀다. 진짜 층 끝 두목("황건적 두목", 절차적 SpawnSolo의
        // withEscorts 또는 Editor/BuildTestDungeonScene.cs BuildBoss())에만 켠다.
        [SerializeField] private bool isWorldBoss;

        // Localization — displayName 자체가 BestiaryState.Record()의 저장 키라
        // (기존 세이브 호환) 그 값은 안 건드리고, 화면 표시용으로만 이 표를
        // 거친다. 종류가 넷뿐이라(잡졸/정예/살수/두목) 새 id 필드를 따로
        // 두는 대신 알려진 한국어 표시명 → 키 매핑 하나로 충분하다.
        private static readonly Dictionary<string, string> DisplayNameKeys = new Dictionary<string, string>
        {
            ["황건적"] = "enemy.grunt",
            ["사나운 황건적"] = "enemy.elite", // BuildTestDungeonScene.cs 더미 전용 표시명.
            ["폐허의 황건 정예"] = "enemy.elite", // DungeonFloorRunner.SpawnElite() 실제 스폰 표시명.
            ["황건 살수"] = "enemy.miniboss",
            ["황건적 두목"] = "enemy.boss",
            ["기계화 정찰병"] = "enemy.elite_fusion", // 101-2 5.7 "시대 퓨전" — 깊은 층 정예 변종.
            ["능묘 파수꾼"] = "enemy.temple_warden", // PLAN.md 106-2 "잊힌 능묘" 잡졸.
            ["능묘지기"] = "enemy.temple_guardian", // PLAN.md 106-2 "잊힌 능묘" 보스.
            // PLAN.md 109-2 세 시대 잡졸(DungeonEras.Foes 와 같은 이름)
            ["폭주 청년"] = "enemy.era_rioter",
            ["시험 기동 인형"] = "enemy.era_testbot",
            ["방역복 추적자"] = "enemy.era_hazmat",
            ["경비 보행병"] = "enemy.era_sentry",
            ["진압 특공대"] = "enemy.era_swat",
            ["강철 인형 병정"] = "enemy.era_steelbot",
            ["암흑가 해결사"] = "enemy.era_enforcer",
            ["별 너머 방문자"] = "enemy.era_visitor",
            ["시련의 수호자"] = "enemy.trial_guardian", // PLAN.md 109-10-3 시련 끝 수호자.
            // PLAN.md 109-10-5 지역 우두머리 아홉(DungeonRegionFoes.Bosses 와 같은 이름)·신화 호위
            ["벌판 흑기 대장"] = "rboss.jungwon",
            ["폐도시 폭주룡"] = "rboss.neon",
            ["개펄 촉수왕"] = "rboss.saltmarsh",
            ["균열 문지기 겁옥"] = "rboss.hellgate",
            ["태양로 폭주 거신"] = "rboss.solar",
            ["모래바다 폭군"] = "rboss.silkroad",
            ["타락한 천장"] = "rboss.heaven",
            ["만년설 거한"] = "rboss.snowfort",
            ["고철 거신"] = "rboss.scrap",
            ["해골 무사"] = "enemy.region_skeleton",
            ["해골 졸개"] = "enemy.region_skeleton_grunt", // PLAN.md 109-10-6 사냥터 신화 잡졸
        };

        /// <summary>진단 — 표시 이름 → 번역 키 표에 있나.</summary>
        public static bool HasDisplayNameKey(string name) => DisplayNameKeys.ContainsKey(name);

        // PLAN.md 106-2 "잊힌 능묘" 보스 — 갑주를 입은 동안 칼은 15%만 들어가고,
        // 벽력탄에 맞으면 갑주가 벗겨져 4초 기절(그동안 150%). 젤다 보스의 "던전 도구로
        // 약점을 연다" 문법. deathFlag 는 쓰러질 때 세울 능묘 진행 비트(세이브 로드 시
        // 이미 서 있으면 이 개체는 나타나지 않는다).
        [SerializeField] private bool bombArmored;
        [SerializeField] private TempleFlag deathFlag = TempleFlag.None;
        private const float ArmorDamageMul = 0.15f;
        private const float StunnedDamageMul = 1.5f;
        private const float BombStunSec = 4f;
        private const float ArmorHintGapSec = 6f;
        private static readonly Color StunColor = new Color(0.45f, 0.6f, 1f);
        private float _stunLeft;
        private float _armorHintCooldown;

        public bool IsBombArmored => bombArmored;
        public bool IsStunned => _stunLeft > 0f;

        // PLAN.md 109-10 비결 한기(웹 §5.9) — 맞으면 얼어 쫓기·공격 준비·예비동작이 느려진다(시간 제한은 그대로).
        private static readonly Color ChillColor = new Color(0.7f, 0.88f, 1f);
        private float _chillLeft;
        public bool IsChilled => _chillLeft > 0f;
        public float CurrentHp => _curHp;

        public void Chill(float seconds)
        {
            if (_state == State.Dead || seconds <= 0f) return;
            bool was = _chillLeft > 0f;
            _chillLeft = Mathf.Max(_chillLeft, seconds);
            if (!was && _visualGo != null) CharacterVisual.Tint(_visualGo, CurrentTint());
        }

        private string LocalizedDisplayName =>
            DisplayNameKeys.TryGetValue(displayName, out var key) ? DungeonLocalization.T(key, displayName) : displayName;
        [SerializeField] private Color bodyColor = new Color(0.72f, 0.64f, 0.3f); // 황건 — 누런 두건.
        [SerializeField] private float visualScale = 1f;

        // "GLB 자산 도입" 슬라이스 — Awake()는 실제 Play 때도 도는 런타임
        // 코드라 AssetDatabase를 못 쓴다(에디터 전용 API). SagaGo
        // NpcBuilder.cs가 이미 쓴 패턴대로 편집기 빌드 스크립트가 이
        // 필드를 채워 씬에 직렬화해 둔다. null이면(다른 PC에 아직 GLB가
        // 없는 경우 등) CharacterVisual.SpawnFallbackCapsule()로 대체.
        [SerializeField] private GameObject modelPrefab;

        // "방 종류 나머지" 슬라이스 — 오픈월드/필드로 방이 둘이 된 뒤
        // `DungeonTrove.cs`/`DungeonShrine.cs`가 "방 클리어"를 판정할 때
        // 이 방 저 방 몬스터를 다 합쳐서 세던 걸 방별로 가르려고 추가
        // (Room2 필드 잡졸이 살아 있으면 Room1 상자가 안 열리던 잠재
        // 버그를 여기서 같이 고쳤다). 기본값 "room1" — Room1 스폰은 안
        // 건드리고 Room2 스폰만 BuildTestDungeonScene.cs가 덮어쓴다.
        [SerializeField] private string roomId = "room1";

        private const float ToastSec = 5f;

        // PLAN.md 101-2 5.4 "월드 보스" — 웹판 §5.4의 실시간 슬롯·필드 스폰은
        // 이 트랙에 대응 개념이 없어(편도 진행, 재방문 없는 필드) 안 옮기고
        // "그 두목전 자체가 75초 제한"으로 좁혔다. 부위 3은 GO 101-2 ③
        // "75초 토벌"(`RareWolfEncounter`+`DuelRules.Raid`)의 75/50/25% 문턱
        // 관례를 그대로 재사용 — 사람형 두목이라 다리/몸통/급소 대신
        // 갑주 부위 이름을 쓴다.
        private const float WorldBossTimeLimitSec = 75f;      // 웹판 그대로.
        private const float FleeRewardMultiplier = 0.3f;      // 웹판 "도망 보상 30%".
        private const float PartBonusGoldMultiplier = 0.15f;  // 부위 하나 파괴마다.
        private const float FullBreakBonusGoldMultiplier = 0.5f; // 부위 3 전부 파괴 시 추가.
        private static readonly float[] WorldBossPartThresholds = { 0.75f, 0.50f, 0.25f };
        private static readonly string[] WorldBossPartNames = { "투구", "갑주", "무기" };
        private static readonly string[] WorldBossPartKeys = { "worldboss.part.helm", "worldboss.part.armor", "worldboss.part.weapon" };

        private float _worldBossTimeLeft;
        private bool _worldBossActive;
        private readonly bool[] _worldBossPartBroken = new bool[WorldBossPartThresholds.Length];

        /// <summary>지금 75초 두목전이 진행 중인 그 개체 — `PlayerHud.cs`가
        /// 폴링해 카운트다운을 보여준다. 한 씬엔 두목이 하나뿐이라(절차적
        /// 진행도 방 하나씩) 이 정적 참조로 충분하다.</summary>
        public static DungeonEnemy ActiveWorldBoss { get; private set; }

        public bool IsWorldBoss => isWorldBoss;
        public float WorldBossTimeLeft => _worldBossTimeLeft;

        /// <summary>PLAN.md 101-2 5.5 "난입" — `HordeRunner`가 처치 수를 세려면
        /// 방을 가리지 않는 이 개체의 roomId를 밖에서 읽어야 한다.</summary>
        public string RoomId => roomId;
        public int RewardExp => rewardExp;
        public int RewardGold => rewardGold;

        public static readonly List<DungeonEnemy> Active = new List<DungeonEnemy>();

        /// <summary>PLAN.md 101-2 5.5 "난입" 전용 훅 — `Die()`가 보상을 이미
        /// 다 준 뒤 부른다. 도망(`Flee()`)은 안 죽은 것이므로 안 쏜다.</summary>
        public static event Action<DungeonEnemy> AnyDied;

        /// <summary>"타격감 2차"(PLAN.md 101-3 C hitstop) — PlayerCombat이
        /// 가해자·피해자 두 Animator를 같이 잠깐 멈추려면 이 적 쪽
        /// Animator도 밖에서 봐야 한다(null 이면 primitive 폴백이라 원래
        /// 없다 — 호출부는 `?.` 로 그냥 넘어간다).</summary>
        public Animator Animator => _animator;

        private enum State { Idle, Chase, Windup, Dead }

        private const float FlashSec = 0.08f; // "타격감 1차" 슬라이스 — enemy flash.

        // PLAN.md 106-1 "적 공격 예고"(젤다 방향) — 사거리에 들면 곧바로 피해를
        // 주던 것을 예비동작 → 판정 둘로 나눈다. 예비동작 동안 멈춰 서서 몸이
        // 달아오르고 발밑 경고 고리가 판정 반경까지 커진다. 주기는 예비동작
        // 시작부터 세어(`attackInterval - 예비동작`) 가만히 서 있으면 예전과
        // 같은 초당 피해 — 읽고 피하는 쪽에만 보상이 간다.
        private const float WindupSec = 0.5f;
        private const float BossWindupSec = 0.7f;        // 두목급은 더 크게 휘두른다.
        private const float StrikeReachMul = 1.2f;       // 판정 반경 = attackRange × 이 값.
        private const float MinRecoverSec = 0.3f;        // 판정 뒤 다음 예비동작까지 최소 간격.
        private const float InterruptCooldownMul = 0.5f; // 강공격에 끊기면 주기 절반 뒤 다시.
        private const float WarnHotAt = 0.7f;            // 이 진행률부터 "지금 피하라" 붉은빛.
        private static readonly Color WarnColor = new Color(1f, 0.22f, 0.08f);
        private const int WarnRingSegments = 40;

        // 44장 "주요 Enemy" 교체 — Death 애니메이션이 재생될 시간을 준 뒤
        // Destroy한다(Player/PlayerCombat.cs의 즉시 회복과 달리 적은
        // 그 자리에서 완전히 사라지므로 지연이 필요).
        private const float DeathAnimDelaySec = 1.2f;

        private State _state = State.Idle;
        private float _curHp;
        private float _attackCooldown;
        private Transform _player;
        private GameObject _visualGo;
        private Animator _animator;
        private Coroutine _flashRoutine;

        // PLAN.md 106-6 "FF 확장" — 동행 무사의 "방패 도발". 걸려 있는 동안 플레이어 대신 무사를 쫓고 때린다.
        // 무사가 쓰러지거나 시간이 다 되면 다시 플레이어.
        private AllyFighter _taunter;
        private float _tauntLeft;

        // PLAN.md 106-7 "두목 등장 컷" — 층 두목(월드 보스)은 매번, 살수 같은 다른 두목급은 세션에 이름마다 한 번.
        // 능묘지기(갑주)는 제 컷(106-3)이 따로 있다.
        private static readonly HashSet<string> IntroSeen = new HashSet<string>();
        private bool _introPlayed;
        public static void ResetIntroSeenForTest() => IntroSeen.Clear();

        private float _windupLeft;
        private float _windupTotal;
        private bool _warnHot;
        private LineRenderer _warnRing;

        /// <summary>PLAN.md 106-1 — 락온(`PlayerLockOn`)·진단이 본다.</summary>
        public bool IsAlive => _state != State.Dead;
        public bool IsBoss => isBoss;
        public float VisualScale => visualScale;
        public bool IsWindingUp => _state == State.Windup;
        public float StrikeReach => attackRange * StrikeReachMul;
        public bool IsTaunted => _tauntLeft > 0f && _taunter != null && _taunter.IsUp;

        /// <summary>PLAN.md 106-6 — `AllyFighter.OrderTaunt()` 가 반경 안 적에게 건다.</summary>
        public void Taunt(AllyFighter by, float seconds)
        {
            if (_state == State.Dead || by == null) return;
            _taunter = by;
            _tauntLeft = seconds;
        }

        private Transform Target => IsTaunted ? _taunter.transform : _player;

        /// <summary>"랜덤 이벤트" 슬라이스 — `DungeonAmbush.cs`처럼 런타임에
        /// 즉석으로 만든 개체에 값을 채우는 정식 API. 편집기 빌드 스크립트의
        /// 리플렉션 `SetPrivateField()`와 달리 Play 중에도 동작해야 한다.
        /// **`Awake()`가 아직 안 돈 상태에서만 의미가 있다** — 호출부가
        /// GameObject를 비활성 상태로 만들고 이 메서드를 부른 뒤 활성화해야
        /// `BuildVisual()`이 올바른 모델로 도는 게 보장된다.</summary>
        public void SetSpawnContext(string newRoomId, GameObject newModelPrefab)
        {
            roomId = newRoomId;
            modelPrefab = newModelPrefab;
        }

        /// <summary>"DUNGEON 오픈월드 확장 — 절차적 층 진행" 슬라이스 —
        /// `DungeonFloorRunner`가 층 공식(`DungeonFormulas`)으로 계산한
        /// 스탯·보상을 즉석으로 만든 개체에 채운다. `SetSpawnContext()`와
        /// 같은 제약(Awake가 아직 안 돈 상태에서만 의미가 있다).</summary>
        public void ConfigureCombat(float newHp, float newDmg, int newRewardExp, int newRewardGold,
            string newRewardItemId, string newRewardGemId, bool newIsBoss, string newDisplayName,
            Color newBodyColor, float newVisualScale, bool newIsWorldBoss = false)
        {
            hp = newHp;
            dmg = newDmg;
            rewardExp = newRewardExp;
            rewardGold = newRewardGold;
            rewardItemId = newRewardItemId;
            rewardGemId = newRewardGemId;
            isBoss = newIsBoss;
            displayName = newDisplayName;
            bodyColor = newBodyColor;
            visualScale = newVisualScale;
            isWorldBoss = newIsWorldBoss;
        }

        private string _introSubtitle;

        /// <summary>PLAN.md 109-10-6 지역 사연 ③ 정예 걸음이 세는 적 — 우두머리 호위·사냥터 정예(`MarkElite`). 옛 VS 정예는 안 센다.</summary>
        public bool IsElite { get; private set; }
        public void MarkElite() => IsElite = true;

        /// <summary>PLAN.md 109-10-10 몰이 사냥 — 전투방 잡졸 곁에 붙은 졸개. 첫 공격을 해시로 어긋나게 늦춘다(떼가 한 박자에 치지 않게).</summary>
        public bool IsMinion { get; private set; }
        public void MarkMinion(float firstAttackDelay)
        {
            IsMinion = true;
            _attackCooldown = firstAttackDelay;
        }
        /// <summary>진단 — 다음 공격까지 남은 시간(경직이 민다).</summary>
        public float AttackCooldownLeft => _attackCooldown;
        /// <summary>진단 — 쓰러질 때 넘친 피해·강공격이었나(날림 힘).</summary>
        public float LastOverkill { get; private set; }
        private bool _lastHeavy;
        private Coroutine _flinchRoutine;
        private Quaternion _flinchBase;

        /// <summary>PLAN.md 108 ③ — 명소 층 주인처럼 등장 컷 부제를 따로 줄 때("순장 왕릉의 주인").</summary>
        public void SetIntroSubtitle(string subtitle) => _introSubtitle = subtitle;

        /// <summary>진단 — 쓰러질 때 떨굴 무기 id.</summary>
        public string RewardItemId => rewardItemId;
        /// <summary>진단 — 세운 이름 원문(표시는 `LocalizedDisplayName`).</summary>
        public string DisplayNameRaw => displayName;
        /// <summary>화면 이름(번역) · 최대 체력 · 한 대 공격력 — PLAN.md 109-10-9 주인 고유 수가 본다.</summary>
        public string DisplayName => LocalizedDisplayName;
        public float MaxHp => hp;
        public float Damage => dmg;

        // PLAN.md 109-10-9 명소 층 주인 고유 수 — 층 진행기가 주인에게만 건다.
        private LordSigRunner _lordSig;
        public LordSigRunner LordSig => _lordSig;
        public void SetLordSig(LordSigRunner runner) => _lordSig = runner;

        private void Awake()
        {
            _curHp = hp;

            // DungeonRoomBuilder.cs와 같은 이유로 처음부터 넣는 방어 —
            // 2026-09-12에 SagaGo 쪽 6곳에서 빠뜨렸다가 뒤늦게 고친 패턴.
            if (transform.childCount == 0)
            {
                BuildVisual();
            }

            var playerGo = GameObject.FindWithTag("Player");
            _player = playerGo != null ? playerGo.transform : null;
        }

        private void OnEnable() => Active.Add(this);

        private void Start()
        {
            if (deathFlag == TempleFlag.None) return;
            TempleState.Changed += OnTempleChanged;
            OnTempleChanged();
        }

        private void OnDestroy()
        {
            if (deathFlag != TempleFlag.None) TempleState.Changed -= OnTempleChanged;
        }

        /// <summary>PLAN.md 106-2 — 이미 쓰러뜨린 보스(세이브 로드)는 다시 서지 않는다.</summary>
        private void OnTempleChanged()
        {
            if (_state != State.Dead && TempleState.Has(deathFlag)) gameObject.SetActive(false);
        }

        /// <summary>PLAN.md 106-2 벽력탄 폭발(`TempleBomb.Explode`)이 부른다. 갑주 보스면
        /// 먼저 갑주를 벗겨 기절시킨 뒤(그래서 이 한 방부터 150%) 피해를 준다. 그 밖의 적은
        /// 강공격처럼 예비동작을 끊는 한 방.</summary>
        public void BombHit(float damage)
        {
            if (_state == State.Dead) return;
            if (bombArmored && _stunLeft <= 0f)
            {
                EndWindup();
                _stunLeft = BombStunSec;
                if (_visualGo != null) CharacterVisual.Tint(_visualGo, StunColor);
                _animator?.SetTrigger("Hit");
                DialogueLabel.Instance?.Show(DungeonLocalization.T("temple.armor_broken", "💥 갑주가 벗겨졌다! — 지금이다"), 3f);
            }
            TakeDamage(damage, heavy: true);
        }

        private void OnDisable()
        {
            Active.Remove(this);
            if (ActiveWorldBoss == this) ActiveWorldBoss = null;
        }

        /// <summary>44장 "주요 Enemy" 교체 — `modelPrefab`에 Animator가
        /// 이미 붙어 있으면(`SetupAbeCharacterImport.cs`가 구운
        /// AbeAnimated.prefab처럼) 리깅된 캐릭터로 보고 실제 스케일 그대로
        /// 쓴다(Mixamo FBX는 이미 실제 사람 크기 단위로 들어온다 —
        /// `BuildTestDungeonScene.BuildPlayerVisual`의 Maria와 같은 가정).
        /// 그 외(Kenney GLB·null)는 기존 `CharacterVisual`(NativeHeight
        /// 2.7 기준 스케일) 경로 그대로.</summary>
        private void BuildVisual()
        {
            if (modelPrefab != null && modelPrefab.GetComponent<Animator>() != null)
            {
                var inst = Instantiate(modelPrefab, transform, false);
                inst.name = "Visual";
                inst.transform.localScale = Vector3.one * visualScale;
                _visualGo = inst;
                _animator = inst.GetComponent<Animator>();
                if (bodyColor != Color.white)
                {
                    CharacterVisual.Tint(inst, bodyColor);
                }
                CharacterVisual.EnsureBlobShadow(transform); // PLAN 102-5 "그림자 계단" — Spawn()을 안 타는 리깅 분기는 직접 부른다.
                return;
            }

            float targetHeight = 2f * visualScale; // 기존 primitive capsule 기준(높이 2m × visualScale) 그대로 유지.

            Transform visual = modelPrefab != null
                ? CharacterVisual.Spawn(modelPrefab, transform, targetHeight, bodyColor)
                : CharacterVisual.SpawnFallbackCapsule(transform, targetHeight, bodyColor);
            _visualGo = visual.gameObject;
        }

        private void Update() => Tick(Time.deltaTime);

        /// <summary>한 프레임 분량의 AI — `Update()`가 부르고, 헤드리스 진단은
        /// 시간을 직접 넣어 예비동작·판정을 한 프레임 안에서 확인한다.</summary>
        public void Tick(float dt)
        {
            if (_state == State.Dead || _player == null) return;
            if (DungeonCutscenes.Playing)
            {
                // PLAN.md 106-3 — 컷 동안은 제자리(숨쉬기 idle 만). 예비동작도 그 자리에 멈춘다.
                if (_state != State.Windup) _animator?.SetFloat("Speed", 0f);
                return;
            }

            if (_armorHintCooldown > 0f) _armorHintCooldown -= dt;
            if (_tauntLeft > 0f) _tauntLeft -= dt;
            if (_stunLeft > 0f)
            {
                _stunLeft -= dt;
                _animator?.SetFloat("Speed", 0f);
                if (_stunLeft <= 0f)
                {
                    if (_visualGo != null) CharacterVisual.Tint(_visualGo, bodyColor);
                    DialogueLabel.Instance?.Show(DungeonLocalization.T("temple.armor_back", "능묘지기가 갑주를 다시 여몄다"), 2.5f);
                }
                return;
            }

            if (isWorldBoss && _worldBossActive)
            {
                _worldBossTimeLeft -= dt;
                if (_worldBossTimeLeft <= 0f)
                {
                    Flee();
                    return;
                }
            }

            if (_chillLeft > 0f)
            {
                _chillLeft -= dt;
                dt *= Saga.Dungeon.Data.SecretState.ChillSlow; // 아래(쫓기·공격 준비·예비동작)만 느려진다.
                if (_chillLeft <= 0f && _visualGo != null) CharacterVisual.Tint(_visualGo, CurrentTint());
            }

            Transform target = Target;
            float dist = Vector3.Distance(transform.position, target.position);

            // PLAN.md 109-10-9 — 달려든 뒤로 고유 수(늘 나를 노린다). 예고·시전하는 동안은 강타를 쉬고, 강타 예비동작 중엔 새로 안 건다.
            if (_lordSig != null && _state != State.Idle && _lordSig.Tick(dt, _state != State.Windup, _player))
            {
                _animator?.SetFloat("Speed", 0f);
                Face(_player);
                return;
            }

            if (_state == State.Windup)
            {
                TickWindup(dt, dist);
                return;
            }

            if (_state == State.Idle)
            {
                if (dist <= aggroRadius || IsTaunted)
                {
                    _state = State.Chase;
                    if (isWorldBoss)
                    {
                        _worldBossActive = true;
                        _worldBossTimeLeft = WorldBossTimeLimitSec; // 컷 동안은 Tick 이 일찍 돌아가 시간이 안 준다.
                        ActiveWorldBoss = this;
                    }
                    // 두목전 안내는 컷이 있으면 컷 뒤에(레터박스 위에 겹치지 않게).
                    if (!TryPlayFieldIntro(isWorldBoss ? ShowWorldBossStart : (Action)null) && isWorldBoss) ShowWorldBossStart();
                }
                return;
            }

            // Chase
            if (dist > attackRange)
            {
                Vector3 dir = target.position - transform.position;
                dir.y = 0f;
                if (dir.sqrMagnitude > 0.0001f)
                {
                    dir.Normalize();
                    transform.position += dir * chaseSpeed * dt;
                    transform.rotation = Quaternion.LookRotation(dir);
                }
                _animator?.SetFloat("Speed", 1f);
            }
            else
            {
                _animator?.SetFloat("Speed", 0f);
                Face(target);
                _attackCooldown -= dt;
                if (_attackCooldown <= 0f)
                {
                    BeginWindup();
                }
            }
        }

        private void ShowWorldBossStart()
        {
            string startMsg = string.Format(
                DungeonLocalization.T("worldboss.start", "⏱ 두목전 시작 — {0:0}초 안에 쓰러뜨려라"),
                WorldBossTimeLimitSec);
            DialogueLabel.Instance?.Show(startMsg, 3f);
        }

        /// <summary>PLAN.md 106-7 — 두목급(능묘지기 빼고)이 처음 달려들 때 등장 컷. 틀었으면 true.</summary>
        private bool TryPlayFieldIntro(Action onEnd)
        {
            if (!isBoss || bombArmored || _introPlayed || _player == null) return false;
            var cuts = DungeonCutscenes.Instance;
            if (cuts == null || DungeonCutscenes.Playing) return false;
            if (!isWorldBoss && !IntroSeen.Add(displayName)) return false;
            _introPlayed = true;
            string sub = _introSubtitle ?? (isWorldBoss
                ? string.Format(DungeonLocalization.T("cut.floorboss_sub", "층 끝의 우두머리 — {0:0}초 안에 쓰러뜨려라"), WorldBossTimeLimitSec)
                : DungeonLocalization.T("cut.miniboss_sub", "층을 지키는 살수 — 홀로 서서 기다린다"));
            return cuts.PlayFieldBoss(this, _player.position, LocalizedDisplayName, sub, onEnd);
        }

        /// <summary>PLAN.md 106-3 — 등장 컷에서 `DungeonCutscenes` 가 부른다. 플레이어를 보고
        /// 공격 클립을 포효 대신 한 번 튼다(판정 없음 — 예비동작 상태로 들어가지 않는다).</summary>
        public void PlayRoar()
        {
            if (_player != null) Face(_player);
            _animator?.SetTrigger("Attack");
            SfxPlayer.PlayHeavyHit();
        }

        private void Face(Transform target)
        {
            Vector3 dir = target.position - transform.position;
            dir.y = 0f;
            if (dir.sqrMagnitude > 0.0001f) transform.rotation = Quaternion.LookRotation(dir.normalized);
        }

        /// <summary>PLAN.md 106-1 — 예비동작 시작. 공격 클립은 여기서 틀어
        /// 휘두르는 동작이 판정 순간에 닿게 한다.</summary>
        private void BeginWindup()
        {
            _state = State.Windup;
            _windupTotal = isBoss ? BossWindupSec : WindupSec;
            _windupLeft = _windupTotal;
            _warnHot = false;
            _animator?.SetTrigger("Attack");
            if (_visualGo != null) CharacterVisual.Tint(_visualGo, Color.Lerp(bodyColor, WarnColor, 0.45f));
            EnsureWarnRing();
            _warnRing.enabled = true;
            SetWarnRingRadius(0.3f);
        }

        private void TickWindup(float dt, float dist)
        {
            _windupLeft -= dt;
            float progress = _windupTotal > 0f ? 1f - Mathf.Clamp01(_windupLeft / _windupTotal) : 1f;
            if (!_warnHot && progress >= WarnHotAt)
            {
                _warnHot = true;
                if (_visualGo != null) CharacterVisual.Tint(_visualGo, WarnColor);
            }
            SetWarnRingRadius(Mathf.Lerp(0.3f, StrikeReach, progress));
            if (_windupLeft <= 0f) ResolveStrike(dist);
        }

        /// <summary>판정 — 반경 밖이면 헛손질, 회피 무적 중이면 완벽 회피(반격 창),
        /// 그 밖엔 피해.</summary>
        private void ResolveStrike(float dist)
        {
            EndWindup();
            _attackCooldown = Mathf.Max(MinRecoverSec, attackInterval - _windupTotal);
            if (dist > StrikeReach) return;
            if (IsTaunted)
            {
                _taunter.TakeHit(dmg); // 무사는 방패로 받는다(피해 감소는 AllyFighter 쪽).
                return;
            }
            if (HeroState.Invulnerable)
            {
                Saga.Dungeon.Player.PlayerController.ReportDodgedStrike();
                return;
            }
            HeroState.TakeDamage(dmg);
        }

        private void EndWindup()
        {
            if (_state == State.Windup) _state = State.Chase;
            if (_warnRing != null) _warnRing.enabled = false;
            if (_visualGo != null) CharacterVisual.Tint(_visualGo, CurrentTint()); // 얼어 있으면 얼음빛으로(아니면 bodyColor).
        }

        private void EnsureWarnRing()
        {
            if (_warnRing != null) return;
            var go = new GameObject("WarnRing");
            go.transform.SetParent(transform, false);
            go.transform.localPosition = new Vector3(0f, 0.05f, 0f);
            _warnRing = go.AddComponent<LineRenderer>();
            _warnRing.useWorldSpace = false;
            _warnRing.loop = true;
            _warnRing.positionCount = WarnRingSegments;
            _warnRing.widthMultiplier = 0.08f;
            _warnRing.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
            _warnRing.receiveShadows = false;
            _warnRing.material = new Material(Shader.Find("Sprites/Default")) { name = "WarnRing (generated)" };
            var c = new Color(WarnColor.r, WarnColor.g, WarnColor.b, 0.85f);
            _warnRing.startColor = c;
            _warnRing.endColor = c;
        }

        private void SetWarnRingRadius(float radius)
        {
            if (_warnRing == null) return;
            for (int i = 0; i < WarnRingSegments; i++)
            {
                float a = i * Mathf.PI * 2f / WarnRingSegments;
                _warnRing.SetPosition(i, new Vector3(Mathf.Cos(a) * radius, 0f, Mathf.Sin(a) * radius));
            }
        }

        /// <summary>플레이어 공격 사거리 안의 가장 가까운 살아있는 적 —
        /// Player/PlayerCombat.cs가 부른다.</summary>
        public static DungeonEnemy FindNearest(Vector3 pos, float maxRange)
        {
            DungeonEnemy best = null;
            float bestDist = maxRange;
            foreach (var e in Active)
            {
                if (e._state == State.Dead) continue;
                float d = Vector3.Distance(pos, e.transform.position);
                if (d <= bestDist)
                {
                    best = e;
                    bestDist = d;
                }
            }
            return best;
        }

        /// <summary>방 종류 POI(`DungeonTrove.cs`·`DungeonShrine.cs`·
        /// `DungeonMerchant.cs`)가 "이 방 몬스터를 다 잡았는지"를 물을 때
        /// 쓴다 — `Active`는 씬 전체를 합친 목록이라 방이 여럿이 되면
        /// 그대로 못 쓴다.</summary>
        public static int CountAliveInRoom(string roomId)
        {
            int count = 0;
            foreach (var e in Active)
            {
                if (e._state != State.Dead && e.roomId == roomId) count++;
            }
            return count;
        }

        /// <summary>"타격감 1차" 슬라이스(PLAN.md 38장 "damage popup"·
        /// "enemy flash") — heavy는 PlayerCombat.TryHeavyAttack()이 넘겨
        /// 팝업 색·크기만 다르게 한다(새 크리티컬 확률 시스템은 범위 밖,
        /// 강공격 자체가 이미 있는 "확실히 센 한 방" 신호라 재사용).</summary>
        public void TakeDamage(float amount, bool heavy = false)
        {
            if (_state == State.Dead) return;
            if (bombArmored)
            {
                if (_stunLeft > 0f)
                {
                    amount *= StunnedDamageMul;
                }
                else
                {
                    amount *= ArmorDamageMul;
                    if (_armorHintCooldown <= 0f)
                    {
                        _armorHintCooldown = ArmorHintGapSec;
                        DialogueLabel.Instance?.Show(DungeonLocalization.T("temple.armor_hint", "칼날이 튕겨 나간다 — 갑주를 먼저 벗겨야 한다"), 3f);
                    }
                }
            }
            _curHp -= amount;
            _lastHeavy = heavy;
            if (_curHp <= 0f) LastOverkill = -_curHp;

            Vector3 popupPos = transform.position + Vector3.up * (2f * visualScale);
            DamagePopup.Spawn(popupPos, amount, heavy);
            HitSpark.Spawn(popupPos, heavy);
            GroundDecal.Spawn(transform.position, GroundDecal.Kind.HitMark); // PLAN.md 101-3 G "지형 반응".

            if (_visualGo != null)
            {
                if (_flashRoutine != null) StopCoroutine(_flashRoutine);
                _flashRoutine = StartCoroutine(FlashHit());
            }

            if (isWorldBoss) CheckWorldBossPartBreak(); // 죽는 타격도 문턱을 넘겼으면 완파 보너스까지 같이 정산.

            // PLAN.md 106-1 "끊기" — 강공격은 두목급이 아닌 적의 예비동작을 끊는다.
            if (heavy && !isBoss && _state == State.Windup && _curHp > 0f)
            {
                EndWindup();
                _attackCooldown = attackInterval * InterruptCooldownMul;
            }

            // PLAN.md 109-10-10 경직 — 맞으면 다음 공격이 조금 밀린다(두목급은 안 밀린다). 떼를 몰아 치는 동안 숨 쉴 틈.
            if (!isBoss && DungeonHunt.Stagger > 0f && _curHp > 0f) _attackCooldown = Mathf.Max(_attackCooldown, DungeonHunt.Stagger);

            if (_curHp <= 0f)
            {
                Die();
            }
            else
            {
                _animator?.SetTrigger("Hit");
                if (!HasHitClip && _visualGo != null) Flinch(); // 피격 클립이 없는 몸은 움찔(그림만)
            }
        }

        /// <summary>PLAN.md 101-2 5.4 "월드 보스" 부위 3 — GO `RareWolfEncounter.
        /// CheckPartBreak()`와 같은 결(같은 기세 풀을 누적 문턱으로 읽어
        /// 넘길 때마다 하나씩), 여기선 별도 풀 없이 hp 비율 그대로 쓴다.</summary>
        private void CheckWorldBossPartBreak()
        {
            float hpFrac = hp > 0f ? Mathf.Clamp01(_curHp / hp) : 0f;
            for (int i = 0; i < WorldBossPartThresholds.Length; i++)
            {
                if (_worldBossPartBroken[i] || hpFrac > WorldBossPartThresholds[i]) continue;
                _worldBossPartBroken[i] = true;

                int bonus = Mathf.RoundToInt(rewardGold * PartBonusGoldMultiplier);
                HeroState.AddGold(bonus);
                string msg = string.Format(DungeonLocalization.T("worldboss.part_broken", "🛡 {0} 파괴! — 돈 +{1}냥"),
                    DungeonLocalization.T(WorldBossPartKeys[i], WorldBossPartNames[i]), bonus);

                if (_worldBossPartBroken[0] && _worldBossPartBroken[1] && _worldBossPartBroken[2])
                {
                    int fullBonus = Mathf.RoundToInt(rewardGold * FullBreakBonusGoldMultiplier);
                    HeroState.AddGold(fullBonus);
                    msg += string.Format(DungeonLocalization.T("worldboss.full_break", "\n💥 완파! — 돈 +{0}냥 추가"), fullBonus);
                }
                DialogueLabel.Instance?.Show(msg, 3f);
            }
        }

        /// <summary>PLAN.md 101-2 5.4 "월드 보스" — 웹판 "75초가 지나면 전투가
        /// 끝나고 보상이 30%다". `Die()`와 달리 도감 등록·유품마커·장비 드랍이
        /// 없다(진짜로 못 잡은 것 — 축소 보상만 받고 자리를 뜬다).</summary>
        private void Flee()
        {
            if (_warnRing != null) _warnRing.enabled = false;
            _lordSig?.Clear();
            _state = State.Dead;
            _worldBossActive = false;
            if (ActiveWorldBoss == this) ActiveWorldBoss = null;

            int fleeExp = Mathf.RoundToInt(rewardExp * FleeRewardMultiplier);
            int fleeGold = Mathf.RoundToInt(rewardGold * FleeRewardMultiplier);
            HeroState.AddExp(fleeExp);
            HeroState.AddGold(fleeGold);

            string msg = string.Format(
                DungeonLocalization.T("worldboss.fled", "{0}이(가) 시간이 다 되어 달아났다 — 경험치 +{1} · 돈 +{2}냥(줄어든 보상)"),
                LocalizedDisplayName, fleeExp, fleeGold);
            DialogueLabel.Instance?.Show(msg, ToastSec);
            Destroy(gameObject);
        }

        private bool? _hasHitClip;
        private bool HasHitClip
        {
            get
            {
                if (_hasHitClip == null)
                {
                    bool has = false;
                    if (_animator != null && _animator.runtimeAnimatorController != null)
                        foreach (var p in _animator.parameters) if (p.name == "Hit") { has = true; break; }
                    _hasHitClip = has;
                }
                return _hasHitClip.Value;
            }
        }

        /// <summary>PLAN.md 109-10-10 움찔 0.28초 — 몸을 나에게서 먼 쪽으로 살짝 젖혔다 돌아온다(판정 없음).</summary>
        private void Flinch()
        {
            if (_flinchRoutine != null) StopCoroutine(_flinchRoutine);
            else _flinchBase = _visualGo.transform.localRotation;
            _flinchRoutine = StartCoroutine(FlinchRoutine());
        }

        private IEnumerator FlinchRoutine()
        {
            var t = _visualGo.transform;
            for (float e = 0f; e < DungeonHunt.FlinchSec; e += Time.deltaTime)
            {
                if (_state == State.Dead || t == null) break;
                t.localRotation = _flinchBase * Quaternion.Euler(-DungeonHunt.FlinchDeg * Mathf.Sin(e / DungeonHunt.FlinchSec * Mathf.PI), 0f, 0f);
                yield return null;
            }
            if (t != null) t.localRotation = _flinchBase;
            _flinchRoutine = null;
        }

        /// <summary>진단 — 움찔 중인가.</summary>
        public bool Flinching => _flinchRoutine != null;

        private IEnumerator FlashHit()
        {
            CharacterVisual.Tint(_visualGo, Color.white);
            yield return new WaitForSeconds(FlashSec);
            // ClearTint()가 아니라 bodyColor로 되돌린다 — 두목·정예처럼
            // 원래부터 색이 있는 개체는 ClearTint()가 그 색까지 지워 버린다.
            if (_visualGo != null) CharacterVisual.Tint(_visualGo, CurrentTint());
        }

        /// <summary>피격 플래시가 끝난 뒤 돌아갈 색 — 예비동작 중이면 경고색을
        /// 지켜야 "지금 피하라" 신호가 타격 한 번에 꺼지지 않는다.</summary>
        private Color CurrentTint()
        {
            if (_stunLeft > 0f) return StunColor;
            if (_state != State.Windup) return _chillLeft > 0f ? Color.Lerp(bodyColor, ChillColor, 0.55f) : bodyColor;
            return _warnHot ? WarnColor : Color.Lerp(bodyColor, WarnColor, 0.45f);
        }

        private void Die()
        {
            if (_warnRing != null) _warnRing.enabled = false;
            _lordSig?.Clear();
            _state = State.Dead;
            _worldBossActive = false;
            if (ActiveWorldBoss == this) ActiveWorldBoss = null;
            SfxPlayer.PlayEnemyDeath();

            int levelBefore = HeroState.Level;
            HeroState.AddExp(rewardExp);
            HeroState.AddGold(rewardGold);
            bool equipped = HeroState.EquipIfBetter(rewardItemId);
            var item = ItemData.Get(rewardItemId);
            bool socketed = !string.IsNullOrEmpty(rewardGemId) && HeroState.SocketIfBetter(rewardGemId);
            var gem = GemData.Get(rewardGemId);
            bool newlyDiscovered = BestiaryState.Record(displayName); // 저장 키는 원문 그대로(세이브 호환) — 표시만 아래서 옮긴다.

            string defeatedVerb = DungeonLocalization.T(isBoss ? "enemy.defeated_boss" : "enemy.defeated_normal",
                isBoss ? "을(를) 쓰러뜨렸다" : "을(를) 물리쳤다");
            string msg = string.Format(DungeonLocalization.T("enemy.defeat_msg", "{0}{1} — 경험치 +{2} · 돈 +{3}냥"),
                LocalizedDisplayName, defeatedVerb, rewardExp, rewardGold);
            if (HeroState.Level > levelBefore) msg += string.Format(DungeonLocalization.T("combat.levelup_suffix", " — 레벨업! ({0} → {1})"), levelBefore, HeroState.Level);
            if (item != null) msg += string.Format(DungeonLocalization.T(equipped ? "enemy.loot_equipped" : "enemy.loot_plain",
                equipped ? "\n{0}을(를) 주웠다 — 바로 갖췄다." : "\n{0}을(를) 주웠다."), item.Name);
            if (item != null && item.Lore != Secret.None) msg += "\n" + SecretState.LoreLine(item.Lore); // PLAN.md 109-10-2 비전
            if (gem != null) msg += string.Format(DungeonLocalization.T(socketed ? "enemy.gem_socketed" : "enemy.loot_plain",
                socketed ? "\n{0}을(를) 주웠다 — 바로 세공했다." : "\n{0}을(를) 주웠다."), gem.Name);
            if (newlyDiscovered) msg += string.Format(DungeonLocalization.T("enemy.bestiary_new", "\n📖 도감에 처음 기록됨 — {0}"), LocalizedDisplayName);
            if (deathFlag != TempleFlag.None)
            {
                TempleState.Set(deathFlag);
                msg += DungeonLocalization.T("temple.cleared", "\n🏆 잊힌 능묘를 정복했다!");
            }
            DialogueLabel.Instance?.Show(msg, ToastSec);

            // PLAN.md 101-3 F "죽음"(2026-09-17) — 보상은 이미 위에서 다
            // 줬다, 이건 그 자리에 남는 시각적 표식뿐(LootMarker.cs 클래스 주석 참고).
            LootMarker.Spawn(transform.position, LootMarker.PillarTierOf(item)); // PLAN.md 109-10 명품 이상은 빛기둥.
            AnyDied?.Invoke(this);
            // PLAN.md 101-2 5.6 "목표판·세션 카드·일일/주간"(2026-09-21) — 일일 풀의
            // "적 처치" 항목. 월드 보스(5.4)는 뽑기 확률 없이 매 세션 만난다는 보장이
            // 없어 이 풀 밖에 있다(클래스 주석 없음 — DungeonDailyTaskState 클래스 주석 참고).
            DungeonDailyTaskState.ReportProgress(DungeonDailyTaskState.Kind.EnemyKill, 1);

            if (_animator != null)
            {
                _animator.SetTrigger("Death");
                // PLAN.md 109-10-10 — 쓰러지면 나에게서 먼 쪽으로 날아가 가라앉는다(그림만, 파괴 1.2초 안에서).
                if (_flinchRoutine != null && _visualGo != null) { StopCoroutine(_flinchRoutine); _flinchRoutine = null; _visualGo.transform.localRotation = _flinchBase; }
                if (_player != null)
                    DeathFling.Begin(gameObject, _visualGo != null ? _visualGo.transform : null, _player.position,
                        DungeonHunt.ScatterForce(LastOverkill, hp, _lastHeavy), lie: !HasDeathParam());
                StartCoroutine(DestroyAfterDeathAnim());
            }
            else
            {
                Destroy(gameObject);
            }
        }

        private bool HasDeathParam()
        {
            if (_animator == null || _animator.runtimeAnimatorController == null) return false;
            foreach (var p in _animator.parameters) if (p.name == "Death") return true;
            return false;
        }

        private IEnumerator DestroyAfterDeathAnim()
        {
            yield return new WaitForSeconds(DeathAnimDelaySec);
            Destroy(gameObject);
        }
    }
}
