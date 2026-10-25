extends RefCounted

## G-0351 3마을 「오늘」 어댑터(웹 W-0380 짝) — 고돗 3마을엔 일과·주간 과제가 없고 하루 한 번씩 되는 일만 있어 그것을 센다:
##   오늘 = 주민과 이야기(talked_today) · 선물(gifted_today) — 주민 수만큼, 갈림 = 이 기기 자정(ForestDay)
## 주간 없음 · 받기 없음(하트·덤은 대화·선물 그 자리에서). 아래 한 줄 = 주민 부탁(한 번씩) 진척.
## G-0373 오늘 셋째 줄 = 낚시 대회(일요일이면 큰 셋 합/다음 상 문턱, 아니면 며칠 뒤).

const VillagerBuilder := preload("res://games/saga_forest/world/villager_builder.gd")


static func midnight_left() -> int:
	var d := Time.get_time_dict_from_system()
	return 86400 - (int(d.hour) * 3600 + int(d.minute) * 60 + int(d.second))


static func model(_hud: Node) -> Dictionary:
	var S: Node = Engine.get_main_loop().root.get_node_or_null("ForestSaveState")
	var talked := 0
	var gifted := 0
	var quests := 0
	var n := VillagerBuilder.VILLAGERS.size()
	for v: Dictionary in VillagerBuilder.VILLAGERS:
		var id := String(v.id)
		if S != null:
			talked += 1 if bool(S.call("talked_today", id)) else 0
			gifted += 1 if bool(S.call("gifted_today", id)) else 0
			quests += 1 if bool(S.call("is_quest_done", id)) else 0
	var today: Array = [
		{"label": "주민과 이야기", "cur": talked, "max": n, "done": talked >= n},
		{"label": "주민에게 선물", "cur": gifted, "max": n, "done": gifted >= n},
	]
	var contest: Dictionary = preload("res://games/saga_forest/data/forest_contest.gd").row(S, ForestDay.epoch_day_index())
	if not contest.is_empty():
		today.append(contest)
	var crop: Dictionary = preload("res://games/saga_forest/data/forest_crops.gd").today_row(S) if S != null else {}   # G-0391 밭 지었을 때만
	if not crop.is_empty():
		today.append(crop)
	return {"title": "오늘", "reset_in": midnight_left(),
		"today": today,
		"week": [], "claim": {},
		"note": "주민 부탁(한 번씩) %d/%d · 하트는 하루 +4 까지" % [quests, n] + _bday_note()}


## G-0388 — 오늘 생일인 주민(아랫줄 — 날마다 줄 수가 바뀌지 않게 note 에).
static func _bday_note() -> String:
	var Bd: GDScript = preload("res://games/saga_forest/data/forest_birthday.gd")
	var names: PackedStringArray = []
	for id: String in Bd.today_ids(ForestDay.today_key()):
		names.append(Bd.name_of(id))
	return " · 🎂 오늘 생일: %s(선물 ×3)" % ", ".join(names) if not names.is_empty() else ""
