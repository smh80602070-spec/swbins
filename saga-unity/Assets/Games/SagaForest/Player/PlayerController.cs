using UnityEngine;
using UnityEngine.InputSystem;
using Saga.Forest.Data;
using Saga.Forest.UI;
using Saga.Forest.World;

namespace Saga.Forest.Player
{
    /// <summary>
    /// VERTICAL_SLICE_FOREST.md(saga-godot) 3절 — "Player 루트는 회전하지
    /// 않는다(Visual 자식만 돈다)"가 고정 카메라의 핵심 전제라, GO의
    /// `Player/PlayerController.cs`(다섯 벌 복사 원칙, 이동·중력·회전
    /// 로직이 게임과 무관해 그대로 가져온다)를 네임스페이스만 바꿔
    /// 그대로 썼다 — DUNGEON판(회피 로직 포함)이 아니라 GO판을 기준으로
    /// 삼은 이유는 FOREST 첫 슬라이스에 전투/회피가 없어 GO 쪽이 더
    /// 가까운 대응이기 때문(godot 문서도 `games/saga_go/player/player.gd`
    /// 재사용을 명시).
    /// </summary>
    [RequireComponent(typeof(CharacterController))]
    public class PlayerController : MonoBehaviour
    {
        private const float WalkSpeed = 6f;
        private const float RunSpeed = 10f;
        private const float Gravity = 20f;
        private const float TurnRate = 12f;

        [SerializeField] private Transform visual;
        [SerializeField] private CameraRig cameraRig;
        [SerializeField] private InputActionAsset inputActions;
        [SerializeField] private VirtualJoystick joystick;
        // 44장 "Player" 교체 — GO PlayerController.cs와 같은 결(Maria가
        // 배정되면 채워짐, 이 게임엔 전투가 없어 Speed만 씀).
        [SerializeField] private Animator animator;

        private CharacterController _controller;
        private InputAction _moveAction;
        private InputAction _sprintAction;
        private float _verticalVelocity;

        // PLAN.md 109-15 탈것·비행 — 비행 탈것은 충돌 없이 마을 위 Hover 높이로 떠서 간다(나무·바위·소품을 넘는다).
        private bool _flying;
        private bool _testInput;
        private Vector2 _testRaw;

        public Transform Visual => visual;
        /// <summary>비행 탈것을 타고 떠 있는 동안(충돌 꺼짐).</summary>
        public bool Flying => _flying;

        /// <summary>진단용 — 입력을 월드 방향(x=+X, y=+Z)으로 곧장 준다.</summary>
        public void SetTestInput(Vector2 raw) { _testInput = true; _testRaw = raw; }
        public void ClearTestInput() { _testInput = false; _testRaw = Vector2.zero; }

        /// <summary>진단용 순간이동 — 충돌 켠 채 자리를 옮기고 떨어뜨린다.</summary>
        public void Teleport(Vector3 pos)
        {
            if (_controller == null) _controller = GetComponent<CharacterController>();
            _controller.enabled = false;
            transform.position = pos;
            _controller.enabled = !_flying;
            _verticalVelocity = 0f;
        }

        private void Awake()
        {
            _controller = GetComponent<CharacterController>();

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
        }

        private void Update() => Step(Time.deltaTime);

        /// <summary>한 프레임 — 진단이 시간을 건너뛰려고 직접 부른다.</summary>
        public void Step(float dt)
        {
            if (_flying && !ForestMounts.RidingFly) EndFly();
            if (ForestMounts.RidingFly)
            {
                StepFly(dt);
                return;
            }

            if (_controller.isGrounded && _verticalVelocity < 0f)
            {
                _verticalVelocity = 0f;
            }
            _verticalVelocity -= Gravity * dt;

            Vector2 inputDir = MovementInput();
            Vector3 moveDir = WorldDirection(inputDir);

            bool running = !_testInput && _sprintAction != null && _sprintAction.IsPressed();
            float speed = (running ? RunSpeed : WalkSpeed) * ForestMounts.SpeedMul; // PLAN.md 109-15 — 안 탔으면 ×1
            ForestDeliveryState.NotifyRunning(running || ForestMounts.RidingGround); // 101-2 5.7 "깨지기 쉬움" 소포 — 달리면 파손(말 위에서도).

            Vector3 horizontal = moveDir * speed;
            _controller.Move(new Vector3(horizontal.x, _verticalVelocity, horizontal.z) * dt);

            bool moving = moveDir.sqrMagnitude > 0.05f * 0.05f;
            if (moving && visual != null)
            {
                float targetYaw = Mathf.Atan2(moveDir.x, moveDir.z) * Mathf.Rad2Deg;
                float yaw = Mathf.LerpAngle(visual.eulerAngles.y, targetYaw, TurnRate * dt);
                visual.rotation = Quaternion.Euler(0f, yaw, 0f);
            }

            if (animator != null)
            {
                animator.SetFloat("Speed", moving ? (running ? 1f : 0.5f) : 0f);
            }
        }

        /// <summary>비행 탈것 한 프레임 — 충돌을 끄고 마을 안(가장자리에서 미끄러짐)을 Hover 높이로 떠서 간다.</summary>
        private void StepFly(float dt)
        {
            if (!_flying)
            {
                _flying = true;
                _controller.enabled = false;
                _verticalVelocity = 0f;
            }
            Vector3 moveDir = WorldDirection(MovementInput());
            bool running = !_testInput && _sprintAction != null && _sprintAction.IsPressed();
            float speed = (running ? RunSpeed : WalkSpeed) * ForestMounts.SpeedMul;
            ForestDeliveryState.NotifyRunning(false);

            Vector3 p = transform.position;
            float limX = ForestGroundBuilder.VillageWidth * 0.5f - ForestMounts.EdgeInset;
            float limZ = ForestGroundBuilder.VillageDepth * 0.5f - ForestMounts.EdgeInset;
            p.x = Mathf.Clamp(p.x + moveDir.x * speed * dt, -limX, limX);
            p.z = Mathf.Clamp(p.z + moveDir.z * speed * dt, -limZ, limZ);
            p.y = Mathf.MoveTowards(p.y, ForestMounts.Hover, ForestMounts.Rise * dt);
            transform.position = p;

            bool moving = moveDir.sqrMagnitude > 0.05f * 0.05f;
            if (moving && visual != null)
            {
                float targetYaw = Mathf.Atan2(moveDir.x, moveDir.z) * Mathf.Rad2Deg;
                float yaw = Mathf.LerpAngle(visual.eulerAngles.y, targetYaw, TurnRate * dt);
                visual.rotation = Quaternion.Euler(0f, yaw, 0f);
            }
            if (animator != null) animator.SetFloat("Speed", moving ? (running ? 1f : 0.5f) : 0f);
        }

        /// <summary>내렸다 — 충돌을 다시 켜고 그 자리에서 떨어진다.</summary>
        private void EndFly()
        {
            _flying = false;
            _controller.enabled = true;
            _verticalVelocity = 0f;
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
    }
}
