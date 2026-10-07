extends SceneTree
## 사가만리 마을에서 가장 가까운 적 곁에 서서 공격 단추를 눌러 가며 몇 프레임 간격으로 화면을 PNG 로 — 움직임(휘두르기·타격 연출)을 눈으로 볼 때(평소엔 안 쓴다).
##
##   SAGA_MOTION_OUT=<절대 경로 폴더> "$GODOT_CONSOLE" --path saga-godot --rendering-method mobile --position -4000,0 --resolution 1280x720 --script res://tools/snap_motion.gd </dev/null
##
## SAGA_MOTION_STEP(기본 6) 프레임마다 한 장, SAGA_MOTION_COUNT(기본 8) 장. 저장은 안 한다.

var _frame := 0
var _p: Node3D
var _step := 6
var _count := 8
var _shots := 0
var _t0 := 80

func _initialize() -> void:
	var packed := load("res://games/saga_go/world/TestVillage.tscn") as PackedScene
	root.add_child(packed.instantiate())
	if OS.get_environment("SAGA_MOTION_STEP") != "":
		_step = int(OS.get_environment("SAGA_MOTION_STEP"))
	if OS.get_environment("SAGA_MOTION_COUNT") != "":
		_count = int(OS.get_environment("SAGA_MOTION_COUNT"))

func _process(_delta: float) -> bool:
	_frame += 1
	if _p == null:
		_p = get_first_node_in_group("player") as Node3D
		return false
	if _frame == 30:
		var best: Node3D = null
		var bd := 1e9
		for e in get_nodes_in_group("field_enemy"):
			if e.call("is_dead"):
				continue
			var d := (e as Node3D).global_position.distance_to(_p.global_position)
			if d < bd:
				bd = d
				best = e as Node3D
		if best != null:
			_p.global_position = best.global_position + Vector3(0, 0.3, 2.2)
			_p.velocity = Vector3.ZERO
			_p.call("face_toward", best.global_position)
	if _frame == 60:
		Input.action_press("combat_quick")
	if _frame == 64:
		Input.action_release("combat_quick")
	if _frame >= _t0 and (_frame - _t0) % _step == 0 and _shots < _count:
		if _frame % 20 == 0 or _shots == 0:
			Input.action_press("combat_quick")
		else:
			Input.action_release("combat_quick")
		root.get_texture().get_image().save_png("%s/motion_%02d.png" % [OS.get_environment("SAGA_MOTION_OUT"), _shots])
		_shots += 1
	if _shots >= _count:
		print("MOTION_OK ", _shots)
		quit()
	return false
