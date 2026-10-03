shader_type spatial;
render_mode blend_mix, cull_back, diffuse_burley, specular_disabled;

// G-0015 — 지역 배치표(layout.json)의 terrain.materials 를 그대로 읽는 땅 셰이더.
// 낮은·평평한 곳 = low 그림, 높거나 가파른 곳 = high 그림. 섞음비 = max(높이 램프, 경사 램프)
// (tools/world-forge/region_hero.py pbr_blend 와 같은 식). tile = 그림 한 장이 덮는 미터(월드 x·-z 평면 투영).

uniform sampler2D low_tex : source_color, repeat_enable, filter_linear_mipmap_anisotropic;
uniform sampler2D high_tex : source_color, repeat_enable, filter_linear_mipmap_anisotropic;
uniform vec3 tint_low : source_color = vec3(1.0);
uniform vec3 tint_high : source_color = vec3(1.0);
uniform float tile_low = 5.0;
uniform float tile_high = 8.0;
uniform float z0 = 3.0;
uniform float z1 = 9.0;
uniform float slope0 = 0.35;
uniform float slope1 = 0.6;
// 0 이면 high 를 아예 안 쓴다(마을처럼 풀 한 장).
uniform float use_high = 1.0;

varying vec3 world_pos;
varying vec3 world_nrm;

void vertex() {
	world_pos = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
	world_nrm = normalize((MODEL_MATRIX * vec4(NORMAL, 0.0)).xyz);
}

void fragment() {
	vec2 p = vec2(world_pos.x, -world_pos.z);
	// 가파른 면은 위에서 내리 투영하면 줄무늬로 늘어진다 — 옆면은 (수평 이동, 높이) 평면으로 한 번 더 읽어 섞는다.
	float steep = smoothstep(0.25, 0.6, 1.0 - world_nrm.y);
	vec2 side = vec2(world_pos.x + world_pos.z, world_pos.y);
	vec3 lo = mix(texture(low_tex, p / tile_low).rgb, texture(low_tex, side / tile_low).rgb, steep) * tint_low;
	vec3 hi = mix(texture(high_tex, p / tile_high).rgb, texture(high_tex, side / tile_high).rgb, steep) * tint_high;
	float h_t = clamp((world_pos.y - z0) / max(z1 - z0, 0.001), 0.0, 1.0);
	float s_t = clamp(((1.0 - world_nrm.y) - slope0) / max(slope1 - slope0, 0.001), 0.0, 1.0);
	float t = max(h_t, s_t) * use_high;
	ALBEDO = mix(lo, hi, t);
	ROUGHNESS = 1.0;
}
