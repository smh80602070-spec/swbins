extends Node
## GO 원신식 이동(go_player.gd) 자동 점검 — 평소엔 안 붙는다. test_village.gd 가
## SAGA_TRAVERSAL_PROBE 가 있을 때만 단다.
##
##   SAGA_TRAVERSAL_PROBE=1 "$GODOT" --headless --path saga-godot res://games/saga_go/world/TestVillage.tscn
##
## ① 선다 ② 점프 높이 ③ 달리기 스태미나 소모·회복 ④ 절벽 등반 → 꼭대기 넘어오르기
## ⑤ 절벽에서 뛰어내려 활공 ⑥ 강에 빠지면 헤엄 ⑦ 둑까지 헤엄쳐 넘어오르기
## ⑧ 기력 소진 익수 복귀 ⑨ 지도 경계벽. 이동은 실제 입력 액션으로(카메라 기본 yaw 0 —
## 앞 = -z, 왼쪽 = -x). 끝에 TRAVERSAL_PROBE_DONE 한 줄을 찍고 끈다. 저장은 안 한다.

const TestMap := preload("res://games/saga_go/data/test_map.gd")
const TerrainBuilder := preload("res://games/saga_go/world/terrain_builder.gd")

var _p: CharacterBody3D
var _frame := 0
var _step := 0
var _fails := 0
var _y0 := 0.0
var _peak := 0.0
var _x0 := 0.0
var _seen_glide := false
var _cliff_top := 0.0
var _glide_vy := 0.0
var _glide_frames := 0

func _ready() -> void:
	_p = get_tree().get_first_node_in_group("player")

