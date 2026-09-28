shader_type spatial;
render_mode unshaded, blend_add, cull_disabled, depth_draw_never, shadows_disabled;

// saga-godot 2026-09-28 "그래픽 먼저" — 원소 폭발 빛기둥(combat_fx.gd). 원기둥 옆면: 밑동이 밝고 위로 갈수록 사라진다,
// 가장자리(비스듬히 보이는 면)가 더 밝아 속이 빈 빛기둥처럼 보인다. fade 로 사라진다.

uniform vec3 color : source_color = vec3(1.0);
uniform float fade = 1.0;

void fragment() {
	float up = 1.0 - UV.y;                       // CylinderMesh UV.y: 위 0 → 아래 1
	float fall = pow(1.0 - up, 1.6);
	float rim = pow(1.0 - abs(dot(NORMAL, VIEW)), 1.5);
	float a = fall * (0.25 + 0.75 * rim) * fade;
	ALBEDO = mix(color, vec3(1.0), 0.3) * a * 2.0;
}
