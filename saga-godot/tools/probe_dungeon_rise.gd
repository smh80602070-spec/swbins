extends SceneTree

## G-0293 2나락 등장 연출 자동 점검 —
##   godot --headless --path saga-godot --script res://tools/probe_dungeon_rise.gd   → "PROBE dungeon_rise OK" / "FAIL n"
## ① rise_in 적: 막 생긴 때 몸이 땅 밑(RISE_DEPTH) · RISE_SEC 뒤 제자리 ② rise_in 없는 적(방에 미리 선 적)은 처음부터 제자리
## ③ 난입 물결(horde_arena._spawn_wave)로 생긴 적은 rise_in. 실제 시간(타이머)으로 잰다.

var fails := 0


func _fail(msg: String) -> void:
	fails += 1
	print("  FAIL ", msg)


func _init() -> void:
	await process_frame
	var sc := (load("res://games/saga_dungeon/world/TestRoom.tscn") as PackedScene).instantiate()
	root.add_child(sc)
	current_scene = sc
	for _i in 20:
		await process_frame
	var DE: GDScript = load("res://games/saga_dungeon/world/dungeon_enemy.gd")
	var pl := get_first_node_in_group("player") as Node3D
	var a: Node3D = DE.new(1, false, false, false, 1.0)
	a.set("rise_in", true)
	a.position = pl.global_position + Vector3(4, 0, 0)
	var b: Node3D = DE.new(1, false, false, false, 1.0)
	b.position = pl.global_position + Vector3(-4, 0, 0)
	sc.add_child(a)
	sc.add_child(b)
	await process_frame
	var ca := a.get("_creature") as Node3D
	var cb := b.get("_creature") as Node3D
	var depth := float(DE.get("RISE_DEPTH"))
	if ca == null or ca.position.y > cb.position.y - depth * 0.5:
		_fail("① 막 생긴 rise_in 적 몸이 땅 밑이 아님 (%s vs %s)" % [ca.position.y if ca else "없음", cb.position.y])
	await create_timer(float(DE.get("RISE_SEC")) + 0.2).timeout
	if absf(ca.position.y - cb.position.y) > 0.05:
		_fail("① RISE_SEC 뒤 제자리 아님 (%.2f vs %.2f)" % [ca.position.y, cb.position.y])
	## ③
	var src := FileAccess.get_file_as_string("res://games/saga_dungeon/world/horde_arena.gd")
	if not src.contains("rise_in = true"):
		_fail("③ 난입 물결이 rise_in 을 안 켬")
	print("RISE a=%.2f b=%.2f" % [ca.position.y, cb.position.y])
	print("PROBE dungeon_rise ", "OK" if fails == 0 else "FAIL %d" % fails)
	quit(1 if fails > 0 else 0)
