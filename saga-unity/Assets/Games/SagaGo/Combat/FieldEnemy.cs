using System;
using System.Collections.Generic;
using UnityEngine;
using Saga.Go.Data;
using Saga.Go.World;

namespace Saga.Go.Combat
{
    /// <summary>
    /// PLAN.md 107-1 "적" — 지도 위를 떠도는 들판 적. 배회 → 발견(24m) → 추격 → 예고(0.6s) → 판정 → 쉼.
    /// 집에서 45m 끌려 나오면 귀가하며 회복, 쓰러지면 90초 뒤 다시 선다. 물리 충돌체는 없다 —
    /// 카메라 벽 pull-in(`CameraRig`, 모든 레이어 raycast)이 적 몸에 걸리지 않게 하려고, 대신 서로·
    /// 플레이어와 거리를 코드로 벌린다. 피해 판정도 물리 쿼리 없이 <see cref="All"/> 을 거리로 훑는다.
    /// 107 ⑤ "원소 쓰는 적"(불도깨비·물귀신·번개귀)은 원소 방패를 두르고 나온다 — 방패가 있는 동안엔 체력 대신
    /// 방패만 깎이고(같은 원소 면역·물리 ×0.4·상성 ×2.5, 반응·부착 없음) 깨지면 2초 비틀거린 뒤 보통 적이 된다.
    /// 덤벼 맞히면 원소에 따라 화상·젖음·감전(`FieldCombat.ApplyFoeStatus`).
    /// 107-7 "망루 수호장"(웹 ⑪ 지역 수호자 규칙) — 방패가 **두 겹**(겉 뇌 → 속 화). 겉이 깨지면 0.8초 휘청하고 곧 속 방패가
    /// 차오르며(주인공 화 원소는 면역 — 수 원소 동료로 바꾸라는 알림), 속이 깨지면 3초 드러눕는다. 한 번 쓰러뜨리면 다시 안 선다.
    /// </summary>
    public class FieldEnemy : MonoBehaviour
    {
        public enum Kind { Bandit, Skeleton, EmberImp, DrownedGhost, StormWraith, Guardian, Hero }
        public enum State { Wander, Chase, Telegraph, Recover, Return, Dead, Stagger }

        public const float DetectRadius = 24f;
        public const int MeatPerBandit = 1; // 109-14-6
        public const float GiveUpRadius = 32f;
        public const float LeashRadius = 45f;
        public const float WanderRadius = 10f;
        public const float ChaseSpeed = 7f;
        public const float WanderSpeed = 2.2f;
        public const float ReturnSpeed = 9f;
        public const float EngageRange = 3.4f;
        public const float StrikeRadius = 4.2f;
        public const float TelegraphSec = 0.6f;
        public const float RecoverSec = 1.2f;
        public const float RespawnSec = 90f;
        public const float SeparationRadius = 2.6f;
        private const float BodyHeight = 3.4f;

        // 107-7 망루 수호장 — 웹 ⑪ 수치(체력 6.5 × 해골 병사 기본, 겹마다 방패 300×1.3, 금 150·경험 30×등급 3).
        public const float GuardianHp = 220f * 6.5f;
        public const float GuardianShield = 300f * 1.3f;
        public const float GuardianAtk = 36f;
        public const int GuardianExp = 90;
        public const int GuardianGold = 150;
        public const float GuardianDetectRadius = 18f;
        public const float GuardianOuterStaggerSec = 0.8f;
        public const float GuardianDownSec = 3f;
        public const GoElement GuardianOuter = GoElement.Electro; // 주인공(화)이 상성으로 깬다
        public const GoElement GuardianInner = GoElement.Pyro;    // 주인공은 면역 — 수 동료(또는 물리 0.4)로

        /// <summary>PLAN.md 106-9 — 등장 컷이 넓은→가까운 샷으로 자르는 순간. 플레이어를 보고 공격 클립을 포효 대신 한 번(판정 없음).</summary>
        public void PlayRoar()
        {
            var fc = FieldCombat.Instance;
            if (fc != null)
            {
                Vector3 d = Flat(fc.transform.position - transform.position);
                if (d.sqrMagnitude > 0.0001f) transform.rotation = Quaternion.LookRotation(d);
            }
            if (_animator != null) _animator.SetTrigger("Attack");
            FieldRingFx.Spawn(transform.position, 5f, GoElements.ColorOf(Element), 0.4f);
        }

        /// <summary>수호장이 처음 달려든 순간 — 등장 컷(106-9)·진단이 듣는다.</summary>
        public static event Action<FieldEnemy> GuardianEngaged;

        private static readonly List<FieldEnemy> _all = new List<FieldEnemy>();
        public static IReadOnlyList<FieldEnemy> All => _all;

        /// <summary>쓰러진 순간 — 보물 상자 "무리 전멸" 잠금(107 ④)·진단이 듣는다.</summary>
        public static event Action<FieldEnemy> Killed;

        [SerializeField] private Kind kind;
        [SerializeField] private GameObject model;

        public Kind EnemyKind => kind;
        public string DisplayName { get; private set; }
        public float MaxHp { get; private set; }
        public float Hp { get; private set; }
        public float Atk { get; private set; }
        public int ExpReward { get; private set; }
        public Vector3 Home { get; private set; }
        private Vector3 _spawnHome;
        public State CurrentState { get; private set; } = State.Wander;
        public bool Alive => CurrentState != State.Dead;
        public GoElement Aura { get; private set; }
        public float AuraLeft { get; private set; }
        public bool Charged => _chargedLeft > 0f;
        // PLAN.md 109-14-1a 새 반응이 남기는 상태 — 얼어붙음(제자리 멎음) · 서리번개(물리 ×1.4) · 싹틈(뇌·초 ×1.25) · 들불(틱 피해)
        public float FrozenLeft { get; private set; }
        public bool Frozen => FrozenLeft > 0f;
        public float SuperLeft { get; private set; }
        public float QuickenLeft { get; private set; }
        public int BurningLeft { get; private set; }
        private float _burningTick;
        private float _burningDmg;
        public string GroupId { get; private set; }
        /// <summary>PLAN.md 109-1 — 이 적이 온 시대(무리 시대). 과거면 옛 몸·옛 이름.</summary>
        public GoEra Era { get; private set; } = GoEra.Past;
        /// <summary>다른 시대 몸 이름(`GoEras.FoeBodies`), 과거면 null.</summary>
        public string EraBody { get; private set; }
        /// <summary>원소 쓰는 적의 원소(보통 적은 Physical).</summary>
        public GoElement Element { get; private set; }
        public float ShieldMax { get; private set; }
        public float ShieldHp { get; private set; }
        public bool Shielded => ShieldHp > 0f;
        public bool IsElemental => Element != GoElement.Physical;
        public bool IsGuardian => kind == Kind.Guardian;

        // ---- PLAN.md 109-6 들판 인물(웹 사가고 ⑯ 싸워서 등용) — `FieldHeroes` 가 겨루기를 열 때만 세운다 ----
        public bool IsHero => kind == Kind.Hero;
        public string HeroId { get; private set; }
        public int HeroRarity { get; private set; }
        /// <summary>체력이 0 이 되어 무릎 꿇었다(쓰러지지 않는다 — 다시 서지도 않는다).</summary>
        public bool Yielded { get; private set; }
        public static event Action<FieldEnemy> HeroYielded;
        /// <summary>끌고 멀리 가 인물이 제자리로 돌아감 — 없던 일(웹 ⑯ "34m 밖").</summary>
        public static event Action<FieldEnemy> HeroReset;

        /// <summary>인물은 제 기질로 싸운다(웹 ⑯): 무 = 넓은 내려찍기 · 지 = 떨어지는 원거리(예고 자리가 플레이어 발밑) · 덕 = 빠른 근접.</summary>
        public const float HeroMightRadius = 6.5f;
        public const float HeroMightTelegraph = 0.85f;
        public const float HeroWisdomRange = 11f;
        public const float HeroWisdomRadius = 3.4f;
        public const float HeroWisdomTelegraph = 0.9f;
        public const float HeroVirtueTelegraph = 0.4f;
        public const float HeroVirtueRecover = 0.6f;

