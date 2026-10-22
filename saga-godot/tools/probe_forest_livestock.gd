extends SceneTree

## G-0311 3마을 가축 기르기(웹 W-0299 짝) 점검 —
##   godot --headless --path saga-godot --script res://tools/probe_forest_livestock.gd   → "PROBE forest_livestock OK" / "FAIL n"
## ① 우리: 제작대 레시피 pen(솔방울 10·광석 2) → 우리 하나 · 둘째는 거절 ② 들이기: 금 −400/−900 · 넷까지 · 우리 없으면·금 모자라면 거절
## ③ 먹이(과일 −1, 하루 한 번)·쓰다듬기(하트 +1, 최대 5) ④ 아침: 먹은 짐승 산물 1(하트 3+ 둘)·안 먹은 짐승 굶은 날 +1·사흘이면 떠남·하루 한 번
##   · 며칠 건너뛰면 빈 날은 굶은 날 ⑤ SAGA_LIVESTOCK=0 → 들이기·아침 없음 ⑥ 저장 왕복·옛 세이브 빈 것 ⑦ 제작대 창 줄 · 우리 보기(울타리·짐승 수) · 마을 배선.
## 진짜 세이브는 안 건드린다(path_override).

const TMP_SAVE := "user://probe_forest_livestock_tmp.json"

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
	var LS: GDScript = load("res://games/saga_forest/data/forest_livestock.gd")
	var Craft: GDScript = load("res://games/saga_forest/data/forest_craft.gd")
	var saved := {"items": F.items.duplicate(true), "gold": F.gold, "ls": (F.livestock as Dictionary).duplicate(true), "path": F.path_override, "tool_perks": F.tool_perks.duplicate(true)}
	F.livestock = {}
	F.tool_perks = {}

	# ① 우리
	F.items = {"솔방울": 30, "광석": 10, "과일": 10}
	F.gold = 100000
	check(not LS.has_pen(F) and String(LS.why_not_buy(F, "chick")).contains("우리부터"), "① 우리 없으면 못 들임")
	var r: Dictionary = Craft.make(F, "pen")
	check(bool(r.ok) and LS.has_pen(F) and String(Craft.why_not(F, Craft.recipe("pen"))).contains("하나"), "① 레시피 pen → 우리 · 둘째 거절")

	# ② 들이기
	var g0: int = F.gold
	var b1: Dictionary = LS.buy(F, "chick")
	var b2: Dictionary = LS.buy(F, "goat")
	check(bool(b1.ok) and bool(b2.ok) and g0 - int(F.gold) == 1300 and LS.animals(F).size() == 2 and String(b1.name) == "꼬꼬", "② 꼬꼬 400 + 매매 900")
	LS.buy(F, "chick")
	LS.buy(F, "chick")
	check(LS.animals(F).size() == 4 and String(LS.why_not_buy(F, "goat")).contains("4마리까지") and String(LS.animals(F)[2].name) == "꼬꼬2", "② 넷까지 · 같은 종 이름 꼬꼬2")
	var list: Array = LS.animals(F)
	list.resize(2)
	F.gold = 10
	check(String(LS.why_not_buy(F, "goat")).contains("금이 모자란다"), "② 금 모자람")

	# ③ 먹이·쓰다듬기
	var fruit0: int = F.item_count("과일")
	var f1: Dictionary = LS.feed(F, 0)
	var f2: Dictionary = LS.feed(F, 0)
	check(bool(f1.ok) and not bool(f2.ok) and F.item_count("과일") == fruit0 - 1, "③ 먹이 과일 −1 · 하루 한 번")
	var p1: Dictionary = LS.pet(F, 0)
	check(bool(p1.ok) and int(p1.heart) == 1 and not bool(LS.pet(F, 0).ok), "③ 쓰다듬기 하트 +1 · 하루 한 번")

	# ④ 아침
	var day := 1000
	LS.st(F).roll = day
	var egg0: int = F.item_count("달걀")
	var m1: Dictionary = LS.on_new_day(F, day + 1)
	check(int((m1.got as Dictionary).get("달걀", 0)) == 1 and F.item_count("달걀") == egg0 + 1 and int(LS.animals(F)[0].hungry) == 0 and int(LS.animals(F)[1].hungry) == 1 and String(m1.text).contains("달걀 1"),
		"④ 먹은 꼬꼬 달걀 1 · 안 먹은 매매 굶은 날 1")
	check(LS.on_new_day(F, day + 1).is_empty() and not bool(LS.animals(F)[0].fed), "④ 하루 한 번 · 먹이 표시 지움")
	LS.animals(F)[0].heart = 3
	LS.feed(F, 0)
	LS.feed(F, 1)
	var m2: Dictionary = LS.on_new_day(F, day + 2)
	check(int((m2.got as Dictionary).get("달걀", 0)) == 2 and int((m2.got as Dictionary).get("산양젖", 0)) == 1, "④ 하트 3 꼬꼬 달걀 둘 · 매매 산양젖 하나")
	var m3: Dictionary = LS.on_new_day(F, day + 5)   # 사흘 건너뜀 — 둘 다 안 먹음 → 굶은 날 3
	check(LS.animals(F).is_empty() and (m3.left as Array).size() == 2 and String(m3.text).contains("떠났다"), "④ 사흘 굶으면 떠남 %s" % str(m3.left))
	LS.buy(F, "chick") if int(F.gold) >= 400 else null
	F.gold = 1000
	LS.buy(F, "chick")
	LS.feed(F, 0)
	LS.on_new_day(F, day + 8)   # 먹고 사흘 뒤 — 빈 날 둘 = 굶은 날 2
	check(LS.animals(F).size() == 1 and int(LS.animals(F)[0].hungry) == 2, "④ 먹인 뒤 건너뛴 날 = 굶은 날 %d" % (int(LS.animals(F)[0].hungry) if LS.animals(F).size() > 0 else -1))

	# ⑤ 끄기
	OS.set_environment("SAGA_LIVESTOCK", "0")
	check(String(LS.why_not_buy(F, "chick")).contains("꺼져") and LS.on_new_day(F, day + 9).is_empty(), "⑤ SAGA_LIVESTOCK=0 → 들이기·아침 없음")
	OS.set_environment("SAGA_LIVESTOCK", "")

	# ⑥ 저장
	F.path_override = TMP_SAVE
	var body := Node3D.new()
	body.add_to_group("player")
	root.add_child(body)
	var want: Dictionary = (F.livestock as Dictionary).duplicate(true)
	var saved_ok: bool = F.save()
	F.livestock = {}
	var loaded: bool = F.try_load()
	check(saved_ok and loaded and LS.has_pen(F) and LS.animals(F).size() == 1 and int(LS.animals(F)[0].hungry) == 2, "⑥ 저장 왕복 %s" % str(F.livestock))
	var d: Dictionary = JSON.parse_string(FileAccess.get_file_as_string(F.save_path()))
	d.erase("livestock")
	var fw := FileAccess.open(F.save_path(), FileAccess.WRITE)
	fw.store_string(JSON.stringify(d))
	fw.close()
	check(F.try_load() and not LS.has_pen(F) and LS.animals(F).is_empty(), "⑥ 옛 세이브(칸 없음) = 우리 없음")
	DirAccess.remove_absolute(ProjectSettings.globalize_path(TMP_SAVE))
	DirAccess.remove_absolute(ProjectSettings.globalize_path(TMP_SAVE + ".bak"))
	F.livestock = want

	# ⑦ 창·보기·배선
	var stage := Node3D.new()
	root.add_child(stage)
	current_scene = stage
	var bench: Node = (load("res://games/saga_forest/world/craft_bench.gd") as GDScript).new()
	var lines: Array = bench.call("pen_lines")
	var txt := str(lines.map(func(l: Dictionary) -> String: return String(l.label)))
	check(lines.size() == 3 and txt.contains("▶ 먹이(과일 1") and txt.contains("매매 새끼 들이기 💰900"), "⑦ 창 줄: %s" % txt.left(140))
	bench.free()
	var view: Node3D = (load("res://games/saga_forest/world/forest_livestock_view.gd") as GDScript).new()
	stage.add_child(view)
	await process_frame
	var pen: Node = view.get_node_or_null("Pen")
	var n_fence := pen.get_child_count() if pen != null else 0
	check(int(view.call("sync")) == 1 and n_fence >= 4 and pen.get_node_or_null("Gate") != null and view.get_node_or_null("Beast0") != null, "⑦ 우리 보기: 울타리 조각 %d·문·짐승 1" % n_fence)
	var vg := FileAccess.get_file_as_string("res://games/saga_forest/world/forest_village.gd")
	check(vg.contains("forest_livestock.gd\").on_new_day(ForestSaveState)") and vg.contains("forest_livestock_view.gd\").new()"), "⑦ 마을 아침 굴림·보기 배선")
	stage.queue_free()

	F.items = saved.items
	F.gold = saved.gold
	F.livestock = saved.ls
	F.path_override = String(saved.path)
	F.tool_perks = saved.tool_perks
	body.queue_free()
	await process_frame
	print("PROBE forest_livestock ", "OK" if fails == 0 else "FAIL %d" % fails)
	quit(1 if fails > 0 else 0)
