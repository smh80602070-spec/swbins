using System.Collections;
using UnityEngine;
using UnityEngine.InputSystem;
using Saga.Dungeon.Cinematics;

namespace Saga.Dungeon.Player
{
    /// <summary>
    /// VERTICAL_SLICE_DUNGEON.md — SagaGo의 Player/CameraRig.cs를 그대로
    /// 복사(오빗 카메라 조작 감각은 게임과 무관). **기본 피치·줌만 다르게
    /// 튜닝**했다 — saga-dungeon 웹판 PLAN.md 16장·28-5절이 "디아블로
    /// 감각"(더 내려다보는 각도, 더 가까운 줌)을 목표로 적어 뒀고, 28-5절은
    /// 화각을 완전히 고정하는 시도는 한 번 되돌렸다(자유 오빗을 유지하는
    /// 쪽이 나았다는 뜻으로 읽었다) — 그래서 GO처럼 자유 오빗은 그대로 두고
    /// 기본값만 더 위·더 가깝게 잡았다.
    /// </summary>
    public class CameraRig : MonoBehaviour
    {
        private const float RotateSpeedDeg = 0.006f * Mathf.Rad2Deg;
        // tasks U-0161(웹 W-0324) — 한계만 넓힘(기본 그대로). 레벨업 컷은 옛 끝 3 으로.
        public const float MinZoom = 1.8f;
        public const float MaxZoom = 16f;
        public const float LevelUpZoom = 3f;
        private const float ZoomStep = 1f;
        private const float MinPitchDeg = 30f;
        private const float MaxPitchDeg = 75f;
        private const float DragThresholdPx = 10f;

        // PLAN.md 102-5 "카메라 클리핑" 폴리시(2026-09-22) — Cinemachine 없이(위
        // 클래스 주석 참고) 수동 raycast pull-in만 추가한다. 원점을 정확히
        // 캐릭터 위치에 두면 Player 자신의 CharacterController를 맞힐 수 있어
        // CameraSkin만큼 카메라 방향으로 나가서 캐스팅을 시작한다(자기 몸
        // 오검출 방지 — 흔한 3인칭 카메라 관례).
        private const float CameraSkin = 0.6f;
        private const float CameraCollisionBuffer = 0.2f;

        [SerializeField] private Camera cam;

        // PLAN.md 106-3 — Cinemachine 도입 뒤엔 실제 카메라 대신 플레이 가상 카메라(PlayerView)를
        // 움직인다(브레인이 실제 카메라를 거기 붙인다). 비워 두면 예전처럼 자식 카메라를 직접 움직인다
        // (LayoutWalk 처럼 Cinemachine 이 없는 씬).
        [SerializeField] private Transform view;

        private float _zoom = 6f;
        private float _pitchDeg = 55f; // GO(35°)보다 더 내려다본다 — 디아블로 감각.
        private float _yawDeg;

        private bool _dragging;
        private bool _dragConfirmed;
        private Vector2 _dragStart;
        private Vector2 _lastPointerPos;

        // "타격감 1차" 슬라이스(PLAN.md 38장 "camera shake") — 짧고 작은
        // 흔들림만, 어지럽지 않게 강공격에도 0.12 정도로 제한한다.
        private float _shakeTimer;
        private float _shakeMagnitude;

        // PLAN.md 101-3 G "성장 연출"(2026-09-17) — 표는 Timeline+Cinemachine
        // 컷을 권한다(40장이 이미 Cinemachine을 권장). 이 프로젝트는 Cinemachine
        // 패키지 자체를 안 받았고(G 흔들림도 Impulse 대신 이 클래스의 수동
        // `Shake()`로 대신함) 카메라를 전부 수동 코루틴으로 다뤄 왔다 — 새
        // 패키지·Timeline 애셋을 새로 배우는 대신 같은 결로 "줌을 순간 당겼다
        // 되돌리는" 카메라 펀치인(zoom punch-in)으로 대신한다. 표의 "1.2s·스킵
        // 가능"은 그대로 지킨다(합계 1.2초, 아무 키나 누르면 그 자리에서 원래
        // 줌으로 즉시 복귀 — 조작을 막지 않으니 "스킵"이라기보다 "끼어들면
        // 양보"에 가깝다).
        private const float LevelUpZoomInSec = 0.3f;
        private const float LevelUpHoldSec = 0.6f;
        private const float LevelUpZoomOutSec = 0.3f;
        private Coroutine _levelUpRoutine;

        // PLAN.md 106-1 "락온 카메라" — yaw 가 플레이어→대상 방향을 따라가고
        // 피치를 낮춰 둘을 한 화면에 담는다. 피벗도 대상 쪽으로 조금 당긴다.
        // 해제하면 락온 전 피치로 돌아간다(드래그하면 그 자리에서 양보).
        private const float LockFollowRate = 6f;
        private const float LockPitchDeg = 38f;
        private const float LockPivotShare = 0.25f;
        private const float LockPivotMaxM = 3f;

