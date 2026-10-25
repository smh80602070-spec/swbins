extends SceneTree

## G-0399 4종횡 장비 세트·고유 효과·몰이 파도(웹 W-0437 짝) 점검 —
##   godot --headless --path saga-godot --script res://tools/probe_story_gear_wave.gd   → "PROBE story_gear_wave OK" / "FAIL n"
## ① 세트: 흑룡 두 점 → 공격 +8 · 넷 → +8·체력 +120·방어 +12 누적 · 요구 수준 미달은 안 셈 · gear_totals 에 얹힘
## ② 세트 무예: 네 점 → F 흑룡파 · 쓰면 쿨 12 · 쿨 중 안 됨 · 세 점이면 무예 없음 ③ 고유 효과: 진룡도 처치마다 체력 2% · 구룡지환 기력 +3 · 호랑수갑 시전 기력 25% 되돌림 · 요구 수준 미달 안 걸림
## ④ 몰이: SAGA_HUNT_WAVE_N=3 이면 처치 셋째에 파도 1(4마리) · 몰이 몹은 무리 수 밖 · 다 잡으면 다음 파도(6) · 다섯째에 「몰이 대장」(체력 ×8·굴림 2) · 끝 · 시간 다하면 흩어짐
## ⑤ 「내 정보」 세트·고유 줄 ⑥ 손잡이 0 = 끔. 장비·레벨은 끝에 되돌린다(세이브는 안 씀).

var fails := 0


func check(cond: bool, msg: String) -> void:
	if cond:
		print("  ok   ", msg)
	else:
		fails += 1
		print("  FAIL ", msg)


func _kill(e: Node) -> void:
	if e != null and is_instance_valid(e) and e.has_method("_die"):
		e.call("_die")


