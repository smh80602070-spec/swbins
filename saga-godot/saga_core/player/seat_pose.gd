extends SkeletonModifier3D

## 2026-09-30 탈것에 앉은 자세 — 공방 몸(UE 식 뼈) 허벅지를 앞으로 들고 무릎을 굽혀 다리가 탈것 옆구리로 늘어지게.
## 애니메이션이 뼈를 놓은 뒤에 얹는 SkeletonModifier3D(talk_face.gd 와 같은 방식). 몸 앞이 +Z 인지 -Z 인지는 발→발끝 방향으로 잰다.
## 세기(influence)를 켜고 끄는 일은 mount.gd 가 한다(set_seated).
## G-0024 — 새 인물 몸(VRoid 뼈 이름 J_Bip_*)도 받는다. 회전은 스켈레톤 공간 축 기준이라 뼈 이름만 맞으면 같이 돈다.

const THIGH_FWD := 68.0   # 허벅지를 앞으로 드는 각도
const KNEE_BEND := 82.0   # 무릎을 접는 각도(종아리가 아래로 늘어지게)
const SPREAD := 16.0      # 다리를 옆으로 벌리는 각도
const BLEND := 8.0

var _seated := false
var _front := 1.0
var _b_thigh_l := -1
var _b_thigh_r := -1
var _b_calf_l := -1
var _b_calf_r := -1

const THIGH_L := ["thigh_l", "J_Bip_L_UpperLeg"]
const THIGH_R := ["thigh_r", "J_Bip_R_UpperLeg"]
const CALF_L := ["calf_l", "J_Bip_L_LowerLeg"]
const CALF_R := ["calf_r", "J_Bip_R_LowerLeg"]
const FOOT_R := ["foot_r", "J_Bip_R_Foot"]
const TOE_R := ["ball_r", "J_Bip_R_ToeBase"]

static func _find(skel: Skeleton3D, names: Array) -> int:
	for n in names:
		var i := skel.find_bone(String(n))
		if i >= 0:
			return i
	return -1

## 몸(Skeleton3D 자식)에 붙인다 — 뼈가 없으면 null. 이미 붙어 있으면 그것.
static func attach(skel: Skeleton3D) -> Node:
	for c in skel.get_children():
		if c.get_meta("seat_pose", false):
			return c
	var t_l := _find(skel, THIGH_L)
	if t_l < 0:
		return null
	var sp: SkeletonModifier3D = (load("res://saga_core/player/seat_pose.gd") as GDScript).new()
	sp.name = "SeatPose"
	sp.set_meta("seat_pose", true)
	skel.add_child(sp)
	sp.call("_init_bones", skel)
	return sp

func _init_bones(skel: Skeleton3D) -> void:
	_b_thigh_l = _find(skel, THIGH_L)
	_b_thigh_r = _find(skel, THIGH_R)
	_b_calf_l = _find(skel, CALF_L)
	_b_calf_r = _find(skel, CALF_R)
	var foot := _find(skel, FOOT_R)
	var toe := _find(skel, TOE_R)
	if foot >= 0 and toe >= 0:
		_front = -1.0 if skel.get_bone_global_rest(toe).origin.z < skel.get_bone_global_rest(foot).origin.z else 1.0
	influence = 0.0

func set_seated(on: bool) -> void:
	_seated = on

func is_seated() -> bool:
	return _seated

func _process(delta: float) -> void:
	influence = lerpf(influence, 1.0 if _seated else 0.0, 1.0 - exp(-BLEND * delta))

func _process_modification() -> void:
	var skel := get_skeleton()
	if skel == null or influence < 0.001:
		return
	## 허벅지 → 종아리 순(자식이 부모를 따라간 뒤 무릎을 접는다).
	_rot(skel, _b_thigh_l, Vector3.RIGHT, deg_to_rad(-_front * THIGH_FWD))
	_rot(skel, _b_thigh_r, Vector3.RIGHT, deg_to_rad(-_front * THIGH_FWD))
	_rot(skel, _b_thigh_l, Vector3.BACK, deg_to_rad(-SPREAD))
	_rot(skel, _b_thigh_r, Vector3.BACK, deg_to_rad(SPREAD))
	_rot(skel, _b_calf_l, Vector3.RIGHT, deg_to_rad(_front * KNEE_BEND))
	_rot(skel, _b_calf_r, Vector3.RIGHT, deg_to_rad(_front * KNEE_BEND))

func _rot(skel: Skeleton3D, bone: int, axis: Vector3, angle: float) -> void:
	if bone < 0:
		return
	var g := skel.get_bone_global_pose(bone)
	g.basis = Basis(axis, angle) * g.basis
	skel.set_bone_global_pose(bone, g)
