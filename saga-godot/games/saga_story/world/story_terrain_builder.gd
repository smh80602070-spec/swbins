extends Node3D

## VERTICAL_SLICE_STORY.md 1·2절 — 허창 들판을 FieldMap.gd 데이터로
## 짓는다. 2.5D라 모든 발판·바닥은 Z축으로 얕은 깊이(PLATFORM_DEPTH)만
## 갖는다 — 플레이어가 Z=0에 고정이라(2절) 더 깊을 필요가 없다.
##
## primitive 박스뿐이다(GLB 없음) — 이 판은 이제 막 첫 슬라이스를
## 시작하는 단계라 GO/FOREST의 "primitive는 프로토타입에서만" 원칙
## 그대로.
##
## **2026-09-13 추가 — 사냥터/마을 공용화(15절).** 처음엔 FieldMap을
## 상수로 preload해 이 사냥터 전용이었다가, 허도(마을)를 지으며 `map_path`
## export로 바꿨다 — 새 사냥터/마을을 추가할 때 이 파일을 복제하지 않고
## (PLAN.md 76장) 같은 모양(width_m/plats_m/ropes_m)의 데이터 파일만
## 새로 만들면 된다. `ground_color`도 데이터마다 다르게 칠할 수 있게 뺐다
## (허도 '#7a5a30' vs 들판 '#6faf55').

## **2026-09-13 추가 — q_explore1(사명, goal.type:'visit').** `_map`에
## `stage_key()`가 있으면(사냥터 넷만 해당, 마을 지도 셋은 없음) 이 씬에
## 들어올 때마다 StorySaveState.visit_stage()를 부른다 — 그 함수가
## 중복은 알아서 거른다(quest.js onStage()와 같은 결).
@export var map_path: String = "res://games/saga_story/data/field_map.gd"
@export var ground_color := Color(0.435, 0.686, 0.333)  # data-side.js field.ground '#6faf55'

const PLATFORM_DEPTH := 4.0
const PLATFORM_THICKNESS := 0.4
const PLAT_COLOR := Color(0.55, 0.42, 0.28)
const ROPE_COLOR := Color(0.6, 0.5, 0.35)
const LADDER_COLOR := Color(0.42, 0.32, 0.2)  # 사다리 — 줄보다 짙은 목재색
const WALL_HEIGHT := 20.0
## G-0222 — 단색 상자였던 바닥 띠·발판에 자체 PBR(K-0093) 결: 바닥 윗면 얇은 판(풀·흙·바위 — ground_color 빛깔로 고름) + 옆면 흙, 발판 널판.
## 세트가 없거나 SAGA_STORY_OLD=1 이면 예전 단색. 빛깔은 늘 ground_color·PLAT_COLOR(prop_real 은 결만 얹는다).
const RealPbr := preload("res://saga_core/world/real_pbr.gd")
const TOP_THICK := 0.06

var _map: RefCounted


func _ready() -> void:
	_map = (load(map_path) as GDScript).new()
	if _map.has_method("stage_key"):
		StorySaveState.visit_stage(_map.stage_key())
	_build_ground()
	for p: Dictionary in _map.plats_m():
		_build_platform(p)
	for r: Dictionary in _map.ropes_m():
		_build_climb(r)
	_build_boundary_walls()
	## G-0269 그리기 부담 — render_budget(saga_core): 해 그림자 100→50m·먼 배경 나무·언덕(옆 보기 뒤편)은 그림자 안 드리움.
	## far 는 그대로(0) — 배경 능선이 1000m 밖이라 잘린다. 씬 뿌리(필드 씬 전부가 이 지형 짓기를 씀) 기준, 배경까지 다 지은 뒤.
	(func() -> void: preload("res://saga_core/world/render_budget.gd").apply(get_parent(), preload("res://saga_core/world/render_budget.gd").CHUNK_M,
			preload("res://saga_core/world/render_budget.gd").NO_CAST_PREFIX + ["BackgroundTrees", "BackgroundHills"], 0.0)).call_deferred()


