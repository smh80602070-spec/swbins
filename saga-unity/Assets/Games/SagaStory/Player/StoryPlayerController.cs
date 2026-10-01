using UnityEngine;
using Saga.Core;
using UnityEngine.InputSystem;
using Saga.Story.Data;
using Saga.Story.UI;
using Saga.Story.World;

namespace Saga.Story.Player
{
    /// <summary>
    /// VERTICAL_SLICE_STORY.md 1·2·3절 — 2.5D 플랫포머 이동+공격.
    /// saga-godot `story_player.gd`와 같은 설계를 Unity 관용구로 새로 짰다
    /// (기계적 번역 아님 — 루트 CLAUDE.md 2장). 이 판은 **가로(X)·높이(Y)
    /// 평면에만** 움직인다(2절 "Z는 이번 슬라이스에서 고정") — 세로 입력
    /// (W/S, 위/아래 버튼)은 이동에 안 쓰고 줄 오르내리기 전용으로 돌린다.
    ///
    /// 물리 상수는 VERTICAL_SLICE_STORY.md 2절 그대로(비율만 웹과 맞춘
    /// 재설계, 원문 픽셀값을 그대로 옮기지 않는다).
    /// </summary>
    [RequireComponent(typeof(CharacterController))]
    public class StoryPlayerController : MonoBehaviour
    {
        private const float Gravity = 36f;
        private const float JumpSpeed = 15f;
        private const float RunSpeed = 6f;
        private const float ClimbSpeed = 4f;
        private const float TurnRate = 12f; // DUNGEON PlayerController.cs와 같은 결 — LerpAngle의 보간 배율(각속도 아님).
        private const float AttackRange = 2.2f;
        private const float AttackCooldown = 0.36f; // 무예 연참(連斬) cd 0.36(js/data-job.js)
        private const float FootprintIntervalSec = 0.35f; // PLAN.md 101-3 G "지형 반응" — 발자국 간격, DUNGEON/GO PlayerController.cs와 같은 값.

        [SerializeField] private Transform visual;
        // 44장 "Player" 교체 — Maria가 배정되면 채워짐(BuildTestStoryScene.
        // BuildPlayerVisual 참고). Speed+Attack, 109-11-1 부터 두목 패턴에 맞으면
        // Hit(`StoryPlayerVitals`).
        [SerializeField] private Animator animator;

        // PLAN.md 101-3 G "장비 가시화"(2026-09-18, `StoryWeaponVisual.cs`
        // 전용) — DUNGEON/GO `PlayerController.Visual`/`.Animator`와 같은 결.
        public Transform Visual => visual;
        public Animator Animator => animator;
        [SerializeField] private HoldButton leftButton;
        [SerializeField] private HoldButton rightButton;
        [SerializeField] private HoldButton climbUpButton;
        [SerializeField] private HoldButton climbDownButton;

        private CharacterController _controller;
        private float _verticalVelocity;
        private float _facing = 1f; // +1 오른쪽, -1 왼쪽
        private float _attackCooldownLeft;
        private float _sweepCooldownLeft;
        private float _boltCooldownLeft;
        private float _braceCooldownLeft;
        private float _footprintCooldown;
        // 강화 칸 하나 — 웹판 `side.js` p.buff처럼 기합·직업 강화 무예(철갑·응안·급소·부적)가
        // 같은 칸을 쓰고, 나중에 건 것이 앞의 것을 덮는다(곱해 쌓지 않는다).
        private float _buffUntilTime; // Time.time 기준
        private float _buffAtk = 1f;
        private float _buffSpeed = 1f;
        private float _buffRegen = 1f;
        private readonly System.Collections.Generic.Dictionary<string, float> _skillCooldownLeft =
            new System.Collections.Generic.Dictionary<string, float>();
        private StoryRope _ropeArea;
        private bool _onRope;

        // PLAN.md 109-15 탈것·비행 — 날갯짓 쉼·모바일 점프 단추의 공중 눌림(날갯짓 요청)·날개 탈것이 뜬 채인가.
        private float _flapCooldownLeft;
        private bool _jumpQueued;
        public bool FlyActive { get; private set; }

        /// <summary>PLAN.md 109-15 — 공격·무예를 쓸 때마다 쏜다(탈것에서 저절로 내린다 — 메이플의 "탈것 위에선 못 싸운다").</summary>
        public static event System.Action Attacked;
        public static void NotifyAttacked() => Attacked?.Invoke();

        private bool BuffActive => Time.time < _buffUntilTime;

