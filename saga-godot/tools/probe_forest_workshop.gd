extends SceneTree

## G-0218 3마을 솜씨도(data/forest_workshop.gd · ForestSaveState.passive · 효과 자리 · ui/workshop_button.gd) 자동 점검.
##   godot --headless --path saga-godot --script res://tools/probe_forest_workshop.gd
## ① 점수 = 1 + Σ(도구 Lv−1) + ⌊기증/5⌋(상한 22) + 하트 문턱(3·5·7·10), 상한 56 ② 빈 솜씨도 = 기존 수치(값·하트·걸음·교배·재료·낚시·채집·풍성·오전)
## ③ 찍으면 사는 값·파는 값·걸음(플레이어 speed_mult)·교배 문턱·입질 창이 식대로 ④ 규칙 여덟 — 맨손·한 우물·정원사·올빼미·구두쇠·마을 사랑·손 큰 장인(진짜 제작)·새벽형
## ⑤ 되돌리기 — 집 밖 거절·하루 한 번 무료·그 뒤 벨 300(HUD 단추로 연 화면)·F2 ⑥ 세이브 왕복(path_override)·옛 세이브 = 빈 칸.
## 끝에 "PROBE forest_workshop OK" 또는 "PROBE forest_workshop FAIL n".

var fails := 0


func check(cond: bool, msg: String) -> void:
	if cond:
		print("  ok   ", msg)
	else:
		fails += 1
		print("  FAIL ", msg)


class FakeHouse extends Node:
	var indoors := false

	func is_player_indoors() -> bool:
		return indoors


class FakePlayer extends Node3D:
	var speed_mult := 1.0