        private GoHeroes.Hero _hero;
        private GoElement _outerElement, _innerElement;
        private RuntimeAnimatorController _controllerOverride;
        private Saga.Go.Player.PartyBodies _dresser; // 109-7 — 인물 겉모습(키·체격·꾸밈)을 입힐 곳
        private Vector3 _strikePoint;
        private bool Ranged => IsHero && _hero.Trait == HeroTrait.Wisdom;
        private bool Quick => IsHero && _hero.Trait == HeroTrait.Virtue;
        private float TelegraphTime => _telegraphOverride > 0f ? _telegraphOverride : !IsHero ? TelegraphSec : Ranged ? HeroWisdomTelegraph : Quick ? HeroVirtueTelegraph : HeroMightTelegraph;
        /// <summary>진단용 — 지금 인물의 예고 반경.</summary>
        public float StrikeReach => _reachOverride > 0f ? _reachOverride : !IsHero ? StrikeRadius : Ranged ? HeroWisdomRadius : Quick ? StrikeRadius : HeroMightRadius;
        private float RecoverTime => (_recoverOverride > 0f ? _recoverOverride : Quick ? HeroVirtueRecover : RecoverSec) * CdMul;
        private float EngageReach => _reachOverride > 0f ? _reachOverride * 0.8f : Ranged ? HeroWisdomRange : EngageRange;

        // ---- 109-14-9 숨은 터 적·주간 보스 — 천하 등급·경험·전리품·일과가 없고 다시 서지 않으며, 원판 안에선 끝까지 쫓는다 ----
        public bool DomainFoe { get; private set; }
        /// <summary>109-14-12 이야기 임무 적(`sq:` 무리) — 경험·전리품·일과 없고 다시 안 선다(쫓기는 건 여느 들판 적처럼).</summary>
        public bool StoryFoe { get; private set; }
        public void MarkStory() => StoryFoe = true;
        public bool IsWeeklyBoss { get; private set; }
        /// <summary>공격 간격 배율(주간 보스 2단계 ×0.69).</summary>
        public float CdMul { get; set; } = 1f;
        private float _reachOverride = -1f, _telegraphOverride = -1f, _recoverOverride = -1f;

        /// <summary>숨은 터 적으로 — 천하 0 · 단계 배율(체력·방패 × hpMul, 공격 × atkMul).</summary>
        public void ApplyDomain(float hpMul, float atkMul)
        {
            DomainFoe = true;
            ApplyWorld(0);
            MaxHp *= hpMul; Hp = MaxHp;
            ShieldMax *= hpMul; ShieldHp = ShieldMax;
            Atk *= atkMul;
        }

        /// <summary>먹구름 이무기 — 해골 몸을 크게, 체력·공격·내리치기·예고·간격을 보스 값으로(방패 없이 시작).</summary>
        public void MakeWeeklyBoss()
        {
            IsWeeklyBoss = true;
            DisplayName = GoLocalization.T("domain.boss", "먹구름 이무기");
            if (_nameText != null) _nameText.text = DisplayName;
            WorldLevel = 0; // 값을 새로 박으니 천하 배율은 없던 것으로
            MaxHp = GoDomain.BossHp; Hp = MaxHp;
            Atk = GoDomain.BossAtk;
            ShieldMax = 0f; ShieldHp = 0f; ShieldLayers = 0;
            _reachOverride = GoDomain.BossReach;
            _telegraphOverride = GoDomain.BossTelegraph;
            _recoverOverride = GoDomain.BossRecover;
            transform.localScale = Vector3.one * GoDomain.BossScale;
            RefreshElementFx();
        }

        /// <summary>주간 보스 2단계 — 그 원소 방패를 두른다.</summary>
        public void RaiseBossShield(GoElement el, float amount)
        {
            Element = el;
            ShieldMax = ShieldHp = amount;
            ShieldLayers = 1;
            RefreshElementFx();
            RefreshHeadUi();
        }

        /// <summary>곧장 쫓는다(숨은 터 파도).</summary>
        public void ForceChase() { if (Alive) EnterChase(); }

        /// <summary>109-14-11 소용돌이 — 가운데 쪽으로 step 만큼 끈다(수호장은 안 끌린다).</summary>
        public void PullToward(Vector3 center, float step)
        {
            if (!Alive || IsGuardian || IsWeeklyBoss) return;
            Vector3 d = Flat(center - transform.position);
            float m = d.magnitude;
            if (m < 0.5f) return;
            transform.position = Grounded(transform.position + d / m * Mathf.Min(step, m - 0.5f));
        }

        /// <summary>원소를 띠게 한다(무덤 터 기운) — 얼어 있으면 안 건드린다.</summary>
        public void SoakAura(GoElement el, float sec)
        {
            if (!Alive || Frozen) return;
            Aura = el;
            AuraLeft = sec;
        }
        /// <summary>두 겹 방패 — 수호장과 ★5 인물.</summary>
        private bool TwoLayered => IsGuardian || (IsHero && HeroRarity >= 5);
        private GoElement OuterElement => IsGuardian ? GuardianOuter : _outerElement;
        private GoElement InnerElement => IsGuardian ? GuardianInner : _innerElement;
        public Vector3 StrikePoint => Ranged ? _strikePoint : transform.position;
        /// <summary>남은 방패 겹(수호장 2→1→0, 원소 적 1→0, 보통 적 0).</summary>
        public int ShieldLayers { get; private set; }
        public bool Engaged { get; private set; }
        public float BodyTop => BodyHeight * HeightFactor();

        private Transform _visual;
        private Animator _animator;
        private float _timer;
        private Vector3 _wanderTarget;
        private float _chargedLeft;
        private float _chargedTick;
        private float _chargedAtk;
        private GoElement _elementOverride;
        private Vector3 _knock;
        private bool _tinted;

        private Transform _headUi;
        private TMPro.TextMeshPro _nameText;
        private TMPro.TextMeshPro _alertText;
        private Transform _hpFill;
        private Renderer _auraDot;
        private LineRenderer _warnRing;
        private MaterialPropertyBlock _block;
        private Transform _shieldFill;
        private GameObject _shieldBar;
        private GameObject _shieldBubble;
        private Transform _orbit;
        private Light _elementLight;
        private Material _bubbleMat;
        private Material _orbMat;
        private Renderer _shieldFillRenderer;

        public static FieldEnemy Spawn(Kind kind, Vector3 home, GameObject model, string groupId, Transform parent)
            => Spawn(kind, home, model, groupId, parent, GoEra.Past, null);

        /// <summary>PLAN.md 109-1 — 다른 시대 무리의 적. 종류(체력·원소·방패)는 그대로, 몸(`eraBody`)·이름만 그 시대 것.</summary>
        public static FieldEnemy Spawn(Kind kind, Vector3 home, GameObject model, string groupId, Transform parent, GoEra era, string eraBody,
            GoElement elementOverride = GoElement.Physical)
        {
            var go = new GameObject($"FieldEnemy_{kind}");
            go.transform.SetParent(parent, false);
            var e = go.AddComponent<FieldEnemy>();
            e.kind = kind;
            e._elementOverride = elementOverride;
            e.model = model;
            e.GroupId = groupId;
            e.Era = era;
            e.EraBody = era == GoEra.Past ? null : eraBody;
            e.Home = home;
            e._spawnHome = home;
            e.Setup();
            if (kind == Kind.Guardian) GuardianInstance = e; // 109-14-10 꺼져 있어도 다시 세울 수 있게
            return e;
        }

        /// <summary>109-14-10 망루 수호장(꺼져 있어도 — `All` 은 켜진 적만).</summary>
        public static FieldEnemy GuardianInstance { get; private set; }

        /// <summary>109-6 — 들판 인물 하나를 겨루기 상대로 세운다(몸은 동행이 됐을 때와 같은 몸, 컨트롤러는 Maria 것 리타깃).</summary>
        public static FieldEnemy SpawnHero(GoHeroes.Hero hero, Vector3 home, GameObject model, RuntimeAnimatorController controller, Transform parent,
            Saga.Go.Player.PartyBodies dresser = null)
        {
            var go = new GameObject($"FieldHero_{hero.Id}");
            go.transform.SetParent(parent, false);
            var e = go.AddComponent<FieldEnemy>();
            e.kind = Kind.Hero;
            e.model = model;
            e._hero = hero;
            e.HeroId = hero.Id;
            e.HeroRarity = hero.Rarity;
            e._controllerOverride = controller;
            e._dresser = dresser;
            e.GroupId = "hero_" + hero.Id;
            e.Home = home;
            e._spawnHome = home;
            e.Setup();
            return e;
        }

