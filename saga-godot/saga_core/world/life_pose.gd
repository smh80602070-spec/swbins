extends SkeletonModifier3D

## G-0265 생활 몸짓(다섯 판 공용) — 웹 W-0303 pose3d.js 의 앉기·인사·둘러보기·체중과 life()(가만히 8초 → 앉기)·idleVariant(3~5초)를
## 뼈 회전 코드로(모캡·새 클립 없음). 애니메이션이 놓은 자세 위에 얹는 SkeletonModifier3D(본보기 seat_pose.gd·talk_face.gd).
##   sit   땅에 무릎 세워 앉기 — 허벅지 뼈를 땅 위 허벅지 반지름(SIT_THIGH_R, 몸 비례)에 두게 엉덩이를 내리고(G-0394), 발목을 엉덩이 앞 0.36m(오른쪽 0.34m)·발목 쉬는 높이에
##         두는 두 뼈 IK(웹 SIT legIK(0.36, −0.02))로 허벅지·정강이를 풀고 발바닥은 쉬는 자세로 평평. 몸은 조금 뒤로, 두 손은 두 뼈 IK 로 무릎 위(_sit_arm).
##   wave  오른팔 인사 1.6초 — 팔꿈치를 어깨 옆 조금 위, 아래팔을 세워 좌우로 흔든다(앞으로 안 뻗음).
##   look  둘러보기 2.6초 — 머리·목·가슴을 위 축으로 +34° → −28° → 0.
##   shift 체중 옮기기 3.0초 — 엉덩이 옆 2cm·기울기 −4°, 허리 3°·가슴 2°.
## 부르는 법: play(이름) · set_rest(on) · tick_still(dt, still)(SIT_AFTER 초 가만히 → 앉기, SAGA_SIT_AFTER 로 바꿈) ·
##   set_auto_idle(on, seed)(주민 — 0.5초에 한 번 카메라 25m 안이면 3~5초마다 look/shift) · look_at_target(Node3D)(목 ±60°·0.5초에 90%).
## 섞기 0.25초. 탈것 자세(seat_pose)가 켜져 있으면 아무것도 안 한다. 할 일이 없으면 _process_modification 이 바로 돌아간다.
## G-0266 — 사람(NPC) 한 줄 연결: attach_npc(몸, seed)(+talk_face) · greet(나)(나를 봄 + 인사) · talk_for(초)(손짓·끄덕임) ·
##   set_hold(on)(이동·공격·쓰러짐 동안 몸짓 0 — 전술판).
## G-0275 — 몸 AnimationPlayer 에 모캡 클립(vroid_body MOCAP_NEW)이 있으면: wave 는 뼈 코드 대신 greet 클립 한 번,
##   auto idle 변주 셋 중 하나는 idle_b 클립 한 번(끝나면 idle 로 돌아감). 서 있을 때(idle·idle_b)만. 앉기 sit 은 뼈 코드 그대로.

const SIT_AFTER := 8.0
const BLEND_T := 0.25
## G-0412 — GO 플레이어만 켜는 층. 클립 평균 자세는 그대로 두고 흔들림만 키운다.
const BREATH_PERIOD := 2.4
const BREATH_CHEST := 1.5
const BREATH_SHOULDER := 1.0
const ARM_SWING_GAIN := 1.3
const BREATH_CLIPS := ["idle", "idle_b", "sword_idle", "spear_idle", "axe_idle", "dagger_idle", "bow_idle", "staff_idle", "gun_idle"]
const GAIT_CLIPS := ["walk", "run", "sprint"]
const DUR := {"wave": 1.6, "look": 2.6, "shift": 3.0}
## G-0394 — 옛 SIT_HIP_UP(발목 쉬는 높이 +0.08m)은 발목 뼈가 땅 위 10~13cm 라 엉덩이 살이 6~8cm 떴다(probe_life_sit).
## 이제 허벅지 뼈(다리 시작)를 땅(몸 원점 y 0) 위 허벅지 반지름에 둔다 — 반지름은 몸 크기 비례(허벅지 쉬는 높이 0.9m 에 0.08m).
const SIT_THIGH_R := 0.08
const SIT_THIGH_REF := 0.9
const SIT_FOOT_FWD := [0.36, 0.34]   # 왼·오른 발목을 엉덩이 앞 몇 m
const SIT_LEAN := -8.0               # 몸 뒤로(°)
## G-0394 — 옛 팔(윗팔 앞으로 −42°·아래팔 −28° 만)은 쉬는 A자 팔을 그대로 든 꼴 → 두 뼈 IK 로 손목을 같은 쪽 무릎 위에.
const SIT_HAND_UP := 0.05            # 손목 = 무릎 뼈 위 몇 m
const SIT_HAND_BACK := 0.04          # 무릎에서 엉덩이 쪽으로 몇 m(무릎 앞으로 넘어가지 않게)
const WAVE_ELBOW_UP := 30.0          # 팔꿈치 = 어깨 옆에서 이만큼 위로(°)
const WAVE_SWING := 22.0             # 아래팔 좌우 흔들기(°)
const LOOK_L := 34.0
const LOOK_R := -28.0
const SHIFT_DX := 0.02
const LOOK_MAX := 60.0
const LOOK_FOLLOW := 0.5             # 이 초에 90% 따라감
const IDLE_MIN := 3.0
const IDLE_MAX := 5.0
const IDLE_NEAR := 25.0
const CHECK_SEC := 0.5

