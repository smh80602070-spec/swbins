extends Node3D

## PLAN.md 51장 GO 축("월드 확장→탐험→지역→이벤트→수집→희귀 몬스터")의
## 마지막 남은 항목 — "지역"의 첫 걸음. §26에서 이미 "역참(길손이 쉬어
## 가는 정자)"을 세워 뒀지만(landmarks_builder.gd _add_waystation) 그냥
## 발견만 되는 장식이었다 — 실제로 "다른 곳으로 통하는 길목"이라는 자리
## 의미를 이번에 준다.
##
## **2026-09-16, 진짜 두 번째 타일맵 지역으로 다시 지었다.** 처음(09-15)엔
## terrain_builder.gd·landmarks_builder.gd가 `TestMap` 하나에 고정
## 결합돼 있어(각각 11회·다수 호출) 다중 지역화가 큰 일이라 primitive
## (PlaneMesh 사각형+박스 벽 넷)로 자급자족했었다. 이번에 그 재설계를
## 했다 — test_map.gd가 이제 `REGIONS`(id→{rows,tile_size,origin})
## 레지스트리라 마을 말고 다른 글자 지도도 가질 수 있고, terrain_builder.gd
## 는 `region_id`(export, 기본 "village")로 어떤 지역이든 그린다. 여기선
## `region_id = "coast"`인 TerrainBuilder 인스턴스 하나로 땅·물·산 벽을
## 전부 얻는다(primitive 셋을 손으로 만들던 `_build_ground/_build_water/
## _build_walls`는 지웠다) — 마을과 똑같이 "산은 못 지나가고 물은 못
## 지나가고 다리(B)로만 건넌다"는 진짜 지형 규칙이 적용된다(이전엔 "첫
## 걸음이라 물에 못 들어간다는 규칙까지 안 만든다"고 미뤄 뒀던 것).
## 마을 쪽은 test_map.gd·terrain_builder.gd 둘 다 기본값(region_id 생략)
## 그대로라 헤드리스 회귀 로그 md5가 이 리팩터 전후로 완전히 같다.
##
## **정직하게 밝혀 둔다** — "갈매기"·"게"는 웹판 js/animal.js KINDS에
## 없는, 이 슬라이스만의 새 짐승이다(사가고 퓨전 방향 메모 — 포켓몬GO
## 완전 모방은 필요 없다는 결). ox와 같은 완전 정지형(배회·도주 없음,
## 근접만으로 발견)으로 둬 새 상태기계를 만들지 않았다.

const TestMap := preload("res://games/saga_go/data/test_map.gd")
const TerrainBuilder := preload("res://games/saga_go/world/terrain_builder.gd")
const GLBUtils := preload("res://saga_core/world/glb_utils.gd")
const ChoicePrompt := preload("res://saga_core/ui/choice_prompt.gd")
const Toast := preload("res://saga_core/ui/toast.gd")
const CelShaderApply := preload("res://saga_core/shaders/cel_shader_apply.gd")
const BeaconTower := preload("res://games/saga_go/world/beacon_tower.gd")
const VegetationBuilder := preload("res://games/saga_go/world/vegetation_builder.gd")

const PLANK_GLB := "res://assets/buildings/planks.glb"

## test_map.gd REGIONS["coast"].origin과 반드시 같은 값이어야 한다(그
## 파일이 그리는 지형과 이 파일이 세우는 실체가 같은 자리에 있어야 하니) —
## 마을 격자(11x11, TILE_SIZE 48 = 528m 사방)보다 훨씬 먼 좌표라 절대
## 마을 지형과 안 겹친다(FOREST INTERIOR_ORIGIN과 같은 발상).
const REGION_ORIGIN := Vector3(480.0, 0.0, 0.0) # 106장 ⑤ 마을 동쪽에 붙임
const COAST_REGION := "coast"

## landmarks_builder.gd _add_waystation()과 같은 격자·계산 — 이 파일이
## 그쪽을 몰라도 되게(단방향 의존) 여기서 다시 구한다. 역참 좌표가 바뀌면
## 두 곳을 같이 고쳐야 한다는 게 유일한 대가(35장 "동일한 코드를 복사하지
## 않는다"의 예외로 둔 것 — 좌표 하나 재계산일 뿐 로직 복제가 아니다).
const VILLAGE_WAYSTATION_GRID := Vector2i(5, 3)
const TRAVEL_TRIGGER_RADIUS := 5.0

## test_map.gd REGIONS["coast"].rows 격자 좌표(9x9) — 물(rows 1~3)·
## 다리(4,3, 물에서 모래로 건너는 유일한 자리)·모래(rows 4~7)·산 테두리.
## 도착점은 다리에서 세 칸(144m) 남쪽, 귀환 트리거는 도착점에서 한 칸
## (48m) 더 남쪽 — TRAVEL_TRIGGER_RADIUS(5)보다 훨씬 떨어져 있어 도착
## 하자마자 되돌아가는 선택지가 다시 뜨지 않는다.
const DOCK_GRID := Vector2i(4, 3)
const ARRIVAL_GRID := Vector2i(4, 6)
const RETURN_GRID := Vector2i(4, 7)
const GULL_GRID := Vector2i(6, 4)
const FISHER_GRID := Vector2i(2, 5)
const DRIFTWOOD_GRID := Vector2i(6, 6)
const CRAB_GRID := Vector2i(2, 4)
const BOAT_GRID := Vector2i(7, 5)

