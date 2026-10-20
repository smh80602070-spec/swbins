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
## scale_mul — G-0255 미리 데우기(warm)만 아주 작게(0.02) 부른다. 기본 1.0 이면 전과 같다.
static func slash(who: Node3D, fwd: Vector3, reach: float, color: Color, step: int, heavy := false, scale_mul := 1.0) -> void:
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
	var s := maxf(reach, 1.2) * (1.25 if heavy else 1.0) * scale_mul
	## 초승달은 +Z 쪽으로 열린 호(가운데가 앞) — 몸 방향으로 돌리고, 앞뒤 축으로 기울인다. 좌우 번갈아 휘두르게 홀짝으로 뒤집는다.
	var flip := -1.0 if step % 2 == 1 else 1.0
	## 수평으로 누인 호는 뒤에서 보는 카메라엔 가는 점선으로만 보였다(09-28 촬영) — 앞쪽을 TILT 만큼 세워 몸 앞에 큰 호로 보이게.
	var b := Basis(Vector3.UP, yaw) * Basis(Vector3.FORWARD, roll) * Basis(Vector3.RIGHT, deg_to_rad(-TILT)) * Basis.from_scale(Vector3(s * flip, s, s))
	mi.global_transform = Transform3D(b, who.global_position + (Vector3.UP * 1.05 + f * 0.25) * scale_mul)
	## 맞는 순간의 멈칫(combat_feel 히트스톱, Engine.time_scale)에도 궤적은 끝까지 휘둘러진다 — 멈추면 궤적이 아예 안 보였다(09-28 촬영).
	var tw := mi.create_tween()
	tw.set_ignore_time_scale(true)
	tw.tween_method(func(v: float) -> void: mat.set_shader_parameter("sweep", v), 0.0, 1.15, 0.09)
	tw.tween_method(func(v: float) -> void: mat.set_shader_parameter("fade", v), 1.0, 0.0, 0.16)
	tw.tween_callback(mi.queue_free)


## 맞은 자리 불꽃 — pos 는 맞은 몸 가운데쯤(월드).
static func spark(host: Node, pos: Vector3, color: Color, big := false, scale_mul := 1.0) -> void:
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
	p.initial_velocity_min = 4.0 * scale_mul
	p.initial_velocity_max = (8.5 if big else 6.5) * scale_mul
	p.gravity = Vector3(0, -9.0, 0) * scale_mul
	p.damping_min = 4.0
	p.damping_max = 8.0
	p.scale_amount_min = 0.7 * scale_mul
	p.scale_amount_max = 1.3 * scale_mul
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
	fl.scale = Vector3.ONE * (0.4 if big else 0.3) * scale_mul
	var tw := fl.create_tween()
	tw.set_ignore_time_scale(true)
	tw.set_parallel(true)
	tw.tween_property(fl, "scale", Vector3.ONE * (1.6 if big else 1.1) * scale_mul, 0.12)
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

# ---------------------------------------------------------------- 원소 스킬·폭발(09-28)

const RING_SHADER := preload("res://saga_core/shaders/shock_ring.gdshader")
const PILLAR_SHADER := preload("res://saga_core/shaders/light_pillar.gdshader")

## 원소별 입자 — [개수, 속도 최소, 최대, 퍼짐(도), 중력 y, 수명, 조각 크기(가로,세로), 날아가는 쪽으로 세우기, 돌기, 감아 돌기]
const PARTICLES := {
	"fire": [26, 2.5, 6.0, 30.0, 3.0, 0.9, Vector2(0.14, 0.14), false, 0.0, 0.0],      # 솟아오르는 불씨
	"water": [28, 4.0, 8.5, 55.0, -14.0, 0.7, Vector2(0.11, 0.11), false, 0.0, 0.0],   # 튀는 물방울
	"thunder": [32, 6.0, 12.0, 180.0, 0.0, 0.3, Vector2(0.04, 0.45), true, 0.0, 0.0],  # 지지직 불똥
	"ice": [22, 4.0, 8.0, 50.0, -12.0, 0.6, Vector2(0.07, 0.34), true, 0.0, 0.0],      # 얼음 파편
	"wind": [30, 1.5, 3.5, 20.0, 1.5, 0.8, Vector2(0.05, 0.5), true, 0.0, 9.0],        # 감아 도는 바람 줄기
	"rock": [18, 5.0, 9.0, 40.0, -20.0, 0.8, Vector2(0.24, 0.24), false, 360.0, 0.0],  # 튀는 돌 조각
	"grass": [24, 2.5, 5.0, 70.0, -2.5, 1.0, Vector2(0.2, 0.11), false, 300.0, 0.0],   # 흩날리는 잎
	"": [20, 3.0, 6.0, 90.0, -4.0, 0.5, Vector2(0.1, 0.1), false, 0.0, 0.0],
}


