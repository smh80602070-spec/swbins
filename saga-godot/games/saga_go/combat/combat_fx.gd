extends RefCounted

## saga-godot 2026-09-28 "그래픽 먼저" — 전투 이펙트. 근접 기본 공격엔 궤적이 없었고, 맞아도 멈칫·흔들림·번쩍·숫자·소리뿐
## 불꽃이 없었다(field_combat.gd·saga_core/combat_feel.gd). 원신 문법만 따른다:
##   · slash() — 몸 앞 초승달 빛 궤적(연타마다 기울기가 바뀜, 무거운 무기는 크게). 0.2초.
##   · spark() — 맞은 자리의 튀는 불꽃 조각 + 짧은 번쩍임. 0.3초.
## 메시·재질은 한 번 만들어 나눠 쓰고, 한 번 쓴 노드는 스스로 지운다. 그림자 없음.

const SLASH_SHADER := preload("res://saga_core/shaders/slash_trail.gdshader")

## 연타 차례별 궤적 기울기(도) — 가로·오른위·왼위·세로 베기 느낌.
const ROLLS := [8.0, -28.0, 30.0, -70.0, 12.0]
const PHYSICAL := Color(1.0, 0.95, 0.82)
const TILT := 55.0

static var _crescent: ArrayMesh = null
static var _spark_mesh: QuadMesh = null
static var _flash_mesh: QuadMesh = null


## who = 플레이어(Node3D), fwd = 바라보는 방향, reach = 닿는 거리(m), step = 연타 차례.
static func slash(who: Node3D, fwd: Vector3, reach: float, color: Color, step: int, heavy := false) -> void:
	if who == null or not who.is_inside_tree():
		return
	var mi := MeshInstance3D.new()
	mi.mesh = _crescent_mesh()
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	var mat := ShaderMaterial.new()
	mat.shader = SLASH_SHADER
	mat.set_shader_parameter("color", color)
	mat.set_shader_parameter("sweep", 0.0)
	mi.material_override = mat
	who.get_tree().current_scene.add_child(mi)
	var f := Vector3(fwd.x, 0.0, fwd.z)
	f = f.normalized() if f.length() > 0.01 else Vector3.FORWARD
	var yaw := atan2(f.x, f.z)
	var roll := deg_to_rad(float(ROLLS[step % ROLLS.size()]))
	var s := maxf(reach, 1.2) * (1.25 if heavy else 1.0)
	## 초승달은 +Z 쪽으로 열린 호(가운데가 앞) — 몸 방향으로 돌리고, 앞뒤 축으로 기울인다. 좌우 번갈아 휘두르게 홀짝으로 뒤집는다.
	var flip := -1.0 if step % 2 == 1 else 1.0
	## 수평으로 누인 호는 뒤에서 보는 카메라엔 가는 점선으로만 보였다(09-28 촬영) — 앞쪽을 TILT 만큼 세워 몸 앞에 큰 호로 보이게.
	var b := Basis(Vector3.UP, yaw) * Basis(Vector3.FORWARD, roll) * Basis(Vector3.RIGHT, deg_to_rad(-TILT)) * Basis.from_scale(Vector3(s * flip, s, s))
	mi.global_transform = Transform3D(b, who.global_position + Vector3.UP * 1.05 + f * 0.25)
	## 맞는 순간의 멈칫(combat_feel 히트스톱, Engine.time_scale)에도 궤적은 끝까지 휘둘러진다 — 멈추면 궤적이 아예 안 보였다(09-28 촬영).
	var tw := mi.create_tween()
	tw.set_ignore_time_scale(true)
	tw.tween_method(func(v: float) -> void: mat.set_shader_parameter("sweep", v), 0.0, 1.15, 0.09)
	tw.tween_method(func(v: float) -> void: mat.set_shader_parameter("fade", v), 1.0, 0.0, 0.16)
	tw.tween_callback(mi.queue_free)


