class_name CelShaderApply
extends RefCounted

## PLAN.md 66-2 "적용 순서" 2번 — cel_shader_prototype.gd에서 검증한
## 카툰 셰이더 적용 로직을 실제 게임 씬(Player/NPC)에서 재사용하는 공용
## 헬퍼. 텍스처가 있는 캐릭터 GLB 전용이다 — 텍스처 없는 단색 primitive
## (아직 GLB가 없는 Enemy/Boss 캡슐)에는 쓰지 않는다(albedo_texture가
## 비어 검게 나온다).

const CEL_SHADER := preload("res://saga_core/shaders/cel_toon.gdshader")
const OUTLINE_SHADER := preload("res://saga_core/shaders/cel_outline.gdshader")

## root 아래 모든 MeshInstance3D의 서피스 재질을 cel_toon 셰이더로 덮는다.
## 반환값은 적용된 서피스 개수.
## VRoid GLB의 "Face" 메시는 같은 자리에 겹친 알파컷아웃 데칼 7장
## (피부·눈흰자·홍채·하이라이트·눈썹·눈꺼풀선·입)으로 얼굴을 쌓는다 —
## 원래 Unity MToon의 렌더큐 순서에만 기대는 방식이라 Godot에 그대로
## 들여오면 카메라 거리에 따라 서피스 순서가 흔들려 하얗게 빈다
## (2026-09-19④). cull_mode(09-19⑤)는 진범이 아니었다 — 실제 원인은
## `AvatarSample_A_Face_Baked.png` 1차 베이크 산출물 자체가 "7서피스가
## 하나의 UV 아틀라스를 공유한다"는 잘못된 가정으로 만들어져 깨져
## 있었던 것(09-19⑩). Blender "Selected to Active" 투사 베이크로 다시
## 구워(`tools/asset-forge/vroid_face_bake_project.py`) SKIN 서피스
## **한 장에** 눈·눈썹·입까지 전부 합성해 넣었다(09-19⑪).
##
## SKIN 메시 자체를 trimesh로 실측(09-19⑫)하니 눈 소켓 자리엔 SKIN
## 정점이 **하나도 없다**(진짜 지오메트리 구멍 — 텍스처만의 문제가
## 아니다). 그래서:
## - SKIN: 새로 구운 합성 텍스처(입·눈썹·눈꺼풀선까지 이미 얹혀 있다).
## - EyeWhite·EyeIris·EyeHighlight: SKIN에 구멍 난 자리를 채우는
##   유일한 지오메트리라 반드시 그려야 한다 — 원래 자기 전용 텍스처를
##   그대로 쓴다(이 셋은 애초에 서로 겹치지도, 카메라 거리로 순서가
##   흔들리지도 않았다 — 문제는 늘 SKIN 쪽이었다).
## - FaceBrow·FaceEyeline·FaceMouth: SKIN 위에 이미 같은 내용이 구워져
##   있으니 그대로 두면 이중으로 겹쳐 그려진다 — 완전히 지운다.
const LAYERED_FACE_MESH_NAMES := ["Face"]
const SKIN_KEY := "SKIN"
const HIDE_KEYS := ["FaceBrow", "FaceEyeline", "FaceMouth"]

## VRoid GLB 경로별 베이크 텍스처 — 2026-09-19⑮, FOREST용 두 번째 캐릭터가
## 붙으며 AvatarSample_A 전용이던 단일 상수를 GLB 단위 표로 바꿨다. `root`
## (Player.tscn 등의 Visual 인스턴스)의 `scene_file_path`가 곧 이 GLB 경로다
## (`PackedScene.instantiate()`가 뿌리 노드에 그대로 남겨 준다 — 실측 확인).
const FACE_BAKE_BY_GLB := {
	"res://assets/characters_vroid/AvatarSample_A.glb":
		preload("res://assets/characters_vroid/generated/AvatarSample_A_Face_Baked.png"),
	"res://assets/characters_vroid/saga_forest_avatar_01.glb":
		preload("res://assets/characters_vroid/generated/saga_forest_avatar_01_Face_Baked.png"),
	"res://assets/characters_vroid/dungeon_hero_01.glb":
		preload("res://assets/characters_vroid/generated/dungeon_hero_01_Face_Baked.png"),
}

