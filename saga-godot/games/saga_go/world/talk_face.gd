extends SkeletonModifier3D

## PLAN 106장 ㉙ — 대화 몸짓. VRoid 몸 하나(Skeleton3D 자식)에 붙어 입 모양·표정·눈 깜박임·말하는 동안 손짓과 끄덕임을 한다.
##   입 모양: speak(글자) — 한글 음절의 가운뎃소리(모음)로 VRoid 입 모양 다섯(Fcl_MTH_A·I·U·E·O) 중 하나를 연다. 한글이 아니면(빈칸·문장부호) 닫는다.
##   표정: set_mood("joy"·"angry"·"sorrow"·"surprised"·"fun"·"") — Fcl_ALL_* 를 MOOD_W 까지 천천히.
##   눈 깜박임: 늘(BLINK_MIN~MAX 초마다 BLINK_SEC 동안 Fcl_EYE_Close).
##   손짓: set_talking(true) 동안 — 애니메이션이 놓은 자세 위에 오른팔을 앞으로 들고(윗팔 ARM_SWING°·아랫팔 FORE_BEND°, 천천히 흔듦)
##     머리를 글자마다 조금 끄덕인다(NOD°). 뼈 회전은 뼈대 공간 X 축으로 돌리고, 몸 앞이 +Z 인지 -Z 인지는 모델마다
##     발목(Foot) → 발끝(ToeBase) 쉬는 자세 방향으로 잰다(_front) — VRoid 셋 다 뼈대 공간 앞이 같다고 가정하지 않는다.
##     세기는 SkeletonModifier3D `influence` 로 섞어 켜고 끈다(GESTURE_BLEND).
##   입 그림: 블렌드셰이프 없는 몸(공방)은 살갗 텍스처의 입 자리에 벌린 입을 덧그린 복사본(anime_mouth)을 갈아 끼운다(open·round·thin, 첫 말할 때 만든다).
## 모델에 그 블렌드셰이프·뼈가 없으면 그 부분만 조용히 건너뛴다.

const VISEMES := ["Fcl_MTH_A", "Fcl_MTH_I", "Fcl_MTH_U", "Fcl_MTH_E", "Fcl_MTH_O"]
const MOODS := {"joy": "Fcl_ALL_Joy", "angry": "Fcl_ALL_Angry", "sorrow": "Fcl_ALL_Sorrow", "surprised": "Fcl_ALL_Surprised", "fun": "Fcl_ALL_Fun"}
const BLINK_SHAPE := "Fcl_EYE_Close"
## 가운뎃소리 21 → 입 모양(0 A·1 I·2 U·3 E·4 O). ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ
const VOWEL_VISEME := [0, 3, 0, 3, 4, 3, 4, 3, 4, 0, 3, 3, 4, 2, 4, 3, 1, 2, 2, 1, 1]
const MOUTH_OPEN := 0.85
const MOUTH_SHOW := 0.3 # 입 그림을 바꿔 보여 줄 문턱(블렌드셰이프 없는 몸)
## 입 모양 번호(A·I·U·E·O) → anime_mouth 종류
const VISEME_KIND := ["open", "thin", "round", "open", "round"]
const ANIME_MOUTH := preload("res://saga_core/anime_mouth.gd")
const MOUTH_DECAY := 6.0 # 입이 닫히는 빠르기(세기/초 — 한 글자 연 입이 0.14초쯤에 닫힌다)
const MOUTH_BLEND := 22.0
const MOOD_W := 0.7
const MOOD_BLEND := 5.0
const BLINK_MIN := 2.2
const BLINK_MAX := 5.0
const BLINK_SEC := 0.14
const GESTURE_BLEND := 6.0
const ARM_SWING := 38.0
const FORE_BEND := 42.0
const ARM_SWAY := 7.0
const NOD := 5.0

var _eye_mats: Array = [] # 블렌드셰이프 없는 몸(공방): 눈 재질에 감은 눈 그림을 갈아 끼워 깜박인다(cel_shader_apply 가 메타로 실어 둔다)
var _eye_shut := false
var _mouth_mats: Array = [] # 벌린 입 그림을 갈아 끼울 살갗 재질(cel_shader_apply 가 mouth_base 메타로 표시)
var _mouth_texs: Dictionary = {} # 재질 → {종류: 텍스처}, 첫 말할 때 만든다
var _mouth_kind := "" # 지금 보이는 입 그림("" = 원본 다문 입)
var _shapes: Dictionary = {} # 블렌드셰이프 이름 → [[MeshInstance3D, idx], …]
var _mouth := [0.0, 0.0, 0.0, 0.0, 0.0]
var _mouth_to := [0.0, 0.0, 0.0, 0.0, 0.0]
var _mood := ""
var _mood_w: Dictionary = {}
var _blink_t := 0.0
var _blink_left := 0.0
var _talking := false
var _nod := 0.0
var _t := 0.0
var _rng := RandomNumberGenerator.new()
var _b_head := -1
var _b_uarm := -1
var _b_larm := -1
var _front := 1.0 # 뼈대 공간에서 몸 앞이 +Z 면 1, -Z 면 -1

