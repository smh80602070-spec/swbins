using UnityEngine;
using Saga.Story.Data;
using Saga.Story.Player;
using Saga.Core;

namespace Saga.Story.World
{
    /// <summary>
    /// PLAN.md 106-10 "STORY 파티 — 교대 셋을 곁에 세우기"(2026-09-24 사용자 결정). 5-8 교대의 세 역할
    /// (선봉·유격·호법, `StoryPartyState.Roster`)이 실제 몸으로 선다. 앞에 나선 역할(활성)은 플레이어와 한 몸이라
    /// 숨고, 쉬는 둘이 플레이어 곁(뒤쪽 줄 z=+0.9)에서 스스로 싸운다 — FF 식 "동료는 알아서, 교대는 누가 앞에 서나".
    ///
    /// 이 판 적은 반격이 없고 플레이어도 안 맞아서(`StoryCombat.StartHp` 주석) 동료에게도 체력·쓰러짐이 없다.
    /// 동료 한 타는 플레이어 기초 공격력(전직·기억 조각·비경 축복 포함, 기합·교대 배율 제외) × 배율 —
    /// 둘이 합쳐 플레이어 평타 빈도의 약 1/5 을 더하는 정도로 잡았다(판수 체감이 크게 안 바뀌게).
    ///
    /// 발판 위 이동: 제 발밑을 아래로 쏴 땅을 찾고(떨어지면 중력), 플레이어와 높이가 0.8m 넘게 다르면 0.5초 포물선으로
    /// 곁에 뛰어오른다. 14m 넘게 벌어지면(비경 아레나 순간이동 등) 불꽃과 함께 곁으로 옮긴다.
    /// `Step(dt)` 를 진단이 직접 부른다.
    /// </summary>
    public class StoryCompanion : MonoBehaviour
    {
        public enum Style { Melee, Archer, Mystic }

        public const float LaneZ = 0.9f;
        private const float Gravity = 36f;
        private const float WalkSpeed = 3.2f;
        private const float RunSpeed = 6.5f;
        private const float HopSec = 0.5f;
        private const float HopHeight = 1.6f;
        private const float LeashM = 14f;
        private const float SameLevelM = 1.5f;
        private const float EngageFromPlayerM = 10f;

        [SerializeField] private int roleIndex;
        [SerializeField] private Style style;
        [SerializeField] private Animator animator;

        private Transform _player;
        private StoryPlayerController _playerPc;
        private float _vy;
        private float _facing = 1f;
        private float _attackLeft;
        private float _healLeft = 4f;
        private bool _hopping;
        private float _hopT;
        private Vector3 _hopFrom, _hopTo;
        private int _slot;

        public int RoleIndex => roleIndex;
        public Style CombatStyle => style;
        public Animator ModelAnimator => animator;
        public int Hits { get; private set; }
        public int Heals { get; private set; }
        public int Teleports { get; private set; }
        public int Hops { get; private set; }
        public StoryEnemy Target { get; private set; }

        // 역할별 수치 — 한 타 배율 · 간격(초) · 교전 거리(m).
        private float Mul => style == Style.Melee ? 0.35f : style == Style.Archer ? 0.3f : 0.22f;
        private float Interval => style == Style.Melee ? 1.1f : style == Style.Archer ? 1.6f : 2.2f;
        private float Reach => style == Style.Melee ? 1.5f : style == Style.Archer ? 8.5f : 6f;
        /// <summary>호법 — 적이 곁에 있을 때 8초마다 기력을 최대치의 12% 채운다(무예를 더 쓰게).</summary>
        public const float MysticHealSec = 8f;
        public const float MysticHealFrac = 0.12f;

        public static float BaseAtk => (StoryCombat.StartAtk + StoryJobState.AtkBonus + StoryLabyrinthState.MemoryAtkBonus)
            * StoryLabyrinthState.AtkMul;

        public void Configure(int role, Style s, Animator anim)
        {
            roleIndex = role;
            style = s;
            animator = anim;
        }

        /// <summary>곁에 선 둘 중 몇째인지(0 가까이 · 1 한 걸음 뒤) — 부대가 정한다.</summary>
        public void SetSlot(int slot) => _slot = slot;

