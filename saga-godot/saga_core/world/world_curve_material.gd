class_name WorldCurveMaterial
extends RefCounted

## VERTICAL_SLICE_FOREST.md 1절(구면 투영)을 쓰는 모든 머티리얼이 공통으로
## 필요로 하는 두 가지를 여기 한 곳에 모았다:
## 1) saga_world_curve_center 전역 유니폼을 한 번 등록하는 것 —
##    saga-godot/CLAUDE.md의 2026-09-12 발견("헤드리스 --editor --quit로
##    자동 등록되지 않는다, 런타임 코드가 직접 등록해야 한다")을 그대로
##    반영. 처음 머티리얼을 만들 때 자동으로 등록되므로 호출자가 순서를
##    신경 쓸 필요는 없다(멱등 — 여러 번 불러도 안전).
## 2) 그 유니폼을 실제로 읽는 ShaderMaterial 두 종류(정점색 전용/텍스처
##    전용)를 만드는 것 — saga_core/shaders/curved_vertex_color.gdshader ·
##    curved_textured.gdshader.
##
## FOREST 전용이 아니라 saga_core에 둔 이유 — world_curve.gdshaderinc
## 자체가 이미 "다른 트랙·다른 게임이 나중에 재사용할 수 있게" 공용
## include로 뽑혀 있다(그 파일 주석 참고); 이 헬퍼도 같은 경계.

const VERTEX_COLOR_SHADER := preload("res://saga_core/shaders/curved_vertex_color.gdshader")
const TEXTURED_SHADER := preload("res://saga_core/shaders/curved_textured.gdshader")
const TRIPLANAR_SHADER := preload("res://saga_core/shaders/curved_triplanar.gdshader")
const CUTOUT_SHADER := preload("res://saga_core/shaders/curved_textured_cutout.gdshader")
const VERTEX_COLOR_CUTOUT_SHADER := preload("res://saga_core/shaders/curved_vertex_color_cutout.gdshader")

const GLOBAL_PARAM_NAME := "saga_world_curve_center"

static var _global_registered := false


static func ensure_global_registered() -> void:
	if _global_registered:
		return
	_global_registered = true
	RenderingServer.global_shader_parameter_add(
		GLOBAL_PARAM_NAME, RenderingServer.GLOBAL_VAR_TYPE_VEC3, Vector3.ZERO)


## 곡률의 중심 — 보통 플레이어 위치. 씬의 루트 스크립트가 매 프레임(또는
## 이동할 때) 한 번씩 불러 준다(games/saga_forest/world/forest_village.gd 참고).
static func update_center(center: Vector3) -> void:
	RenderingServer.global_shader_parameter_set(GLOBAL_PARAM_NAME, center)


static func vertex_color_material(curve_amount: float, roughness_value: float = 0.95,
		tint_color: Color = Color(1, 1, 1)) -> ShaderMaterial:
	ensure_global_registered()
	var mat := ShaderMaterial.new()
	mat.shader = VERTEX_COLOR_SHADER
	mat.set_shader_parameter("curve_amount", curve_amount)
	mat.set_shader_parameter("roughness_value", roughness_value)
	mat.set_shader_parameter("tint_color", tint_color)
	return mat


## G-0019 — 표면마다 텍스처가 다른 불투명 GLB(K-0052/K-0058 통일 툰 소품: 표면 3~5장)를 곡률 재질로. 원본 공유 Mesh 는 안 건드리고
## 복제해 표면마다 `albedo_texture` 를 곡률 텍스처 셰이더로 바꾼다. 텍스처가 없는 표면은 정점색 재질(tint)로 물러선다. tint 는 색 곱.
static func textured_surfaces(src: Mesh, curve_amount: float, roughness_value: float = 0.9, tint: Color = Color(1, 1, 1)) -> Mesh:
	ensure_global_registered()
	var mesh := src.duplicate() as Mesh
	for i in mesh.get_surface_count():
		var orig := src.surface_get_material(i) as BaseMaterial3D
		if orig == null or orig.albedo_texture == null:
			mesh.surface_set_material(i, vertex_color_material(curve_amount, roughness_value, tint))
			continue
		var mat := ShaderMaterial.new()
		mat.shader = TEXTURED_SHADER
		mat.set_shader_parameter("albedo_texture", orig.albedo_texture)
		mat.set_shader_parameter("curve_amount", curve_amount)
		mat.set_shader_parameter("roughness_value", roughness_value)
		mat.set_shader_parameter("tint_color", tint)
		mesh.surface_set_material(i, mat)
	return mesh


