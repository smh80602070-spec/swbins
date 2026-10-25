extends RefCounted

## PLAN 106장 ⑰ — 원신식 성유물(표·생성·계산만, 상태는 PartyState.artifacts).
##   부위 다섯: 꽃(체력)·깃(공격력)·해시계·술잔·관 — 꽃·깃은 주옵션이 정해져 있고 나머지는 부위마다 고른다.
##   ★4(최대 +16, 부옵션 처음 2~3)·★5(최대 +20, 처음 3~4). +4 마다 부옵션이 넷 미만이면 새로 하나, 넷이면 하나가 오른다.
##   주옵션 값 = 처음 값 + (끝 값 - 처음 값) × Lv/20(★4 는 ×0.8). 부옵션 한 번 = 최대치 × (0.7·0.8·0.9·1.0 중 하나).
##   무작위는 성유물마다 정해진 씨앗으로 굴린다(점검·세이브가 늘 같게).
##   세트 다섯 — 2 세트·4 세트 효과(SETS). 체력·방어 고정값은 이 판 체력 규모(원신의 약 0.3·0.2)에 맞춰 줄였다.
## 이름·수치는 이 판 것(원작 세트 이름을 옮기지 않는다).

const SLOTS := ["flower", "plume", "sands", "goblet", "circlet"]
const SLOT_NAMES := {"flower": "꽃", "plume": "깃", "sands": "해시계", "goblet": "술잔", "circlet": "관"}

const STAT_NAMES := {
	"hp": "체력", "atk": "공격력", "def": "방어력",
	"hp_pct": "체력%", "atk_pct": "공격력%", "def_pct": "방어력%",
	"energy": "기력 획득", "crit_rate": "치명타 확률", "crit_dmg": "치명타 피해",
	"elem_fire": "화 피해", "elem_water": "수 피해", "elem_thunder": "뇌 피해", "elem_wind": "풍 피해",
	"elem_ice": "빙 피해", "elem_rock": "암 피해", "elem_grass": "초 피해", "elem_phys": "물리 피해",
}
const FLAT := ["hp", "atk", "def"]

## 주옵션 ★5 [+0, +20].
const MAIN := {
	"hp": [32.0, 210.0], "atk": [47.0, 311.0],
	"atk_pct": [0.07, 0.466], "hp_pct": [0.07, 0.466], "def_pct": [0.087, 0.583],
	"energy": [0.078, 0.518], "crit_rate": [0.047, 0.311], "crit_dmg": [0.093, 0.622],
	"elem_fire": [0.07, 0.466], "elem_water": [0.07, 0.466], "elem_thunder": [0.07, 0.466], "elem_wind": [0.07, 0.466],
	"elem_ice": [0.07, 0.466], "elem_rock": [0.07, 0.466], "elem_grass": [0.07, 0.466], "elem_phys": [0.087, 0.583],
}
const SLOT_MAINS := {
	"flower": ["hp"],
	"plume": ["atk"],
	"sands": ["atk_pct", "hp_pct", "def_pct", "energy"],
	"goblet": ["atk_pct", "hp_pct", "def_pct", "elem_fire", "elem_water", "elem_thunder", "elem_wind", "elem_ice", "elem_rock", "elem_grass", "elem_phys"],
	"circlet": ["crit_rate", "crit_dmg", "atk_pct", "hp_pct", "def_pct"],
}
## 부옵션 ★5 한 번 최대치.
const SUB_ROLL := {"hp": 13.0, "atk": 19.45, "def": 4.6, "hp_pct": 0.0583, "atk_pct": 0.0583, "def_pct": 0.0729,
	"energy": 0.0648, "crit_rate": 0.0389, "crit_dmg": 0.0777}
const ROLL_TIERS := [0.7, 0.8, 0.9, 1.0]
const RARITY_MUL := {4: 0.8, 5: 1.0}
const MAX_LV := {4: 16, 5: 20}

## 강화 — 연마석 하나 = 경험 2500(냥 250). 다음 +1 까지 (Lv+1)×1500. 분해하면 ★4 연마석 1·★5 2 + 쌓인 경험 8할.
const POLISH_EXP := 2500
const POLISH_MORA := 250
const SALVAGE := {4: 1, 5: 2}
const CAP := 200 # 가진 성유물 상한 — 넘치면 안 낀 ★4 부터 저절로 분해

