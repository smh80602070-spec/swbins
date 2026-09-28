extends Node

## saga-godot 2026-09-28 "그래픽 먼저" — GO 밤 화면. 밤낮(time_of_day.gd, 실제 시계 21~4시)은 NPC 대사·동물·산적만 바꾸고
## 하늘·해는 늘 낮이었다. 밤이면 원신처럼: 해 → 약한 푸른 달빛, 하늘 → 짙은 남색 + 별, 구름·안개 → 어둡게,
## 집 창·길가 등롱 → 따뜻한 불(house_builder.gd 공유 재질). 바뀔 때 FADE_SEC 에 걸쳐 섞는다.
## 값은 낮 값(시작 때 잰다)에서 NIGHT 쪽으로 섞기만 한다 — env_*.tres·씬 파일은 안 건드린다.
## test_village.gd 가 단다. tools/probe_shots.gd 의 "night" 할 일이 refresh_now() 로 곧바로 바꾼다.

const HouseBuilder := preload("res://games/saga_go/world/house_builder.gd")

const CHECK_SEC := 2.0
const FADE_SEC := 3.0
const NIGHT := {
	"sun_mul": 0.28,
	"sun_color": Color(0.62, 0.72, 1.0),
	"ambient_mul": 0.8,        # 하늘이 어두워져 하늘빛 주변광은 절로 준다. 1.35 는 풀밭이 한밤에도 쨍한 초록이었다(09-28 촬영)
	"saturation": 0.85,        # 낮 1.22 — 밤빛은 색이 빠져 푸르게
	"top": Color(0.03, 0.07, 0.19),
	"horizon": Color(0.13, 0.19, 0.36),
	"cloud": Color(0.3, 0.35, 0.5),
	"cloud_shade": Color(0.13, 0.15, 0.26),
	"fog_mul": Color(0.2, 0.25, 0.4),
}

var _sun: DirectionalLight3D
var _env: Environment
var _sky: ShaderMaterial
var _weather: Node
var _day := {}
var _target := 0.0
var _blend := -1.0
var _check := 0.0


func _ready() -> void:
	add_to_group("go_night_visual")
	var scene := get_parent()
	_sun = scene.get_node_or_null("Sun") as DirectionalLight3D
	var we := scene.get_node_or_null("WorldEnvironment") as WorldEnvironment
	_env = we.environment if we else null
	if _env and _env.sky and _env.sky.sky_material is ShaderMaterial:
		_sky = _env.sky.sky_material
	_weather = scene.get_node_or_null("SeasonWeatherVisual")
	if _sun:
		_day["sun"] = _sun.light_energy
		_day["sun_color"] = _sun.light_color
	if _env:
		_day["ambient"] = _env.ambient_light_energy
		_day["sat"] = _env.adjustment_saturation
	if _sky:
		## 재질에 따로 안 넣은 값은 null 로 온다 — sky_toon.gdshader 기본값.
		var defaults := {"top_color": Color(0.24, 0.5, 0.9), "horizon_color": Color(0.76, 0.88, 0.96),
			"cloud_color": Color(1, 1, 1), "cloud_shade": Color(0.7, 0.76, 0.88)}
		for k in defaults:
			var v = _sky.get_shader_parameter(k)
			_day[k] = v if v is Color else (Color(v.x, v.y, v.z) if v is Vector3 else defaults[k])
	refresh_now()


func _process(delta: float) -> void:
	_check -= delta
	if _check <= 0.0:
		_check = CHECK_SEC
		_target = 1.0 if TimeOfDay.is_night() else 0.0
	if _blend != _target:
		_apply(move_toward(_blend, _target, delta / FADE_SEC))


## 밤낮을 지금 곧바로 맞춘다(시작·촬영 도구).
func refresh_now() -> void:
	_target = 1.0 if TimeOfDay.is_night() else 0.0
	_apply(_target)


func is_night_shown() -> bool:
	return _blend >= 0.5


func _apply(b: float) -> void:
	_blend = b
	if _sun and _day.has("sun"):
		_sun.light_energy = lerpf(_day.sun, _day.sun * NIGHT.sun_mul, b)
		_sun.light_color = (_day.sun_color as Color).lerp(NIGHT.sun_color, b)
	if _env and _day.has("ambient"):
		_env.ambient_light_energy = lerpf(_day.ambient, _day.ambient * NIGHT.ambient_mul, b)
		_env.adjustment_saturation = lerpf(_day.sat, NIGHT.saturation, b)
	if _sky and _day.has("top_color"):
		_sky.set_shader_parameter("top_color", (_day.top_color as Color).lerp(NIGHT.top, b))
		_sky.set_shader_parameter("horizon_color", (_day.horizon_color as Color).lerp(NIGHT.horizon, b))
		_sky.set_shader_parameter("cloud_color", (_day.cloud_color as Color).lerp(NIGHT.cloud, b))
		_sky.set_shader_parameter("cloud_shade", (_day.cloud_shade as Color).lerp(NIGHT.cloud_shade, b))
		_sky.set_shader_parameter("stars", b)
	if _weather:
		_weather.set("night_mul", Color(1, 1, 1).lerp(NIGHT.fog_mul, b))
		_weather.call("apply")
	HouseBuilder.set_night(b)
