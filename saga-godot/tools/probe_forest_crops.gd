extends SceneTree

## G-0391 3마을 밭 작물(유니티 U-0223 짝) 점검 —
##   godot --headless --path saga-godot --script res://tools/probe_forest_crops.gd   → "PROBE forest_crops OK" / "FAIL n"
## ① 밭: 과일 8 → 밭 하나·칸 넷 · 모자라면·둘째 거절 ② 씨 과일 −1 · 빈 두둑만 ③ 물 하루 한 번(두 번 = 한 번) · 빈 두둑·다 자란 칸 거절
## ④ 아침: 물 받은 칸만 한 단계 · 물 준 날 3 → 다 자람 · 물 안 준 칸 그대로 · 하루 한 번 ⑤ 빠진 날 몰아 셈(첫 날만 물 — 한 단계)
## ⑥ 비 = 씨 뿌린 칸 저절로 물(다 자란 칸·빈 두둑 빼고) ⑦ 거둠 과일 +4 → 빈 두둑 ⑧ 「오늘」 줄(밭 있을 때만) ⑨ SAGA_CROPS=0 → 없음
## ⑩ 저장 왕복·옛 세이브 빈 것 ⑪ 보기(두둑 넷·단계 모델)·창 줄·제작대·마을 배선. 진짜 세이브는 안 건드린다(path_override).