func _build_ground() -> void:
	var width: float = _map.width_m()
	var body := _build_box(width * 0.5, -PLATFORM_THICKNESS * 0.5, width, PLATFORM_THICKNESS, ground_color, "Ground", "dirt", 0, Color(0.38, 0.29, 0.2) if _top_set(ground_color) == "grass" else ground_color.darkened(0.25))   # 옆면 = 흙(풀빛 옆면은 연두 띠로 떴다)
	if body != null and _real():
		## 윗면 판(충돌 없음) — 풀빛 땅이면 풀, 갈색이면 흙, 그 밖(동굴)은 바위
		var top := MeshInstance3D.new()
		top.name = "GroundTop"
		var m := BoxMesh.new()
		m.size = Vector3(width + 0.04, TOP_THICK, PLATFORM_DEPTH + 0.04)
		top.mesh = m
		top.position = Vector3(0, PLATFORM_THICKNESS * 0.5 - TOP_THICK * 0.5 + 0.01, 0)
		## ground_color 그대로면 결 위로도 쨍한 연두 판이었다(10-13 전후) — 채도 ×0.8·밝기 ×0.55 로 뒤 들판(풀 사진 × 색)과 잇는다
		var tc := Color.from_hsv(ground_color.h, ground_color.s * 0.8, ground_color.v * 0.55)
		RealPbr.apply_box(top, m.size, _top_set(ground_color), 0, tc, 0.4)
		body.add_child(top)


static func _top_set(c: Color) -> String:
	if c.g > c.r and c.g > c.b:
		return "grass"
	if c.r > c.g and c.g > c.b:
		return "dirt"
	return "rock"


static func _real() -> bool:
	return RealPbr.available("planks") and OS.get_environment("SAGA_STORY_OLD") == ""


func _build_platform(p: Dictionary) -> void:
	var w: float = float(p.half_w) * 2.0
	_build_box(float(p.x), float(p.height) - PLATFORM_THICKNESS * 0.5, w, PLATFORM_THICKNESS, PLAT_COLOR, "Platform", "planks", 1, PLAT_COLOR)


func _build_box(center_x: float, center_y: float, width: float, thickness: float, color: Color, name_: String, real_set := "", real_kind := 0, real_tint := Color.WHITE) -> StaticBody3D:
	var body := StaticBody3D.new()
	body.name = name_
	body.position = Vector3(center_x, center_y, 0)
	add_child(body)

	var mi := MeshInstance3D.new()
	var box := BoxMesh.new()
	box.size = Vector3(width, thickness, PLATFORM_DEPTH)
	mi.mesh = box
	if real_set == "" or not _real() or not RealPbr.apply_box(mi, box.size, real_set, real_kind, real_tint):
		var mat := StandardMaterial3D.new()
		mat.albedo_color = color
		mi.material_override = mat
	body.add_child(mi)

	var cs := CollisionShape3D.new()
	var shape := BoxShape3D.new()
	shape.size = box.size
	cs.shape = shape
	body.add_child(cs)
	return body


## 웹판 field.ropes 다섯(rope 넷+ladder 하나) — 오르내리는 동안 옆으로
## 못 움직이게 story_player.gd가 이 Area3D 안에서만 "on_rope" 상태로
## 바뀐다. kind는 시각만 가른다(등반 판정은 story_player.gd가 rope든
## ladder든 똑같이 다룬다 — 원작도 물리를 안 가른다, field_map.gd 참고).
func _build_climb(r: Dictionary) -> void:
	var height: float = float(r.top) - float(r.bottom)
	var mid_y: float = float(r.bottom) + height * 0.5
	var kind: String = String(r.kind)

	if kind == "ladder":
		_build_ladder_visual(float(r.x), mid_y, height)
	else:
		_build_rope_visual(float(r.x), mid_y, height)

	var area := Area3D.new()
	area.name = "LadderArea" if kind == "ladder" else "RopeArea"
	area.add_to_group("story_rope")
	var cs := CollisionShape3D.new()
	var shape := BoxShape3D.new()
	shape.size = Vector3(0.6, height, 1.2)
	cs.shape = shape
	area.add_child(cs)
	area.position = Vector3(float(r.x), mid_y, 0)
	area.set_meta("rope_top", float(r.top))
	area.set_meta("rope_bottom", float(r.bottom))
	area.set_meta("rope_x", float(r.x))
	area.body_entered.connect(_on_rope_body_entered.bind(area))
	area.body_exited.connect(_on_rope_body_exited.bind(area))
	add_child(area)


