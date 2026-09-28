shader_type spatial;
render_mode blend_mix, cull_back, diffuse_burley, specular_disabled;

// saga-godot 2026-09-29 "그래픽 먼저" — 이야기 지역 건물(산성·선착장·역사 등)이 무늬 없는 회색 상자(StandardMaterial3D 한 빛)였다.
// 도형은 그대로 두고 칠만 바꾼다: 돌 결(삼축 투영, 색은 tint 가 정하고 그림은 밝기만) + 큰 얼룩 + 상자 모서리 어두운 선 + 아래쪽 그늘 +
// cel_toon 과 같은 띠 명암·림 빛. 같은 색 상자는 재질 하나를 나눠 쓰고(games/saga_go/world/prop_material.gd) 상자 크기는 instance uniform.

uniform vec4 tint : source_color = vec4(0.6, 0.6, 0.6, 1.0);
uniform sampler2D detail_tex : source_color, filter_linear_mipmap, repeat_enable;
uniform float detail_scale = 0.45;
uniform float detail_strength : hint_range(0.0, 1.0) = 0.55;
uniform float edge_width = 0.07;
uniform float edge_dark : hint_range(0.0, 1.0) = 0.5;
uniform int band_count : hint_range(2, 4) = 3;
uniform float band_softness : hint_range(0.0, 1.0) = 0.08;
uniform vec3 rim_color : source_color = vec3(1.0, 0.95, 0.85);
uniform float rim_power : hint_range(0.5, 8.0) = 4.5;
uniform float rim_strength : hint_range(0.0, 2.0) = 0.22;
instance uniform vec3 box_half = vec3(0.0);

varying vec3 wpos;
varying vec3 wnrm;
varying vec3 lpos;
varying vec3 lnrm;

float _hash(vec2 p) {
	return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

float _noise(vec2 p) {
	vec2 i = floor(p);
	vec2 f = fract(p);
	vec2 u = f * f * (3.0 - 2.0 * f);
	return mix(mix(_hash(i), _hash(i + vec2(1.0, 0.0)), u.x), mix(_hash(i + vec2(0.0, 1.0)), _hash(i + vec2(1.0, 1.0)), u.x), u.y);
}

void vertex() {
	wpos = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
	wnrm = normalize((MODEL_MATRIX * vec4(NORMAL, 0.0)).xyz);
	lpos = VERTEX;
	lnrm = NORMAL;
}

void fragment() {
	vec3 w = abs(wnrm);
	w /= (w.x + w.y + w.z);
	vec3 t = texture(detail_tex, wpos.zy * detail_scale).rgb * w.x
		+ texture(detail_tex, wpos.xz * detail_scale).rgb * w.y
		+ texture(detail_tex, wpos.xy * detail_scale).rgb * w.z;
	float lum = dot(t, vec3(0.299, 0.587, 0.114));
	float avg = dot(textureLod(detail_tex, vec2(0.5), 10.0).rgb, vec3(0.299, 0.587, 0.114));
	float detail = mix(1.0, lum / max(avg, 0.05), detail_strength);
	float blotch = 0.94 + 0.12 * _noise(wpos.xz * 0.18 + wpos.y * 0.11);
	float edge = 0.0;
	float ao = 1.0;
	if (box_half.x > 0.0) {
		vec3 d = box_half - abs(lpos);
		vec3 m = step(abs(lnrm), vec3(0.5)); // 이 면에 누운 두 축
		float e = min(mix(99.0, d.x, m.x), min(mix(99.0, d.y, m.y), mix(99.0, d.z, m.z)));
		edge = 1.0 - smoothstep(edge_width * 0.4, edge_width, e);
		ao = mix(0.72, 1.0, smoothstep(-box_half.y, -box_half.y + min(0.9, box_half.y), lpos.y));
	}
	ALBEDO = tint.rgb * detail * blotch * (1.0 - edge * edge_dark) * ao;
	ROUGHNESS = 1.0;
}

void light() {
	float ndotl = clamp(dot(NORMAL, LIGHT), 0.0, 1.0);
	float band_step = 1.0 / float(band_count);
	float banded = floor(ndotl / band_step) * band_step;
	float s = smoothstep(banded, banded + band_softness * band_step, ndotl);
	float lit = clamp(mix(banded, banded + band_step, s), 0.0, 1.0);
	float rim = pow(1.0 - clamp(dot(NORMAL, VIEW), 0.0, 1.0), rim_power) * rim_strength;
	rim *= smoothstep(0.0, 0.3, ndotl);
	DIFFUSE_LIGHT += clamp(ALBEDO * LIGHT_COLOR * ATTENUATION * lit + rim_color * rim * LIGHT_COLOR * ATTENUATION, vec3(0.0), vec3(1.0));
}
