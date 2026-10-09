shader_type sky;
render_mode use_debanding;

// G-0141 — 사실적 하늘(사용자 10-09 "하늘도 사실처럼"). sky_toon 을 갈음한다(GO 만, environment_profile.gd).
// 산란 근사: 천정 짙은 파랑 → 지평선 희뿌연 밝음(레일리) + 해 둘레 빛무리(미) + 노을이면 해 쪽 지평선이 주황·자주로.
// 구름: 영역을 비튼 FBM 뭉게구름, 해 쪽으로 몇 걸음 밀어 본 밀도 차로 밝은 윗면·어두운 밑면·해 쪽 은빛 테두리.
// TIME 을 쓰지 않는다(쓰면 반사 맵을 매 프레임 굽는다) — 구름 흐름(cloud_offset)·노을(warm)·덮개(cloud_cover)는
// games/saga_go/world/sky_panorama.gd 가 CHECK_SEC 마다 넣고, Sky 는 INCREMENTAL 로 여러 프레임에 나눠 굽는다.
// 밤은 night_visual.gd 가 top/horizon/cloud 색·stars 를 섞는다(이름 그대로). 파노라마(pano_*)는 손잡이로 남김.

uniform vec3 top_color : source_color = vec3(0.13, 0.33, 0.76);
uniform vec3 horizon_color : source_color = vec3(0.72, 0.81, 0.92);
uniform vec3 ground_color : source_color = vec3(0.36, 0.40, 0.42);
uniform vec3 cloud_color : source_color = vec3(1.0, 0.99, 0.97);
uniform vec3 cloud_shade : source_color = vec3(0.55, 0.60, 0.70);
uniform float cloud_cover : hint_range(0.0, 1.0) = 0.45;
uniform vec2 cloud_offset = vec2(0.0);
uniform float cloud_scale = 0.9;
uniform float warm : hint_range(0.0, 1.0) = 0.0;     // 새벽·노을(sky_panorama 시간 칸)
uniform float sun_size = 0.026;
uniform float sun_strength = 6.0;
uniform float stars : hint_range(0.0, 1.0) = 0.0;
uniform sampler2D pano_a : source_color, filter_linear, repeat_enable;
uniform sampler2D pano_b : source_color, filter_linear, repeat_enable;
uniform float pano_mix : hint_range(0.0, 1.0) = 0.0;
uniform float pano_on : hint_range(0.0, 1.0) = 0.0;

// 셰이더에 적은 색 상수는 선형값이다 — uniform(source_color)과 같은 sRGB 로 적고 이걸로 바꾼다.
vec3 srgb(vec3 c) {
	return pow(c, vec3(2.2));
}

float hash21(vec2 p) {
	return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float vnoise(vec2 p) {
	vec2 i = floor(p);
	vec2 f = fract(p);
	vec2 u = f * f * (3.0 - 2.0 * f);
	return mix(mix(hash21(i), hash21(i + vec2(1.0, 0.0)), u.x), mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), u.x), u.y);
}

float fbm(vec2 p) {
	float v = 0.0;
	float a = 0.5;
	for (int i = 0; i < 6; i++) {
		v += vnoise(p) * a;
		p = p * 2.02 + vec2(17.0, 9.0);
		a *= 0.5;
	}
	return v;
}

// 구름 밀도(0~1) — 영역 비틀기로 뭉게구름 덩어리, 덮개만큼 문턱.
float cloud_density(vec2 uv) {
	vec2 w = vec2(fbm(uv * 0.5 + vec2(3.1, 7.7)), fbm(uv * 0.5 + vec2(9.2, 1.3)));
	float n = fbm(uv + (w - 0.5) * 1.6);
	float th = mix(0.72, 0.38, cloud_cover);
	return smoothstep(th, th + 0.22, n);
}