        /// <summary>PLAN.md 106-10 소환 — 지금 한 타의 공격력(소환 피해 = 이 값 × 8), 줄에 매달렸는지(매달리면 못 부른다).</summary>
        public float AttackPower => CurrentAtk;
        public bool OnRope => _onRope;

        /// <summary>side.js buffOn().atk와 같은 자리 — 기합이 켜져 있으면
        /// 연참·횡소·기탄 전부 이 값으로 굴린다. 2026-09-15 — 전직으로
        /// 얻은 grow.atk(StoryJobState.AtkBonus)를 기초값 위에 얹는다.
        /// 101-2 5-3 "비경"(2026-09-20) — 영구 강화(StoryLabyrinthState.
        /// MemoryAtkBonus, 기억 조각으로 산 것 — 평소에도 적용)와 회차
        /// 중 공격 축복(AtkMul, 회차 밖엔 항상 1)을 더 얹는다. 101-2 5-8
        /// "동료 교대"(2026-09-21) — 활성 역할의 공격 배율(웹판 "인물의
        /// 몸" 재해석)도 곱한다.</summary>
        private float CurrentAtk => (StoryCombat.StartAtk + StoryJobState.AtkBonus + StoryLabyrinthState.MemoryAtkBonus)
            * (BuffActive ? _buffAtk : 1f) * StoryLabyrinthState.AtkMul * StoryPartyState.AtkMultiplier;

        private void Awake()
        {
            _controller = GetComponent<CharacterController>();
            if (visual != null) visual.rotation = Quaternion.Euler(0f, 90f, 0f);
            // PLAN.md 109-11-1 — 플레이어 체력(두목 패턴이 때린다). Play 때 붙어 씬 재빌드가 필요 없다.
            if (Application.isPlaying && GetComponent<StoryPlayerVitals>() == null) gameObject.AddComponent<StoryPlayerVitals>();
        }

        private void Update() => Step(Time.deltaTime);

        // 진단용(PLAN.md 109-15) — 가로 입력을 곧장 주고(−1~1), 시간을 건너뛰며 한 프레임씩 굴린다.
        private bool _testInput;
        private float _testAxis;
        public void SetTestAxis(float axis) { _testInput = true; _testAxis = axis; }
        public void ClearTestInput() { _testInput = false; _testAxis = 0f; _jumpQueued = false; }
        /// <summary>진단용 순간이동 — 세로 속도도 비운다.</summary>
        public void Teleport(Vector3 pos)
        {
            _controller.enabled = false;
            transform.position = pos;
            _controller.enabled = true;
            _verticalVelocity = 0f;
        }

        /// <summary>한 프레임 — 진단이 시간을 건너뛰려고 직접 부른다.</summary>
        public void Step(float dt)
        {
            // PLAN.md 106-8 — 두목 등장 컷 동안은 선다(입력·이동·중력 전부 — 짧은 컷이라 땅 위에서만 튼다).
            if (Saga.Story.Cinematics.StoryCutscenes.Playing)
            {
                if (animator != null) animator.SetFloat("Speed", 0f);
                return;
            }
            _attackCooldownLeft = Mathf.Max(0f, _attackCooldownLeft - dt);
            _sweepCooldownLeft = Mathf.Max(0f, _sweepCooldownLeft - dt);
            _boltCooldownLeft = Mathf.Max(0f, _boltCooldownLeft - dt);
            _braceCooldownLeft = Mathf.Max(0f, _braceCooldownLeft - dt);
            TickSkillCooldowns(dt);
            StoryCombat.TickMpRegen(dt, BuffActive ? _buffRegen : 1f);
            StoryPartyState.TickCooldown(dt); // 101-2 5-8 "동료 교대".
            CheckRope();

            if (_onRope && _ropeArea != null) Climb(dt);
            else Walk(dt);

            // 2절 "Z는 이번 슬라이스에서 고정" — 바닥·발판 충돌의 얕은
            // Z폭에서 모서리에 살짝 밀릴 수 있어 되돌린다. **실제로 겪은
            // 결함** — `p.z != 0f`(정확히 0과 비교)로 짰더니 부동소수점
            // 잔차(예: Move()의 충돌 슬라이딩이 남기는 1e-6 수준의 Z)가
            // 항상 걸려 매 프레임 CharacterController를 껐다 켰다 — 그
            // 결과 로프 트리거가 매 프레임 Enter→Exit를 반복해 실제로는
            // 로프 위에 서 있어도 `_ropeArea`가 널로 보였다(PlaytestStorySlice.cs
            // 가 잡아냈다). 무시해도 되는 잡음과 실제 밀림을 문턱값으로 가른다.
            var p = transform.position;
            if (Mathf.Abs(p.z) > 0.01f)
            {
                p.z = 0f;
                _controller.enabled = false;
                transform.position = p;
                _controller.enabled = true;
            }

            if (WantsAttack()) TryAttack();
            if (WantsSweep()) TrySweep();
            if (WantsBolt()) TryBolt();
            if (WantsBrace()) TryBrace();
            for (int i = 0; i < StorySkillState.SlotCount; i++)
            {
                if (WantsJobSkill(i)) TriggerJobSkill(i);
            }
        }

