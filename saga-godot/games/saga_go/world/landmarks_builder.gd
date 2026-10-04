extends Node3D

## VERTICAL_SLICE.md 27절 — 지도 위 이름난 자리(랜드마크)를 세운다.
## 2026-09-11 — PLAN.md 45·46장(GLB 교체). 마을집·폐허 기둥·다리 널판을
## CC0 Kenney Fantasy Town Kit(assets/buildings, ASSET_GUIDE.md 참고)의
## GLB 조각으로 바꿨다. 굴 입구는 이 킷에 맞는 조각이 없어 이번 교체에서
## 빠졌었다 — 같은 날 뒤이어 CC0 Kenney Modular Cave Kit의 gate-rock.glb로
## 마저 바꿨다(아래 _add_cave 참고). 마을집도 처음엔 wall-block.glb 한 장을
## 비균등 스케일로 늘려 대체했었는데, 그 뒤 이어서 실제로 여러 장을 격자로
## 이어 붙이는 모듈형 조립으로 바꿨다 — docs/ASSET_GUIDE.md 참고.
## 2026-09-28 마을집·역참은 다시 코드 오두막(house_builder.gd)으로 — 블록 격자가 유리 상자로 보였다.

const TestMap := preload("res://games/saga_go/data/test_map.gd")
const TerrainBuilder := preload("res://games/saga_go/world/terrain_builder.gd")
const GLBUtils := preload("res://saga_core/world/glb_utils.gd")
const HouseBuilder := preload("res://games/saga_go/world/house_builder.gd")
const ShrineTrial := preload("res://games/saga_go/world/shrine_trial.gd")
const BeaconTower := preload("res://games/saga_go/world/beacon_tower.gd")

## 103-3 스냅(2026-09-19) — 마을집·역참(_add_village·_add_waystation)은
## go_village, 폐허 기둥(_add_ruins)은 go_ruins 팔레트 변형으로 바꿨다.
## 다리 널판(PLANK_GLB)은 마을·폐허 어느 쪽도 아니라(강 위 마을 시설)
## 원본 그대로 남겨뒀다. "시대 퓨전" 갈래는 아직 이 판에 실제 소품이
## 없어(전장 잔해 4종은 방패·투구·화살통·깃발) 보류.
const PILLAR_GLB := "res://assets/world/dungeon_pillar_01.glb"   # G-0020 — 옛 pillar-stone(Kenney 원기둥) 변형 대신(1.3×3.55×1.3m)
const PLANK_GLB := "res://assets/buildings/planks.glb"
const CAVE_GATE_GLB := "res://assets/world/cave_gate_01_dirt.glb"   # G-0020 — 옛 Kenney gate-rock 대신(4.01×3.2×0.8m, 바닥이 -0.2m 에 있어 CAVE_GATE_LIFT 만큼 올림)
const SHRINE_GLB := "res://assets/world/altar_01.glb"   # G-0020 — 옛 Kenney altar-stone 대신(2.6×1.5×1.8m)

