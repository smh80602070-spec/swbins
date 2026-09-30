using UnityEngine;
using UnityEngine.InputSystem;
using Saga.Go.Combat;
using Saga.Go.Data;
using Saga.Go.UI;
using Saga.Go.World;
using Saga.Core;

namespace Saga.Go.Player
{
    /// <summary>
    /// VERTICAL_SLICE.md Phase 4 — 이동(조이스틱 우선, 없으면 Move
    /// 액션(WASD/화살표) 폴백) · 달리기(Sprint) · 중력 · CharacterController
    /// 충돌 · 이동 방향으로 몸통 회전. 수치는 saga-godot의 player.gd를
    /// 그대로 가져왔다(새로 설계하지 않는다).
    ///
    /// 아직 GLB 캐릭터가 없어 Visual은 primitive Capsule이다(PLAN.md 8장
    /// "Placeholder는 개발 초기 테스트용" — saga-godot도 처음엔 캡슐이었다
    /// 가 2026-09-11에 GLB로 바꿨다). 애니메이션 재생(idle/walk/sprint)은
    /// GLB가 들어온 뒤에 붙인다.
    ///
    /// **PLAN.md 107 ② "이동"(2026-09-24)** — 원신식 이동 상태 여섯: 지상·공중(점프 Space)·등반(가파른 면을
    /// 향해 밀면 붙는다, 꼭대기에서 넘어오르기, Space 도약/아래+Space 놓기)·넘어오르기·활공(공중 발밑 4m+ 에서
    /// Space)·수영(강 칸 수면 아래로 빠지면). 스태미나(`GoStamina`)를 달리기·회피와 같이 쓴다. 등반·활공·수영은
    /// `traversal` 이 켜진 씬(TestVillage)만 — LayoutWalk 같은 다른 씬은 점프까지만.
    /// </summary>
    [RequireComponent(typeof(CharacterController))]
    public class PlayerController : MonoBehaviour
    {
        public enum MoveMode { Ground, Air, Climb, Mantle, Glide, Swim, Fly }

        private const float WalkSpeed = 6f;
        private const float RunSpeed = 10f;
        private const float GroundSnapDistance = 0.6f; // 107-3 내리막 붙이기(달리기 10m/s·45° 한 프레임 낙차보다 넉넉히)
        private const float Gravity = 20f;
        private const float TurnRate = 12f; // Godot lerp_angle(from,to,weight)의 weight와 같은 순수 보간 계수(각도 단위 아님)

        // PLAN.md 107 ② — GO 사람 키 3.4m(실측 약 1.85배) 기준. Godot 사가고 점프 1.4m → 2.4m.
        public const float JumpVelocity = 9.8f;          // v²/2g = 2.4m
        public const float ClimbSpeed = 3.2f;
        public const float ClimbSideSpeed = 2.6f;
        public const float ClimbStaminaPerSec = 6f;
        public const float ClimbIdleStaminaPerSec = 1.5f;
        public const float ClimbLeapCost = 15f;
        public const float ClimbLeapHeight = 3f;
        private const float ClimbLeapSec = 0.3f;
        private const float ClimbProbeHeight = 1.7f;     // 가슴 높이
        private const float KneeProbeHeight = 0.5f;
        private const float ClimbReach = 1.6f;           // 반지름 0.9 + 0.7
        private const float ClimbRegrabSec = 0.45f;
        private const float MantleSec = 0.45f;
        public const float GlideMinHeight = 4f;
        public const float GlideSpeed = 10f;
        public const float GlideFallSpeed = 3f;
        public const float GlideStaminaPerSec = 5f;

        // ---- PLAN.md 109-14-20 바람 기둥(웹 사가고 ⑲-20 landform) — 켜져 있으면 기둥 안 공중(점프)에서 저절로 활공하고 초당 Rise m 로
        // 솟다가 Top 에서 멎는다(기력 안 씀). 땅에 선 채로는 안 뜬다. 기둥 안에서 접으면(점프) 기둥을 나갈 때까지 안 편다. `StoryField` 가 켠다.
        // ---- PLAN.md 109-14-22 활 조준 — 켜져 있으면 걷지 않고(방향 입력은 `AimInput` 으로 넘겨 겨눈 쪽을 돌린다), 점프하면 풀린다(`AimCancelled`).
        public bool MoveLocked { get; set; }
        public Vector2 AimInput { get; private set; }
        public bool AimCancelled { get; set; }