        /// <summary>모바일 무예 칸 버튼(`StorySkillSlotButton`)·숫자키 5~8이 부른다 —
        /// 칸이 비었으면(아직 안 찍음) 조용히 무시.</summary>
        public void TriggerJobSkill(int slot)
        {
            var sk = StorySkillState.SlotSkill(slot);
            if (sk != null) TryCastJobSkill(sk);
        }

        /// <summary>무예 칸 버튼이 쿨다운을 어둡게 그리려고 읽는다.</summary>
        public float JobSkillCooldownLeft(string key) =>
            key != null && _skillCooldownLeft.TryGetValue(key, out var left) ? left : 0f;

        private void TickSkillCooldowns(float dt)
        {
            if (_skillCooldownLeft.Count == 0) return;
            var keys = new System.Collections.Generic.List<string>(_skillCooldownLeft.Keys);
            foreach (var k in keys) _skillCooldownLeft[k] = Mathf.Max(0f, _skillCooldownLeft[k] - dt);
        }

        /// <summary>PLAN.md 101-2 5-2 1단계 — 1차 직업 무예 하나를 쓴다. 웹판 `side.js`
        /// castBody()의 effect 갈래를 이 트랙 채널로 옮겼다(heal·guard·invuln은
        /// `StorySkillData` 클래스 주석대로 빠짐). 레벨 0이면 못 쓴다(웹판 원작 그대로).</summary>
        private bool TryCastJobSkill(StorySkillData.Skill sk)
        {
            if (StorySkillState.LevelOf(sk.Key) <= 0) return false;
            if (JobSkillCooldownLeft(sk.Key) > 0f) return false;
            if (!StoryCombat.TrySpendMp(sk.Cost)) return false;
            NotifyAttacked();

            // 5-2 2단계 유파 세트 — 판정은 StorySkillState.BonusOf() 한 곳, 여기선 제자리에
            // 곱하거나 더할 뿐(웹판 castSkill()의 `var sb = JB.schoolBonus(sk)`와 같은 결).
            var sb = StorySkillState.BonusOf(sk);
            float cooldown = sk.Cooldown * StoryLabyrinthState.CooldownMul * sb.CooldownMul;
            _skillCooldownLeft[sk.Key] = cooldown;

            float mul = StorySkillState.MulOf(sk) * sb.DmgMul;
            int shots = sk.Shots + sb.ShotsAdd;
            LastCast = (sk.Key, mul, sk.RadiusM * sb.AoeMul, shots, sk.BuffSec * sb.BuffMul, cooldown, sb.CritForce);
            switch (sk.Effect)
            {
                case StorySkillData.Effect.Melee: CastMelee(mul, sk.Hits); break;
                case StorySkillData.Effect.Aoe: CastAoe(mul, sk.RadiusM * sb.AoeMul); break;
                case StorySkillData.Effect.Bolt: SpawnShot(mul, true, StoryCombat.BoltSpeed, StoryCombat.BoltLife, 1f, new Color(0.35f, 0.65f, 0.95f)); break;
                case StorySkillData.Effect.Arrow: SpawnShot(mul, false, ArrowSpeed, StoryCombat.BoltLife, 1f, ArrowColor); break;
                case StorySkillData.Effect.Volley:
                    for (int j = 0; j < shots; j++)
                    {
                        // 웹판: 높이를 0.16 P_H씩 달리하고 속도를 34px/s씩 올려 한 줄로 안 겹치게.
                        // 발수가 5를 넘으면(만천화우+세트) 높이는 넷마다 되돌아온다.
                        SpawnShot(mul, false, (600f + j * 34f) * FieldMapData.ScaleMPerPx, 1.1f, 0.7f + 0.3f * (j % 4), ArrowColor);
                    }
                    break;
                case StorySkillData.Effect.Dash: CastDash(mul, sk.DistM, sk.Backward, sb.CritForce); break;
                case StorySkillData.Effect.Buff: SetBuff(sk.BuffSec * sb.BuffMul, sk.BuffAtk, sk.BuffSpeed, sk.BuffRegen); break;
                case StorySkillData.Effect.Rain: CastRain(mul); break;
            }
            if (sk.Effect != StorySkillData.Effect.Buff) PlayAttackAnim();
            return true;
        }

