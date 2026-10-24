shader_type spatial;
render_mode cull_disabled;

// G-0366 잎 카드 흔들림 — GLB 제 StandardMaterial(그림·컷아웃·역광)과 같은 그림을 내되 꼭짓점을 바람에 흔든다.
// 4종횡 앞 풀(story_background _grass_sway)이 쓴다. sway 0 이면 안 흔들림(메시 높이에 비례 — 밑동은 땅에 붙음).
// 공용 weather_visual(G-0363·0365)이 meta grass_sway 를 보고 바람 날 배율을 곱한다.

uniform sampler2D albedo_texture : source_color, filter_linear_mipmap;
uniform vec4 albedo_color : source_color = vec4(1.0);
uniform float alpha_cutoff : hint_range(0.0, 1.0) = 0.5;
uniform vec3 backlight_color : source_color = vec3(0.42, 0.5, 0.26);
uniform float roughness_value : hint_range(0.0, 1.0) = 0.9;
uniform float sway = 0.0;

void vertex() {
	if (sway > 0.0) {
		vec3 wp = (MODEL_MATRIX * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
		float h = max(VERTEX.y, 0.0);
		VERTEX.x += sin(TIME * 1.7 + wp.x * 0.6 + wp.z * 0.4) * sway * h;
		VERTEX.z += cos(TIME * 1.3 + wp.z * 0.5 + wp.x * 0.3) * sway * 0.6 * h;
	}
}

void fragment() {
	vec4 tex = texture(albedo_texture, UV) * albedo_color;
	ALBEDO = tex.rgb;
	ALPHA = tex.a;
	ALPHA_SCISSOR_THRESHOLD = alpha_cutoff;
	ROUGHNESS = roughness_value;
	BACKLIGHT = backlight_color;
}
