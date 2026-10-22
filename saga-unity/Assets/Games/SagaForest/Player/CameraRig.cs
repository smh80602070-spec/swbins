using UnityEngine;
using UnityEngine.InputSystem;

namespace Saga.Forest.Player
{
    /// <summary>
    /// VERTICAL_SLICE_FOREST.md(saga-godot) 3절 "카메라" 결정 — 원작
    /// (`village-view.js`)이 이미 고정 카메라였다(회전·줌 입력이 코드
    /// 어디에도 없다, `cam.x/y`가 플레이어 위치만 따라간다). godot 쪽은
    /// DUNGEON의 `dungeon_camera_rig.gd`를 그대로 재사용했는데, Unity
    /// DUNGEON의 `CameraRig.cs`는 마우스 드래그 오빗·휠 줌이 있는 자유
    /// 카메라라 그대로 재사용하면 이 결정과 어긋난다 — 그래서 **입력
    /// 처리를 아예 없앤 진짜 고정 버전**으로 새로 짰다(Update() 없음,
    /// Awake에서 각도·거리를 한 번만 정하고 다시는 안 바꾼다).
    /// `pitch=62°`(DUNGEON의 55°보다 더 위에서 — "마당·화단이 잘 보여야
    /// 한다"), `springLength=14m`(DUNGEON의 12m보다 살짝 멀게 — 90×60m
    /// 열린 마을이라 주변이 더 보이게). 벽 충돌(godot의 SpringArm3D
    /// collision_mask)은 이번 슬라이스에 없음 — 마을에 카메라가 파고들
    /// 만한 큰 구조물이 집 하나뿐이라 범위 밖으로 남긴다.
    /// </summary>
    public class CameraRig : MonoBehaviour
    {
        private const float PitchDeg = 62f;
        private const float SpringLength = 14f;

        // tasks U-0161(웹 W-0324 userZoom 0.25~6 · 고돗 0.2~1.8) — 휠로 끈 길이 배율(회전 없음 그대로). 한 칸 × 0.85.
        public const float MinMul = 0.25f, MaxMul = 1.8f, Notch = 0.85f;
        private float _mul = 1f;
        /// <summary>진단 — 지금 끈 길이(m).</summary>
        public float Spring => SpringLength * _mul;

        [SerializeField] private Camera cam;

        private void Awake()
        {
            if (cam == null) cam = GetComponentInChildren<Camera>();
            transform.localRotation = Quaternion.Euler(PitchDeg, 0f, 0f);
            if (cam != null) cam.transform.localPosition = new Vector3(0f, 0f, -SpringLength);
        }

        private void Update()
        {
            var mouse = Mouse.current;
            if (mouse == null) return;
            float y = mouse.scroll.ReadValue().y;
            if (y > 0f) ZoomBy(-1); else if (y < 0f) ZoomBy(1);
        }

        /// <summary>기본 끈 길이(배율 1)로.</summary>
        public void ResetZoom() => SetMul(1f);

        private void SetMul(float m)
        {
            _mul = Mathf.Clamp(m, MinMul, MaxMul);
            if (cam != null) cam.transform.localPosition = new Vector3(0f, 0f, -Spring);
        }

        /// <summary>휠 칸(+ 멀리) — 끈 길이 배율을 곱으로.</summary>
        public void ZoomBy(int notches)
        {
            _mul = Mathf.Clamp(_mul * Mathf.Pow(1f / Notch, notches), MinMul, MaxMul);
            if (cam != null) cam.transform.localPosition = new Vector3(0f, 0f, -Spring);
        }
    }
}
