using UnityEngine;
using Saga.Dungeon.Cinematics;
using Saga.Dungeon.Data;
using Saga.Dungeon.UI;

namespace Saga.Dungeon.World
{
    /// <summary>
    /// VERTICAL_SLICE_DUNGEON.md 다음 슬라이스 "부대(다중 영웅) 시스템" —
    /// saga-dungeon 웹판 `js/hero.js`의 `partyPower()`(동행 전원의
    /// might*0.7+wisdom*0.3=atk, command*0.6+wisdom*0.2=def를 합산)는
    /// 다중 영웅 등용·성장·장비까지 갖춘 완전한 부대 시스템을 요구해
    /// 이번 슬라이스 범위 밖(VERTICAL_SLICE_DUNGEON.md "제외" 참고,
    /// `HeroState.cs`도 같은 이유로 단일 캐릭터로 남겨 뒀다). **부대의
    /// 핵심 가치("혼자가 아니라 여럿이 함께 싸운다")만 가장 작은 단위로
    /// 보여준다** — 등용·성장 없이 처음부터 함께 있는 동행 하나가
    /// 플레이어를 따라다니며 스스로 싸운다. 죽지 않는다(체력·죽음 처리는
    /// 다음 슬라이스 몫 — 이번엔 "화력이 늘어난다"는 것만 증명).
    /// 스탯은 `partyPower()` 공식 그대로(might=24·wisdom=12·command=18
    /// → atk=24×0.7+12×0.3=20.4) 옮기되, 등용 대상이 없어 임의로 잡은
    /// 가상의 동행("동행 무사", 원작 상표 없음).
    ///
    /// PLAN.md 106-6 "FF 확장" — 파티의 앞줄. 체력이 생기고(웹판 `hpMaxOf` = max(30, def×3), def = command×0.6 +
    /// wisdom×0.2 = 13.2 → 40), 명령 "방패 도발"(게이지 한 칸)을 받으면 12m 안 적이 8초 동안 무사만 노린다
    /// (받는 피해 40%). 체력이 다하면 쓰러지고 12초 뒤 30% 로 일어난다 — 술사의 "치유의 빛"은 곧바로 일으킨다.
    /// 적이 곁에 없으면 4초 뒤 체력이 다 찬다(던전 한 판을 무사 체력으로 막지 않게).
    /// </summary>
    public class AllyFighter : MonoBehaviour
    {
        private const float FollowDistance = 3f;
        private const float FollowSpeed = 6f; // PlayerController.WalkSpeed와 같음 — 플레이어를 놓치지 않게
        private const float WalkFollowSpeed = 2.6f; // PLAN.md 106-4 — 가까울 땐 걷기 클립 보폭에 맞춘다

        private const float EngageRadius = 8f; // DungeonEnemy.AggroRadius 기본값과 같음 — 이 거리 안 적을 알아서 맞선다
        private const float AttackRange = 2.3f;
        private const float ChaseSpeed = 5f;
        private const float AttackInterval = 0.55f; // js/dungeon.js BASE_ATK_CD, PlayerCombat.cs와 같음

        // partyPower() 공식(atk = might*0.7 + wisdom*0.3) 그대로 —
        // 동행 stats: might=24, wisdom=12, command=18(방어 기여는 이번
        // 슬라이스에 안 씀, 동행이 안 죽어 체력 계산이 필요 없다).
        private const float Atk = 24f * 0.7f + 12f * 0.3f; // 20.4
        public static float HitDamage => Mathf.Max(4f, Atk / 6f); // dungeon.js atkOf()와 같은 공식

        private static readonly Color BodyColor = new Color(0.3f, 0.45f, 0.7f); // 동행 — 청색 갑주
        private const float TargetHeight = 1.7f; // 기존 primitive capsule 기준(높이 2m × 0.85) 그대로 유지.

        // "GLB 자산 도입" 슬라이스 — DungeonEnemy.cs와 같은 이유(Awake는
        // 런타임에도 돎)로 편집기 빌드 스크립트가 채워 준다.
        [SerializeField] private GameObject modelPrefab;

