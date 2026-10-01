#ifndef SAGA_CEL_TOON_INPUT_INCLUDED
#define SAGA_CEL_TOON_INPUT_INCLUDED

// Saga/CelToon 재질 입력(tasks U-0022) — 모든 패스가 같은 CBUFFER 를 써야 SRP Batcher 가 켜진다.
// 앞 네 줄(_BaseMap_ST·_BaseColor·_Cutoff·_Surface)은 URP 공용 그림자/깊이 패스(ShadowCasterPass·DepthOnlyPass)가 읽는 이름이라 그대로 둔다.

#include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/SurfaceInput.hlsl"

CBUFFER_START(UnityPerMaterial)
    float4 _BaseMap_ST;
    half4 _BaseColor;
    half _Cutoff;
    half _Surface;
    half _BandCount;
    half _BandSoftness;
    half4 _RimColor;
    half _RimPower;
    half _RimStrength;
    half _HitFlash;
    half _GlowStrength;
    half4 _OutlineColor;
    float _OutlineWidth;
CBUFFER_END

#endif