## 마을집 발자국(가로·벽 높이·세로, m) — 충돌 상자·코드 오두막 크기.
const WALL_FOOTPRINT := Vector3(10, 4, 10)
## pillar-stone.glb(높이 1m 원기둥)의 지름 스케일 — 얇을수록 폐허답다.
const RUIN_PILLAR_RADIUS_SCALE := 4.0   # (옛 원기둥용 — G-0020 이후 안 씀, 새 기둥은 균일 배율)
const PILLAR_NEW_HEIGHT := 3.55         # dungeon_pillar_01 실측 높이
## gate-rock.glb(4.0 x 4.05 x 2.454, 바닥 피벗)은 이미 아치 비율이 잡혀
## 있어 축을 고르게(균일) 키우기만 한다 — wall-block처럼 단순 색 아틀라스가
## 아니라 실제 바위 굴곡 노멀맵이 있는 조각이라, 비균등 스케일을 쓰면
## 그 결이 늘어나 이상해 보인다(ASSET_GUIDE.md "마을집이 늘어난 이유" 절
## 참고 — 거긴 색 아틀라스라 비균등이 통했지만 여긴 안 통한다). 원래
## primitive 높이(6)에 맞춰 스케일을 역산했다.
const CAVE_GATE_SIZE := Vector3(4.01, 3.2, 0.8)   # G-0020 cave_gate_01_dirt 실측
const CAVE_GATE_SCALE := 6.0 / 3.2          # 옛 primitive 높이 6m 에 맞춤
const CAVE_GATE_LIFT := 0.2                 # GLB 바닥이 원점 아래 0.2m(실측) — 올려서 땅에 맞춘다
## altar-stone.glb(CC0 Kenney Graveyard Kit, ASSET_GUIDE.md 참고, 실측
## 1.04 x 0.49 x 0.65m, 바닥 중앙 피벗)는 gate-rock.glb와 같은 이유로
## 균일 스케일만 쓴다(실제 돌 표면 굴곡이 있는 조각). 웃허리 높이 제단
## 하나가 목표라 primitive 선례 없이 새로 잡았다 — 최종 높이 약 1.2m,
## 너비 약 2.6m.
const SHRINE_SIZE := Vector3(2.6, 1.5, 1.8)   # G-0020 altar_01 실측(옛 altar-stone ×2.5 ≈ 2.6×1.2×1.6 와 같은 크기)
const SHRINE_SCALE := 1.0

## VERTICAL_SLICE.md 26절 "제외" 목록의 "역참/성채 같은 건물 POI" 착수
## (2026-09-14). 성채(요새 하나만한 규모)는 범위가 커서 이번엔 역참
## (길손이 쉬어 가는 작은 정자)만 — 마을집과 같은 코드 오두막(house_builder.gd)을
## 쓰되 발자국을 마을집(10x4x10)보다 작게 잡아(6x3x6) "쉼터"
## 규모로 구별한다(44장 "에셋은 무작정 많이 넣지 않는다" — 새 킷 없이
## 기존 조각으로 충분). 길(=) 위, 굴 입구(y=2)와 마을(y=5) 사이 (5,3)에
## 세워 "여행길의 쉼터"라는 자리 의미를 살렸다.
const WAYSTATION_FOOTPRINT := Vector3(6, 3, 6)

## 2026-09-12⑩ — 산속 폭포(waterfall_falls, land.js 다섯 표식 중 마지막).
## 새 킷을 받지 않고 **이미 받아 둔** vegetation_builder.gd의 산 바위
## (rock_largeA.glb, 실측 0.78 x 0.26 x 1.02)를 절벽처럼 세로로 세워
## 재사용한다 — 사당·굴처럼 새 킷을 받을 정도로 다른 조각이 필요하진
## 않다고 판단(44장 "에셋은 무작정 많이 넣지 않는다"). 폭포 물줄기·물웅덩이는
## 이 판에 맞는 GLB가 아예 없어(강물도 마찬가지였다) terrain_builder.gd의
## WaterSurface와 같은 색·투명도의 primitive 평면으로 낸다 — "primitive는
## 프로토타입에서만"의 예외가 아니라, 강물 표면도 이미 같은 방식이었다.
const WATERFALL_ROCK_GLB := "res://assets/world/rock_large_02.glb"   # G-0020 — 옛 Kenney rock_largeA 대신(2.66×2.51×1.99m, 바닥 -0.35m)
const WATERFALL_ROCK_SCALE := Vector3(2.6, 5.0, 2.2)
## 2026-09-23 물줄기 폭·웅덩이 — 절벽 높이(tile_base_height)에 맞춰 커졌다.
const WATERFALL_FALL_WIDTH := 7.0
const WATERFALL_POOL_SIZE := Vector2(12.0, 9.0)
const WATER_SHADER := preload("res://saga_core/shaders/water_toon.gdshader")


