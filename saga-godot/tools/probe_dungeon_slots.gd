extends SceneTree

## G-0198 사가나락 무예 넉 자리(Z·X·C·V)·공용 시전기(player/skill_caster.gd) 자동 점검 — 적 노드를 직접 세워 규칙 함수만 부른다(그림은 안 봄).
##   godot --headless --path saga-godot --script res://tools/probe_dungeon_slots.gd
## ① 자동 채움(처음 배운 활성 무예 → 빈 칸)·맞바꿈(setSlot)·패시브/안 배운 것/딴 직업 것 거절 ② 직업마다 넷 따로 — 무기를 바꾸면 시전기의 자리도 그 직업 것
## ③ 옛 세이브(skill_slots 없음)는 배운 활성 무예를 표 순서로 채움 · 새 세이브 slots 는 그대로 · 길이 넷 맞춤
## ④ 모양 아홉(bolt·swing·nova·dash·buff·heal·curse·summon·chain)+whirl·shots(a_multi 셋)·far(w_leap 0.36초)가 옛 사본과 같은 값 · 쿨다운은 무예 키별 · 입력 넷 = Z·X·C·V.
## ⑤ G-0200 시전 손맛 — 모양 아홉마다 숫자(popup) 수 = 맞은 적 수 · 여럿 맞혀도 멈칫(hitstop) 1 · 효과 노드가 생기고 1초 안에 스스로 지워짐 · 원소→입자 표가 ELEMENTS 일곱을 다 덮음.
## 상태는 끝에 되돌린다. 끝에 "PROBE dungeon_slots OK" 또는 "PROBE dungeon_slots FAIL n".

var fails := 0


func check(cond: bool, msg: String) -> void:
	if cond:
		print("  ok   ", msg)
	else:
		fails += 1
		print("  FAIL ", msg)


class FakePlayer extends CharacterBody3D:
	var dash_dir := Vector3.ZERO
	var dash_speed := 0.0


class FakeHealth extends Node:
	var max_hp := 200.0
	var healed: Array = []

	func heal_by(a: float) -> void:
		healed.append(a)