        /// <summary>종류 이름(머리 위 이름표·108 지역 몬스터 명단이 같이 쓴다).</summary>
        public static string KindName(Kind k)
        {
            switch (k)
            {
                case Kind.Bandit: return GoLocalization.T("field.foe.bandit", "산적");
                case Kind.EmberImp: return GoLocalization.T("field.foe.imp", "불도깨비");
                case Kind.DrownedGhost: return GoLocalization.T("field.foe.ghost", "물귀신");
                case Kind.StormWraith: return GoLocalization.T("field.foe.wraith", "번개귀");
                case Kind.Guardian: return GoLocalization.T("field.foe.guardian", "망루 수호장");
                case Kind.Hero: return GoLocalization.T("field.foe.hero", "들판 인물");
                default: return GoLocalization.T("field.foe.skeleton", "해골 병사");
            }
        }

        /// <summary>108 — 선 지역 위험도(1~3). `FieldSpawner` 가 세운 직후 `ApplyDanger` 로 정한다.</summary>
        public int Danger { get; private set; } = 1;

        /// <summary>108 — 지역 위험도 배율을 체력·공격·방패·경험치에 곱한다. 수호장은 자기 표 그대로(107-7).</summary>
        public void ApplyDanger(int danger)
        {
            if (IsGuardian) return;
            Danger = Mathf.Clamp(danger, 1, GoWorldMap.MaxDanger);
            float m = GoWorldMap.DangerMul(Danger);
            MaxHp *= m; Hp = MaxHp;
            Atk *= m;
            ShieldMax *= m; ShieldHp = ShieldMax;
            ExpReward = Mathf.RoundToInt(ExpReward * m);
        }

        private void Setup()
        {
            switch (kind)
            {
                case Kind.Bandit:
                    DisplayName = KindName(kind);
                    MaxHp = 320f; Atk = 26f; ExpReward = 15;
                    break;
                case Kind.EmberImp:
                    DisplayName = KindName(kind);
                    MaxHp = 260f; Atk = 24f; ExpReward = 20; Element = GoElement.Pyro; ShieldMax = 150f;
                    break;
                case Kind.DrownedGhost:
                    DisplayName = KindName(kind);
                    MaxHp = 300f; Atk = 22f; ExpReward = 20; Element = GoElement.Hydro; ShieldMax = 180f;
                    break;
                case Kind.StormWraith:
                    DisplayName = KindName(kind);
                    MaxHp = 230f; Atk = 28f; ExpReward = 20; Element = GoElement.Electro; ShieldMax = 130f;
                    break;
                case Kind.Guardian:
                    DisplayName = KindName(kind);
                    MaxHp = GuardianHp; Atk = GuardianAtk; ExpReward = GuardianExp; Element = GuardianOuter; ShieldMax = GuardianShield;
                    break;
                case Kind.Hero:
                    DisplayName = GoHeroes.Label(_hero);
                    MaxHp = GoHeroes.MaxHp(HeroRarity); Atk = GoHeroes.Atk(HeroRarity); ExpReward = GoHeroes.ExpPerRarity * HeroRarity;
                    Element = _outerElement = GoHeroes.ElementOf(_hero);
                    _innerElement = GoHeroes.InnerOf(_outerElement);
                    ShieldMax = GoHeroes.ShieldLayers(HeroRarity) > 0 ? GoHeroes.ShieldPerLayer * (HeroRarity - 2) : 0f;
                    break;
                default:
                    DisplayName = KindName(kind);
                    MaxHp = 220f; Atk = 20f; ExpReward = 10;
                    break;
            }
            if (_elementOverride != GoElement.Physical && IsElemental)
            {
                // 109-14-1a — 새 원소(풍·빙·암·초) 인물의 졸개는 옛 원소 적 몸에 그 원소 방패(제 괴물은 14-1b)
                Element = _elementOverride;
                DisplayName = GoLocalization.T("field.minion." + Element.ToString().ToLowerInvariant(), GoElements.NameOf(Element) + " 졸개");
            }
            if (EraBody != null) DisplayName = GoEras.FoeName(EraBody, Element);
            Hp = MaxHp;
            ShieldHp = ShieldMax;
            ShieldLayers = TwoLayered ? 2 : ShieldMax > 0f ? 1 : 0;
            WorldLevel = 0;
            ApplyWorld(AdventureState.WorldLevel); // 109-14-7 천하 등급
            transform.position = Grounded(Home);
            _wanderTarget = Home;
            _timer = UnityEngine.Random.Range(0.5f, 3f);
            BuildVisual();
            BuildHeadUi();
            BuildWarnRing();
            if (IsElemental) BuildElementFx();
        }

        private void OnEnable() { if (!_all.Contains(this)) _all.Add(this); }

        // ---- 109-14-7 천하 등급 — 체력·방패 ×(1 + 0.35w) · 공격 ×(1 + 0.22w), 지역 위험 배율에 곱한다 ----
        public int WorldLevel { get; private set; }

        static FieldEnemy() { AdventureState.WorldChanged += (from, to) => RescaleAll(); }

        /// <summary>천하 등급 w 로 다시 잰다(지금 몫에서 비율로 — 남은 체력 비율은 그대로).</summary>
        public void ApplyWorld(int w)
        {
            w = GoAdventure.Clamp(w);
            if (w == WorldLevel) return;
            float kh = GoAdventure.HpMul(w) / GoAdventure.HpMul(WorldLevel), ka = GoAdventure.AtkMul(w) / GoAdventure.AtkMul(WorldLevel);
            MaxHp *= kh; Hp *= kh;
            ShieldMax *= kh; ShieldHp *= kh;
            Atk *= ka;
            WorldLevel = w;
        }

        public static void RescaleAll()
        {
            int w = AdventureState.WorldLevel;
            foreach (var e in _all.ToArray()) if (e != null && !e.DomainFoe) e.ApplyWorld(w); // 109-14-9 숨은 터 적은 천하 등급을 안 받는다
        }

        /// <summary>수호장 금 — 천하 등급 전리품 배율.</summary>
        public int GuardianGoldNow => Mathf.RoundToInt(GuardianGold * GoAdventure.LootMul(WorldLevel));
        private void OnDisable() => _all.Remove(this);

        // ---- 모양 -------------------------------------------------------------

        private void BuildVisual()
        {
            if (model != null)
            {
                var inst = Instantiate(model, transform);
                inst.name = "Visual";
                inst.transform.localPosition = Vector3.zero;
                inst.transform.localRotation = Quaternion.identity;
                float h = MeasureHeight(inst);
                if (h > 0.01f) inst.transform.localScale = Vector3.one * (BodyHeight * HeightFactor() / h);
                _animator = inst.GetComponentInChildren<Animator>();
                if (_animator != null) _animator.applyRootMotion = false;
                if (IsHero)
                {
                    if (_dresser != null) _dresser.Dress(inst, HeroId, BodyHeight * HeightFactor()); // 109-7 선 인물·동행과 같은 겉모습
                    foreach (var col in inst.GetComponentsInChildren<Collider>()) Destroy(col); // 동행 몸 프리팹 — 제 충돌은 뺀다(PartyBodies 와 같은 결)
                    if (_animator != null && _animator.isHuman && _controllerOverride != null) _animator.runtimeAnimatorController = _controllerOverride;
                }
                _visual = inst.transform;
                if (BaseTint(out Color tint)) CharacterVisual.Tint(inst, tint);
            }
            else
            {
                _visual = CharacterVisual.SpawnFallbackCapsule(transform,
                    kind == Kind.Bandit ? new Color(0.5f, 0.2f, 0.15f) : BaseTint(out Color t) ? t : new Color(0.85f, 0.85f, 0.8f));
            }
        }

        private float HeightFactor()
        {
            switch (kind)
            {
                case Kind.Skeleton: return 1.05f;
                case Kind.EmberImp: return 0.85f;
                case Kind.DrownedGhost: return 1.15f;
                case Kind.Guardian: return 1.6f;
                default: return 1f;
            }
        }

        /// <summary>몸에 늘 입히는 빛깔 — 해골은 바랜 흰빛, 원소 쓰는 적은 원소 빛(산적은 없음).</summary>
        private bool BaseTint(out Color c)
        {
            if (kind == Kind.Skeleton && EraBody == null) { c = new Color(0.88f, 0.9f, 0.96f); return true; } // 바랜 뼈빛은 옛 해골 몸에만
            if (IsHero) { c = Color.Lerp(Color.white, GoElements.ColorOf(Element), 0.15f); return true; } // 109-6 — 제 몸은 그대로, 원소만 옅게
            // 수호장 — 전용 몸(Maw, 2026-09-24)의 제 빛깔 위에 지금 겹의 원소가 은은히 밴다(옛 Brute 몸 때의 돌빛은 뺐다).
            if (IsGuardian) { c = Color.Lerp(Color.white, GoElements.ColorOf(Element), 0.3f); return true; }
            if (IsElemental) { c = Color.Lerp(new Color(0.35f, 0.33f, 0.32f), GoElements.ColorOf(Element), 0.75f); return true; }
            c = Color.white;
            return false;
        }

