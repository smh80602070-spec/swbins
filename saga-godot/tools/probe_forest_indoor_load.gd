extends SceneTree

## G-0376 3마을 집 안 저장 → 불러오기 점검 —
##   godot --headless --path saga-godot --script res://tools/probe_forest_indoor_load.gd   → "PROBE forest_indoor_load OK" / "FAIL n"
## ① indoors_at: 집 안 좌표(INTERIOR_ORIGIN 둘레)만 참 ② 몸이 집 안 좌표에 선 채 첫 _process 를 지나면 is_player_indoors 참
## ③ 마을 자리면 거짓 그대로. 세이브는 안 건드린다(몸 자리만 메모리에서 옮김).

var fails := 0


func check(cond: bool, msg: String) -> void:
	if cond:
		print("  ok   ", msg)
	else:
		fails += 1
		print("  FAIL ", msg)


func _initialize() -> void:
	await process_frame
	var H: GDScript = load("res://games/saga_forest/world/forest_house.gd")
	var o: Vector3 = H.INTERIOR_ORIGIN
	check(H.indoors_at(o + Vector3(0, 0.1, 2)) and not H.indoors_at(Vector3(-15, 0, -3)) and not H.indoors_at(Vector3(0, 0, 0)), "① 집 안 좌표만 참")

	var sc := (load("res://games/saga_forest/world/TestVillageForest.tscn") as PackedScene).instantiate()
	root.add_child(sc)
	current_scene = sc
	for i in 5:
		await process_frame
	var p := get_first_node_in_group("player") as Node3D
	var h := get_first_node_in_group("forest_house")
	# ② 집 안 좌표로 옮기고 다시 맞춤
	p.global_position = o + Vector3(0, 0.1, 2)
	h.set("_player_indoors", false)
	h.set("_indoor_checked", false)
	paused = false   # 이야기 첫 대화가 트리를 멈춘다
	for i in 3:
		await process_frame
	var in_ok := bool(h.call("is_player_indoors"))
	# ③ 마을 자리
	p.global_position = Vector3(-15, 0.1, -3)
	h.set("_player_indoors", false)
	h.set("_indoor_checked", false)
	paused = false   # 이야기 첫 대화가 트리를 멈춘다
	for i in 3:
		await process_frame
	var out_ok := not bool(h.call("is_player_indoors"))
	check(in_ok and out_ok, "② 집 안 좌표면 집 안 %s · ③ 마을이면 바깥 %s" % [in_ok, out_ok])

	print("PROBE forest_indoor_load ", "OK" if fails == 0 else "FAIL %d" % fails)
	quit(1 if fails > 0 else 0)