## 2026-09-16, 포구 콘텐츠 확장 2호 — simple_event.gd(웹판 event.js의
## "발견/돕기" 계열)와 같은 결의 가장 가벼운 사건: 한 번뿐, 선택지 고르면
## 문구만 보여주고 끝난다. simple_event.gd를 그대로 재사용하지 않고
## 여기서 다시 짠 건 그 파일이 마을 격자(region_id 없는 TestMap)에
## 고정돼 있어서다(export grid만으로는 지역을 못 고른다) — 코드 스무 줄
## 남짓이라 복제 부담보다 새 export 하나 얹는 재설계 부담이 더 크다고
## 판단했다.
const DRIFTWOOD_ID := "coast_driftwood"
const DRIFTWOOD_TRIGGER_RADIUS := 14.0

## 2026-09-16, 포구 콘텐츠 확장 4호 — 표류물과 같은 결(simple_event.gd
## 계열, 한 번뿐)의 두 번째 사건. 산 테두리에 붙은 구석 칸(BOAT_GRID)에
## 둬 표류물·어부·게와 자리가 겹치지 않는다.
const BOAT_ID := "coast_boat"
const BOAT_TRIGGER_RADIUS := 14.0

## 2026-09-16, GO 진짜 세 번째 지역("폐허", region3_ruins.gd) — 포구의
## 갈림길 하나에 세 번째 목적지를 얹는다. region3_ruins.gd를 이 파일이
## 몰라도 되게(단방향 의존, HarborReturn과 같은 원칙) TestMap에 "ruins"
## region_id를 직접 넘겨 좌표만 계산한다. 산 테두리에 붙은 빈 모래 칸
## (RUINS_GATE_GRID)에 둬 어부·게·표류물·조각배·도착점·귀환 트리거와
## 안 겹친다.
const RUINS_REGION := "ruins"
const RUINS_GATE_GRID := Vector2i(1, 6)
## region3_ruins.gd ENTRY_GRID와 반드시 같은 값 — 그 파일 주석 참고.
const RUINS_ENTRY_GRID := Vector2i(3, 3)

## 2026-09-16, 포구 콘텐츠 확장(사용자 지시 "순서대로 이어해줘"의
## 2번째) — landmarks_builder.gd _add_cave()/_add_shrine() 계열(선택지
## 없이 근접만으로 도장 찍는 순수 장식)과 같은 결의 첫 사례. 지금까지
## 포구 발견 지점은 전부 "harbor"(도착 안전망) 하나뿐이었다 — 어부·
## 게·표류물·조각배·폐허 갈림길과 겹치지 않는 남은 구석 칸에 둔다.
const WHALEBONE_ID := "coast_whalebone"
const WHALEBONE_GRID := Vector2i(2, 7)
const WHALEBONE_DISCOVERY_RADIUS := 15.0

## 2026-09-18, PLAN 101-1 E(발견 밀도) — `test_village.gd` 워크어블 판정을
## LEGEND.walkable로 고친 뒤(강은 걸을 수 없다) 다시 재니 포구가 61.2%
## →41.4%로 이미 줄었지만 여전히 10% 기준을 넘는다. 격자를 손으로 짚어
## (density_report.gd의 60m 고정 반경 기준) 지금 안 닿는 자리 셋에 순수
## 발견 셋을 더 얹는다 — whalebone과 같은 결. "닻"은 다리(DOCK_GRID)
## 옆이라 배가 오가던 자리라는 결이 자연스럽고, 그물더미·조개무지는
## 어부·게와 이미 있는 "바닷가 잡동사니" 결을 그대로 늘린 것뿐이다.
const BEACH_DEBRIS := [
	{"id": "coast_anchor", "grid": Vector2i(4, 4), "shape": "anchor"},
	{"id": "coast_netpile", "grid": Vector2i(6, 6), "shape": "netpile"},
	{"id": "coast_shellmidden", "grid": Vector2i(1, 6), "shape": "shellmidden"},
	## 2026-09-20, PLAN 101-1 E 재점검(09-18 이후 처음 재측정) — 여전히
	## 17.2%(다섯 칸)라 위와 같은 결로 다섯을 더 얹는다. boat(7,5)는 event
	## kind라 이 밀도(place 전용)에 안 잡힌다 — 같은 칸에 place 하나(게딱지)
	## 더해도 결이 다르니 안 겹친다.
	{"id": "coast_firepit", "grid": Vector2i(3, 5), "shape": "firepit"},
	{"id": "coast_mast", "grid": Vector2i(5, 5), "shape": "mast"},
	{"id": "coast_crabshell", "grid": Vector2i(7, 5), "shape": "crabshell"},
	{"id": "coast_sandcastle", "grid": Vector2i(5, 7), "shape": "sandcastle"},
	{"id": "coast_tidepool", "grid": Vector2i(7, 7), "shape": "tidepool"},
]
const BEACH_DEBRIS_TRIGGER_RADIUS := 15.0

