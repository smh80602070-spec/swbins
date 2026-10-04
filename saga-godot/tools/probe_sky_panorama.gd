extends SceneTree
## G-0026 하늘 파노라마 자동 점검 —
##   godot --headless --path saga-godot --script res://tools/probe_sky_panorama.gd   → "PROBE sky_panorama OK" / "FAIL n"
## ① 시각 → 두 장·섞기 순수 함수(밤 21~4 경계 포함) ② 4시간대 × 3시대 × (2k·1k) 파일이 열린다 ③ 지역→시대 표가 지역을 다 덮는다
## 파일이 없는 PC(assets/sky 없음)는 ②를 건너뛴다.

const SkyPanorama := preload("res://games/saga_go/world/sky_panorama.gd")
const TestMap := preload("res://games/saga_go/data/test_map.gd")

var fails := 0


func _fail(msg: String) -> void:
	fails += 1
	print("  FAIL ", msg)


func _expect(hour: float, a: String, b: String, mix: float) -> void:
	var s := SkyPanorama.slots_for(hour)
	if s[0] != a or s[1] != b or absf(float(s[2]) - mix) > 0.001:
		_fail("① %.2f시 → %s 기대 [%s,%s,%.2f]" % [hour, str(s), a, b, mix])


func _init() -> void:
	_expect(0.0, "night", "night", 0.0)
	_expect(1.5, "night", "night", 0.0)
	_expect(3.75, "night", "dawn", 0.5)
	_expect(6.0, "night", "dawn", 1.0)
	_expect(9.0, "dawn", "noon", 0.5)
	_expect(12.0, "dawn", "noon", 1.0)
	_expect(18.5, "noon", "sunset", 1.0)
	_expect(23.0, "night", "night", 0.0)
	_expect(25.0, "night", "night", 0.0)   # 하루를 넘겨도 같은 값(1시)
	if ResourceLoader.exists(SkyPanorama.sky_path("noon", "past", false)):
		for slot in ["dawn", "noon", "sunset", "night"]:
			for era in ["past", "present", "future"]:
				for mobile in [false, true]:
					var p := SkyPanorama.sky_path(slot, era, mobile)
					var t := load(p) as Texture2D
					if t == null:
						_fail("② 안 열림 " + p)
					elif t.get_width() < 512 or t.get_width() != t.get_height() * 2:
						_fail("② 2:1 이 아님 %s %dx%d" % [p, t.get_width(), t.get_height()])
	for r in ["village", "coast", "ruins", "frost", "skyport", "crossing", "sunken", "amber", "vault", "fork"]:
		if not SkyPanorama.REGION_ERA.has(r):
			_fail("③ 지역→시대 표에 없음 " + r)
	print("PROBE sky_panorama ", "OK" if fails == 0 else "FAIL %d" % fails)
	quit(1 if fails > 0 else 0)
