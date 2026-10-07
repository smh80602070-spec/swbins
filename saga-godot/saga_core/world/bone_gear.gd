extends RefCounted
## G-0063 — 자체툴 장비·꾸밈 GLB(eq_·acc_)를 인물 몸(VRoid/공방 몸) 뼈에 붙이는 공용 길. 사가만리 갑옷(armor_visual.gd, G-0060)·
## 사가마을 옷(forest_wear_visual.gd)이 같이 쓴다(네 판은 saga_go 를 부르지 않는다 — 참조 방향).
## 규약(tools/world-forge/data/equip_slots.json): 조각 원점 = 붙일 뼈의 머리(T-자세), 인물 앞 = 고돗 +Z, 왼쪽 조각은 오른쪽 뼈에 X -1 배율 사본,
## 몸마다 균등 배율 = 머리 뼈 높이 / 1.5m. 붙이는 자리는 뼈 축을 몸 축으로 되돌린 앵커(VroidBody.bone_anchor) — 손 무기(G-0029)와 같다.
## tag 로 앵커 이름을 갈라(예 "armor"·"forest_gear") 한 몸에 둘이 붙어도 서로 안 지운다.
## G-0083 — K-0081 몸 맞춤 두 칸(equip_slots.json — 고돗 res:// 밖이라 값을 아래 상수로 옮김):
##   fit.chest   가슴판만 X 배율 × clamp(어깨 폭 / k / 0.145, 0.75, 1.15)(어깨 폭 = |L_UpperArm.x − Chest.x|, 뼈대 공간 T-자세)
##   hide_match  입은 슬롯의 hides → 몸 재질 이름(원 메시 재질, 대소문자 무시)에 그 글자가 든 표면만 숨김(표면 단위 — 메시 통째면 몸이 사라진다).
##   숨김은 표면 덮개 재질을 비우는 셰이더로 바꾸고 원래 덮개를 메타에 둔다 — clear(tag) 가 되돌린다.

const VroidBody := preload("res://saga_core/world/vroid_body.gd")

const REF_HEAD_H := 1.5 # equip_slots.json ref_head_bone_height_m
const FIT_REF_SHOULDER_X := 0.145 # equip_slots.json fit.chest.ref_shoulder_x_m
const FIT_CLAMP := Vector2(0.75, 1.15) # fit.chest.clamp
const HIDE_META := "gear_hidden_"
## 숨긴 표면 — 정점을 한 점으로 모아 어떤 패스(그림자 포함)에도 안 그린다.
const HIDE_SHADER := "shader_type spatial;
render_mode unshaded;
void vertex() { VERTEX = vec3(0.0); }
void fragment() { ALPHA = 0.0; }
"
static var _hide_mat: ShaderMaterial
## 뼈 이름 후보 — VRoid 이름 먼저, 공방 몸(UE 식) 이름 다음. 갑옷(armor_visual)·사가마을 옷이 같이 쓴다(G-0067: 세 곳에 복사돼 있던 것).
const HEAD_BONES := ["J_Bip_C_Head", "head"]
const NECK_BONES := ["J_Bip_C_Neck", "neck_01"]
const CHEST_BONES := ["J_Bip_C_Chest", "spine_03", "spine_02"]
const UPPER_CHEST_BONES := ["J_Bip_C_UpperChest", "spine_03"]
const HIPS_BONES := ["J_Bip_C_Hips", "pelvis"]
const L_UPPER_ARM := ["J_Bip_L_UpperArm", "upperarm_l"]
const R_UPPER_ARM := ["J_Bip_R_UpperArm", "upperarm_r"]
const L_LOWER_ARM := ["J_Bip_L_LowerArm", "lowerarm_l"]
const R_LOWER_ARM := ["J_Bip_R_LowerArm", "lowerarm_r"]
const L_LOWER_LEG := ["J_Bip_L_LowerLeg", "calf_l"]
const R_LOWER_LEG := ["J_Bip_R_LowerLeg", "calf_r"]
const L_FOOT := ["J_Bip_L_Foot", "foot_l"]
const R_FOOT := ["J_Bip_R_Foot", "foot_r"]


static func skeleton_of(body: Node3D) -> Skeleton3D:
	if body == null:
		return null
	for s in body.find_children("*", "Skeleton3D", true, false):
		return s as Skeleton3D
	return null


## 뼈대 공간 머리 뼈 높이 / 1.5 — 앵커가 뼈대(와 그 위 몸) 배율을 이미 물려받으므로 뼈대 공간 값으로 충분하다.
static func body_scale(skel: Skeleton3D) -> float:
	var head := VroidBody.find_bone_of(skel, HEAD_BONES)
	if head < 0:
		return 1.0
	return maxf(skel.get_bone_global_rest(head).origin.y, 0.3) / REF_HEAD_H


## fit.chest — 가슴판 X 배율(어깨 폭 비율). 뼈를 못 찾으면 1.
static func chest_fit(skel: Skeleton3D, k: float) -> float:
	var arm := VroidBody.find_bone_of(skel, L_UPPER_ARM)
	var chest := VroidBody.find_bone_of(skel, CHEST_BONES)
	if arm < 0 or chest < 0 or k <= 0.0:
		return 1.0
	var sh := absf(skel.get_bone_global_rest(arm).origin.x - skel.get_bone_global_rest(chest).origin.x) / k
	return clampf(sh / FIT_REF_SHOULDER_X, FIT_CLAMP.x, FIT_CLAMP.y)