func _initialize() -> void:
	await process_frame
	seed(20260824)
	var Enemy: GDScript = load("res://games/saga_dungeon/world/dungeon_enemy.gd")
	var Caster: GDScript = load("res://games/saga_dungeon/player/skill_caster.gd")
	var Melee: GDScript = load("res://games/saga_dungeon/player/melee_attack.gd")
	var Skills: GDScript = load("res://games/saga_dungeon/data/dungeon_skills.gd")
	var Run: Node = root.get_node("DungeonRunState")
	var Eq: Node = root.get_node("DungeonEquipmentState")
	var SS: Node = root.get_node("DungeonSkillState")
	var saved := [SS.points.duplicate(true), SS.ranks.duplicate(true), SS.slots.duplicate(true), Run.boons.duplicate(true)]
	var saved_equip := {}
	for s in Eq.SLOT_NAMES:
		saved_equip[s] = (Eq.item_for(s) as Dictionary).duplicate(true)
		Eq.equip(s, {})
	Run.boons = {}
	Run._temp_buffs.clear()

	# ① 자동 채움·맞바꿈·거절
	SS.restore({"warrior": 10}, {}, {})
	SS.invest("w_whirl")
	SS.invest("w_whirl")
	SS.invest("w_dash")
	SS.invest("w_tough") # 패시브
	var ws: Array = SS.slots_of("warrior")
	check(ws == ["w_whirl", "w_dash", "", ""], "자동 채움: 처음 배운 활성 무예만 빈 칸에(두 번째 단은 다시 안 걸고, 패시브 w_tough 는 안 걸림) %s" % str(ws))
	check(SS.set_slot("warrior", 3, "w_whirl") and SS.slots_of("warrior") == ["", "w_dash", "", "w_whirl"], "set_slot: 이미 딴 칸에 걸린 것이면 맞바꿈(빈 칸과) %s" % str(SS.slots_of("warrior")))
	SS.set_slot("warrior", 1, "w_whirl")
	check(SS.slots_of("warrior") == ["", "w_whirl", "", "w_dash"], "set_slot: 걸린 두 칸끼리 맞바꿈 %s" % str(SS.slots_of("warrior")))
	check(not SS.set_slot("warrior", 0, "w_tough") and not SS.auto_slot("w_tough"), "패시브는 못 건다(set_slot·auto_slot)")
	check(not SS.set_slot("warrior", 0, "w_chain") and not SS.set_slot("warrior", 0, "a_multi") and not SS.set_slot("warrior", 4, "w_whirl"), "안 배운 것·딴 직업 것·자리 밖(4)은 거절")
	check(SS.set_slot("warrior", 1, "") and SS.slots_of("warrior")[1] == "", "빈 키로 칸 비우기")
	SS.set_slot("warrior", 0, "w_whirl")

	# ② 직업마다 넷
	SS.points["archer"] = 5
	SS.invest("a_pierce")
	check(SS.slots_of("archer") == ["a_pierce", "", "", ""] and SS.slots_of("warrior")[0] == "w_whirl", "직업마다 따로: 궁장에 배운 것은 궁장 넷에만")
	check(SS.equipped("warrior") == ["w_whirl", "", "", "w_dash"] and SS.equipped("archer")[0] == "a_pierce", "equipped(직업): 그 직업의 쓸 수 있는 것만")
	var world := Node3D.new()
	root.add_child(world)
	current_scene = world
	var health := FakeHealth.new()
	health.add_to_group("player_health")
	root.add_child(health)
	var player := FakePlayer.new()
	world.add_child(player)
	var vis := Node3D.new()
	vis.name = "Visual"
	player.add_child(vis)
	var caster: Node = Caster.new()
	player.add_child(caster)
	await process_frame
	check(caster.slot_key(0) == "w_whirl" and caster.slot_key(3) == "w_dash", "맨손(무장) — 시전기 자리 = 무장 넷")
	Eq.equip("weapon", {"base": "w_gakgung"})
	check(caster.slot_key(0) == "a_pierce" and caster.slot_key(3) == "", "활을 쥐면 — 시전기 자리 = 궁장 넷(무장 무예는 손에서 빠짐)")
	Eq.equip("weapon", {})

	# ③ 옛 세이브
	SS.restore({}, {"a_multi": 2, "w_dash": 1, "w_whirl": 3, "w_tough": 1, "s_wave": 1}, null)
	check(SS.slots_of("warrior") == ["w_whirl", "w_dash", "", ""] and SS.slots_of("archer") == ["a_multi", "", "", ""] and SS.slots_of("scholar") == ["s_wave", "", "", ""], "옛 세이브(skill_slots 없음): 배운 활성 무예를 표 순서로 직업마다 채움 %s" % str(SS.slots))
	check(SS.rank_of("w_whirl") == 3 and SS.rank_of("a_multi") == 2, "옛 세이브 단은 그대로")
	SS.restore({}, {"w_whirl": 1, "w_dash": 1}, {"warrior": ["w_dash", null, "w_whirl"]})
	check(SS.slots_of("warrior") == ["w_dash", "", "w_whirl", ""], "새 세이브: 저장된 자리 그대로(null→빈 칸, 길이 넷 맞춤)")

	# ④ 모양별 피해 — 옛 사본과 같은 식(치명 끔)
	var ranks := {}
	for k in ["s_wave", "w_whirl", "y_thunderdoom", "a_dashshot", "w_leap", "m_rally", "s_restore", "w_intimidate", "y_shade", "a_chain", "a_multi"]:
		ranks[k] = 3
	SS.restore({}, ranks, {})
	var spawn := func(pos: Vector3) -> Node:
		var e: Node = Enemy.new(12)
		world.add_child(e)
		(e as Node3D).global_position = pos
		e.hp = 5000.0
		e.max_hp = 5000.0
		e.resist = {}
		e._elite_def = {}
		return e
	var reset := func() -> Array:
		for c in world.get_children():
			if c != player:
				c.free()
		Run._temp_buffs.clear()
		Run.add_temp_buff("critPct", -1000.0, 60.0)
		health.healed.clear()
		caster._cd.clear()
		caster._dash_left = 0.0
		player.dash_speed = 0.0
		return [spawn.call(Vector3(1.0, 0, 0)), spawn.call(Vector3(0, 0, 1.8)), spawn.call(Vector3(-3.0, 0, 0)), spawn.call(Vector3(7.0, 0, 2.0))]
	var expect := func(k: String, mult: float = 1.0) -> float:
		var sk: Dictionary = Skills.skill_by_key(k)
		return maxf(1.0, roundf(Melee.ATK_DAMAGE * Run.atk_mult() * Skills.value_at(sk, 3) * mult * Run.skill_mul()))
	var lost := func(es: Array) -> Array: return es.map(func(e): return 5000.0 - e.hp)

	var es: Array = reset.call()
	check(caster.try_cast("s_wave") and lost.call(es) == [expect.call("s_wave"), 0.0, 0.0, 0.0], "bolt(s_wave): 가장 가까운 적 하나 %s" % str(lost.call(es)))
	es = reset.call()
	check(caster.try_cast("a_multi") and lost.call(es) == [expect.call("a_multi"), expect.call("a_multi"), expect.call("a_multi"), 0.0], "bolt shots(a_multi 3): 가까운 셋 %s" % str(lost.call(es)))
	es = reset.call()
	var wr: float = float(Skills.skill_by_key("w_whirl").r) * Run.reach_mult()
	var want_w: Array = es.map(func(e): return expect.call("w_whirl") if (e as Node3D).global_position.length() <= wr else 0.0)
	check(caster.try_cast("w_whirl") and lost.call(es) == want_w and want_w[0] > 0.0, "swing·whirl(w_whirl): 반경 r×사거리 안 전부 %s" % str(lost.call(es)))
	es = reset.call()
	var nr: float = float(Skills.skill_by_key("y_thunderdoom").r)
	var want_n: Array = es.map(func(e): return expect.call("y_thunderdoom") if (e as Node3D).global_position.length() <= nr else 0.0)
	check(caster.try_cast("y_thunderdoom") and lost.call(es) == want_n and want_n[0] > 0.0, "nova(y_thunderdoom): 반경 r 안 전부 %s" % str(lost.call(es)))
	es = reset.call()
	check(caster.try_cast("a_dashshot") and player.dash_speed > 0.0 and is_equal_approx(caster._dash_left, 0.2), "dash(a_dashshot): 0.2초 돌진 시작")
	caster._physics_process(0.05)
	check(lost.call(es) == [expect.call("a_dashshot"), expect.call("a_dashshot"), 0.0, 0.0] and not caster.try_cast("w_leap"), "dash: 지나는 적(2.4m) 한 번씩 · 돌진 중엔 다른 돌진 안 나감 %s" % str(lost.call(es)))
	for i in 4:
		caster._physics_process(0.05)
	check(player.dash_speed == 0.0, "dash: 시간이 다하면 멈춤")
	es = reset.call()
	check(caster.try_cast("w_leap") and is_equal_approx(caster._dash_left, 0.36), "dash far(w_leap 1.8): 0.36초")
	es = reset.call()
	var rally: Dictionary = Skills.skill_by_key("m_rally")
	check(caster.try_cast("m_rally") and is_equal_approx(float(Run._temp_buffs[str(rally.buff_eff)].v), Skills.value_at(rally, 3)), "buff(m_rally): 임시 은사 %s +%.0f" % [rally.buff_eff, Skills.value_at(rally, 3)])
	es = reset.call()
	check(caster.try_cast("s_restore") and health.healed.size() == 1 and is_equal_approx(health.healed[0], 200.0 * Skills.value_at(Skills.skill_by_key("s_restore"), 3) / 100.0), "heal(s_restore): 최대 체력 %")
	es = reset.call()
	var cr: float = float(Skills.skill_by_key("w_intimidate").r)
	check(caster.try_cast("w_intimidate") and es[0]._slow_mult == 0.35 and es[0]._hex_v == Skills.value_at(Skills.skill_by_key("w_intimidate"), 3) and (es[3]._hex_v == 0.0 or es[3].global_position.length() <= cr), "curse(w_intimidate): 반경 안 느려짐 0.35·약화")
	es = reset.call()
	var Minion: GDScript = load("res://games/saga_dungeon/world/dungeon_minion.gd")
	var minions := func() -> int: return world.get_children().filter(func(c): return c.get_script() == Minion).size()
	var n_before: int = minions.call()
	check(caster.try_cast("y_shade") and minions.call() - n_before == roundi(Skills.value_at(Skills.skill_by_key("y_shade"), 3)), "summon(y_shade): 분신 round(값)기")
	es = reset.call()
	check(caster.try_cast("a_chain") and lost.call(es)[0] == expect.call("a_chain") and lost.call(es).filter(func(v): return v > 0.0).size() == 3, "chain(a_chain): 첫 적 전부 · 세 번 튐 %s" % str(lost.call(es)))

	# ⑤ G-0200 시전 손맛(치명 끔 — 치명이면 stop_ms 0 이어도 +50ms 라 멈칫이 둘 셀 수 있다)
	var feel: Node = root.get_node("CombatFeel")
	var pops := [0]
	var stops := [0]
	feel.popup_triggered.connect(func(_a, _c): pops[0] += 1)
	feel.hitstop_triggered.connect(func(_d): stops[0] += 1)
	var fx_count := func() -> int: return world.get_children().filter(func(c): return c is CPUParticles3D or c is MeshInstance3D).size()
	var fx_bad: Array = []
	for k in ["s_wave", "a_multi", "w_whirl", "y_thunderdoom", "a_dashshot", "m_rally", "s_restore", "w_intimidate", "y_shade", "a_chain"]:
		es = reset.call()
		pops[0] = 0
		stops[0] = 0
		var ok5: bool = caster.try_cast(k)
		for i in 8:
			caster._physics_process(0.05)
		var hit_n: int = lost.call(es).filter(func(v): return v > 0.0).size()
		var fx_n: int = fx_count.call()
		if not ok5 or pops[0] != hit_n or stops[0] != mini(hit_n, 1) or fx_n == 0:
			fx_bad.append("%s ok=%s 맞음%d 숫자%d 멈칫%d 효과%d" % [k, ok5, hit_n, pops[0], stops[0], fx_n])
	check(fx_bad.is_empty(), "시전 손맛: 모양 아홉(+shots·chain) 숫자 = 맞은 적 · 멈칫 시전당 1 · 효과 노드 생김 %s" % str(fx_bad))
	es = reset.call()
	caster.try_cast("w_whirl")
	var fx_on: int = fx_count.call()
	## create_timer 는 첫 프레임 delta(앞 점검이 동기로 쓴 시간)에 바로 끝난다 — 실제 시간으로 1.2초 프레임을 돌린다.
	var t0 := Time.get_ticks_msec()
	while Time.get_ticks_msec() - t0 < 1200:
		await process_frame
	check(fx_on > 0 and fx_count.call() == 0, "효과 노드는 1초 남짓 안에 스스로 지워짐 %d → %d" % [fx_on, fx_count.call()])
	Engine.time_scale = 1.0
	var CombatFx: GDScript = load("res://saga_core/combat_fx.gd")
	var el_miss: Array = []
	for e: Dictionary in load("res://games/saga_dungeon/data/dungeon_items.gd").ELEMENTS:
		if not Caster.EL_PARTICLE.has(e.key) or not CombatFx.PARTICLES.has(Caster.EL_PARTICLE[e.key]):
			el_miss.append(e.key)
	check(el_miss.is_empty() and Caster.el_color({"el": "emp"}).is_equal_approx(Color("#ff4fd8")) and Caster.el_color({"el": "fire"}).is_equal_approx(Color("#e2601a")), "원소→입자 표가 ELEMENTS 일곱을 다 덮고 색은 표 그대로 %s" % str(el_miss))

	# G-0199 br6·br7 30 — 공용 시전기로 하나씩 실제 시전(표만 늘려도 나간다)
	var new_keys: Array = Skills.SKILLS.filter(func(s): return int(s.br) >= 6).map(func(s): return String(s.key))
	var r30 := {}
	for k in new_keys:
		r30[k] = 1
	SS.restore({}, r30, {})
	var dead30: Array = []
	for k in new_keys:
		es = reset.call()
		var cast_ok: bool = caster.try_cast(k)
		for i in 8:
			caster._physics_process(0.05)
		var dealt: float = lost.call(es).reduce(func(a, b): return a + b, 0.0)
		if not cast_ok or dealt <= 0.0:
			dead30.append(k)
	check(new_keys.size() == 30 and dead30.is_empty(), "br6·br7 30 이 다 시전되고 피해를 냄(bolt·nova·chain·swing·dash) %s" % str(dead30))
	SS.restore({}, ranks, {})
	es = reset.call()
	caster.try_cast("a_chain")

	# 쿨다운·입력
	check(not caster.try_cast("a_chain") and caster.cooldown_left("a_chain") > 0.0 and caster.try_cast("s_wave"), "쿨다운은 무예 키별(a_chain 쿨 중에도 s_wave 는 나감)")
	caster._process(100.0)
	check(caster.cooldown_left("a_chain") == 0.0 and caster._cd.is_empty(), "쿨다운이 다하면 지움")
	var keys := []
	for a in ["dungeon_slot_1", "dungeon_slot_2", "dungeon_slot_3", "dungeon_slot_4"]:
		var evs := InputMap.action_get_events(a) if InputMap.has_action(a) else []
		keys.append((evs[0] as InputEventKey).physical_keycode if evs.size() > 0 else 0)
	check(keys == [KEY_Z, KEY_X, KEY_C, KEY_V] and not InputMap.has_action("dungeon_skill_1"), "입력 dungeon_slot_1~4 = Z·X·C·V · 옛 dungeon_skill_N 없음")
	check(Skills.SKILLS.filter(func(s): return Skills.is_active(s)).size() >= 76 and Skills.SKILLS.filter(func(s): return Skills.is_active(s) and not s.has("icon")).is_empty(), "활성 무예(76+) 모두 icon — 새 활성 무예는 표에 icon 칸")

	# 되돌림
	SS.restore(saved[0], saved[1], saved[2])
	Run.boons = saved[3]
	Run._temp_buffs.clear()
	for s in Eq.SLOT_NAMES:
		Eq.equip(s, saved_equip[s])
	print("PROBE dungeon_slots OK" if fails == 0 else "PROBE dungeon_slots FAIL %d" % fails)
	quit(0)
