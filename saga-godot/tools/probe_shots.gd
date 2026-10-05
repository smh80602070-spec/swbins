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
const VroidBody := preload("res://saga_core/world/vroid_body.gd")
const Characters := preload("res://saga_core/data/characters.gd")
const DispatchNode := preload("res://games/saga_go/world/dispatch.gd")
const CombatFx := preload("res://games/saga_go/combat/combat_fx.gd")
const Elements := preload("res://games/saga_go/combat/elements.gd")
const CreatureBuilder := preload("res://saga_core/world/creature_builder.gd")
const FieldEnemy := preload("res://games/saga_go/combat/field_enemy.gd")

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
	["v_bridge", "village", Vector2(5.0, 6.2), Vector3(8, 0, 0), Vector2(5.0, 7.0), -12.0, 14.0, ""],
	["x_swing", "ruins", "r_statue", Vector3(9, 0, 9), "r_statue", -24.0, 7.5, "swing3"],
	["x_swing_late", "ruins", "r_statue", Vector3(9, 0, 9), "r_statue", -24.0, 7.5, "swing8"],
	["x_fxring", "ruins", "r_statue", Vector3(14, 0, -4), "r_statue", -32.0, 14.0, "fxring"],
	["v_statue_far", "village", "v_statue", Vector3(3, 0, 12), "v_statue", -2.0, 14.0, ""],
	["h_homestead", "village", "v_statue", Vector3(-14, 0, 18), "v_statue", -10.0, 8.0, ""],   # G-0014 — 마당 표지(등롱·비석 둘레) 새 툰 GLB 확인
	["v_station_boards", "village", "v_station", Vector3(0, 0, 9), "v_station", -22.0, 10.0, ""],
	["o_village_field", "village", Vector2(2.3, 7.6), Vector3.ZERO, Vector2(3.6, 6.4), -3.0, 12.0, ""],
	["o_crossing_field", "crossing", Vector2(6.6, 4.4), Vector3.ZERO, Vector2(5.6, 3.0), -2.0, 12.0, ""],
	["o_skyport_field", "skyport", Vector2(2.4, 3.2), Vector3.ZERO, Vector2(3.4, 2.4), -2.0, 12.0, ""],
	["o_sunken_field", "sunken", Vector2(4.0, 4.5), Vector3.ZERO, Vector2(5.0, 3.5), -2.0, 12.0, ""],
	["k_ride_horse", "village", "v_statue", Vector3(9, 0, 9), "v_statue", -12.0, 7.0, "mount:pt_jeolyeong"],
	["k_ride_horse_a", "village", "v_statue", Vector3(9, 0, 0), "v_statue", -6.0, 5.0, "mount:pt_jeolyeong"],
	["k_ride_horse_b", "village", "v_statue", Vector3(0, 0, 9), "v_statue", -6.0, 5.0, "mount:pt_jeolyeong"],
	["k_ride_tiger", "village", "v_statue", Vector3(9, 0, 9), "v_statue", -12.0, 7.0, "mount:pt_baekho"],
	["k_ride_crow", "village", "v_statue", Vector3(9, 0, 9), "v_statue", -14.0, 9.0, "mount:pt_samjogo"],
	["k_ride_dragon", "village", "v_statue", Vector3(9, 0, 9), "v_statue", -14.0, 11.0, "mount:pt_cheongryong"],
	["k_fly_dragon", "village", "v_statue", Vector3(9, 0, 9), "v_statue", 8.0, 16.0, "mountfly:pt_cheongryong"],
	["k_fly_crow", "village", "v_statue", Vector3(9, 0, 9), "v_statue", 10.0, 14.0, "mountfly:pt_samjogo"],
	["v_people_lineup", "village", "v_statue", Vector3(-14, 0, 12), "lineup", -8.0, 7.0, "lineup"],
	["p_faces", "village", "v_statue", Vector3(-14, 0, 12), "lineup", 12.0, 2.0, "lineup_faces"],
	["v_cliff_n", "village", Vector2(3.5, 4.4), Vector3.ZERO, Vector2(3.5, 2.6), -4.0, 8.0, ""],
	["v_cliff_s", "village", Vector2(3.0, 6.4), Vector3.ZERO, Vector2(3.0, 8.3), -4.0, 8.0, ""],
	["v_cliff_close", "village", Vector2(3.5, 3.45), Vector3.ZERO, Vector2(3.5, 2.6), -2.0, 5.0, ""],
	["m_beasts", "village", "v_statue", Vector3(-14, 0, 12), "lineup", -10.0, 9.0, "beasts"],
	["m_beasts_a", "village", "v_statue", Vector3(-14, 0, 12), "lineup", -8.0, 4.5, "beasts_a"],
	["m_beasts_b", "village", "v_statue", Vector3(-14, 0, 12), "lineup", -8.0, 4.5, "beasts_b"],
	["m_pets", "village", "v_statue", Vector3(-14, 0, 12), "lineup", -10.0, 8.0, "pets"],
	["m_1_wolf", "village", "v_statue", Vector3(-14, 0, 12), "lineup", -6.0, 2.2, "beast:wolf"],
	["m_1_thunder_cat", "village", "v_statue", Vector3(-14, 0, 12), "lineup", -6.0, 2.2, "beast:thunder_cat"],
	["m_1_ice_fox", "village", "v_statue", Vector3(-14, 0, 12), "lineup", -6.0, 2.2, "beast:ice_fox"],
	["m_1_rock_bear", "village", "v_statue", Vector3(-14, 0, 12), "lineup", -6.0, 2.2, "beast:rock_bear"],
	["m_1_fire_imp", "village", "v_statue", Vector3(-14, 0, 12), "lineup", -6.0, 2.2, "beast:fire_imp"],
	["m_1_water_turtle", "village", "v_statue", Vector3(-14, 0, 12), "lineup", -6.0, 2.2, "beast:water_turtle"],
	["m_1_wind_hawk", "village", "v_statue", Vector3(-14, 0, 12), "lineup", -6.0, 2.2, "beast:wind_hawk"],
	["m_1_grass_snake", "village", "v_statue", Vector3(-14, 0, 12), "lineup", -6.0, 2.2, "beast:grass_snake"],
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
	["u_cliff_n", "sunken", Vector2(4.0, 1.4), Vector3.ZERO, Vector2(4.0, 0.3), -3.0, 9.0, ""],
	["u_base_dome", "sunken", Vector2(6.5, 2.9), Vector3.ZERO, Vector2(5.0, 6.0), -4.0, 14.0, ""],
	["u_light", "sunken", "u_light", Vector3(-6, 0, -6), Vector2(7.0, 7.0), 8.0, 16.0, ""],
	["s_gate", "village", Vector2(0.6, 4.0), Vector3.ZERO, Vector2(-0.5, 4.0), -5.0, 8.0, ""],
	["c_shipyard_side", "coast", Vector2(7.85, 4.6), Vector3.ZERO, Vector2(7.3, 3.8), -15.0, 10.0, ""],
	["f_pines", "frost", Vector2(6.35, 4.3), Vector3.ZERO, Vector2(7.0, 4.0), -8.0, 9.0, ""],
	["f_fox_camp", "frost", Vector2(2.0, 3.6), Vector3.ZERO, Vector2(2.0, 3.0), -16.0, 9.0, ""],
	["f_top_nofog", "frost", Vector2(4.0, 4.5), Vector3.ZERO, Vector2(4.0, 3.0), -70.0, 90.0, "nofog"],
	["f_n_close", "frost", Vector2(5.0, 3.35), Vector3.ZERO, Vector2(5.0, 3.0), -60.0, 8.0, "nofog"],
	["a_tower_far", "amber", Vector2(4.0, 3.6), Vector3.ZERO, Vector2(4.0, 1.4), -3.0, 10.0, ""],
	["a_cross_far", "amber", Vector2(4.3, 6.2), Vector3.ZERO, Vector2(4.3, 4.2), -3.0, 10.0, ""],
	["w_plain", "vault", Vector2(1.5, 2.5), Vector3.ZERO, Vector2(1.5, 1.5), -3.0, 10.0, ""],
	["w_vault_far", "vault", Vector2(4.0, 4.2), Vector3.ZERO, Vector2(4.0, 1.5), -3.0, 10.0, ""],
	["w_granary_far", "vault", Vector2(2.6, 6.6), Vector3.ZERO, Vector2(1.4, 5.4), -3.0, 10.0, ""],
	["k_tower_far", "fork", Vector2(4.0, 4.6), Vector3.ZERO, Vector2(4.0, 1.2), -3.0, 10.0, ""],
	["k_gate_far", "fork", Vector2(4.0, 7.8), Vector3.ZERO, Vector2(4.0, 6.3), -3.0, 10.0, ""],
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
var _swing_enemy: Node3D = null   # "swing" 할 일 — 가장 가까운 들판 적 곁에 서서 찍기 직전에 한 번 휘두른다(09-28 전투 이펙트)

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
		_env_override()
	## "fxring" — 원소 일곱의 스킬 자리(둘레 6m)와 가운데 폭발 하나를 찍기 12 프레임 전에 띄운다(09-28 원소 이펙트).
	if String(SHOTS[_i][7]) == "fxring" and _frame == SETTLE - 12:
		var els := ["fire", "water", "thunder", "wind", "ice", "rock", "grass"]
		for k in els.size():
			var a := TAU * float(k) / float(els.size())
			var at := _p.global_position + Vector3(cos(a), 0.0, sin(a)) * 6.0
			at.y = TerrainBuilder.height_at(String(SHOTS[_i][1]), at)
			CombatFx.element_burst(_p, at, 2.2, Elements.color_of(els[k]), 0.5, els[k], false)
		CombatFx.element_burst(_p, _p.global_position, 3.0, Elements.color_of("thunder"), 0.8, "thunder", true)
	if String(SHOTS[_i][7]).begins_with("swing") and _frame == SETTLE - int(String(SHOTS[_i][7]).substr(5) if String(SHOTS[_i][7]).length() > 5 else "5"):
		var fc := get_tree().get_first_node_in_group("go_field_combat")
		if fc:
			fc.call("attack")
			## 편성이 법구 한 명이면 근접 궤적이 안 나온다 — 이펙트 모양을 보려고 궤적·불꽃도 직접 한 번(연결은 field_combat.gd).
			if is_instance_valid(_swing_enemy):
				CombatFx.slash(_p, _swing_enemy.global_position - _p.global_position, 2.6, CombatFx.PHYSICAL, 1)
				CombatFx.spark(_p, _swing_enemy.global_position + Vector3.UP * 0.9, Color(0.75, 0.45, 1.0), true)
	if _frame < SETTLE:
		_aim(SHOTS[_i])
	if _frame == SETTLE:
		_capture(String(SHOTS[_i][0]))

