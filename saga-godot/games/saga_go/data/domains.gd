extends RefCounted

## PLAN 106장 ⑳ — 원신식 비경(짧은 도전 던전) 규칙. 상태는 PartyState.resin·resin_t, 진행은 world/domains.gd.
##   비경 셋 — 성유물(잠든 무덤, 폐허)·특성(옛 서당, 마을)·무기(쇠부리 터, 포구). 입구 3m 안에서 F → 단계(I·II·III) 고르기.
##   안: 세상 밖 떨어진 원판(지름 36m). 3초 뒤 파도 둘을 차례로, 120초 안에 다 쓰러뜨리면 보상 나무가 난다 —
##   원기 20 을 써서 받는다(모자라면 못 받고 나감). 명단이 다 쓰러지거나 시간이 다 되면 실패(원기 안 씀).
##   지맥 이상(비경마다 하나): 무덤 = 적이 물을 띤다 · 서당 = 적을 쓰러뜨리면 명단 기력 +8 · 쇠부리 터 = 적 공격 +30%.
##   원기(원신의 레진 자리): 상한 160, 실제 시각 8분에 1 — 저장한다.
## 이름·수치는 이 판 것.

const RESIN_MAX := 160
const RESIN_SEC := 480.0
const RESIN_COST := 20
const TIME_LIMIT := 120.0
const START_DELAY := 3.0
const ARENA_R := 18.0
const GATE_M := 3.0

## 단계 — 체력·공격 배율, 여는 모험 등급(106장 ㉒ adventure.gd), 권장 인물 레벨(표시만).
const LEVELS := [
	{"name": "I", "hp": 1.0, "atk": 1.0, "ar": 1, "rec": 1},
	{"name": "II", "hp": 2.0, "atk": 1.5, "ar": 6, "rec": 20},
	{"name": "III", "hp": 3.5, "atk": 2.2, "ar": 12, "rec": 40},
]

