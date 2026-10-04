extends Node

## G-0026 — K-0034 하늘 파노라마 12장(`assets/sky/sky_<새벽·낮·노을·밤>_<과거·현대·미래>.webp`)을 실제 시계 시각과 지역 시대에 맞춰
## 하늘 셰이더(`sky_toon.gdshader`)에 입힌다. 키 시각 사이는 두 장을 섞는다. 파일이 없으면 아무것도 안 해 툰 하늘 그대로.
## 반사 맵은 하늘 uniform 이 바뀔 때마다 다시 굽는다 — 섞기 값을 1/MIX_STEPS 단계로 CHECK_SEC 마다만 갱신한다.
## G-0027 — 파노라마 속 해·달 위치(`sky_markers.json` 의 sun_az·sun_el, 밤은 달 값)로 `Sun` 방향을 돌려 그림자가 따라가게 한다(SAGA_SKY_LIGHT=0 이면 안 함).
## test_village.gd 가 단다.

const TestMap := preload("res://games/saga_go/data/test_map.gd")

const CHECK_SEC := 5.0
const MIX_STEPS := 20.0
const SKY_DIR := "res://assets/sky/"
## G-0027 — 햇빛 고도 하한(도). 표식의 4~8° 해는 그림자가 땅에 붙고 땅이 너무 어두워(10° 로 해 보니 풀밭이 어둡다) 22° 로.
const SUN_MIN_EL := 22.0
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
var _sun: DirectionalLight3D
var _markers := {}
var _follow := true


## 순수 함수 — 방위각(0=북 −Z·90=동 +X)·고도(도) → 해(달) 쪽 단위 벡터.
static func dir_from(az_deg: float, el_deg: float) -> Vector3:
	var az := deg_to_rad(az_deg)
	var el := deg_to_rad(el_deg)
	return Vector3(sin(az) * cos(el), sin(el), -cos(az) * cos(el))


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
	_sun = scene.get_node_or_null("Sun") as DirectionalLight3D
	_follow = OS.get_environment("SAGA_SKY_LIGHT") != "0"
	var mp := SKY_DIR + "sky_markers.json"
	if FileAccess.file_exists(mp):
		var j: Variant = JSON.parse_string(FileAccess.get_file_as_string(mp))
		if j is Dictionary and (j as Dictionary).has("skies"):
			_markers = (j as Dictionary).skies
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
	_follow_sun(String(s[0]), String(s[1]), era, float(s[2]))


## G-0027 — 두 하늘의 해(달) 방향을 구면 보간해 `Sun` 을 돌린다. 표식·Sun 이 없으면 아무것도 안 한다.
func _follow_sun(a: String, b: String, era: String, mix: float) -> void:
	if not _follow or _sun == null or _markers.is_empty():
		return
	var ma: Variant = _markers.get("%s_%s" % [a, era])
	var mb: Variant = _markers.get("%s_%s" % [b, era])
	if not (ma is Dictionary) or not (mb is Dictionary):
		return
	var da := dir_from(float(ma.sun_az), maxf(float(ma.sun_el), SUN_MIN_EL))
	var db := dir_from(float(mb.sun_az), maxf(float(mb.sun_el), SUN_MIN_EL))
	var d := da.slerp(db, mix) if da.dot(db) < 0.9999 else da
	_sun.global_transform = Transform3D(Basis.looking_at(-d.normalized(), Vector3.UP), _sun.global_position)


func _tex(slot: String, era: String) -> Texture2D:
	var p := sky_path(slot, era, _mobile)
	if not _cache.has(p):
		_cache[p] = load(p) as Texture2D if ResourceLoader.exists(p) else null
	return _cache[p]
