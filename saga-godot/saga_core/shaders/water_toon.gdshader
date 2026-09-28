shader_type spatial;
render_mode blend_mix, cull_disabled, depth_draw_never, diffuse_toon, specular_toon;

// PLAN 66-2 "물은 단순화된 색+하이라이트+가장자리 거품"·106장 ② 의 실물판.
// 원신 물의 문법(얕은 곳 청록 → 깊은 곳 남색 두 단, 물가 흰 거품, 흐르는
// 하이라이트 띠, 비스듬히 볼수록 하늘빛)만 따르고 코드는 직접 짰다.
// 두께는 깊이 버퍼로 잰다 — 수면 뒤 불투명 지형까지의 시선 거리 차.
// uv_flow > 0 이면 폭포면: UV.y 방향으로 흘러내리는 줄무늬만 그린다.

uniform sampler2D depth_tex : hint_depth_texture, filter_linear_mipmap;

// 2026-09-28 GO 가 ACES·밝은 해로 바뀐 뒤 옛 색(0.36,0.80,0.80 / 0.08,0.33,0.60)은 바다가 연한 하늘색 띠로 바랬다(창 모드 촬영).
// 한 단 짙은 청록 → 남색, 비스듬히 볼 때 하늘빛 섞기 0.45 → 0.22(강을 낮게 보면 하얗게 날아갔다), 해 반짝임 추가.
uniform vec3 shallow_color : source_color = vec3(0.18, 0.66, 0.70);
uniform vec3 deep_color : source_color = vec3(0.03, 0.2, 0.46);
uniform vec3 foam_color : source_color = vec3(0.96, 0.99, 1.0);
uniform vec3 sky_tint : source_color = vec3(0.70, 0.86, 0.98);
uniform float depth_scale = 2.2;     // 이 두께(m)면 완전히 깊은 색
uniform float foam_width = 0.45;     // 물가 거품 두께(m)
uniform vec2 flow = vec2(0.35, 0.12);
uniform float wave_height = 0.04;
uniform float uv_flow = 0.0;

varying vec3 wpos;

float hash21(vec2 p) {
	return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float vnoise(vec2 p) {
	vec2 i = floor(p);
	vec2 f = fract(p);
	vec2 u = f * f * (3.0 - 2.0 * f);
	float a = hash21(i);
	float b = hash21(i + vec2(1.0, 0.0));
	float c = hash21(i + vec2(0.0, 1.0));
	float d = hash21(i + vec2(1.0, 1.0));
	return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

void vertex() {
	wpos = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
	if (uv_flow <= 0.0) {
		VERTEX.y += (sin(wpos.x * 0.35 + TIME * 1.3) + cos(wpos.z * 0.3 + TIME * 1.1)) * wave_height;
	}
}

void fragment() {
	if (uv_flow > 0.0) {
		// 폭포 — 세로로 흘러내리는 흰 줄과 파란 바탕, 아래쪽일수록 물보라.
		float s = vnoise(vec2(UV.x * 14.0, UV.y * 3.0 - TIME * uv_flow * 3.0));
		float streak = smoothstep(0.55, 0.62, s);
		float spray = smoothstep(0.75, 1.0, UV.y);
		ALBEDO = mix(mix(shallow_color, deep_color, 0.35), foam_color, max(streak * 0.8, spray));
		ALPHA = 0.82;
		ROUGHNESS = 0.3;
	} else {
		float depth_raw = texture(depth_tex, SCREEN_UV).r;
		vec4 view = INV_PROJECTION_MATRIX * vec4(SCREEN_UV * 2.0 - 1.0, depth_raw, 1.0);
		view.xyz /= view.w;
		float thick = max(-view.z - (-VERTEX.z), 0.0);
		float t = clamp(thick / depth_scale, 0.0, 1.0);

		// 툰 — 부드러운 그라디언트 대신 두 단으로 끊는다(경계만 살짝 번짐).
		float band = smoothstep(0.30, 0.36, t) * 0.55 + smoothstep(0.72, 0.78, t) * 0.45;
		vec3 col = mix(shallow_color, deep_color, band);

		float n = vnoise(wpos.xz * 0.9 + TIME * flow);
		float foam = 1.0 - smoothstep(foam_width * (0.55 + 0.9 * n) - 0.05, foam_width * (0.55 + 0.9 * n), thick);

		float s = vnoise(wpos.xz * vec2(0.18, 0.7) + TIME * flow * 0.6);
		float streak = smoothstep(0.765, 0.78, s) * (1.0 - band * 0.5);

		float fr = pow(1.0 - clamp(dot(NORMAL, VIEW), 0.0, 1.0), 4.0);
		col = mix(col, sky_tint, fr * 0.22);
		// 해 반짝임 — 잔물결 두 겹이 겹치는 곳만 작게 빛난다(원신 물의 반짝이).
		float g1 = vnoise(wpos.xz * 5.5 + TIME * flow * 3.0);
		float g2 = vnoise(wpos.xz * 7.3 - TIME * flow.yx * 3.4 + 5.0);
		float glint = smoothstep(0.92, 0.95, g1 * g2 * 1.6) * (1.0 - fr) * (1.0 - smoothstep(25.0, 60.0, length(VERTEX)));
		col += vec3(1.0, 0.97, 0.9) * glint * 0.9;
		col = mix(col, foam_color, max(foam, streak * 0.32));

		ALBEDO = col;
		ALPHA = max(mix(0.7, 0.96, t), max(foam, glint));
		ROUGHNESS = 0.22;   // 0.12·0.6 은 낮게 본 강에서 해 반사가 넓게 번져 하얗게 떴다
		SPECULAR = 0.35;
	}
}
