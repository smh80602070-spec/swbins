extends RefCounted

## G-0334 2나락 로컬 시즌·래더(디아블로·PoE 시즌 — 구조만, 서버 없음) — 한 판 등급(data/dungeon_rank.gd G-0312) 위에.
##   시즌    한 주(월요일 0시, 이 기기 시계) = 한 시즌. 번호 = 유닉스 날짜 + 3 을 7 로 나눈 몫(1970-01-01 은 목요일).
##   점수    살아 나온 등급 판만 — (D 1·C 2·B 3·A 4·S 5) × 급(난도·부적 1~5). 이번 시즌 좋은 판 다섯 개 합 = 시즌 점수(최대 125).
##   단계    🥉 청동 10·🥈 백은 25·🥇 황금 45·💎 백금 70·👑 왕좌 100.
##   넘어감  던전에 들어설 때(test_room) · 판을 기록할 때 시즌 번호가 바뀌었으면 지난 시즌을 닫는다 — 닿은 단계 금(100·300·700·1500·3000)
##           을 지갑에, 지난 기록 넷까지 남기고 래더를 비운다. 처음 켠 기기는 번호만 잡는다(덤 없음).
##   저장    DungeonSaveState "season" 칸(순수 추가, 버전 그대로). SAGA_SEASON=0 이면 끔(기록·넘어감 없음).

const ORDER := ["D", "C", "B", "A", "S"]
const KEEP := 5
const PAST_KEEP := 4
const TIERS := [
	{"need": 10, "name": "청동", "emoji": "🥉", "gold": 100},
	{"need": 25, "name": "백은", "emoji": "🥈", "gold": 300},
	{"need": 45, "name": "황금", "emoji": "🥇", "gold": 700},
	{"need": 70, "name": "백금", "emoji": "💎", "gold": 1500},
	{"need": 100, "name": "왕좌", "emoji": "👑", "gold": 3000},
]

static var id := -1
static var runs: Array = []   # [{pts, rank, tier, sec}] 점수 높은 순, KEEP 개까지
static var past: Array = []   # [{id, score, tier}] 새것이 앞, PAST_KEEP 개까지
static var now_override := -1   # 점검용 유닉스 초(-1 이면 시계)


static func on() -> bool:
	return OS.get_environment("SAGA_SEASON") != "0"


static func season_of(unix: int) -> int:
	return (unix / 86400 + 3) / 7


static func now_unix() -> int:
	return now_override if now_override >= 0 else int(Time.get_unix_time_from_system())


static func days_left() -> int:
	var u := now_unix()
	return (season_of(u) + 1) * 7 - 3 - u / 86400


static func score() -> int:
	var s := 0
	for r: Dictionary in runs:
		s += int(r.pts)
	return s


## 닿은 단계 번호(-1 = 아직 없음)
static func tier_of(sc: int) -> int:
	var t := -1
	for i in TIERS.size():
		if sc >= int(TIERS[i].need):
			t = i
	return t


static func tier_name(t: int) -> String:
	return "단계 없음" if t < 0 else "%s %s" % [String(TIERS[t].emoji), String(TIERS[t].name)]


static func next_text(sc: int) -> String:
	var t := tier_of(sc)
	if t >= TIERS.size() - 1:
		return "최고 단계"
	return "%s까지 %d" % [String(TIERS[t + 1].name), int(TIERS[t + 1].need) - sc]


## 시즌이 바뀌었으면 지난 시즌을 닫고 덤 금 — {} 이거나 {settled, id, score, tier, gold}
static func roll() -> Dictionary:
	if not on():
		return {}
	var cur := season_of(now_unix())
	if id == cur or (id >= 0 and cur < id):   # 시계를 뒤로 돌려도 닫지 않는다(앞뒤로 돌려 덤 금 거듭 받기 막음 — R-5)
		return {}
	if id < 0:
		id = cur
		return {}
	var sc := score()
	var t := tier_of(sc)
	var g: int = int(TIERS[t].gold) if t >= 0 else 0
	if g > 0:
		DungeonGoldState.add(g)
	past.push_front({"id": id, "score": sc, "tier": t})
	if past.size() > PAST_KEEP:
		past.resize(PAST_KEEP)
	var out := {"settled": true, "id": id, "score": sc, "tier": t, "gold": g}
	id = cur
	runs = []
	return out


