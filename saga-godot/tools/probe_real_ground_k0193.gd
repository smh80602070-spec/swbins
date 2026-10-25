extends SceneTree

## G-0404 K-0193 땅 섞음 결 셋·깃대 GLB 자동 점검.
##   godot --headless --path saga-godot --script res://tools/probe_real_ground_k0193.gd
## ① 공용 triplanar_material: 세트를 주면 그 _hi + SET_GAIN · 없는 세트는 그 슬롯 기본(다른 PC 안전)
## ② 2나락 brown_mud → mud_gravel(세트 없으면 dirt) · 흙 방 바닥 재질 그림
## ③ 3마을 땅 흙 슬롯 = path_grass · 풀·돌 그대로
## ④ 5천하 지도 땅·도읍 원반 풀 슬롯 = field_mix
## ⑤ 3마을 사고 다 모음 깃발 = banner_pole_01 GLB(높이 3.3 · 바닥 y 2.4), GLB 없으면 옛 도형
## 새 결이 임포트 안 된 PC 는 옛 세트로 물러서는지만 본다. 저장은 안 한다. 끝에 "PROBE real_ground_k0193 OK|FAIL n".

const WCM := preload("res://saga_core/world/world_curve_material.gd")
const RealSurface := preload("res://games/saga_dungeon/world/dungeon_real_surface.gd")
const MUSEUM := "res://games/saga_forest/world/museum.gd"   # 자동 로드(ForestSaveState)를 쓰므로 load() 로
var Museum: GDScript
const FOREST := "res://games/saga_forest/world/TestVillageForest.tscn"
const CITY := "res://games/saga_realm/world/TestCity.tscn"
const REAL := "res://assets/generated/tiles_real/"

var fails := 0


func check(cond: bool, msg: String) -> void:
	if cond:
		print("  ok   ", msg)
	else:
		fails += 1
		print("  FAIL ", msg)


func _frames(n: int) -> void:
	for i in n:
		await process_frame


func _open(path: String) -> Node:
	var scene: Node = (load(path) as PackedScene).instantiate()
	root.add_child(scene)
	current_scene = scene
	await _frames(20)
	return scene


func _close(scene: Node) -> void:
	scene.queue_free()
	await _frames(3)


func _tex(m: Material, p: String) -> String:
	if not (m is ShaderMaterial):
		return ""
	var t = (m as ShaderMaterial).get_shader_parameter(p)
	return (t as Texture2D).resource_path if t is Texture2D else ""


func _has(set_name: String) -> bool:
	return ResourceLoader.exists(REAL + set_name + "_hi.webp")


## 그 세트가 있으면 그것, 없으면 물러설 세트
func _want(set_name: String, fallback: String) -> String:
	return REAL + (set_name if _has(set_name) else fallback) + "_hi.webp"


func _initialize() -> void:
	_run()