        public static bool DraftOn;
        public static Vector3 DraftBase;
        public static float DraftR, DraftTop, DraftRise = 9f;
        private bool _draftFolded;
        /// <summary>109-14-35 구름섬 바람 기둥 말고 더 있는 솟는 기둥(시간 기둥) — 밑자리·반지름·솟는 높이.</summary>
        public struct DraftCol { public Vector3 Base; public float R, Top; public bool Has(Vector3 p) { float dx = p.x - Base.x, dz = p.z - Base.z; return dx * dx + dz * dz <= R * R && p.y > Base.y - 1f && p.y < Top + 3f; } }
        public static readonly System.Collections.Generic.List<DraftCol> ExtraDrafts = new System.Collections.Generic.List<DraftCol>();
        public static bool InDraft(Vector3 p)
        {
            foreach (var d in ExtraDrafts) if (d.Has(p)) return true;
            if (!DraftOn) return false;
            float dx = p.x - DraftBase.x, dz = p.z - DraftBase.z;
            return dx * dx + dz * dz <= DraftR * DraftR && p.y > DraftBase.y - 1f && p.y < DraftTop + 3f;
        }
        /// <summary>p 가 든 기둥의 솟는 높이(없으면 구름섬 기둥 것).</summary>
        public static float DraftTopAt(Vector3 p)
        {
            foreach (var d in ExtraDrafts) if (d.Has(p)) return d.Top;
            return DraftTop;
        }
        public const float SwimDepth = 2.6f;             // 수면에서 발까지 — 머리가 다리 널판 밑을 지난다
        public const float SwimSpeed = 4f;
        public const float SwimFastSpeed = 7f;
        public const float SwimStaminaPerSec = 2f;
        public const float SwimFastStaminaPerSec = 12f;
        private const float LastLandIntervalSec = 0.5f;

        [SerializeField] private Transform visual;
        [SerializeField] private CameraRig cameraRig;
        [SerializeField] private InputActionAsset inputActions;
        [SerializeField] private VirtualJoystick joystick;
        // 44장 "Player" 교체 — Maria(리깅+Animator)가 배정되면 채워진다
        // (BuildTestVillageScene.BuildPlayerVisual 참고). null이면(character-a
        // 폴백 등) 예전처럼 몸통 회전만 하고 애니메이션은 안 돈다 — 씬이 안 깨짐
        // (Saga.Dungeon.Player.PlayerController와 같은 결).
        [SerializeField] private Animator animator;
        // PLAN.md 107 ② — 등반·활공·수영을 켤지(씬 빌더가 TestVillage 에만 켠다).
        [SerializeField] private bool traversal;

        // PLAN.md 101-3 C hitstop(2026-09-17) — BanditEncounter/RareWolfEncounter가
        // 타격 순간 잠깐 멈추려고 읽는다(DUNGEON `PlayerCombat.cs`의 같은 이름
        // 프로퍼티와 같은 결).
        public Animator Animator => animator;

        /// <summary>PLAN.md 101-3 G "장비 가시화"(2026-09-17) — `WeaponVisual`이
        /// 무기 소켓을 심을 자리를 찾으려고 읽는다(DUNGEON `PlayerController.
        /// Visual`과 같은 결).</summary>
        public Transform Visual => visual;

        private const float FootprintIntervalSec = 0.35f; // PLAN.md 101-3 G "지형 반응" — 발자국 간격.

        private CharacterController _controller;
        private InputAction _moveAction;
        private InputAction _sprintAction;
        private InputAction _jumpAction;
        private float _verticalVelocity;
        private float _footprintCooldown;

        // PLAN.md 107-1 "회피" — 들판 전투(`FieldCombat`)가 부르는 짧은 대시. 무적은 FieldCombat 몫.
        private float _dashTimeLeft;
        private Vector3 _dashVelocity;

        // PLAN.md 107 ② 이동 상태
        public MoveMode Mode { get; private set; } = MoveMode.Ground;
        // PLAN.md 109-14-2 낙하 공격 — 활공 중 공격을 누르면 날개를 접고 곧게 내리꽂는다, 땅에 닿으면 떨어진 높이(m)를 알린다
        public bool Plunging => _plunging;
        public event System.Action<float> PlungeLanded;
        private bool _plunging;
        private float _plungeTop;
        private float _plungeSpeed;
        public Vector3 LastLand { get; private set; }
        public bool Traversal => traversal;
        private bool _jumpQueued;
        private Vector3 _wallNormal;
        private float _leapLeft;
        private float _regrabCooldown;
        private Vector3 _mantleFrom, _mantleTo;
        private float _mantleT;
        private float _lastLandTimer;
        private GameObject _wings;
        private bool _hasClimbParam, _hasGlideParam, _hasSwimParam, _hasJumpParam, _hasClimbRate;

        // 진단용 입력 대체 — raw.x=오른쪽, raw.y=앞(월드 +X/+Z 로 곧장, 카메라 무시). 등반 중엔 raw.y=위.
        private bool _testInput;
        private Vector2 _testRaw;
        private bool _testSprint;

        public bool IsDashing => _dashTimeLeft > 0f;
        /// <summary>들판 전투가 공격·회피를 받아 줄 수 있는 자세인가(땅을 딛고 있을 때만).</summary>
        public bool OnFoot => Mode == MoveMode.Ground;

