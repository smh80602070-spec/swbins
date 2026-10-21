using UnityEngine;
using UnityEngine.Rendering;
using UnityEngine.Rendering.Universal;

namespace Saga.Core
{
    /// <summary>
    /// 폰 발열·배터리 점검(2026-09-24) — 다섯 판 공통.
    ///
    /// ① 프레임 상한: 모바일은 `Application.targetFrameRate` 를 30 으로 **명시**한다(기본값 -1 은 플랫폼·기기마다
    ///    해석이 달라 120Hz 화면에서 더 돌 수 있다). PC·에디터는 건드리지 않는다.
    ///
    /// ② 설정의 "그래픽 저": 다섯 판 `XxxSettingsState.ApplyGraphicsQuality` 가 `QualitySettings.shadowDistance`·
    ///    `antiAliasing` 만 바꿨는데, **URP 는 그 둘을 안 읽는다**(그림자 거리·MSAA 는 파이프라인 에셋 값). 그래서
    ///    "저" 를 골라도 폰에서 실제로 가벼워지지 않았다. 여기서 활성 URP 에셋의 그림자 거리·MSAA·렌더 스케일·
    ///    물체당 추가 조명 수를 직접 바꾼다. 에디터에선 에셋 파일이 바뀌어 저장될 수 있어 **플레이어 빌드에서만** 바꾸고,
    ///    값 자체는 `LowShadowDistance` 등 상수·`Target()` 로 진단이 본다. 처음 값은 기억해 "고" 로 되돌린다.
    /// </summary>
    public static class MobileGraphics
    {
        public const int MobileFrameRate = 30;
        public const float LowShadowDistance = 15f;
        public const int LowMsaa = 1;
        public const float LowRenderScaleMax = 0.7f;
        public const int LowAdditionalLightsPerObject = 2;

        private static bool _captured;
        private static float _shadowDistance;
        private static int _msaa;
        private static float _renderScale;
        private static int _lightsPerObject;

        /// <summary>"고"/"저" 에서 URP 에셋에 들어갈 값(진단용 순수 함수).</summary>
        public static (float Shadow, int Msaa, float Scale, int Lights) Target(bool high, float shadow, int msaa, float scale, int lights) =>
            high ? (shadow, msaa, scale, lights)
                 : (Mathf.Min(shadow, LowShadowDistance), LowMsaa, Mathf.Min(scale, LowRenderScaleMax), Mathf.Min(lights, LowAdditionalLightsPerObject));

        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.BeforeSceneLoad)]
        private static void Init()
        {
            if (Application.isMobilePlatform) Application.targetFrameRate = MobileFrameRate;
        }

        /// <summary>다섯 판 설정이 부른다. 에디터에선 URP 에셋을 안 건드린다(위 주석 ②).</summary>
        public static void ApplyQuality(bool high)
        {
            CharacterOutline.SetQuality(high); // tasks U-0148 — 낮음이면 인물 외곽선 끔(에디터에서도)
            if (Application.isEditor) return;
            var urp = GraphicsSettings.currentRenderPipeline as UniversalRenderPipelineAsset;
            if (urp == null) return;
            if (!_captured)
            {
                _captured = true;
                _shadowDistance = urp.shadowDistance;
                _msaa = urp.msaaSampleCount;
                _renderScale = urp.renderScale;
                _lightsPerObject = urp.maxAdditionalLightsCount;
            }
            var t = Target(high, _shadowDistance, _msaa, _renderScale, _lightsPerObject);
            urp.shadowDistance = t.Shadow;
            urp.msaaSampleCount = t.Msaa;
            urp.renderScale = t.Scale;
            urp.maxAdditionalLightsCount = t.Lights;
        }
    }
}
