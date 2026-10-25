extends SceneTree

## G-0389 4종횡 사냥터 엘리트(world/story_elite.gd) 점검 —
##   godot --headless --path saga-godot --script res://tools/probe_story_elite.gd   → "PROBE story_elite OK" / "FAIL n"
## ① 사냥터(TestField)에 붙음 ② SAGA_ELITE_N=3 이면 처치 셋째에 엘리트(체력 ×15·「엘리트」·화면 어둡게) · 무리 수 그대로
## ③ 엘리트 처치 덤 곱(elite_mul ×1.25·굴림 셋) 배선 ④ 엘리트 셋 잡으면 엘리트 보스(체력 ×40) ⑤ 보스는 시간 지나면 사라지고 어둠 걷힘
## ⑥ 손잡이 0 = 안 붙음. 세이브는 안 쓴다(경험치·처치 수는 메모리 — 끝에 되돌림 없이 씬만 버림).

var fails := 0


func check(cond: bool, msg: String) -> void:
	if cond:
		print("  ok   ", msg)
	else:
		fails += 1
		print("  FAIL ", msg)


func _kill(e: Node) -> void:
	if e != null and is_instance_valid(e) and e.has_method("_die"):
		e.call("_die")


func _initialize() -> void:
	await process_frame
	OS.set_environment("SAGA_ELITE_N", "3")
	var EL: GDScript = load("res://games/saga_story/world/story_elite.gd")
	var sc := (load("res://games/saga_story/world/TestField.tscn") as PackedScene).instantiate()
	root.add_child(sc)
	current_scene = sc
	for i in 5:
		await process_frame
	paused = false
	var el := sc.find_child("StoryElite", true, false)
	check(el != null, "① 사냥터에 엘리트 노드")
	if el == null:
		print("PROBE story_elite FAIL %d" % fails)
		quit(1)
		return
	var sp: Node = el.get_parent()
	var grunts := func() -> Array:
		return sp.get_children().filter(func(c: Node) -> bool: return c.has_method("_die") and not c.has_meta("elite") and not bool(c.get("_dead")))
	var n0: int = (grunts.call() as Array).size()
	for i in 3:
		_kill((grunts.call() as Array)[0])
		await process_frame
		await process_frame
	var elites: Array = sp.get_children().filter(func(c: Node) -> bool: return c.has_meta("elite"))
	var e: Node = elites[0] if not elites.is_empty() else null
	check(e != null and float(e.get("mini_hp_mul")) == 15.0 and bool(el.call("is_dimmed")), "② 처치 셋째에 엘리트(체력 ×%s · 어둡게 %s)" % [e.get("mini_hp_mul") if e else "-", el.call("is_dimmed")])
	check((grunts.call() as Array).size() == n0, "② 잡몹 수 그대로(%d → %d)" % [n0, (grunts.call() as Array).size()])
	check(e != null and is_equal_approx(float(e.get("elite_mul")), EL.ELITE_EXTRA_MUL) and int(e.get("elite_drops")) == EL.ELITE_DROPS, "③ 덤 곱 ×%.2f·굴림 %d" % [float(e.get("elite_mul")) if e else 0.0, int(e.get("elite_drops")) if e else 0])
	var src := FileAccess.get_file_as_string("res://games/saga_story/world/story_enemy.gd")
	check(src.contains("rare_mul * elite_mul") and src.contains("for _d in elite_drops"), "③ 처치 덤 배선(경험치·금·굴림)")

	_kill(e)
	await process_frame
	for k in 2:
		var e2: Node = el.call("spawn_elite", false)
		await process_frame
		_kill(e2)
		await process_frame
	var boss: Node = el.get("_boss")
	check(boss != null and float(boss.get("mini_hp_mul")) == 40.0 and String(boss.get_meta("elite", "")) == "boss", "④ 엘리트 셋 → 엘리트 보스(체력 ×%s)" % [boss.get("mini_hp_mul") if boss else "-"])
	el.set("_boss_t", 0.05)
	await create_timer(0.2).timeout
	check(el.get("_boss") == null and not bool(el.call("is_dimmed")), "⑤ 시간 지나면 보스 사라짐·어둠 걷힘")

	OS.set_environment("SAGA_ELITE", "0")
	check(EL.attach(Node.new()) == null, "⑥ 0 = 안 붙음")
	OS.set_environment("SAGA_ELITE", "")
	OS.set_environment("SAGA_ELITE_N", "")
	print("PROBE story_elite ", "OK" if fails == 0 else "FAIL %d" % fails)
	quit(1 if fails > 0 else 0)
