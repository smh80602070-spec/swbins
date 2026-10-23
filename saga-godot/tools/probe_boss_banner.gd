extends SceneTree

## G-0339 보스 등장 띠 공용(saga_core/ui/boss_banner.gd) — 2나락 우두머리·4종횡 사냥터 보스 점검. 1만리 컷은 probe_boss_intro.
##   godot --headless --path saga-godot --script res://tools/probe_boss_banner.gd   → "PROBE boss_banner OK" / "FAIL n"
## ① 공용 띠: 이름·아랫줄 Label · SAGA_BOSS_INTRO=0 이면 null ② 2나락: 우두머리 10m 안 처음 → "굴혈의 우두머리 / N층 · 패턴" · 첫 강타 cd ≥ 2 · 두 번째 안 뜸
## ③ 4종횡: 사냥터 보스 패턴전 거리 안 처음 → 보스 이름 · Lv · 첫 패턴 cd ≥ 2 ④ 배선(1만리 boss_intro 도 공용 띠)

var fails := 0


func check(cond: bool, msg: String) -> void:
	if cond:
		print("  ok   ", msg)
	else:
		fails += 1
		print("  FAIL ", msg)


func _frames(n: int) -> void:
	for _i in n:
		await process_frame


func _labels(n: Node) -> String:
	var t := ""
	if n != null:
		for l in n.find_children("*", "Label", true, false):
			t += String((l as Label).text) + " / "
	return t


func _load(path: String) -> Node:
	if current_scene != null:
		current_scene.queue_free()
		await _frames(2)
	var sc := (load(path) as PackedScene).instantiate()
	root.add_child(sc)
	current_scene = sc
	await _frames(30)
	for m in get_nodes_in_group("ui_modal"):
		if m is CanvasLayer and (m as CanvasLayer).visible:
			m.queue_free()
	return sc


func _initialize() -> void:
	await process_frame
	var BB: GDScript = load("res://saga_core/ui/boss_banner.gd")

	# ①
	var host := Node.new()
	root.add_child(host)
	var b: CanvasLayer = BB.pop(host, "시험 보스", "Lv.3")
	check(b != null and _labels(b) == "시험 보스 / Lv.3 / ", "① 공용 띠: %s" % _labels(b))
	OS.set_environment("SAGA_BOSS_INTRO", "0")
	check(BB.pop(host, "x") == null, "① SAGA_BOSS_INTRO=0 → 안 뜸")
	OS.set_environment("SAGA_BOSS_INTRO", "")
	host.queue_free()

	# ② 2나락
	var sc: Node = await _load("res://games/saga_dungeon/world/TestRoom.tscn")
	var pl := get_first_node_in_group("player") as Node3D
	var boss: Node3D = null
	for e in get_nodes_in_group("dungeon_boss"):
		if not e.is_in_group("world_boss"):
			boss = e
	if pl == null or boss == null:
		check(false, "② 준비 pl=%s 우두머리=%s" % [pl, boss])
	else:
		pl.set_physics_process(false)
		var bp: RefCounted = boss.get("boss_pattern")
		bp.set("cd", 0.5)
		var n0: int = BB.get("shown")
		pl.global_position = boss.global_position + Vector3(6.0, 0.0, 0.0)
		await _frames(4)
		var ban := sc.find_child("BossBanner", true, false)
		var txt := _labels(ban)
		check(int(BB.get("shown")) == n0 + 1 and txt.begins_with("굴혈의 우두머리 / ") and txt.contains("층 · ") and float(bp.get("cd")) >= 1.9 and bool(boss.get("intro_done")),
			"② 우두머리 띠: %s · 첫 강타 cd %.2f" % [txt, float(bp.get("cd"))])
		pl.global_position = boss.global_position + Vector3(40.0, 0.0, 0.0)
		await _frames(3)
		pl.global_position = boss.global_position + Vector3(6.0, 0.0, 0.0)
		await _frames(3)
		check(int(BB.get("shown")) == n0 + 1, "② 다시 와도 한 번")

	# ③ 4종횡
	sc = await _load("res://games/saga_story/world/TestField.tscn")
	pl = get_first_node_in_group("player") as Node3D
	var sb: Node3D = null
	for e in sc.find_children("*", "", true, false):
		if e.get("boss_pattern") != null and bool(e.get("is_boss")):
			sb = e
			break
	if pl == null or sb == null:
		check(false, "③ 준비 pl=%s 보스=%s" % [pl, sb])
	else:
		var sp: RefCounted = sb.get("boss_pattern")
		sp.set("cd", 0.5)
		var n1: int = BB.get("shown")
		pl.global_position = sb.global_position + Vector3(1.5, 0.0, 0.0)
		await _frames(4)
		var ban2 := sc.find_child("BossBanner", true, false)
		var t2 := _labels(ban2)
		check(int(BB.get("shown")) == n1 + 1 and t2.begins_with(String(sb.get("boss_name"))) and t2.contains("Lv.") and float(sp.get("cd")) >= 1.9,
			"③ 사냥터 보스 띠: %s · 첫 패턴 cd %.2f" % [t2, float(sp.get("cd"))])

	# ④
	var bi := FileAccess.get_file_as_string("res://games/saga_go/ui/boss_intro.gd")
	check(bi.contains("BossBanner.pop(self"), "④ 1만리 등장 컷도 공용 띠")
	print("PROBE boss_banner ", "OK" if fails == 0 else "FAIL %d" % fails)
	quit(1 if fails > 0 else 0)