func _initialize() -> void:
	await process_frame
	var S: Node = root.get_node("StorySaveState")
	var GS: GDScript = load("res://games/saga_story/data/story_gear_set.gd")
	var UF: GDScript = load("res://games/saga_story/data/story_unique_fx.gd")
	var HW: GDScript = load("res://games/saga_story/world/story_hunt_wave.gd")
	OS.set_environment("SAGA_HUNT_WAVE_N", "3")
	OS.set_environment("SAGA_ELITE", "0")
	var sc := (load("res://games/saga_story/world/TestField.tscn") as PackedScene).instantiate()
	root.add_child(sc)
	current_scene = sc
	for i in 5:
		await process_frame
	paused = false
	var saved := {"eq": (S.equipped as Dictionary).duplicate(), "lv": S.level, "sb": (S.scroll_bonus as Dictionary).duplicate(true)}
	S.scroll_bonus = {}
	S.level = 30

	# ①
	S.equipped = {"shoes": "shoe4", "glove": "glv4"}
	var b2: Dictionary = GS.bonus_of(GS.worn_keys(S))
	S.equipped = {"shoes": "shoe4", "glove": "glv4", "cape": "cap4", "ring": "ring4"}
	var b4: Dictionary = GS.bonus_of(GS.worn_keys(S))
	var base4: Dictionary = preload("res://games/saga_story/data/story_combat_base.gd").gear_totals((S.equipped as Dictionary).values())
	var tot4: Dictionary = S.gear_totals()
	S.level = 10
	var low: Dictionary = GS.bonus_of(GS.worn_keys(S))
	S.level = 30
	check(is_equal_approx(float(b2.atk), 8.0) and float(b2.hp) == 0.0 and is_equal_approx(float(b4.hp), 120.0) and is_equal_approx(float(b4.def), 12.0)
		and is_equal_approx(float(tot4.atk) - float(base4.atk), 8.0) and float(low.atk) == 0.0, "① 두 점 공격 +%d · 넷 체력 +%d 방어 +%d · 합에 얹힘 · 수준 미달 0" % [int(b2.atk), int(b4.hp), int(b4.def)])

	# ② 사냥터 씬
	var pl: Node = get_first_node_in_group("player") if false else sc.get_tree().get_first_node_in_group("player")
	var ok1: bool = pl.call("cast_gear_set")
	var cd: float = pl.call("set_skill_cd")
	var ok2: bool = pl.call("cast_gear_set")
	S.equipped.erase("ring")
	var three: Array = GS.skills_of(GS.worn_keys(S))
	check(ok1 and absf(cd - 12.0) < 0.05 and not ok2 and three.is_empty(), "② 네 점 → F 흑룡파 · 쿨 %.1f · 쿨 중 안 됨 · 세 점이면 무예 없음" % cd)

	# ③
	S.equipped = {"weapon": "u_sword", "ring": "u_ring", "glove": "u_glove"}
	pl.set("hp", 10.0)
	pl.set("mp", 0.0)
	var mh: float = float(pl.get("max_hp"))
	var n_kill: int = UF.fire("kill", S, pl)
	var hp1: float = float(pl.get("hp"))
	var mp1: float = float(pl.get("mp"))
	var n_cast: int = UF.fire("cast", S, pl, 20.0)
	var mp2: float = float(pl.get("mp"))
	S.level = 5
	var n_low: int = UF.fire("kill", S, pl)
	S.level = 30
	check(n_kill == 2 and is_equal_approx(hp1, 10.0 + roundf(mh * 0.02)) and is_equal_approx(mp1, 3.0) and n_cast == 1 and is_equal_approx(mp2 - mp1, 5.0) and n_low == 0,
		"③ 처치 효과 둘(체력 +%d·기력 +3) · 시전 되돌림 +%d · 수준 미달 0" % [int(hp1 - 10.0), int(mp2 - mp1)])
	var en := FileAccess.get_file_as_string("res://games/saga_story/world/story_enemy.gd")
	var pb := FileAccess.get_file_as_string("res://games/saga_story/player/story_player_base.gd")
	check(en.contains("story_unique_fx.gd\").fire(\"boss\" if (is_boss or is_mini) else \"kill\"") and pb.contains("story_unique_fx.gd\").fire(\"cast\""), "③ 배선(적 처치·무예 몸짓 자리)")

	# ④
	var hw := sc.find_child("StoryHuntWave", true, false)
	var sp: Node = hw.get_parent() if hw != null else null
	var grunts := func() -> Array:
		return sp.get_children().filter(func(c: Node) -> bool: return c.has_method("_die") and not c.has_meta("wave") and not bool(c.get("_dead")))
	var wavers := func() -> Array:
		return sp.get_children().filter(func(c: Node) -> bool: return c.has_meta("wave") and not bool(c.get("_dead")) and not c.is_queued_for_deletion())
	var n0: int = (grunts.call() as Array).size()
	for i in 3:
		_kill((grunts.call() as Array)[0])
		await process_frame
		await process_frame
	var w1: int = (wavers.call() as Array).size()
	check(hw != null and bool(hw.get("active")) and w1 == HW.wave_size(0) and (grunts.call() as Array).size() == n0, "④ 처치 셋째 → 몰이 파도 1(%d마리) · 잡몹 수 그대로" % w1)
	var sizes: Array = [w1]
	var boss := {}
	for w in range(1, HW.WAVES + 1):
		for e: Node in (wavers.call() as Array):
			if e.has_meta("wave_boss"):
				boss = {"hp": float(e.get("mini_hp_mul")), "drops": int(e.get("elite_drops"))}   # 죽이기 전에 적어 둠(죽으면 노드가 풀린다)
			_kill(e)
		await process_frame
		hw.call("tick", 0.1)
		await process_frame
		if w < HW.WAVES:
			sizes.append((wavers.call() as Array).size())
	check(sizes == [4, 6, 8, 10, 13] and not boss.is_empty() and float(boss.hp) == 8.0 and int(boss.drops) == HW.LOOT and not bool(hw.get("active")) and int(hw.get("finished")) == 1,
		"④ 파도 %s(마지막 = 12 + 대장) · 대장 체력 ×8·굴림 2 · 몰이 끝" % str(sizes))
	hw.call("start")
	await process_frame
	hw.call("tick", 200.0)
	await process_frame
	check(not bool(hw.get("active")) and (wavers.call() as Array).is_empty(), "④ 시간 다하면 흩어짐")

	# ⑤
	S.equipped = {"shoes": "shoe4", "glove": "glv4", "weapon": "u_sword"}
	var rows: Array = GS.me_rows(S)
	var ur: Dictionary = UF.me_row(S)
	check(rows.size() == 1 and String(rows[0].value) == "2/4" and String(ur.get("detail", "")).contains("체력 2%"), "⑤ 「내 정보」 세트 %s · 고유 「%s」" % [String(rows[0].value) if not rows.is_empty() else "-", String(ur.get("detail", ""))])

	# ⑥
	OS.set_environment("SAGA_GEAR_SET", "0")
	OS.set_environment("SAGA_UNIQUE_FX", "0")
	OS.set_environment("SAGA_HUNT_WAVE", "0")
	S.equipped = {"shoes": "shoe4", "glove": "glv4", "cape": "cap4", "ring": "ring4", "weapon": "u_sword"}
	check(float(GS.bonus_of(GS.worn_keys(S)).atk) == 0.0 and GS.skills_of(GS.worn_keys(S)).is_empty() and UF.fire("kill", S, pl) == 0 and HW.attach(Node.new()) == null, "⑥ 손잡이 0 = 끔")
	for k in ["SAGA_GEAR_SET", "SAGA_UNIQUE_FX", "SAGA_HUNT_WAVE", "SAGA_HUNT_WAVE_N", "SAGA_ELITE"]:
		OS.set_environment(k, "")
	S.equipped = saved.eq
	S.level = saved.lv
	S.scroll_bonus = saved.sb
	print("PROBE story_gear_wave ", "OK" if fails == 0 else "FAIL %d" % fails)
	quit(1 if fails > 0 else 0)