func _physics_process(_delta: float) -> void:
	_frame += 1
	match _step:
		0: # ① 선다 — 마을 광장
			if _frame == 1:
				_teleport(TestMap.world_pos(5, 4) + Vector3(0, 1.0, 0))
			if _frame == 40:
				_check("stand", _p.is_on_floor() and _p.mode == _p.Mode.GROUND, _pos())
				_next()
		1: # ② 점프
			if _frame == 1:
				_y0 = _p.global_position.y
				_peak = _y0
				Input.action_press("jump")
			if _frame == 8:
				_check_pose("pose_jump", "jump", "idle")   # G-0025 — 상승 중
			if _frame == 3:
				Input.action_release("jump")
			_peak = maxf(_peak, _p.global_position.y)
			if _frame == 70:
				var rise := _peak - _y0
				_check("jump", rise > 1.0 and rise < 2.0 and _p.is_on_floor(), "rise=%.2f" % rise)
				_next()
		2: # ③ 달리기 3초 → 소모, 놓고 5초 → 가득
			if _frame == 1:
				Input.action_press("run")
				Input.action_press("move_right")
			if _frame == 180:
				Input.action_release("run")
				Input.action_release("move_right")
				var st: float = _p.stamina
				## 106장 ⑧ — Shift 를 누르는 순간 대시(15)가 먼저 나가고 그 뒤 달리기(8/s).
				_check("sprint_cost", st < 90.0 and st > 50.0, "st=%.1f" % st)
			if _frame == 480:
				_check("regen", _p.stamina >= 99.9, "st=%.1f" % _p.stamina)
				_next()
		3: # ④ 길(5,1) 서쪽 끝에서 왼쪽 산(4,1) 절벽으로 밀고, 붙으면 위로
			if _frame == 1:
				_cliff_top = TerrainBuilder.tile_base_height("village", 4, 1)
				var edge_x := TestMap.world_pos(4, 1).x + TestMap.TILE_SIZE * 0.5
				_teleport(Vector3(edge_x + 1.5, 0.6, TestMap.world_pos(4, 1).z))
			if _frame == 20:
				Input.action_press("move_left")
			if _frame == 60:
				_check("climb_grab", _p.mode == _p.Mode.CLIMB, "mode=%d %s" % [_p.mode, _pos()])
				_check_pose("pose_climb", "climb", "walk")   # G-0025 — 붙은 동안 등반 동작
				Input.action_release("move_left")
				Input.action_press("move_forward")
			if _frame > 60 and _p.mode == _p.Mode.GROUND and _p.is_on_floor():
				Input.action_release("move_forward")
				var y := _p.global_position.y
				## 09-28 산이 절벽 턱(terrain_builder PEAK_RIM) 뒤로 솟는 봉우리가 됐다 — 턱에 서거나 비탈을 이어 오르면 "꼭대기 이상·봉우리 높이 이하"면 통과.
				_check("climb_top", y > _cliff_top - 1.0 and y < _cliff_top + TerrainBuilder.MOUNTAIN_PEAK_AMP + 1.0, "y=%.2f top=%.1f st=%.1f" % [y, _cliff_top, _p.stamina])
				_next()
			elif _frame == 900:
				Input.action_release("move_forward")
				_check("climb_top", false, "timeout mode=%d %s st=%.1f" % [_p.mode, _pos(), _p.stamina])
				_next()
		4: # ⑤ 가득 찰 때까지 쉬었다가 절벽 밖(+x)으로 걸어 떨어지며 점프 → 활공
			if _frame == 300:
				_x0 = _p.global_position.x
				Input.action_press("move_right")
			if _frame > 300 and _p.mode == _p.Mode.AIR and not _seen_glide and _p.global_position.y < _cliff_top - 1.0:
				Input.action_press("jump")
			if _frame > 300 and Input.is_action_pressed("jump") and _p.mode == _p.Mode.GLIDE:
				Input.action_release("jump")
				_seen_glide = true
			if _frame > 300 and _p.mode == _p.Mode.GLIDE:
				## 펼친 직후엔 떨어지던 속도가 남는다 — 0.5초 뒤 안정된 낙하 속도만 본다.
				_glide_frames += 1
				if _glide_frames == 10:
					_check_pose("pose_glide", "glide", "idle")   # G-0025
				if _glide_frames > 30:
					_glide_vy = minf(_glide_vy, _p.velocity.y)
			## 활공이 끝나면(땅·맞은편 절벽) 곧바로 판정 — 계속 밀면 맞은편 벽을 타고 옆으로 간다.
			if _frame > 300 and _seen_glide and _p.mode != _p.Mode.GLIDE:
				Input.action_release("move_right")
				var dx := _p.global_position.x - _x0
				_check("glide", dx > 25.0 and _glide_vy > -3.0, "dx=%.1f vy_min=%.2f end_mode=%d" % [dx, _glide_vy, _p.mode])
				_next()
			elif _frame == 1500:
				Input.action_release("move_right")
				Input.action_release("jump")
				_check("glide", false, "timeout seen=%s mode=%d %s" % [_seen_glide, _p.mode, _pos()])
				_next()
		5: # ⑥ 강(3,7) 한가운데 위에서 떨어뜨린다
			if _frame == 1:
				## 앞 단계(활공 끝 등반)에서 쓴 기력은 ③에서 회복을 이미 봤으니 채우고 시작한다.
				_p.stamina = _p.STAMINA_MAX
				_teleport(TestMap.world_pos(3, 7) + Vector3(0, 0.5, 0))
			if _frame == 150:
				var y := _p.global_position.y
				var want := TerrainBuilder.WATER_LEVEL - 1.25
				_check("swim", _p.mode == _p.Mode.SWIM and absf(y - want) < 0.35, "mode=%d y=%.2f want=%.2f" % [_p.mode, y, want])
				_check_pose("pose_swim", "swim", "walk")   # G-0025
				Input.action_press("move_forward")
				_next()
		6: # ⑦ 북쪽 둑(3,6 들판)까지 헤엄쳐 넘어오른다
			if _frame == 30:
				_check_pose("pose_swim_move", "swim", "walk")   # G-0025 — 헤엄치며 나아가는 중
			if _p.mode == _p.Mode.GROUND and _p.is_on_floor():
				Input.action_release("move_forward")
				var bank_z := TestMap.world_pos(3, 7).z - TestMap.TILE_SIZE * 0.5
				var ok := _p.global_position.z < bank_z and absf(_p.global_position.y) < 0.3
				_check("swim_out", ok, _pos())
				_next()
			elif _frame == 900:
				Input.action_release("move_forward")
				_check("swim_out", false, "timeout mode=%d %s" % [_p.mode, _pos()])
				_next()
		7: # ⑧ 물 한가운데서 기력을 비우면 마지막으로 딛은 땅으로
			if _frame == 60:
				_teleport(TestMap.world_pos(8, 7) + Vector3(0, 0.5, 0))
			if _frame == 200:
				_p.stamina = 0.5
			if _frame == 260:
				var dry: bool = _p.mode == _p.Mode.GROUND and _p.global_position.y > -0.5
				_check("drown_return", dry and _p.stamina >= 99.0, "mode=%d %s" % [_p.mode, _pos()])
				_next()
		8: # ⑨ 서쪽 끝 숲(0,5)에서 지도 밖으로 걸어 본다
			if _frame == 1:
				var w := TestMap.world_pos(0, 5)
				_teleport(Vector3(w.x - TestMap.TILE_SIZE * 0.5 + 3.0, 1.0, w.z))
			if _frame == 20:
				Input.action_press("move_left")
			if _frame == 200:
				Input.action_release("move_left")
				var border := TestMap.world_pos(0, 5).x - TestMap.TILE_SIZE * 0.5
				_check("border", _p.global_position.x > border - 0.1, "x=%.2f border=%.1f" % [_p.global_position.x, border])
				_next()
		9: # ⑩ 106장 ⑤ — 마을 동쪽 숲(10,6)에서 동쪽으로 걸으면 포구 모래밭(고개)으로 넘어간다
			if _frame == 1:
				var c := TestMap.world_pos(10, 6)
				_teleport(Vector3(c.x + 14.0, 1.0, c.z))
			if _frame == 20:
				Input.action_press("move_right")
			if _frame == 260:
				Input.action_release("move_right")
				var r := TestMap.region_at(_p.global_position)
				_check("pass_coast", r == "coast", "region=%s %s" % [r, _pos()])
				_next()
		10: # ⑪ 마을 남쪽 길(5,10)에서 남쪽으로 걸으면 폐허 고개(3,0)로 넘어간다
			if _frame == 1:
				var c := TestMap.world_pos(5, 10)
				_teleport(Vector3(c.x, 1.0, c.z + 12.0))
			if _frame == 20:
				Input.action_press("move_back")
			if _frame == 260:
				Input.action_release("move_back")
				var r := TestMap.region_at(_p.global_position)
				_check("pass_ruins", r == "ruins", "region=%s %s" % [r, _pos()])
				_next()
		11: # ⑫ 세이브 v1(옛 원점 8000m) 좌표 → 새 원점. 실제 세이브 파일은 안 건드린다.
			var a: Dictionary = SaveState.call("_migrate", {"version": 1, "player_pos": [8100.0, 0.5, 20.0]})
			var b: Dictionary = SaveState.call("_migrate", {"version": 1, "player_pos": [10.0, 0.5, 8050.0]})
			var c: Dictionary = SaveState.call("_migrate", {"version": 1, "player_pos": [-24.0, 0.1, -72.0]})
			var ok: bool = is_equal_approx(float(a.player_pos[0]), 580.0) and is_equal_approx(float(b.player_pos[2]), 482.0) 				and is_equal_approx(float(c.player_pos[0]), -24.0) and int(a.version) == int(SaveState.SAVE_VERSION)
			_check("save_migrate", ok, "%s %s %s" % [str(a.player_pos), str(b.player_pos), str(c.player_pos)])
			_next()
		12: # ⑬ G-0025 — 낙하 공격 동작(공중 높이 40m 에서 시작)
			if _frame == 1:
				_teleport(TestMap.world_pos(5, 4) + Vector3(0, 40.0, 0))
			if _frame == 12:
				_check("plunge_start", _p.start_plunge(), "mode=%d %s" % [_p.mode, _pos()])
			if _frame == 26:
				_check_pose("pose_plunge", "plunge", "idle")   # 0.8초 공격 동작(_action_t)이 클립을 막지 않는지
				_next()
		13: # ⑭ G-0025 — 턱 넘기 동작
			if _frame == 1:
				_p.stamina = _p.STAMINA_MAX
				_teleport(TestMap.world_pos(5, 4) + Vector3(0, 1.0, 0))
			if _frame == 40:
				_p._start_mantle(_p.global_position + Vector3(1.0, 1.2, 0.0))
			if _frame == 44:
				_check_pose("pose_mantle", "mantle", "idle")
				_next()
		14: # ⑮ G-0025 — 시전·폭발 동작
			if _frame == 60:
				_p.play_action("skill", 0.4, 0.5)
			if _frame == 62:
				_check_pose("pose_skill", "skill", "attack")
			if _frame == 120:
				_p.play_action("burst", 0.6, 0.0)
			if _frame == 122:
				_check_pose("pose_burst", "burst", "attack")
				_next()
		15: # ⑯ G-0024 — 낚시 중 몸을 바꿔도 낚싯대가 남는다
			if _frame == 1:
				var rod := Node3D.new()
				rod.name = "FishingRod"
				_p.visual.add_child(rod)
				_p.set_hero_body("dj_doseo")
			if _frame == 3:
				_check("rod_keeps", _p.visual.get_node_or_null("FishingRod") != null, "body=%s" % str(_p._body_id))
				_next()
		16: # ⑰ G-0020 — 새 널판 다리를 끝에서 끝까지 걸어 건넌다(물에 안 빠지고 길이 이어진다)
			if _frame == 1:
				var b := TestMap.world_pos(5, 7)
				_teleport(Vector3(b.x, 3.0, b.z - 26.0))
				_x0 = b.z
			if _frame == 30:
				Input.action_press("move_back")
			if _frame == 300:
				_check("bridge_mid", _p.mode == _p.Mode.GROUND and absf(_p.global_position.z - _x0) < 12.0, "mode=%d %s mid_z=%.1f" % [_p.mode, _pos(), _x0])
			if _frame == 640:
				Input.action_release("move_back")
				_check("bridge_cross", _p.mode == _p.Mode.GROUND and _p.global_position.z > _x0 + 18.0, "mode=%d %s mid_z=%.1f" % [_p.mode, _pos(), _x0])
				_next()
		17:
			print("TRAVERSAL_PROBE_DONE fails=%d" % _fails)
			get_tree().quit()

