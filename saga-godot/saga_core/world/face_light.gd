extends SkeletonModifier3D

## G-0248 — 인물 얼굴 그림자(원신식). 몸의 Skeleton3D 자식으로 붙어 머리 뼈 앞 방향(월드)을
## 그 몸 얼굴 메시들의 instance uniform `head_fwd`(cel_toon.gdshader) 로 보낸다 — 셰이더가 얼굴 법선 대신
## 머리 앞을 섞은 수평 법선으로 명암을 내 코·입가·턱 얼룩 그늘이 사라지고 좌우 반쪽 그늘이 된다.
## CelShaderApply.apply_to 끝에서 attach 한다(플레이어·NPC·dex 몸·face_view 다 그 길이라 판 코드 수정 없음).
## 얼굴 표면 = cel_shader_apply._apply_one 이 "face_part" 메타를 단 재질(얼굴 메시의 살갗·눈썹·입·눈).
## 손잡이: SAGA_FACE_LIGHT=0 이면 붙지 않는다(face_mode 0 — 옛 법선 띠 그대로).
## SDF(K 대기): FACE_SDF_PATH 에 그림이 생기면 face_sdf_on=1 로 바로 꽂힌다(VRoid 얼굴은 UV 가 같아 한 장을 나눠 쓴다).
## 갱신은 머리가 MOVE_DOT 보다 더 돌았을 때만(가만히 선 NPC 는 RenderingServer 호출 0).

const HEAD_BONES := ["J_Bip_C_Head", "Head"]
const FACE_SDF_PATH := "res://assets/face_sdf/face_sdf.png"
const MOVE_DOT := 0.9995 # 약 1.8° 안쪽 흔들림은 안 보낸다

static var _sdf: Texture2D = null
static var _sdf_checked := false

var _head := -1
var _local_fwd := Vector3.FORWARD # 머리 뼈 공간에서 얼굴 앞
var _meshes: Array[MeshInstance3D] = []
var _last := Vector3.ZERO


static func enabled() -> bool:
	return OS.get_environment("SAGA_FACE_LIGHT") != "0"


static func sdf_texture() -> Texture2D:
	if not _sdf_checked:
		_sdf_checked = true
		if ResourceLoader.exists(FACE_SDF_PATH):
			_sdf = load(FACE_SDF_PATH) as Texture2D
	return _sdf


## root 아래 얼굴 재질에 face_mode=1 을 켜고 첫 Skeleton3D 에 이 수정자를 붙인다(이미 있으면 얼굴 목록만 새로).
## 머리 뼈가 없거나 얼굴 재질이 없으면 null(그 몸은 face_mode 0 그대로).
static func attach(root: Node) -> Node:
	if not enabled():
		return null
	var skels := root.find_children("*", "Skeleton3D", true, false)
	if root is Skeleton3D:
		skels.insert(0, root)
	if skels.is_empty():
		return null
	var skel := skels[0] as Skeleton3D
	var head := -1
	for n in HEAD_BONES:
		head = skel.find_bone(String(n))
		if head >= 0:
			break
	if head < 0:
		return null
	var sdf := sdf_texture()
	var faces: Array[MeshInstance3D] = []
	for node in root.find_children("*", "MeshInstance3D", true, false):
		var mi := node as MeshInstance3D
		var any := false
		for si in mi.get_surface_override_material_count():
			var sm := mi.get_surface_override_material(si) as ShaderMaterial
			if sm == null or not sm.get_meta("face_part", false):
				continue
			sm.set_shader_parameter("face_mode", 1.0)
			if sdf != null:
				sm.set_shader_parameter("face_sdf", sdf)
				sm.set_shader_parameter("face_sdf_on", 1.0)
			any = true
		if any:
			faces.append(mi)
	if faces.is_empty():
		return null
	var fl: Node = null
	for c in skel.get_children():
		if c.get_meta("face_light", false):
			fl = c
	if fl == null:
		fl = (load("res://saga_core/world/face_light.gd") as GDScript).new()
		fl.name = "FaceLight"
		fl.set_meta("face_light", true)
		skel.add_child(fl)
	fl.call("_setup", skel, head, faces)
	return fl


func _setup(skel: Skeleton3D, head: int, faces: Array[MeshInstance3D]) -> void:
	_head = head
	_meshes = faces
	_last = Vector3.ZERO
	## 몸 앞(뼈대 공간 ±Z) — 오른발목 → 발끝 쉬는 자세 방향(talk_face·vroid_body.front_sign 과 같은 법).
	var front := 1.0
	var foot := skel.find_bone("J_Bip_R_Foot")
	if foot < 0:
		foot = skel.find_bone("foot_r")
	var toe := skel.find_bone("J_Bip_R_ToeBase")
	if toe < 0:
		toe = skel.find_bone("ball_r")
	if foot >= 0 and toe >= 0 and skel.get_bone_global_rest(toe).origin.z < skel.get_bone_global_rest(foot).origin.z:
		front = -1.0
	## 뼈 굴림(roll)이 있어도 맞게 — 쉬는 자세의 머리 뼈 공간으로 앞을 옮겨 둔다.
	_local_fwd = (skel.get_bone_global_rest(head).basis.inverse() * Vector3(0.0, 0.0, front)).normalized()


func _process_modification() -> void:
	var skel := get_skeleton()
	if skel == null or _head < 0:
		return
	var f := (skel.global_transform.basis * skel.get_bone_global_pose(_head).basis * _local_fwd).normalized()
	if f.dot(_last) > MOVE_DOT:
		return
	_last = f
	for mi in _meshes:
		if is_instance_valid(mi):
			mi.set_instance_shader_parameter("head_fwd", f)


## 점검용 — 마지막으로 보낸 머리 앞(아직 안 보냈으면 0).
func last_fwd() -> Vector3:
	return _last
