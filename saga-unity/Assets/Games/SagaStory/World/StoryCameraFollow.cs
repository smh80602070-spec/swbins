using System.Collections;
using UnityEngine;
using UnityEngine.InputSystem;

namespace Saga.Story.World
{
    /// <summary>
    /// VERTICAL_SLICE_STORY.md 2절 — "플레이어는 X만 따라가고(Y는 완만하게
    /// 보간), Z는 항상 같은 거리". DUNGEON `CameraRig.cs`의 추적·회전·줌
    /// 카메라와 달리 이 판은 **회전 자체가 없다** — 플레이어의 자식으로
    /// 안 두고 독립 오브젝트로 둔 이유도 그거다(자식으로 두면 부모 위치를
    /// 그대로 따라가 Y 보간을 못 한다).
    ///
    /// Unity 카메라는 로컬 +Z를 정면으로 본다(Godot는 -Z) — 그래서
    /// 플레이어(Z=0 평면)를 보려면 카메라가 **음(-)의 Z distance**에
    /// 서야 한다(saga-godot `story_camera.gd`는 +Z에 선다 — 핸디니스
    /// 차이, 값 자체는 같다).
    ///
    /// PLAN.md 106-8 — 이 컴포넌트는 이제 실제 카메라가 아니라 플레이 가상 카메라(StoryPlayerView,
    /// CinemachineCamera)에 붙는다. 실제 카메라는 `CinemachineBrain` 이 이 자리(평소) 또는 두목 등장 컷
    /// 카메라에 붙인다 — 위치 계산은 그대로(DUNGEON `CameraRig` 가 `PlayerView` 를 움직이는 것과 같은 결).
    /// </summary>
    public class StoryCameraFollow : MonoBehaviour
    {
        private const float YOffset = 2.6f;
        private const float BaseZDistance = 16f;
        private const float YLerpRate = 3f;

        // PLAN.md 101-3 G "성장 연출"(2026-09-17 다음 세션 몫) — DUNGEON/GO
        // `CameraRig.PlayLevelUpCut()`와 같은 결(줌을 당겼다 되돌리는 카메라
        // 펀치인). 이 판은 오빗 카메라가 없어 "줌"이 아니라 ZDistance를
        // 좁혀 같은 효과를 낸다 — 그래서 상수였던 ZDistance를 가변 필드로
        // 바꿨다(다른 값은 그대로 옮김, 합계 1.2초 스킵 가능).
        private const float LevelUpZDistance = 8f;
        private const float LevelUpZoomInSec = 0.3f;
        private const float LevelUpHoldSec = 0.6f;
        private const float LevelUpZoomOutSec = 0.3f;
        private float _zDistance = BaseZDistance;

        // tasks U-0161(웹 W-0324 0.35~5 · 고돗 0.18~1.8) — 휠로 Z 거리 배율. 한 칸 × 0.85 · 가까우면 눈높이 2.6 → 1.2(몸 가운데).
        public const float MinZMul = 0.35f, MaxZMul = 1.8f, ZoomNotch = 0.85f, CloseYOffset = 1.2f;
        public float ZDistance => _zDistance;

        /// <summary>휠 칸(+ 멀리). 레벨업 컷 중엔 안 받는다(컷이 되돌릴 자리를 흔들지 않게).</summary>
        public void ZoomBy(int notches)
        {
            if (_levelUpRoutine != null) return;
            _zDistance = Mathf.Clamp(_zDistance * Mathf.Pow(1f / ZoomNotch, notches), BaseZDistance * MinZMul, BaseZDistance * MaxZMul);
        }

        /// <summary>진단 — 레벨업 컷을 끊고 기본 거리로(컷 중엔 휠을 안 받으므로).</summary>
        public void ResetZoomForTest()
        {
            if (_levelUpRoutine != null) { StopCoroutine(_levelUpRoutine); _levelUpRoutine = null; }
            _zDistance = BaseZDistance;
        }