## 원소 스킬·폭발·반응의 자리 — 바닥 충격파 + 원소별 입자, big(폭발)이면 빛기둥까지. 색이 원소 색표와 같으면 그 원소로 본다.
static func element_burst(host: Node, center: Vector3, radius: float, color: Color, sec: float, element: String, big: bool, scale_mul := 1.0) -> void:
	if host == null or not host.is_inside_tree():
		return
	var scene := host.get_tree().current_scene
	## ① 바닥 충격파.
	var ring := MeshInstance3D.new()
	var plane := PlaneMesh.new()
	plane.size = Vector2(radius * 2.0, radius * 2.0)
	ring.mesh = plane
	var rm := ShaderMaterial.new()
	rm.shader = RING_SHADER
	rm.set_shader_parameter("color", color)
	ring.material_override = rm
	ring.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	scene.add_child(ring)
	ring.global_position = center + Vector3.UP * 0.15 * scale_mul
	var tw := ring.create_tween()
	tw.set_ignore_time_scale(true)
	tw.set_parallel(true)
	tw.tween_method(func(v: float) -> void: rm.set_shader_parameter("progress", v), 0.15, 1.0, sec).set_ease(Tween.EASE_OUT).set_trans(Tween.TRANS_CUBIC)
	tw.tween_method(func(v: float) -> void: rm.set_shader_parameter("fade", v), 1.0, 0.0, sec).set_ease(Tween.EASE_IN)
	tw.chain().tween_callback(ring.queue_free)
	## ② 원소별 입자.
	var spec: Array = PARTICLES.get(element, PARTICLES[""])
	var p := CPUParticles3D.new()
	p.one_shot = true
	p.emitting = false
	p.amount = int(float(spec[0]) * (1.8 if big else 1.0))
	p.lifetime = float(spec[5])
	p.explosiveness = 0.85
	p.randomness = 0.4
	p.emission_shape = CPUParticles3D.EMISSION_SHAPE_RING
	p.emission_ring_axis = Vector3.UP
	p.emission_ring_height = 0.3 * scale_mul
	p.emission_ring_radius = maxf(radius * 0.55, 0.6) * scale_mul
	p.emission_ring_inner_radius = maxf(radius * 0.15, 0.2) * scale_mul
	p.direction = Vector3.UP
	p.spread = float(spec[3])
	p.initial_velocity_min = float(spec[1]) * scale_mul
	p.initial_velocity_max = float(spec[2]) * scale_mul
	p.gravity = Vector3(0, float(spec[4]), 0) * scale_mul
	p.damping_min = 1.0
	p.damping_max = 3.0
	p.angular_velocity_min = -float(spec[8])
	p.angular_velocity_max = float(spec[8])
	p.tangential_accel_min = float(spec[9])
	p.tangential_accel_max = float(spec[9])
	p.particle_flag_align_y = bool(spec[7])
	var q := QuadMesh.new()
	q.size = spec[6]
	if element == "rock":
		var bx := BoxMesh.new()
		bx.size = Vector3.ONE * (spec[6] as Vector2).x
		p.mesh = bx
	else:
		p.mesh = q
	var curve := Curve.new()
	curve.add_point(Vector2(0, 1))
	curve.add_point(Vector2(0.7, 0.8))
	curve.add_point(Vector2(1, 0))
	p.scale_amount_curve = curve
	p.scale_amount_min = 0.7 * scale_mul
	p.scale_amount_max = 1.4 * scale_mul
	var grad := Gradient.new()
	grad.set_color(0, color.lerp(Color.WHITE, 0.15))
	grad.set_color(1, Color(color.r, color.g, color.b, 0.0))
	p.color_ramp = grad
	var pm := StandardMaterial3D.new()
	pm.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	pm.vertex_color_use_as_albedo = true
	pm.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	if element != "rock":
		## 네모난 판은 색종이처럼 보였다(09-28 촬영) — 가운데가 밝고 가장자리가 스러지는 둥근 빛 알갱이.
		pm.albedo_texture = _dot_tex()
		pm.blend_mode = BaseMaterial3D.BLEND_MODE_ADD
		pm.billboard_mode = BaseMaterial3D.BILLBOARD_PARTICLES
		pm.billboard_keep_scale = true
	p.material_override = pm
	p.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	scene.add_child(p)
	p.global_position = center + Vector3.UP * 0.2 * scale_mul
	p.emitting = true
	var pt := p.create_tween()
	pt.tween_interval(p.lifetime + 0.2)
	pt.tween_callback(p.queue_free)
	## ③ 폭발 — 하늘로 솟는 빛기둥 + 가운데 큰 번쩍임.
	if big:
		var pillar := MeshInstance3D.new()
		var cyl := CylinderMesh.new()
		cyl.top_radius = radius * 0.3
		cyl.bottom_radius = radius * 0.45
		cyl.height = 14.0 * scale_mul
		cyl.radial_segments = 20
		cyl.rings = 1
		cyl.cap_top = false
		cyl.cap_bottom = false
		pillar.mesh = cyl
		var lm := ShaderMaterial.new()
		lm.shader = PILLAR_SHADER
		lm.set_shader_parameter("color", color)
		pillar.material_override = lm
		pillar.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		scene.add_child(pillar)
		pillar.global_position = center + Vector3.UP * 7.0 * scale_mul
		pillar.scale = Vector3(0.4, 1.0, 0.4)
		var pw := pillar.create_tween()
		pw.set_ignore_time_scale(true)
		pw.set_parallel(true)
		pw.tween_property(pillar, "scale", Vector3(1.1, 1.0, 1.1), sec * 0.9).set_ease(Tween.EASE_OUT)
		pw.tween_method(func(v: float) -> void: lm.set_shader_parameter("fade", v), 1.0, 0.0, sec * 1.1).set_ease(Tween.EASE_IN)
		pw.chain().tween_callback(pillar.queue_free)
		spark(host, center + Vector3.UP * 1.2 * scale_mul, color, true, scale_mul)


