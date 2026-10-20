shader_type spatial;
render_mode blend_mix, cull_back, diffuse_burley, specular_schlick_ggx;

// PLAN 102-5 "바닥 한 색" 처방을 FOREST 구면 투영과 함께 쓰는 자리 —
// terrain_triplanar.gdshader(GO)의 잔디·흙·돌 노이즈 블렌드 fragment를
// world_curve.gdshaderinc(curved_vertex_color.gdshader와 같은 include)의
// vertex 곡률과 합친 변종. 두 파일을 각자 고치지 않고 여기서만 합친다 —
// cel_toon_curved.gdshader가 cel_toon+world_curve를 합친 것과 같은 결
// (HISTORY 2026-09-16 "FOREST 곡률 병합" 참고).

#include "res://saga_core/shaders/world_curve.gdshaderinc"

uniform float curve_amount : hint_range(0.0, 0.02) = 0.004;

uniform sampler2D grass_albedo : source_color;
uniform sampler2D grass_normal : hint_normal;
uniform sampler2D grass_rough;
uniform sampler2D dirt_albedo : source_color;
uniform sampler2D dirt_normal : hint_normal;
uniform sampler2D dirt_rough;
uniform sampler2D stone_albedo : source_color;
uniform sampler2D stone_normal : hint_normal;
uniform sampler2D stone_rough;

// G-0225 — 자체 PBR 세트(K-0093)일 때: 높이 맵 섞기·세트별 빛깔 맞춤(1만리 terrain_triplanar G-0143 과 같은 식). 옛 세트면 use_height 0·gain 1.
uniform sampler2D grass_height;
uniform sampler2D dirt_height;
uniform sampler2D stone_height;
uniform float use_height : hint_range(0.0, 1.0) = 0.0;
uniform vec3 grass_gain = vec3(1.0);
uniform vec3 dirt_gain = vec3(1.0);
uniform vec3 stone_gain = vec3(1.0);
uniform float photo_color : hint_range(0.0, 1.0) = 1.0;
uniform float blotch : hint_range(0.0, 1.0) = 1.0;   // 흙·돌 얼룩 세기(사진 세트에선 줄인다 — 흐린 물감 얼룩)
uniform float tile_scale : hint_range(0.05, 2.0) = 0.4;
uniform float patch_scale : hint_range(0.02, 1.0) = 0.12;
// G-0252 — 1 이면 법선을 월드 공간 triplanar(whiteout)로 풀어 NORMAL 에 직접 쓴다. GLB 벽(2나락 방)은 접선 방향이 칸마다 뒤집혀
// 접선 공간 NORMAL_MAP 이 바둑판 검은 칸이 됐다. 0(기본) = 예전 그대로(3마을 평지).
uniform float world_space_normal : hint_range(0.0, 1.0) = 0.0;

varying vec3 world_pos;
varying vec3 world_normal;

