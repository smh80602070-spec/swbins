using UnityEngine;
using Saga.Core;
using UnityEngine.InputSystem;
using Saga.Realm.Data;
using Saga.Realm.World;

namespace Saga.Realm.Player
{
    /// <summary>
    /// VERTICAL_SLICE_REALM.md 2-10절 "월드맵 드래그 궤도 카메라" + 2-9절
    /// "성표 탭으로 조망 대상 바꾸기"를 한 컴포넌트로 합쳤다(saga-godot은
    /// 두 파일로 나눴지만 여기선 드래그 판정 하나가 회전과 탭을 같이
    /// 가르는 게 자연스러워 합쳤다 — 개념만 참고, 코드는 새로). 완전한
    /// 구면 좌표(yaw+pitch+radius)로 원점(지도 중심)을 돈다 — 이 리그
    /// 자체가 도는 궤도점이라 자식 카메라는 로컬 원점에 그대로 둔다
    /// (RealmOrbitCamera.cs의 "자식 카메라를 뒤로 미는" 방식과 다름).
    ///
    /// GO/DUNGEON `Player/CameraRig.cs`의 드래그+문지방 요령을 그대로
    /// 재사용(마우스·터치 각각 받고 10px 문지방으로 회전과 탭을 가른다) —
    /// 문지방을 못 넘은 즉 "탭"으로 끝난 손떼기는 성표 클릭 판정으로
    /// 넘긴다.
    /// </summary>
    public class RealmWorldMapCamera : MonoBehaviour
    {
        // tasks U-0102 — 120m 에선 성 앞 태수·재야(키 4m)가 점뿐이었다 → 30m 까지. 확대 한 걸음 = 지금 거리의 12%(가까울수록 잘게, 최소 4m).
        public const float MinRadius = 15f;   // tasks U-0161(웹 W-0324) 30 → 15 — 태수 몸을 코앞에서 ·   // 40m 에선 태수 몸이 화면 높이 7.8% — 30m 로 한 걸음 더(U-0102 진단)
        public const float MaxRadius = 420f;
        public const float ZoomFrac = 0.12f, MinZoomStep = 4f;
        /// <summary>tasks U-0102 — 카메라 중심이 고른 성으로 옮겨 가는 빠르기(1/초, 지수 따라잡기).</summary>
        public const float PivotFollow = 6f;
        private const float MinPitchRad = 0.35f;
        private const float MaxPitchRad = 1.3f;
        private const float RotateSpeedRad = 0.006f;
        private const float DragThresholdPx = 10f;

        [SerializeField] private Camera cam;

        private float _radius = 240f;
        private float _pitchRad = 0.8f;
        private float _yawRad;

        private bool _dragging;
        private bool _dragConfirmed;
        private Vector2 _dragStart;
        private Vector2 _lastPointerPos;

        // PLAN.md 109-15 비행 — 나는 동안 카메라가 낮고 가깝게 내려와(FlyPitch·FlyRadius) 천천히 돌며 둘러보고, 돌아보는 속도가 탈것 배율만큼 빨라진다.
        // 내리면 날기 전 기울기·거리로 돌아간다. 자동 돌기 0.12rad/초 × 배율, 키(A·D·←→)는 0.9rad/초 × 배율.
        public const float FlyAutoYawRad = 0.12f, FlyKeyYawRad = 0.9f, FlyBlendPerSec = 2.2f;
        private bool _wasFlying;
        private float _prevRadius, _prevPitch;

        public float DebugYaw => _yawRad;
        public float DebugPitch => _pitchRad;
        public float DebugRadius => _radius;
        public Vector3 DebugPivot => _pivot;
        public Camera Cam => cam;

        // tasks U-0102 — 카메라가 도는 중심. 예전엔 늘 원점(지도 한가운데) → 지금 고른 성(`RealmWorldMap.CityWorldPos`)을 따라간다.
        private Vector3 _pivot;
        private Vector3 PivotTarget() => RealmWorldMap.CityWorldPos(RealmCityState.CurrentCity) ?? Vector3.zero;

        private void Awake()
        {
            if (cam == null) cam = GetComponentInChildren<Camera>();
            ApplyOrbit();
        }

        private void OnEnable()
        {
            // 디오라마↔지도 전환으로 이 GameObject가 다시 활성화될 때마다
            // Awake는 두 번째부터 안 돌므로 여기서도 한 번 더 맞춘다. 지도를 켜면 지금 성 위에서 시작(따라가지 않고 바로).
            _pivot = PivotTarget();
            ApplyOrbit();
        }

        private void Update()
        {
            HandlePointer();
            Tick(Time.deltaTime);
        }

