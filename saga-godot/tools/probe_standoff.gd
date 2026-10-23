extends SceneTree
## G-0343 1만리 대치 점검 —
##   godot --headless --path saga-godot --script res://tools/probe_standoff.gd   → "PROBE standoff OK" / "FAIL n"
## 들판 무리 하나만 남기고(나머지는 멀리) 주인공을 그 곁에 세운다. 대치 노드는 물리를 끄고 scan·tick 을 직접 부른다.
## ① 쉬는 무리 곁 → 대치·노려봄(어그로 거리 안으로 들어와도 IDLE) ② 달려들기 전 평타 → 성급·무리 쫓음·평타는 나감
## ③ 달려드는 창 안 평타 → 한 칼·다음 창 ×0.85 ④ 이어 달려듦 → 무리 전원 일격·완승 ⑤ 창 놓침 → 한 방 맞고 깨짐
## ⑥ 깬 무리는 다시 안 맞섬(쿨) ⑦ 헛몸짓 중 평타 → 성급 ⑧ 웅크림·자동 퀘스트 → 안 맞섬 ⑨ SAGA_STANDOFF=0 → 안 붙음 ⑩ field_combat 1500줄 밑

var fails := 0


func check(ok: bool, msg: String) -> void:
	print("  %s %s" % ["OK  " if ok else "FAIL", msg])
	if not ok:
		fails += 1


func _initialize() -> void:
	_run.call_deferred()


func _reset(list: Array) -> void:
	for e in list:
		if bool(e.call("is_dead")):
			e.call("_revive")
		e.set_physics_process(true)
		e.set("shield", 0.0)
		e.set("hp", float(e.get("max_hp")))
		e.set("ai", 0)
		e.set("asleep", false)
		(e as Node3D).global_position = e.get("home")
		if e.has_meta("standoff"):
			e.remove_meta("standoff")


func _place(pl: Node3D, list: Array, gap: float) -> void:
	var c := Vector3.ZERO
	for e in list:
		c += (e as Node3D).global_position
	c /= float(list.size())
	var m0 := list[0] as Node3D
	var dir := Vector3(m0.global_position.x - c.x, 0.0, m0.global_position.z - c.z).normalized()
	var aggro := float((m0.get("def") as Dictionary).get("aggro", 10.0))
	pl.global_position = m0.global_position + dir * (aggro + gap)