## SAGA_SHOT_ENV="fog_density=0.001;fog_light_color=Color(0.6,0.7,0.9,1)" — 찍기 전 Environment 속성을 바꿔 값 고르기(09-30 먼 경치).
## 날씨 화면이 60초마다 안개 농도·색을 다시 쓰므로 컷마다 덮어쓴다.
func _env_override() -> void:
	## SAGA_SHOT_HIDE="GrassField,CliffRocks*" — 이름(와일드카드)이 맞는 노드를 숨겨 무엇이 그리는지 가린다.
	for pat in OS.get_environment("SAGA_SHOT_HIDE").split(",", false):
		for n in get_tree().current_scene.find_children(pat, "Node3D", true, false):
			(n as Node3D).visible = false
	var spec := OS.get_environment("SAGA_SHOT_ENV")
	if spec == "":
		return
	var we := get_tree().current_scene.find_children("*", "WorldEnvironment", true, false)
	if we.is_empty():
		return
	var en := (we[0] as WorldEnvironment).environment
	for kv in spec.split(";", false):
		var i := kv.find("=")
		if i > 0:
			en.set(kv.substr(0, i).strip_edges(), str_to_var(kv.substr(i + 1)))

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
	if String(s[7]).begins_with("lineup"):
		_build_lineup(_pos_of(String(s[1]), s[2]) + (s[3] as Vector3))
	elif String(s[7]).begins_with("beast") or String(s[7]) == "pets":
		_build_beasts(_pos_of(String(s[1]), s[2]) + (s[3] as Vector3), String(s[7]))
	var e := _pos_of(String(s[1]), s[2]) + (s[3] as Vector3)
	e.y = TerrainBuilder.height_at(String(s[1]), e) + 0.6
	_p.global_position = e
	_p.velocity = Vector3.ZERO

