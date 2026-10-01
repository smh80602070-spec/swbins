using UnityEngine;
using Saga.Core;
using UnityEngine.InputSystem;

namespace Saga.Realm.Player
{
    /// <summary>
    /// VERTICAL_SLICE_REALM.md 1절 "성 하나를 3D로 조망한다" — REALM에는
    /// 이동하는 플레이어 아바타가 없어(1절 "실시간 이동·전투는 이 슬라이스에
    /// 아예 없다"), 다른 네 판의 드래그 오빗(SagaDungeon/SagaGo
    /// `Player/CameraRig.cs`)을 그대로 안 옮기고 WASD 오빗으로 새로 짰다
    /// — saga-godot REALM 1절이 "성 조망 단일 화면엔 드래그보다 WASD가
    /// 더 어울린다"고 정한 것과 같은 결론(개념만 참고, 코드는 새로).
    /// 이 리그는 성 중심(원점)에 고정된 채 도는 궤도 카메라다 — 쫓아갈
    /// 대상이 없다.
    /// </summary>
    public class RealmOrbitCamera : MonoBehaviour
    {
        private const float RotateSpeedDeg = 60f;
        private const float ZoomSpeed = 8f;
        private const float MinZoom = 8f;
        private const float MaxZoom = 24f;
        private const float MinPitchDeg = 25f;
        private const float MaxPitchDeg = 70f;

        // PLAN.md 102-5 "카메라 클리핑"(2026-09-22) — SagaDungeon/SagaGo
        // `Player/CameraRig.cs`의 `ResolveCollisionZoom()`과 같은 결(수동
        // raycast pull-in, Cinemachine 없음). 이 리그는 캐릭터가 아니라 성
        // 중심(원점)에 고정돼 있어 자기 몸을 오검출할 CharacterController가
        // 없지만, 원점 자체가 건물 안에 들어앉을 수 있어 Skin은 그대로
        // 작게 둔다(0으로 하면 원점이 벽 속일 때 레이가 시작부터 막혀
        // hit.distance가 0이 되는 것을 방지).
        private const float CameraSkin = 1f;
        private const float CameraCollisionBuffer = 0.3f;

        [SerializeField] private Camera cam;

        private float _zoom = 16f;
        private float _pitchDeg = 45f;
        private float _yawDeg;

        private void Awake()
        {
            if (cam == null) cam = GetComponentInChildren<Camera>();
            transform.localRotation = Quaternion.Euler(_pitchDeg, _yawDeg, 0f);
            ApplyZoom();
        }

        private void Update()
        {
            float dt = Time.deltaTime;
            var kb = Keyboard.current;
            if (kb != null)
            {
                if (kb.aKey.isPressed) _yawDeg -= RotateSpeedDeg * dt;
                if (kb.dKey.isPressed) _yawDeg += RotateSpeedDeg * dt;
                if (kb.wKey.isPressed) _pitchDeg = Mathf.Clamp(_pitchDeg - RotateSpeedDeg * dt, MinPitchDeg, MaxPitchDeg);
                if (kb.sKey.isPressed) _pitchDeg = Mathf.Clamp(_pitchDeg + RotateSpeedDeg * dt, MinPitchDeg, MaxPitchDeg);
                if (kb.qKey.isPressed) Zoom(-ZoomSpeed * dt);
                if (kb.eKey.isPressed) Zoom(ZoomSpeed * dt);
            }

            // tasks U-0018 — 오른쪽 스틱 회전·LB/RB 줌(키 A/D/W/S/Q/E 와 같은 방향)
            Vector2 padLook = SagaPad.Stick(SagaPad.Side.Right);
            _yawDeg += padLook.x * RotateSpeedDeg * dt;
            _pitchDeg = Mathf.Clamp(_pitchDeg - padLook.y * RotateSpeedDeg * dt, MinPitchDeg, MaxPitchDeg);
            if (SagaPad.Held(SagaPad.Btn.ZoomIn)) Zoom(-ZoomSpeed * dt);
            if (SagaPad.Held(SagaPad.Btn.ZoomOut)) Zoom(ZoomSpeed * dt);

            var mouse = Mouse.current;
            if (mouse != null)
            {
                float scrollY = mouse.scroll.ReadValue().y;
                if (scrollY != 0f) Zoom(-scrollY * 0.02f * ZoomSpeed);
            }

            transform.localRotation = Quaternion.Euler(_pitchDeg, _yawDeg, 0f);
            ApplyZoom();
        }

        private void Zoom(float delta)
        {
            _zoom = Mathf.Clamp(_zoom + delta, MinZoom, MaxZoom);
        }

        private void ApplyZoom()
        {
            if (cam == null) return;
            float clippedZoom = ResolveCollisionZoom(_zoom);
            cam.transform.localPosition = new Vector3(0f, 0f, -clippedZoom);
        }

        /// <summary>벽에 카메라가 파고들지 않도록 원하는 줌 거리 안에서
        /// raycast로 막힌 지점을 찾으면 그만큼 당긴다(102-5 "카메라 클리핑").
        /// 막힌 게 없으면 원래 _zoom 그대로 돌려준다 — `CameraRig.
        /// ResolveCollisionZoom()`과 완전히 같은 로직.</summary>
        private float ResolveCollisionZoom(float desiredZoom)
        {
            if (desiredZoom <= CameraSkin) return desiredZoom;
            Vector3 origin = transform.position;
            Vector3 dir = transform.TransformDirection(Vector3.back);
            Vector3 castStart = origin + dir * CameraSkin;
            float castDistance = desiredZoom - CameraSkin;
            if (Physics.Raycast(castStart, dir, out RaycastHit hit, castDistance, ~0, QueryTriggerInteraction.Ignore))
            {
                return Mathf.Max(CameraSkin, CameraSkin + hit.distance - CameraCollisionBuffer);
            }
            return desiredZoom;
        }
    }
}
