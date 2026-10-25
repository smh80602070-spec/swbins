extends SceneTree

## G-0252 PBR 사진 땅 두 판 자동 점검(2나락 방·문·통로 · 5천하 지도 땅·도읍 원반).
##   godot --headless --path saga-godot --script res://tools/probe_real_ground2.gd
## ① 공용 triplanar_material(c) 기본 호출 = 지금과 같음(풀·흙·바위 _hi · gain · blotch 0.45 — 3마을 안 바뀜)
## ② TestRoom: RoomMesh·문·통로 표면 중 표에 있는 재질은 전부 curved_triplanar 양면 변종(원본 cull 끔) + tiles_real, 용암 줄(white_stucco)은 원본 · (mood, 재질) 같으면 인스턴스 하나
## ③ SAGA_DUNGEON_OLD=1 → 덮개 없음(원본 toon)
## ④ TestCity: MapGround·CityGround = curved_triplanar(풀·흙·자갈) ⑤ SAGA_REALM_OLD=1 → curved_vertex_color
## 저장은 안 한다. 끝에 "PROBE real_ground2 OK|FAIL n".

const WCM := preload("res://saga_core/world/world_curve_material.gd")
const RealSurface := preload("res://games/saga_dungeon/world/dungeon_real_surface.gd")
const ROOM := "res://games/saga_dungeon/world/TestRoom.tscn"
const CITY := "res://games/saga_realm/world/TestCity.tscn"
const TRI := "res://saga_core/shaders/curved_triplanar.gdshader"
const VC := "res://saga_core/shaders/curved_vertex_color.gdshader"
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


func _shader(m: Material) -> String:
	return (m as ShaderMaterial).shader.resource_path if m is ShaderMaterial and (m as ShaderMaterial).shader != null else ""


func _kit_meshes(scene: Node) -> Array[MeshInstance3D]:
	var out: Array[MeshInstance3D] = []
	for n in scene.find_children("*", "MeshInstance3D", true, false):
		var nm := String(n.name)
		if nm == "RoomMesh" or nm.ends_with("Gate") or nm.begins_with("CorridorTile"):
			out.append(n as MeshInstance3D)
	return out


