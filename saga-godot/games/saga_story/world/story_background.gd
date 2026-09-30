extends Node3D

## VERTICAL_SLICE_STORY.md 2절 — Background 레이어(Z 매우 음수, 큰 실루엣,
## 충돌 없음). 지금까지 story_terrain_builder.gd는 Midground(바닥·발판,
## Z=0)만 지어 뒀다 — 2절이 설계해 둔 세 겹(Background/Midground/
## Foreground) 중 Midground만 있던 상태를 이걸로 채운다(Foreground는
## 여전히 생략 — 2절 "있으면 좋고 없어도 완료 조건에 안 걸린다").
##
## 새 GLB를 안 받는다(PLAN.md 44장) — 이미 받아 둔 GO/FOREST 에셋
## (tree_oak.glb·rock_largeA.glb) 재활용. 실루엣이라 원래 텍스처 대신
## 짙은 단색(UNSHADED — 태양 방향·시간에 안 흔들리는 "늘 같은 먼 산" 톤)
## 으로 덮어 쓴다. 충돌은 안 만든다(MultiMeshInstance3D 자체가 충돌이
## 없다 — vegetation_builder.gd처럼 따로 StaticBody를 안 붙인다).

## **2026-09-13 추가(같은 날 더, 23절) — 사냥터 공용화.** field 전용으로
## FieldMap.width_m()을 상수 preload해 쓰던 것을 `map_path` export로
## 바꿨다(story_enemy_spawner.gd 등과 같은 이유) — 안 바꾸면 오림 숲·
## 한중 굴혈처럼 field보다 넓은 사냥터에서 배경 나무·언덕이 field 너비
## (44m)만큼만 깔려 뒷부분이 빈 채로 남는다.
@export var map_path: String = "res://games/saga_story/data/field_map.gd"

const GLBUtils := preload("res://saga_core/world/glb_utils.gd")

const TREE_GLB := "res://assets/vegetation/tree_oak.glb"
const HILL_GLB := "res://assets/rocks/rock_largeA.glb"

const TREE_Z := -30.0
const HILL_Z := -45.0  # 나무보다 더 뒤 — 대기 원근(더 멀수록 흐리고 파르스름)
const TREE_COUNT := 14
const HILL_COUNT := 5
const TREE_SCALE := 9.0
const HILL_SCALE := 16.0
const TREE_COLOR := Color(0.36, 0.44, 0.4)
const HILL_COLOR := Color(0.3, 0.36, 0.42)


var _map: RefCounted


func _ready() -> void:
	_map = (load(map_path) as GDScript).new()
	_build_layer(TREE_GLB, TREE_COUNT, TREE_SCALE, TREE_Z, TREE_COLOR, "BackgroundTrees")
	_build_layer(HILL_GLB, HILL_COUNT, HILL_SCALE, HILL_Z, HILL_COLOR, "BackgroundHills")


## 사냥터 너비에 고르게 퍼뜨리되, 인덱스 홀짝으로 크기를 살짝 변주한다
## (randf()는 안 쓴다 — 배경도 매번 켤 때마다 같은 자리·같은 크기여야
## vegetation_builder.gd의 해시 원칙과 같은 정신을 지킨다, 다만 여긴
## 격자가 없어 인덱스만으로 충분하다).
func _build_layer(glb_path: String, count: int, base_scale: float, z: float, color: Color, node_name: String) -> void:
	var mesh := GLBUtils.extract_mesh(glb_path)
	if mesh == null:
		return

	var width: float = _map.width_m()
	var mm := MultiMesh.new()
	mm.transform_format = MultiMesh.TRANSFORM_3D
	mm.mesh = mesh
	mm.instance_count = count

	for i in count:
		var t: float = (float(i) + 0.5) / float(count)
		var x: float = t * width
		var s: float = base_scale * (0.85 + 0.3 * float(i % 3) / 2.0)
		var basis := Basis().scaled(Vector3.ONE * s)
		mm.set_instance_transform(i, Transform3D(basis, Vector3(x, 0, z)))

	var mmi := MultiMeshInstance3D.new()
	mmi.multimesh = mm
	mmi.name = node_name
	var mat := StandardMaterial3D.new()
	mat.albedo_color = color
	mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	mmi.material_override = mat
	add_child(mmi)