## GLB 하나를 뼈에 붙인다(mirror_bones 가 있으면 오른쪽 사본도). 붙인 수(0~2)를 돌려준다. 노드 이름 = <name>(·<name>_R).
## fit == "chest" 면 X 만 chest_fit 배(G-0083).
static func attach(body: Node3D, path: String, bones: Array, mirror_bones: Array, tag: String, name: String, fit := "") -> int:
	var skel := skeleton_of(body)
	if skel == null or not ResourceLoader.exists(path):
		return 0
	var packed := load(path) as PackedScene
	if packed == null:
		return 0
	var k := body_scale(skel)
	var kx := chest_fit(skel, k) if fit == "chest" else 1.0
	var n := _put(skel, packed, bones, false, tag, name, k, kx)
	if not mirror_bones.is_empty():
		n += _put(skel, packed, mirror_bones, true, tag, name + "_R", k, kx)
	return n


static func _put(skel: Skeleton3D, packed: PackedScene, bone_names: Array, mirrored: bool, tag: String, name: String, k: float, kx := 1.0) -> int:
	var bone := VroidBody.find_bone_of(skel, bone_names)
	if bone < 0:
		return 0
	## G-0067 — 먼저 지어 보고(뿌리가 Node3D 가 아니면 빈 앵커를 남기지 않게) 앵커를 단다.
	var inst := packed.instantiate()
	var model := inst as Node3D
	if model == null:
		if inst != null:
			inst.free()
		return 0
	var anchor := VroidBody.bone_anchor(skel, bone)
	anchor.name = anchor_name(tag)
	model.name = name
	model.scale = Vector3((-k if mirrored else k) * kx, k, k)
	anchor.add_child(model)
	return 1


static func anchor_name(tag: String) -> String:
	return "Gear_%s" % tag


## hide_match — 몸 표면 중 원 재질 이름에 patterns 글자가 든 것을 숨긴다. 숨긴 표면 수.
static func hide_surfaces(body: Node3D, patterns: Array, tag: String) -> int:
	if body == null or patterns.is_empty():
		return 0
	if _hide_mat == null:
		var sh := Shader.new()
		sh.code = HIDE_SHADER
		_hide_mat = ShaderMaterial.new()
		_hide_mat.shader = sh
	var n := 0
	for node in body.find_children("*", "MeshInstance3D", true, false):
		var mi := node as MeshInstance3D
		if mi.mesh == null or _under_gear(mi, body):
			continue
		var saved: Dictionary = mi.get_meta(HIDE_META + tag, {})
		for i in mi.mesh.get_surface_count():
			var src := mi.mesh.surface_get_material(i)
			var nm := src.resource_name.to_upper() if src != null else ""
			if nm == "" or saved.has(i) or mi.get_surface_override_material(i) == _hide_mat:
				continue
			for p in patterns:
				if nm.contains(String(p).to_upper()):
					saved[i] = mi.get_surface_override_material(i)
					mi.set_surface_override_material(i, _hide_mat)
					n += 1
					break
		if not saved.is_empty():
			mi.set_meta(HIDE_META + tag, saved)
	return n


## hide_surfaces 로 숨긴 것을 원래 덮개로.
static func unhide(body: Node3D, tag: String) -> void:
	if body == null:
		return
	for node in body.find_children("*", "MeshInstance3D", true, false):
		var mi := node as MeshInstance3D
		if not mi.has_meta(HIDE_META + tag):
			continue
		var saved: Dictionary = mi.get_meta(HIDE_META + tag)
		for i in saved:
			mi.set_surface_override_material(int(i), saved[i])
		mi.remove_meta(HIDE_META + tag)


## 숨긴 표면 수(점검용).
static func hidden_count(body: Node3D, tag: String) -> int:
	var n := 0
	if body != null:
		for mi in body.find_children("*", "MeshInstance3D", true, false):
			n += (mi.get_meta(HIDE_META + tag, {}) as Dictionary).size()
	return n


static func _under_gear(n: Node, body: Node) -> bool:
	var p := n.get_parent()
	while p != null and p != body:
		if String(p.name).begins_with("Gear_"):
			return true
		p = p.get_parent()
	return false


## 그 tag 로 붙인 것을 앵커째 치우고 숨긴 표면을 되돌린다.
static func clear(body: Node3D, tag: String) -> void:
	if body == null:
		return
	unhide(body, tag)
	for n in body.find_children(anchor_name(tag), "Node3D", true, false):
		var att := n.get_parent()
		if att != null and att.get_parent() != null:
			att.get_parent().remove_child(att)
			att.queue_free()


## 그 tag 로 붙은 조각 노드들(점검용).
static func worn(body: Node3D, tag: String) -> Array:
	var out: Array = []
	if body == null:
		return out
	for a in body.find_children(anchor_name(tag), "Node3D", true, false):
		for c in a.get_children():
			out.append(c)
	return out