float _hash(vec2 p) {
	return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

float _value_noise(vec2 p) {
	vec2 i = floor(p);
	vec2 f = fract(p);
	float a = _hash(i);
	float b = _hash(i + vec2(1.0, 0.0));
	float c = _hash(i + vec2(0.0, 1.0));
	float d = _hash(i + vec2(1.0, 1.0));
	vec2 u = f * f * (3.0 - 2.0 * f);
	return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
}

void vertex() {
	VERTEX = saga_apply_world_curve(VERTEX, MODEL_MATRIX, curve_amount);
	world_pos = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
	world_normal = (MODEL_MATRIX * vec4(NORMAL, 0.0)).xyz;
}

vec4 _triplanar(sampler2D tex, vec3 pos, vec3 n, float scale) {
	vec3 w = abs(normalize(n));
	w /= (w.x + w.y + w.z);
	vec4 xy = texture(tex, pos.xy * scale);
	vec4 yz = texture(tex, pos.zy * scale);
	vec4 xz = texture(tex, pos.xz * scale);
	return xz * w.y + yz * w.x + xy * w.z;
}

// whiteout 블렌드 triplanar 법선(월드 공간) — n 은 정규화된 월드 법선.
vec3 _triplanar_wnormal(sampler2D tex, vec3 pos, vec3 n, float scale) {
	vec3 w = abs(n);
	w /= (w.x + w.y + w.z);
	vec3 tx = texture(tex, pos.zy * scale).rgb * 2.0 - 1.0;
	vec3 ty = texture(tex, pos.xz * scale).rgb * 2.0 - 1.0;
	vec3 tz = texture(tex, pos.xy * scale).rgb * 2.0 - 1.0;
	tx = vec3(tx.xy + n.zy, abs(tx.z) * n.x);
	ty = vec3(ty.xy + n.xz, abs(ty.z) * n.y);
	tz = vec3(tz.xy + n.xy, abs(tz.z) * n.z);
	return normalize(tx.zyx * w.x + ty.xzy * w.y + tz.xyz * w.z);
}

void fragment() {
	vec3 grass_a = _triplanar(grass_albedo, world_pos, world_normal, tile_scale).rgb;
	vec3 dirt_a = _triplanar(dirt_albedo, world_pos, world_normal, tile_scale).rgb;
	vec3 stone_a = _triplanar(stone_albedo, world_pos, world_normal, tile_scale).rgb;
	grass_a *= pow(grass_gain, vec3(1.0 - photo_color));
	dirt_a *= pow(dirt_gain, vec3(1.0 - photo_color));
	stone_a *= pow(stone_gain, vec3(1.0 - photo_color));
	vec3 grass_n = _triplanar(grass_normal, world_pos, world_normal, tile_scale).rgb * 2.0 - 1.0;
	vec3 dirt_n = _triplanar(dirt_normal, world_pos, world_normal, tile_scale).rgb * 2.0 - 1.0;
	vec3 stone_n = _triplanar(stone_normal, world_pos, world_normal, tile_scale).rgb * 2.0 - 1.0;
	float grass_r = _triplanar(grass_rough, world_pos, world_normal, tile_scale).r;
	float dirt_r = _triplanar(dirt_rough, world_pos, world_normal, tile_scale).r;
	float stone_r = _triplanar(stone_rough, world_pos, world_normal, tile_scale).r;

	float n1 = _value_noise(world_pos.xz * patch_scale);
	float n2 = _value_noise(world_pos.xz * patch_scale * 3.7 + vec2(11.0, 5.0));
	float dirt_w = smoothstep(0.55, 0.75, n1) * 0.6 * blotch;
	float stone_w = smoothstep(0.6, 0.8, n2) * 0.5 * blotch;
	float grass_w = max(0.05, 1.0 - dirt_w - stone_w);
	// G-0225 — 높이 기반 섞기(높은 쪽이 이긴다 — 경계가 번지지 않고 틈에 차듯). use_height 0 이면 예전 가중 그대로.
	vec2 hp = world_pos.xz * tile_scale;
	float hg = texture(grass_height, hp).r * 0.6 + grass_w;
	float hd = texture(dirt_height, hp).r * 0.6 + dirt_w;
	float hs = texture(stone_height, hp).r * 0.75 + stone_w;
	float hmax = max(hg, max(hd, hs)) - 0.18;
	grass_w = mix(grass_w, max(hg - hmax, 0.0) * step(0.001, grass_w) + 0.0001, use_height);
	dirt_w = mix(dirt_w, max(hd - hmax, 0.0) * step(0.001, dirt_w), use_height);
	stone_w = mix(stone_w, max(hs - hmax, 0.0) * step(0.001, stone_w), use_height);
	float wsum = grass_w + dirt_w + stone_w;

	vec3 detail_albedo = (grass_a * grass_w + dirt_a * dirt_w + stone_a * stone_w) / wsum;
	vec3 detail_normal = normalize(grass_n * grass_w + dirt_n * dirt_w + stone_n * stone_w);
	float detail_rough = (grass_r * grass_w + dirt_r * dirt_w + stone_r * stone_w) / wsum;

	ALBEDO = COLOR.rgb * detail_albedo;
	if (world_space_normal > 0.5) {
		vec3 wn = normalize(world_normal) * (FRONT_FACING ? 1.0 : -1.0);   // 양면 변종(2나락 glb 원본 cull 끔)의 뒷면
		vec3 nw = normalize(_triplanar_wnormal(grass_normal, world_pos, wn, tile_scale) * grass_w
			+ _triplanar_wnormal(dirt_normal, world_pos, wn, tile_scale) * dirt_w
			+ _triplanar_wnormal(stone_normal, world_pos, wn, tile_scale) * stone_w);
		NORMAL = normalize((VIEW_MATRIX * vec4(nw, 0.0)).xyz);
		detail_normal = vec3(0.0, 0.0, 1.0);
	}
	NORMAL_MAP = detail_normal * 0.5 + 0.5;
	ROUGHNESS = detail_rough;
}
