Shader "Saga/VertexColorLit"
{
    // TerrainBuilder.cs가 굽는 정점 색(Color32, RGB만 씀)을 그대로 알베도로
    // 쓰는 최소 URP 라이트 셰이더. 텍스처 없이 칸 색 + 메인 라이트만으로
    // 칠한다 — Vertical Slice 단계의 primitive 표현(PLAN.md 8장)이다.
    // Cull Off — 정점 감김 방향 계산이 어긋나도 안 뚫리게 방어(saga-godot의
    // terrain_builder.gd가 cull_mode=CULL_DISABLED로 같은 걸 했던 것과 동일).
    //
    // 44장 "Environment" 디테일 오버레이(2026-09-14) — 지형 9종을 정점색
    // 하나로 다 칠하던 것에, PBR 재질 하나(_DetailTex, 기본은 Poly Haven
    // cobblestone_floor_01의 AO 맵)를 곱해 미세한 질감을 더한다. 타일
    // 종류별로 다른 텍스처를 매핑하는 전면 스플랫팅은 범위 밖(사용자가
    // "간단한 디테일 오버레이만" 선택) — 정점색 블렌딩(TileVertexColor)은
    // 그대로 유지, 그 위에 이 곱색 한 겹만 얹는다. UV는 TerrainBuilder.cs가
    // 월드 XZ 그대로 담아 두고 여기서 _DetailTiling으로 배율만 곱한다.
    Properties
    {
        _DetailTex ("Detail (grayscale multiply)", 2D) = "white" {}
        _DetailTiling ("Detail Tiling (world units per repeat)", Float) = 2
        _DetailStrength ("Detail Strength", Range(0,1)) = 0.6
        _Roughness ("Roughness (U-0084 PBR)", Range(0,1)) = 0.85
    }
    SubShader
    {
        Tags { "RenderType" = "Opaque" "RenderPipeline" = "UniversalPipeline" "Queue" = "Geometry" }
        Cull Off

        Pass
        {
            Name "ForwardLit"
            Tags { "LightMode" = "UniversalForward" }

            HLSLPROGRAM
            #pragma vertex Vert
            #pragma fragment Frag
            #pragma multi_compile _ _MAIN_LIGHT_SHADOWS _MAIN_LIGHT_SHADOWS_CASCADE _MAIN_LIGHT_SHADOWS_SCREEN
            #pragma multi_compile _ _ADDITIONAL_LIGHTS_VERTEX _ADDITIONAL_LIGHTS
            #pragma multi_compile _ _CLUSTER_LIGHT_LOOP
            #pragma multi_compile_fragment _ _ADDITIONAL_LIGHT_SHADOWS
            #pragma multi_compile_fragment _ _SHADOWS_SOFT
            #pragma multi_compile_fragment _ _SAGA_GROUND_TOON
            #pragma multi_compile_fog

            #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Core.hlsl"
            #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Lighting.hlsl"
            #include "Assets/Shaders/SagaGroundPBR.hlsl"

            TEXTURE2D(_DetailTex); SAMPLER(sampler_DetailTex);
            float _DetailTiling;
            float _DetailStrength;
            float _Roughness;

            struct Attributes
            {
                float4 positionOS : POSITION;
                float3 normalOS   : NORMAL;
                float4 color      : COLOR;
                float2 uv         : TEXCOORD0;
            };

            struct Varyings
            {
                float4 positionHCS : SV_POSITION;
                float3 normalWS    : TEXCOORD0;
                float3 positionWS  : TEXCOORD1;
                float4 color       : COLOR;
                float2 uv          : TEXCOORD2;
                float fogCoord     : TEXCOORD3;
            };

            Varyings Vert(Attributes IN)
            {
                Varyings OUT;
                VertexPositionInputs posInputs = GetVertexPositionInputs(IN.positionOS.xyz);
                OUT.positionHCS = posInputs.positionCS;
                OUT.positionWS = posInputs.positionWS;
                OUT.normalWS = TransformObjectToWorldNormal(IN.normalOS);
                OUT.color = IN.color;
                OUT.uv = IN.uv;
                OUT.fogCoord = ComputeFogFactor(OUT.positionHCS.z);
                return OUT;
            }

            half4 Frag(Varyings IN) : SV_Target
            {
                float3 normalWS = normalize(IN.normalWS);
                Light mainLight = GetMainLight(TransformWorldToShadowCoord(IN.positionWS));
                half ndotl = saturate(dot(normalWS, mainLight.direction));
                half3 shadowed = mainLight.color * (ndotl * mainLight.shadowAttenuation);
                half3 ambient = SampleSH(normalWS);

                // 디테일 오버레이 — AO류 텍스처는 대체로 밝은(백색에 가까운)
                // 값이라 곱해도 전체가 확 어두워지지 않는다. _DetailStrength로
                // 0(안 씀)~1(그대로 곱함) 사이를 보간해 과해지지 않게 한다.
                half detail = SAMPLE_TEXTURE2D(_DetailTex, sampler_DetailTex, IN.uv / _DetailTiling).r;
                half3 albedo = IN.color.rgb * lerp(1.0h, detail, _DetailStrength);

                #if defined(_SAGA_GROUND_TOON)
                half3 lit = albedo * (shadowed + ambient);
                #else
                half3 lit = SagaGroundPBR(albedo, IN.positionWS, (half3)normalWS, IN.positionHCS, (half)_Roughness);
                #endif
                lit = MixFog(lit, IN.fogCoord);
                return half4(lit, 1);
            }
            ENDHLSL
        }
    }
}