        /// <summary>107 ⑤ — 방패 거품(반투명)·몸 둘레를 도는 원소 구슬 셋·원소 빛. 몸(`_visual`) 밖에 붙여 빛깔 입히기와 섞이지 않게.</summary>
        private void BuildElementFx()
        {
            Color c = GoElements.ColorOf(Element);
            float h = BodyHeight * HeightFactor();
            _shieldBubble = GameObject.CreatePrimitive(PrimitiveType.Sphere);
            _shieldBubble.name = "ShieldBubble";
            Destroy(_shieldBubble.GetComponent<Collider>());
            _shieldBubble.transform.SetParent(transform, false);
            _shieldBubble.transform.localPosition = new Vector3(0f, h * 0.5f, 0f);
            _shieldBubble.transform.localScale = new Vector3(2.8f, h * 1.15f, 2.8f);
            var bubbleMat = new Material(Shader.Find("Sprites/Default")) { name = "ShieldBubble (generated)" };
            bubbleMat.color = new Color(c.r, c.g, c.b, 0.22f);
            _bubbleMat = bubbleMat;
            if (IsGuardian) _shieldBubble.transform.localScale = new Vector3(4.2f, h * 1.15f, 4.2f);
            var br = _shieldBubble.GetComponent<MeshRenderer>();
            br.sharedMaterial = bubbleMat;
            br.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
            br.receiveShadows = false;

            _orbit = new GameObject("ElementOrbit").transform;
            _orbit.SetParent(transform, false);
            _orbit.localPosition = new Vector3(0f, h * 0.6f, 0f);
            var orbMat = new Material(Shader.Find("Universal Render Pipeline/Lit")) { name = "ElementOrb (generated)" };
            orbMat.color = c;
            orbMat.EnableKeyword("_EMISSION");
            orbMat.SetColor("_EmissionColor", c * 2.5f);
            _orbMat = orbMat;
            for (int i = 0; i < 3; i++)
            {
                var orb = GameObject.CreatePrimitive(PrimitiveType.Sphere);
                orb.name = "Orb";
                Destroy(orb.GetComponent<Collider>());
                orb.transform.SetParent(_orbit, false);
                float a = i * Mathf.PI * 2f / 3f;
                float orbR = IsGuardian ? 2.6f : 1.6f;
                orb.transform.localPosition = new Vector3(Mathf.Cos(a) * orbR, (i - 1) * 0.35f, Mathf.Sin(a) * orbR);
                orb.transform.localScale = Vector3.one * 0.35f;
                orb.GetComponent<MeshRenderer>().sharedMaterial = orbMat;
            }
            var lightGo = new GameObject("ElementLight");
            lightGo.transform.SetParent(_orbit, false);
            _elementLight = lightGo.AddComponent<Light>();
            _elementLight.type = LightType.Point;
            _elementLight.color = c;
            _elementLight.range = 7f;
            _elementLight.intensity = 1.6f;
            RefreshElementFx();
        }

        private void RefreshElementFx()
        {
            if (!IsElemental || _orbit == null) return;
            _shieldBubble.SetActive(Alive && Shielded);
            _orbit.gameObject.SetActive(Alive);
            _elementLight.intensity = Shielded ? 1.6f : 0.7f;
        }

        private static float MeasureHeight(GameObject go)
        {
            var renderers = go.GetComponentsInChildren<Renderer>();
            if (renderers.Length == 0) return 0f;
            var b = renderers[0].bounds;
            foreach (var r in renderers) b.Encapsulate(r.bounds);
            return b.size.y;
        }

        private void BuildHeadUi()
        {
            _block = new MaterialPropertyBlock();
            var head = new GameObject("HeadUI");
            head.transform.SetParent(transform, false);
            head.transform.localPosition = new Vector3(0f, BodyHeight * (IsGuardian ? HeightFactor() : 1f) + 0.9f, 0f);
            _headUi = head.transform;

            _nameText = NewText(_headUi, DisplayName, new Vector3(0f, 0.45f, 0f), 0.035f, Color.white);
            _alertText = NewText(_headUi, "!", new Vector3(0f, 1.2f, 0f), 0.09f, new Color(1f, 0.35f, 0.2f));
            _alertText.gameObject.SetActive(false);

            NewQuad(_headUi, "HpBack", new Vector3(0f, 0f, 0.01f), new Vector3(2.0f, 0.22f, 1f), new Color(0f, 0f, 0f, 0.6f));
            var fillPivot = new GameObject("HpFillPivot").transform;
            fillPivot.SetParent(_headUi, false);
            fillPivot.localPosition = new Vector3(-0.97f, 0f, 0f);
            var fill = NewQuad(fillPivot, "HpFill", new Vector3(0.5f, 0f, 0f), Vector3.one, new Color(0.9f, 0.25f, 0.2f));
            fill.localScale = Vector3.one;
            fillPivot.localScale = new Vector3(1.94f, 0.16f, 1f);
            _hpFill = fillPivot;
            _auraDot = NewQuad(_headUi, "AuraDot", new Vector3(-1.3f, 0f, 0f), new Vector3(0.3f, 0.3f, 1f), Color.clear).GetComponent<Renderer>();
            _auraDot.enabled = false;
            if (IsElemental) _nameText.color = Color.Lerp(Color.white, GoElements.ColorOf(Element), 0.6f);
            if (ShieldMax > 0f)
            {
                // 방패 막대 — 체력 막대 바로 위, 원소 빛깔
                _shieldBar = new GameObject("ShieldBar");
                _shieldBar.transform.SetParent(_headUi, false);
                _shieldBar.transform.localPosition = new Vector3(0f, 0.2f, 0f);
                NewQuad(_shieldBar.transform, "ShieldBack", new Vector3(0f, 0f, 0.01f), new Vector3(2.0f, 0.14f, 1f), new Color(0f, 0f, 0f, 0.6f));
                var sp = new GameObject("ShieldFillPivot").transform;
                sp.SetParent(_shieldBar.transform, false);
                sp.localPosition = new Vector3(-0.97f, 0f, 0f);
                _shieldFillRenderer = NewQuad(sp, "ShieldFill", new Vector3(0.5f, 0f, 0f), Vector3.one, GoElements.ColorOf(Element)).GetComponent<Renderer>();
                sp.localScale = new Vector3(1.94f, 0.1f, 1f);
                _shieldFill = sp;
            }
        }

        private static TMPro.TextMeshPro NewText(Transform parent, string text, Vector3 local, float size, Color color)
        {
            var go = new GameObject("Text");
            go.transform.SetParent(parent, false);
            go.transform.localPosition = local;
            var t = Saga.Core.SagaWorldText.Add(go, text, 64f * size, color);
            return t;
        }

        private static Material _unlitMat;

        private static Transform NewQuad(Transform parent, string name, Vector3 local, Vector3 scale, Color color)
        {
            var q = GameObject.CreatePrimitive(PrimitiveType.Quad);
            q.name = name;
            var col = q.GetComponent<Collider>();
            if (Application.isPlaying) Destroy(col); else DestroyImmediate(col);
            q.transform.SetParent(parent, false);
            q.transform.localPosition = local;
            q.transform.localScale = scale;
            if (_unlitMat == null) _unlitMat = new Material(Shader.Find("Sprites/Default")) { name = "FieldEnemyUi (generated)" };
            var r = q.GetComponent<MeshRenderer>();
            r.sharedMaterial = _unlitMat;
            r.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
            r.receiveShadows = false;
            var block = new MaterialPropertyBlock();
            block.SetColor("_Color", color);
            r.SetPropertyBlock(block);
            return q.transform;
        }

        private void BuildWarnRing()
        {
            var go = new GameObject("WarnRing");
            go.transform.SetParent(transform, false);
            go.transform.localPosition = new Vector3(0f, 0.15f, 0f);
            _warnRing = go.AddComponent<LineRenderer>();
            _warnRing.useWorldSpace = false;
            _warnRing.loop = true;
            _warnRing.positionCount = 40;
            _warnRing.widthMultiplier = 0.18f;
            _warnRing.material = _unlitMat != null ? _unlitMat : new Material(Shader.Find("Sprites/Default"));
            _warnRing.startColor = _warnRing.endColor = new Color(1f, 0.3f, 0.15f, 0.85f);
            _warnRing.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
            _warnRing.enabled = false;
        }