static func roll_text(r: Dictionary) -> String:
	if r.is_empty():
		return ""
	return "🏆 시즌 %d 끝 — %s(%d점)%s" % [int(r.id), tier_name(int(r.tier)), int(r.score), (" · 💰 +%d" % int(r.gold)) if int(r.gold) > 0 else ""]


## 한 판 등급 결과를 래더에 — {} 이거나 {pts, in, score, tier, up}
static func record(r: Dictionary) -> Dictionary:
	if not on() or r.is_empty() or bool(r.get("dead", false)):
		return {}
	var rolled := roll()
	var pts := (ORDER.find(String(r.rank)) + 1) * clampi(int(r.get("tier", 1)), 1, 5)
	if pts <= 0:
		return {}
	var t0 := tier_of(score())
	var e := {"pts": pts, "rank": String(r.rank), "tier": int(r.get("tier", 1)), "sec": int(r.get("sec", 0))}
	var at := runs.size()
	for i in runs.size():
		if pts > int(runs[i].pts):
			at = i
			break
	var entered := at < KEEP
	if entered:
		runs.insert(at, e)
		if runs.size() > KEEP:
			runs.resize(KEEP)
	var sc := score()
	return {"pts": pts, "in": entered, "score": sc, "tier": tier_of(sc), "up": tier_of(sc) > t0, "rolled": rolled}


static func line(s: Dictionary) -> String:
	if s.is_empty():
		return ""
	var head := roll_text(s.get("rolled", {}))
	var body := ("🏅 시즌 +%d점 → %d점 %s · %s" % [int(s.pts), int(s.score), tier_name(int(s.tier)), next_text(int(s.score))]) if bool(s.in) \
		else "🏅 시즌 %d점 — 좋은 판 다섯에 못 듦" % int(s.pts)
	if bool(s.get("up", false)):
		body += " · 단계 올라감!"
	return (head + " / " if head != "" else "") + body


## 시즌 창 줄
static func lines() -> Array:
	var sc := score()
	var out: Array = ["🏆 시즌 %d · 남은 %d일 · %d점 %s · %s" % [id, days_left(), sc, tier_name(tier_of(sc)), next_text(sc)]]
	if runs.is_empty():
		out.append("이번 시즌 기록 없음 — 살아 나온 등급 판(처치 셋 이상)이 오른다")
	for i in runs.size():
		var r: Dictionary = runs[i]
		out.append("%d. %s급 × 급수 %d = %d점 · %d:%02d" % [i + 1, String(r.rank), int(r.tier), int(r.pts), int(r.sec) / 60, int(r.sec) % 60])
	for p: Dictionary in past:
		out.append("지난 시즌 %d — %s(%d점)" % [int(p.id), tier_name(int(p.tier)), int(p.score)])
	return out


static func dump() -> Dictionary:
	return {"id": id, "runs": runs, "past": past}


static func restore(saved: Variant) -> void:
	id = -1
	runs = []
	past = []
	if typeof(saved) != TYPE_DICTIONARY:
		return
	var d: Dictionary = saved
	id = int(d.get("id", -1))
	for r in d.get("runs", []):
		if typeof(r) == TYPE_DICTIONARY and ORDER.has(String(r.get("rank", ""))):
			runs.append({"pts": int(r.get("pts", 0)), "rank": String(r.rank), "tier": int(r.get("tier", 1)), "sec": int(r.get("sec", 0))})
	runs.sort_custom(func(a: Dictionary, b: Dictionary) -> bool: return int(a.pts) > int(b.pts))
	if runs.size() > KEEP:
		runs.resize(KEEP)
	for p in d.get("past", []):
		if typeof(p) == TYPE_DICTIONARY and past.size() < PAST_KEEP:
			past.append({"id": int(p.get("id", 0)), "score": int(p.get("score", 0)), "tier": int(p.get("tier", -1))})
