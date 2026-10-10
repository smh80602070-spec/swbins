#ifndef SAGA_GROUND_PBR_INCLUDED
#define SAGA_GROUND_PBR_INCLUDED
// tasks U-0084 사실 땅 1단계 — 땅 계열 셰이더(RegionGround·VertexColorLit·ForestWorldCurve)가 같이 쓰는 PBR 조명.
// 바탕색·섞음·휨은 각 셰이더 그대로, 빛만 URP UniversalFragmentPBR(금속 0, 거칠기 기본 0.85) — 주 조명 그림자(부드러움)·
// 하늘 앰비언트(SH)·반사 프로브·추가 조명(등불·횃불)까지 받는다. 옛 명암(띠·램버트)은 전역 키워드 _SAGA_GROUND_TOON
// (환경변수 SAGA_GROUND_TOON=1 → RegionMaterials.ApplyGroundLook) 일 때만. Lighting.hlsl 을 먼저 include 할 것.
half3 SagaGroundPBR(half3 albedo, float3 positionWS, half3 normalWS, float4 positionCS, half roughness)
{
    InputData inputData = (InputData)0;
    inputData.positionWS = positionWS;
    inputData.normalWS = normalWS;
    inputData.viewDirectionWS = GetWorldSpaceNormalizeViewDir(positionWS);
    inputData.shadowCoord = TransformWorldToShadowCoord(positionWS);
    inputData.normalizedScreenSpaceUV = GetNormalizedScreenSpaceUV(positionCS);
    inputData.shadowMask = half4(1, 1, 1, 1);
    inputData.bakedGI = SampleSH(normalWS);
    SurfaceData s = (SurfaceData)0;
    s.albedo = albedo;
    s.metallic = 0.0h;
    s.specular = half3(0, 0, 0);
    s.smoothness = 1.0h - roughness;
    s.occlusion = 1.0h;
    s.alpha = 1.0h;
    s.normalTS = half3(0, 0, 1);
    return UniversalFragmentPBR(inputData, s).rgb;
}
#endif
