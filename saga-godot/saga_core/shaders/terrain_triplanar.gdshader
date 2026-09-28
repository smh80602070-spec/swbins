shader_type spatial;
render_mode cull_disabled, diffuse_burley;

// PLAN 102-5 "바닥 한 색" 처방의 실물판 — ground_noise.gdshader가 남겨둔
// 자리를 그대로 잇는다(정점색·지형 판정 로직은 그대로, 새로 안 짠다).
// 103장 tilegen이 만든 잔디·흙·돌 3장(512, 각 albedo+normal+roughness)을
// 노이즈로 자연스럽게 섞어 "밋밋한 단색 평면"에 표면 디테일을 얹는다.
// terrain_builder.gd의 정점색(칸별 지형색, 산·강·길 구분)은 최종 곱으로
// 그대로 남아 지형 구분은 이 셰이더로 조금도 안 바뀐다 — 순수 디테일
// 추가. 지형 메시가 전부 위(+Y)만 보는 평평한 조각이라(terrain_builder.gd
// _build() 참고, 옆면 없음) 실제로는 XZ 평면 투영이면 충분하지만, 이름과
// 앞으로의 확장(경사면)을 대비해 삼축 투영으로 짠다.

uniform sampler2D grass_albedo : source_color;
uniform sampler2D grass_normal : hint_normal;
uniform sampler2D grass_rough;
uniform sampler2D dirt_albedo : source_color;
uniform sampler2D dirt_normal : hint_normal;
uniform sampler2D dirt_rough;
uniform sampler2D stone_albedo : source_color;
uniform sampler2D stone_normal : hint_normal;
uniform sampler2D stone_rough;

uniform float tile_scale : hint_range(0.05, 2.0) = 0.4; // 텍스처 반복 밀도(1/m)
uniform float patch_scale : hint_range(0.02, 1.0) = 0.12; // 얼룩 크기

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

// saga-godot 106장 ㊺ — 눈·얼음·모래 표시(terrain_builder.gd surface_of: CUSTOM0 .r 눈 · .g 얼음 · .b 모래). 안 싣는 메시는 0.
varying vec3 v_surf;

void vertex() {
	v_surf = CUSTOM0.rgb;
	world_pos = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
	world_normal = (MODEL_MATRIX * vec4(NORMAL, 0.0)).xyz;
}

// 삼축(XY·YZ·XZ) 투영을 법선 가중으로 섞는다(표준 triplanar). 이 메시는
// 늘 위를 보므로 실질적으로 XZ 항이 거의 전부를 차지한다.
vec4 _triplanar(sampler2D tex, vec3 pos, vec3 n, float scale) {
	vec3 w = abs(normalize(n));
	w /= (w.x + w.y + w.z);
	vec4 xy = texture(tex, pos.xy * scale);
	vec4 yz = texture(tex, pos.zy * scale);
	vec4 xz = texture(tex, pos.xz * scale);
	return xz * w.y + yz * w.x + xy * w.z;
}

