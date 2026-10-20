extends SceneTree

## G-0250 시간대 빛 자동 점검 —
##   godot --headless --path saga-godot --script res://tools/probe_day_light.gd   → "PROBE day_light OK" / "FAIL n"
## 세 판 대표 씬(3마을 TestVillageForest·5천하 TestCity·4종횡 SinyaField)을 SAGA_HOUR 6/12/21 로 싣고 DayLight 노드 값을 본다:
##   6 → sky_real warm>0 · 12 → Sun 값이 씬 파일 값 그대로(기본)·warm 0·stars 0 · 21 → Sun 세기 < 낮 절반·stars>0
##   SAGA_DAY_LIGHT=0 → 노드 없음·Sun 값이 씬 파일 값 그대로 · GO 씬(TestVillage)은 _real_sky_scene 밖(노드 안 붙음).
## 순수 함수 slots_at 경계(3·4·6·12·18·21·23시)도 본다. 환경변수는 이 과정 안에서만 바꾸고 끝에 되돌린다.

const DayLight := preload("res://saga_core/world/day_light.gd")
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


func _file_sun(path: String) -> Dictionary:
	var s := (load(path) as PackedScene).instantiate()
	var sun := s.get_node_or_null("Sun") as DirectionalLight3D
	var d := {}
	if sun:
		d = {"e": sun.light_energy, "c": sun.light_color, "b": sun.transform.basis}
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


func _same_sun(sun: DirectionalLight3D, want: Dictionary) -> bool:
	return sun != null and is_equal_approx(sun.light_energy, want.e) and sun.light_color.is_equal_approx(want.c) \
		and sun.transform.basis.is_equal_approx(want.b)


func _init() -> void:
	_run.call_deferred()


func _run() -> void:
	var old_hour := OS.get_environment("SAGA_HOUR")
	var old_on := OS.get_environment("SAGA_DAY_LIGHT")
	var old_w := OS.get_environment("SAGA_WEATHER")
	OS.set_environment("SAGA_WEATHER", "0")   # G-0251 — 날씨가 해 세기·안개색을 곱하면 "12시 = 씬 값" 이 슬롯을 탄다
	# 순수 함수 경계
	var want := {3.0: "night", 4.0: "night", 6.0: "dawn", 12.0: "noon", 18.0: "sunset", 21.0: "night", 23.0: "night"}
	for h in want:
		var s := DayLight.slots_at(h)
		if s[0] != want[h] or float(s[2]) != 0.0:
			_fail("slots_at(%s) = %s" % [h, s])
	OS.set_environment("SAGA_DAY_LIGHT", "1")
	for label in SCENES:
		var path: String = SCENES[label]
		var base := _file_sun(path)
		var noon_e := float(base.get("e", 0.0))
		for hour in [6, 12, 21]:
			OS.set_environment("SAGA_HOUR", str(hour))
			var scene: Node = await _load(path)
			var dl := scene.get_node_or_null("DayLight")
			var sun := scene.get_node_or_null("Sun") as DirectionalLight3D
			if dl == null:
				_fail("%s %d시 DayLight 노드 없음" % [label, hour])
				await _unload(scene)
				continue
			var l: Dictionary = dl.last
			var info := "warm=%.2f stars=%.2f sun=%.2f" % [l.get("warm", -1.0), l.get("stars", -1.0), l.get("sun_energy", -1.0)]
			var bad: Array[String] = []
			if hour == 6 and not float(l.get("warm", 0.0)) > 0.0:
				bad.append("warm 0")
			if hour == 12:
				if not _same_sun(sun, base):
					bad.append("Sun 이 씬 값과 다름")
				if float(l.get("warm", 1.0)) != 0.0 or float(l.get("stars", 1.0)) != 0.0:
					bad.append("낮인데 warm/stars")
			if hour == 21:
				if sun == null or not sun.light_energy < noon_e * 0.5:
					bad.append("Sun 세기가 낮 절반 이상")
				if not float(l.get("stars", 0.0)) > 0.0:
					bad.append("stars 0")
			if bad.is_empty():
				print("DAY %s %d시 ok %s" % [label, hour, info])
			else:
				_fail("%s %d시 %s (%s)" % [label, hour, ", ".join(bad), info])
			await _unload(scene)
		# 끄기 손잡이
		OS.set_environment("SAGA_DAY_LIGHT", "0")
		OS.set_environment("SAGA_HOUR", "21")
		var off: Node = await _load(path)
		if off.get_node_or_null("DayLight") != null:
			_fail("%s SAGA_DAY_LIGHT=0 인데 노드 있음" % label)
		if not _same_sun(off.get_node_or_null("Sun") as DirectionalLight3D, base):
			_fail("%s SAGA_DAY_LIGHT=0 인데 Sun 값이 바뀜" % label)
		await _unload(off)
		OS.set_environment("SAGA_DAY_LIGHT", "1")
	# 1만리 씬엔 안 붙는다 — DayLight 는 _real_sky_scene 갈래에서만 단다(GO 씬을 --script 로 띄우면 GO UI 가 current_scene 을 못 찾아 오류라 표로 본다)
	if EnvProfile._real_sky_scene(GO_SCENE):
		_fail("GO 씬이 _real_sky_scene 에 든다 — DayLight 가 붙는다")
	OS.set_environment("SAGA_HOUR", old_hour)
	OS.set_environment("SAGA_DAY_LIGHT", old_on)
	OS.set_environment("SAGA_WEATHER", old_w)
	print("PROBE day_light ", "OK" if fails == 0 else "FAIL %d" % fails)
	quit(1 if fails > 0 else 0)