## 맞은 자리 불꽃 — pos 는 맞은 몸 가운데쯤(월드).
static func spark(host: Node, pos: Vector3, color: Color, big := false) -> void:
	if host == null or not host.is_inside_tree():
		return
	var scene := host.get_tree().current_scene
	var p := CPUParticles3D.new()
	p.one_shot = true
	p.emitting = false
	p.amount = 14 if big else 9
	p.lifetime = 0.32
	p.explosiveness = 1.0
	p.mesh = _spark_quad()
	p.particle_flag_align_y = true
	p.direction = Vector3.UP
	p.spread = 180.0
	p.initial_velocity_min = 4.0
	p.initial_velocity_max = 8.5 if big else 6.5
	p.gravity = Vector3(0, -9.0, 0)
	p.damping_min = 4.0
	p.damping_max = 8.0
	p.scale_amount_min = 0.7
	p.scale_amount_max = 1.3
	var curve := Curve.new()
	curve.add_point(Vector2(0, 1))
	curve.add_point(Vector2(1, 0))
	p.scale_amount_curve = curve
	var mat := StandardMaterial3D.new()
	mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	mat.blend_mode = BaseMaterial3D.BLEND_MODE_ADD
	mat.albedo_color = color.lerp(Color.WHITE, 0.35)
	mat.billboard_mode = BaseMaterial3D.BILLBOARD_PARTICLES
	mat.billboard_keep_scale = true
	p.material_override = mat
	p.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	scene.add_child(p)
	p.global_position = pos
	p.emitting = true
	## 번쩍 — 맞은 자리에 커졌다 사라지는 빛 한 장(카메라를 본다).
	var fl := MeshInstance3D.new()
	fl.mesh = _flash_quad()
	var fm := StandardMaterial3D.new()
	fm.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	fm.blend_mode = BaseMaterial3D.BLEND_MODE_ADD
	fm.billboard_mode = BaseMaterial3D.BILLBOARD_ENABLED
	fm.albedo_color = color.lerp(Color.WHITE, 0.5)
	fm.albedo_texture = _star_tex()
	fm.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	fl.material_override = fm
	fl.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	scene.add_child(fl)
	fl.global_position = pos
	fl.scale = Vector3.ONE * (0.4 if big else 0.3)
	var tw := fl.create_tween()
	tw.set_ignore_time_scale(true)
	tw.set_parallel(true)
	tw.tween_property(fl, "scale", Vector3.ONE * (1.6 if big else 1.1), 0.12)
	tw.tween_property(fm, "albedo_color:a", 0.0, 0.14)
	tw.chain().tween_callback(fl.queue_free)
	var t := p.create_tween()
	t.tween_interval(p.lifetime + 0.1)
	t.tween_callback(p.queue_free)


## 초승달 — 반지름 0.55~1.0, 호 160°(가운데가 +Z), 양 끝이 가늘다. UV.x 호 차례, UV.y 안→밖.
static func _crescent_mesh() -> ArrayMesh:
	if _crescent != null:
		return _crescent
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	var seg := 20
	var arc := deg_to_rad(160.0)
	for i in seg:
		var pts := []
		for k in [i, i + 1]:
			var t := float(k) / float(seg)
			var a := -arc * 0.5 + arc * t
			var thin := sin(t * PI) # 끝이 가늘다
			var r_in := 1.0 - 0.45 * thin
			var dir := Vector3(sin(a), 0.0, cos(a))
			pts.append([dir * r_in, dir * 1.0, t])
		var a0: Array = pts[0]
		var a1: Array = pts[1]
		var q := [[a0[0], Vector2(a0[2], 0.0)], [a0[1], Vector2(a0[2], 1.0)], [a1[1], Vector2(a1[2], 1.0)], [a1[0], Vector2(a1[2], 0.0)]]
		for k in [0, 1, 2, 0, 2, 3]:
			st.set_normal(Vector3.UP)
			st.set_uv(q[k][1])
			st.add_vertex(q[k][0])
	_crescent = st.commit()
	return _crescent


static func _spark_quad() -> QuadMesh:
	if _spark_mesh == null:
		_spark_mesh = QuadMesh.new()
		_spark_mesh.size = Vector2(0.05, 0.32) # 가늘고 긴 불똥(날아가는 쪽으로 선다)
	return _spark_mesh


static func _flash_quad() -> QuadMesh:
	if _flash_mesh == null:
		_flash_mesh = QuadMesh.new()
		_flash_mesh.size = Vector2(1.0, 1.0)
	return _flash_mesh


static var _star: ImageTexture = null
## 네 갈래 별빛(가운데 둥근 빛 + 십자 줄기) — 코드로 굽는다.
static func _star_tex() -> ImageTexture:
	if _star != null:
		return _star
	var n := 64
	var img := Image.create(n, n, false, Image.FORMAT_RGBA8)
	for y in n:
		for x in n:
			var u := (float(x) + 0.5) / float(n) * 2.0 - 1.0
			var v := (float(y) + 0.5) / float(n) * 2.0 - 1.0
			var r := sqrt(u * u + v * v)
			var glow := clampf(1.0 - r, 0.0, 1.0)
			glow = glow * glow
			var cross := maxf(clampf(1.0 - absf(u) * 14.0, 0.0, 1.0) * (1.0 - absf(v)), clampf(1.0 - absf(v) * 14.0, 0.0, 1.0) * (1.0 - absf(u)))
			var a := clampf(glow * 0.9 + cross, 0.0, 1.0)
			img.set_pixel(x, y, Color(1, 1, 1, a))
	_star = ImageTexture.create_from_image(img)
	return _star
