extends Node
## G-0065 [R-3] 사가만리 툰 물·손그림 하늘(features gd.go.g1-toon) 자동 점검 — 평소엔 안 붙는다. test_village.gd 가 SAGA_TOON_LOOK_PROBE 가 있을 때만 단다.
##   SAGA_TOON_LOOK_PROBE=1 "$GODOT" --headless --path saga-godot res://games/saga_go/world/TestVillage.tscn
## ① WorldEnvironment 하늘 재질 셰이더가 sky_toon ② 물 메시 하나 이상이 water_toon 재질. 끝에 "TOON_LOOK_PROBE_DONE fails=N".

var _frame := 0
var _fails := 0


func _check(name: String, ok: bool, info := "") -> void:
	print("TOON_LOOK_PROBE %s %s %s" % [name, "ok" if ok else "FAIL", info])
	if not ok:
		_fails += 1


func _physics_process(_delta: float) -> void:
	_frame += 1
	if _frame != 20:
		return
	var sky_ok := false
	for we in get_tree().root.find_children("*", "WorldEnvironment", true, false):
		var env := (we as WorldEnvironment).environment
		if env != null and env.sky != null and env.sky.sky_material is ShaderMaterial:
			var sh := (env.sky.sky_material as ShaderMaterial).shader
			sky_ok = sky_ok or (sh != null and (sh.resource_path.ends_with("sky_toon.gdshader") or sh.resource_path.ends_with("sky_real.gdshader")))   # G-0141 GO 는 sky_real
	_check("sky_toon", sky_ok)
	var water := 0
	for mi in get_tree().root.find_children("*", "MeshInstance3D", true, false):
		var m := mi as MeshInstance3D
		var mats: Array = [m.material_override]
		if m.mesh != null:
			for i in m.mesh.get_surface_count():
				mats.append(m.get_surface_override_material(i))
				mats.append(m.mesh.surface_get_material(i))
		for mat in mats:
			if mat is ShaderMaterial and (mat as ShaderMaterial).shader != null and ((mat as ShaderMaterial).shader.resource_path.ends_with("water_toon.gdshader") or (mat as ShaderMaterial).shader.resource_path.ends_with("water_real.gdshader")):   # G-0140 강·바다는 water_real
				water += 1
				break
	_check("water_toon", water >= 1, "물 메시 %d" % water)
	print("TOON_LOOK_PROBE_DONE fails=%d" % _fails)
	get_tree().quit()