const HIPS := ["J_Bip_C_Hips", "pelvis"]
const SPINE := ["J_Bip_C_Spine", "spine_01"]
const CHEST := ["J_Bip_C_Chest", "spine_02"]
const SHOULDER := [["J_Bip_L_Shoulder", "clavicle_l"], ["J_Bip_R_Shoulder", "clavicle_r"]]
const NECK := ["J_Bip_C_Neck", "neck_01"]
const HEAD := ["J_Bip_C_Head", "head", "Head"]
const THIGH := [["J_Bip_L_UpperLeg", "thigh_l"], ["J_Bip_R_UpperLeg", "thigh_r"]]
const CALF := [["J_Bip_L_LowerLeg", "calf_l"], ["J_Bip_R_LowerLeg", "calf_r"]]
const FOOT := [["J_Bip_L_Foot", "foot_l"], ["J_Bip_R_Foot", "foot_r"]]
const UARM := [["J_Bip_L_UpperArm", "upperarm_l"], ["J_Bip_R_UpperArm", "upperarm_r"]]
const LARM := [["J_Bip_L_LowerArm", "lowerarm_l"], ["J_Bip_R_LowerArm", "lowerarm_r"]]
const HAND := [["J_Bip_L_Hand", "hand_l"], ["J_Bip_R_Hand", "hand_r"]]
const TOE_R := ["J_Bip_R_ToeBase", "ball_r"]

var sit_after := SIT_AFTER
var _b := {}
var _fwd := Vector3.BACK          # 뼈대 공간 몸 앞(±Z)
var _right := Vector3.RIGHT       # 뼈대 공간 몸 오른쪽(왼어깨 → 오른어깨)
var _rest := false
var _sit_w := 0.0
var _act := ""
var _act_t := 0.0
var _still_t := 0.0
var _idle_on := false
var _idle_next := 0.0
var _auto := false
var _check_t := 0.0
var _clock := 0.0
var _look_target: Node3D = null
var _look_yaw := 0.0
var _seat: Node = null
var _face: Node = null   # attach_npc 가 붙인 talk_face
var _talk_left := 0.0
var _hold := false
var _motion_layers := false
var _breath_w := 0.0
var _gait_w := 0.0
var _arm_means := {}
var _rng := RandomNumberGenerator.new()
var _clip_act := ""      # G-0275 — 클립으로 대신 트는 몸짓 이름(current 가 돌려줌)
var _clip_left := 0.0

static func _find(skel: Skeleton3D, names: Array) -> int:
	for n in names:
		var i := skel.find_bone(String(n))
		if i >= 0:
			return i
	return -1

## 몸(VroidBody 결과·플레이어 Visual) 또는 Skeleton3D 에 붙인다 — 뼈대·다리 뼈가 없으면 null. 이미 붙어 있으면 그것.
static func attach(body: Node) -> Node:
	var skel := body as Skeleton3D
	if skel == null:
		var skels := body.find_children("*", "Skeleton3D", true, false)
		if skels.is_empty():
			return null
		skel = skels[0] as Skeleton3D
	for c in skel.get_children():
		if c.get_meta("life_pose", false):
			return c
	if _find(skel, HIPS) < 0 or _find(skel, THIGH[0]) < 0 or _find(skel, UARM[1]) < 0:
		return null
	var lp: SkeletonModifier3D = (load("res://saga_core/world/life_pose.gd") as GDScript).new()
	lp.name = "LifePose"
	lp.set_meta("life_pose", true)
	skel.add_child(lp)
	lp.call("_init_bones", skel)
	return lp

