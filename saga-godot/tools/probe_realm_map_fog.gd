extends SceneTree

## G-0259 5천하 지도 안개 — 지도(viewing_map)를 켜면 WorldEnvironment 가 어떤 안개로 그리는지, 끄면 원래 env 로 돌아오는지.
##   godot --headless --path saga-godot --script res://tools/probe_realm_map_fog.gd
## SAGA_WEATHER=clear·fog 두 번: TestCity 싣고 SETTLE → viewing_map=true → MAP_FRAMES → "REALM_MAP env …" 한 줄 → 끄고 원본 복귀 검사.
## 씬·env_pc.tres·세이브는 안 바꾼다(측정·검사만).

const SCENE := "res://games/saga_realm/world/TestCity.tscn"   # check_refs:allow — 5천하 대표 씬
const SETTLE := 20
const MAP_FRAMES := 40
const WEATHERS := ["clear", "fog"]
## G-0259 갈래 B(지도에선 fog_enabled=false — 안개 아닌 밉맵에 결이 녹음): 지도 땅 tile_scale 새 값.
const MAP_TILE_SCALE := 0.04

var fails := 0


func _fail(msg: String) -> void:
	fails += 1
	print("REALM_MAP FAIL %s" % msg)


func _ground_tile_scale(wm: Node) -> float:
	for m in wm.find_children("*", "MeshInstance3D", true, false):
		var sm := (m as MeshInstance3D).material_override as ShaderMaterial
		if sm == null:
			continue
		var ts = sm.get_shader_parameter("tile_scale")
		if ts != null:
			return float(ts)
	return -1.0


## G-0262 — 재질의 detile 값(설정 안 했으면 셰이더 기본값). 공용 셰이더 번짐 잡기: 지도 땅 1 · 도읍 원반·3마을 땅 0.
func _detile_of(mat: Material) -> float:
	var sm := mat as ShaderMaterial
	if sm == null or sm.shader == null:
		return -1.0
	var v = sm.get_shader_parameter("detile")
	if v == null:
		## 안 정한 값 = 셰이더 선언 기본값(더미 렌더러는 shader_get_parameter_default 가 null 이라 원문에서 읽는다).
		var rx := RegEx.create_from_string("uniform float detile[^=;]*= *([0-9.]+)")
		var mt := rx.search(sm.shader.code)
		v = float(mt.get_string(1)) if mt else null
	return float(v) if v != null else -1.0


func _ground_detile(wm: Node) -> float:
	for m in wm.find_children("*", "MeshInstance3D", true, false):
		var sm := (m as MeshInstance3D).material_override as ShaderMaterial
		if sm and sm.get_shader_parameter("tile_scale") != null:
			return _detile_of(sm)
	return -1.0


func _run(weather: String) -> void:
	OS.set_environment("SAGA_WEATHER", weather)
	var ps := load(SCENE) as PackedScene
	if ps == null:
		_fail("씬 못 읽음")
		return
	var scene := ps.instantiate()
	root.add_child(scene)
	current_scene = scene
	for _i in SETTLE:
		await process_frame
	var we := scene.get_node("WorldEnvironment") as WorldEnvironment
	var wm := scene.get_node("WorldMap")
	var rs := root.get_node_or_null("/root/RealmSaveState")
	if rs == null:
		_fail("RealmSaveState 없음")
		return
	## 세이브가 없으면 시나리오 고르기 창이 떠 scenario_ready=false — G-0259 전엔 realm_worldmap._process 가 토글 전에 돌아가
	## 지도 안개 사본이 안 걸렸다(이 probe 첫 측정: fog_enabled=true·copy=false). 일부러 안 켜고 그 길을 잰다.
	print("REALM_MAP scenario_ready=%s" % rs.get("scenario_ready"))
	if (wm as Node3D).visible:
		_fail("%s 성 화면인데 지도가 보임" % weather)
	var env_before := we.environment
	var fog_before := env_before.fog_enabled
	var dens_before := env_before.fog_density
	rs.set("viewing_map", true)
	for _i in MAP_FRAMES:
		await process_frame
	var e := we.environment
	var cam := root.get_viewport().get_camera_3d()
	var orig: Environment = wm.get("_env_original")
	print("REALM_MAP env %s fog_enabled=%s fog_density=%.4f fog_mode=%d depth=%.0f~%.0f vol=%s sky_affect=%.2f copy=%s orig_is_before=%s cam_far=%.0f tile_scale=%.3f" % [
		weather, e.fog_enabled, e.fog_density, e.fog_mode, e.fog_depth_begin, e.fog_depth_end, e.volumetric_fog_enabled, e.fog_sky_affect,
		e != env_before, orig == env_before, cam.far if cam else -1.0, _ground_tile_scale(wm)])
	print("REALM_MAP detile map=%.1f" % _ground_detile(wm))
	if not is_equal_approx(_ground_detile(wm), 1.0):
		_fail("%s 지도 땅 detile %.1f != 1" % [weather, _ground_detile(wm)])
	var cg := scene.find_child("CityGround", true, false) as MeshInstance3D
	var city_d := _detile_of(cg.material_override) if cg else -1.0
	var fs_d := _detile_of(WorldCurveMaterial.triplanar_material(0.004))   # 3마을 forest_terrain_builder 와 같은 부름(기본값)
	print("REALM_MAP detile city=%.1f forest=%.1f" % [city_d, fs_d])
	if cg != null and cg.material_override is ShaderMaterial and not is_zero_approx(city_d):
		_fail("도읍 원반 detile %.1f != 0" % city_d)
	if not is_zero_approx(fs_d):
		_fail("3마을 땅 재질 detile %.1f != 0" % fs_d)
	if e == env_before:
		_fail("%s 지도인데 env 사본으로 안 바뀜" % weather)
	if e.fog_enabled:
		_fail("%s 지도인데 안개 켜짐" % weather)
	if not is_equal_approx(_ground_tile_scale(wm), MAP_TILE_SCALE):
		_fail("%s 지도 땅 tile_scale %.3f != %.3f" % [weather, _ground_tile_scale(wm), MAP_TILE_SCALE])
	rs.set("viewing_map", false)
	for _i in 5:
		await process_frame
	var back := we.environment
	print("REALM_MAP back %s same=%s fog_enabled=%s fog_density=%.4f (전 %s %.4f)" % [weather, back == env_before, back.fog_enabled, back.fog_density, fog_before, dens_before])
	if back != env_before:
		_fail("%s 끄면 원본 env 로 안 돌아옴" % weather)
	if back.fog_enabled != fog_before:
		_fail("%s 끈 뒤 fog_enabled 다름" % weather)
	scene.queue_free()
	await process_frame
	await process_frame


func _initialize() -> void:
	create_timer(170.0).timeout.connect(func() -> void:
		print("PROBE realm_map_fog FAIL 1 (시간 초과)")
		quit(3))
	for w in WEATHERS:
		await _run(w)
	print("PROBE realm_map_fog OK" if fails == 0 else "PROBE realm_map_fog FAIL %d" % fails)
	quit(0 if fails == 0 else 1)
