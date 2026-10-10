using UnityEngine;
using UnityEngine.InputSystem;
using Saga.Dungeon.Cinematics;
using Saga.Dungeon.Data;
using Saga.Dungeon.UI;
using Saga.Dungeon.World;
using Saga.Core;

namespace Saga.Dungeon.Player
{
    /// <summary>
    /// VERTICAL_SLICE_DUNGEON.md — SagaGo의 Player/PlayerController.cs를
    /// 그대로 복사(네임스페이스만 변경, 루트 CLAUDE.md "다섯 판은 다섯 벌
    /// 복사" 원칙을 이 Unity 트랙에도 적용 — SagaCore가 비어 있어 공유할
    /// 기반도 없다). 이동·중력·CharacterController 로직은 게임과 무관해서
    /// 새로 설계하지 않는다. **다음 슬라이스 "회피"만 DUNGEON 고유 로직이라
    /// 새로 짰다** — 웹판 `js/dungeon.js:2510` `doDodge()`의 실제 상수를
    /// 그대로 옮김: `DODGE_CD=0.9`·`DODGE_SEC=0.16`·`DODGE_INVULN=0.22`
    /// (전부 시간 단위라 변환 불필요). `DODGE_SPD=520`(px/초)만 물리 거리라
    /// `DungeonRoomBuilder.cs`가 이미 쓴 px→m 환산(ROOM_W 560px = 20m,
    /// 28px/m)을 그대로 적용해 이동 거리 ≈2.97m→3m으로 잡았다.
    ///
    /// "회피 애니메이션·이펙트" 슬라이스 — 당시엔 Animator/스켈레톤
    /// 애니메이션 재생 파이프라인이 전혀 없어서(캐릭터 GLB는
    /// `CharacterVisual.Spawn()`으로 정적으로 세울 뿐) `BanditEncounter.cs`가
    /// 이미 쓰는 절차적 연출 방식(Tint·Coroutine 스케일 펄스)과 같은 결로
    /// 세 가지를 코드로 직접 만들었다: **회전 애니메이션**(구르는 동작 —
    /// `visual`을 회피 방향으로 향하게 한 뒤 로컬 X축으로 360도 굴림,
    /// 정확히 한 바퀴라 끝나면 자동으로 다시 똑바로 섬), **잔상 이펙트**
    /// (`TrailRenderer`, 새 셰이더 없이 어디서나 되는 `Sprites/Default`),
    /// **무적 틴트**(`CharacterVisual.Tint()` 재사용 — 회피 대시(0.16초)
    /// 보다 긴 무적 시간(0.22초) 내내 옅은 하늘색으로 덮어써 "지금 안
    /// 맞는다"를 눈으로 알 수 있게).
    ///
    /// **44장 "Player" 교체(2026-09-13)** — Maria(Humanoid Animator,
    /// `BuildTestDungeonScene.BuildPlayerVisual` 참고)가 배정되면 `animator`가
    /// 채워진다. 그 경우 이동은 `Speed` 파라미터로 Idle/Walk/Run을 블렌드,
    /// 회피는 위 절차적 X축 롤 대신 `Dodge` 트리거(Maria의 실제 구르기
    /// 클립)를 쓴다 — 얼굴 방향만 맞추고 회전 자체는 클립에 맡긴다. Maria가
    /// 없어(로컬 전용 자산 미다운로드) character-a 폴백이 배정되면
    /// `animator`가 null이라 예전 절차적 롤이 그대로 쓰인다.
    ///
    /// **PLAN.md 106-5 "탐험"(2026-09-24)** — GO(107 ②)의 점프·등반·넘어오르기·내리막 붙이기를 던전 키(사람 1.8m,
    /// GO 3.4m 의 0.53배)로 줄여 옮겼다. 점프 = F·"점프" 버튼(Space 는 평타), 1.3m. 등반은 **`DungeonClimbable` 이
    /// 붙은 면만**(담쟁이 벽 — 방·복도 벽은 못 오른다, GO 는 반대로 `NoClimb` 만 뺀다), 스태미나 없음(던전엔 스태미나가
    /// 없다). 등반 중 F = 손 놓기. 활공·수영은 안 옮겼다(던전에 절벽·물이 없다). 진단은 `Step`·`SetTestInput` 으로 돌린다.
    /// </summary>
    [RequireComponent(typeof(CharacterController))]
    public class PlayerController : MonoBehaviour
    {
        private const float WalkSpeed = 6f;
        private const float RunSpeed = 10f;
        private const float Gravity = 20f;
        private const float TurnRate = 12f;