func _run() -> void:
	await _frames(2)
	Museum = load(MUSEUM)
	print("새 결 임포트: mud_gravel %s · path_grass %s · field_mix %s · 깃대 %s" % [_has("mud_gravel"), _has("path_grass"), _has("field_mix"), ResourceLoader.exists(Museum.GRAND_FLAG_GLB)])

	# ①
	var m := WCM.triplanar_material(0.0, {"dirt": "path_grass"})
	check(_tex(m, "dirt_albedo") == _want("path_grass", "dirt") and _tex(m, "dirt_height") == _want("path_grass", "dirt").replace("_hi.webp", "_hi_h.webp")
		and _tex(m, "grass_albedo") == REAL + "grass_hi.webp" and _tex(m, "stone_albedo") == REAL + "rock_hi.webp"
		and m.get_shader_parameter("dirt_gain") == WCM.SET_GAIN["path_grass" if _has("path_grass") else "dirt"],
		"triplanar_material 흙 슬롯 = %s · gain 세트 것 · 풀·돌 그대로" % _tex(m, "dirt_albedo").get_file())
	var miss := WCM.triplanar_material(0.0, {"grass": "no_such_set"})
	check(_tex(miss, "grass_albedo") == REAL + "grass_hi.webp" and miss.get_shader_parameter("grass_gain") == WCM.SET_GAIN["grass"],
		"없는 세트는 그 슬롯 기본(grass)으로 물러섬")
	for s: String in ["mud_gravel", "path_grass", "field_mix"]:
		var g: Vector3 = WCM.SET_GAIN[s]
		check(g.x > 0.0 and g.y > 0.0 and g.z > 0.0, "SET_GAIN %s %s" % [s, g])

	# ②
	var want_set := "mud_gravel" if _has("mud_gravel") else "dirt"
	check(RealSurface.set_for("brown_mud") == want_set and RealSurface.set_for("brown_mud.001") == want_set, "2나락 brown_mud → %s" % RealSurface.set_for("brown_mud"))
	if RealSurface.enabled():
		var dm := RealSurface.material("dirt", "brown_mud", RealSurface.set_for("brown_mud"))
		var gg: Vector3 = dm.get_shader_parameter("grass_gain")
		check(_tex(dm, "grass_albedo") == REAL + want_set + "_hi.webp" and _tex(dm, "stone_normal") == REAL + want_set + "_hi_n.webp" and gg.x < 0.3 and gg == dm.get_shader_parameter("stone_gain"),
			"흙 방 바닥 재질 = %s · gain %s(원본 어둠 맞춤)" % [_tex(dm, "grass_albedo").get_file(), gg])

	# ③
	var forest := await _open(FOREST)
	var ground := forest.find_child("Ground", true, false) as MeshInstance3D
	var fm: Material = ground.material_override if ground != null else null
	check(fm != null and _tex(fm, "dirt_albedo") == _want("path_grass", "dirt") and _tex(fm, "grass_albedo") == REAL + "grass_hi.webp" and _tex(fm, "stone_albedo") == REAL + "rock_hi.webp",
		"3마을 땅 흙길 = %s · 풀·돌 그대로" % _tex(fm, "dirt_albedo").get_file())
	await _close(forest)

	# ④
	var city := await _open(CITY)
	var bad: Array[String] = []
	for nm in ["MapGround", "CityGround"]:
		var n := city.find_child(nm, true, false) as MeshInstance3D
		if n == null or _tex(n.material_override, "grass_albedo") != _want("field_mix", "grass") or _tex(n.material_override, "stone_albedo") != REAL + "gravel_hi.webp":
			bad.append(nm)
	check(bad.is_empty(), "5천하 지도 땅·도읍 원반 풀 = %s (%s)" % [_want("field_mix", "grass").get_file(), ", ".join(bad)])
	await _close(city)

	# ⑤
	var mu: Node3D = Museum.new()
	root.add_child(mu)
	await _frames(2)
	for c in mu.get_children():
		if c.name == "BundleGrandFlag":
			c.free()
	mu.call("_spawn_grand_flag")
	var flag := mu.find_child("BundleGrandFlag", false, false) as MeshInstance3D
	if ResourceLoader.exists(Museum.GRAND_FLAG_GLB):
		var ok := flag != null and not (flag.mesh is CylinderMesh)
		var h := 0.0
		var bottom := 0.0
		if ok:
			var ab := flag.mesh.get_aabb()
			h = ab.size.y * flag.scale.y
			bottom = flag.position.y + ab.position.y * flag.scale.y
		check(ok and absf(h - Museum.GRAND_FLAG_H) < 0.01 and absf(bottom - 2.4) < 0.01 and flag.mesh.surface_get_material(0) is ShaderMaterial,
			"사고 깃대 = banner_pole_01 GLB · 높이 %.2f · 바닥 y %.2f · 곡률 재질" % [h, bottom])
	else:
		check(flag != null and flag.mesh is CylinderMesh, "깃대 GLB 없음 → 옛 도형")
	mu.queue_free()
	await _frames(2)

	print("PROBE real_ground_k0193 ", "OK" if fails == 0 else "FAIL %d" % fails)
	quit(1 if fails > 0 else 0)
