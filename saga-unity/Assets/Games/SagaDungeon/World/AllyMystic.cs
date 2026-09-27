using UnityEngine;
using Saga.Dungeon.Cinematics;
using Saga.Dungeon.Data;
using Saga.Dungeon.UI;

namespace Saga.Dungeon.World
{
    /// <summary>
    /// PLAN.md 106-6 "FF 확장" — 파티의 뒷줄 "동행 술사"(가상 인물, 원작 이름 없음). 무사(`AllyFighter`)와 같은 결로
    /// 스스로 싸우되 거리를 둔다: 10m 안 적에게 1.6초마다 빛살(`MysticBolt`)을 쏘고, 적이 3.5m 안으로 붙으면 물러선다.
    /// 명령 "치유의 빛"(게이지 한 칸)은 플레이어 체력 40% 를 채우고 무사를 60% 로 일으킨다. 적은 술사를 노리지 않는다
    /// (도발은 무사 몫 — 적 표적은 플레이어·도발한 무사 둘뿐이라 술사는 체력이 없다).
    /// 스탯은 무사와 같은 `partyPower()` 공식(might 10·wisdom 30 → atk 16 → 한 타 max(4, 16/6) = 4).
    /// 몸은 Peasant Girl — 제 컨트롤러에 전용 클립(걷기·달리기·빛살 시전 `Attack`·치유 시전 `Heal`, 2026-09-24 Mixamo)이 있으면 그대로,
    /// 없는 PC 면 Maria.controller 를 씌운 리타깃(GO 107-6 과 같은 방식).
    /// </summary>
    public class AllyMystic : MonoBehaviour
    {
        private const float FollowDistance = 4.5f;
        private const float FollowSpeed = 6f;
        private const float WalkFollowSpeed = 2.6f;
        private const float EngageRadius = 10f;
        private const float KeepAwayRadius = 3.5f;
        private const float BackOffSpeed = 3f;
        private const float CastInterval = 1.6f;
        private const float HandHeight = 1.3f;

        private const float Atk = 10f * 0.7f + 30f * 0.3f; // 16
        public static float BoltDamage => Mathf.Max(4f, Atk / 6f);

        public const float HealPlayerFrac = 0.4f;
        public const float ReviveGuardFrac = 0.6f;

        private const float TargetHeight = 1.65f;
        private static readonly Color BodyColor = new Color(0.55f, 0.4f, 0.7f); // 폴백 캡슐 — 보랏빛 도포.

        [SerializeField] private GameObject modelPrefab;
        [SerializeField] private RuntimeAnimatorController bodyController;

        private Transform _player;
        private float _castCooldown;
        private Animator _animator;

        public static AllyMystic Instance { get; private set; }
        public Animator Animator => _animator;
        public int BoltsCast { get; private set; }

        private void Awake()
        {
            Instance = this;
            if (transform.childCount == 0) BuildVisual();
            var playerGo = GameObject.FindWithTag("Player");
            _player = playerGo != null ? playerGo.transform : null;
            Gesturer.Attach(gameObject, GestureState.AllyKey, npc: false); // PLAN.md 109-10-7 몸짓 — 호응은 제 시전 클립.
        }

        private void OnDestroy()
        {
            if (Instance == this) Instance = null;
        }

        private void BuildVisual()
        {
            if (modelPrefab != null && modelPrefab.GetComponent<Animator>() != null)
            {
                var inst = Instantiate(modelPrefab, transform, false);
                inst.name = "Visual";
                _animator = inst.GetComponent<Animator>();
                if (bodyController != null && _animator.isHuman && !HasOwnClips) _animator.runtimeAnimatorController = bodyController;
                CharacterVisual.EnsureBlobShadow(transform);
                return;
            }
            if (modelPrefab != null) CharacterVisual.Spawn(modelPrefab, transform, TargetHeight, BodyColor);
            else CharacterVisual.SpawnFallbackCapsule(transform, TargetHeight, BodyColor);
        }

        /// <summary>PLAN.md 106-6 "치유의 빛" — `PartyCommands` 가 게이지를 쓴 뒤 부른다.</summary>
        public void OrderHeal()
        {
            HeroState.HealBy(Mathf.CeilToInt(HeroState.HpMax * HealPlayerFrac));
            var guard = AllyFighter.Instance;
            if (guard != null) guard.Revive(ReviveGuardFrac);
            Trigger(HasParam("Heal") ? "Heal" : "Attack");
            if (_player != null) HealGlow.Spawn(_player.position);
            if (guard != null) HealGlow.Spawn(guard.transform.position);
            DialogueLabel.Instance?.Show(DungeonLocalization.T("party.heal", "동행 술사: 「치유의 빛!」 — 체력이 차오른다"), 2.5f);
        }

        private void Update()
        {
            if (_player == null) return;
            if (DungeonCutscenes.Playing)
            {
                SetSpeed(0f);
                return;
            }
            Tick(Time.deltaTime);
        }

        /// <summary>한 프레임 분량 — 진단이 시간을 직접 넣는다.</summary>
        public void Tick(float dt)
        {
            if (_castCooldown > 0f) _castCooldown -= dt;

            var close = DungeonEnemy.FindNearest(transform.position, KeepAwayRadius);
            if (close != null)
            {
                Vector3 away = transform.position - close.transform.position;
                away.y = 0f;
                if (away.sqrMagnitude < 0.0001f) away = -transform.forward;
                transform.position += away.normalized * BackOffSpeed * dt;
                SetSpeed(0.5f);
                return;
            }

            var target = DungeonEnemy.FindNearest(transform.position, EngageRadius);
            if (target != null)
            {
                SetSpeed(0f);
                Face(target.transform.position);
                if (_castCooldown <= 0f)
                {
                    _castCooldown = CastInterval;
                    BoltsCast++;
                    Trigger("Attack");
                    MysticBolt.Fire(transform.position + Vector3.up * HandHeight + transform.forward * 0.4f, target, BoltDamage);
                }
                return;
            }

            Vector3 toPlayer = _player.position - transform.position;
            toPlayer.y = 0f;
            float dist = toPlayer.magnitude;
            if (dist <= FollowDistance)
            {
                SetSpeed(0f);
                return;
            }
            bool far = dist > FollowDistance * 2f;
            SetSpeed(far ? 1f : 0.5f);
            transform.position += toPlayer.normalized * (far ? FollowSpeed : WalkFollowSpeed) * dt;
            Face(_player.position);
        }

        /// <summary>제 컨트롤러가 걷기·시전을 다 갖췄나(전용 클립을 받은 PC) — 아니면 Maria.controller 리타깃.</summary>
        public bool HasOwnClips => HasParam("Attack") && HasParam("Heal");

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

        private void SetSpeed(float value)
        {
            if (_animator != null) _animator.SetFloat("Speed", value, 0.1f, Time.deltaTime);
        }

        private void Face(Vector3 worldPos)
        {
            Vector3 dir = worldPos - transform.position;
            dir.y = 0f;
            if (dir.sqrMagnitude > 0.0001f) transform.rotation = Quaternion.LookRotation(dir.normalized);
        }
    }
}