## 포구 콘텐츠 확장(2026-09-16, "GO 포구 콘텐츠 확장") — npc_builder.gd
## VILLAGERS의 상인(offer_a/b 한 번뿐인 제안) 패턴을 그대로 옮긴다.
## npc_builder.gd를 직접 의존하지 않고 이 파일 안에서 다시 짠 것은 위
## _add_discovery_area()와 같은 판단(단방향 의존, 코드 몇 줄 복제 수준).
## 캐릭터 글자는 이 판에 있는 넷(a~d) 중 a=플레이어·c=마을 상인이 이미
## 쓰고, d=도적(bandit_encounter.gd, 적대 조우)이라 우호적 NPC로 다시
## 쓰면 헷갈린다 — 마을 촌장과 같은 b를 재사용한다(마을·포구가 텔레포트로만
## 오가 화면에 동시에 안 보이니 겹쳐도 무해하다).
const FISHER_ID := "npc_fisher"
const FISHER_NAME := "늙은 어부"
const FISHER_GLB := "res://assets/characters/character-b.glb"
const VroidBody := preload("res://saga_core/world/vroid_body.gd")
const FISHER_TALK_RADIUS := 14.0
const FISHER_TALK_GAP_SEC := 45.0
const FISHER_LINE := "그물은 무겁지만 바다는 정직하지."
const FISHER_OFFER_EVENT_ID := "offer_npc_fisher"
## 105 Q-h 결정(c, 2026-09-19) — 1.7m 표준, npc_builder.gd와 같은 값.
const NPC_CHAR_SCALE := 0.625
const LINE_SHOW_SEC := 4.0

var _village_layer: CanvasLayer
var _village_triggered := false
var _harbor_layer: CanvasLayer
var _harbor_triggered := false
var _ruins_layer: CanvasLayer
var _ruins_triggered := false
var _fisher_last_said_ms := -1000000


func _ready() -> void:
	_build_departure_trigger()
	_build_harbor()
	_build_beacon()


## PLAN.md 101-2 GO ⑤"봉수대" — 포구 몫. 기존 콘텐츠(어부·표류물·조각배
## 등)와 안 겹치는 구석(7,7).
func _build_beacon() -> void:
	var tower := BeaconTower.new()
	tower.name = "BeaconTower_coast"
	tower.region_id = COAST_REGION
	tower.grid = Vector2i(7, 7)
	tower.region_label = "포구"
	add_child(tower)


## === 마을 쪽 — 역참에 실제 기능을 단다 ===

func _build_departure_trigger() -> void:
	var ground: float = TerrainBuilder.LEGEND["="].height
	var pos := TestMap.world_pos(VILLAGE_WAYSTATION_GRID.x, VILLAGE_WAYSTATION_GRID.y) + Vector3(0, ground, 0)
	var area := Area3D.new()
	area.name = "WaystationTravel"
	var cs := CollisionShape3D.new()
	var shape := SphereShape3D.new()
	shape.radius = TRAVEL_TRIGGER_RADIUS
	cs.shape = shape
	area.add_child(cs)
	area.position = pos
	add_child(area)
	area.body_entered.connect(_on_village_entered)


func _on_village_entered(body: Node3D) -> void:
	if _village_triggered or not body.is_in_group("player"):
		return
	_village_triggered = true
	var choices: Array = [
		{"label": "🚢 먼 포구로 길을 나선다", "cb": func() -> void: _travel_to_harbor(body)},
		{"label": "그만둔다", "cb": _close_village_prompt},
	]
	_village_layer = ChoicePrompt.build(self, "역참 — 여기서 먼 포구로 통하는 길이 있다.", choices)


func _close_village_prompt() -> void:
	if _village_layer:
		_village_layer.queue_free()
	_village_triggered = false


func _travel_to_harbor(player: Node3D) -> void:
	if _village_layer:
		_village_layer.queue_free()
	var ground: float = TerrainBuilder.LEGEND["D"].height
	(player as Node3D).global_position = TestMap.world_pos(ARRIVAL_GRID.x, ARRIVAL_GRID.y, COAST_REGION) + Vector3(0, ground + 1.0, 0)
	CodexState.discover("place", "harbor")
	Toast.show(self, "먼 포구에 닿았다.", 2.5)
	_village_triggered = false


## === 포구(두 번째 지역, 진짜 타일맵) ===

