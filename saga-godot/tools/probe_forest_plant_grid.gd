extends SceneTree

## G-0186 3마을 심을 칸·격자 자동 점검(games/saga_forest/world/plant_grid_overlay.gd · forest_planting.gd cell_of/can_plant_at).
##   godot --headless --path saga-godot --script res://tools/probe_forest_plant_grid.gd
## ① 칸 셈 경계(칸 모서리 ±0.01m) ② can_plant_at = 풀밭 '.' 만(옛 거절식 tile_at != "." 과 같다) ③ 꽃이 없으면 발밑 칸 숨김 · 있으면 보임 · 집 안(마을 밖 먼 좌표)이면 숨김
## ④ 심은 꽃 셋 → 격자 한 메시(그리기 1) · 노드는 발밑·격자 둘뿐 ⑤ 마을 카메라: belt 꺼짐·yaw 0·pitch 그대로(실제 55° — tscn 의 62 는 앞 ## 줄 때문에 안 먹는다, 웹 W-0160 도 55°).
## 세이브는 안 건드린다(items·planted 되돌림). 끝에 "PROBE forest_plant_grid OK|FAIL n".

var Planting: GDScript   # autoload(ForestSaveState)를 쓰는 스크립트라 const preload 말고 load()
const ForestMap := preload("res://games/saga_forest/data/village_map.gd")
const SCENE := "res://games/saga_forest/world/TestVillageForest.tscn"

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


func _initialize() -> void:
	Planting = load("res://games/saga_forest/world/forest_planting.gd")
	var F: Node = root.get_node("ForestSaveState")
	var saved_items: Dictionary = (F.items as Dictionary).duplicate(true)
	var saved_planted: Array = (F.planted as Array).duplicate(true)
	F.items = {}
	F.planted = []

	# ① ②
	var corner := ForestMap.world_pos(10, 5)
	check(Planting.cell_of(corner + Vector3(0.01, 0, 0.01)) == Vector2i(10, 5) and Planting.cell_of(corner - Vector3(0.01, 0, 0.01)) == Vector2i(9, 4), "칸 셈: 모서리 +0.01 → (10,5) · −0.01 → (9,4)")
	var same := true
	var grass := 0
	var s := ForestMap.size()
	for y in s.y:
		for x in s.x:
			var c := Vector2i(x, y)
			same = same and Planting.can_plant_at(c) == (ForestMap.tile_at(x, y) == ".")
			if Planting.can_plant_at(c):
				grass += 1
	check(same and grass > 0 and not Planting.can_plant_at(Vector2i(-1, 0)), "심을 수 있는 칸 = 풀밭 '.' 만(%d칸 · 옛 거절식과 같다 · 지도 밖 거절)" % grass)

	var scene: Node = (load(SCENE) as PackedScene).instantiate()
	root.add_child(scene)
	current_scene = scene
	await _frames(20)
	var ov := scene.find_child("PlantGridOverlay", true, false)
	var player := get_first_node_in_group("player") as Node3D
	if ov == null or player == null:
		check(false, "발밑 칸 노드·플레이어를 못 찾음")
	else:
		# ③
		var gc := Vector2i(-1, -1)
		for y in s.y:
			for x in s.x:
				if gc.x < 0 and ForestMap.tile_at(x, y) == ".":
					gc = Vector2i(x, y)
		player.global_position = ForestMap.world_pos(gc.x + 0.5, gc.y + 0.5) + Vector3(0, player.global_position.y, 0)
		ov.call("tick")
		var hidden_no_flower: bool = not ov.cursor.visible
		F.items = {Planting.ITEM_LABEL_NORMAL: 2}
		ov.call("tick")
		var shown: bool = ov.cursor.visible and ov.cursor_cell == gc and ov.cursor_ok
		player.global_position = Vector3(500, player.global_position.y, 500)   # 집 안 먼 좌표(forest_house INTERIOR_ORIGIN)
		ov.call("tick")
		var hidden_house: bool = not ov.cursor.visible
		check(hidden_no_flower and shown and hidden_house, "발밑 칸: 꽃 없으면 숨김 · 꽃 들고 풀밭 %s 이면 초록 · 집 안이면 숨김" % str(gc))
		# ④
		F.planted = [{"x": 0.0, "z": 0.0, "day": 0}, {"x": 3.0, "z": 0.0, "day": 0}, {"x": 20.0, "z": 9.0, "day": 0}]
		ov.call("tick")
		var meshes := (ov as Node).find_children("*", "MeshInstance3D", true, false)
		check(ov.grid.visible and ov.grid.mesh != null and (ov.grid.mesh as ArrayMesh).get_surface_count() == 1 and meshes.size() == 2, "심은 꽃 셋 → 격자 한 메시 · 노드는 발밑·격자 둘(그리기 ≤2)")
		# ⑤
		var rig := player.get_node_or_null("CameraRig") as Node3D
		check(rig != null and not bool(rig.get("_belt_on")) and is_equal_approx(rig.rotation_degrees.y, 0.0) and is_equal_approx(rig.rotation_degrees.x, -float(rig.get("pitch_deg"))), "마을 카메라: 벨트 꺼짐 · yaw 0 · pitch −%.0f 그대로" % float(rig.get("pitch_deg")))
	scene.queue_free()
	await _frames(3)
	F.items = saved_items
	F.planted = saved_planted
	print("PROBE forest_plant_grid ", "OK" if fails == 0 else "FAIL %d" % fails)
	quit(1 if fails > 0 else 0)
