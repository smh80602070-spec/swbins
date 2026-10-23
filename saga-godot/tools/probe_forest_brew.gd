extends SceneTree

## G-0320 3마을 물약 양조 점검 —
##   godot --headless --path saga-godot --script res://tools/probe_forest_brew.gd   → "PROBE forest_brew OK" / "FAIL n"
## ① 거절: 약초·재료 없음 · 없는 재료 ② 달이기: 약초 −1·재료 −1 · 처음이면 찾음 · 창 줄 ❔ → 이름
## ③ 효과(오늘만): 기운 채집 +1 · 물빛 낚시 ×1.5 · 꽃향 하트 +1(실제 gain_affinity · 하루 상한 4 그대로) · 탁한 물약 없음 · 내일은 끝
## ④ SAGA_BREW=0 → 효과·달이기 없음 ⑤ 저장 왕복·옛 세이브 빈 것 ⑥ 배선(채집·낚시·하트·제작대).

const TMP_SAVE := "user://probe_forest_brew_tmp.json"

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
	var BR: GDScript = load("res://games/saga_forest/data/forest_brew.gd")
	var saved := {"items": F.items.duplicate(true), "brew": (F.brew as Dictionary).duplicate(true), "path": F.path_override,
		"aff": F.affinity.duplicate(true), "aday": F.affinity_day.duplicate(true), "agt": F.affinity_gained_today.duplicate(true)}
	F.brew = {}
	var day := 30000

	# ①
	F.items = {"과일": 2}
	check(String(BR.why_not(F, "과일")).contains("약초") and String(BR.why_not(F, "모래")).contains("섞을") and not bool(BR.brew(F, "과일", day).ok), "① 약초 없으면·없는 재료 거절")
	F.items = {"약초": 5, "과일": 2, "조개": 1, "꽃": 1, "곤충": 1}
	check(String(BR.why_not(F, "광석")).contains("광석"), "① 재료 없으면 거절")

	# ②
	var l0: String = String((BR.lines(F)[0] as Dictionary).label)
	var r: Dictionary = BR.brew(F, "과일", day)
	var l1: String = String((BR.lines(F)[0] as Dictionary).label)
	var r2: Dictionary = BR.brew(F, "과일", day)
	check(bool(r.ok) and bool(r.fresh) and not bool(r2.fresh) and F.item_count("약초") == 3 and F.item_count("과일") == 0 and l0.contains("❔") and l1.contains("기운 물약"), "② 달이기 −1·−1 · 처음 찾음 · 창 ❔ → 기운 물약")

	# ③
	var g1: int = BR.gather_add(F, day)
	var g_next: int = BR.gather_add(F, day + 1)
	BR.brew(F, "조개", day)
	var fm: float = BR.fish_mul(F, day)
	var g_after: int = BR.gather_add(F, day)
	BR.brew(F, "곤충", day)
	var dud: bool = BR.fx_today(F, day) == "" and is_equal_approx(BR.fish_mul(F, day), 1.0)
	check(g1 == 1 and g_next == 0 and is_equal_approx(fm, 1.5) and g_after == 0 and dud, "③ 기운 +1(내일 0) · 물빛 ×1.5(기운 사라짐) · 탁한 물약 없음")
	ForestDay.force(day)
	BR.brew(F, "꽃", day)
	F.affinity = {}
	F.affinity_day = {}
	F.affinity_gained_today = {}
	var a1: int = F.gain_affinity("probe_npc", 1)
	var a2: int = F.gain_affinity("probe_npc", 3)
	ForestDay.force(null)
	check(a1 == 2 and a2 == 2 and int(F.affinity.probe_npc) == 4, "③ 꽃향: 하트 1 → 2 · 하루 상한 4 그대로(%d·%d)" % [a1, a2])

	# ④
	OS.set_environment("SAGA_BREW", "0")
	check(BR.fx_today(F, day) == "" and not bool(BR.brew(F, "조개", day).ok) and BR.heart_add(F, day, 1) == 0, "④ SAGA_BREW=0 → 효과·달이기 없음")
	OS.set_environment("SAGA_BREW", "")

	# ⑤
	F.path_override = TMP_SAVE
	var body := Node3D.new()
	body.add_to_group("player")
	root.add_child(body)
	var saved_ok: bool = F.save()
	F.brew = {}
	check(saved_ok and F.try_load() and BR.found(F, "꽃") and BR.found(F, "과일") and int(F.brew.day) == day, "⑤ 저장 왕복 %s" % str(F.brew))
	var d: Dictionary = JSON.parse_string(FileAccess.get_file_as_string(F.save_path()))
	d.erase("brew")
	var fw := FileAccess.open(F.save_path(), FileAccess.WRITE)
	fw.store_string(JSON.stringify(d))
	fw.close()
	check(F.try_load() and not BR.found(F, "꽃") and BR.fx_today(F, day) == "", "⑤ 옛 세이브(칸 없음) = 찾은 것 없음")
	DirAccess.remove_absolute(ProjectSettings.globalize_path(TMP_SAVE))

	# ⑥
	var gb := FileAccess.get_file_as_string("res://games/saga_forest/world/gatherable_builder.gd")
	var fs := FileAccess.get_file_as_string("res://games/saga_forest/world/fishing_spot.gd")
	var sv := FileAccess.get_file_as_string("res://games/saga_forest/data/forest_save_state.gd")
	var cb := FileAccess.get_file_as_string("res://games/saga_forest/world/craft_bench.gd")
	check(gb.contains("forest_brew.gd\").gather_add(") and fs.contains("forest_brew.gd\").fish_mul(") and sv.contains("forest_brew.gd\").heart_add(self") and cb.contains("open_brew()"), "⑥ 배선 넷")

	body.queue_free()
	F.items = saved.items
	F.brew = saved.brew
	F.path_override = saved.path
	F.affinity = saved.aff
	F.affinity_day = saved.aday
	F.affinity_gained_today = saved.agt
	print("PROBE forest_brew ", "OK" if fails == 0 else "FAIL %d" % fails)
	quit(1 if fails > 0 else 0)
