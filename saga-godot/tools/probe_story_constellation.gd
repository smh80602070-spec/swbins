extends SceneTree

## G-0214 4종횡 사방 성좌도(data/story_constellation.gd · StorySaveState.passive · player 효과 자리 · ui/constellation_button.gd) 자동 점검.
##   godot --headless --path saga-godot --script res://tools/probe_story_constellation.gd
## ① 점수 = (레벨−1) + 관문 대장 첫 승리 마을 수, 상한 56 ② 첫 점은 무명·지금 계열만 ③ 빈 성좌 = 배수 1(기존 수치 그대로)
## ④ 찍으면 공격·체력·이동·점프가 (1+합/100) 배, 받는 피해 줄음 ⑤ 규칙 — 비연(공중 2.6m·0.6초 쿨)·한 방(무예 쿨 ×1.4, 공격 ×1.6)·
##    사냥꾼의 눈(경험 −20%·드롭 ×1.4)·연타(타수 +1) ⑥ 되돌리기 — 사냥터 안 거절·금 모자람 거절·마을에서 금 200 내고 되돌림(HUD 단추로 연 화면)
## ⑦ 세이브 왕복(passive 한 칸)·옛 세이브 19 → 빈 칸 · 키 L(story_passive). 진짜 세이브는 안 건드림(path_override).
## 끝에 "PROBE story_constellation OK" 또는 "PROBE story_constellation FAIL n".

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
	var S: Node = root.get_node("StorySaveState")
	var R: Node = root.get_node("StoryLabyrinthState")
	var SC: GDScript = load("res://games/saga_story/data/story_constellation.gd")
	var saved := {"job": S.job, "equipped": S.equipped.duplicate(), "level": S.level, "gold": S.gold, "exp": S.exp,
		"wcw": S.weekly_champion_week.duplicate(), "passive": S.passive.duplicate(true), "boons": R.boons.duplicate(), "path": S.path_override}
	S.equipped = {}
	R.boons = {}
	S.job = "warrior"
	S.passive = {"start": null, "taken": []}
	var scene: PackedScene = load("res://games/saga_story/player/StoryPlayer.tscn")
	var p: CharacterBody3D = scene.instantiate()
	root.add_child(p)
	p.set_physics_process(false)
	p.set_process(false)
	await process_frame

	# ① 점수
	S.level = 1
	S.weekly_champion_week = {}
	var p1: int = SC.points_total()
	S.level = 10
	S.weekly_champion_week = {"field": 1, "cave": 1}
	var p2: int = SC.points_total()
	S.level = 80
	S.weekly_champion_week = {"a": 1, "b": 1, "c": 1, "d": 1, "e": 1}
	var p3: int = SC.points_total()
	check(p1 == 0 and p2 == 11 and p3 == 56, "① 점수 Lv1 %d · Lv10+관문 둘 %d · 상한 %d" % [p1, p2, p3])

	# ② 첫 점 계열
	var g_arch: String = SC.gate(self, "o_archer")
	check(g_arch != "" and SC.gate(self, "o_warrior") == "" and SC.gate(self, "o_none") == "", "② 무사는 무명·무사의 별만 · 궁수의 별 막음(\"%s\")" % g_arch)

	# ③ 빈 성좌 = 1
	var api: RefCounted = S.passive_api()
	var base_atk: float = p._effective_atk()
	var base_hp: float = p.max_hp
	var keys_one := ["atk", "hp", "mp", "move", "jump", "dodge", "cd", "take", "drop", "exp"]
	var all_one := keys_one.all(func(k): return is_equal_approx(SC.mul(k), 1.0)) and is_equal_approx(SC.mul("crit"), 0.0)
	Input.action_press("move_right")
	p._coyote_time_left = 0.05
	p._jump_buffer_left = 0.1
	p.velocity = Vector3.ZERO
	p._walk(1.0 / 60.0)
	var base_move: float = p.velocity.x
	var base_jump: float = p.velocity.y
	p.hp = p.max_hp
	p._invuln_time_left = 0.0
	p.take_damage(10.0)
	var base_take: float = p.max_hp - p.hp
	check(all_one, "③ 빈 성좌 — 배수 전부 1 · 급소 +0 (공격 %.1f · 이동 %.2f · 점프 %.2f · 피해 %.2f)" % [base_atk, base_move, base_jump, base_take])

	# ④ 찍어서 오름 — 무사 시작 → 비연까지 길(공격·체력·이동) + 받는 피해·점프 마디 하나씩
	S.level = 57
	S.weekly_champion_week = {}
	api.take("o_warrior")
	api.take_path("k_biyeon")
	for want in ["guardPct", "jumpPct"]:
		var best := ""
		var best_cost := 999
		for nd: Dictionary in api.def.nodes:
			if (nd.get("stats", {}) as Dictionary).has(want) and not api.is_taken(String(nd.id)):
				var pp: Dictionary = api.path_to(String(nd.id))
				if not pp.is_empty() and int(pp.cost) < best_cost:
					best_cost = int(pp.cost)
					best = String(nd.id)
		api.take_path(best)
	var e_atk: float = 1.0 + api.sum("atkPct") / 100.0
	var e_move: float = 1.0 + api.sum("movePct") / 100.0
	var e_jump: float = 1.0 + api.sum("jumpPct") / 100.0
	var e_take: float = maxf(0.5, 1.0 - api.sum("guardPct") / 100.0)
	var e_hp: float = 1.0 + api.sum("hpPct") / 100.0
	p._coyote_time_left = 0.05
	p._jump_buffer_left = 0.1
	p.velocity = Vector3.ZERO
	p._walk(1.0 / 60.0)
	var mv: float = p.velocity.x / base_move
	var jp: float = p.velocity.y / base_jump
	p.hp = p.max_hp
	p.take_damage(10.0)
	var tk: float = (p.max_hp - p.hp) / base_take
	var at: float = p._effective_atk() / base_atk
	var hpr: float = p.max_hp / base_hp
	check(is_equal_approx(at, e_atk) and is_equal_approx(mv, e_move) and is_equal_approx(jp, e_jump) and is_equal_approx(tk, e_take) and is_equal_approx(hpr, e_hp)
		and at > 1.0 and mv > 1.0 and jp > 1.0 and tk < 1.0,
		"④ %d마디 — 공격 ×%.2f · 체력 ×%.2f · 이동 ×%.2f · 점프 ×%.2f · 받는 피해 ×%.2f (= 1+합/100)" % [api.used(), at, hpr, mv, jp, tk])

	# ⑤ 규칙
	var has_b: bool = SC.has_rule("biyeon")
	p.global_position = Vector3(10, 5, 0)
	p._facing = 1.0
	var x0: float = p.global_position.x
	var blink1: bool = p._try_blink()
	var x1: float = p.global_position.x
	var blink2: bool = p._try_blink()
	check(has_b and blink1 and absf(x1 - x0 - 2.6) < 1e-4 and not blink2, "⑤ 비연 — 공중 순간 이동 %.2fm · 0.6초 안 다시는 안 됨" % (x1 - x0))
	api.reset(true)
	api.take("o_warrior")
	var ok_h: bool = api.take_path("k_hanbang")
	var e_cd: float = maxf(0.5, 1.0 - api.sum("cdPct") / 100.0) * 1.4
	var e_atk_h: float = (1.0 + api.sum("atkPct") / 100.0) * 1.6
	p._cd_brace = 1.0
	p._physics_process(0.1)
	var cd_used: float = 1.0 - p._cd_brace
	check(ok_h and SC.has_rule("hanbang") and is_equal_approx(SC.mul("cd"), e_cd) and absf(cd_used - 0.1 / e_cd) < 1e-4 and is_equal_approx(p._effective_atk() / base_atk, e_atk_h),
		"⑤ 한 방 — 무예 쿨 배수 %.2f(0.1초에 %.3f 줆) · 공격 ×%.2f" % [SC.mul("cd"), cd_used, p._effective_atk() / base_atk])
	api.reset(true)
	api.take("o_warrior")
	var ok_e: bool = api.take_path("k_hunteye")
	var e_exp: float = 1.0 + (api.sum("expPct") - 20.0) / 100.0
	var e_drop: float = (1.0 + api.sum("dropPct") / 100.0) * 1.4
	S.level = 60
	S.exp = 0
	S.add_exp(100)
	var got_exp: int = S.exp
	check(ok_e and is_equal_approx(SC.mul("exp"), e_exp) and got_exp == roundi(100 * e_exp) and is_equal_approx(SC.mul("drop"), e_drop),
		"⑤ 사냥꾼의 눈 — 경험 100 → %d(×%.2f) · 드롭 ×%.2f" % [got_exp, e_exp, e_drop])
	api.reset(true)
	api.take("o_warrior")
	var ok_y: bool = api.take_path("k_yeonta")
	var foe_s := GDScript.new()
	foe_s.source_code = "extends Node3D\nvar hits := 0\nfunc take_damage(_a: float) -> void:\n\thits += 1\n"
	foe_s.reload()
	var foe := Node3D.new()
	foe.set_script(foe_s)
	foe.add_to_group("story_enemy")
	root.add_child(foe)
	foe.global_position = p.global_position + Vector3(0.5, 0, 0)
	p._attack()
	var hits_y: int = foe.hits
	api.reset(true)
	foe.hits = 0
	p._attack()
	check(ok_y and hits_y == 2 and foe.hits == 1, "⑤ 연타 — 기본 공격 한 번에 %d타(없으면 %d타)" % [hits_y, foe.hits])
	foe.free()

	# ⑥ 되돌리기 — HUD 단추로 연 화면
	api.take("o_warrior")
	var leaf: String = api.neighbors("o_warrior").filter(func(x): return String(api.node(x).k) != "o")[0]
	api.take(leaf)
	var hunt := Node.new()
	hunt.add_to_group("story_hunt_events")
	root.add_child(hunt)
	var g_hunt: String = SC.gate(self, leaf)
	hunt.free()
	S.gold = 100
	var g_poor: String = SC.gate(self, leaf)
	S.gold = 500
	var Btn: GDScript = load("res://games/saga_story/ui/constellation_button.gd")
	var btn := Button.new()
	btn.set_script(Btn)
	var stage := Node.new()
	root.add_child(stage)
	current_scene = stage
	stage.add_child(btn)
	var scr: CanvasLayer = btn.open_screen()
	await process_frame
	scr.select(leaf)
	var label: String = scr._card_btn.text
	scr._on_card_btn()
	var dropped: bool = not api.is_taken(leaf)
	var gold_after: int = S.gold
	scr.close_screen()
	await process_frame
	check(g_hunt == "되돌리기는 사냥터 밖에서만" and g_poor != "" and label == "되돌리기" and dropped and gold_after == 300 and btn.text == "✨ 성좌" and InputMap.has_action("story_passive"),
		"⑥ 사냥터 안 \"%s\" · 금 모자람 거절 · 마을에서 \"%s\" → 금 500→%d · 단추 「%s」·키 story_passive" % [g_hunt, label, gold_after, btn.text])
	stage.free()

	# ⑦ 세이브 왕복·옛 세이브
	S.path_override = "user://probe_constellation_save.json"
	api.reset(true)
	api.take("o_warrior")
	api.take(leaf)
	var saved_ok: bool = S.save()
	S.passive = {"start": null, "taken": []}
	var load_ok: bool = S.try_load()
	var round_ok: bool = S.passive.get("start") == "warrior" and (S.passive.taken as Array) == [leaf] and S.passive_api().is_taken(leaf)
	var f := FileAccess.open(S.path_override, FileAccess.WRITE)
	f.store_string(JSON.stringify({"version": 19, "player_pos": [0, 0, 0], "level": 3}))
	f.close()
	var old_ok: bool = S.try_load()
	var old_empty: bool = S.passive.get("start") == null and (S.passive.taken as Array).is_empty()
	DirAccess.remove_absolute(ProjectSettings.globalize_path(S.path_override))
	check(saved_ok and load_ok and round_ok and old_ok and old_empty and S.SAVE_VERSION >= 20,   # G-0283 — 뒤 티켓(G-0238 21·G-0245 22)이 올려도 이 칸(성좌) 왕복은 그대로
		"⑦ 세이브 왕복(시작 %s·%d마디) · 옛 세이브 19 → 빈 칸 · 버전 20" % [S.passive.get("start"), (S.passive.taken as Array).size()])

	Input.action_release("move_right")
	S.job = saved.job
	S.equipped = saved.equipped
	S.level = saved.level
	S.gold = saved.gold
	S.exp = saved.exp
	S.weekly_champion_week = saved.wcw
	S.passive = saved.passive
	S.path_override = saved.path
	R.boons = saved.boons
	p.free()
	print("PROBE story_constellation OK" if fails == 0 else "PROBE story_constellation FAIL %d" % fails)
	quit(1 if fails > 0 else 0)
