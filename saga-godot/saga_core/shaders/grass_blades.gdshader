shader_type spatial;
render_mode cull_disabled, diffuse_lambert, specular_disabled;

// saga-godot 2026-09-28 "그래픽 먼저" — 원신식 풀잎 밭(games/saga_go/world/grass_field.gd 가 카메라 둘레에만 깐다).
// 인스턴스 색 = 그 칸 땅 정점색(terrain_builder.gd color_of) — 지역마다 풀빛이 땅과 같이 바뀐다(가을 벌·호박빛 거리).
// 정점색 = 잎마다 명암 흔들림, UV.y = 밑동 0 → 끝 1.
// 법선은 늘 위 — 잎이 땅과 같은 빛을 받아 밑동이 땅에 녹아든다(잎 옆면 빛으로 얼룩지지 않게).
// 가장자리(fade_start~fade_end)는 잎을 눌러 0 으로 — 칸을 새로 깔 때 뚝 나타나지 않는다.

uniform float ground_mul = 0.42;          // 땅 셰이더는 정점색 × 풀 텍스처(어두운 편) — 밑동을 그 밝기에 맞춘다
uniform vec3 tip_tint = vec3(1.25, 1.3, 0.8);
uniform float wind_strength = 0.16;
uniform vec2 gust_dir = vec2(0.8, 0.6);
uniform float fade_start = 30.0;
uniform float fade_end = 42.0;
uniform vec3 fade_center;              // grass_field.gd 가 매 프레임 카메라 자리를 넣는다

varying float v_h;
varying float v_gust;

void vertex() {
	v_h = UV.y;
	vec3 wp = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
	vec3 root = (MODEL_MATRIX * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
	float d = distance(wp.xz, fade_center.xz);
	float keep = 1.0 - smoothstep(fade_start, fade_end, d);
	VERTEX.y *= keep;
	// 흔들림: 잔바람 둘 + 밭을 건너가는 큰 물결(원신 들판의 바람 물결).
	float bend = UV.y * UV.y;
	float gust = sin(dot(root.xz, gust_dir) * 0.09 - TIME * 1.4) * 0.5 + 0.5;
	gust = gust * gust;
	v_gust = gust * bend;
	float sway = sin(TIME * 1.9 + wp.x * 0.37 + wp.z * 0.23) * 0.55 + sin(TIME * 3.3 + wp.x * 1.3 - wp.z * 0.9) * 0.2;
	vec2 push = gust_dir * (gust * 1.0 + sway) * wind_strength * bend;
	VERTEX.x += push.x;
	VERTEX.z += push.y;
	VERTEX.y -= length(push) * 0.35 * UV.y;
	NORMAL = vec3(0.0, 1.0, 0.0);   // 인스턴스는 돌리지 않고(grass_field.gd) 크기만 바꾼다 — 모델 위 = 월드 위
}

void fragment() {
	vec3 base = COLOR.rgb * ground_mul;
	vec3 col = mix(base * 0.62, base * tip_tint, smoothstep(0.0, 1.0, v_h));
	col += vec3(0.05, 0.06, 0.02) * v_gust;   // 바람이 지나가는 물결이 잎끝을 살짝 밝힌다
	ALBEDO = col;
	// 뒷면도 같은 위 법선(양면 그리기는 뒷면 법선을 뒤집어 아래를 봐 까맣게 나왔다).
	NORMAL = normalize((VIEW_MATRIX * vec4(0.0, 1.0, 0.0, 0.0)).xyz);
	ROUGHNESS = 0.9;
}
