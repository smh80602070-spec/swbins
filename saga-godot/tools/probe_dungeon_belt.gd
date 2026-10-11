extends SceneTree

## G-0185 2나락 벨트 카메라 자동 점검(saga_core/player/dungeon_camera_rig.gd belt).
##   godot --headless --path saga-godot --script res://tools/probe_dungeon_belt.gd
## ① 초점 순수 함수: 방 양 끝에서 z 가 방 가운데 ±2.5 에 멈춤 · 통로에선 그대로 · x 는 방 가운데
## ② 실제 TestRoom: 리그가 top_level·yaw 90·pitch −42 · 입력 "오른쪽" → 월드 −z(다음 방 쪽), "위" → −x(화면 안쪽)
## ③ 방 끝에 서면 카메라 초점 z 가 방 가운데 +2.5 로 멈춘다 · 통로로 나가면 따라간다
## ④ SAGA_DG_CAM=diablo 면 옛 시점(플레이어 자식·pitch 55·yaw 0)
## ⑤ 3마을 몸(ForestPlayer.tscn)은 belt=false 그대로. 저장은 안 한다. 끝에 "PROBE dungeon_belt OK|FAIL n".

const Rig := preload("res://saga_core/player/dungeon_camera_rig.gd")
const ROOM := "res://games/saga_dungeon/world/TestRoom.tscn"

var fails := 0


func check(cond: bool, msg: String) -> void:
	if cond:
		print("  ok   ", msg)
	else:
		fails += 1
		print("  FAIL ", msg)


func _frames(n: int) -> void:
	for i in n:
		await process_frame


func _open() -> Node:
	var scene: Node = (load(ROOM) as PackedScene).instantiate()
	root.add_child(scene)
	current_scene = scene
	await _frames(20)
	return scene


func _close(scene: Node) -> void:
	scene.queue_free()
	await _frames(3)


func _initialize() -> void:
	# ①
	var rooms := [{"z0": 6.0, "z1": -6.0, "cx": 0.0}, {"z0": -14.0, "z1": -26.0, "cx": 0.0}]
	var f_south: Vector3 = Rig.belt_focus(Vector3(4.0, 0.0, 5.9), rooms)
	var f_north: Vector3 = Rig.belt_focus(Vector3(-3.0, 0.0, -5.9), rooms)
	var f_corr: Vector3 = Rig.belt_focus(Vector3(1.0, 0.0, -10.0), rooms)
	var f_r1: Vector3 = Rig.belt_focus(Vector3(0.0, 0.0, -25.0), rooms)
	check(is_equal_approx(f_south.z, 2.5) and is_equal_approx(f_north.z, -2.5) and is_equal_approx(f_south.x, 0.0) and is_equal_approx(f_corr.z, -10.0) and is_equal_approx(f_r1.z, -22.5),
		"초점: 방 끝 z 5.9 → 2.5 · −5.9 → −2.5 · 통로 −10 그대로 · 둘째 방 −25 → −22.5 · x 는 방 가운데")

	# ② ③
	var scene := await _open()
	var rig := get_first_node_in_group("camera_rig") as Node3D
	var player := get_first_node_in_group("player") as Node3D
	if rig == null or player == null:
		check(false, "리그·플레이어를 못 찾음")
	else:
		var rot := rig.rotation_degrees
		check(bool(rig.get("_belt_on")) and rig.is_set_as_top_level() and is_equal_approx(rot.x, -Rig.BELT_PITCH) and is_equal_approx(rot.y, Rig.BELT_YAW), "벨트 켜짐: top_level · pitch %.0f · yaw %.0f" % [rot.x, rot.y])
		var right: Vector3 = player.call("_world_direction", Vector2(1, 0))
		var up: Vector3 = player.call("_world_direction", Vector2(0, 1))
		check(right.distance_to(Vector3(0, 0, -1)) < 0.01 and up.distance_to(Vector3(-1, 0, 0)) < 0.01, "입력 오른쪽 → %s(다음 방 −z) · 위 → %s(화면 안쪽 −x)" % [str(right.snapped(Vector3.ONE * 0.01)), str(up.snapped(Vector3.ONE * 0.01))])
		player.global_position = Vector3(2.0, player.global_position.y, 5.5)
		await _frames(90)
		var z_end := rig.global_position.z
		player.global_position = Vector3(0.0, player.global_position.y, -10.0)
		await _frames(90)
		var z_corr := rig.global_position.z
		check(absf(z_end - 2.5) < 0.3 and absf(z_corr - (-10.0)) < 0.5 and absf(rig.global_position.x) < 0.3, "방 끝에 서면 초점 z %.2f(→2.5)에서 멈춤 · 통로로 나가면 %.2f(→−10) 따라감" % [z_end, z_corr])
	await _close(scene)

	# ④
	OS.set_environment("SAGA_DG_CAM", "diablo")
	var scene2 := await _open()
	var rig2 := get_first_node_in_group("camera_rig") as Node3D
	check(rig2 != null and not bool(rig2.get("_belt_on")) and not rig2.is_set_as_top_level() and is_equal_approx(rig2.rotation_degrees.x, -55.0) and is_equal_approx(rig2.rotation_degrees.y, 0.0), "SAGA_DG_CAM=diablo → 옛 시점(자식·pitch −55·yaw 0)")
	await _close(scene2)
	OS.set_environment("SAGA_DG_CAM", "")

	# ⑤
	var fp: Node = (load("res://games/saga_forest/player/ForestPlayer.tscn") as PackedScene).instantiate()
	var frig := fp.get_node_or_null("CameraRig")
	check(frig != null and not bool(frig.get("belt")), "3마을 몸: belt=false 그대로(pitch_deg %.0f — tscn 의 62 는 앞 ## 줄 때문에 안 먹는다, G-0186 메모)" % float(frig.get("pitch_deg")))
	fp.free()

	print("PROBE dungeon_belt ", "OK" if fails == 0 else "FAIL %d" % fails)
	quit(1 if fails > 0 else 0)
