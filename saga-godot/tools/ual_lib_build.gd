extends SceneTree
## char-forge(tools/char-forge/bake_for_rig.py)가 VRoid 뼈대에 구운 CC0 동작(.glb, 뼈대+동작만)을
## 게임이 쓰는 AnimationLibrary(.res)로 바꾼다 — Mixamo 리타겟(tools/mixamo_retarget.gd)을 갈음한다.
## 동작 원본은 Quaternius Universal Animation Library(CC0)라 결과를 커밋한다(assets/characters_vroid/anim_cc0/).
##
## .glb 는 프로젝트 밖(보통 tools/char-forge/_out/)에서 GLTFDocument 로 직접 읽는다 — res:// 에 넣지 않으니
## .import·캐시 잡음이 안 생긴다. Blender 가 다시 내보낸 뼈대는 관절 축 관례가 원래 VRM 과 다를 수 있어,
## 트랙 값을 그대로 베끼지 않고 **월드에서** 옮긴다: 뼈마다 (구운 쪽 지금 회전 × 구운 쪽 쉼 회전⁻¹)을
## 게임 몸의 쉼 회전에 곱하고, 부모로 나눠 로컬 트랙에 쓴다. 엉덩이는 이동도(쉼 위치 차이는 뺀다).
## 끝나면 같은 프레임에서 두 뼈대의 뼈 방향(기준 자식 쪽)을 맞대 최대 각도를 찍는다 — 0.5° 넘으면 실패
## (Blender 가 다시 내보낸 쉼 위치의 반올림 차이로 모든 동작에 고르게 0.1° 쯤 남는다 — 2026-09-24 측정).
##
## 사용법: Godot_..._console.exe --headless --path saga-godot --script tools/ual_lib_build.gd -- \
##   <구운 .glb 절대경로> <게임 몸 glb res://경로> <출력 접두어>
## 예:  -- C:/swbins/tools/char-forge/_out/AvatarSample_A_anims.glb res://assets/characters_vroid/AvatarSample_A.glb AvatarSample_A

const OUT_DIR := "res://assets/characters_vroid/anim_cc0"
const FPS := 30.0
const LOOP_CLIPS := ["idle", "walk", "sprint", "fall", "climb", "glide", "swim", "plunge"]   # G-0025 — 이동 클립(K-0059) 중 루프인 것
const HIPS := "J_Bip_C_Hips"
## 뼈 방향을 잴 기준 자식(tools/char-forge/rigmaps.py REF_CHILD 의 VRoid 이름판, 몸통·팔다리만)
const REF := {
	"J_Bip_C_Hips": "J_Bip_C_Spine", "J_Bip_C_Spine": "J_Bip_C_Chest", "J_Bip_C_Chest": "J_Bip_C_UpperChest",
	"J_Bip_C_UpperChest": "J_Bip_C_Neck", "J_Bip_C_Neck": "J_Bip_C_Head",
	"J_Bip_L_UpperArm": "J_Bip_L_LowerArm", "J_Bip_L_LowerArm": "J_Bip_L_Hand",
	"J_Bip_R_UpperArm": "J_Bip_R_LowerArm", "J_Bip_R_LowerArm": "J_Bip_R_Hand",
	"J_Bip_L_UpperLeg": "J_Bip_L_LowerLeg", "J_Bip_L_LowerLeg": "J_Bip_L_Foot", "J_Bip_L_Foot": "J_Bip_L_ToeBase",
	"J_Bip_R_UpperLeg": "J_Bip_R_LowerLeg", "J_Bip_R_LowerLeg": "J_Bip_R_Foot", "J_Bip_R_Foot": "J_Bip_R_ToeBase",
}