        // PLAN.md 106-6 — 체력·쓰러짐·도발.
        public const int HpMax = 40;
        public const float TauntSec = 8f;
        public const float TauntRadius = 12f;
        public const float TauntDamageMul = 0.4f;
        public const float DownSec = 12f;
        public const float GetUpHpFrac = 0.3f;
        private const float CalmRegenSec = 4f;
        private const float CalmRadius = 12f;
        private static readonly Color TauntRingColor = new Color(1f, 0.78f, 0.25f);

        private Transform _player;
        private float _attackCooldown;
        private Animator _animator; // PLAN.md 106-4 — 사실 모델(Paladin)일 때만. Speed 0/0.5/1 + Attack 트리거.
        private Transform _visual;
        private float _hp = HpMax;
        private float _downLeft;
        private float _tauntLeft;
        private float _calmFor;
        private LineRenderer _tauntRing;

        public Animator Animator => _animator;

        public static AllyFighter Instance { get; private set; }
        public float Hp => _hp;
        public bool IsUp => _downLeft <= 0f;
        public bool Taunting => _tauntLeft > 0f && IsUp;
        public float DownLeft => _downLeft;

        private void Awake()
        {
            Instance = this;
            if (transform.childCount == 0) BuildVisual();
            _visual = transform.childCount > 0 ? transform.GetChild(0) : null;
            var playerGo = GameObject.FindWithTag("Player");
            _player = playerGo != null ? playerGo.transform : null;
            // PLAN.md 109-10-7 몸짓 — 선두 회전베기에 ❗ 호응(제 베기 클립)·두목급 처치·레벨업에 환호. 쓰러졌거나 도발 중이면 글자만.
            Gesturer.Attach(gameObject, GestureState.AllyKey, npc: false, () => !IsUp || Taunting, ownKey: GestureState.GuardKey);
            // PLAN.md 109-10-8 동행 서명 — 💥 철벽 진동(쓰러져 있으면 못 씀).
            AllySigCaster.Attach(gameObject, PartyRole.Guard, () => IsUp, () => HitDamage, () => Trigger("Attack"));
        }

        private void OnDestroy()
        {
            if (Instance == this) Instance = null;
        }

        /// <summary>PLAN.md 106-6 "방패 도발" — `PartyCommands` 가 게이지를 쓴 뒤 부른다. 걸린 적 수를 돌려준다.</summary>
        public int OrderTaunt()
        {
            if (!IsUp) return 0;
            _tauntLeft = TauntSec;
            int n = 0;
            foreach (var e in DungeonEnemy.Active)
            {
                if (e == null || !e.IsAlive) continue;
                if (Vector3.Distance(transform.position, e.transform.position) > TauntRadius) continue;
                e.Taunt(this, TauntSec);
                n++;
            }
            // 106-6 전용 클립 — 방패를 치켜든다(Paladin@Taunt). 클립이 없는 PC 는 검방 공격 클립.
            Trigger(HasParam("Taunt") ? "Taunt" : "Attack");
            EnsureTauntRing();
            _tauntRing.enabled = true;
            DialogueLabel.Instance?.Show(DungeonLocalization.T("party.taunt", "동행 무사: 「이쪽이다!」 — 적이 무사를 노린다"), 2.5f);
            return n;
        }

        /// <summary>적의 판정이 도발 중인 무사에게 떨어졌다(`DungeonEnemy.ResolveStrike`).</summary>
        public void TakeHit(float amount)
        {
            if (!IsUp || amount <= 0f) return;
            float taken = amount * (Taunting ? TauntDamageMul : 1f);
            _hp = Mathf.Max(0f, _hp - taken);
            _calmFor = 0f;
            DamagePopup.Spawn(transform.position + Vector3.up * 2f, taken, false);
            if (_hp <= 0f) { GoDown(); return; }
            // 도발 중엔 방패로 받아 내는 동작(Blocked), 아니면 맞아 휘청(Hit) — 클립이 있을 때만.
            if (Taunting && HasParam("Blocked")) Trigger("Blocked");
            else if (HasParam("Hit")) Trigger("Hit");
        }

