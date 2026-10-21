shader_type spatial;
render_mode blend_mix, cull_back, diffuse_burley, specular_schlick_ggx;

// saga_core/shaders/world_curve.gdshaderinc를 쓰는 두 공용 머티리얼 중
// 하나 — 텍스처 없이 정점 색만으로 칠하는 메시용(터레인 SurfaceTool,
// CC0 Kenney Nature Kit 나무·바위처럼 정점색 기반 GLB). 다른 하나는
// curved_textured.gdshader(텍스처가 있는 메시용). 나머지는 전부
// saga_core/world/world_curve_material.gd가 감싸 준다 — 이 파일을
// 직접 쓰는 자리는 없어야 한다.

#include "res://saga_core/shaders/world_curve.gdshaderinc"

uniform float curve_amount : hint_range(0.0, 0.02) = 0.004;
uniform float roughness_value : hint_range(0.0, 1.0) = 0.95;
// 같은 메시(예: tree_oak.glb)를 색만 다르게 재사용하고 싶을 때 곱하는 값
// — 기본 흰색(1,1,1)이면 정점색 그대로다. 소나무가 나무 GLB를 재사용하되
// 살짝 푸르스름하게 보이는 것처럼(games/saga_forest/world/gatherable_builder.gd
// 참고), 새 메시를 안 구하고 톤만 바꿀 때 쓴다.
uniform vec3 tint_color : source_color = vec3(1.0);
// G-0277 — 밤 불빛(night_glow.gd register_shader 가 창·불 면에만 켬). 기본 0 이라 기존 사용처는 그대로.
uniform vec3 emission_color : source_color = vec3(0.0);
uniform float emission_energy = 0.0;

void vertex() {
	VERTEX = saga_apply_world_curve(VERTEX, MODEL_MATRIX, curve_amount);
}

void fragment() {
	ALBEDO = COLOR.rgb * tint_color;
	ROUGHNESS = roughness_value;
	EMISSION = emission_color * emission_energy;
}
