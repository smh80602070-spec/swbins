shader_type spatial;
render_mode blend_mix, cull_disabled, diffuse_burley, specular_schlick_ggx;

// curved_textured.gdshader의 알파 컷아웃판 — 잎·꽃 카드처럼 텍스처 알파로
// 모양을 오려내는 양면 메시용(Quaternius Fern·Flower, gltf alphaMode MASK).
// 기존 curved_textured를 고치지 않고 따로 둔 건 그걸 쓰는 불투명 메시들의
// 파이프라인(cull_back·ALPHA 미기록)을 그대로 지키려는 것이다.

#include "res://saga_core/shaders/world_curve.gdshaderinc"

uniform sampler2D albedo_texture : source_color;
uniform float curve_amount : hint_range(0.0, 0.02) = 0.004;
uniform float roughness_value : hint_range(0.0, 1.0) = 0.9;
uniform float alpha_cutoff : hint_range(0.0, 1.0) = 0.2;
uniform float sway = 0.0;   // G-0365 풀 포기 흔들림(메시 높이에 비례 — 0 = 안 흔들림, 3마을 풀만 켬·날씨가 배율)
// G-0272 — textured_surfaces 가 잎 카드(사실판 자연물)를 이 셰이더로 돌릴 때 바이옴 색 곱(기본 흰색 = 옛 그대로).
uniform vec4 tint_color : source_color = vec4(1.0);
// G-0285 — 원본 재질의 법선·거칠기 맵(K-0152·K-0154 toon 359 몸, 웹 W-0358 짝). normal_scale 0·use_rough_tex 0 이 기본이라 맵 없는 사용처는 그대로.
uniform sampler2D normal_texture : hint_normal;
uniform float normal_scale = 0.0;
uniform sampler2D roughness_texture : hint_roughness_g;
uniform float use_rough_tex = 0.0;

void vertex() {
	if (sway > 0.0) {
		vec3 wp = (MODEL_MATRIX * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
		float h = max(VERTEX.y, 0.0);
		VERTEX.x += sin(TIME * 1.7 + wp.x * 0.6 + wp.z * 0.4) * sway * h;
		VERTEX.z += cos(TIME * 1.3 + wp.z * 0.5 + wp.x * 0.3) * sway * 0.6 * h;
	}
	VERTEX = saga_apply_world_curve(VERTEX, MODEL_MATRIX, curve_amount);
}

void fragment() {
	vec4 tex = texture(albedo_texture, UV);
	ALBEDO = tex.rgb * tint_color.rgb;
	ALPHA = tex.a;
	ALPHA_SCISSOR_THRESHOLD = alpha_cutoff;
	ROUGHNESS = roughness_value * mix(1.0, texture(roughness_texture, UV).g, use_rough_tex);   // StandardMaterial 처럼 값 × 맵(G-0285 R-5)
	NORMAL_MAP = texture(normal_texture, UV).rgb;
	NORMAL_MAP_DEPTH = normal_scale;
}