        private const float DodgeCooldownSec = 0.9f;   // dungeon.js DODGE_CD
        private const float DodgeDurationSec = 0.16f;  // dungeon.js DODGE_SEC
        private const float DodgeInvulnSec = 0.22f;    // dungeon.js DODGE_INVULN
        private const float DodgeDistance = 3f;        // DODGE_SPD(520px/s) × 0.16s ÷ 28px/m ≈ 2.97m
        private const float DodgeSpeed = DodgeDistance / DodgeDurationSec;

        private const float DodgeTrailFadeSec = 0.25f; // 대시보다 살짝 길게 남는 잔상
        private static readonly Color DodgeTintColor = new Color(0.75f, 0.92f, 1f); // 무적 동안 옅은 하늘색

        private const float FootprintIntervalSec = 0.35f; // PLAN.md 101-3 G "지형 반응" — 발자국 간격.

        // PLAN.md 106-1 "락온 중 이동" — 달리기 없이 대상을 보며 옆걸음.
        private const float LockMoveSpeed = 4.5f;
        private const float LockTurnRate = 14f;

        // PLAN.md 106-5 "탐험" — GO 값 × 0.53(사람 키 1.8/3.4)
        public enum MoveMode { Ground, Air, Climb, Mantle, Fly }
        public const float JumpVelocity = 7.2f;          // v²/2g = 1.3m
        public const float ClimbSpeed = 1.7f;
        public const float ClimbSideSpeed = 1.4f;
        private const float ClimbProbeHeight = 0.9f;     // 가슴 높이
        private const float KneeProbeHeight = 0.3f;
        private const float ClimbReach = 0.85f;          // 반지름 0.4 + 0.45
        private const float ClimbRegrabSec = 0.45f;
        private const float MantleSec = 0.4f;
        private const float GroundSnapDistance = 0.4f;

        [SerializeField] private Transform visual;
        [SerializeField] private Animator animator;
        [SerializeField] private CameraRig cameraRig;
        [SerializeField] private InputActionAsset inputActions;
        [SerializeField] private VirtualJoystick joystick;
        [SerializeField] private PlayerLockOn lockOn;

        /// <summary>PLAN.md 106-1 "완벽 회피" — 적 판정 순간 회피 무적 중이었으면
        /// `DungeonEnemy.ResolveStrike()`가 `ReportDodgedStrike()`로 쏜다.
        /// `PlayerCombat`이 받아 반격 창을 연다.</summary>
        public static event System.Action PerfectDodged;

        public static void ReportDodgedStrike() => PerfectDodged?.Invoke();

        // Maria.controller 에 락온 옆걸음 블렌드(`Editor/BuildMariaLockOnStrafe.cs`)가
        // 들어가 있을 때만 true — 없으면 걷기 클립 폴백.
        private bool _hasStrafeParams;
        private bool _strafeFlag;

        // PLAN.md 106-2 "밀기 블록" — 이번 프레임 입력의 월드 방향(카메라 기준, 길이 ≤1).
        // `TemplePushBlock`이 "블록 쪽으로 밀고 있는가"를 본다.
        private Vector3 _moveIntent;
        public Vector3 MoveIntent => _moveIntent;

        private CharacterController _controller;
        private InputAction _moveAction;
        private InputAction _sprintAction;
        private float _verticalVelocity;

        private float _dodgeTimeLeft;
        private float _dodgeCooldownLeft;
        private float _invulnTimeLeft;
        private Vector3 _dodgeDir;
        private TrailRenderer _dodgeTrail;
        private bool _wasInvulnerable;
        private float _footprintCooldown;

        public Transform Visual => visual;

        public MoveMode Mode { get; private set; } = MoveMode.Ground;
        /// <summary>등반·넘어오르기 중이면 true — 공격·회피·벽력탄을 막는다.</summary>
        public bool Climbing => Mode == MoveMode.Climb || Mode == MoveMode.Mantle;
        private bool _jumpQueued;
        private Vector3 _wallNormal;
        private float _regrabCooldown;
        private Vector3 _mantleFrom, _mantleTo;
        private float _mantleT;
        private bool _hasClimbParam, _hasJumpParam, _hasClimbRate;
        private bool _testInput;
        private Vector2 _testRaw;