func _init():
	var args := OS.get_cmdline_user_args()
	if args.size() < 3:
		push_error("인자: <구운 glb 절대경로> <게임 몸 glb res://> <접두어>")
		quit(1)
		return
	var doc := GLTFDocument.new()
	var state := GLTFState.new()
	if doc.append_from_file(args[0], state) != OK:
		push_error("못 읽음: " + args[0])
		quit(1)
		return
	var a_root: Node = doc.generate_scene(state)
	var g_root: Node = (load(args[1]) as PackedScene).instantiate()
	var sa: Skeleton3D = _find(a_root, "Skeleton3D")
	var sg: Skeleton3D = _find(g_root, "Skeleton3D")
	var ap: AnimationPlayer = _find(a_root, "AnimationPlayer")
	var ta := _to_root(sa)
	var tg := _to_root(sg)
	# 두 뼈대에 다 있는 뼈만 옮긴다(J_Bip_* 52). 머리카락·옷 흔들림 뼈(J_Sec_*)는 쉼 그대로.
	var mapped := {}
	for i in sg.get_bone_count():
		var n := sg.get_bone_name(i)
		var j := sa.find_bone(n)
		if j >= 0 and n.begins_with("J_Bip_"):
			mapped[n] = j
	var lib := AnimationLibrary.new()
	var worst := 0.0
	var report := []
	for clip in ap.get_animation_list():
		var src: Animation = ap.get_animation(clip)
		var out := Animation.new()
		out.length = src.length
		out.loop_mode = Animation.LOOP_LINEAR if LOOP_CLIPS.has(clip) else Animation.LOOP_NONE
		var rot_tr := {}
		for n in mapped:
			var idx := out.add_track(Animation.TYPE_ROTATION_3D)
			out.track_set_path(idx, NodePath("Skeleton3D:%s" % n))
			out.track_set_interpolation_type(idx, Animation.INTERPOLATION_LINEAR)
			rot_tr[n] = idx
		var pos_tr := out.add_track(Animation.TYPE_POSITION_3D)
		out.track_set_path(pos_tr, NodePath("Skeleton3D:%s" % HIPS))
		out.track_set_interpolation_type(pos_tr, Animation.INTERPOLATION_LINEAR)
		var frames := int(round(src.length * FPS))
		var clip_worst := 0.0
		for f in frames + 1:
			var t := minf(f / FPS, src.length)
			var a_local := _local_poses(sa, src, t)
			var a_glob := _globals(sa, a_local)
			var g_glob := {}
			var g_local := {}
			for i in _topo(sg):
				var n := sg.get_bone_name(i)
				var p := sg.get_bone_parent(i)
				var rest := sg.get_bone_rest(i)
				var parent_g: Transform3D = g_glob[p] if p >= 0 else Transform3D.IDENTITY
				var glob: Transform3D = parent_g * rest
				if mapped.has(n):
					var j: int = mapped[n]
					var wa: Transform3D = ta * a_glob[j]
					var wa0: Transform3D = ta * sa.get_bone_global_rest(j)
					var wg0: Transform3D = tg * sg.get_bone_global_rest(i)
					var basis_w := (wa.basis.orthonormalized() * wa0.basis.orthonormalized().inverse()
						* wg0.basis.orthonormalized())
					var origin_w := (tg * glob).origin
					if n == HIPS:
						origin_w = wg0.origin + (wa.origin - wa0.origin)
					glob = tg.affine_inverse() * Transform3D(basis_w, origin_w)
				g_glob[i] = glob
				g_local[i] = parent_g.affine_inverse() * glob
			for n in mapped:
				var i := sg.find_bone(n)
				out.rotation_track_insert_key(rot_tr[n], t, (g_local[i] as Transform3D).basis.get_rotation_quaternion())
			out.position_track_insert_key(pos_tr, t, (g_local[sg.find_bone(HIPS)] as Transform3D).origin)
			# 자체 확인: 뼈 방향이 구운 쪽과 같은가(월드)
			for n in REF:
				if not (mapped.has(n) and mapped.has(REF[n])):
					continue
				var da: Vector3 = ((ta * a_glob[mapped[REF[n]]]).origin - (ta * a_glob[mapped[n]]).origin).normalized()
				var dg: Vector3 = ((tg * g_glob[sg.find_bone(REF[n])]).origin - (tg * g_glob[sg.find_bone(n)]).origin).normalized()
				clip_worst = maxf(clip_worst, rad_to_deg(da.angle_to(dg)))
		worst = maxf(worst, clip_worst)
		lib.add_animation(clip, out)
		report.append("%s %.2fs %.3f°" % [clip, src.length, clip_worst])
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(OUT_DIR))
	var out_path := "%s/%s_lib.res" % [OUT_DIR, args[2]]
	var err := ResourceSaver.save(lib, out_path)
	print("UALLIB ", out_path, " save_err=", err, " clips=", lib.get_animation_list().size(), " dir_err_max_deg=%.4f" % worst)
	for r in report:
		print("UALLIB_CLIP ", r)
	a_root.free()
	g_root.free()
	quit(0 if err == OK and worst <= 0.5 else 2)


func _find(node: Node, cls: String) -> Node:
	if node.is_class(cls):
		return node
	for c in node.get_children():
		var r := _find(c, cls)
		if r:
			return r
	return null


## 뼈대 노드 → 장면 뿌리까지의 변환(장면 안의 Node3D 변환을 곱한다)
func _to_root(n: Node) -> Transform3D:
	var t := Transform3D.IDENTITY
	var cur := n
	while cur:
		if cur is Node3D:
			t = (cur as Node3D).transform * t
		cur = cur.get_parent()
	return t


func _topo(s: Skeleton3D) -> Array:
	var out := []
	var seen := {}
	var todo := range(s.get_bone_count())
	while out.size() < s.get_bone_count():
		for i in todo:
			if seen.has(i):
				continue
			var p := s.get_bone_parent(i)
			if p < 0 or seen.has(p):
				out.append(i)
				seen[i] = true
	return out


## 동작의 t 시각 로컬 자세(트랙이 없는 뼈는 쉼)
func _local_poses(s: Skeleton3D, anim: Animation, t: float) -> Dictionary:
	var pos := {}
	var rot := {}
	var scl := {}
	for i in s.get_bone_count():
		var r := s.get_bone_rest(i)
		pos[i] = r.origin
		rot[i] = r.basis.get_rotation_quaternion()
		scl[i] = r.basis.get_scale()
	for tr in anim.get_track_count():
		var path := anim.track_get_path(tr)
		var b := s.find_bone(String(path.get_concatenated_subnames()))
		if b < 0:
			continue
		match anim.track_get_type(tr):
			Animation.TYPE_ROTATION_3D:
				rot[b] = anim.rotation_track_interpolate(tr, t)
			Animation.TYPE_POSITION_3D:
				pos[b] = anim.position_track_interpolate(tr, t)
			Animation.TYPE_SCALE_3D:
				scl[b] = anim.scale_track_interpolate(tr, t)
	var out := {}
	for i in s.get_bone_count():
		out[i] = Transform3D(Basis(rot[i]).scaled(scl[i]), pos[i])
	return out


func _globals(s: Skeleton3D, local: Dictionary) -> Dictionary:
	var g := {}
	for i in _topo(s):
		var p := s.get_bone_parent(i)
		g[i] = (g[p] as Transform3D) * local[i] if p >= 0 else local[i]
	return g
