extends SceneTree

## G-0251 날씨 자동 점검 —
##   godot --headless --path saga-godot --script res://tools/probe_weather_visual.gd   → "PROBE weather_visual OK" / "FAIL n"
## 세 판 대표 씬(3마을 TestVillageForest·5천하 TestCity·4종횡 SinyaField)을 SAGA_HOUR=12·SAGA_WEATHER=clear/rain/snow/fog 로 싣고 본다:
##   clear → 비·눈 입자 없음 · rain → fog_density ≥ clear×2·cloud_cover 0.9·"Rainfall"·Sun 세기 < 맑음 · snow → "Snowfall" · fog → 밀도 ≥ clear×4
##   SAGA_WEATHER=0 → 노드 없음·안개 밀도·Sun 이 씬 파일 값 그대로 · GO 씬은 _real_sky_scene 밖.
## 순수 함수 key_at: 같은 3시간 슬롯 같은 키 · 7월 눈 0 · 1월엔 눈이 나온다. 환경변수는 끝에 되돌린다.

const WV := preload("res://saga_core/world/weather_visual.gd")
const EnvProfile := preload("res://saga_core/world/environment_profile.gd")
const SETTLE := 8
const SCENES := {
	"FOREST": "res://games/saga_forest/world/TestVillageForest.tscn",
	"REALM": "res://games/saga_realm/world/TestCity.tscn",
	"STORY": "res://games/saga_story/world/SinyaField.tscn",
}
const GO_SCENE := "res://games/saga_go/world/TestVillage.tscn"

var fails := 0


func _fail(msg: String) -> void:
	fails += 1
	print("  FAIL ", msg)


func _file_vals(path: String) -> Dictionary:
	var s := (load(path) as PackedScene).instantiate()
	var d := {}
	var sun := s.get_node_or_null("Sun") as DirectionalLight3D
	if sun:
		d["sun"] = sun.light_energy
	var we := s.get_node_or_null("WorldEnvironment") as WorldEnvironment
	if we and we.environment:
		d["fog"] = we.environment.fog_density
	s.free()
	return d


func _load(path: String) -> Node:
	var scene := (load(path) as PackedScene).instantiate()
	root.add_child(scene)
	current_scene = scene
	for _i in SETTLE:
		await process_frame
	return scene


func _unload(scene: Node) -> void:
	scene.queue_free()
	await process_frame
	await process_frame


func _vals(scene: Node) -> Dictionary:
	var d := {"fog": -1.0, "cloud": -1.0, "sun": -1.0, "top": -1.0, "glow": -1.0}
	var we := scene.get_node_or_null("WorldEnvironment") as WorldEnvironment
	if we and we.environment:
		d.fog = we.environment.fog_density
		if we.environment.sky and we.environment.sky.sky_material is ShaderMaterial:
			var c = (we.environment.sky.sky_material as ShaderMaterial).get_shader_parameter("cloud_cover")
			d.cloud = float(c) if c != null else -1.0
			var sm := we.environment.sky.sky_material as ShaderMaterial
			var tc = sm.get_shader_parameter("top_color")
			var tcc: Color = tc if tc is Color else (Color(tc.x, tc.y, tc.z) if tc is Vector3 else Color(0.13, 0.33, 0.76))
			d.top = tcc.r + tcc.g + tcc.b
			var g = sm.get_shader_parameter("sun_strength")
			d.glow = float(g) if g != null else 6.0
	var sun := scene.get_node_or_null("Sun") as DirectionalLight3D
	if sun:
		d.sun = sun.light_energy
	return d


func _fall(wv: Node, n: String) -> bool:
	var p := wv.get_node_or_null(n) as CPUParticles3D
	return p != null and p.emitting


func _init() -> void:
	_run.call_deferred()


