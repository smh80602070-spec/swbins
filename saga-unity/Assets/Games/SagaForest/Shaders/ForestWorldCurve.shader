Shader "Saga/ForestWorldCurve"
{
    // VERTICAL_SLICE_FOREST.md(saga-godot) 1절 "구면 투영" 결정을 Unity
    // URP로 옮겼다 — 진짜로 휜 지오메트리가 아니라 순수 정점 셰이더 트릭,
    // 세계 좌표·걷기·판정은 C#에서 계속 평면으로 계산한다(그쪽 문서와
    // 같은 경계). SagaGo `VertexColorLit.shader`를 뼈대로 그대로 재사용
    // (이미 이 프로젝트에서 검증된 URP 최소 라이트 셰이더 구조) — 정점
    // 색 대신 단색 `_BaseColor`, 그리고 곡률 오프셋만 추가했다.
    //
    // 곡률 공식(godot의 world_curve.gdshaderinc와 동일):
    //   offset = dot(worldXZ - center.xz, worldXZ - center.xz) * _CurveAmount
    //   position.y -= offset   ("파낸다=낮아진다", 그릇 모양)
    // **전제 — Y축 회전만 쓰는 오브젝트에만 유효하다**(이 프로젝트의 월드
    // 오브젝트는 전부 그렇다, godot 문서의 같은 전제 그대로) — 그래서
    // 오브젝트 로컬 Y에서 바로 빼도 최종 월드 결과가 어긋나지 않는다.
    // `_SagaWorldCurveCenter`는 전역(글로벌) 파라미터 —
    // `World/ForestWorldCurveDriver.cs`가 매 프레임 플레이어 위치로 갱신한다.
    // 이 값을 보는 모든 머티리얼(땅·나무·NPC 등)이 같은 값을 봐야 한다 —
    // 땅만 휘고 나무는 안 휘면 나무가 공중에 뜬 것처럼 보인다. 실내
    // 머티리얼은 이 셰이더를 아예 안 물리는 것으로 "안 휨"을 표현한다.
    //
    // 정점색(COLOR) — `_BaseColor`에 곱해지는 배율(2026-09-12, 바이옴
    // 지형 다양성 슬라이스). `ForestGroundBuilder`만 실제로 흰색이 아닌
    // 값을 채운다(`Data/ForestBiomeData.cs`의 바이옴 틴트) — 정점색이 없는
    // 메시(창조물 primitive 등)는 Unity가 기본값 (1,1,1,1)을 채워 기존
    // 결과와 동일하다.
    //
    // 디테일 오버레이(2026-09-22, PLAN 102-5 "바닥 한 색") — GO
    // `VertexColorLit.shader`와 같은 결의 그레이스케일 곱 텍스처를
    // 월드 XZ로 직접 샘플한다(별도 UV 채널 없이 — 땅은 곡률만 Y에서
    // 빼므로 XZ는 그대로 세계 좌표). 기본값 흰 텍스처·Strength 0이라
    // `ForestGroundBuilder`가 명시로 채우지 않는 한(나무·NPC 등 이
    // 셰이더의 다른 쓰임) 기존 결과와 동일하다.
    Properties
    {
        _BaseColor("Base Color", Color) = (0.35, 0.55, 0.25, 1)
        _CurveAmount("Curve Amount", Float) = 0.004
        _DetailTex ("Detail (grayscale multiply)", 2D) = "white" {}
        _DetailTiling ("Detail Tiling (world units per repeat)", Float) = 4
        _DetailStrength ("Detail Strength", Range(0,1)) = 0
        _Roughness ("Roughness (U-0084 PBR)", Range(0,1)) = 0.85
        // U-0084 2단계 사진 땅 — RegionMaterials.ApplyGroundPhoto 가 채우고 키워드를 켠다(0 풀·1 흙·2 바위·3 자갈).
        [Toggle(_SAGA_GROUND_PHOTO)] _GroundPhoto ("Ground Photo (U-0084)", Float) = 0
        _PhotoStrength ("Photo Strength", Range(0,1)) = 1
        _GTiling ("Photo Tiling m (grass, dirt, rock, gravel)", Vector) = (3, 3, 4, 2.5)
        [NoScaleOffset] _GBase0 ("Grass", 2D) = "white" {}
        [NoScaleOffset] _GBase1 ("Dirt", 2D) = "white" {}
        [NoScaleOffset] _GBase2 ("Rock", 2D) = "white" {}
        [NoScaleOffset] _GBase3 ("Gravel", 2D) = "white" {}
        [NoScaleOffset][Normal] _GNorm0 ("Grass N", 2D) = "bump" {}
        [NoScaleOffset][Normal] _GNorm1 ("Dirt N", 2D) = "bump" {}
        [NoScaleOffset][Normal] _GNorm2 ("Rock N", 2D) = "bump" {}
        [NoScaleOffset][Normal] _GNorm3 ("Gravel N", 2D) = "bump" {}
        [NoScaleOffset] _GRough0 ("Grass R", 2D) = "white" {}
        [NoScaleOffset] _GRough1 ("Dirt R", 2D) = "white" {}
        [NoScaleOffset] _GRough2 ("Rock R", 2D) = "white" {}
        [NoScaleOffset] _GRough3 ("Gravel R", 2D) = "white" {}
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
            #pragma multi_compile_local_fragment _ _SAGA_GROUND_PHOTO
            #pragma multi_compile_fog

            #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Core.hlsl"
            #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Lighting.hlsl"
            #include "Assets/Shaders/SagaGroundPBR.hlsl"
            #if defined(_SAGA_GROUND_PHOTO)
            #include "Assets/Shaders/SagaGroundPhoto.hlsl"
            #endif

            half4 _BaseColor;
            float _CurveAmount;
            float3 _SagaWorldCurveCenter;
            TEXTURE2D(_DetailTex); SAMPLER(sampler_DetailTex);
            float _DetailTiling;
            float _DetailStrength;
            float _Roughness;

            struct Attributes
            {
                float4 positionOS : POSITION;
                float3 normalOS   : NORMAL;
                float4 color      : COLOR;
                float4 kinds      : TEXCOORD1; // U-0084 사진 세트 가중치(ForestGroundBuilder)
            };

            struct Varyings
            {
                float4 positionHCS : SV_POSITION;
                float3 normalWS    : TEXCOORD0;
                float3 positionWS  : TEXCOORD1;
                float fogCoord     : TEXCOORD2;
                float4 color       : TEXCOORD3;
                float4 kinds       : TEXCOORD4;
            };

            Varyings Vert(Attributes IN)
            {
                Varyings OUT;

                float3 positionOS = IN.positionOS.xyz;
                float3 rawWorldPos = TransformObjectToWorld(positionOS);
                float2 diff = rawWorldPos.xz - _SagaWorldCurveCenter.xz;
                float offset = dot(diff, diff) * _CurveAmount;
                positionOS.y -= offset;

                VertexPositionInputs posInputs = GetVertexPositionInputs(positionOS);
                OUT.positionHCS = posInputs.positionCS;
                OUT.positionWS = posInputs.positionWS;
                OUT.normalWS = TransformObjectToWorldNormal(IN.normalOS);
                OUT.fogCoord = ComputeFogFactor(OUT.positionHCS.z);
                // 정점색이 없는 메시(primitive 몸통 등)는 Unity가 기본값
                // (1,1,1,1)을 채워 준다 — _BaseColor만 쓰던 기존 결과와 같다.
                // 정점색이 있는 메시(ForestGroundBuilder의 바이옴 틴트)만
                // 실제로 곱이 달라진다.
                OUT.color = IN.color;
                OUT.kinds = IN.kinds;
                return OUT;
            }

            half4 Frag(Varyings IN) : SV_Target
            {
                float3 normalWS = normalize(IN.normalWS);
                Light mainLight = GetMainLight(TransformWorldToShadowCoord(IN.positionWS));
                half ndotl = saturate(dot(normalWS, mainLight.direction));
                half3 shadowed = mainLight.color * (ndotl * mainLight.shadowAttenuation);
                half3 ambient = SampleSH(normalWS);
                half detail = SAMPLE_TEXTURE2D(_DetailTex, sampler_DetailTex, IN.positionWS.xz / _DetailTiling).r;
                half3 albedo = _BaseColor.rgb * IN.color.rgb * lerp(1.0h, detail, _DetailStrength);
                half rough = (half)_Roughness;
                #if defined(_SAGA_GROUND_PHOTO)
                // 사진 땅(땅 재질 사본만 키워드) — 평면 좌표 = 월드 XZ(휨은 Y 만 빼서 XZ 는 그대로)
                {
                    half3 pa, pn; half pr;
                    SagaGroundPhoto(IN.positionWS.xz, IN.kinds, _BaseColor.rgb * IN.color.rgb, IN.positionWS, normalWS, pa, pn, pr);
                    albedo = pa; normalWS = pn; rough = lerp(rough, pr, (half)_PhotoStrength);
                }
                #endif
                #if defined(_SAGA_GROUND_TOON)
                half3 lit = albedo * (shadowed + ambient);
                #else
                half3 lit = SagaGroundPBR(albedo, IN.positionWS, (half3)normalWS, IN.positionHCS, rough);
                #endif
                lit = MixFog(lit, IN.fogCoord);
                return half4(lit, _BaseColor.a);
            }
            ENDHLSL
        }
    }
}