func _build_harbor() -> void:
	var terrain := Node3D.new()
	terrain.set_script(TerrainBuilder)
	terrain.name = "CoastTerrain"
	terrain.set("region_id", COAST_REGION)
	add_child(terrain)
	## 103-3 스냅(2026-09-19) — 이 지도엔 T(숲) 칸이 없어(REGIONS["coast"]
	## 참고) 나무는 안 서고, ^(산) 테두리 32칸에 go_coast 팔레트 변형
	## 바위만 선다(vegetation_builder.gd REGION_ROCK_*_GLB).
	var vegetation := Node3D.new()
	vegetation.set_script(VegetationBuilder)
	vegetation.name = "CoastVegetation"
	vegetation.set("region_id", COAST_REGION)
	add_child(vegetation)
	_build_dock()
	_build_gull()
	_build_crab()
	_build_fisherman()
	_build_driftwood()
	_build_boat()
	_build_ruins_gate()
	_build_whalebone()
	_build_beach_debris()
	_build_return_trigger()


## landmarks_builder.gd _add_bridge()와 완전히 같은 방식(35장) — 물에서
## 모래로 건너는 유일한 자리(DOCK_GRID, "B" 타일)에 널판을 얹는다. 충돌은
## terrain_builder.gd의 "B" 타일이 이미 같은 높이(BRIDGE_CLEARANCE)에
## 놓아 두므로 여기서 따로 만들지 않는다.
func _build_dock() -> void:
	var bed: float = TerrainBuilder.LEGEND["B"].height
	var dock_length := 44.0   # landmarks_builder.gd _add_bridge()와 같은 값(칸 하나, 48m)
	var dock_width := 4.0
	var base_pos := TestMap.world_pos(DOCK_GRID.x, DOCK_GRID.y, COAST_REGION) + Vector3(0, bed + TerrainBuilder.BRIDGE_CLEARANCE, 0)

	var plank_mesh := GLBUtils.extract_mesh(PLANK_GLB)
	if plank_mesh == null:
		var plank := MeshInstance3D.new()
		var box := BoxMesh.new()
		box.size = Vector3(dock_width, 0.4, dock_length)
		plank.mesh = box
		var mat := StandardMaterial3D.new()
		mat.albedo_color = Color(0.42, 0.3, 0.18)
		plank.material_override = mat
		plank.position = base_pos
		add_child(plank)
	else:
		var plank_count := int(ceil(dock_length))
		var mm := MultiMesh.new()
		mm.transform_format = MultiMesh.TRANSFORM_3D
		mm.mesh = plank_mesh
		mm.instance_count = plank_count
		var start_z := -dock_length * 0.5 + 0.5
		for i in plank_count:
			var basis := Basis().scaled(Vector3(dock_width, 2.0, 1.02))
			var pos := base_pos + Vector3(0, 0, start_z + i)
			mm.set_instance_transform(i, Transform3D(basis, pos))
		var mmi := MultiMeshInstance3D.new()
		mmi.multimesh = mm
		mmi.name = "Dock"
		add_child(mmi)

	## ARRIVAL_GRID(모래 마당 한복판)를 중심으로 넉넉히 잡는다 — 어차피
	## `_travel_to_harbor()`가 도착 즉시 discover()를 부르니 이 영역은
	## 걸어서 왔을 때를 위한 안전망이다(중복 호출은 discover()가 알아서 막는다).
	_add_discovery_area("harbor", TestMap.world_pos(ARRIVAL_GRID.x, ARRIVAL_GRID.y, COAST_REGION), 90.0)


## animal_builder.gd OX_HOMES와 같은 완전 정지형(act:null) — 배회·도주가
## 없어 근접만으로 발견을 찍는다(그 파일 헤더의 소 항목과 같은 경계).
## 물가에 붙은 모래 칸(GULL_GRID)에 세운다 — 물 위가 아니라 물가에 서
## 있는 새라는 그림.
func _build_gull() -> void:
	var ground: float = TerrainBuilder.LEGEND["D"].height
	var pos := TestMap.world_pos(GULL_GRID.x, GULL_GRID.y, COAST_REGION) + Vector3(0, ground + 0.6, 0)
	var mi := MeshInstance3D.new()
	var mesh := SphereMesh.new()
	mesh.radius = 0.35
	mesh.height = 0.7
	mi.mesh = mesh
	mi.position = pos
	var mat := StandardMaterial3D.new()
	mat.albedo_color = Color(0.92, 0.92, 0.9)
	mi.material_override = mat
	add_child(mi)
	_add_discovery_area("gull", pos, 15.0, "beast")