## 2026-09-12④ — CodexState "지역" 갈래(§26 "발견 도감") 발견 반경.
## 사건 조우 반경(20m)보다 넉넉히 잡았다 — 위협이 아니라 그냥 랜드마크에
## 가까이 왔다는 것만 확인하면 되니 더 관대해도 된다.
const DISCOVERY_RADIUS := 25.0

## 2026-09-18, PLAN 101-1 E(발견 밀도) — `test_village.gd` 워크어블 판정을
## LEGEND.walkable로 고친 뒤 재도 마을은 59.7%(HISTORY 09-18, 포구·폐허는
## 이미 처리). 기존 8지점(굴·사당·폭포·집 둘·역참·폐허·다리)이 중앙에
## 몰려 있어 네 모퉁이가 안 닿는다 — 코너마다 순수 발견 하나씩(돌무더기·
## 이끼바위·허수아비·이정표), whalebone과 같은 결.
const FIELD_MARKERS := [
	{"id": "village_cairn", "grid": Vector2i(8, 1), "shape": "cairn"},
	{"id": "village_mossstone", "grid": Vector2i(1, 9), "shape": "mossstone"},
	{"id": "village_scarecrow", "grid": Vector2i(8, 9), "shape": "scarecrow"},
	{"id": "village_milestone", "grid": Vector2i(5, 9), "shape": "milestone"},
	## 2026-09-20, PLAN 101-1 E 재점검 — 09-18 넷을 더한 뒤에도 46.8%(서·동
	## 숲 테두리가 그대로 안 닿는다, 60m 반경이 48m 타일 하나 정도밖에 못
	## 덮어서 넷으로는 어림없었다). 서쪽 셋·동쪽 셋을 대칭으로 더 심고,
	## 마을 안쪽 남은 두 칸(6,4)(6,6)은 우물 하나로 같이 덮고, 북쪽 산길
	## 어귀((5,0), 굴·사당보다도 북쪽) 하나를 더한다.
	{"id": "village_foxden", "grid": Vector2i(1, 2), "shape": "burrow"},
	{"id": "village_hollow", "grid": Vector2i(1, 4), "shape": "hollow"},
	{"id": "village_beehive", "grid": Vector2i(1, 6), "shape": "beehive"},
	{"id": "village_squirrelnest", "grid": Vector2i(9, 2), "shape": "nest"},
	{"id": "village_badgerden", "grid": Vector2i(9, 4), "shape": "burrow"},
	{"id": "village_woodpecker", "grid": Vector2i(9, 6), "shape": "hollow"},
	{"id": "village_well", "grid": Vector2i(6, 5), "shape": "well"},
	{"id": "village_pass_cairn", "grid": Vector2i(5, 0), "shape": "cairn"},
	## 위 여덟을 심고 재보니 46.8%→12.9%(HISTORY 09-20), 서쪽 숲 안쪽
	## (0,3)(0,5) 두 칸만 딱 하나 모자라 10% 문턱을 못 넘었다 — 옹달샘
	## 하나로 그 둘을 같이 덮는다.
	{"id": "village_spring", "grid": Vector2i(0, 4), "shape": "spring"},
]


func _ready() -> void:
	_add_cave()
	_add_village()
	_add_ruins()
	_add_bridge()
	_add_shrine()
	_add_waterfall()
	_add_waystation()
	_add_beacon()
	_add_field_markers()


## PLAN.md 101-2 GO ⑤"봉수대" — 마을 몫. 숲 모퉁이(9,1), 사당(2,1)·
## 마을(5,5)·역참(5,3)과 안 겹치는 자리.
func _add_beacon() -> void:
	var tower := BeaconTower.new()
	tower.name = "BeaconTower_village"
	tower.region_id = "village"
	tower.grid = Vector2i(9, 1)
	tower.region_label = "마을"
	add_child(tower)


