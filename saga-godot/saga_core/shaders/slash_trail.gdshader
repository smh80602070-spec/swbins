shader_type spatial;
render_mode unshaded, blend_add, cull_disabled, depth_draw_never, shadows_disabled;

// saga-godot 2026-09-28 "그래픽 먼저" — 근접 베기 궤적(games/saga_go/combat/combat_fx.gd 가 초승달 메시에 씌운다).
// UV.x = 호를 따라 0(휘두르기 시작) → 1(끝), UV.y = 안쪽 0 → 바깥 1.
// sweep 가 0 → 1 로 가며 궤적이 호를 따라 그려지고, fade 가 1 → 0 으로 사라진다. 끝부분(sweep 머리)이 가장 밝다.

uniform vec3 color : source_color = vec3(1.0, 0.95, 0.8);
uniform float sweep = 1.0;
uniform float fade = 1.0;

void fragment() {
	float head = sweep;
	float behind = head - UV.x;                       // 머리 뒤로 얼마나 떨어졌나
	float drawn = step(0.0, behind);                  // 아직 안 그려진 쪽은 0
	float tail = 1.0 - smoothstep(0.0, 0.75, behind); // 머리 가까울수록 밝다
	float edge = smoothstep(0.0, 0.35, UV.y) * (1.0 - smoothstep(0.75, 1.0, UV.y));
	float core = smoothstep(0.55, 0.85, UV.y) * (1.0 - smoothstep(0.85, 1.0, UV.y)); // 바깥 날 선 줄
	float a = drawn * tail * fade * (edge * 0.55 + core * 0.9);
	ALBEDO = mix(color, vec3(1.0), core * 0.6) * a * 3.0;
}