## 비경 — gate: [지역, 칸], arena: 세상 밖 원판 가운데. waves: 파도마다 적 kind. reward: 단계마다 가방 사전.
## 성유물 비경은 artifacts 로 [★4 수, ★5 수], 세트는 sets 둘 중 번갈아.
const DOMAINS := {
	"tomb": {"name": "잠든 무덤", "kind": "artifact", "gate": ["ruins", Vector2(5.0, 2.3)], "arena": Vector3(-1400.0, 40.0, 0.0),
		"waves": [["wolf", "wolf", "bandit"], ["water_turtle", "fire_imp"]], "modifier": "water",
		"modifier_text": "지맥 이상: 적이 물을 띤다", "sets": ["crimson", "depth"],
		"reward": [{"mora": 1000, "polish": 1}, {"mora": 1800, "polish": 2}, {"mora": 2600, "polish": 3}],
		"artifacts": [[2, 0], [2, 1], [1, 2]]},
	"school": {"name": "옛 서당", "kind": "talent", "gate": ["village", Vector2(3.3, 5.6)], "arena": Vector3(-1400.0, 40.0, 200.0),
		"waves": [["bandit", "bandit", "bandit"], ["thunder_cat", "ice_fox"]], "modifier": "energy",
		"modifier_text": "지맥 이상: 적을 쓰러뜨리면 명단 기력 +8",
		"reward": [{"mora": 1000, "talent_1": 3}, {"mora": 1800, "talent_1": 2, "talent_2": 2}, {"mora": 2600, "talent_2": 3, "talent_3": 1}]},
	"forge": {"name": "쇠부리 터", "kind": "weapon", "gate": ["coast", Vector2(7.3, 4.6)], "arena": Vector3(-1400.0, 40.0, 400.0),
		"waves": [["rock_bear", "wolf", "wolf"], ["grass_snake", "wind_hawk"]], "modifier": "fury",
		"modifier_text": "지맥 이상: 적 공격 +30%",
		"reward": [{"mora": 1000, "ore_s": 3, "iron": 2}, {"mora": 1800, "ore_m": 2, "iron": 4}, {"mora": 2600, "ore_m": 2, "ore_l": 1, "iron": 6}]},
	## 106장 ㉑ 주간 보스 — 보스 하나(combat/field_boss.gd), 180초, 원기 60(이번 주 처음 셋은 30). 특성 7→8 재료 뇌룡 비늘.
	"weekly": {"name": "먹구름 제단", "kind": "boss", "boss": true, "gate": ["coast", Vector2(5.4, 7.4)], "arena": Vector3(-1400.0, 40.0, 600.0),
		"waves": [["storm_serpent"]], "modifier": "none", "time": 180.0,
		"modifier_text": "주간 보스: 체력 절반에서 번개 방패(불에 약함) · 붉은 원을 피하라",
		"sets": ["emblem", "gladiator"],
		"reward": [{"mora": 2000, "boss_mat": 1, "talent_2": 2}, {"mora": 3000, "boss_mat": 2, "talent_2": 3}, {"mora": 4000, "boss_mat": 3, "talent_3": 1, "fate_knot": 1}],
		"artifacts": [[0, 1], [0, 1], [0, 2]]},
	## 106장 52-5 결말 뒤 재대결 — 이야기 보스 넷을 주간 보스 틀로(보스 하나·240초·원기 60, 주간 할인 셋은 모든 주간 보스가 함께 센다).
	## after_ch = 이 장(0부터 센 수)에 닿은 뒤에만 입구가 보이고 열린다 — 29(8부 29장 = 1차 결말을 마친 뒤). 입구는 그 보스가 나온 지역.
	"rematch_king": {"name": "매듭 등불의 메아리", "kind": "boss", "boss": true, "after_ch": 29, "gate": ["village", Vector2(6.3, 3.6)], "arena": Vector3(-1400.0, 40.0, 800.0),
		"waves": [["storm_king_true"]], "modifier": "none", "time": 240.0,
		"modifier_text": "재대결: 먹구름 임금 — 참몸 · 체력 절반에서 번개 방패(불에 약함)",
		"sets": ["emblem", "gladiator"],
		"reward": [{"mora": 3000, "boss_mat": 1, "talent_3": 1}, {"mora": 4500, "boss_mat": 2, "talent_3": 1, "book_l": 1}, {"mora": 6000, "boss_mat": 3, "talent_3": 2, "fate_knot": 1}],
		"artifacts": [[0, 1], [0, 1], [0, 2]]},
	"rematch_fox": {"name": "얼음굴의 메아리", "kind": "boss", "boss": true, "after_ch": 29, "gate": ["frost", Vector2(3.7, 2.8)], "arena": Vector3(-1400.0, 40.0, 1000.0),
		"waves": [["rift_fox"]], "modifier": "none", "time": 240.0,
		"modifier_text": "재대결: 틈새 서리 구미호 · 틈새 질주를 피하라",
		"sets": ["crimson", "viridescent"],
		"reward": [{"mora": 3000, "boss_mat": 1, "talent_3": 1}, {"mora": 4500, "boss_mat": 2, "talent_3": 1, "book_l": 1}, {"mora": 6000, "boss_mat": 3, "talent_3": 2, "fate_knot": 1}],
		"artifacts": [[0, 1], [0, 1], [0, 2]]},
	"rematch_crow": {"name": "갈림길의 메아리", "kind": "boss", "boss": true, "after_ch": 29, "gate": ["crossing", Vector2(4.3, 2.9)], "arena": Vector3(-1400.0, 40.0, 1200.0),
		"waves": [["rift_crow"]], "modifier": "none", "time": 240.0,
		"modifier_text": "재대결: 틈 삼킨 별까마귀 · 붉은 원을 피하라",
		"sets": ["viridescent", "emblem"],
		"reward": [{"mora": 3000, "boss_mat": 1, "talent_3": 1}, {"mora": 4500, "boss_mat": 2, "talent_3": 1, "book_l": 1}, {"mora": 6000, "boss_mat": 3, "talent_3": 2, "fate_knot": 1}],
		"artifacts": [[0, 1], [0, 1], [0, 2]]},
	## 106장 55-5 2차 결말 뒤 재대결 — 11부 이야기 보스 둘(after_ch 38 = 38장을 마친 뒤). 입구는 세갈래 고을.
	"rematch_first_crow": {"name": "처음 순간의 메아리", "kind": "boss", "boss": true, "after_ch": 38, "gate": ["fork", Vector2(3.0, 3.4)], "arena": Vector3(-1400.0, 40.0, 1600.0),
		"waves": [["first_crow"]], "modifier": "none", "time": 240.0,
		"modifier_text": "재대결: 처음의 별까마귀 · 찢긴 하늘의 번개 방패(불로 깬다)",
		"sets": ["viridescent", "emblem"],
		"reward": [{"mora": 3500, "boss_mat": 1, "talent_3": 1}, {"mora": 5000, "boss_mat": 2, "talent_3": 1, "book_l": 1}, {"mora": 7000, "boss_mat": 3, "talent_3": 2, "fate_knot": 1}],
		"artifacts": [[0, 1], [0, 1], [0, 2]]},
	"rematch_garmuri": {"name": "갈무리 격자의 메아리", "kind": "boss", "boss": true, "after_ch": 38, "gate": ["fork", Vector2(5.0, 2.2)], "arena": Vector3(-1400.0, 40.0, 1800.0),
		"waves": [["garmuri_true"]], "modifier": "none", "time": 240.0,
		"modifier_text": "재대결: 갈무리 — 참몸 · 격자를 몸에 두른 보관 거신",
		"sets": ["crimson", "depth"],
		"reward": [{"mora": 3500, "boss_mat": 1, "talent_3": 1}, {"mora": 5000, "boss_mat": 2, "talent_3": 1, "book_l": 1}, {"mora": 7000, "boss_mat": 3, "talent_3": 2, "fate_knot": 1}],
		"artifacts": [[0, 1], [0, 1], [0, 2]]},
	## 106장 56-2 3차 결말(41장) 뒤 재대결 — 12부 이야기 보스(after_ch 41). 입구는 세갈래 고을 마당 곁.
	"rematch_seed": {"name": "곳간 노래의 메아리", "kind": "boss", "boss": true, "after_ch": 41, "gate": ["fork", Vector2(2.6, 2.6)], "arena": Vector3(-1400.0, 40.0, 2000.0),
		"waves": [["seed_giant"]], "modifier": "none", "time": 240.0,
		"modifier_text": "재대결: 갈무리의 싹 · 덩굴 방패(풍으로 깬다)",
		"sets": ["viridescent", "depth"],
		"reward": [{"mora": 3800, "boss_mat": 1, "talent_3": 1}, {"mora": 5500, "boss_mat": 2, "talent_3": 1, "book_l": 1}, {"mora": 7500, "boss_mat": 3, "talent_3": 2, "fate_knot": 1}],
		"artifacts": [[0, 1], [0, 1], [0, 2]]},
	## G-0076 13부(회차 전용) 끝(44장) 뒤 재대결 — 이야기 보스 그날의 검은 가면(after_ch 44). 입구는 청하 마을 북쪽 봉우리 발치.
	"rematch_dawn": {"name": "그날 노래의 메아리", "kind": "boss", "boss": true, "after_ch": 44, "gate": ["village", Vector2(6.0, 2.85)], "arena": Vector3(-1400.0, 40.0, 2200.0),
		"waves": [["dawn_mask"]], "modifier": "none", "time": 240.0,
		"modifier_text": "재대결: 그날의 검은 가면 · 먹구름 방패(불로 깬다)",
		"sets": ["crimson", "emblem"],
		"reward": [{"mora": 4000, "boss_mat": 1, "talent_3": 1}, {"mora": 5800, "boss_mat": 2, "talent_3": 1, "book_l": 1}, {"mora": 8000, "boss_mat": 3, "talent_3": 2, "fate_knot": 1}],
		"artifacts": [[0, 1], [0, 1], [0, 2]]},
	"rematch_colossus": {"name": "빛 돔의 메아리", "kind": "boss", "boss": true, "after_ch": 29, "gate": ["sunken", Vector2(3.7, 2.1)], "arena": Vector3(-1400.0, 40.0, 1400.0),
		"waves": [["dome_colossus"]], "modifier": "none", "time": 240.0,
		"modifier_text": "재대결: 돔 파수 거신 · 체력 절반에서 암 방패(초로 깬다)",
		"sets": ["depth", "gladiator"],
		"reward": [{"mora": 3000, "boss_mat": 1, "talent_3": 1}, {"mora": 4500, "boss_mat": 2, "talent_3": 1, "book_l": 1}, {"mora": 6000, "boss_mat": 3, "talent_3": 2, "fate_knot": 1}],
		"artifacts": [[0, 1], [0, 1], [0, 2]]},
}
const ORDER := ["tomb", "school", "forge", "weekly", "rematch_king", "rematch_fox", "rematch_crow", "rematch_colossus", "rematch_first_crow", "rematch_garmuri", "rematch_seed", "rematch_dawn"]
const KIND_NAMES := {"artifact": "성유물", "talent": "특성 재료", "weapon": "무기 재료", "boss": "주간 보스"}
const WEEKLY_COST := 60
const WEEKLY_DISCOUNT_COST := 30
const WEEKLY_DISCOUNTS := 3
const FURY_MUL := 1.3
const ENERGY_PER_KILL := 8.0
const WATER_EVERY := 4.0
const REWARD_EXP := [10.0, 15.0, 20.0]

