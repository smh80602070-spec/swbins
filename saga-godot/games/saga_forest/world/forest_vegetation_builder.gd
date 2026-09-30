extends Node3D

## VERTICAL_SLICE_FOREST.md 4절 "나무 몇 그루만(GO의 tree_oak.glb 재사용)"
## — 소나무·바위·꽃 등 다른 채집 대상은 "제외" 목록이라 여기 없다.
## 2절이 이미 확인해 둔 값 그대로 재사용한다: tree_oak.glb ×4.5가 이
## 3.0m 타일에 캐노피 폭 ≈2.9m로 딱 들어맞는다(새 자산 없이 GO의 나무를
## 그대로 가져다 쓴다).
##
## GO의 vegetation_builder.gd와 같은 원칙("자리는 시각의 순수 함수다") —
## 결정적 해시로 늘 같은 자리에 선다. 1절 결정(구면 투영)에 따라 나무도
## 땅과 같은 곡률 머티리얼을 써야 한다 — 안 그러면 나무가 굽은 땅 위에
## 붕 뜬 것처럼 보인다(world_curve.gdshaderinc 주석 그대로).

const ForestMap := preload("res://games/saga_forest/data/village_map.gd")
const ForestBiome := preload("res://games/saga_forest/data/forest_biome.gd")
const GLBUtils := preload("res://saga_core/world/glb_utils.gd")
const WorldCurveMaterial := preload("res://saga_core/world/world_curve_material.gd")

## 2026-09-20 — GO와 같은 이유(vegetation_builder.gd 해당 날짜 주석)로
## Kenney tree_oak 대신 Quaternius CommonTree_1을 쓴다. 이 판은 나무를
## vertex_color_material로 완전히 덮어 칠하므로(아래 BIOME_TREE_TINT)
## 팔레트 스냅 텍스처가 어차피 안 보인다 — 그래서 스냅 변형이 아니라
## `assets/vegetation/` 원본 gltf를 바로 쓴다. 옛 최종 높이(1.226×4.5≈
## 5.52m) 그대로 맞추려 TREE_SCALE만 CommonTree_1 실측고(7.265)로 역산.
const TREE_GLB := "res://assets/vegetation/CommonTree_1.gltf"
const TREE_SCALE := 0.759
const TREES_PER_EDGE_TILE := 2
const CURVE_AMOUNT := 0.004

## PLAN 103-3 "FOREST 바이옴 5" — GO처럼 GLB 변형을 따로 굽지 않는다.
## FOREST 나무는 이미 material_override(vertex_color_material)로
## 원본 텍스처를 버리고 정점색×tint_color 하나로만 칠해지므로(구면
## 곡률 셰이더가 요구하는 방식), 바이옴 구분은 GLB 대신 forest_biome_
## scatter.gd 가 이미 쓰는 것과 같은 방식 — 바이옴별 tint_color 하나씩
## 이다. 바이옴 하나마다 MultiMeshInstance3D 를 따로 둬야 색이 갈린다
## (한 MultiMesh는 머티리얼 하나뿐이라 — GO vegetation_builder.gd 의
## "바위 큰/작은 두 MultiMesh" 패턴과 같은 이유). ForestBiome.biome_at()
## 의 땅 색(meadow 밝은 풀·dark 짙은 숲·mush 축축한 녹회색·rocky
## 메마른 회녹)을 그대로 베끼지 않고 "나뭇잎다운" 톤으로 옮겼다 —
## 땅과 나무가 완전히 같은 색이면 밋밋해 보여서다.
const BIOME_TREE_TINT := {
	"meadow": Color(0.85, 0.95, 0.5),
	"dark": Color(0.32, 0.4, 0.28),
	"mush": Color(0.55, 0.62, 0.48),
	"rocky": Color(0.6, 0.58, 0.46),
}


func _ready() -> void:
	_scatter_trees()


static func _hash(gx: int, gy: int, salt: int) -> float:
	var h := (gx * 374761393) ^ (gy * 668265263) ^ (salt * 2246822519)
	h = (h ^ (h >> 13)) * 1274126177
	h = h ^ (h >> 16)
	return float(h & 0x7fffffff) / float(0x7fffffff)


