extends SceneTree

## G-0277 밤 불빛 자동 점검 —
##   godot --headless --path saga-godot --script res://tools/probe_night_glow.gd   → "PROBE night_glow OK" / "FAIL n"
## 판 씬(1만리 TestVillage·3마을 TestVillageForest·4종횡 SinyaField·5천하 TestCity)을 SAGA_HOUR 22 로 싣고:
##   ① 불 면(glow_*) 재질이 하나 이상 모였다(창 glass 는 1만리·3마을) ② 밤 세기 ≥ 낮(set_night 0) × 3 ③ 창 emission > 0
##   ④ NightGlowLights 노드 — 켜진 점광 ≤ MAX_LIGHTS·그림자 끔 · light_point 가 있는 판은 카메라를 첫 등 곁으로 옮겨 점광 > 0
## 그리고 SAGA_NIGHT_GLOW=0 이면 노드가 안 붙고 재질이 안 모인다(새 과정이 아니라 같은 과정에서 손잡이 끈 뒤 새로 실음).
## 헤드리스라 그림은 안 본다(숫자만) — 그림은 창 모드 촬영.

const NightGlow := preload("res://saga_core/world/night_glow.gd")
const SETTLE := 8
const SCENES := {
	"GO": "res://games/saga_go/world/TestVillage.tscn",
	"FOREST": "res://games/saga_forest/world/TestVillageForest.tscn",
	"STORY": "res://games/saga_story/world/SinyaField.tscn",
	"REALM": "res://games/saga_realm/world/TestCity.tscn",
}

var fails := 0


func _fail(msg: String) -> void:
	fails += 1
	print("  FAIL ", msg)


func _load(path: String) -> Node:
	var scene := (load(path) as PackedScene).instantiate()
	root.add_child(scene)
	current_scene = scene
	for _i in SETTLE:
		await process_frame
	return scene


func _unload(scene: Node) -> void:
	scene.queue_free()
	await process_frame
	await process_frame


func _init() -> void:
	_run.call_deferred()


func _run() -> void:
	await process_frame
	OS.set_environment("SAGA_HOUR", "22")
	var total_glow := 0
	var total_glass := 0
	for key in SCENES:
		var scene: Node = await _load(SCENES[key])
		var n_glow := 0
		var n_glass := 0
		for e in NightGlow._mats:
			if String(e[1]) == "glass":
				n_glass += 1
			else:
				n_glow += 1
		NightGlow.set_night(1.0, scene)
		await process_frame
		var lights := scene.get_node_or_null(NightGlow.NODE_NAME)
		var lit := 0
		var pts := 0
		if lights != null:
			lights.call("pick_now")
			lit = int(lights.call("lit_count"))
			var cam := root.get_viewport().get_camera_3d()
			var ps: PackedVector3Array = lights.get("_points")
			if cam != null and not ps.is_empty():   # 등 곁으로 카메라를 옮겨 점광이 켜지는지(시작 자리에선 멀 수 있다)
				cam.global_position = ps[0] + Vector3(0, 2, 3)
				lights.call("pick_now")
				lit = int(lights.call("lit_count"))
				if lit == 0:
					_fail("④ %s 등 곁인데 점광 0" % key)
			pts = int(lights.call("point_count"))
			for l in lights.get_children():
				if l is OmniLight3D and (l as OmniLight3D).shadow_enabled:
					_fail("④ %s 점광 그림자 켜짐" % key)
			if lit > NightGlow.MAX_LIGHTS:
				_fail("④ %s 점광 %d > %d" % [key, lit, NightGlow.MAX_LIGHTS])
		elif n_glow > 0:
			_fail("④ %s 밤인데 NightGlowLights 없음" % key)
		print("NIGHT %s glow_mats=%d glass_mats=%d points=%d lit=%d" % [key, n_glow, n_glass, pts, lit])
		total_glow = n_glow
		total_glass = n_glass
		await _unload(scene)
	if total_glow == 0:
		_fail("① 불 면 재질이 하나도 안 모임")
	if total_glass == 0:
		_fail("① 창 재질이 하나도 안 모임")
	## ②③ 세기
	NightGlow.set_night(0.0)
	var day := {}
	for e in NightGlow._mats:
		day[e[0]] = (e[0] as StandardMaterial3D).emission_energy_multiplier
	NightGlow.set_night(1.0)
	for e in NightGlow._mats:
		var m := e[0] as StandardMaterial3D
		if String(e[1]) == "glass":
			if not m.emission_enabled or m.emission_energy_multiplier <= 0.0:
				_fail("③ 창 밤 emission 0")
		elif m.emission_energy_multiplier < float(day[m]) * 3.0 - 0.001:
			_fail("② 불 면 밤 %.2f < 낮 %.2f × 3" % [m.emission_energy_multiplier, float(day[m])])
	for e in NightGlow._shaders:
		if is_instance_valid(e[0]) and float((e[0] as ShaderMaterial).get_shader_parameter("emission_energy")) <= 0.0:
			_fail("③ 곡률 셰이더 %s 밤 emission 0" % e[1])
	NightGlow.set_night(0.0)
	## 손잡이 0 — 모은 재질은 이미 있으니 새로 안 늘고, 밤이어도 노드가 안 붙는다
	OS.set_environment("SAGA_NIGHT_GLOW", "0")
	var before: int = NightGlow._mats.size()
	var off: Node = await _load(SCENES["STORY"])
	NightGlow.set_night(1.0, off)
	await process_frame
	if off.get_node_or_null(NightGlow.NODE_NAME) != null:
		_fail("⑤ SAGA_NIGHT_GLOW=0 인데 NightGlowLights 붙음")
	if NightGlow._mats.size() != before:
		_fail("⑤ SAGA_NIGHT_GLOW=0 인데 재질이 더 모임")
	await _unload(off)
	OS.set_environment("SAGA_NIGHT_GLOW", "")
	OS.set_environment("SAGA_HOUR", "")
	print("PROBE night_glow ", "OK" if fails == 0 else "FAIL %d" % fails)
	quit(1 if fails > 0 else 0)
