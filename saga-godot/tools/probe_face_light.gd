extends SceneTree
## G-0248 얼굴 그림자(원신식) 자동 점검 —
##   godot --headless --path saga-godot --script res://tools/probe_face_light.gd   → "PROBE face_light OK" / "FAIL n"
## dex 몸 셋: ① 얼굴 메시 살갗·얼굴 부품 표면 face_mode=1 (하나 이상) ② 몸 살갗·옷·머리 face_mode 0
## ③ FaceLight 수정자 붙음 ④ 몇 프레임 뒤 얼굴 메시 head_fwd 가 0 벡터 아님(길이 ≈1)
## ⑤ SAGA_FACE_LIGHT=0 이면 face_mode 0·수정자 없음.
## G-0271 ⑥ 얼굴 살갗 face_sdf_on 1(하나 이상)·입 안·눈썹·눈선·눈(face_no_sdf) 0 ⑦ SAGA_FACE_SDF=0 이면 둘 다 0. dex 가 없으면 SKIP.

const VroidBody := preload("res://saga_core/world/vroid_body.gd")
const FaceLight := preload("res://saga_core/world/face_light.gd")

var fails := 0
var _bodies: Array[Node3D] = []
var _frame := 0


func _fail(msg: String) -> void:
	fails += 1
	print("  FAIL ", msg)


func _mode(sm: ShaderMaterial) -> float:
	var v: Variant = sm.get_shader_parameter("face_mode")
	return float(v) if v != null else 0.0


## 몸의 얼굴 표면 SDF 켬 수 — [살갗 켬, 살갗 밖 켬, 살갗 밖 표면 수]
func _sdf_counts(v: Node) -> Array[int]:
	var r: Array[int] = [0, 0, 0]
	for node in v.find_children("*", "MeshInstance3D", true, false):
		var mi := node as MeshInstance3D
		for si in mi.get_surface_override_material_count():
			var sm := mi.get_surface_override_material(si) as ShaderMaterial
			if sm == null or not sm.get_meta("face_part", false):
				continue
			var on: Variant = sm.get_shader_parameter("face_sdf_on")
			var lit := on != null and float(on) > 0.5
			if sm.get_meta("face_no_sdf", false):
				r[2] += 1
				if lit:
					r[1] += 1
			elif lit:
				r[0] += 1
	return r


func _init() -> void:
	if not VroidBody.dex_available():
		print("PROBE face_light SKIP dex 없음")
		quit(0)
		return
	for id in ["probe_face_0", "probe_face_1", "sg_zhugeliang"]:
		var v := VroidBody.build(id, 3)
		if v == null:
			_fail("몸 없음 " + id)
			continue
		root.add_child(v)
		_bodies.append(v)
		var face_on := 0
		for node in v.find_children("*", "MeshInstance3D", true, false):
			var mi := node as MeshInstance3D
			for si in mi.get_surface_override_material_count():
				var sm := mi.get_surface_override_material(si) as ShaderMaterial
				if sm == null:
					continue
				var m := _mode(sm)
				if sm.get_meta("face_part", false):
					if m > 0.5:
						face_on += 1
					else:
						_fail("① 얼굴 표면 face_mode 0 %s/%s" % [id, mi.name])
				elif m > 0.5:
					_fail("② 얼굴 아닌 표면 face_mode 1 %s/%s" % [id, mi.name])
		if face_on == 0:
			_fail("① 얼굴 표면 없음 " + id)
		if v.find_children("FaceLight", "", true, false).is_empty():
			_fail("③ FaceLight 수정자 없음 " + id)
		var c := _sdf_counts(v)
		print("  %s sdf 살갗 %d · 살갗 밖 %d/%d" % [id, c[0], c[1], c[2]])
		if FaceLight.sdf_texture() == null:
			_fail("⑥ face_sdf.png 못 읽음")
		elif c[0] == 0 or c[1] > 0:
			_fail("⑥ %s 살갗 SDF %d(>0 이어야)·살갗 밖 %d(0 이어야)" % [id, c[0], c[1]])
	## ⑦ SAGA_FACE_SDF=0 — sdf_texture 는 한 번만 읽어 두니 캐시를 비우고 잰 뒤 되돌린다.
	OS.set_environment("SAGA_FACE_SDF", "0")
	FaceLight._sdf_checked = false
	FaceLight._sdf = null
	var nosdf := VroidBody.build("probe_face_nosdf", 3)
	OS.set_environment("SAGA_FACE_SDF", "")
	FaceLight._sdf_checked = false
	if nosdf != null:
		var c0 := _sdf_counts(nosdf)
		if c0[0] + c0[1] > 0:
			_fail("⑦ SAGA_FACE_SDF=0 인데 SDF 켬 %d" % (c0[0] + c0[1]))
		nosdf.free()
	## ⑤ 손잡이 0
	OS.set_environment("SAGA_FACE_LIGHT", "0")
	var off := VroidBody.build("probe_face_off", 3)
	OS.set_environment("SAGA_FACE_LIGHT", "")
	if off != null:
		for node in off.find_children("*", "MeshInstance3D", true, false):
			var mi := node as MeshInstance3D
			for si in mi.get_surface_override_material_count():
				var sm := mi.get_surface_override_material(si) as ShaderMaterial
				if sm != null and _mode(sm) > 0.5:
					_fail("⑤ SAGA_FACE_LIGHT=0 인데 face_mode 1 " + String(mi.name))
		if not off.find_children("FaceLight", "", true, false).is_empty():
			_fail("⑤ SAGA_FACE_LIGHT=0 인데 수정자 붙음")
		off.free()


func _process(_d: float) -> bool:
	_frame += 1
	if _frame < 6:
		return false
	for v in _bodies:
		var got := false
		for node in v.find_children("*", "MeshInstance3D", true, false):
			var mi := node as MeshInstance3D
			var face := false
			for si in mi.get_surface_override_material_count():
				var sm := mi.get_surface_override_material(si) as ShaderMaterial
				if sm != null and sm.get_meta("face_part", false):
					face = true
			if not face:
				continue
			var f: Variant = mi.get_instance_shader_parameter("head_fwd")
			if f is Vector3 and absf((f as Vector3).length() - 1.0) < 0.01:
				got = true
			else:
				_fail("④ head_fwd 없음·0 %s/%s (%s)" % [v.name, mi.name, str(f)])
		if not got:
			_fail("④ 얼굴 메시 head_fwd 하나도 없음 " + String(v.name))
	print("PROBE face_light ", "OK" if fails == 0 else "FAIL %d" % fails)
	quit(1 if fails > 0 else 0)
	return true
