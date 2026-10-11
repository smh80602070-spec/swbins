extends Node3D

## G-0186 — 3마을 스타듀 읽힘새(웹 W-0160 의 고돗 짝). 꽃을 들고 풀밭에 서면 발밑 3m 칸이 옅은 초록 테두리(심을 수 없는 칸이면 붉게),
## 심은 꽃이 있는 자리 둘레 5×5 칸엔 옅은 격자 선. 심기 규칙(자리 = 발 위치, 풀밭 '.' 만)은 forest_planting.gd 의 cell_of/can_plant_at 하나 — 표시도 같은 식을 쓴다.
## 마을 땅은 구면으로 휘므로(구면 투영) 선은 saga_core world_curve 로 같이 휜다 — 칸 변마다 끊어 짧은 띠로 지어 곡률을 따라간다.
## 그리기: 발밑 칸 1 + 격자 1(심은 꽃 수와 상관없이 한 메시). 0.1초마다 발밑 칸을 다시 본다(매 틱 셈 금지). 집 안(마을 밖 먼 좌표)·꽃이 없으면 숨김.

const ForestMap := preload("res://games/saga_forest/data/village_map.gd")
const TerrainBuilder := preload("res://games/saga_forest/world/forest_terrain_builder.gd")
const WorldCurveMaterial := preload("res://saga_core/world/world_curve_material.gd")
const Planting := preload("res://games/saga_forest/world/forest_planting.gd")

const TICK_SEC := 0.1
const LINE_W := 0.045      # 격자 선 반폭
const CURSOR_W := 0.1      # 발밑 칸 테두리 반폭(격자보다 굵게)
const CURSOR_LIFT := 0.03  # 발밑 칸은 격자 위로
const LIFT := 0.04
const GRID_RADIUS := 2   # 심은 꽃 칸 둘레 ±2 = 5×5
const OK_COL := Color(0.55, 1.0, 0.55, 0.85)
const OK_FILL := Color(0.55, 1.0, 0.55, 0.22)
const NO_COL := Color(1.0, 0.42, 0.38, 0.85)
const NO_FILL := Color(1.0, 0.42, 0.38, 0.14)
const GRID_COL := Color(1.0, 1.0, 1.0, 0.14)

var cursor: MeshInstance3D
var grid: MeshInstance3D
var cursor_cell := Vector2i(-1, -1)
var cursor_ok := false
var _acc := 0.0
var _planted_n := -1
var _mat: ShaderMaterial


static func _shader() -> Shader:
	var sh := Shader.new()
	sh.code = """shader_type spatial;
render_mode blend_mix, unshaded, cull_disabled, depth_draw_never;
#include "res://saga_core/shaders/world_curve.gdshaderinc"
uniform float curve_amount = 0.004;
void vertex() { VERTEX = saga_apply_world_curve(VERTEX, MODEL_MATRIX, curve_amount); }
void fragment() { ALBEDO = COLOR.rgb; ALPHA = COLOR.a; }
"""
	return sh


func _ready() -> void:
	name = "PlantGridOverlay"
	WorldCurveMaterial.ensure_global_registered()
	_mat = ShaderMaterial.new()
	_mat.shader = _shader()
	_mat.set_shader_parameter("curve_amount", Planting.CURVE_AMOUNT)
	cursor = MeshInstance3D.new()
	cursor.name = "PlantCursor"
	var cmat := _mat.duplicate() as ShaderMaterial
	cmat.render_priority = 1   # 격자보다 나중에(위에) 그린다
	cursor.material_override = cmat
	cursor.position.y = CURSOR_LIFT
	cursor.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	cursor.visible = false
	add_child(cursor)
	grid = MeshInstance3D.new()
	grid.name = "PlantGrid"
	grid.material_override = _mat
	grid.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(grid)
	refresh_grid()
	tick()


func _process(delta: float) -> void:
	_acc += delta
	if _acc < TICK_SEC:
		return
	_acc = 0.0
	tick()


static func ground_y() -> float:
	return float(TerrainBuilder.LEGEND["."].height) + LIFT


## 칸 (gx, gy) 의 네 모서리(월드, 땅 위)
static func cell_corners(c: Vector2i) -> Array:
	var y := ground_y()
	var a := ForestMap.world_pos(c.x, c.y) + Vector3(0, y, 0)
	var t := ForestMap.TILE_SIZE
	return [a, a + Vector3(t, 0, 0), a + Vector3(t, 0, t), a + Vector3(0, 0, t)]


static func in_map(c: Vector2i) -> bool:
	var s := ForestMap.size()
	return c.x >= 0 and c.y >= 0 and c.x < s.x and c.y < s.y


## 한 번 셈 — 발밑 칸 표시(점검도 부른다)
func tick() -> void:
	var p := get_tree().get_first_node_in_group("player") as Node3D
	var has_flower := ForestSaveState.item_count(Planting.ITEM_LABEL_NORMAL) >= 1
	if p == null or not has_flower:
		cursor.visible = false
	else:
		var c := Planting.cell_of(p.global_position)
		if not in_map(c):
			cursor.visible = false   # 집 안(INTERIOR_ORIGIN 먼 좌표) 등 마을 밖
		else:
			var ok := Planting.can_plant_at(c)
			if c != cursor_cell or ok != cursor_ok or cursor.mesh == null:
				cursor_cell = c
				cursor_ok = ok
				cursor.mesh = _cell_mesh([c], OK_COL if ok else NO_COL, OK_FILL if ok else NO_FILL, CURSOR_W)
			cursor.visible = true
	if ForestSaveState.planted.size() != _planted_n:
		refresh_grid()


## 심은 꽃 둘레 격자를 다시 짓는다(심은 수가 바뀔 때만)
func refresh_grid() -> void:
	_planted_n = ForestSaveState.planted.size()
	var cells := {}
	for e: Dictionary in ForestSaveState.planted:
		var pc := Planting.cell_of(Vector3(float(e.x), 0, float(e.z)))
		for dy in range(-GRID_RADIUS, GRID_RADIUS + 1):
			for dx in range(-GRID_RADIUS, GRID_RADIUS + 1):
				var c := pc + Vector2i(dx, dy)
				if in_map(c):
					cells[c] = true
	grid.mesh = _cell_mesh(cells.keys(), GRID_COL, Color(0, 0, 0, 0)) if not cells.is_empty() else null
	grid.visible = not cells.is_empty()


## 칸들의 테두리 띠(+ 채움) 한 메시 — 정점색에 알파
static func _cell_mesh(cells: Array, line: Color, fill: Color, half_w: float = LINE_W) -> ArrayMesh:
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	for c: Vector2i in cells:
		var k := cell_corners(c)
		if fill.a > 0.0:
			_quad(st, k[0], k[1], k[2], k[3], fill)
		for i in 4:
			var a: Vector3 = k[i]
			var b: Vector3 = k[(i + 1) % 4]
			var along := (b - a).normalized()
			var side := Vector3(-along.z, 0, along.x) * half_w
			_quad(st, a - side, b - side, b + side, a + side, line)
	return st.commit()


static func _quad(st: SurfaceTool, a: Vector3, b: Vector3, c: Vector3, d: Vector3, col: Color) -> void:
	st.set_color(col)
	st.add_vertex(a)
	st.add_vertex(b)
	st.add_vertex(c)
	st.add_vertex(a)
	st.add_vertex(c)
	st.add_vertex(d)
