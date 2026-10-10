Shader "Saga/SkyReal"
{
    // U-0083 사실 하늘(스카이박스, 손 HLSL·텍스처 없음) — SkyPass 가 시각에서 계산한 해·달 방향(_SunDir·_MoonDir)과
    // SkyWeather 의 날씨 값(_CloudCover·_Overcast·_Wind)을 넘긴다. 색 상수는 선형값(프로젝트 Linear).
    // 하늘빛 = 레일리 근사(천정 파랑 → 지평선 옅게, 해가 낮으면 지평선 주황·천정 보랏빛 남색) + 미 빛무리 + 해 원반 ·
    // 구름 = 2D FBM 을 하늘 높이 평면으로 투영해 바람으로 흘림, 해 쪽 가장자리 은빛·노을 주황 · 밤 = 절차 별 + 달 원반 ·
    // 지평선 띠는 안개색(unity_FogColor)으로 녹여 3D 땅의 안개와 이음매가 안 생기게.
    // U-0079 미래 땅 덧층 `_Future`(0~1, SkyPass 가 땅 자리로 정함) — 북동 하늘 큰 행성+고리(낮 옅게·밤 또렷)·밤 북쪽 오로라·별 2.5배·지평선 보랏빛.
    // 구름·흐림이 덧층을 가린다. 0 이면 덧층 분기를 안 타서 사실 하늘 픽셀이 그대로.
    Properties
    {
        _SunDir ("Sun dir (code)", Vector) = (0.3, 0.8, -0.5, 0)
        _MoonDir ("Moon dir (code)", Vector) = (-0.3, 0.6, 0.5, 0)
        _CloudCover ("Cloud cover", Range(0, 1)) = 0.35
        _Overcast ("Overcast", Range(0, 1)) = 0
        _Wind ("Wind", Float) = 1
        _CloudScale ("Cloud scale", Float) = 1.4
        _SunSize ("Sun size deg", Float) = 1.6
        _Exposure ("Exposure", Float) = 1
        _HorizonFog ("Horizon fog blend", Range(0, 1)) = 0.65
        _Future ("Future overlay (code)", Range(0, 1)) = 0
    }
    SubShader
    {
        Tags { "Queue" = "Background" "RenderType" = "Background" "RenderPipeline" = "UniversalPipeline" "PreviewType" = "Skybox" }
        Cull Off ZWrite Off

        Pass
        {
            HLSLPROGRAM
            #pragma vertex Vert
            #pragma fragment Frag
            #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Core.hlsl"

            CBUFFER_START(UnityPerMaterial)
                float4 _SunDir, _MoonDir;
                float _CloudCover, _Overcast, _Wind, _CloudScale, _SunSize, _Exposure, _HorizonFog, _Future;
            CBUFFER_END

            struct Attributes { float4 positionOS : POSITION; };
            struct Varyings { float4 positionHCS : SV_POSITION; float3 dir : TEXCOORD0; };

            Varyings Vert(Attributes IN)
            {
                Varyings OUT;
                OUT.positionHCS = TransformObjectToHClip(IN.positionOS.xyz);
                OUT.dir = IN.positionOS.xyz;
                return OUT;
            }

            float Hash2(float2 p)
            {
                float3 p3 = frac(float3(p.xyx) * 0.1031);
                p3 += dot(p3, p3.yzx + 33.33);
                return frac((p3.x + p3.y) * p3.z);
            }
            float Hash3(float3 p)
            {
                p = frac(p * 0.1031);
                p += dot(p, p.zyx + 31.32);
                return frac((p.x + p.y) * p.z);
            }
            float Noise(float2 p)
            {
                float2 i = floor(p), f = frac(p);
                float2 u = f * f * (3.0 - 2.0 * f);
                float a = Hash2(i), b = Hash2(i + float2(1, 0)), c = Hash2(i + float2(0, 1)), d = Hash2(i + float2(1, 1));
                return lerp(lerp(a, b, u.x), lerp(c, d, u.x), u.y);
            }
            // 겹 수는 성능 측정으로 정했다(U-0083: 5겹이면 1만리 fps 가 10% 넘게 떨어짐) — 모양 4겹, 그늘 3겹
            float Fbm(float2 p, int octaves)
            {
                float v = 0, a = 0.5, norm = 0;
                float2x2 r = float2x2(0.8, -0.6, 0.6, 0.8);
                [unroll] for (int i = 0; i < 4; i++)
                {
                    if (i >= octaves) break;
                    v += a * Noise(p); norm += a; p = mul(r, p) * 2.03 + 11.7; a *= 0.5;
                }
                return v / norm * 0.94;
            }

            half4 Frag(Varyings IN) : SV_Target
            {
                float3 d = normalize(IN.dir);
                float3 sun = normalize(_SunDir.xyz);
                float3 moon = normalize(_MoonDir.xyz);
                float sunEl = sun.y;
                float day = smoothstep(-0.14, 0.10, sunEl);                       // 0 밤 → 1 낮
                float low = smoothstep(-0.16, 0.02, sunEl) * (1.0 - smoothstep(0.02, 0.5, sunEl));  // 해가 지평선 언저리(고도 ~30° 아래부터 노을빛)
                float up = saturate(d.y);
                float cosS = dot(d, sun);

                // 해 쪽 지평선일수록 노을이 짙다
                float2 hd = normalize(d.xz + 1e-5), hs = normalize(sun.xz + 1e-5);
                float toward = pow(saturate(dot(hd, hs) * 0.5 + 0.5), 2.0);

                // 레일리 근사 — 천정·지평선 두 색을 높이 곡선으로
                float3 zenDay = float3(0.05, 0.16, 0.52), horDay = float3(0.45, 0.62, 0.86);
                float3 zenSet = float3(0.06, 0.06, 0.20), horSet = float3(1.00, 0.40, 0.14);
                float3 zenNight = float3(0.004, 0.007, 0.022), horNight = float3(0.016, 0.024, 0.05);
                float3 zen = lerp(zenNight, zenDay, day);
                float3 hor = lerp(horNight, horDay, day);
                zen = lerp(zen, zenSet, low * 0.75);
                hor = lerp(hor, lerp(horSet * 0.55 + float3(0.12, 0.08, 0.14), horSet, toward), low);
                hor = lerp(hor, hor * float3(0.92, 0.82, 1.18) + float3(0.012, 0.0, 0.03) * (1.0 - day), _Future * 0.6);   // 미래 땅 — 지평선 보랏빛
                float3 sky = lerp(hor, zen, pow(up, 0.42));

                // 미 빛무리 + 해 원반(원반은 지평선 아래면 숨김)
                float3 sunCol = lerp(float3(1.0, 0.45, 0.18), float3(1.0, 0.96, 0.88), smoothstep(0.0, 0.45, sunEl));
                float vis = smoothstep(-0.03, 0.02, sunEl);
                sky += sunCol * (pow(saturate(cosS), 6.0) * 0.18 + pow(saturate(cosS), 80.0) * 0.6) * vis * (0.35 + 0.65 * day);
                float sunR = cos(radians(_SunSize));
                float disk = smoothstep(sunR, lerp(sunR, 1.0, 0.25), cosS) * smoothstep(-0.01, 0.01, d.y);

                // 밤 — 별·달
                float night = 1.0 - day;
                float3 sp = d * 260.0;
                float3 cell = floor(sp);
                float hs3 = Hash3(cell);
                float star = step(lerp(0.9965, 0.99125, _Future), hs3) * saturate(1.0 - length(frac(sp) - 0.5) * 2.6) * (0.4 + 0.6 * Hash3(cell + 7.0));
                star *= smoothstep(0.02, 0.25, d.y) * night;
                float cosM = dot(d, moon);
                float moonDisk = smoothstep(cos(radians(1.3)), cos(radians(1.05)), cosM) * smoothstep(0.0, 0.05, moon.y) * night;
                float moonGlow = pow(saturate(cosM), 40.0) * 0.08 * night * smoothstep(0.0, 0.1, moon.y);

                // 구름 — 하늘 높이 평면 투영
                float3 col = sky + star * float3(0.9, 0.95, 1.1) * 1.5 + moonGlow * float3(0.6, 0.7, 1.0);

                // 미래 땅 덧층 — 행성(공 명암·띠·기운 고리)과 밤 오로라. 오로라는 구름 아래(먼저 그림), 행성은 구름 뒤에 비쳐 보이게 구름 다음에 섞는다
                float pMix = 0.0, rMix = 0.0;
                float3 pCol = 0.0, rCol = 0.0;
                [branch] if (_Future > 0.001)   // 바깥 땅은 통째로 건너뛴다(균일 값 분기)
                {
                    float3 pDir = normalize(float3(0.62, 0.42, 0.66));                     // 북동 · 고도 ~25°
                    float sinR = sin(radians(7.0));
                    float cosP = dot(d, pDir);
                    float3 t1 = normalize(cross(float3(0, 1, 0), pDir)), t2 = cross(pDir, t1);
                    float3 q = d - pDir * cosP;
                    float2 uv = float2(dot(q, t1), dot(q, t2)) / sinR;                      // 행성 반지름 = 1
                    float r2 = dot(uv, uv);
                    float front = step(0.0, cosP);
                    float pAlpha = lerp(0.6, 1.0, night) * _Future * front * smoothstep(0.0, 0.08, d.y);
                    float pDisk = (1.0 - smoothstep(0.96, 1.0, r2)) * front;
                    float3 pn = normalize(t1 * uv.x + t2 * uv.y - pDir * sqrt(saturate(1.0 - r2)));
                    float pl = saturate(dot(pn, sun)) * day + saturate(dot(pn, moon)) * 0.12 * night;
                    float bands = 0.82 + 0.18 * sin(uv.y * 17.0 + Noise(uv * 3.0) * 2.5);
                    float3 pAlb = lerp(float3(0.55, 0.62, 0.78), float3(0.72, 0.58, 0.82), saturate(uv.y * 0.5 + 0.5)) * bands;
                    pCol = pAlb * (pl * 1.15 + 0.05) + sky * 0.35;
                    // 고리 — 행성 평면에서 20° 기울고 납작한 띠, 행성 뒤쪽 반은 공에 가린다
                    float2 ru = float2(uv.x * 0.94 + uv.y * 0.34, -uv.x * 0.34 + uv.y * 0.94);
                    float re = length(float2(ru.x, ru.y * 3.4));
                    float ring = smoothstep(1.32, 1.40, re) * (1.0 - smoothstep(1.78, 1.92, re)) * (0.55 + 0.45 * sin(re * 40.0));
                    ring *= 1.0 - pDisk * step(0.0, ru.y);
                    rCol = float3(0.80, 0.76, 0.86) * (0.25 + 0.75 * saturate(sun.y * 2.0 + 0.3) * day + 0.2 * night);
                    pMix = pDisk * pAlpha;
                    rMix = saturate(ring) * pAlpha * 0.7;

                    // 오로라 — 북쪽(+Z) 하늘 커튼, 아래 초록 → 위 보라, 천천히 일렁임
                    float north = smoothstep(0.05, 0.6, d.z) * smoothstep(0.03, 0.15, d.y);
                    float az = atan2(d.x, d.z);
                    float t = _Time.y;
                    float base = 0.22 + (Noise(float2(az * 2.2 + t * 0.03, 3.1)) - 0.5) * 0.18;
                    float h = d.y - base;
                    float curtain = exp(-h * h / (h > 0.0 ? 0.045 : 0.004));                // 아래 끝 또렷·위로 길게 번짐
                    float rays = 0.45 + 0.55 * Noise(float2(az * 38.0 + t * 0.25, t * 0.1));
                    float3 aCol = lerp(float3(0.10, 0.95, 0.45), float3(0.55, 0.25, 0.95), saturate(h * 3.0 + 0.2));
                    col += aCol * curtain * rays * north * night * _Future * 0.55;
                }
                float cover = saturate(_CloudCover * 0.75 + _Overcast * 0.5 + 0.08);
                float cloudDens = 0.0;
                if (d.y > 0.0)
                {
                    float2 uv = d.xz / (d.y + 0.08) * _CloudScale;
                    float2 wind = float2(0.012, 0.004) * _Wind * _Time.y;
                    float n = Fbm(uv + wind, 4);
                    float dens = smoothstep(1.0 - cover - 0.06, 1.0 - cover + 0.28, n);
                    dens *= smoothstep(0.0, 0.22, d.y);
                    // 해 쪽으로 조금 옮긴 자리의 밀도 → 그 사이가 얇으면 밝다(자기 그늘)
                    float n2 = Fbm(uv + wind + hs * 0.09, 3);
                    float lit = saturate(0.6 + (n - n2) * 4.0);
                    // 밤 구름은 달빛 남회색(낮 색을 어둡게만 하면 갈색 얼룩이 된다)
                    float3 cLit = lerp(float3(0.055, 0.065, 0.10), lerp(float3(0.95, 0.96, 1.0), float3(1.0, 0.58, 0.34), low), day);
                    float3 cShade = lerp(float3(0.022, 0.028, 0.045), lerp(float3(0.42, 0.46, 0.55), float3(0.36, 0.26, 0.36), low), day);
                    float3 cloud = lerp(cShade, cLit, lit);
                    cloud += sunCol * pow(saturate(cosS), 10.0) * (1.0 - dens) * 0.9 * vis;   // 해 쪽 가장자리 은빛
                    cloud = lerp(cloud, cloud * float3(0.75, 0.78, 0.82), _Overcast);
                    col = lerp(col, cloud, dens);
                    cloudDens = dens;
                    disk *= 1.0 - dens;
                    moonDisk *= 1.0 - dens;
                }
                col += sunCol * disk * 18.0 * vis;
                col += float3(0.8, 0.85, 0.95) * moonDisk * 1.2;
                float see = 1.0 - cloudDens * 0.7;                                        // 행성은 큰 몸이라 얇은 구름 너머로 비친다(0 이면 그대로)
                col = lerp(col, pCol, pMix * see);
                col = lerp(col, rCol, rMix * see);

                // 흐림 — 하늘 전체를 잿빛으로
                float3 grey = float3(0.40, 0.43, 0.48) * lerp(0.04, 1.0, day);
                col = lerp(col, grey, _Overcast * 0.7);

                // 지평선 띠 → 안개색, 땅 아래는 안개색으로 덮음
                float fogBand = (1.0 - smoothstep(0.0, 0.16, d.y)) * _HorizonFog;
                col = lerp(col, unity_FogColor.rgb, fogBand);
                if (d.y < 0.0) col = lerp(col, unity_FogColor.rgb, saturate(-d.y * 6.0 + _HorizonFog));
                return half4(col * _Exposure, 1.0);
            }
            ENDHLSL
        }
    }
    FallBack Off
}