        /// <summary>진단용 — 마지막 직업 무예 시전에 실제로 쓰인 값(세트 보정 적용 뒤).</summary>
        public (string key, float mul, float radius, int shots, float buffSec, float cooldown, bool critForce) LastCast { get; private set; }

        /// <summary>웹판 rain — 바라보는 쪽 앞 넓은 띠(가로 340px+몸 폭, 위 220px~아래 80px)에
        /// 쏟는다. 서 있는 높이와 상관없이 위아래로 넓다(2차 전우·천뢰, 2026-09-23).</summary>
        private void CastRain(float mul)
        {
            const float Px = FieldMapData.ScaleMPerPx;
            float x0 = transform.position.x, x1 = x0 + _facing * (340f + 34f) * Px;
            float lo = Mathf.Min(x0, x1), hi = Mathf.Max(x0, x1);
            float footY = transform.position.y;
            bool hitAny = false, anyCrit = false;
            foreach (var enemy in StoryEnemy.All)
            {
                if (enemy == null || enemy.IsDead) continue;
                var p = enemy.transform.position;
                if (p.x < lo || p.x > hi || p.y > footY + 220f * Px || p.y < footY - 80f * Px) continue;
                var (dmg, crit) = StoryCombat.RollDamage(CurrentAtk, mul);
                enemy.TakeDamage(dmg, crit);
                if (crit) StoryCombat.TriggerHitstop(this);
                hitAny = true;
                anyCrit |= crit;
            }
            ApplyHitFeedback(hitAny, anyCrit);
        }

        private const float ArrowSpeed = 640f * FieldMapData.ScaleMPerPx; // side.js arrow spd 640px/s
        private static readonly Color ArrowColor = new Color(0.85f, 0.75f, 0.45f);

        private void CastMelee(float mul, int hits)
        {
            bool hitAny = false, anyCrit = false;
            foreach (var enemy in StoryEnemy.All)
            {
                if (enemy == null || enemy.IsDead) continue;
                float dx = enemy.transform.position.x - transform.position.x;
                if (Mathf.Abs(dx) > AttackRange) continue;
                if (Mathf.Abs(dx) > 0.3f && !Mathf.Approximately(Mathf.Sign(dx), _facing)) continue;
                for (int h = 0; h < hits && !enemy.IsDead; h++)
                {
                    var (dmg, crit) = StoryCombat.RollDamage(CurrentAtk, mul);
                    enemy.TakeDamage(dmg, crit);
                    if (crit) StoryCombat.TriggerHitstop(this);
                    hitAny = true;
                    anyCrit |= crit;
                }
            }
            ApplyHitFeedback(hitAny, anyCrit);
        }

        private void CastAoe(float mul, float radius)
        {
            bool hitAny = false, anyCrit = false;
            Vector2 origin = new Vector2(transform.position.x, transform.position.y);
            foreach (var enemy in StoryEnemy.All)
            {
                if (enemy == null || enemy.IsDead) continue;
                Vector2 pos = new Vector2(enemy.transform.position.x, enemy.transform.position.y);
                if (Vector2.Distance(origin, pos) > radius) continue;
                var (dmg, crit) = StoryCombat.RollDamage(CurrentAtk, mul);
                enemy.TakeDamage(dmg, crit);
                if (crit) StoryCombat.TriggerHitstop(this);
                hitAny = true;
                anyCrit |= crit;
            }
            ApplyHitFeedback(hitAny, anyCrit);
        }

        private void SpawnShot(float mul, bool pierce, float speed, float life, float height, Color color)
        {
            var go = new GameObject("StoryBolt");
            go.transform.position = transform.position + new Vector3(_facing * 0.6f, height, 0f);
            go.AddComponent<StoryBolt>().Configure(_facing, CurrentAtk, mul, animator, pierce, speed, life, color);
        }