        private void Awake()
        {
            var p = GameObject.FindWithTag("Player");
            if (p != null)
            {
                _player = p.transform;
                _playerPc = p.GetComponent<StoryPlayerController>();
            }
        }

        /// <summary>부대가 모습을 드러낼 때 — 플레이어 곁에서 튀어나온다.</summary>
        public void AppearBeside()
        {
            if (_player == null) return;
            _hopping = false;
            _vy = 0f;
            transform.position = new Vector3(_player.position.x - PlayerFacing() * (1.1f + _slot), _player.position.y, LaneZ);
            HitSpark.Spawn(transform.position + Vector3.up, false);
        }

        public void Step(float dt)
        {
            if (_player == null) return;
            _attackLeft = Mathf.Max(0f, _attackLeft - dt);
            _healLeft = Mathf.Max(0f, _healLeft - dt);

            Vector3 pos = transform.position;
            Vector3 pp = _player.position;

            if (Mathf.Abs(pp.x - pos.x) > LeashM || Mathf.Abs(pp.y - pos.y) > 6f)
            {
                Teleports++;
                AppearBeside();
                return;
            }

            if (_hopping)
            {
                _hopT += dt / HopSec;
                float t = Mathf.Clamp01(_hopT);
                var p = Vector3.Lerp(_hopFrom, _hopTo, t);
                p.y += Mathf.Sin(t * Mathf.PI) * HopHeight;
                transform.position = p;
                if (t >= 1f) _hopping = false;
                SetSpeed(1f);
                return;
            }

            bool grounded = ProbeGround(pos, out float groundY);
            // 플레이어가 땅에 서 있나 — isGrounded 는 Move() 뒤에만 갱신돼(순간이동 직후 거짓) 발밑 땅 찾기로 본다.
            bool playerGrounded = ProbeGround(pp, out float playerGround) && pp.y - playerGround < 0.2f;
            if (playerGrounded && grounded && Mathf.Abs(pp.y - groundY) > 0.8f && Mathf.Abs(pp.x - pos.x) < 7f)
            {
                StartHop(new Vector3(pp.x - PlayerFacing() * (1.1f + _slot), pp.y, LaneZ));
                return;
            }

            Target = PickTarget(pos);
            float moveX = 0f;
            float speed = 0f;
            if (Target != null)
            {
                float dx = Target.transform.position.x - pos.x;
                _facing = Mathf.Sign(dx == 0f ? _facing : dx);
                if (Mathf.Abs(dx) > Reach) { moveX = Mathf.Sign(dx); speed = RunSpeed; }
                else if (style != Style.Melee && Mathf.Abs(dx) < 2.5f) { moveX = -Mathf.Sign(dx); speed = WalkSpeed; } // 활·술사는 2.5m 안으로 붙으면 물러선다.
                if (Mathf.Abs(dx) <= Reach && _attackLeft <= 0f) Attack(Target);
            }
            else
            {
                float homeX = pp.x - PlayerFacing() * (1.1f + _slot);
                float dx = homeX - pos.x;
                if (Mathf.Abs(dx) > 0.4f)
                {
                    moveX = Mathf.Sign(dx);
                    speed = Mathf.Abs(dx) > 3f ? RunSpeed : WalkSpeed;
                    _facing = moveX;
                }
                else _facing = PlayerFacing();
            }

            if (style == Style.Mystic && _healLeft <= 0f && Target != null && StoryCombat.Mp < StoryCombat.MpMaxCurrent)
            {
                _healLeft = MysticHealSec;
                StoryCombat.RestoreMp(StoryCombat.Mp + StoryCombat.MpMaxCurrent * MysticHealFrac);
                Heals++;
                if (animator != null) animator.SetTrigger("Heal");
                HitSpark.Spawn(pp + Vector3.up * 1.2f, false);
            }

            pos.x += moveX * speed * dt;
            if (grounded && pos.y - groundY < 0.05f && _vy <= 0f)
            {
                pos.y = groundY;
                _vy = 0f;
            }
            else
            {
                _vy -= Gravity * dt;
                pos.y += _vy * dt;
                if (grounded && pos.y < groundY) { pos.y = groundY; _vy = 0f; }
            }
            pos.z = LaneZ;
            transform.position = pos;
            transform.rotation = Quaternion.Euler(0f, _facing > 0f ? 90f : -90f, 0f);
            SetSpeed(moveX == 0f ? 0f : speed >= RunSpeed ? 1f : 0.4f);
        }

