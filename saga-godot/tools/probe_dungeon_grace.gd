extends SceneTree

## G-0193 2나락 은총 자리·사망 카드 자동 점검(games/saga_dungeon/world/grace_sites.gd · player/player_health.gd).
##   godot --headless --path saga-godot --script res://tools/probe_dungeon_grace.gd
## ① 은총 표식 = 첫 방 + 샘 방(둘) · 처음엔 첫 방이 은총 ② 샘 방에 들어서면 은총이 샘 방으로 ③ 적에게 맞아 쓰러지면 은총 자리로 옮겨 서고 hp 가득 · 유품은 쓰러진 자리
## ④ 사망 카드 세 줄(어디서 = 그 방 이름·누구에게 = 친 적 이름·무슨 피해 = 마지막 한 대) + 남는 것·잃은 것.
## 금·장비·유품은 끝에 되돌린다(세이브 안 함). 끝에 "PROBE dungeon_grace OK|FAIL n".

const ROOM := "res://games/saga_dungeon/world/TestRoom.tscn"

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
	var Gold: Node = root.get_node("DungeonGoldState")
	var Equip: Node = root.get_node("DungeonEquipmentState")
	var Grave: Node = root.get_node("DungeonGraveState")
	var gold0: int = Gold.gold
	var w0: Dictionary = (Equip.weapon as Dictionary).duplicate(true)
	var c0: Dictionary = (Equip.charm as Dictionary).duplicate(true)
	var grave0: Dictionary = (Grave.grave as Dictionary).duplicate(true)
	var hc: Node = root.get_node("DungeonHardcoreState")
	var hc0: bool = hc.hardcore
	hc.hardcore = false
	var scene: Node = (load(ROOM) as PackedScene).instantiate()
	root.add_child(scene)
	current_scene = scene
	await _frames(20)
	for n in get_nodes_in_group("ui_modal"):   # 출사표 창 등은 닫는다
		if n is CanvasLayer:
			(n as CanvasLayer).queue_free()
	var g := get_first_node_in_group("dungeon_grace")
	var player := get_first_node_in_group("player") as Node3D
	var ph := get_first_node_in_group("player_health")
	if g == null or player == null or ph == null:
		check(false, "은총·플레이어·체력 노드를 못 찾음")
	else:
		# ①
		var well := (g.kinds as Array).find("well")
		check((g._markers as Dictionary).size() == 2 and (g._markers as Dictionary).has(0) and (g._markers as Dictionary).has(well) and g.grace_room == 0, "은총 표식 둘(첫 방·샘 방 %d) · 처음 은총은 첫 방" % (well + 1))
		# ②
		player.global_position = Vector3(0, player.global_position.y, float(g.origins[well]))
		g.tick()
		check(g.grace_room == well and g.grace_pos().distance_to(Vector3(0, 0, float(g.origins[well])) + g.GRACE_OFFSET) < 0.01, "샘 방에 들어서면 은총이 샘 방으로")
		# ③ ④ — 둘째 방(정예 다음 보물 방)에서 적에게 맞아 쓰러짐
		var die_at := Vector3(1.5, player.global_position.y, float(g.origins[1]) + 1.0)
		player.global_position = die_at
		var enemy: Node = get_first_node_in_group("dungeon_enemy")
		Gold.gold = 1000
		ph.call("take_damage", 9999.0, enemy)
		await process_frame
		var at_grace: bool = player.global_position.distance_to(g.grace_pos()) < 0.3 and is_equal_approx(float(ph.hp), float(ph.max_hp))
		var grave_pos: Vector3 = Grave.grave_position()
		check(at_grace and Gold.gold == 800 and grave_pos.distance_to(die_at) < 0.3, "쓰러지면 은총 자리(샘 방)에 서고 hp 가득 · 금 20%% 유품(1000 → %d) · 유품은 쓰러진 자리" % Gold.gold)
		var who := String(enemy.call("who_label")) if enemy != null else ""
		var txt: String = ph.call("death_card_text", 200, String(g.room_label_at(die_at)), ph.last_hit)
		check(enemy != null and "2번째 방 · 보물 방" in txt and who != "" and who in txt and "마지막 한 대 9999" in txt and "남는 것: 도감·인물·공적" in txt and "금 200" in txt,
			"사망 카드: 어디서(2번째 방 · 보물 방)·누구에게(%s)·무슨 피해(9999)·남는 것·잃은 것" % who)
		print("  카드 —\n", txt)
	scene.queue_free()
	await _frames(3)
	Gold.gold = gold0
	Equip.equip("weapon", w0)
	Equip.equip("charm", c0)
	Grave.grave = grave0
	hc.hardcore = hc0
	print("PROBE dungeon_grace ", "OK" if fails == 0 else "FAIL %d" % fails)
	quit(1 if fails > 0 else 0)
