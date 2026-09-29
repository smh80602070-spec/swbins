extends Node3D

## VERTICAL_SLICE_FOREST.md 4절 "마을 지형 하나 — 잔디·흙길·나무 몇
## 그루만, 바이옴 다양성은 이번엔 안 만든다". GO의 terrain_builder.gd와
## 달리 높낮이·복수 지형(산·강)이 없어 훨씬 단순하다 — 칸마다 색만 있는
## 평평한 사각형 하나, 충돌도 지도 전체를 덮는 평평한 바닥 하나뿐이다.
##
## 1절 결정(구면 투영, 정점 셰이더) — 땅은 이 곡률을 쓰는 첫 머티리얼이다.
## WorldCurveMaterial이 SUB(칸 경계 블렌딩)까지는 안 하지만(GO는 여러
## 지형이 만나는 경계를 부드럽게 섞어야 했다 — FOREST는 사실상 한 색이라
## 그 문제 자체가 없다), 정점색 기반 곡률 셰이더는 그대로 재사용한다.

const ForestMap := preload("res://games/saga_forest/data/village_map.gd")
const ForestBiome := preload("res://games/saga_forest/data/forest_biome.gd")
const WorldCurveMaterial := preload("res://saga_core/world/world_curve_material.gd")

## height는 전부 0 — 이번 슬라이스는 높낮이가 없다(그래도 GO의 LEGEND와
## 같은 모양을 유지해 다른 빌더들이 TerrainBuilder.LEGEND[ch].height로
## 지면 높이를 얻는 관례를 그대로 따를 수 있게 한다).
const LEGEND := {
	"T": {"name": "forest_edge", "color": Color(0.19, 0.4, 0.17), "walkable": true, "height": 0.0},
	".": {"name": "grass", "color": Color(0.32, 0.52, 0.22), "walkable": true, "height": 0.0},
	"=": {"name": "path", "color": Color(0.55, 0.45, 0.3), "walkable": true, "height": 0.0},
	"H": {"name": "house", "color": Color(0.32, 0.52, 0.22), "walkable": true, "height": 0.0},
}

const CURVE_AMOUNT := 0.004


func _ready() -> void:
	_build_ground()
	_build_collision()


## 칸마다 색이 다른 사각형 하나씩(GO처럼 경계를 섞지 않는다 — 위 주석
## 참고) — 한 장의 메시로 합쳐 draw call은 하나뿐이다.
func _build_ground() -> void:
	var rows := ForestMap.ROWS
	var half := ForestMap.TILE_SIZE * 0.5

	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)

	for y in rows.size():
		var row: String = rows[y]
		for x in row.length():
			var ch: String = row[x]
			if not LEGEND.has(ch):
				push_warning("forest_terrain_builder: 모르는 지형 글자 '%s'" % ch)
				continue
			var info: Dictionary = LEGEND[ch]
			var center := ForestMap.world_pos(x, y) + Vector3(0, info.height, 0)
			## 제외 목록 7번(바이옴 지형 다양성) — 풀밭(".")만 사분면
			## 바이옴 색으로, 나머지(숲 테두리·흙길·집 자리)는 그대로.
			var col: Color = ForestBiome.color_at(x, y) if ch == "." else info.color

			var p00 := center + Vector3(-half, 0, -half)
			var p10 := center + Vector3(half, 0, -half)
			var p01 := center + Vector3(-half, 0, half)
			var p11 := center + Vector3(half, 0, half)

			st.set_normal(Vector3.UP)
			## 시계 방향이 앞면(위에서 본 GO 땅과 같다 — 반시계면 cull_back 재질에서 땅이 통째로 안 보인다).
			st.set_color(col); st.add_vertex(p00)
			st.set_color(col); st.add_vertex(p10)
			st.set_color(col); st.add_vertex(p11)

			st.set_normal(Vector3.UP)
			st.set_color(col); st.add_vertex(p00)
			st.set_color(col); st.add_vertex(p11)
			st.set_color(col); st.add_vertex(p01)

	var mesh := st.commit()
	## PLAN 102-5 "바닥 한 색" 처방(2026-09-22) — GO에 먼저 물린
	## terrain_triplanar를 곡률과 합친 변종으로 FOREST에도. 정점색(지형
	## 종류·바이옴 tint)·구면 투영 로직은 한 줄도 안 바꿨다, 머티리얼만
	## 교체.
	var mat := WorldCurveMaterial.triplanar_material(CURVE_AMOUNT)

	var mi := MeshInstance3D.new()
	mi.mesh = mesh
	mi.name = "Ground"
	mi.material_override = mat
	add_child(mi)


## 이번 슬라이스는 높낮이가 없어(전부 height=0) GO처럼 칸마다 충돌체를
## 안 만들고 지도 전체를 덮는 평평한 바닥 하나로 충분하다.
func _build_collision() -> void:
	var s := ForestMap.size()
	var body := StaticBody3D.new()
	body.name = "TerrainCollision"
	var cs := CollisionShape3D.new()
	var box := BoxShape3D.new()
	box.size = Vector3(s.x * ForestMap.TILE_SIZE, 1.0, s.y * ForestMap.TILE_SIZE)
	cs.shape = box
	body.position = Vector3(0, -0.5, 0)
	body.add_child(cs)
	add_child(body)
