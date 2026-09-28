extends Node
## GO 창 모드 촬영 — 사람이 실기로 볼 것을 PC 에서 먼저 찍어 보는 도구. 평소엔 안 붙는다.
## test_village.gd 가 SAGA_SHOT_PROBE 가 있을 때만 단다. 헤드리스에선 그림이 비니 창 모드로(화면 밖에 띄운다):
##
##   SAGA_SHOT_PROBE=1 SAGA_SHOT_DIR=<절대 경로> "$GODOT_CONSOLE" --path saga-godot --rendering-method mobile \
##       --position -4000,0 --resolution 1280x720 res://games/saga_go/world/TestVillage.tscn </dev/null
##
## SHOTS 한 줄 = 자리 하나: 플레이어를 eye 에 세우고 카메라를 look 쪽으로 돌려 SETTLE 프레임 뒤 뷰포트를 PNG 로.
## SAGA_SHOT_ONLY=이름,이름 이면 그것만. 할 일 "nofog"·"raw"(안개·톤매핑·SSAO 끔)·"noshadow" 는 진단용
## (2026-09-26 땅 뒷면·눈 판정을 찾을 때 셰이더를 잠깐 EMISSION 디버그로 바꿔 이 컷들로 봤다). 마우스를 가두지 않고, 저장은 안 한다(저장은 저장 단추로만 된다).

const TestMap := preload("res://games/saga_go/data/test_map.gd")
const TerrainBuilder := preload("res://games/saga_go/world/terrain_builder.gd")
const VroidBody := preload("res://games/saga_go/world/vroid_body.gd")
const Characters := preload("res://saga_core/data/characters.gd")
const DispatchNode := preload("res://games/saga_go/world/dispatch.gd")

const SETTLE := 90

