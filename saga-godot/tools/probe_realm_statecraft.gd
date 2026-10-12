extends SceneTree

## G-0216 5천하 경륜도(games/saga_realm/data/realm_statecraft.gd · RealmSaveState.passive · 효과 자리 · ui/statecraft_button.gd) 자동 점검.
##   godot --headless --path saga-godot --script res://tools/probe_realm_statecraft.gd
## ① 점수 = 첫 별 1 + 빼앗은 성 + ⌊지난 달/6⌋, 상한 56 ② 빈 경륜도 = 배수 1 ③ 찍으면 개간 성과(같은 굴림)·출병 공격(같은 굴림 step_round)이 오름,
##    배수 = 1+합/100 ④ 규칙 여덟 — 무위·둔전·원교근공·일인지하·공성 전문(성벽 ×2)·화공(비 달 막음)·청야·철기
## ⑤ 되돌리기 — 이번 달 명령 뒤 막음·금 모자람 막음·금 150 ⑥ 세이브 왕복(path_override)·옛 19 = 빈 칸 · 버전 20 ⑦ 단추 「🧭 경륜」·키 F2.
## 끝에 "PROBE realm_statecraft OK" 또는 "PROBE realm_statecraft FAIL n".

var fails := 0
var SC: GDScript
var api: RefCounted


