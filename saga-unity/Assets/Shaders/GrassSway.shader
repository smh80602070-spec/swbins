// Saga/GrassSway — tasks U-0216 1만리 풀 포기 흔들림(고돗 G-0365 sway · G-0363 날씨 배율 짝).
// glTFast 재질(Shader Graphs/glTF-pbrMetallicRoughness)의 속성 이름을 그대로 읽는다(baseColorFactor·baseColorTexture·metallicRoughnessTexture
// G=거칠기·B=금속 · normalTexture(+scale, x*=w 풀기 = glTFast Normal.cginc) · alphaCutoff·_Cull) — 재질 사본의 셰이더만 바꿔 끼우면 값이 그대로 넘어온다.
// 빛은 셰이더 그래프 Lit(금속 흐름)과 같은 UniversalFragmentPBR(주 조명 그림자·추가 조명·SH·반사·SSAO). 뒷면 법선은 안 뒤집는다(그래프와 같음).
// 흔들림: 정적 배칭되면 메시가 월드 좌표로 합쳐져 모델 높이를 못 읽는다 → 높이 = 서브메시별 UV.y 직선 맞춤 `_SwayFit`(x + y·uv.y, 월드 m —
// GrassWind 가 원본 메시에서 셈). 뿌리(높이 0) 고정·끝이 가장 크게. `_Sway` 0 이면 옛 화면 그대로(분기). 그림자·깊이·깊이법선 패스도 같이 흔든다.
Shader "Saga/GrassSway"
{
    Properties
    {
        baseColorFactor("Base Color", Color) = (1, 1, 1, 1)
        baseColorTexture("Base Color Tex", 2D) = "white" {}
        metallicFactor("Metallic", Range(0, 1)) = 1
        roughnessFactor("Roughness", Range(0, 1)) = 1
        metallicRoughnessTexture("Metallic Roughness Tex", 2D) = "white" {}
        [Normal] normalTexture("Normal Tex", 2D) = "bump" {}
        normalTexture_scale("Normal Scale", Float) = 1
        alphaCutoff("Alpha Cutoff", Range(0, 1)) = 0.5
        [Toggle(_ALPHATEST_ON)] _AlphaClip("Alpha Clip", Float) = 0
        [Enum(UnityEngine.Rendering.CullMode)] _Cull("Cull", Float) = 2
        _Sway("흔들림 세기", Float) = 0
        _SwaySpeed("흔들림 빠르기", Float) = 1
        _SwayFit("높이 맞춤(x + y·uv.y, m)", Vector) = (0, 1, 0, 0)
    }

    HLSLINCLUDE
    #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Core.hlsl"

    TEXTURE2D(baseColorTexture); SAMPLER(samplerbaseColorTexture);
    TEXTURE2D(metallicRoughnessTexture); SAMPLER(samplermetallicRoughnessTexture);
    TEXTURE2D(normalTexture); SAMPLER(samplernormalTexture);

    CBUFFER_START(UnityPerMaterial)
        float4 baseColorTexture_ST;
        half4 baseColorFactor;
        half metallicFactor;
        half roughnessFactor;
        half normalTexture_scale;
        half alphaCutoff;
        float _Sway;
        float _SwaySpeed;
        float4 _SwayFit;
    CBUFFER_END

    // 고돗 curved_textured_cutout.gdshader 24~30 과 같은 결 — x 는 sin(1.7t), z 는 cos(1.3t)·0.6. 위상은 그 꼭짓점 월드 자리(배칭돼도 같음).
    float3 SagaGrassSway(float3 positionWS, float2 uv)
    {
        if (_Sway > 0.0)
        {
            float h = max(_SwayFit.x + _SwayFit.y * uv.y, 0.0);
            float t = _Time.y * _SwaySpeed;
            positionWS.x += sin(t * 1.7 + positionWS.x * 0.6 + positionWS.z * 0.4) * _Sway * h;
            positionWS.z += cos(t * 1.3 + positionWS.z * 0.5 + positionWS.x * 0.3) * _Sway * 0.6 * h;
        }
        return positionWS;
    }

    half SagaGrassAlpha(float2 uv)
    {
        half a = SAMPLE_TEXTURE2D(baseColorTexture, samplerbaseColorTexture, uv).a * baseColorFactor.a;
        #if defined(_ALPHATEST_ON)
            clip(a - alphaCutoff);
        #endif
        return a;
    }
    ENDHLSL

    SubShader
    {
        Tags { "RenderType" = "Opaque" "RenderPipeline" = "UniversalPipeline" "Queue" = "Geometry" }

        Pass
        {
            Name "ForwardLit"
            Tags { "LightMode" = "UniversalForward" }
            Cull [_Cull]

            HLSLPROGRAM
            #pragma target 3.5
            #pragma vertex Vert
            #pragma fragment Frag
            #pragma shader_feature_local _ALPHATEST_ON
            #pragma multi_compile _ _MAIN_LIGHT_SHADOWS _MAIN_LIGHT_SHADOWS_CASCADE _MAIN_LIGHT_SHADOWS_SCREEN
            #pragma multi_compile _ _ADDITIONAL_LIGHTS_VERTEX _ADDITIONAL_LIGHTS
            #pragma multi_compile_fragment _ _ADDITIONAL_LIGHT_SHADOWS
            #pragma multi_compile_fragment _ _REFLECTION_PROBE_BLENDING
            #pragma multi_compile_fragment _ _REFLECTION_PROBE_BOX_PROJECTION
            #pragma multi_compile_fragment _ _SHADOWS_SOFT _SHADOWS_SOFT_LOW _SHADOWS_SOFT_MEDIUM _SHADOWS_SOFT_HIGH
            #pragma multi_compile_fragment _ _SCREEN_SPACE_OCCLUSION
            #pragma multi_compile _ _CLUSTER_LIGHT_LOOP
            #pragma multi_compile_fog
            #pragma multi_compile_instancing

            #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Lighting.hlsl"

            struct Attributes
            {
                float4 positionOS : POSITION;
                float3 normalOS : NORMAL;
                float4 tangentOS : TANGENT;
                float2 uv : TEXCOORD0;
                UNITY_VERTEX_INPUT_INSTANCE_ID
            };

            struct Varyings
            {
                float4 positionCS : SV_POSITION;
                float3 positionWS : TEXCOORD0;
                float3 normalWS : TEXCOORD1;
                float4 tangentWS : TEXCOORD2;
                float2 uv : TEXCOORD3;
                half fogFactor : TEXCOORD4;
                UNITY_VERTEX_INPUT_INSTANCE_ID
                UNITY_VERTEX_OUTPUT_STEREO
            };

            Varyings Vert(Attributes input)
            {
                Varyings o = (Varyings)0;
                UNITY_SETUP_INSTANCE_ID(input);
                UNITY_TRANSFER_INSTANCE_ID(input, o);
                UNITY_INITIALIZE_VERTEX_OUTPUT_STEREO(o);
                float3 pws = SagaGrassSway(TransformObjectToWorld(input.positionOS.xyz), input.uv);
                o.positionWS = pws;
                o.positionCS = TransformWorldToHClip(pws);
                VertexNormalInputs n = GetVertexNormalInputs(input.normalOS, input.tangentOS);
                o.normalWS = n.normalWS;
                o.tangentWS = float4(n.tangentWS, input.tangentOS.w * GetOddNegativeScale());
                o.uv = TRANSFORM_TEX(input.uv, baseColorTexture);
                o.fogFactor = ComputeFogFactor(o.positionCS.z);
                return o;
            }

            half4 Frag(Varyings input) : SV_Target
            {
                UNITY_SETUP_INSTANCE_ID(input);
                half4 tex = SAMPLE_TEXTURE2D(baseColorTexture, samplerbaseColorTexture, input.uv);
                half alpha = tex.a * baseColorFactor.a;
                #if defined(_ALPHATEST_ON)
                    clip(alpha - alphaCutoff);
                #endif
                half4 mr = SAMPLE_TEXTURE2D(metallicRoughnessTexture, samplermetallicRoughnessTexture, input.uv);
                // glTFast Normal.cginc — DXT5nm 이어도 XYZ 로(x *= w), 세기는 xy 에
                half4 pn = SAMPLE_TEXTURE2D(normalTexture, samplernormalTexture, input.uv);
                pn.x *= pn.w;
                half3 tn;
                tn.xy = (pn.xy * 2.0h - 1.0h) * normalTexture_scale;
                tn.z = sqrt(1.0h - saturate(dot(tn.xy, tn.xy)));

                float3 nWS = normalize(input.normalWS);
                float3 tWS = normalize(input.tangentWS.xyz);
                float3 bWS = cross(nWS, tWS) * input.tangentWS.w;
                half3 normalWS = NormalizeNormalPerPixel(TransformTangentToWorld(tn, half3x3(tWS, bWS, nWS)));

                InputData inputData = (InputData)0;
                inputData.positionWS = input.positionWS;
                inputData.positionCS = input.positionCS;
                inputData.normalWS = normalWS;
                inputData.viewDirectionWS = GetWorldSpaceNormalizeViewDir(input.positionWS);
                inputData.shadowCoord = TransformWorldToShadowCoord(input.positionWS);
                inputData.fogCoord = input.fogFactor;
                inputData.bakedGI = SampleSH(normalWS);
                inputData.normalizedScreenSpaceUV = GetNormalizedScreenSpaceUV(input.positionCS);
                inputData.shadowMask = half4(1, 1, 1, 1);

                SurfaceData s = (SurfaceData)0;
                s.albedo = tex.rgb * baseColorFactor.rgb;
                s.metallic = metallicFactor * mr.b;
                s.smoothness = 1.0h - roughnessFactor * mr.g;
                s.normalTS = tn;
                s.occlusion = 1.0h;
                s.alpha = 1.0h;

                half4 c = UniversalFragmentPBR(inputData, s);
                c.rgb = MixFog(c.rgb, inputData.fogCoord);
                c.a = 1.0h;
                return c;
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
            #pragma vertex ShadowVert
            #pragma fragment ShadowFrag
            #pragma shader_feature_local _ALPHATEST_ON
            #pragma multi_compile_vertex _ _CASTING_PUNCTUAL_LIGHT_SHADOW
            #pragma multi_compile_instancing
            #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Shadows.hlsl"

            float3 _LightDirection;
            float3 _LightPosition;

            struct Attributes { float4 positionOS : POSITION; float3 normalOS : NORMAL; float2 uv : TEXCOORD0; UNITY_VERTEX_INPUT_INSTANCE_ID };
            struct Varyings { float4 positionCS : SV_POSITION; float2 uv : TEXCOORD0; };

            Varyings ShadowVert(Attributes input)
            {
                Varyings o = (Varyings)0;
                UNITY_SETUP_INSTANCE_ID(input);
                float3 pws = SagaGrassSway(TransformObjectToWorld(input.positionOS.xyz), input.uv);
                float3 nws = TransformObjectToWorldNormal(input.normalOS);
                #if _CASTING_PUNCTUAL_LIGHT_SHADOW
                    float3 l = normalize(_LightPosition - pws);
                #else
                    float3 l = _LightDirection;
                #endif
                o.positionCS = ApplyShadowClamping(TransformWorldToHClip(ApplyShadowBias(pws, nws, l)));
                o.uv = TRANSFORM_TEX(input.uv, baseColorTexture);
                return o;
            }

            half4 ShadowFrag(Varyings input) : SV_Target
            {
                SagaGrassAlpha(input.uv);
                return 0;
            }
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
            #pragma vertex DepthVert
            #pragma fragment DepthFrag
            #pragma shader_feature_local _ALPHATEST_ON
            #pragma multi_compile_instancing

            struct Attributes { float4 positionOS : POSITION; float2 uv : TEXCOORD0; UNITY_VERTEX_INPUT_INSTANCE_ID };
            struct Varyings { float4 positionCS : SV_POSITION; float2 uv : TEXCOORD0; UNITY_VERTEX_OUTPUT_STEREO };

            Varyings DepthVert(Attributes input)
            {
                Varyings o = (Varyings)0;
                UNITY_SETUP_INSTANCE_ID(input);
                UNITY_INITIALIZE_VERTEX_OUTPUT_STEREO(o);
                o.positionCS = TransformWorldToHClip(SagaGrassSway(TransformObjectToWorld(input.positionOS.xyz), input.uv));
                o.uv = TRANSFORM_TEX(input.uv, baseColorTexture);
                return o;
            }

            half DepthFrag(Varyings input) : SV_Target
            {
                SagaGrassAlpha(input.uv);
                return input.positionCS.z;
            }
            ENDHLSL
        }

        Pass
        {
            Name "DepthNormals"
            Tags { "LightMode" = "DepthNormals" }
            ZWrite On
            Cull [_Cull]

            HLSLPROGRAM
            #pragma target 3.5
            #pragma vertex DNVert
            #pragma fragment DNFrag
            #pragma shader_feature_local _ALPHATEST_ON
            #pragma multi_compile_fragment _ _GBUFFER_NORMALS_OCT
            #pragma multi_compile_instancing

            struct Attributes { float4 positionOS : POSITION; float3 normalOS : NORMAL; float2 uv : TEXCOORD0; UNITY_VERTEX_INPUT_INSTANCE_ID };
            struct Varyings { float4 positionCS : SV_POSITION; float2 uv : TEXCOORD0; float3 normalWS : TEXCOORD1; UNITY_VERTEX_OUTPUT_STEREO };

            Varyings DNVert(Attributes input)
            {
                Varyings o = (Varyings)0;
                UNITY_SETUP_INSTANCE_ID(input);
                UNITY_INITIALIZE_VERTEX_OUTPUT_STEREO(o);
                o.positionCS = TransformWorldToHClip(SagaGrassSway(TransformObjectToWorld(input.positionOS.xyz), input.uv));
                o.normalWS = TransformObjectToWorldNormal(input.normalOS);
                o.uv = TRANSFORM_TEX(input.uv, baseColorTexture);
                return o;
            }

            half4 DNFrag(Varyings input) : SV_Target
            {
                SagaGrassAlpha(input.uv);
                float3 n = normalize(input.normalWS);
                #if defined(_GBUFFER_NORMALS_OCT)
                    float2 oct = PackNormalOctQuadEncode(n);
                    return half4(PackFloat2To888(saturate(oct * 0.5 + 0.5)), 0.0);
                #else
                    return half4(n, 0.0);
                #endif
            }
            ENDHLSL
        }
    }
    FallBack Off
}
