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
const NightGlow := preload("res://saga_core/world/night_glow.gd")   # G-0277

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
			var vm := vertex_color_material(curve_amount, roughness_value, tint)
			if orig != null and orig.has_meta("night_glow"):   # G-0277 — 그림 없는 창(forest_cottage glass)도 밤에 빛나게
				NightGlow.register_shader(vm, String(orig.get_meta("night_glow")))
			mesh.surface_set_material(i, vm)
			continue
		var mat := ShaderMaterial.new()
		mat.shader = TEXTURED_SHADER
		## G-0272 — 사실판 자연물 잎 카드(gltf MASK)는 컷아웃판으로(불투명 셰이더면 잎 카드가 네모 판으로 보인다).
		if orig.transparency == BaseMaterial3D.TRANSPARENCY_ALPHA_SCISSOR:
			mat.shader = CUTOUT_SHADER
			mat.set_shader_parameter("alpha_cutoff", orig.alpha_scissor_threshold)
		mat.set_shader_parameter("albedo_texture", orig.albedo_texture)
		mat.set_shader_parameter("curve_amount", curve_amount)
		mat.set_shader_parameter("roughness_value", roughness_value)
		mat.set_shader_parameter("tint_color", tint)
		pbr_maps(mat, orig)
		if orig.has_meta("night_glow"):   # G-0277 — 불 면·창은 밤에 빛나게(곡률 셰이더 emission 자리)
			NightGlow.register_shader(mat, String(orig.get_meta("night_glow")))
		mesh.surface_set_material(i, mat)
	return mesh


## G-0285 — 원본 재질의 법선·거칠기 맵을 곡률 셰이더로 넘긴다(전엔 그림만 넘겨 K-0152·K-0154 의 맵이 3마을에서 사라졌다). 손잡이 SAGA_CURVE_PBR=0.
static func pbr_maps(mat: ShaderMaterial, orig: BaseMaterial3D) -> void:
	if OS.get_environment("SAGA_CURVE_PBR") == "0" or orig == null:
		return
	if orig.normal_enabled and orig.normal_texture != null:
		mat.set_shader_parameter("normal_texture", orig.normal_texture)
		mat.set_shader_parameter("normal_scale", orig.normal_scale)
	if orig.roughness_texture != null:
		mat.set_shader_parameter("roughness_texture", orig.roughness_texture)
		mat.set_shader_parameter("use_rough_tex", 1.0)


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
## G-0252 — sets(슬롯 grass·dirt·stone → tiles_real 세트 이름, 빠진 슬롯은 REAL_SETS)·old_env(옛 512 로 물러설 환경변수)·
## blotch(≥0 이면 얼룩 세기 덮어씀) — 셋 다 기본값이면 3마을 G-0225 결과 그대로. 빛깔 맞춤은 세트 이름으로(SET_GAIN, 없는 세트 1).
static func triplanar_material(curve_amount: float, sets := {}, old_env := "SAGA_FOREST_OLD", blotch := -1.0) -> ShaderMaterial:
	ensure_global_registered()
	var mat := ShaderMaterial.new()
	mat.shader = TRIPLANAR_SHADER
	mat.set_shader_parameter("curve_amount", curve_amount)
	## G-0225 — 자체 PBR(K-0093 tiles_real)이 있으면 풀·흙·바위 _hi + 높이 + 빛깔 맞춤(1만리 terrain_builder REAL_GAIN 과 같은 값 — 판끼리 참조 금지라 여기 둔다).
	## 사진 세트에선 흙·돌 얼룩을 줄인다(BLOTCH_REAL). SAGA_FOREST_OLD=1 이면 옛 512.
	var real := ResourceLoader.exists(REAL_DIR + "grass_hi.webp") and OS.get_environment(old_env) == ""
	for k: String in REAL_SETS:
		if real:
			var set_name := String(sets.get(k, REAL_SETS[k]))
			var base := REAL_DIR + set_name + "_hi"
			mat.set_shader_parameter(k + "_albedo", load(base + ".webp"))
			mat.set_shader_parameter(k + "_normal", load(base + "_n.webp"))
			mat.set_shader_parameter(k + "_rough", load(base + "_r.webp"))
			mat.set_shader_parameter(k + "_height", load(base + "_h.webp"))
			mat.set_shader_parameter(k + "_gain", SET_GAIN.get(set_name, Vector3.ONE))
		else:
			var old := "res://assets/generated/tiles/%s_512" % k
			mat.set_shader_parameter(k + "_albedo", load(old + ".png"))
			mat.set_shader_parameter(k + "_normal", load(old + "_n.png"))
			mat.set_shader_parameter(k + "_rough", load(old + "_r.png"))
	mat.set_shader_parameter("use_height", 1.0 if real else 0.0)
	mat.set_shader_parameter("photo_color", PHOTO_COLOR if real else 1.0)
	mat.set_shader_parameter("blotch", blotch if blotch >= 0.0 else (BLOTCH_REAL if real else 1.0))
	return mat


const REAL_DIR := "res://assets/generated/tiles_real/"
const REAL_SETS := {"grass": "grass", "dirt": "dirt", "stone": "rock"}
const SET_GAIN := {"grass": Vector3(1.418, 2.341, 1.544), "dirt": Vector3(0.636, 0.546, 0.295), "rock": Vector3(0.946, 0.875, 0.768)}   # 세트 이름 → 빛깔 맞춤(옛 슬롯 REAL_GAIN 값 그대로)
const PHOTO_COLOR := 0.35
const BLOTCH_REAL := 0.45