## 몸(VroidBody.build 결과·플레이어 Visual)에 붙인다 — 뼈대가 없으면 null. 이미 붙어 있으면 그것.
static func attach(body: Node) -> Node:
	var skels := body.find_children("*", "Skeleton3D", true, false)
	if skels.is_empty():
		return null
	var skel := skels[0] as Skeleton3D
	for c in skel.get_children():
		if c.get_meta("talk_face", false):
			return c
	var tf: SkeletonModifier3D = (load("res://games/saga_go/world/talk_face.gd") as GDScript).new()
	tf.name = "TalkFace"
	tf.set_meta("talk_face", true)
	skel.add_child(tf)
	tf.call("_collect", body)
	return tf

func _collect(body: Node) -> void:
	_rng.seed = hash(body.get_path()) if body.is_inside_tree() else 20260824
	_blink_t = _rng.randf_range(BLINK_MIN, BLINK_MAX)
	var names: Array = VISEMES + MOODS.values() + [BLINK_SHAPE]
	for mi in body.find_children("*", "MeshInstance3D", true, false):
		var m := mi as MeshInstance3D
		for n in names:
			var idx := m.find_blend_shape_by_name(n)
			if idx >= 0:
				if not _shapes.has(n):
					_shapes[n] = []
				(_shapes[n] as Array).append([m, idx])
	for mi in body.find_children("Eyes", "MeshInstance3D", true, false):
		var em := mi as MeshInstance3D
		for si in em.get_surface_override_material_count():
			var sm := em.get_surface_override_material(si) as ShaderMaterial
			if sm != null and sm.has_meta("eye_closed"):
				_eye_mats.append(sm)
	for mi in body.find_children("*", "MeshInstance3D", true, false):
		var bm := mi as MeshInstance3D
		for si in bm.get_surface_override_material_count():
			var sm := bm.get_surface_override_material(si) as ShaderMaterial
			if sm != null and sm.has_meta("mouth_base") and not _mouth_mats.has(sm):
				_mouth_mats.append(sm)
	var skel := get_parent() as Skeleton3D
	## 2026-09-29 — 공방 몸(char-forge, UE 식 뼈 이름)도. 몸짓은 뼈대 공간 축으로 돌려(_rotate_global) 뼈 축이 달라도 같은 방향이다.
	_b_head = _bone(skel, ["J_Bip_C_Head", "Head"])
	_b_uarm = _bone(skel, ["J_Bip_R_UpperArm", "upperarm_r"])
	_b_larm = _bone(skel, ["J_Bip_R_LowerArm", "lowerarm_r"])
	var foot := _bone(skel, ["J_Bip_R_Foot", "foot_r"])
	var toe := _bone(skel, ["J_Bip_R_ToeBase", "ball_r"])
	if foot >= 0 and toe >= 0:
		var dz := skel.get_bone_global_rest(toe).origin.z - skel.get_bone_global_rest(foot).origin.z
		_front = -1.0 if dz < 0.0 else 1.0
	influence = 0.0

static func _bone(skel: Skeleton3D, names: Array) -> int:
	for n in names:
		var i := skel.find_bone(String(n))
		if i >= 0:
			return i
	return -1

func has_mouth() -> bool:
	return _shapes.has("Fcl_MTH_A")

## 글자 하나를 말한다 — 한글이면 그 모음 입 모양을 열고, 아니면 닫는다.
func speak(ch: String) -> void:
	for i in 5:
		_mouth_to[i] = 0.0
	var v := viseme_of(ch)
	if v >= 0:
		_mouth_to[v] = MOUTH_OPEN
		_nod = 1.0
		if not _mouth_mats.is_empty() and _mouth_texs.is_empty():
			_build_mouth_texs()

## 한글 음절 → 입 모양 번호(0~4), 한글이 아니면 -1.
static func viseme_of(ch: String) -> int:
	if ch.is_empty():
		return -1
	var c := ch.unicode_at(0)
	if c < 0xAC00 or c > 0xD7A3:
		return -1
	var medial := ((c - 0xAC00) / 28) % 21
	return int(VOWEL_VISEME[medial])

func set_mood(m: String) -> void:
	_mood = m if MOODS.has(m) else ""

func set_talking(on: bool) -> void:
	_talking = on
	if not on:
		for i in 5:
			_mouth_to[i] = 0.0

func is_talking() -> bool:
	return _talking

## 지금 가장 크게 열린 입 모양(점검용) — [번호, 세기].
func mouth_state() -> Array:
	var best := -1
	var w := 0.0
	for i in 5:
		if _mouth[i] > w:
			w = _mouth[i]
			best = i
	return [best, w]

func front_sign() -> float:
	return _front

func mood_weight(m: String) -> float:
	return float(_mood_w.get(m, 0.0))

func blink_weight() -> float:
	return _shape_value(BLINK_SHAPE)

