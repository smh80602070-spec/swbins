extends SceneTree
## G-0026 하늘 파노라마 자동 점검 —
##   godot --headless --path saga-godot --script res://tools/probe_sky_panorama.gd   → "PROBE sky_panorama OK" / "FAIL n"
## ④ 방위각·고도→방향·표식 12개에 해 방향 있음 ① 시각 → 두 장·섞기 순수 함수(밤 21~4 경계 포함) ② 4시간대 × 3시대 × (2k·1k) 파일이 열린다 ③ 지역→시대 표가 지역을 다 덮는다
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
	## ④ G-0027 방위각·고도 → 방향(북 −Z·동 +X·위 +Y)
	for t in [[0.0, 0.0, Vector3(0, 0, -1)], [90.0, 0.0, Vector3(1, 0, 0)], [180.0, 0.0, Vector3(0, 0, 1)], [270.0, 0.0, Vector3(-1, 0, 0)], [123.0, 90.0, Vector3(0, 1, 0)]]:
		var v := SkyPanorama.dir_from(float(t[0]), float(t[1]))
		if not v.is_equal_approx(t[2] as Vector3):
			_fail("④ 방향 az=%s el=%s → %s 기대 %s" % [t[0], t[1], str(v), str(t[2])])
	var mp := "res://assets/sky/sky_markers.json"
	if FileAccess.file_exists(mp):
		var j: Variant = JSON.parse_string(FileAccess.get_file_as_string(mp))
		var sk: Dictionary = (j as Dictionary).skies if j is Dictionary else {}
		for slot in ["dawn", "noon", "sunset", "night"]:
			for era in ["past", "present", "future"]:
				var m: Variant = sk.get("%s_%s" % [slot, era])
				if not (m is Dictionary) or not (m as Dictionary).has("sun_az") or not (m as Dictionary).has("sun_el"):
					_fail("④ 표식에 해 방향 없음 %s_%s" % [slot, era])
	for r in ["village", "coast", "ruins", "frost", "skyport", "crossing", "sunken", "amber", "vault", "fork"]:
		if not SkyPanorama.REGION_ERA.has(r):
			_fail("③ 지역→시대 표에 없음 " + r)
	print("PROBE sky_panorama ", "OK" if fails == 0 else "FAIL %d" % fails)
	quit(1 if fails > 0 else 0)
