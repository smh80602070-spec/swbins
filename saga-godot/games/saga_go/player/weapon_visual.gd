extends RefCounted
## G-0029 — 인물이 든 무기를 자체툴 `wpn_*` GLB 로 오른손에 쥔다(Unity U-0049 이식).
##   무기 종류 → 모델: 한손검 sword · 양손검 axe · 장병기 spear · 법구 staff · 활 bow, 등급 1~2 common · 3 rare · 4~5 legend.
##   GLB 규약: 노드 `grip`(원점 = 쥐는 곳) · `tip`(길이 방향 끝) · `up`, 단위 m. 목표 길이는 종류마다 정해 두고 `tip` 높이로 배율을 구한다.
##   손은 몸 오른손 뼈(VRoid J_Bip_R_Hand)에 얹는다 — 뼈 축을 몸 축으로 되돌리는 앵커를 거쳐 칼끝 방향 오프셋(HOLD_ROT_DEG)만 더한다.

const Weapons := preload("res://games/saga_go/data/weapons.gd")
const VroidBody := preload("res://saga_core/world/vroid_body.gd")

const DIR := "res://assets/world/"
const MODEL_OF := {"sword": "sword", "claymore": "axe", "polearm": "spear", "catalyst": "staff", "bow": "bow"}
const GRADE_OF := {1: "common", 2: "common", 3: "rare", 4: "legend", 5: "legend"}
const LENGTH_M := {"sword": 0.95, "claymore": 1.1, "polearm": 1.8, "catalyst": 1.1, "bow": 1.0}
const HAND_BONES := ["J_Bip_R_Hand", "hand_r"]
const HOLD_NAME := "HeldWeapon"
## 손 앵커(몸 축) 안에서 날(+Y)이 서 있게 하는 오프셋 — 창 모드 촬영으로 정했다(0 이면 날이 옆으로 누워 몸 밖을 향하고, Z +90 이면 땅을 향한다).
const HOLD_ROT_DEG := Vector3(0.0, 0.0, -90.0)

## 무기 id → GLB 경로. 모르는 id 면 "".
static func model_path(wid: String) -> String:
	if not Weapons.WEAPONS.has(wid):
		return ""
	var info: Dictionary = Weapons.info(wid)
	var kind: String = MODEL_OF.get(String(info.type), "")
	if kind == "":
		return ""
	return "%swpn_%s_%s.glb" % [DIR, kind, GRADE_OF.get(int(info.rarity), "common")]

## 모델을 지어 grip 이 원점·tip 이 목표 길이가 되게 맞춘다(없으면 null).
static func build(wid: String) -> Node3D:
	var path := model_path(wid)
	if path == "" or not ResourceLoader.exists(path):
		return null
	var packed := load(path) as PackedScene
	if packed == null:
		return null
	var model := packed.instantiate() as Node3D
	var tip := model.find_child("tip", true, false) as Node3D
	var grip := model.find_child("grip", true, false) as Node3D
	var length := 1.0
	if tip != null:
		length = maxf(tip.position.length(), 0.01)
	var want: float = LENGTH_M.get(String(Weapons.info(wid).type), 1.0)
	var holder := Node3D.new()
	holder.name = HOLD_NAME
	holder.scale = Vector3.ONE * (want / length)
	holder.set_meta("weapon_id", wid)
	holder.set_meta("model_path", path)
	if grip != null:
		model.position = -grip.position   # 쥐는 곳이 원점
	holder.add_child(model)
	return holder

## 몸(Visual) 오른손에 무기를 쥐게 한다. 옛 무기가 있으면 먼저 치운다. 쥔 노드(없으면 null)를 돌려준다.
static func attach(body: Node3D, wid: String) -> Node3D:
	clear(body)
	if body == null:
		return null
	var skel: Skeleton3D = null
	for s in body.find_children("*", "Skeleton3D", true, false):
		skel = s as Skeleton3D
		break
	if skel == null:
		return null
	var bone := VroidBody.find_bone_of(skel, HAND_BONES)
	if bone < 0:
		return null
	var weapon := build(wid)
	if weapon == null:
		return null
	var anchor := VroidBody.bone_anchor(skel, bone)
	anchor.name = "WeaponAnchor"
	weapon.rotation_degrees = HOLD_ROT_DEG
	anchor.add_child(weapon)
	return weapon

## 몸에 붙은 쥔 무기를 치운다(앵커째).
static func clear(body: Node3D) -> void:
	if body == null:
		return
	for n in body.find_children("WeaponAnchor", "Node3D", true, false):
		var att := n.get_parent()
		if att != null and att.get_parent() != null:
			att.get_parent().remove_child(att)   # 바로 트리에서 뺀다 — held() 가 옛 것을 다시 찾지 않게
			att.queue_free()

static func held(body: Node3D) -> Node3D:
	if body == null:
		return null
	return body.find_child(HOLD_NAME, true, false) as Node3D
