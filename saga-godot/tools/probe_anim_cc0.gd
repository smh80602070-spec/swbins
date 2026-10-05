extends SceneTree
## CC0 동작 묶음(assets/characters_vroid/anim_cc0/*_lib.res, tools/ual_lib_build.gd)을 실제 VRoid 몸에 틀어 본다.
## 몸마다: 게임이 부르는 여덟 동작이 다 있나 · 이동 셋은 반복인가 · 뼈가 실제로 움직이나 ·
## 이동 셋에서 낮은 발이 땅(쉼 높이 ±1cm)에 닿나 · 서 있기에서 두 위팔이 아래를 향하나(팔이 머리 위로 간 옛 버그 막이).
##
## 사용법: Godot_..._console.exe --headless --path saga-godot --script tools/probe_anim_cc0.gd
## 출력: PROBE_ANIM {...} 한 줄씩 + RESULT n/n

const LIB_DIR := "res://assets/characters_vroid/anim_cc0"  # 여기 있는 <몸>_lib.res 전부(새 주역이 들어오면 저절로 점검된다)
const CLIPS := ["idle", "walk", "sprint", "attack", "hit", "dodge", "death", "pickup"]
const LOOPS := ["idle", "walk", "sprint"]
const FEET := ["J_Bip_L_Foot", "J_Bip_R_Foot"]

var _done := false


func _process(_delta: float) -> bool:
	if _done:
		return true
	_done = true
	var ok := 0
	var total := 0
	var bodies: Array[String] = []
	for f in DirAccess.get_files_at(LIB_DIR):
		## 몸 없이 여럿이 같이 쓰는 라이브러리(dex_common_lib — probe_dex_bodies 가 본다)는 건너뛴다.
		if f.ends_with("_lib.res") and ResourceLoader.exists("res://assets/characters_vroid/%s.glb" % f.trim_suffix("_lib.res")):
			bodies.append(f.trim_suffix("_lib.res"))
	bodies.sort()
	for body in bodies:
		total += 1
		var fails: Array = []
		var inst: Node3D = (load("res://assets/characters_vroid/%s.glb" % body) as PackedScene).instantiate()
		root.add_child(inst)
		var skel: Skeleton3D = inst.find_children("*", "Skeleton3D", true, false)[0]
		var ap := AnimationPlayer.new()
		inst.add_child(ap)
		var lib: AnimationLibrary = load("%s/%s_lib.res" % [LIB_DIR, body])
		ap.add_animation_library("", lib)
		var rest_y := {}
		for f in FEET:
			rest_y[f] = skel.get_bone_global_rest(skel.find_bone(f)).origin.y
		var moved_min := 999
		for clip in CLIPS:
			if not ap.has_animation(clip):
				fails.append(clip + " 없음")
				continue
			var anim := ap.get_animation(clip)
			if LOOPS.has(clip) and anim.loop_mode == Animation.LOOP_NONE:
				fails.append(clip + " 반복 아님")
			ap.play(clip)
			var low := 999.0
			var moved := 0
			for i in 9:
				ap.seek(anim.length * i / 8.0, true)
				for f in FEET:
					var b := skel.find_bone(f)
					low = minf(low, skel.get_bone_global_pose(b).origin.y - rest_y[f])
				if i == 4:
					for b in skel.get_bone_count():
						if skel.get_bone_name(b).begins_with("J_Bip_") and \
								skel.get_bone_pose_rotation(b).angle_to(skel.get_bone_rest(b).basis.get_rotation_quaternion()) > 0.02:
							moved += 1
					if clip == "idle":
						for side in ["L", "R"]:
							var ua := skel.get_bone_global_pose(skel.find_bone("J_Bip_%s_UpperArm" % side)).origin
							var la := skel.get_bone_global_pose(skel.find_bone("J_Bip_%s_LowerArm" % side)).origin
							var d := (la - ua).normalized()
							if d.y > -0.5:
								fails.append("idle %s 위팔이 아래를 안 봄(y=%.2f)" % [side, d.y])
			moved_min = mini(moved_min, moved)
			if moved < 10:
				fails.append("%s 움직인 뼈 %d" % [clip, moved])
			if LOOPS.has(clip) and absf(low) > 0.01:
				fails.append("%s 낮은 발 %.3fm" % [clip, low])
		inst.queue_free()
		if fails.is_empty():
			ok += 1
		print("PROBE_ANIM ", JSON.stringify({"body": body, "moved_min": moved_min, "fails": fails}))
	print("RESULT %d/%d" % [ok, total])
	print("PROBE anim_cc0 %s" % ("OK" if ok == total else "FAIL %d" % (total - ok)))   # probe_all.sh 가 읽는 결과 줄
	quit(0 if ok == total else 1)
	return true
