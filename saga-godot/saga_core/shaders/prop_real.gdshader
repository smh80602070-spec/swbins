shader_type spatial;
render_mode blend_mix, cull_back, diffuse_burley, specular_schlick_ggx;

// saga-godot 2026-10-09 G-0144 "배경 전부 사실·인물 툰" — 이야기 지역 건물·소품 상자(prop_material.gd)가 prop_toon(돌 결 한 장·검은 모서리 선·띠 명암·림)이라 툰 상자로 읽혔다.
// 사실 쪽: 재질 종류(material_kind, prop_material 이 tint 색으로 고름)마다 결·거칠기·금속·법선 세기를 달리하고, 엔진 PBR 조명(띠 명암·림·검은 선 없음).
// 상자 면은 로컬 축에 붙어 있으니 면마다 한 번만 투영(삼축 섞기 없음 — 바탕 1장·법선 1장). 위치 = 로컬 + 물체 원점(이웃 상자 무늬가 엇갈리게).
// 아래쪽 습기·때, 위에서 흘러내린 빗물 자국, 모서리 닳음(밝게·칠은 벗겨져 회색) + 모서리 둥근 빛(법선 꺾기).
// 사진 PBR 세트(자체툴 K, tiles_real/)가 오기 전엔 tiles/stone_512 바탕·법선을 모든 재질이 쓰고 나무 결은 셰이더가 만든다.

uniform vec4 tint : source_color = vec4(0.6, 0.6, 0.6, 1.0);
uniform int material_kind = 0; // 0 돌 · 1 나무 · 2 회벽 · 3 칠한 판 · 4 쇠 (prop_material.gd 의 표와 같은 순서)
uniform sampler2D detail_tex : source_color, filter_linear_mipmap, repeat_enable;
uniform sampler2D detail_normal : hint_normal, filter_linear_mipmap, repeat_enable;
uniform float detail_scale = 0.45;
uniform float edge_width = 0.06;
instance uniform vec3 box_half = vec3(0.0);

const float K_DETAIL[5] = float[5](0.85, 0.18, 0.5, 0.12, 0.1);   // 바탕 결 세기
const float K_NORMAL[5] = float[5](1.0, 0.35, 0.45, 0.2, 0.15);   // 법선 세기
const float K_ROUGH[5] = float[5](0.9, 0.72, 0.95, 0.55, 0.5);
const float K_METAL[5] = float[5](0.0, 0.0, 0.0, 0.0, 0.4);
const float K_WEAR[5] = float[5](1.1, 1.12, 1.06, 1.0, 1.25);     // 모서리 닳음 밝기(칠한 판은 아래에서 회색으로 벗김)

varying vec3 lpos;
varying vec3 lnrm;
varying vec3 opos;

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
	lpos = VERTEX;
	lnrm = NORMAL;
	opos = MODEL_MATRIX[3].xyz;
}

