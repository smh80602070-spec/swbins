extends RefCounted

## PLAN 106장 ㊷ — 원신식 낚시 규칙(표·계산만, 진행은 world/fishing.gd, 상태는 PartyState.fishing
## {"log": {물고기: 잡은 수}, "gone": {"<낚시터>:<번호>": 잡은 시각}}).
##   낚시터 넷(마을 강 둘·포구 바다 둘) — 물고기가 FISH_PER_SPOT 마리씩 물속에서 돈다. 잡은 자리는 RESPAWN_SEC(실제 시각) 뒤 다시.
##   미끼 셋 = 채집 재료 하나씩(던질 때 하나 씀) — 물고기마다 좋아하는 미끼가 하나라 다른 미끼엔 안 온다.
##   던지기 → 미끼 둘레 BITE_RADIUS 안의 그 미끼 물고기가 다가와 몇 번 건드리고(NIBBLE_*) 문다 → BITE_WINDOW 안에 당기기
##   (건드릴 때 당기면 달아남, 놓치면 도망) → 줄다리기: 누르고 있으면 찌가 오르고 떼면 내려간다, 물고기 칸 안에 두면
##   잡는 막대가 차고 밖이면 준다 — 다 차면 잡음, 비면 놓침.
## 전체 퓨전(../SAGA-DESIGN.md §12): 물고기도 과거·현대·미래가 한 물에 — 이름·그림은 이 판 것.

const FISH_PER_SPOT := 5
const RESPAWN_SEC := 1800.0
const CAST_MIN := 4.0
const CAST_MAX := 14.0
const BITE_RADIUS := 4.0
const SWIM_SPEED := 1.2       # 물고기가 떠돌 때
const APPROACH_SPEED := 1.6   # 미끼로 다가올 때
const NIBBLE_MIN := 1
const NIBBLE_MAX := 3
const NIBBLE_GAP := [0.7, 1.3] # 건드리기 사이(초)
const BITE_WINDOW := 1.0
const WAIT_MAX := 15.0         # 이만큼 안 오면 "물고기가 오지 않는다"
const SCARE_SEC := 8.0         # 놀란 물고기는 이만큼 미끼에 안 옴

## 줄다리기 — 막대 0~1. 찌: 누르면 +PULL_ACCEL, 떼면 -PULL_ACCEL(속도 ±PULL_VMAX), 끝에 닿으면 멈춤.
const PULL_ACCEL := 2.6
const PULL_VMAX := 1.2
const PROGRESS_START := 0.3

## 미끼 — 재료 id(growth.gd ITEMS·cooking.gd GATHER).
const BAITS := {
	"honey_flower": {"name": "꿀꽃 미끼"},
	"apple": {"name": "산사과 미끼"},
	"meat": {"name": "고기 미끼"},
}
const BAIT_ORDER := ["honey_flower", "apple", "meat"]

## 물고기 — bait 좋아하는 미끼 · zone 칸 너비 · move 칸이 움직이는 빠르기(초마다 칸 가운데를 바꾸는 사이 [짧게, 길게])
## · gain/loss 칸 안·밖에서 잡는 막대 초당 · len 그림자 길이(m) · era 표시 글자.
const FISH := {
	"crucian": {"name": "은비늘 붕어", "era": "과거", "rarity": 1, "bait": "honey_flower", "zone": 0.28, "move": [1.0, 1.6], "gain": 0.34, "loss": 0.16, "len": 0.45, "color": Color(0.75, 0.78, 0.82)},
	"mandarin": {"name": "청하 쏘가리", "era": "현대", "rarity": 2, "bait": "meat", "zone": 0.22, "move": [0.7, 1.2], "gain": 0.28, "loss": 0.2, "len": 0.6, "color": Color(0.62, 0.55, 0.3)},
	"clockcarp": {"name": "태엽 잉어", "era": "미래", "rarity": 3, "bait": "apple", "zone": 0.16, "move": [0.45, 0.9], "gain": 0.24, "loss": 0.24, "len": 0.7, "color": Color(0.85, 0.7, 0.35)},
	"gizzard": {"name": "갯바람 전어", "era": "과거", "rarity": 1, "bait": "honey_flower", "zone": 0.28, "move": [0.9, 1.5], "gain": 0.34, "loss": 0.16, "len": 0.4, "color": Color(0.6, 0.72, 0.8)},
	"lanternpuffer": {"name": "등불 복어", "era": "현대", "rarity": 2, "bait": "apple", "zone": 0.22, "move": [0.7, 1.2], "gain": 0.28, "loss": 0.2, "len": 0.45, "color": Color(1.0, 0.8, 0.4)},
	"steelflounder": {"name": "강철 넙치", "era": "미래", "rarity": 2, "bait": "meat", "zone": 0.2, "move": [0.6, 1.1], "gain": 0.27, "loss": 0.21, "len": 0.75, "color": Color(0.55, 0.6, 0.7)},
	"neonhairtail": {"name": "네온 갈치", "era": "미래", "rarity": 3, "bait": "meat", "zone": 0.15, "move": [0.4, 0.8], "gain": 0.24, "loss": 0.25, "len": 1.1, "color": Color(0.4, 0.95, 1.0)},
	"moonjelly": {"name": "옛 달 해파리", "era": "과거", "rarity": 3, "bait": "apple", "zone": 0.17, "move": [0.5, 0.9], "gain": 0.25, "loss": 0.24, "len": 0.5, "color": Color(0.85, 0.8, 1.0)},
}
const FISH_ORDER := ["crucian", "mandarin", "clockcarp", "gizzard", "lanternpuffer", "steelflounder", "neonhairtail", "moonjelly"]