void sky() {
	vec3 d = EYEDIR;
	if (pano_on > 0.5) {
		vec2 puv = vec2(fract(atan(d.x, -d.z) / 6.28318530718), acos(clamp(d.y, -1.0, 1.0)) / 3.14159265359);
		COLOR = mix(textureLod(pano_a, puv, 0.0).rgb, textureLod(pano_b, puv, 0.0).rgb, pano_mix);
	} else {
		float h = d.y;
		vec3 sun_dir = LIGHT0_ENABLED ? LIGHT0_DIRECTION : normalize(vec3(0.3, 0.6, -0.5));
		vec3 sun_col = LIGHT0_ENABLED ? LIGHT0_COLOR : vec3(1.0);
		float sd = dot(d, sun_dir);
		// 해 쪽 방위로 얼마나 향했나(노을빛은 해 쪽 지평선에 몰린다).
		float toward = max(dot(normalize(vec2(d.x, d.z) + 1e-4), normalize(vec2(sun_dir.x, sun_dir.z) + 1e-4)), 0.0);

		vec3 col;
		if (h >= 0.0) {
			// 레일리 근사 — 지평선으로 갈수록 공기층이 두꺼워 희뿌옇게(지수 감쇠 곡선).
			float t = 1.0 - exp(-h * 4.2);
			vec3 zen = mix(top_color, srgb(vec3(0.16, 0.22, 0.46)), warm * 0.8);   // 노을이면 천정이 짙은 보랏빛 남색
			vec3 hor = mix(horizon_color, srgb(vec3(0.92, 0.66, 0.52)), warm * 0.7);   // 지평선 전체가 따뜻하게
			vec3 glow = mix(srgb(vec3(1.0, 0.58, 0.30)), srgb(vec3(0.95, 0.42, 0.48)), smoothstep(0.0, 0.25, h));
			hor = mix(hor, glow, warm * (0.2 + 0.8 * pow(toward, 1.5)));
			t = mix(t, pow(t, 0.6), warm);   // 노을빛이 지평선에서 더 높이 번진다
			col = mix(hor, zen, t);
		} else {
			col = mix(horizon_color, ground_color, smoothstep(0.0, 0.1, -h));
		}
		// 미 산란 — 해 둘레 빛무리(넓은 것·좁은 것), 해 원반.
		float sdp = max(sd, 0.0);
		col += sun_col * (pow(sdp, 8.0) * 0.12 + pow(sdp, 64.0) * 0.35) * mix(1.0, 1.8, warm) * (1.0 - stars * 0.8);
		float disc = smoothstep(cos(sun_size * 1.15), cos(sun_size), sd);
		col += sun_col * disc * sun_strength * (1.0 - stars);

		if (h > 0.0) {
			if (stars > 0.0) {
				vec2 sp = floor(d.xz / (h + 0.35) * 170.0);
				float star = step(0.9965, hash21(sp)) * (0.55 + 0.45 * hash21(sp + 7.0));
				col += vec3(0.9, 0.93, 1.0) * star * stars * smoothstep(0.04, 0.3, h);
			}
			// 구름 — 하늘 돔을 높이 h 로 나눠 평면에 펴고(지평선 쪽 납작), 흐름 offset.
			vec2 uv = d.xz / (h + 0.12) * cloud_scale + cloud_offset;
			float den = cloud_density(uv);
			if (den > 0.001) {
				vec2 sstep = normalize(sun_dir.xz + 1e-4) * 0.09;
				float toward_sun = cloud_density(uv + sstep) * 0.6 + cloud_density(uv + sstep * 2.5) * 0.4;
				float lit = clamp(1.0 - toward_sun * 0.85, 0.0, 1.0);   // 해 쪽에 구름이 더 있으면 그늘
				vec3 cc = mix(cloud_shade, cloud_color, lit);
				cc *= mix(vec3(1.0), sun_col, 0.35);
				vec3 dusk_lit = srgb(vec3(1.0, 0.62, 0.42)) * (0.75 + 0.45 * toward);
				vec3 dusk_shade = srgb(vec3(0.42, 0.36, 0.50));
				cc = mix(cc, mix(dusk_shade, dusk_lit, lit), warm * 0.85);   // 노을 구름 — 밝은 쪽 주황·분홍, 밑은 보랏빛 잿빛
				float rim = pow(sdp, 12.0) * (1.0 - den) * 1.4;   // 해 쪽 얇은 가장자리 은빛
				cc += sun_col * rim * (1.0 - stars);
				// 멀수록(지평선) 하늘빛에 묻힌다.
				float haze = smoothstep(0.0, 0.22, h);
				col = mix(col, cc, den * haze * 0.96);
			}
		}
		COLOR = col * mix(1.0, 0.82, warm);
	}
}
