shader_type spatial;
render_mode diffuse_burley, specular_disabled;

// saga-godot 2026-09-28 "그래픽 먼저" — 밤이면 켜지는 창·등롱 유리(games/saga_go/world/house_builder.gd 가 모아 그린다).
// 낮엔 정점색 그대로(창 = 짙은 유리, 등롱 = 누런 유리), 밤(night = 1)엔 따뜻한 불빛으로 빛난다(블룸이 번지게).
// night 는 공유 재질 하나에 village_dressing.gd 가 밤낮을 보고 넣는다 — 집·등롱이 몇 개든 재질 하나.

uniform float night : hint_range(0.0, 1.0) = 0.0;
uniform vec3 lamp : source_color = vec3(1.0, 0.74, 0.38);
uniform float energy = 2.2;

void fragment() {
	ALBEDO = mix(COLOR.rgb, lamp, night * 0.8);
	EMISSION = lamp * night * energy;
	ROUGHNESS = 0.4;
}
