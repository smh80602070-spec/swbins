extends SceneTree
## G-0304 1만리 쳐내기 점검 —
##   godot --headless --path saga-godot --script res://tools/probe_parry.gd   → "PROBE parry OK" / "FAIL n"
## 적 하나를 주인공 앞에 세우고 WINDUP·_t 를 직접 넣는다.
## ① 창 안 → 쳐냄·적 RECOVER·주인공 무피해·다음 _deal ×2.4(×2 · 비틀 ×1.2) 한 번만, 그다음 ×1.2, 비틀 끝나면 ×1
## ② 창 밖(_t 0.6) → 평타(쳐냄 아님) ③ 보스 비틀 0.5초 ④ 자동 퀘스트 켜짐 → 쳐내기 안 함 ⑤ SAGA_PARRY=0 이면 안 붙음

var fails := 0


func _fail(msg: String) -> void:
	fails += 1
	print("  FAIL ", msg)


func _windup(e: Node, pl: Node3D, t: float) -> void:
	e.set_physics_process(false)
	(e as Node3D).global_position = pl.global_position + Vector3(0, 0, 1.4)
	e.set("hp", 99999.0)
	e.set("max_hp", 99999.0)
	e.set("_hit_siege", false)
	e.set("ai", 2)
	e.set("_t", t)
	e.set_meta("parried_until", 0)


func _initialize() -> void:
	_run.call_deferred()


func _run() -> void:
	var sc := (load("res://games/saga_go/world/TestVillage.tscn") as PackedScene).instantiate()
	root.add_child(sc)
	current_scene = sc
	for _i in 40:
		await process_frame
	var fc := get_first_node_in_group("go_field_combat")
	var pa := get_first_node_in_group("go_field_parry")
	var pl := get_first_node_in_group("player") as Node3D
	var e: Node = null
	var boss: Node = null
	for n in get_nodes_in_group("field_enemy"):
		if n.call("is_dead") or n.call("is_shielded"):
			continue
		if pa.call("is_boss", n):
			if boss == null:
				boss = n
		elif e == null:
			e = n
	if fc == null or pa == null or e == null:
		_fail("준비 — fc=%s parry=%s 적=%s" % [fc, pa, e])
		_finish()
		return
	for n in get_nodes_in_group("field_enemy"):
		if n != e and n != boss:
			n.set_physics_process(false)
			(n as Node3D).global_position += Vector3(500, 0, 500)
	pl.set_physics_process(false)
	var hp0 := float(fc.get("hp"))
	## ①
	_windup(e, pl, 0.15)
	fc.set("_attack_t", 0.0)
	var ok: bool = fc.call("attack")
	var n1: int = int(pa.get("parries"))
	var ai1: int = int(e.get("ai"))
	var m1: float = pa.call("mul", e)
	var m2: float = pa.call("mul", e)
	e.set_meta("parried_until", 0)
	var m3: float = pa.call("mul", e)
	print("PARRY ok=%s parries=%d ai=%d mul=%.2f/%.2f/%.2f" % [ok, n1, ai1, m1, m2, m3])
	if not ok or n1 != 1 or ai1 != 4 or not is_equal_approx(m1, 2.4) or not is_equal_approx(m2, 1.2) or not is_equal_approx(m3, 1.0):
		_fail("① 쳐냄 ok=%s 횟수 %d ai %d 배율 %.2f/%.2f/%.2f" % [ok, n1, ai1, m1, m2, m3])
	e.set_physics_process(true)
	for _i in 30:
		await physics_frame
	e.set_physics_process(false)
	if float(fc.get("hp")) < hp0:
		_fail("① 쳐냈는데 주인공이 다침 %.1f → %.1f" % [hp0, float(fc.get("hp"))])
	## ②
	_windup(e, pl, 0.6)
	fc.set("_attack_t", 0.0)
	fc.call("attack")
	if int(pa.get("parries")) != 1 or int(e.get("ai")) == 4:
		_fail("② 이른 평타가 쳐냄(%d)" % int(pa.get("parries")))
	pa.call("mul", e)
	## ③
	if boss == null:
		print("  (보스 없음 — ③ 건너뜀)")
	else:
		boss.set_physics_process(false)
		_windup(boss, pl, 0.1)
		e.set("ai", 4)
		fc.set("_attack_t", 0.0)
		fc.call("attack")
		var bt := float(boss.get("_t"))
		if int(pa.get("parries")) != 2 or absf(bt - 0.5) > 0.01:
			_fail("③ 보스 비틀 %.2f(기대 0.5) 횟수 %d" % [bt, int(pa.get("parries"))])
		(boss as Node3D).global_position += Vector3(500, 0, 500)
		pa.call("mul", boss)
	## ④
	var aq := get_first_node_in_group("go_autoquest")
	if aq != null and aq.get("q") != null:
		var p0 := int(pa.get("parries"))
		aq.get("q").set("on", true)
		_windup(e, pl, 0.1)
		fc.set("_attack_t", 0.0)
		fc.call("attack")
		aq.get("q").set("on", false)
		if int(pa.get("parries")) != p0:
			_fail("④ 자동 퀘스트 중 쳐냄")
	## ⑤
	OS.set_environment("SAGA_PARRY", "0")
	if load("res://games/saga_go/combat/field_parry.gd").call("attach", Node.new()) != null:
		_fail("⑤ 손잡이 0 인데 붙음")
	OS.set_environment("SAGA_PARRY", "")
	_finish()


func _finish() -> void:
	print("PROBE parry %s" % ("OK" if fails == 0 else "FAIL %d" % fails))
	quit(0 if fails == 0 else 1)
