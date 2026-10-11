extends SceneTree

## G-0192 4종횡 세계 흔들림 자동 점검(games/saga_story/world/story_camera.gd shake · story_player.gd take_damage).
##   godot --headless --path saga-godot --script res://tools/probe_story_shake.gd
## ① 사냥터 카메라가 "camera_rig" 그룹(combat_feel 이 찾는 자리) ② 때림 손맛(CombatFeel._do_shake) → 흔들림, 120ms 뒤 제자리(흔들림 뺀 자리 = 플레이어 x)
## ③ 내가 맞으면(take_damage) 더 세게(0.12m) 흔들림 · 무적 중이면 안 흔들림. 세이브 안 건드림. 끝에 "PROBE story_shake OK|FAIL n".

const SCENE := "res://games/saga_story/world/TestField.tscn"

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


func _initialize() -> void:
	var scene: Node = (load(SCENE) as PackedScene).instantiate()
	root.add_child(scene)
	current_scene = scene
	await _frames(20)
	var cam := get_first_node_in_group("camera_rig") as Camera3D
	var player := get_first_node_in_group("player") as Node3D
	check(cam != null and cam.has_method("shake") and cam.get_script().resource_path.ends_with("story_camera.gd"), "사냥터 카메라가 camera_rig 그룹·shake() 를 가짐")
	if cam != null and player != null:
		root.get_node("CombatFeel").call("_do_shake", 1.0)
		await process_frame
		var shaking_hit: bool = cam.call("is_shaking")
		var amp_hit := float(cam.get("_shake_amp_m"))
		await create_timer(0.25).timeout
		await process_frame
		var settled := not bool(cam.call("is_shaking")) and cam.global_position.is_equal_approx(cam.get("_base")) and absf(cam.global_position.x - player.global_position.x) < 0.01
		check(shaking_hit and is_equal_approx(amp_hit, 0.06) and settled, "때림 손맛 → 흔들림 0.06m · 120ms 뒤 제자리(x = 플레이어 x)")
		player.set("_invuln_time_left", 0.0)
		player.set("_parry_time_left", 0.0)
		player.call("take_damage", 5.0)
		await process_frame
		check(bool(cam.call("is_shaking")) and is_equal_approx(float(cam.get("_shake_amp_m")), 0.12), "맞으면 흔들림 0.12m(때릴 때보다 셈)")
		await create_timer(0.3).timeout
		player.set("_invuln_time_left", 5.0)
		player.call("take_damage", 5.0)
		await process_frame
		check(not bool(cam.call("is_shaking")), "무적 중엔 안 맞으니 안 흔들림")
	scene.queue_free()
	await _frames(3)
	print("PROBE story_shake ", "OK" if fails == 0 else "FAIL %d" % fails)
	quit(1 if fails > 0 else 0)
