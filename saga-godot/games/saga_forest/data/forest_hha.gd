extends RefCounted

## G-0330 3마을 집 꾸미기 계절 심사(동물의숲 HHA — 구조만). 고돗이 먼저(웹 짝 없음, 장부 forest.md 우선 3 "가구 태그의 보상").
##   심사   집 안 「집 평가」(forest_house _show_home_score)를 누르면 이번 계절 심사 — 점수 = 기존 집 평가(ForestHome.score) + 계절 주제 덤.
##   주제   계절마다 가구 갈래(set) 하나 — 🌸 봄 뜰(ddeul) · ☀️ 여름 부엌(buok) · 🍂 가을 사랑(sarang) · ❄️ 겨울 안방(anbang).
##          그 갈래 가구가 하나면 +THEME_ONE, 둘 이상이면 +THEME_TWO.
##   별     점수 문턱 STARS(집 등급 문턱과 같은 30·80·160·280·450) → ★1~5. 보상 금 = 별 × GOLD_PER_STAR — 계절마다 가장 높은 별만큼(다시 심사해 오르면 차이만).
##   저장   ForestSaveState.hha = {season: "YYYY-n", best: 별} — 순수 추가 칸(버전 안 올림). SAGA_HHA=0 이면 끔.
## F = ForestSaveState(forest_livestock.gd 와 같은 꼴).

const SEASONS := [
	{"name": "봄", "emoji": "🌸", "set": "ddeul", "set_name": "뜰"},
	{"name": "여름", "emoji": "☀️", "set": "buok", "set_name": "부엌"},
	{"name": "가을", "emoji": "🍂", "set": "sarang", "set_name": "사랑방"},
	{"name": "겨울", "emoji": "❄️", "set": "anbang", "set_name": "안방"},
]
const THEME_ONE := 25
const THEME_TWO := 40
const STARS := [30, 80, 160, 280, 450]
const GOLD_PER_STAR := 300


static func on() -> bool:
	return OS.get_environment("SAGA_HHA") != "0"


## 계절 번호 0 봄(3~5월) · 1 여름 · 2 가을 · 3 겨울(12~2월)
static func season_idx(day_key: int) -> int:
	var m := (day_key / 100) % 100
	if m >= 3 and m <= 5:
		return 0
	if m >= 6 and m <= 8:
		return 1
	if m >= 9 and m <= 11:
		return 2
	return 3


## 계절 열쇠 — 12월은 다음 해 겨울(1·2월과 같은 열쇠)
static func season_key(day_key: int) -> String:
	var y := day_key / 10000
	var m := (day_key / 100) % 100
	return "%d-%d" % [y + 1 if m == 12 else y, season_idx(day_key)]


static func theme_bonus(items: Array, sidx: int, furn: Callable) -> int:
	var want := String(SEASONS[sidx].set)
	var n := 0
	for it: Dictionary in items:
		var f: Dictionary = furn.call(String(it.key))
		if String(f.get("set", "")) == want:
			n += 1
	return THEME_TWO if n >= 2 else (THEME_ONE if n == 1 else 0)


static func stars_of(total: int) -> int:
	var s := 0
	for t: int in STARS:
		if total >= t:
			s += 1
	return s


## 심사 — {total, theme, stars, gold, best, season}. base = ForestHome.score().total
static func judge(F: Node, base: int, theme: int, day_key: int) -> Dictionary:
	if not on():
		return {}
	if typeof(F.hha) != TYPE_DICTIONARY or (F.hha as Dictionary).is_read_only():   # 상수 사전(촬영 set 등)이 들어와도 고쳐 쓸 수 있게
		F.hha = (F.hha as Dictionary).duplicate(true) if typeof(F.hha) == TYPE_DICTIONARY else {}
	var H: Dictionary = F.hha
	var key := season_key(day_key)
	if String(H.get("season", "")) != key:
		H["season"] = key
		H["best"] = 0
	var total := base + theme
	var st := stars_of(total)
	var gold := 0
	if st > int(H.best):
		gold = (st - int(H.best)) * GOLD_PER_STAR
		H.best = st
		F.add_gold(gold)
	return {"total": total, "theme": theme, "stars": st, "gold": gold, "best": int(H.best), "season": key}


static func text(r: Dictionary, sidx: int) -> String:
	var s: Dictionary = SEASONS[sidx]
	var line := "%s %s 심사 — %s %d점(주제 %s +%d)" % [s.emoji, s.name, "★".repeat(int(r.stars)) + "☆".repeat(5 - int(r.stars)), int(r.total), s.set_name, int(r.theme)]
	return line + ("\n💰 +%d" % int(r.gold) if int(r.gold) > 0 else "\n이번 계절 최고 ★%d — 더 꾸미면 덤" % int(r.best))