static func apply_to(root: Node) -> int:
	var baked_face: Texture2D = FACE_BAKE_BY_GLB.get(root.scene_file_path)
	setup_shadow_proxy(root)
	var applied := 0
	for mesh_instance in _find_mesh_instances(root):
		if String(mesh_instance.name).contains("ShadowProxy"):
			continue # 그림자 대역은 색 패스에 안 나온다 — 셀 재질·외곽선 불필요
		if mesh_instance.name in LAYERED_FACE_MESH_NAMES and baked_face != null:
			_apply_baked_face(mesh_instance, baked_face)
			continue
		applied += _apply_one(mesh_instance)
	return applied

## 2026-09-29 — 공방(char-forge) 플레이어 몸엔 그림자 대역 ZZ_ShadowProxy(몸을 30%로 줄인 사본)가 있다.
## 대역만 그림자를 드리우고(SHADOWS_ONLY — 색 패스·외곽선엔 안 나온다) 보이는 조각은 그림자를 끈다. 대역 없는 몸은 그대로.
## 그림자 패스(캐스케이드마다 다시 그림)가 몸 삼각형을 여러 번 세서 GO PERF 마을 플레이어 몫 11만 중 6.8만이었다.
## 셀 셰이더를 안 거치는 자리(REALM 초상)는 이것만 부른다 — 안 부르면 대역이 보이는 몸과 겹쳐 그려진다.
static func setup_shadow_proxy(root: Node) -> void:
	var meshes := _find_mesh_instances(root)
	var proxy: MeshInstance3D = null
	for mi in meshes:
		if String(mi.name).contains("ShadowProxy"):
			proxy = mi
	if proxy == null:
		return
	for mi in meshes:
		mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_SHADOWS_ONLY if mi == proxy \
			else GeometryInstance3D.SHADOW_CASTING_SETTING_OFF

static func _apply_baked_face(mesh_instance: MeshInstance3D, baked_face: Texture2D) -> void:
	var mesh := mesh_instance.mesh
	if mesh == null:
		return
	for surface_index in mesh.get_surface_count():
		## 덮어쓰기 전에 원본 재질을 먼저 읽어야 한다(덮은 뒤엔
		## get_active_material이 이 override를 돌려준다).
		var original := mesh_instance.get_active_material(surface_index)
		var original_name: String = original.resource_name if original else ""
		var hide := false
		for key in HIDE_KEYS:
			if key in original_name:
				hide = true
				break

		var mat := StandardMaterial3D.new()
		mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
		mat.cull_mode = BaseMaterial3D.CULL_DISABLED
		if hide:
			mat.albedo_color = Color(0, 0, 0, 0)
			mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
		elif SKIN_KEY in original_name:
			mat.albedo_texture = baked_face
			mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA_SCISSOR
		else:
			## EyeWhite·EyeIris·EyeHighlight — 원래 자기 텍스처 그대로.
			var orig_tex: Texture2D = (original as BaseMaterial3D).albedo_texture if original is BaseMaterial3D else null
			mat.albedo_texture = orig_tex
			mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA_SCISSOR
		mesh_instance.set_surface_override_material(surface_index, mat)
	mesh_instance.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF

static func _find_mesh_instances(node: Node) -> Array[MeshInstance3D]:
	var result: Array[MeshInstance3D] = []
	if node is MeshInstance3D:
		result.append(node)
	for child in node.get_children():
		result.append_array(_find_mesh_instances(child))
	return result

static func _apply_one(mesh_instance: MeshInstance3D) -> int:
	var mesh := mesh_instance.mesh
	if mesh == null:
		return 0
	var count := 0
	for surface_index in mesh.get_surface_count():
		var original := mesh_instance.get_active_material(surface_index)
		if not (original is BaseMaterial3D) or (original as BaseMaterial3D).albedo_texture == null:
			continue
		var shader_mat := ShaderMaterial.new()
		shader_mat.shader = CEL_SHADER
		shader_mat.set_shader_parameter("albedo_texture", (original as BaseMaterial3D).albedo_texture)
		shader_mat.set_shader_parameter("albedo_tint", (original as BaseMaterial3D).albedo_color)
		## PLAN 102-3 아웃라인 — 뒤집힌 헐 셰이더를 next_pass로 얹는다.
		## Player·NPC(이 함수를 부르는 곳)에만 자연히 걸린다.
		var outline_mat := ShaderMaterial.new()
		outline_mat.shader = OUTLINE_SHADER
		shader_mat.next_pass = outline_mat
		mesh_instance.set_surface_override_material(surface_index, shader_mat)
		count += 1
	return count
