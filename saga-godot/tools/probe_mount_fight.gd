extends SceneTree
## G-0306 1만리 말 위 전투 점검 —
##   godot --headless --path saga-godot --script res://tools/probe_mount_fight.gd   → "PROBE mount_fight OK" / "FAIL n"
## ① 빠르기 배율(서면 ×1 · 최고로 달리면 ×1.5) ② 탄 채 평타 입력은 통과·폭발 등은 막힘·공격해도 안 내림
## ③ 돌진(E) — 앞 적 피해·비틀·쿨 6초(둘째는 안 나감) ④ 탄 채 맞으면 낙마·0.8초 못 침
## ⑤ 나는 탈것 위 평타 막힘(안 내림) ⑥ SAGA_MOUNT_FIGHT=0 이면 안 붙음

var fails := 0


func _fail(msg: String) -> void:
	fails += 1
	print("  FAIL ", msg)


func _ev(action: String) -> InputEventAction:
	var ev := InputEventAction.new()
	ev.action = action
	ev.pressed = true
	return ev


func _initialize() -> void:
	_run.call_deferred()


func _run() -> void:
	var sc := (load("res://games/saga_go/world/TestVillage.tscn") as PackedScene).instantiate()
	root.add_child(sc)
	current_scene = sc
	for _i in 40:
		await process_frame
	var fc := get_first_node_in_group("go_field_combat")
	var fm := get_first_node_in_group("go_field_mount")
	var pl := get_first_node_in_group("player") as CharacterBody3D
	var m: Node = null
	for c in pl.get_children():
		if c.has_method("dismount") and c.has_method("is_riding"):
			m = c
	if fc == null or fm == null or m == null:
		_fail("준비 fc=%s fm=%s mount=%s" % [fc, fm, m])
		_finish()
		return
	for e in get_nodes_in_group("field_enemy"):
		e.set_physics_process(false)
		(e as Node3D).global_position += Vector3(800, 0, 800)
	pl.set_physics_process(false)
	m.call("mount", "pt_jeolyeong")
	for _i in 3:
		await process_frame
	if not bool(pl.get("mounted")):
		_fail("준비 — 못 탐")
		_finish()
		return
	## ①
	fm.set("_top", 10.0)
	pl.velocity = Vector3.ZERO
	var m0: float = fm.call("mul")
	pl.velocity = Vector3(10, 0, 0)
	var m1: float = fm.call("mul")
	pl.velocity = Vector3.ZERO
	print("MF mul stand=%.2f run=%.2f" % [m0, m1])
	if not is_equal_approx(m0, 1.0) or not is_equal_approx(m1, 1.5):
		_fail("① 배율 %.2f/%.2f" % [m0, m1])
	## ②
	if not bool(fm.call("allows", _ev("combat_quick"))) or bool(fm.call("allows", _ev("combat_burst"))):
		_fail("② 입력 거르기")
	m.call("_unhandled_input", _ev("combat_quick"))
	await process_frame
	if not bool(pl.get("mounted")):
		_fail("② 평타에 내려짐")
	## ③
	var e: Node = null
	for n in get_nodes_in_group("field_enemy"):
		if not n.call("is_dead") and not n.call("is_shielded"):
			e = n
			break
	var fwd: Vector3 = pl.call("facing")
	(e as Node3D).global_position = pl.global_position + fwd * 2.0
	e.set("hp", 99999.0)
	e.set("max_hp", 99999.0)
	var h0 := float(e.get("hp"))
	fm.call("allows", _ev("combat_ult"))
	var dealt := h0 - float(e.get("hp"))
	var cd := float(fm.get("charge_cd"))
	var again: bool = fm.call("charge")
	print("MF charge dealt=%.1f ai=%d cd=%.1f again=%s" % [dealt, int(e.get("ai")), cd, again])
	if dealt <= 0.0 or int(e.get("ai")) != 4 or absf(cd - 6.0) > 0.01 or again:
		_fail("③ 돌진 피해 %.1f ai %d 쿨 %.1f 둘째 %s" % [dealt, int(e.get("ai")), cd, again])
	(e as Node3D).global_position += Vector3(800, 0, 800)
	## ④
	fc.set("_attack_t", 0.0)
	fc.call("take_damage", 5.0, null)
	await process_frame
	if bool(pl.get("mounted")) or float(fc.get("_attack_t")) < 0.79:
		_fail("④ 낙마 mounted=%s attack_t=%.2f" % [pl.get("mounted"), float(fc.get("_attack_t"))])
	## ⑤
	m.call("mount", "pt_samjogo")
	for _i in 3:
		await process_frame
	pl.set("fly_on", true)
	if bool(fm.call("allows", _ev("combat_quick"))):
		_fail("⑤ 날면서 평타 통과")
	m.call("_unhandled_input", _ev("combat_quick"))
	await process_frame
	if not bool(pl.get("mounted")):
		_fail("⑤ 날면서 공격에 내려짐")
	pl.set("fly_on", false)
	m.call("dismount", "", true)
	## ⑥
	OS.set_environment("SAGA_MOUNT_FIGHT", "0")
	if load("res://games/saga_go/combat/field_mount.gd").call("attach", Node.new()) != null:
		_fail("⑥ 손잡이 0 인데 붙음")
	OS.set_environment("SAGA_MOUNT_FIGHT", "")
	_finish()


func _finish() -> void:
	print("PROBE mount_fight %s" % ("OK" if fails == 0 else "FAIL %d" % fails))
	quit(0 if fails == 0 else 1)