        /// <summary>"점프" 버튼·진단이 부른다(다음 Step 에서 F 와 같게 처리).</summary>
        public void RequestJump() => _jumpQueued = true;

        /// <summary>진단용 — 입력을 월드 방향(x=+X, y=+Z)으로 곧장 준다.</summary>
        public void SetTestInput(Vector2 raw) { _testInput = true; _testRaw = raw; }
        public void ClearTestInput() { _testInput = false; _testRaw = Vector2.zero; _jumpQueued = false; }

        /// <summary>진단용 순간이동 — 상태도 땅/공중으로 다시 잡는다.</summary>
        public void Teleport(Vector3 pos)
        {
            _controller.enabled = false;
            transform.position = pos;
            _controller.enabled = true;
            _verticalVelocity = 0f;
            _dodgeTimeLeft = 0f;
            _regrabCooldown = 0f;
            Mode = HeightAboveGround() < 0.2f ? MoveMode.Ground : MoveMode.Air;
        }

        public float HeightAboveGround()
        {
            Vector3 origin = transform.position + Vector3.up * 0.3f;
            if (Physics.Raycast(origin, Vector3.down, out RaycastHit hit, 100f, ~0, QueryTriggerInteraction.Ignore))
                return hit.distance - 0.3f;
            return 100f;
        }

        /// <summary>Maria 배정 때만 non-null(위 클래스 주석 참고) — null이면
        /// 리깅 안 된 캐릭터라 PlayerCombat이 Attack/Death 트리거를 건너뛴다.</summary>
        public Animator Animator => animator;

        /// <summary>강공격(Player/PlayerCombat.cs)이 참고 — 웹판 heavyAttack()도
        /// `p.dodge`(회피 중) 동안엔 강공격을 막는다.</summary>
        public bool IsDodging => _dodgeTimeLeft > 0f;

        private void Awake()
        {
            _controller = GetComponent<CharacterController>();
            HeroTorch.Attach(transform); // tasks U-0082 — 방이 까맣지 않게 주인공 횃불 + 방 앰비언트

            if (inputActions != null)
            {
                var map = inputActions.FindActionMap("Player", throwIfNotFound: false);
                if (map != null)
                {
                    _moveAction = map.FindAction("Move");
                    _sprintAction = map.FindAction("Sprint");
                    map.Enable();
                }
            }

            if (joystick == null)
            {
                joystick = Object.FindFirstObjectByType<VirtualJoystick>();
            }

            if (animator == null)
            {
                animator = GetComponentInChildren<Animator>();
            }
            if (lockOn == null)
            {
                lockOn = GetComponent<PlayerLockOn>();
            }
            if (animator != null)
            {
                foreach (var p in animator.parameters)
                {
                    if (p.name == "LockOn") _hasStrafeParams = true;
                    else if (p.name == "Climb") _hasClimbParam = true;
                    else if (p.name == "Jump") _hasJumpParam = true;
                    else if (p.name == "ClimbRate") _hasClimbRate = true;
                }
            }

            _dodgeTrail = BuildDodgeTrail();
        }

        /// <summary>`PlayerCombat`이 타격 순간 몸을 대상 쪽으로 돌릴 때 쓴다.</summary>
        public void FaceToward(Vector3 worldPos)
        {
            if (visual == null) return;
            Vector3 dir = worldPos - transform.position;
            dir.y = 0f;
            if (dir.sqrMagnitude < 0.0001f) return;
            visual.rotation = Quaternion.Euler(0f, Mathf.Atan2(dir.x, dir.z) * Mathf.Rad2Deg, 0f);
        }

        private bool LockedOn => lockOn != null && lockOn.IsLocked;

        private void SetStrafeFlag(bool on)
        {
            if (!_hasStrafeParams || animator == null || _strafeFlag == on) return;
            _strafeFlag = on;
            animator.SetBool("LockOn", on);
            if (!on)
            {
                animator.SetFloat("MoveX", 0f);
                animator.SetFloat("MoveY", 0f);
            }
        }

