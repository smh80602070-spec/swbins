shader_type spatial;
render_mode blend_mix, cull_back, diffuse_burley, specular_disabled;

// saga-godot 2026-09-28 "그래픽 먼저" — cel_toon.gdshader 와 같은 밴드 명암·림 빛인데 색을 정점색에서 읽는다.
// 여러 빛깔 부품을 메시 하나로 합친 코드 건물(games/saga_go/world/house_builder.gd)이 draw call 하나로 그려지게.
// 2026-09-29 — 코드 짐승(creature_builder.gd)도 쓴다: 정점 알파가 1 보다 작으면 그만큼 스스로 빛나고(원소 눈·줄무늬),
// hit_flash 는 cel_toon 과 같은 피격 번쩍임(combat_feel.gd). 건물은 알파 1 이라 그대로다.

uniform int band_count : hint_range(2, 4) = 3;
uniform float band_softness : hint_range(0.0, 1.0) = 0.08;
uniform vec3 rim_color : source_color = vec3(1.0, 0.95, 0.85);
uniform float rim_power : hint_range(0.5, 8.0) = 4.5;
uniform float rim_strength : hint_range(0.0, 2.0) = 0.25;
uniform float hit_flash : hint_range(0.0, 1.0) = 0.0;
uniform float glow_strength : hint_range(0.0, 8.0) = 1.4;

void fragment() {
	ALBEDO = mix(COLOR.rgb, vec3(1.0), hit_flash);
	EMISSION = COLOR.rgb * (1.0 - COLOR.a) * glow_strength;
	ROUGHNESS = 1.0;
}

void light() {
	float ndotl = clamp(dot(NORMAL, LIGHT), 0.0, 1.0);
	float band_step = 1.0 / float(band_count);
	float banded = floor(ndotl / band_step) * band_step;
	float t = smoothstep(banded, banded + band_softness * band_step, ndotl);
	float lit = clamp(mix(banded, banded + band_step, t), 0.0, 1.0);
	float rim = pow(1.0 - clamp(dot(NORMAL, VIEW), 0.0, 1.0), rim_power) * rim_strength;
	rim *= smoothstep(0.0, 0.3, ndotl);
	vec3 direct = ALBEDO * LIGHT_COLOR * ATTENUATION * lit;
	DIFFUSE_LIGHT += clamp(direct + rim_color * rim * LIGHT_COLOR * ATTENUATION, vec3(0.0), vec3(1.0));
}