func _aim(s: Array) -> void:
	var t := _pos_of(String(s[1]), s[4])
	if String(s[7]).begins_with("swing") and is_instance_valid(_swing_enemy):
		t = _swing_enemy.global_position
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
		"swing", "swing3", "swing8":
			var best := 1e9
			for e in get_tree().get_nodes_in_group("field_enemy"):
				var d := (e as Node3D).global_position.distance_to(_p.global_position)
				if d < best:
					best = d
					_swing_enemy = e
			if _swing_enemy:
				_swing_enemy.set_physics_process(false)
				_swing_enemy.set_process(false)
				_p.global_position = _swing_enemy.global_position + Vector3(1.4, 0.4, 0.9)
		"lineup_faces":
			_p.visible = false # 얼굴 가까이 — 플레이어가 앞을 가리지 않게
		"beasts", "beasts_a", "beasts_b", "pets":
			_p.visible = false # 줄 한가운데를 가린다
		_ when a.begins_with("beast:"):
			_p.visible = false
			var gf := get_tree().current_scene.get_node_or_null("GrassField") as Node3D
			if gf:
				gf.visible = false # 가까이 한 마리 — 발까지 보려고 풀을 잠깐 끈다
		_ when a.begins_with("mountfly:"):
			var mf := _p.get_node_or_null("Mount")
			if mf:
				mf.call("mount", a.substr(9))
				Input.action_press("jump") # 떠올라 계속 오른다 — _undo 가 뗀다
		_ when a.begins_with("mount:"):
			var mn := _p.get_node_or_null("Mount")
			if mn:
				mn.call("mount", a.substr(6))
		"night":
			TimeOfDay.force(true)
			var nv := get_tree().get_first_node_in_group("go_night_visual")
			if nv:
				nv.call("refresh_now")
			var sp := get_tree().get_first_node_in_group("go_sky_panorama")   # G-0026 — 하늘 파노라마도 곧바로
			if sp:
				sp.call("refresh_now")
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
	if Input.is_action_pressed("jump"):
		Input.action_release("jump")
	var mn := _p.get_node_or_null("Mount") if _p else null
	if mn and bool(mn.call("is_riding")):
		mn.call("dismount", "", true)
	if _p:
		_p.visible = true
	var gf := get_tree().current_scene.get_node_or_null("GrassField") as Node3D
	if gf:
		gf.visible = true
	if TimeOfDay.is_night():
		TimeOfDay.force(false)
		var nv := get_tree().get_first_node_in_group("go_night_visual")
		if nv:
			nv.call("refresh_now")
		var sp := get_tree().get_first_node_in_group("go_sky_panorama")
		if sp:
			sp.call("refresh_now")
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