        /// <summary>PLAN.md 107-1 — `dir` 쪽으로 `seconds` 동안 `distance` 만큼 미끄러진다(입력 무시).
        /// Maria 면 구르기 클립(`Dodge` 트리거).</summary>
        public void Dash(Vector3 dir, float distance, float seconds)
        {
            dir.y = 0f;
            if (dir.sqrMagnitude < 0.0001f) dir = visual != null ? visual.forward : transform.forward;
            dir.Normalize();
            _dashVelocity = dir * (distance / Mathf.Max(0.01f, seconds));
            _dashTimeLeft = seconds;
            if (visual != null) visual.rotation = Quaternion.LookRotation(dir);
            if (animator != null) animator.SetTrigger("Dodge");
        }

        /// <summary>109-14-43 별배 견인줄 — `height` m 위로 솟구친다(v = √(2gh)). 공중이 되어 점프 단추로 날개(활공)를 펼 수 있다.</summary>
        public void Launch(float height)
        {
            _verticalVelocity = Mathf.Sqrt(2f * Gravity * Mathf.Max(0f, height));
            Mode = MoveMode.Air;
            _plunging = false;
            if (animator != null && _hasJumpParam) animator.SetTrigger("Jump");
        }

        /// <summary>`FieldCombat` 이 공격 순간 몸을 대상 쪽으로 돌릴 때.</summary>
        public void FaceToward(Vector3 worldPos)
        {
            if (visual == null) return;
            Vector3 d = worldPos - transform.position;
            d.y = 0f;
            if (d.sqrMagnitude < 0.0001f) return;
            visual.rotation = Quaternion.LookRotation(d);
        }

        /// <summary>현재 입력의 월드 방향(카메라 기준, 길이 ≤1) — 회피 방향용.</summary>
        public Vector3 MoveIntent => WorldDirection(RawInput());

        /// <summary>쓰러져 마을로 돌아갈 때 — CharacterController 는 꺼야 순간이동이 먹는다.</summary>
        public void Teleport(Vector3 pos)
        {
            _controller.enabled = false;
            transform.position = pos;
            _controller.enabled = true;
            _verticalVelocity = 0f;
            _dashTimeLeft = 0f;
            _leapLeft = 0f;
            _plunging = false;
            Mode = HeightAboveGround() < 0.3f ? MoveMode.Ground : MoveMode.Air;
            if (Mode != MoveMode.Ground && GoMounts.Riding != null) GoMounts.Dismount(); // 109-15 공중으로 옮겨졌으면 탈것에서 내린다
            SetWings(false);
        }

        /// <summary>109-14-2 — 활공 중이고 발밑이 minHeight 넘으면 내리꽂기 시작(초당 speed m). 아니면 false.</summary>
        public bool TryPlunge(float minHeight, float speed)
        {
            if (Mode != MoveMode.Glide || HeightAboveGround() < minHeight) return false;
            _plunging = true;
            _plungeTop = transform.position.y;
            _plungeSpeed = speed;
            _verticalVelocity = -speed;
            Mode = MoveMode.Air;
            SetWings(false);
            return true;
        }

        /// <summary>모바일 "점프" 버튼·진단이 부른다(다음 Step 에서 Space 와 같게 처리).</summary>
        public void RequestJump() => _jumpQueued = true;

        public void SetTestInput(Vector2 raw, bool sprint)
        {
            _testInput = true;
            _testRaw = raw;
            _testSprint = sprint;
        }

        public void ClearTestInput()
        {
            _testInput = false;
            _testRaw = Vector2.zero;
            _testSprint = false;
        }

        private void Awake()
        {
            _controller = GetComponent<CharacterController>();
            LastLand = transform.position;

            if (inputActions != null)
            {
                var map = inputActions.FindActionMap("Player", throwIfNotFound: false);
                if (map != null)
                {
                    _moveAction = map.FindAction("Move");
                    _sprintAction = map.FindAction("Sprint");
                    _jumpAction = map.FindAction("Jump");
                    map.Enable();
                }
            }

            if (joystick == null)
            {
                joystick = Object.FindFirstObjectByType<VirtualJoystick>();
            }

            CacheAnimatorParams();
            if (traversal) _wings = BuildWings();
        }

        private void CacheAnimatorParams()
        {
            _hasClimbParam = _hasGlideParam = _hasSwimParam = _hasJumpParam = _hasClimbRate = false;
            if (animator == null) return;
            foreach (var p in animator.parameters)
            {
                if (p.name == "Climb") _hasClimbParam = true;
                else if (p.name == "Glide") _hasGlideParam = true;
                else if (p.name == "Swim") _hasSwimParam = true;
                else if (p.name == "Jump") _hasJumpParam = true;
                else if (p.name == "ClimbRate") _hasClimbRate = true;
            }
        }