## 사람(NPC) 몸에 생활 몸짓 + 말할 때 손짓(talk_face)을 함께 붙인다. auto = 카메라 25m 안이면 3~5초마다 둘러보기·체중.
static func attach_npc(body: Node, seed_value: int, auto := true) -> Node:
	var lp: Node = attach(body)
	if lp == null:
		return null
	if auto:
		lp.call("set_auto_idle", true, seed_value)
	if lp.get("_face") == null:
		lp.set("_face", (load("res://saga_core/world/talk_face.gd") as GDScript).call("attach", body))
	return lp

func _init_bones(skel: Skeleton3D) -> void:
	influence = 1.0   # 세기는 몸짓마다 안에서 섞는다
	for k in ["hips", "spine", "chest", "neck", "head"]:
		_b[k] = _find(skel, {"hips": HIPS, "spine": SPINE, "chest": CHEST, "neck": NECK, "head": HEAD}[k])
	for s in 2:
		_b["shoulder%d" % s] = _find(skel, SHOULDER[s])
		_b["thigh%d" % s] = _find(skel, THIGH[s])
		_b["calf%d" % s] = _find(skel, CALF[s])
		_b["foot%d" % s] = _find(skel, FOOT[s])
		_b["uarm%d" % s] = _find(skel, UARM[s])
		_b["larm%d" % s] = _find(skel, LARM[s])
		_b["hand%d" % s] = _find(skel, HAND[s])
	var toe := _find(skel, TOE_R)
	if _b.foot1 >= 0 and toe >= 0:
		_fwd = Vector3(0, 0, -1.0 if skel.get_bone_global_rest(toe).origin.z < skel.get_bone_global_rest(_b.foot1).origin.z else 1.0)
	if _b.uarm0 >= 0 and _b.uarm1 >= 0:
		var r := skel.get_bone_global_rest(_b.uarm1).origin - skel.get_bone_global_rest(_b.uarm0).origin
		r.y = 0.0
		if r.length() > 0.01:
			_right = r.normalized()
	var env := OS.get_environment("SAGA_SIT_AFTER")
	if env.is_valid_float():
		sit_after = maxf(env.to_float(), 0.0)
	_rng.seed = 20260824

# ── 부르는 쪽 ─────────────────────────────────────────

func play(pose_name: String) -> void:
	if not DUR.has(pose_name) or _hold:
		return
	if pose_name == "wave":
		var t := clip_once("greet")
		if t > 0.0:
			_clip_act = "wave"
			_clip_left = t
			return
	_act = pose_name
	_act_t = 0.0

## 몸의 클립 하나를 한 번 틀고 idle 로 돌아가게 줄 세운다 — 그 클립 길이(초), 못 틀면 0.
func clip_once(clip: String) -> float:
	var ap := _body_ap()
	if ap == null or not ap.has_animation(clip) or not (ap.current_animation in ["idle", "idle_b"]):
		return 0.0
	ap.play(clip, BLEND_T)
	ap.queue("idle")
	return ap.get_animation(clip).length

func _body_ap() -> AnimationPlayer:
	var n: Node = get_skeleton()
	for _i in 4:
		if n == null:
			return null
		var ap := n.get_node_or_null("AnimationPlayer") as AnimationPlayer
		if ap != null:
			return ap
		n = n.get_parent()
	return null

func current() -> String:
	if _rest:
		return "sit"
	return _clip_act if _clip_left > 0.0 else _act

func set_rest(on: bool) -> void:
	_rest = on
	if on:
		_act = ""

func is_resting() -> bool:
	return _rest

