shader_type spatial;
render_mode blend_mix, depth_draw_never, cull_disabled, specular_disabled;

// G-0136 — 길(=) 칸 가운데를 잇는 흙길 띠(games/saga_go/world/road_builder.gd). 지형 위 6cm 에 얹힌다.
// 색 = 정점색(길 빛, sRGB 로 적은 값이라 선형으로) × 흙 텍스처 결, 알파 = 정점 알파(가장자리 흐림) + 노이즈(들쭉날쭉).

uniform sampler2D dirt_albedo : source_color, filter_linear_mipmap, repeat_enable;
uniform float tex_scale = 0.4;

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

void vertex() {
	wpos = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
}

void fragment() {
	vec3 dirt = texture(dirt_albedo, wpos.xz * tex_scale).rgb;
	float n = vnoise(wpos.xz * 0.35);
	float m = vnoise(wpos.xz * 1.7 + vec2(4.0, 9.0));
	vec3 col = pow(COLOR.rgb, vec3(2.2)) * mix(vec3(1.0), dirt * 2.5, 0.35) * (0.86 + 0.18 * n);
	// 바퀴 자국처럼 가운데가 조금 밝게 다져진 느낌 — 알파가 높은(가운데) 곳만.
	col *= mix(0.92, 1.04, smoothstep(0.6, 1.0, COLOR.a));
	col = mix(col, vec3(dot(col, vec3(0.3, 0.59, 0.11))), 0.2);   // 정점색 그대로면 주황으로 쨍했다 — 다져진 흙빛으로 한 단
	ALBEDO = col;
	ALPHA = clamp(smoothstep(0.0, 0.85, COLOR.a + (m - 0.5) * 0.45), 0.0, 1.0);
	ROUGHNESS = 0.95;
	// 양면 그리기 — 뒷면은 법선이 뒤집혀 아래를 봐 까맣게 나왔다(풀잎 셰이더와 같은 처치: 늘 위).
	NORMAL = normalize((VIEW_MATRIX * vec4(0.0, 1.0, 0.0, 0.0)).xyz);
}
