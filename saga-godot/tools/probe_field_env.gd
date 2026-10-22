extends SceneTree
## G-0303 1만리 환경 연쇄 점검 —
##   godot --headless --path saga-godot --script res://tools/probe_field_env.gd   → "PROBE field_env OK" / "FAIL n"
## ① 들 칸 위 적에 불 타격 → 불길 1·둘레 적 피해·0.5초 뒤 2(번짐 한 번만)·3초 뒤 0 ② 길 = ·마을 H 칸은 안 탐
## ③ 강 ~ 위 적 둘에 번개 → 둘째 적도 피해(한 번) ④ 불길에 물 타격 → 꺼짐 ⑤ 주인공 체력 그대로 ⑥ SAGA_FIELD_ENV=0 이면 없음

const TestMap := preload("res://games/saga_go/data/test_map.gd")
var FieldEnv: GDScript = load("res://games/saga_go/combat/field_env.gd")

var fails := 0


func _fail(msg: String) -> void:
	fails += 1
	print("  FAIL ", msg)


func _tile_pos(want: String, region := "village") -> Vector3:
	var s := TestMap.size(region)
	for y in s.y:
		for x in s.x:
			if TestMap.tile_at(x, y, region) == want:
				var p := TestMap.world_pos(x, y, region)
				if want == "." and FieldEnv.is_grass(p) and FieldEnv.is_grass(p + Vector3(4, 0, 0)):
					return p
				if want == "~" and FieldEnv.is_wet(p):
					return p
				if want != "." and want != "~":
					return p
	return Vector3.INF


func _pin(e: Node, p: Vector3) -> void:
	e.set_physics_process(false)
	e.set_process(false)
	(e as Node3D).global_position = p
	e.set("max_hp", 99999.0)
	e.set("hp", 99999.0)
	e.call("set_aura", "")


func _initialize() -> void:
	_run.call_deferred()


func _run() -> void:
	var sc := (load("res://games/saga_go/world/TestVillage.tscn") as PackedScene).instantiate()
	root.add_child(sc)
	current_scene = sc
	for _i in 40:
		await process_frame
	var fc := get_first_node_in_group("go_field_combat")
	var env := get_first_node_in_group("go_field_env")
	var pl := get_first_node_in_group("player") as Node3D
	var es: Array = []
	for e in get_nodes_in_group("field_enemy"):
		if not e.call("is_dead") and not e.call("is_shielded") and es.size() < 3:
			es.append(e)
	if fc == null or env == null or es.size() < 3:
		_fail("준비 — fc=%s env=%s 적 %d" % [fc, env, es.size()])
		_finish()
		return
	var hp0: float = float(fc.get("hp"))
	## ①
	var g := _tile_pos(".")
	_pin(es[0], g)
	_pin(es[1], g + Vector3(1.0, 0, 0))
	_pin(es[2], g + Vector3(30, 0, 30))
	fc.call("_deal", es[0], 50.0, "fire", Vector3.FORWARD)
	var n0: int = (env.call("fires") as Array).size()
	var hp1: float = float(es[1].get("hp"))
	await create_timer(0.75).timeout
	var n1: int = (env.call("fires") as Array).size()
	var hurt := hp1 - float(es[1].get("hp"))
	await create_timer(1.0).timeout
	var n2: int = (env.call("fires") as Array).size()
	await create_timer(2.6).timeout
	var n3: int = (env.call("fires") as Array).size()
	print("ENV fire n=%d→%d→%d→%d hurt=%.1f at %s" % [n0, n1, n2, n3, hurt, g])
	if n0 != 1 or n1 != 2 or n2 != 2 or n3 != 0 or hurt <= 0.0:
		_fail("① 불길 %d→%d→%d→%d 둘레 피해 %.1f" % [n0, n1, n2, n3, hurt])
	## ②
	for t in ["=", "H"]:
		var q := _tile_pos(t)
		_pin(es[0], q)
		fc.call("_deal", es[0], 50.0, "fire", Vector3.FORWARD)
		if not (env.call("fires") as Array).is_empty():
			_fail("② %s 칸이 탐" % t)
			(env.call("fires") as Array).clear()
	## ③
	var w := _tile_pos("~")
	if w == Vector3.INF:
		_fail("③ 물 자리 없음")
	else:
		_pin(es[0], w)
		_pin(es[1], w + Vector3(3.0, 0, 0))
		_pin(es[2], w + Vector3(30, 0, 30))
		var b1: float = float(es[1].get("hp"))
		var b2: float = float(es[2].get("hp"))
		fc.call("_deal", es[0], 40.0, "thunder", Vector3.FORWARD)
		var d1 := b1 - float(es[1].get("hp"))
		print("ENV shock second=%.1f far=%.1f wet2=%s" % [d1, b2 - float(es[2].get("hp")), FieldEnv.is_wet(w + Vector3(3, 0, 0))])
		if not FieldEnv.is_wet(w + Vector3(3, 0, 0)):
			print("  (둘째 자리 물 아님 — 건너뜀)")
		elif d1 < 39.0 or d1 > 41.0 or b2 != float(es[2].get("hp")):
			_fail("③ 물벼락 둘째 %.1f(기대 40)·먼 적 %.1f" % [d1, b2 - float(es[2].get("hp"))])
	## ④
	_pin(es[0], g)
	fc.call("_deal", es[0], 50.0, "fire", Vector3.FORWARD)
	es[0].call("set_aura", "")
	fc.call("_deal", es[0], 10.0, "water", Vector3.FORWARD)
	if not (env.call("fires") as Array).is_empty():
		_fail("④ 물 타격에도 불길 %d" % (env.call("fires") as Array).size())
	## ⑤
	if float(fc.get("hp")) < hp0:
		_fail("⑤ 주인공이 다침 %.1f → %.1f" % [hp0, float(fc.get("hp"))])
	## ⑥
	OS.set_environment("SAGA_FIELD_ENV", "0")
	if FieldEnv.attach(Node.new()) != null:
		_fail("⑥ 손잡이 0 인데 붙음")
	OS.set_environment("SAGA_FIELD_ENV", "")
	_finish()


func _finish() -> void:
	print("PROBE field_env %s" % ("OK" if fails == 0 else "FAIL %d" % fails))
	quit(0 if fails == 0 else 1)