static var _dot: ImageTexture = null
## 둥근 빛 알갱이(가운데 밝고 가장자리로 스러짐) — 코드로 굽는다.
static func _dot_tex() -> ImageTexture:
	if _dot != null:
		return _dot
	var n := 32
	var img := Image.create(n, n, false, Image.FORMAT_RGBA8)
	for y in n:
		for x in n:
			var u := (float(x) + 0.5) / float(n) * 2.0 - 1.0
			var v := (float(y) + 0.5) / float(n) * 2.0 - 1.0
			var a := clampf(1.0 - sqrt(u * u + v * v), 0.0, 1.0)
			img.set_pixel(x, y, Color(1, 1, 1, a * a * 1.6))
	_dot = ImageTexture.create_from_image(img)
	return _dot


# ---------------------------------------------------------------- 미리 데우기(G-0255)

## 씬에서 첫 궤적·불꽃·충격파는 셰이더를 처음 그리느라 그 프레임이 길어 tween 이 통째로 지나가 안 보였다(G-0253).
## 씬이 뜰 때(environment_profile._ready deferred) 카메라 앞 1.5m 에 한 벌을 아주 작게(0.02) 한 번 그려 컴파일을 끝낸다.
## 셰이더 캐시는 프로세스 공용이라 한 번만 — 다음 씬은 바로 돌아간다. SAGA_FX_WARM=0 이면 끔. 로그 안 찍음.
const WARM_SCALE := 0.02
static var _warmed := false
static var last_warm := {}

static func warm(host: Node) -> void:
	if OS.get_environment("SAGA_FX_WARM") == "0":
		return
	if _warmed:
		last_warm = {"nodes": 0, "at_ms": Time.get_ticks_msec()}
		return
	## 씬을 실은 직후 몇 프레임은 시간 배율 무시 tween·타이머 걸음이 싣는 시간만큼 길어, 효과가 한 프레임 안에 끝나 그려지기 전에 지워졌다(점검) —
	## 실시간 0.5초·3 프레임을 프레임 단위로 기다린다(타이머도 같은 걸음이라 안 됨). 씬마다 한 번, 매 틱 셈 아님.
	if host == null or not host.is_inside_tree():
		return
	var tree := host.get_tree()
	var t0 := Time.get_ticks_msec()
	var fr := 0
	while fr < 3 or Time.get_ticks_msec() - t0 < 500:
		await tree.process_frame
		fr += 1
	if _warmed or not is_instance_valid(host) or not host.is_inside_tree() or tree.current_scene == null:
		return
	var cam := host.get_viewport().get_camera_3d()
	if cam == null:
		return
	_warmed = true
	var scene := tree.current_scene
	var before := scene.get_child_count()
	var cb := cam.global_transform.basis
	var front := cam.global_position - cb.z * 1.5
	var fwd := Vector3(-cb.z.x, 0.0, -cb.z.z)
	var who := Node3D.new()
	scene.add_child(who)
	who.global_position = front
	slash(who, fwd, 0.05, PHYSICAL, 0, false, WARM_SCALE)
	who.queue_free()
	spark(host, front, PHYSICAL, false, WARM_SCALE)
	spark(host, front, PHYSICAL, true, WARM_SCALE)
	## 바닥 충격파는 누운 판이라 눈높이면 옆선뿐 — 카메라 아래쪽으로 조금 내려 위에서 보게.
	var low := front - cb.y * 0.3
	element_burst(host, low, 0.05, PHYSICAL, 0.3, "", false, WARM_SCALE)
	element_burst(host, low, 0.05, Color(1.0, 0.5, 0.2), 0.3, "fire", true, WARM_SCALE)
	last_warm = {"nodes": scene.get_child_count() - before - 1, "at_ms": Time.get_ticks_msec()}


## 원소 색표(elements.gd INFO)와 같은 색이면 그 원소 이름, 아니면 ""(반응 색 등).
static func element_of_color(c: Color, info: Dictionary) -> String:
	for k in info:
		if (info[k].color as Color).is_equal_approx(c):
			return k
	return ""
