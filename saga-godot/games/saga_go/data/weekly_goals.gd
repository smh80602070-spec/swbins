extends RefCounted

## 주간 도전 (2026-09-30 새 시스템) — 하루짜리 의뢰(U) 위의 한 주짜리 큰 목표. 이번 주(월요일 새벽 4시 기준)에 이미 있는 셈(들판 적·원소 괴물·우두머리·비경·
## 원소 반응·채집·요리·낚시·상자·별조각·걸음·알 부화)을 얼마나 늘렸나로 다섯 가지를 골라 준다. 규칙·표는 여기, 상태는 PartyState.weekly_goals,
## 화면·알림은 world/weekly_goals.gd. 셈은 업적(world/achievements.gd)이 쌓는 값 + 알 상태(걸음·부화)를 그대로 읽는다.
##
##   PartyState.weekly_goals = {"week": 주 번호, "base": {셈: 주 시작 때 값}, "claimed": [받은 도전 id], "bonus": 다 모은 보상을 받았나}
##   이번 주 진척 = 지금 값 − 주 시작 값(값이 줄면 — 회차로 상자가 되살아나는 등 — 시작 값을 낮춰 0 아래로 안 간다).

const Domains := preload("res://games/saga_go/data/domains.gd")

## id → [이름, 셈, 목표, 설명(%d 자리에 목표)]
const POOL := {
	"g_kills": ["들판 순찰", "kills", 30, "들판의 적 %d마리 쓰러뜨리기"],
	"g_elemental": ["원소 사냥", "kills_elemental", 8, "원소 괴물 %d마리 쓰러뜨리기"],
	"g_boss": ["우두머리 토벌", "bosses", 1, "보스 %d번 쓰러뜨리기"],
	"g_domains": ["비경 두 번", "domains", 2, "비경 %d번 깨기"],
	"g_reactions": ["원소 놀이", "reactions", 25, "원소 반응 %d번 일으키기"],
	"g_gather": ["약초꾼", "gathered", 25, "채집물 %d개 줍기"],
	"g_cook": ["솥 앞의 사흘", "cooked", 3, "요리 %d번 하기"],
	"g_fish": ["낚시 한 판", "fish", 5, "물고기 %d마리 낚기"],
	"g_chests": ["보물 찾기", "chests", 4, "보물 상자 %d개 열기"],
	"g_shards": ["별 줍기", "shards", 3, "별조각 %d개 줍기"],
	"g_walk": ["먼 길", "walk", 3000, "%dm 걷기"],
	"g_hatch": ["알 품기", "hatched", 1, "신수 알 %d개 부화시키기"],
}
const ORDER := ["g_kills", "g_elemental", "g_boss", "g_domains", "g_reactions", "g_gather", "g_cook", "g_fish", "g_chests", "g_shards", "g_walk", "g_hatch"]
const PER_WEEK := 5
const REWARD := {"mora": 2500, "book_s": 2}
const BONUS := {"fate_knot": 2, "book_m": 2, "polish": 2}
const BONUS_EXP := 100.0

## 점검이 주를 돌릴 때(0 이면 진짜 주).
static var week_offset := 0


static func week() -> int:
	return Domains.this_week() + week_offset


## 이번 주 도전 id 다섯 — 주 번호가 씨앗이라 늘 같다(서로 다른 셈).
static func picks(w: int) -> Array[String]:
	var scored: Array = []
	for id in ORDER:
		scored.append([absi(("%d|%s" % [w, id]).hash()), id])
	scored.sort_custom(func(a, b): return a[0] < b[0])
	var out: Array[String] = []
	for i in PER_WEEK:
		out.append(String(scored[i][1]))
	return out


static func name_of(id: String) -> String:
	return String((POOL[id] as Array)[0])


static func stat_of(id: String) -> String:
	return String((POOL[id] as Array)[1])


static func goal_of(id: String) -> int:
	return int((POOL[id] as Array)[2])


static func desc_of(id: String) -> String:
	return String((POOL[id] as Array)[3]) % goal_of(id)


## 주가 바뀌었으면 새로 짠다(도전 다섯·시작 값). 지금 셈 값은 provider(Callable(셈) → int)가 준다.
static func ensure(provider: Callable) -> Dictionary:
	var s: Dictionary = PartyState.weekly_goals
	var w := week()
	if int(s.get("week", -1)) != w:
		var base := {}
		for id in ORDER:
			base[stat_of(id)] = int(provider.call(stat_of(id)))
		PartyState.weekly_goals = {"week": w, "base": base, "claimed": [], "bonus": false}
	return PartyState.weekly_goals


static func progress(id: String, provider: Callable) -> int:
	var s := ensure(provider)
	var stat := stat_of(id)
	var cur := int(provider.call(stat))
	var base := int((s.base as Dictionary).get(stat, 0))
	if cur < base:
		(s.base as Dictionary)[stat] = cur
		base = cur
	return cur - base


static func done(id: String, provider: Callable) -> bool:
	return progress(id, provider) >= goal_of(id)


static func claimed(id: String) -> bool:
	return ((PartyState.weekly_goals.get("claimed", []) as Array)).has(id)


static func claimable(provider: Callable) -> Array[String]:
	var out: Array[String] = []
	for id in picks(week()):
		if done(id, provider) and not claimed(id):
			out.append(id)
	return out


## 받는다 — 받았으면 true.
static func claim(id: String, provider: Callable) -> bool:
	if not picks(week()).has(id) or claimed(id) or not done(id, provider):
		return false
	(PartyState.weekly_goals.claimed as Array).append(id)
	PartyState.add_items(REWARD)
	return true


static func all_claimed() -> bool:
	for id in picks(week()):
		if not claimed(id):
			return false
	return true


static func claim_bonus() -> bool:
	if not all_claimed() or bool(PartyState.weekly_goals.get("bonus", false)):
		return false
	PartyState.weekly_goals.bonus = true
	PartyState.add_items(BONUS)
	PartyState.add_exp(BONUS_EXP)
	return true
