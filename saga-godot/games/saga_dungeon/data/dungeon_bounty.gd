extends RefCounted

## G-0372 현상금 게시판(디아블로 3·4 — 판마다 걸린 의뢰를 같이 쫓는다). 한 판(dungeon_rank 와 같은 begin~finish) 앞에 POOL 다섯 중 셋을 건다:
##   정예 쓰러뜨리기 · 적 쓰러뜨리기 · 통·항아리 부수기(셈) / 적게 맞고 깨기 · 빨리 깨기(마지막 방에서 등급 결과로 판정)
##   셈은 dungeon_rank 고리(kill·finish)와 dungeon_breakables.break_prop 이 부른다. 살아 나온 판만 채운 현상금마다 금 GOLD_PER × 급(난도·부적).
##   쓰러지면 덤 없음(현상금은 은총 자리 새 판에서 다시 건다). 살아 나온 판의 금은 세이브에 미수령으로 쌓고 「오늘」 창(goals_adapter)에서 받는다. SAGA_BOUNTY=0 이면 안 건다.

const POOL := [
	{"id": "elite", "name": "정예 쓰러뜨리기", "n": 2, "live": true},
	{"id": "kills", "name": "적 쓰러뜨리기", "n": 20, "live": true},
	{"id": "props", "name": "통·항아리 부수기", "n": 6, "live": true},
	{"id": "nohit", "name": "5번 넘게 맞지 않고 깨기", "n": 5, "live": false},
	{"id": "fast", "name": "6분 안에 깨기", "n": 360, "live": false},
]
const PICK := 3
const GOLD_PER := 150

static var active: Array = []     # [{id, name, n, live, cur, done}]
static var tier := 1


static func on() -> bool:
	return OS.get_environment("SAGA_BOUNTY") != "0"


## 씨앗으로 셋을 고른다(순수 — 점검도 부른다).
static func pick(seed_value: int) -> Array:
	var rng := RandomNumberGenerator.new()
	rng.seed = seed_value
	var ids: Array = []
	for b in POOL:
		ids.append(b.id)
	for i in range(ids.size() - 1, 0, -1):
		var j := rng.randi_range(0, i)
		var t: Variant = ids[i]
		ids[i] = ids[j]
		ids[j] = t
	var out: Array = []
	for b in POOL:
		if ids.slice(0, PICK).has(b.id):
			var row: Dictionary = b.duplicate()
			row["cur"] = 0
			row["done"] = false
			out.append(row)
	return out


static func begin(p_tier: int, seed_value: int = -1) -> void:
	active = []
	tier = maxi(p_tier, 1)
	if not on():
		return
	active = pick(seed_value if seed_value >= 0 else int(Time.get_unix_time_from_system()))


static func _bump(id: String, by: int = 1) -> String:
	for b in active:
		if b.id == id and not b.done:
			b.cur = int(b.cur) + by
			if int(b.cur) >= int(b.n):
				b.done = true
				return String(b.name)
	return ""


## 적 하나 — 정예면 정예 셈도. 이번에 채운 현상금 이름들.
static func kill(elite: bool) -> Array[String]:
	var out: Array[String] = []
	for id in ["kills", "elite"] if elite else ["kills"]:
		var nm := _bump(id)
		if nm != "":
			out.append(nm)
	return out


static func prop() -> String:
	return _bump("props")


## 판 끝 — 등급 결과(r: hits·sec)로 끝 판정 현상금을 매기고 덤 금(쓰러졌으면 0)과 채운 수를 돌려준다.
static func finish(r: Dictionary, dead: bool) -> Dictionary:
	if active.is_empty():
		return {}
	for b in active:
		if b.live:
			continue
		match String(b.id):
			"nohit":
				b.cur = int(r.get("hits", 0))
				b.done = not dead and int(b.cur) <= int(b.n)
			"fast":
				b.cur = int(r.get("sec", 0))
				b.done = not dead and int(b.cur) <= int(b.n)
	var got := 0
	for b in active:
		got += 1 if b.done else 0
	var gold := 0 if dead else got * GOLD_PER * tier
	var out := {"done": got, "of": active.size(), "gold": gold}
	active = []
	return out


static func text(res: Dictionary) -> String:
	if res.is_empty():
		return ""
	if int(res.gold) > 0:
		return "📜 현상금 %d/%d — 받을 금 +%d" % [int(res.done), int(res.of), int(res.gold)]
	return "📜 현상금 %d/%d — 덤 없음" % [int(res.done), int(res.of)]


static func begin_text() -> String:
	var names: PackedStringArray = []
	for b in active:
		names.append(String(b.name))
	return "📜 이번 판 현상금 — " + " · ".join(names) if not names.is_empty() else ""


## 「오늘」 창 줄 — 끝 판정 둘은 지금 값이 아니라 목표만.
static func rows() -> Array:
	var out: Array = []
	for b in active:
		if b.live:
			out.append({"label": String(b.name), "cur": mini(int(b.cur), int(b.n)), "max": int(b.n), "done": bool(b.done)})
		else:
			out.append({"label": String(b.name) + " (마지막 방에서)", "cur": 0, "max": 0, "done": false})
	return out
