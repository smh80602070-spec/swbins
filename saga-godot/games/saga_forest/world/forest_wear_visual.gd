extends Node3D

## VERTICAL_SLICE_FOREST.md 4절 "제외" 목록 6번(옷) 중 화면에 보이는
## 절반 — forest_wear.gd 상단 주석 참고: 옷 빛(dye)은 GLB 텍스처에
## StandardMaterial3D.albedo_color를 곱색으로 얹고(games/saga_go/world/
## bandit_encounter.gd의 강타 예고 물들이기와 같은 GLBUtils.
## find_all_mesh_instances 활용 — 다만 여기는 되돌리지 않고 계속
## 남긴다). 덧옷·머리·겉옷 갑옷은 G-0063 부터 자체툴 GLB 를 뼈에 붙인다(아래 HEAD_GLB 등 — 그림이 없는 것은 안 붙임).
##
## GO/DUNGEON의 Player.tscn·player.gd는 건드리지 않는다 — 이 스크립트가
## TestVillageForest.tscn에만 붙어 FOREST 안에서만 플레이어를 찾아
## 건드린다(player.gd 자체는 GO/FOREST가 공유하는 범용 컴포넌트라
## FOREST 전용 로직을 거기 넣지 않는다).

## 2026-09-23 — 플레이어가 09-19에 VRoid(saga_forest_avatar_01)로 바뀐 뒤에도
## 여기는 옛 Kenney 방식(모든 메시에 texture-a.png 재질 하나를 material_override)
## 그대로라, 염색하면 VRoid에 엉뚱한 아틀라스가 입혀지고 cel_toon·얼굴 베이크·
## 외곽선이 통째로 사라졌다(빼도 흰 tint로 다시 덮어 안 돌아왔다). 이제는
## cel_shader_apply.gd가 표면마다 박아 둔 cel_toon의 albedo_tint에 곱색만
## 얹는다 — VRoid는 옷이 재질 단위로 나뉘어 있어(이름 끝 "_CLOTH": Tops·
## Bottoms·Shoes) 피부·머리·얼굴은 안 물들이고 옷만 물들인다.
const CLOTH_KEY := "CLOTH" # 대문자로 견준다 — VRoid "…_CLOTH…" · 공방 몸(09-29) "cloth_a"
const BASE_TINT_META := &"dye_base_tint"

## G-0063 — 머리·덧옷·겉옷 갑옷을 자체툴 GLB 로 몸 뼈에 붙인다(saga_core/world/bone_gear.gd, 사가고 갑옷과 같은 길).
## 판 도형 덧옷(_build_cape)은 걷어냈다. 그림이 없는 것(맨머리·상투·평상복·도포·두루마기)은 아무것도 안 붙인다.
const BoneGear := preload("res://saga_core/world/bone_gear.gd")
const TAG := "forest_gear"
const DIR := "res://assets/world/"
const HEAD_GLB := {"braid": "acc_ribbon", "scholar": "acc_headband", "gat": "acc_hat_wide", "hairpin": "acc_crown", "helmet": "acc_hat_pointed"}
const CAPE_GLB := "acc_cape_long"
const PLATE_GLB := ["eq_past_2_chest", "eq_past_2_shoulder"]

var _player: Node3D = null
var _skel: Skeleton3D = null
var _last_dye := ""
var _last_gear := ""


func _process(_delta: float) -> void:
	if _player == null or not is_instance_valid(_player):
		_player = get_tree().get_first_node_in_group("player")
		if _player == null:
			return
		_last_dye = ""  # 처음 찾았을 때 강제로 한 번 다시 칠한다
		_last_gear = ""
	## 몸이 바뀌면(swap_body — 옛 뼈대는 사라진다) 다시 붙이고 다시 칠한다. 뼈대가 살아 있으면 다시 찾지 않는다(G-0067 — 매 프레임 몸 전체를 훑지 않게).
	if _skel == null or not is_instance_valid(_skel) or not _skel.is_inside_tree():
		_skel = BoneGear.skeleton_of(_player)
		if _skel == null:
			return   # 몸이 아직 없으면 기다린다
		_last_dye = ""
		_last_gear = ""

	var dye: String = ForestSaveState.wearing("dye")
	if dye != _last_dye:
		## G-0067 — 셰이더 재질이 아직 안 붙어(cel_shader_apply 가 늦게 돌면) 칠한 면이 0 이면 다음 프레임에 다시.
		if _apply_dye(dye) > 0:
			_last_dye = dye

	var gear := "%s|%s|%s" % [ForestSaveState.wearing("head"), ForestSaveState.wearing("cape"), ForestSaveState.wearing("coat")]
	if gear != _last_gear:
		_last_gear = gear
		apply_gear(_player, ForestSaveState.wearing("head"), ForestSaveState.wearing("cape"), ForestSaveState.wearing("coat"))


## 머리·덧옷·겉옷 → 붙일 GLB 줄기 목록(화면 없이 셈 — 점검이 부른다).
static func gear_ids(head: String, cape: String, coat: String) -> Array:
	var out: Array = []
	if HEAD_GLB.has(head):
		out.append(HEAD_GLB[head])
	if cape == "on":
		out.append(CAPE_GLB)
	if coat == "plate":
		out.append_array(PLATE_GLB)
	return out


## 옛 것을 치우고 다시 붙인다. 붙인 조각 수(어깨는 좌우 둘)를 돌려준다.
## 붙인 조각은 옷 빛을 안 받는다(의도 — 갓 짚빛·망토 등 자체툴 조각은 제 색).
static func apply_gear(player: Node3D, head: String, cape: String, coat: String) -> int:
	BoneGear.clear(player, TAG)
	var n := 0
	for id: String in gear_ids(head, cape, coat):
		var bones: Array = BoneGear.HEAD_BONES
		var mirror: Array = []
		if id == CAPE_GLB:
			bones = BoneGear.UPPER_CHEST_BONES
		elif id == "eq_past_2_chest":
			bones = BoneGear.CHEST_BONES
		elif id == "eq_past_2_shoulder":
			bones = BoneGear.L_UPPER_ARM
			mirror = BoneGear.R_UPPER_ARM
		n += BoneGear.attach(player, "%s%s.glb" % [DIR, id], bones, mirror, TAG, "Wear_%s" % id)
	return n


func _apply_dye(dye: String) -> int:
	var painted := 0
	var it := ForestWear.item("dye", dye)
	var tint := Color(1, 1, 1)
	if String(it.get("c", "")) != "":
		tint = Color(String(it.c))
	for mi: MeshInstance3D in GLBUtils.find_all_mesh_instances(_player):
		if mi.mesh == null:
			continue
		for i in mi.mesh.get_surface_count():
			var orig := mi.mesh.surface_get_material(i)
			if orig == null or not (CLOTH_KEY in orig.resource_name.to_upper()):
				continue
			var mat := mi.get_surface_override_material(i) as ShaderMaterial
			if mat == null:
				continue
			## 표면마다 cel_shader_apply가 새로 만든 재질이라 공유되지 않는다 —
			## 제자리에서 고쳐도 된다. 원래 tint는 처음 한 번만 기억해 둔다.
			if not mat.has_meta(BASE_TINT_META):
				mat.set_meta(BASE_TINT_META, mat.get_shader_parameter("albedo_tint"))
			var base: Color = mat.get_meta(BASE_TINT_META)
			mat.set_shader_parameter("albedo_tint", base * tint)
			painted += 1
	return painted