## 09-29 적 몬스터 모습 — 들판 적(코드 몸)을 한 줄로. "beasts" 전부 · "beasts_a"/"beasts_b" 앞·뒤 절반을 가까이 · "pets" 신수 열하나.
## 몸마다 비스듬히(±30°) 돌려 옆모습·앞모습이 같이 보이게.
const BEAST_KINDS := ["wolf", "thunder_cat", "ice_fox", "rock_bear", "fire_imp", "water_turtle", "wind_hawk", "grass_snake"]
func _build_beasts(eye: Vector3, which: String) -> void:
	var root := get_tree().current_scene
	var looks: Array = []
	if which == "pets":
		for id in CreatureBuilder.PET_LOOKS:
			var l: Array = CreatureBuilder.PET_LOOKS[id]
			looks.append([l[0], [l[1], l[2], l[3]], 1.4, l[4] if l.size() > 4 else {}])
	else:
		var kinds: Array = BEAST_KINDS
		if which == "beasts_a":
			kinds = BEAST_KINDS.slice(0, 4)
		elif which == "beasts_b":
			kinds = BEAST_KINDS.slice(4)
		elif which.begins_with("beast:"):
			kinds = [which.substr(6)]
		for k in kinds:
			var d: Dictionary = FieldEnemy.KINDS[k]
			looks.append([d.get("shape", "wolf"), d.get("colors", []), float(d.get("height", 1.0)), {"element": String(d.get("element", "")), "enemy": true}])
	var gap := 2.4 if which != "pets" else 1.9
	var n := looks.size()
	for k in n:
		var l: Array = looks[k]
		var body: Node3D
		if (l[1] as Array).is_empty():
			body = CreatureBuilder.build("wolf", [Color(0.42, 0.4, 0.38), Color(0.62, 0.6, 0.56), Color(0.95, 0.8, 0.25)], l[3])
			CreatureBuilder._fit(body, "wolf", 1.05)
		else:
			body = CreatureBuilder.build(l[0], l[1], l[3])
			CreatureBuilder._fit(body, l[0], l[2])
		root.add_child(body)
		var p := eye + Vector3((k - (n - 1) / 2.0) * gap, 0, -6.0 if n > 1 else -2.8)
		p.y = TerrainBuilder.height_at("village", p)
		body.global_position = p
		body.rotation.y = deg_to_rad(30.0 if k % 2 == 0 else -30.0) if n > 1 else deg_to_rad(40.0)
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
	var cam := get_viewport().get_camera_3d()
	var arm := _rig.get("spring_arm") as SpringArm3D if _rig else null
	if arm and arm.get_hit_length() < 0.5:
		## 끈이 시작점에서 걸렸을 때 — 끈 방향 광선·끈 모양 겹침으로 무엇인지(09-29 조사)
		var ss := _p.get_world_3d().direct_space_state
		var from := arm.global_position
		var q := PhysicsRayQueryParameters3D.create(from, from + arm.global_basis.z * arm.spring_length, arm.collision_mask)
		q.hit_from_inside = true
		var hit := ss.intersect_ray(q)
		print("SHOT_ARM from=%s ray_hit=%s shape=%s" % [from, (hit.collider as Node).get_path() if hit else "none", arm.shape])
		if arm.shape:
			var sq := PhysicsShapeQueryParameters3D.new()
			sq.shape = arm.shape
			sq.transform = Transform3D(Basis(), from)
			sq.collision_mask = arm.collision_mask
			for r in ss.intersect_shape(sq, 8):
				print("SHOT_ARM overlap=%s" % (r.collider as Node).get_path())
	print("SHOT %s %s err=%d modal=%d pos=%s cam=%s arm_hit=%.2f time_scale=%.2f" % [name, path, err, get_tree().get_nodes_in_group("ui_modal").size(), _p.global_position,
		cam.global_position if cam else Vector3.ZERO, arm.get_hit_length() if arm else -1.0, Engine.time_scale])
