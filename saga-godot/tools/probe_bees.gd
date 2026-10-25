extends SceneTree
## G-0346 3마을 벌집 점검 —
##   godot --headless --path saga-godot --script res://tools/probe_bees.gd   → "PROBE bees OK" / "FAIL n"
## ① 벌집 굴림 — 나무·소나무만 · 하루·나무 씨앗 고정 · 365일 중 20% 안팎 ② 벌떼가 쫓아와 붙으면 모임
## ③ 모임 중 [G] → 잡음·곤충 +2 ④ 놓치면 쏘임(못 움직임 → 1.2초 뒤 풀림) ⑤ 8초 못 붙으면 흩어짐 ⑥ SAGA_BEES=0 → 없음 ⑦ 흔들기 고리

var Bees: GDScript = null   # autoload(ForestSaveState·CombatFeel)을 쓰는 스크립트라 실행 뒤 load

var fails := 0


func check(ok: bool, msg: String) -> void:
	print("  %s %s" % ["OK  " if ok else "FAIL", msg])
	if not ok:
		fails += 1


func _initialize() -> void:
	_run.call_deferred()


func _run() -> void:
	var sc := (load("res://games/saga_forest/world/TestVillageForest.tscn") as PackedScene).instantiate()
	root.add_child(sc)
	current_scene = sc
	for _i in 30:
		await process_frame
	Bees = load("res://games/saga_forest/world/forest_bees.gd")
	var F: Node = root.get_node("ForestSaveState")
	var pl := get_first_node_in_group("player") as CharacterBody3D
	if pl == null:
		check(false, "준비 player 없음")
		_finish()
		return
	pl.set_physics_process(false)
	paused = false   # 3마을은 첫 창(시나리오·인사) 동안 멈춰 있다 — 벌떼는 게임과 같이 멈추는 게 맞음
	for m in get_nodes_in_group("ui_modal"):
		m.queue_free()

	# ①
	var hits := 0
	for d in 365:
		if bool(Bees.call("hive_roll", d, "gather_tree")):
			hits += 1
	var same := bool(Bees.call("hive_roll", 42, "gather_pine")) == bool(Bees.call("hive_roll", 42, "gather_pine"))
	var rock := false
	for d in 100:
		rock = rock or bool(Bees.call("hive_roll", d, "gather_rock"))
	check(hits > 45 and hits < 105 and same and not rock, "① 나무 365일 중 %d번 · 같은 날 같음 · 바위 없음" % hits)

	# ②
	var b: Node3D = Bees.call("spawn", sc, pl.global_position + Vector3(6, 0, 0))
	var got_near := false
	for _i in 120:
		paused = false
		await physics_frame
		if b != null and is_instance_valid(b) and int(b.get("state")) == 1:
			got_near = true
			break
	check(b != null and got_near, "② 쫓아와 붙음 → 모임")
	var src_g := FileAccess.get_file_as_string("res://games/saga_forest/world/gatherable_builder.gd")
	check(bool(Bees.call("any_gathering", self)) and src_g.contains("forest_bees.gd\").any_gathering(get_tree())"), "② 모이는 중 = any_gathering · 채집 [G] 폴링은 건너뜀(R-5)")

	# ③
	var bug0 := int(F.items.get("곤충", 0))
	var c0 := int(Bees.get("caught"))
	var ok3: bool = b.call("try_catch") if b != null and is_instance_valid(b) else false
	check(ok3 and int(Bees.get("caught")) == c0 + 1 and int(F.items.get("곤충", 0)) == bug0 + 2, "③ 모임 중 [G] → 잡음 곤충 %d → %d" % [bug0, int(F.items.get("곤충", 0))])

	# ④
	var b4: Node3D = Bees.call("spawn", sc, pl.global_position + Vector3(0.5, 0, 0))
	var had4 := b4 != null
	var s0 := int(Bees.get("stung"))
	var froze := false
	for _i in 90:
		paused = false
		await physics_frame
		froze = froze or bool(pl.get("frozen"))
		if int(Bees.get("stung")) > s0:
			break
	var stung_now := int(Bees.get("stung")) == s0 + 1 and bool(pl.get("frozen"))
	var t4 := Time.get_ticks_msec()
	for _i in 400:
		paused = false
		await physics_frame
		if not bool(pl.get("frozen")):
			break
	print("  (풀리기까지 %d ms)" % (Time.get_ticks_msec() - t4))
	check(had4 and stung_now and not bool(pl.get("frozen")), "④ 놓치면 쏘임(못 움직임) → 1.2초 뒤 풀림")

	# ⑤
	var b5: Node3D = Bees.call("spawn", sc, pl.global_position + Vector3(40, 0, 0))
	b5.set("_age", 7.95)
	var f0 := int(Bees.get("fled"))
	for _i in 10:
		paused = false
		await physics_frame
	check(int(Bees.get("fled")) == f0 + 1 and int(b5.get("state")) == 2, "⑤ 8초 못 붙으면 흩어짐")

	# ⑥
	OS.set_environment("SAGA_BEES", "0")
	check(Bees.call("spawn", sc, pl.global_position) == null, "⑥ SAGA_BEES=0 → 없음")
	OS.set_environment("SAGA_BEES", "")

	# ⑦
	var src := FileAccess.get_file_as_string("res://games/saga_forest/world/gatherable_builder.gd")
	check(src.contains("forest_bees.gd\").hive_roll(today, String(d.id))"), "⑦ 흔들기 → 벌집 굴림")
	_finish()


func _finish() -> void:
	print("PROBE bees %s" % ("OK" if fails == 0 else "FAIL %d" % fails))
	quit(0 if fails == 0 else 1)