## region3_ruins.gd _build_debris()/region2_coast.gd _build_beach_debris()와
## 같은 결(primitive 여러 모양 + 선택지 없는 순수 발견 하나씩) — PLAN
## 101-1 E, FIELD_MARKERS 참고.
func _add_field_markers() -> void:
	for m in FIELD_MARKERS:
		var ch: String = TestMap.tile_at(m.grid.x, m.grid.y)
		var ground: float = TerrainBuilder.height_at("village", TestMap.world_pos(m.grid.x, m.grid.y))  # 09-30 평지 기복 — LEGEND 평탄 값이 아니라 실제 지면
		var pos := TestMap.world_pos(m.grid.x, m.grid.y) + Vector3(0, ground, 0)
		var mi := MeshInstance3D.new()
		match m.shape:
			"cairn":
				var mesh := CylinderMesh.new()
				mesh.top_radius = 0.25
				mesh.bottom_radius = 0.5
				mesh.height = 0.9
				mi.mesh = mesh
				mi.position = pos + Vector3(0, 0.45, 0)
			"mossstone":
				var mesh := SphereMesh.new()
				mesh.radius = 0.5
				mesh.height = 0.8
				mi.mesh = mesh
				mi.position = pos + Vector3(0, 0.3, 0)
			"scarecrow":
				var mesh := CapsuleMesh.new()
				mesh.radius = 0.12
				mesh.height = 2.0
				mi.mesh = mesh
				mi.position = pos + Vector3(0, 1.0, 0)
			"milestone":
				var mesh := BoxMesh.new()
				mesh.size = Vector3(0.4, 1.0, 0.2)
				mi.mesh = mesh
				mi.position = pos + Vector3(0, 0.5, 0)
			"burrow":
				var mesh := SphereMesh.new()
				mesh.radius = 0.35
				mesh.height = 0.35
				mi.mesh = mesh
				mi.position = pos + Vector3(0, 0.08, 0)
			"hollow":
				var mesh := CylinderMesh.new()
				mesh.top_radius = 0.4
				mesh.bottom_radius = 0.55
				mesh.height = 2.2
				mi.mesh = mesh
				mi.position = pos + Vector3(0, 1.1, 0)
			"beehive":
				var mesh := SphereMesh.new()
				mesh.radius = 0.3
				mesh.height = 0.55
				mi.mesh = mesh
				mi.position = pos + Vector3(0, 1.4, 0)
			"nest":
				var mesh := SphereMesh.new()
				mesh.radius = 0.28
				mesh.height = 0.4
				mi.mesh = mesh
				mi.position = pos + Vector3(0, 0.9, 0)
			"well":
				var mesh := CylinderMesh.new()
				mesh.top_radius = 0.6
				mesh.bottom_radius = 0.65
				mesh.height = 0.7
				mi.mesh = mesh
				mi.position = pos + Vector3(0, 0.35, 0)
			"spring":
				var mesh := CylinderMesh.new()
				mesh.top_radius = 0.7
				mesh.bottom_radius = 0.7
				mesh.height = 0.05
				mi.mesh = mesh
				mi.position = pos + Vector3(0, 0.03, 0)
		var mat := StandardMaterial3D.new()
		if m.shape == "mossstone":
			mat.albedo_color = Color(0.3, 0.36, 0.24)
		elif m.shape in ["burrow", "hollow", "nest"]:
			mat.albedo_color = Color(0.32, 0.24, 0.16)
		elif m.shape == "beehive":
			mat.albedo_color = Color(0.62, 0.5, 0.2)
		elif m.shape == "well":
			mat.albedo_color = Color(0.5, 0.5, 0.52)
		elif m.shape == "spring":
			mat.albedo_color = Color(0.25, 0.45, 0.62, 0.72)
			mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
		else:
			mat.albedo_color = Color(0.48, 0.44, 0.36)
		mi.material_override = mat
		add_child(mi)
		_add_discovery_area(m.id, pos, self)


func _box(size: Vector3, color: Color) -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	var mesh := BoxMesh.new()
	mesh.size = size
	mi.mesh = mesh
	var mat := StandardMaterial3D.new()
	mat.albedo_color = color
	mi.material_override = mat
	return mi


