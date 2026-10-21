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
// G-0277 — 밤 불빛(night_glow.gd register_shader 가 불 면·창 표면에만 켬). 기본 0 이라 기존 사용처는 그대로.
uniform vec3 emission_color : source_color = vec3(0.0);
uniform float emission_energy = 0.0;
// G-0285 — 원본 재질의 법선·거칠기 맵(K-0152·K-0154 toon 359 몸, 웹 W-0358 짝). normal_scale 0·use_rough_tex 0 이 기본이라 맵 없는 사용처는 그대로.
uniform sampler2D normal_texture : hint_normal;
uniform float normal_scale = 0.0;
uniform sampler2D roughness_texture : hint_roughness_g;
uniform float use_rough_tex = 0.0;

void vertex() {
	VERTEX = saga_apply_world_curve(VERTEX, MODEL_MATRIX, curve_amount);
}

void fragment() {
	ALBEDO = texture(albedo_texture, UV).rgb * tint_color.rgb;
	ROUGHNESS = mix(roughness_value, texture(roughness_texture, UV).g, use_rough_tex);
	NORMAL_MAP = texture(normal_texture, UV).rgb;
	NORMAL_MAP_DEPTH = normal_scale;
	EMISSION = emission_color * emission_energy;
}
