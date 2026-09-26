extends RefCounted

## PLAN 106장 ⑱ — 원신식 채집·요리 규칙(표·계산만, 상태는 PartyState.bag·gather_t·cook_prof·food_buffs).
##   채집물: 일반 재료 다섯(박하·꿀꽃·산사과·송이버섯·바지락, 실제 시각 30분 뒤 다시 자람) + 지역 특산물 넷
##   (마을 청하란·포구 갯소라·폐허 재꽃·고원 눈꽃, 1시간 — 원신의 하루·이틀을 이 판 채집 자리 수에 맞춰 줄였다) + 짐승 고기(늑대·바위곰).
##   요리 여덟: 회복(한 인물·모두·되살리기) 셋 · 공격 계열(공격·치명 확률·치명 피해) 셋 · 방어 계열 하나 · 모험 계열 하나.
##   품질 셋(이상한·보통·맛있는) — 조리 때 불 끄는 때를 맞히면 맛있는. 숙련 5 번이면 "자동 조리"(보통).
##   버프는 명단 전체 300초, 계열마다 하나만(새로 먹으면 갈아 끼움). 회복 요리는 먹은 인물 포만감 +35(100 을 넘으면 못 먹음).
## 이름·수치는 이 판 것(원작 요리·재료 이름을 옮기지 않는다).

const QUALITY_NAMES := ["이상한", "보통", "맛있는"]
const QUALITY_COUNT := 3
const PROF_MAX := 5
const BUFF_SEC := 300.0
const FULL_MAX := 100.0
const FULL_PER_DISH := 35.0
const FULL_DECAY := 1.0 # 초마다

## 조리 — 바늘이 0→1→0 을 NEEDLE_SEC 에 한 번 오간다. 요리마다 맛있는 칸 가운데(zone), 반폭 PERFECT_HALF,
## 그 바깥 NORMAL_HALF 까지는 보통, 더 벗어나면 이상한.
const NEEDLE_SEC := 1.6
const PERFECT_HALF := 0.07
const NORMAL_HALF := 0.2

## 다시 자라는 시간(초, 실제 시각).
const RESPAWN_SEC := {"common": 1800.0, "special": 3600.0}

## 채집물 — 이름은 growth.gd ITEMS 에도 있다(가방 표시). kind = common·special.
const GATHER := {
	"mint": {"name": "박하", "kind": "common", "color": Color(0.36, 0.78, 0.42)},
	"honey_flower": {"name": "꿀꽃", "kind": "common", "color": Color(0.98, 0.78, 0.25)},
	"apple": {"name": "산사과", "kind": "common", "color": Color(0.86, 0.2, 0.18)},
	"mushroom": {"name": "송이버섯", "kind": "common", "color": Color(0.62, 0.42, 0.26)},
	"clam": {"name": "바지락", "kind": "common", "color": Color(0.86, 0.8, 0.66)},
	"orchid": {"name": "청하란", "kind": "special", "color": Color(0.72, 0.86, 1.0)},
	"conch": {"name": "갯소라", "kind": "special", "color": Color(1.0, 0.62, 0.52)},
	"ash_flower": {"name": "재꽃", "kind": "special", "color": Color(0.8, 0.74, 0.9)},
	"snow_bloom": {"name": "눈꽃", "kind": "special", "color": Color(0.55, 0.8, 1.0)}, # 흰 눈 위에서 보이게 하늘빛
}
const MEAT := "meat" # 짐승 고기 — 채집이 아니라 들판 적(growth.gd KILL_DROPS)

## 지역 특산물 — 인물 돌파에 쓴다(growth.gd ASCEND_COST "special").
const SPECIALTY_OF_REGION := {"village": "orchid", "coast": "conch", "ruins": "ash_flower", "frost": "snow_bloom"}
## 인물 해시 풀(growth.gd SPECIALTIES 와 같은 차례) — 고원 눈꽃은 해시 밖(growth.gd SPECIALTY_OF).
const SPECIALTIES := ["orchid", "conch", "ash_flower"]

