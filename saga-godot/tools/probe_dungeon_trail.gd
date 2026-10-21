extends SceneTree

## G-0290 2나락 무기 등급 잔광 자동 점검 —
##   godot --headless --path saga-godot --script res://tools/probe_dungeon_trail.gd   → "PROBE dungeon_trail OK" / "FAIL n"
## 등급 0~4 무기를 차례로 끼고 한 번 휘두름: 상품(0)은 궤적 0 · 양품부터 1 개, 색 = TIERS 색 · TRAIL_SEC 가 단마다 늚.
## 무기는 점검 끝에 되돌린다(세이브 안 함). autoload 는 이름(/root/<이름>)으로.

var fails := 0


func _fail(msg: String) -> void:
	fails += 1
	print("  FAIL ", msg)


func _init() -> void:
	await process_frame
	var sc := (load("res://games/saga_dungeon/world/TestRoom.tscn") as PackedScene).instantiate()
	root.add_child(sc)
	current_scene = sc
	for _i in 30:
		await process_frame
	var eq := root.get_node("/root/DungeonEquipmentState")
	var items: GDScript = load("res://games/saga_dungeon/data/dungeon_items.gd")
	var melee := get_first_node_in_group("melee_attack")
	var secs: Array = melee.get("TRAIL_SEC")
	for i in range(1, secs.size()):
		if float(secs[i]) <= float(secs[i - 1]):
			_fail("TRAIL_SEC 가 단마다 안 늚 %s" % [secs])
	var w0: Dictionary = eq.get("weapon")
	for t in 5:
		eq.call("equip", "weapon", items.call("roll", 5, "weapon", t, true))
		var before := _slashes()
		melee.set("_cooldown_left", 0.0)
		melee.call("try_attack")
		await process_frame
		var after := _slashes()
		var made := after.size() - before.size()
		var want := 0 if t == 0 else 1
		if made != want:
			_fail("등급 %d 궤적 %d != %d" % [t, made, want])
		elif want == 1:
			var col: Color = (after[after.size() - 1].material_override as ShaderMaterial).get_shader_parameter("color")
			var tc := Color(String(items.get("TIERS")[t].color))
			if not col.is_equal_approx(tc):
				_fail("등급 %d 색 %s != %s" % [t, col, tc])
		print("TRAIL tier=%d made=%d" % [t, made])
	eq.call("equip", "weapon", w0)
	print("PROBE dungeon_trail ", "OK" if fails == 0 else "FAIL %d" % fails)
	quit(1 if fails > 0 else 0)


func _slashes() -> Array:
	var out: Array = []
	for n in current_scene.get_children():
		if n is MeshInstance3D and (n as MeshInstance3D).material_override is ShaderMaterial \
				and String(((n as MeshInstance3D).material_override as ShaderMaterial).shader.resource_path).ends_with("slash_trail.gdshader") \
				and not n.is_queued_for_deletion():
			out.append(n)
	return out
