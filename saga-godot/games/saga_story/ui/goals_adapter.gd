extends RefCounted

## G-0351 4종횡 「오늘」 어댑터(웹 W-0380 4종횡 daily 사명 짝) — 판 기존 값만 읽는다:
##   오늘 = 일일 사명 둘(StoryCombat.REPEAT_QUESTS daily — d_hunt·d_gather: 지난 완수 뒤 늘어난 값 / n, 오늘 끝났으면 ✔, Lv 모자라면 "Lv n부터")
##   이번 주 = 관문 대장(weekly_champion_week 가 이번 주인 칸 수 — 주마다 한 번 덤 대장) · 갈림 = UTC 자정(daily_done_day 셈 그대로)
## 받기 없음(사명 보상은 다 차면 저절로). 줄 누르면 갈 창이 없어(사명은 HUD 목표판뿐) 누를 수 없음.

const ORDER := ["d_hunt", "d_gather"]


static func model(_hud: Node) -> Dictionary:
	var S: Node = Engine.get_main_loop().root.get_node_or_null("StorySaveState")
	var today: Array = []
	var day := int(Time.get_unix_time_from_system() / 86400.0)
	for key: String in ORDER:
		var q: Dictionary = StoryCombat.REPEAT_QUESTS[key]
		if S == null:
			continue
		var lv := int(S.get("level"))
		var done := int((S.get("daily_done_day") as Dictionary).get(key, -1)) == day
		var cur := 0
		if done:
			cur = int(q.n)
		elif lv >= int(q.need):
			cur = int(float(S.call("_quest_value", q)) - float((S.get("repeat_progress") as Dictionary).get(key, 0.0)))
		var label := String(q.name) + ("" if lv >= int(q.need) else " (Lv %d부터)" % int(q.need))
		today.append({"label": label, "cur": clampi(cur, 0, int(q.n)), "max": int(q.n), "done": done})
	var week: Array = []
	if S != null:
		var wk := int(S.call("current_week"))
		var got := 0
		for k in (S.get("weekly_champion_week") as Dictionary):
			got += 1 if int(S.get("weekly_champion_week")[k]) == wk else 0
		week.append({"label": "이번 주 잡은 관문 대장 %d" % got, "cur": got, "max": 0, "done": false})
	var t := int(Time.get_unix_time_from_system())
	return {"title": "오늘 · 이번 주", "reset_in": 86400 - t % 86400, "today": today, "week": week, "claim": {},
		"note": "사명 보상은 다 차면 저절로 · 관문 대장은 보스 사냥터마다 주에 한 번"}
