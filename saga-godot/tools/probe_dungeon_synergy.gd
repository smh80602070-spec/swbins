extends SceneTree

## 사가나락 원소 시너지(player/melee_attack.gd `_check_elem_synergy` — 처치 시 반경 안 적에게 확산 피해, dungeon_boons.gd SYNERGIES)와 유품·은사가 합산에 얹히는 길 자동 점검 — 적 노드를 직접 세워 규칙 함수만 부른다(그림은 안 봄). 씨앗 고정(20260824).
##   godot --headless --path saga-godot --script res://tools/probe_dungeon_synergy.gd
## ① 쌍 셋(화+뇌·빙+기·독+전자)마다: 그 시너지 은사를 골랐고 · 이번 타격에 두 결이 다 박혔고 · 그 적이 죽었을 때만 — 반경(2.35m) 안 다른 적이 14 피해, 반경 밖·죽은 적 자신은 그대로
## ② 안 뜨는 경우: 은사 없음·한 결만·적이 아직 살아 있음·다른 쌍의 결·모르는 은사 ③ 시너지는 은사 합산(atk_mult 등)에 안 섞임.
## 상태는 끝에 되돌린다. 끝에 "PROBE dungeon_synergy OK" 또는 "PROBE dungeon_synergy FAIL n".

const Boons := preload("res://games/saga_dungeon/data/dungeon_boons.gd")

var fails := 0


func check(cond: bool, msg: String) -> void:
	if cond:
		print("  ok   ", msg)
	else:
		fails += 1
		print("  FAIL ", msg)


func _initialize() -> void:
	await process_frame
	seed(20260824)
	var Enemy: GDScript = load("res://games/saga_dungeon/world/dungeon_enemy.gd")
	var Melee: GDScript = load("res://games/saga_dungeon/player/melee_attack.gd")
	var Run: Node = root.get_node("DungeonRunState")
	var saved_boons: Dictionary = Run.boons.duplicate()
	var stage := Node3D.new()
	root.add_child(stage)
	var melee: Node = Melee.new()
	stage.add_child(melee)

	var spawn := func(pos: Vector3) -> Node:
		var e: Node = Enemy.new(12)
		stage.add_child(e)
		(e as Node3D).global_position = pos
		e.hp = 5000.0
		e.max_hp = 5000.0
		return e
	await process_frame

	for syn: Dictionary in Boons.SYNERGIES:
		var key := String(syn.key)
		var dmgs := {String(syn.a): 6.0, String(syn.b): 7.0, "phys": 10.0}
		Run.boons = {key: 1}
		var main = spawn.call(Vector3.ZERO)
		var near = spawn.call(Vector3(Boons.SYN_RADIUS * 0.8, 0, 0))
		var edge = spawn.call(Vector3(0, 0, Boons.SYN_RADIUS * 0.99))
		var far = spawn.call(Vector3(Boons.SYN_RADIUS * 1.4, 0, 0))
		main.hp = 0.0
		melee._check_elem_synergy(dmgs, main, Vector3.ZERO)
		check(near.hp == 5000.0 - Boons.SYN_DAMAGE and edge.hp == 5000.0 - Boons.SYN_DAMAGE and far.hp == 5000.0 and main.hp == 0.0, "%s(%s+%s): 처치 시 반경 %.2fm 안 적이 %.0f 피해 · 밖·자기 자신은 그대로" % [key, syn.a, syn.b, Boons.SYN_RADIUS, Boons.SYN_DAMAGE])
		# 안 뜨는 경우
		for e in [main, near, edge, far]:
			e.hp = 5000.0
		main.hp = 0.0
		melee._check_elem_synergy({String(syn.a): 6.0, "phys": 10.0}, main, Vector3.ZERO)
		melee._check_elem_synergy({String(syn.b): 7.0}, main, Vector3.ZERO)
		Run.boons = {}
		melee._check_elem_synergy(dmgs, main, Vector3.ZERO)
		Run.boons = {key: 1}
		main.hp = 10.0
		melee._check_elem_synergy(dmgs, main, Vector3.ZERO)
		check(near.hp == 5000.0 and edge.hp == 5000.0, "%s: 한 결만·은사 없음·적이 아직 살아 있으면 안 뜸" % key)
		for e in [main, near, edge, far]:
			e.queue_free()
		await process_frame

	# 다른 쌍의 결·모르는 은사
	var m2 = spawn.call(Vector3.ZERO)
	var n2 = spawn.call(Vector3(1.0, 0, 0))
	m2.hp = 0.0
	Run.boons = {"syn_fire_lit": 1}
	melee._check_elem_synergy({"cold": 5.0, "chi": 5.0}, m2, Vector3.ZERO)
	Run.boons = {"syn_nope": 1}
	melee._check_elem_synergy({"fire": 5.0, "lit": 5.0}, m2, Vector3.ZERO)
	check(n2.hp == 5000.0, "다른 쌍의 결이거나 모르는 은사면 안 뜸")
	Run.boons = {"syn_fire_lit": 1, "syn_cold_chi": 1}
	melee._check_elem_synergy({"fire": 5.0, "lit": 5.0, "cold": 5.0, "chi": 5.0}, m2, Vector3.ZERO)
	check(n2.hp == 5000.0 - 2.0 * Boons.SYN_DAMAGE, "두 쌍을 다 골랐고 네 결이 다 박혔으면 두 번 뜸(-%.0f)" % (2.0 * Boons.SYN_DAMAGE))
	# 합산에 안 섞임
	Run.boons = {}
	var a0: float = Run.atk_mult()
	var h0: float = Run.hp_mult()
	var s0: float = Run.skill_mul()
	Run.boons = {"syn_fire_lit": 1, "syn_cold_chi": 1, "syn_pois_emp": 1}
	check(Run.atk_mult() == a0 and Run.hp_mult() == h0 and Run.skill_mul() == s0, "시너지 은사는 합산(공격·체력·무예)을 안 바꿈 — 처치 시 효과만")
	stage.queue_free()
	Run.boons = saved_boons
	print("PROBE dungeon_synergy ", "OK" if fails == 0 else "FAIL %d" % fails)
	quit(1 if fails > 0 else 0)
