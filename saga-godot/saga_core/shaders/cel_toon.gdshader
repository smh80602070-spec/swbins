shader_type spatial;
render_mode blend_mix, cull_back, diffuse_burley, specular_disabled;

// PLAN.md 66-2 — 카툰/셀셰이딩(원신류) 프로토타입 1호.
// 밴드형(quantized) 명암 2~3단 + rim light. godotshaders.com 계열
// 공개 예제(light() 커스텀 함수로 NdotL을 계단화하는 방식)를 참고해
// 직접 짰다 — 원신 실제 셰이더 코드나 데이터마이닝 자료는 쓰지 않았다
// (루트 CLAUDE.md 원작 에셋 금지 원칙).
//
// 대상: 텍스처가 있는 캐릭터/몬스터/NPC 메시(VRoid GLB 등). 아웃라인은
// 이 셰이더에 없다 — 66-2장 "적용 순서" 3번에서 성능 검토 후 별도로 붙인다.
//
// G-0145 — 툰은 그대로, 결만 섬세하게(텍스처 파일·해상도 그대로, 용량 0):
//   이방성 필터(비스듬한 옷·얼굴이 흐려지지 않게) · 띠 경계를 화면 픽셀 폭으로 매끈하게(계단·지글거림 없이)
//   · 살갗 그늘에 붉은 온기(skin_warm) · 머리 광택 띠를 결 노이즈로 끊어 가닥처럼 · 옷에 아주 옅은 천 결(cloth_grain, 멀면 0).

uniform sampler2D albedo_texture : source_color, filter_linear_mipmap_anisotropic;
uniform vec4 albedo_tint : source_color = vec4(1.0);
uniform int band_count : hint_range(2, 4) = 3;
uniform float band_softness : hint_range(0.0, 1.0) = 0.08;
uniform vec3 rim_color : source_color = vec3(1.0, 0.95, 0.85);
uniform float rim_power : hint_range(0.5, 8.0) = 4.5;
uniform float rim_strength : hint_range(0.0, 2.0) = 0.3;
// PLAN 102-3 — combat_feel.gd ③ 피격 플래시가 이 uniform으로 흰색을 섞는다
// (0=평소, 1=완전 흰색). saga_core/combat_feel.gd::_do_flash/_tick_flash 참고.
uniform float hit_flash : hint_range(0.0, 1.0) = 0.0;
// 2026-09-30 머리카락 윤기 띠(원신의 "천사의 고리") — 머리 재질만 세기를 올린다(cel_shader_apply._tune_outline).
// 화면 기준 위쪽을 보는 면(뷰 공간 법선 y)에 좁은 밝은 띠 하나. 머리 색을 밝게 한 톤으로 얹는다.
uniform float hair_gloss : hint_range(0.0, 1.0) = 0.0;
// G-0145 — 살갗(cel_shader_apply 가 skin* 재질에 1) · 옷 결(살갗·머리·눈은 0).
uniform float skin_warm : hint_range(0.0, 1.0) = 0.0;
uniform float cloth_grain : hint_range(0.0, 1.0) = 1.0;
// G-0248 — 얼굴 그림자(원신식). 얼굴 표면(face_light.gd 가 face_mode=1)은 제 법선 대신 머리 앞 방향(head_fwd, 월드)을 섞은
//   수평 법선으로 명암 — 코·입가·턱 밑 얼룩 그늘이 사라지고 경계는 머리 좌우(수평 각) 기준 세로 반쪽. 빛도 수평으로 눌러 잰다(해가 높아도 얼굴이 안 어두워짐).
//   head_fwd 는 몸마다 다르니 instance uniform(재질 수·draw call 그대로) — gl_compatibility 처럼 안 들어오면(0 벡터) 제 법선 + face_flatten 만큼 그늘 바닥을 올린다.
//   face_sdf(K 대기): 넣고 face_sdf_on=1 이면 원신 SDF 문턱(빛 수평 각 → 텍스처 값)으로 바꾼다. 텍스처는 빛이 캐릭터 오른쪽에서 올 때 기준, 반대면 UV 좌우 뒤집음(face_sdf_flip=-1 로 반대 규약).
uniform float face_mode = 0.0;
instance uniform vec3 head_fwd = vec3(0.0);
uniform float face_flatten : hint_range(0.0, 1.0) = 0.65;
uniform sampler2D face_sdf : hint_default_white, filter_linear;
uniform float face_sdf_on = 0.0;
uniform float face_sdf_flip = 1.0;

varying float v_strand;   // 머리 결(0~1) — fragment 에서 재고 light 에서 광택 띠를 끊는다
varying vec3 v_head_fwd;  // G-0248 — 머리 앞(뷰 공간, 얼굴 아니거나 모르면 0)
varying vec3 v_up;        // G-0248 — 월드 위(뷰 공간)
varying vec2 v_sdf;       // G-0248 — face_sdf 값(UV 그대로·좌우 뒤집음)

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
	v_head_fwd = vec3(0.0);
	if (face_mode > 0.5 && dot(head_fwd, head_fwd) > 0.01) {
		v_head_fwd = normalize((VIEW_MATRIX * vec4(head_fwd, 0.0)).xyz);
	}
	v_up = (VIEW_MATRIX * vec4(0.0, 1.0, 0.0, 0.0)).xyz;
}