static var time_offset := 0.0

static func now() -> float:
	return Time.get_unix_time_from_system() + time_offset

## 지금 원기 — 저장된 값에 지난 시간만큼 더한다(상한 160). PartyState 에 앉히며 돌려준다.
static func resin_now() -> int:
	var t := now()
	if float(PartyState.resin_t) <= 0.0:
		PartyState.resin = RESIN_MAX
		PartyState.resin_t = t
		return RESIN_MAX
	if PartyState.resin >= RESIN_MAX:
		PartyState.resin_t = t
		return RESIN_MAX
	var gained := floori((t - float(PartyState.resin_t)) / RESIN_SEC)
	if gained > 0:
		PartyState.resin = mini(PartyState.resin + gained, RESIN_MAX)
		PartyState.resin_t = float(PartyState.resin_t) + gained * RESIN_SEC
		if PartyState.resin >= RESIN_MAX:
			PartyState.resin_t = t
	return PartyState.resin

static func spend_resin(n: int) -> bool:
	if resin_now() < n:
		return false
	var was_full := PartyState.resin >= RESIN_MAX
	PartyState.resin -= n
	if was_full:
		PartyState.resin_t = now() # 가득일 땐 시계가 멈춰 있었다 — 지금부터 다시 찬다
	return true

## 주 번호 — 월요일 새벽 4시에 넘어간다(commissions.gd 날짜 번호 기준, 1970-01-01 은 목요일).
static func this_week() -> int:
	return floori(float(preload("res://games/saga_go/data/commissions.gd").today() + 3) / 7.0)