## 가만히 있나(still)를 매 프레임(또는 몇 번에 한 번) 알린다 — sit_after 초 넘게 가만히 → 앉기, 그 사이 3~5초마다 look/shift.
## 움직이면 바로 일어나고 둘러보기·체중도 그친다(인사는 끝까지).
func tick_still(dt: float, still: bool) -> void:
	if not still:
		_still_t = 0.0
		_idle_on = false
		if _rest:
			set_rest(false)
		if _act == "look" or _act == "shift":
			_act = ""
		return
	_still_t += dt
	if _still_t >= sit_after:
		if not _rest:
			set_rest(true)
		return
	if not _idle_on:
		_idle_on = true
		_idle_next = _clock + _rng.randf_range(IDLE_MIN, IDLE_MAX)
	elif _act == "" and _clock >= _idle_next:
		play("look" if _rng.randf() < 0.5 else "shift")
		_idle_next = _clock + float(DUR[_act]) + _rng.randf_range(IDLE_MIN, IDLE_MAX)

## 주민·동반자·손님 — 0.5초에 한 번, 카메라 IDLE_NEAR m 안이면 3~5초마다 look/shift(seed = id 해시).
func set_auto_idle(on: bool, seed_value: int = 0) -> void:
	_auto = on
	_rng.seed = seed_value
	_idle_next = _clock + _rng.randf_range(IDLE_MIN, IDLE_MAX)

func look_at_target(t: Node3D) -> void:
	_look_target = t

## 다가온 이를 보고 손 한 번.
func greet(t: Node3D) -> void:
	look_at_target(t)
	if not _hold:
		play("wave")

## sec 초 동안 말하는 손짓·끄덕임(attach_npc 로 붙인 talk_face).
func talk_for(sec: float) -> void:
	if _face == null or not is_instance_valid(_face):
		return
	_face.call("set_talking", true)
	_talk_left = sec

func is_talking() -> bool:
	return _face != null and is_instance_valid(_face) and bool(_face.call("is_talking"))

## 이동·공격·쓰러짐 동안 몸짓을 바로 0 으로(전술판). 풀면 다음 차례부터 다시.
func set_hold(on: bool) -> void:
	_hold = on
	if on:
		_act = ""
		_rest = false
		_sit_w = 0.0

func is_held() -> bool:
	return _hold

func sit_weight() -> float:
	return _sit_w

func set_motion_layers(on: bool) -> void:
	_motion_layers = on
	if not on:
		_breath_w = 0.0
		_gait_w = 0.0

func _process(delta: float) -> void:
	step(delta)

## 시계·섞기(점검은 이걸 직접 부른다).
func step(delta: float) -> void:
	_clock += delta
	if _motion_layers:
		var ap := _body_ap()
		var clip := String(ap.current_animation).get_file() if ap != null and ap.is_playing() else ""
		var free_pose := not _hold and not _rest and _sit_w < 0.001 and _act == "" and not _seated()
		_breath_w = move_toward(_breath_w, 1.0 if free_pose and BREATH_CLIPS.has(clip) else 0.0, delta / BLEND_T)
		_gait_w = move_toward(_gait_w, 1.0 if free_pose and GAIT_CLIPS.has(clip) else 0.0, delta / BLEND_T)
	if _talk_left > 0.0:
		_talk_left -= delta
		if _talk_left <= 0.0 and _face != null and is_instance_valid(_face):
			_face.call("set_talking", false)
	var k := delta / BLEND_T
	_sit_w = move_toward(_sit_w, 1.0 if _rest and not _seated() else 0.0, k)
	if _clip_left > 0.0:
		_clip_left -= delta
	if _act != "":
		_act_t += delta
		if _act_t >= float(DUR[_act]):
			_act = ""
	if _auto:
		_check_t += delta
		if _check_t >= CHECK_SEC:
			_check_t = 0.0
			if _act == "" and not _rest and not _hold and _clock >= _idle_next and _near_camera():
				var clip_t := clip_once("idle_b") if _rng.randf() < 0.34 else 0.0
				if clip_t <= 0.0:
					play("look" if _rng.randf() < 0.5 else "shift")
					clip_t = float(DUR[_act])
				_idle_next = _clock + clip_t + _rng.randf_range(IDLE_MIN, IDLE_MAX)
	var want := 0.0
	if _look_target != null:
		if not is_instance_valid(_look_target):
			_look_target = null
		else:
			want = _yaw_to(_look_target.global_position)
	_look_yaw = lerpf(_look_yaw, want, 1.0 - exp(-delta * 4.6 / LOOK_FOLLOW))