func _build_rope_visual(x: float, mid_y: float, height: float) -> void:
	var visual := MeshInstance3D.new()
	visual.name = "Rope"
	var cyl := CylinderMesh.new()
	cyl.top_radius = 0.06
	cyl.bottom_radius = 0.06
	cyl.height = height
	visual.mesh = cyl
	var mat := StandardMaterial3D.new()
	mat.albedo_color = ROPE_COLOR
	visual.material_override = mat
	visual.position = Vector3(x, mid_y, 0)
	add_child(visual)


## 사다리 — 세로 기둥 둘(폭 0.5m) + 0.4m 간격 가로대. 줄과 시각으로만
## 갈린다(위 _build_climb() 머리말).
func _build_ladder_visual(x: float, mid_y: float, height: float) -> void:
	var root := Node3D.new()
	root.name = "Ladder"
	root.position = Vector3(x, mid_y, 0)
	add_child(root)

	var mat := StandardMaterial3D.new()
	mat.albedo_color = LADDER_COLOR

	for side_x: float in [-0.25, 0.25]:
		var rail := MeshInstance3D.new()
		var rail_mesh := CylinderMesh.new()
		rail_mesh.top_radius = 0.04
		rail_mesh.bottom_radius = 0.04
		rail_mesh.height = height
		rail.mesh = rail_mesh
		rail.material_override = mat
		rail.position = Vector3(side_x, 0, 0)
		root.add_child(rail)

	var rung_gap := 0.4
	var rung_count: int = maxi(1, floori(height / rung_gap))
	for i in rung_count:
		var rung := MeshInstance3D.new()
		var rung_mesh := CylinderMesh.new()
		rung_mesh.top_radius = 0.035
		rung_mesh.bottom_radius = 0.035
		rung_mesh.height = 0.5
		rung.mesh = rung_mesh
		rung.material_override = mat
		rung.rotation.z = PI * 0.5
		rung.position = Vector3(0, height * 0.5 - float(i) * rung_gap, 0)
		root.add_child(rung)


func _on_rope_body_entered(body: Node3D, area: Area3D) -> void:
	if body.is_in_group("player") and body.has_method("set_rope_area"):
		body.set_rope_area(area)


func _on_rope_body_exited(body: Node3D, area: Area3D) -> void:
	if body.is_in_group("player") and body.has_method("clear_rope_area"):
		body.clear_rope_area(area)


## 목적지 없는 방향으로 걸어 나가지 못하게 막는다 — 문(Portal 노드)이
## 있는 쪽도 이 벽은 그대로 둔다(문은 상호작용해야 넘어가지, 그냥
## 걸어서는 못 지나간다 — 벽이 그 자리를 지킨다, 15절).
func _build_boundary_walls() -> void:
	var width: float = _map.width_m()
	_build_wall(-0.5)
	_build_wall(width + 0.5)


func _build_wall(x: float) -> void:
	var body := StaticBody3D.new()
	body.name = "Boundary"
	body.position = Vector3(x, WALL_HEIGHT * 0.5, 0)
	var cs := CollisionShape3D.new()
	var shape := BoxShape3D.new()
	shape.size = Vector3(1.0, WALL_HEIGHT, PLATFORM_DEPTH)
	cs.shape = shape
	body.add_child(cs)
	add_child(body)
