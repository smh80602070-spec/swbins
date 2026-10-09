shader_type spatial;
render_mode blend_mix, cull_back, diffuse_burley, specular_schlick_ggx;

// G-0148 — 사가마을 연못(games/saga_forest/world/fishing_spot.gd)의 사실적 물. 사가만리 water_real 과 같은 문법
// (잔물결 법선·하늘 반사·깊이에 따른 물빛·물가 가는 선)이되, 연못은 바닥 없는 평평한 원판이라 깊이는 정점색으로 대신한다
// (fishing_spot.pond_mesh: 가운데 POND_DEEP → POND_MID → 가장자리 POND_EDGE — 초록 성분이 깊이 표지).
// 구면 투영(world_curve.gdshaderinc)은 그대로 — 사가마을 정체성, 되돌리지 않는다.

#include "res://saga_core/shaders/world_curve.gdshaderinc"

uniform float curve_amount : hint_range(0.0, 0.02) = 0.004;
uniform vec3 shallow_color : source_color = vec3(0.16, 0.42, 0.40);
uniform vec3 deep_color : source_color = vec3(0.02, 0.10, 0.18);
uniform vec3 foam_color : source_color = vec3(0.86, 0.92, 0.9);
uniform float ripple_strength = 0.14;

varying vec3 wpos;

float hash21(vec2 p) {
	return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float vnoise(vec2 p) {
	vec2 i = floor(p);
	vec2 f = fract(p);
	vec2 u = f * f * (3.0 - 2.0 * f);
	return mix(mix(hash21(i), hash21(i + vec2(1.0, 0.0)), u.x), mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), u.x), u.y);
}

float ripple_h(vec2 p, float t) {
	return vnoise(p * 1.1 + vec2(0.3, 0.1) * t) * 0.6 + vnoise(p * 2.6 - vec2(0.1, 0.35) * t + 7.0) * 0.4
		+ sin(length(p) * 3.0 - t * 1.6) * 0.15;
}

void vertex() {
	wpos = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
	VERTEX = saga_apply_world_curve(VERTEX, MODEL_MATRIX, curve_amount);
}

void fragment() {
	// 깊이 표지: 정점색 초록(가운데 0.09 · 중간 0.18 · 가장자리 0.30) → 0(물가)~1(가운데).
	float depth = 1.0 - smoothstep(0.09, 0.30, COLOR.g);
	float e = 0.1;
	float h0 = ripple_h(wpos.xz, TIME);
	float hx = ripple_h(wpos.xz + vec2(e, 0.0), TIME);
	float hz = ripple_h(wpos.xz + vec2(0.0, e), TIME);
	vec3 nw = normalize(vec3(-(hx - h0) / e * ripple_strength, 1.0, -(hz - h0) / e * ripple_strength));
	NORMAL = normalize((VIEW_MATRIX * vec4(nw, 0.0)).xyz);
	float cos_v = clamp(dot(NORMAL, VIEW), 0.0, 1.0);
	float fres = 0.02 + 0.98 * pow(1.0 - cos_v, 5.0);
	vec3 body = mix(shallow_color, deep_color, smoothstep(0.15, 0.9, depth));
	// 물가 가는 선 — 가장자리 띠 안쪽 잔 노이즈로 끊긴다.
	float fn = vnoise(wpos.xz * 3.0 + TIME * 0.4);
	float foam = (1.0 - smoothstep(0.01, 0.035 + fn * 0.03, depth)) * smoothstep(0.45, 0.7, fn + 0.15) * 0.8;
	EMISSION = mix(body * (1.0 - fres), foam_color * 0.5, foam);
	ALBEDO = foam_color * foam;
	ROUGHNESS = mix(0.06, 0.8, foam);
	SPECULAR = 0.5;
}