        /// <summary>회피 잔상 — 회전 애니메이션과 달리 `visual`이 아니라
        /// 플레이어 루트(`transform`)에 붙인다(구르는 회전에 잔상 폭이
        /// 같이 뒤틀리지 않게).</summary>
        private TrailRenderer BuildDodgeTrail()
        {
            var trail = gameObject.AddComponent<TrailRenderer>();
            trail.time = DodgeTrailFadeSec;
            trail.startWidth = 0.5f;
            trail.endWidth = 0.05f;
            trail.minVertexDistance = 0.05f;
            trail.material = new Material(Shader.Find("Sprites/Default")) { name = "DodgeTrail (generated)" };
            trail.startColor = new Color(DodgeTintColor.r, DodgeTintColor.g, DodgeTintColor.b, 0.55f);
            trail.endColor = new Color(DodgeTintColor.r, DodgeTintColor.g, DodgeTintColor.b, 0f);
            trail.emitting = false;
            return trail;
        }

        private void Update() => Step(Time.deltaTime);

        /// <summary>한 프레임 — 진단이 시간을 건너뛰려고 직접 부른다.</summary>
        public void Step(float dt)
        {
            if (_regrabCooldown > 0f) _regrabCooldown -= dt;
            if (Mode == MoveMode.Mantle) { StepMantle(dt); SetModeParams(); return; }
            if (Mode == MoveMode.Fly && !DungeonMounts.RidingFly) Mode = MoveMode.Air; // 탈것에서 내렸다 — 떠 있던 자리에서 떨어진다

            if (_controller.isGrounded && _verticalVelocity < 0f)
            {
                _verticalVelocity = 0f;
            }
            if (Mode != MoveMode.Climb && Mode != MoveMode.Fly) _verticalVelocity -= Gravity * dt;

            if (_dodgeCooldownLeft > 0f) _dodgeCooldownLeft -= dt;
            if (_invulnTimeLeft > 0f) _invulnTimeLeft -= dt;
            bool invulnerableNow = _invulnTimeLeft > 0f;
            HeroState.Invulnerable = invulnerableNow;
            if (invulnerableNow != _wasInvulnerable && visual != null)
            {
                if (invulnerableNow) CharacterVisual.Tint(visual.gameObject, DodgeTintColor);
                else CharacterVisual.ClearTint(visual.gameObject);
            }
            _wasInvulnerable = invulnerableNow;

            if (DungeonCutscenes.Playing)
            {
                // PLAN.md 106-3 — 컷 동안은 서 있기만(중력만). 회피 대시도 그 자리에서 멈춘다.
                _moveIntent = Vector3.zero;
                _controller.Move(new Vector3(0f, _verticalVelocity, 0f) * dt);
                if (animator != null) animator.SetFloat("Speed", 0f);
                return;
            }

            var kb = Keyboard.current;
            if (!_testInput && SagaPad.Pressed(SagaPad.Btn.Dodge, kb?.leftCtrlKey)) // tasks U-0017 — 패드 B
            {
                TryDodge();
            }
            bool jumpPressed = _jumpQueued || (!_testInput && SagaPad.Pressed(SagaPad.Btn.Jump, kb?.fKey));
            _jumpQueued = false;

            Vector2 inputDir = MovementInput();
            Vector3 moveDir = WorldDirection(inputDir);
            _moveIntent = moveDir;

            if (Mode == MoveMode.Climb)
            {
                StepClimb(dt, inputDir, jumpPressed);
                SetModeParams();
                return;
            }
            // PLAN.md 109-15 — 비행 탈것: X 로 오르면 뜨고, 뜬 뒤엔 손을 떼도 그 높이(내려앉아 땅에 닿을 때까지).
            if (DungeonMounts.RidingFly && _dodgeTimeLeft <= 0f && (Mode == MoveMode.Fly || DungeonMounts.Lift > 0f))
            {
                StepFly(dt, moveDir);
                return;
            }
            if (jumpPressed && _dodgeTimeLeft <= 0f && _controller.isGrounded)
            {
                _verticalVelocity = JumpVelocity;
                if (animator != null && _hasJumpParam) animator.SetTrigger("Jump");
            }

            if (_dodgeTimeLeft > 0f)
            {
                _dodgeTimeLeft -= dt;
                Vector3 dash = _dodgeDir * DodgeSpeed;
                _controller.Move(new Vector3(dash.x, _verticalVelocity, dash.z) * dt);

                if (visual != null)
                {
                    float yaw = Mathf.Atan2(_dodgeDir.x, _dodgeDir.z) * Mathf.Rad2Deg;
                    if (animator != null)
                    {
                        // Maria의 "Dodge" 클립이 구르는 동작 자체를 담당 —
                        // 여기선 방향만 맞춘다(절차적 X축 롤과 안 겹치게).
                        visual.rotation = Quaternion.Euler(0f, yaw, 0f);
                    }
                    else
                    {
                        // 회피 방향을 향해 정확히 한 바퀴(360도) 구른다 —
                        // 끝나는 시점(progress=1)에 각도가 360도라 별도 복구
                        // 없이 저절로 다시 똑바로 선다.
                        float rollProgress = 1f - Mathf.Clamp01(_dodgeTimeLeft / DodgeDurationSec);
                        visual.rotation = Quaternion.Euler(0f, yaw, 0f) * Quaternion.Euler(rollProgress * 360f, 0f, 0f);
                    }
                }
                if (_dodgeTimeLeft <= 0f && _dodgeTrail != null)
                {
                    _dodgeTrail.emitting = false; // 대시 끝 — 남은 잔상은 trail.time 동안 저절로 흐려짐.
                }

                return; // 회피 중엔 일반 이동·회전 입력을 무시 — dungeon.js도 dodge 중엔 p.dirX/Y를 안 봄.
            }

            if (LockedOn)
            {
                UpdateLockedMove(moveDir, dt);
                UpdateGroundMode();
                SetModeParams();
                return;
            }
            SetStrafeFlag(false);

            bool running = !_testInput && _sprintAction != null && _sprintAction.IsPressed();
            float speed = (running ? RunSpeed : WalkSpeed) * DungeonMounts.GroundMul; // PLAN.md 109-15 — 안 탔으면 ×1

            Vector3 horizontal = moveDir * speed;
            bool wasGrounded = _controller.isGrounded && _verticalVelocity <= 0f;
            _controller.Move(new Vector3(horizontal.x, _verticalVelocity, horizontal.z) * dt);
            // 106-5 내리막 붙이기(GO 107-3 과 같은 결) — 방금까지 딛고 있었고 뛰어오르는 중이 아니며 발밑이 가까우면 붙인다.
            if (!_controller.isGrounded && wasGrounded && _verticalVelocity <= 0f)
            {
                float h = HeightAboveGround();
                if (h > 0f && h < GroundSnapDistance)
                {
                    _controller.Move(Vector3.down * (h + 0.05f));
                    if (_controller.isGrounded) _verticalVelocity = 0f;
                }
            }
            UpdateGroundMode();
            SetModeParams();
            if (moveDir.sqrMagnitude > 0.05f * 0.05f && TryStartClimb(moveDir)) return;

            if (animator != null)
            {
                // Maria.controller의 Idle→Walk(>0.1)→Run(>0.6) 문턱과
                // 겹치지 않게 0/0.5/1로 확실히 갈라 준다.
                bool moving = moveDir.sqrMagnitude > 0.05f * 0.05f;
                animator.SetFloat("Speed", moving ? (running ? 1f : 0.5f) : 0f);
            }

            if (moveDir.sqrMagnitude > 0.05f * 0.05f)
            {
                if (visual != null)
                {
                    float targetYaw = Mathf.Atan2(moveDir.x, moveDir.z) * Mathf.Rad2Deg;
                    float yaw = Mathf.LerpAngle(visual.eulerAngles.y, targetYaw, TurnRate * dt);
                    visual.rotation = Quaternion.Euler(0f, yaw, 0f);
                }

                // PLAN.md 101-3 G "지형 반응" — 걷는 동안 일정 간격으로 발자국.
                _footprintCooldown -= dt;
                if (_footprintCooldown <= 0f)
                {
                    _footprintCooldown = FootprintIntervalSec;
                    GroundDecal.Spawn(transform.position, GroundDecal.Kind.Footprint);
                }
            }
        }

