extends Node3D

## VERTICAL_SLICE_FOREST.md 4절 "제외" 목록 6번(옷) 중 화면에 보이는
## 절반 — forest_wear.gd 상단 주석 참고: 옷 빛(dye)은 GLB 텍스처에
## StandardMaterial3D.albedo_color를 곱색으로 얹고(games/saga_go/world/
## bandit_encounter.gd의 강타 예고 물들이기와 같은 GLBUtils.
## find_all_mesh_instances 활용 — 다만 여기는 되돌리지 않고 계속
## 남긴다), 덧옷(cape)은 등에 붙는 얇은 판 하나를 켜고 끈다. 겉옷·머리는
## 그림 자산이 없어 이 스크립트가 아예 안 본다(폴링할 이유가 없다).
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

var _player: Node3D = null
var _cape: MeshInstance3D = null
var _last_dye := ""
var _last_cape := ""


func _process(_delta: float) -> void:
	if _player == null or not is_instance_valid(_player):
		_player = get_tree().get_first_node_in_group("player")
		if _player == null:
			return
		_cape = _build_cape(_player)
		_last_dye = ""  # 처음 찾았을 때 강제로 한 번 다시 칠한다
		_last_cape = ""

	var dye: String = ForestSaveState.wearing("dye")
	if dye != _last_dye:
		_last_dye = dye
		_apply_dye(dye)

	var cape: String = ForestSaveState.wearing("cape")
	if cape != _last_cape:
		_last_cape = cape
		_cape.visible = cape == "on"


func _apply_dye(dye: String) -> void:
	var it := ForestWear.item("dye", dye)
	var tint := Color(1, 1, 1)
	if String(it.get("c", "")) != "":
		tint = Color(String(it.c))
	for mi: MeshInstance3D in GLBUtils.find_all_mesh_instances(_player):
		if mi.mesh == null or mi.name == "WearCape":
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


## 덧옷은 회전하는 Visual(VRoid, ×1.0344)의 자식으로 붙여 캐릭터가 도는 대로
## 등판이 따라온다(예전엔 루트에 붙어 안 돌았다). 크기·자리는 1.7m 사람
## 기준(어깨 ≈1.4m 아래로 무릎 위까지) — 모델이 +Z를 보므로(player.gd
## target_yaw = atan2(x, z)) 등은 -Z. 미세조정은 실기 확인 때.
func _build_cape(player: Node3D) -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	mi.name = "WearCape"
	var box := BoxMesh.new()
	box.size = Vector3(0.42, 0.72, 0.03)
	mi.mesh = box
	var mat := StandardMaterial3D.new()
	mat.albedo_color = Color(0.35, 0.28, 0.5)
	mi.material_override = mat
	mi.position = Vector3(0, 1.0, -0.14)
	mi.visible = false
	var visual: Node3D = player.get_node_or_null("Visual")
	(visual if visual != null else player).add_child(mi)
	return mi
