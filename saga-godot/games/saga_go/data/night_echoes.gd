extends RefCounted

## PLAN 106장 52-5 — 결말 뒤 "밤의 잔불"(시나리오 8부 "결말 뒤 여는 것: 모든 지역 밤 사건"). 진행은 world/night_echoes.gd.
##   1차 결말(29장)을 마친 뒤, 밤(TimeOfDay.is_night — 실제 시각 21~4시)에만 지역마다 먹구름 잔불 하나가 핀다.
##   START_M 안에 들어서면 잔당이 서고(되살아나지 않음·전리품 없음·세계 등급), 다 쓰러뜨리면 그 지역 이야기 인물의 한 줄 + REWARD.
##   지역마다 하루에 한 번(commissions.gd today — 새벽 4시에 넘어간다). 멀리(LEAVE_M) 떠나거나 낮이 되면 잔당은 걷히고 다음에 처음부터.
##   자리는 그 지역 이야기 kill 칸(잔당이 이미 서 본 자리 — 명소에 안 묻힌다).
## 세이브 PartyState.night_echo = {"day": 날 번호, "done": [id…]}(없으면 빈 사전 — 필드만 더해 SAVE_VERSION 그대로).
## 이름·대사는 이 판 것.

const AFTER_CH := 29 # 이 장(0부터 센 수)에 닿은 뒤 — 29 = 8부 29장을 마친 뒤
const START_M := 14.0
const LEAVE_M := 60.0
const SPREAD := 4.5
const REWARD := {"mora": 20000, "talent_2": 1}

## [id, region, 칸, 이름, 잔당 kind, 말하는 이, 한 줄]
const ECHOES := [
	["village", "village", Vector2(7.2, 9.2), "남쪽 들녘의 잔불", ["bandit", "bandit", "wind_hawk"],
		"누리", "밤에도 매듭 불이 꺼지지 않는구나. 마을 아이들이 그 불빛으로 별을 센단다."],
	["coast", "coast", Vector2(5.6, 4.3), "밤 물가의 잔불", ["water_turtle", "bandit", "thunder_cat"],
		"버들", "밤바다에 먹구름 부스러기가 떠다니더니, 네가 쓸어 냈구나. 오늘은 그물이 가볍겠다."],
	["ruins", "ruins", Vector2(2.0, 1.0), "폐허 어귀의 잔불", ["thunder_cat", "bandit", "grass_snake"],
		"은비", "비문 뒷면에 새 줄이 또 생겼어. 밤마다 한 글자씩 — 누가 적는 걸까?"],
	["frost", "frost", Vector2(3.7, 2.45), "얼어붙은 호수의 잔불", ["ice_fox", "ice_fox", "wind_hawk"],
		"하람", "밤 관측 끝! 잔불이 꺼지니 기압계 바늘이 춤을 추네요."],
	["skyport", "skyport", Vector2(3.5, 6.0), "옛 절터 비탈의 잔불", ["thunder_cat", "fire_imp", "rock_bear"],
		"아라", "나루 등불이 다시 또렷해졌어요. 오늘 밤 별배 길은 맑음이에요."],
	["crossing", "crossing", Vector2(5.0, 4.5), "갈림길의 잔불", ["ice_fox", "fire_imp", "wind_hawk"],
		"한별", "틈 너머에도 잔불이 남아 있었군. 밤 항해가 한결 편하겠네."],
	["sunken", "sunken", Vector2(6.0, 2.55), "잠긴 도읍 모래밭의 잔불", ["water_turtle", "water_turtle", "wind_hawk"],
		"여울", "물 밑 불빛이 다시 맑아졌어요. 오늘 밤 잠수는 안심이네요."],
]

static func row(id: String) -> Array:
	for r in ECHOES:
		if String(r[0]) == id:
			return r
	return []

static func unlocked() -> bool:
	return int(PartyState.story.get("ch", 0)) >= AFTER_CH

## 오늘 이미 끈 잔불들(날이 바뀌었으면 비운다).
static func done_today() -> Array:
	var d := preload("res://games/saga_go/data/commissions.gd").today()
	if int(PartyState.night_echo.get("day", -1)) != d:
		PartyState.night_echo = {"day": d, "done": []}
	return PartyState.night_echo.done

static func mark_done(id: String) -> void:
	var done := done_today()
	if not done.has(id):
		done.append(id)

## 지금 그 잔불이 피어 있는가 — 결말 뒤·밤·오늘 아직 안 끔.
static func active(id: String) -> bool:
	return unlocked() and TimeOfDay.is_night() and not done_today().has(id)