        /// <summary>웹판 dash — 밀고 나간 뒤 지나간 자리(가로 구간, 발 높이 차 60px≈1.2m 안)의
        /// 적을 벤다. 벽은 CharacterController.Move()가 막는다(웹판 clamp 대신).</summary>
        private void CastDash(float mul, float dist, bool backward, bool critForce = false)
        {
            float fromX = transform.position.x;
            float dir = backward ? -_facing : _facing;
            _onRope = false;
            _controller.Move(new Vector3(dir * dist, 0f, 0f));
            float toX = transform.position.x;
            float lo = Mathf.Min(fromX, toX) - 0.3f, hi = Mathf.Max(fromX, toX) + 0.3f;
            float footY = transform.position.y;

            bool hitAny = false, anyCrit = false;
            foreach (var enemy in StoryEnemy.All)
            {
                if (enemy == null || enemy.IsDead) continue;
                var p = enemy.transform.position;
                if (p.x < lo || p.x > hi || Mathf.Abs(p.y - footY) > 1.2f) continue;
                var (dmg, crit) = StoryCombat.RollDamage(CurrentAtk, mul, critForce); // 유파 dash 4세트 — 급소 확정
                enemy.TakeDamage(dmg, crit);
                if (crit) StoryCombat.TriggerHitstop(this);
                hitAny = true;
                anyCrit |= crit;
            }
            ApplyHitFeedback(hitAny, anyCrit);
        }

        private void SetBuff(float sec, float atk, float speed, float regen)
        {
            _buffUntilTime = Time.time + sec;
            _buffAtk = atk;
            _buffSpeed = speed;
            _buffRegen = regen;
        }

        /// <summary>모바일 "공격" 버튼(OnClick)이 부른다 — 쿨다운 확인은
        /// TryAttack() 안에서 하므로 이 경로도 DUNGEON PlayerCombat.cs의
        /// TriggerAttack()과 같이 쿨다운을 그대로 존중한다.</summary>
        public void TriggerAttack() => TryAttack();

        /// <summary>모바일 "횡소"·"기탄"·"기합" 버튼(OnClick)이 부른다 —
        /// 위 TriggerAttack()과 같은 결.</summary>
        public void TriggerSweep() => TrySweep();
        public void TriggerBolt() => TryBolt();
        public void TriggerBrace() => TryBrace();

        /// <summary>모바일 "선봉/유격/호법" 교대 버튼(OnClick)이 부른다 —
        /// 101-2 5-8 "동료 교대". 교대 자체가 성사됐을 때만(쿨다운 중이면
        /// 조용히 무시, `StoryHud`가 쿨다운 남은 시간을 상시 보여준다)
        /// 그 역할의 서명을 무료로(MP 소모 없이, 그 무예 자신의 쿨다운은
        /// 그대로 존중 — "새 효과 없음" 원칙대로 기존 셋을 그대로 쓴다)
        /// 즉시 발동한다.</summary>
        public void TriggerPartySwap(int index)
        {
            if (!StoryPartyState.TrySwap(index)) return;
            TriggerCompanionSignature(StoryPartyState.Active.Signature);
            DialogueLabel.Instance?.Show(
                string.Format(StoryLocalization.T("party.swapped_toast", "{0}(으)로 교대! 서명을 발동했다."), StoryPartyState.Active.DisplayName),
                2.5f);
        }

        private void TriggerCompanionSignature(StoryPartyState.Signature signature)
        {
            switch (signature)
            {
                case StoryPartyState.Signature.Sweep: TrySweep(free: true); break;
                case StoryPartyState.Signature.Bolt: TryBolt(free: true); break;
                case StoryPartyState.Signature.Brace: TryBrace(free: true); break;
            }
        }

        /// <summary>모바일 "점프" 버튼(OnClick)이 부른다.</summary>
        public void TriggerJump()
        {
            if (_onRope) return;
            if (_controller.isGrounded) _verticalVelocity = JumpSpeed * StoryMounts.JumpMul;
            else _jumpQueued = true; // 공중이면 날갯짓 요청(날개 탈것이 아니면 다음 Walk 에서 그냥 버려진다)
        }

        private void TryAttack()
        {
            if (_attackCooldownLeft > 0f) return;
            _attackCooldownLeft = AttackCooldown * StoryLabyrinthState.CooldownMul;
            NotifyAttacked();
            PlayAttackAnim();

            bool hitAny = false;
            bool anyCrit = false;
            foreach (var enemy in StoryEnemy.All)
            {
                if (enemy == null) continue;
                float dx = enemy.transform.position.x - transform.position.x;
                if (Mathf.Abs(dx) > AttackRange) continue;
                if (Mathf.Abs(dx) > 0.3f && !Mathf.Approximately(Mathf.Sign(dx), _facing)) continue; // 등 뒤는 안 맞는다.

                var (dmg, crit) = StoryCombat.RollDamage(CurrentAtk);
                enemy.TakeDamage(dmg, crit);
                if (crit) StoryCombat.TriggerHitstop(this);
                hitAny = true;
                anyCrit |= crit;
            }
            ApplyHitFeedback(hitAny, anyCrit);
        }

