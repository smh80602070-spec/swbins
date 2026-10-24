extends SceneTree

## G-0379 1만리 핏빛 달 밤(world/go_blood_moon.gd) 점검 —
##   godot --headless --path saga-godot --script res://tools/probe_go_blood_moon.gd   → "PROBE go_blood_moon OK" / "FAIL n"
## ① is_blood_night: 같은 밤 같은 값 · 365 밤 중 대략 CHANCE ② 마을에 붙음 ③ 쓰러진 들판 적이 있을 때 붉어지면 되살림 표시(hold_respawn)·덤 ×2·막 보임
## ④ 지면 덤 ×1·막 꺼짐 ⑤ field_enemy 처치 재료 곱 배선 ⑥ 손잡이(0 끔 · 1 늘 붉음).

var fails := 0


func check(cond: bool, msg: String) -> void:
	if cond:
		print("  ok   ", msg)
	else:
		fails += 1
		print("  FAIL ", msg)


func _initialize() -> void:
	await process_frame
	var BM: GDScript = load("res://games/saga_go/world/go_blood_moon.gd")
	var n := 0
	for d in 365:
		n += 1 if BM.is_blood_night(20000 + d) else 0
	check(n > 40 and n < 110 and BM.is_blood_night(20123) == BM.is_blood_night(20123), "① 365 밤 중 %d 밤 붉음(결정적)" % n)

	var sc := (load("res://games/saga_go/world/TestVillage.tscn") as PackedScene).instantiate()
	root.add_child(sc)
	current_scene = sc
	for i in 8:
		await process_frame
	paused = false
	var bm := sc.get_node_or_null("BloodMoon")
	check(bm != null, "② 마을에 붙음")
	if bm == null:
		print("PROBE go_blood_moon FAIL %d" % fails)
		quit(1)
		return
	bm.set_process(false)   # 실제 시각으로 켜고 끄지 않게 — 아래에서 손으로
	var e: Node = null
	for x in get_nodes_in_group("field_enemy"):
		if not x.is_in_group("go_boss") and bool(x.get("respawns")):
			e = x
			break
	if e != null:
		e.call("_die")
	bm.call("set_blood", true)
	var veil := bm.get("_veil") as ColorRect
	check(e != null and int(bm.get("risen")) >= 1 and BM.loot_mul() == 2 and veil.visible, "③ 붉은 밤 — 되살림 %d · 덤 ×%d · 막" % [int(bm.get("risen")), BM.loot_mul()])
	bm.call("set_blood", false)
	check(BM.loot_mul() == 1 and not veil.visible, "④ 지면 덤 ×1·막 꺼짐")

	var src := FileAccess.get_file_as_string("res://games/saga_go/combat/field_enemy.gd")
	check(src.contains("go_blood_moon.gd\").loot_mul()"), "⑤ 처치 재료 곱 배선")

	OS.set_environment("SAGA_BLOOD_MOON", "0")
	var off: Node = BM.attach(Node.new())
	OS.set_environment("SAGA_BLOOD_MOON", "1")
	var always: bool = BM.is_blood_night(1)
	OS.set_environment("SAGA_BLOOD_MOON", "")
	check(off == null and always, "⑥ 0 끔 · 1 늘 붉음")

	print("PROBE go_blood_moon ", "OK" if fails == 0 else "FAIL %d" % fails)
	quit(1 if fails > 0 else 0)