void fragment() {
	vec4 tex = texture(albedo_texture, UV);
	vec3 col = tex.rgb * albedo_tint.rgb;
	// 옷 결 — 텍스처 좌표에 아주 잔 노이즈 두 겹(씨줄·날줄 느낌). 화면에서 한 텍셀이 1픽셀보다 작아지면(멀면) 잦아든다.
	float texel = length(fwidth(UV)) * 1024.0;
	float near = 1.0 - smoothstep(0.6, 1.6, texel);
	float grain = vnoise(UV * vec2(900.0, 260.0)) * 0.5 + vnoise(UV * vec2(260.0, 900.0)) * 0.5;
	col *= 1.0 + (grain - 0.5) * 0.09 * cloth_grain * near;
	ALBEDO = mix(col, vec3(1.0), hit_flash);
	ALPHA = tex.a * albedo_tint.a;
	// VRoid 얼굴처럼 겹친 알파컷아웃 레이어(눈썹·눈꺼풀선·홍채 등, 원래
	// BaseMaterial3D transparency ALPHA_SCISSOR/ALPHA_DEPTH_PRE_PASS)를
	// blend_mix 그대로 두면 반투명 정렬이 깨져 하얗게 날아가 보인다
	// (2026-09-19 VRoid 교체 중 실기로 발견). 컷아웃으로 강제해 깊이
	// 버퍼 기준으로 또렷하게 겹치게 한다.
	ALPHA_SCISSOR_THRESHOLD = 0.5;
	ROUGHNESS = 1.0;
	v_strand = vnoise(UV * vec2(180.0, 6.0)) * 0.6 + vnoise(UV * vec2(420.0, 9.0)) * 0.4;
	v_sdf = vec2(1.0);
	if (face_sdf_on > 0.5) {
		v_sdf = vec2(texture(face_sdf, UV).r, texture(face_sdf, vec2(1.0 - UV.x, UV.y)).r);
	}
}

// G-0248 — 얼굴 표면의 빛 세기(0~1). 얼굴 아니면 NORMAL·LIGHT 그대로.
float face_ndotl(vec3 n, vec3 l, vec3 head_v, vec3 up_v, vec2 sdf2) {
	float plain = clamp(dot(n, l), 0.0, 1.0);
	if (face_mode < 0.5) {
		return plain;
	}
	if (dot(head_v, head_v) < 0.25) {
		// 머리 방향 모름(instance uniform 안 들어옴) — 그늘 바닥만 올려 얼룩을 옅게.
		return mix(plain, max(plain, 0.7 * smoothstep(0.0, 0.15, plain)), face_flatten);
	}
	vec3 up = normalize(up_v);
	vec3 hf = normalize(head_v - up * dot(head_v, up));
	float lv = dot(l, up);
	vec3 lh = l - up * lv;
	float lhl = length(lh);
	if (lhl < 0.05) {
		return lv > 0.0 ? 1.0 : 0.0;   // 바로 위(아래)에서 오는 빛
	}
	lh /= lhl;
	float d;
	if (face_sdf_on > 0.5) {
		float side = dot(lh, cross(hf, up)) * face_sdf_flip;
		float sdf = side >= 0.0 ? sdf2.x : sdf2.y;
		float thr = 0.5 - 0.5 * dot(hf, lh);   // 정면 0 · 옆 0.5 · 뒤 1
		d = smoothstep(thr - 0.02, thr + 0.02, sdf);
	} else {
		vec3 nh = n - up * dot(n, up);
		vec3 fn = normalize(mix(nh, hf, face_flatten) + hf * 1e-3);
		d = clamp(dot(fn, lh), 0.0, 1.0);
	}
	// 해가 높을수록 얼굴 전체가 고르게 밝게(수평으로 눌러 잰 몫을 줄임).
	return mix(d, 1.0, smoothstep(0.8, 0.98, lv));
}

void light() {
	float ndotl = face_ndotl(NORMAL, LIGHT, v_head_fwd, v_up, v_sdf);
	float band_step = 1.0 / float(band_count);
	float banded = floor(ndotl / band_step) * band_step;
	// G-0145 — 경계 폭을 화면 픽셀 기준 최소 1.5픽셀로(가까이선 또렷, 멀어도 계단·지글거림 없이).
	float soft = max(band_softness * band_step, fwidth(ndotl) * 1.5);
	float t = smoothstep(banded, banded + soft, ndotl);
	float lit = clamp(mix(banded, banded + band_step, t), 0.0, 1.0);

	float rim = pow(1.0 - clamp(dot(NORMAL, VIEW), 0.0, 1.0), rim_power) * rim_strength;
	rim *= smoothstep(0.0, 0.3, ndotl);

	vec3 direct = ALBEDO * LIGHT_COLOR * ATTENUATION * lit;
	// G-0145 — 살갗 그늘의 붉은 온기(살 속에 번진 빛 흉내). 밝은 쪽은 그대로, 그늘일수록.
	direct += ALBEDO * vec3(0.16, 0.05, 0.03) * skin_warm * (1.0 - lit) * LIGHT_COLOR * ATTENUATION;
	vec3 rim_light = rim_color * rim * LIGHT_COLOR * ATTENUATION;
	float ring = smoothstep(0.18, 0.23, NORMAL.y) * (1.0 - smoothstep(0.42, 0.47, NORMAL.y)) * hair_gloss;
	ring *= mix(1.0, smoothstep(0.3, 0.75, v_strand), hair_gloss * 0.7);   // G-0145 — 띠를 머리 결로 끊어 가닥처럼
	vec3 gloss = mix(ALBEDO, vec3(1.0), 0.55) * ring * 1.2 * LIGHT_COLOR * ATTENUATION * smoothstep(-0.2, 0.15, ndotl);
	DIFFUSE_LIGHT += clamp(direct + rim_light + gloss, vec3(0.0), vec3(1.0));
}