func _near_camera() -> bool:
	if not is_inside_tree():
		return false
	var cam := get_viewport().get_camera_3d()
	return cam != null and cam.global_position.distance_to(global_position) <= IDLE_NEAR

func _seated() -> bool:
	if _seat == null:
		var skel := get_skeleton()
		if skel != null:
			for c in skel.get_children():
				if c.get_meta("seat_pose", false):
					_seat = c
	return _seat != null and is_instance_valid(_seat) and bool(_seat.call("is_seated"))

## 목표가 몸 앞에서 위 축으로 몇 도(뼈대 공간, ±LOOK_MAX).
func _yaw_to(p: Vector3) -> float:
	var skel := get_skeleton()
	if skel == null or not skel.is_inside_tree() or _b.head < 0:
		return 0.0
	var d := skel.global_transform.affine_inverse() * p - skel.get_bone_global_pose(_b.head).origin
	d.y = 0.0
	if d.length() < 0.01:
		return 0.0
	d = d.normalized()
	return clampf(rad_to_deg(atan2(_fwd.cross(d).dot(Vector3.UP), _fwd.dot(d))), -LOOK_MAX, LOOK_MAX)

# ── 자세 ─────────────────────────────────────────────

func _process_modification() -> void:
	var skel := get_skeleton()
	if skel == null or _hold:
		return
	if _seated():
		return
	if _motion_layers and not _rest and _sit_w < 0.001 and _act == "":
		_apply_motion_layers(skel)
	if _sit_w < 0.001 and _act == "" and absf(_look_yaw) < 0.05:
		return
	if _sit_w > 0.001:
		_sit(skel, _smooth(_sit_w))
	if _act != "":
		var u := _act_t / float(DUR[_act])
		match _act:
			"wave":
				_wave(skel, _keyed(u, [[0.0, 0.0], [0.22, 1.0], [0.76, 1.0], [1.0, 0.0]]), u)
			"look":
				_turn_head(skel, _keyed(u, [[0.0, 0.0], [0.25, LOOK_L], [0.45, LOOK_L], [0.62, LOOK_R], [0.78, LOOK_R], [1.0, 0.0]]))
			"shift":
				_shift(skel, _keyed(u, [[0.0, 0.0], [0.25, 1.0], [0.75, 1.0], [1.0, 0.0]]))
	if absf(_look_yaw) >= 0.05:
		_turn_head(skel, _look_yaw)

func _apply_motion_layers(skel: Skeleton3D) -> void:
	var ap := _body_ap()
	if ap == null or not ap.is_playing():
		return
	var clip := String(ap.current_animation).get_file()
	if BREATH_CLIPS.has(clip) and _breath_w > 0.0:
		var breath := sin(TAU * fmod(_clock, BREATH_PERIOD) / BREATH_PERIOD) * _breath_w
		_rot(skel, _b.chest, _pitch_axis(), BREATH_CHEST * breath)
		for s in 2:
			_rot(skel, _b["shoulder%d" % s], _fwd, BREATH_SHOULDER * breath * (-1.0 if s == 0 else 1.0))
	elif GAIT_CLIPS.has(clip) and _gait_w > 0.0:
		var a := ap.get_animation(clip)
		for s in 2:
			var bone: int = _b["uarm%d" % s]
			if bone < 0:
				continue
			var mean: Variant = _arm_mean(a, skel.get_bone_name(bone))
			if mean == null:
				continue
			var q := skel.get_bone_pose_rotation(bone)
			var swing: Quaternion = (mean as Quaternion).inverse() * q
			if swing.w < 0.0:
				swing = -swing
			var extra := Quaternion.IDENTITY.slerp(swing.normalized(), (ARM_SWING_GAIN - 1.0) * _gait_w)
			skel.set_bone_pose_rotation(bone, (q * extra).normalized())

