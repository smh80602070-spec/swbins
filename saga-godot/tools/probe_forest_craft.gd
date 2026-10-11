extends SceneTree

## G-0196 3마을 제작대 자동 점검(games/saga_forest/data/forest_craft.gd · world/craft_bench.gd · world/gatherable_builder.gd 덤).
##   godot --headless --path saga-godot --script res://tools/probe_forest_craft.gd
## ① 레시피 12(도구 6·가구 6) 재료가 전부 채집 품목 · 가구 키가 FURNITURE 에 있음 ② 세 갈래 = 서로 다른 축(100번)
## ③ 만들기: 모자라면 까닭 · 승급 순서(Lv3 먼저 안 됨) · 삽 없으면 삽 승급 안 됨 · 재료를 쓰고 Lv 오름 · 가구는 창고 +1
## ④ 고르기·거절(💰+100) ⑤ 덤 확률(1000 자리): 수확 ≈30% · 풍성 ≈8% · 손재주 ≈25% · 갈래 없으면 늘 +1
## ⑥ 옛 세이브(tool_lv 없음) = 바구니·잠자리채 Lv1·삽은 있으면 Lv1 ⑦ 저장 왕복 ⑧ 실제 채집(gatherable_builder._gather)에 덤이 붙음·손재주는 하루 한 번
## 상태·날짜 강제는 끝에 되돌린다. 끝에 "PROBE forest_craft OK|FAIL n".

const Craft := preload("res://games/saga_forest/data/forest_craft.gd")
const Home := preload("res://games/saga_forest/data/forest_home.gd")
const Day := preload("res://games/saga_forest/data/forest_day.gd")
const SAVED_VARS := ["items", "used", "gold", "tools", "tool_lv", "tool_perks", "knack_used", "home_stock", "path_override"]

var fails := 0


func check(cond: bool, msg: String) -> void:
	if cond:
		print("  ok   ", msg)
	else:
		fails += 1
		print("  FAIL ", msg)


