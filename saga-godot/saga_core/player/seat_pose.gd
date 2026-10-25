extends SkeletonModifier3D

## 2026-09-30 탈것에 앉은 자세 — 공방 몸(UE 식 뼈) 허벅지를 앞으로 들고 무릎을 굽혀 다리가 탈것 옆구리로 늘어지게.
## 애니메이션이 뼈를 놓은 뒤에 얹는 SkeletonModifier3D(talk_face.gd 와 같은 방식). 몸 앞이 +Z 인지 -Z 인지는 발→발끝 방향으로 잰다.
## 세기(influence)를 켜고 끄는 일은 mount.gd 가 한다(set_seated).
## G-0024 — 새 인물 몸(VRoid 뼈 이름 J_Bip_*)도 받는다. 회전은 스켈레톤 공간 축 기준이라 뼈 이름만 맞으면 같이 돈다.

const THIGH_FWD := 68.0   # 허벅지를 앞으로 드는 각도
const KNEE_BEND := 82.0   # 무릎을 접는 각도(종아리가 아래로 늘어지게)
const SPREAD := 16.0      # 다리를 옆으로 벌리는 각도
const BLEND := 8.0
## G-0395 — 옛 각(앞 68°·벌림 16°)은 벌림이 **안쪽**(왼다리 +x 인 VRoid 에서 −x 로)이라 다리가 탈것 몸 속에 묻혀 상반신만 떠 보였다.
## 탈것 몸통 반폭을 알면(set_ik — mount.gd 가 몸 메시로 잼) 각 대신 목표점 IK: 무릎 = 옆구리 밖 KNEE_CLEAR·조금 앞, 발 = 무릎 아래로 늘어짐.
## 몸통이 허벅지로 못 감쌀 만큼 넓으면(새·용) 무릎을 앞으로 내밀어 등 위에 얹는다. 반폭을 모르면 옛 각 그대로.
const KNEE_CLEAR := 0.03
const KNEE_FWD := 0.10        # 무릎을 엉덩이보다 앞으로(m)
const FOOT_BACK := 0.15       # 종아리 방향: 아래로 1, 뒤로 이만큼
const WIDE_SPREAD := 20.0     # 얹기: 무릎 옆으로(°)

var _seated := false
var _front := 1.0
var _b_thigh_l := -1
var _b_thigh_r := -1
var _b_calf_l := -1
var _b_calf_r := -1
var _b_foot_l := -1
var _b_foot_r := -1
var _half := -1.0         # 탈것 몸통 반폭(스켈레톤 공간 m) — 음수면 옛 각

const THIGH_L := ["thigh_l", "J_Bip_L_UpperLeg"]
const THIGH_R := ["thigh_r", "J_Bip_R_UpperLeg"]
const CALF_L := ["calf_l", "J_Bip_L_LowerLeg"]
const CALF_R := ["calf_r", "J_Bip_R_LowerLeg"]
const FOOT_L := ["foot_l", "J_Bip_L_Foot"]
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
	_b_foot_l = _find(skel, FOOT_L)
	_b_foot_r = _find(skel, FOOT_R)
	var foot := _find(skel, FOOT_R)
	var toe := _find(skel, TOE_R)
	if foot >= 0 and toe >= 0:
		_front = -1.0 if skel.get_bone_global_rest(toe).origin.z < skel.get_bone_global_rest(foot).origin.z else 1.0
	influence = 0.0

## G-0395 탈것 몸통 반폭(스켈레톤 공간 m, 음수 = 모름 → 옛 각).
func set_ik(half_local: float) -> void:
	_half = half_local

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
	if _half > 0.0 and _b_foot_l >= 0 and _b_foot_r >= 0:
		_ik_leg(skel, _b_thigh_l, _b_calf_l, _b_foot_l)
		_ik_leg(skel, _b_thigh_r, _b_calf_r, _b_foot_r)
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


## 감싸기(true)인가 얹기(false)인가 — 무릎을 옆구리 밖까지 벌려도 허벅지가 0.9 길이 안이면 감싸기(점검도 이 함수로 가른다).
static func straddles(half: float, hip_x: float, thigh_len: float) -> bool:
	return half + KNEE_CLEAR - hip_x < thigh_len * 0.9


## G-0395 다리 하나 — 무릎·발 목표를 정해 허벅지·종아리를 그쪽으로 돌린다(life_pose _aim 과 같은 꼴).
func _ik_leg(skel: Skeleton3D, th: int, ca: int, fo: int) -> void:
	if th < 0 or ca < 0 or fo < 0:
		return
	var hip := skel.get_bone_global_pose(th).origin
	var lt := skel.get_bone_global_rest(th).origin.distance_to(skel.get_bone_global_rest(ca).origin)
	var lc := skel.get_bone_global_rest(ca).origin.distance_to(skel.get_bone_global_rest(fo).origin)
	var side := 1.0 if hip.x >= 0.0 else -1.0
	var fwd := Vector3(0, 0, _front)
	var hx := absf(skel.get_bone_global_rest(th).origin.x)
	var dx := _half + KNEE_CLEAR - hx
	var knee: Vector3
	var foot_dir: Vector3
	if straddles(_half, hx, lt):
		dx = maxf(dx, 0.04)
		var dz := minf(KNEE_FWD, sqrt(maxf(0.0, lt * lt - dx * dx)) * 0.5)
		var dy := -sqrt(maxf(0.0, lt * lt - dx * dx - dz * dz))
		knee = hip + Vector3(side * dx, dy, 0) + fwd * dz
		foot_dir = (Vector3(side * 0.05, -1.0, 0) - fwd * FOOT_BACK).normalized()
	else:
		var a := deg_to_rad(WIDE_SPREAD)
		knee = hip + (Vector3(side * sin(a), -0.15, 0) + fwd * cos(a)).normalized() * lt
		foot_dir = (Vector3(side * 0.1, -1.0, 0) + fwd * 0.5).normalized()
	_aim(skel, th, ca, knee)
	var k := skel.get_bone_global_pose(ca).origin
	_aim(skel, ca, fo, k + foot_dir * lc)


func _aim(skel: Skeleton3D, bone: int, child: int, to: Vector3) -> void:
	var g := skel.get_bone_global_pose(bone)
	var c := skel.get_bone_global_pose(child).origin - g.origin
	var d := to - g.origin
	if c.length() < 0.001 or d.length() < 0.001:
		return
	g.basis = Basis(Quaternion(c.normalized(), d.normalized())) * g.basis
	skel.set_bone_global_pose(bone, g)
