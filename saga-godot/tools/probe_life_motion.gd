extends SceneTree
## G-0412: 실제 dex 몸 둘에서 GO 배선·호흡 주기·클립 평균 둘레 팔 보정·행동 제외.
const Body := preload("res://saga_core/world/vroid_body.gd")
const Life := preload("res://saga_core/world/life_pose.gd")
var fails := 0

func check(ok: bool, label: String) -> void:
	if not ok:
		fails += 1
		print("FAIL life_motion ", label)

func _initialize() -> void:
	_run.call_deferred()

func _sample(ap: AnimationPlayer, sk: Skeleton3D, lp: Node, clip: String, time: float, on: bool, clock: float) -> Dictionary:
	ap.play(clip, 0.0)
	ap.seek(time, true)
	ap.advance(0.0)
	lp.call("set_motion_layers", on)
	lp.call("step", 0.3)
	lp.set("_clock", clock)
	var out := {}
	var read := func() -> void:
		for name in ["J_Bip_C_Chest", "J_Bip_L_Shoulder", "J_Bip_R_Shoulder", "J_Bip_L_UpperArm", "J_Bip_R_UpperArm", "J_Bip_C_Hips"]:
			var b := sk.find_bone(name)
			if b >= 0:
				out[name] = sk.get_bone_pose_rotation(b)
	sk.skeleton_updated.connect(read, CONNECT_ONE_SHOT)
	sk.advance(0.016)
	for i in 10:
		if not out.is_empty():
			break
		await process_frame
	if out.is_empty():
		if sk.skeleton_updated.is_connected(read):
			sk.skeleton_updated.disconnect(read)
		check(false, "뼈 갱신 신호 없음")
	return out

func _angle(a: Dictionary, b: Dictionary, name: String) -> float:
	if not a.has(name) or not b.has(name):
		check(false, "필수 뼈 없음 " + name)
		return INF
	return rad_to_deg((a[name] as Quaternion).angle_to(b[name]))

func _spring_frame(ap: AnimationPlayer, sk: Skeleton3D) -> Dictionary:
	ap.seek(0.0, true)
	ap.advance(0.0)
	var out := {}
	var read := func() -> void:
		for b in sk.get_bone_count():
			out[sk.get_bone_name(b)] = sk.get_bone_pose_rotation(b)
	sk.skeleton_updated.connect(read, CONNECT_ONE_SHOT)
	sk.advance(1.0 / 60.0)
	await process_frame
	return out

func _check_springs(id: String, v: Node3D, ap: AnimationPlayer, sk: Skeleton3D, lp: Node) -> void:
	var spring := Body.attach_springs(v)
	check(spring != null and spring.get_setting_count() > 0, id + " 보조 뼈 스프링 연결")
	if spring == null:
		return
	check(Body.attach_springs(v) == spring, id + " 스프링 중복 안 붙임")
	for i in spring.get_setting_count():
		for j in spring.get_joint_count(i):
			check(Body._spring_bone(spring.get_joint_bone_name(i, j)), id + " 머리·옷 뼈만 수정")
		check(spring.get_center_bone(i) == sk.find_bone("J_Bip_C_Hips"), id + " 골반 기준")
	lp.call("set_hold", false)
	lp.call("set_motion_layers", false)
	ap.play("idle", 0.0)
	spring.influence = 0.0
	var base := await _spring_frame(ap, sk)
	spring.influence = 1.0
	spring.reset()
	spring.set_external_force(Vector3(0.2, 0, 0))
	var peak := 0.0
	var residual := 0.0
	for f in 150:
		if f == 20:
			spring.set_external_force(Vector3.ZERO)
		var pose := await _spring_frame(ap, sk)
		var angle := 0.0
		for name in pose:
			if Body._spring_bone(name):
				var q: Quaternion = pose[name]
				check(q.is_finite(), id + " 스프링 유한 회전")
				angle = maxf(angle, _angle(base, pose, name))
		if f < 40:
			peak = maxf(peak, angle)
		if f >= 140:
			residual = maxf(residual, angle)
		check(_angle(base, pose, "J_Bip_C_Chest") < 0.05, id + " 스프링이 몸통 안 바꿈")
	check(peak > 0.05, id + " 실제 흔들림 발생")
	check(residual < peak * 0.25, id + " 힘 해제 뒤 감쇠")
	print("LIFE_SPRING_BODY ", id, " chains=", spring.get_setting_count(), " peak_deg=", peak, " residual_deg=", residual)