## 포구 콘텐츠 확장(2026-09-16, "포구 콘텐츠 더 채우기") — 갈매기와
## 같은 결의 여섯째 짐승. 웹판 js/animal.js에도 없는 이 슬라이스만의
## 새 종이라는 걸 정직하게 밝혀 둔다(사가고 퓨전 방향 메모 참고).
## 갈매기와 자리를 겹치지 않는 모래 칸(CRAB_GRID)에 완전 정지형으로
## 세운다 — 새 상태기계를 만들지 않는다.
func _build_crab() -> void:
	var ground: float = TerrainBuilder.LEGEND["D"].height
	var pos := TestMap.world_pos(CRAB_GRID.x, CRAB_GRID.y, COAST_REGION) + Vector3(0, ground + 0.15, 0)
	var mi := MeshInstance3D.new()
	var mesh := BoxMesh.new()
	mesh.size = Vector3(0.55, 0.25, 0.4)
	mi.mesh = mesh
	mi.position = pos
	var mat := StandardMaterial3D.new()
	mat.albedo_color = Color(0.75, 0.22, 0.14)
	mi.material_override = mat
	add_child(mi)
	_add_discovery_area("crab", pos, 15.0, "beast")


## landmarks_builder.gd _add_cave()/_add_shrine()과 같은 결 — 선택지 없이
## 근접만으로 도장 찍는 순수 장식(primitive, 구부러진 흰 뼈 두 조각).
func _build_whalebone() -> void:
	var ground: float = TerrainBuilder.LEGEND["D"].height
	var pos := TestMap.world_pos(WHALEBONE_GRID.x, WHALEBONE_GRID.y, COAST_REGION) + Vector3(0, ground, 0)

	for i in 2:
		var mi := MeshInstance3D.new()
		var mesh := CapsuleMesh.new()
		mesh.radius = 0.18
		mesh.height = 2.2
		mi.mesh = mesh
		mi.rotation = Vector3(0, 0, deg_to_rad(60.0 if i == 0 else -60.0))
		mi.position = pos + Vector3(-0.4 if i == 0 else 0.4, 0.5, 0)
		var mat := StandardMaterial3D.new()
		mat.albedo_color = Color(0.88, 0.86, 0.8)
		mi.material_override = mat
		add_child(mi)

	_add_discovery_area(WHALEBONE_ID, pos, WHALEBONE_DISCOVERY_RADIUS)


## region3_ruins.gd _build_debris()와 같은 결(다른 모양 primitive 여러 개
## + 선택지 없는 순수 발견 하나씩) — PLAN 101-1 E, BEACH_DEBRIS 참고.
func _build_beach_debris() -> void:
	var ground: float = TerrainBuilder.LEGEND["D"].height
	for d in BEACH_DEBRIS:
		var pos := TestMap.world_pos(d.grid.x, d.grid.y, COAST_REGION) + Vector3(0, ground, 0)
		var mi := MeshInstance3D.new()
		match d.shape:
			"anchor":
				var mesh := PrismMesh.new()
				mesh.size = Vector3(0.15, 1.1, 0.6)
				mi.mesh = mesh
				mi.rotation = Vector3(deg_to_rad(90.0), 0, 0)
				mi.position = pos + Vector3(0, 0.15, 0)
			"netpile":
				var mesh := SphereMesh.new()
				mesh.radius = 0.55
				mesh.height = 0.5
				mi.mesh = mesh
				mi.position = pos + Vector3(0, 0.2, 0)
			"shellmidden":
				var mesh := BoxMesh.new()
				mesh.size = Vector3(0.9, 0.3, 0.9)
				mi.mesh = mesh
				mi.position = pos + Vector3(0, 0.15, 0)
			"firepit":
				var mesh := CylinderMesh.new()
				mesh.top_radius = 0.6
				mesh.bottom_radius = 0.7
				mesh.height = 0.2
				mi.mesh = mesh
				mi.position = pos + Vector3(0, 0.1, 0)
			"mast":
				var mesh := BoxMesh.new()
				mesh.size = Vector3(0.22, 0.22, 2.6)
				mi.mesh = mesh
				mi.rotation = Vector3(0, 0, deg_to_rad(72.0))
				mi.position = pos + Vector3(0, 0.4, 0)
			"crabshell":
				var mesh := BoxMesh.new()
				mesh.size = Vector3(0.4, 0.12, 0.32)
				mi.mesh = mesh
				mi.position = pos + Vector3(0, 0.06, 0)
			"sandcastle":
				var mesh := PrismMesh.new()
				mesh.size = Vector3(0.7, 0.6, 0.7)
				mi.mesh = mesh
				mi.position = pos + Vector3(0, 0.3, 0)
			"tidepool":
				var mesh := CylinderMesh.new()
				mesh.top_radius = 0.85
				mesh.bottom_radius = 0.85
				mesh.height = 0.06
				mi.mesh = mesh
				mi.position = pos + Vector3(0, 0.03, 0)
		var mat := StandardMaterial3D.new()
		mat.albedo_color = Color(0.25, 0.45, 0.62, 0.72) if d.shape == "tidepool" else (Color(0.35, 0.28, 0.2) if d.shape == "firepit" else Color(0.62, 0.56, 0.42))
		if d.shape == "tidepool":
			mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
		mi.material_override = mat
		add_child(mi)
		_add_discovery_area(d.id, pos, BEACH_DEBRIS_TRIGGER_RADIUS)


