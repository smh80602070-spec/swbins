extends Node
## G-0237 3마을 입주 조건(data/forest_lots.gd · forest_craft lot 레시피 · craft_bench 빈 집 꾸미기 · world/forest_lots_view.gd) 점검 — 러너 래퍼 tools/probe_forest_lots.gd.
## ① 빈 집 셋까지(넷째 거절) ② 태그 둘은 안 옴 ③ 태그 셋 + 좋아함 둘은 그날 아니고 다음 날 · 같은 날 두 번 안 굴림
## ④ 두 집 준비여도 하루 한 명 · 동점은 명단 순 ⑤ 산 집 잠김(넣기·거두기 거절) · 창고 오감 ⑥ 저장 왕복 · 옛 세이브(칸 없음) = 빈 집 없음
## ⑦ 마을에 손님 몸·이름표. 세이브 칸·날·경로는 끝에 되돌린다.

const Lots := preload("res://games/saga_forest/data/forest_lots.gd")
const Craft := preload("res://games/saga_forest/data/forest_craft.gd")
const TMP_SAVE := "user://probe_forest_lots.json"
const DAY0 := 21000

var fails := 0


func _check(name: String, ok: bool, detail: String) -> void:
	if not ok:
		fails += 1
		print("  FAIL ", name, " ", detail)
	else:
		print("  ok   ", name, " ", detail)


func _put_all(F: Node, i: int, keys: Array) -> bool:
	var ok := true
	for k: String in keys:
		ok = ok and bool(Lots.put(F, i, k).ok)
	return ok