func _process(delta: float) -> void:
	_t += delta
	## 입 — 목표로 빠르게 가고, 목표는 저절로 닫혀 간다(다음 글자가 다시 연다).
	var km := 1.0 - exp(-MOUTH_BLEND * delta)
	for i in 5:
		_mouth_to[i] = maxf(float(_mouth_to[i]) - MOUTH_DECAY * delta, 0.0)
		_mouth[i] = lerpf(float(_mouth[i]), float(_mouth_to[i]), km)
		_set_shape(VISEMES[i], _mouth[i])
	if not _mouth_texs.is_empty():
		_show_mouth()
	## 표정.
	var kf := 1.0 - exp(-MOOD_BLEND * delta)
	for m in MOODS:
		var want := MOOD_W if m == _mood else 0.0
		var w := lerpf(float(_mood_w.get(m, 0.0)), want, kf)
		_mood_w[m] = w
		_set_shape(MOODS[m], w)
	## 눈 깜박임.
	if _blink_left > 0.0:
		_blink_left -= delta
		_set_shape(BLINK_SHAPE, 1.0 if _blink_left > 0.0 else 0.0)
		_shut_eyes(_blink_left > 0.0)
	else:
		_blink_t -= delta
		if _blink_t <= 0.0:
			_blink_t = _rng.randf_range(BLINK_MIN, BLINK_MAX)
			_blink_left = BLINK_SEC
	## 손짓 세기.
	influence = lerpf(influence, 1.0 if _talking else 0.0, 1.0 - exp(-GESTURE_BLEND * delta))
	_nod = maxf(_nod - delta * 5.0, 0.0)

func _process_modification() -> void:
	var skel := get_skeleton()
	if skel == null or influence < 0.001:
		return
	var sway := sin(_t * 2.3) * ARM_SWAY
	## 뼈대 공간 X 축으로 돌린다 — 앞이 +Z 면 -각도가 늘어진 팔을 앞으로, +각도가 얼굴을 아래로(앞이 -Z 면 반대).
	if _b_uarm >= 0:
		_rotate_global(skel, _b_uarm, Vector3.RIGHT, deg_to_rad(-_front * (ARM_SWING + sway)))
	if _b_larm >= 0:
		_rotate_global(skel, _b_larm, Vector3.RIGHT, deg_to_rad(-_front * (FORE_BEND + sway * 0.6)))
	if _b_head >= 0:
		_rotate_global(skel, _b_head, Vector3.RIGHT, deg_to_rad(_front * NOD * (0.35 + _nod)))

## 그 뼈를 제자리(뼈 원점)에서 뼈대 공간 축으로 돌린다 — 부모에 대한 자세로 되돌려 넣는다.
func _rotate_global(skel: Skeleton3D, bone: int, axis: Vector3, angle: float) -> void:
	var g := skel.get_bone_global_pose(bone)
	g.basis = Basis(axis, angle) * g.basis
	skel.set_bone_global_pose(bone, g)

## 벌린 입 그림 세 장을 재질마다 만든다(2048² 복사·덧그리기 — 첫 말할 때 한 번, 같은 원본은 캐시를 나눠 쓴다).
func _build_mouth_texs() -> void:
	for sm in _mouth_mats:
		var texs: Dictionary = ANIME_MOUTH.textures_for((sm as ShaderMaterial).get_meta("mouth_base"), (sm as ShaderMaterial).get_meta("mouth_uv"))
		if not texs.is_empty():
			_mouth_texs[sm] = texs

## 지금 가장 크게 열린 입 모양에 맞는 그림을 보인다 — 문턱 아래면 원본(다문 입).
func _show_mouth() -> void:
	var st := mouth_state()
	var kind: String = VISEME_KIND[int(st[0])] if int(st[0]) >= 0 and float(st[1]) > MOUTH_SHOW else ""
	if kind == _mouth_kind:
		return
	_mouth_kind = kind
	for sm in _mouth_texs:
		(sm as ShaderMaterial).set_shader_parameter("albedo_texture", (_mouth_texs[sm] as Dictionary)[kind] if kind != "" else (sm as ShaderMaterial).get_meta("mouth_base"))

## 지금 보이는 입 그림 종류(점검용).
func mouth_kind() -> String:
	return _mouth_kind

func _shut_eyes(shut: bool) -> void:
	if shut == _eye_shut or _eye_mats.is_empty():
		return
	_eye_shut = shut
	for sm in _eye_mats:
		(sm as ShaderMaterial).set_shader_parameter("albedo_texture", (sm as ShaderMaterial).get_meta("eye_closed" if shut else "eye_open"))

func _set_shape(n: String, w: float) -> void:
	for pair in _shapes.get(n, []):
		(pair[0] as MeshInstance3D).set_blend_shape_value(int(pair[1]), w)

func _shape_value(n: String) -> float:
	var list: Array = _shapes.get(n, [])
	return (list[0][0] as MeshInstance3D).get_blend_shape_value(int(list[0][1])) if not list.is_empty() else 0.0
