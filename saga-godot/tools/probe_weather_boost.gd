extends SceneTree

## G-0408 1만리 날씨 부스트 자동 점검 —
##   godot --headless --path saga-godot --script res://tools/probe_weather_boost.gd   → "PROBE weather_boost OK" / "FAIL n"
## ① 날씨 여섯마다 BOOST 원소는 ×1.2, 나머지·물리("")는 ×1 · 모든 날씨에 부스트 원소가 하나 이상
## ② 맑음 = 화·초, 비 = 수·뇌 (포켓몬GO 맑음 불·풀 / 비 물·전기 문법)
## ③ 날씨 줄(SeasonWeatherVisual.summary)에 "⬆" + 원소 이름 · SAGA_WEATHER_BOOST=0 이면 부스트·⬆ 없음
## 헤드리스 기본 끔(진단은 시각 의존 축을 붙든다) · =1 켬. 저장 안 함. 날씨는 force 로 붙들고 끝에 풀어 둔다.

const ORDER := ["fire", "water", "thunder", "wind", "ice", "rock", "grass"]

var fails := 0


func _fail(msg: String) -> void:
	fails += 1
	print("  FAIL ", msg)


func _init() -> void:
	await process_frame
	OS.set_environment("SAGA_WEATHER_BOOST", "1")   # 헤드리스는 기본 끔
	var W: GDScript = load("res://games/saga_go/data/weather.gd")
	var V: GDScript = load("res://games/saga_go/world/season_weather_visual.gd")
	for k: String in W.ORDER:
		W.force(k)
		var up: Array = W.BOOST.get(k, [])
		if up.is_empty():
			_fail("① %s 부스트 원소 없음" % k)
		for el: String in ORDER:
			var want := 1.2 if up.has(el) else 1.0
			if not is_equal_approx(W.boost_mul(el), want):
				_fail("① %s %s ×%.2f (기대 %.2f)" % [k, el, W.boost_mul(el), want])
		if not is_equal_approx(W.boost_mul(""), 1.0):
			_fail("① %s 물리 부스트" % k)
		var line: String = V.summary()
		print("WX %s → %s" % [k, line])
		if not line.contains("⬆"):
			_fail("③ %s 날씨 줄에 ⬆ 없음" % k)
	W.force("clear")
	if not (W.boosted("fire") and W.boosted("grass") and not W.boosted("water")):
		_fail("② 맑음")
	W.force("rain")
	if not (W.boosted("water") and W.boosted("thunder") and not W.boosted("fire")):
		_fail("② 비")
	OS.set_environment("SAGA_WEATHER_BOOST", "0")
	if W.boosted("water") or String(V.summary()).contains("⬆"):
		_fail("③ 끔 손잡이")
	OS.set_environment("SAGA_WEATHER_BOOST", "1")
	if not W.boosted("water"):
		_fail("③ =1 켬")
	OS.set_environment("SAGA_WEATHER_BOOST", "")
	if W.boosted("water"):
		_fail("③ 헤드리스 기본 끔")
	W.force("")
	print("PROBE weather_boost ", "OK" if fails == 0 else "FAIL %d" % fails)
	quit(1 if fails > 0 else 0)