        /// <summary>한 프레임 — 비행 중이면 카메라를 낮고 가깝게 내리며 돌고, 아니면 날기 전 자리로 돌아온다. 진단이 시간을 건너뛰려고 직접 부른다.</summary>
        public void Tick(float dt)
        {
            bool flying = RealmMounts.IsFlying;
            if (flying && !_wasFlying) { _prevRadius = _radius; _prevPitch = _pitchRad; }
            if (flying)
            {
                float pan = RealmMounts.PanMul;
                float k = 1f - Mathf.Exp(-FlyBlendPerSec * dt);
                _radius = Mathf.Lerp(_radius, Mathf.Clamp(RealmMounts.FlyRadius, MinRadius, MaxRadius), k);
                _pitchRad = Mathf.Lerp(_pitchRad, Mathf.Clamp(RealmMounts.FlyPitch, MinPitchRad, MaxPitchRad), k);
                float turn = FlyAutoYawRad;
                var kb = Keyboard.current;
                if (kb != null)
                {
                    if (kb.aKey.isPressed || kb.leftArrowKey.isPressed) turn -= FlyKeyYawRad;
                    if (kb.dKey.isPressed || kb.rightArrowKey.isPressed) turn += FlyKeyYawRad;
                }
                turn += SagaPad.Stick(SagaPad.Side.Left).x * FlyKeyYawRad; // tasks U-0018 — 왼쪽 스틱 선회
                _yawRad += turn * pan * dt;
            }
            else if (_wasFlying)
            {
                _radius = _prevRadius;
                _pitchRad = _prevPitch;
            }
            _wasFlying = flying;
            _pivot = Vector3.Lerp(_pivot, PivotTarget(), 1f - Mathf.Exp(-PivotFollow * dt));
            ApplyOrbit();
        }

        private void HandlePointer()
        {
            var mouse = Mouse.current;
            if (mouse != null)
            {
                Vector2 pos = mouse.position.ReadValue();
                if (mouse.leftButton.wasPressedThisFrame) BeginDrag(pos);
                else if (mouse.leftButton.wasReleasedThisFrame) EndDrag(pos);
                else if (mouse.leftButton.isPressed && _dragging) ApplyDrag(pos - _lastPointerPos, pos);
                if (mouse.leftButton.isPressed) _lastPointerPos = pos;

                float scrollY = mouse.scroll.ReadValue().y;
                if (scrollY > 0f) ZoomSteps(-1);
                else if (scrollY < 0f) ZoomSteps(1);
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
                    EndDrag(primary.position.ReadValue());
                }
            }
        }

        private void BeginDrag(Vector2 pos)
        {
            _dragging = true;
            _dragStart = pos;
            _dragConfirmed = false;
        }

        private void EndDrag(Vector2 pos)
        {
            _dragging = false;
            if (!_dragConfirmed) TrySelectCity(pos);
        }

        private void ApplyDrag(Vector2 relative, Vector2 pos)
        {
            if (!_dragConfirmed)
            {
                if (Vector2.Distance(pos, _dragStart) < DragThresholdPx) return;
                _dragConfirmed = true;
            }
            float pan = RealmMounts.PanMul; // 나는 동안 돌아보기가 빨라진다(안 날면 1)
            _yawRad += relative.x * RotateSpeedRad * pan;
            _pitchRad = Mathf.Clamp(_pitchRad + relative.y * RotateSpeedRad * pan, MinPitchRad, MaxPitchRad);
        }

        /// <summary>확대(−)·축소(+) n 걸음 — 한 걸음 = 지금 거리 × ZoomFrac(최소 MinZoomStep). 진단·촬영도 부른다.</summary>
        public void ZoomSteps(int steps)
        {
            for (int i = 0; i < Mathf.Abs(steps); i++)
                _radius = Mathf.Clamp(_radius + Mathf.Sign(steps) * Mathf.Max(MinZoomStep, _radius * ZoomFrac), MinRadius, MaxRadius);
            ApplyOrbit();
        }

        /// <summary>촬영·진단 — 거리·기울기를 바로 놓는다(범위 안으로).</summary>
        public void SetView(float radius, float pitchRad)
        {
            _radius = Mathf.Clamp(radius, MinRadius, MaxRadius);
            _pitchRad = Mathf.Clamp(pitchRad, MinPitchRad, MaxPitchRad);
            ApplyOrbit();
        }

        private void ApplyOrbit()
        {
            float x = _radius * Mathf.Sin(_yawRad) * Mathf.Cos(_pitchRad);
            float z = _radius * Mathf.Cos(_yawRad) * Mathf.Cos(_pitchRad);
            float y = _radius * Mathf.Sin(_pitchRad);
            transform.position = _pivot + new Vector3(x, y, z);
            transform.LookAt(_pivot, Vector3.up);
        }

        private void TrySelectCity(Vector2 screenPos)
        {
            if (cam == null) return;
            var ray = cam.ScreenPointToRay(screenPos);
            if (Physics.Raycast(ray, out var hit, 2000f))
            {
                var marker = hit.collider.GetComponent<RealmCityMarkerId>();
                if (marker != null) RealmCityState.SetCurrentCity(marker.CityId);
            }
        }

        /// <summary>PlaytestRealmSlice.cs 전용 — 가짜 드래그/탭을 흉내낼 때 쓴다.</summary>
        public void DebugBeginDrag(Vector2 pos) => BeginDrag(pos);
        public void DebugApplyDrag(Vector2 relative, Vector2 pos) => ApplyDrag(relative, pos);
        public void DebugEndDrag(Vector2 pos) => EndDrag(pos);
    }
}
