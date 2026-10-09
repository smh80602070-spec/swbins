shader_type spatial;
render_mode blend_mix, depth_draw_always, cull_back, diffuse_burley, specular_schlick_ggx;

// G-0140 — 사실적 물(사용자 10-09 "물 그래픽은 사실적으로"). 강·바다·다리 밑 수면(terrain_builder _build_water). 폭포는 water_toon 그대로.
// 텍스처 에셋 없이 코드로만:
//   잔물결 법선 — 흐르는 높이 함수(사인 물결 + 값 노이즈 두 겹)의 차분.
//   굴절 — 화면 텍스처를 법선만큼 밀어 읽는다(밀린 자리가 수면 앞 물체면 안 민다).
//   흡수 — 수직 깊이(G-0139 로 물 밑이 매끈해짐)만큼 빛이 빠지고 물빛이 찬다: 얕으면 맑은 청록(바닥이 비침), 깊으면 남색.
//   반사 — 엔진 PBR(하늘 반사 맵·해 정반사, 프레넬). 물 밑 빛은 이미 조명된 화면이라 EMISSION 으로, ALBEDO 는 검정에 가깝게
//          (그래야 해 빛이 물 밑 색을 두 번 비추지 않는다). 물 밑 빛은 (1 − 프레넬)만큼만.
//   물가 거품 — 수직 깊이 0~foam_depth 의 가는 선 + 노이즈로 끊김.
// 모바일 렌더러: 화면·깊이 텍스처 지원(SSR 은 없음 — 건물은 비치지 않고 하늘·해만).

uniform sampler2D screen_tex : hint_screen_texture, filter_linear_mipmap;
uniform sampler2D depth_tex : hint_depth_texture, filter_linear_mipmap;

uniform vec3 absorb = vec3(0.55, 0.16, 0.10);        // m 당 빛 빠짐(빨강이 먼저 — 깊을수록 푸르게)
uniform vec3 scatter_color : source_color = vec3(0.05, 0.26, 0.34); // 물 속 산란빛(깊은 물 몸빛)
uniform vec3 deep_color : source_color = vec3(0.015, 0.08, 0.16);
uniform float scatter_depth = 2.2;                   // 이 깊이(m)면 산란빛이 거의 다 찬다
uniform float refract_strength = 0.035;
uniform float wave_height = 0.035;
uniform float ripple_scale = 0.95;
uniform float ripple_strength = 0.16;
uniform vec2 flow = vec2(0.32, 0.11);
uniform vec3 foam_color : source_color = vec3(0.92, 0.95, 0.97);
uniform float foam_depth = 0.05;
uniform float roughness = 0.07;

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

// 수면 높이(잔물결) — 큰 사인 물결 둘 + 흐르는 값 노이즈 두 겹.
float ripple_h(vec2 p, float t) {
	float h = sin(dot(p, vec2(0.21, 0.13)) + t * 1.1) * 0.5 + sin(dot(p, vec2(-0.17, 0.27)) + t * 0.8) * 0.35;
	h += vnoise(p * ripple_scale + flow * t) * 0.9 + vnoise(p * ripple_scale * 2.3 - flow.yx * t * 1.4 + 7.0) * 0.45;
	return h;
}

void vertex() {
	wpos = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
	VERTEX.y += (sin(wpos.x * 0.31 + TIME * 1.2) + cos(wpos.z * 0.27 + TIME * 0.95)) * wave_height;
}

void fragment() {
	vec3 surf_w = (INV_VIEW_MATRIX * vec4(VERTEX, 1.0)).xyz;
	// 잔물결 법선(월드) — 높이 함수 차분. 멀수록 잦아든다(멀리서 반짝이 잡음).
	float e = 0.12;
	float h0 = ripple_h(surf_w.xz, TIME);
	float hx = ripple_h(surf_w.xz + vec2(e, 0.0), TIME);
	float hz = ripple_h(surf_w.xz + vec2(0.0, e), TIME);
	float fade = 1.0 - smoothstep(30.0, 120.0, length(VERTEX));
	vec3 nw = normalize(vec3(-(hx - h0) / e * ripple_strength * fade, 1.0, -(hz - h0) / e * ripple_strength * fade));
	NORMAL = normalize((VIEW_MATRIX * vec4(nw, 0.0)).xyz);

	// 수직 깊이 — 굴절 안 한 자리.
	float d0 = texture(depth_tex, SCREEN_UV).r;
	vec4 v0 = INV_PROJECTION_MATRIX * vec4(SCREEN_UV * 2.0 - 1.0, d0, 1.0);
	v0.xyz /= v0.w;
	float depth0 = max(surf_w.y - (INV_VIEW_MATRIX * vec4(v0.xyz, 1.0)).y, 0.0);

	// 굴절 — 깊을수록 조금 더 민다. 밀린 자리가 수면보다 앞(물 밖 물체)이면 원래 자리.
	vec2 ruv = SCREEN_UV + nw.xz * refract_strength * clamp(depth0, 0.0, 1.0);
	float d1 = texture(depth_tex, ruv).r;
	vec4 v1 = INV_PROJECTION_MATRIX * vec4(ruv * 2.0 - 1.0, d1, 1.0);
	v1.xyz /= v1.w;
	if (v1.z > VERTEX.z) {
		ruv = SCREEN_UV;
		v1 = v0;
	}
	float depth = max(surf_w.y - (INV_VIEW_MATRIX * vec4(v1.xyz, 1.0)).y, 0.0);
	// 시선이 물을 지나는 길이 — 수직 깊이 ÷ 비스듬함(얕게 보면 길어 더 흐리다). 너무 커지지 않게.
	float cos_v = clamp(abs(dot(nw, normalize(CAMERA_POSITION_WORLD - surf_w))), 0.15, 1.0);
	float path = depth / cos_v;

	vec3 below = textureLod(screen_tex, ruv, 0.0).rgb;
	vec3 trans = exp(-absorb * path);
	vec3 body = mix(scatter_color, deep_color, smoothstep(scatter_depth, scatter_depth * 3.0, depth));
	vec3 under = below * trans + body * (1.0 - exp(-path / scatter_depth));

	// 프레넬(슐릭, 물 F0 0.02) — 이만큼은 엔진 반사, 나머지가 물 밑 빛.
	float fres = 0.02 + 0.98 * pow(1.0 - cos_v, 5.0);

	// 물가 거품 — 가는 선, 노이즈로 끊고 흐른다.
	float fn = vnoise(surf_w.xz * 1.6 + flow * TIME * 1.5) * 0.6 + vnoise(surf_w.xz * 4.1 - flow * TIME) * 0.4;
	float foam = (1.0 - smoothstep(foam_depth * 0.4, foam_depth * (0.7 + fn * 0.8), depth0)) * smoothstep(0.35, 0.6, fn + 0.2);

	EMISSION = mix(under * (1.0 - fres), foam_color * 0.6, foam);
	ALBEDO = mix(vec3(0.0), foam_color, foam);
	ROUGHNESS = mix(roughness, 0.8, foam);
	SPECULAR = 0.5;
	METALLIC = 0.0;
	ALPHA = 1.0;
}
