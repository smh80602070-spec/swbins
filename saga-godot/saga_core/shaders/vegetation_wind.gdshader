shader_type spatial;
render_mode cull_disabled;

// PLAN.md 102-5 — 나무 원본 StandardMaterial3D(알베도 텍스처+알파 시저+
// 러프니스/스페큘러)를 그대로 흉내 내면서 wind_sway.gdshaderinc 만 얹는다.
// 값은 하드코딩하지 않고 vegetation_builder.gd 가 원본 머티리얼에서 읽어
// 그대로 이 uniform 에 옮겨 담는다(에셋이 바뀌어도 따로 안 맞춰도 된다).
#include "res://saga_core/shaders/wind_sway.gdshaderinc"

uniform sampler2D albedo_texture : source_color;
uniform float alpha_scissor_threshold : hint_range(0.0, 1.0) = 0.0;
uniform float roughness_value : hint_range(0.0, 1.0) = 1.0;
uniform float specular_value : hint_range(0.0, 1.0) = 0.5;
// saga-godot 106장 ㊻-4 눈 전용 나무 — 위를 보는 잎·가지에 눈이 얹힌다(0 이면 예전 그대로).
// 잎 색도 snow_amount 만큼 서늘하게 가라앉힌다(고원 침엽수가 마을 잎빛 그대로면 눈밭에서 뜬다).
uniform float snow_amount : hint_range(0.0, 1.0) = 0.0;
// G-0160 — 카메라에서 이만큼 안에 들어온 조각은 화면 위치 점묘로 비운다(가까울수록 더). 나무가 MultiMesh 칸이라
// 한 그루만 숨길 수 없어서 — 대화 구도·숲 속 시점에서 수관이 화면 ¼ 을 진초록으로 덮던 것. 그림자 패스는 빛 시점 거리라 그대로.
uniform float near_fade_m = 4.0;
varying vec3 v_world_normal;

void vertex() {
	v_world_normal = (MODEL_MATRIX * vec4(NORMAL, 0.0)).xyz;
	vec3 world_pos = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
	apply_wind_sway(VERTEX, world_pos, UV);
}

void fragment() {
	float cam_d = length(VERTEX);
	if (cam_d < near_fade_m) {
		// 안쪽 60% 는 통째로 비우고, 바깥 띠만 4×4 규칙 점묘(무작위 점묘는 모래알처럼 지글거렸다)
		float keep = clamp((cam_d / near_fade_m - 0.6) / 0.4, 0.0, 1.0);
		ivec2 q = ivec2(FRAGCOORD.xy) % 4;
		int bi = q.x + q.y * 4;
		float bayer = float((bi == 0 ? 0 : bi == 1 ? 8 : bi == 2 ? 2 : bi == 3 ? 10 : bi == 4 ? 12 : bi == 5 ? 4 : bi == 6 ? 14 : bi == 7 ? 6
			: bi == 8 ? 3 : bi == 9 ? 11 : bi == 10 ? 1 : bi == 11 ? 9 : bi == 12 ? 15 : bi == 13 ? 7 : bi == 14 ? 13 : 5)) / 16.0;
		if (bayer >= keep) {
			discard;
		}
	}
	vec4 tex = texture(albedo_texture, UV);
	ALBEDO = tex.rgb;
	if (snow_amount > 0.0) {
		float lum = dot(tex.rgb, vec3(0.3, 0.59, 0.11));
		ALBEDO = mix(tex.rgb, vec3(lum) * vec3(0.78, 0.92, 0.98), 0.35 * snow_amount);
		float up = smoothstep(0.2, 0.75, normalize(v_world_normal).y);
		ALBEDO = mix(ALBEDO, vec3(0.93, 0.95, 0.99), snow_amount * up);
	}
	ALPHA = tex.a;
	ALPHA_SCISSOR_THRESHOLD = alpha_scissor_threshold;
	ROUGHNESS = roughness_value;
	SPECULAR = specular_value;
	METALLIC = 0.0;
}
