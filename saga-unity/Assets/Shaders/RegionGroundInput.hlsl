#ifndef SAGA_REGION_GROUND_INPUT_INCLUDED
#define SAGA_REGION_GROUND_INPUT_INCLUDED

// Saga/RegionGround 재질 입력(tasks U-0023) — 모든 패스가 같은 CBUFFER 를 써야 SRP Batcher 가 켜진다.
// 앞 네 줄(_BaseMap_ST·_BaseColor·_Cutoff·_Surface)은 URP 공용 그림자/깊이 패스가 읽는 이름이라 그대로 둔다(CelToonInput.hlsl 과 같은 규칙).

#include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/SurfaceInput.hlsl"

TEXTURE2D(_HighMap); SAMPLER(sampler_HighMap);

CBUFFER_START(UnityPerMaterial)
    float4 _BaseMap_ST;
    half4 _BaseColor;
    half _Cutoff;
    half _Surface;
    half4 _TintLow;
    half4 _TintHigh;
    half _SatLow;
    half _SatHigh;
    float _TileLow;
    float _TileHigh;
    float _HeightZ0;
    float _HeightZ1;
    half _Slope0;
    half _Slope1;
    half _HasHigh;
    half _BandCount;
    half _BandSoftness;
    half4 _RimColor;
    half _RimPower;
    half _RimStrength;
CBUFFER_END

#endif