## CodexState "지역" 발견 — 마을(집 두 채)처럼 한 곳에 여러 번 걸어도
## discover()가 알아서 dedup한다(두 번째부터는 조용히 아무 일도 안 함).
func _add_discovery_area(codex_id: String, pos: Vector3, parent: Node3D) -> void:
	var area := Area3D.new()
	area.name = "Discover_" + codex_id
	var cs := CollisionShape3D.new()
	var shape := SphereShape3D.new()
	shape.radius = DISCOVERY_RADIUS
	cs.shape = shape
	area.add_child(cs)
	area.position = pos
	area.add_to_group("codex_discoverable")
	parent.add_child(area)
	area.body_entered.connect(func(body: Node3D) -> void:
		if body.is_in_group("player"):
			CodexState.discover("place", codex_id))


## 그림만 있고 부딪히지 않던 것 — 건물마다 이걸로 실제 벽을 붙인다.
func _solid(size: Vector3, local_pos: Vector3, parent: Node3D) -> void:
	var body := StaticBody3D.new()
	body.name = "Collision"
	body.position = local_pos
	var cs := CollisionShape3D.new()
	var box := BoxShape3D.new()
	box.size = size
	cs.shape = box
	body.add_child(cs)
	parent.add_child(body)


func _add_cave() -> void:
	var ground: float = TerrainBuilder.LEGEND["C"].height
	## 2026-09-11㉒ 지도 확장(+2,+2) — test_map.gd 참고.
	var base_pos := TestMap.world_pos(5, 2) + Vector3(0, ground, 0)
	var size := CAVE_GATE_SIZE * CAVE_GATE_SCALE
	var gate_mesh := GLBUtils.extract_mesh(CAVE_GATE_GLB)

	if gate_mesh != null:
		var mi := MeshInstance3D.new()
		mi.name = "CaveEntrance"
		mi.mesh = gate_mesh
		## gate-rock.glb는 바닥이 원점이라 primitive 시절처럼 높이 절반만큼
		## 띄울 필요가 없다(village/ruins와 같은 이유, ASSET_GUIDE.md 참고).
		mi.transform = Transform3D(Basis().scaled(Vector3.ONE * CAVE_GATE_SCALE), base_pos + Vector3(0, CAVE_GATE_LIFT * CAVE_GATE_SCALE, 0))
		add_child(mi)
	else:
		## 못 받아 왔으면 예전 primitive로 대체 — bridge의 fallback과 같은 패턴.
		var cave := _box(size, Color(0.12, 0.12, 0.14))
		cave.name = "CaveEntrance"
		cave.position = base_pos + Vector3(0, size.y * 0.5, 0)
		add_child(cave)

	## 충돌은 시각 메시의 피벗과 무관하게 중심 기준이라 그대로 둔다
	## (village 쪽 주석과 같은 이유) — 동굴 입구는 지나갈 수 있는 통로가
	## 아니라 랜드마크 장애물이라는 기존 동작을 그대로 유지한다.
	_solid(size, base_pos + Vector3(0, size.y * 0.5, 0), self)
	_add_discovery_area("cave", base_pos, self)


