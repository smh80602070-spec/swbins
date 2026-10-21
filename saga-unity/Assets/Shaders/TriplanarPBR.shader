// Saga/TriplanarPBR — tasks U-0085 2단계: 색만 있는 배경 GLB(UV 가 쓸모없음)에 자체 사진 세트(K-0146 `Resources/TexturesReal/<세트>/<세트>_hi·_hi_n·_hi_r`)를
// 월드 위치로 세 방향 투영(트라이플레이너)해 URP PBR 로 비춘다. 바탕 = 사진 × 원래 재질 색 물들임(_BaseColor), 법선 = 화이트아웃 블렌드, 거칠기 = _RoughMap R × _Roughness.
// 크기 = _Tiling(m 당 한 번 되풀이). 정점색은 안 쓴다. 그림자·깊이·깊이법선은 URP Lit 패스를 빌린다(속성 이름 _BaseMap·_BaseColor·_Cutoff 를 맞춤).
// 본보기: Games/SagaGo/World/VertexColorTriplanarLit.shader(트라이플레이너) · URP Lit(PBR 조명).
Shader "Saga/TriplanarPBR"
{
    Properties
    {
        _BaseMap("바탕 사진", 2D) = "white" {}
        _BaseColor("물들임 색", Color) = (1, 1, 1, 1)
        [Normal] _BumpMap("법선", 2D) = "bump" {}
        _BumpScale("법선 세기", Range(0, 2)) = 1
        _RoughMap("거칠기(R)", 2D) = "white" {}
        _Roughness("거칠기 배율", Range(0, 1)) = 0.9
        _Metallic("금속", Range(0, 1)) = 0
        _Tiling("되풀이 크기(m)", Float) = 2
        _BlendSharpness("방향 섞기 날카로움", Range(1, 8)) = 4
        _Cutoff("Alpha Cutoff", Range(0, 1)) = 0.5
    }
    SubShader
    {
        Tags { "RenderType" = "Opaque" "RenderPipeline" = "UniversalPipeline" "Queue" = "Geometry" }

        Pass
        {
            Name "ForwardLit"
            Tags { "LightMode" = "UniversalForward" }

            HLSLPROGRAM
            #pragma target 3.5
            #pragma vertex Vert
            #pragma fragment Frag
            #pragma multi_compile _ _MAIN_LIGHT_SHADOWS _MAIN_LIGHT_SHADOWS_CASCADE _MAIN_LIGHT_SHADOWS_SCREEN
            #pragma multi_compile _ _ADDITIONAL_LIGHTS_VERTEX _ADDITIONAL_LIGHTS
            #pragma multi_compile_fragment _ _ADDITIONAL_LIGHT_SHADOWS
            #pragma multi_compile_fragment _ _SHADOWS_SOFT
            #pragma multi_compile_fragment _ _SCREEN_SPACE_OCCLUSION
            #pragma multi_compile_fog
            #pragma multi_compile_instancing

            #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Core.hlsl"
            #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Lighting.hlsl"

            TEXTURE2D(_BaseMap); SAMPLER(sampler_BaseMap);
            TEXTURE2D(_BumpMap); SAMPLER(sampler_BumpMap);
            TEXTURE2D(_RoughMap); SAMPLER(sampler_RoughMap);

            CBUFFER_START(UnityPerMaterial)
                float4 _BaseMap_ST;
                half4 _BaseColor;
                half _Cutoff;
                half _BumpScale;
                half _Roughness;
                half _Metallic;
                float _Tiling;
                half _BlendSharpness;
            CBUFFER_END

            struct Attributes
            {
                float4 positionOS : POSITION;
                float3 normalOS : NORMAL;
                UNITY_VERTEX_INPUT_INSTANCE_ID
            };

            struct Varyings
            {
                float4 positionCS : SV_POSITION;
                float3 positionWS : TEXCOORD0;
                float3 normalWS : TEXCOORD1;
                half fogFactor : TEXCOORD2;
                UNITY_VERTEX_INPUT_INSTANCE_ID
                UNITY_VERTEX_OUTPUT_STEREO
            };

            Varyings Vert(Attributes input)
            {
                Varyings o = (Varyings)0;
                UNITY_SETUP_INSTANCE_ID(input);
                UNITY_TRANSFER_INSTANCE_ID(input, o);
                UNITY_INITIALIZE_VERTEX_OUTPUT_STEREO(o);
                VertexPositionInputs p = GetVertexPositionInputs(input.positionOS.xyz);
                o.positionCS = p.positionCS;
                o.positionWS = p.positionWS;
                o.normalWS = TransformObjectToWorldNormal(input.normalOS);
                o.fogFactor = ComputeFogFactor(p.positionCS.z);
                return o;
            }

            // 화이트아웃 블렌드 — 탄젠트 공간 법선을 세 투영면 기준 월드 법선으로.
            half3 TriNormal(half3 tn, half3 n, int axis)
            {
                // axis 0: YZ 면(x 법선) · 1: XZ 면(y) · 2: XY 면(z)
                half3 r;
                if (axis == 0) { half3 w = half3(tn.xy + n.zy, abs(tn.z) * n.x); r = w.zyx; }
                else if (axis == 1) { half3 w = half3(tn.xy + n.xz, abs(tn.z) * n.y); r = w.xzy; }
                else { half3 w = half3(tn.xy + n.xy, abs(tn.z) * n.z); r = w.xyz; }
                return r;
            }

            half4 Frag(Varyings input) : SV_Target
            {
                UNITY_SETUP_INSTANCE_ID(input);
                float3 n = normalize(input.normalWS);
                float3 w = pow(abs(n), _BlendSharpness);
                w /= max(dot(w, 1.0), 1e-4);
                float2 uvX = input.positionWS.zy / _Tiling;
                float2 uvY = input.positionWS.xz / _Tiling;
                float2 uvZ = input.positionWS.xy / _Tiling;

                half3 albedo = SAMPLE_TEXTURE2D(_BaseMap, sampler_BaseMap, uvX).rgb * w.x
                             + SAMPLE_TEXTURE2D(_BaseMap, sampler_BaseMap, uvY).rgb * w.y
                             + SAMPLE_TEXTURE2D(_BaseMap, sampler_BaseMap, uvZ).rgb * w.z;
                half rough = SAMPLE_TEXTURE2D(_RoughMap, sampler_RoughMap, uvX).r * w.x
                           + SAMPLE_TEXTURE2D(_RoughMap, sampler_RoughMap, uvY).r * w.y
                           + SAMPLE_TEXTURE2D(_RoughMap, sampler_RoughMap, uvZ).r * w.z;
                half3 tnX = UnpackNormalScale(SAMPLE_TEXTURE2D(_BumpMap, sampler_BumpMap, uvX), _BumpScale);
                half3 tnY = UnpackNormalScale(SAMPLE_TEXTURE2D(_BumpMap, sampler_BumpMap, uvY), _BumpScale);
                half3 tnZ = UnpackNormalScale(SAMPLE_TEXTURE2D(_BumpMap, sampler_BumpMap, uvZ), _BumpScale);
                half3 sgn = sign(n);
                tnX.z *= sgn.x; tnY.z *= sgn.y; tnZ.z *= sgn.z;
                half3 nWS = normalize(TriNormal(tnX, n, 0) * w.x + TriNormal(tnY, n, 1) * w.y + TriNormal(tnZ, n, 2) * w.z);

                InputData inputData = (InputData)0;
                inputData.positionWS = input.positionWS;
                inputData.normalWS = nWS;
                inputData.viewDirectionWS = GetWorldSpaceNormalizeViewDir(input.positionWS);
                inputData.shadowCoord = TransformWorldToShadowCoord(input.positionWS);
                inputData.fogCoord = input.fogFactor;
                inputData.bakedGI = SampleSH(nWS);
                inputData.normalizedScreenSpaceUV = GetNormalizedScreenSpaceUV(input.positionCS);
                inputData.shadowMask = half4(1, 1, 1, 1);

                SurfaceData s = (SurfaceData)0;
                s.albedo = albedo * _BaseColor.rgb;
                s.metallic = _Metallic;
                s.smoothness = saturate(1.0h - rough * _Roughness);
                s.normalTS = half3(0, 0, 1);
                s.occlusion = 1;
                s.alpha = 1;

                half4 c = UniversalFragmentPBR(inputData, s);
                c.rgb = MixFog(c.rgb, inputData.fogCoord);
                return c;
            }
            ENDHLSL
        }

        UsePass "Universal Render Pipeline/Lit/ShadowCaster"
        UsePass "Universal Render Pipeline/Lit/DepthOnly"
        UsePass "Universal Render Pipeline/Lit/DepthNormals"
    }
    FallBack "Universal Render Pipeline/Lit"
}
