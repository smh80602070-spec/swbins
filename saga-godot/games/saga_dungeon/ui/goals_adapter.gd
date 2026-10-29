extends RefCounted

## G-0351 2나락 「오늘」 어댑터(웹 W-0380 짝) — 고돗 2나락엔 일일 목표가 없고(test_room _refresh_goal_board 도 주간 "—"),
## 주 단위는 시즌 사다리(dungeon_season — 한 주 한 시즌, 판 다섯 점수 합)뿐이라 그것만 읽는다:
##   이번 주 = 시즌 점수 → 다음 단계 문턱 · 지난 판 기록 수 · 갈림 = 시즌 끝까지.
## 줄 누르면 시즌 창(SeasonButton.open_screen). SAGA_SEASON=0 이면 빈 창 대신 한 줄 안내.
## G-0372·G-0414 위 칸(오늘 자리) = 이번 판 현상금 셋, 지난 판 미수령 금은 받기 단추.

const Season := preload("res://games/saga_dungeon/data/dungeon_season.gd")
const Bounty := preload("res://games/saga_dungeon/data/dungeon_bounty.gd")


static func season_left() -> int:
	var u := Season.now_unix()
	return ((Season.season_of(u) + 1) * 7 - 3) * 86400 - u


static func model(hud: Node) -> Dictionary:
	var m := {"title": "이번 주 · 시즌", "reset_in": 0, "reset_label": "시즌 끝까지", "today": [], "week": [], "claim": {},
		"note": "2나락은 날마다 거리가 없다 — 한 주 시즌에 판 다섯의 점수를 쌓는다"}
	var pending := int(DungeonSaveState.bounty_pending_gold)
	if pending > 0:
		var take := func() -> void:
			var amount: int = DungeonSaveState.claim_bounty_gold()
			var player := hud.get_tree().get_first_node_in_group("player") as Node3D
			if amount > 0 and player != null:
				DungeonSaveState.save(player)
		m.claim = {"label": "현상금 금 +%d" % pending, "ready": true, "done": false, "take": take}
	m.today = Bounty.rows()
	if not m.today.is_empty():
		m.title = "이번 판 현상금 · 시즌"
		m.note = "현상금은 살아 나오면 채운 만큼 금 덤 · " + String(m.note)
	if pending > 0:
		m.note = "지난 판 현상금 금을 오늘 창에서 받을 수 있다"
	if not Season.on():
		m.note = "시즌이 꺼져 있다"
		return m
	var btn := hud.find_child("SeasonButton", true, false)
	var go := Callable(btn, "open_screen") if btn != null else Callable()
	var sc := Season.score()
	var t := Season.tier_of(sc)
	var top := t >= Season.TIERS.size() - 1
	var need := int(Season.TIERS[mini(t + 1, Season.TIERS.size() - 1)].need)
	m.reset_in = season_left()
	m.week = [
		{"label": "시즌 단계 — %s · %s" % [Season.tier_name(t), Season.next_text(sc)], "cur": sc, "max": need, "done": top, "go": go},
		{"label": "판 기록(점수 높은 다섯이 셈)", "cur": Season.runs.size(), "max": Season.KEEP, "done": Season.runs.size() >= Season.KEEP, "go": go},
	]
	return m