        /// <summary>PLAN.md 107-6 "동료 모델" — 나선 인물의 몸으로 갈아 끼운다(`PartyBodies` 가 부른다).
        /// 보던 방향을 넘기고, 옛 몸은 끄고, 활공 날개를 새 몸 등으로 옮긴다. Animator 파라미터 유무도 다시 센다.</summary>
        public void SetBody(Transform newVisual, Animator newAnimator)
        {
            if (newVisual == null || newVisual == visual) return;
            if (visual != null)
            {
                newVisual.rotation = visual.rotation;
                visual.gameObject.SetActive(false);
            }
            newVisual.gameObject.SetActive(true);
            visual = newVisual;
            animator = newAnimator;
            CacheAnimatorParams();
            if (_wings != null) AttachWings(_wings.transform, visual);
            SetModeParams();
        }

        private static void AttachWings(Transform root, Transform parent)
        {
            root.SetParent(parent, false);
            root.localPosition = new Vector3(0f, 2.55f, -0.35f) / Mathf.Max(0.01f, parent.lossyScale.y);
            root.localRotation = Quaternion.identity;
            root.localScale = Vector3.one / Mathf.Max(0.01f, parent.lossyScale.y);
        }

        private void Update()
        {
            // PLAN.md 106-9 — 등장 컷 동안은 선다(진단은 Step 을 직접 부르므로 여기서만 막는다).
            if (Saga.Go.Cinematics.GoCutscenes.Playing)
            {
                if (animator != null) animator.SetFloat("Speed", 0f);
                return;
            }
            Step(Time.deltaTime);
        }

        /// <summary>한 프레임 — 진단이 시간을 건너뛰려고 직접 부른다.</summary>
        public void Step(float dt)
        {
            GoStamina.Tick(dt);
            if (_regrabCooldown > 0f) _regrabCooldown -= dt;

            bool jumpPressed = _jumpQueued || (!_testInput && _jumpAction != null && _jumpAction.WasPressedThisFrame());
            _jumpQueued = false;
            Vector2 raw = RawInput();
            if (MoveLocked) // 109-14-22 조준 중 — 걸음 대신 겨누기, 점프면 풀고 뛴다
            {
                AimInput = raw;
                if (jumpPressed) { MoveLocked = false; AimCancelled = true; }
                else raw = Vector2.zero;
            }
            else AimInput = Vector2.zero;
            Vector3 moveDir = WorldDirection(raw);
            bool sprintHeld = _testInput ? _testSprint : (_sprintAction != null && _sprintAction.IsPressed());

            if (_dashTimeLeft > 0f)
            {
                _dashTimeLeft -= dt;
                _verticalVelocity -= Gravity * dt;
                _controller.Move(new Vector3(_dashVelocity.x, _verticalVelocity, _dashVelocity.z) * dt);
                return;
            }

            if (Mode == MoveMode.Fly && !GoMounts.RidingFly) Mode = MoveMode.Air; // 109-15 내렸으면(싸움·직접) 떠 있던 자리에서 떨어진다
            switch (Mode)
            {
                case MoveMode.Fly: StepFly(dt, moveDir); break;
                case MoveMode.Climb: StepClimb(dt, raw, jumpPressed); break;
                case MoveMode.Mantle: StepMantle(dt); break;
                case MoveMode.Glide: StepGlide(dt, moveDir, jumpPressed); break;
                case MoveMode.Swim: StepSwim(dt, moveDir, sprintHeld); break;
                default: StepWalk(dt, moveDir, sprintHeld, jumpPressed); break;
            }
            SetWings(Mode == MoveMode.Glide);
            SetModeParams();
        }

        // ---- 지상·공중 -----------------------------------------------------------

