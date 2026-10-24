extends SceneTree

## G-0367 날씨 소리 자동 점검(오디오 장치 없이 표본을 직접 만든다) —
##   godot --headless --path saga-godot --script res://tools/probe_weather_sound.gd   → "PROBE weather_sound OK" / "FAIL n"
## ① level_of: 비 [1, 0.25] · 바람 [0, 1] · 눈 [0, 0.35] · 맑음 [0, 0]
## ② 1초씩 만든 표본: 비·바람 다 소리 있음(RMS > 0.03) · 맑음은 0 · 비는 바람보다 영점 교차가 세 배 넘게 잦다(쏴아 ↔ 웅웅)

const WeatherSound := preload("res://saga_core/audio/weather_sound.gd")

var fails := 0


func _fail(msg: String) -> void:
	fails += 1
	print("  FAIL ", msg)


func _stats(rain: float, wind: float) -> Vector2:
	var s: Node = WeatherSound.new()
	s.set("rain", rain)
	s.set("wind", wind)
	var n := int(WeatherSound.MIX_RATE)
	var ss := 0.0
	var zc := 0
	var prev := 0.0
	for i in n:
		var v := float(s.call("sample"))
		ss += v * v
		if (v >= 0.0) != (prev >= 0.0):
			zc += 1
		prev = v
	s.free()
	return Vector2(sqrt(ss / float(n)), float(zc))


func _init() -> void:
	var lv := [WeatherSound.level_of("rain"), WeatherSound.level_of("wind"), WeatherSound.level_of("snow"), WeatherSound.level_of("clear")]
	if lv != [[1.0, 0.25], [0.0, 1.0], [0.0, 0.35], [0.0, 0.0]]:
		_fail("① level_of %s" % [lv])
	var r := _stats(1.0, 0.0)
	var w := _stats(0.0, 1.0)
	var c := _stats(0.0, 0.0)
	print("WEATHER_SOUND 비 rms %.3f zc %d · 바람 rms %.3f zc %d · 맑음 rms %.3f" % [r.x, int(r.y), w.x, int(w.y), c.x])
	if r.x < 0.03 or w.x < 0.03 or c.x != 0.0 or r.y < w.y * 3.0:
		_fail("② 표본 비 %s 바람 %s 맑음 %s" % [r, w, c])
	print("PROBE weather_sound ", "OK" if fails == 0 else "FAIL %d" % fails)
	quit(1 if fails > 0 else 0)
