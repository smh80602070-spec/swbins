extends SceneTree

## 사가블로 기본 공격(player/melee_attack.gd — try_attack 사거리·쿨다운·분신, _strike 피해식·치명타·저항·손맛 연결·가시 반사·흡혈·원소 결(느려짐·독·편차)) 자동 점검 — 적 노드를 직접 세워 규칙 함수만 부른다(그림은 안 봄). 씨앗 고정(20260824).
##   godot --headless --path saga-godot --script res://tools/probe_dungeon_melee.gd
## ① 상수: 쿨다운 0.55·피해 9·사거리 2.4·치명 ×1.85 ② _strike: 피해 = 9×(은사+장비 %)+장비 고정 · 치명 1.85배 · 물리 저항만큼 줄어듦 · 손맛(CombatFeel.hit)에 실제 피해·치명 여부가 넘어감 · 가시 반사(맞은 만큼의 22%)가 플레이어 체력 노드로 · 처치 시 흡혈
## ③ 원소: 무기 보석의 원소 피해가 따로 들어가고(저항 반영·1 이상) · 빙은 느려짐·독은 3초에 나눠(dot) · 뇌는 편차 ④ try_attack: 사거리(×사거리 은사) 안만 · 쿨다운(÷공속) 중엔 안 침 · 분신 확률 100 이면 두 번.
## 상태는 끝에 되돌린다. 끝에 "PROBE dungeon_melee OK" 또는 "PROBE dungeon_melee FAIL n".

var fails := 0


func check(cond: bool, msg: String) -> void:
	if cond:
		print("  ok   ", msg)
	else:
		fails += 1
		print("  FAIL ", msg)


class FakeHealth extends Node:
	var max_hp := 200.0
	var healed: Array = []
	var taken: Array = []

	func heal_by(a: float) -> void:
		healed.append(a)

	func take_damage(a: float) -> void:
		taken.append(a)


