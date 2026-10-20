extends SkeletonModifier3D

## G-0264 발 고정 걷기 — 두 가지를 코드로(모캡·새 클립 없음, 웹 W-0303 anim-own.js gait 와 같은 생각).
##   ① 걸음새 gait(): 실제 수평 속도 → walk/sprint·클립 빠르기(디딘 발이 몸과 같은 빠르기로 뒤로 가게)
##   ② 디딘 발 잠금: 몸 Skeleton3D 에 TwoBoneIK3D(설정 둘 = 허벅지·정강이·발목) + 목표 Marker3D 둘.
##      물리 틱마다 발목 아래 레이 둘 — 디딘 발(발목 ≤ 바닥+3cm·세로 속도 작음)은 그 자리 잠금, 든 발은 클립대로 + 땅 높이.
##      엉덩이 내림 = 두 발 땅 차 중 낮은 쪽(≤ 0.25m). 세기 0.15초 섞기.
## 끔: 공중·탈것(seat_pose 켜짐)·idle/walk/sprint 밖 동작·주인(CharacterBody3D)의 foot_lock_allowed() 가 false·SAGA_FOOT_LOCK=0.
## 나 하나만 붙인다(레이 둘/틱) — 주민·적 안 붙임. 본보기 seat_pose.gd(attach·뼈 이름 표).

## 클립 본래 빠르기(m/s, 몸 배율 1) — tools/probe_gait.gd 로 잰 값(dex 몸 셋 평균, 메모 G-0264).
const V0_WALK := 0.65
const V0_SPRINT := 2.9
const RUN_FROM := 1.7      # 달리기 문턱 = V0_WALK × 이것
const RUN_BACK := 0.85     # 되돌이 — 문턱 곁에서 걷기↔달리기가 프레임마다 뒤집히지 않게
const RATE_MIN := 0.6
const RATE_MAX := 2.3      # 웹 1.7 보다 큼 — 1.7 이면 10m/s 에서 잠근 발이 다리 길이를 15~20cm 넘어 끌린다(G-0264 메모)

const RAY_UP := 0.6
const RAY_DOWN := 0.6
const DOWN_EPS := 0.03     # 디딘 발 = 발목 ≤ 바닥 + 쉬는 발목 높이 + 이것
const DOWN_VY := 0.6       # 디딘 발 세로 속도 상한(m/s)
const RELEASE := 0.30      # 잠근 자리와 클립 발이 이만큼 벌어지면 놓는다(몸 돌기·멈춤)
const HIP_MAX := 0.25
const BLEND_T := 0.15
const WARMUP := 0.3        # 씬 실은 직후 dt 큼 — 이 동안 세기 0

const THIGH := [["J_Bip_L_UpperLeg", "thigh_l"], ["J_Bip_R_UpperLeg", "thigh_r"]]
const CALF := [["J_Bip_L_LowerLeg", "calf_l"], ["J_Bip_R_LowerLeg", "calf_r"]]
const FOOT := [["J_Bip_L_Foot", "foot_l"], ["J_Bip_R_Foot", "foot_r"]]
const HIPS := ["J_Bip_C_Hips", "pelvis"]
const WALK_CLIPS := ["idle", "walk", "sprint"]

var _ik: SkeletonModifier3D = null
var _tgt: Array = []
var _pole: Array = []
var _b_foot := [-1, -1]
var _b_calf := [-1, -1]
var _b_hips := -1
var _ankle_h := 0.08
var _host: CharacterBody3D = null
var _ap: AnimationPlayer = null
var _seat: Node = null
var _age := 0.0
var _w := 0.0
var _anim_foot := [Vector3.ZERO, Vector3.ZERO]
var _prev_foot := [Vector3.ZERO, Vector3.ZERO]
var _ground := [0.0, 0.0]
var _hit := [false, false]
var _lock := [Vector3.ZERO, Vector3.ZERO]
var _locked := [false, false]
var _have_prev := false