        /// <summary>PLAN.md 106-1 — 락온 중엔 몸이 늘 대상을 보고, 입력은
        /// 카메라 기준(카메라가 대상 쪽을 따라가므로 위=다가가기·아래=물러서기·
        /// 좌우=돌기)으로 옆걸음한다. 옆걸음 블렌드가 있으면 몸 기준 MoveX/MoveY 를 준다.</summary>
        private void UpdateLockedMove(Vector3 moveDir, float dt)
        {
            Vector3 horizontal = moveDir * (LockMoveSpeed * DungeonMounts.GroundMul);
            _controller.Move(new Vector3(horizontal.x, _verticalVelocity, horizontal.z) * dt);

            Vector3 toTarget = lockOn.Target.transform.position - transform.position;
            toTarget.y = 0f;
            if (visual != null && toTarget.sqrMagnitude > 0.0001f)
            {
                float targetYaw = Mathf.Atan2(toTarget.x, toTarget.z) * Mathf.Rad2Deg;
                float yaw = Mathf.LerpAngle(visual.eulerAngles.y, targetYaw, LockTurnRate * dt);
                visual.rotation = Quaternion.Euler(0f, yaw, 0f);
            }

            bool moving = moveDir.sqrMagnitude > 0.05f * 0.05f;
            if (animator != null)
            {
                SetStrafeFlag(true);
                animator.SetFloat("Speed", moving ? 0.5f : 0f);
                if (_hasStrafeParams && visual != null)
                {
                    Vector3 local = moving ? moveDir.normalized : Vector3.zero;
                    animator.SetFloat("MoveX", Vector3.Dot(local, visual.right), 0.1f, dt);
                    animator.SetFloat("MoveY", Vector3.Dot(local, visual.forward), 0.1f, dt);
                }
            }

            if (moving)
            {
                _footprintCooldown -= dt;
                if (_footprintCooldown <= 0f)
                {
                    _footprintCooldown = FootprintIntervalSec;
                    GroundDecal.Spawn(transform.position, GroundDecal.Kind.Footprint);
                }
            }
        }

