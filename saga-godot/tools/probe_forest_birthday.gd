extends SceneTree

## G-0388 3마을 주민 생일(data/forest_birthday.gd) 점검 —
##   godot --headless --path saga-godot --script res://tools/probe_forest_birthday.gd   → "PROBE forest_birthday OK" / "FAIL n"
## ① 주민 전원 날짜 서로 다름·1~12월 1~28일·결정적 ② 생일 날 선물 배수 3·상한 +5, 다른 날 1·0
## ③ ForestSaveState.gain_affinity: 생일 날 9 가 다 오름 · 다른 날은 하루 4 상한 ④ 배선(선물 ×·메뉴 제목 🎂·마을 붙임)
## ⑤ 「오늘」 창 아랫줄에 생일 ⑥ 손잡이 0 = 다 끔. 날짜는 ForestDay.force, 바꾼 하트 기록은 끝에 되돌린다.
## 판 스크립트가 자동 로드를 써서 const preload 대신 _initialize 에서 load().

var fails := 0


func check(cond: bool, msg: String) -> void:
	if cond:
		print("  ok   ", msg)
	else:
		fails += 1
		print("  FAIL ", msg)


func _initialize() -> void:
	await process_frame
	var Bd: GDScript = load("res://games/saga_forest/data/forest_birthday.gd")
	var GA: GDScript = load("res://games/saga_forest/ui/goals_adapter.gd")
	var S: Node = root.get_node("ForestSaveState")
	var FD: GDScript = load("res://games/saga_forest/data/forest_day.gd")
	var t: Dictionary = Bd.table()
	var seen := {}
	var ok_range := true
	for id: String in t:
		var b: Vector2i = t[id]
		seen["%d-%d" % [b.x, b.y]] = true
		ok_range = ok_range and b.x >= 1 and b.x <= 12 and b.y >= 1 and b.y <= 28
	check(t.size() >= 6 and seen.size() == t.size() and ok_range, "① 주민 %d 날짜 서로 다름·범위 %s" % [t.size(), str(t.values())])
	Bd.set("_table", {})
	check(Bd.table() == t, "① 결정적")

	var id: String = t.keys()[0]
	var b0: Vector2i = t[id]
	var bday_key := 2026 * 10000 + b0.x * 100 + b0.y
	var other_key := 2026 * 10000 + (b0.x % 12 + 1) * 100 + b0.y
	check(Bd.gift_mul(id, bday_key) == 3 and Bd.cap_bonus(id, bday_key) == 5 and Bd.gift_mul(id, other_key) == 1 and Bd.cap_bonus(id, other_key) == 0,
		"② 생일 ×3·상한 +5 · 다른 날 ×1·+0 (%s %s)" % [id, Bd.label(id)])

	var keep_aff: Dictionary = S.get("affinity").duplicate()
	var keep_day: Dictionary = S.get("affinity_day").duplicate()
	var keep_gain: Dictionary = S.get("affinity_gained_today").duplicate()
	S.get("affinity")[id] = 0
	S.get("affinity_day").erase(id)
	FD.force(bday_key)
	var a1: int = S.gain_affinity(id, 9)
	S.get("affinity")[id] = 0
	S.get("affinity_day").erase(id)
	FD.force(other_key)
	var a2: int = S.gain_affinity(id, 9)
	check(a1 >= 9 and a2 <= 4, "③ 생일 날 9 오름(%d) · 다른 날 상한 4(%d)" % [a1, a2])

	var vb := FileAccess.get_file_as_string("res://games/saga_forest/world/villager_builder.gd")
	var fv := FileAccess.get_file_as_string("res://games/saga_forest/world/forest_village.gd")
	check(vb.contains("forest_birthday.gd\").gift_mul(") and vb.contains("forest_birthday.gd\").label(") and fv.contains("forest_birthday.gd\").attach(self)"), "④ 선물 ×·메뉴 제목·마을 붙임 배선")

	FD.force(bday_key)
	var note: String = GA.model(null).note
	check(note.contains("오늘 생일") and note.contains(Bd.name_of(id)), "⑤ 「오늘」 창 아랫줄: %s" % note)

	OS.set_environment("SAGA_BIRTHDAY", "0")
	check(Bd.gift_mul(id, bday_key) == 1 and Bd.cap_bonus(id, bday_key) == 0 and Bd.attach(Node.new()) == null and Bd.today_ids(bday_key).is_empty(), "⑥ 0 = 다 끔")
	OS.set_environment("SAGA_BIRTHDAY", "")

	FD.force(null)
	S.set("affinity", keep_aff)
	S.set("affinity_day", keep_day)
	S.set("affinity_gained_today", keep_gain)
	print("PROBE forest_birthday ", "OK" if fails == 0 else "FAIL %d" % fails)
	quit(1 if fails > 0 else 0)