## [이름, 지역, eye(칸 Vector2 또는 지점 id), eye 에 더할 m, look(칸 Vector2·지점 id·"boss:<id>"·"lineup"), 피치°, 거리 m, 할 일]
const SHOTS := [
	["v_statue", "village", "v_statue", Vector3(9, 0, 9), "v_statue", -18.0, 9.0, ""],
	["v_house", "village", Vector2(4.0, 5.0), Vector3(-4, 0, 18), Vector2(4.0, 5.0), -6.0, 9.0, ""],
	["v_village_plaza", "village", Vector2(5.5, 6.3), Vector3.ZERO, Vector2(4.7, 5.3), -12.0, 16.0, ""],
	["v_village_west", "village", Vector2(4.6, 5.9), Vector3.ZERO, Vector2(3.9, 5.5), -10.0, 12.0, ""],
	["n_village_plaza", "village", Vector2(5.5, 6.3), Vector3.ZERO, Vector2(4.7, 5.3), -12.0, 16.0, "night"],
	["n_house", "village", Vector2(4.0, 5.0), Vector3(-4, 0, 18), Vector2(4.0, 5.0), -6.0, 9.0, "night"],
	["n_statue_far", "village", "v_statue", Vector3(3, 0, 12), "v_statue", -2.0, 14.0, "night"],
	["c_sea", "coast", Vector2(3.0, 3.75), Vector3.ZERO, Vector2(3.0, 2.2), -22.0, 12.0, ""],
	["v_river", "village", Vector2(3.5, 6.6), Vector3.ZERO, Vector2(3.5, 7.0), -25.0, 10.0, ""],
	["v_statue_far", "village", "v_statue", Vector3(3, 0, 12), "v_statue", -2.0, 14.0, ""],
	["v_station_boards", "village", "v_station", Vector3(0, 0, 9), "v_station", -22.0, 10.0, ""],
	["v_people_lineup", "village", "v_statue", Vector3(-14, 0, 12), "lineup", -8.0, 7.0, "lineup"],
	["c_dock", "coast", "c_dock", Vector3(10, 0, 8), "c_dock", -16.0, 10.0, ""],
	["r_statue", "ruins", "r_statue", Vector3(9, 0, 9), "r_statue", -16.0, 10.0, ""],
	["f_pass_view", "frost", "f_pass", Vector3(0, 0, 0), Vector2(3.0, 4.0), -10.0, 11.0, ""],
	["f_statue", "frost", "f_statue", Vector3(8, 0, 8), "f_statue", -18.0, 9.0, ""],
	["f_fort", "frost", Vector2(3.0, 4.75), Vector3.ZERO, Vector2(3.0, 4.0), -14.0, 10.0, ""],
	["f_lake_observatory", "frost", Vector2(3.6, 2.9), Vector3.ZERO, Vector2(4.4, 1.2), -12.0, 10.0, ""],
	["f_airship", "frost", Vector2(5.85, 6.0), Vector3.ZERO, Vector2(6.45, 5.25), -14.0, 10.0, ""],
	["f_snow_bloom", "frost", Vector2(4.2, 3.5), Vector3.ZERO, Vector2(4.2, 3.4), -40.0, 6.0, ""],
	["f_bear_king", "frost", Vector2(3.15, 6.05), Vector3.ZERO, "boss:snow_bear_king", -12.0, 10.0, ""],
	["c_shipyard", "coast", Vector2(6.6, 4.55), Vector3.ZERO, Vector2(7.3, 3.85), -12.0, 11.0, ""],
	["r_observatory", "ruins", Vector2(1.2, 2.85), Vector3.ZERO, Vector2(1.2, 2.2), 8.0, 12.0, ""],
	["r_obs_deck", "ruins", Vector2(1.2, 2.2), Vector3(0.0, 24.5, 6.0), Vector2(1.2, 2.1), -20.0, 9.0, ""],
	["v_old_station", "village", Vector2(5.15, 8.95), Vector3.ZERO, Vector2(4.72, 8.8), -10.0, 11.0, ""],
	["f_starship_up", "frost", Vector2(5.85, 5.9), Vector3.ZERO, Vector2(6.45, 5.25), 10.0, 14.0, ""],
	["s_port", "skyport", Vector2(4.6, 2.4), Vector3.ZERO, Vector2(5.4, 1.6), -8.0, 14.0, ""],
	["s_temple_station", "skyport", Vector2(3.6, 4.6), Vector3.ZERO, Vector2(4.4, 5.0), -10.0, 12.0, ""],
	["s_docked", "skyport", Vector2(5.3, 2.3), Vector3.ZERO, Vector2(5.4, 1.6), 6.0, 16.0, ""],
	["s_belfry", "skyport", Vector2(2.72, 3.72), Vector3.ZERO, Vector2(2.71, 3.54), -4.0, 7.0, ""],
	["x_first_stop", "crossing", Vector2(4.2, 2.7), Vector3.ZERO, Vector2(5.0, 2.0), -8.0, 12.0, ""],
	["x_tangled", "crossing", Vector2(3.5, 3.7), Vector3.ZERO, Vector2(2.5, 4.5), 2.0, 16.0, ""],
	["x_stones_clock", "crossing", Vector2(4.4, 6.4), Vector3.ZERO, Vector2(2.5, 7.0), 12.0, 18.0, ""],
	["u_palace", "sunken", Vector2(2.1, 3.3), Vector3.ZERO, Vector2(2.3, 5.0), -6.0, 12.0, ""],
	["u_base_dome", "sunken", Vector2(6.5, 2.9), Vector3.ZERO, Vector2(5.0, 6.0), -4.0, 14.0, ""],
	["u_light", "sunken", "u_light", Vector3(-6, 0, -6), Vector2(7.0, 7.0), 8.0, 16.0, ""],
	["s_gate", "village", Vector2(0.6, 4.0), Vector3.ZERO, Vector2(-0.5, 4.0), -5.0, 8.0, ""],
	["c_shipyard_side", "coast", Vector2(7.85, 4.6), Vector3.ZERO, Vector2(7.3, 3.8), -15.0, 10.0, ""],
	["f_pines", "frost", Vector2(6.35, 4.3), Vector3.ZERO, Vector2(7.0, 4.0), -8.0, 9.0, ""],
	["f_fox_camp", "frost", Vector2(2.0, 3.6), Vector3.ZERO, Vector2(2.0, 3.0), -16.0, 9.0, ""],
	["f_top_nofog", "frost", Vector2(4.0, 4.5), Vector3.ZERO, Vector2(4.0, 3.0), -70.0, 90.0, "nofog"],
	["f_n_close", "frost", Vector2(5.0, 3.35), Vector3.ZERO, Vector2(5.0, 3.0), -60.0, 8.0, "nofog"],
	["ui_hud", "village", "v_statue", Vector3(6, 0, 6), "v_statue", -25.0, 8.0, ""],
	["ui_sight", "village", "v_statue", Vector3(6, 0, 6), "v_statue", -25.0, 8.0, "sight"],
	["ui_map", "village", "v_statue", Vector3(6, 0, 6), "v_statue", -25.0, 8.0, "map"],
	["ui_character", "village", "v_statue", Vector3(6, 0, 6), "v_statue", -25.0, 8.0, "character"],
	["ui_dispatch", "village", "board", Vector3(1.5, 0, 1.0), "v_station", -25.0, 8.0, "dispatch"],
]