## 한 번 샘플링한 클립 평균을 캐시. 몸의 A자 쉼 자세까지 1.3배 하지 않는다.
func _arm_mean(a: Animation, bone_name: String) -> Variant:
	var key := "%s:%s" % [a.get_instance_id(), bone_name]
	if _arm_means.has(key):
		return _arm_means[key]
	var result: Variant = null
	for tr in a.get_track_count():
		if a.track_get_type(tr) != Animation.TYPE_ROTATION_3D or not a.track_is_enabled(tr):
			continue
		var path := a.track_get_path(tr)
		if path.get_subname_count() == 0 or String(path.get_subname(0)) != bone_name or a.track_get_key_count(tr) == 0:
			continue
		var sum := Vector4.ZERO
		var ref: Quaternion = a.rotation_track_interpolate(tr, 0.0)
		for i in 32:
			var q: Quaternion = a.rotation_track_interpolate(tr, a.length * float(i) / 32.0)
			if ref.dot(q) < 0.0:
				q = -q
			sum += Vector4(q.x, q.y, q.z, q.w)
		if sum.length_squared() > 0.0001:
			sum = sum.normalized()
			result = Quaternion(sum.x, sum.y, sum.z, sum.w)
		break
	_arm_means[key] = result
	return result

static func _smooth(x: float) -> float:
	return x * x * (3.0 - 2.0 * x)

## 열쇠 표 [[u, 값], …] 사이를 부드럽게.
static func _keyed(u: float, keys: Array) -> float:
	for i in range(1, keys.size()):
		var a: Array = keys[i - 1]
		var b: Array = keys[i]
		if u <= float(b[0]):
			var t := clampf((u - float(a[0])) / maxf(float(b[0]) - float(a[0]), 0.0001), 0.0, 1.0)
			return lerpf(float(a[1]), float(b[1]), _smooth(t))
	return float(keys[-1][1])

## 몸 앞으로 숙이는 축(위 × 앞) — 이 축으로 +각이면 위쪽이 앞으로 간다.
func _pitch_axis() -> Vector3:
	return Vector3.UP.cross(_fwd).normalized()

func _rot(skel: Skeleton3D, bone: int, axis: Vector3, deg: float) -> void:
	if bone < 0 or absf(deg) < 0.001:
		return
	var g := skel.get_bone_global_pose(bone)
	g.basis = Basis(axis, deg_to_rad(deg)) * g.basis
	skel.set_bone_global_pose(bone, g)

## bone 의 자식 뼈(child) 원점이 to 쪽을 보게 돌린다(w 만큼).
func _aim(skel: Skeleton3D, bone: int, child: int, to: Vector3, w: float) -> void:
	if bone < 0 or child < 0:
		return
	var g := skel.get_bone_global_pose(bone)
	var c := skel.get_bone_global_pose(child).origin - g.origin
	var d := to - g.origin
	if c.length() < 0.001 or d.length() < 0.001:
		return
	var q := Quaternion(c.normalized(), d.normalized())
	g.basis = Basis(Quaternion.IDENTITY.slerp(q, w)) * g.basis
	skel.set_bone_global_pose(bone, g)

func _rest_len(skel: Skeleton3D, a: int, b: int) -> float:
	return skel.get_bone_global_rest(a).origin.distance_to(skel.get_bone_global_rest(b).origin)

func _sit(skel: Skeleton3D, w: float) -> void:
	var ankle_y := skel.get_bone_global_rest(_b.foot0).origin.y
	var hp := skel.get_bone_global_pose(_b.hips)
	var hips_rest_y := skel.get_bone_global_rest(_b.hips).origin.y
	var thigh_rest_y := skel.get_bone_global_rest(_b.thigh0).origin.y if _b.thigh0 >= 0 else hips_rest_y
	var thigh_r := SIT_THIGH_R * thigh_rest_y / SIT_THIGH_REF
	hp.origin.y = lerpf(hp.origin.y, thigh_r + (hips_rest_y - thigh_rest_y), w)
	skel.set_bone_global_pose(_b.hips, hp)
	_rot(skel, _b.spine, _pitch_axis(), SIT_LEAN * w)
	_rot(skel, _b.chest, _pitch_axis(), 4.0 * w)
	var ax := _pitch_axis()
	for s in 2:
		var th: int = _b["thigh%d" % s]
		var ca: int = _b["calf%d" % s]
		var fo: int = _b["foot%d" % s]
		if th < 0 or ca < 0 or fo < 0:
			continue
		var o := skel.get_bone_global_pose(th).origin
		var a := _rest_len(skel, th, ca)
		var b := _rest_len(skel, ca, fo)
		var t := Vector3(o.x, ankle_y, o.z) + _fwd * float(SIT_FOOT_FWD[s])
		var dv := t - o
		var d := clampf(dv.length(), absf(a - b) + 0.001, a + b - 0.001)
		var cos_a := clampf((a * a + d * d - b * b) / (2.0 * a * d), -1.0, 1.0)
		var knee := o + (Basis(ax, -acos(cos_a)) * dv.normalized()) * a   # 무릎은 위·앞으로
		_aim(skel, th, ca, knee, w)
		_aim(skel, ca, fo, t, w)
		var fg := skel.get_bone_global_pose(fo)
		fg.basis = fg.basis.orthonormalized().slerp(skel.get_bone_global_rest(fo).basis.orthonormalized(), w).scaled(fg.basis.get_scale())
		skel.set_bone_global_pose(fo, fg)
	for s in 2:
		_sit_arm(skel, s, w)