func _run() -> void:
	if not Body.dex_available():
		check(false, "실제 몸 없음 — 건너뛰기를 통과로 처리하지 않음")
	else:
		for id in ["self", "sg_xiahoudun"]:
			var v := Body.build_hero(id)
			root.add_child(v)
			var sk := v.find_children("*", "Skeleton3D", true, false)[0] as Skeleton3D
			sk.modifier_callback_mode_process = Skeleton3D.MODIFIER_CALLBACK_MODE_PROCESS_MANUAL
			var ap := v.get_node("AnimationPlayer") as AnimationPlayer
			ap.callback_mode_process = AnimationMixer.ANIMATION_CALLBACK_MODE_PROCESS_MANUAL
			var player := load("res://games/saga_go/player/go_player.gd").new() as CharacterBody3D
			player.set("visual", v)
			player.call("_attach_foot_lock")
			var lp: Node = player.get("_life")
			check(lp != null and bool(lp.get("_motion_layers")), id + " GO 플레이어 연결")
			player.free()
			if lp == null:
				v.free()
				continue
			lp.set_process(false)
			for mod in sk.get_children():
				if mod is SkeletonModifier3D and mod != lp:
					mod.influence = 0.0
			var base := await _sample(ap, sk, lp, "idle", 0.0, false, 0.6)
			var inhale := await _sample(ap, sk, lp, "idle", 0.0, true, 0.6)
			var exhale := await _sample(ap, sk, lp, "idle", 0.0, true, 1.8)
			var repeat := await _sample(ap, sk, lp, "idle", 0.0, true, 3.0)
			var chest := _angle(base, inhale, "J_Bip_C_Chest")
			check(absf(chest - 1.5) < 0.05, id + " 가슴 호흡 1.5도: %.3f" % chest)
			check(_angle(inhale, exhale, "J_Bip_C_Chest") > 2.9, id + " 들숨·날숨 반대 방향")
			check(_angle(inhale, repeat, "J_Bip_C_Chest") < 0.05, id + " 2.4초 주기")
			check(_angle(base, inhale, "J_Bip_C_Hips") < 0.05, id + " 호흡 때 골반 고정")
			for side in ["L", "R"]:
				var name := "J_Bip_%s_Shoulder" % side
				check(absf(_angle(base, inhale, name) - 1.0) < 0.05, id + " 어깨 호흡 1도 " + side)
			for clip in ["walk", "sprint", "run"]:
				if not ap.has_animation(clip):
					continue
				var changed := false
				for t in [0.2, 0.6]:
					var a := ap.get_animation(clip)
					var before := await _sample(ap, sk, lp, clip, a.length * t, false, 0.6)
					var after := await _sample(ap, sk, lp, clip, a.length * t, true, 0.6)
					for side in ["L", "R"]:
						var name := "J_Bip_%s_UpperArm" % side
						var mean: Quaternion = lp.call("_arm_mean", a, name)
						var old := rad_to_deg(mean.angle_to(before[name]))
						var now := rad_to_deg(mean.angle_to(after[name]))
						check(absf(now - old * 1.3) < 0.1, "%s %s %s 평균 둘레 1.3배: %.2f→%.2f" % [id, clip, side, old, now])
						changed = changed or _angle(before, after, name) > 0.05
					check(_angle(before, after, "J_Bip_C_Chest") < 0.05, id + " 이동 중 호흡 안 섞음")
				check(changed, id + " " + clip + " 실제 팔 변화")
			for clip in ["attack", "hit", "jump", "death"]:
				if not ap.has_animation(clip):
					continue
				var before := await _sample(ap, sk, lp, clip, 0.2, false, 0.6)
				var after := await _sample(ap, sk, lp, clip, 0.2, true, 0.6)
				check(_angle(before, after, "J_Bip_C_Chest") < 0.05 and _angle(before, after, "J_Bip_R_UpperArm") < 0.05, id + " " + clip + " 보정 제외")
			lp.call("set_hold", true)
			var held := await _sample(ap, sk, lp, "idle", 0.0, true, 0.6)
			check(_angle(base, held, "J_Bip_C_Chest") < 0.05, id + " hold 중 호흡 제외")
			print("LIFE_MOTION_BODY ", id, " chest_deg=", chest)
			await _check_springs(id, v, ap, sk, lp)
			v.free()
	print("PROBE life_motion ", "OK" if fails == 0 else "FAIL %d" % fails)
	quit(0 if fails == 0 else 1)