## 옛 사당(S) — test_map.gd LEGEND에 이미 있었지만 2026-09-11㉒ 지도 확장
## 전까지 지도에 한 번도 안 쓰인 자리(격자 (2,1), 북서쪽 숲 모퉁이). 굴·
## 폐허·다리처럼 눈에 보이는 랜드마크 하나만 세운다 — 안에 들어가는 씬은
## 아니다(§32와 같은 경계, 이번엔 사당이라 충돌은 얕게만 잡는다).
func _add_shrine() -> void:
	var ground: float = TerrainBuilder.LEGEND["S"].height
	var base_pos := TestMap.world_pos(2, 1) + Vector3(0, ground, 0)
	var size := SHRINE_SIZE * SHRINE_SCALE
	var altar_mesh := GLBUtils.extract_mesh(SHRINE_GLB)

	if altar_mesh != null:
		var mi := MeshInstance3D.new()
		mi.name = "ShrineAltar"
		mi.mesh = altar_mesh
		## altar-stone.glb도 바닥 중앙 피벗이라 cave/ruins와 같은 이유로
		## height*0.5만큼 안 띄워도 된다.
		mi.transform = Transform3D(Basis().scaled(Vector3.ONE * SHRINE_SCALE), base_pos)
		add_child(mi)
	else:
		## 못 받아 왔으면 예전 방식과 같은 fallback(primitive 박스).
		var altar := _box(size, Color(0.42, 0.4, 0.38))
		altar.name = "ShrineAltar"
		altar.position = base_pos + Vector3(0, size.y * 0.5, 0)
		add_child(altar)

	_solid(size, base_pos + Vector3(0, size.y * 0.5, 0), self)
	_add_discovery_area("shrine", base_pos, self)

	## PLAN.md 101-2 GO ④"사당 시련" — 제단 자리에 시련 노드를 심는다
	## (shrine_trial.gd, 자기 완결형 — 위치는 자기 스스로 잡지 않고 여기
	## base_pos를 받는다).
	var trial := ShrineTrial.new()
	trial.name = "ShrineTrial"
	trial.position = base_pos
	add_child(trial)


## 산속 폭포(W) — 격자 (8,3), 옛 산(^) 자리 하나를 깎았다(test_map.gd 참고).
## rock_largeA.glb를 세로로 세운 절벽 배경 + primitive 물줄기·물웅덩이.
## 물줄기는 장식이라 충돌 없음 — 막히는 건 뒤쪽 바위뿐(사당과 같은 경계,
## "충돌은 얕게만 잡는다").
func _add_waterfall() -> void:
	var ground: float = TerrainBuilder.LEGEND["W"].height
	var base_pos := TestMap.world_pos(8, 3) + Vector3(0, ground, 0)
	## 2026-09-23 물줄기가 칸 북쪽 절벽으로 옮겨 가 바위도 그 발치 옆으로.
	var rock_back_offset := Vector3(WATERFALL_FALL_WIDTH * 0.5 + 2.0, 0, -TestMap.TILE_SIZE * 0.5 + 1.8)
	var rock_mesh := GLBUtils.extract_mesh(WATERFALL_ROCK_GLB)

	if rock_mesh != null:
		var mi := MeshInstance3D.new()
		mi.name = "WaterfallRock"
		mi.mesh = rock_mesh
		## G-0020 — rock_large_02 는 이미 2.66×2.51×1.99m 라 충돌 상자(WATERFALL_ROCK_SCALE 2.6×5.0×2.2 의 윗 절반 2.5)와 거의 같다: 균일 0.95배, 바닥 -0.35m 만큼 올림.
		mi.transform = Transform3D(Basis().scaled(Vector3.ONE * 0.95),
			base_pos + rock_back_offset + Vector3(0, 0.35 * 0.95, 0))
		add_child(mi)
	else:
		var fallback := _box(WATERFALL_ROCK_SCALE, Color(0.4, 0.4, 0.42))
		fallback.name = "WaterfallRock"
		fallback.position = base_pos + rock_back_offset + Vector3(0, WATERFALL_ROCK_SCALE.y * 0.5, 0)
		add_child(fallback)
	_solid(Vector3(WATERFALL_ROCK_SCALE.x, WATERFALL_ROCK_SCALE.y * 0.5, WATERFALL_ROCK_SCALE.z),
		base_pos + rock_back_offset + Vector3(0, WATERFALL_ROCK_SCALE.y * 0.25, 0), self)

	## PLAN 106장 ② — 산이 10~30m 절벽이 됐으니(terrain_builder.gd) 물줄기도
	## 북쪽 산(8,2) 절벽 꼭대기에서 칸 북쪽 변을 따라 쏟아진다. 툰 물 셰이더의
	## 폭포 모드(uv_flow)로 흘러내리는 줄을 그리고, 발치 웅덩이는 보통 물.
	var tile := TestMap.TILE_SIZE
	var cliff_top: float = TerrainBuilder.tile_base_height("village", 8, 2)
	var fall_h: float = cliff_top - ground
	var cliff_z: float = base_pos.z - tile * 0.5

	var fall_mat := ShaderMaterial.new()
	fall_mat.shader = WATER_SHADER
	fall_mat.set_shader_parameter("uv_flow", 0.6)
	var face_mi := MeshInstance3D.new()
	face_mi.name = "WaterfallFace"
	var face_mesh := PlaneMesh.new()
	face_mesh.size = Vector2(WATERFALL_FALL_WIDTH, fall_h)
	face_mi.mesh = face_mesh
	face_mi.material_override = fall_mat
	face_mi.rotation_degrees = Vector3(90, 0, 0)
	face_mi.position = Vector3(base_pos.x, ground + fall_h * 0.5, cliff_z + 0.25)
	add_child(face_mi)

	var pool_mat := ShaderMaterial.new()
	pool_mat.shader = WATER_SHADER
	pool_mat.set_shader_parameter("flow", Vector2(0.0, 0.5))
	var pool_mi := MeshInstance3D.new()
	pool_mi.name = "WaterfallPool"
	var pool_mesh := PlaneMesh.new()
	pool_mesh.size = WATERFALL_POOL_SIZE
	pool_mi.mesh = pool_mesh
	pool_mi.material_override = pool_mat
	pool_mi.position = Vector3(base_pos.x, ground + 0.05, cliff_z + WATERFALL_POOL_SIZE.y * 0.5)
	add_child(pool_mi)

	_add_discovery_area("waterfall", pool_mi.position, self)