## G-0394 앉은 팔 — 어깨(윗팔 뼈)에서 손목을 같은 쪽 무릎 위로 두 뼈 IK. 팔꿈치는 몸 바깥·아래로 굽힌다.
func _sit_arm(skel: Skeleton3D, s: int, w: float) -> void:
	var ua: int = _b["uarm%d" % s]
	var la: int = _b["larm%d" % s]
	var ha: int = _b["hand%d" % s]
	var kn: int = _b["calf%d" % s]
	if ua < 0 or la < 0 or ha < 0 or kn < 0:
		return
	var o := skel.get_bone_global_pose(ua).origin
	var knee := skel.get_bone_global_pose(kn).origin
	var t := knee + Vector3.UP * SIT_HAND_UP - _fwd * SIT_HAND_BACK
	var a := _rest_len(skel, ua, la)
	var b := _rest_len(skel, la, ha)
	var dv := t - o
	var d := clampf(dv.length(), absf(a - b) + 0.001, a + b - 0.001)
	var dir := dv.normalized()
	var side := -1.0 if s == 0 else 1.0   # 0 = 왼쪽
	var pole := (_right * side - Vector3.UP * 0.5).normalized()
	pole = (pole - dir * pole.dot(dir)).normalized()   # 어깨–손목 선에 수직인 바깥·아래
	var cos_a := clampf((a * a + d * d - b * b) / (2.0 * a * d), -1.0, 1.0)
	var elbow := o + dir * (a * cos_a) + pole * (a * sqrt(maxf(0.0, 1.0 - cos_a * cos_a)))
	_aim(skel, ua, la, elbow, w)
	_aim(skel, la, ha, o + dir * d, w)

func _wave(skel: Skeleton3D, w: float, u: float) -> void:
	var ua: int = _b.uarm1
	var la: int = _b.larm1
	var ha: int = _b.hand1
	if ua < 0 or la < 0 or ha < 0 or w < 0.001:
		return
	var s := skel.get_bone_global_pose(ua).origin
	var up_ang := deg_to_rad(WAVE_ELBOW_UP)
	var elbow := s + (_right * cos(up_ang) + Vector3.UP * sin(up_ang)) * _rest_len(skel, ua, la)
	_aim(skel, ua, la, elbow, w)
	var e := skel.get_bone_global_pose(la).origin
	var swing := sin(u * TAU * 2.0) * WAVE_SWING   # 두 번 흔든다
	var hand := e + (Basis(_fwd, deg_to_rad(swing)) * Vector3.UP) * _rest_len(skel, la, ha)
	_aim(skel, la, ha, hand, w)
	_rot(skel, _b.chest, _fwd, -2.0 * w)

func _turn_head(skel: Skeleton3D, deg: float) -> void:
	_rot(skel, _b.chest, Vector3.UP, deg * 0.22)
	_rot(skel, _b.neck, Vector3.UP, deg * 0.18)
	_rot(skel, _b.head, Vector3.UP, deg * 0.6)

func _shift(skel: Skeleton3D, w: float) -> void:
	if w < 0.001:
		return
	var hp := skel.get_bone_global_pose(_b.hips)
	hp.origin -= _right * SHIFT_DX * w
	hp.basis = Basis(_fwd, deg_to_rad(-4.0 * w)) * hp.basis
	skel.set_bone_global_pose(_b.hips, hp)
	_rot(skel, _b.spine, _fwd, 3.0 * w)
	_rot(skel, _b.chest, _fwd, 2.0 * w)
