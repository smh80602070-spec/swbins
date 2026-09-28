shader_type spatial;
render_mode unshaded, blend_add, cull_disabled, depth_draw_never, shadows_disabled;

// saga-godot 2026-09-28 "그래픽 먼저" — 원소 스킬·폭발 바닥 충격파(games/saga_go/combat/combat_fx.gd element_burst).
// 사각 판(한 변 = 지름) 위에 progress 반지름의 빛 고리 + 안쪽 은은한 빛, fade 로 사라진다. 고리에 잔물결 무늬.

uniform vec3 color : source_color = vec3(1.0);
uniform float progress = 0.0;
uniform float fade = 1.0;

void fragment() {
	vec2 c = UV - 0.5;
	float d = length(c) * 2.0;
	float ang = atan(c.y, c.x);
	float wob = 0.03 * sin(ang * 9.0 + progress * 6.0);
	float p = progress + wob;
	float band = smoothstep(p - 0.16, p, d) * (1.0 - smoothstep(p, p + 0.035, d));
	float fill = (1.0 - smoothstep(0.0, max(p, 0.001), d)) * 0.22;
	float a = (band + fill) * fade * (1.0 - step(1.0, d));
	ALBEDO = mix(color, vec3(1.0), band * 0.45) * a * 2.4;
}