        private void StepWalk(float dt, Vector3 moveDir, bool sprintHeld, bool jumpPressed)
        {
            if (_plunging)
            {
                // 109-14-2 내리꽂기 — 곧게 아래로, 땅에 닿는 순간 떨어진 높이를 알린다(물이면 헤엄으로 끝, 공격 없음)
                _verticalVelocity = -_plungeSpeed;
                _controller.Move(Vector3.down * _plungeSpeed * dt);
                if (_controller.isGrounded)
                {
                    _plunging = false;
                    Mode = MoveMode.Ground;
                    _verticalVelocity = -2f;
                    PlungeLanded?.Invoke(_plungeTop - transform.position.y);
                    return;
                }
                if (TryStartSwim()) { _plunging = false; return; }
                Mode = MoveMode.Air;
                return;
            }
            bool grounded = _controller.isGrounded;
            if (grounded && _verticalVelocity < 0f) _verticalVelocity = -2f; // 경사·턱에서 떨어지지 않게 살짝 누른다
            bool inDraft = InDraft(transform.position);
            if (!inDraft) _draftFolded = false;
            else if (!grounded && !_draftFolded && traversal)
            {
                Mode = MoveMode.Glide; // 109-14-20 바람 기둥 — 공중이면 저절로 날개
                _verticalVelocity = 0f;
                return;
            }

            if (GoMounts.RidingFly)
            {
                jumpPressed = false; // 109-15 비행 탈것에선 Space 가 오르기(점프가 아니다)
                if (GoMounts.Lift > 0f && !GoMounts.StoryBlocked) { Mode = MoveMode.Fly; _verticalVelocity = 0f; return; }
            }
            else if (GoMounts.RidingGround && jumpPressed) GoMounts.Dismount(); // 뛰면 지상 탈것에서 내린다

            if (jumpPressed)
            {
                if (grounded)
                {
                    _verticalVelocity = JumpVelocity;
                    grounded = false;
                    if (animator != null && _hasJumpParam) animator.SetTrigger("Jump");
                }
                else if (traversal && HeightAboveGround() >= GlideMinHeight && GoStamina.Value > 0f)
                {
                    Mode = MoveMode.Glide;
                    _verticalVelocity = -GlideFallSpeed;
                    return;
                }
            }
            _verticalVelocity -= Gravity * dt;

            bool moving = moveDir.sqrMagnitude > 0.05f * 0.05f;
            // PLAN.md 107-1 — 달리기는 스태미나를 초당 8 쓴다(바닥나면 30까지 잠김). 공중에선 안 닳는다.
            bool running = sprintHeld && moving && grounded && GoStamina.Drain(GoStamina.SprintPerSec * dt);
            float speed = (running ? RunSpeed : WalkSpeed) * GoMounts.GroundMul; // 109-15 탄 탈것의 걷는 속도 배율

            Vector3 horizontal = moveDir * speed;
            _controller.Move(new Vector3(horizontal.x, _verticalVelocity, horizontal.z) * dt);
            bool wasGrounded = grounded;
            grounded = _controller.isGrounded;
            // 107-3 비탈 — 내리막을 걸으면 매 프레임 발이 살짝 떠서 "공중"이 됐다(낙하 동작·활공 가능). 방금까지 딛고 있었고
            // 뛰어오르는 중이 아니며 발밑 0.6m 안에 땅이 있으면 붙인다. 절벽 끝에서 걸어 나가면 발밑이 멀어 그대로 공중.
            if (!grounded && wasGrounded && _verticalVelocity <= 0f)
            {
                float h = HeightAboveGround();
                if (h > 0f && h < GroundSnapDistance)
                {
                    _controller.Move(Vector3.down * (h + 0.05f));
                    grounded = _controller.isGrounded;
                    if (grounded) _verticalVelocity = -2f;
                }
            }
            Mode = grounded ? MoveMode.Ground : MoveMode.Air;

            if (moving && visual != null)
            {
                float targetYaw = Mathf.Atan2(moveDir.x, moveDir.z) * Mathf.Rad2Deg;
                float yaw = Mathf.LerpAngle(visual.eulerAngles.y, targetYaw, TurnRate * dt);
                visual.rotation = Quaternion.Euler(0f, yaw, 0f);
            }

            if (moving && grounded)
            {
                // PLAN.md 101-3 G "지형 반응" — 걷는 동안 일정 간격으로 발자국.
                _footprintCooldown -= dt;
                if (_footprintCooldown <= 0f)
                {
                    _footprintCooldown = FootprintIntervalSec;
                    GroundDecal.Spawn(transform.position, GroundDecal.Kind.Footprint);
                }
            }

            // Maria.controller의 Speed 파라미터(Idle↔Walk↔Run 블렌드,
            // Saga.Dungeon.Player.PlayerController와 같은 관례 — >0.1 걷기,
            // >0.6 뛰기 임계값은 Animator Controller 쪽에 있다).
            if (animator != null)
            {
                animator.SetFloat("Speed", moving ? (running ? 1f : 0.5f) : 0f);
            }

            if (!traversal) return;
            if (moving && TryStartClimb(moveDir)) return;
            if (TryStartSwim()) return;
            if (grounded) RecordLastLand(dt);
        }

        // ---- 비행 탈것(109-15) — Space 누르는 동안 오르고 Z 누르는 동안 내린다(손 떼면 그 높이에 뜬다). 이야기 임무의 오르기·섬·배·따라가기·쫓기·보스·지키기·무리 단계엔 못 날아 내려와 땅에서 내린다 ----

        private void StepFly(float dt, Vector3 moveDir)
        {
            if (!GoMounts.RidingFly) { Mode = MoveMode.Air; return; }
            var m = GoMounts.Riding;
            float h = HeightAboveGround();
            bool blocked = GoMounts.StoryBlocked;
            float lift = blocked ? -1f : GoMounts.Lift;
            float v = lift > 0f ? (h < m.Ceil ? GoMounts.Rise : 0f) : lift < 0f ? -(blocked ? GoMounts.LandRate : GoMounts.Fall) : 0f;
            _verticalVelocity = v;
            Vector3 horizontal = moveDir * WalkSpeed * m.Fly;
            _controller.Move(new Vector3(horizontal.x, v, horizontal.z) * dt);
            bool moving = moveDir.sqrMagnitude > 0.05f * 0.05f;
            if (moving && visual != null)
            {
                float targetYaw = Mathf.Atan2(moveDir.x, moveDir.z) * Mathf.Rad2Deg;
                visual.rotation = Quaternion.Euler(0f, Mathf.LerpAngle(visual.eulerAngles.y, targetYaw, TurnRate * dt), 0f);
            }
            if (animator != null) animator.SetFloat("Speed", moving ? 0.5f : 0f); // 날 땐 걷기 몸짓
            if (v <= 0f && _controller.isGrounded)
            {
                Mode = MoveMode.Ground; // 착지 — 탄 채(걷는 학·용). 이야기 구간에서 내려온 거면 내린다
                _verticalVelocity = -2f;
                if (blocked) GoMounts.Dismount();
            }
        }