var _p: CharacterBody3D
var _rig: Node3D
var _wps: Node
var _i := -1
var _frame := 0
var _dir := ""
var _only: PackedStringArray = []
var _lineup: Array[Node3D] = []
var _done: Array = []

func _ready() -> void:
	Weather.force("clear")
	TimeOfDay.force(false)
	## 09-28 — 날씨 화면(season_weather_visual)은 60초마다 다시 칠해 첫 컷들이 실제 시각 날씨(안개)로 찍혔다. 고정 직후 한 번 칠한다.
	(func() -> void:
		var sw := get_tree().current_scene.get_node_or_null("SeasonWeatherVisual")
		if sw:
			sw.call("apply")).call_deferred()
	_dir = OS.get_environment("SAGA_SHOT_DIR")
	var o := OS.get_environment("SAGA_SHOT_ONLY")
	if o != "":
		_only = o.split(",")

func _process(_delta: float) -> void:
	if _p == null:
		_p = get_tree().get_first_node_in_group("player") as CharacterBody3D
		_rig = get_tree().get_first_node_in_group("camera_rig") as Node3D
		_wps = get_tree().get_first_node_in_group("go_waypoints")
		return
	if _rig and bool(_rig.get("mouse_look")):
		_rig.set("mouse_look", false)
	if Input.mouse_mode != Input.MOUSE_MODE_VISIBLE:
		Input.mouse_mode = Input.MOUSE_MODE_VISIBLE
	_frame += 1
	if _i < 0 or _frame > SETTLE + 2:
		_undo()
		_i += 1
		while _i < SHOTS.size() and not _only.is_empty() and not _only.has(String(SHOTS[_i][0])):
			_i += 1
		if _i >= SHOTS.size():
			print("SHOT_PROBE_DONE shots=%d" % _done.size())
			get_tree().quit()
			return
		_frame = 0
		_place(SHOTS[_i])
		return
	if _frame == 20:
		_act(String(SHOTS[_i][7]))
	if _frame < SETTLE:
		_aim(SHOTS[_i])
	if _frame == SETTLE:
		_capture(String(SHOTS[_i][0]))

func _pos_of(region: String, v: Variant) -> Vector3:
	var p := Vector3.ZERO
	if v is Vector2:
		p = TestMap.world_pos((v as Vector2).x, (v as Vector2).y, region)
	elif String(v) == "board":
		p = DispatchNode.board_pos()
	elif String(v).begins_with("boss:"):
		var fb := get_tree().get_first_node_in_group("go_field_bosses")
		var b: Node3D = fb.call("boss", String(v).substr(5)) if fb else null
		return b.global_position + Vector3(0, 1.5, 0) if b else Vector3.ZERO
	elif String(v) == "lineup":
		return _lineup_center() + Vector3(0, 1.2, 0)
	else:
		p = _wps.call("world_pos_of", String(v))
	p.y = TerrainBuilder.height_at(region, p)
	return p

func _place(s: Array) -> void:
	if String(s[7]) == "lineup":
		_build_lineup(_pos_of(String(s[1]), s[2]) + (s[3] as Vector3))
	var e := _pos_of(String(s[1]), s[2]) + (s[3] as Vector3)
	e.y = TerrainBuilder.height_at(String(s[1]), e) + 0.6
	_p.global_position = e
	_p.velocity = Vector3.ZERO