        /// <summary>횡소(橫掃) — data-job.js sweep, aoe. 등 뒤·앞 구분 없이
        /// 반경 안 전부(side.js castSkill() effect==='aoe'와 같은 결).
        /// <paramref name="free"/>=true(101-2 5-8 "동료 교대" 서명 전용)면
        /// MP를 안 쓴다 — 이 무예 자신의 쿨다운은 그대로 존중한다.</summary>
        private void TrySweep(bool free = false)
        {
            if (_sweepCooldownLeft > 0f) return;
            if (!free && !StoryCombat.TrySpendMp(StoryCombat.SweepCost)) return;
            _sweepCooldownLeft = StoryCombat.SweepCooldown * StoryLabyrinthState.CooldownMul;
            NotifyAttacked();
            PlayAttackAnim();

            bool hitAny = false;
            bool anyCrit = false;
            Vector2 origin = new Vector2(transform.position.x, transform.position.y);
            foreach (var enemy in StoryEnemy.All)
            {
                if (enemy == null) continue;
                Vector2 pos = new Vector2(enemy.transform.position.x, enemy.transform.position.y);
                if (Vector2.Distance(origin, pos) > StoryCombat.SweepRadius) continue;

                var (dmg, crit) = StoryCombat.RollDamage(CurrentAtk, StoryCombat.SweepMul);
                enemy.TakeDamage(dmg, crit);
                if (crit) StoryCombat.TriggerHitstop(this);
                hitAny = true;
                anyCrit |= crit;
            }
            ApplyHitFeedback(hitAny, anyCrit);
        }

        /// <summary>PLAN.md 101-2 STORY "5-7 손맛 표준"(2026-09-17, 101-3 C
        /// 표) — 크리티컬 슬로모(`StoryCombat.TriggerHitstop`, 웹판 원문
        /// 기능)와 별개로 **모든 타격**에 카메라 흔들림 + 짧은 Animator
        /// 정지를 건다. 한 번의 공격이 여럿을 때려도(횡소) 한 번만 건다 —
        /// DUNGEON `PlayerCombat.TryWhirl()`과 같은 결.</summary>
        private void ApplyHitFeedback(bool hitAny, bool anyCrit)
        {
            if (!hitAny) return;
            StoryCameraFollow.Instance?.Shake(
                anyCrit ? StoryCombat.CritShakeMag : StoryCombat.HitShakeMag,
                anyCrit ? StoryCombat.CritShakeSec : StoryCombat.HitShakeSec);
            StoryCombat.ApplyHitFreeze(this, animator);
        }

        /// <summary>기탄(氣彈) — data-job.js bolt, 관통 투사체
        /// (`StoryBolt.cs` 참고). <paramref name="free"/>는 TrySweep()과 같은 뜻.</summary>
        private void TryBolt(bool free = false)
        {
            if (_boltCooldownLeft > 0f) return;
            if (!free && !StoryCombat.TrySpendMp(StoryCombat.BoltCost)) return;
            _boltCooldownLeft = StoryCombat.BoltCooldown * StoryLabyrinthState.CooldownMul;
            NotifyAttacked();
            PlayAttackAnim();

            var go = new GameObject("StoryBolt");
            go.transform.position = transform.position + new Vector3(_facing * 0.6f, 1f, 0f);
            go.AddComponent<StoryBolt>().Configure(_facing, CurrentAtk, StoryCombat.BoltMul, animator);
        }

        /// <summary>기합(氣合) — data-job.js brace, buff. 8초간 공격·이동
        /// 배율만 올린다(side.js buffOn()과 달리 guard·regen은 이 슬라이스가
        /// 아직 안 쓰는 축이라 배선 안 함 — RunSpeed·CurrentAtk 둘만).
        /// <paramref name="free"/>는 TrySweep()과 같은 뜻.</summary>
        private void TryBrace(bool free = false)
        {
            if (_braceCooldownLeft > 0f) return;
            if (!free && !StoryCombat.TrySpendMp(StoryCombat.BraceCost)) return;
            _braceCooldownLeft = StoryCombat.BraceCooldown * StoryLabyrinthState.CooldownMul;
            NotifyAttacked();
            SetBuff(StoryCombat.BraceSeconds, StoryCombat.BraceAtkMul, StoryCombat.BraceSpeedMul, 1f);
        }