        // ---- 등반 --------------------------------------------------------------

        /// <summary>가슴·무릎 높이에서 이동 방향으로 쏜 광선이 둘 다 가파른 면(법선 y&lt;0.5)에 닿으면 붙는다.
        /// 캡슐·구 충돌체(사람·소품)와 `NoClimb` 는 안 잡는다.</summary>
        private bool TryStartClimb(Vector3 dir)
        {
            if (_regrabCooldown > 0f || GoStamina.Value <= 0f) return false;
            dir.y = 0f;
            if (dir.sqrMagnitude < 0.0001f) return false;
            dir.Normalize();
            Vector3 p = transform.position;
            if (!ProbeWall(p + Vector3.up * ClimbProbeHeight, dir, ClimbReach, out RaycastHit chest)) return false;
            if (!ProbeWall(p + Vector3.up * KneeProbeHeight, dir, ClimbReach + 0.4f, out _)) return false;
            Vector3 n = chest.normal; n.y = 0f;
            if (n.sqrMagnitude < 0.0001f || Vector3.Dot(dir, -n.normalized) < 0.5f) return false;
            _wallNormal = n.normalized;
            Mode = MoveMode.Climb;
            _verticalVelocity = 0f;
            _leapLeft = 0f;
            if (visual != null) visual.rotation = Quaternion.LookRotation(-_wallNormal);
            return true;
        }

        private static bool ProbeWall(Vector3 origin, Vector3 dir, float dist, out RaycastHit hit)
        {
            if (!Physics.Raycast(origin, dir, out hit, dist, ~0, QueryTriggerInteraction.Ignore)) return false;
            if (hit.normal.y >= 0.5f) return false;
            var c = hit.collider;
            if (c is CapsuleCollider || c is SphereCollider || c is CharacterController) return false;
            if (c.GetComponentInParent<NoClimb>() != null) return false;
            return true;
        }

        private void StepClimb(float dt, Vector2 raw, bool jumpPressed)
        {
            Vector3 p = transform.position;
            Vector3 into = -_wallNormal;
            if (!ProbeWall(p + Vector3.up * ClimbProbeHeight, into, ClimbReach + 0.6f, out RaycastHit hit))
            {
                // 가슴 높이에 벽이 없다 — 무릎엔 있으면 꼭대기 턱이라 넘어오르고, 없으면 벽이 끝나 떨어진다.
                if (ProbeWall(p + Vector3.up * KneeProbeHeight, into, ClimbReach + 0.6f, out _) && BeginMantle(into)) return;
                Drop(false);
                return;
            }
            Vector3 n = hit.normal; n.y = 0f;
            if (n.sqrMagnitude > 0.0001f) _wallNormal = n.normalized;
            into = -_wallNormal;

            if (jumpPressed)
            {
                if (raw.y < -0.5f) { Drop(true); return; }
                if (_leapLeft <= 0f && GoStamina.Use(ClimbLeapCost)) _leapLeft = ClimbLeapSec;
            }

            bool moving = raw.sqrMagnitude > 0.05f * 0.05f;
            float cost = (moving ? ClimbStaminaPerSec : ClimbIdleStaminaPerSec) * dt;
            if (!GoStamina.Use(cost)) { Drop(false); return; }

            Vector3 right = Vector3.Cross(Vector3.up, into);
            Vector3 vel = Vector3.up * (raw.y * ClimbSpeed) + right * (raw.x * ClimbSideSpeed);
            if (_leapLeft > 0f)
            {
                _leapLeft -= dt;
                vel += Vector3.up * (ClimbLeapHeight / ClimbLeapSec);
            }
            float gap = hit.distance - (_controller.radius + 0.05f);
            vel += into * Mathf.Clamp(gap / Mathf.Max(dt, 0.001f), -4f, 4f);
            _controller.Move(vel * dt);
            if (visual != null) visual.rotation = Quaternion.LookRotation(into);
            if (animator != null)
            {
                animator.SetFloat("Speed", _hasClimbParam ? 0f : (moving ? 0.5f : 0f));
                // 등반 클립은 멈추면 멈추고 내려가면 거꾸로(Maria.controller "Climb" 상태 속도 배수).
                if (_hasClimbRate) animator.SetFloat("ClimbRate", _leapLeft > 0f ? 1.6f : moving ? (raw.y < -0.1f ? -1f : 1f) : 0f);
            }

            if (raw.y < -0.1f && _controller.isGrounded) Mode = MoveMode.Ground; // 내려와 땅에 닿음
        }

