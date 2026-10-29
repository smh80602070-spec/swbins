extends SceneTree
## G-0412: 실제 AnimationPlayer의 중간 자세·재시작 방지·공격 창 회귀.

var fails := 0

func check(ok: bool, label: String) -> void:
	if not ok:
		fails += 1
		print("FAIL motion_blend ", label)

func _initialize() -> void:
	await process_frame
	var body := Node3D.new()
	root.add_child(body)
	var target := Node3D.new()
	target.name = "Target"
	body.add_child(target)
	var ap := AnimationPlayer.new()
	body.add_child(ap)
	ap.callback_mode_process = AnimationMixer.ANIMATION_CALLBACK_MODE_PROCESS_MANUAL
	var lib := AnimationLibrary.new()
	var names := ["idle", "walk", "attack", "hit"]
	for i in names.size():
		var a := Animation.new()
		a.length = 1.57
		var tr := a.add_track(Animation.TYPE_VALUE)
		a.track_set_path(tr, NodePath("Target:position"))
		a.track_insert_key(tr, 0.0, Vector3(float(i), 0, 0))
		lib.add_animation(names[i], a)
	ap.add_animation_library("", lib)
	var player := load("res://saga_core/player/player.gd").new() as CharacterBody3D
	player.set("_anim", ap)
	player.call("_play_anim", "idle")
	ap.advance(0.2)
	player.call("_play_anim", "walk")
	ap.advance(0.0)
	ap.advance(0.05)
	ap.advance(0.01)
	check(target.position.x > 0.0 and target.position.x < 1.0, "idle→walk 중간 자세")
	var pos := ap.current_animation_position
	player.call("_play_anim", "walk")
	check(is_equal_approx(pos, ap.current_animation_position), "같은 이동 재시작 안 함")
	ap.advance(0.2)
	ap.advance(0.0)
	check(absf(target.position.x - 1.0) < 0.0001, "이동 전환 완료")
	player.call("play_once", "attack", 0.5)
	ap.advance(0.02)
	ap.advance(0.01)
	check(target.position.x > 1.0 and target.position.x < 2.0, "이동→공격 중간 자세")
	check(is_equal_approx(ap.speed_scale, 1.3), "공격 창 빠르기 유지")
	check(is_equal_approx(float(player.call("_motion_blend", "hit")), 0.05), "피격 반응 0.05초")
	player.set("_once_until", 0)
	player.call("_play_anim", "idle")
	check(is_equal_approx(ap.speed_scale, 1.0), "공격 종료 빠르기 복원")
	check(is_equal_approx(float(player.call("_motion_blend", "walk")), 0.15), "이동 기본 0.15초")
	player.free()
	var go := load("res://games/saga_go/player/go_player.gd").new() as CharacterBody3D
	go.set("_anim", ap)
	go.set("_current_anim", "walk")
	go.call("play_action", "attack", 0.5, 0.25)
	check(is_equal_approx(ap.current_animation_position, 0.3), "GO 공격 창 시작 유지")
	check(is_equal_approx(ap.speed_scale, 1.3), "GO 공격 창 빠르기 유지")
	go.set("_action_t", 0.0)
	go.call("_play_anim", "idle")
	check(is_equal_approx(ap.speed_scale, 1.0), "GO 공격 종료 빠르기 복원")
	go.free()
	var combat_lib := AnimationLibrary.new()
	var combat_anim := Animation.new()
	combat_anim.length = 1.0
	combat_anim.set_meta("strike_time", 0.4)
	combat_lib.add_animation("spear_1", combat_anim)
	ap.add_animation_library("combat", combat_lib)
	var motion_go := load("res://games/saga_go/player/go_player.gd").new() as CharacterBody3D
	motion_go.set("_anim", ap)
	motion_go.call("play_action", "combat/spear_1", 0.5, 0.25)
	check(ap.current_animation == "combat/spear_1", "전투 팩 클립 재생")
	check(is_equal_approx(ap.speed_scale, 1.4), "움츠림 속도 0.7배")
	check(is_equal_approx(float(motion_go.get("_action_t")), 0.4 / 1.4 + 0.6 / 3.2 + 0.12), "타격 가속 뒤 0.12초 여운")
	motion_go.call("_set_combat_speed", "combat/spear_1", 3.2)
	check(is_equal_approx(ap.speed_scale, 3.2), "타격 구간 1.6배")
	motion_go.call("_hold_combat_pose", "combat/spear_1")
	check(is_zero_approx(ap.speed_scale), "끝 자세 멈춤")
	motion_go.free()
	body.free()
	print("PROBE motion_blend ", "OK" if fails == 0 else "FAIL %d" % fails)
	quit(0 if fails == 0 else 1)