## npc_builder.gd _spawn()/_build_body()와 같은 골격 — 대화만 하는 주민
## 하나(사명 없음, 상인처럼 한 번뿐인 제안만 있다).
func _build_fisherman() -> void:
	var ground: float = TerrainBuilder.LEGEND["D"].height
	var root := Node3D.new()
	root.name = "Fisherman"
	root.position = TestMap.world_pos(FISHER_GRID.x, FISHER_GRID.y, COAST_REGION) + Vector3(0, ground, 0)
	add_child(root)

	var body := _build_fisher_body()
	root.add_child(body)
	if not body.has_meta("cel_applied"):
		CelShaderApply.apply_to(body)

	var area := Area3D.new()
	area.name = "FisherTalk"
	var cs := CollisionShape3D.new()
	var shape := SphereShape3D.new()
	shape.radius = FISHER_TALK_RADIUS
	cs.shape = shape
	area.add_child(cs)
	root.add_child(area)
	area.body_entered.connect(_on_fisher_entered)


func _build_fisher_body() -> Node3D:
	## PLAN 106장 ④ — Kenney 블록 → VRoid 몸(바다색 옷).
	if ResourceLoader.exists(VroidBody.BODIES[0].glb):
		return VroidBody.build("coast_fisher", 2, Color(0.45, 0.6, 0.75))
	var scene: PackedScene = load(FISHER_GLB)
	if scene != null:
		var inst := scene.instantiate()
		inst.scale = Vector3.ONE * NPC_CHAR_SCALE
		return inst

	var body := MeshInstance3D.new()
	var mesh := CapsuleMesh.new()
	mesh.radius = 0.45
	mesh.height = 1.7
	body.mesh = mesh
	body.position = Vector3(0, 0.85, 0)
	return body


## npc_builder.gd _on_body_entered()의 상인 갈래(offer_title 있고
## quest_id 없음)와 같은 흐름 — 처음엔 제안, 그 뒤론 한 줄(대화 간격은
## 그대로 45초).
func _on_fisher_entered(body: Node3D) -> void:
	if not body.is_in_group("player"):
		return
	CodexState.discover("people", FISHER_ID)
	var now := Time.get_ticks_msec()
	if now - _fisher_last_said_ms < FISHER_TALK_GAP_SEC * 1000.0:
		return
	_fisher_last_said_ms = now

	if not EventState.is_resolved(FISHER_OFFER_EVENT_ID):
		CodexState.discover("event", FISHER_OFFER_EVENT_ID)
		_show_fisher_offer()
		return
	Toast.show(self, "%s — %s" % [FISHER_NAME, FISHER_LINE], LINE_SHOW_SEC)


## npc_builder.gd _show_offer_prompt()가 원래 쓰던 "선언 후 대입"(var
## layer; layer = ChoicePrompt.build(...)) 방식은 배열 리터럴(콜백 포함)
## 쪽이 대입보다 먼저 평가돼, 클로저가 GDScript 람다 특유의 "생성 시점
## 값 스냅샷" 캡처 규칙 때문에 항상 null이던 layer를 붙잡는다 — 이 함수를
## 임시 검증 씬으로 직접 실측해 버튼을 눌러 보고 발견(`layer.queue_free()`
## 가 null 위에서 터짐, npc_builder.gd에도 같은 버그가 있어 같이 고쳤다).
## realm_attack_button.gd 등이 이미 쓰던 `layer_box := {}` 관용구로
## 맞춘다 — Dictionary는 참조 타입이라 값으로 캡처돼도 나중에 채운
## 내용이 클로저 쪽에도 그대로 보인다.
func _show_fisher_offer() -> void:
	var layer_box := {}
	layer_box["layer"] = ChoicePrompt.build(self, "🎣 늙은 어부\n\"그물이 무거워 혼자는 힘에 부치는구먼. 함께 당겨 주겠나?\"", [
		{"label": "그물을 함께 당긴다", "cb": func() -> void: _resolve_fisher_offer(layer_box, "그물 가득한 물고기에 힘을 보탰다.", 10.0)},
		{"label": "구경만 한다", "cb": func() -> void: _resolve_fisher_offer(layer_box, "어부가 홀로 그물을 마저 당겼다.", 0.0)},
	])


func _resolve_fisher_offer(layer_box: Dictionary, text: String, exp_reward: float) -> void:
	(layer_box["layer"] as CanvasLayer).queue_free()
	if exp_reward > 0.0:
		PartyState.add_exp(exp_reward)
		text += " (경험 +%d)" % int(exp_reward)
	Toast.show(self, text, LINE_SHOW_SEC)
	EventState.mark_resolved(FISHER_OFFER_EVENT_ID)