func _aim(s: Array) -> void:
	var t := _pos_of(String(s[1]), s[4])
	var d := t - _p.global_position
	d.y = 0.0
	if d.length() > 0.1 and _rig:
		_rig.rotation.y = atan2(-d.x, -d.z)
		_rig.rotation_degrees.x = float(s[5])
		var arm := _rig.get("spring_arm") as SpringArm3D
		if arm:
			arm.spring_length = float(s[6])

func _act(a: String) -> void:
	match a:
		"night":
			TimeOfDay.force(true)
			var nv := get_tree().get_first_node_in_group("go_night_visual")
			if nv:
				nv.call("refresh_now")
		"nofog":
			var we := get_tree().current_scene.find_children("*", "WorldEnvironment", true, false)
			if not we.is_empty():
				(we[0] as WorldEnvironment).environment.fog_enabled = false
		"noshadow":
			for l in get_tree().current_scene.find_children("*", "DirectionalLight3D", true, false):
				(l as DirectionalLight3D).shadow_enabled = false
				print("SHOT_SUN %s energy=%.2f dir=%s" % [l.name, (l as DirectionalLight3D).light_energy, -(l as Node3D).global_transform.basis.z])
		"raw":
			var we2 := get_tree().current_scene.find_children("*", "WorldEnvironment", true, false)
			if not we2.is_empty():
				var en := (we2[0] as WorldEnvironment).environment
				en.fog_enabled = false
				en.volumetric_fog_enabled = false
				en.tonemap_mode = Environment.TONE_MAPPER_LINEAR
				en.tonemap_exposure = 1.0
				en.glow_enabled = false
				en.ssao_enabled = false
				en.adjustment_enabled = false
		"sight":
			var es := get_tree().get_first_node_in_group("go_elemental_sight")
			if es:
				es.call("set_active", true)
		"map":
			var m := get_tree().get_first_node_in_group("go_world_map")
			if m:
				m.call("open_map")
		"character":
			var c := get_tree().get_first_node_in_group("go_character_screen")
			if c:
				c.call("open_screen")
		"dispatch":
			var dn := get_tree().get_first_node_in_group("go_dispatch")
			if dn:
				dn.call("open_screen")

func _undo() -> void:
	if TimeOfDay.is_night():
		TimeOfDay.force(false)
		var nv := get_tree().get_first_node_in_group("go_night_visual")
		if nv:
			nv.call("refresh_now")
	var es := get_tree().get_first_node_in_group("go_elemental_sight")
	if es and bool(es.get("active")):
		es.call("set_active", false)
	for pair in [["go_world_map", "close_map"], ["go_character_screen", "close_screen"], ["go_dispatch", "close_screen"]]:
		var n := get_tree().get_first_node_in_group(pair[0])
		if n and not get_tree().get_nodes_in_group("ui_modal").is_empty():
			n.call(pair[1])
	for n in _lineup:
		n.queue_free()
	_lineup.clear()

## 도감 인물 여덟을 한 줄로(몸이 둘뿐이라 색만 다른지 보려고) — 플레이어 앞 6m, +Z 쪽(카메라 쪽)을 보게.
func _build_lineup(eye: Vector3) -> void:
	var root := get_tree().current_scene
	var n := 8
	for k in n:
		var h: Dictionary = Characters.HEROES[(k * 13) % Characters.HEROES.size()]
		var body := VroidBody.build(String(h.id), int(h.get("rarity", 3)))
		root.add_child(body)
		var p := eye + Vector3((k - (n - 1) / 2.0) * 1.1, 0, -6.0)
		p.y = TerrainBuilder.height_at("village", p)
		body.global_position = p
		_lineup.append(body)

func _lineup_center() -> Vector3:
	var c := Vector3.ZERO
	for n in _lineup:
		c += n.global_position
	return c / maxf(_lineup.size(), 1)

func _capture(name: String) -> void:
	await RenderingServer.frame_post_draw
	var img := get_viewport().get_texture().get_image()
	var path := _dir.path_join("%s_%dx%d.png" % [name, img.get_width(), img.get_height()])
	var err := img.save_png(path)
	_done.append(name)
	print("SHOT %s %s err=%d modal=%d pos=%s" % [name, path, err, get_tree().get_nodes_in_group("ui_modal").size(), _p.global_position])
