extends Node3D

## VERTICAL_SLICE_FOREST.md 4절 "제외" 목록 7번(마지막 항목) — 바이옴
## 지형 다양성 중 "그 바이옴다운 사물"(웹판 village.js BIOME_SCATTER)
## 절반. 땅 색은 forest_terrain_builder.gd가 이미 ForestBiome.color_at()
## 으로 칠했고, 여기는 그 위에 성긴 장식(순수 시각 — 충돌·채집 없음)을
## 얹는다.
##
## **재해석** — 웹판은 숲 고리(마을 훨씬 바깥)에 짐승·몬스터까지 곁들인
## 훨씬 큰 바이옴 산포 체계를 깐다. 이 슬라이스는 그 고리가 없어 마을
## 안 사분면에, 짐승·몬스터 없이 장식 사물만 흩뿌린다 — 그건 "몬스터·
## 퓨전 콘텐츠"(4절 5번, 여전히 별개 항목으로 제외).
##
## 자리는 forest_vegetation_builder.gd `_hash()`와 같은 원칙 —
## **좌표+salt 결정적 해시**(Math.random을 안 쓴다).

const ForestMap := preload("res://games/saga_forest/data/village_map.gd")
const ForestBiome := preload("res://games/saga_forest/data/forest_biome.gd")
const TerrainBuilder := preload("res://games/saga_forest/world/forest_terrain_builder.gd")
const GLBUtils := preload("res://saga_core/world/glb_utils.gd")
const WorldCurveMaterial := preload("res://saga_core/world/world_curve_material.gd")

const CURVE_AMOUNT := 0.004
const DENSITY := 10  # 풀밭 칸 10개 중 1개꼴(해시 문턱)에만 놓는다
## 배치 가능 칸이 적은 바이옴(실측 dark 20·mush 18 vs meadow 35·rocky 42)은
## 1/10이면 1~2개뿐이라, 바이옴마다 ≈5개가 보이게 문턱만 넓힌다. 같은
## 해시(salt 1)의 문턱을 올리는 것이라 기존 자리는 그대로 남고 추가만 된다.
const BIOME_DENSITY := {"dark": 4, "mush": 4}
const CLEAR_RADIUS := 2  # 이 격자 거리 안(주민·채집물·집 등)엔 안 놓는다

## 상호작용하는 고정 자리 — villager_builder.gd VILLAGERS·gatherable_builder.gd
## DEFS(약초 포함)·forest_house.gd HOUSE_GRID·museum.gd GRID·fishing_spot.gd
## GRID의 grid 값을 그대로 옮겨 적었다(각자 다른 스크립트의 const라 계산식
## 으로 못 끌어온다 — forest_planting.gd 상단과 같은 제약). **이 좌표들을
## 옮기게 되면 이 목록도 같이 고칠 것.**
const CLEAR_SPOTS: Array = [
	Vector2i(19, 9), Vector2i(26, 5), Vector2i(5, 14), Vector2i(25, 8),
	Vector2i(5, 8), Vector2i(14, 15),                                        # 주민 6
	Vector2i(24, 3), Vector2i(9, 12), Vector2i(22, 12), Vector2i(9, 5),
	Vector2i(14, 4), Vector2i(18, 13), Vector2i(6, 11), Vector2i(8, 15),      # 채집물 8(약초 포함)
	Vector2i(15, 9), Vector2i(12, 6), Vector2i(22, 5),                       # 집·박물관·낚시터
]


func _ready() -> void:
	var rows: Array = ForestMap.ROWS
	for y in rows.size():
		var row: String = rows[y]
		for x in row.length():
			if row[x] != ".":
				continue
			if _too_close(Vector2i(x, y)):
				continue
			var density: int = BIOME_DENSITY.get(String(ForestBiome.biome_at(x, y).key), DENSITY)
			if _hash(x, y, 1) >= 1.0 / float(density):
				continue
			_spawn(x, y)


func _too_close(p: Vector2i) -> bool:
	for c: Vector2i in CLEAR_SPOTS:
		if absi(c.x - p.x) <= CLEAR_RADIUS and absi(c.y - p.y) <= CLEAR_RADIUS:
			return true
	return false