        private void SetRingRadius(float r)
        {
            for (int i = 0; i < _warnRing.positionCount; i++)
            {
                float a = i * Mathf.PI * 2f / _warnRing.positionCount;
                _warnRing.SetPosition(i, new Vector3(Mathf.Cos(a) * r, 0f, Mathf.Sin(a) * r));
            }
        }

        // ---- 흐름 -------------------------------------------------------------

        private void Update() => Tick(Time.deltaTime);

        private void EnterChase()
        {
            CurrentState = State.Chase;
            if (!(IsGuardian || IsHero) || Engaged) return;
            Engaged = true;
            if (IsGuardian) GuardianEngaged?.Invoke(this);
        }

        /// <summary>109-6 — `FieldHeroes` 가 겨루기를 연다(바로 달려든다).</summary>
        public void Challenge() => EnterChase();

        /// <summary>한 틱 — 진단이 시간을 건너뛰려고 직접 부른다.</summary>
        public void Tick(float dt)
        {
            TickStatus(dt);
            if (IsGuardian && !GuardianState.Standing && Alive)
            {
                gameObject.SetActive(false); // 세이브에서 이미 쓰러뜨린 수호장 — 꽃을 받고 150초가 지나기 전엔 안 선다(109-14-10 `GuardianBloom` 이 다시 세운다).
                return;
            }
            if (CurrentState == State.Dead)
            {
                _timer -= dt;
                if (_timer <= 0f) Revive();
                return;
            }
            if (DuelGate.Active || Saga.Go.Cinematics.GoCutscenes.Playing || StoryState.Talking) { SetMoveAnim(0f); return; } // 106-9 — 등장 컷 동안도 선다. 109-14-12 이야기 대화 중도
            if (Frozen) { SetMoveAnim(0f); return; } // 109-14-1a 얼어붙음 — 제자리에 멎는다(시간은 TickStatus 가 줄인다)

            var fc = FieldCombat.Instance;
            bool playerOk = fc != null && fc.CanBeTargeted;
            Vector3 toPlayer = playerOk ? Flat(fc.transform.position - transform.position) : Vector3.zero;
            float distPlayer = playerOk ? toPlayer.magnitude : float.MaxValue;

            if (_knock.sqrMagnitude > 0.01f)
            {
                MoveBy(_knock * dt);
                _knock = Vector3.Lerp(_knock, Vector3.zero, 8f * dt);
            }

            switch (CurrentState)
            {
                case State.Wander:
                    if (IsHero) { SetMoveAnim(0f); if (playerOk) Face(toPlayer); break; } // 109-6 — 인물은 겨루기가 열려야 움직인다
                    if (DomainFoe || distPlayer < (IsGuardian ? GuardianDetectRadius : DetectRadius)) { EnterChase(); break; }
                    _timer -= dt;
                    if (_timer <= 0f)
                    {
                        Vector2 c = UnityEngine.Random.insideUnitCircle * WanderRadius;
                        _wanderTarget = Home + new Vector3(c.x, 0f, c.y);
                        _timer = UnityEngine.Random.Range(3f, 6f);
                    }
                    MoveToward(_wanderTarget, WanderSpeed, dt, 0.5f);
                    break;

                case State.Chase:
                    if (!DomainFoe && (!playerOk || distPlayer > GiveUpRadius || Flat(transform.position - Home).magnitude > LeashRadius))
                    {
                        CurrentState = State.Return;
                        break;
                    }
                    if (distPlayer <= EngageReach)
                    {
                        BeginTelegraph();
                        break;
                    }
                    MoveToward(fc.transform.position, ChaseSpeed, dt, EngageReach * 0.9f);
                    break;

                case State.Telegraph:
                    SetMoveAnim(0f);
                    if (playerOk) Face(toPlayer);
                    _timer -= dt;
                    float p = 1f - Mathf.Clamp01(_timer / TelegraphTime);
                    SetRingRadius(Mathf.Lerp(0.6f, StrikeReach, p));
                    TintVisual(Color.Lerp(Color.white, new Color(1f, 0.35f, 0.3f), p), true);
                    if (_timer <= 0f) ResolveStrike();
                    break;

                case State.Recover:
                    SetMoveAnim(0f);
                    _timer -= dt;
                    if (_timer <= 0f) CurrentState = DomainFoe || (playerOk && distPlayer < GiveUpRadius) ? State.Chase : State.Return;
                    break;

                case State.Stagger:
                    SetMoveAnim(0f);
                    _timer -= dt;
                    if (_timer <= 0f) CurrentState = DomainFoe || (playerOk && distPlayer < GiveUpRadius) ? State.Chase : State.Return;
                    break;

                case State.Return:
                    if (MoveToward(Home, ReturnSpeed, dt, 1f))
                    {
                        Hp = MaxHp;
                        ResetShields();
                        CurrentState = State.Wander;
                        _timer = 1f;
                        if (IsHero)
                        {
                            Engaged = false;
                            HeroReset?.Invoke(this);
                        }
                    }
                    break;
            }
            RefreshHeadUi();
        }

        private void BeginTelegraph()
        {
            CurrentState = State.Telegraph;
            _timer = TelegraphTime;
            _alertText.gameObject.SetActive(true);
            _warnRing.enabled = true;
            SetRingRadius(0.6f);
            // 109-6 지(智) 인물 — 떨어지는 원거리: 예고 원이 시작 순간 플레이어 발밑에 선다.
            var fc = FieldCombat.Instance;
            _strikePoint = fc != null ? fc.transform.position : transform.position;
            if (Ranged) _warnRing.transform.position = new Vector3(_strikePoint.x, Grounded(_strikePoint).y + 0.15f, _strikePoint.z);
            else _warnRing.transform.localPosition = new Vector3(0f, 0.15f, 0f);
        }

        /// <summary>예고 끝 판정 — 그 순간 반경 안이면 맞는다(회피 무적이면 `FieldCombat` 이 흘린다).</summary>
        public void ResolveStrike()
        {
            _alertText.gameObject.SetActive(false);
            _warnRing.enabled = false;
            TintVisual(Color.white, false);
            if (_animator != null) _animator.SetTrigger("Attack");
            var fc = FieldCombat.Instance;
            if (fc != null && fc.CanBeTargeted && Flat(fc.transform.position - StrikePoint).magnitude <= StrikeReach)
            {
                fc.ReceiveStrike(Atk, this);
            }
            CurrentState = State.Recover;
            _timer = RecoverTime;
            _warnRing.transform.localPosition = new Vector3(0f, 0.15f, 0f);
        }

        private void TickStatus(float dt)
        {
            if (AuraLeft > 0f)
            {
                AuraLeft -= dt;
                if (AuraLeft <= 0f) Aura = GoElement.Physical;
            }
            if (FrozenLeft > 0f)
            {
                FrozenLeft -= dt;
                if (FrozenLeft <= 0f) { FrozenLeft = 0f; TintVisual(Color.white, false); }
            }
            if (SuperLeft > 0f) SuperLeft = Mathf.Max(0f, SuperLeft - dt);
            if (QuickenLeft > 0f) QuickenLeft = Mathf.Max(0f, QuickenLeft - dt);
            if (BurningLeft > 0 && Alive)
            {
                _burningTick -= dt;
                while (_burningTick <= 0f && BurningLeft > 0 && Alive)
                {
                    _burningTick += GoElements.BurningTickSec;
                    BurningLeft--;
                    ApplyDamage(_burningDmg, GoElements.ColorOf(GoReaction.Burning), 0.8f);
                }
            }
            if (_chargedLeft > 0f && Alive)
            {
                _chargedLeft -= dt;
                _chargedTick -= dt;
                if (_chargedTick <= 0f)
                {
                    _chargedTick += GoElements.ChargedTickSec;
                    ApplyDamage(_chargedAtk, GoElements.ColorOf(GoReaction.ElectroCharged), 0.8f);
                }
            }
        }

        // ---- 피해 -------------------------------------------------------------