## 채집 무리 — [무리 id, 채집물, 지역, 칸(소수), 개수]. 한 무리의 채집물은 가운데에서 1.4m 둘레에 고르게 놓인다.
## 사건·상자·순간이동 지점 칸 한가운데는 피했다(칸 48m, 가운데 = 정수).
const PATCHES := [
	["v_mint_w", "mint", "village", Vector2(0.6, 4.4), 3],
	["v_mint_e", "mint", "village", Vector2(9.6, 3.6), 3],
	["v_honey_s", "honey_flower", "village", Vector2(3.3, 6.3), 3],
	["v_honey_n", "honey_flower", "village", Vector2(3.35, 4.4), 2],
	["v_apple_w", "apple", "village", Vector2(1.5, 2.4), 2],
	["v_apple_s", "apple", "village", Vector2(2.2, 9.0), 2],
	["v_mush", "mushroom", "village", Vector2(4.4, 3.0), 3],
	["v_orchid_fall", "orchid", "village", Vector2(8.3, 3.4), 2],
	["v_orchid_shrine", "orchid", "village", Vector2(2.0, 1.4), 2],
	["v_orchid_field", "orchid", "village", Vector2(8.6, 9.3), 2],
	["c_clam_w", "clam", "coast", Vector2(2.3, 4.0), 3],
	["c_clam_e", "clam", "coast", Vector2(6.8, 4.1), 3],
	["c_conch_w", "conch", "coast", Vector2(1.5, 3.8), 2],
	["c_conch_e", "conch", "coast", Vector2(5.6, 3.8), 2],
	["c_conch_s", "conch", "coast", Vector2(3.5, 7.2), 2],
	["c_mint", "mint", "coast", Vector2(7.3, 6.3), 2],
	["c_honey", "honey_flower", "coast", Vector2(0.6, 5.0), 2],
	["r_mush", "mushroom", "ruins", Vector2(4.2, 4.3), 3],
	["r_apple", "apple", "ruins", Vector2(2.0, 4.3), 2],
	["r_honey", "honey_flower", "ruins", Vector2(1.3, 1.4), 2],
	["r_mint", "mint", "ruins", Vector2(3.0, 5.3), 2],
	["r_ash_ne", "ash_flower", "ruins", Vector2(5.4, 1.5), 2],
	["r_ash_w", "ash_flower", "ruins", Vector2(1.4, 3.0), 2],
	["f_mush", "mushroom", "frost", Vector2(1.3, 3.4), 3],
	["f_mint", "mint", "frost", Vector2(6.2, 6.3), 2],
	["f_apple", "apple", "frost", Vector2(1.4, 6.3), 2],
	## 106장 ㊻-3 고원 특산물 눈꽃 — 석상·호수 서쪽 · 산성과 봉화 사이 · 위성 조각 남쪽(비행선 북쪽).
	["f_snow_nw", "snow_bloom", "frost", Vector2(2.3, 2.3), 2],
	["f_snow_mid", "snow_bloom", "frost", Vector2(4.2, 3.4), 2],
	["f_snow_e", "snow_bloom", "frost", Vector2(6.4, 4.2), 2],
	## 106장 ㊽ 은하 나루 — 있는 채집물만(특산물은 인물 돌파 재료와 묶여 사용자와).
	["s_mush", "mushroom", "skyport", Vector2(1.3, 1.5), 3],
	["s_mint", "mint", "skyport", Vector2(7.2, 5.5), 2],
	["s_apple", "apple", "skyport", Vector2(1.6, 6.2), 2],
	["s_honey", "honey_flower", "skyport", Vector2(3.6, 2.3), 2],
	## 106장 ㊾ 틈새 갈림길 — 있는 채집물만.
	["x_mush", "mushroom", "crossing", Vector2(1.3, 1.8), 3],
	["x_mint", "mint", "crossing", Vector2(6.4, 2.6), 2],
	["x_apple", "apple", "crossing", Vector2(1.3, 4.3), 2],
	["x_honey", "honey_flower", "crossing", Vector2(6.2, 7.1), 2],
	## 106장 ㊿ 잠긴 도읍 — 있는 채집물만(바다 것 위주).
	["u_clam_w", "clam", "sunken", Vector2(1.4, 3.0), 3],
	["u_conch", "conch", "sunken", Vector2(5.6, 2.8), 2],
	["u_mint", "mint", "sunken", Vector2(6.6, 1.5), 2],
	["u_clam_isle", "clam", "sunken", Vector2(6.85, 7.15), 2],
	["r_ash_se", "ash_flower", "ruins", Vector2(4.8, 5.5), 2],
]
const PATCH_RING_M := 1.4