## G-0025 — 지금 틀고 있는 동작이 그 상태의 클립인지(클립이 없는 몸은 물러선 동작인지).
func _check_pose(name: String, clip: String, fallback: String) -> void:
	var has: bool = _p._anim != null and _p._anim.has_animation(clip)
	var want := clip if has else fallback
	_check(name, _p._current_anim == want, "now=%s want=%s has_clip=%s" % [_p._current_anim, want, str(has)])
	## 창 모드로 돌릴 때만(SAGA_TRAVERSAL_SHOTS=<절대 경로>) 그 순간의 화면을 PNG 로 — 동작이 보기에 맞는지 눈으로 볼 때 쓴다.
	var dir := OS.get_environment("SAGA_TRAVERSAL_SHOTS")
	if dir != "":
		_shot(dir, name)

## 화면 글자판(CanvasLayer)을 숨기고 화면을 PNG 로 — 몸 동작이 글자판에 안 가리게.
func _shot(dir: String, name: String) -> void:
	var hidden: Array = []
	for n in get_tree().root.find_children("*", "CanvasLayer", true, false):
		if (n as CanvasLayer).visible:
			(n as CanvasLayer).visible = false
			hidden.append(n)
	await RenderingServer.frame_post_draw
	var img := get_viewport().get_texture().get_image()
	for n in hidden:
		(n as CanvasLayer).visible = true
	img.save_png("%s/%s.png" % [dir, name])

func _teleport(pos: Vector3) -> void:
	_p.global_position = pos
	_p.velocity = Vector3.ZERO

func _pos() -> String:
	var p := _p.global_position
	return "pos=(%.1f, %.2f, %.1f)" % [p.x, p.y, p.z]

func _check(name: String, ok: bool, detail: String) -> void:
	if not ok:
		_fails += 1
	print("TRAVERSAL_PROBE %s %s %s" % [name, "ok" if ok else "FAIL", detail])

func _next() -> void:
	_step += 1
	_frame = 0
