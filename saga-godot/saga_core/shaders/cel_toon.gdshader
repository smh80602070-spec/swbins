shader_type spatial;
render_mode blend_mix, cull_back, diffuse_burley, specular_disabled;

// PLAN.md 66-2 — 카툰/셀셰이딩(원신류) 프로토타입 1호.
// 밴드형(quantized) 명암 2~3단 + rim light. godotshaders.com 계열
// 공개 예제(light() 커스텀 함수로 NdotL을 계단화하는 방식)를 참고해
// 직접 짰다 — 원신 실제 셰이더 코드나 데이터마이닝 자료는 쓰지 않았다
// (루트 CLAUDE.md 원작 에셋 금지 원칙).
//
// 대상: 텍스처가 있는 캐릭터/몬스터/NPC 메시(VRoid GLB 등). 아웃라인은
// 이 셰이더에 없다 — 66-2장 "적용 순서" 3번에서 성능 검토 후 별도로 붙인다.
//
// G-0145 — 툰은 그대로, 결만 섬세하게(텍스처 파일·해상도 그대로, 용량 0):
//   이방성 필터(비스듬한 옷·얼굴이 흐려지지 않게) · 띠 경계를 화면 픽셀 폭으로 매끈하게(계단·지글거림 없이)
//   · 살갗 그늘에 붉은 온기(skin_warm) · 머리 광택 띠를 결 노이즈로 끊어 가닥처럼 · 옷에 아주 옅은 천 결(cloth_grain, 멀면 0).

uniform sampler2D albedo_texture : source_color, filter_linear_mipmap_anisotropic;
uniform vec4 albedo_tint : source_color = vec4(1.0);
uniform int band_count : hint_range(2, 4) = 3;
uniform float band_softness : hint_range(0.0, 1.0) = 0.08;
uniform vec3 rim_color : source_color = vec3(1.0, 0.95, 0.85);
uniform float rim_power : hint_range(0.5, 8.0) = 4.5;
uniform float rim_strength : hint_range(0.0, 2.0) = 0.3;
// PLAN 102-3 — combat_feel.gd ③ 피격 플래시가 이 uniform으로 흰색을 섞는다
// (0=평소, 1=완전 흰색). saga_core/combat_feel.gd::_do_flash/_tick_flash 참고.
uniform float hit_flash : hint_range(0.0, 1.0) = 0.0;
// 2026-09-30 머리카락 윤기 띠(원신의 "천사의 고리") — 머리 재질만 세기를 올린다(cel_shader_apply._tune_outline).
// 화면 기준 위쪽을 보는 면(뷰 공간 법선 y)에 좁은 밝은 띠 하나. 머리 색을 밝게 한 톤으로 얹는다.
uniform float hair_gloss : hint_range(0.0, 1.0) = 0.0;
// G-0145 — 살갗(cel_shader_apply 가 skin* 재질에 1) · 옷 결(살갗·머리·눈은 0).
uniform float skin_warm : hint_range(0.0, 1.0) = 0.0;
uniform float cloth_grain : hint_range(0.0, 1.0) = 1.0;

varying float v_strand;   // 머리 결(0~1) — fragment 에서 재고 light 에서 광택 띠를 끊는다

float hash21(vec2 p) {
	return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float vnoise(vec2 p) {
	vec2 i = floor(p);
	vec2 f = fract(p);
	vec2 u = f * f * (3.0 - 2.0 * f);
	return mix(mix(hash21(i), hash21(i + vec2(1.0, 0.0)), u.x), mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), u.x), u.y);
}

void fragment() {
	vec4 tex = texture(albedo_texture, UV);
	vec3 col = tex.rgb * albedo_tint.rgb;
	// 옷 결 — 텍스처 좌표에 아주 잔 노이즈 두 겹(씨줄·날줄 느낌). 화면에서 한 텍셀이 1픽셀보다 작아지면(멀면) 잦아든다.
	float texel = length(fwidth(UV)) * 1024.0;
	float near = 1.0 - smoothstep(0.6, 1.6, texel);
	float grain = vnoise(UV * vec2(900.0, 260.0)) * 0.5 + vnoise(UV * vec2(260.0, 900.0)) * 0.5;
	col *= 1.0 + (grain - 0.5) * 0.09 * cloth_grain * near;
	ALBEDO = mix(col, vec3(1.0), hit_flash);
	ALPHA = tex.a * albedo_tint.a;
	// VRoid 얼굴처럼 겹친 알파컷아웃 레이어(눈썹·눈꺼풀선·홍채 등, 원래
	// BaseMaterial3D transparency ALPHA_SCISSOR/ALPHA_DEPTH_PRE_PASS)를
	// blend_mix 그대로 두면 반투명 정렬이 깨져 하얗게 날아가 보인다
	// (2026-09-19 VRoid 교체 중 실기로 발견). 컷아웃으로 강제해 깊이
	// 버퍼 기준으로 또렷하게 겹치게 한다.
	ALPHA_SCISSOR_THRESHOLD = 0.5;
	ROUGHNESS = 1.0;
	v_strand = vnoise(UV * vec2(180.0, 6.0)) * 0.6 + vnoise(UV * vec2(420.0, 9.0)) * 0.4;
}

void light() {
	float ndotl = clamp(dot(NORMAL, LIGHT), 0.0, 1.0);
	float band_step = 1.0 / float(band_count);
	float banded = floor(ndotl / band_step) * band_step;
	// G-0145 — 경계 폭을 화면 픽셀 기준 최소 1.5픽셀로(가까이선 또렷, 멀어도 계단·지글거림 없이).
	float soft = max(band_softness * band_step, fwidth(ndotl) * 1.5);
	float t = smoothstep(banded, banded + soft, ndotl);
	float lit = clamp(mix(banded, banded + band_step, t), 0.0, 1.0);

	float rim = pow(1.0 - clamp(dot(NORMAL, VIEW), 0.0, 1.0), rim_power) * rim_strength;
	rim *= smoothstep(0.0, 0.3, ndotl);

	vec3 direct = ALBEDO * LIGHT_COLOR * ATTENUATION * lit;
	// G-0145 — 살갗 그늘의 붉은 온기(살 속에 번진 빛 흉내). 밝은 쪽은 그대로, 그늘일수록.
	direct += ALBEDO * vec3(0.16, 0.05, 0.03) * skin_warm * (1.0 - lit) * LIGHT_COLOR * ATTENUATION;
	vec3 rim_light = rim_color * rim * LIGHT_COLOR * ATTENUATION;
	float ring = smoothstep(0.18, 0.23, NORMAL.y) * (1.0 - smoothstep(0.42, 0.47, NORMAL.y)) * hair_gloss;
	ring *= mix(1.0, smoothstep(0.3, 0.75, v_strand), hair_gloss * 0.7);   // G-0145 — 띠를 머리 결로 끊어 가닥처럼
	vec3 gloss = mix(ALBEDO, vec3(1.0), 0.55) * ring * 1.2 * LIGHT_COLOR * ATTENUATION * smoothstep(-0.2, 0.15, ndotl);
	DIFFUSE_LIGHT += clamp(direct + rim_light + gloss, vec3(0.0), vec3(1.0));
}