## 세트 — "2"·"4" 는 효과 사전. 2 세트 효과는 PartyState.stat() 에 더해지는 옵션, 4 세트는 전용 키
## (normal_melee: 한손검·양손검·장병기 기본 공격 · react_fire: 증발·융해·과부하·연소 · react_swirl: 확산 · burst_dmg · skill_dmg).
const SETS := {
	"gladiator": {"name": "떠돌이 무사", "2": {"atk_pct": 0.18}, "4": {"normal_melee": 0.35},
		"text2": "공격력 +18%", "text4": "한손검·양손검·장병기 기본 공격 피해 +35%"},
	"crimson": {"name": "불꽃 무녀", "2": {"elem_fire": 0.15}, "4": {"react_fire": 0.4},
		"text2": "화 피해 +15%", "text4": "증발·융해·과부하·연소 피해 +40%"},
	"viridescent": {"name": "바람 나그네", "2": {"elem_wind": 0.15}, "4": {"react_swirl": 0.6},
		"text2": "풍 피해 +15%", "text4": "확산 피해 +60%"},
	"emblem": {"name": "절연 깃발", "2": {"energy": 0.2}, "4": {"burst_dmg": 0.25},
		"text2": "기력 획득 +20%", "text4": "원소 폭발 피해 +25%"},
	"depth": {"name": "물결 성자", "2": {"elem_water": 0.15}, "4": {"skill_dmg": 0.3},
		"text2": "수 피해 +15%", "text4": "원소 스킬 피해 +30%"},
}
const SET_IDS := ["gladiator", "crimson", "viridescent", "emblem", "depth"]
const FIRE_REACTIONS := ["vaporize", "melt", "overload", "burning"]

static func _rng(seed_value: int) -> RandomNumberGenerator:
	var r := RandomNumberGenerator.new()
	r.seed = seed_value
	return r

## 새 성유물 하나 — set_id·slot 이 ""이면 씨앗으로 고른다.
static func generate(seed_value: int, rarity: int, set_id: String = "", slot: String = "") -> Dictionary:
	var r := _rng(seed_value)
	if set_id == "":
		set_id = SET_IDS[r.randi() % SET_IDS.size()]
	if slot == "":
		slot = SLOTS[r.randi() % SLOTS.size()]
	var mains: Array = SLOT_MAINS[slot]
	var main: String = mains[r.randi() % mains.size()]
	var art := {"set": set_id, "slot": slot, "rarity": rarity, "lv": 0, "exp": 0.0, "total": 0.0, "main": main, "subs": [], "seed": seed_value, "owner": ""}
	var n := (3 if rarity >= 5 else 2) + (1 if r.randf() < 0.25 else 0)
	for i in n:
		_add_sub(art, r)
	var uq: String = preload("res://games/saga_go/data/artifact_unique.gd").roll(seed_value, rarity)   # G-0400 고유 보패(★5 의 8% — 주·부옵션 굴림과 따로)
	if uq != "":
		art["uq"] = uq
	return art

static func _add_sub(art: Dictionary, r: RandomNumberGenerator) -> void:
	var pool: Array = []
	for k in SUB_ROLL:
		if k == art.main:
			continue
		var taken := false
		for s in art.subs:
			if s[0] == k:
				taken = true
		if not taken:
			pool.append(k)
	var key: String = pool[r.randi() % pool.size()]
	(art.subs as Array).append([key, _roll(key, int(art.rarity), r)])

static func _roll(key: String, rarity: int, r: RandomNumberGenerator) -> float:
	return float(SUB_ROLL[key]) * float(RARITY_MUL[rarity]) * float(ROLL_TIERS[r.randi() % ROLL_TIERS.size()])

## +4 에 닿을 때 — 부옵션이 넷 미만이면 새로, 넷이면 하나 올린다. 씨앗 = 성유물 씨앗 × 31 + Lv.
static func on_step(art: Dictionary) -> void:
	var r := _rng(int(art.seed) * 31 + int(art.lv))
	var subs: Array = art.subs
	if subs.size() < 4:
		_add_sub(art, r)
	else:
		var s: Array = subs[r.randi() % subs.size()]
		s[1] = float(s[1]) + _roll(s[0], int(art.rarity), r)

static func exp_to_next(lv: int) -> int:
	return (lv + 1) * 1500

static func main_value(art: Dictionary) -> float:
	var t: Array = MAIN[art.main]
	var v: float = float(t[0]) + (float(t[1]) - float(t[0])) * float(art.lv) / 20.0
	return v * float(RARITY_MUL[int(art.rarity)])

static func stat_text(key: String, v: float) -> String:
	if FLAT.has(key):
		return "%s +%d" % [STAT_NAMES[key], int(round(v))]
	return "%s +%.1f%%" % [STAT_NAMES[key], v * 100.0]

static func salvage_value(art: Dictionary) -> int:
	return int(SALVAGE[int(art.rarity)]) + int(float(art.get("total", 0.0)) * 0.8 / POLISH_EXP)
