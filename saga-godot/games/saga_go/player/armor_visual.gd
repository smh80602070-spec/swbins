extends RefCounted
## G-0060 — 낀 성유물이 몸에 갑옷 조각으로 보인다(101-3 G "성장 가시화"). 자체툴 `eq_<시대>_<등급>_<부위>` GLB 54 를 VRoid 뼈에 붙인다.
##   부위: 꽃 → chest · 깃 → shoulder · 해시계 → arm · 술잔 → leg + boot · 관 → head(다섯 다 끼면 여섯 부위, 좌우 포함 10 조각).
##   등급(그 성유물 하나): ★4 는 Lv 0~7 → 1, 8~ → 2 · ★5 는 0~7 → 1, 8~15 → 2, 16~ → 3.
##   시대(인물 era): 삼국지·한국사·일본사 → past · 세계사 → present · 균열(가상)·폐허(가상) → future · 나머지 → past.
##   GLB 규약(license.json·tools/world-forge/data/equip_slots.json): 원점 = 붙일 뼈의 머리, 인물 앞 = Blender -Y(= 고돗 +Z, 몸 앞과 같다).
##   왼쪽 부위(J_Bip_L_*)는 오른쪽에 X 뒤집은 사본. 몸마다 균등 배율 = 머리 뼈 높이 / 1.5m(기준 몸).
## 붙이는 길은 weapon_visual.gd(G-0029)와 같다 — 뼈 축을 몸 축으로 되돌리는 앵커(VroidBody.bone_anchor) 아래.

const VroidBody := preload("res://saga_core/world/vroid_body.gd")

const DIR := "res://assets/world/"
const PARTS_OF := {"flower": ["chest"], "plume": ["shoulder"], "sands": ["arm"], "goblet": ["leg", "boot"], "circlet": ["head"]}
## 부위 → [왼쪽(또는 가운데) 뼈 이름 후보, 오른쪽 뼈 이름 후보(거울 부위만)] — VRoid 이름 먼저, 공방 몸(UE 식) 이름 다음.
const BONES := {
	"head": [["J_Bip_C_Head", "head"], []],
	"chest": [["J_Bip_C_Chest", "spine_03", "spine_02"], []],
	"shoulder": [["J_Bip_L_UpperArm", "upperarm_l"], ["J_Bip_R_UpperArm", "upperarm_r"]],
	"arm": [["J_Bip_L_LowerArm", "lowerarm_l"], ["J_Bip_R_LowerArm", "lowerarm_r"]],
	"leg": [["J_Bip_L_LowerLeg", "calf_l"], ["J_Bip_R_LowerLeg", "calf_r"]],
	"boot": [["J_Bip_L_Foot", "foot_l"], ["J_Bip_R_Foot", "foot_r"]],
}
const PAST_ERAS := ["삼국지", "한국사", "일본사"]
const FUTURE_ERAS := ["균열(가상)", "폐허(가상)"]
const ANCHOR_NAME := "ArmorAnchor"
const REF_HEAD_H := 1.5 # equip_slots.json ref_head_bone_height_m


static func era_of(era: String) -> String:
	if era == "세계사":
		return "present"
	if era in FUTURE_ERAS:
		return "future"
	return "past"


static func grade_of(art: Dictionary) -> int:
	var lv := int(art.get("lv", 0))
	if lv < 8:
		return 1
	if int(art.get("rarity", 4)) >= 5 and lv >= 16:
		return 3
	return 2


## 낀 성유물 → 붙일 조각 목록 [{slot, part, path, bones, mirror}] — 화면 없이 셈(점검이 부른다). 거울 부위는 조각 하나에 mirror=true(붙일 때 둘).
static func pieces_for(artifacts: Array, era: String) -> Array:
	var out: Array = []
	var e := era_of(era)
	for a: Dictionary in artifacts:
		for part: String in PARTS_OF.get(String(a.get("slot", "")), []):
			var b: Array = BONES[part]
			out.append({"slot": String(a.slot), "part": part, "path": "%seq_%s_%d_%s.glb" % [DIR, e, grade_of(a), part],
				"bones": b[0], "mirror_bones": b[1], "mirror": not (b[1] as Array).is_empty()})
	return out


## 몸(Visual)에 조각을 붙인다(옛 조각은 먼저 치움). 붙인 GLB 수를 돌려준다.
static func attach(body: Node3D, pieces: Array) -> int:
	clear(body)
	if body == null or pieces.is_empty():
		return 0
	var skel: Skeleton3D = null
	for s in body.find_children("*", "Skeleton3D", true, false):
		skel = s as Skeleton3D
		break
	if skel == null:
		return 0
	var k := body_scale(skel)
	var n := 0
	for p: Dictionary in pieces:
		if not ResourceLoader.exists(String(p.path)):
			continue
		var packed := load(String(p.path)) as PackedScene
		if packed == null:
			continue
		n += _put(skel, packed, p.bones, false, String(p.part), k)
		if bool(p.mirror):
			n += _put(skel, packed, p.mirror_bones, true, String(p.part), k)
	return n


## 뼈대 공간 머리 뼈 높이 / 1.5 — 앵커가 뼈대(와 그 위 몸) 배율을 이미 물려받으므로 뼈대 공간 값으로 충분하다.
static func body_scale(skel: Skeleton3D) -> float:
	var head := VroidBody.find_bone_of(skel, BONES.head[0])
	if head < 0:
		return 1.0
	return maxf(skel.get_bone_global_rest(head).origin.y, 0.3) / REF_HEAD_H


static func _put(skel: Skeleton3D, packed: PackedScene, bone_names: Array, mirrored: bool, part: String, k: float) -> int:
	var bone := VroidBody.find_bone_of(skel, bone_names)
	if bone < 0:
		return 0
	var anchor := VroidBody.bone_anchor(skel, bone)
	anchor.name = ANCHOR_NAME
	var model := packed.instantiate() as Node3D
	model.name = "Armor_%s%s" % [part, "_R" if mirrored else ""]
	model.scale = Vector3(-k if mirrored else k, k, k)
	anchor.add_child(model)
	return 1


## 몸에 붙은 갑옷 조각을 치운다(앵커째).
static func clear(body: Node3D) -> void:
	if body == null:
		return
	for n in body.find_children(ANCHOR_NAME, "Node3D", true, false):
		var att := n.get_parent()
		if att != null and att.get_parent() != null:
			att.get_parent().remove_child(att)
			att.queue_free()


## 붙어 있는 조각 노드들(점검용).
static func worn(body: Node3D) -> Array:
	var out: Array = []
	if body == null:
		return out
	for n in body.find_children("Armor_*", "Node3D", true, false):
		out.append(n)
	return out