void fragment() {
	int k = clamp(material_kind, 0, 4);
	vec3 an = abs(lnrm);
	// 면의 두 축(u, v)과 바깥 방향(ax) — 상자라 한 축만 크다
	vec3 ax;
	vec3 ua;
	vec3 va;
	if (an.x > an.y && an.x > an.z) {
		ax = vec3(sign(lnrm.x), 0.0, 0.0); ua = vec3(0.0, 0.0, 1.0); va = vec3(0.0, 1.0, 0.0);
	} else if (an.y > an.z) {
		ax = vec3(0.0, sign(lnrm.y), 0.0); ua = vec3(1.0, 0.0, 0.0); va = vec3(0.0, 0.0, 1.0);
	} else {
		ax = vec3(0.0, 0.0, sign(lnrm.z)); ua = vec3(1.0, 0.0, 0.0); va = vec3(0.0, 1.0, 0.0);
	}
	vec3 p = lpos + opos;
	vec2 uv = vec2(dot(p, ua), dot(p, va)) * detail_scale;

	vec3 t = texture(detail_tex, uv).rgb;
	float lum = dot(t, vec3(0.299, 0.587, 0.114));
	float avg = dot(textureLod(detail_tex, vec2(0.5), 10.0).rgb, vec3(0.299, 0.587, 0.114));
	float detail = mix(1.0, lum / max(avg, 0.05), K_DETAIL[k]);
	vec2 tn = (texture(detail_normal, uv).xy * 2.0 - 1.0) * K_NORMAL[k];

	// 나무: 상자의 긴 축을 따라 결·널 이음(가로 0.28m)
	if (k == 1) {
		vec3 bh = max(box_half, vec3(0.01));
		vec3 along = (bh.y >= bh.x && bh.y >= bh.z) ? vec3(0.0, 1.0, 0.0) : (bh.x >= bh.z ? vec3(1.0, 0.0, 0.0) : vec3(0.0, 0.0, 1.0));
		if (abs(dot(along, ax)) > 0.5) along = ua; // 마구리 면
		vec3 across = normalize(cross(ax, along));
		float a = dot(p, along);
		float c = dot(p, across);
		float grain = _noise(vec2(c * 26.0, a * 0.9)) * 0.6 + _noise(vec2(c * 70.0, a * 2.5)) * 0.4;
		float plank = fract(c / 0.28);
		float seam = 1.0 - smoothstep(0.0, 0.035, min(plank, 1.0 - plank));
		float tone = 0.9 + 0.2 * _hash(vec2(floor(c / 0.28), 3.7));
		detail *= (0.82 + 0.3 * grain) * tone * (1.0 - seam * 0.45);
		tn += vec2(dot(across, ua), dot(across, va)) * (grain - 0.5) * 0.25;
	}

	// 큰 얼룩(멀리서 한 빛깔로 안 보이게)
	float blotch = 0.88 + 0.24 * _noise(p.xz * 0.21 + p.y * 0.13);

	float edge = 0.0;
	float grime = 1.0;
	vec3 bend = vec3(0.0);
	if (box_half.x > 0.0) {
		vec3 d = box_half - abs(lpos);
		float du = dot(d, ua);
		float dv = dot(d, va);
		float e = min(du, dv);
		edge = 1.0 - smoothstep(edge_width * 0.3, edge_width, e);
		// 모서리 둥근 빛: 가까운 모서리 쪽으로 법선을 조금 꺾는다
		bend = ua * sign(dot(lpos, ua)) * (1.0 - smoothstep(0.0, edge_width, du))
			+ va * sign(dot(lpos, va)) * (1.0 - smoothstep(0.0, edge_width, dv));
		// 아래쪽 습기·때(바닥에서 0.9m)
		float h = lpos.y + box_half.y;
		grime = mix(0.68, 1.0, smoothstep(0.0, min(0.9, box_half.y * 1.2), h));
		// 빗물 자국: 옆면만, 위에서 내려오며 옅어짐
		float side = 1.0 - an.y;
		float streak = smoothstep(0.55, 0.85, _noise(vec2(dot(p, ua) * 2.3, p.y * 0.12)));
		float from_top = smoothstep(box_half.y * 2.0, 0.0, box_half.y - lpos.y);
		grime *= 1.0 - 0.14 * streak * side * from_top;
		// 윗면은 먼지로 조금 밝고 거칠게
		grime *= mix(1.0, 1.05, smoothstep(0.5, 0.9, lnrm.y));
	}
	vec3 col = tint.rgb * detail * blotch;
	if (k == 3) {
		col = mix(col, vec3(0.5, 0.48, 0.45) * detail, edge * 0.55); // 칠 벗겨짐
	} else {
		col *= mix(1.0, K_WEAR[k], edge);
	}
	ALBEDO = clamp(col * grime, vec3(0.0), vec3(1.0));
	METALLIC = K_METAL[k] * (1.0 - edge * 0.3);
	ROUGHNESS = clamp(K_ROUGH[k] + (1.0 - grime) * 0.3 - edge * 0.12 + (lum - avg) * 0.2, 0.05, 1.0);

	// 하늘 가림: 옆면은 하늘을 반만 보고 아래로 갈수록 더 가린다 — 주변광에만(해 받는 면은 그대로) → 해 쪽·그늘 쪽 면 대비
	AO = clamp(mix(0.62, 1.0, max(lnrm.y, 0.0)) * mix(0.8, 1.0, grime), 0.0, 1.0);
	AO_LIGHT_AFFECT = 0.0;

	vec3 nl = normalize(ax + ua * tn.x + va * tn.y + bend * 0.55);
	NORMAL = normalize((VIEW_MATRIX * vec4(MODEL_NORMAL_MATRIX * nl, 0.0)).xyz);
}
