extends SceneTree

## G-0267 1만리 날씨 손잡이 자동 점검 —
##   godot --headless --path saga-godot --script res://tools/probe_go_weather.gd   → "PROBE go_weather OK" / "FAIL n"
## 씬은 안 싣는다. SAGA_WEATHER 를 clear·fog·rain·0·zzz 로 바꿔 가며 Weather 캐시를 비우고 current_key() 를 본다:
##   clear·fog·rain → 그 키 · 0·zzz → 실제 시각 키(key_at) · force("snow") 는 env 보다 앞섬 · exp_bonus_mul() clear 1.10.
## 환경변수는 이 과정 안에서만 바꾸고 끝에 되돌린다.

const WeatherGd := preload("res://games/saga_go/data/weather.gd")

var fails := 0


func _fail(msg: String) -> void:
	fails += 1
	print("GO_WEATHER FAIL ", msg)


func _key_with(env: String) -> String:
	OS.set_environment("SAGA_WEATHER", env)
	WeatherGd._env_read = false
	return WeatherGd.current_key()


func _init() -> void:
	var old := OS.get_environment("SAGA_WEATHER")
	WeatherGd.force("")
	var real := WeatherGd.key_at(int(Time.get_unix_time_from_system() * 1000.0))
	for k in ["clear", "fog", "rain"]:
		var got := _key_with(k)
		print("GO_WEATHER env=%s key=%s" % [k, got])
		if got != k:
			_fail("env=%s → %s" % [k, got])
	for k in ["0", "zzz", ""]:
		var got := _key_with(k)
		print("GO_WEATHER env='%s' key=%s (시각 %s)" % [k, got, real])
		if got != real:
			_fail("env='%s' → %s, 시각 키 %s 여야" % [k, got, real])
	_key_with("clear")
	WeatherGd.force("snow")
	if WeatherGd.current_key() != "snow":
		_fail("force(snow) 가 env 보다 앞서야 — %s" % WeatherGd.current_key())
	WeatherGd.force("")
	if absf(WeatherGd.exp_bonus_mul() - 1.10) > 0.0001:
		_fail("clear exp_bonus_mul %.3f" % WeatherGd.exp_bonus_mul())
	OS.set_environment("SAGA_WEATHER", old)
	WeatherGd._env_read = false
	print("PROBE go_weather %s" % ("OK" if fails == 0 else "FAIL %d" % fails))
	quit(0 if fails == 0 else 1)
