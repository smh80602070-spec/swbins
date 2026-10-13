shader_type spatial;
render_mode blend_mix, cull_back, diffuse_burley, specular_schlick_ggx;

// G-0221 1만리 마을 집(games/saga_go/world/house_builder.gd) 사실 재질 — 셀 정점색·검은 외곽선(cel_vertex_color + cel_outline)이 장난감 집으로 읽혔다.
// 부품 종류는 UV.x(house_builder 가 색 상수로 붙임: 0 기타 · 1 돌 · 2 회벽 · 3 나무 · 4 지붕)로 오고, 종류마다 자체 PBR 결(K-0093 tiles_real:
// stonewall · plaster · planks · rooftile)의 밝기 결·법선만 얹는다 — 빛깔은 늘 정점색(색 상수 그대로). 본보기 prop_real.gdshader(G-0144).
// 집은 축 정렬 상자 + X 축으로 기운 지붕판이라 면마다 한 번 투영(로컬 좌표 + 물체 원점 — 이웃 집 무늬가 엇갈리게). 지붕은 비탈 방향으로 펴서 기와 줄이 안 늘어난다.

uniform sampler2D stone_tex : source_color, filter_linear_mipmap, repeat_enable;
uniform sampler2D stone_n : hint_normal, filter_linear_mipmap, repeat_enable;
uniform sampler2D plaster_tex : source_color, filter_linear_mipmap, repeat_enable;
uniform sampler2D plaster_n : hint_normal, filter_linear_mipmap, repeat_enable;
uniform sampler2D wood_tex : source_color, filter_linear_mipmap, repeat_enable;
uniform sampler2D wood_n : hint_normal, filter_linear_mipmap, repeat_enable;
uniform sampler2D roof_tex : source_color, filter_linear_mipmap, repeat_enable;
uniform sampler2D roof_n : hint_normal, filter_linear_mipmap, repeat_enable;

// 종류별 반복(1/m)·결 세기·법선 세기·거칠기 — 0 기타 · 1 돌 · 2 회벽 · 3 나무 · 4 지붕
const float K_SCALE[5] = float[5](0.45, 0.55, 0.4, 0.9, 0.42);
const float K_DETAIL[5] = float[5](0.0, 0.9, 0.5, 0.7, 0.8);
const float K_NORMAL[5] = float[5](0.0, 1.0, 0.5, 0.7, 0.9);
const float K_ROUGH[5] = float[5](0.8, 0.9, 0.95, 0.75, 0.82);
const float K_SPEC[5] = float[5](0.5, 0.35, 0.3, 0.4, 0.25);   // 지붕 윤기가 멀리서 빛깔을 허옇게 바랬다(10-13 전후 촬영)

varying vec3 lpos;
varying vec3 lnrm;
varying vec3 opos;
varying float kind;

void vertex() {
	lpos = VERTEX;
	lnrm = NORMAL;
	opos = MODEL_MATRIX[3].xyz;
	kind = UV.x;
}

vec3 _pick(int k, vec2 uv) {
	if (k == 1) return texture(stone_tex, uv).rgb;
	if (k == 2) return texture(plaster_tex, uv).rgb;
	if (k == 3) return texture(wood_tex, uv).rgb;
	return texture(roof_tex, uv).rgb;
}

vec3 _pick_avg(int k) {
	if (k == 1) return textureLod(stone_tex, vec2(0.5), 10.0).rgb;
	if (k == 2) return textureLod(plaster_tex, vec2(0.5), 10.0).rgb;
	if (k == 3) return textureLod(wood_tex, vec2(0.5), 10.0).rgb;
	return textureLod(roof_tex, vec2(0.5), 10.0).rgb;
}

vec2 _pick_n(int k, vec2 uv) {
	vec3 t;
	if (k == 1) t = texture(stone_n, uv).rgb;
	else if (k == 2) t = texture(plaster_n, uv).rgb;
	else if (k == 3) t = texture(wood_n, uv).rgb;
	else t = texture(roof_n, uv).rgb;
	return t.xy * 2.0 - 1.0;
}

void fragment() {
	int k = clamp(int(kind + 0.5), 0, 4);
	vec3 col = COLOR.rgb;
	ROUGHNESS = K_ROUGH[k];
	SPECULAR = K_SPEC[k];
	vec3 an = abs(lnrm);
	vec3 ax;
	vec3 ua;
	vec3 va;
	if (k == 4) {
		// 지붕판: 용마루(X)를 따라 u, 비탈을 따라 v
		ua = vec3(1.0, 0.0, 0.0);
		va = normalize(cross(lnrm, ua));
		ax = normalize(lnrm);
	} else if (an.x > an.y && an.x > an.z) {
		ax = vec3(sign(lnrm.x), 0.0, 0.0); ua = vec3(0.0, 0.0, 1.0); va = vec3(0.0, 1.0, 0.0);
	} else if (an.y > an.z) {
		ax = vec3(0.0, sign(lnrm.y), 0.0); ua = vec3(1.0, 0.0, 0.0); va = vec3(0.0, 0.0, 1.0);
	} else {
		ax = vec3(0.0, 0.0, sign(lnrm.z)); ua = vec3(1.0, 0.0, 0.0); va = vec3(0.0, 1.0, 0.0);
	}
	vec3 nl = normalize(lnrm);
	if (k > 0) {
		vec3 p = lpos + opos;
		vec2 uv = vec2(dot(p, ua), dot(p, va)) * K_SCALE[k];
		vec3 t = _pick(k, uv);
		float lum = dot(t, vec3(0.299, 0.587, 0.114));
		float avg = max(dot(_pick_avg(k), vec3(0.299, 0.587, 0.114)), 0.05);
		col *= mix(1.0, lum / avg, K_DETAIL[k]);
		vec2 tn = _pick_n(k, uv) * K_NORMAL[k];
		nl = normalize(ax + ua * tn.x + va * tn.y);
		ROUGHNESS = clamp(K_ROUGH[k] + (avg - lum) * 0.25, 0.05, 1.0);
	}
	// 아래 때 — 받침·벽 아래쪽 0.9m 가 조금 어둡다(땅 습기)
	col *= mix(0.78, 1.0, smoothstep(0.0, 0.9, lpos.y));
	ALBEDO = clamp(col, vec3(0.0), vec3(1.0));
	// 옆면은 하늘을 반만 본다 — 주변광만(해 받는 면 그대로)
	AO = mix(0.66, 1.0, max(nl.y, 0.0));
	AO_LIGHT_AFFECT = 0.0;
	NORMAL = normalize((VIEW_MATRIX * vec4(MODEL_NORMAL_MATRIX * nl, 0.0)).xyz);
}
