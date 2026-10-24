extends SceneTree

## G-0373 3마을 낚시 대회(data/forest_contest.gd) 점검 —
##   godot --headless --path saga-godot --script res://tools/probe_forest_contest.gd   → "PROBE forest_contest OK" / "FAIL n"
## ① 날: 일요일만(1970-01-04 = 3 일째 일요일) · 며칠 뒤 셈 ② 크기: 빠를수록 크다 · 범위 15~70 ③ 큰 셋 합 · 문턱마다 상 한 번씩(금이 지갑에)
## ④ 다른 날 = {} · 날이 바뀌면 새 대회 ⑤ 세이브 칸 contest · 「오늘」 줄(대회 날·다른 날) ⑥ 낚시 고리 배선 · 손잡이. 진짜 세이브는 되돌린다.

var fails := 0


func check(cond: bool, msg: String) -> void:
	if cond:
		print("  ok   ", msg)
	else:
		fails += 1
		print("  FAIL ", msg)


func _initialize() -> void:
	await process_frame
	var C: GDScript = load("res://games/saga_forest/data/forest_contest.gd")
	var F: Node = root.get_node("ForestSaveState")
	var saved := {"contest": (F.get("contest") as Dictionary).duplicate(true), "gold": int(F.get("gold"))}
	var sun := 3 + 7 * 2900   # 일요일

	# ① 날
	check(C.is_day(3) and C.is_day(sun) and not C.is_day(sun + 1) and C.days_until(sun + 1) == 6 and C.days_until(sun - 1) == 1, "① 일요일만 · 며칠 뒤")

	# ② 크기
	var fast: int = C.size_of(1.0, 0.0)
	var slow: int = C.size_of(0.0, 0.0)
	var top: int = C.size_of(1.0, 1.0)
	check(fast > slow and slow == C.BASE_CM and top == C.BASE_CM + C.SPAN_CM + C.LUCK_CM, "② 빠름 %d > 늦음 %d · 최대 %d" % [fast, slow, top])

	# ③ 합·상
	F.set("contest", {})
	var g0 := int(F.get("gold"))
	var r1: Dictionary = C.on_catch(F, sun, 1.0, 0.0)   # 55
	var r2: Dictionary = C.on_catch(F, sun, 0.0, 0.0)   # 15 → 70
	var r3: Dictionary = C.on_catch(F, sun, 1.0, 0.0)   # 55 → 125 : 동상·은상
	var r4: Dictionary = C.on_catch(F, sun, 0.0, 0.0)   # 15 — 큰 셋 그대로 125
	var r5: Dictionary = C.on_catch(F, sun, 1.0, 1.0)   # 70 → 55+55+70 = 180 : 금상
	var paid := int(F.get("gold")) - g0
	check(int(r1.total) == 55 and int(r2.total) == 70 and int(r3.total) == 125 and int(r3.prize) == 1100 and int(r4.total) == 125 and int(r4.prize) == 0
		and int(r5.total) == 180 and int(r5.prize) == 2000 and paid == 3100 and C.toast_text(r5).contains("금상"),
		"③ 합 %d→%d→%d→%d→%d · 상 %d·%d · 지갑 +%d" % [int(r1.total), int(r2.total), int(r3.total), int(r4.total), int(r5.total), int(r3.prize), int(r5.prize), paid])

	# ④ 다른 날·새 대회
	var off: Dictionary = C.on_catch(F, sun + 1, 1.0, 1.0)
	var nxt: Dictionary = C.on_catch(F, sun + 7, 1.0, 0.0)
	check(off.is_empty() and int(nxt.total) == 55 and int(nxt.prize) == 0, "④ 다른 날 없음 · 다음 일요일 새로(%d)" % int(nxt.get("total", -1)))

	# ⑤ 세이브·「오늘」 줄
	var src := FileAccess.get_file_as_string("res://games/saga_forest/data/forest_save_state.gd")
	var row_day: Dictionary = C.row(F, sun + 7)
	var row_off: Dictionary = C.row(F, sun + 8)
	check(src.contains("\"contest\": contest") and src.contains("data.get(\"contest\", {})") and int(row_day.cur) == 55 and int(row_day.max) == 90
		and String(row_off.label).contains("6일 뒤"), "⑤ 세이브 칸 · 줄 대회 날 %d/%d · 다른 날 %s" % [int(row_day.cur), int(row_day.max), row_off.label])

	# ⑥ 배선·손잡이
	var fs := FileAccess.get_file_as_string("res://games/saga_forest/world/fishing_spot.gd")
	OS.set_environment("SAGA_CONTEST", "0")
	var off2: bool = C.is_day(sun)
	OS.set_environment("SAGA_CONTEST", "")
	check(fs.contains("forest_contest.gd") and fs.contains("Contest.on_catch(ForestSaveState, ForestDay.epoch_day_index(), quality") and not off2, "⑥ 낚시 고리 · 끄면 대회 없음")

	F.set("contest", saved.contest)
	F.set("gold", saved.gold)
	print("PROBE forest_contest ", "OK" if fails == 0 else "FAIL %d" % fails)
	quit(1 if fails > 0 else 0)
