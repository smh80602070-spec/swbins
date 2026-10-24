extends SceneTree

## G-0267 1만리 날씨 손잡이 자동 점검 —
##   godot --headless --path saga-godot --script res://tools/probe_go_weather.gd   → "PROBE go_weather OK" / "FAIL n"
## 씬은 안 싣는다. SAGA_WEATHER 를 clear·fog·rain·0·zzz 로 바꿔 가며 Weather 캐시를 비우고 current_key() 를 본다:
##   clear·fog·rain → 그 키 · 0·zzz → 실제 시각 키(key_at) · force("snow") 는 env 보다 앞섬 · exp_bonus_mul() clear 1.10.
##   G-0349 go_weather_fall: force(rain) → Rainfall 내림 · snow → Snowfall(비 멈춤) · clear → 둘 다 멈춤.
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
	var fall: Node = (load("res://games/saga_go/world/go_weather_fall.gd") as GDScript).new()
	root.add_child(fall)
	await process_frame   # _init 안에선 root 에 바로 안 붙는다(뷰포트가 있어야 입자 상자를 세운다)
	var seen := []
	for k in ["rain", "snow", "clear"]:
		WeatherGd.force(k)
		fall.call("refresh_now")
		var r: CPUParticles3D = fall.get("_rain")
		var s: CPUParticles3D = fall.get("_snow")
		seen.append("%s:%s%s" % [k, "비" if r and r.emitting else "", "눈" if s and s.emitting else ""])
	print("GO_WEATHER fall ", seen)
	if seen != ["rain:비", "snow:눈", "clear:"]:
		_fail("G-0349 입자 %s" % [seen])
	var FallGd: GDScript = load("res://games/saga_go/world/go_weather_fall.gd")
	var w1 := float(FallGd.call("wet_step", 0.0, true, 10.0))
	var w2 := float(FallGd.call("wet_step", 1.0, false, 30.0))
	var w3 := float(FallGd.call("wet_step", 0.9, true, 10.0))
	print("GO_WEATHER wet 비10초 %.2f · 그침30초 %.2f · 꽉 참 %.2f" % [w1, w2, w3])
	if absf(w1 - 0.5) > 0.01 or absf(w2 - 0.5) > 0.01 or w3 != 1.0:
		_fail("G-0359 젖음 셈 %.2f·%.2f·%.2f" % [w1, w2, w3])
	WeatherGd.force("rain")
	var fall2: Node = FallGd.new()
	root.add_child(fall2)
	await process_frame
	if float(fall2.get("wet")) != 1.0:
		_fail("G-0359 비 오는 중 들어오면 이미 젖음 — wet %.2f" % float(fall2.get("wet")))
	fall2.free()
	fall.free()
	WeatherGd.force("")
	if absf(WeatherGd.exp_bonus_mul() - 1.10) > 0.0001:
		_fail("clear exp_bonus_mul %.3f" % WeatherGd.exp_bonus_mul())
	OS.set_environment("SAGA_WEATHER", old)
	WeatherGd._env_read = false
	print("PROBE go_weather %s" % ("OK" if fails == 0 else "FAIL %d" % fails))
	quit(0 if fails == 0 else 1)