        /// <summary>술사 "치유의 빛" — 쓰러져 있으면 일으키고, 서 있으면 채운다.</summary>
        public void Revive(float hpFrac)
        {
            _hp = Mathf.Max(_hp, HpMax * Mathf.Clamp01(hpFrac));
            if (_downLeft > 0f)
            {
                _downLeft = 0f;
                SetDownPose(false);
            }
        }

        /// <summary>진단용 — 게이지·쓰러짐을 처음 상태로.</summary>
        public void ResetParty()
        {
            _hp = HpMax;
            _downLeft = 0f;
            _tauntLeft = 0f;
            _calmFor = 0f;
            if (_tauntRing != null) _tauntRing.enabled = false;
            SetDownPose(false);
        }

        private void GoDown()
        {
            _downLeft = DownSec;
            _tauntLeft = 0f;
            if (_tauntRing != null) _tauntRing.enabled = false;
            SetDownPose(true);
            DialogueLabel.Instance?.Show(DungeonLocalization.T("party.guard_down", "동행 무사가 쓰러졌다 — 술사의 치유로 일으킬 수 있다"), 3f);
        }

        /// <summary>쓰러짐 — 전용 클립(Paladin@Dying, 마지막 프레임에 머문다)이 있으면 그것, 일어날 땐 대기로 곧장.
        /// 클립이 없는 PC 는 몸을 뒤로 눕힌다(절차적 폴백, PlayerController 구르기와 같은 결).</summary>
        private void SetDownPose(bool down)
        {
            SetSpeed(0f);
            if (UsesDeathClip)
            {
                if (down) Trigger("Death");
                else if (_animator.GetCurrentAnimatorStateInfo(0).IsName("Death") || _animator.IsInTransition(0))
                {
                    _animator.ResetTrigger("Death");
                    _animator.Play("Idle", 0, 0f);
                }
                return;
            }
            if (_visual == null) return;
            _visual.localRotation = down ? Quaternion.Euler(-80f, 0f, 0f) : Quaternion.identity;
            _visual.localPosition = down ? new Vector3(0f, 0.3f, 0f) : Vector3.zero;
        }

        /// <summary>한 프레임 분량의 쓰러짐·도발·회복 — 진단이 시간을 직접 넣는다.</summary>
        public void TickParty(float dt)
        {
            if (_downLeft > 0f)
            {
                _downLeft -= dt;
                if (_downLeft <= 0f)
                {
                    _downLeft = 0f;
                    _hp = HpMax * GetUpHpFrac;
                    SetDownPose(false);
                }
                return;
            }
            if (_tauntLeft > 0f)
            {
                _tauntLeft -= dt;
                if (_tauntLeft <= 0f && _tauntRing != null) _tauntRing.enabled = false;
            }
            if (_hp < HpMax)
            {
                _calmFor = DungeonEnemy.FindNearest(transform.position, CalmRadius) == null ? _calmFor + dt : 0f;
                if (_calmFor >= CalmRegenSec) _hp = HpMax;
            }
        }

        /// <summary>106-6 전용 클립 — 쓰러짐을 클립으로 보이는가(아니면 몸을 눕히는 폴백).</summary>
        public bool UsesDeathClip => HasParam("Death");

        /// <summary>진단용 — 마지막으로 건 트리거 이름.</summary>
        public string LastTrigger { get; private set; }

        private bool HasParam(string name)
        {
            if (_animator == null || _animator.runtimeAnimatorController == null) return false;
            foreach (var p in _animator.parameters) if (p.name == name) return true;
            return false;
        }

        private void Trigger(string name)
        {
            LastTrigger = name;
            if (HasParam(name)) _animator.SetTrigger(name);
        }