        /// <summary>회피 트리거 — 데스크톱은 Update()의 Left Ctrl, 모바일은
        /// 화면 "회피" 버튼(OnClick)이 직접 부른다(PlayerCombat.cs의
        /// TriggerAttack()과 같은 결).</summary>
        public void TryDodge()
        {
            if (_dodgeCooldownLeft > 0f || _dodgeTimeLeft > 0f || DungeonCutscenes.Playing || Climbing) return;

            Vector3 dir = WorldDirection(MovementInput());
            if (dir.sqrMagnitude < 0.0001f)
            {
                if (LockedOn)
                {
                    // PLAN.md 106-1 — 락온 중 입력 없이 회피하면 백스텝(대상 반대쪽).
                    dir = transform.position - lockOn.Target.transform.position;
                }
                else
                {
                    dir = visual != null ? visual.forward : transform.forward;
                }
            }
            dir.y = 0f;
            if (dir.sqrMagnitude < 0.0001f) dir = transform.forward;
            dir.Normalize();

            _dodgeDir = dir;
            _dodgeTimeLeft = DodgeDurationSec;
            _dodgeCooldownLeft = DodgeCooldownSec;
            _invulnTimeLeft = DodgeInvulnSec;
            // 같은 프레임에 판정하는 적(예비동작 끝)도 무적을 보게 바로 올린다 —
            // Update()가 다음 프레임부터 _invulnTimeLeft 로 다시 계산한다.
            HeroState.Invulnerable = true;

            animator?.SetTrigger("Dodge");

            if (_dodgeTrail != null)
            {
                _dodgeTrail.Clear(); // 이전 잔상과 안 이어붙게.
                _dodgeTrail.emitting = true;
            }
        }

        private Vector2 MovementInput()
        {
            if (_testInput) return _testRaw;
            if (joystick != null && joystick.Value.sqrMagnitude > 0.05f * 0.05f)
            {
                return joystick.Value;
            }
            return _moveAction != null ? _moveAction.ReadValue<Vector2>() : Vector2.zero;
        }

        private Vector3 WorldDirection(Vector2 inputDir)
        {
            if (inputDir.sqrMagnitude < 0.001f) return Vector3.zero;
            if (_testInput)
            {
                Vector3 t = new Vector3(inputDir.x, 0f, inputDir.y);
                return t.sqrMagnitude > 1f ? t.normalized : t;
            }

            Transform basis = cameraRig != null ? cameraRig.transform : transform;
            Vector3 forward = basis.forward; forward.y = 0f; forward.Normalize();
            Vector3 right = basis.right; right.y = 0f; right.Normalize();

            Vector3 dir = forward * inputDir.y + right * inputDir.x;
            if (dir.sqrMagnitude > 1f) dir.Normalize();
            return dir;
        }
        // ---- PLAN.md 109-15 탈것·비행 ------------------------------------------------------

