class_name CelShaderApply
extends RefCounted

## PLAN.md 66-2 "적용 순서" 2번 — cel_shader_prototype.gd에서 검증한
## 카툰 셰이더 적용 로직을 실제 게임 씬(Player/NPC)에서 재사용하는 공용
## 헬퍼. 텍스처가 있는 캐릭터 GLB 전용이다 — 텍스처 없는 단색 primitive
## (아직 GLB가 없는 Enemy/Boss 캡슐)에는 쓰지 않는다(albedo_texture가
## 비어 검게 나온다).

const CEL_SHADER := preload("res://saga_core/shaders/cel_toon.gdshader")
const OUTLINE_SHADER := preload("res://saga_core/shaders/cel_outline.gdshader")
const ANIME_EYE := preload("res://saga_core/anime_eye.gd")
const ANIME_MOUTH := preload("res://saga_core/anime_mouth.gd")

## 공방 몸의 눈 재질 이름("eye") — 실사 눈 텍스처 위에 셀 화풍 눈을 다시 그려 얹는다(anime_eye.gd, 홍채색은 몸 파일마다 하나).
const EYE_MATERIAL := "eye"
static var _iris_seed := ""
static var _skin_tex: Texture2D = null # 이 몸 살갗 재질 텍스처(감은 눈 살색용, apply_to 가 먼저 찾아 둔다)

## root 아래 모든 MeshInstance3D의 서피스 재질을 cel_toon 셰이더로 덮는다.
## 반환값은 적용된 서피스 개수.
## G-0030 — 옛 VRoid 샘플(AvatarSample·avatar_sample_*·숲/던전 아바타)의 얼굴 구운 그림 표(FACE_BAKE_BY_GLB)와 그 갈래를 걷어냈다.
## 사람 몸은 이제 새 인물 몸(characters_dex)뿐이고, 그 얼굴은 표면마다 셀 재질로 그대로 그린다.
static func apply_to(root: Node) -> int:
	_iris_seed = root.scene_file_path
	_skin_tex = null
	for mi in _find_mesh_instances(root):
		if mi.mesh == null or String(mi.name).begins_with("Eye"):
			continue
		for si in mi.mesh.get_surface_count():
			var sm := mi.get_active_material(si)
			if _skin_tex == null and sm is BaseMaterial3D and sm.resource_name.to_lower().begins_with("skin") and (sm as BaseMaterial3D).albedo_texture != null:
				_skin_tex = (sm as BaseMaterial3D).albedo_texture
	setup_shadow_proxy(root)
	var applied := 0
	for mesh_instance in _find_mesh_instances(root):
		if String(mesh_instance.name).contains("ShadowProxy"):
			continue # 그림자 대역은 색 패스에 안 나온다 — 셀 재질·외곽선 불필요
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

static func _find_mesh_instances(node: Node) -> Array[MeshInstance3D]:
	var result: Array[MeshInstance3D] = []
	if node is MeshInstance3D:
		result.append(node)
	for child in node.get_children():
		result.append_array(_find_mesh_instances(child))
	return result

## 2026-09-30 — 옷 기준 1.5cm 두께 외곽선이 얼굴에선 코·턱·앞머리 위로 검은 파편으로 솟았다(face_view 촬영). 얼굴·머리·눈은 훨씬 얇게, 눈·눈썹은 없이.
## 살갗은 짙은 살색으로(검정이 아니라 원신처럼 따뜻한 그림자 선).
static func _tune_outline(outline_mat: ShaderMaterial, mesh_name: String, mat_name: String) -> void:
	var m := mat_name.to_lower()
	if mesh_name.begins_with("Eye"):
		outline_mat.set_shader_parameter("thickness", 0.0)
	elif m.contains("skin"):
		outline_mat.set_shader_parameter("thickness", 0.0028)
		outline_mat.set_shader_parameter("outline_color", Color(0.2, 0.09, 0.07))
	elif m.contains("hair"):
		## 수염·짧은 머리는 메시가 잘게 갈라져 두꺼운 선이 파편으로 튄다(마을 남자 촬영).
		outline_mat.set_shader_parameter("thickness", 0.0025 if mesh_name.to_lower().contains("beard") else 0.005)

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
		var albedo_tex: Texture2D = (original as BaseMaterial3D).albedo_texture
		if original.resource_name == EYE_MATERIAL:
			var raw_tex := albedo_tex
			albedo_tex = ANIME_EYE.texture_for(raw_tex, ANIME_EYE.iris_for(_iris_seed))
			## 깜박임(talk_face)이 갈아 끼울 두 장.
			shader_mat.set_meta("eye_open", albedo_tex)
			shader_mat.set_meta("eye_closed", ANIME_EYE.closed_texture_for(raw_tex, ANIME_EYE.skin_average(_skin_tex)))
		elif original.resource_name.to_lower().begins_with("skin"):
			## 입 자리가 있는 얼굴 살갗이면 talk_face 가 말할 때 벌린 입 그림을 만들어 갈아 끼운다(anime_mouth).
			var mouth_uv := ANIME_MOUTH.center_for(albedo_tex.resource_path)
			if mouth_uv.x >= 0.0:
				shader_mat.set_meta("mouth_base", albedo_tex)
				shader_mat.set_meta("mouth_uv", mouth_uv)
		shader_mat.set_shader_parameter("albedo_texture", albedo_tex)
		shader_mat.set_shader_parameter("albedo_tint", (original as BaseMaterial3D).albedo_color)
		## PLAN 102-3 아웃라인 — 뒤집힌 헐 셰이더를 next_pass로 얹는다.
		## Player·NPC(이 함수를 부르는 곳)에만 자연히 걸린다.
		var outline_mat := ShaderMaterial.new()
		outline_mat.shader = OUTLINE_SHADER
		_tune_outline(outline_mat, String(mesh_instance.name), original.resource_name)
		if original.resource_name.to_lower().contains("hair") and not String(mesh_instance.name).begins_with("Eye"):
			shader_mat.set_shader_parameter("hair_gloss", 1.0)
		shader_mat.next_pass = outline_mat
		mesh_instance.set_surface_override_material(surface_index, shader_mat)
		count += 1
	return count