func _initialize() -> void:
	await process_frame
	seed(20260824)
	var F: Node = root.get_node("ForestSaveState")
	var W: GDScript = load("res://games/saga_forest/data/forest_workshop.gd")
	var Craft: GDScript = load("res://games/saga_forest/data/forest_craft.gd")
	var saved := {"tool_lv": F.tool_lv.duplicate(), "md": F.museum_donated, "aff": F.affinity.duplicate(), "passive": F.passive.duplicate(true),
		"gold": F.gold, "items": F.items.duplicate(), "path": F.path_override, "aday": F.affinity_day.duplicate(), "again": F.affinity_gained_today.duplicate(),
		"tools": F.tools.duplicate(), "stock": F.home_stock.duplicate(true)}
	F.passive = {"start": null, "taken": []}
	var near := func(a: float, b: float) -> bool: return absf(a - b) < 1e-5

	# ① 점수
	F.tool_lv = {}
	F.museum_donated = 0
	F.affinity = {}
	var p0: int = W.points_total()
	F.tool_lv = {"basket": 3, "net": 2}
	F.museum_donated = 23
	F.affinity = {"a": 5, "b": 10, "c": 2}
	var p1: int = W.points_total()
	F.museum_donated = 9999
	F.affinity = {"a": 10, "b": 10, "c": 10, "d": 10, "e": 10, "f": 10, "g": 10, "h": 10}
	var p2: int = W.points_total()
	check(p0 == 1 and p1 == 1 + 3 + 4 + 6 and p2 == 56, "① 점수 빈 %d · 도구 3+기증 23+하트(5·10) %d · 상한 %d" % [p0, p1, p2])

	# ② 빈 솜씨도 = 기존 수치
	var player := FakePlayer.new()
	player.add_to_group("player")
	root.add_child(player)
	F.sync_walk()
	var roll_a: Dictionary = Craft.gather_roll(["bounty"], "1|gather_tree")
	var roll_b: Dictionary = Craft.gather_roll(["bounty"], "1|gather_tree", W.bounty_add())
	var empty_ok: bool = W.cost(700) == 700 and W.sell_unit(40) == 40 and W.heart(3) == 3 and W.heart(-2) == -2 and player.speed_mult == 1.0 \
		and W.hybrid_cut(0.45) == 0.45 and W.hybrid_cut(0.7) == 0.7 and W.need(5) == 5 and W.craft_fee() == 0 and W.gather_n("gather_tree", 2) == 2 \
		and W.fish_n() == 1 and W.fish_win_mul() == 1.0 and W.bounty_add() == 0.0 and roll_a == roll_b and W.morning_end() == 12 and not W.shop_closed() and not W.no_tool()
	check(empty_ok, "② 빈 솜씨도 — 값·하트·걸음·교배·재료·채집·낚시·풍성·오전 전부 그대로")

	# ③ 찍기 — 가까운 시작점에서 사는 값·파는 값·걸음·꽃·입질 마디까지
	var api: RefCounted = F.passive_api()
	var take_near := func(pred: Callable) -> bool:
		var best := ""
		var best_cost := 999
		var best_start := ""
		for st: Dictionary in api.def.nodes:
			if String(st.k) != "o":
				continue
			var keep: Dictionary = {"start": api.store.start, "taken": (api.store.taken as Array).duplicate()}
			if api.store.start == null:
				api.take(String(st.id))
			for nd: Dictionary in api.def.nodes:
				if bool(pred.call(nd)) and not api.is_taken(String(nd.id)):
					var pp: Dictionary = api.path_to(String(nd.id))
					if not pp.is_empty() and int(pp.cost) < best_cost:
						best_cost = int(pp.cost)
						best = String(nd.id)
						best_start = String(st.id)
			if keep.start == null:
				api.reset(true)
			else:
				break
		if api.store.start == null and best_start != "":
			api.take(best_start)
		return best != "" and api.take_path(best)
	for want in ["buyPct", "sellPct", "walkPct", "flowerPct", "fishPct"]:
		take_near.call(func(nd: Dictionary) -> bool: return String(nd.k) != "k" and (nd.get("stats", {}) as Dictionary).has(want))
	var s := {}
	for k in ["buyPct", "sellPct", "walkPct", "flowerPct", "fishPct"]:
		s[k] = float(api.sum(k))
	var m: float = 1.0 + s.flowerPct / 100.0
	var up_ok: bool = W.cost(1000) == roundi(1000 * maxf(0.5, 1.0 - s.buyPct / 100.0)) and W.sell_unit(100) == roundi(100 * (1.0 + s.sellPct / 100.0)) \
		and near.call(player.speed_mult, 1.0 + s.walkPct / 100.0) and near.call(W.hybrid_cut(0.45), maxf(0.02, 0.45 - 0.55 * (m - 1.0))) \
		and near.call(W.fish_win_mul(), 1.0 + s.fishPct / 100.0) and s.buyPct > 0.0 and s.sellPct > 0.0 and s.walkPct > 0.0 and s.flowerPct > 0.0 and s.fishPct > 0.0
	check(up_ok, "③ %d마디 — 삽 700→%d · 과일 40→%d · 걸음 ×%.2f · 교배 문턱 0.45→%.3f · 입질 창 ×%.2f" % [api.used(), W.cost(700), W.sell_unit(40), player.speed_mult, W.hybrid_cut(0.45), W.fish_win_mul()])

	# ④ 규칙 — 가까운 시작점에서 그 규칙까지만
	var rule := func(r: String) -> bool:
		api.reset(true)
		return take_near.call(func(nd: Dictionary) -> bool: return String(nd.get("rule", "")) == r) and W.has_rule(r)
	var b_ok: bool = rule.call("barehand")
	check(b_ok and W.no_tool() and near.call(player.speed_mult, (1.0 + api.sum("walkPct") / 100.0) * 0.85), "④ 맨손 — 삽 없이 · 걸음 ×%.2f" % player.speed_mult)
	var o_ok: bool = rule.call("onewell")
	var shell: int = W.gather_n("gather_shell", 3)
	check(o_ok and W.fish_n() == 2 and shell <= 2 and shell >= 1, "④ 한 우물 — 낚시 %d마리 · 조개 3→%d" % [W.fish_n(), shell])
	var g_ok: bool = rule.call("gardener")
	var mg: float = (1.0 + api.sum("flowerPct") / 100.0) * 2.0
	check(g_ok and W.gather_n("gather_pine", 1) >= 1 and W.gather_n("gather_tree", 3) <= 3 and near.call(W.hybrid_cut(0.45), maxf(0.02, 0.45 - 0.55 * (mg - 1.0))),
		"④ 정원사 — 교배 문턱 %.3f · 나무 열매 −1(최소 1)" % W.hybrid_cut(0.45))
	var w_ok: bool = rule.call("owl")
	W.forced_hour = 22
	var night_fish: int = W.fish_n()
	var night_closed: bool = W.shop_closed()
	W.forced_hour = 5
	var dawn_closed: bool = W.shop_closed()
	W.forced_hour = 13
	var day_fish: int = W.fish_n()
	W.forced_hour = null
	check(w_ok and night_fish == 2 and day_fish == 1 and dawn_closed and not night_closed, "④ 올빼미 — 밤 낚시 %d · 낮 %d · 새벽 가구 진열 없음" % [night_fish, day_fish])
	var mi_ok: bool = rule.call("miser")
	var e_cost: int = roundi(1000 * maxf(0.5, 1.0 - api.sum("buyPct") / 100.0) * 1.25)
	var e_sell: int = roundi(100 * (1.0 + api.sum("sellPct") / 100.0) * 1.25)
	check(mi_ok and W.cost(1000) == e_cost and W.sell_unit(100) == e_sell, "④ 구두쇠 — 1000 사기 %d · 100 팔기 %d" % [W.cost(1000), W.sell_unit(100)])
	var v_ok: bool = rule.call("villagelove")
	F.affinity["probe_npc"] = 0   # 점수(하트 문턱)는 그대로 두고 한 사람만 더
	F.affinity_day = {}
	F.affinity_gained_today = {}
	var applied: int = F.gain_affinity("probe_npc", 1)
	var capped: int = F.gain_affinity("probe_npc", 3)
	check(v_ok and applied >= 2 and applied <= 3 and applied + capped == 4 and F.heart("probe_npc") == 4, "④ 마을 사랑 — 하트 +1 → +%d · 하루 상한 4 그대로(%d)" % [applied, F.heart("probe_npc")])
	var h_ok: bool = rule.call("bighand")
	F.items = {"솔방울": 4, "과일": 2}
	F.gold = 500
	F.home_stock = {}
	var why: String = Craft.why_not(F, Craft.recipe("make_soban"))
	var made: Dictionary = Craft.make(F, "make_soban")
	var pine_left: int = F.item_count("솔방울")
	check(h_ok and why == "" and bool(made.ok) and F.gold == 300 and (pine_left == 1 or pine_left == 2) and W.need(10) == 7,
		"④ 손 큰 장인 — 소반 솔방울 4→재료 3(남음 %d, 아낌이면 +1) · 삯 200(금 500→%d)" % [pine_left, F.gold])
	var d_ok: bool = rule.call("dawn")
	check(d_ok and W.morning_end() == 14, "④ 새벽형 — 오전이 %d시까지" % W.morning_end())

	# ⑤ 되돌리기 — 집 안·하루 한 번 무료·그 뒤 300
	api.reset(true)
	api.take("o_gatherer")
	var leaves: Array = api.neighbors("o_gatherer").filter(func(x): return String(api.node(x).k) != "o")
	api.take(leaves[0])
	api.take(leaves[1])
	var g_out: String = W.gate(self, leaves[0])
	var house := FakeHouse.new()
	house.add_to_group("forest_house")
	root.add_child(house)
	house.indoors = true
	F.passive.erase("freeDay")
	F.gold = 100
	var g_free: String = W.gate(self, leaves[0])
	var stage := Node.new()
	root.add_child(stage)
	current_scene = stage
	var btn := Button.new()
	btn.set_script(load("res://games/saga_forest/ui/workshop_button.gd"))
	stage.add_child(btn)
	var scr: CanvasLayer = btn.open_screen()
	await process_frame
	scr.select(leaves[0])
	scr._on_card_btn()
	var free_dropped: bool = not api.is_taken(leaves[0]) and F.gold == 100 and int(F.passive.get("freeDay", -1)) == ForestDay.today_key()
	var g_poor: String = W.gate(self, leaves[1])
	F.gold = 500
	scr.select(leaves[1])
	scr._on_card_btn()
	var paid_dropped: bool = not api.is_taken(leaves[1]) and F.gold == 200
	scr.close_screen()
	await process_frame
	check(g_out == "되돌리기는 집 안에서만" and g_free == "" and free_dropped and g_poor != "" and paid_dropped and btn.text == "🌿 솜씨" and not btn.is_open and InputMap.has_action("forest_workshop"),
		"⑤ 집 밖 \"%s\" · 오늘 첫 되돌리기 무료 · 둘째는 벨 300(500→%d) · 단추 「%s」·키 forest_workshop(F2)" % [g_out, F.gold, btn.text])
	stage.free()
	house.free()

	# ⑥ 세이브 왕복·옛 세이브
	F.path_override = "user://probe_workshop_save.json"
	api.reset(true)
	api.take("o_angler")
	api.take(api.neighbors("o_angler").filter(func(x): return String(api.node(x).k) != "o")[0])
	var saved_ok: bool = F.save()
	F.passive = {"start": null, "taken": []}
	var load_ok: bool = F.try_load()
	var round_ok: bool = F.passive.get("start") == "angler" and (F.passive.taken as Array).size() == 1 and F.passive_api().used() == 1
	var f := FileAccess.open(F.path_override, FileAccess.WRITE)
	f.store_string(JSON.stringify({"version": 2, "player_pos": [0, 0, 0]}))
	f.close()
	var old_ok: bool = F.try_load()
	var old_empty: bool = F.passive.get("start") == null and (F.passive.taken as Array).is_empty()
	DirAccess.remove_absolute(ProjectSettings.globalize_path(F.path_override))
	check(saved_ok and load_ok and round_ok and old_ok and old_empty, "⑥ 세이브 왕복(낚시꾼·1마디) · passive 없는 옛 세이브 → 빈 솜씨도")

	F.tool_lv = saved.tool_lv
	F.museum_donated = saved.md
	F.affinity = saved.aff
	F.affinity_day = saved.aday
	F.affinity_gained_today = saved.again
	F.passive = saved.passive
	F.gold = saved.gold
	F.items = saved.items
	F.tools = saved.tools
	F.home_stock = saved.stock
	F.path_override = saved.path
	player.free()
	print("PROBE forest_workshop OK" if fails == 0 else "PROBE forest_workshop FAIL %d" % fails)
	quit(1 if fails > 0 else 0)
