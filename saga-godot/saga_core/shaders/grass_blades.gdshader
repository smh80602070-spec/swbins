shader_type spatial;
render_mode cull_disabled, diffuse_lambert, specular_disabled;

// saga-godot 2026-09-28 "그래픽 먼저" — 원신식 풀잎 밭(games/saga_go/world/grass_field.gd 가 카메라 둘레에만 깐다).
// 인스턴스 색 = 그 칸 땅 정점색(terrain_builder.gd color_of) — 지역마다 풀빛이 땅과 같이 바뀐다(가을 벌·호박빛 거리).
// 정점색 = 잎마다 명암 흔들림, UV.y = 밑동 0 → 끝 1.
// 가장자리(fade_start~fade_end)는 잎을 눌러 0 으로 — 칸을 새로 깔 때 뚝 나타나지 않는다.
//
// G-0142 — 사실적 들풀(사용자 10-09 "배경 전부 사실·인물 툰"). 잎은 세 마디로 휘고(grass_field._clump_mesh) 잎 면 법선을 싣는다.
//   법선 = 위쪽과 잎 면 섞기(밑동은 위 — 땅과 같은 빛, 위로 갈수록 잎 면 — 포기가 둥글게) · 잎 가로(UV.x)로 가운데 잎맥이 밝고 가장자리 어둡게
//   · 역광(BACKLIGHT): 해가 잎 뒤에 있으면 잎끝이 노랗게 비친다 · 색: 포기(뿌리 자리 노이즈)·잎(UV2.x)마다 초록·누런·짙은 흔들림.

uniform float ground_mul = 0.42;          // 땅 셰이더는 정점색 × 풀 텍스처(어두운 편) — 밑동을 그 밝기에 맞춘다
uniform vec3 tip_tint = vec3(1.22, 1.26, 0.82);
uniform float wind_strength = 0.16;
uniform vec2 gust_dir = vec2(0.8, 0.6);
uniform float fade_start = 30.0;
uniform float fade_end = 42.0;
uniform vec3 fade_center;              // grass_field.gd 가 매 프레임 카메라 자리를 넣는다
uniform float leaf_normal = 0.55;      // 잎 끝에서 잎 면 법선 몫
uniform float translucency = 0.55;

varying float v_h;
varying float v_gust;
varying float v_var;     // 포기 색 흔들림(뿌리 자리 노이즈 0~1)
varying vec3 v_nrm;      // 잎 면 법선(월드)

float hash21(vec2 p) {
	return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float vnoise(vec2 p) {
	vec2 i = floor(p);
	vec2 f = fract(p);
	vec2 u = f * f * (3.0 - 2.0 * f);
	return mix(mix(hash21(i), hash21(i + vec2(1.0, 0.0)), u.x), mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), u.x), u.y);
}

void vertex() {
	v_h = UV.y;
	vec3 wp = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
	vec3 root = (MODEL_MATRIX * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
	v_var = vnoise(root.xz * 0.11) * 0.7 + hash21(root.xz) * 0.3;
	v_nrm = normalize((MODEL_MATRIX * vec4(NORMAL, 0.0)).xyz);
	float d = distance(wp.xz, fade_center.xz);
	float keep = 1.0 - smoothstep(fade_start, fade_end, d);
	VERTEX.y *= keep;
	// 흔들림: 잔바람 둘 + 밭을 건너가는 큰 물결(원신 들판의 바람 물결).
	float bend = UV.y * UV.y;
	float gust = sin(dot(root.xz, gust_dir) * 0.09 - TIME * 1.4) * 0.5 + 0.5;
	gust = gust * gust;
	v_gust = gust * bend;
	float sway = sin(TIME * 1.9 + wp.x * 0.37 + wp.z * 0.23) * 0.55 + sin(TIME * 3.3 + wp.x * 1.3 - wp.z * 0.9) * 0.2;
	sway += sin(TIME * 5.1 + UV2.x * 40.0) * 0.12;   // G-0142 잎마다 잔떨림
	vec2 push = gust_dir * (gust * 1.0 + sway) * wind_strength * bend;
	VERTEX.x += push.x;
	VERTEX.z += push.y;
	VERTEX.y -= length(push) * 0.35 * UV.y;
	NORMAL = vec3(0.0, 1.0, 0.0);
}

void fragment() {
	vec3 base = COLOR.rgb * ground_mul;
	// G-0142 — 포기·잎 색 흔들림: 누런 잎·짙은 잎이 섞인 들풀.
	vec3 dry = base * vec3(1.25, 1.08, 0.62);
	vec3 deep = base * vec3(0.78, 0.92, 0.82);
	float pick = v_var * 0.7 + UV2.x * 0.3;
	base = mix(base, dry, smoothstep(0.62, 0.9, pick) * 0.8);
	base = mix(base, deep, (1.0 - smoothstep(0.12, 0.38, pick)) * 0.7);
	vec3 col = mix(base * 0.58, base * tip_tint, smoothstep(0.0, 1.0, v_h));
	// 잎맥 — 가운데 밝고 가장자리로 어둡게.
	col *= mix(0.86, 1.04, 1.0 - abs(UV.x));
	col += vec3(0.05, 0.06, 0.02) * v_gust;   // 바람이 지나가는 물결이 잎끝을 살짝 밝힌다
	ALBEDO = col;
	// 법선 — 밑동은 위(땅빛), 끝으로 갈수록 잎 면. 뒷면에서 보면 뒤집는다(양면 그리기).
	vec3 n = v_nrm * (FRONT_FACING ? 1.0 : -1.0);
	vec3 nw = normalize(mix(vec3(0.0, 1.0, 0.0), n, leaf_normal * v_h));
	NORMAL = normalize((VIEW_MATRIX * vec4(nw, 0.0)).xyz);
	// 역광 — 잎 뒤에서 오는 빛이 잎을 통과해 끝이 노랗게(엔진이 뒷면 빛 몫을 더한다).
	BACKLIGHT = col * vec3(1.15, 1.1, 0.6) * translucency * smoothstep(0.2, 1.0, v_h);
	ROUGHNESS = 0.85;
}