func _run() -> void:
	var old_hour := OS.get_environment("SAGA_HOUR")
	var old_w := OS.get_environment("SAGA_WEATHER")
	var old_dl := OS.get_environment("SAGA_DAY_LIGHT")
	# 순수 함수
	var t0 := 1_790_000_000_000 - (1_790_000_000_000 % WV.SPAN_MS)
	for i in 50:
		var t := t0 + i * WV.SPAN_MS
		if WV.key_at(t, 7) != WV.key_at(t + WV.SPAN_MS - 1, 7):
			_fail("같은 슬롯 다른 키 (slot %d)" % i)
			break
	var winter_snow := 0
	for i in 2000:
		if WV.key_at(t0 + i * WV.SPAN_MS, 7) == "snow":
			_fail("7월 눈 (slot %d)" % i)
			break
		if WV.key_at(t0 + i * WV.SPAN_MS, 1) == "snow":
			winter_snow += 1
	if winter_snow == 0:
		_fail("1월인데 눈이 한 번도 없음")
	print("WEATHER key_at ok 1월 눈 %d/2000" % winter_snow)
	OS.set_environment("SAGA_HOUR", "12")
	OS.set_environment("SAGA_DAY_LIGHT", "1")
	for label in SCENES:
		var path: String = SCENES[label]
		var file := _file_vals(path)
		var clear := {}
		for w in ["clear", "rain", "snow", "fog"]:
			OS.set_environment("SAGA_WEATHER", w)
			var scene: Node = await _load(path)
			var wv := scene.get_node_or_null("WeatherVisual")
			if wv == null:
				_fail("%s %s WeatherVisual 노드 없음" % [label, w])
				await _unload(scene)
				continue
			var v := _vals(scene)
			var info := "fog=%.4f cloud=%.2f sun=%.2f top=%.3f glow=%.2f" % [v.fog, v.cloud, v.sun, v.top, v.glow]
			var bad: Array[String] = []
			if String(wv.key) != w:
				bad.append("key=%s" % wv.key)
			if w == "clear":
				clear = v
				if _fall(wv, "Rainfall") or _fall(wv, "Snowfall"):
					bad.append("맑은데 입자")
			if w == "rain":
				if not float(v.fog) >= float(clear.get("fog", 1e9)) * 2.0:
					bad.append("안개 밀도 < 맑음×2")
				if not is_equal_approx(float(v.cloud), 0.9):
					bad.append("cloud_cover != 0.9")
				if not _fall(wv, "Rainfall"):
					bad.append("Rainfall 없음")
				if not float(v.sun) < float(clear.get("sun", -1.0)):
					bad.append("Sun 세기가 맑음보다 안 낮음")
				## G-0256 — 비면 하늘 위쪽도 어둡게·해 빛무리 거의 없음.
				if not float(v.top) < float(clear.get("top", -1.0)) * 0.75:
					bad.append("하늘 천정 밝기 ≥ 맑음×0.75")
				if not float(v.glow) < float(clear.get("glow", -1.0)) * 0.2:
					bad.append("해 빛무리 ≥ 맑음×0.2")
			if w == "snow" and not _fall(wv, "Snowfall"):
				bad.append("Snowfall 없음")
			if w == "fog" and not float(v.fog) >= float(clear.get("fog", 1e9)) * 4.0 * 0.999:
				bad.append("안개 밀도 < 맑음×4")
			if bad.is_empty():
				print("WEATHER %s %s ok %s" % [label, w, info])
			else:
				_fail("%s %s %s (%s)" % [label, w, ", ".join(bad), info])
			await _unload(scene)
		# 끄기 손잡이
		OS.set_environment("SAGA_WEATHER", "0")
		var off: Node = await _load(path)
		if off.get_node_or_null("WeatherVisual") != null:
			_fail("%s SAGA_WEATHER=0 인데 노드 있음" % label)
		var ov := _vals(off)
		if not clear.is_empty() and (not is_equal_approx(float(clear.top), float(ov.top)) or not is_equal_approx(float(clear.glow), float(ov.glow))):
			_fail("%s 맑음 하늘이 SAGA_WEATHER=0 과 다름 (top %.3f/%.3f glow %.2f/%.2f)" % [label, clear.top, ov.top, clear.glow, ov.glow])
		if not is_equal_approx(float(ov.fog), float(file.get("fog", -2.0))) or not is_equal_approx(float(ov.sun), float(file.get("sun", -2.0))):
			_fail("%s SAGA_WEATHER=0 인데 씬 값과 다름 (fog %.4f/%.4f sun %.2f/%.2f)" % [label, ov.fog, file.get("fog", -1.0), ov.sun, file.get("sun", -1.0)])
		await _unload(off)
	if EnvProfile._real_sky_scene(GO_SCENE):
		_fail("GO 씬이 _real_sky_scene 에 든다 — WeatherVisual 이 붙는다")
	OS.set_environment("SAGA_HOUR", old_hour)
	OS.set_environment("SAGA_WEATHER", old_w)
	OS.set_environment("SAGA_DAY_LIGHT", old_dl)
	print("PROBE weather_visual ", "OK" if fails == 0 else "FAIL %d" % fails)
	quit(1 if fails > 0 else 0)