func run() -> int:
	var F: Node = ForestSaveState
	var saved := {"lots": F.lots.duplicate(true), "lots_roll": F.lots_roll, "home_stock": F.home_stock.duplicate(true),
		"items": F.items.duplicate(true), "gold": F.gold, "path": F.path_override}
	ForestDay.force_epoch_day(DAY0)
	F.lots = []
	F.lots_roll = -1
	F.gold = 100000
	F.items = {"솔방울": 60, "광석": 20, "화석": 20}
	F.home_stock = {"bangseok": 2, "hwabun": 1, "mulhang": 1, "jokja": 1, "soban": 1, "deungjan": 1, "geomungo": 1}

	# ① 셋까지
	var b1: Dictionary = Craft.make(F, "lot")
	var b2: Dictionary = Craft.make(F, "lot")
	var b3: Dictionary = Craft.make(F, "lot")
	var b4: Dictionary = Craft.make(F, "lot")
	_check("build", bool(b1.ok) and bool(b2.ok) and bool(b3.ok) and not bool(b4.ok) and Lots.count(F) == 3 and String(b4.why).contains("3채"),
		"ok=%s,%s,%s fourth=%s why=%s n=%d" % [b1.ok, b2.ok, b3.ok, b4.ok, b4.why, Lots.count(F)])

	# ② 태그 둘(안방·뜰) · ③ 셋(부엌·바다·안방 — 풍랑 좋아함 둘)
	var p0 := _put_all(F, 0, ["bangseok", "hwabun"])
	var p1 := _put_all(F, 1, ["mulhang", "bangseok"])
	var same_day: Dictionary = Lots.on_new_day(F)
	ForestDay.force_epoch_day(DAY0 + 1)
	var next_day: Dictionary = Lots.on_new_day(F)
	var again: Dictionary = Lots.on_new_day(F)
	_check("next_day", p0 and p1 and same_day.is_empty() and String(next_day.get("key", "")) == "sailor" and int(next_day.get("lot", -1)) == 1 and again.is_empty()
		and String(F.lots[1].who) == "sailor" and String(F.lots[0].who) == "",
		"same_day=%s next=%s again=%s" % [same_day, next_day.get("key", ""), again])
	ForestDay.force_epoch_day(DAY0 + 2)
	var two_tags: Dictionary = Lots.on_new_day(F)
	_check("two_tags", two_tags.is_empty() and Lots.lot_tags(F, 0).size() == 2 and String(F.lots[0].who) == "", "tags=%s r=%s" % [Lots.lot_tags(F, 0), two_tags])

	# ⑤ 산 집 잠김 · 창고
	var lock_put: Dictionary = Lots.put(F, 1, "jokja")
	var lock_take: Dictionary = Lots.take(F, 1, "mulhang")
	var st0: int = F.home_stock_count("hwabun")
	var tk: Dictionary = Lots.take(F, 0, "hwabun")
	var back: bool = F.home_stock_count("hwabun") == st0 + 1
	var rp: bool = bool(Lots.put(F, 0, "hwabun").ok) and F.home_stock_count("hwabun") == st0
	_check("locked", not bool(lock_put.ok) and not bool(lock_take.ok) and bool(tk.ok) and back and rp,
		"put=%s take=%s stock_back=%s reput=%s" % [lock_put.ok, lock_take.ok, back, rp])

	# ④ 두 집 준비 — 집 0(안방·뜰·서재·부엌: 호연·나비 동점 → 명단 앞 호연) · 집 2(서재·밤·악기: 반디)
	_put_all(F, 0, ["jokja", "soban"])
	_put_all(F, 2, ["deungjan", "geomungo"])
	ForestDay.force_epoch_day(DAY0 + 3)
	var d3: Dictionary = Lots.on_new_day(F)
	var after3 := Lots.settled(F).size()
	ForestDay.force_epoch_day(DAY0 + 4)
	var d4: Dictionary = Lots.on_new_day(F)
	_check("one_per_day", String(d3.get("key", "")) == "fox" and after3 == 2 and String(d4.get("key", "")) == "wisp" and Lots.settled(F).size() == 3,
		"d3=%s settled=%d d4=%s" % [d3.get("key", ""), after3, d4.get("key", "")])

	# ⑥ 저장 왕복 · 옛 세이브
	F.path_override = TMP_SAVE
	var body := Node3D.new()
	body.add_to_group("player")
	add_child(body)
	var want: Array = F.lots.duplicate(true)
	F.save()
	F.lots = []
	F.lots_roll = -1
	var loaded: bool = F.try_load()
	var rt: bool = loaded and F.lots.size() == 3 and String(F.lots[0].who) == "fox" and (F.lots[0].furn as Array).size() == 4 and F.lots_roll == DAY0 + 4
	var f := FileAccess.open(TMP_SAVE, FileAccess.READ)
	var raw: Dictionary = JSON.parse_string(f.get_as_text())
	f.close()
	raw.erase("lots")
	raw.erase("lots_roll")
	var w := FileAccess.open(TMP_SAVE, FileAccess.WRITE)
	w.store_string(JSON.stringify(raw))
	w.close()
	var old_ok: bool = F.try_load() and F.lots.is_empty() and F.lots_roll == -1
	_check("save", rt and old_ok, "roundtrip=%s old_save_none=%s" % [rt, old_ok])
	DirAccess.remove_absolute(ProjectSettings.globalize_path(TMP_SAVE))
	DirAccess.remove_absolute(ProjectSettings.globalize_path(TMP_SAVE + ".bak"))
	F.path_override = String(saved.path)
	F.lots = want

	# ⑦ 마을에 손님 몸
	var view: Node3D = load("res://games/saga_forest/world/forest_lots_view.gd").new()
	add_child(view)
	await get_tree().process_frame
	var g := view.find_child("Guest_fox", false, false)
	var shown := g != null and view.find_child("Guest_sailor", false, false) != null and view.find_child("Guest_wisp", false, false) != null \
		and g.find_child("Name", false, false) != null and String((g.find_child("Name", false, false) as Label3D).text).contains("호연")
	_check("view", shown, "children=%d" % view.get_child_count())
	view.queue_free()
	body.queue_free()

	F.lots = saved.lots
	F.lots_roll = int(saved.lots_roll)
	F.home_stock = saved.home_stock
	F.items = saved.items
	F.gold = int(saved.gold)
	ForestDay.force_epoch_day(null)
	return fails
