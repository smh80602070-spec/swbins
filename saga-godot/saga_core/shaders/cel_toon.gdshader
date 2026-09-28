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

uniform sampler2D albedo_texture : source_color;
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

void fragment() {
	vec4 tex = texture(albedo_texture, UV);
	ALBEDO = mix(tex.rgb * albedo_tint.rgb, vec3(1.0), hit_flash);
	ALPHA = tex.a * albedo_tint.a;
	// VRoid 얼굴처럼 겹친 알파컷아웃 레이어(눈썹·눈꺼풀선·홍채 등, 원래
	// BaseMaterial3D transparency ALPHA_SCISSOR/ALPHA_DEPTH_PRE_PASS)를
	// blend_mix 그대로 두면 반투명 정렬이 깨져 하얗게 날아가 보인다
	// (2026-09-19 VRoid 교체 중 실기로 발견). 컷아웃으로 강제해 깊이
	// 버퍼 기준으로 또렷하게 겹치게 한다.
	ALPHA_SCISSOR_THRESHOLD = 0.5;
	ROUGHNESS = 1.0;
}

void light() {
	float ndotl = clamp(dot(NORMAL, LIGHT), 0.0, 1.0);
	float band_step = 1.0 / float(band_count);
	float banded = floor(ndotl / band_step) * band_step;
	float t = smoothstep(banded, banded + band_softness * band_step, ndotl);
	float lit = clamp(mix(banded, banded + band_step, t), 0.0, 1.0);

	float rim = pow(1.0 - clamp(dot(NORMAL, VIEW), 0.0, 1.0), rim_power) * rim_strength;
	rim *= smoothstep(0.0, 0.3, ndotl);

	vec3 direct = ALBEDO * LIGHT_COLOR * ATTENUATION * lit;
	vec3 rim_light = rim_color * rim * LIGHT_COLOR * ATTENUATION;
	float ring = smoothstep(0.18, 0.23, NORMAL.y) * (1.0 - smoothstep(0.42, 0.47, NORMAL.y)) * hair_gloss;
	vec3 gloss = mix(ALBEDO, vec3(1.0), 0.55) * ring * 1.2 * LIGHT_COLOR * ATTENUATION * smoothstep(-0.2, 0.15, ndotl);
	DIFFUSE_LIGHT += clamp(direct + rim_light + gloss, vec3(0.0), vec3(1.0));
}