        private void Walk(float dt)
        {
            if (_controller.isGrounded && _verticalVelocity < 0f) _verticalVelocity = 0f;
            // PLAN.md 109-15 탈것·비행 — 날개 탈것(두목 없는 사냥터)은 중력 ×0.22·낙하 상한이 걸리고, 공중에서 점프를 다시 누르면 날갯짓.
            bool fly = StoryMounts.CanFlyNow(_onRope);
            _flapCooldownLeft = Mathf.Max(0f, _flapCooldownLeft - dt);
            _verticalVelocity -= Gravity * (fly ? StoryMounts.FlyGrav : 1f) * dt;
            if (fly && _verticalVelocity < -StoryMounts.FlyFallCap) _verticalVelocity = -StoryMounts.FlyFallCap;

            bool jumpPressed = WantsJump() || _jumpQueued;
            _jumpQueued = false;
            if (_controller.isGrounded && jumpPressed) _verticalVelocity = JumpSpeed * StoryMounts.JumpMul;
            else if (fly && !_controller.isGrounded && jumpPressed && _flapCooldownLeft <= 0f)
            {
                _verticalVelocity = JumpSpeed * StoryMounts.FlapVy;
                _flapCooldownLeft = StoryMounts.FlapCd;
            }
            if (fly)
            {
                // 맨 위 천장에서 멎는다(웹 y=20px).
                float ceilY = FieldMapData.HeightOfPx(StoryMounts.CeilPx);
                float y = transform.position.y;
                if (y >= ceilY && _verticalVelocity > 0f) _verticalVelocity = 0f;
                else if (_verticalVelocity > 0f && y + _verticalVelocity * dt > ceilY) _verticalVelocity = Mathf.Max(0f, (ceilY - y) / Mathf.Max(dt, 0.0001f));
            }
            FlyActive = fly && !_controller.isGrounded;

            float axis = HorizontalInput();
            if (Mathf.Abs(axis) > 0.05f)
            {
                _facing = Mathf.Sign(axis);
                if (visual != null)
                {
                    float targetYaw = _facing > 0f ? 90f : -90f;
                    visual.rotation = Quaternion.Euler(0f, Mathf.LerpAngle(visual.eulerAngles.y, targetYaw, TurnRate * dt), 0f);
                }
            }

            float runSpeed = RunSpeed * (BuffActive ? _buffSpeed : 1f) * StoryLabyrinthState.MoveSpeedMul * StoryMounts.SpeedMul; // 109-15 — 안 탔으면 ×1
            var move = new Vector3(axis * runSpeed, _verticalVelocity, 0f);
            _controller.Move(move * dt);

            if (animator != null)
            {
                animator.SetFloat("Speed", Mathf.Abs(axis) > 0.05f ? 1f : 0f);
            }

            // PLAN.md 101-3 G "지형 반응" — 땅 위를 걷는 동안 일정 간격으로 발자국.
            if (Mathf.Abs(axis) > 0.05f && _controller.isGrounded)
            {
                _footprintCooldown -= dt;
                if (_footprintCooldown <= 0f)
                {
                    _footprintCooldown = FootprintIntervalSec;
                    StoryGroundDecal.Spawn(transform.position, StoryGroundDecal.Kind.Footprint);
                }
            }
        }

        /// <summary>연참·횡소·기탄·기합 넷 다 검을 쓰는 동작이라 Maria.controller의
        /// 단일 "Attack" 트리거 하나로 같이 재생한다(무기별로 다른 클립을
        /// 만드는 건 이번 슬라이스 범위 밖).
        /// `animator?.`(null-조건 연산자)는 안 쓴다 — Maria 애셋이 없어(로컬
        /// 전용, mixamo.com) 캡슐 폴백으로 지어진 씬은 이 필드가 "진짜 C#
        /// null"이 아니라 "직렬화 때 한 번도 안 채워진" UnityEngine.Object라
        /// `?.`가 놓치고 그대로 호출해 UnassignedReferenceException을 던진다
        /// (Update()의 `if (animator != null)`과 같은 이유로 여기도 맞춘다,
        /// 2026-09-17 PlaytestStorySlice 3연속 재검증에서 발견).</summary>
        private void PlayAttackAnim()
        {
            if (animator != null) animator.SetTrigger("Attack");
        }