## 이번 주 주간 보스 보상 받은 번수(주가 바뀌었으면 0 으로 되돌린다).
static func weekly_claims() -> int:
	var w := this_week()
	if int(PartyState.weekly.get("week", -1)) != w:
		PartyState.weekly = {"week": w, "claims": 0}
	return int(PartyState.weekly.claims)

static func add_weekly_claim() -> void:
	weekly_claims()
	PartyState.weekly.claims = int(PartyState.weekly.claims) + 1

## 이 비경 보상에 드는 원기.
static func cost_of(id: String) -> int:
	if DOMAINS[id].get("boss", false):
		return WEEKLY_DISCOUNT_COST if weekly_claims() < WEEKLY_DISCOUNTS else WEEKLY_COST
	return RESIN_COST

static func time_of(id: String) -> float:
	return float(DOMAINS[id].get("time", TIME_LIMIT))

## 입구가 열렸는가 — after_ch 가 있으면 이야기가 그 장까지 닿은 뒤(52-5 재대결 = 1차 결말 뒤).
static func domain_open(id: String) -> bool:
	return int(PartyState.story.get("ch", 0)) >= int(DOMAINS[id].get("after_ch", 0))

static func level_open(lv: int) -> bool:
	return PartyState.level + 1 >= int(LEVELS[lv].ar)

## 보상 한 줄(표시).
static func reward_text(id: String, lv: int) -> String:
	var d: Dictionary = DOMAINS[id]
	var parts: Array[String] = []
	if d.has("artifacts"):
		var a: Array = d.artifacts[lv]
		if int(a[0]) > 0:
			parts.append("★4 성유물 %d" % int(a[0]))
		if int(a[1]) > 0:
			parts.append("★5 성유물 %d" % int(a[1]))
	var r: Dictionary = d.reward[lv]
	for item in r:
		parts.append("%s %d" % [preload("res://games/saga_go/data/growth.gd").item_name(item), int(r[item])])
	return " · ".join(parts)