func _initialize() -> void:
	await process_frame
	seed(20260824)
	var Enemy: GDScript = load("res://games/saga_dungeon/world/dungeon_enemy.gd")
	var Melee: GDScript = load("res://games/saga_dungeon/player/melee_attack.gd")
	var Items: GDScript = load("res://games/saga_dungeon/data/dungeon_items.gd")
	var Run: Node = root.get_node("DungeonRunState")
	var Eq: Node = root.get_node("DungeonEquipmentState")
	var CF: Node = root.get_node("CombatFeel")
	var saved_boons: Dictionary = Run.boons.duplicate()
	var saved_equip := {}
	for s in Eq.SLOT_NAMES:
		saved_equip[s] = (Eq.item_for(s) as Dictionary).duplicate(true)
		Eq.equip(s, {})
	Run.boons = {}
	Run._temp_buffs.clear()
	var popups: Array = []
	CF.popup_triggered.connect(func(a, c): popups.append([a, c]))

	var player := Node3D.new()
	root.add_child(player)
	var melee: Node = Melee.new()
	player.add_child(melee)
	var health := FakeHealth.new()
	health.add_to_group("player_health")
	root.add_child(health)
	await process_frame
	var spawn := func(pos: Vector3, hp: float = 5000.0) -> Node:
		var e: Node = Enemy.new(12)
		root.add_child(e)
		(e as Node3D).global_position = pos
		e.hp = hp
		e.max_hp = hp
		e.resist = {}
		e._elite_def = {}
		return e
	var near := func(a: float, b: float) -> bool: return absf(a - b) < 1e-3

	# ① 상수
	check(Melee.ATK_COOLDOWN == 0.55 and Melee.ATK_DAMAGE == 9.0 and Melee.ATK_RANGE == 2.4 and Melee.CRIT_MULT == 1.85, "기본 공격 상수: 쿨다운 0.55 · 피해 9 · 사거리 2.4 · 치명 ×1.85")

	# ② _strike
	var e1 = spawn.call(Vector3(1.0, 0, 0))
	var a_mult: float = Run.atk_mult() + Eq.atk_pct_bonus() / 100.0
	melee._strike(e1)
	var d1: float = 5000.0 - e1.hp
	check(near.call(d1, 9.0 * a_mult) and popups.size() == 1 and near.call(popups[0][0], d1) and popups[0][1] == false, "_strike: 피해 9 × 은사 배율 · 손맛(CombatFeel.hit)에 실제 피해·치명 아님이 넘어감(%.1f)" % d1)
	Run.add_temp_buff("critPct", 1000.0, 30.0)
	e1.hp = 5000.0
	melee._strike(e1)
	var d2: float = 5000.0 - e1.hp
	check(near.call(d2, 9.0 * a_mult * 1.85) and popups[-1][1] == true and near.call(popups[-1][0], d2), "치명타: ×1.85 · 손맛에 치명 표시")
	Run._temp_buffs.clear()
	e1.hp = 5000.0
	e1.resist = {"phys": 35.0}
	melee._strike(e1)
	check(near.call(5000.0 - e1.hp, 9.0 * a_mult * 0.65), "물리 저항 35%%: 피해 ×0.65")
	e1.resist = {}
	Run.boons = {"fury": 2}
	e1.hp = 5000.0
	melee._strike(e1)
	check(near.call(5000.0 - e1.hp, 9.0 * (1.0 + 0.36)), "맹공 은사 2겹(+36%%): 피해 9×1.36")
	Run.boons = {}
	var flat_weapon := {"base": "w_changj", "tier": 0, "ilvl": 1, "main": 10.0, "aff": [], "sock": [], "set": "", "unid": false, "dur": 30.0}
	Eq.equip("weapon", flat_weapon)
	e1.hp = 5000.0
	melee._strike(e1)
	check(near.call(5000.0 - e1.hp, 9.0 * (1.0 + Eq.atk_pct_bonus() / 100.0) + Eq.atk_flat_bonus()) and Eq.atk_flat_bonus() >= 10.0, "장비 무기: 주 능력치가 고정 피해로 더해짐(+%.0f)" % Eq.atk_flat_bonus())
	Eq.equip("weapon", {})
	# 가시 반사
	e1.hp = 5000.0
	e1._elite_def = {"thorn": 0.22}
	health.taken.clear()
	melee._strike(e1)
	var hit: float = 5000.0 - e1.hp
	check(health.taken.size() == 1 and near.call(health.taken[0], maxf(1.0, roundf(hit * 0.22))), "가시 돋친 정예: 맞은 피해의 22%%를 플레이어에게 되돌림(%.0f)" % health.taken[0])
	e1._elite_def = {}
	# 흡혈
	Run.add_temp_buff("drainPct", 10.0, 30.0)
	var weak = spawn.call(Vector3(1.0, 0, 0), 1.0)
	health.healed.clear()
	melee._strike(weak)
	check(weak.hp <= 0.0 and health.healed.size() == 1 and near.call(health.healed[0], 200.0 * 10.0 / 100.0), "처치하면 흡혈: 최대 체력의 10%%(20)를 회복")
	var e_alive = spawn.call(Vector3(1.0, 0, 0))
	health.healed.clear()
	melee._strike(e_alive)
	check(health.healed.is_empty(), "처치하지 못하면 흡혈 없음")
	Run._temp_buffs.clear()
	e_alive.queue_free()
	weak.queue_free()

	# ③ 원소
	var elem_weapon := {"base": "w_changj", "tier": 0, "ilvl": 1, "main": 1.0, "aff": [], "set": "", "unid": false, "dur": 30.0,
		"sock": [{"t": "gem", "key": "agate", "g": 0}, {"t": "gem", "key": "pearl", "g": 0}, {"t": "gem", "key": "jade", "g": 0}]}
	Eq.equip("weapon", elem_weapon)
	var ed: Dictionary = Eq.elem_damage()
	check(ed == {"fire": 6.0, "cold": 5.0, "pois": 8.0}, "무기 보석 셋: 화 6·빙 5·독 8 원소 피해 %s" % str(ed))
	e1.hp = 5000.0
	e1._slow_time_left = 0.0
	e1._dots.clear()
	var phys_only: float = 9.0 * (Run.atk_mult() + Eq.atk_pct_bonus() / 100.0) + Eq.atk_flat_bonus()
	melee._strike(e1)
	var total: float = 5000.0 - e1.hp
	check(near.call(total, phys_only + 6.0 + 5.0) and e1._slow_time_left > 1.0 and near.call(e1._slow_mult, 0.45) and e1._dots.size() == 1 and near.call(float(e1._dots[0].dps), 8.0 / 3.0) and near.call(float(e1._dots[0].t), 3.0), "원소: 화 +6·빙 +5 즉시 · 빙은 0.45배로 1.6초 느려짐 · 독은 3초에 걸쳐 8(초당 2.67) — 합 %.1f" % total)
	e1.hp = 5000.0
	e1.resist = {"fire": 50.0, "cold": 75.0}
	e1._dots.clear()
	melee._strike(e1)
	check(near.call(5000.0 - e1.hp, phys_only + 3.0 + maxf(1.0, roundf(5.0 * 0.25))), "원소 저항: 화 50%% → 3 · 빙 75%% → 1(하한 1)")
	e1.resist = {}
	var lit_weapon := {"base": "w_changj", "tier": 0, "ilvl": 1, "main": 1.0, "aff": [], "set": "", "unid": false, "dur": 30.0, "sock": [{"t": "gem", "key": "amber", "g": 4}]}
	Eq.equip("weapon", lit_weapon)
	var lo := 999.0
	var hi := 0.0
	var base_phys: float = 9.0 * (Run.atk_mult() + Eq.atk_pct_bonus() / 100.0) + Eq.atk_flat_bonus()
	for n in 200:
		e1.hp = 5000.0
		melee._strike(e1)
		var el_part: float = 5000.0 - e1.hp - base_phys
		lo = minf(lo, el_part)
		hi = maxf(hi, el_part)
	check(lo >= 1.0 and hi <= roundf(7.0 * 7.0 * 1.7) + 1.0 and hi - lo > 5.0, "뇌 결: 편차가 큼(원소 피해 %.0f ~ %.0f, 평균 49 둘레)" % [lo, hi])
	Eq.equip("weapon", {})
	e1.queue_free()

	# ④ try_attack
	Run.boons = {}
	player.global_position = Vector3.ZERO
	var inn = spawn.call(Vector3(2.0, 0, 0))
	var out = spawn.call(Vector3(2.6, 0, 0))
	melee._cooldown_left = 0.0
	melee.try_attack()
	check(inn.hp < 5000.0 and out.hp == 5000.0 and near.call(melee._cooldown_left, 0.55 / Run.atk_speed_mult()), "try_attack: 사거리 2.4m 안만 치고(2.0 맞음·2.6 안 맞음) · 쿨다운 0.55초")
	var hp_after: float = inn.hp
	melee.try_attack()
	check(inn.hp == hp_after, "쿨다운 중에는 안 침")
	Run.boons = {"reach": 1}
	melee._cooldown_left = 0.0
	melee.try_attack()
	check(out.hp < 5000.0, "장병 은사(+18%%)면 사거리 2.83m — 2.6m 도 맞음")
	Run.boons = {"haste": 2}
	melee._cooldown_left = 0.0
	melee.try_attack()
	check(near.call(melee._cooldown_left, 0.55 / 1.28), "연격 은사 2겹: 쿨다운이 공속 배율로 줆(0.55÷1.28)")
	Run.boons = {}
	Run.add_temp_buff("echoPct", 1000.0, 30.0)
	inn.hp = 5000.0
	melee._cooldown_left = 0.0
	melee.try_attack()
	var echo_dmg: float = 5000.0 - inn.hp
	Run._temp_buffs.clear()
	check(near.call(echo_dmg, 2.0 * 9.0 * Run.atk_mult()), "분신 확률 100%%: 한 번 더 침(피해 2배)")
	inn.queue_free()
	out.queue_free()

	player.queue_free()
	health.queue_free()
	Run.boons = saved_boons
	Run._temp_buffs.clear()
	for s in Eq.SLOT_NAMES:
		Eq.equip(s, saved_equip[s])
	Engine.time_scale = 1.0
	print("PROBE dungeon_melee ", "OK" if fails == 0 else "FAIL %d" % fails)
	quit(1 if fails > 0 else 0)
