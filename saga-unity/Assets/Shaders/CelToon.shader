// Saga/CelToon — Godot 과 같은 툰 노선(tasks U-0022). 본보기: saga-godot/saga_core/shaders/cel_toon.gdshader · cel_vertex_color.gdshader · cel_outline.gdshader.
// 빛마다 NdotL 을 band_count 단으로 계단화(+부드러움)하고 림 빛을 더한다. 바탕은 텍스처×색이거나(_VERTEX_COLOR 끔) 정점색(켬 — 정점 알파 < 1 이면 그만큼 스스로 빛난다).
// 외곽선은 뒤집힌 헐 패스(_OutlineWidth > 0 일 때만 그려진다). Shader Graph 가 아니라 HLSL 직접(Shader Graph 리플렉션은 막혔다 — PLAN 110).
Shader "Saga/CelToon"
{
    Properties
    {
        [MainTexture] _BaseMap("바탕 그림", 2D) = "white" {}
        [MainColor] _BaseColor("바탕 색(곱)", Color) = (1, 1, 1, 1)
        [Toggle(_VERTEX_COLOR)] _UseVertexColor("정점색을 바탕으로(건물·코드 짐승)", Float) = 0
        [Toggle(_ALPHATEST_ON)] _AlphaClip("알파 컷아웃", Float) = 0
        _Cutoff("컷아웃 기준", Range(0, 1)) = 0.5

        _BandCount("명암 단 수", Range(2, 4)) = 3
        _BandSoftness("단 경계 부드러움", Range(0, 1)) = 0.08
        _RimColor("림 색", Color) = (1, 0.95, 0.85, 1)
        _RimPower("림 폭(클수록 좁다)", Range(0.5, 8)) = 4.5
        _RimStrength("림 세기", Range(0, 2)) = 0.3
        _HitFlash("피격 번쩍임", Range(0, 1)) = 0
        _GlowStrength("스스로 빛남(정점 알파)", Range(0, 8)) = 1.4

        _OutlineColor("외곽선 색", Color) = (0.08, 0.06, 0.10, 1)
        _OutlineWidth("외곽선 두께(0=끔)", Range(0, 0.05)) = 0

        [HideInInspector] _Surface("_Surface", Float) = 0
        [HideInInspector] _Cull("_Cull", Float) = 2
    }

    SubShader
    {
        Tags { "RenderType" = "Opaque" "RenderPipeline" = "UniversalPipeline" "UniversalMaterialType" = "SimpleLit" "Queue" = "Geometry" "IgnoreProjector" = "True" }
        LOD 200

        Pass
        {
            Name "ForwardLit"
            Tags { "LightMode" = "UniversalForward" }
            Cull [_Cull]

            HLSLPROGRAM
            #pragma target 3.5
            #pragma exclude_renderers gles
            #pragma vertex CelVertex
            #pragma fragment CelFragment

            #pragma shader_feature_local_fragment _VERTEX_COLOR
            #pragma shader_feature_local_fragment _ALPHATEST_ON
            #pragma multi_compile _ _MAIN_LIGHT_SHADOWS _MAIN_LIGHT_SHADOWS_CASCADE _MAIN_LIGHT_SHADOWS_SCREEN
            #pragma multi_compile _ _ADDITIONAL_LIGHTS_VERTEX _ADDITIONAL_LIGHTS
            #pragma multi_compile _ _CLUSTER_LIGHT_LOOP
            #pragma multi_compile_fragment _ _ADDITIONAL_LIGHT_SHADOWS
            #pragma multi_compile_fragment _ _SHADOWS_SOFT
            #pragma multi_compile_instancing
            #include_with_pragmas "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Fog.hlsl"

            #include "Assets/Shaders/CelToonInput.hlsl"
            #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Core.hlsl"
            #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Lighting.hlsl"

            struct Attributes
            {
                float4 positionOS : POSITION;
                float3 normalOS : NORMAL;
                float2 uv : TEXCOORD0;
                half4 color : COLOR;
                UNITY_VERTEX_INPUT_INSTANCE_ID
            };

            struct Varyings
            {
                float4 positionCS : SV_POSITION;
                float2 uv : TEXCOORD0;
                float3 positionWS : TEXCOORD1;
                half3 normalWS : TEXCOORD2;
                half4 color : TEXCOORD3;
                half fogFactor : TEXCOORD4;
                UNITY_VERTEX_INPUT_INSTANCE_ID
                UNITY_VERTEX_OUTPUT_STEREO
            };

            Varyings CelVertex(Attributes input)
            {
                Varyings output = (Varyings)0;
                UNITY_SETUP_INSTANCE_ID(input);
                UNITY_TRANSFER_INSTANCE_ID(input, output);
                UNITY_INITIALIZE_VERTEX_OUTPUT_STEREO(output);
                VertexPositionInputs vp = GetVertexPositionInputs(input.positionOS.xyz);
                output.positionCS = vp.positionCS;
                output.positionWS = vp.positionWS;
                output.normalWS = (half3)TransformObjectToWorldNormal(input.normalOS);
                output.uv = TRANSFORM_TEX(input.uv, _BaseMap);
                output.color = input.color;
                output.fogFactor = ComputeFogFactor(vp.positionCS.z);
                return output;
            }

            // 명암을 band 단으로 — cel_toon.gdshader 의 light() 와 같은 식.
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

            half4 CelFragment(Varyings input) : SV_Target
            {
                UNITY_SETUP_INSTANCE_ID(input);
                UNITY_SETUP_STEREO_EYE_INDEX_POST_VERTEX(input);

                half3 albedo;
                half alpha = 1.0h;
                half3 glow = 0.0h;
                #if defined(_VERTEX_COLOR)
                    albedo = input.color.rgb;
                    glow = input.color.rgb * (1.0h - input.color.a) * _GlowStrength;
                #else
                    half4 tex = SAMPLE_TEXTURE2D(_BaseMap, sampler_BaseMap, input.uv);
                    albedo = tex.rgb * _BaseColor.rgb;
                    alpha = tex.a * _BaseColor.a;
                #endif
                #if defined(_ALPHATEST_ON)
                    clip(alpha - _Cutoff);
                #endif
                albedo = lerp(albedo, 1.0h, _HitFlash);

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

                color = saturate(color) + glow;
                color = MixFog(color, input.fogFactor);
                return half4(color, 1.0h);
            }
            ENDHLSL
        }

        // 외곽선 — 뒤집힌 헐. _OutlineWidth 가 0 이면 꼭짓점이 클립 밖으로 가서 그려지지 않는다.
        Pass
        {
            Name "Outline"
            Tags { "LightMode" = "SRPDefaultUnlit" }
            Cull Front

            HLSLPROGRAM
            #pragma target 3.5
            #pragma exclude_renderers gles
            #pragma vertex OutlineVertex
            #pragma fragment OutlineFragment
            #pragma multi_compile_instancing
            #include_with_pragmas "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Fog.hlsl"

            #include "Assets/Shaders/CelToonInput.hlsl"
            #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Core.hlsl"

            struct OutlineAttributes
            {
                float4 positionOS : POSITION;
                float3 normalOS : NORMAL;
                UNITY_VERTEX_INPUT_INSTANCE_ID
            };

            struct OutlineVaryings
            {
                float4 positionCS : SV_POSITION;
                half fogFactor : TEXCOORD0;
                UNITY_VERTEX_INPUT_INSTANCE_ID
                UNITY_VERTEX_OUTPUT_STEREO
            };

            OutlineVaryings OutlineVertex(OutlineAttributes input)
            {
                OutlineVaryings output = (OutlineVaryings)0;
                UNITY_SETUP_INSTANCE_ID(input);
                UNITY_TRANSFER_INSTANCE_ID(input, output);
                UNITY_INITIALIZE_VERTEX_OUTPUT_STEREO(output);
                float3 pos = input.positionOS.xyz + input.normalOS * _OutlineWidth;
                output.positionCS = TransformObjectToHClip(pos);
                output.fogFactor = ComputeFogFactor(output.positionCS.z);
                if (_OutlineWidth <= 0.0) output.positionCS = float4(0, 0, 2, 0);
                return output;
            }

            half4 OutlineFragment(OutlineVaryings input) : SV_Target
            {
                UNITY_SETUP_INSTANCE_ID(input);
                UNITY_SETUP_STEREO_EYE_INDEX_POST_VERTEX(input);
                return half4(MixFog(_OutlineColor.rgb, input.fogFactor), 1.0h);
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
            Cull [_Cull]

            HLSLPROGRAM
            #pragma target 3.5
            #pragma exclude_renderers gles
            #pragma vertex ShadowPassVertex
            #pragma fragment ShadowPassFragment
            #pragma shader_feature_local_fragment _ALPHATEST_ON
            #pragma multi_compile_instancing
            #pragma multi_compile_vertex _ _CASTING_PUNCTUAL_LIGHT_SHADOW

            #include "Assets/Shaders/CelToonInput.hlsl"
            #include "Packages/com.unity.render-pipelines.universal/Shaders/ShadowCasterPass.hlsl"
            ENDHLSL
        }

        Pass
        {
            Name "DepthOnly"
            Tags { "LightMode" = "DepthOnly" }
            ZWrite On
            ColorMask R
            Cull [_Cull]

            HLSLPROGRAM
            #pragma target 3.5
            #pragma exclude_renderers gles
            #pragma vertex DepthOnlyVertex
            #pragma fragment DepthOnlyFragment
            #pragma shader_feature_local_fragment _ALPHATEST_ON
            #pragma multi_compile_instancing

            #include "Assets/Shaders/CelToonInput.hlsl"
            #include "Packages/com.unity.render-pipelines.universal/Shaders/DepthOnlyPass.hlsl"
            ENDHLSL
        }
    }

    FallBack "Hidden/Universal Render Pipeline/FallbackError"
}