func _add_village() -> void:
	var ground: float = TerrainBuilder.LEGEND["H"].height
	## 2026-09-11㉒ 지도 확장(+2,+2) — test_map.gd 참고.
	for gx in [4, 5]:
		var pos := TestMap.world_pos(gx, 5) + Vector3(0, ground, 0)
		var house := _build_house("House_%d" % gx, pos, WALL_FOOTPRINT, gx)
		add_child(house)
		_add_discovery_area("village", house.position, self)


## 코드 오두막(house_builder.gd, 메시 하나) + 충돌 하나짜리 건물 한 채.
## 2026-09-28 "그래픽 먼저" — 예전엔 wall-block.glb 벽 둘레 + roof-gable.glb 지붕이라 푸른 유리 상자로 보였다(창 모드 촬영).
## `_add_village()`(마을집, WALL_FOOTPRINT)와 `_add_waystation()`(역참,
## WAYSTATION_FOOTPRINT — 더 작은 발자국)이 같은 조립을 쓴다(35장 "동일한
## 코드를 복사하지 않는다").
func _build_house(node_name: String, pos: Vector3, footprint: Vector3, variant: int) -> Node3D:
	var house := Node3D.new()
	house.name = node_name
	house.position = pos
	house.add_child(HouseBuilder.build(footprint, variant))
	## 충돌은 벽 상자 그대로(지붕·처마·굴뚝은 머리 위라 막지 않는다).
	_solid(footprint, Vector3(0, footprint.y * 0.5, 0), house)
	return house


func _add_waystation() -> void:
	var ground: float = TerrainBuilder.height_at("village", TestMap.world_pos(5, 3))
	var pos := TestMap.world_pos(5, 3) + Vector3(0, ground, 0)
	var house := _build_house("Waystation", pos, WAYSTATION_FOOTPRINT, 2)
	add_child(house)
	_add_discovery_area("waystation", house.position, self)