        /// <summary>비행 탈것을 탄 채 한 프레임 — 오르내림은 `DungeonMounts.Lift`(X·Z·▲▼), 높이는 지면 위 <c>Mount.Ceil</c> 까지,
        /// 뜬 동안 속도는 <c>Mount.Fly</c> 배. 뜬 채로는 칸 밖(던전 문·바깥 벽)으로 못 나간다(가장자리는 미끄러진다).</summary>
        private void StepFly(float dt, Vector3 moveDir)
        {
            var m = DungeonMounts.Riding;
            Mode = MoveMode.Fly;
            float h = HeightAboveGround();
            float lift = DungeonMounts.Lift;
            float vy = lift > 0f ? (h >= m.Ceil ? 0f : DungeonMounts.Rise) : lift < 0f ? -DungeonMounts.Fall : 0f;
            bool running = !_testInput && _sprintAction != null && _sprintAction.IsPressed();
            float speed = (running ? RunSpeed : WalkSpeed) * (DungeonMounts.Airborne(h) ? m.Fly : m.Mul);
            Vector3 horizontal = moveDir * speed;
            Vector3 p = transform.position;
            if (horizontal.sqrMagnitude > 0f && DungeonWorldMap.IndexAt(p + horizontal * dt) < 0)
            {
                var onlyX = new Vector3(horizontal.x, 0f, 0f);
                var onlyZ = new Vector3(0f, 0f, horizontal.z);
                if (DungeonWorldMap.IndexAt(p + onlyX * dt) >= 0) horizontal = onlyX;
                else if (DungeonWorldMap.IndexAt(p + onlyZ * dt) >= 0) horizontal = onlyZ;
                else horizontal = Vector3.zero;
            }
            _verticalVelocity = vy;
            _controller.Move(new Vector3(horizontal.x, vy, horizontal.z) * dt);
            if (lift <= 0f && _controller.isGrounded) { Mode = MoveMode.Ground; _verticalVelocity = 0f; } // 내려앉아 땅에 닿았다 — 탄 채로 걷는다
            SetModeParams();
            bool moving = moveDir.sqrMagnitude > 0.05f * 0.05f;
            if (animator != null) animator.SetFloat("Speed", moving ? (running ? 1f : 0.5f) : 0f);
            if (moving && visual != null)
            {
                float targetYaw = Mathf.Atan2(moveDir.x, moveDir.z) * Mathf.Rad2Deg;
                float yaw = Mathf.LerpAngle(visual.eulerAngles.y, targetYaw, TurnRate * dt);
                visual.rotation = Quaternion.Euler(0f, yaw, 0f);
            }
        }

        // ---- PLAN.md 106-5 탐험 — 땅/공중·등반·넘어오르기 ----------------------------------

        private void UpdateGroundMode()
        {
            if (Mode == MoveMode.Ground || Mode == MoveMode.Air)
                Mode = _controller.isGrounded ? MoveMode.Ground : MoveMode.Air;
        }

        private void SetModeParams()
        {
            if (animator == null) return;
            if (_hasClimbParam) animator.SetBool("Climb", Mode == MoveMode.Climb);
        }

        /// <summary>가슴·무릎 높이 광선이 둘 다 `DungeonClimbable` 의 가파른 면에 닿는 쪽으로 밀면 붙는다.</summary>
        private bool TryStartClimb(Vector3 dir)
        {
            if (_regrabCooldown > 0f || LockedOn) return false;
            dir.y = 0f;
            if (dir.sqrMagnitude < 0.0001f) return false;
            dir.Normalize();
            Vector3 p = transform.position;
            if (!ProbeWall(p + Vector3.up * ClimbProbeHeight, dir, ClimbReach, out RaycastHit chest)) return false;
            if (!ProbeWall(p + Vector3.up * KneeProbeHeight, dir, ClimbReach + 0.2f, out _)) return false;
            Vector3 n = chest.normal; n.y = 0f;
            if (n.sqrMagnitude < 0.0001f || Vector3.Dot(dir, -n.normalized) < 0.5f) return false;
            _wallNormal = n.normalized;
            Mode = MoveMode.Climb;
            _verticalVelocity = 0f;
            if (visual != null) visual.rotation = Quaternion.LookRotation(-_wallNormal);
            return true;
        }

