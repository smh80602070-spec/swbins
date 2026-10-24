extends RefCounted

## G-0364 5천하 「이번 달」 어댑터(G-0351 「오늘」 창의 5천하 칸 — 웹 W-0380 짝) — 5천하는 실제 시계가 아니라 게임 달로 돈다.
## 판 기존 값만 읽는다(세이브 안 건드림 — focus 는 st() 대신 get 으로):
##   이번 달 = 명령을 내린 장수(_done_this_month) / 우리 장수 · 국가 방침(focus cur·left)
##   천하   = 승리 셋 — 천하통일(우리 성 / 전체) · 문화(문답 정답 / 200) · 외교(화친 연속 달 / 36)
## 받기 없음. 줄 누르면 명령 창(OrderButton)·방침 창(FocusButton). 갈림 = ▶ 다음 달 단추(시계 없음).

const RealmFocus := preload("res://games/saga_realm/data/realm_focus.gd")
const RealmWar := preload("res://games/saga_realm/data/realm_rules_war.gd")
const RealmCities := preload("res://games/saga_realm/data/realm_cities.gd")


static func model(hud: Node) -> Dictionary:
	var S: Node = Engine.get_main_loop().root.get_node_or_null("RealmSaveState")
	var m := {"title": "이번 달 · 천하", "today_head": "이번 달", "week_head": "천하", "reset_in": 0, "today": [], "week": [], "claim": {},
		"note": "달은 ▶ 다음 달 단추로 넘어간다"}
	if S == null:
		return m
	var order_b := hud.find_child("OrderButton", true, false)
	var focus_b := hud.find_child("FocusButton", true, false)
	var go_order := Callable(order_b, "_on_pressed") if order_b != null else Callable()
	var go_focus := Callable(focus_b, "open_screen") if focus_b != null else Callable()
	var roster: Array = S.get("roster")
	var done_m: Dictionary = S.get("_done_this_month")
	var acted := 0
	for id in roster:
		acted += 1 if bool(done_m.get(String(id), false)) else 0
	m.today.append({"label": "명령 내린 장수", "cur": acted, "max": roster.size(), "done": acted >= roster.size() and roster.size() > 0, "go": go_order})
	if RealmFocus.on():
		var f: Dictionary = S.get("focus") if typeof(S.get("focus")) == TYPE_DICTIONARY else {}
		var cur := String(f.get("cur", ""))
		var fin := "(끝낸 방침 %d/%d)" % [(f.get("done", []) as Array).size(), RealmFocus.MAX_DONE]
		var label := "국가 방침 — 고른 것 없음 " + fin
		if cur != "" and RealmFocus.FOCI.has(cur):
			label = "국가 방침 %s %s — %d달 남음 %s" % [RealmFocus.FOCI[cur].emoji, RealmFocus.FOCI[cur].name, int(f.get("left", 0)), fin]
		m.today.append({"label": label, "cur": 0, "max": 0, "done": cur != "", "go": go_focus})
	var total: int = RealmCities.CITIES.size() + RealmCities.ENEMY_CITIES.size()
	m.week = [
		{"label": "천하통일 — 우리 성", "cur": (S.get("cities") as Dictionary).size(), "max": total, "done": false},
		{"label": "문화 — 문답 정답", "cur": int((S.get("quiz") as Dictionary).get("correct", 0)), "max": RealmWar.CULTURE_VICTORY_CORRECT, "done": false},
		{"label": "외교 — 화친 연속 달", "cur": int(S.get("diplomacy_peace_streak")), "max": RealmWar.DIPLOMACY_VICTORY_MONTHS, "done": false},
	]
	if String(S.get("result")) != "":
		m.note = "승리 달성 — " + String(S.get("result"))
	return m