func _add_ruins() -> void:
	var ground: float = TerrainBuilder.LEGEND["R"].height
	## 2026-09-11㉒ 지도 확장(+2,+2) — test_map.gd 참고.
	var base := TestMap.world_pos(7, 5) + Vector3(0, ground, 0)
	var offsets := [Vector2(-3, -2), Vector2(2, 1), Vector2(-1, 3)]
	var pillar_mesh := GLBUtils.extract_mesh(PILLAR_GLB)
	## pillar-stone.glb는 높이 1m짜리 원기둥 — 스케일 값을 그대로 목표
	## 높이(m)로 쓸 수 있다. 반지름은 얇게 두는 쪽이 폐허다워서 primitive
	## 시절(반지름 최대 1.2)보다 가늘게 잡았다 — ASSET_GUIDE.md 참고.
	var radius_scale := RUIN_PILLAR_RADIUS_SCALE
	for i in offsets.size():
		var off: Vector2 = offsets[i]
		var height := 5.0 + float(i % 2) * 1.5
		var pos := base + Vector3(off.x, 0, off.y)

		if pillar_mesh != null:
			var mi := MeshInstance3D.new()
			mi.mesh = pillar_mesh
			mi.name = "RuinPillar_%d" % i
			## 바닥 피벗이라 그대로 세우면 된다(primitive 때는 중앙 피벗이라
			## height*0.5만큼 띄워야 했다).
			var u := height / PILLAR_NEW_HEIGHT   # 균일 배율(툰 질감을 안 늘린다) — 5~6.5m 가 되도록
			mi.transform = Transform3D(Basis().scaled(Vector3.ONE * u), pos)
			add_child(mi)

		var body := StaticBody3D.new()
		body.name = "Collision"
		body.position = pos + Vector3(0, height * 0.5, 0)
		var cs := CollisionShape3D.new()
		var shape := CylinderShape3D.new()
		shape.radius = 0.45 * height / PILLAR_NEW_HEIGHT   # 새 기둥 반폭 0.65m×배율의 7할 — 스치면 안 걸리게
		shape.height = height
		cs.shape = shape
		body.add_child(cs)
		add_child(body)

	_add_discovery_area("ruins", base, self)


func _add_bridge() -> void:
	## 다리 밑은 강바닥(height -1.0)이고 그 위에 수면(-0.45)이 떠 있다
	## (terrain_builder.gd _build_water 참고) — 널판은 수면보다 확실히 위에 놓는다.
	## 충돌은 terrain_builder.gd의 "B" 타일이 이미 같은 높이(BRIDGE_CLEARANCE)에
	## 놓아 두므로 여기서 따로 만들지 않는다 — 두 파일이 각자 만들면 겹친다.
	var bed: float = TerrainBuilder.LEGEND["B"].height
	## 2026-09-11㉒ 지도 확장(+2,+2) — test_map.gd 참고.
	var base_pos := TestMap.world_pos(5, 7) + Vector3(0, bed + TerrainBuilder.BRIDGE_CLEARANCE, 0)
	var bridge_length := 44.0
	var bridge_width := 6.0

	var plank_mesh := GLBUtils.extract_mesh(PLANK_GLB)
	if plank_mesh == null:
		## 못 받아 왔으면 예전 primitive로 대체 — 다리가 아예 안 보이는 것보단 낫다.
		var plank := _box(Vector3(bridge_width, 0.6, bridge_length), Color(0.42, 0.3, 0.18))
		plank.name = "Bridge"
		plank.position = base_pos
		add_child(plank)
		_add_discovery_area("bridge", base_pos, self)
		return

	## planks.glb는 1x1x1칸짜리 널빤지 — primitive처럼 하나를 44배 길게
	## 늘리면 나뭇결이 다 뭉개져 보이므로, 강을 따라 실제로 이어 붙인다
	## (MultiMesh — 44개라도 draw call은 1회, master.md 35장 그대로).
	var plank_count := int(ceil(bridge_length))
	var mm := MultiMesh.new()
	mm.transform_format = MultiMesh.TRANSFORM_3D
	mm.mesh = plank_mesh
	mm.instance_count = plank_count

	var start_z := -bridge_length * 0.5 + 0.5
	for i in plank_count:
		var basis := Basis().scaled(Vector3(bridge_width, 2.0, 1.02))
		var pos := base_pos + Vector3(0, 0, start_z + i)
		mm.set_instance_transform(i, Transform3D(basis, pos))

	var mmi := MultiMeshInstance3D.new()
	mmi.multimesh = mm
	mmi.name = "Bridge"
	add_child(mmi)
	_add_discovery_area("bridge", base_pos, self)