        /// <summary>플레이어 공격 한 번. 반응을 풀고 실제로 들어간 피해를 돌려준다.
        /// <paramref name="atk"/> 는 반응 피해를 셀 공격력. <paramref name="heavy"/> = 기본 공격 3타째(얼어붙은 적을 깨뜨린다, 109-14-1a).</summary>
        public float TakeHit(float amount, GoElement element, float atk, out GoReaction reaction, bool heavy = false, bool crit = false)
        {
            reaction = GoReaction.None;
            if (!Alive) return 0f;
            if (Shielded) return HitShield(amount, element);

            GoElement from = GoElement.Physical; // 반응 전에 붙어 있던 원소(회오리가 옮겨 붙인다)
            if (element == GoElement.Physical && SuperLeft > 0f) amount *= GoElements.SuperPhysMul; // 서리번개 뒤 물리
            if (Frozen && (element == GoElement.Geo || heavy))
            {
                // 깨뜨림 — 얼어 멈춘 적을 암이나 3타째로 치면 크게 들어가고 풀린다
                reaction = GoReaction.Shatter;
                amount *= GoElements.ShatterMul;
                FrozenLeft = 0f;
                TintVisual(Color.white, false);
            }
            else if (QuickenLeft > 0f && (element == GoElement.Electro || element == GoElement.Dendro))
            {
                // 싹틈 상태 — 뇌는 번개싹, 초는 덩굴뻗음(붙은 원소는 안 건드린다)
                reaction = element == GoElement.Electro ? GoReaction.Aggravate : GoReaction.Spread;
                amount *= GoElements.QuickenMul;
            }
            else if (element != GoElement.Physical)
            {
                reaction = AuraLeft > 0f ? GoElements.Resolve(Aura, element) : GoReaction.None;
                if (reaction == GoReaction.None)
                {
                    if (GoElements.Attaches(element))
                    {
                        Aura = element;
                        AuraLeft = GoElements.AuraSec;
                    }
                }
                else
                {
                    from = Aura;
                    Aura = GoElement.Physical;
                    AuraLeft = 0f;
                }
            }

            // 109-14-5b 보패 4 세트 — 대장간 불씨(물안개·녹임·터짐·들불)·솔바람 피리(회오리)
            float setRx = reaction != GoReaction.None && FieldCombat.Instance != null ? FieldCombat.Instance.SetReactMul(reaction) : 1f;
            if (reaction == GoReaction.Vaporize) amount *= GoElements.VaporizeMul * setRx;
            if (reaction == GoReaction.Melt) amount *= GoElements.MeltMul * setRx;

            if (reaction != GoReaction.None)
            {
                DailyTaskState.ReportProgress(DailyTaskState.Kind.Reaction, 1); // 109-14-8 일일 의뢰 — 원소 반응
                FieldDamageText.Spawn(transform.position + Vector3.up * (BodyHeight + 1.8f),
                    GoElements.NameOf(reaction), GoElements.ColorOf(reaction), 1.3f);
            }

            // 109-14-5a 치명타는 굵고 크게(금빛)
            float dealt = ApplyDamage(amount, crit ? new Color(1f, 0.82f, 0.3f) : element == GoElement.Physical ? Color.white : GoElements.ColorOf(element), crit ? 1.45f : 1f);

            if (reaction == GoReaction.Overload)
            {
                // 과부하 — 둘레 적 전부(자기 포함 이미 맞은 몫과 별도로 광역 몫)·밀침.
                float blast = atk * GoElements.OverloadAtkMul * setRx;
                foreach (var other in _all.ToArray())
                {
                    if (!other.Alive) continue;
                    Vector3 d = Flat(other.transform.position - transform.position);
                    if (d.magnitude > GoElements.OverloadRadius) continue;
                    other.ApplyDamage(blast, GoElements.ColorOf(GoReaction.Overload), 1f);
                    other._knock = (d.sqrMagnitude > 0.01f ? d.normalized : -transform.forward) * GoElements.OverloadKnockback;
                    other.Aggro();
                }
            }
            else if (reaction == GoReaction.ElectroCharged)
            {
                StartCharged(atk);
                foreach (var other in _all)
                {
                    if (other == this || !other.Alive || other.Aura != GoElement.Hydro || other.AuraLeft <= 0f) continue;
                    if (Flat(other.transform.position - transform.position).magnitude > GoElements.ChargedSpreadRadius) continue;
                    other.Aura = GoElement.Physical;
                    other.AuraLeft = 0f;
                    other.StartCharged(atk);
                }
            }
            else if (reaction == GoReaction.Frozen)
            {
                if (Alive) Freeze();
            }
            else if (reaction == GoReaction.Superconduct)
            {
                // 서리번개 — 둘레 적(자기 포함) 광역 ×0.5 + 8초 동안 물리 ×1.4
                foreach (var other in _all.ToArray())
                {
                    if (!other.Alive || Flat(other.transform.position - transform.position).magnitude > GoElements.SuperRadius) continue;
                    other.SuperLeft = GoElements.SuperSec;
                    other.ApplyDamage(atk * GoElements.SuperAtkMul, GoElements.ColorOf(GoReaction.Superconduct), 1f);
                    other.Aggro();
                }
            }
            else if (reaction == GoReaction.Swirl)
            {
                // 회오리 — 둘레 다른 적에게 그 원소를 옮겨 붙이고 ×0.6
                foreach (var other in _all.ToArray())
                {
                    if (other == this || !other.Alive) continue;
                    if (Flat(other.transform.position - transform.position).magnitude > GoElements.SwirlRadius) continue;
                    if (!other.Shielded && (other.AuraLeft <= 0f || other.Aura == from))
                    {
                        other.Aura = from;
                        other.AuraLeft = GoElements.AuraSec;
                    }
                    other.ApplyDamage(atk * GoElements.SwirlAtkMul * setRx, GoElements.ColorOf(from), 1f);
                    other.Aggro();
                }
            }
            else if (reaction == GoReaction.Crystallize)
            {
                FieldCombat.Instance?.AddCrystalGuard();
            }
            else if (reaction == GoReaction.Bloom)
            {
                FieldCombat.Instance?.AddBloomSeed(transform.position, atk * GoElements.BloomAtkMul);
            }
            else if (reaction == GoReaction.Burning)
            {
                BurningLeft = GoElements.BurningTicks;
                _burningTick = GoElements.BurningTickSec;
                _burningDmg = atk * GoElements.BurningAtkMul * setRx;
            }
            else if (reaction == GoReaction.Quicken)
            {
                QuickenLeft = GoElements.QuickenSec;
            }

            Aggro();
            return dealt;
        }

        /// <summary>얼어붙음 — 2.5초 제자리에 멎고, 예고하던 수도 끊긴다.</summary>
        private void Freeze()
        {
            FrozenLeft = GoElements.FrozenSec;
            if (CurrentState == State.Telegraph)
            {
                CurrentState = State.Chase;
                _warnRing.enabled = false;
            }
            TintVisual(GoElements.ColorOf(GoElement.Cryo), true);
        }

        /// <summary>원소 없는 날 피해(꽃피움 씨앗 터짐 등) — 반응·부착 없이.</summary>
        public float TakeRaw(float amount, Color color)
        {
            if (!Alive) return 0f;
            Aggro();
            return ApplyDamage(amount, color, 1f);
        }

        private void ClearReactionStates()
        {
            if (FrozenLeft > 0f) TintVisual(Color.white, false);
            FrozenLeft = 0f;
            SuperLeft = 0f;
            QuickenLeft = 0f;
            BurningLeft = 0;
        }

        /// <summary>원소 방패에 한 번 — 체력은 안 깎이고 반응·부착도 없다. 방패에 들어간 양을 돌려준다.</summary>
        private float HitShield(float amount, GoElement element)
        {
            float mul = GoElements.ShieldMul(Element, element);
            Vector3 textPos = transform.position + Vector3.up * (BodyHeight + 0.8f);
            Aggro();
            if (mul <= 0f)
            {
                FieldDamageText.Spawn(textPos, GoLocalization.T("field.immune", "면역"), new Color(0.7f, 0.7f, 0.72f), 1f);
                return 0f;
            }
            float dmg = amount * mul;
            float dealt = Mathf.Min(ShieldHp, dmg);
            ShieldHp -= dmg;
            FieldDamageText.Spawn(textPos, Mathf.RoundToInt(dmg).ToString(), GoElements.ColorOf(Element), mul > 1f ? 1.25f : 0.85f);
            if (mul > 1f)
                FieldDamageText.Spawn(textPos + Vector3.up * 1f, GoLocalization.T("field.counter", "상성!"), GoElements.ColorOf(element), 1.1f);
            if (ShieldHp <= 0f) BreakShield();
            RefreshHeadUi();
            return dealt;
        }

