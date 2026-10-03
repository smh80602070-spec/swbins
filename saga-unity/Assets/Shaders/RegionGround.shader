// Saga/RegionGround — 지역 땅(tasks U-0023). 낮은·평평한 곳 = low 그림, 높거나 가파른 곳 = high 그림, 높이(z0~z1)와 경사(slope0~slope1)가 섞음비를 정한다.
// 본보기: tools/world-forge/region_hero.py 의 pbr_blend() — 물체 좌표(미터) 기준이라 그림이 tile 미터마다 반복되고, 지역 뿌리를 옮겨도 섞음이 안 변한다.
// 명암은 CelToon 과 같은 식(단계 3·림). 땅은 알파·정점색·외곽선이 없어 그 부분은 뺐다.
Shader "Saga/RegionGround"
{
    Properties
    {
        [MainTexture] _BaseMap("낮은 곳 그림(low)", 2D) = "white" {}
        _HighMap("높은 곳 그림(high)", 2D) = "white" {}
        [MainColor] _BaseColor("바탕 색(곱)", Color) = (1, 1, 1, 1)
        _TintLow("low 색조", Color) = (1, 1, 1, 1)
        _TintHigh("high 색조", Color) = (1, 1, 1, 1)
        _SatLow("low 채도", Range(0, 2)) = 1
        _SatHigh("high 채도", Range(0, 2)) = 1
        _TileLow("low 그림이 반복되는 미터", Float) = 5
        _TileHigh("high 그림이 반복되는 미터", Float) = 8
        _HeightZ0("섞기 시작 높이", Float) = 999
        _HeightZ1("섞기 끝 높이", Float) = 1000
        _Slope0("섞기 시작 경사(1-법선y)", Range(0, 1)) = 0.35
        _Slope1("섞기 끝 경사", Range(0, 1)) = 0.6
        [Toggle] _HasHigh("high 그림 있음", Float) = 0

        _BandCount("명암 단 수", Range(2, 4)) = 3
        _BandSoftness("단 경계 부드러움", Range(0, 1)) = 0.08
        _RimColor("림 색", Color) = (1, 0.95, 0.85, 1)
        _RimPower("림 폭", Range(0.5, 8)) = 4.5
        _RimStrength("림 세기", Range(0, 2)) = 0.15

        [HideInInspector] _Cutoff("_Cutoff", Float) = 0.5
        [HideInInspector] _Surface("_Surface", Float) = 0
    }

    SubShader
    {
        Tags { "RenderType" = "Opaque" "RenderPipeline" = "UniversalPipeline" "UniversalMaterialType" = "SimpleLit" "Queue" = "Geometry" "IgnoreProjector" = "True" }
        LOD 200

        Pass
        {
            Name "ForwardLit"
            Tags { "LightMode" = "UniversalForward" }
            Cull Back

            HLSLPROGRAM
            #pragma target 3.5
            #pragma exclude_renderers gles
            #pragma vertex GroundVertex
            #pragma fragment GroundFragment

            #pragma multi_compile _ _MAIN_LIGHT_SHADOWS _MAIN_LIGHT_SHADOWS_CASCADE _MAIN_LIGHT_SHADOWS_SCREEN
            #pragma multi_compile _ _ADDITIONAL_LIGHTS_VERTEX _ADDITIONAL_LIGHTS
            #pragma multi_compile _ _CLUSTER_LIGHT_LOOP
            #pragma multi_compile_fragment _ _ADDITIONAL_LIGHT_SHADOWS
            #pragma multi_compile_fragment _ _SHADOWS_SOFT
            #pragma multi_compile_instancing
            #include_with_pragmas "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Fog.hlsl"

            #include "Assets/Shaders/RegionGroundInput.hlsl"
            #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Core.hlsl"
            #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Lighting.hlsl"

            struct Attributes
            {
                float4 positionOS : POSITION;
                float3 normalOS : NORMAL;
                UNITY_VERTEX_INPUT_INSTANCE_ID
            };

            struct Varyings
            {
                float4 positionCS : SV_POSITION;
                float3 positionOS : TEXCOORD0;
                float3 normalOS : TEXCOORD1;
                float3 positionWS : TEXCOORD2;
                half3 normalWS : TEXCOORD3;
                half fogFactor : TEXCOORD4;
                UNITY_VERTEX_INPUT_INSTANCE_ID
                UNITY_VERTEX_OUTPUT_STEREO
            };

            Varyings GroundVertex(Attributes input)
            {
                Varyings output = (Varyings)0;
                UNITY_SETUP_INSTANCE_ID(input);
                UNITY_TRANSFER_INSTANCE_ID(input, output);
                UNITY_INITIALIZE_VERTEX_OUTPUT_STEREO(output);
                VertexPositionInputs vp = GetVertexPositionInputs(input.positionOS.xyz);
                output.positionCS = vp.positionCS;
                output.positionOS = input.positionOS.xyz;
                output.normalOS = input.normalOS;
                output.positionWS = vp.positionWS;
                output.normalWS = (half3)TransformObjectToWorldNormal(input.normalOS);
                output.fogFactor = ComputeFogFactor(vp.positionCS.z);
                return output;
            }

            half CelBand(half ndotl)
            {
                half stepSize = 1.0h / _BandCount;
                half banded = floor(ndotl / stepSize) * stepSize;
                half t = smoothstep(banded, banded + _BandSoftness * stepSize, ndotl);
                return saturate(lerp(banded, banded + stepSize, t));
            }

            half3 CelLight(Light light, half3 albedo, half3 normalWS, half3 viewDirWS)
            {
                half ndotl = saturate(dot(normalWS, light.direction));
                half lit = CelBand(ndotl);
                half rim = pow(1.0h - saturate(dot(normalWS, viewDirWS)), _RimPower) * _RimStrength;
                rim *= smoothstep(0.0h, 0.3h, ndotl);
                half3 atten = light.color * (light.distanceAttenuation * light.shadowAttenuation);
                return albedo * atten * lit + _RimColor.rgb * rim * atten;
            }

            half3 Saturation(half3 c, half sat)
            {
                half luma = dot(c, half3(0.2126h, 0.7152h, 0.0722h));
                return lerp(luma.xxx, c, sat);
            }

            half4 GroundFragment(Varyings input) : SV_Target
            {
                UNITY_SETUP_INSTANCE_ID(input);
                UNITY_SETUP_STEREO_EYE_INDEX_POST_VERTEX(input);

                // 그림 자리는 물체 좌표 x·z(미터)를 tile 로 나눈 값 — Blender 의 Object 좌표 매핑(1/tile)과 같다.
                float2 uvLow = input.positionOS.xz / max(_TileLow, 0.01);
                half3 low = Saturation(SAMPLE_TEXTURE2D(_BaseMap, sampler_BaseMap, uvLow).rgb * _TintLow.rgb, _SatLow);
                half3 albedo = low;
                if (_HasHigh > 0.5h)
                {
                    float2 uvHigh = input.positionOS.xz / max(_TileHigh, 0.01);
                    half3 high = Saturation(SAMPLE_TEXTURE2D(_HighMap, sampler_HighMap, uvHigh).rgb * _TintHigh.rgb, _SatHigh);
                    half byHeight = saturate((input.positionOS.y - _HeightZ0) / max(_HeightZ1 - _HeightZ0, 0.0001));
                    half bySlope = saturate((1.0h - normalize(input.normalOS).y - _Slope0) / max(_Slope1 - _Slope0, 0.0001h));
                    albedo = lerp(low, high, max(byHeight, bySlope));
                }
                albedo *= _BaseColor.rgb;

                half3 normalWS = normalize(input.normalWS);
                half3 viewDirWS = (half3)GetWorldSpaceNormalizeViewDir(input.positionWS);

                InputData inputData = (InputData)0;
                inputData.positionWS = input.positionWS;
                inputData.normalWS = normalWS;
                inputData.viewDirectionWS = viewDirWS;
                inputData.shadowCoord = TransformWorldToShadowCoord(input.positionWS);
                inputData.normalizedScreenSpaceUV = GetNormalizedScreenSpaceUV(input.positionCS);
                inputData.shadowMask = half4(1, 1, 1, 1);

                Light mainLight = GetMainLight(inputData.shadowCoord, input.positionWS, inputData.shadowMask);
                half3 color = SampleSH(normalWS) * albedo;
                color += CelLight(mainLight, albedo, normalWS, viewDirWS);

                #if defined(_ADDITIONAL_LIGHTS)
                    uint pixelLightCount = GetAdditionalLightsCount();
                    AmbientOcclusionFactor aoFactor;
                    aoFactor.indirectAmbientOcclusion = 1.0h;
                    aoFactor.directAmbientOcclusion = 1.0h;
                    #if USE_CLUSTER_LIGHT_LOOP
                    [loop] for (uint lightIndex = 0; lightIndex < min(URP_FP_DIRECTIONAL_LIGHTS_COUNT, MAX_VISIBLE_LIGHTS); lightIndex++)
                    {
                        CLUSTER_LIGHT_LOOP_SUBTRACTIVE_LIGHT_CHECK
                        Light light = GetAdditionalLight(lightIndex, inputData, inputData.shadowMask, aoFactor);
                        color += CelLight(light, albedo, normalWS, viewDirWS);
                    }
                    #endif
                    LIGHT_LOOP_BEGIN(pixelLightCount)
                        Light light = GetAdditionalLight(lightIndex, inputData, inputData.shadowMask, aoFactor);
                        color += CelLight(light, albedo, normalWS, viewDirWS);
                    LIGHT_LOOP_END
                #endif

                color = MixFog(saturate(color), input.fogFactor);
                return half4(color, 1.0h);
            }
            ENDHLSL
        }

        Pass
        {
            Name "ShadowCaster"
            Tags { "LightMode" = "ShadowCaster" }
            ZWrite On
            ZTest LEqual
            ColorMask 0
            Cull Back

            HLSLPROGRAM
            #pragma target 3.5
            #pragma exclude_renderers gles
            #pragma vertex ShadowPassVertex
            #pragma fragment ShadowPassFragment
            #pragma multi_compile_instancing
            #pragma multi_compile_vertex _ _CASTING_PUNCTUAL_LIGHT_SHADOW

            #include "Assets/Shaders/RegionGroundInput.hlsl"
            #include "Packages/com.unity.render-pipelines.universal/Shaders/ShadowCasterPass.hlsl"
            ENDHLSL
        }

        Pass
        {
            Name "DepthOnly"
            Tags { "LightMode" = "DepthOnly" }
            ZWrite On
            ColorMask R
            Cull Back

            HLSLPROGRAM
            #pragma target 3.5
            #pragma exclude_renderers gles
            #pragma vertex DepthOnlyVertex
            #pragma fragment DepthOnlyFragment
            #pragma multi_compile_instancing

            #include "Assets/Shaders/RegionGroundInput.hlsl"
            #include "Packages/com.unity.render-pipelines.universal/Shaders/DepthOnlyPass.hlsl"
            ENDHLSL
        }
    }

    FallBack "Hidden/Universal Render Pipeline/FallbackError"
}