## 낚시터 — stand = 서는 칸(물가 땅), cast = 물고기가 도는 물 가운데 칸(칸 48m — 물가에서 0.1~0.2칸, 서는 자리에서 CAST_MAX 안), fish = 그 물의 물고기 FISH_PER_SPOT 마리.
const SPOTS := {
	"v_river_w": {"name": "강가 서쪽 낚시터", "region": "village", "stand": Vector2(3.4, 6.42), "cast": Vector2(3.4, 6.62),
		"fish": ["crucian", "crucian", "mandarin", "mandarin", "clockcarp"]},
	"v_river_e": {"name": "강가 동쪽 낚시터", "region": "village", "stand": Vector2(7.3, 6.42), "cast": Vector2(7.3, 6.62),
		"fish": ["crucian", "crucian", "crucian", "mandarin", "clockcarp"]},
	"c_dock": {"name": "선착장 곁 낚시터", "region": "coast", "stand": Vector2(5.0, 3.62), "cast": Vector2(5.0, 3.36),   # G-0139 3.42 → 3.36(물가 비탈이 생겨 3.42 는 수심 0.27m)
		"fish": ["gizzard", "gizzard", "lanternpuffer", "steelflounder", "neonhairtail"]},
	"c_shore_w": {"name": "서쪽 갯가 낚시터", "region": "coast", "stand": Vector2(2.0, 3.62), "cast": Vector2(2.0, 3.36),   # G-0139 같은 까닭
		"fish": ["gizzard", "lanternpuffer", "lanternpuffer", "steelflounder", "moonjelly"]},
}
const SPOT_ORDER := ["v_river_w", "v_river_e", "c_dock", "c_shore_w"]
const STAND_RADIUS := 3.0

## 잡을 때 경험(부대) — 등급마다.
const CATCH_EXP := [0.0, 2.0, 4.0, 8.0]

## 낚시 조합(포구 선착장 곁 게시판) — 물고기를 바꾼다. cost = {물고기: 수}, give = 가방 칸, weapon = 무기(처음엔 얻고 뒤엔 재련).
const BOARD_CELL := Vector2(4.5, 3.8)
const EXCHANGE := [
	{"id": "catch_spear", "name": "갯바람 작살(★4 장병기)", "cost": {"gizzard": 6, "lanternpuffer": 3, "steelflounder": 2}, "weapon": "w_polearm_catch"},
	{"id": "mora", "name": "냥 3000", "cost": {"crucian": 3}, "give": {"mora": 3000}},
	{"id": "mora_sea", "name": "냥 3000", "cost": {"gizzard": 3}, "give": {"mora": 3000}},
	{"id": "book", "name": "견문록 2", "cost": {"mandarin": 2}, "give": {"book_m": 2}},
	{"id": "ore", "name": "정련 강화석 1", "cost": {"clockcarp": 1}, "give": {"ore_l": 1}},
	{"id": "knot", "name": "인연 매듭 1", "cost": {"neonhairtail": 1, "moonjelly": 1}, "give": {"fate_knot": 1}},
]

static func item_id(fish: String) -> String:
	return "fish_" + fish

static func fish(id: String) -> Dictionary:
	return FISH.get(id, {})

static func spot(id: String) -> Dictionary:
	return SPOTS.get(id, {})

static func likes(fish_id: String, bait: String) -> bool:
	return String(fish(fish_id).get("bait", "")) == bait

static func stars(fish_id: String) -> String:
	return "★".repeat(int(fish(fish_id).get("rarity", 1)))