func check(cond: bool, msg: String) -> void:
	if cond:
		print("  ok   ", msg)
	else:
		fails += 1
		print("  FAIL ", msg)


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
	var RS: Node = root.get_node("RealmSaveState")
	SC = load("res://games/saga_realm/data/realm_statecraft.gd")
	var War: GDScript = load("res://games/saga_realm/data/realm_war.gd")
	var Orders: GDScript = load("res://games/saga_realm/data/realm_orders.gd")
	var saved := {"enemies": (RS.enemies as Dictionary).duplicate(true), "year": RS.year, "month": RS.month, "scen": RS.scenario_id, "gold": RS.gold,
		"passive": (RS.passive as Dictionary).duplicate(true), "done": (RS._done_this_month as Dictionary).duplicate(), "path": RS.path_override}
	RS.passive = {"start": null, "taken": []}

	# ① 점수
	RS.scenario_id = "194"
	RS.year = 194
	RS.month = 1
	for k in RS.enemies:
		RS.enemies[k]["captured"] = false
	var p1: int = SC.points_total()
	var ks: Array = (RS.enemies as Dictionary).keys()
	for i in 3:
		RS.enemies[ks[i]]["captured"] = true
	RS.year = 195
	RS.month = 7
	var p2: int = SC.points_total()
	RS.year = 230
	var p3: int = SC.points_total()
	check(p1 == 1 and p2 == 7 and p3 == 56, "① 점수 처음 %d · 성 셋·18달 %d · 상한 %d" % [p1, p2, p3])

	# ② 빈 경륜도
	api = RS.passive_api()
	var keys := ["gold", "food", "eat", "gov", "wall", "draft", "hire", "diplo", "plot", "fire", "atk", "take", "field", "siege", "chip", "exp", "enemy_atk"]
	check(keys.all(func(k): return is_equal_approx(SC.mul(k), 1.0)) and is_equal_approx(SC.diplo_mul(true), 1.0) and not SC.fire_blocked(6, true),
		"② 빈 경륜도 — 배수 %d 개 전부 1 · 화계 안 막힘" % keys.size())

	# ③ 찍어서 오름 — 같은 굴림으로 개간 성과·출병 공격
	var o: Dictionary = Orders.ORDERS[0]
	var off: String = String(RS.roster[0])
	RS._rng.seed = 4242
	var r0: Dictionary = RS._roll_amount(o, off)
	var mk_atk := func(extra: Dictionary) -> Dictionary:
		var a := {"troops": 5000, "start": 5000, "train": 50, "tech": 50, "best_command": 70.0, "best_might": 70.0, "officer_count": 1}
		a.merge(extra, true)
		return a
	var mk_def := func() -> Dictionary: return {"troops": 9000, "start": 9000, "train": 50, "tech": 50, "best_command": 60.0, "best_might": 60.0, "officer_count": 1}
	var rng := RandomNumberGenerator.new()
	rng.seed = 7
	var d0: Dictionary = mk_def.call()
	War.step_round(mk_atk.call({}), d0, {"wall": 500, "max_wall": 1000}, 1.0, 1.0, true, rng)
	api.take("o_mokmin")
	for want in ["govPct", "atkPct", "goldPct", "hirePct", "plotPct"]:
		var best := ""
		var bc := 999
		for nd: Dictionary in api.def.nodes:
			if (nd.get("stats", {}) as Dictionary).has(want) and not api.is_taken(String(nd.id)):
				var pp: Dictionary = api.path_to(String(nd.id))
				if not pp.is_empty() and int(pp.cost) < bc:
					bc = int(pp.cost)
					best = String(nd.id)
		RS.year = 230
		api.take_path(best)
	RS._rng.seed = 4242
	var r1: Dictionary = RS._roll_amount(o, off)
	rng.seed = 7
	var d1: Dictionary = mk_def.call()
	War.step_round(mk_atk.call({"give": SC.mul("atk")}), d1, {"wall": 500, "max_wall": 1000}, 1.0, 1.0, true, rng)
	var gov: float = SC.mul("gov")
	var loss0: int = 9000 - int(d0.troops)
	var loss1: int = 9000 - int(d1.troops)
	var ok3: bool = int(r1.amount) == roundi(float(r0.amount) * gov) and gov > 1.0 and absf(float(loss1) / float(loss0) - SC.mul("atk")) < 0.01 and SC.mul("atk") > 1.0
	for pair in [["gold", "goldPct"], ["hire", "hirePct"], ["plot", "plotPct"]]:
		ok3 = ok3 and is_equal_approx(SC.mul(pair[0]), 1.0 + api.sum(pair[1]) / 100.0)
	check(ok3, "③ %d마디 — 개간 %d → %d(×%.2f) · 출병 공격 적 손실 %d → %d(×%.2f) · 금 ×%.2f · 등용 ×%.2f · 계략 ×%.2f" % [api.used(), r0.amount, r1.amount, gov, loss0, loss1, SC.mul("atk"), SC.mul("gold"), SC.mul("hire"), SC.mul("plot")])

	# ④ 규칙
	var muwi: bool = take_rule("muwi") and is_equal_approx(SC.mul("gold"), 0.0) and is_equal_approx(SC.mul("food"), (1.0 + api.sum("foodPct") / 100.0) * 2.0)
	var tun: bool = take_rule("tunjeon") and is_equal_approx(SC.mul("eat"), 0.5) and is_equal_approx(SC.mul("draft"), (1.0 + api.sum("troopPct") / 100.0) * 0.7)
	var won: bool = take_rule("wongyo")
	var pdip: float = 1.0 + api.sum("diploPct") / 100.0
	won = won and is_equal_approx(SC.diplo_mul(true), pdip * 0.6) and is_equal_approx(SC.diplo_mul(false), pdip * 1.5)
	var top: String = SC.top_officer(RS)
	var other := ""
	for id in RS.roster:
		if String(id) != top:
			other = String(id)
			break
	api.reset(true)
	var top0: float = RS._effective_stat(top, "might")
	var oth0: float = RS._effective_stat(other, "might") if other != "" else 1.0
	var ilin: bool = take_rule("ilin")
	ilin = ilin and is_equal_approx(RS._effective_stat(top, "might") / top0, 1.5) and (other == "" or is_equal_approx(RS._effective_stat(other, "might") / oth0, 0.9))
	var gong: bool = take_rule("gongseong") and is_equal_approx(SC.mul("chip"), 2.0) and is_equal_approx(SC.mul("field"), 0.85)
	var wall_a := {"wall": 800, "max_wall": 1000}
	var wall_b := {"wall": 800, "max_wall": 1000}
	rng.seed = 3
	War.step_round(mk_atk.call({}), mk_def.call(), wall_a, 1.0, 1.0, false, rng)
	rng.seed = 3
	War.step_round(mk_atk.call({"chip": 2.0}), mk_def.call(), wall_b, 1.0, 1.0, false, rng)
	gong = gong and (800 - int(wall_b.wall)) >= 2 * (800 - int(wall_a.wall)) - 1
	var hwa: bool = take_rule("hwagong") and SC.fire_blocked(6, false) and SC.fire_blocked(3, true) and not SC.fire_blocked(3, false) and is_equal_approx(SC.mul("fire"), 2.0)
	var cya: bool = take_rule("cheongya") and is_equal_approx(SC.mul("enemy_atk"), 0.8) and is_equal_approx(SC.mul("gold"), (1.0 + api.sum("goldPct") / 100.0) * 0.8)
	var cgi: bool = take_rule("cheolgi") and is_equal_approx(SC.mul("field"), 1.4) and is_equal_approx(SC.mul("siege"), 0.8)
	check(muwi and tun and won and ilin and gong and hwa and cya and cgi,
		"④ 규칙 여덟 — 무위 %s · 둔전 %s · 원교근공 %s · 일인지하 %s(으뜸 %s) · 공성 전문 %s(성벽 %d→%d) · 화공 %s · 청야 %s · 철기 %s" % [muwi, tun, won, ilin, top, gong, 800 - int(wall_a.wall), 800 - int(wall_b.wall), hwa, cya, cgi])

	# ⑤ 되돌리기
	api.reset(true)
	api.take("o_mokmin")
	var leaf: String = api.neighbors("o_mokmin").filter(func(x): return String(api.node(x).k) != "o")[0]
	api.take(leaf)
	RS._done_this_month = {"x": true}
	var g_busy: String = SC.gate(leaf)
	RS._done_this_month = {}
	RS.gold = 100
	var g_poor: String = SC.gate(leaf)
	RS.gold = 500
	var g_ok: String = SC.gate(leaf)
	SC.pay_drop()
	check(g_busy == "되돌리기는 이번 달 명령 전에만" and g_poor != "" and g_ok == "" and RS.gold == 350, "⑤ 이번 달 명령 뒤 막음 · 금 모자람 막음 · 되돌리기 금 500→%d" % RS.gold)

	# ⑥ 세이브 왕복·옛 세이브
	RS.path_override = "user://probe_realm_statecraft_save.json"
	var ok_save: bool = RS.save()
	RS.passive = {"start": null, "taken": []}
	var ok_load: bool = RS.try_load()
	var round_ok: bool = RS.passive.get("start") == "mokmin" and (RS.passive.taken as Array) == [leaf] and RS.passive_api().is_taken(leaf)
	var f := FileAccess.open(RS.path_override, FileAccess.READ)
	var dd: Dictionary = JSON.parse_string(f.get_as_text())
	f.close()
	dd.erase("passive")
	dd["version"] = 19
	f = FileAccess.open(RS.path_override, FileAccess.WRITE)
	f.store_string(JSON.stringify(dd))
	f.close()
	var ok_old: bool = RS.try_load()
	var old_empty: bool = RS.passive.get("start") == null and (RS.passive.taken as Array).is_empty()
	DirAccess.remove_absolute(ProjectSettings.globalize_path(RS.path_override))
	check(ok_save and ok_load and round_ok and ok_old and old_empty and RS.SAVE_VERSION == 20, "⑥ 세이브 왕복 · 옛 19 → 빈 칸 · 버전 20")

	# ⑦ 단추
	var stage := Node.new()
	root.add_child(stage)
	current_scene = stage
	var btn := Button.new()
	btn.set_script(load("res://games/saga_realm/ui/statecraft_button.gd"))
	stage.add_child(btn)
	var scr: CanvasLayer = btn.call("open_screen")
	await process_frame
	var opened: bool = scr != null and is_instance_valid(scr)
	if opened:
		scr.call("close_screen")
	var ev: Array = InputMap.action_get_events("realm_statecraft")
	check(opened and btn.text == "🧭 경륜" and ev.size() == 1 and (ev[0] as InputEventKey).physical_keycode == KEY_F2, "⑦ 단추 「%s」로 열림 · 키 F2" % btn.text)

	RS.enemies = saved.enemies
	RS.year = saved.year
	RS.month = saved.month
	RS.scenario_id = saved.scen
	RS.gold = saved.gold
	RS.passive = saved.passive
	RS._passive_api = null
	RS._done_this_month = saved.done
	RS.path_override = saved.path
	stage.free()
	print("PROBE realm_statecraft OK" if fails == 0 else "PROBE realm_statecraft FAIL %d" % fails)
	quit(1 if fails > 0 else 0)
