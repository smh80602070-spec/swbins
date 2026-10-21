#ifndef SAGA_GROUND_PHOTO_INCLUDED
#define SAGA_GROUND_PHOTO_INCLUDED
// tasks U-0084 사실 땅 2단계 — 땅 셰이더(VertexColorLit·ForestWorldCurve)가 같이 쓰는 사진 섞기.
// 사진 네 세트(0 풀·1 흙·2 바위·3 자갈 — K-0146 `Resources/TexturesReal/<세트>/<세트>_hi·_hi_n·_hi_r`)를
// 정점 가중치(UV1 xyzw, `RegionMaterials.ApplyGroundPhoto` 가 텍스처를 꽂고 빌더가 가중치를 굽는다)로 섞는다.
// 색은 원래 정점색 그대로 — 사진은 "평균 대비 밝기·무늬" 로만 곱한다(사진 ÷ 그 사진 1×1 밉 평균). 그래서 칸 섞임·바이옴 물들임이 안 바뀐다.
// 법선은 사진 법선을 가중 합해 화면 미분(ddx/ddy) 접선틀로 세운다(평면 UV 라 접선 데이터 없음).
// 반복 깨기: 풀 사진을 7.3배 크게 한 번 더 읽어 밝기만 ±(큰 얼룩). 머티리얼 키워드 _SAGA_GROUND_PHOTO 일 때만 컴파일·사용.
// Lighting.hlsl 다음에 include.

TEXTURE2D(_GBase0); SAMPLER(sampler_GBase0);
TEXTURE2D(_GBase1); TEXTURE2D(_GBase2); TEXTURE2D(_GBase3);
TEXTURE2D(_GNorm0); TEXTURE2D(_GNorm1); TEXTURE2D(_GNorm2); TEXTURE2D(_GNorm3);
TEXTURE2D(_GRough0); TEXTURE2D(_GRough1); TEXTURE2D(_GRough2); TEXTURE2D(_GRough3);
float4 _GTiling;        // 세트별 되풀이 크기(m)
float _PhotoStrength;   // 0 = 사진 안 씀(옛 디테일 곱) · 1 = 사진

// 사진 ÷ 그 사진 평균(가장 작은 밉) — 색은 정점색이 정하고 사진은 무늬·밝기만.
half3 SagaPhotoRatio(TEXTURE2D_PARAM(tex, smp), float2 uv)
{
    half3 c = SAMPLE_TEXTURE2D(tex, smp, uv).rgb;
    half3 m = SAMPLE_TEXTURE2D_LOD(tex, smp, float2(0.5, 0.5), 12).rgb;
    return clamp(c / max(m, 0.03h), 0.15h, 2.5h);
}

// 화면 미분 접선틀(Mikkelsen 없이) — N 은 정규화된 월드 법선, p 는 월드 위치, uv 는 사진을 읽은 평면 좌표.
half3 SagaPerturbNormal(float3 N, float3 p, float2 uv, half3 tn)
{
    float3 dp1 = ddx(p), dp2 = ddy(p);
    float2 duv1 = ddx(uv), duv2 = ddy(uv);
    float3 dp2perp = cross(dp2, N), dp1perp = cross(N, dp1);
    float3 T = dp2perp * duv1.x + dp1perp * duv2.x;
    float3 B = dp2perp * duv1.y + dp1perp * duv2.y;
    float s = rsqrt(max(max(dot(T, T), dot(B, B)), 1e-12));
    return (half3)normalize(T * s * tn.x + B * s * tn.y + N * tn.z);
}

// w = 세트 가중치(합이 0 이면 사진 없음 — 호출한 쪽 옛 길). tint = 정점색(바탕색). 결과: albedo·법선·거칠기.
void SagaGroundPhoto(float2 uvM, float4 w, half3 tint, float3 positionWS, float3 normalWS,
                     out half3 albedo, out half3 nOut, out half rough)
{
    float sum = dot(w, 1.0);
    w = sum > 1e-3 ? w / sum : float4(1, 0, 0, 0);
    float2 u0 = uvM / _GTiling.x, u1 = uvM / _GTiling.y, u2 = uvM / _GTiling.z, u3 = uvM / _GTiling.w;

    half3 ratio = SagaPhotoRatio(TEXTURE2D_ARGS(_GBase0, sampler_GBase0), u0) * w.x
                + SagaPhotoRatio(TEXTURE2D_ARGS(_GBase1, sampler_GBase0), u1) * w.y
                + SagaPhotoRatio(TEXTURE2D_ARGS(_GBase2, sampler_GBase0), u2) * w.z
                + SagaPhotoRatio(TEXTURE2D_ARGS(_GBase3, sampler_GBase0), u3) * w.w;
    // 큰 얼룩 — 같은 무늬가 바둑판처럼 되풀이돼 보이지 않게(밝기만 ±).
    half macro = dot(SagaPhotoRatio(TEXTURE2D_ARGS(_GBase0, sampler_GBase0), uvM / (_GTiling.x * 7.3) + 0.37), half3(0.299h, 0.587h, 0.114h));
    ratio *= lerp(1.0h, macro, 0.35h);
    albedo = tint * ratio;

    rough = SAMPLE_TEXTURE2D(_GRough0, sampler_GBase0, u0).r * w.x
          + SAMPLE_TEXTURE2D(_GRough1, sampler_GBase0, u1).r * w.y
          + SAMPLE_TEXTURE2D(_GRough2, sampler_GBase0, u2).r * w.z
          + SAMPLE_TEXTURE2D(_GRough3, sampler_GBase0, u3).r * w.w;

    half3 tn = UnpackNormal(SAMPLE_TEXTURE2D(_GNorm0, sampler_GBase0, u0)) * w.x
             + UnpackNormal(SAMPLE_TEXTURE2D(_GNorm1, sampler_GBase0, u1)) * w.y
             + UnpackNormal(SAMPLE_TEXTURE2D(_GNorm2, sampler_GBase0, u2)) * w.z
             + UnpackNormal(SAMPLE_TEXTURE2D(_GNorm3, sampler_GBase0, u3)) * w.w;
    tn.z = max(tn.z, 0.2h);
    nOut = SagaPerturbNormal(normalWS, positionWS, uvM, normalize(tn));

    albedo = lerp(tint, albedo, (half)_PhotoStrength);
    nOut = normalize(lerp((half3)normalWS, nOut, (half)_PhotoStrength));
}
#endif