        private Transform _lockTarget;
        private float _freePitchDeg;
        private bool _restoringPitch;
        private Vector3 _basePivot;
        private Vector3 _pivotOffset;

        public Transform LockTarget => _lockTarget;

        private void Awake()
        {
            if (cam == null) cam = GetComponentInChildren<Camera>();
            if (view == null && cam != null) view = cam.transform;
            transform.localRotation = Quaternion.Euler(_pitchDeg, _yawDeg, 0f);
            _basePivot = transform.localPosition;
            _freePitchDeg = _pitchDeg;
            ApplyZoom();
        }

        private void Update()
        {
            HandlePointer();
            UpdateLockFollow(Time.deltaTime);
            ApplyZoom();
        }

        /// <summary>`PlayerLockOn`이 대상이 바뀔 때마다 부른다(null = 해제).</summary>
        public void SetLockTarget(Transform target)
        {
            if (target != null && _lockTarget == null && !_restoringPitch) _freePitchDeg = _pitchDeg;
            _restoringPitch = target == null && _lockTarget != null;
            _lockTarget = target;
        }

        private void UpdateLockFollow(float dt)
        {
            float k = 1f - Mathf.Exp(-LockFollowRate * dt);
            Vector3 wantOffset = Vector3.zero;
            bool rotate = false;

            if (_lockTarget != null)
            {
                Vector3 origin = transform.parent != null ? transform.parent.position : transform.position;
                Vector3 to = _lockTarget.position - origin;
                to.y = 0f;
                if (to.sqrMagnitude > 0.01f)
                {
                    _yawDeg = Mathf.LerpAngle(_yawDeg, Mathf.Atan2(to.x, to.z) * Mathf.Rad2Deg, k);
                    wantOffset = Vector3.ClampMagnitude(to * LockPivotShare, LockPivotMaxM);
                }
                _pitchDeg = Mathf.Lerp(_pitchDeg, LockPitchDeg, k);
                rotate = true;
            }
            else if (_restoringPitch)
            {
                _pitchDeg = Mathf.Lerp(_pitchDeg, _freePitchDeg, k);
                if (Mathf.Abs(_pitchDeg - _freePitchDeg) < 0.1f)
                {
                    _pitchDeg = _freePitchDeg;
                    _restoringPitch = false;
                }
                rotate = true;
            }

            if (rotate) transform.localRotation = Quaternion.Euler(_pitchDeg, _yawDeg, 0f);

            if (_pivotOffset.sqrMagnitude > 0.000001f || wantOffset.sqrMagnitude > 0f)
            {
                _pivotOffset = Vector3.Lerp(_pivotOffset, wantOffset, k);
                if (wantOffset.sqrMagnitude == 0f && _pivotOffset.sqrMagnitude < 0.0001f) _pivotOffset = Vector3.zero;
                transform.localPosition = _basePivot + _pivotOffset;
            }
        }

        /// <summary>PlayerCombat.cs가 타격 성공 시 부른다 — magnitude는
        /// 로컬 좌표 오프셋 반경(m), duration은 지속 시간(초).</summary>
        public void Shake(float magnitude, float duration)
        {
            _shakeMagnitude = magnitude;
            _shakeTimer = duration;
        }

        /// <summary>`GameBootstrap.OnLeveledUp()`이 부른다 — 줌을 MinZoom까지
        /// 당겼다 잠깐 멎었다 되돌린다. 아무 키나 누르면 그 프레임에 원래
        /// 줌으로 바로 돌아간다(위 클래스 필드 주석 "스킵" 참고).</summary>
        public void PlayLevelUpCut()
        {
            if (_levelUpRoutine != null) StopCoroutine(_levelUpRoutine);
            _levelUpRoutine = StartCoroutine(LevelUpCutRoutine());
        }

        private IEnumerator LevelUpCutRoutine()
        {
            float startZoom = _zoom;
            float t = 0f;
            while (t < LevelUpZoomInSec)
            {
                if (AnyKeyPressed()) { _zoom = startZoom; _levelUpRoutine = null; yield break; }
                t += Time.deltaTime;
                _zoom = Mathf.Lerp(startZoom, LevelUpZoom, t / LevelUpZoomInSec);
                yield return null;
            }
            _zoom = LevelUpZoom;

            t = 0f;
            while (t < LevelUpHoldSec)
            {
                if (AnyKeyPressed()) break;
                t += Time.deltaTime;
                yield return null;
            }

            t = 0f;
            while (t < LevelUpZoomOutSec)
            {
                t += Time.deltaTime;
                _zoom = Mathf.Lerp(LevelUpZoom, startZoom, t / LevelUpZoomOutSec);
                yield return null;
            }
            _zoom = startZoom;
            _levelUpRoutine = null;
        }