## simple_event.gd 계열의 가장 가벼운 사건 — 트리거 근처에 primitive
## 상자 하나(GLB 없음, 다른 판 primitive 임시 교체와 같은 결). 한 번뿐:
## 이미 해결된 뒤엔 body_entered가 다시 와도 아무 것도 안 뜬다.
func _build_driftwood() -> void:
	var ground: float = TerrainBuilder.LEGEND["D"].height
	var pos := TestMap.world_pos(DRIFTWOOD_GRID.x, DRIFTWOOD_GRID.y, COAST_REGION) + Vector3(0, ground, 0)

	var mi := MeshInstance3D.new()
	var mesh := BoxMesh.new()
	mesh.size = Vector3(1.4, 0.9, 1.0)
	mi.position = pos + Vector3(0, 0.45, 0)
	mi.mesh = mesh
	var mat := StandardMaterial3D.new()
	mat.albedo_color = Color(0.42, 0.3, 0.18)
	mi.material_override = mat
	add_child(mi)

	var area := Area3D.new()
	area.name = "Driftwood"
	var cs := CollisionShape3D.new()
	var shape := SphereShape3D.new()
	shape.radius = DRIFTWOOD_TRIGGER_RADIUS
	cs.shape = shape
	area.add_child(cs)
	area.position = pos
	add_child(area)
	area.body_entered.connect(_on_driftwood_entered)


func _on_driftwood_entered(body: Node3D) -> void:
	if not body.is_in_group("player") or EventState.is_resolved(DRIFTWOOD_ID):
		return
	CodexState.discover("event", DRIFTWOOD_ID)
	_show_driftwood_prompt()


func _show_driftwood_prompt() -> void:
	var layer_box := {}
	layer_box["layer"] = ChoicePrompt.build(self, "🪵 표류물\n파도에 밀려온 나무 상자 하나가 모래에 반쯤 묻혀 있다.", [
		{"label": "상자를 연다", "cb": func() -> void: _resolve_driftwood(layer_box, "방수포에 싸인 여행 물자가 조금 나왔다.", 15.0)},
		{"label": "그냥 둔다", "cb": func() -> void: _resolve_driftwood(layer_box, "괜히 손대고 싶지 않아 그대로 두었다.", 0.0)},
	])


func _resolve_driftwood(layer_box: Dictionary, text: String, exp_reward: float) -> void:
	(layer_box["layer"] as CanvasLayer).queue_free()
	if exp_reward > 0.0:
		PartyState.add_exp(exp_reward)
		text += " (경험 +%d)" % int(exp_reward)
	Toast.show(self, text, LINE_SHOW_SEC)
	EventState.mark_resolved(DRIFTWOOD_ID)


## 표류물과 완전히 같은 결의 두 번째 사건 — 뒤집힌 조각배 하나(primitive,
## 표류물과 다른 크기·색으로 구분). 한 번뿐, 이미 해결된 뒤엔 다시 안 뜬다.
func _build_boat() -> void:
	var ground: float = TerrainBuilder.LEGEND["D"].height
	var pos := TestMap.world_pos(BOAT_GRID.x, BOAT_GRID.y, COAST_REGION) + Vector3(0, ground, 0)

	var mi := MeshInstance3D.new()
	var mesh := BoxMesh.new()
	mesh.size = Vector3(2.6, 0.7, 1.2)
	mi.position = pos + Vector3(0, 0.35, 0)
	mi.mesh = mesh
	var mat := StandardMaterial3D.new()
	mat.albedo_color = Color(0.55, 0.5, 0.42)
	mi.material_override = mat
	add_child(mi)

	var area := Area3D.new()
	area.name = "Boat"
	var cs := CollisionShape3D.new()
	var shape := SphereShape3D.new()
	shape.radius = BOAT_TRIGGER_RADIUS
	cs.shape = shape
	area.add_child(cs)
	area.position = pos
	add_child(area)
	area.body_entered.connect(_on_boat_entered)


func _on_boat_entered(body: Node3D) -> void:
	if not body.is_in_group("player") or EventState.is_resolved(BOAT_ID):
		return
	CodexState.discover("event", BOAT_ID)
	_show_boat_prompt()


func _show_boat_prompt() -> void:
	var layer_box := {}
	layer_box["layer"] = ChoicePrompt.build(self, "🛶 뒤집힌 조각배\n모래에 반쯤 파묻힌 낡은 배 한 척이 뒤집혀 있다.", [
		{"label": "배를 뒤집어 본다", "cb": func() -> void: _resolve_boat(layer_box, "밑에 깔려 있던 낡은 그물 조각을 챙겼다.", 15.0)},
		{"label": "그냥 둔다", "cb": func() -> void: _resolve_boat(layer_box, "굳이 손대지 않고 지나쳤다.", 0.0)},
	])


func _resolve_boat(layer_box: Dictionary, text: String, exp_reward: float) -> void:
	(layer_box["layer"] as CanvasLayer).queue_free()
	if exp_reward > 0.0:
		PartyState.add_exp(exp_reward)
		text += " (경험 +%d)" % int(exp_reward)
	Toast.show(self, text, LINE_SHOW_SEC)
	EventState.mark_resolved(BOAT_ID)


