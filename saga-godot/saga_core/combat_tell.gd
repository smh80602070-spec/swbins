extends RefCounted

## G-0204 — 바닥 공격 예고. 실제로 맞는 범위(원·부채꼴)를 발밑에 깔고, 터지기까지 남은 시간만큼 안쪽이 가운데서 바깥으로 차오른다
## (피하기 타이밍). sec 뒤 스스로 지운다. 셰이더는 1만리 field_enemy.gd G-0172 TELL_FAN_SHADER 글자를 본떴다(판끼리 참조 금지라 여기 따로).
##   ring(host, pos, r, sec, color) · fan(host, pos, dir, r, half_rad, sec, color) → MeshInstance3D(씬이 없으면 null — 점검 무대)

const SHADER_CODE := """
shader_type spatial;
render_mode unshaded, cull_disabled, shadows_disabled, depth_draw_never;
uniform float radius = 1.0;
uniform float min_dot = -2.0;
uniform float progress = 0.0;
uniform vec4 color : source_color = vec4(1.0, 0.18, 0.12, 1.0);
varying vec2 lp;
void vertex() { lp = VERTEX.xz; }
void fragment() {
	float r = length(lp) / radius;
	if (r > 1.0 || (r > 0.001 && normalize(lp).y < min_dot)) { discard; }
	float edge = smoothstep(0.9, 1.0, r);
	float fill = r <= progress ? 0.38 : 0.0;
	ALBEDO = color.rgb;
	ALPHA = max(0.14 + fill, edge * 0.75);
}
"""

static var _shader: Shader = null


static func ring(host: Node, pos: Vector3, radius: float, sec: float, color: Color) -> MeshInstance3D:
	return _make(host, pos, Vector3.FORWARD, radius, -2.0, sec, color)


## dir 쪽(바닥 평면)으로 반각 half_rad 의 부채꼴.
static func fan(host: Node, pos: Vector3, dir: Vector3, radius: float, half_rad: float, sec: float, color: Color) -> MeshInstance3D:
	return _make(host, pos, dir, radius, cos(half_rad), sec, color)


static func _make(host: Node, pos: Vector3, dir: Vector3, radius: float, min_dot: float, sec: float, color: Color) -> MeshInstance3D:
	if host == null or not host.is_inside_tree() or host.get_tree().current_scene == null:
		return null
	if _shader == null:
		_shader = Shader.new()
		_shader.code = SHADER_CODE
	var mi := MeshInstance3D.new()
	var pm := PlaneMesh.new()
	pm.size = Vector2(radius * 2.0, radius * 2.0)
	mi.mesh = pm
	var mat := ShaderMaterial.new()
	mat.shader = _shader
	mat.set_shader_parameter("radius", radius)
	mat.set_shader_parameter("min_dot", min_dot)
	mat.set_shader_parameter("color", color)
	mi.material_override = mat
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	host.get_tree().current_scene.add_child(mi)
	mi.global_position = pos + Vector3.UP * 0.06
	var flat := Vector3(dir.x, 0.0, dir.z)
	if flat.length() > 0.001:
		mi.rotation.y = atan2(flat.x, flat.z) # 메시 앞(+Z)을 dir 로
	## 게임 시간으로 흐른다 — 터지는 쪽 타이머(보스 _physics_process delta)와 같은 시계라 멈칫 중에도 어긋나지 않는다.
	var tw := mi.create_tween()
	tw.tween_method(func(v: float) -> void: mat.set_shader_parameter("progress", v), 0.0, 1.0, maxf(sec, 0.01))
	tw.tween_callback(mi.queue_free)
	return mi
