extends RefCounted

## 사냥 기록 (2026-09-30 새 시스템) — 몬스터헌터식 "종마다 쌓는 기록". 업적(Y)은 들판의 적을 통틀어 세지만, 여기는 종마다 따로 센다:
## 처음 쓰러뜨리면 도감에 이름이 적히고(그 전엔 "???"), 마릿수 단계마다 보상을 받는다. 규칙·수치는 여기, 상태는 PartyState.hunt,
## 화면·셈은 world/hunt_log.gd. 종 목록은 combat/field_enemy.gd KINDS 를 그대로 읽는다(새 종을 더하면 저절로 늘어난다).
##
##   PartyState.hunt = {"kills": {종: 마릿수}, "claimed": {종: 받은 단계 수}}
##   우두머리(체력 BOSS_HP 이상)는 단계가 낮고(1·3·10) 보상이 크다. 나머지는 10·40·120.

const FieldEnemy := preload("res://games/saga_go/combat/field_enemy.gd")
const Elements := preload("res://games/saga_go/combat/elements.gd")

const BOSS_HP := 2500.0
const TIERS := [10, 40, 120]
const BOSS_TIERS := [1, 3, 10]
const REWARDS := [
	{"mora": 1000, "book_s": 1},
	{"mora": 2000, "book_s": 2, "ore_s": 2},
	{"mora": 3500, "book_m": 1, "polish": 1},
]
const BOSS_REWARDS := [
	{"mora": 2500, "book_s": 2},
	{"mora": 5000, "book_m": 1, "polish": 1},
	{"mora": 8000, "book_m": 2, "fate_knot": 1},
]


static func state() -> Dictionary:
	var h: Dictionary = PartyState.hunt
	if not h.has("kills"):
		h["kills"] = {}
	if not h.has("claimed"):
		h["claimed"] = {}
	return h


## 종 id 들 — 일반 먼저, 우두머리 나중(KINDS 적힌 순서 그대로).
static func species() -> Array[String]:
	var normal: Array[String] = []
	var bosses: Array[String] = []
	for id in FieldEnemy.KINDS:
		if is_boss(String(id)):
			bosses.append(String(id))
		else:
			normal.append(String(id))
	return normal + bosses


static func def(kind: String) -> Dictionary:
	return FieldEnemy.KINDS.get(kind, {})


static func is_boss(kind: String) -> bool:
	return float(def(kind).get("hp", 0.0)) >= BOSS_HP


static func display_name(kind: String) -> String:
	return String(def(kind).get("name", kind))


static func element_name(kind: String) -> String:
	var el := String(def(kind).get("element", ""))
	return Elements.name_of(el) if el != "" else ""


static func tiers_of(kind: String) -> Array:
	return BOSS_TIERS if is_boss(kind) else TIERS


static func rewards_of(kind: String) -> Array:
	return BOSS_REWARDS if is_boss(kind) else REWARDS


static func kills(kind: String) -> int:
	return int((state().kills as Dictionary).get(kind, 0))


static func record(kind: String) -> int:
	if def(kind).is_empty():
		return 0
	var k: Dictionary = state().kills
	k[kind] = int(k.get(kind, 0)) + 1
	return int(k[kind])


## 지금까지 닿은 단계 수(0~3).
static func tier_reached(kind: String) -> int:
	var n := kills(kind)
	var t := 0
	for i in tiers_of(kind).size():
		if n >= int(tiers_of(kind)[i]):
			t = i + 1
	return t


static func claimed_tiers(kind: String) -> int:
	return int((state().claimed as Dictionary).get(kind, 0))


## 받을 수 있는 단계 수.
static func claimable(kind: String) -> int:
	return maxi(tier_reached(kind) - claimed_tiers(kind), 0)


static func claimable_total() -> int:
	var n := 0
	for id in species():
		n += claimable(id)
	return n


## 받는다 — 받은 보상 합(가방에 넣음). 없으면 {}.
static func claim(kind: String) -> Dictionary:
	var out := {}
	var from := claimed_tiers(kind)
	var to := tier_reached(kind)
	if to <= from:
		return out
	for i in range(from, to):
		var r: Dictionary = rewards_of(kind)[i]
		for item in r:
			out[item] = int(out.get(item, 0)) + int(r[item])
	PartyState.add_items(out)
	(state().claimed as Dictionary)[kind] = to
	return out


static func claim_all() -> Dictionary:
	var out := {}
	for id in species():
		var r := claim(id)
		for item in r:
			out[item] = int(out.get(item, 0)) + int(r[item])
	return out


## 만나 본 종 수 / 전체.
static func found_count() -> int:
	var n := 0
	for id in species():
		if kills(id) > 0:
			n += 1
	return n
