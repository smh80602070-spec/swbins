extends SceneTree

## G-0380 2나락 저주받은 상자(world/dungeon_cursed_chest.gd) 점검 —
##   godot --headless --path saga-godot --script res://tools/probe_dungeon_cursed.gd   → "PROBE dungeon_cursed OK" / "FAIL n"
## ① room_for: 씨앗마다 싸움 방(2·5) ② 2나락 방에 하나 붙음 ③ 다가가면 열림·물결이 적을 세움(방 적 수 늘어남)
## ④ 버티면(남은 시간 0) 금 + 전리품 · 끝 ⑤ 새 상자에서 고리 밖으로 나가면 실패(보상 없음) ⑥ 손잡이. 지갑은 되돌린다.

var fails := 0


func check(cond: bool, msg: String) -> void:
	if cond:
		print("  ok   ", msg)
	else:
		fails += 1
		print("  FAIL ", msg)


func _initialize() -> void:
	await process_frame
	var CC: GDScript = load("res://games/saga_dungeon/world/dungeon_cursed_chest.gd")
	var G: Node = root.get_node("DungeonGoldState")
	var gold0: int = G.gold
	check(CC.room_for(0) in [2, 5] and CC.room_for(1) in [2, 5] and CC.room_for(0) != CC.room_for(1), "① 싸움 방 2·5")

	var sc := (load("res://games/saga_dungeon/world/TestRoom.tscn") as PackedScene).instantiate()
	root.add_child(sc)
	current_scene = sc
	for i in 5:
		await process_frame
	paused = false
	var c := sc.get_node_or_null("CursedChest") as Node3D
	check(c != null, "② 방에 상자 하나")
	if c == null:
		print("PROBE dungeon_cursed FAIL %d" % fails)
		quit(1)
		return
	var p := get_first_node_in_group("player") as Node3D
	var e0 := get_nodes_in_group("dungeon_enemy").size()
	p.global_position = c.global_position + Vector3(0.5, 0.1, 0.0)
	for i in 4:
		await physics_frame
	var opened := int(c.get("state")) == 1
	for i in 3:
		await physics_frame
	var e1 := get_nodes_in_group("dungeon_enemy").size()
	check(opened and int(c.get("spawned")) >= 2, "③ 열림 · 물결 %d 마리(적 %d→%d)" % [int(c.get("spawned")), e0, e1])

	var g1: int = G.gold
	c.set("_left", 0.0)
	for i in 3:
		await physics_frame
	var paid: int = G.gold - g1
	check(int(c.get("state")) == 2 and paid >= CC.GOLD * int(c.get("floor_num")), "④ 버팀 — 금 +%d(전리품 주운 몫 포함)" % paid)

	# ⑤ 새 상자 — 실패
	var c2: Node3D = CC.attach(sc, [0.0, -20.0, -40.0, -60.0, -80.0, -100.0, -120.0], 0)
	await process_frame
	p.global_position = c2.global_position + Vector3(0.5, 0.1, 0.0)
	for i in 3:
		await physics_frame
	var g2: int = G.gold
	p.global_position = c2.global_position + Vector3(CC.STAY_R + 3.0, 0.1, 0.0)
	for i in 3:
		await physics_frame
	check(int(c2.get("state")) == 2 and G.gold == g2, "⑤ 고리 밖 — 실패·보상 없음")

	OS.set_environment("SAGA_CURSED", "0")
	var off: Node = CC.attach(Node.new(), [0.0, 1.0, 2.0, 3.0, 4.0, 5.0, 6.0], 0)
	OS.set_environment("SAGA_CURSED", "")
	check(off == null, "⑥ 끄면 없음")

	G.set("gold", gold0)
	print("PROBE dungeon_cursed ", "OK" if fails == 0 else "FAIL %d" % fails)
	quit(1 if fails > 0 else 0)