        /// <summary>지금 거리의 눈높이 — 기본 거리 이상이면 2.6, 가장 가까우면 1.2.</summary>
        public float EyeOffset => Mathf.Lerp(CloseYOffset, YOffset, Mathf.InverseLerp(BaseZDistance * MinZMul, BaseZDistance, _zDistance));
        private Coroutine _levelUpRoutine;

        /// <summary>`DialogueLabel.Instance`·`RealmToast.Instance`와 같은
        /// 결 — 씬에 하나뿐이라 다른 컴포넌트(StoryPlayerController 등)가
        /// 참조 배선 없이 바로 Shake()를 부를 수 있다.</summary>
        public static StoryCameraFollow Instance { get; private set; }

        private Transform _player;
        private float _followY; // 흔들림과 분리한 "진짜" Lerp 목표 — 안 그러면 흔들림 오프셋이 다음 프레임 Lerp 시작점으로 누적된다.
        private float _shakeMagnitude;
        private float _shakeTimer;

        private void Awake() => Instance = this;
        private void OnDestroy()
        {
            if (Instance == this) Instance = null;
        }

        private void Start()
        {
            var pos = transform.position;
            pos.z = -_zDistance;
            transform.position = pos;
            transform.rotation = Quaternion.identity;
            _followY = pos.y;
        }

        /// <summary>PLAN.md 101-3 C "shake" — DUNGEON `CameraRig.Shake()`와
        /// 같은 서명. 이 판은 회전 카메라가 없어 X·Y 평면 오프셋만 준다
        /// (Z는 항상 -ZDistance 고정).</summary>
        public void Shake(float magnitude, float duration)
        {
            _shakeMagnitude = magnitude;
            _shakeTimer = duration;
        }

        /// <summary>`GameBootstrap.OnLeveledUp()`이 부른다 — ZDistance를
        /// LevelUpZDistance까지 당겼다 잠깐 멎었다 되돌린다. 아무 키나
        /// 누르면 그 프레임에 원래 거리로 바로 돌아간다(DUNGEON/GO
        /// `CameraRig.PlayLevelUpCut()`과 같은 결).</summary>
        public void PlayLevelUpCut()
        {
            if (_levelUpRoutine != null) StopCoroutine(_levelUpRoutine);
            _levelUpRoutine = StartCoroutine(LevelUpCutRoutine());
        }

        private IEnumerator LevelUpCutRoutine()
        {
            float startDistance = _zDistance;
            float t = 0f;
            while (t < LevelUpZoomInSec)
            {
                if (AnyKeyPressed()) { _zDistance = startDistance; _levelUpRoutine = null; yield break; }
                t += Time.deltaTime;
                _zDistance = Mathf.Lerp(startDistance, LevelUpZDistance, t / LevelUpZoomInSec);
                yield return null;
            }
            _zDistance = LevelUpZDistance;

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
                _zDistance = Mathf.Lerp(LevelUpZDistance, startDistance, t / LevelUpZoomOutSec);
                yield return null;
            }
            _zDistance = startDistance;
            _levelUpRoutine = null;
        }

        private static bool AnyKeyPressed()
        {
            var kb = Keyboard.current;
            return kb != null && kb.anyKey.wasPressedThisFrame;
        }

        private void Update()
        {
            if (_player == null)
            {
                var go = GameObject.FindWithTag("Player");
                if (go == null) return;
                _player = go.transform;
            }

            var mouse = Mouse.current;
            if (mouse != null)
            {
                float sy = mouse.scroll.ReadValue().y;
                if (sy > 0f) ZoomBy(-1); else if (sy < 0f) ZoomBy(1);
            }
            _followY = Mathf.Lerp(_followY, _player.position.y + EyeOffset, YLerpRate * Time.deltaTime);

            Vector2 shakeOffset = Vector2.zero;
            if (_shakeTimer > 0f)
            {
                _shakeTimer -= Time.deltaTime;
                shakeOffset = Random.insideUnitCircle * _shakeMagnitude;
            }

            var pos = transform.position;
            pos.x = _player.position.x + shakeOffset.x;
            pos.y = _followY + shakeOffset.y;
            pos.z = -_zDistance;
            transform.position = pos;
        }
    }
}
