class_name Weather
extends RefCounted

## saga-go 웹판 js/weather.js를 옮긴다. 실제 기상 정보 대신 **세 시간마다
## 바뀌는 결정론적 천후** — 같은 시각이면 어느 기기에서나 같다(TimeOfDay와
## 같은 "시각의 순수 함수" 원칙). season.gd의 wx 표가 확률을 기울인다.
##
## 웹판은 포획 확률·신수 출현·인물 스폰 편향까지 건드리지만, 이 판엔 그
## 자리(무작위 스폰·포획·신수) 자체가 없다(고정 배치 사건뿐) — 그래서 그
## 필드는 옮기지 않았다. 대신 이 판에 실제로 있는 두 자리만 잇는다:
## **exp_pct**(사건 보상 경험치, party_state.gd::add_exp가 곱해 쓴다)와
## **fog_density_mul/tint**(환경 분위기, season_weather_visual.gd가 읽는다).

static var _forced: String = ""
## G-0267 — 진단·촬영 손잡이 SAGA_WEATHER=<키>(세 판 weather_visual.gd 와 같은 이름). 한 번만 읽어 둔다.
##   KINDS 에 없는 값("0"·빈칸·모르는 키)은 실제 시각 — 1만리엔 "날씨 안 닮" 이 없다. force() 가 이것보다 앞선다.
static var _env_read := false
static var _env_key: String = ""

const SPAN_MS := 3 * 60 * 60 * 1000

const KINDS := {
	"clear": {
		"name": "맑음", "emoji": "☀️", "exp_pct": 10.0,
		"fog_density_mul": 0.6, "tint": Color(1.05, 1.03, 0.95),
	},
	"cloud": {
		"name": "흐림", "emoji": "☁️", "exp_pct": 5.0,
		"fog_density_mul": 1.0, "tint": Color(0.95, 0.96, 1.0),
	},
	"rain": {
		"name": "비", "emoji": "🌧️", "exp_pct": 0.0,
		"fog_density_mul": 1.6, "tint": Color(0.85, 0.9, 1.0),
	},
	"wind": {
		"name": "바람", "emoji": "🌬️", "exp_pct": 8.0,
		"fog_density_mul": 0.8, "tint": Color(1.0, 1.0, 1.0),
	},
	"fog": {
		"name": "안개", "emoji": "🌫️", "exp_pct": 4.0,
		"fog_density_mul": 2.4, "tint": Color(0.9, 0.9, 0.92),
	},
	"snow": {
		"name": "눈", "emoji": "❄️", "exp_pct": 12.0,
		"fog_density_mul": 1.2, "tint": Color(1.02, 1.02, 1.08),
	},
}

const ORDER := ["clear", "cloud", "rain", "wind", "fog", "snow"]


static func force(key: String) -> void:
	_forced = key if KINDS.has(key) else ""


## vegetation_builder.gd::_hash()와 같은 정신(정수 입력 → 결정적 0~1) —
## 여긴 좌표 대신 3시간 슬롯 번호가 입력이다.
static func _hash01(slot: int) -> float:
	var h := (slot * 374761393) ^ 987654321
	h = (h ^ (h >> 13)) * 1274126177
	h = h ^ (h >> 16)
	return float(h & 0x7fffffff) / float(0x7fffffff)


static func key_at(unix_ms: int) -> String:
	var slot: int = int(unix_ms / SPAN_MS)
	var h: float = _hash01(slot)
	var weights: Array[float] = []
	var total := 0.0
	for k in ORDER:
		var w: float = max(0.0, Season.weather_weight(k))
		weights.append(w)
		total += w
	if total <= 0.0:
		return ORDER[0]
	var x: float = h * total
	for i in range(ORDER.size()):
		x -= weights[i]
		if x <= 0.0:
			return ORDER[i]
	return ORDER[ORDER.size() - 1]


static func current_key() -> String:
	if _forced != "":
		return _forced
	if not _env_read:
		_env_read = true
		var k := OS.get_environment("SAGA_WEATHER")
		_env_key = k if KINDS.has(k) else ""
	if _env_key != "":
		return _env_key
	return key_at(int(Time.get_unix_time_from_system() * 1000.0))


static func current() -> Dictionary:
	return KINDS[current_key()]


## G-0408 날씨 부스트(포켓몬GO — 그 날씨에 맞는 속성 기술이 세짐) — 명단 공격 피해만(field_combat _dmg_bonus 가 곱함), 적 공격은 그대로.
const BOOST := {"clear": ["fire", "grass"], "cloud": ["rock"], "rain": ["water", "thunder"], "wind": ["wind"], "fog": ["rock", "wind"], "snow": ["ice"]}
const BOOST_MUL := 1.2


## 손잡이 SAGA_WEATHER_BOOST=0 끔 · 헤드리스(점검)는 시각 의존 축이라 기본 끔, =1 이면 켬(probe_weather_boost).
static func boost_on() -> bool:
	var e := OS.get_environment("SAGA_WEATHER_BOOST")
	return e == "1" or (e != "0" and DisplayServer.get_name() != "headless")


static func boosted(element: String) -> bool:
	return element != "" and boost_on() and (BOOST.get(current_key(), []) as Array).has(element)


static func boost_mul(element: String) -> float:
	return BOOST_MUL if boosted(element) else 1.0


## party_state.gd::add_exp()가 곱해 쓴다 — 사건 보상 경험치만 탄다
## (걷기·시간 경과로는 애초에 exp가 안 붙으니 손댈 자리가 없다).
static func exp_bonus_mul() -> float:
	return 1.0 + float(current()["exp_pct"]) / 100.0
