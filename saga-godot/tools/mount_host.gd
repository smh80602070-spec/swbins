extends Node
## 탈것(player/mount.gd)을 GO 말고 다른 판(DUNGEON·FOREST)에서 점검하는 호스트 — 일반 씬 실행으로 띄워 대상 씬을 자식으로 싣는다.
##   SAGA_MOUNT_ALL=1 godot --headless --path . res://tools/mount_host.tscn -- res://games/saga_dungeon/world/TestRoom.tscn
## ① Mount 노드 있음 ② 땅 탈것: 이동이 빨라짐 ③ 나는 탈것: 떠올랐다가 손 떼면 내려앉아 땅에 섬 ④ 내리면 배율 복귀.
## 끝에 MOUNT_HOST_DONE fails=N.

var _fails := 0
var _scene: Node
var _p: CharacterBody3D
var _m: Node

func _ready() -> void:
	get_tree().create_timer(90.0).timeout.connect(func() -> void:
		print("MOUNT_HOST_DONE fails=-1 (시간 초과)")
		get_tree().quit(3))
	var args := OS.get_cmdline_user_args()
	_scene = (load(args[0]) as PackedScene).instantiate()
	add_child(_scene)
	get_tree().current_scene = _scene
	for _i in 30:
		await get_tree().physics_frame
	_p = get_tree().get_first_node_in_group("player") as CharacterBody3D
	_m = _p.get_node_or_null("Mount") if _p else null
	_check("node", _m != null, str(args[0]))
	if _m == null:
		print("MOUNT_HOST_DONE fails=%d" % _fails)
		get_tree().quit()
		return
	if OS.get_environment("SAGA_MOUNT_ALL") == "":
		_check("fresh_locked", (_m.call("owned") as Array).is_empty(), "%s progress=%s scene=%s" % [str(_m.call("owned")), str(_m.call("game_progress")), get_tree().current_scene.scene_file_path])
	else:
		_check("all_open", (_m.call("owned") as Array).size() == 6, str(_m.call("owned")))
	var x0 := _p.global_position.x
	Input.action_press("move_right")
	for _i in 30:
		await get_tree().physics_frame
	var v_walk := absf(_p.global_position.x - x0) / 0.5
	Input.action_release("move_right")
	for _i in 20:
		await get_tree().physics_frame
	_m.call("mount", "pt_jeolyeong")
	for _i in 10:
		await get_tree().physics_frame
	_check("mounted", bool(_p.get("mounted")) and float(_p.get("ride_height")) > 0.5, "ride=%.2f" % float(_p.get("ride_height")))
	x0 = _p.global_position.x
	Input.action_press("move_left")
	for _i in 30:
		await get_tree().physics_frame
	var v_ride := absf(_p.global_position.x - x0) / 0.5
	Input.action_release("move_left")
	_check("ground_speed", v_ride > v_walk * 1.3, "walk=%.1f ride=%.1f" % [v_walk, v_ride])
	_m.call("dismount", "")
	for _i in 30:
		await get_tree().physics_frame
	_check("dismount_reset", is_equal_approx(float(_p.get("mount_speed_mul")), 1.0) and is_equal_approx(float(_p.get("ride_height")), 0.0), "")
	_m.call("mount", "pt_samjogo")
	var peak := _p.global_position.y
	Input.action_press("jump")
	for _i in 90:
		await get_tree().physics_frame
		peak = maxf(peak, _p.global_position.y)
	Input.action_release("jump")
	_check("fly_rise", peak > 6.0 and bool(_p.call("is_flying_now")), "peak=%.1f" % peak)
	Input.action_press("run")
	if InputMap.has_action("story_dash"):
		Input.action_press("story_dash") # 사가스토리는 내려가기가 story_dash
	for _i in 260:
		await get_tree().physics_frame
		if OS.get_environment("SAGA_HOST_DEBUG") != "" and _i % 40 == 0:
			print("HOSTDBG y=%.2f vy=%.2f fly=%s" % [_p.global_position.y, _p.velocity.y, str(_p.get("fly_on"))])
	Input.action_release("run")
	if InputMap.has_action("story_dash"):
		Input.action_release("story_dash")
	_check("fly_land", _p.is_on_floor() and not bool(_p.call("is_flying_now")) and bool(_p.get("mounted")), "y=%.1f" % _p.global_position.y)
	_m.call("dismount", "")
	print("MOUNT_HOST_DONE fails=%d" % _fails)
	get_tree().quit()

func _check(name: String, ok: bool, detail: String) -> void:
	if not ok:
		_fails += 1
	print("MOUNT_HOST %s %s %s" % [name, "ok" if ok else "FAIL", detail])