## 포구 안의 세 번째 갈림길 — 마을행 HarborReturn과 자리도 트리거도
## 완전히 분리된 별도 지점(같은 곳에 선택지를 얹지 않는다, 두 행선지가
## 헷갈리지 않게).
func _build_ruins_gate() -> void:
	var ground: float = TerrainBuilder.LEGEND["D"].height
	var pos := TestMap.world_pos(RUINS_GATE_GRID.x, RUINS_GATE_GRID.y, COAST_REGION) + Vector3(0, ground, 0)
	var area := Area3D.new()
	area.name = "RuinsGate"
	var cs := CollisionShape3D.new()
	var shape := SphereShape3D.new()
	shape.radius = TRAVEL_TRIGGER_RADIUS
	cs.shape = shape
	area.add_child(cs)
	area.position = pos
	add_child(area)
	area.body_entered.connect(_on_ruins_gate_entered)


func _on_ruins_gate_entered(body: Node3D) -> void:
	if _ruins_triggered or not body.is_in_group("player"):
		return
	_ruins_triggered = true
	var choices: Array = [
		{"label": "🏛️ 산 너머 폐허로 들어간다", "cb": func() -> void: _travel_to_ruins(body)},
		{"label": "그만둔다", "cb": _close_ruins_prompt},
	]
	_ruins_layer = ChoicePrompt.build(self, "낡은 길목 — 산 너머 폐허로 이어지는 좁은 길이 있다.", choices)


func _close_ruins_prompt() -> void:
	if _ruins_layer:
		_ruins_layer.queue_free()
	_ruins_triggered = false


func _travel_to_ruins(player: Node3D) -> void:
	if _ruins_layer:
		_ruins_layer.queue_free()
	var ground: float = TerrainBuilder.LEGEND["R"].height
	(player as Node3D).global_position = TestMap.world_pos(RUINS_ENTRY_GRID.x, RUINS_ENTRY_GRID.y, RUINS_REGION) + Vector3(0, ground + 1.0, 0)
	## id "ruins_far" — region3_ruins.gd _build_entry_discovery() 주석
	## 참고(마을 폐허의 codex id "ruins"와 겹치면 안 된다).
	CodexState.discover("place", "ruins_far")
	Toast.show(self, "폐허에 발을 들였다.", 2.5)
	_ruins_triggered = false


func _build_return_trigger() -> void:
	var ground: float = TerrainBuilder.LEGEND["D"].height
	var pos := TestMap.world_pos(RETURN_GRID.x, RETURN_GRID.y, COAST_REGION) + Vector3(0, ground, 0)
	var area := Area3D.new()
	area.name = "HarborReturn"
	var cs := CollisionShape3D.new()
	var shape := SphereShape3D.new()
	shape.radius = TRAVEL_TRIGGER_RADIUS
	cs.shape = shape
	area.add_child(cs)
	area.position = pos
	add_child(area)
	area.body_entered.connect(_on_harbor_entered)


func _on_harbor_entered(body: Node3D) -> void:
	if _harbor_triggered or not body.is_in_group("player"):
		return
	_harbor_triggered = true
	var choices: Array = [
		{"label": "🏘️ 마을로 돌아간다", "cb": func() -> void: _travel_to_village(body)},
		{"label": "그만둔다", "cb": _close_harbor_prompt},
	]
	_harbor_layer = ChoicePrompt.build(self, "포구 — 여기서 마을로 돌아가는 길이 있다.", choices)


func _close_harbor_prompt() -> void:
	if _harbor_layer:
		_harbor_layer.queue_free()
	_harbor_triggered = false


func _travel_to_village(player: Node3D) -> void:
	if _harbor_layer:
		_harbor_layer.queue_free()
	var ground: float = TerrainBuilder.LEGEND["="].height
	var pos := TestMap.world_pos(VILLAGE_WAYSTATION_GRID.x, VILLAGE_WAYSTATION_GRID.y) + Vector3(0, ground, 0)
	(player as Node3D).global_position = pos + Vector3(0, 1.0, -12.0)
	Toast.show(self, "마을로 돌아왔다.", 2.5)
	_harbor_triggered = false


## landmarks_builder.gd _add_discovery_area()와 같은 계약(가까이 오면
## kind 하나를 도장 찍는다, 중복은 CodexState.discover()가 알아서
## 막는다) — 그 파일을 몰라도 되게 여기서 다시 구현한다(코드 세 줄
## 수준이라 복제 부담이 code_review 수준의 문제가 아니라고 판단).
func _add_discovery_area(codex_id: String, pos: Vector3, radius: float, kind: String = "place") -> void:
	var area := Area3D.new()
	area.name = "Discover_" + codex_id
	var cs := CollisionShape3D.new()
	var shape := SphereShape3D.new()
	shape.radius = radius
	cs.shape = shape
	area.add_child(cs)
	area.position = pos
	area.add_to_group("codex_discoverable")
	add_child(area)
	area.body_entered.connect(func(body: Node3D) -> void:
		if body.is_in_group("player"):
			CodexState.discover(kind, codex_id))