static func _find(skel: Skeleton3D, names: Array) -> int:
	for n in names:
		var i := skel.find_bone(String(n))
		if i >= 0:
			return i
	return -1

## 걸음새 — 수평 속도(m/s)·몸 배율·지난번 달리기였나 → [클립, 빠르기]. 순수(probe_gait 가 그대로 부른다).
static func gait(speed: float, body_scale: float, was_run: bool) -> Array:
	var s := maxf(body_scale, 0.01)
	var run := speed >= V0_WALK * s * RUN_FROM * (RUN_BACK if was_run else 1.0)
	var v0 := (V0_SPRINT if run else V0_WALK) * s
	return ["sprint" if run else "walk", clampf(speed / v0, RATE_MIN, RATE_MAX)]

## 몸(Skeleton3D)에 붙인다 — 다리 뼈가 없거나 SAGA_FOOT_LOCK=0 이면 null. 이미 붙어 있으면 그것.
static func attach(skel: Skeleton3D) -> Node:
	if skel == null or OS.get_environment("SAGA_FOOT_LOCK") == "0" or not ClassDB.class_exists("TwoBoneIK3D"):
		return null
	for c in skel.get_children():
		if c.get_meta("foot_lock", false):
			return c
	for k in 2:
		if _find(skel, THIGH[k]) < 0 or _find(skel, CALF[k]) < 0 or _find(skel, FOOT[k]) < 0:
			return null
	var fl: SkeletonModifier3D = (load("res://saga_core/player/foot_lock.gd") as GDScript).new()
	fl.name = "FootLock"
	fl.set_meta("foot_lock", true)
	skel.add_child(fl)
	fl.call("_init_bones", skel)
	return fl

func _init_bones(skel: Skeleton3D) -> void:
	influence = 1.0   # 엉덩이 내림은 _w 로 섞어 넣는다(0 이면 이 변경이 버려진다) — IK 세기는 _ik.influence
	for k in 2:
		_b_foot[k] = _find(skel, FOOT[k])
		_b_calf[k] = _find(skel, CALF[k])
	_b_hips = _find(skel, HIPS)
	var ik := ClassDB.instantiate("TwoBoneIK3D") as SkeletonModifier3D
	ik.name = "FootIK"
	skel.add_child(ik)
	ik.call("set_setting_count", 2)
	for k in 2:
		var t := Marker3D.new()
		t.name = "FootTarget%d" % k
		t.top_level = true
		add_child(t)
		var p := Marker3D.new()
		p.name = "KneePole%d" % k
		p.top_level = true
		add_child(p)
		_tgt.append(t)
		_pole.append(p)
		ik.call("set_root_bone_name", k, skel.get_bone_name(_find(skel, THIGH[k])))
		ik.call("set_middle_bone_name", k, skel.get_bone_name(_b_calf[k]))
		ik.call("set_end_bone_name", k, skel.get_bone_name(_b_foot[k]))
		ik.call("set_target_node", k, ik.get_path_to(t))
		ik.call("set_pole_node", k, ik.get_path_to(p))
	ik.influence = 0.0
	_ik = ik
	## 주인(CharacterBody3D)·동작 재생기·탈것 자세
	var n: Node = skel
	while n != null and _host == null:
		if n is CharacterBody3D:
			_host = n
		n = n.get_parent()
	var v: Node = skel
	while v != null and v.get_node_or_null("AnimationPlayer") == null:
		v = v.get_parent()
	if v != null:
		_ap = v.get_node("AnimationPlayer") as AnimationPlayer
func _allowed() -> bool:
	if _host == null or not _host.is_on_floor():
		return false
	if _seat == null:   # 탈것 자세(seat_pose)는 나중에 붙는다 — 찾을 때까지 형제만 훑는다(몇 개)
		for c in get_skeleton().get_children():
			if c.get_meta("seat_pose", false):
				_seat = c
	if _seat != null and is_instance_valid(_seat) and bool(_seat.call("is_seated")):
		return false
	if _ap != null and not WALK_CLIPS.has(String(_ap.current_animation)):
		return false
	if _host.has_method("foot_lock_allowed") and not bool(_host.call("foot_lock_allowed")):
		return false
	return true

