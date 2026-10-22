extends SceneTree
## G-0305 1만리 쉼터 점검 —
##   godot --headless --path saga-godot --script res://tools/probe_rest_sites.gd   → "PROBE rest_sites OK" / "FAIL n"
## ① 지역마다 자리 하나·풀 땅·물 아님 ② 다가가면 lit·at·명단 회복 ③ 그 지역 죽은 잡몹은 서고 보스는 그대로
## ④ 싸움 중엔 안 앉음 · 나갔다 와야 다시 ⑤ party_wiped → 쉼터 옆 · 지피지 않은 곳은 부활 자리 아님
## ⑥ SaveState 왕복에 rest(임시 경로 — 진짜 세이브 안 덮음) ⑦ SAGA_REST=0 이면 없음

var fails := 0


func _fail(msg: String) -> void:
	fails += 1
	print("  FAIL ", msg)


func _initialize() -> void:
	_run.call_deferred()


func _tp(pl: Node3D, p: Vector3) -> void:
	pl.global_position = p + Vector3(0, 0.5, 0)
	pl.set("velocity", Vector3.ZERO)


func _run() -> void:
	var sc := (load("res://games/saga_go/world/TestVillage.tscn") as PackedScene).instantiate()
	root.add_child(sc)
	current_scene = sc
	for _i in 40:
		await process_frame
	var ps := root.get_node("/root/PartyState")
	var rest0: Dictionary = (ps.get("rest") as Dictionary).duplicate(true)
	ps.set("rest", {})
	var rs := get_first_node_in_group("go_rest_sites")
	var fc := get_first_node_in_group("go_field_combat")
	var pl := get_first_node_in_group("player") as Node3D
	var TM: GDScript = load("res://games/saga_go/data/test_map.gd")
	if rs == null or fc == null:
		_fail("준비 rs=%s fc=%s" % [rs, fc])
		_finish()
		return
	## ①
	var all: Dictionary = rs.call("sites")
	print("REST sites=%d %s" % [all.size(), all.keys()])
	if all.size() < (TM.get("REGIONS") as Dictionary).size():
		_fail("① 자리 %d / 지역 %d" % [all.size(), (TM.get("REGIONS") as Dictionary).size()])
	for id: String in all:
		var p: Vector3 = all[id]
		var g: Vector2i = TM.call("grid_at", id, p)
		if not [".", "T", "D"].has(TM.call("tile_at", g.x, g.y, id)) or TM.call("region_at", p) != id:
			_fail("① %s 자리 칸 %s" % [id, TM.call("tile_at", g.x, g.y, id)])
	var vid := "village"
	var vp: Vector3 = all[vid]
	## 들판 적은 쉼터에서 멀리(싸움 판정 안 걸리게) — 하나는 죽여 둠, 보스도
	var dead: Node = null
	var boss: Node = null
	for e in get_nodes_in_group("field_enemy"):
		e.set_physics_process(false)
		var s: Script = e.get_script()
		var is_boss := s != null and String(s.resource_path).ends_with("field_boss.gd")
		if is_boss and boss == null:
			boss = e
		elif not is_boss and dead == null and TM.call("region_at", e.get("home")) == vid and bool(e.get("drops")):
			dead = e
		(e as Node3D).global_position = Vector3(5000, 0, 5000)
	if dead != null:
		dead.call("_die")
		dead.set("_t", 80.0)
	if boss != null:
		boss.call("_die")
		boss.set("_t", 80.0)
		boss.set("home", vp)
	## ②
	fc.set("_hp", {String(fc.call("active_id")): 1.0})
	_tp(pl, vp + Vector3(1.0, 0, 0))
	for _i in 30:
		await physics_frame
	await create_timer(0.6).timeout
	var r: Dictionary = ps.get("rest")
	print("REST lit=%s at=%s hp=%.0f/%.0f" % [r.get("lit"), r.get("at"), float(fc.get("hp")), float(fc.get("max_hp"))])
	if not (r.get("lit", []) as Array).has(vid) or String(r.get("at", "")) != vid or float(fc.get("hp")) < float(fc.get("max_hp")) - 0.5:
		_fail("② 앉기 lit·at·회복")
	## ③
	if dead != null and float(dead.get("_t")) > 0.01:
		_fail("③ 잡몹 안 섬(_t %.1f)" % float(dead.get("_t")))
	if boss != null and float(boss.get("_t")) < 79.0:
		_fail("③ 보스가 섬")
	## ④ 안 나가고 다시 — 안 앉음(at 을 비워 봄)
	r["at"] = ""
	await create_timer(0.6).timeout
	if String(r.get("at", "")) != "":
		_fail("④ 안 나갔는데 다시 앉음")
	_tp(pl, vp + Vector3(40, 0, 0))
	await create_timer(0.6).timeout
	var near_e: Node = null
	for e in get_nodes_in_group("field_enemy"):
		if not e.call("is_dead"):
			near_e = e
			break
	if near_e != null:
		(near_e as Node3D).global_position = vp + Vector3(4, 0, 0)
		near_e.set("ai", 1)
	_tp(pl, vp + Vector3(1.0, 0, 0))
	await create_timer(0.6).timeout
	if near_e != null and bool(fc.call("in_combat")) and String(r.get("at", "")) != "":
		_fail("④ 싸움 중에 앉음")
	if near_e != null:
		(near_e as Node3D).global_position = Vector3(5000, 0, 5000)
		near_e.set("ai", 0)
	_tp(pl, vp + Vector3(40, 0, 0))
	await create_timer(0.6).timeout
	_tp(pl, vp + Vector3(1.0, 0, 0))
	await create_timer(0.6).timeout
	if String(r.get("at", "")) != vid:
		_fail("④ 나갔다 오니 안 앉음")
	## ⑤
	_tp(pl, vp + Vector3(200, 0, 200))
	fc.emit_signal("party_wiped")
	var dw := Vector2(pl.global_position.x - vp.x, pl.global_position.z - vp.z).length()
	if dw > 4.0:
		_fail("⑤ 전멸 뒤 쉼터 옆 아님 %.1fm" % dw)
	r["at"] = ""
	var far := pl.global_position + Vector3(300, 0, 0)
	_tp(pl, far)
	fc.emit_signal("party_wiped")
	if pl.global_position.distance_to(far + Vector3(0, 0.5, 0)) > 0.5:
		_fail("⑤ 부활 자리 없는데 옮겨짐")
	## ⑥
	var ss := root.get_node("/root/SaveState")
	var old_path := String(ss.get("path_override"))
	ss.set("path_override", "user://_probe_rest_save.json")
	ps.set("rest", {"lit": ["village", "coast"], "at": "coast"})
	ss.call("save")
	ps.set("rest", {})
	ss.call("try_load")
	var back: Dictionary = ps.get("rest")
	ss.set("path_override", old_path)
	DirAccess.remove_absolute(ProjectSettings.globalize_path("user://_probe_rest_save.json"))
	if String(back.get("at", "")) != "coast" or (back.get("lit", []) as Array).size() != 2:
		_fail("⑥ 세이브 왕복 %s" % [back])
	## ⑦
	OS.set_environment("SAGA_REST", "0")
	if load("res://games/saga_go/world/rest_sites.gd").call("attach", Node.new()) != null:
		_fail("⑦ 손잡이 0 인데 붙음")
	OS.set_environment("SAGA_REST", "")
	ps.set("rest", rest0)
	_finish()


func _finish() -> void:
	print("PROBE rest_sites %s" % ("OK" if fails == 0 else "FAIL %d" % fails))
	quit(0 if fails == 0 else 1)