## CommonTree_1 잎은 alphaMode MASK 카드(텍스처 76% 투명, 잎 정점 전부 투명
## 픽셀 위 — 09-23 실측)인데, 예전엔 material_override(vertex_color_material)
## 하나로 덮어 알파가 무시돼 잎이 네모판으로 그려졌다. 색(정점색 × 바이옴
## tint)은 승인된 그대로 두고 원본 텍스처 알파로만 오려낸다. MultiMesh는 표면별
## 머티리얼을 따로 못 받으므로(material_override뿐) 바이옴마다 메시를 복제해
## 표면(줄기·잎)마다 머티리얼을 박는다 — 원본 공유 Mesh는 안 건드린다.
func _biome_tree_mesh(src: Mesh, tint: Color) -> Mesh:
	var mesh := src.duplicate() as Mesh
	for i in mesh.get_surface_count():
		var orig := src.surface_get_material(i) as BaseMaterial3D
		if orig == null or orig.albedo_texture == null:
			mesh.surface_set_material(i, WorldCurveMaterial.vertex_color_material(CURVE_AMOUNT, 0.95, tint))
			continue
		mesh.surface_set_material(i, WorldCurveMaterial.vertex_color_cutout_material(
			CURVE_AMOUNT, 0.95, tint, orig.albedo_texture, orig.alpha_scissor_threshold))
	return mesh


func _scatter_trees() -> void:
	var ground := 0.0
	## 바이옴 키(meadow/dark/mush/rocky)별로 자리를 따로 모은다 — 각각
	## 다른 MultiMeshInstance3D가 되어야 tint_color가 갈린다.
	var by_biome: Dictionary = {}
	for key in BIOME_TREE_TINT:
		by_biome[key] = {"positions": [], "scales": [], "yaws": []}

	var rows := ForestMap.ROWS
	for y in rows.size():
		var row: String = rows[y]
		for x in row.length():
			if row[x] != "T":
				continue
			var biome_key: String = String(ForestBiome.biome_at(x, y).key)
			var bucket: Dictionary = by_biome[biome_key]
			for i in TREES_PER_EDGE_TILE:
				var jx := (_hash(x, y, i * 2) - 0.5) * ForestMap.TILE_SIZE * 0.8
				var jz := (_hash(x, y, i * 2 + 1) - 0.5) * ForestMap.TILE_SIZE * 0.8
				var s := 0.7 + _hash(x, y, i * 2 + 100) * 0.6
				bucket.positions.append(ForestMap.world_pos(x, y) + Vector3(jx, ground, jz))
				bucket.scales.append(s)
				bucket.yaws.append(_hash(x, y, i * 2 + 200) * TAU)

	var any_tree := false
	for key: String in by_biome:
		if not by_biome[key].positions.is_empty():
			any_tree = true
			break
	if not any_tree:
		return

	var tree_mesh := GLBUtils.extract_mesh(TREE_GLB)
	if tree_mesh == null:
		return

	var trunks := StaticBody3D.new()
	trunks.name = "TreeTrunkCollisions"
	add_child(trunks)

	for key: String in by_biome:
		var bucket: Dictionary = by_biome[key]
		var positions: Array = bucket.positions
		if positions.is_empty():
			continue
		var scales: Array = bucket.scales
		var yaws: Array = bucket.yaws

		var mm := MultiMesh.new()
		mm.transform_format = MultiMesh.TRANSFORM_3D
		mm.mesh = _biome_tree_mesh(tree_mesh, BIOME_TREE_TINT[key])
		mm.instance_count = positions.size()

		var mmi := MultiMeshInstance3D.new()
		mmi.multimesh = mm
		mmi.name = "Trees_%s" % key
		add_child(mmi)

		for i in positions.size():
			var s: float = scales[i] * TREE_SCALE
			var basis := Basis(Vector3.UP, yaws[i]).scaled(Vector3(s, s, s))
			var base_pos: Vector3 = positions[i]
			mm.set_instance_transform(i, Transform3D(basis, base_pos))

			## GO vegetation_builder.gd와 같은 값(줄기만 막는다, 캐노피는 안
			## 막는다) — 걷는 느낌을 그대로 물려받는다.
			var cs := CollisionShape3D.new()
			var shape := CylinderShape3D.new()
			shape.radius = 0.4 * scales[i]
			shape.height = 3.0 * scales[i]
			cs.shape = shape
			cs.position = base_pos + Vector3(0, 1.5 * scales[i], 0)
			trunks.add_child(cs)