        /// <summary>줄 안에서는 중력이 없다 — 세로 입력을 오르내리기 전용으로
        /// 빌려 쓴다. 가로 입력이 세게 들어오면(> 0.3) 손을 놓은 것으로
        /// 본다(웹판엔 없는 규칙 — 로프에서 못 내려오는 사고를 막으려고
        /// 직접 정함, saga-godot도 같은 이유로 같은 값을 씀).</summary>
        private void Climb(float dt)
        {
            if (Mathf.Abs(HorizontalInput()) > 0.3f)
            {
                _onRope = false;
                return;
            }

            float vertical = ClimbInput();
            var pos = transform.position;
            pos.x = _ropeArea.RopeX;
            pos.y = Mathf.Clamp(pos.y + vertical * ClimbSpeed * dt, _ropeArea.Bottom, _ropeArea.Top);

            _controller.enabled = false;
            transform.position = pos;
            _controller.enabled = true;
            _verticalVelocity = 0f;

            if (WantsJump())
            {
                _onRope = false;
                _verticalVelocity = JumpSpeed * 0.6f;
            }
        }

        private void CheckRope()
        {
            if (_onRope || _ropeArea == null) return;
            if (Mathf.Abs(ClimbInput()) > 0.05f) _onRope = true;
        }

        /// <summary>StoryRope.cs가 트리거 진입/이탈 때 부른다(플레이어는
        /// CharacterController라 자기 쪽엔 트리거 콜백이 없다 — 줄 쪽에서
        /// 알려 주는 방향으로 배선했다).</summary>
        public void SetRopeArea(StoryRope rope) => _ropeArea = rope;

        public void ClearRopeArea(StoryRope rope)
        {
            if (_ropeArea == rope)
            {
                _ropeArea = null;
                _onRope = false;
            }
        }

        private float HorizontalInput()
        {
            if (_testInput) return _testAxis;
            float v = 0f;
            var kb = Keyboard.current;
            if (kb != null)
            {
                if (kb.aKey.isPressed || kb.leftArrowKey.isPressed) v -= 1f;
                if (kb.dKey.isPressed || kb.rightArrowKey.isPressed) v += 1f;
            }
            v += SagaPad.Stick(SagaPad.Side.Left).x; // tasks U-0018 — 왼쪽 스틱
            if (leftButton != null && leftButton.IsHeld) v -= 1f;
            if (rightButton != null && rightButton.IsHeld) v += 1f;
            return Mathf.Clamp(v, -1f, 1f);
        }

        private float ClimbInput()
        {
            float v = 0f;
            var kb = Keyboard.current;
            if (kb != null)
            {
                if (kb.sKey.isPressed || kb.downArrowKey.isPressed) v -= 1f;
                if (kb.wKey.isPressed || kb.upArrowKey.isPressed) v += 1f;
            }
            v += SagaPad.Stick(SagaPad.Side.Left).y;
            if (climbDownButton != null && climbDownButton.IsHeld) v -= 1f;
            if (climbUpButton != null && climbUpButton.IsHeld) v += 1f;
            return Mathf.Clamp(v, -1f, 1f);
        }

        private bool WantsJump()
        {
            var kb = Keyboard.current;
            return SagaPad.Pressed(SagaPad.Btn.Jump, kb?.spaceKey);
        }

        private bool WantsAttack()
        {
            var kb = Keyboard.current;
            return SagaPad.Pressed(SagaPad.Btn.Attack, kb?.jKey);
        }

        // 무예 넷 중 연참(J)만 기존 배선 — 나머지 셋은 숫자키로(모바일은
        // Trigger*() 버튼, BuildTestStoryScene.cs 참고).
        private bool WantsSweep()
        {
            var kb = Keyboard.current;
            return SagaPad.Pressed(SagaPad.Btn.Skill, kb?.digit2Key);
        }

        private bool WantsBolt()
        {
            var kb = Keyboard.current;
            return SagaPad.Pressed(SagaPad.Btn.Burst, kb?.digit3Key);
        }

        private bool WantsBrace()
        {
            var kb = Keyboard.current;
            return SagaPad.Pressed(SagaPad.Btn.Aim, kb?.digit4Key);
        }

        // 직업 무예 칸 넷 — 공통 무예(1~4) 바로 다음 숫자 5~8.
        private bool WantsJobSkill(int slot)
        {
            var kb = Keyboard.current;
            switch (slot)
            {
                case 0: return SagaPad.Pressed(SagaPad.Btn.Slot1, kb?.digit5Key);
                case 1: return SagaPad.Pressed(SagaPad.Btn.Slot2, kb?.digit6Key);
                case 2: return SagaPad.Pressed(SagaPad.Btn.Slot3, kb?.digit7Key);
                case 3: return SagaPad.Pressed(SagaPad.Btn.Slot4, kb?.digit8Key);
                default: return false;
            }
        }
    }
}