        /// <summary>방패가 깨짐 — 하던 예고를 끊고 2초 비틀거린다. 그 뒤로는 보통 적(부착·반응 받음).
        /// 수호장은 겉이 깨지면 0.8초 휘청한 뒤 속 방패(다른 원소)가 차오르고, 속이 깨지면 3초 드러눕는다.</summary>
        private void BreakShield()
        {
            if (TwoLayered && ShieldLayers >= 2)
            {
                ShieldLayers = 1;
                Element = InnerElement;
                ShieldHp = ShieldMax;
                _alertText.gameObject.SetActive(false);
                _warnRing.enabled = false;
                CurrentState = State.Stagger;
                _timer = GuardianOuterStaggerSec;
                if (_animator != null) _animator.SetTrigger("Hit");
                FieldDamageText.Spawn(transform.position + Vector3.up * (BodyTop + 2f),
                    GoLocalization.T("field.guard_outer_break", "겉 방패 깨짐!"), GoElements.ColorOf(OuterElement), 1.4f);
                FieldRingFx.Spawn(transform.position, 6f, GoElements.ColorOf(OuterElement), 0.5f);
                string hint = string.Format(GoLocalization.T("field.guard_inner", "속 방패 {0} — {1} 원소 동료로 바꿔라"),
                    GoElements.NameOf(InnerElement), GoElements.NameOf(CounterOf(InnerElement)));
                Saga.Go.UI.DialogueLabel.Instance?.Show(hint, 3.5f);
                ApplyElementColors();
                RefreshElementFx();
                RefreshHeadUi();
                return;
            }
            ShieldHp = 0f;
            ShieldLayers = 0;
            _alertText.gameObject.SetActive(false);
            _warnRing.enabled = false;
            TintVisual(Color.white, false);
            CurrentState = State.Stagger;
            _timer = IsGuardian ? GuardianDownSec : GoElements.ShieldBreakStaggerSec;
            if (_animator != null) _animator.SetTrigger("Hit");
            FieldDamageText.Spawn(transform.position + Vector3.up * (BodyTop + 2f),
                IsGuardian ? GoLocalization.T("field.guard_down", "속 방패 깨짐! — 드러누웠다") : GoLocalization.T("field.shield_break", "방패 깨짐!"),
                GoElements.ColorOf(Element), 1.4f);
            FieldRingFx.Spawn(transform.position, 4f, GoElements.ColorOf(Element), 0.5f);
            RefreshElementFx();
        }

        /// <summary>방패를 처음 모양으로(수호장은 겉 겹부터 다시).</summary>
        private void ResetShields()
        {
            ShieldHp = ShieldMax;
            if (TwoLayered)
            {
                ShieldLayers = 2;
                Element = OuterElement;
                ApplyElementColors();
            }
            else
            {
                ShieldLayers = ShieldMax > 0f ? 1 : 0;
            }
            RefreshElementFx();
        }

        /// <summary>수호장 겹이 바뀌면 방패 거품·구슬·빛·방패 막대·이름·몸 빛깔을 그 원소로.</summary>
        private void ApplyElementColors()
        {
            Color c = GoElements.ColorOf(Element);
            if (_bubbleMat != null) _bubbleMat.color = new Color(c.r, c.g, c.b, 0.22f);
            if (_orbMat != null)
            {
                _orbMat.color = c;
                _orbMat.SetColor("_EmissionColor", c * 2.5f);
            }
            if (_elementLight != null) _elementLight.color = c;
            if (_shieldFillRenderer != null)
            {
                var block = new MaterialPropertyBlock();
                block.SetColor("_Color", c);
                _shieldFillRenderer.SetPropertyBlock(block);
            }
            if (_nameText != null) _nameText.color = Color.Lerp(Color.white, c, 0.6f);
            if (_visual != null && !_tinted && BaseTint(out Color baseTint)) CharacterVisual.Tint(_visual.gameObject, baseTint);
        }

        /// <summary>그 원소를 누르는 원소(수 → 화 · 뇌 → 수 · 화 → 뇌).</summary>
        private static GoElement CounterOf(GoElement e)
        {
            return GoElements.CounterOf(e); // 109-14-1a 일곱
        }

        private void StartCharged(float atk)
        {
            _chargedLeft = GoElements.ChargedSec;
            _chargedTick = GoElements.ChargedTickSec;
            _chargedAtk = atk * GoElements.ChargedTickAtkMul;
        }

        private void Aggro()
        {
            if (CurrentState == State.Wander || CurrentState == State.Return) EnterChase();
        }

        private float ApplyDamage(float amount, Color color, float size)
        {
            if (!Alive || amount <= 0f) return 0f;
            if (Shielded)
            {
                // 옆 적의 과부하 광역처럼 원소 없는 몫 — 방패가 받는다(배율 1)
                float sd = Mathf.Min(ShieldHp, amount);
                ShieldHp -= amount;
                FieldDamageText.Spawn(transform.position + Vector3.up * (BodyHeight + 0.8f), Mathf.RoundToInt(amount).ToString(), GoElements.ColorOf(Element), size * 0.85f);
                if (ShieldHp <= 0f) BreakShield();
                RefreshHeadUi();
                return sd;
            }
            float dealt = Mathf.Min(Hp, amount);
            Hp -= amount;
            FieldDamageText.Spawn(transform.position + Vector3.up * (BodyHeight + 0.8f),
                Mathf.RoundToInt(amount).ToString(), color, size);
            if (Hp <= 0f)
            {
                Die();
            }
            else if (_animator != null && CurrentState != State.Telegraph)
            {
                _animator.SetTrigger("Hit");
            }
            RefreshHeadUi();
            return dealt;
        }

        private void Die()
        {
            if (IsHero) { Yield(); return; }
            Hp = 0f;
            CurrentState = State.Dead;
            _timer = DomainFoe || StoryFoe ? float.MaxValue : RespawnSec; // 109-14-9 숨은 터 적·109-14-12 임무 적은 다시 안 선다
            _chargedLeft = 0f;
            ClearReactionStates();
            Aura = GoElement.Physical;
            AuraLeft = 0f;
            _alertText.gameObject.SetActive(false);
            _warnRing.enabled = false;
            TintVisual(Color.white, false);
            if (_animator != null) _animator.SetTrigger("Death");
            _headUi.gameObject.SetActive(false);
            RefreshElementFx();
            if (DomainFoe || StoryFoe) { Killed?.Invoke(this); Invoke(nameof(HideBody), 2.5f); return; } // 109-14-9 경험·전리품·일과 없음(109-14-12 임무 적도)
            if (!(IsGuardian && GuardianState.Defeated)) PlayerStats.AddExp(ExpReward); // 109-14-10 다시 선 수호장은 경험 없이 꽃만
            DailyTaskState.ReportProgress(DailyTaskState.Kind.FieldKill, 1); // 109-14-8 일일 의뢰 — 들판 적
            if (EnemyKind == Kind.Bandit && !IsHero)
            {
                // 109-14-6 짐승 고기 — 14-1b 짐승(바위곰)이 오기 전까지 산적 봇짐에서
                CookState.Add("meat", MeatPerBandit);
                FieldDamageText.Spawn(transform.position + Vector3.up * (BodyHeight + 3.4f), string.Format(GoLocalization.T("cook.meat_plus", "{0} +{1}"), GoCooking.ItemName("meat"), MeatPerBandit), new Color(0.95f, 0.7f, 0.55f), 0.85f);
            }
            if (IsGuardian)
            {
                _timer = float.MaxValue; // 저절로 다시 안 선다 — 꽃을 받고 150초 뒤 `GuardianBloom` 이 세운다(109-14-10)
                if (GuardianState.MarkDefeated())
                {
                    GoldState.Add(GuardianGoldNow); // 109-14-7 천하 등급 전리품 배율 — 첫 토벌만
                    Saga.Go.UI.DialogueLabel.Instance?.Show(string.Format(
                        GoLocalization.T("field.guard_slain", "망루 수호장 토벌! 금 {0}냥 · 경험치 {1}"), GuardianGoldNow, ExpReward) + " — " + GoLocalization.T("boss.bloomed", "보상 꽃이 피었다"), 4f);
                }
                else Saga.Go.UI.DialogueLabel.Instance?.Show(GoLocalization.T("boss.again", "망루 수호장을 다시 쓰러뜨렸다 — 보상 꽃이 피었다"), 3.5f);
            }
            if (IsElemental && ShieldMax > 0f && !IsGuardian && !IsHero)
            {
                // 109-14-4 방패 두른 원소 괴물 — 무예 쪽지 하나(웹 ⑲-4 얻는 곳)
                string mats = TalentState.Add(GoTalent.EliteMats);
                WeaponState.AddOre(GoWeapons.EliteOre); // 109-14-5a 강화석 하나
                mats += (mats.Length > 0 ? " · " : "") + string.Format(GoLocalization.T("weapon.ore_plus", "강화석 +{0}"), GoWeapons.EliteOre);
                mats += " · " + ArtifactState.OnElite(); // 109-14-5b 보패 ★4 하나
                if (mats.Length > 0) FieldDamageText.Spawn(transform.position + Vector3.up * (BodyHeight + 2.6f), mats, new Color(0.95f, 0.85f, 0.55f), 0.9f);
            }
            Killed?.Invoke(this);
            Invoke(nameof(HideBody), 2.5f);
        }