static func textured_material(texture_path: String, curve_amount: float, roughness_value: float = 0.9) -> ShaderMaterial:
	ensure_global_registered()
	var mat := ShaderMaterial.new()
	mat.shader = TEXTURED_SHADER
	mat.set_shader_parameter("albedo_texture", load(texture_path))
	mat.set_shader_parameter("curve_amount", curve_amount)
	mat.set_shader_parameter("roughness_value", roughness_value)
	return mat


## G-0030 — textured_material 과 같되 텍스처를 리소스로(표면마다 그림이 다른 인물 몸이 원본 재질에서 꺼내 넘긴다).
static func textured_material_from(texture: Texture2D, curve_amount: float, roughness_value: float = 0.9) -> ShaderMaterial:
	ensure_global_registered()
	var mat := ShaderMaterial.new()
	mat.shader = TEXTURED_SHADER
	mat.set_shader_parameter("albedo_texture", texture)
	mat.set_shader_parameter("curve_amount", curve_amount)
	mat.set_shader_parameter("roughness_value", roughness_value)
	return mat


## 알파 컷아웃 양면(잎·꽃 카드). textured_material과 달리 텍스처를 경로가
## 아니라 리소스로 받는다 — 표면마다 텍스처가 다른 gltf(Flower_3_Group:
## 잎·꽃 2장)는 호출부가 원본 재질에서 표면별로 꺼내 넘긴다.
static func cutout_material(texture: Texture2D, curve_amount: float,
		roughness_value: float = 0.9, alpha_cutoff: float = 0.2) -> ShaderMaterial:
	ensure_global_registered()
	var mat := ShaderMaterial.new()
	mat.shader = CUTOUT_SHADER
	mat.set_shader_parameter("albedo_texture", texture)
	mat.set_shader_parameter("curve_amount", curve_amount)
	mat.set_shader_parameter("roughness_value", roughness_value)
	mat.set_shader_parameter("alpha_cutoff", alpha_cutoff)
	return mat


## vertex_color_material과 같은 색(정점색 × tint)에 원본 텍스처의 알파로만
## 오려낸다 — 색감은 그대로 두고 잎 카드의 네모판만 없앨 때.
static func vertex_color_cutout_material(curve_amount: float, roughness_value: float,
		tint_color: Color, alpha_texture: Texture2D, alpha_cutoff: float = 0.2) -> ShaderMaterial:
	ensure_global_registered()
	var mat := ShaderMaterial.new()
	mat.shader = VERTEX_COLOR_CUTOUT_SHADER
	mat.set_shader_parameter("curve_amount", curve_amount)
	mat.set_shader_parameter("roughness_value", roughness_value)
	mat.set_shader_parameter("tint_color", tint_color)
	mat.set_shader_parameter("alpha_texture", alpha_texture)
	mat.set_shader_parameter("alpha_cutoff", alpha_cutoff)
	return mat


## PLAN 102-5 "바닥 한 색" 처방(GO terrain_triplanar.gdshader)을 곡률
## 지형에 쓰는 자리 — 103장 tilegen 잔디·흙·돌 3장(공용, 게임마다 새로
## 안 만든다)을 고정으로 물린다. 호출부는 정점색(지형 종류별 tint)만
## 책임진다.
static func triplanar_material(curve_amount: float) -> ShaderMaterial:
	ensure_global_registered()
	var mat := ShaderMaterial.new()
	mat.shader = TRIPLANAR_SHADER
	mat.set_shader_parameter("curve_amount", curve_amount)
	mat.set_shader_parameter("grass_albedo", load("res://assets/generated/tiles/grass_512.png"))
	mat.set_shader_parameter("grass_normal", load("res://assets/generated/tiles/grass_512_n.png"))
	mat.set_shader_parameter("grass_rough", load("res://assets/generated/tiles/grass_512_r.png"))
	mat.set_shader_parameter("dirt_albedo", load("res://assets/generated/tiles/dirt_512.png"))
	mat.set_shader_parameter("dirt_normal", load("res://assets/generated/tiles/dirt_512_n.png"))
	mat.set_shader_parameter("dirt_rough", load("res://assets/generated/tiles/dirt_512_r.png"))
	mat.set_shader_parameter("stone_albedo", load("res://assets/generated/tiles/stone_512.png"))
	mat.set_shader_parameter("stone_normal", load("res://assets/generated/tiles/stone_512_n.png"))
	mat.set_shader_parameter("stone_rough", load("res://assets/generated/tiles/stone_512_r.png"))
	return mat
