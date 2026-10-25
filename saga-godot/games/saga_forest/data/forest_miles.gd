extends RefCounted

## G-0409 3마을 마을 마일(동물의숲 너굴 마일리지 — 하루 할 일을 하면 마일, 마일로 물건). F = ForestSaveState.
##   모으기  「오늘」 창 줄(주민과 이야기·선물·낚시 대회·밭 — goals_adapter)이 다 되면 그 줄마다 PER_ROW 마일 — 창의 받기 단추로(하루 한 번씩, 이 기기 자정 ForestDay)
##   쓰기    상인 메뉴 「🎟️ 마일 교환」 — SHOP 넷(과일·광석·교배꽃·별 조각)
##   저장    F.miles = {pts, day, got:[줄 이름…]} — 순수 추가 칸(버전 안 올림, forest_contest 와 같은 꼴). SAGA_MILES=0 이면 끔.

const PER_ROW := 100
const SHOP := [
	{"item": "과일", "n": 5, "cost": 150},
	{"item": "광석", "n": 3, "cost": 200},
	{"item": "교배꽃", "n": 1, "cost": 400},
	{"item": "별 조각", "n": 1, "cost": 600},
]


static func enabled() -> bool:
	return OS.get_environment("SAGA_MILES") != "0"


static func pts(F: Node) -> int:
	return int((F.get("miles") as Dictionary).get("pts", 0)) if F != null else 0


## 오늘 이미 받은 줄 이름들(날이 바뀌었으면 빈 것)
static func got_today(F: Node, day: int) -> Array:
	var m: Dictionary = F.get("miles")
	return (m.get("got", []) as Array) if int(m.get("day", -1)) == day else []


## 다 됐는데 아직 안 받은 줄 이름들 — rows 는 goals_adapter 「오늘」 줄({label, done})
static func claimable(F: Node, rows: Array, day: int) -> Array:
	var got := got_today(F, day)
	var out: Array = []
	for r: Dictionary in rows:
		if bool(r.get("done", false)) and not got.has(String(r.label)):
			out.append(String(r.label))
	return out


## 받기 — 늘어난 마일
static func take(F: Node, rows: Array, day: int) -> int:
	var add := claimable(F, rows, day)
	if add.is_empty():
		return 0
	var got := got_today(F, day).duplicate()
	got.append_array(add)
	F.set("miles", {"pts": pts(F) + PER_ROW * add.size(), "day": day, "got": got})
	return PER_ROW * add.size()


## 바꾸기 — {ok, text}
static func buy(F: Node, i: int) -> Dictionary:
	if i < 0 or i >= SHOP.size():
		return {"ok": false, "text": "없는 물건"}
	var it: Dictionary = SHOP[i]
	var have := pts(F)
	if have < int(it.cost):
		return {"ok": false, "text": "🎟️ 마일이 모자라다 (%d / %d)" % [have, int(it.cost)]}
	var m: Dictionary = (F.get("miles") as Dictionary).duplicate(true)
	m["pts"] = have - int(it.cost)
	F.set("miles", m)
	F.call("add_item", String(it.item), int(it.n))
	return {"ok": true, "text": "🎟️ %s ×%d 받음 (남은 마일 %d)" % [String(it.item), int(it.n), have - int(it.cost)]}


## 「오늘」 창 받기 칸(goals_panel claim) — rows 를 받아 만든다
static func claim_row(F: Node, rows: Array, day: int) -> Dictionary:
	if F == null or not enabled():
		return {}
	var c := claimable(F, rows, day)
	return {"label": "마을 마일 +%d (모은 마일 %d)" % [PER_ROW * c.size(), pts(F)] if not c.is_empty() else "마을 마일 (모은 마일 %d · 줄마다 +%d)" % [pts(F), PER_ROW],
		"ready": not c.is_empty(), "done": c.is_empty() and not got_today(F, day).is_empty(),
		"take": func() -> void: take(F, rows, day)}