func _physics_process(_delta: float) -> void:
	if _host == null or not _have_prev or not is_visible_in_tree():
		return
	var space := get_world_3d().direct_space_state
	var ex := [_host.get_rid()]
	for k in 2:
		var p: Vector3 = _anim_foot[k]
		var q := PhysicsRayQueryParameters3D.create(p + Vector3.UP * RAY_UP, p + Vector3.DOWN * RAY_DOWN)
		q.exclude = ex
		q.collide_with_areas = false
		var r := space.intersect_ray(q)
		_hit[k] = not r.is_empty()
		_ground[k] = (r["position"] as Vector3).y if _hit[k] else _host.global_position.y

func _process_modification() -> void:
	var skel := get_skeleton()
	if skel == null or _ik == null:
		return
	var dt := get_process_delta_time()
	_age += dt
	var on := _allowed() and _age > WARMUP
	_w = move_toward(_w, 1.0 if on else 0.0, dt / BLEND_T)
	var xf := skel.global_transform
	var sy := xf.basis.get_scale().y
	_ankle_h = skel.get_bone_global_rest(_b_foot[0]).origin.y * sy
	for k in 2:
		_prev_foot[k] = _anim_foot[k]
		_anim_foot[k] = xf * skel.get_bone_global_pose(_b_foot[k]).origin
	if not _have_prev:
		_have_prev = true
		_ik.influence = 0.0
		return
	if _w <= 0.001:
		_locked = [false, false]
		_ik.influence = 0.0
		return
	var floor_y := _host.global_position.y
	## 엉덩이 내림 — 두 발 땅 중 낮은 쪽이 몸 바닥보다 아래면 그만큼(≤ HIP_MAX)
	var drop := clampf(minf(minf(float(_ground[0]), float(_ground[1])) - floor_y, 0.0), -HIP_MAX, 0.0)
	if _b_hips >= 0 and drop < -0.001:
		var hp := skel.get_bone_global_pose(_b_hips)
		hp.origin.y += drop * _w / maxf(sy, 0.01)
		skel.set_bone_global_pose(_b_hips, hp)
	var vis := _host.get("visual") as Node3D   # 몸 앞 = Visual +Z(vroid_body 가 맞춰 둔다)
	var fwd := (vis.global_basis.z if vis != null else xf.basis.z).normalized()
	for k in 2:
		var a: Vector3 = _anim_foot[k] + Vector3.UP * drop
		var vy := (float(_anim_foot[k].y) - float(_prev_foot[k].y)) / maxf(dt, 0.001)
		var g: float = _ground[k]
		var lift := float(_anim_foot[k].y) - floor_y   # 클립이 든 높이(몸 바닥 기준)
		var down: bool = lift <= _ankle_h + DOWN_EPS and absf(vy) < DOWN_VY
		var target := Vector3(a.x, g + lift, a.z)
		if down:
			if not _locked[k]:
				_locked[k] = true
				_lock[k] = Vector3(a.x, g + lift, a.z)
			elif Vector2(a.x - _lock[k].x, a.z - _lock[k].z).length() > RELEASE:
				_lock[k] = Vector3(a.x, g + lift, a.z)
			target = _lock[k]
		else:
			_locked[k] = false
		var t: Marker3D = _tgt[k]
		t.global_position = target
		t.global_basis = (xf * skel.get_bone_global_pose(_b_foot[k])).basis.orthonormalized()
		var knee: Vector3 = xf * skel.get_bone_global_pose(_b_calf[k]).origin
		(_pole[k] as Marker3D).global_position = knee + fwd * 0.6
	_ik.influence = _w
