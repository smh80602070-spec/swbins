#ifndef SAGA_WET_PUDDLE_INCLUDED
#define SAGA_WET_PUDDLE_INCLUDED
// tasks U-0214 — 비 오는 날 평지 물웅덩이·빗방울 물결(고돗 terrain_triplanar.gdshader G-0359 웅덩이·G-0362 물결 이식).
// 땅 전체의 어둡게·매끈하게(색 ×0.64·거칠기 ×0.45)는 WetGround 가 재질 속성(_BaseColor·_Roughness)으로 이미 곱한다 →
// 여기는 **웅덩이 층만** 더한다(두 번 곱하지 않음). wet 0 이면 부르는 쪽 분기에서 건너뛰어 옛 화면 그대로.
// 텍스처 없이 해시·값 잡음만. 물결은 웅덩이 픽셀(puddle > 0.01)에서만(폰 비용).

float SagaWetHash(float2 p)
{
    return frac(sin(dot(p, float2(127.1, 311.7))) * 43758.5453123);
}

float SagaWetNoise(float2 p)
{
    float2 i = floor(p);
    float2 f = frac(p);
    float a = SagaWetHash(i);
    float b = SagaWetHash(i + float2(1.0, 0.0));
    float c = SagaWetHash(i + float2(0.0, 1.0));
    float d = SagaWetHash(i + float2(1.0, 1.0));
    float2 u = f * f * (3.0 - 2.0 * f);
    return lerp(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
}

// G-0362 빗방울 물결 — 0.7m 칸마다 제 박자로 퍼지는 동그라미 하나(법선을 바깥으로 민다). 칸 안 자리·박자는 해시.
float2 SagaRainRings(float2 p, float t)
{
    float2 cell = floor(p / 0.7);
    float2 acc = float2(0.0, 0.0);
    [unroll] for (int i = -1; i <= 1; i++)
    {
        [unroll] for (int j = -1; j <= 1; j++)
        {
            float2 c = cell + float2((float)i, (float)j);
            float h = SagaWetHash(c);
            float2 ctr = (c + float2(frac(h * 13.7), frac(h * 71.3)) * 0.8 + 0.1) * 0.7;
            float ph = frac(t * 0.9 + h);
            float2 d = p - ctr;
            float r = length(d);
            float ring = (1.0 - smoothstep(0.0, 0.035, abs(r - ph * 0.42))) * (1.0 - ph);
            acc += (r > 0.001 ? d / r : float2(0.0, 0.0)) * ring;
        }
    }
    return acc;
}

// 평평한 곳(경사 0.08 아래 → 0.25 위는 없음)에만 잡음 얼룩 웅덩이 — 색 ×0.55·거칠기 0.04(거의 거울)·법선 평평(면 법선 쪽).
// 비가 내리는 동안(rain) 웅덩이에 빗방울 물결. geomN = 면(정점) 법선, normalWS = 사진 법선까지 얹힌 지금 법선.
void SagaWetPuddle(float3 positionWS, float3 geomN, float wet, float rain, inout half3 albedo, inout half rough, inout float3 normalWS)
{
    float slope = 1.0 - saturate(geomN.y);
    float flatW = 1.0 - smoothstep(0.08, 0.25, slope);
    float2 xz = positionWS.xz;
    float pn = SagaWetNoise(xz * 0.09 + float2(13.0, 5.0)) * 0.75 + SagaWetNoise(xz * 0.35 + float2(2.0, 9.0)) * 0.25;
    float puddle = smoothstep(0.6, 0.68, pn) * flatW * wet;
    albedo = lerp(albedo, albedo * 0.55h, (half)puddle);
    rough = lerp(rough, 0.04h, (half)puddle);
    normalWS = normalize(lerp(normalWS, geomN, puddle));
    if (rain > 0.001 && puddle > 0.01)
    {
        float2 rr = SagaRainRings(xz, _Time.y) * (0.45 * rain * puddle);
        normalWS = normalize(normalWS + float3(rr.x, 0.0, rr.y));
    }
}
#endif