        private static bool ProbeWall(Vector3 origin, Vector3 dir, float dist, out RaycastHit hit)
        {
            if (!Physics.Raycast(origin, dir, out hit, dist, ~0, QueryTriggerInteraction.Ignore)) return false;
            if (hit.normal.y >= 0.5f) return false;
            return hit.collider.GetComponentInParent<DungeonClimbable>() != null;
        }

        private void StepClimb(float dt, Vector2 raw, bool jumpPressed)
        {
            Vector3 p = transform.position;
            Vector3 into = -_wallNormal;
            if (!ProbeWall(p + Vector3.up * ClimbProbeHeight, into, ClimbReach + 0.3f, out RaycastHit hit))
            {
                // 가슴 높이에 벽이 없다 — 무릎엔 있으면 꼭대기 턱이라 넘어오르고, 없으면 벽이 끝나 떨어진다.
                if (ProbeWall(p + Vector3.up * KneeProbeHeight, into, ClimbReach + 0.3f, out _) && BeginMantle(into)) return;
                Drop(false);
                return;
            }
            Vector3 n = hit.normal; n.y = 0f;
            if (n.sqrMagnitude > 0.0001f) _wallNormal = n.normalized;
            into = -_wallNormal;
            if (jumpPressed) { Drop(true); return; }

            bool moving = raw.sqrMagnitude > 0.05f * 0.05f;
            Vector3 right = Vector3.Cross(Vector3.up, into);
            Vector3 vel = Vector3.up * (raw.y * ClimbSpeed) + right * (raw.x * ClimbSideSpeed);
            float gap = hit.distance - (_controller.radius + 0.03f);
            vel += into * Mathf.Clamp(gap / Mathf.Max(dt, 0.001f), -3f, 3f);
            _controller.Move(vel * dt);
            if (visual != null) visual.rotation = Quaternion.LookRotation(into);
            if (animator != null)
            {
                animator.SetFloat("Speed", _hasClimbParam ? 0f : (moving ? 0.5f : 0f));
                if (_hasClimbRate) animator.SetFloat("ClimbRate", moving ? (raw.y < -0.1f ? -1f : 1f) : 0f);
            }
            if (raw.y < -0.1f && _controller.isGrounded) Mode = MoveMode.Ground; // 내려와 땅에 닿음
        }

        /// <summary>등반을 놓는다. `pushOff` 면 벽에서 살짝 뛰어 떨어진다(F).</summary>
        private void Drop(bool pushOff)
        {
            Mode = MoveMode.Air;
            _regrabCooldown = ClimbRegrabSec;
            _verticalVelocity = pushOff ? 2f : 0f;
            if (pushOff) _controller.Move(_wallNormal * 0.6f);
        }

        /// <summary>꼭대기 턱 너머 딛을 자리를 찾아 넘어오른다. 못 찾으면 false.</summary>
        private bool BeginMantle(Vector3 into)
        {
            Vector3 p = transform.position;
            Vector3 scan = p + Vector3.up * (ClimbProbeHeight + 1.9f) + into * (_controller.radius + 0.75f);
            if (!Physics.Raycast(scan, Vector3.down, out RaycastHit top, 3.2f, ~0, QueryTriggerInteraction.Ignore)) return false;
            if (top.normal.y < 0.6f || top.point.y < p.y) return false;
            _mantleFrom = p;
            _mantleTo = top.point + Vector3.up * 0.05f;
            _mantleT = 0f;
            Mode = MoveMode.Mantle;
            _controller.enabled = false;
            return true;
        }

        private void StepMantle(float dt)
        {
            _mantleT += dt / MantleSec;
            float t = Mathf.Clamp01(_mantleT);
            float up = Mathf.SmoothStep(0f, 1f, Mathf.Clamp01(t / 0.6f));
            float fwd = Mathf.SmoothStep(0f, 1f, Mathf.Clamp01((t - 0.4f) / 0.6f));
            Vector3 flat = Vector3.Lerp(new Vector3(_mantleFrom.x, 0f, _mantleFrom.z), new Vector3(_mantleTo.x, 0f, _mantleTo.z), fwd);
            transform.position = new Vector3(flat.x, Mathf.Lerp(_mantleFrom.y, _mantleTo.y, up), flat.z);
            if (t >= 1f)
            {
                _controller.enabled = true;
                Mode = MoveMode.Ground;
                _verticalVelocity = 0f;
                _regrabCooldown = ClimbRegrabSec;
            }
        }
    }
}