        private static bool AnyKeyPressed()
        {
            var kb = Keyboard.current;
            return kb != null && kb.anyKey.wasPressedThisFrame;
        }

        private void HandlePointer()
        {
            if (DungeonCutscenes.Playing)
            {
                _dragging = false; // 컷을 넘기는 클릭·탭이 카메라 드래그로 이어지지 않게.
                return;
            }
            var mouse = Mouse.current;
            if (mouse != null)
            {
                Vector2 pos = mouse.position.ReadValue();
                if (mouse.leftButton.wasPressedThisFrame) BeginDrag(pos);
                else if (mouse.leftButton.wasReleasedThisFrame) EndDrag();
                else if (mouse.leftButton.isPressed && _dragging)
                {
                    ApplyDrag(pos - _lastPointerPos, pos);
                }
                if (mouse.leftButton.isPressed) _lastPointerPos = pos;

                float scrollY = mouse.scroll.ReadValue().y;
                if (scrollY > 0f) Zoom(-ZoomStep);
                else if (scrollY < 0f) Zoom(ZoomStep);
            }

            var touch = Touchscreen.current;
            if (touch != null)
            {
                var primary = touch.primaryTouch;
                if (primary.press.wasPressedThisFrame)
                {
                    Vector2 pos = primary.position.ReadValue();
                    BeginDrag(pos);
                    _lastPointerPos = pos;
                }
                else if (primary.press.isPressed && _dragging)
                {
                    Vector2 pos = primary.position.ReadValue();
                    ApplyDrag(pos - _lastPointerPos, pos);
                    _lastPointerPos = pos;
                }
                else if (primary.press.wasReleasedThisFrame)
                {
                    EndDrag();
                }
            }
        }

        private void BeginDrag(Vector2 pos)
        {
            _dragging = true;
            _dragStart = pos;
            _dragConfirmed = false;
        }

        private void EndDrag()
        {
            _dragging = false;
        }

        private void ApplyDrag(Vector2 relative, Vector2 pos)
        {
            if (_lockTarget != null) return; // 락온 중엔 카메라가 대상을 따라간다.
            if (!_dragConfirmed)
            {
                if (Vector2.Distance(pos, _dragStart) < DragThresholdPx) return;
                _dragConfirmed = true;
            }
            _restoringPitch = false;
            _yawDeg += relative.x * RotateSpeedDeg;
            _pitchDeg = Mathf.Clamp(_pitchDeg + relative.y * RotateSpeedDeg, MinPitchDeg, MaxPitchDeg);
            transform.localRotation = Quaternion.Euler(_pitchDeg, _yawDeg, 0f);
        }

        /// <summary>진단 — tasks U-0161 휠 한 칸(+ 멀리)·지금 줌.</summary>
        public void ZoomForTest(float delta) { Zoom(delta); }
        public float CurrentZoom => _zoom;

        private void Zoom(float delta)
        {
            _zoom = Mathf.Clamp(_zoom + delta, MinZoom, MaxZoom);
        }

        private void ApplyZoom()
        {
            if (view == null) return;
            Vector3 shakeOffset = Vector3.zero;
            if (_shakeTimer > 0f)
            {
                _shakeTimer -= Time.deltaTime;
                shakeOffset = Random.insideUnitSphere * _shakeMagnitude;
            }
            float clippedZoom = ResolveCollisionZoom(_zoom);
            view.localPosition = new Vector3(0f, 0f, -clippedZoom) + shakeOffset;
        }

        /// <summary>벽에 카메라가 파고들지 않도록 원하는 줌 거리 안에서
        /// raycast로 막힌 지점을 찾으면 그만큼 당긴다(102-5 "카메라 클리핑").
        /// 막힌 게 없으면 원래 _zoom 그대로 돌려준다 — 이 메서드는 _zoom
        /// 자체는 바꾸지 않아 장애물을 벗어나면 바로 원래 거리로 복귀한다.</summary>
        private float ResolveCollisionZoom(float desiredZoom)
        {
            if (desiredZoom <= CameraSkin) return desiredZoom;
            Vector3 origin = transform.position;
            Vector3 dir = transform.TransformDirection(Vector3.back);
            Vector3 castStart = origin + dir * CameraSkin;
            float castDistance = desiredZoom - CameraSkin;
            // 106-5 — "Ignore Raycast" 층(옛 감시탑 뜰의 보이지 않는 막이)은 카메라를 당기지 않는다.
            if (Physics.Raycast(castStart, dir, out RaycastHit hit, castDistance, Physics.DefaultRaycastLayers, QueryTriggerInteraction.Ignore))
            {
                return Mathf.Max(CameraSkin, CameraSkin + hit.distance - CameraCollisionBuffer);
            }
            return desiredZoom;
        }
    }
}