func _initialize() -> void:
	await process_frame
	var F: Node = root.get_node("ForestSaveState")
	var saved := {}
	for v in SAVED_VARS:
		var cur: Variant = F.get(v)
		saved[v] = cur.duplicate(true) if (cur is Dictionary or cur is Array) else cur

	# ①
	var mats_ok := true
	var furn_ok := true
	var n_tool := 0
	var n_furn := 0
	for r: Dictionary in Craft.RECIPES:
		for label: String in (r.need as Dictionary).keys():
			mats_ok = mats_ok and Craft.GATHER_LABELS.has(label)
		if String(r.kind) == "tool":
			n_tool += 1
		else:
			n_furn += 1
			furn_ok = furn_ok and not Home.furn(String(r.furn)).is_empty()
	check(Craft.RECIPES.size() == 12 and n_tool == 6 and n_furn == 6 and mats_ok and furn_ok, "레시피 12(도구 6·가구 6) · 재료 전부 채집 품목 · 가구 키 있음")
	# ②
	var dup := 0
	for i in 100:
		var o: Array = Craft.offer3()
		var seen := {}
		for a: String in o:
			if seen.has(a):
				dup += 1
			seen[a] = true
	check(dup == 0 and Craft.offer3().size() == 3, "세 갈래 100번 — 같은 축 겹침 0")
	# ③ ④ ⑥
	F.items = {}
	F.tools = {}
	F.tool_lv = {}
	F.tool_perks = {}
	F.home_stock = {}
	F.gold = 0
	check(Craft.tool_lv(F, "basket") == 1 and Craft.tool_lv(F, "net") == 1 and Craft.tool_lv(F, "spade") == 0, "옛 세이브(단계 없음): 바구니·잠자리채 Lv1 · 삽 없음 Lv0")
	var short := Craft.make(F, "up_basket_2")
	F.items = {"솔방울": 20, "꽃": 10, "과일": 10, "약초": 10, "광석": 10, "화석": 5, "조개": 5, "곤충": 10}
	var early := Craft.make(F, "up_basket_3")
	var no_spade := Craft.make(F, "up_spade_2")
	var up2 := Craft.make(F, "up_basket_2")
	check(not short.ok and "모자람" in String(short.why) and not early.ok and not no_spade.ok and up2.ok and String(up2.tool) == "basket" and Craft.tool_lv(F, "basket") == 2 and F.item_count("솔방울") == 17 and F.item_count("꽃") == 8,
		"모자라면 까닭 · Lv3 먼저 안 됨 · 삽 없으면 삽 승급 안 됨 · 바구니 Lv2(솔방울 −3·꽃 −2)")
	Craft.pick(F, "basket", "harvest")
	Craft.decline(F)
	var mf := Craft.make(F, "make_soban")
	check(Craft.perks(F, "basket") == ["harvest"] and F.gold == 100 and mf.ok and int(F.home_stock.get("soban", 0)) == 1, "고르면 갈래 붙음 · 거절 💰+100 · 소반 짓기 → 창고 +1")
	F.tools = {"spade": true}
	check(Craft.tool_lv(F, "spade") == 1, "삽을 사면 Lv1")
	# ⑤
	var hh := 0
	var bb := 0
	var kk := 0
	var none_extra := 0
	for i in 1000:
		var s := "d%d|p" % i
		if int(Craft.gather_roll(["harvest"], s).extra) == 1:
			hh += 1
		if int(Craft.gather_roll(["bounty"], s).extra) == 3:
			bb += 1
		if bool(Craft.gather_roll(["knack"], s).again):
			kk += 1
		none_extra += int(Craft.gather_roll([], s).extra)
	check(absi(hh - 300) < 50 and absi(bb - 80) < 30 and absi(kk - 250) < 50 and none_extra == 0, "덤 확률(1000): 수확 %d · 풍성 %d · 손재주 %d · 갈래 없으면 0" % [hh, bb, kk])
	# ⑦
	F.tool_lv = {"basket": 3, "net": 2}
	F.tool_perks = {"basket": ["harvest", "knack"]}
	F.path_override = "user://probe_forest_craft_save.json"
	var dummy := Node3D.new()   # 이 판 save() 는 플레이어 자리를 함께 적는다 — 점검용 빈 플레이어
	dummy.add_to_group("player")
	root.add_child(dummy)
	var sv: bool = F.save()
	F.tool_lv = {}
	F.tool_perks = {}
	var ld: bool = F.try_load()
	check(sv and ld and int(F.tool_lv.get("basket", 0)) == 3 and F.tool_perks.get("basket", []) == ["harvest", "knack"], "저장 왕복(tool_lv·tool_perks)")
	DirAccess.remove_absolute(ProjectSettings.globalize_path("user://probe_forest_craft_save.json"))
	dummy.queue_free()
	await process_frame
	# ⑧ 실제 채집 — 수확·손재주가 둘 다 걸리는 날을 찾아 나무를 흔든다
	var GB: GDScript = load("res://games/saga_forest/world/gatherable_builder.gd")
	var gb: Node = GB.new()
	root.add_child(gb)
	await process_frame
	var tree_def: Dictionary = {}
	for d: Dictionary in GB.DEFS:
		if String(d.id) == "gather_tree":
			tree_def = d
	F.tool_perks = {"basket": ["harvest", "knack"]}
	var day := -1
	for k in range(20260101, 20261231):
		var r := Craft.gather_roll(["harvest", "knack"], "%d|gather_tree" % k)
		if int(r.extra) == 1 and bool(r.again):
			day = k
			break
	if day < 0:
		check(false, "수확·손재주가 함께 걸리는 날을 못 찾음")
	else:
		Day.force(day)
		F.used = {}
		F.knack_used = {}
		F.items = {}
		gb.call("_gather", tree_def)
		var first: int = F.item_count("과일")
		var can_again: bool = F.can_gather("gather_tree")
		gb.call("_gather", tree_def)
		var second: int = F.item_count("과일")
		var can_third: bool = F.can_gather("gather_tree")
		check(first == 2 and can_again and second == 4 and not can_third, "실제 채집: 수확 → 과일 +2 · 손재주 → 같은 날 한 번 더(+2) · 셋째는 안 됨(하루 한 번)")
	gb.queue_free()
	Day.force(null)
	for v in SAVED_VARS:
		F.set(v, saved[v])
	print("PROBE forest_craft ", "OK" if fails == 0 else "FAIL %d" % fails)
	quit(1 if fails > 0 else 0)
