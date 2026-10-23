extends SceneTree

## G-0338 1만리 보스 등장 컷(ui/boss_intro.gd) 점검 —
##   godot --headless --path saga-godot --script res://tools/probe_boss_intro.gd   → "PROBE boss_intro OK" / "FAIL n"
## ① 보스 20m 안으로 가면 한 번 틂 — BossIntro 띠(이름·원소·Lv)·카메라 대화 구도(in_talk) ② SHOT_SEC 뒤 카메라 돌아옴(in_talk 거짓)
## ③ 멀어졌다 다시 와도 또 안 틂 ④ 대화 중이면 카메라 안 건드리고 띠만 ⑤ SAGA_BOSS_INTRO=0 → 안 틂 ⑥ 배선(보스 바)

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


func _initialize() -> void:
	await process_frame
	var BI: GDScript = load("res://games/saga_go/ui/boss_intro.gd")
	var sc := (load("res://games/saga_go/world/TestVillage.tscn") as PackedScene).instantiate()
	root.add_child(sc)
	current_scene = sc
	await _frames(40)
	for m in get_nodes_in_group("ui_modal"):
		if m is CanvasLayer and (m as CanvasLayer).visible:
			m.queue_free()
	var pl := get_first_node_in_group("player") as CharacterBody3D
	var rig := get_first_node_in_group("camera_rig")
	var bosses: Array = []
	for b in get_nodes_in_group("go_boss"):
		if not b.call("is_dead"):
			bosses.append(b)
	if pl == null or rig == null or bosses.size() < 2:
		check(false, "준비 pl=%s rig=%s 보스 %d" % [pl, rig, bosses.size()])
		_end()
		return
	pl.set_physics_process(false)
	for e in get_nodes_in_group("field_enemy"):
		e.set_physics_process(false)
	var b0: Node3D = bosses[0]
	var p0 := BI.get("played") as int

	# ①
	pl.global_position = b0.global_position + Vector3(8.0, 0.5, 0.0)
	for _w in 600:   # 보스 바는 실시간 0.25초마다 고른다 — 헤드리스 프레임 수로 기다리면 들쭉날쭉
		if int(BI.get("played")) > p0:
			break
		await process_frame
	await _frames(3)
	var node := sc.find_child("BossIntro", true, false)
	var txt := ""
	if node != null:
		for l in node.find_children("*", "Label", true, false):
			txt += String((l as Label).text) + " / "
	var nm := String((b0.get("def") as Dictionary).get("name", ""))
	check(int(BI.get("played")) == p0 + 1 and node != null and txt.contains(nm) and bool(rig.call("in_talk")), "① 등장 컷 — %s · 카메라 대화 구도(played %d→%d node %s talk %s)" % [txt, p0, int(BI.get("played")), node != null, rig.call("in_talk")])
	check(String(BI.sub_text(b0)).contains("원소") or String(BI.sub_text(b0)).contains("Lv"), "① 아랫줄: %s" % BI.sub_text(b0))
	check(float(b0.get("skill_cd")) >= BI.SHOT_SEC + BI.GRACE_SEC - 0.5, "① 컷 동안 첫 패턴 미룸(skill_cd %.2f)" % float(b0.get("skill_cd")))
	var fbn := get_first_node_in_group("go_field_bosses")
	var ai0: int = b0.get("ai")
	b0.set("ai", 1)   # FieldEnemy.AI.CHASE — 옛 띠는 쫓거나 치는 보스만
	await _frames(3)
	var htxt: String = fbn.call("hud_text") if fbn != null else ""
	check(fbn != null and htxt.contains(nm) and not bool((fbn.get("_hud") as Control).visible), "① 옛 들판 보스 띠는 숨음(글은 그대로: %s)" % htxt)
	b0.set("ai", ai0)

	# ②
	await create_timer(BI.SHOT_SEC + 0.2).timeout
	check(not bool(rig.call("in_talk")), "② %.1f초 뒤 카메라 돌아옴" % BI.SHOT_SEC)

	# ③
	pl.global_position = b0.global_position + Vector3(60.0, 0.5, 0.0)
	await _frames(20)
	pl.global_position = b0.global_position + Vector3(8.0, 0.5, 0.0)
	await _frames(20)
	check(int(BI.get("played")) == p0 + 1, "③ 다시 와도 또 안 틂(played %d)" % int(BI.get("played")))

	# ④ 대화 중이면 띠만
	var b1: Node3D = bosses[1]
	rig.call("talk_shot", pl.global_position + Vector3(1, 0, 0), pl.global_position)
	var t_before: Dictionary = rig.call("talk_target")
	check(bool(BI.maybe_play(sc, b1)), "④ 다른 보스는 틂")
	var t_after: Dictionary = rig.call("talk_target")
	check((t_after.eye as Vector3).is_equal_approx(t_before.eye), "④ 대화 중엔 카메라 구도 그대로")
	rig.call("end_talk")

	# ④-2 이미 예고 중인 보스 — 예고 시간이 컷만큼 는다
	if bosses.size() > 3:
		var b3: Node3D = bosses[3]
		b3.call("begin_skill", "slam", pl)
		var t0 := float(b3.get("skill_t"))
		BI.maybe_play(sc, b3)
		check(String(b3.get("skill")) != "" and is_equal_approx(float(b3.get("skill_t")), t0 + BI.SHOT_SEC), "④ 예고 중이면 예고 %.2f → %.2f초" % [t0, float(b3.get("skill_t"))])

	# ⑤
	OS.set_environment("SAGA_BOSS_INTRO", "0")
	var b2: Node3D = bosses[2] if bosses.size() > 2 else null
	check(b2 == null or not bool(BI.maybe_play(sc, b2)), "⑤ SAGA_BOSS_INTRO=0 → 안 틂")
	OS.set_environment("SAGA_BOSS_INTRO", "")

	# ⑥
	var bb := FileAccess.get_file_as_string("res://games/saga_go/ui/boss_bar.gd")
	check(bb.contains("boss_intro.gd\").maybe_play(get_parent(), _boss)"), "⑥ 보스 바 배선")
	_end()


func _end() -> void:
	print("PROBE boss_intro ", "OK" if fails == 0 else "FAIL %d" % fails)
	quit(1 if fails > 0 else 0)
