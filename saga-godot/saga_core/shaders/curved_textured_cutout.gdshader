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
// G-0272 — textured_surfaces 가 잎 카드(사실판 자연물)를 이 셰이더로 돌릴 때 바이옴 색 곱(기본 흰색 = 옛 그대로).
uniform vec4 tint_color : source_color = vec4(1.0);

void vertex() {
	VERTEX = saga_apply_world_curve(VERTEX, MODEL_MATRIX, curve_amount);
}

void fragment() {
	vec4 tex = texture(albedo_texture, UV);
	ALBEDO = tex.rgb * tint_color.rgb;
	ALPHA = tex.a;
	ALPHA_SCISSOR_THRESHOLD = alpha_cutoff;
	ROUGHNESS = roughness_value;
}