func _initialize() -> void:
	# ①
	var d := WCM.triplanar_material(0.004)
	check(_shader(d) == TRI and _tex(d, "grass_albedo") == REAL + "grass_hi.webp" and _tex(d, "dirt_albedo") == REAL + "dirt_hi.webp"
		and _tex(d, "stone_albedo") == REAL + "rock_hi.webp" and _tex(d, "stone_normal") == REAL + "rock_hi_n.webp"
		and d.get_shader_parameter("stone_gain") == Vector3(0.946, 0.875, 0.768) and d.get_shader_parameter("grass_gain") == Vector3(1.418, 2.341, 1.544)
		and is_equal_approx(float(d.get_shader_parameter("blotch")), 0.45) and is_equal_approx(float(d.get_shader_parameter("photo_color")), 0.35),
		"기본 triplanar_material: 풀·흙·바위 _hi · gain 그대로 · blotch 0.45 · photo 0.35 (3마을 그대로)")

	# ② ③
	for old in [false, true]:
		OS.set_environment("SAGA_DUNGEON_OLD", "1" if old else "")
		var scene := await _open(ROOM)
		var kits := _kit_meshes(scene)
		var swapped := 0
		var kept := 0
		var bad: Array[String] = []
		var inst := {}
		var shared_ok := true
		var stucco := 0
		for mi in kits:
			for i in mi.mesh.get_surface_count():
				var orig := mi.mesh.surface_get_material(i)
				var ov := mi.get_surface_override_material(i)
				var want := RealSurface.set_for(orig.resource_name) if orig != null else ""
				if orig != null and orig.resource_name == "white_stucco":
					stucco += 1
				if old or want == "":
					if ov != null:
						bad.append("%s#%d 덮개 있음" % [mi.name, i])
					kept += 1
					continue
				if not (ov is ShaderMaterial and (ov as ShaderMaterial).shader == RealSurface.two_sided_shader() and RealSurface.two_sided_shader().code == RealSurface.cutaway_code((load(TRI) as Shader).code.replace("cull_back", "cull_disabled"))) or _tex(ov, "grass_albedo") != REAL + want + "_hi.webp" or _tex(ov, "grass_normal") != REAL + want + "_hi_n.webp":
					bad.append("%s#%d %s → %s" % [mi.name, i, orig.resource_name, _tex(ov, "grass_albedo")])
					continue
				swapped += 1
				var mood := "?"
				var tp := (orig as BaseMaterial3D).albedo_texture.resource_path if orig is BaseMaterial3D and (orig as BaseMaterial3D).albedo_texture != null else ""
				for md: String in ["dirt", "limestone", "lava"]:
					if tp.contains("_%s_" % md):
						mood = md
				var mk := mood + "/" + orig.resource_name
				if not inst.has(mk):
					inst[mk] = {}
				inst[mk][ov.get_instance_id()] = true
		if old:
			check(kits.size() >= 3 and swapped == 0 and bad.is_empty(), "SAGA_DUNGEON_OLD=1: 방·문·통로 %d 개 덮개 0 (%s)" % [kits.size(), ", ".join(bad.slice(0, 3))])
		else:
			# 같은 (mood, 재질) → 인스턴스 하나: 서로 다른 인스턴스 수 = 캐시 칸 수와 같아야
			var ids := {}
			for k: String in inst:
				shared_ok = shared_ok and (inst[k] as Dictionary).size() == 1 and RealSurface._cache.has(k) and (inst[k] as Dictionary).has(RealSurface._cache[k].get_instance_id())
				for id in inst[k]:
					ids[id] = true
			shared_ok = shared_ok and ids.size() == inst.size() and RealSurface._cache.size() <= 6
			check(kits.size() >= 3 and swapped >= kits.size() and bad.is_empty(), "방·문·통로 %d 개 · 바꾼 표면 %d · 원본 둔 표면 %d(용암 줄 %d) (%s)" % [kits.size(), swapped, kept, stucco, ", ".join(bad.slice(0, 3))])
			check(shared_ok, "같은 (mood, 재질) 인스턴스 하나: 칸 %s → 재질 %d · 캐시 %d (≤6)" % [str(inst.keys()), ids.size(), RealSurface._cache.size()])
			var m: ShaderMaterial = RealSurface._cache.get("dirt/brown_mud")
			check(m != null and is_zero_approx(float(m.get_shader_parameter("blotch"))) and is_zero_approx(float(m.get_shader_parameter("photo_color")))
				and (m.get_shader_parameter("grass_gain") as Vector3).x < 0.3 and m.get_shader_parameter("grass_gain") == m.get_shader_parameter("stone_gain"),
				"흙 방 바닥: blotch 0 · photo 0 · 세 슬롯 같은 gain(원본 평균 맞춤, 어둠 유지)")
		await _close(scene)
	OS.set_environment("SAGA_DUNGEON_OLD", "")

	# ④ ⑤
	for old in [false, true]:
		OS.set_environment("SAGA_REALM_OLD", "1" if old else "")
		var scene := await _open(CITY)
		var res: Array[String] = []
		for nm in ["MapGround", "CityGround"]:
			var n := scene.find_child(nm, true, false) as MeshInstance3D
			if n == null:
				res.append("%s 없음" % nm)
				continue
			var m := n.material_override
			if old:
				if _shader(m) != VC:
					res.append("%s %s" % [nm, _shader(m)])
			elif _shader(m) != TRI or _tex(m, "grass_albedo") != REAL + ("field_mix" if ResourceLoader.exists(REAL + "field_mix_hi.webp") else "grass") + "_hi.webp" or _tex(m, "stone_albedo") != REAL + "gravel_hi.webp" or _tex(m, "dirt_normal") != REAL + "dirt_hi_n.webp":
				res.append("%s %s %s" % [nm, _shader(m), _tex(m, "stone_albedo")])
		check(res.is_empty(), ("SAGA_REALM_OLD=1: 지도 땅·도읍 원반 = vertex_color" if old else "지도 땅·도읍 원반 = curved_triplanar 풀·흙·자갈") + (" (%s)" % ", ".join(res) if not res.is_empty() else ""))
		await _close(scene)
	OS.set_environment("SAGA_REALM_OLD", "")

	print("PROBE real_ground2 ", "OK" if fails == 0 else "FAIL %d" % fails)
	quit(1 if fails > 0 else 0)