void fragment() {
	vec3 grass_a = _triplanar(grass_albedo, world_pos, world_normal, tile_scale).rgb;
	vec3 dirt_a = _triplanar(dirt_albedo, world_pos, world_normal, tile_scale).rgb;
	vec3 stone_a = _triplanar(stone_albedo, world_pos, world_normal, tile_scale).rgb;
	// 텍스처 색([0,1])을 탄젠트 공간 벡터([-1,1])로 되돌려야 가중 평균이
	// 뜻이 있다 — [0,1] 그대로 블렌드하면 방향이 아니라 색을 섞는 꼴이 된다.
	vec3 grass_n = _triplanar(grass_normal, world_pos, world_normal, tile_scale).rgb * 2.0 - 1.0;
	vec3 dirt_n = _triplanar(dirt_normal, world_pos, world_normal, tile_scale).rgb * 2.0 - 1.0;
	vec3 stone_n = _triplanar(stone_normal, world_pos, world_normal, tile_scale).rgb * 2.0 - 1.0;
	float grass_r = _triplanar(grass_rough, world_pos, world_normal, tile_scale).r;
	float dirt_r = _triplanar(dirt_rough, world_pos, world_normal, tile_scale).r;
	float stone_r = _triplanar(stone_rough, world_pos, world_normal, tile_scale).r;

	float n1 = _value_noise(world_pos.xz * patch_scale);
	float n2 = _value_noise(world_pos.xz * patch_scale * 3.7 + vec2(11.0, 5.0));
	float dirt_w = smoothstep(0.55, 0.75, n1) * 0.6;
	// 2026-09-28 — 평지의 돌 얼룩은 0.5 → 0.15: 풀밭 위 잿빛 얼룩이 멀리서 안개 덩어리처럼 보였다(창 모드 촬영). 경사 돌은 아래서 그대로.
	float stone_w = smoothstep(0.6, 0.8, n2) * 0.15;
	// 2026-09-23 GO 절벽·봉우리(terrain_builder.gd) — 경사가 급할수록 돌.
	// 평지(법선 y=1)는 slope 0 이라 예전 화면 그대로다.
	float slope = 1.0 - clamp(normalize(world_normal).y, 0.0, 1.0);
	stone_w = max(stone_w, smoothstep(0.25, 0.6, slope));
	dirt_w *= 1.0 - smoothstep(0.25, 0.6, slope);
	float grass_w = max(0.05, 1.0 - dirt_w - stone_w);
	float wsum = grass_w + dirt_w + stone_w;

	vec3 detail_albedo = (grass_a * grass_w + dirt_a * dirt_w + stone_a * stone_w) / wsum;
	vec3 detail_normal = normalize(grass_n * grass_w + dirt_n * dirt_w + stone_n * stone_w);
	float detail_rough = (grass_r * grass_w + dirt_r * dirt_w + stone_r * stone_w) / wsum;

	ALBEDO = COLOR.rgb * detail_albedo;
	// 2026-09-28 "그래픽 먼저" — 절벽(가파른 면)은 돌 텍스처 한 장만 반복돼 멀리서 한 빛 회색 판이었다.
	// 지층 띠(높이 따라 굽이치는 가로 줄)·큰 얼룩(따뜻한 황토 ↔ 서늘한 잿빛)·세로 물때 줄을 얹는다. 평지는 cliff 0 이라 그대로.
	float cliff = smoothstep(0.45, 0.8, slope);
	float wob = _value_noise(world_pos.xz * 0.05 + world_pos.y * 0.01) * 5.0;
	float strata = sin(world_pos.y * 0.75 + wob) * 0.5 + 0.5;
	float band = mix(0.62, 1.18, smoothstep(0.2, 0.8, strata));
	float macro = _value_noise(vec2(world_pos.x + world_pos.z, world_pos.y * 2.0) * 0.02);
	vec3 rock_tint = mix(vec3(1.12, 0.98, 0.82), vec3(0.86, 0.92, 1.02), macro);
	float streak = _value_noise(vec2((world_pos.x - world_pos.z) * 0.6, world_pos.y * 0.04));
	rock_tint *= band * mix(0.85, 1.05, streak);
	ALBEDO *= mix(vec3(1.0), rock_tint, cliff);
	// 이끼 — 절벽의 각진 면 중 조금이라도 위를 보는 턱(법선 y 0.08~0.3)과 큰 얼룩이 겹치는 곳에 풀빛이 앉는다(원신 절벽의 이끼 턱).
	float ny = normalize(world_normal).y;
	float moss = cliff * smoothstep(0.04, 0.2, ny) * smoothstep(0.25, 0.5, _value_noise(world_pos.xz * 0.08 + world_pos.y * 0.05));
	ALBEDO = mix(ALBEDO, vec3(0.2, 0.36, 0.13) * (0.85 + 0.3 * n1), moss * 0.85);
	NORMAL_MAP = detail_normal * 0.5 + 0.5;
	ROUGHNESS = detail_rough;
	// 모래 표시 — 풀 텍스처 대신 모래색에 흙결만 옅게(평평한 모래밭).
	// 정점색은 sRGB 로 적은 값이라(풀·흙은 어두운 텍스처와 곱해져 맞았다) 그대로 칠하는 모래는 선형으로 — 안 그러면 한 단 허옇게 뜬다.
	float sand_w = smoothstep(0.25, 0.75, v_surf.z) * (1.0 - smoothstep(0.35, 0.7, slope));
	vec3 sand = pow(COLOR.rgb, vec3(2.2)) * mix(vec3(1.0), dirt_a * 2.5, 0.25) * (0.93 + 0.07 * n2);
	// 2026-09-28 — 모래밭이 한 빛 판이었다. 바람 물결무늬(굽이치는 가는 줄) + 드문드문 흰 조개 점.
	float ripple = sin(dot(world_pos.xz, vec2(0.82, 0.57)) * 2.6 + _value_noise(world_pos.xz * 0.15) * 6.0) * 0.5 + 0.5;
	sand *= mix(0.93, 1.04, smoothstep(0.35, 0.65, ripple));
	vec2 sc = world_pos.xz * 2.5;
	float shell = step(0.985, _hash(floor(sc))) * (1.0 - smoothstep(0.18, 0.24, length(fract(sc) - 0.5)));
	sand = mix(sand, vec3(0.95, 0.9, 0.86), shell * 0.8);
	ALBEDO = mix(ALBEDO, sand, sand_w);
	ROUGHNESS = mix(ROUGHNESS, 0.9, sand_w);
	// saga-godot PLAN 106장 ㊺ 서리봉 고원 — 눈 표시(눈밭·눈 덮인 산)는 풀 텍스처 대신 눈으로,
	// 얼음 표시(얼어붙은 호수)는 매끈한 얼음으로. 표시는 정점색이 아니라 CUSTOM0 로 따로 온다(가장자리 섞임에 안 흔들린다).
	// 다른 지역·판은 표시가 0 이라 화면이 그대로다. 가파른 비탈은 돌을 남긴다.
	float snow_w = smoothstep(0.25, 0.75, v_surf.x) * (1.0 - smoothstep(0.35, 0.7, slope));
	// 눈은 정점색보다 한 단 희게(길·숲 바닥 색이 비치되 눈빛이 이기게) — AgX 톤매핑에서 0.86 은 회색으로 가라앉았다.
	// 09-28 GO 가 ACES·밝은 해로 바뀐 뒤 0.95 눈은 하얗게 포화돼 결이 사라졌다(창 모드 촬영) — 한 단 낮추고 얼룩을 키운다.
	vec3 snow = mix(COLOR.rgb * 0.62, vec3(0.52, 0.57, 0.64), 0.5) * (0.84 + 0.16 * n2) * mix(vec3(1.0), stone_a * 1.6, 0.12);
	ALBEDO = mix(ALBEDO, snow, snow_w);
	ROUGHNESS = mix(ROUGHNESS, 0.75, snow_w);
	float ice_w = smoothstep(0.25, 0.75, v_surf.y) * (1.0 - snow_w);
	// 2026-09-28 — 얼음이 정점색 한 빛(파스텔 하늘색 판)이라 물감 칠한 바닥 같았다. 희게 한 단 + 가는 금(두 겹)·깊은 곳 짙은 청록 얼룩.
	float crack1 = 1.0 - smoothstep(0.0, 0.018, abs(_value_noise(world_pos.xz * 0.11) - 0.5));
	float crack2 = 1.0 - smoothstep(0.0, 0.012, abs(_value_noise(world_pos.xz * 0.37 + vec2(3.0, 7.0)) - 0.5));
	vec3 ice = mix(COLOR.rgb * 0.7, vec3(0.5, 0.6, 0.7), 0.25) * (0.88 + 0.12 * n1);
	ice = mix(ice, COLOR.rgb * vec3(0.55, 0.8, 0.85), smoothstep(0.55, 0.85, n2) * 0.45);
	ice = mix(ice, vec3(0.72, 0.78, 0.85), max(crack1, crack2 * 0.6) * 0.75);
	ALBEDO = mix(ALBEDO, ice, ice_w);
	ROUGHNESS = mix(ROUGHNESS, 0.12, ice_w);
	NORMAL_MAP = mix(NORMAL_MAP, vec3(0.5, 0.5, 1.0), max(ice_w, snow_w * 0.3));
}
