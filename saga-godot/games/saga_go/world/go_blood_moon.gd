extends Node

## G-0379 1만리 핏빛 달 밤(젤다 야숨 블러드문 — 구조만). 밤(TimeOfDay — 실제 시각 21~4시) 중 몇몇 밤은 달이 붉다:
##   어느 밤  그 밤의 날짜(새벽 4시 전이면 전날)를 해시 — CHANCE(다섯 밤에 하나 꼴), 같은 밤은 늘 같음(is_blood_night 순수)
##   떠오름   밤이 붉어지는 순간 한 번 — 쓰러진 들판 무리가 RISE_SEC 뒤 모두 되살아난다(보스 group go_boss 는 꽃 받기 규칙 그대로 둠)
##   덤       붉은 밤 동안 들판 적 처치 육성 재료 ×LOOT_MUL(field_enemy._die 가 loot_mul 을 곱함)
##   그림     화면 전체에 옅은 붉은 막(CanvasLayer — 렌더러 상관없음) + 처음에 토스트 한 줄
## test_village 가 붙인다. SAGA_BLOOD_MOON=0 이면 안 붙음 · SAGA_BLOOD_MOON=1 이면 밤이면 늘 붉음(촬영·점검).

const Toast := preload("res://saga_core/ui/toast.gd")

const CHANCE := 0.2
const RISE_SEC := 1.0
const LOOT_MUL := 2
const TINT := Color(0.55, 0.0, 0.05, 0.13)
const CHECK_SEC := 2.0

static var active := false

var _t := 0.0
var _layer: CanvasLayer = null
var _veil: ColorRect = null
var risen := 0   # 점검용 — 되살린 적 수


static func enabled() -> bool:
	return OS.get_environment("SAGA_BLOOD_MOON") != "0"


static func loot_mul() -> int:
	return LOOT_MUL if active else 1


## 그 밤 날짜(1970-01-01 부터 며칠째)가 붉은 밤인가(순수).
static func is_blood_night(night_day: int) -> bool:
	if OS.get_environment("SAGA_BLOOD_MOON") == "1":
		return true
	var h := ("blood:%d" % night_day).md5_text().substr(0, 6).hex_to_int()   # hash() 아래 자리는 고르지 않아(55%%) md5 앞자리
	return float(h) / float(0xFFFFFF) < CHANCE


## 지금 밤의 날짜 — 새벽(4시 전)이면 전날 밤.
static func night_day_now() -> int:
	var unix := int(Time.get_unix_time_from_system()) + int(Time.get_time_zone_from_system().bias) * 60
	var day := unix / 86400
	return day - 1 if TimeOfDay.hour_float() < 4.0 else day


static func attach(parent: Node) -> Node:
	if not enabled():
		return null
	var n := new()
	n.name = "BloodMoon"
	parent.add_child(n)
	return n


func _ready() -> void:
	_layer = CanvasLayer.new()
	_layer.layer = -1
	add_child(_layer)
	_veil = ColorRect.new()
	_veil.color = TINT
	_veil.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_veil.set_anchors_preset(Control.PRESET_FULL_RECT)
	_veil.visible = false
	_layer.add_child(_veil)
	active = false


func _exit_tree() -> void:
	active = false


func _process(delta: float) -> void:
	_t -= delta
	if _t > 0.0:
		return
	_t = CHECK_SEC
	set_blood(TimeOfDay.is_night() and is_blood_night(night_day_now()))


## 붉은 밤 켜고 끔(점검도 부른다) — 켜지는 순간 쓰러진 무리를 되살린다.
func set_blood(on: bool) -> void:
	if on == active:
		return
	active = on
	_veil.visible = on
	if on:
		risen = 0
		var dead_ai: int = int(((load("res://games/saga_go/combat/field_enemy.gd") as GDScript).get_script_constant_map()["AI"] as Dictionary)["DEAD"])   # 런타임 load — field_enemy 가 이 파일을 preload 해 맞물림 피함
		for e in get_tree().get_nodes_in_group("field_enemy"):
			if e.is_in_group("go_boss") or not e.has_method("hold_respawn"):
				continue
			if int(e.get("ai")) == dead_ai:
				e.call("hold_respawn", RISE_SEC)
				risen += 1
		Toast.show(self, "🌕 핏빛 달이 떴다 — 쓰러진 무리가 되살아난다 · 오늘 밤 전리품 ×%d" % LOOT_MUL, 4.0)
	else:
		Toast.show(self, "🌕 붉은 달이 졌다", 2.5)
