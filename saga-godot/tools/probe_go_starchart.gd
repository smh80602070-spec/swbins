extends SceneTree

## G-0215 1만리 성도(games/saga_go/data/go_starchart.gd · PartyState.passive · 효과 자리 · world/starchart_entry.gd) 자동 점검.
##   godot --headless --path saga-godot --script res://tools/probe_go_starchart.gd
## ① 점수 = 첫 별 1 + 모험 등급−1(PartyState.level) + ⌊도감 종/10⌋, 상한 56 ② 빈 성도 = 배수 1(기존 수치 그대로)
## ③ 찍으면 동료 공격·체력 비율 옵션(stat atk_pct·hp_pct)이 합/100 만큼 · 이동·설득·포획·경험 배수 = 1+합/100
## ④ 규칙 — 외길(들판 동행 1·×1.6) · 철벽 부대(받는 피해 ×0.7·이동 ×0.85) · 속전(토벌 45초·×1.35) · 무욕(경험 +50%·채집 ×0.5) ·
##    맨발(탈것 못 탐·이동 ×1.25·알 걸음 ×0.7) · 바람길(날기 ×1.3·땅 ×0.7) · 큰 그물(알 얻을 확률 ×2·설득 ×0.75) · 야행(밤·낮)
## ⑤ 설득 favor 가 같은 굴림에서 배수만큼 · 알 얻을 확률(상자 500번) ⑥ 되돌리기 모라 120(모자라면 막음) · 첫걸음 사명 "star"
## ⑦ 세이브 왕복(path_override)·옛 세이브(키 없음) = 빈 칸 · 입구(그룹 go_starchart·키 F2·메뉴 줄).
## 끝에 "PROBE go_starchart OK" 또는 "PROBE go_starchart FAIL n".

var fails := 0
var GS: GDScript
var api: RefCounted


func check(cond: bool, msg: String) -> void:
	if cond:
		print("  ok   ", msg)
	else:
		fails += 1
		print("  FAIL ", msg)


## 시작점 여섯 중 가장 가까운 곳에서 rule 마디까지 길째 찍는다(점수 56)
func take_rule(rule: String) -> bool:
	var target := ""
	for nd: Dictionary in api.def.nodes:
		if String(nd.get("rule", "")) == rule:
			target = String(nd.id)
	var best := ""
	var best_cost := 9999
	for s: Dictionary in api.def.starts:
		api.reset(true)
		api.take("o_" + String(s.key))
		var p: Dictionary = api.path_to(target)
		if not p.is_empty() and int(p.cost) < best_cost:
			best_cost = int(p.cost)
			best = String(s.key)
	api.reset(true)
	api.take("o_" + best)
	return api.take_path(target)


