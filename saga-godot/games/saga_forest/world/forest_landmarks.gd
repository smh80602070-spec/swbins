extends Node3D

## PLAN 101-1 E(발견 밀도), FOREST 몫 — 2026-09-18③.
## forest_village.gd::_print_density_report()가 GO와 같은 반경(60m)을
## 그대로 쓰면 FOREST 지도(90×60m)는 거의 전부 한 반경 안에 들어 empty_pct
## 가 늘 0.0으로 나와 무의미했다(PLAN 105 Q-f). GO의 "타일 1.25칸" 비율
## (48m/타일 기준)을 FOREST 타일(3m)에 그대로 옮기면 3.75m로 너무 작아
## 이번엔 반대로 무의미해진다 — 이 세션 판단으로 **반경 10m**를 택했다
## (r=10m: empty 108/600=18.0%, r=15m부터는 이미 3.7%라 신호가 죽는다.
## r=20m 이상은 GO의 60m와 같은 문제를 그대로 재현한다).
##
## GO landmarks_builder.gd FIELD_MARKERS와 같은 결 — 순수 장식, 선택지도
## 보상도 없다. FOREST엔 CodexState "discover" 갈래가 없어(forest_village.gd
## 헤더 참고) "codex_discoverable" 그룹에 넣기만 하면 밀도 진단이 위치를
## 집어간다. r=10m 빈 칸 108개가 주로 지도 테두리(숲 경계 "T" 2겹, 걸을
## 수는 있다)에 몰려 있어 그 구역을 노려 11개를 놓았다.

const ForestMap := preload("res://games/saga_forest/data/village_map.gd")
const TerrainBuilder := preload("res://games/saga_forest/world/forest_terrain_builder.gd")
const WorldCurveMaterial := preload("res://saga_core/world/world_curve_material.gd")

const CURVE_AMOUNT := 0.004

const MARKERS := [
	{"id": "forest_stump", "grid": Vector2i(2, 3), "shape": "stump"},
	{"id": "forest_root", "grid": Vector2i(1, 13), "shape": "root"},
	{"id": "forest_totem", "grid": Vector2i(13, 1), "shape": "totem"},
	{"id": "forest_cairn_ne", "grid": Vector2i(23, 1), "shape": "cairn"},
	{"id": "forest_mossrock_ne", "grid": Vector2i(27, 2), "shape": "mossrock"},
	{"id": "forest_beehive", "grid": Vector2i(28, 9), "shape": "beehive"},
	{"id": "forest_anthill", "grid": Vector2i(28, 16), "shape": "anthill"},
	{"id": "forest_milestone", "grid": Vector2i(19, 13), "shape": "milestone"},
	{"id": "forest_woodpile", "grid": Vector2i(8, 12), "shape": "woodpile"},
	{"id": "forest_shrine_stone", "grid": Vector2i(7, 18), "shape": "shrine_stone"},
	{"id": "forest_well", "grid": Vector2i(24, 18), "shape": "well"},
]


func _ready() -> void:
	for m: Dictionary in MARKERS:
		_add_marker(m)


func _add_marker(m: Dictionary) -> void:
	var ch: String = ForestMap.tile_at(m.grid.x, m.grid.y)
	var ground: float = TerrainBuilder.LEGEND.get(ch, TerrainBuilder.LEGEND["."]).height
	var pos := ForestMap.world_pos(m.grid.x, m.grid.y) + Vector3(0, ground, 0)

	var mi := MeshInstance3D.new()
	mi.name = "Landmark_%s" % m.id
	var color := Color(0.45, 0.4, 0.32)
	match String(m.shape):
		"stump":
			var mesh := CylinderMesh.new()
			mesh.top_radius = 0.35; mesh.bottom_radius = 0.4; mesh.height = 0.5
			mi.mesh = mesh
			mi.position = pos + Vector3(0, 0.25, 0)
			color = Color(0.42, 0.3, 0.18)
		"root":
			var mesh := TorusMesh.new()
			mesh.inner_radius = 0.15; mesh.outer_radius = 0.5
			mi.mesh = mesh
			mi.position = pos + Vector3(0, 0.15, 0)
			color = Color(0.38, 0.28, 0.16)
		"totem":
			var mesh := CapsuleMesh.new()
			mesh.radius = 0.18; mesh.height = 2.2
			mi.mesh = mesh
			mi.position = pos + Vector3(0, 1.1, 0)
			color = Color(0.5, 0.36, 0.2)
		"cairn":
			var mesh := CylinderMesh.new()
			mesh.top_radius = 0.2; mesh.bottom_radius = 0.5; mesh.height = 0.9
			mi.mesh = mesh
			mi.position = pos + Vector3(0, 0.45, 0)
			color = Color(0.5, 0.48, 0.44)
		"mossrock":
			var mesh := SphereMesh.new()
			mesh.radial_segments = 16; mesh.rings = 8   # G-0260 기본 64×32 → creature_builder 값(반지름 ≤0.5m 라 눈엔 같음)
			mesh.radius = 0.45; mesh.height = 0.7
			mi.mesh = mesh
			mi.position = pos + Vector3(0, 0.25, 0)
			color = Color(0.32, 0.4, 0.26)
		"beehive":
			var mesh := CylinderMesh.new()
			mesh.top_radius = 0.05; mesh.bottom_radius = 0.35; mesh.height = 0.7
			mi.mesh = mesh
			mi.position = pos + Vector3(0, 1.4, 0)
			color = Color(0.68, 0.56, 0.24)
		"anthill":
			var mesh := CylinderMesh.new()
			mesh.top_radius = 0.05; mesh.bottom_radius = 0.5; mesh.height = 0.8
			mi.mesh = mesh
			mi.position = pos + Vector3(0, 0.4, 0)
			color = Color(0.36, 0.28, 0.18)
		"milestone":
			var mesh := BoxMesh.new()
			mesh.size = Vector3(0.4, 1.0, 0.2)
			mi.mesh = mesh
			mi.position = pos + Vector3(0, 0.5, 0)
			color = Color(0.48, 0.44, 0.36)
		"woodpile":
			var mesh := BoxMesh.new()
			mesh.size = Vector3(1.0, 0.6, 0.6)
			mi.mesh = mesh
			mi.position = pos + Vector3(0, 0.3, 0)
			color = Color(0.44, 0.3, 0.18)
		"shrine_stone":
			var mesh := BoxMesh.new()
			mesh.size = Vector3(0.5, 1.3, 0.25)
			mi.mesh = mesh
			mi.position = pos + Vector3(0, 0.65, 0)
			color = Color(0.5, 0.48, 0.46)
		"well":
			var mesh := CylinderMesh.new()
			mesh.top_radius = 0.55; mesh.bottom_radius = 0.55; mesh.height = 0.6
			mi.mesh = mesh
			mi.position = pos + Vector3(0, 0.3, 0)
			color = Color(0.42, 0.4, 0.38)

	mi.material_override = WorldCurveMaterial.vertex_color_material(CURVE_AMOUNT, 0.9, color)
	add_child(mi)
	mi.add_to_group("codex_discoverable")
