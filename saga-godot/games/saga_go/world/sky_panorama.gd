extends Node

## G-0026 — K-0034 하늘 파노라마 12장(`assets/sky/sky_<새벽·낮·노을·밤>_<과거·현대·미래>.webp`)을 실제 시계 시각과 지역 시대에 맞춰
## 하늘 셰이더(`sky_toon.gdshader`)에 입힌다. 키 시각 사이는 두 장을 섞는다. 파일이 없으면 아무것도 안 해 툰 하늘 그대로.
## 반사 맵은 하늘 uniform 이 바뀔 때마다 다시 굽는다 — 섞기 값을 1/MIX_STEPS 단계로 CHECK_SEC 마다만 갱신한다.
## 해·달 방향으로 조명을 돌리지는 않는다(후속). test_village.gd 가 단다.

const TestMap := preload("res://games/saga_go/data/test_map.gd")

const CHECK_SEC := 5.0
const MIX_STEPS := 20.0
const SKY_DIR := "res://assets/sky/"
## 키 시각(시) → 하늘. 밤은 TimeOfDay.is_night(21~4시)와 같은 경계. 양끝(1.5 이전·23 이후)은 밤 그대로.
const KEYS := [[1.5, "night"], [6.0, "dawn"], [12.0, "noon"], [18.5, "sunset"], [23.0, "night"]]
## 지역 → 하늘 시대(past 과거·present 현대·future 미래). 취향대로 여기서 고친다.
const REGION_ERA := {
	"village": "past", "coast": "present", "ruins": "past", "frost": "future", "skyport": "future",
	"crossing": "present", "sunken": "past", "amber": "present", "vault": "future", "fork": "present",
}

var _sky: ShaderMaterial
var _player: Node3D
var _check := 0.0
var _slots := ["", ""]
var _cache := {}
var _mobile := false


## 순수 함수 — 시각(시, 0~24) → [앞 하늘 이름, 뒤 하늘 이름, 섞기 0~1(1/MIX_STEPS 단계)].
static func slots_for(hour: float) -> Array:
	var h := fposmod(hour, 24.0)
	if h <= float(KEYS[0][0]) or h >= float(KEYS[KEYS.size() - 1][0]):
		return ["night", "night", 0.0]
	for i in KEYS.size() - 1:
		var a: Array = KEYS[i]
		var b: Array = KEYS[i + 1]
		if h >= float(a[0]) and h <= float(b[0]):
			var t := (h - float(a[0])) / (float(b[0]) - float(a[0]))
			return [String(a[1]), String(b[1]), snappedf(t, 1.0 / MIX_STEPS)]
	return ["noon", "noon", 0.0]


static func era_of(region_id: String) -> String:
	return String(REGION_ERA.get(region_id, "past"))


static func sky_path(slot: String, era: String, mobile: bool) -> String:
	return "%ssky_%s_%s%s.webp" % [SKY_DIR, slot, era, "_1k" if mobile else ""]


func _ready() -> void:
	add_to_group("go_sky_panorama")
	var scene := get_parent()
	var we := scene.get_node_or_null("WorldEnvironment") as WorldEnvironment
	var env := we.environment if we else null
	if env and env.sky and env.sky.sky_material is ShaderMaterial:
		_sky = env.sky.sky_material
	_mobile = RenderingServer.get_current_rendering_method() == "mobile"
	if _sky == null or not ResourceLoader.exists(sky_path("noon", "past", _mobile)):
		set_process(false)
		return
	refresh_now()


func _process(delta: float) -> void:
	_check -= delta
	if _check <= 0.0:
		_check = CHECK_SEC
		refresh_now()


func refresh_now() -> void:
	if _sky == null:
		return
	if _player == null:
		_player = get_tree().get_first_node_in_group("player") as Node3D
	var region := TestMap.region_at(_player.global_position) if _player else "village"
	var era := era_of(region)
	var s := slots_for(TimeOfDay.hour_float())
	var a := _tex(String(s[0]), era)
	var b := _tex(String(s[1]), era)
	if a == null or b == null:
		_sky.set_shader_parameter("pano_on", 0.0)
		return
	var key := "%s/%s/%s" % [s[0], s[1], era]
	if key != _slots[0]:
		_slots[0] = key
		_sky.set_shader_parameter("pano_a", a)
		_sky.set_shader_parameter("pano_b", b)
	_sky.set_shader_parameter("pano_on", 1.0)
	_sky.set_shader_parameter("pano_mix", float(s[2]))


func _tex(slot: String, era: String) -> Texture2D:
	var p := sky_path(slot, era, _mobile)
	if not _cache.has(p):
		_cache[p] = load(p) as Texture2D if ResourceLoader.exists(p) else null
	return _cache[p]