        /// <summary>등반을 놓는다. `pushOff` 면 벽에서 살짝 뛰어 떨어진다(아래+Space).</summary>
        private void Drop(bool pushOff)
        {
            Mode = MoveMode.Air;
            _regrabCooldown = ClimbRegrabSec;
            _leapLeft = 0f;
            _verticalVelocity = pushOff ? 3f : 0f;
            if (pushOff) _controller.Move(_wallNormal * 1.2f);
        }

        /// <summary>꼭대기 턱 너머 딛을 자리를 찾아 넘어오른다. 못 찾으면 false.</summary>
        private bool BeginMantle(Vector3 into)
        {
            Vector3 p = transform.position;
            Vector3 scan = p + Vector3.up * (ClimbProbeHeight + 3.5f) + into * (_controller.radius + 1.4f);
            if (!Physics.Raycast(scan, Vector3.down, out RaycastHit top, 6f, ~0, QueryTriggerInteraction.Ignore)) return false;
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
            // 먼저 올라서고(0~0.6) 그다음 앞으로(0.4~1) — 턱 모서리를 파고들지 않게.
            float up = Mathf.SmoothStep(0f, 1f, Mathf.Clamp01(t / 0.6f));
            float fwd = Mathf.SmoothStep(0f, 1f, Mathf.Clamp01((t - 0.4f) / 0.6f));
            Vector3 flatFrom = new Vector3(_mantleFrom.x, 0f, _mantleFrom.z);
            Vector3 flatTo = new Vector3(_mantleTo.x, 0f, _mantleTo.z);
            Vector3 flat = Vector3.Lerp(flatFrom, flatTo, fwd);
            transform.position = new Vector3(flat.x, Mathf.Lerp(_mantleFrom.y, _mantleTo.y, up), flat.z);
            if (t >= 1f)
            {
                _controller.enabled = true;
                Mode = MoveMode.Ground;
                _verticalVelocity = -2f;
                _regrabCooldown = ClimbRegrabSec;
            }
        }

        // ---- 활공 --------------------------------------------------------------

        private void StepGlide(float dt, Vector3 moveDir, bool jumpPressed)
        {
            bool draft = InDraft(transform.position) && !_draftFolded; // 109-14-20 바람 기둥 — 기력 안 쓰고 솟는다
            if (!InDraft(transform.position)) _draftFolded = false;
            if (jumpPressed || (!draft && !GoStamina.Use(GlideStaminaPerSec * dt)))
            {
                if (jumpPressed && draft) _draftFolded = true;
                Mode = MoveMode.Air;
                _verticalVelocity = 0f;
                return;
            }
            _verticalVelocity = draft ? Mathf.Clamp((DraftTopAt(transform.position) - transform.position.y) / Mathf.Max(dt, 1e-4f), 0f, DraftRise) : -GlideFallSpeed;
            Vector3 horizontal = moveDir * GlideSpeed;
            _controller.Move(new Vector3(horizontal.x, _verticalVelocity, horizontal.z) * dt);
            if (moveDir.sqrMagnitude > 0.0025f && visual != null)
            {
                float yaw = Mathf.LerpAngle(visual.eulerAngles.y, Mathf.Atan2(moveDir.x, moveDir.z) * Mathf.Rad2Deg, TurnRate * 0.5f * dt);
                visual.rotation = Quaternion.Euler(0f, yaw, 0f);
            }
            if (animator != null) animator.SetFloat("Speed", 0f);

            if (_controller.isGrounded && !draft) { Mode = MoveMode.Ground; _verticalVelocity = -2f; return; }
            if (moveDir.sqrMagnitude > 0.0025f && TryStartClimb(moveDir)) return;
            TryStartSwim();
        }

        // ---- 수영 --------------------------------------------------------------

        private static bool OverWater(Vector3 p)
        {
            var (gx, gy) = TestMapData.WorldToGrid(p);
            return TestMapData.IsWater(TestMapData.TileAt(gx, gy));
        }

        private bool TryStartSwim()
        {
            Vector3 p = transform.position;
            if (!OverWater(p) || p.y > TestMapData.WaterSurfaceHeight - SwimDepth + 0.05f) return false;
            Mode = MoveMode.Swim;
            _verticalVelocity = 0f;
            return true;
        }

