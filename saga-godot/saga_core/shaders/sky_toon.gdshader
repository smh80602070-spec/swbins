shader_type sky;
render_mode use_debanding;

// PLAN 66-2 "손그림에 가까운 그라디언트+구름"·106장 ② — 원신 하늘의 문법
// (지평선 쪽 밝은 하늘색 → 천정 짙은 파랑, 가장자리가 또렷한 뭉게구름,
// 둥근 해 원반과 번짐)을 코드로 직접 그린다. TIME 을 쓰지 않는다 — 하늘
// 셰이더가 TIME 을 쓰면 반사(radiance) 맵을 매 프레임 다시 굽는다.

uniform vec3 top_color : source_color = vec3(0.24, 0.50, 0.90);
uniform vec3 horizon_color : source_color = vec3(0.76, 0.88, 0.96);
uniform vec3 ground_color : source_color = vec3(0.42, 0.46, 0.44);
uniform vec3 cloud_color : source_color = vec3(1.0, 1.0, 1.0);
uniform vec3 cloud_shade : source_color = vec3(0.70, 0.76, 0.88);
uniform float cloud_coverage : hint_range(0.0, 1.0) = 0.52;
uniform float cloud_scale = 1.4;
uniform float sun_size = 0.045;       // 라디안
uniform float sun_strength = 3.0;
// saga-godot 2026-09-28 — 밤 별(0 = 낮, 1 = 밤). games/saga_go/world/night_visual.gd 가 넣는다(uniform 이라 바뀔 때만 반사 맵을 다시 굽는다).
uniform float stars : hint_range(0.0, 1.0) = 0.0;
// G-0026 — 하늘 파노라마(등장방형 2:1, 방위각 0=북(-Z)·90=동(+X), 위가 v=0). pano_on 이 0 이면 아래 툰 하늘 그대로.
// games/saga_go/world/sky_panorama.gd 가 시각·지역 시대에 맞춰 두 장(pano_a → pano_b)과 섞기(pano_mix)를 넣는다.
uniform sampler2D pano_a : source_color, filter_linear, repeat_enable;
uniform sampler2D pano_b : source_color, filter_linear, repeat_enable;
uniform float pano_mix : hint_range(0.0, 1.0) = 0.0;
uniform float pano_on : hint_range(0.0, 1.0) = 0.0;

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

float fbm(vec2 p) {
	float v = 0.0;
	float a = 0.5;
	for (int i = 0; i < 5; i++) {
		v += vnoise(p) * a;
		p = p * 2.03 + vec2(17.0, 9.0);
		a *= 0.5;
	}
	return v;
}

void sky() {
	vec3 d = EYEDIR;
	if (pano_on > 0.5) {
		vec2 puv = vec2(fract(atan(d.x, -d.z) / 6.28318530718), acos(clamp(d.y, -1.0, 1.0)) / 3.14159265359);
		COLOR = mix(textureLod(pano_a, puv, 0.0).rgb, textureLod(pano_b, puv, 0.0).rgb, pano_mix);
	} else {
	float h = d.y;
	vec3 col;
	if (h >= 0.0) {
		col = mix(horizon_color, top_color, pow(smoothstep(0.0, 0.65, h), 0.8));
	} else {
		col = mix(horizon_color, ground_color, smoothstep(0.0, 0.12, -h));
	}

	if (LIGHT0_ENABLED) {
		float sd = dot(d, LIGHT0_DIRECTION);
		float disc = smoothstep(cos(sun_size * 1.2), cos(sun_size), sd);
		float halo = pow(max(sd, 0.0), 48.0) * 0.35 + pow(max(sd, 0.0), 6.0) * 0.06;
		col += LIGHT0_COLOR * LIGHT0_ENERGY * (disc * sun_strength + halo);
	}

	if (h > 0.0) {
		// 하늘 돔을 평면으로 펴서 구름을 깐다 — 지평선 쪽은 납작하게 모인다.
		vec2 uv = d.xz / (h + 0.15) * cloud_scale;
		float n = fbm(uv);
		float mask = smoothstep(cloud_coverage, cloud_coverage + 0.06, n);
		// 해 반대쪽 아래가 어두운 두 단 음영.
		float lit = smoothstep(cloud_coverage + 0.04, cloud_coverage + 0.2, fbm(uv + vec2(0.06, 0.04)));
		vec3 cc = mix(cloud_shade, cloud_color, lit);
		if (LIGHT0_ENABLED) {
			cc *= mix(vec3(1.0), LIGHT0_COLOR, 0.25);
		}
		float fade = smoothstep(0.0, 0.18, h);
		if (stars > 0.0) {
			vec2 sp = floor(d.xz / (h + 0.35) * 170.0);
			float star = step(0.9965, hash21(sp)) * (0.55 + 0.45 * hash21(sp + 7.0));
			col += vec3(0.9, 0.93, 1.0) * star * stars * smoothstep(0.04, 0.3, h) * (1.0 - mask);
		}
		col = mix(col, cc, mask * fade);
	}
	COLOR = col;
	}
}
