shader_type spatial;
render_mode blend_mix, cull_back, diffuse_burley, specular_schlick_ggx;

// curved_vertex_color.gdshader와 짝을 이루는 다른 하나 — 텍스처 하나로
// 칠하는 메시용(CC0 Kenney 건물·캐릭터 킷처럼 colormap/texture-* 한 장을
// 쓰는 GLB). world_curve_material.gd가 두 셰이더를 감싼다.

#include "res://saga_core/shaders/world_curve.gdshaderinc"

uniform sampler2D albedo_texture : source_color;
uniform float curve_amount : hint_range(0.0, 0.02) = 0.004;
uniform float roughness_value : hint_range(0.0, 1.0) = 0.9;
// G-0019 — 곱해지는 색(바이옴 tint). 기본 흰색이라 기존 사용처는 그대로.
uniform vec4 tint_color : source_color = vec4(1.0);

void vertex() {
	VERTEX = saga_apply_world_curve(VERTEX, MODEL_MATRIX, curve_amount);
}

void fragment() {
	ALBEDO = texture(albedo_texture, UV).rgb * tint_color.rgb;
	ROUGHNESS = roughness_value;
}
