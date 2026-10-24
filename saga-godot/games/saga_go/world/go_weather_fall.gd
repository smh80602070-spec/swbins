extends "res://saga_core/world/weather_visual.gd"

## G-0349 — 1만리 비·눈 입자. 날씨 키·안개·하늘은 1만리 것(weather.gd·season_weather_visual·sky_panorama)이 그대로 맡고,
## 여기선 공용 weather_visual 의 입자(Rainfall/Snowfall — 카메라 앞 위 상자)만 빌린다. 키는 Weather.current_key()
## (SAGA_WEATHER·force 그대로). season_weather_visual 이 _ready 에서 단다(씬 안 고침), SAGA_WEATHER=0 이면 안 단다.
## 서리봉 고원(region4_frost)은 그 지역 안에서만 늘 눈이 오니 — 거기 눈이 내리는 동안은 이 눈을 숨긴다(두 겹 방지).
## G-0359 땅 젖음은 공용 weather_visual(_wet_tick·wet_step·terrain_mats — G-0360 에서 옮김)이 그대로 한다.


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
	if _snow and _snow.emitting:
		var fr := get_tree().get_first_node_in_group("go_frost_region")
		var own: CPUParticles3D = fr.get("_snow") if fr else null
		_snow.visible = not (own != null and own.emitting)
