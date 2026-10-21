shader_type spatial;

// G-0281 — 들판 괴물 creatures 몸(세 트랙 공용 사실 몸) 원소 색. 원본 재질(StandardMaterial3D: 그림·roughness 0.85·금속 0·
// 법선 없음 — 일곱 몸 같음)을 그대로 따라 그리되, 그림 밝기는 지키고 색조만 tint 로(곱하기면 주황 × 보라 = 갈색이라).
// amount 0 = 원본 그대로 · bright = 덧칠한 쪽 밝기(눈여우처럼 흰 털로 읽혀야 할 때 > 1).

uniform sampler2D albedo_texture : source_color, filter_linear_mipmap, repeat_enable;
uniform vec4 tint : source_color = vec4(1.0);
uniform float amount : hint_range(0.0, 1.0) = 0.0;
uniform float bright = 1.0;
uniform float roughness_v = 0.85;

void fragment() {
	vec3 c = texture(albedo_texture, UV).rgb;
	const vec3 LUMA = vec3(0.299, 0.587, 0.114);
	float g = dot(c, LUMA);
	vec3 t = g * bright * tint.rgb / max(dot(tint.rgb, LUMA), 0.05);
	ALBEDO = mix(c, clamp(t, 0.0, 1.0), amount);
	ROUGHNESS = roughness_v;
	METALLIC = 0.0;
}