        private void StepSwim(float dt, Vector3 moveDir, bool sprintHeld)
        {
            Vector3 p = transform.position;
            if (!OverWater(p))
            {
                Mode = MoveMode.Air;
                return;
            }
            bool moving = moveDir.sqrMagnitude > 0.05f * 0.05f;
            bool fast = sprintHeld && moving;
            float cost = (fast ? SwimFastStaminaPerSec : moving ? SwimStaminaPerSec : SwimStaminaPerSec * 0.5f) * dt;
            if (!GoStamina.Use(cost) || GoStamina.Value <= 0f)
            {
                Drown();
                return;
            }
            float targetY = TestMapData.WaterSurfaceHeight - SwimDepth;
            float vy = Mathf.Clamp((targetY - p.y) / Mathf.Max(dt, 0.001f), -3f, 3f);
            Vector3 horizontal = moveDir * (fast ? SwimFastSpeed : SwimSpeed);
            _controller.Move(new Vector3(horizontal.x, vy, horizontal.z) * dt);
            if (moving && visual != null)
            {
                float yaw = Mathf.LerpAngle(visual.eulerAngles.y, Mathf.Atan2(moveDir.x, moveDir.z) * Mathf.Rad2Deg, TurnRate * dt);
                visual.rotation = Quaternion.Euler(0f, yaw, 0f);
            }
            if (animator != null) animator.SetFloat("Speed", moving ? 0.5f : 0f); // Swim 상태 1D 블렌드(0 물 위 대기·0.5 헤엄)
            if (moving) TryStartClimb(moveDir); // 강둑·다리 기둥을 잡고 올라온다
        }

        /// <summary>물에서 기력이 다하면 마지막으로 딛었던 땅으로(잃는 것 없음).</summary>
        private void Drown()
        {
            Teleport(LastLand);
            GoStamina.ResetFull();
            if (DialogueLabel.Instance != null)
                DialogueLabel.Instance.Show(GoLocalization.T("move.drown", "기력이 다해 물가로 돌아왔다"), 2.5f);
        }

        private void RecordLastLand(float dt)
        {
            _lastLandTimer -= dt;
            if (_lastLandTimer > 0f) return;
            _lastLandTimer = LastLandIntervalSec;
            if (!OverWater(transform.position)) LastLand = transform.position + Vector3.up * 0.1f;
        }

        // ---- 도움 --------------------------------------------------------------

        public float HeightAboveGround()
        {
            Vector3 origin = transform.position + Vector3.up * 0.5f;
            if (Physics.Raycast(origin, Vector3.down, out RaycastHit hit, 300f, ~0, QueryTriggerInteraction.Ignore))
                return hit.distance - 0.5f;
            return 300f;
        }

        private void SetModeParams()
        {
            if (animator == null) return;
            if (_hasClimbParam) animator.SetBool("Climb", Mode == MoveMode.Climb);
            if (_hasGlideParam) animator.SetBool("Glide", Mode == MoveMode.Glide);
            if (_hasSwimParam) animator.SetBool("Swim", Mode == MoveMode.Swim);
        }

        /// <summary>활공 날개 — 코드로 그린 얇은 판 둘(원작 모양 아님). 활공 중에만 보인다.</summary>
        private GameObject BuildWings()
        {
            Transform parent = visual != null ? visual : transform;
            var root = new GameObject("GlideWings (generated)");
            root.transform.SetParent(parent, false);
            root.transform.localPosition = new Vector3(0f, 2.55f, -0.35f) / Mathf.Max(0.01f, parent.lossyScale.y);
            root.transform.localScale = Vector3.one / Mathf.Max(0.01f, parent.lossyScale.y);
            var mat = new Material(Shader.Find("Universal Render Pipeline/Lit")) { name = "GlideWings (generated)" };
            mat.color = new Color(0.86f, 0.8f, 0.66f);
            for (int side = -1; side <= 1; side += 2)
            {
                var wing = GameObject.CreatePrimitive(PrimitiveType.Cube);
                wing.name = side < 0 ? "WingL" : "WingR";
                Destroy(wing.GetComponent<Collider>());
                wing.transform.SetParent(root.transform, false);
                wing.transform.localPosition = new Vector3(side * 1.55f, 0.25f, 0f);
                wing.transform.localRotation = Quaternion.Euler(0f, 0f, side * -12f);
                wing.transform.localScale = new Vector3(3f, 0.06f, 1.1f);
                wing.GetComponent<MeshRenderer>().sharedMaterial = mat;
            }
            root.SetActive(false);
            return root;
        }

        private void SetWings(bool on)
        {
            if (_wings != null && _wings.activeSelf != on) _wings.SetActive(on);
        }

        private Vector2 RawInput()
        {
            if (_testInput) return _testRaw;
            return MovementInput();
        }

        /// <summary>조이스틱이 있고 밀렸으면 그걸 우선한다(모바일) — 아니면 Move 액션으로 되돈다.</summary>
        private Vector2 MovementInput()
        {
            if (joystick != null && joystick.Value.sqrMagnitude > 0.05f * 0.05f)
            {
                return joystick.Value;
            }
            return _moveAction != null ? _moveAction.ReadValue<Vector2>() : Vector2.zero;
        }

        /// <summary>입력(x=오른쪽, y=앞)을 카메라가 보는 방향 기준 월드 벡터로 바꾼다.
        /// 진단 입력은 카메라를 무시하고 월드 +X/+Z 로 곧장.</summary>
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
    }
}
