class_name ForestTurnip
extends RefCounted

## VERTICAL_SLICE_FOREST.md 4절 "제외" 목록 5번 — 순무 시세(카부). 웹판
## js/turnip.js 조사 결과: "원작에서 유일하게 값이 오르내리는 축"이라고
## 스스로 적어 둔 시스템이라, 공식·문턱을 상수 하나 안 바꾸고 그대로
## 옮긴다(duel_rules.gd·world_curve.gdshaderinc와 같은 "새로 설계하지
## 않는다" 원칙).
##
## 산다 — 일요일 오전에만 장이 선다, 그 주 살 값은 90~110.
## 판다 — 월~토, 오전/오후로 하루 두 번 값이 바뀐다.
## 썩는다 — 다음 일요일이 오면 썩어서 개당 ROT_PRICE(10)로만 팔린다.
## 시세는 그 주 번호를 씨앗으로 한 결정적 해시라 같은 주면 늘 같다
## (웹판 core.hash2와 같은 정신 — 이 파일은 그 알고리즘의 Godot판 포트,
## 값 자체가 JS와 똑같이 나올 필요는 없다, 이 프로젝트 안에서만 결정적
## 이면 된다).
##
## 이 스크립트는 **순수 계산**만 한다(날짜/시세 공식) — 가진 순무 수·
## 산 값·골드 같은 실제 상태는 games/saga_forest/data/forest_save_state.gd
## 가 들고 있다(사고팔기 트랜잭션도 거기서 처리) — 계산과 상태를 분리해
## 둔 GO의 TimeOfDay.gd/season.gd와 같은 경계.

const Workshop := preload("res://games/saga_forest/data/forest_workshop.gd")   # G-0218 솜씨도
const BASE := 100
const UNIT := 10
const MAX_BUY := 900
const ROT_PRICE := 10
const PATTERNS := ["파동", "내림", "급등", "폭등"]

## 오전인가 — 시세가 하루 두 번 바뀌는 기준(웹판 half()와 같이 실제
## 벽시계 시각을 본다). 루트 CLAUDE.md "시각에 기대는 축은 진단에서
## 붙들어 둔다"와 같은 이유로 force를 둔다.
static var _forced_morning: Variant = null

static func force_morning(is_morning: Variant) -> void:
	_forced_morning = is_morning


static func is_morning() -> bool:
	if _forced_morning != null:
		return _forced_morning
	return int(Time.get_time_dict_from_system()["hour"]) < Workshop.morning_end()   # G-0218 새벽형 — 14시까지


static func half() -> int:
	return 0 if is_morning() else 1


## 웹판 core.hash2(x, y)의 Godot 포트 — 정수 두 개에서 결정적으로 0~1을
## 뽑는다. forest_vegetation_builder.gd의 _hash()(salt 셋 XOR)와는 인자
## 개수·조합 방식이 달라 따로 뒀다(순무 공식이 원래 2-인자 hash2를 쓴다).
static func _hash2(x: int, y: int) -> float:
	var h: int = (x * 374761393 + y * 668265263) & 0xFFFFFFFF
	h = ((h ^ (h >> 13)) * 1274126177) & 0xFFFFFFFF
	h = h ^ (h >> 16)
	return float(h & 0x7fffffff) / float(0x7fffffff)


## 1970-01-01(Unix epoch)이 목요일이라 (날짜+4)%7이 요일이 된다(0=일요일).
static func dow(day: int = -1) -> int:
	var d: int = ForestDay.epoch_day_index() if day < 0 else day
	return ((d + 4) % 7 + 7) % 7


static func week(day: int = -1) -> int:
	var d: int = ForestDay.epoch_day_index() if day < 0 else day
	return int(floor(float(d + 4) / 7.0))


static func market_open() -> bool:
	return dow() == 0 and is_morning()


## 그 주의 살 값(일요일에 정해진다) — 90~110.
static func buy_price(w: int = -1) -> int:
	var k: int = week() if w < 0 else w
	return 90 + int(floor(_hash2(k * 31 + 5, k % 887 + 11) * 21))


static func pattern(w: int = -1) -> int:
	var k: int = week() if w < 0 else w
	return int(floor(_hash2(k * 7 + 3, k % 613 + 29) * PATTERNS.size())) % PATTERNS.size()


## 파는 값. d(1~6, 월~토)·h(0 오전/1 오후) — 일요일(d=0)은 장이 안 서니 0.
static func sell_price(w: int = -1, d: int = -1, h: int = -1) -> int:
	var k: int = week() if w < 0 else w
	var dd: int = dow() if d < 0 else d
	var hh: int = half() if h < 0 else h
	if dd == 0:
		return 0

	var i: int = (dd - 1) * 2 + hh  # 0=월요일 오전 … 11=토요일 오후
	var pat: int = pattern(k)
	var n: float = _hash2(k * 101 + i * 13, k % 379 + i)
	var v: float

	if pat == 0:  # 파동 — 0.8~1.4 사이를 오르내린다
		v = 0.80 + n * 0.60
	elif pat == 1:  # 내림 — 월요일부터 계속 떨어진다
		v = 0.92 - i * 0.05 + n * 0.05
	elif pat == 2:  # 급등 — 한중간에 한 번 크게 오른다
		var at2: int = 4 + int(floor(_hash2(k, k * 3 + 1) * 4))
		if i == at2:
			v = 1.5 + n * 0.7
		elif i == at2 + 1:
			v = 1.3 + n * 0.5
		else:
			v = 0.55 + n * 0.25
	else:  # 폭등 — 후반에 서너 배까지 뛴다
		var at3: int = 6 + int(floor(_hash2(k * 5, k + 7) * 4))
		if i == at3:
			v = 3.0 + n * 3.0
		elif i == at3 - 1:
			v = 1.2 + n * 0.6
		else:
			v = 0.45 + n * 0.25

	return maxi(15, int(round(BASE * v)))