        private void EnsureTauntRing()
        {
            if (_tauntRing != null) return;
            var go = new GameObject("TauntRing");
            go.transform.SetParent(transform, false);
            go.transform.localPosition = new Vector3(0f, 0.06f, 0f);
            _tauntRing = go.AddComponent<LineRenderer>();
            _tauntRing.useWorldSpace = false;
            _tauntRing.loop = true;
            _tauntRing.widthMultiplier = 0.08f;
            _tauntRing.material = new Material(Shader.Find("Sprites/Default"));
            _tauntRing.startColor = _tauntRing.endColor = TauntRingColor;
            _tauntRing.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
            const int seg = 36;
            _tauntRing.positionCount = seg;
            for (int i = 0; i < seg; i++)
            {
                float a = i * Mathf.PI * 2f / seg;
                _tauntRing.SetPosition(i, new Vector3(Mathf.Cos(a) * 1.1f, 0f, Mathf.Sin(a) * 1.1f));
            }
        }

        private void BuildVisual()
        {
            if (modelPrefab != null && modelPrefab.GetComponent<Animator>() != null)
            {
                // 리깅 모델은 실제 크기 그대로, 청색 칠도 안 한다(갑주 텍스처가 이미 있다).
                var inst = Instantiate(modelPrefab, transform, false);
                inst.name = "Visual";
                _animator = inst.GetComponent<Animator>();
                CharacterVisual.EnsureBlobShadow(transform);
                return;
            }
            if (modelPrefab != null)
            {
                CharacterVisual.Spawn(modelPrefab, transform, TargetHeight, BodyColor);
            }
            else
            {
                CharacterVisual.SpawnFallbackCapsule(transform, TargetHeight, BodyColor);
            }
        }

        private void Update()
        {
            if (_player == null) return;
            if (DungeonCutscenes.Playing)
            {
                SetSpeed(0f); // PLAN.md 106-3 — 컷 동안은 동행도 선다.
                return;
            }
            TickParty(Time.deltaTime);
            if (!IsUp) return;
            if (_attackCooldown > 0f) _attackCooldown -= Time.deltaTime;

            var target = DungeonEnemy.FindNearest(transform.position, EngageRadius);
            if (target != null)
            {
                float dist = Vector3.Distance(transform.position, target.transform.position);
                FaceTowards(target.transform.position);

                if (dist <= AttackRange)
                {
                    if (_attackCooldown <= 0f)
                    {
                        _attackCooldown = AttackInterval;
                        target.TakeDamage(HitDamage);
                        PartyState.AddAllyHit(PartyRole.Guard); // PLAN.md 106-6 — 제 평타도 게이지를 조금 채운다.
                        if (_animator != null) _animator.SetTrigger("Attack");
                    }
                    SetSpeed(0f);
                }
                else
                {
                    Vector3 dir = target.transform.position - transform.position;
                    dir.y = 0f;
                    transform.position += dir.normalized * ChaseSpeed * Time.deltaTime;
                    SetSpeed(1f);
                }
                return; // 싸우는 동안엔 플레이어를 안 쫓는다.
            }

            FollowPlayer();
        }

        private void FollowPlayer()
        {
            Vector3 toPlayer = _player.position - transform.position;
            toPlayer.y = 0f;
            float dist = toPlayer.magnitude;
            if (dist <= FollowDistance)
            {
                SetSpeed(0f);
                return;
            }
            bool far = dist > FollowDistance * 2f;
            SetSpeed(far ? 1f : 0.5f); // 멀면 달리고 가까우면 걷는다(걷기 클립에 맞춰 속도도 낮춘다).

            Vector3 dir = toPlayer.normalized;
            transform.position += dir * (far ? FollowSpeed : WalkFollowSpeed) * Time.deltaTime;
            FaceTowards(_player.position);
        }

        private void SetSpeed(float value)
        {
            if (_animator != null) _animator.SetFloat("Speed", value, 0.1f, Time.deltaTime);
        }

        private void FaceTowards(Vector3 worldPos)
        {
            Vector3 dir = worldPos - transform.position;
            dir.y = 0f;
            if (dir.sqrMagnitude > 0.0001f)
            {
                transform.rotation = Quaternion.LookRotation(dir.normalized);
            }
        }
    }
}