const TMP_SAVE := "user://probe_forest_crops_tmp.json"

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
	var CR: GDScript = load("res://games/saga_forest/data/forest_crops.gd")
	var saved := {"items": F.items.duplicate(true), "crops": (F.crops as Dictionary).duplicate(true), "path": F.path_override}
	F.crops = {}
	var day := 2000

	# ①
	F.items = {"과일": 5}
	check(not CR.has_field(F) and String(CR.why_not_build(F)).contains("모자람(5/8)") and CR.today_row(F).is_empty(), "① 과일 5 → 못 지음 · 오늘 줄 없음")
	F.items = {"과일": 20}
	var b: Dictionary = CR.build(F, day)
	check(bool(b.ok) and CR.has_field(F) and CR.plots(F).size() == 4 and F.item_count("과일") == 12 and String(CR.why_not_build(F)).contains("하나"), "① 과일 8 → 밭 칸 넷 · 둘째 거절")

	# ②
	var p0: Dictionary = CR.plant(F, 0)
	check(bool(p0.ok) and CR.stage(F, 0) == 0 and F.item_count("과일") == 11 and not bool(CR.plant(F, 0).ok), "② 씨 과일 −1 · 심은 칸 다시 못 심음")
	CR.plant(F, 1)

	# ③
	var w1: Dictionary = CR.water(F, 0)
	var w2: Dictionary = CR.water(F, 0)
	check(bool(w1.ok) and not bool(w2.ok) and String(w2.why).contains("오늘은") and String(CR.water(F, 2).why).contains("빈 두둑"), "③ 물 하루 한 번 · 빈 두둑 거절")
	var row: Dictionary = CR.today_row(F)

	# ④
	var a1: Dictionary = CR.advance(F, day + 1)
	check(int(a1.grew) == 1 and CR.stage(F, 0) == 1 and CR.stage(F, 1) == 0 and CR.advance(F, day + 1).is_empty() and not bool(CR.plots(F)[0].wet), "④ 물 받은 칸만 한 단계 · 하루 한 번 · 물 지움")
	CR.water(F, 0)
	CR.advance(F, day + 2)
	CR.water(F, 0)
	var a3: Dictionary = CR.advance(F, day + 3)
	check(CR.stage(F, 0) == 3 and int(a3.ripe) == 1 and String(a3.text).contains("다 자람") and String(CR.water(F, 0).why).contains("다 자랐다"), "④ 물 준 날 3 → 다 자람 · 다 자란 칸 물 거절")

	# ⑤
	CR.water(F, 1)
	CR.advance(F, day + 7)   # 나흘 건너뜀 — 첫 날 물만
	check(CR.stage(F, 1) == 1, "⑤ 빠진 날 몰아 셈 — 한 단계(%d)" % CR.stage(F, 1))

	# ⑥
	CR.plant(F, 2)
	var rained: int = CR.rain_water(F)
	check(rained == 2 and bool(CR.plots(F)[1].wet) and bool(CR.plots(F)[2].wet) and not bool(CR.plots(F)[0].wet) and not bool(CR.plots(F)[3].wet) and CR.rain_water(F) == 0,
		"⑥ 비 = 씨 뿌린 칸 둘 저절로 물(다 자란 칸·빈 두둑 빼고)")

	# ⑦
	var f0: int = F.item_count("과일")
	var h: Dictionary = CR.harvest(F, 0)
	check(bool(h.ok) and F.item_count("과일") == f0 + 4 and CR.stage(F, 0) == -1 and not bool(CR.harvest(F, 1).ok), "⑦ 거둠 과일 +4 → 빈 두둑 · 덜 자란 칸 거절")

	# ⑧
	var row2: Dictionary = CR.today_row(F)
	check(int(row.max) == 2 and int(row.cur) == 1 and String(row.label) == "밭 물 주기" and int(row2.max) == 2 and bool(row2.done), "⑧ 「오늘」 밭 물 주기 %d/%d → %d/%d" % [int(row.cur), int(row.max), int(row2.cur), int(row2.max)])

	# ⑨
	OS.set_environment("SAGA_CROPS", "0")
	check(not CR.has_field(F) and CR.advance(F, day + 9).is_empty() and CR.today_row(F).is_empty() and String(CR.why_not_build(F)).contains("꺼져"), "⑨ SAGA_CROPS=0 → 없음")
	OS.set_environment("SAGA_CROPS", "")

	# ⑩
	F.path_override = TMP_SAVE
	var body := Node3D.new()
	body.add_to_group("player")
	root.add_child(body)
	var want: Dictionary = (F.crops as Dictionary).duplicate(true)
	var saved_ok: bool = F.save()
	F.crops = {}
	var loaded: bool = F.try_load()
	check(saved_ok and loaded and CR.has_field(F) and CR.stage(F, 1) == 1 and CR.stage(F, 0) == -1 and bool(CR.plots(F)[2].wet), "⑩ 저장 왕복")
	var d: Dictionary = JSON.parse_string(FileAccess.get_file_as_string(F.save_path()))
	d.erase("crops")
	var fw := FileAccess.open(F.save_path(), FileAccess.WRITE)
	fw.store_string(JSON.stringify(d))
	fw.close()
	check(F.try_load() and not CR.has_field(F), "⑩ 옛 세이브(칸 없음) = 밭 없음")
	DirAccess.remove_absolute(ProjectSettings.globalize_path(TMP_SAVE))
	DirAccess.remove_absolute(ProjectSettings.globalize_path(TMP_SAVE + ".bak"))
	F.crops = want
	CR.plots(F)[3] = {"st": 3, "wet": false}
	CR.plots(F)[0] = {"st": 2, "wet": false}

	# ⑪
	var stage := Node3D.new()
	root.add_child(stage)
	current_scene = stage
	var view: Node3D = (load("res://games/saga_forest/world/forest_crop_view.gd") as GDScript).new()
	stage.add_child(view)
	await process_frame
	var n_crop: int = view.call("sync")
	var beds := 0
	for c in view.get_children():
		beds += 1 if String(c.name).begins_with("Bed") else 0
	var lines: Array = view.call("menu_lines")
	var txt := str(lines.map(func(l: Dictionary) -> String: return String(l.label)))
	check(beds == 4 and n_crop == 3 and view.get_node_or_null("Seed2") != null and view.get_node_or_null("Crop3") != null,
		"⑪ 보기: 두둑 %d · 작물 모델 %d(자람·싹·다 자람) · 씨 자리" % [beds, n_crop])
	check(lines.size() == 4 and txt.contains("▶ 물 주기") and txt.contains("▶ 거두기(과일 +4)") and txt.contains("오늘 물 줌"), "⑪ 창 줄: %s" % txt.left(160))
	var bench := FileAccess.get_file_as_string("res://games/saga_forest/world/craft_bench.gd")
	var vg := FileAccess.get_file_as_string("res://games/saga_forest/world/forest_village.gd")
	var ga := FileAccess.get_file_as_string("res://games/saga_forest/ui/goals_adapter.gd")
	check(bench.contains("Crops.build(ForestSaveState)") and vg.contains("forest_crops.gd\").advance(ForestSaveState)") and vg.contains("forest_crop_view.gd\").new()") and ga.contains("forest_crops.gd\").today_row(S)"),
		"⑪ 제작대·마을 아침·보기·「오늘」 배선")
	stage.queue_free()

	F.items = saved.items
	F.crops = saved.crops
	F.path_override = String(saved.path)
	body.queue_free()
	await process_frame
	print("PROBE forest_crops ", "OK" if fails == 0 else "FAIL %d" % fails)
	quit(1 if fails > 0 else 0)