func _initialize() -> void:
	await process_frame
	var PS: Node = root.get_node("PartyState")
	var CS: Node = root.get_node("CodexState")
	var SS: Node = root.get_node("SaveState")
	GS = load("res://games/saga_go/data/go_starchart.gd")
	var saved := {"level": PS.level, "book": (CS.book as Dictionary).duplicate(), "passive": PS.passive.duplicate(true), "path": SS.path_override, "tut": PS.tut.duplicate()}
	PS.passive = {"start": null, "taken": []}

	# ① 점수
	PS.level = 0
	CS.book = {}
	var p1: int = GS.points_total()
	PS.level = 9
	var book := {}
	for i in 25:
		book["pet:p%d" % i] = true
	book["item:x"] = true
	CS.book = book
	var p2: int = GS.points_total()
	PS.level = 80
	var p3: int = GS.points_total()
	check(p1 == 1 and p2 == 12 and p3 == 56, "① 점수 처음 %d · 등급 10·도감 종 25 %d · 상한 %d" % [p1, p2, p3])

	# ② 빈 성도
	api = PS.passive_api()
	var keys := ["move", "atk", "hp", "take", "recruit", "egg_walk", "egg_find", "herb", "bond", "catch", "exp", "ki", "raid_atk"]
	var a0: float = PS.stat("self", "atk_pct")
	check(keys.all(func(k): return is_equal_approx(GS.mul(k), 1.0)) and GS.party_cap(3) == 3 and is_equal_approx(GS.raid_sec(75.0), 75.0) and is_equal_approx(GS.mount_mul(true), 1.0),
		"② 빈 성도 — 배수 %d 개 전부 1 · 동행 3 · 토벌 75초" % keys.size())

	# ③ 찍어서 오름
	api.take("o_wayfarer")
	for want in ["atkPct", "hpPct", "movePct", "recruitPct", "catchPct", "expPct"]:
		var best := ""
		var bc := 999
		for nd: Dictionary in api.def.nodes:
			if (nd.get("stats", {}) as Dictionary).has(want) and not api.is_taken(String(nd.id)):
				var pp: Dictionary = api.path_to(String(nd.id))
				if not pp.is_empty() and int(pp.cost) < bc:
					bc = int(pp.cost)
					best = String(nd.id)
		api.take_path(best)
	var d_atk: float = PS.stat("self", "atk_pct") - a0
	var ok3 := is_equal_approx(d_atk, api.sum("atkPct") / 100.0) and d_atk > 0.0
	for pair in [["move", "movePct"], ["recruit", "recruitPct"], ["catch", "catchPct"], ["exp", "expPct"], ["hp", "hpPct"]]:
		ok3 = ok3 and is_equal_approx(GS.mul(pair[0]), 1.0 + api.sum(pair[1]) / 100.0) and GS.mul(pair[0]) > 1.0
	check(ok3, "③ %d마디 — 동료 공격 비율 +%.2f · 이동 ×%.2f · 설득 ×%.2f · 포획 ×%.2f · 경험 ×%.2f · 체력 ×%.2f" % [api.used(), d_atk, GS.mul("move"), GS.mul("recruit"), GS.mul("catch"), GS.mul("exp"), GS.mul("hp")])

	# ④ 규칙
	var r1 := take_rule("onepath")
	var one: bool = r1 and GS.party_cap(3) == 1 and is_equal_approx(GS.mul("atk"), (1.0 + api.sum("atkPct") / 100.0) * 1.6)
	var r2 := take_rule("ironwall")
	var iron: bool = r2 and is_equal_approx(GS.mul("take"), 0.7) and is_equal_approx(GS.mul("move"), (1.0 + api.sum("movePct") / 100.0) * 0.85)
	var r3 := take_rule("blitz")
	var blitz: bool = r3 and is_equal_approx(GS.raid_sec(75.0), 45.0) and is_equal_approx(GS.mul("raid_atk"), (1.0 + api.sum("atkPct") / 100.0) * 1.35)
	var r4 := take_rule("unbound")
	var unb: bool = r4 and is_equal_approx(GS.mul("exp"), 1.0 + (api.sum("expPct") + 50.0) / 100.0) and is_equal_approx(GS.mul("herb"), (1.0 + api.sum("herbPct") / 100.0) * 0.5)
	var r5 := take_rule("barefoot")
	var gp: Object = (load("res://games/saga_go/player/go_player.gd") as GDScript).new()
	var bare: bool = r5 and int(gp.call("mount_chapter")) == -1 and is_equal_approx(GS.mul("egg_walk"), maxf(0.4, 1.0 - api.sum("eggPct") / 100.0) * 0.7)
	api.reset(true)
	var unbare: bool = int(gp.call("mount_chapter")) == int(PS.story.get("ch", 0))
	gp.free()
	var r6 := take_rule("windroad")
	var wind: bool = r6 and is_equal_approx(GS.mount_mul(true), 1.3) and is_equal_approx(GS.mount_mul(false), 0.7)
	var r7 := take_rule("bignet")
	var net: bool = r7 and is_equal_approx(GS.mul("egg_find"), (1.0 + api.sum("spawnRarePct") / 100.0) * 2.0) and is_equal_approx(GS.mul("recruit"), (1.0 + api.sum("recruitPct") / 100.0) * 0.75)
	var r8 := take_rule("nightowl")
	var night: bool = bool((load("res://games/saga_go/data/time_of_day.gd") as GDScript).call("is_night"))
	var owl: bool = r8 and is_equal_approx(GS.recruit_mul(), GS.mul("recruit") * (1.4 if night else 0.8))
	check(one and iron and blitz and unb and bare and unbare and wind and net and owl,
		"④ 규칙 여덟 — 외길 %s · 철벽 %s · 속전 %s · 무욕 %s · 맨발 %s(빼면 탈것 장 %s) · 바람길 %s · 큰 그물 %s · 야행 %s(지금 %s)" % [one, iron, blitz, unb, bare, unbare, wind, net, owl, "밤" if night else "낮"])

	# ⑤ 설득 favor·알 확률
	var PR: GDScript = load("res://games/saga_go/data/persuade_rules.gd")
	api.reset(true)
	seed(7)
	var s0: Object = PR.create("x")
	s0.call("appeal", "x")
	var f0: float = s0.favor
	take_rule("bignet")
	var rm: float = GS.recruit_mul()
	seed(7)
	var s1: Object = PR.create("x")
	s1.call("appeal", "x")
	var f1: float = s1.favor
	var Eggs: GDScript = load("res://games/saga_go/data/eggs.gd")
	var n_net := 0
	for i in 500:
		n_net += (Eggs.roll("chest:common", "probe%d" % i) as Array).size()
	api.reset(true)
	var n0 := 0
	for i in 500:
		n0 += (Eggs.roll("chest:common", "probe%d" % i) as Array).size()
	check(f0 > 0.0 and is_equal_approx(f1 / f0, rm) and absf(float(n0) / 500.0 - 0.12) < 0.05 and float(n_net) / float(maxi(1, n0)) > 1.6,
		"⑤ 설득 favor 같은 굴림 %.1f → %.1f(×%.2f) · 상자 알 500번 보통 %d · 큰 그물 %d" % [f0, f1, rm, n0, n_net])

	# ⑥ 되돌리기·첫걸음
	api.reset(true)
	api.take("o_wayfarer")
	var leaf: String = api.neighbors("o_wayfarer").filter(func(x): return String(api.node(x).k) != "o")[0]
	api.take(leaf)
	var mora0: int = int(PS.count("mora"))
	PS.bag["mora"] = 50
	var g_poor: String = GS.gate(leaf)
	PS.bag["mora"] = 500
	var g_ok: String = GS.gate(leaf)
	GS.pay_drop()
	var paid: int = 500 - PS.count("mora")
	PS.bag["mora"] = mora0
	var tut_has: bool = (load("res://games/saga_go/data/tutorial.gd") as GDScript).call("ids").has("star")
	check(g_poor != "" and g_ok == "" and paid == 120 and tut_has, "⑥ 모라 모자람 막음 · 되돌리기 모라 %d · 첫걸음 사명 star" % paid)

	# ⑦ 세이브 왕복·입구
	var stage := Node3D.new()
	root.add_child(stage)
	current_scene = stage
	var dummy := Node3D.new()
	dummy.add_to_group("player")
	stage.add_child(dummy)
	SS.path_override = "user://probe_go_starchart_save.json"
	var ok_save: bool = SS.save()
	PS.passive = {"start": null, "taken": []}
	var ok_load: bool = SS.try_load()
	var round_ok: bool = PS.passive.get("start") == "wayfarer" and (PS.passive.taken as Array) == [leaf] and PS.passive_api().is_taken(leaf)
	DirAccess.remove_absolute(ProjectSettings.globalize_path(SS.path_override))
	var Entry: GDScript = load("res://games/saga_go/world/starchart_entry.gd")
	var entry: Node = Entry.new()
	stage.add_child(entry)
	var scr: CanvasLayer = entry.call("open_screen")
	await process_frame
	var opened: bool = scr != null and is_instance_valid(scr) and bool(entry.get("is_open"))
	scr.call("close_screen")
	await process_frame
	var menu_row: bool = (load("res://games/saga_go/world/hud_menu.gd") as GDScript).get("ENTRIES").any(func(e): return e[0] == "go_starchart")
	var ev: Array = InputMap.action_get_events("go_starchart")
	check(ok_save and ok_load and round_ok and opened and not bool(entry.get("is_open")) and menu_row and ev.size() == 1 and (ev[0] as InputEventKey).physical_keycode == KEY_F2,
		"⑦ 세이브 왕복(%s·%d마디) · 그룹 go_starchart 로 열고 닫힘 · 메뉴 줄 · 키 F2" % [PS.passive.get("start"), (PS.passive.taken as Array).size()])

	PS.level = saved.level
	CS.book = saved.book
	PS.passive = saved.passive
	PS._passive_api = null
	PS.tut = saved.tut
	SS.path_override = saved.path
	stage.free()
	print("PROBE go_starchart OK" if fails == 0 else "PROBE go_starchart FAIL %d" % fails)
	quit(1 if fails > 0 else 0)