func _spawn(x: int, y: int) -> void:
	var biome := ForestBiome.biome_at(x, y)
	var ground: float = TerrainBuilder.LEGEND["."].height
	var pos := ForestMap.world_pos(x, y) + Vector3(0, ground, 0)
	pos.x += (_hash(x, y, 2) - 0.5) * ForestMap.TILE_SIZE * 0.7
	pos.z += (_hash(x, y, 3) - 0.5) * ForestMap.TILE_SIZE * 0.7

	match String(biome.key):
		"meadow":
			_spawn_prop(FLOWER_GLB, pos, FLOWER_SCALE, _hash(x, y, 5) * TAU)
		"dark":
			_spawn_prop(FERN_GLB, pos, FERN_SCALE, _hash(x, y, 6) * TAU)
		"mush":
			_spawn_prop(MUSHROOM_GLB, pos, MUSHROOM_SCALE, _hash(x, y, 4) * TAU)
		"rocky":
			## 2026-09-20 — Kenney rock_smallA 대신 Quaternius Rock_Medium_1.
			## 옛 최종 크기(0.191×0.6≈0.115m)에 맞춰 스케일만 역산(2.260 실측고
			## 기준 0.6→0.0508). 이 gltf엔 COLOR_0이 없어 vertex_color_material
			## (정점색×tint)로는 흰 바위가 됐다(09-23 발견) — 버섯과 같이 원본
			## 텍스처를 곡률째 그린다.
			## G-0019 — 통일 툰 rock_small_01(실측고 0.511m → 옛 0.115m 로 ×0.225), 표면별 텍스처를 곡률째.
			_spawn_prop(ROCK_GLB, pos, ROCK_SCALE, _hash(x, y, 7) * TAU)


## 바위·버섯 — 통일 툰 GLB(G-0019), 표면별 텍스처를 곡률째(_spawn_prop). 배율은 옛 primitive 높이 ÷ 실측고.
const ROCK_GLB := "res://assets/world/rock_small_01.glb"
const ROCK_SCALE := 0.225    # 0.115 / 0.511
const MUSHROOM_GLB := "res://assets/world/mushroom_01.glb"
const MUSHROOM_SCALE := 0.64 # 0.32 / 0.5

## meadow(옛 primitive 구 0.28m)·dark(옛 상자 0.4m) 자리 — 꽃 무리·풀 포기 통일 툰 GLB(G-0019). 배율은 옛 높이 ÷ 실측고(trimesh).
const FLOWER_GLB := "res://assets/world/flower_patch_01.glb"
const FLOWER_SCALE := 0.5    # 0.28 / 0.559
const FERN_GLB := "res://assets/world/grass_tuft_01.glb"   # 고사리 자리 — 짝이 되는 풀 포기
const FERN_SCALE := 0.552    # 0.4 / 0.724

## G-0019 — 통일 툰 GLB 한 개를 곡률 재질(표면별 텍스처)로 놓는다. 꽃·풀·버섯·바위 공용.
## G-0123 — 곡률 재질을 입힌 메시는 GLB 마다 한 벌(예전엔 소품마다 메시 복제 + 셰이더 재질 새로 — 묶어 그리지 못하고 메모리도 소품 수만큼).
static var _prop_mesh := {}
func _spawn_prop(glb: String, pos: Vector3, s: float, yaw: float) -> void:
	if not _prop_mesh.has(glb):
		var src: Mesh = GLBUtils.extract_mesh(glb)
		_prop_mesh[glb] = WorldCurveMaterial.textured_surfaces(src, CURVE_AMOUNT, 0.9) if src != null else null
	var mesh: Mesh = _prop_mesh[glb]
	if mesh == null:
		return
	var mi := MeshInstance3D.new()
	mi.mesh = mesh
	mi.scale = Vector3.ONE * s
	mi.rotation.y = yaw
	mi.position = pos
	add_child(mi)


## forest_vegetation_builder.gd `_hash(gx,gy,salt)`와 완전히 같은
## 알고리즘 — 각자 자기 파일에 둔다(공용화할 이유가 없다는 이 코드베이스의
## 확립된 결, forest_turnip.gd·forest_planting.gd와 같은 이유).
static func _hash(gx: int, gy: int, salt: int) -> float:
	var h := (gx * 374761393) ^ (gy * 668265263) ^ (salt * 2246822519)
	h = (h ^ (h >> 13)) * 1274126177
	h = h ^ (h >> 16)
	return float(h & 0x7fffffff) / float(0x7fffffff)