        /// <summary>109-6 굴복 — 쓰러지지 않고 무릎 꿇는다(Interact 동작). 다시 서지 않고, `FieldHeroes` 가 등용한 뒤 치운다.</summary>
        private void Yield()
        {
            Hp = 0f;
            Yielded = true;
            CurrentState = State.Dead;
            _timer = float.MaxValue;
            _chargedLeft = 0f;
            ClearReactionStates();
            Aura = GoElement.Physical;
            AuraLeft = 0f;
            _alertText.gameObject.SetActive(false);
            _warnRing.enabled = false;
            TintVisual(Color.white, false);
            if (_animator != null) _animator.SetTrigger("Interact");
            _headUi.gameObject.SetActive(false);
            RefreshElementFx();
            PlayerStats.AddExp(ExpReward);
            HeroYielded?.Invoke(this);
        }

        private void HideBody()
        {
            if (CurrentState == State.Dead && _visual != null) _visual.gameObject.SetActive(false);
        }

        private void Revive()
        {
            CancelInvoke(nameof(HideBody));
            Hp = MaxHp;
            ResetShields();
            transform.position = Grounded(Home);
            CurrentState = State.Wander;
            _timer = 1f;
            if (_visual != null) _visual.gameObject.SetActive(true);
            if (_animator != null) { _animator.Rebind(); _animator.Update(0f); }
            _headUi.gameObject.SetActive(true);
            RefreshElementFx();
            RefreshHeadUi();
        }

        /// <summary>플레이어가 모두 쓰러져 마을로 돌아갈 때 — 쫓던 적은 귀가.</summary>
        public void ForceReturn()
        {
            if (!Alive) return;
            _alertText.gameObject.SetActive(false);
            _warnRing.enabled = false;
            TintVisual(Color.white, false);
            CurrentState = State.Return;
        }

        /// <summary>진단용 — 곧바로 다시 세운다.</summary>
        public void ReviveNow() => Revive();

        /// <summary>진단용 — 그 자리를 잠시 집으로 삼아 세운다(끌려 나옴 규칙에 안 걸리게).</summary>
        public void WarpForTest(Vector3 pos)
        {
            Revive();
            ClearAuraForTest();
            Home = pos;
            transform.position = Grounded(pos);
        }

        /// <summary>진단용 — 원래 집으로 되돌려 세운다.</summary>
        public void RestoreHomeForTest()
        {
            Home = _spawnHome;
            Revive();
            ClearAuraForTest();
        }

        /// <summary>진단용 — 방패를 곧장 맞춘다(0 이면 깨진 채, 비틀거림 없이).</summary>
        public void SetShieldForTest(float value)
        {
            ShieldHp = Mathf.Clamp(value, 0f, ShieldMax);
            RefreshElementFx();
            RefreshHeadUi();
        }

        /// <summary>진단용 — 체력을 곧장 맞춘다(109-14-7 다시 재도 비율이 남는지).</summary>
        public void SetHpForTest(float value) => Hp = Mathf.Clamp(value, 1f, MaxHp);

        /// <summary>진단용 — 수호장 "처음 만남" 여부를 정한다(false 면 다음 발견에 등장 컷).</summary>
        public void SetEngagedForTest(bool engaged) => Engaged = engaged;

        /// <summary>진단용 — 원소 부착을 지운다.</summary>
        public void ClearAuraForTest()
        {
            Aura = GoElement.Physical;
            AuraLeft = 0f;
            _chargedLeft = 0f;
            ClearReactionStates();
        }

        // ---- 움직임 ------------------------------------------------------------

        private bool MoveToward(Vector3 target, float speed, float dt, float stopDist)
        {
            Vector3 d = Flat(target - transform.position);
            float dist = d.magnitude;
            if (dist <= stopDist)
            {
                SetMoveAnim(0f);
                return true;
            }
            Vector3 step = d / dist * Mathf.Min(speed * dt, dist - stopDist * 0.5f);
            step += Separation() * dt;
            MoveBy(step);
            Face(d);
            SetMoveAnim(speed >= ChaseSpeed ? 1f : 0.5f);
            return false;
        }

        private Vector3 Separation()
        {
            Vector3 push = Vector3.zero;
            foreach (var other in _all)
            {
                if (other == this || !other.Alive) continue;
                Vector3 d = Flat(transform.position - other.transform.position);
                float m = d.magnitude;
                if (m > 0.01f && m < SeparationRadius) push += d / m * (SeparationRadius - m) * 3f;
            }
            return push;
        }

        private void MoveBy(Vector3 delta)
        {
            Vector3 next = transform.position + delta;
            if (!CanStandOn(next)) return; // 107 ② — 산 고원·강으로는 안 따라 들어온다
            transform.position = Grounded(next);
        }

        /// <summary>들판 적이 설 수 있는 칸인가 — 산(고원·절벽)과 강·다리 칸은 아니다.</summary>
        public static bool CanStandOn(Vector3 p)
        {
            var (gx, gy) = TestMapData.WorldToGrid(p);
            char c = TestMapData.TileAt(gx, gy);
            return c != '^' && !TestMapData.IsWater(c);
        }

        private void Face(Vector3 dir)
        {
            dir.y = 0f;
            if (dir.sqrMagnitude < 0.0001f) return;
            Quaternion want = Quaternion.LookRotation(dir);
            transform.rotation = Quaternion.Slerp(transform.rotation, want, 0.25f);
        }

        private void SetMoveAnim(float speed)
        {
            if (_animator != null && _animator.runtimeAnimatorController != null) _animator.SetFloat("Speed", speed);
        }

        private void TintVisual(Color c, bool on)
        {
            if (_visual == null) return;
            bool hasBase = BaseTint(out Color baseTint);
            if (on)
            {
                CharacterVisual.Tint(_visual.gameObject, hasBase ? c * baseTint : c);
                _tinted = true;
            }
            else if (_tinted)
            {
                if (hasBase) CharacterVisual.Tint(_visual.gameObject, baseTint);
                else CharacterVisual.ClearTint(_visual.gameObject);
                _tinted = false;
            }
        }

        private static Vector3 Grounded(Vector3 p)
        {
            var hits = Physics.RaycastAll(new Vector3(p.x, p.y + 30f, p.z), Vector3.down, 80f, ~0, QueryTriggerInteraction.Ignore);
            float best = float.NegativeInfinity;
            foreach (var h in hits)
            {
                if (h.collider is CharacterController) continue;
                if (h.point.y > p.y + 3f) continue; // 머리 위 지붕·나무 윗면엔 안 올라탄다
                if (h.point.y > best) best = h.point.y;
            }
            if (best > float.NegativeInfinity) p.y = best;
            return p;
        }

        private static Vector3 Flat(Vector3 v) { v.y = 0f; return v; }

        private void RefreshHeadUi()
        {
            if (_hpFill == null) return;
            float r = MaxHp > 0f ? Mathf.Clamp01(Hp / MaxHp) : 0f;
            _hpFill.localScale = new Vector3(1.94f * r, 0.16f, 1f);
            if (TwoLayered && _nameText != null)
            {
                string name = ShieldLayers > 0
                    ? $"{DisplayName}  {string.Format(GoLocalization.T("field.guard_layers", "방패 {0}겹"), ShieldLayers)}"
                    : DisplayName;
                if (_nameText.text != name) _nameText.text = name;
            }
            if (_shieldBar != null)
            {
                _shieldBar.SetActive(Shielded);
                _shieldFill.localScale = new Vector3(1.94f * Mathf.Clamp01(ShieldHp / ShieldMax), 0.1f, 1f);
            }
            bool aura = AuraLeft > 0f && Aura != GoElement.Physical;
            _auraDot.enabled = aura;
            if (aura)
            {
                _auraDot.GetPropertyBlock(_block);
                _block.SetColor("_Color", GoElements.ColorOf(Aura));
                _auraDot.SetPropertyBlock(_block);
            }
        }

        private void LateUpdate()
        {
            if (_orbit != null && _orbit.gameObject.activeSelf) _orbit.Rotate(0f, 90f * Time.deltaTime, 0f, Space.Self);
            var cam = Camera.main;
            if (cam != null && _headUi != null)
            {
                _headUi.rotation = Quaternion.LookRotation(_headUi.position - cam.transform.position);
            }
        }
    }
}
