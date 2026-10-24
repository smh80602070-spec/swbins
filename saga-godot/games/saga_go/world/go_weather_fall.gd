extends "res://saga_core/world/weather_visual.gd"

## G-0349 — 1만리 비·눈 입자. 날씨 키·안개·하늘은 1만리 것(weather.gd·season_weather_visual·sky_panorama)이 그대로 맡고,
## 여기선 공용 weather_visual 의 입자(Rainfall/Snowfall — 카메라 앞 위 상자)만 빌린다. 키는 Weather.current_key()
## (SAGA_WEATHER·force 그대로). season_weather_visual 이 _ready 에서 단다(씬 안 고침), SAGA_WEATHER=0 이면 안 단다.
## 서리봉 고원(region4_frost)은 그 지역 안에서만 늘 눈이 오니 — 거기 눈이 내리는 동안은 이 눈을 숨긴다(두 겹 방지).
## G-0359 땅 젖음 — 비가 오면 땅 재질(terrain_triplanar 의 wet)을 WET_IN 초에 걸쳐 1 로, 그치면 WET_OUT 초에 걸쳐 0 으로.
## 땅 재질은 씬에서 그 셰이더를 쓰는 material_override 를 모은다(지역이 나중에 지어지니 WET_SCAN 초마다 다시). SAGA_WET=0 이면 안 적심.

const TERRAIN_SHADER := "res://saga_core/shaders/terrain_triplanar.gdshader"
const WET_IN := 20.0
const WET_OUT := 60.0
const WET_SCAN := 5.0

var wet := 0.0
var _wet_mats: Array[ShaderMaterial] = []
var _wet_scan := 0.0
var _wet_sent := -1.0


## 그 셰이더를 쓰는 땅 재질들(씬 전체 — 지역 빌더가 만든 것)
static func terrain_mats(root: Node) -> Array[ShaderMaterial]:
	var out: Array[ShaderMaterial] = []
	if root == null:
		return out
	for n in root.find_children("*", "GeometryInstance3D", true, false):
		var m := (n as GeometryInstance3D).material_override as ShaderMaterial
		if m != null and m.shader != null and m.shader.resource_path == TERRAIN_SHADER and not out.has(m):
			out.append(m)
	return out


## 젖음 한 걸음(순수) — 비면 WET_IN 초에 1 까지, 아니면 WET_OUT 초에 0 까지
static func wet_step(w: float, raining: bool, dt: float) -> float:
	return minf(1.0, w + dt / WET_IN) if raining else maxf(0.0, w - dt / WET_OUT)


## 공용 _ready 는 세 판 그룹(saga_weather_visual)에 들고 WorldEnvironment 를 잡는다 — 1만리는 입자만이라 둘 다 안 한다.
func _ready() -> void:
	refresh_now()
	wet = 1.0 if key == "rain" else 0.0   # G-0359 들어올 때 이미 비면 땅도 이미 젖어 있다


func key_now() -> String:
	return Weather.current_key()


func refresh_now() -> void:
	_check = CHECK_SEC
	key = key_now()
	last["key"] = key
	_set_fall(key)


func _process(delta: float) -> void:
	super(delta)
	if OS.get_environment("SAGA_WET") != "0":
		wet = wet_step(wet, key == "rain", delta)
		_wet_scan -= delta
		if _wet_scan <= 0.0:
			_wet_scan = WET_SCAN
			_wet_mats = terrain_mats(get_tree().current_scene)
			_wet_sent = -1.0
		if absf(wet - _wet_sent) > 0.01:
			_wet_sent = wet
			for m in _wet_mats:
				m.set_shader_parameter("wet", wet)
	if _snow and _snow.emitting:
		var fr := get_tree().get_first_node_in_group("go_frost_region")
		var own: CPUParticles3D = fr.get("_snow") if fr else null
		_snow.visible = not (own != null and own.emitting)
