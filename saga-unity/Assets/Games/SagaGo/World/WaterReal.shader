Shader "Saga/WaterReal"
{
    // U-0078 사실 물 — 텍스처 없이 손 HLSL. TerrainBuilder.cs 가 강 수면·폭포 샘 웅덩이에 얹는다.
    // 잔물결 = 흐르는 값 노이즈 세 겹의 기울기 · 하늘 반사 = 프레넬(반사 프로브가 비면 안개색↔하늘 앰비언트) + 해 반짝임
    // 깊이 흡수 = 카메라 깊이로 물 두께 → exp 감쇠(얕은 청록 → 깊은 남색) · 물가 거품 = 두께 0~_FoamWidth 띠
    // 굴절 = _Refract 1(불투명 텍스처가 켜진 파이프라인 — PC)일 때만 · 깊이 텍스처가 없으면 고정 알파+프레넬로 떨어진다.
    Properties
    {
        _ShallowColor ("Shallow", Color) = (0.20, 0.47, 0.45, 1)
        _DeepColor ("Deep", Color) = (0.04, 0.15, 0.22, 1)
        _Absorb ("Absorb per m", Float) = 0.55
        _ColorDepth ("Color depth m", Float) = 2.6
        _FallbackAlpha ("Alpha without depth", Range(0, 1)) = 0.8
        _FakeDepth ("Extra depth m", Float) = 0
        _WaveScale ("Wave scale", Float) = 0.32
        _WaveSpeed ("Wave speed", Float) = 0.45
        _WaveStrength ("Wave strength", Range(0, 1)) = 0.2
        _FlowDir ("Flow dir xz", Vector) = (0.8, 0.0, 0.6, 0)
        _SunGloss ("Sun gloss power", Float) = 380
        _SunStrength ("Sun strength", Float) = 2.4
        _FoamColor ("Foam", Color) = (0.92, 0.95, 0.94, 1)
        _FoamWidth ("Foam width m", Float) = 0.45
        _FoamAmount ("Foam amount", Range(0, 1)) = 0.85
        _Refract ("Refract (set by code)", Float) = 0
        _RefractStrength ("Refract strength", Float) = 0.035
    }
    SubShader
    {
        Tags { "RenderType" = "Transparent" "Queue" = "Transparent" "RenderPipeline" = "UniversalPipeline" "IgnoreProjector" = "True" }
        Blend One OneMinusSrcAlpha   // 미리 곱한 알파 — 반사·반짝임이 투명도와 따로 더해진다
        ZWrite Off
        Cull Off

        Pass
        {
            Name "WaterReal"
            Tags { "LightMode" = "UniversalForward" }
            HLSLPROGRAM
            #pragma vertex Vert
            #pragma fragment Frag
            #pragma multi_compile_fog
            #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Core.hlsl"
            #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Lighting.hlsl"
            #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/DeclareDepthTexture.hlsl"
            #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/DeclareOpaqueTexture.hlsl"

            CBUFFER_START(UnityPerMaterial)
                float4 _ShallowColor, _DeepColor, _FoamColor, _FlowDir;
                float _Absorb, _ColorDepth, _FallbackAlpha, _FakeDepth;
                float _WaveScale, _WaveSpeed, _WaveStrength, _SunGloss, _SunStrength;
                float _FoamWidth, _FoamAmount, _Refract, _RefractStrength;
            CBUFFER_END

            struct Attributes { float4 positionOS : POSITION; };
            struct Varyings
            {
                float4 positionHCS : SV_POSITION;
                float3 positionWS : TEXCOORD0;
                float4 screenPos : TEXCOORD1;
                float fogCoord : TEXCOORD2;
            };

            Varyings Vert(Attributes IN)
            {
                Varyings OUT;
                VertexPositionInputs p = GetVertexPositionInputs(IN.positionOS.xyz);
                OUT.positionHCS = p.positionCS;
                OUT.positionWS = p.positionWS;
                OUT.screenPos = ComputeScreenPos(p.positionCS);
                OUT.fogCoord = ComputeFogFactor(p.positionCS.z);
                return OUT;
            }

            float Hash(float2 p)
            {
                float3 p3 = frac(float3(p.xyx) * 0.1031);
                p3 += dot(p3, p3.yzx + 33.33);
                return frac((p3.x + p3.y) * p3.z);
            }

            // 값 노이즈 + 해석적 기울기(xy) — 법선을 세 번 더 찍지 않는다
            float3 Noise(float2 p)
            {
                float2 i = floor(p), f = frac(p);
                float2 u = f * f * (3.0 - 2.0 * f);
                float2 du = 6.0 * f * (1.0 - f);
                float a = Hash(i), b = Hash(i + float2(1, 0)), c = Hash(i + float2(0, 1)), d = Hash(i + float2(1, 1));
                float v = a + (b - a) * u.x + (c - a) * u.y + (a - b - c + d) * u.x * u.y;
                float2 g = du * (float2(b - a, c - a) + (a - b - c + d) * u.yx);
                return float3(v, g);
            }

            // 세 겹 — 큰 너울은 흐름 방향으로, 잔물결 둘은 엇갈려 흐른다
            float2 WaveSlope(float2 xz, float t)
            {
                float2 flow = normalize(_FlowDir.xz + 1e-4);
                float2 side = float2(-flow.y, flow.x);
                float s = _WaveScale;
                float2 g = Noise(xz * s + flow * t * 0.6).yz * s * 0.7;
                g += Noise(xz * s * 2.3 + (flow * 0.7 + side * 0.5) * t * 1.1 + 17.0).yz * s * 2.3 * 0.5;
                g += Noise(xz * s * 5.1 + (flow * 0.4 - side * 0.8) * t * 1.7 + 41.0).yz * s * 5.1 * 0.22;
                return g;
            }

            half4 Frag(Varyings IN) : SV_Target
            {
                float3 V = normalize(GetWorldSpaceViewDir(IN.positionWS));
                float t = _Time.y * _WaveSpeed;
                float2 slope = WaveSlope(IN.positionWS.xz, t) * _WaveStrength;
                float3 N = normalize(float3(-slope.x, 1.0, -slope.y));
                if (dot(V, float3(0, 1, 0)) < 0) N.y = -N.y;   // 물 밑에서 볼 때(Cull Off)

                float2 suv = IN.screenPos.xy / IN.screenPos.w;
                float fragEye = IN.screenPos.w;
                float sceneEye = LinearEyeDepth(SampleSceneDepth(suv), _ZBufferParams);
                float thick = sceneEye - fragEye;
                // 깊이 텍스처가 없으면(먼 평면·0) 값이 말이 안 된다 — 고정 알파로 떨어진다
                bool hasDepth = sceneEye < _ProjectionParams.z * 0.98 && thick > -0.05;
                // 물 두께(시선 길이) → 수직 깊이에 가깝게 — 비스듬히 볼수록 길어지는 만큼 덜어 낸다
                float depth = max(thick, 0.0) * saturate(abs(V.y) + 0.25) + _FakeDepth;

                float transmit = hasDepth ? exp(-depth * _Absorb) : 1.0 - _FallbackAlpha;
                float a = 1.0 - transmit;
                float tint = hasDepth ? saturate(1.0 - exp(-depth / max(_ColorDepth, 0.01))) : 0.7;

                Light sun = GetMainLight();
                float ndl = saturate(dot(N, sun.direction)) * 0.55 + 0.45;
                half3 amb = unity_AmbientSky.rgb * 0.5 + unity_AmbientEquator.rgb * 0.3;
                half3 body = lerp(_ShallowColor.rgb, _DeepColor.rgb, tint) * (sun.color * ndl * 0.75 + amb);

                // 굴절(PC) — 물 밑 불투명을 법선으로 살짝 밀어 직접 섞는다(그때는 알파 1)
                half3 under = 0;
                bool refr = _Refract > 0.5 && hasDepth;
                if (refr)
                {
                    float2 ruv = suv + slope * _RefractStrength * saturate(depth);
                    float rEye = LinearEyeDepth(SampleSceneDepth(ruv), _ZBufferParams);
                    if (rEye < fragEye) ruv = suv;   // 물 위 물체가 끌려 들어오지 않게
                    under = SampleSceneColor(ruv);
                }

                // 프레넬 하늘 반사 — 반사 프로브가 비었으면(하늘 그림 없음) 안개색(수평선)↔하늘 앰비언트
                float3 R = reflect(-V, N);
                half3 probe = GlossyEnvironmentReflection(R, 0.06, 1.0);
                half3 skyGrad = lerp(unity_FogColor.rgb, unity_AmbientSky.rgb * 1.25, saturate(R.y * 1.6));
                half3 refl = dot(probe, half3(0.333, 0.333, 0.333)) > 0.02 ? probe : skyGrad;
                float F = 0.02 + 0.98 * pow(1.0 - saturate(dot(N, V)), 5.0);
                F = min(F, 0.9);

                float3 H = normalize(sun.direction + V);
                half3 spec = sun.color * pow(saturate(dot(N, H)), _SunGloss) * _SunStrength * saturate(sun.direction.y * 4.0 + 0.2);

                half3 rgb;
                float A;
                if (refr)
                {
                    rgb = lerp(under * transmit + body * a, refl, F) + spec;
                    A = 1.0;
                }
                else
                {
                    rgb = body * a * (1.0 - F) + refl * F + spec;
                    A = 1.0 - transmit * (1.0 - F);
                }

                // 물가 거품 — 얕은 띠, 노이즈로 끊고 흘려 보낸다(깊이 없으면·_FakeDepth 웅덩이는 없음)
                if (hasDepth && _FakeDepth <= 0.0)
                {
                    float edge = 1.0 - smoothstep(0.0, _FoamWidth, depth);
                    float n = Noise(IN.positionWS.xz * 1.7 + _FlowDir.xz * t * 0.8).x;
                    float foam = saturate(edge * (0.55 + n * 0.9) - (1.0 - edge) * 0.4) * _FoamAmount;
                    half3 foamCol = _FoamColor.rgb * (sun.color * 0.6 + amb * 0.8);
                    rgb = rgb * (1.0 - foam) + foamCol * foam;
                    A = A * (1.0 - foam) + foam;
                }

                rgb = MixFogColor(rgb, unity_FogColor.rgb * A, IN.fogCoord);
                return half4(rgb, A);
            }
            ENDHLSL
        }
    }
    FallBack Off
}
