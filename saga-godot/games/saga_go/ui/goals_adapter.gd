extends RefCounted

## G-0351 1만리 「오늘」 어댑터(웹 W-0380 1만리 daily 어댑터 짝) — 판 기존 값만 읽는다:
##   오늘 = 의뢰 넷(Commissions 노드 entries·info — 갈림 새벽 4시) · 이번 주 = 주간 도전 다섯(Weekly picks·progress — 월요일 새벽 4시)
##   받기 = 주간 도전 끝난 것 + 다섯 다 받으면 주간 덤(WeeklyGoals 노드 do_claim·do_claim_bonus). 의뢰 덤은 게시판 곁에서 저절로라 받기 단추 없음.
## 줄 누르면 의뢰판(toggle_panel)·주간 도전 창(open_screen).

const Weekly := preload("res://games/saga_go/data/weekly_goals.gd")
const Commissions := preload("res://games/saga_go/data/commissions.gd")


## 다음 새벽 4시까지 초(Commissions.today 와 같은 셈)
static func day_left() -> int:
	var bias_min := int(Time.get_time_zone_from_system().get("bias", 0))
	var t: float = Time.get_unix_time_from_system() + Commissions.time_offset + bias_min * 60.0 - Commissions.RESET_HOUR * 3600.0
	return int(86400.0 - fposmod(t, 86400.0))


static func model(hud: Node) -> Dictionary:
	var tree := hud.get_tree()
	var com: Node = tree.get_first_node_in_group("go_commissions")
	var wk: Node = tree.get_first_node_in_group("go_weekly_goals")
	var today: Array = []
	if com != null:
		com.call("ensure_today")
		var open_c := Callable(com, "toggle_panel")
		for e: Dictionary in com.call("entries"):
			var c: Dictionary = Commissions.POOL.get(String(e.id), {})
			today.append({"label": String(c.get("name", e.id)), "cur": int(e.p), "max": int(c.get("n", 1)), "done": bool(e.done), "go": open_c})
	var week: Array = []
	var claim := {}
	if wk != null:
		var prov := Callable(wk, "provider")
		var open_w := Callable(wk, "open_screen")
		for id: String in Weekly.picks(Weekly.week()):
			var mx := Weekly.goal_of(id)
			week.append({"label": Weekly.name_of(id) + (" (받음)" if Weekly.claimed(id) else ""), "cur": mini(Weekly.progress(id, prov), mx),
				"max": mx, "done": Weekly.done(id, prov), "go": open_w})
		var n := int(wk.call("claimable_count"))
		var bonus_ready := Weekly.all_claimed() and not bool(PartyState.weekly_goals.get("bonus", false))
		claim = {"label": "주간 도전 보상 %d" % n if n > 0 else "주간 도전 덤", "ready": n > 0 or bonus_ready,
			"done": bool(PartyState.weekly_goals.get("bonus", false)),
			"take": func() -> void:
				for id: String in Weekly.claimable(prov):
					wk.call("do_claim", id)
				wk.call("do_claim_bonus")}
	var note := ""
	if com != null:
		note = "의뢰 넷을 다 하면 게시판(마을 역참 옆)에서 덤 — %s" % ("받았음" if bool(com.call("bonus_claimed")) else "아직")
	return {"title": "오늘 · 이번 주", "reset_in": day_left(), "today": today, "week": week, "claim": claim, "note": note}