func _run() -> void:
	var sc := (load("res://games/saga_go/world/TestVillage.tscn") as PackedScene).instantiate()
	root.add_child(sc)
	current_scene = sc
	for _i in 40:
		await process_frame
	var fc := get_first_node_in_group("go_field_combat")
	var so := get_first_node_in_group("go_field_standoff")
	var pl := get_first_node_in_group("player") as Node3D
	var camps := {}
	for n in get_nodes_in_group("field_enemy"):
		if n.has_meta("go_camp"):
			var id := String(n.get_meta("go_camp"))
			if not camps.has(id):
				camps[id] = []
			camps[id].append(n)
	var list: Array = []
	for id in camps:
		if (camps[id] as Array).size() >= 2 and list.is_empty():
			list = camps[id]
	if fc == null or so == null or pl == null or list.is_empty():
		check(false, "준비 — fc=%s standoff=%s 무리=%d" % [fc, so, list.size()])
		_finish()
		return
	for n in get_nodes_in_group("field_enemy"):
		if not list.has(n):
			n.set_physics_process(false)
			(n as Node3D).global_position += Vector3(500, 0, 500)
	pl.set_physics_process(false)
	so.set_physics_process(false)
	var aggro := float(((list[0] as Node).get("def") as Dictionary).get("aggro", 10.0))

	# ①
	_reset(list)
	_place(pl, list, 1.0)
	var opened: bool = so.call("scan")
	var metas := list.filter(func(e: Node) -> bool: return e.has_meta("standoff")).size()
	_place(pl, list, -2.0)
	for _i in 20:
		await physics_frame
	var idle := list.filter(func(e: Node) -> bool: return int(e.get("ai")) == 0).size()
	check(opened and int(so.get("state")) == 1 and metas == list.size() and idle == list.size(), "① 대치 열림(무리 %d · 노려봄 %d · 어그로 %.0fm 안쪽에서도 IDLE %d)" % [list.size(), metas, aggro, idle])

	# ②
	fc.set("_attack_t", 0.0)
	fc.call("attack")
	var chase := list.filter(func(e: Node) -> bool: return int(e.get("ai")) != 0).size()
	check(int(so.get("hasty")) == 1 and int(so.get("state")) == 0 and chase == list.size() and float(fc.get("_attack_t")) > 0.0, "② 성급 → 깨짐·쫓음 %d·평타 나감" % chase)

	# ③
	_reset(list)
	so.set("_cool", {})
	_place(pl, list, 1.0)
	so.call("scan")
	var near: Node3D = so.call("_nearest", pl, list)
	so.call("_lunge", near)
	so.call("tick", 0.1)
	fc.set("_attack_t", 0.0)
	var struck: bool = fc.call("attack")
	check(struck and bool(near.call("is_dead")) and int(so.get("kills")) == 1 and int(so.get("state")) == 4 and is_equal_approx(float(so.get("window")), 0.45 * 0.85),
		"③ 창 안 평타 → 한 칼(창 다음 %.3f)" % float(so.get("window")))

	# ④
	for _k in list.size():
		if int(so.get("state")) == 0:
			break
		so.set("_t", 0.0)
		so.call("tick", 0.01)
		fc.set("_attack_t", 0.0)
		fc.call("attack")
	var dead := list.filter(func(e: Node) -> bool: return bool(e.call("is_dead"))).size()
	check(dead == list.size() and int(so.get("sweeps")) == 1 and int(so.get("state")) == 0, "④ 무리 전원 일격 %d/%d·완승" % [dead, list.size()])

	# ⑤
	_reset(list)
	so.set("_cool", {})
	_place(pl, list, 1.0)
	fc.set("hp", float(fc.call("max_hp_of", fc.call("active_id"))) if fc.has_method("max_hp_of") else float(fc.get("hp")))
	var hp0 := float(fc.get("hp"))
	so.call("scan")
	so.call("_lunge", so.call("_nearest", pl, list))
	so.call("tick", 0.3)
	so.call("tick", 0.3)
	chase = list.filter(func(e: Node) -> bool: return int(e.get("ai")) != 0).size()
	check(int(so.get("missed")) == 1 and int(so.get("state")) == 0 and float(fc.get("hp")) < hp0 and chase == list.size(), "⑤ 창 놓침 → 한 방(%.0f → %.0f)·깨짐" % [hp0, float(fc.get("hp"))])

	# ⑥
	_reset(list)
	_place(pl, list, 1.0)
	check(not bool(so.call("scan")), "⑥ 깬 무리는 쿨 동안 안 맞섬")

	# ⑦
	so.set("_cool", {})
	_reset(list)
	so.call("scan")
	var n7: Node3D = so.call("_nearest", pl, list)
	so.set("challenger", n7)
	so.set("state", 2)
	fc.set("_attack_t", 0.0)
	var h0 := int(so.get("hasty"))
	fc.call("attack")
	check(int(so.get("hasty")) == h0 + 1 and int(so.get("state")) == 0, "⑦ 헛몸짓 중 평타 → 성급")

	# ⑧
	so.set("_cool", {})
	_reset(list)
	pl.set("crouching", true)
	var c8: bool = so.call("scan")
	pl.set("crouching", false)
	var a8 := false
	var aq := get_first_node_in_group("go_autoquest")
	if aq != null and aq.get("q") != null:
		aq.get("q").set("on", true)
		a8 = so.call("scan")
		aq.get("q").set("on", false)
	check(not c8 and not a8, "⑧ 웅크림·자동 퀘스트 → 안 맞섬")

	# ⑨
	OS.set_environment("SAGA_STANDOFF", "0")
	check(load("res://games/saga_go/combat/field_standoff.gd").call("attach", Node.new()) == null, "⑨ SAGA_STANDOFF=0 → 안 붙음")
	OS.set_environment("SAGA_STANDOFF", "")

	# ⑩
	var lines := FileAccess.get_file_as_string("res://games/saga_go/combat/field_combat.gd").split("\n").size()
	check(lines <= 1500, "⑩ field_combat.gd %d줄" % lines)
	_finish()


func _finish() -> void:
	print("PROBE standoff %s" % ("OK" if fails == 0 else "FAIL %d" % fails))
	quit(0 if fails == 0 else 1)
