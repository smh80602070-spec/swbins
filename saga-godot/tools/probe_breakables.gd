extends SceneTree
## G-0307 2나락 부서지는 통·항아리 점검 —
##   godot --headless --path saga-godot --script res://tools/probe_breakables.gd   → "PROBE breakables OK" / "FAIL n"
## ① 방마다 둘(정예·중보스 셋, 샘 0) · 자리가 방 안·모델 넷 중 하나 · 다시 지어도 같은 자리·종류
## ② hit_around — 사거리 안만 깸 · 깨면 조각(RigidBody) 넷·금 · 약병 표시면 약병 · 1.4초 뒤 조각 사라짐
## ③ 평타(melee_attack.try_attack)가 곁 소품을 깸 ④ SAGA_BREAKABLE=0 이면 안 놓음

var fails := 0


func _fail(msg: String) -> void:
	fails += 1
	print("  FAIL ", msg)


func _initialize() -> void:
	_run.call_deferred()


func _sig(b: Node) -> String:
	var s := ""
	for p: Node3D in b.call("props"):
		s += "%s@%.1f,%.1f;" % [p.get_meta("model"), p.position.x, p.position.z]
	return s


func _run() -> void:
	var sc := (load("res://games/saga_dungeon/world/TestRoom.tscn") as PackedScene).instantiate()
	root.add_child(sc)
	current_scene = sc
	for _i in 30:
		await process_frame
	var brk := get_first_node_in_group("dungeon_breakables")
	var pl := get_first_node_in_group("player") as Node3D
	if brk == null or pl == null:
		_fail("준비 brk=%s pl=%s" % [brk, pl])
		_finish()
		return
	## ①
	var origins: Array = sc.get("_room_origin_z")
	var kinds: Array = Array(sc.get("ROOM_KINDS")) if sc.get("ROOM_KINDS") != null else []
	var per := {}
	for p: Node3D in brk.call("props"):
		var best := -1
		for i in origins.size():
			if absf(p.position.z - float(origins[i])) <= 6.0 and absf(p.position.x) <= 6.0:
				best = i
		if best < 0:
			_fail("① 방 밖 소품 %s" % p.position)
		per[best] = int(per.get(best, 0)) + 1
		if not (String(p.get_meta("model")) in ["jar_01", "vase_tall_01", "barrel_01", "crate_small_01"]) or p.get_node_or_null("Visual") == null:
			_fail("① 모델 %s" % p.get_meta("model"))
	print("BRK per-room %s kinds %s" % [per, kinds])
	var KINDS := ["elite", "trove", "fight", "well", "miniboss", "fight", "cave"]
	for i in KINDS.size():
		var want := 0 if KINDS[i] == "well" else (3 if KINDS[i] in ["elite", "miniboss"] else 2)
		if int(per.get(i, 0)) != want:
			_fail("① 방 %d(%s) %d개(기대 %d)" % [i, KINDS[i], int(per.get(i, 0)), want])
	var sig1 := _sig(brk)
	var again: Node = load("res://games/saga_dungeon/world/dungeon_breakables.gd").new()
	root.add_child(again)
	again.call("build", origins, KINDS)
	if _sig(again) != sig1:
		_fail("① 다시 지으니 다름")
	again.queue_free()
	## ②
	var props: Array = brk.call("props")
	var target: Node3D = props[0]
	var pot: Node3D = null
	for p: Node3D in props:
		if bool(p.get_meta("potion")) and p != target:
			pot = p
	var c0 := brk.get_child_count()
	var far := target.global_position + Vector3(0, 0, 9.0)
	if int(brk.call("hit_around", far, 2.4)) != 0:
		_fail("② 멀리서 깸")
	var n: int = brk.call("hit_around", target.global_position + Vector3(1.5, 0, 0), 2.4)
	await process_frame
	var shards := 0
	var gold := 0
	for c in brk.get_children():
		if c is RigidBody3D:
			shards += 1
		if String(c.name).begins_with("GoldPickup"):
			gold += 1
	print("BRK hit n=%d shards=%d gold=%d children %d→%d" % [n, shards, gold, c0, brk.get_child_count()])
	if n < 1 or shards < 4 or gold < 1 or is_instance_valid(target) and target.is_in_group("dungeon_breakable"):
		_fail("② 깨기 n=%d 조각 %d 금 %d" % [n, shards, gold])
	if pot != null:
		brk.call("break_prop", pot, Vector3.FORWARD)
		await process_frame
		var potions := 0
		for c in brk.get_children():
			if String(c.name).begins_with("PotionPickup"):
				potions += 1
		if potions < 1:
			_fail("② 약병 표시인데 약병 없음")
	else:
		print("  (약병 표시 소품 없음 — 건너뜀)")
	await create_timer(1.6).timeout
	for c in brk.get_children():
		if c is RigidBody3D:
			_fail("② 조각이 안 사라짐")
			break
	## ③
	var rest: Array = brk.call("props")
	if rest.is_empty():
		_fail("③ 남은 소품 없음")
	else:
		var t2: Node3D = rest[0]
		for e in get_nodes_in_group("dungeon_enemy"):
			(e as Node3D).global_position += Vector3(500, 0, 500)
		pl.global_position = t2.global_position + Vector3(1.2, 0.2, 0)
		var melee := pl.find_child("*Melee*", true, false)
		if melee == null:
			for c in pl.get_children():
				if c.has_method("try_attack"):
					melee = c
		if melee == null:
			_fail("③ 평타 노드 없음")
		else:
			melee.set("_cooldown_left", 0.0)
			melee.call("try_attack")
			if is_instance_valid(t2) and t2.is_in_group("dungeon_breakable"):
				_fail("③ 평타로 안 깨짐")
	## ④
	OS.set_environment("SAGA_BREAKABLE", "0")
	if load("res://games/saga_dungeon/world/dungeon_breakables.gd").call("attach", Node.new(), [0.0], ["fight"]) != null:
		_fail("④ 손잡이 0 인데 놓음")
	OS.set_environment("SAGA_BREAKABLE", "")
	_finish()


func _finish() -> void:
	print("PROBE breakables %s" % ("OK" if fails == 0 else "FAIL %d" % fails))
	quit(0 if fails == 0 else 1)
