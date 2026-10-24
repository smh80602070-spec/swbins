extends SceneTree
## G-0344 2나락 피 구슬 점검 —
##   godot --headless --path saga-godot --script res://tools/probe_globe.gd   → "PROBE globe OK" / "FAIL n"
## ① 떨굼 — 우두머리 셋·정예 하나·잡졸 22% 안팎(씨앗 고정 400번) ② 끌려와 먹음 — 최대 체력 12% · 구슬 사라짐
## ③ 가득이면 안 먹고 그 자리에 남음 ④ 수명 끝 → 사라짐 ⑤ SAGA_GLOBE=0 → 안 떨굼 ⑥ 적 쓰러짐 고리

const Globe := preload("res://games/saga_dungeon/world/health_globe.gd")

var fails := 0


func check(ok: bool, msg: String) -> void:
	print("  %s %s" % ["OK  " if ok else "FAIL", msg])
	if not ok:
		fails += 1


func _initialize() -> void:
	_run.call_deferred()


func _globes() -> Array:
	return get_nodes_in_group("dungeon_health_globe")


func _clear() -> void:
	for g in _globes():
		g.remove_from_group("dungeon_health_globe")
		g.queue_free()


func _run() -> void:
	var sc := (load("res://games/saga_dungeon/world/TestRoom.tscn") as PackedScene).instantiate()
	root.add_child(sc)
	current_scene = sc
	for _i in 30:
		await process_frame
	var pl := get_first_node_in_group("player") as Node3D
	var h := get_first_node_in_group("player_health")
	if pl == null or h == null:
		check(false, "준비 pl=%s health=%s" % [pl, h])
		_finish()
		return
	for b in sc.find_children("*", "CharacterBody3D", true, false):
		if b != pl:
			b.set_physics_process(false)
			(b as Node3D).global_position += Vector3(300, 0, 300)
	pl.set_physics_process(false)
	_clear()
	await process_frame

	# ①
	var nb := Globe.drop(sc, pl.global_position + Vector3(20, 0, 0), true, false)
	var ne := Globe.drop(sc, pl.global_position + Vector3(20, 0, 0), false, true)
	seed(20260824)
	var nn := 0
	for i in 400:
		nn += Globe.drop(sc, pl.global_position + Vector3(20, 0, 0), false, false)
	var rate := float(nn) / 400.0
	check(nb == 3 and ne == 1 and rate > 0.15 and rate < 0.30, "① 우두머리 %d · 정예 %d · 잡졸 %.2f" % [nb, ne, rate])
	_clear()
	await process_frame

	# ②
	var mx := float(h.get("max_hp"))
	h.set("hp", mx * 0.5)
	Globe.drop(sc, pl.global_position + Vector3(2.0, 0, 0), true, false)
	for g in _globes().slice(1):
		g.remove_from_group("dungeon_health_globe")
		g.queue_free()
	for _i in 30:
		await physics_frame
	var hp2 := float(h.get("hp"))
	check(_globes().is_empty() and is_equal_approx(hp2, mx * 0.62), "② 끌려와 먹음 %.0f → %.0f(최대 %.0f의 12%%)" % [mx * 0.5, hp2, mx])

	# ③
	h.set("hp", mx)
	Globe.drop(sc, pl.global_position + Vector3(1.5, 0, 0), false, true)
	var g3: Node3D = _globes()[0] if not _globes().is_empty() else null
	var p3 := g3.global_position if g3 else Vector3.ZERO
	for _i in 20:
		await physics_frame
	check(g3 != null and is_instance_valid(g3) and g3.global_position.is_equal_approx(p3), "③ 가득이면 안 먹고 남음")

	# ④
	if g3 != null and is_instance_valid(g3):
		g3.set("_age", Globe.LIFE_SEC + Globe.FADE_SEC + 0.1)
	for _i in 3:
		await physics_frame
	check(_globes().is_empty(), "④ 수명 끝 → 사라짐")

	# ⑤
	OS.set_environment("SAGA_GLOBE", "0")
	check(Globe.drop(sc, pl.global_position, true, false) == 0, "⑤ SAGA_GLOBE=0 → 안 떨굼")
	OS.set_environment("SAGA_GLOBE", "")

	# ⑥
	var src := FileAccess.get_file_as_string("res://games/saga_dungeon/world/dungeon_enemy.gd")
	check(src.contains("health_globe.gd\").drop(get_parent(), global_position, is_boss"), "⑥ 적 쓰러짐 → 떨굼")
	_finish()


func _finish() -> void:
	print("PROBE globe %s" % ("OK" if fails == 0 else "FAIL %d" % fails))
	quit(0 if fails == 0 else 1)