        private void Update()
        {
            if (StoryCompanionSquad.PausedForTest) return;
            if (Saga.Story.Cinematics.StoryCutscenes.Playing)
            {
                SetSpeed(0f);
                return;
            }
            Step(Time.deltaTime);
        }

        private StoryEnemy PickTarget(Vector3 pos)
        {
            StoryEnemy best = null;
            float bestD = float.MaxValue;
            foreach (var e in StoryEnemy.All)
            {
                if (e == null || e.IsDead) continue;
                var ep = e.transform.position;
                if (Mathf.Abs(ep.y - pos.y) > SameLevelM) continue;                 // 다른 발판 위는 안 쫓는다.
                if (Mathf.Abs(ep.x - _player.position.x) > EngageFromPlayerM) continue; // 플레이어 곁 싸움만.
                float d = Mathf.Abs(ep.x - pos.x);
                if (d < bestD) { bestD = d; best = e; }
            }
            return best;
        }

        private void Attack(StoryEnemy target)
        {
            _attackLeft = Interval * StoryLabyrinthState.CooldownMul;
            if (animator != null) animator.SetTrigger("Attack");
            Hits++;
            if (style == Style.Archer)
            {
                // 화살 — 기탄(StoryBolt)의 관통 없는 판(좁고 긴 모양), 흙빛.
                var go = new GameObject("CompanionArrow");
                go.transform.position = transform.position + new Vector3(_facing * 0.5f, 1.3f, -LaneZ);
                var arrow = go.AddComponent<StoryBolt>();
                arrow.Configure(_facing, BaseAtk, Mul, null, false,
                    StoryCombat.BoltSpeed * 1.4f, StoryCombat.BoltLife, new Color(0.55f, 0.42f, 0.28f));
                arrow.FromCompanion = true;
                return;
            }
            var (dmg, crit) = StoryCombat.RollDamage(BaseAtk, Mul);
            StorySummonState.HitSource = StorySummonState.Source.Companion; // 소환 게이지 +1(플레이어 +3 보다 적게).
            target.TakeDamage(dmg, crit);
            StorySummonState.HitSource = StorySummonState.Source.Player;
        }

        private void StartHop(Vector3 to)
        {
            _hopping = true;
            _hopT = 0f;
            _hopFrom = transform.position;
            _hopTo = to;
            _vy = 0f;
            Hops++;
            _facing = Mathf.Sign(to.x - _hopFrom.x == 0f ? _facing : to.x - _hopFrom.x);
            transform.rotation = Quaternion.Euler(0f, _facing > 0f ? 90f : -90f, 0f);
        }

        private float PlayerFacing()
        {
            // 플레이어 몸("Visual")이 보는 쪽 — 2.5D 라 ±90° 둘뿐.
            var v = _playerPc != null && _playerPc.Visual != null ? _playerPc.Visual : _player;
            return v.forward.x >= 0f ? 1f : -1f;
        }

        /// <summary>제 발밑 땅 높이 — 발 위 1m 에서 아래로(플레이어·적·트리거는 빼고).</summary>
        private bool ProbeGround(Vector3 pos, out float groundY)
        {
            groundY = 0f;
            var hits = Physics.RaycastAll(new Vector3(pos.x, pos.y + 1f, 0f), Vector3.down, 40f, ~0, QueryTriggerInteraction.Ignore);
            float best = float.MaxValue;
            bool found = false;
            foreach (var h in hits)
            {
                if (h.collider.CompareTag("Player") || h.collider.GetComponentInParent<StoryEnemy>() != null) continue;
                if (h.collider.GetComponentInParent<StoryCompanion>() != null) continue;
                if (h.distance < best) { best = h.distance; groundY = h.point.y; found = true; }
            }
            return found;
        }

        private void SetSpeed(float s)
        {
            if (animator != null) animator.SetFloat("Speed", s);
        }
    }
}