## 요리 — effect: heal(먹은 인물 비율+고정) · heal_all(명단 전체 비율) · revive(쓰러진 인물 비율) · buff(계열·옵션).
## 값은 품질 [이상한, 보통, 맛있는]. zone = 맛있는 칸 가운데(0~1).
const RECIPES := {
	"honey_cake": {"name": "꿀꽃 떡", "effect": "heal", "ratio": [0.14, 0.2, 0.26], "flat": [40.0, 60.0, 80.0],
		"ing": {"honey_flower": 2, "apple": 1}, "zone": 0.62},
	"mush_skewer": {"name": "버섯 꼬치", "effect": "heal_all", "ratio": [0.06, 0.09, 0.12],
		"ing": {"mushroom": 2, "mint": 1}, "zone": 0.45},
	"meat_stew": {"name": "고기 찜", "effect": "revive", "ratio": [0.1, 0.15, 0.2],
		"ing": {"meat": 2, "apple": 1}, "zone": 0.7},
	"mint_stirfry": {"name": "박하 고기볶음", "effect": "buff", "cat": "attack", "stat": "atk", "value": [12.0, 18.0, 24.0],
		"ing": {"meat": 1, "mint": 2}, "zone": 0.55},
	"orchid_tea": {"name": "청하란 차", "effect": "buff", "cat": "attack", "stat": "crit_rate", "value": [0.05, 0.08, 0.1],
		"ing": {"orchid": 1, "honey_flower": 2}, "zone": 0.38},
	"ash_pancake": {"name": "재꽃 버섯전", "effect": "buff", "cat": "attack", "stat": "crit_dmg", "value": [0.1, 0.15, 0.2],
		"ing": {"ash_flower": 1, "mushroom": 2}, "zone": 0.5},
	"clam_soup": {"name": "바지락탕", "effect": "buff", "cat": "defense", "stat": "def", "value": [10.0, 15.0, 20.0],
		"ing": {"clam": 2, "mint": 1}, "zone": 0.66},
	"conch_grill": {"name": "갯소라 구이", "effect": "buff", "cat": "adventure", "stat": "stamina_save", "value": [0.12, 0.18, 0.24],
		"ing": {"conch": 1, "clam": 1}, "zone": 0.42},
}
const RECIPE_ORDER := ["honey_cake", "mush_skewer", "meat_stew", "mint_stirfry", "orchid_tea", "ash_pancake", "clam_soup", "conch_grill"]
const CAT_NAMES := {"attack": "공격", "defense": "방어", "adventure": "모험"}
const STAT_NAMES := {"atk": "공격력", "def": "방어력", "crit_rate": "치명타 확률", "crit_dmg": "치명타 피해", "stamina_save": "스태미나 소모 감소"}

static func now() -> float:
	return Time.get_unix_time_from_system() + time_offset

## 점검이 시계를 앞으로 돌릴 때(다시 자라기).
static var time_offset := 0.0

static func respawn_sec(item: String) -> float:
	return RESPAWN_SEC[GATHER[item].kind]

static func is_special(item: String) -> bool:
	return GATHER.has(item) and GATHER[item].kind == "special"

## 가방 칸 이름 — "dish_<요리>_<품질 0~2>".
static func dish_id(recipe: String, q: int) -> String:
	return "dish_%s_%d" % [recipe, clampi(q, 0, QUALITY_COUNT - 1)]

static func dish_name(recipe: String, q: int) -> String:
	return "%s %s" % [QUALITY_NAMES[clampi(q, 0, QUALITY_COUNT - 1)], RECIPES[recipe].name]

## 바늘 자리(0~1) → 품질.
static func quality_at(recipe: String, needle: float) -> int:
	var d := absf(needle - float(RECIPES[recipe].zone))
	if d <= PERFECT_HALF:
		return 2
	if d <= NORMAL_HALF:
		return 1
	return 0

## t 초 뒤 바늘 자리(0→1→0 왕복).
static func needle_at(t: float) -> float:
	var p := fposmod(t, NEEDLE_SEC) / NEEDLE_SEC * 2.0
	return p if p <= 1.0 else 2.0 - p

## 요리 효과 한 줄(품질 q).
static func effect_text(recipe: String, q: int) -> String:
	var r: Dictionary = RECIPES[recipe]
	match String(r.effect):
		"heal":
			return "고른 인물 체력 %d%%+%d 회복" % [roundi(r.ratio[q] * 100.0), int(r.flat[q])]
		"heal_all":
			return "명단 모두 체력 %d%% 회복" % roundi(r.ratio[q] * 100.0)
		"revive":
			return "쓰러진 인물을 체력 %d%% 로 되살림" % roundi(r.ratio[q] * 100.0)
		_:
			var v: float = r.value[q]
			var shown := ("%d%%" % roundi(v * 100.0)) if v < 1.0 else ("%d" % int(v))
			return "%s 계열 · 명단 전체 %s +%s · %d초" % [CAT_NAMES[r.cat], STAT_NAMES[r.stat], shown, int(BUFF_SEC)]

static func uses_fullness(recipe: String) -> bool:
	return String(RECIPES[recipe].effect) != "buff"

## 무리 안 k 번째 채집물 자리(땅 높이는 부르는 쪽이 얹는다) — 가운데 둘레 고른 각.
static func node_offset(k: int, n: int) -> Vector3:
	if n <= 1:
		return Vector3.ZERO
	var a := TAU * float(k) / float(n) + 0.6
	return Vector3(cos(a), 0.0, sin(a)) * PATCH_RING_M
