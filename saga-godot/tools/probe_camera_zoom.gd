extends SceneTree

## G-0294 카메라 줌 범위 자동 점검(웹 W-0324 짝) —
##   godot --headless --path saga-godot --script res://tools/probe_camera_zoom.gd   → "PROBE camera_zoom OK" / "FAIL n"
## ① 1만리: 기본 8 그대로 · 휠 가까이 끝 2.2 · 멀리 끝 16 ② 2나락·3마을(dungeon_camera_rig): 기본 배율 1(끈 길이 그대로) ·
##    휠 위 한 칸에 가까워짐 · 끝 0.2·1.8 ③ 4종횡(story_camera): 기본 1 · 가까이 끝에서 카메라 z = Z_DISTANCE × 0.18
## 휠은 InputEventMouseButton 을 그 노드의 입력 함수에 직접 넘긴다(헤드리스).

const SCENES := {"go": "res://games/saga_go/world/TestVillage.tscn", "dungeon": "res://games/saga_dungeon/world/TestRoom.tscn",
	"forest": "res://games/saga_forest/world/TestVillageForest.tscn", "story": "res://games/saga_story/world/SinyaField.tscn"}

var fails := 0


func _fail(msg: String) -> void:
	fails += 1
	print("  FAIL ", msg)


func _wheel(up: bool) -> InputEventMouseButton:
	var ev := InputEventMouseButton.new()
	ev.button_index = MOUSE_BUTTON_WHEEL_UP if up else MOUSE_BUTTON_WHEEL_DOWN
	ev.pressed = true
	return ev


func _init() -> void:
	await process_frame
	for g in SCENES:
		var sc := (load(SCENES[g]) as PackedScene).instantiate()
		root.add_child(sc)
		current_scene = sc
		for _i in 20:
			await process_frame
		for m in get_nodes_in_group("ui_modal"):
			m.remove_from_group("ui_modal")
		match g:
			"go":
				var rig := get_first_node_in_group("camera_rig")
				var arm: SpringArm3D = rig.get("spring_arm")
				if not is_equal_approx(arm.spring_length, 8.0):
					_fail("① 1만리 기본 %.1f != 8" % arm.spring_length)
				for _k in 30:
					rig.call("_zoom", -1.0)
				var near := arm.spring_length
				for _k in 30:
					rig.call("_zoom", 1.0)
				if not is_equal_approx(near, 2.2) or not is_equal_approx(arm.spring_length, 16.0):
					_fail("① 1만리 끝 %.2f·%.2f != 2.2·16" % [near, arm.spring_length])
				print("ZOOM go %.2f~%.2f" % [near, arm.spring_length])
			"dungeon", "forest":
				var rig := get_first_node_in_group("camera_rig")
				var arm: SpringArm3D = rig.get("_arm")
				var base := float(rig.get("spring_length"))
				if not is_equal_approx(arm.spring_length, base):
					_fail("② %s 기본 끈 %.1f != %.1f" % [g, arm.spring_length, base])
				rig.call("_unhandled_input", _wheel(true))
				if arm.spring_length >= base:
					_fail("② %s 휠 위인데 안 가까워짐" % g)
				for _k in 40:
					rig.call("_unhandled_input", _wheel(true))
				var near := float(rig.get("zoom_mul"))
				for _k in 40:
					rig.call("_unhandled_input", _wheel(false))
				if not is_equal_approx(near, 0.2) or not is_equal_approx(float(rig.get("zoom_mul")), 1.8):
					_fail("② %s 끝 %.2f·%.2f" % [g, near, rig.get("zoom_mul")])
				print("ZOOM %s %.2f~%.2f (끈 %.1f)" % [g, near, rig.get("zoom_mul"), base])
				rig.call("set_zoom", 1.0)
			"story":
				var cam := get_first_node_in_group("camera_rig") as Camera3D
				var zd := float(cam.get("Z_DISTANCE"))
				if not is_equal_approx(cam.global_position.z, zd):
					_fail("③ 4종횡 기본 z %.2f != %.2f" % [cam.global_position.z, zd])
				for _k in 40:
					cam.call("_unhandled_input", _wheel(true))
				await process_frame
				if not is_equal_approx(cam.global_position.z, zd * 0.18):
					_fail("③ 4종횡 가까이 끝 z %.2f != %.2f" % [cam.global_position.z, zd * 0.18])
				print("ZOOM story z %.2f" % cam.global_position.z)
		sc.queue_free()
		for _k in 3:
			await process_frame
	print("PROBE camera_zoom ", "OK" if fails == 0 else "FAIL %d" % fails)
	quit(1 if fails > 0 else 0)
