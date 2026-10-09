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
uniform vec3 dry_tint = vec3(1.18, 1.03, 0.62); // G-0137 풀빛 큰 얼룩(누렇게 바랜 풀) — 정점색에 곱한다
// 2026-09-30 — 풀 텍스처의 초록기를 얼마나 뺄지(0 = 그대로). 가을빛 지역(정점색이 누런 땅)만 올린다.
uniform float hue_desat : hint_range(0.0, 1.0) = 0.0;
uniform vec3 cliff_color = vec3(0.62, 0.53, 0.42); // 가파른 비탈 빛깔(terrain_builder.gd CLIFF_COLOR)

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

// 2026-09-29 — 절벽 큰 바위 판. 셀 노이즈(가까운 점 F1·둘째 F2·셀 해시)로 가로 4m·세로 7m 남짓한 판을 나눈다.
vec3 _voronoi(vec2 p) {
	vec2 i = floor(p);
	vec2 f = fract(p);
	float d1 = 8.0;
	float d2 = 8.0;
	float id = 0.0;
	for (int y = -1; y <= 1; y++) {
		for (int x = -1; x <= 1; x++) {
			vec2 g = vec2(float(x), float(y));
			vec2 o = vec2(_hash(i + g), _hash(i + g + vec2(17.3, 9.1)));
			vec2 r = g + o * 0.85 - f;
			float d = dot(r, r);
			if (d < d1) {
				d2 = d1;
				d1 = d;
				id = _hash(i + g + vec2(3.7, 1.3));
			} else if (d < d2) {
				d2 = d;
			}
		}
	}
	return vec3(sqrt(d1), sqrt(d2), id);
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
	// G-0134 — 경계 폭 0.2(0.55~0.75)는 얼룩 대부분이 풀·흙 반반이라 흐린 진흙 자국이었다. 좁은 경계 + n2 로 가장자리 흔들기 = 또렷한 흙자리.
	// G-0137 — 흙 얼룩(상한 0.5)은 풀·흙 반반이라 올리브 진흙, 확실한 흙(0.85)으로 하면 맨흙 밭이었다 → 흙은 아주 옅게만,
	// 들판 변화는 같은 큰 노이즈로 풀빛을 누렇게 흔드는 쪽(원신식 들판 — 맨흙은 길·마당에만).
	float dirt_w = smoothstep(0.72, 0.8, n1 + (n2 - 0.5) * 0.14) * 0.18;
	float dry_w = smoothstep(0.45, 0.8, n1 + (n2 - 0.5) * 0.1) * 0.55;
	// 2026-09-28 — 평지의 돌 얼룩은 0.5 → 0.15: 풀밭 위 잿빛 얼룩이 멀리서 안개 덩어리처럼 보였다(창 모드 촬영). 경사 돌은 아래서 그대로.
	float stone_w = smoothstep(0.6, 0.8, n2) * 0.15;
	// 2026-09-23 GO 절벽·봉우리(terrain_builder.gd) — 경사가 급할수록 돌.
	// 평지(법선 y=1)는 slope 0 이라 예전 화면 그대로다.
	float slope = 1.0 - clamp(normalize(world_normal).y, 0.0, 1.0);
	stone_w = max(stone_w, smoothstep(0.25, 0.6, slope));
	dirt_w *= 1.0 - smoothstep(0.25, 0.6, slope);
	float grass_w = max(0.05, 1.0 - dirt_w - stone_w);
	// G-0143 — 높이 기반 섞기: 텍스처 밝기를 높이로 보고(돌·흙 알갱이 윗면이 밝다) 섞는 경계에서 높은 쪽이 이긴다 —
	// 부드러운 번짐 대신 돌 틈에 풀·흙이 차는 실제 경계. 한 종류만 있는 곳(평지 풀밭)은 그대로.
	float hg = dot(grass_a, vec3(0.333)) + grass_w;
	float hd = dot(dirt_a, vec3(0.333)) + dirt_w;
	float hs = dot(stone_a, vec3(0.333)) * 1.2 + stone_w;
	float hmax = max(hg, max(hd, hs)) - 0.18;
	grass_w = max(hg - hmax, 0.0) * step(0.001, grass_w) + 0.0001;
	dirt_w = max(hd - hmax, 0.0) * step(0.001, dirt_w);
	stone_w = max(hs - hmax, 0.0) * step(0.001, stone_w);
	float wsum = grass_w + dirt_w + stone_w;
	// G-0143 — 반복 감추기: 풀 텍스처를 넉 배 크게 한 번 더(돌려서) 읽어 멀어질수록 섞는다(한 장 2.5m 반복 무늬가 멀리서 격자로 보였다).
	float cam_dist = length(world_pos - CAMERA_POSITION_WORLD);
	float far_mix = smoothstep(12.0, 60.0, cam_dist) * 0.55;
	vec2 rp = mat2(vec2(0.8, -0.6), vec2(0.6, 0.8)) * world_pos.xz * tile_scale * 0.23;
	grass_a = mix(grass_a, texture(grass_albedo, rp).rgb, far_mix);

	vec3 detail_albedo = (grass_a * grass_w + dirt_a * dirt_w + stone_a * stone_w) / wsum;
	detail_albedo = mix(detail_albedo, vec3(dot(detail_albedo, vec3(0.3, 0.59, 0.11)) * 1.55), hue_desat * (1.0 - stone_w) * (1.0 - smoothstep(4.0, 8.0, world_pos.y)));
	vec3 detail_normal = normalize(grass_n * grass_w + dirt_n * dirt_w + stone_n * stone_w);
	float detail_rough = (grass_r * grass_w + dirt_r * dirt_w + stone_r * stone_w) / wsum;

	// 2026-09-30 — 봉우리 굴곡(칸 윗면)의 가파른 비탈은 아래 절벽 무늬(판·틈)는 받는데 빛깔은 산 윗면 풀빛 정점색 그대로라,
	// 절벽 사이사이 연두빛 반투명 조각으로 보였다(창 모드 s_port). 가파를수록 절벽 빛깔(terrain_builder CLIFF_COLOR 와 같은 값)로.
	float steep = smoothstep(0.45, 0.8, slope);
	vec3 base_col = mix(COLOR.rgb, COLOR.rgb * dry_tint, dry_w);
	ALBEDO = mix(base_col, cliff_color, steep) * detail_albedo;
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
	// 2026-09-29 — 먼 절벽이 여전히 한 빛 잿빛 판이었다(돌 텍스처가 밉맵으로 뭉개진다, 창 모드 v_cliff_*).
	// 큰 바위 판(판마다 밝기·온도 조금씩) + 판 사이 어두운 틈(멀수록 굵게 — 80m 에서도 두어 픽셀) + 판마다 기운 면(빛을 달리 받아 각져 보인다).
	if (cliff > 0.01) {
		vec3 cn = normalize(world_normal);
		vec2 fp = abs(cn.x) > abs(cn.z) ? world_pos.zy : world_pos.xy;
		// 경계를 굽이치게 비틀고(돌담처럼 고른 판이 되지 않게) 세로로 긴 판(가로 7m·세로 13m 남짓).
		vec2 warp = vec2(_value_noise(fp * 0.09), _value_noise(fp * 0.09 + vec2(7.1, 3.3))) - 0.5;
		vec3 vc = _voronoi((fp + warp * 9.0) * vec2(0.14, 0.075));
		float cam_d = length(world_pos - CAMERA_POSITION_WORLD);
		float cw = 0.025 + cam_d * 0.0006;
		float crack = 1.0 - smoothstep(cw, cw * 2.2, vc.y - vc.x);
		// 틈은 절반쯤만 — 나머지 경계는 면 기울기 차이로만 갈린다.
		crack *= smoothstep(0.35, 0.65, _value_noise(fp * 0.18 + vec2(vc.z * 5.0, 0.0)));
		float slab = mix(0.72, 1.12, vc.z);
		vec3 slab_tint = mix(vec3(1.06, 0.97, 0.86), vec3(0.9, 0.95, 1.02), fract(vc.z * 7.3));
		ALBEDO = mix(ALBEDO, ALBEDO * 0.88 * slab * slab_tint * (1.0 - crack * 0.65), cliff);
		vec3 tilt = vec3(fract(vc.z * 13.1) - 0.5, fract(vc.z * 5.7) * 0.8 - 0.25, fract(vc.z * 29.3) - 0.5) * 1.2;
		NORMAL = normalize(NORMAL + (VIEW_MATRIX * vec4(tilt, 0.0)).xyz * cliff);
	}
	// 이끼 — 절벽의 각진 면 중 조금이라도 위를 보는 턱(법선 y 0.08~0.3)과 큰 얼룩이 겹치는 곳에 풀빛이 앉는다(원신 절벽의 이끼 턱).
	// 2026-09-30 — 면 법선(각진 절벽은 삼각형마다 한 값)으로 거르니 위를 보는 큰 삼각형이 통째로 연두가 돼, 돌 틈이 비치는 반투명 쐐기로 보였다(창 모드 s_port).
	// 법선은 옅게만 기울이고(면 경계에서 끊기지 않게) 세로로 흘러내린 얼룩 노이즈로 모양을 낸다.
	float ny = normalize(world_normal).y;
	vec2 mp = vec2(world_pos.x + world_pos.z, world_pos.y * 0.35);
	float mpatch = _value_noise(mp * 0.11) * 0.65 + _value_noise(mp * 0.37 + vec2(3.7, 1.9)) * 0.35;
	// 2026-09-30 — 수직 벽 전체에 세로로 긴 연둣빛 띠가 흘렀다(창 모드 u_cliff_n). 이끼는 위를 보는 턱에만 짙게, 벽면엔 아주 옅게.
	float ledge = smoothstep(0.04, 0.2, ny) * (1.0 - smoothstep(0.4, 0.65, ny));
	float moss = cliff * smoothstep(0.55, 0.72, mpatch + ny * 0.12) * mix(0.1, 1.0, ledge);
	ALBEDO = mix(ALBEDO, vec3(0.16, 0.27, 0.1) * (0.85 + 0.3 * n1), moss * 0.6);
	// G-0143 — 멀수록 법선 결을 줄인다(밉맵으로 뭉개진 법선이 멀리서 반짝이는 잡음이 됐다).
	NORMAL_MAP = mix(vec3(0.0, 0.0, 1.0), detail_normal, 1.0 - smoothstep(25.0, 90.0, cam_dist) * 0.7) * 0.5 + 0.5;
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
	// 2026-09-30 — 모래밭이 넓은 한 빛 판이었다(창 모드 u_palace·c_sea). 물기 밴 어두운 큰 얼룩(굽이치는 띠)과 잔자갈 점을 얹는다.
	float damp = smoothstep(0.42, 0.7, _value_noise(world_pos.xz * 0.045 + vec2(21.0, 4.0)) * 0.7 + _value_noise(world_pos.xz * 0.16) * 0.3);
	sand *= mix(1.0, 0.74, damp);
	vec2 pc = world_pos.xz * 4.0;
	float pebble = step(0.93, _hash(floor(pc) + 7.0)) * (1.0 - smoothstep(0.12, 0.2, length(fract(pc) - 0.5)));
	sand = mix(sand, sand * vec3(0.55, 0.52, 0.5), pebble * 0.7);
	ALBEDO = mix(ALBEDO, sand, sand_w);
	ROUGHNESS = mix(ROUGHNESS, 0.9, sand_w);
	// saga-godot PLAN 106장 ㊺ 서리봉 고원 — 눈 표시(눈밭·눈 덮인 산)는 풀 텍스처 대신 눈으로,
	// 얼음 표시(얼어붙은 호수)는 매끈한 얼음으로. 표시는 정점색이 아니라 CUSTOM0 로 따로 온다(가장자리 섞임에 안 흔들린다).
	// 다른 지역·판은 표시가 0 이라 화면이 그대로다. 가파른 비탈은 돌을 남긴다.
	float snow_w = smoothstep(0.25, 0.75, v_surf.x) * (1.0 - smoothstep(0.35, 0.7, slope));
	// 눈은 정점색보다 한 단 희게(길·숲 바닥 색이 비치되 눈빛이 이기게) — AgX 톤매핑에서 0.86 은 회색으로 가라앉았다.
	// 09-28 GO 가 ACES·밝은 해로 바뀐 뒤 0.95 눈은 하얗게 포화돼 결이 사라졌다(창 모드 촬영) — 한 단 낮추고 얼룩을 키운다.
	// 2026-10-09 G-0128 — 해 드는 눈밭이 한 빛(243)이라 결이 안 보였다 — 얼룩·물결 폭을 키운다(밝은 곳은 그대로 희게).
	vec3 snow = mix(COLOR.rgb * 0.62, vec3(0.52, 0.57, 0.64), 0.5) * (0.7 + 0.3 * n2) * mix(vec3(1.0), stone_a * 1.6, 0.12) * 0.74;   // × 0.85 → 0.74(G-0147 사실적 하늘 뒤 다시 꽉 참) — 해 든 눈이 255 로 꽉 차 결이 묻혔다
	// 2026-09-30 — 눈밭이 넓은 한 빛 흰 판이었다(창 모드 f_fort). 바람이 쓸어 만든 눈 물결(굽이치는 결)과 그늘진 골의 푸른 기, 햇빛에 반짝이는 점.
	float drift = sin(dot(world_pos.xz, vec2(0.6, 0.8)) * 0.85 + _value_noise(world_pos.xz * 0.09) * 8.0) * 0.5 + 0.5;
	float drift2 = sin(dot(world_pos.xz, vec2(-0.8, 0.6)) * 2.1 + _value_noise(world_pos.xz * 0.3) * 5.0) * 0.5 + 0.5;
	snow *= mix(vec3(0.72, 0.8, 0.96), vec3(1.0), smoothstep(0.25, 0.7, drift)) * mix(0.9, 1.03, drift2);
	vec2 gl = world_pos.xz * 3.0;
	float glint = step(0.985, _hash(floor(gl))) * (1.0 - smoothstep(0.1, 0.22, length(fract(gl) - 0.5)));
	ALBEDO = mix(ALBEDO, snow, snow_w);
	EMISSION += vec3(0.9, 0.95, 1.0) * glint * snow_w * 0.7;
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
