extends Node3D

## PLAN 106장 ㊿ — 일곱째 지역 "잠긴 도읍"(REGIONS["sunken"], test_map.gd). 이야기 6부의 무대.
## 틈이 닫히며(20장) 갯바람 포구 남쪽 바다에 굳은 시대 조각 — 물에 잠긴 옛 도읍이 드러났다.
## 포구 (1,8) 모래 고개가 이 지역 (1,0) 과 맞닿는다. 5부를 마치기 전(ch < 20)엔 고개에 짙은 해무(흰 막, 충돌)가 서서 못 지나간다.
## 바다는 강과 같은 물(바닥 −3, 헤엄) — 잠수는 없다. 그래서 도읍은 "얕게 잠겨 지붕·기단이 물 위로 드러난" 모양이고,
## 물을 밀어낸 빛 돔 안만 마른 바닥(U, −10)이다. 헤엄쳐 올라설 수 있게 물 위 턱은 모두 +0.75 이하(go_player 헤엄 넘어오르기 2.45m).
## 이 파일이 짓는 것: 지형·식생(TerrainBuilder·VegetationBuilder region_id 인스턴스) · 고정 명소 넷 · 고개 경계비·해무 문 · 디딤 지붕 · 발견 지점.
## 순간이동 지점·들판 무리·상자·별조각·채집·탐사지는 각 표(waypoints·field_spawner·treasure_spawner·star_shards·cooking·dispatch)에 "sunken" 줄로.
##   과거 — 잠긴 궁궐(PALACE_CELL): 물 위로 드러난 기단(+0.25)·기운 정전·기와 지붕(올라설 수 있다) + 모래밭에서 이어지는 돌다리
##   현대 — 해저 연구 기지·잠수정 선착장(BASE_CELL): 모래밭 끝 갑판·컨테이너·안테나·기지로 내려가는 통로 + 빛 돔까지 잔교 · 잔교 옆 선착장에 노란 잠수정
##   미래 — 빛 돔(DOME_CELL): 물을 밀어낸 둥근 받침(안 반지름 22·바깥 34, 윗면 +0.5) 위 유리 반구, 안은 마른 −10 바닥·경사로·기록실.
##     북쪽 문은 22장을 마치기 전(ch < DOME_OPEN_CH) 잠겨 있다(빛 막 + 충돌).
##   과거·미래 — 옛 등대(LIGHT_CELL, K 바위섬): 15m 돌탑(벽 타기)·난간 판·빛 등롱 — 23장을 마치면(ch ≥ LIGHT_ON_CH) 불이 켜지고 빛줄기가 돈다
##   고개 경계비((1.35,0.65)) · 디딤 지붕 셋(궁궐 곁채·물에 잠긴 대문·석탑 꼭대기)

const TestMap := preload("res://games/saga_go/data/test_map.gd")
const TerrainBuilder := preload("res://games/saga_go/world/terrain_builder.gd")
const VegetationBuilder := preload("res://games/saga_go/world/vegetation_builder.gd")

const REGION := "sunken"
const DISCOVER_R := 30.0

## [codex id, 칸(소수), 반지름] — CodexState "place"(codex_state.gd TOTAL 에 더함).
const DISCOVERIES := [
	["sunken_region", Vector2(4.0, 4.0), 60.0],
	["sunken_pass", Vector2(1.0, 0.6), DISCOVER_R],
	["sunken_palace", Vector2(2.3, 5.0), DISCOVER_R],
	["sunken_base", Vector2(6.5, 3.3), DISCOVER_R],
	["sunken_dome", Vector2(5.0, 6.0), DISCOVER_R],
	["sunken_light", Vector2(7.0, 7.0), DISCOVER_R],
]
## 작은 발견(선택지 없는 순수 발견). [codex id, 칸, 모양] — 물 칸의 떠 있는 것(FLOAT_SHAPES)은 수면 높이에.
const SMALL := [
	["sunken_tewak", Vector2(2.0, 1.3), "tewak"],     # 과거 — 해녀 테왁(주황 뒤웅박 부표)과 망사리
	["sunken_helmet", Vector2(4.6, 1.4), "helmet"],   # 현대 — 모래에 박힌 구리 잠수 투구
	["sunken_crates", Vector2(7.4, 2.2), "crates"],   # 현대 — 기지 보급 상자
	["sunken_pearl", Vector2(3.4, 2.7), "pearl"],     # 자연 — 입 벌린 큰 진주조개
	["sunken_buoy", Vector2(4.1, 3.7), "buoy"],       # 현대 — 기지 신호 부표
	["sunken_turtle", Vector2(1.2, 4.2), "turtle"],   # 과거 — 물 위로 비석만 내민 돌거북
	["sunken_plaque", Vector2(1.6, 6.7), "plaque"],   # 과거 — 떠 있는 궁궐 편액
	["sunken_haetae", Vector2(3.9, 7.2), "haetae"],   # 과거 — 산호 덮인 해태상 머리
	["sunken_jelly", Vector2(6.2, 4.6), "jelly"],     # 미래 — 빛 해파리 떼
	["sunken_drone", Vector2(6.9, 5.6), "drone"],     # 미래 — 멈춘 수중 드론
]
const SMALL_R := 14.0
const FLOAT_SHAPES := ["buoy", "plaque", "jelly", "drone"]

const PALACE_CELL := Vector2(2.3, 5.0)
const BASE_CELL := Vector2(6.5, 3.3)
const DOME_CELL := Vector2(5.0, 6.0)
const LIGHT_CELL := Vector2(7.0, 7.0)
const PASS_STONE_CELL := Vector2(1.35, 0.65)
## 돌다리 — 모래밭 (2,3) 남쪽 끝에서 궁궐 기단 북쪽 변까지.
const CAUSEWAY_FROM := Vector2(2.05, 3.35)
const CAUSEWAY_TO := Vector2(2.2, 4.86)
## 디딤 지붕 [칸, 윗면 높이, 모양] — 헤엄치다 올라서 쉬는 자리(궁궐 → 돔, 돔 → 등대).
const STEPS := [
	[Vector2(3.5, 5.45), 0.45, "roof"],   # 궁궐 곁채 지붕
	[Vector2(1.3, 6.3), 0.5, "gate"],     # 물에 잠긴 대문 지붕
	[Vector2(6.2, 6.6), 0.55, "pagoda"],  # 석탑 꼭대기
]
## 해무 문 — 이 지역 (1,0) 고개 칸 북쪽 변(y −0.5 = 포구 (1,8) 남쪽 변, 월드 z 192). 5부를 마치면(ch ≥ 20) 걷힌다.
const GATE_CELL := Vector2(1.0, -0.5)
const GATE_OPEN_CH := 20
## 빛 돔 문 — 22장(인덱스 21)을 마치면 열린다. 등대 — 23장(인덱스 22)을 마치면 켜진다.
const DOME_OPEN_CH := 22
const LIGHT_ON_CH := 23

## 물 위 걷는 판(갑판·잔교·돔 받침) 윗면 — 헤엄쳐 넘어오를 수 있는 높이(수면 −0.45 + 0.95).
const DECK_Y := 0.5
const TERRACE_Y := 0.25
const SEABED := -3.0
const RING_IN := 22.0
const RING_OUT := 34.0
const RING_SEG := 48
const GLASS_LAT := 10
const GLASS_LON := 32
const DOOR_K := 24 # 북쪽(−z) 경도 칸
const DOOR_LAT := 2 # 문 높이 = 위도 칸 둘(약 6.8m)
## 돔 안 경사로 — 문 안 층계참(z −17)에서 남쪽 z RAMP_END_Z 까지 10.5m 를 내려간다(1m 에 0.48m, 약 25°).
const RAMP_END_Z := 5.0
const LIGHT_H := 15.0
const LIGHT_R := 2.3

const STONE := Color(0.56, 0.57, 0.55)
const STONE_DARK := Color(0.36, 0.38, 0.4)
const MOSS := Color(0.3, 0.42, 0.34)
const PILLAR := Color(0.62, 0.2, 0.15)
const ROOF := Color(0.22, 0.26, 0.3)
const STEEL := Color(0.7, 0.72, 0.74)
const STEEL_DARK := Color(0.3, 0.33, 0.36)
const HAZARD := Color(0.95, 0.72, 0.12)
const ALLOY := Color(0.84, 0.9, 0.94)
const GLOW := Color(0.45, 0.9, 1.0)
const MIST := Color(0.86, 0.92, 0.95)
const WOOD := Color(0.42, 0.28, 0.16)

var _gate_body: StaticBody3D = null
var _gate_veil: Node3D = null
var _gate_open := false
var _door_body: StaticBody3D = null
var _door_veil: Node3D = null
var _dome_open := false
var _lamp_mat: StandardMaterial3D = null
var _beam: Node3D = null
var _light_on := false
var _floaters: Array = [] # [node, base_y, phase] — 물 위에 뜬 것들이 느리게 오르내린다(충돌 없는 것만)
var _t := 0.0
var _check_t := 0.0

func _ready() -> void:
	add_to_group("go_sunken_region")
	var terrain := Node3D.new()
	terrain.set_script(TerrainBuilder)
	terrain.name = "SunkenTerrain"
	terrain.set("region_id", REGION)
	add_child(terrain)
	var veg := Node3D.new()
	veg.set_script(VegetationBuilder)
	veg.name = "SunkenVegetation"
	veg.set("region_id", REGION)
	add_child(veg)
	_build_palace()
	_build_causeway()
	_build_steps()
	_build_base()
	_build_dome()
	_build_lighthouse()
	_build_pass_stone()
	_build_gate()
	for d in DISCOVERIES:
		_add_discovery(String(d[0]), cell_pos(d[1]), float(d[2]))
	for d in SMALL:
		_build_small(String(d[0]), d[1], String(d[2]))
		_add_discovery(String(d[0]), cell_pos(d[1]), SMALL_R)
	_set_gate(gate_open())
	_set_door(dome_open())
	_set_light(light_on())

static func cell_pos(c: Vector2) -> Vector3:
	var p := TestMap.world_pos(c.x, c.y, REGION)
	p.y = TerrainBuilder.height_at(REGION, p)
	return p

## 칸의 월드 x,z 에 높이 y 를 박은 자리(물 위 명소는 지형이 아니라 이 높이에 선다).
static func at(c: Vector2, y: float) -> Vector3:
	var p := TestMap.world_pos(c.x, c.y, REGION)
	p.y = y
	return p

static func _story_ch() -> int:
	return int(PartyState.story.get("ch", 0))

## 5부(20장)를 마쳤는가 — 고개 해무가 걷혀 있다.
static func gate_open() -> bool:
	return _story_ch() >= GATE_OPEN_CH

## 22장을 마쳤는가 — 빛 돔 북쪽 문이 열려 있다.
static func dome_open() -> bool:
	return _story_ch() >= DOME_OPEN_CH

## 23장을 마쳤는가 — 옛 등대에 불이 켜져 있다.
static func light_on() -> bool:
	return _story_ch() >= LIGHT_ON_CH

func is_gate_open() -> bool:
	return _gate_open

func is_dome_open() -> bool:
	return _dome_open

func is_light_on() -> bool:
	return _light_on

## 빛 돔 받침 윗면 한가운데(월드, 받침 높이) — 받침은 이 둘레 RING_IN~RING_OUT.
static func dome_center() -> Vector3:
	return at(DOME_CELL, DECK_Y)

## 돔 안 마른 바닥 한가운데(월드).
static func dome_floor() -> Vector3:
	return cell_pos(DOME_CELL)

## 옛 등대 난간 판 윗면(월드).
static func light_top() -> Vector3:
	return cell_pos(LIGHT_CELL) + Vector3(0, LIGHT_H + 0.3, 0)

## 잔교 두 끝(월드, 윗면) — 기지 갑판 남쪽 변 → 돔 받침 바깥 변 1m 안.
static func pier_ends() -> Array:
	var p0 := at(BASE_CELL, DECK_Y) + Vector3(-3.0, 0, 6.0)
	var c := dome_center()
	var dir := Vector3(p0.x - c.x, 0, p0.z - c.z).normalized()
	var p1 := c + dir * (RING_OUT - 1.0)
	return [p0, p1]

func _process(delta: float) -> void:
	_t += delta
	for f in _floaters:
		(f[0] as Node3D).position.y = float(f[1]) + sin(_t * 0.7 + float(f[2])) * 0.12
	_check_t -= delta
	if _check_t <= 0.0:
		_check_t = 1.0
		if gate_open() != _gate_open:
			_set_gate(gate_open())
		if dome_open() != _dome_open:
			_set_door(dome_open())
		if light_on() != _light_on:
			_set_light(light_on())
	if _light_on and _beam != null:
		_beam.rotation.y += delta * 0.5

# ---------------------------------------------------------------- 명소

## 잠긴 궁궐 — 바다 밑(−3)에서 솟은 기단이 물 위 +0.25 로 드러나고, 기운 정전(기둥·뒷벽·옆벽)과 맞배 기와 지붕(올라설 수 있다).
func _build_palace() -> void:
	var root := _root_at("SunkenPalace", PALACE_CELL, 0.0)
	var th := TERRACE_Y - SEABED
	_solid_box(root, Vector3(22.0, th, 16.0), Vector3(0, SEABED + th * 0.5, 0), STONE)
	_box(root, Vector3(22.2, 0.5, 16.2), Vector3(0, -0.55, 0), MOSS) # 물 닿는 자리 이끼 띠
	## 기단 앞 돌계단(남쪽, 물속으로 내려간다)
	for k in 3:
		_box(root, Vector3(6.0, 0.4, 1.0), Vector3(0, TERRACE_Y - 0.4 - k * 0.4, 8.5 + k * 1.0), STONE_DARK)
	var hall := Node3D.new()
	hall.name = "Hall"
	hall.rotation.z = 0.05 # 한쪽으로 가라앉아 조금 기울었다
	hall.position = Vector3(0, TERRACE_Y, 0)
	root.add_child(hall)
	for x in [-6.0, 0.0, 6.0]:
		_solid_box(hall, Vector3(0.7, 4.2, 0.7), Vector3(x, 2.1, 3.8), PILLAR)
	_solid_box(hall, Vector3(14.6, 4.2, 0.6), Vector3(0, 2.1, -4.0), Color(0.78, 0.74, 0.66)) # 뒷벽(벽 타기로 지붕에)
	for x in [-7.0, 7.0]:
		_solid_box(hall, Vector3(0.6, 4.2, 4.0), Vector3(x, 2.1, -2.0), Color(0.78, 0.74, 0.66))
	_box(hall, Vector3(15.0, 0.5, 8.6), Vector3(0, 4.35, 0), PILLAR.darkened(0.3)) # 들보
	## 맞배 지붕 — 용마루 +7.2(기단 위), 처마 +4.4, 앞뒤 ±6m.
	for s in [-1.0, 1.0]:
		var slab := Node3D.new()
		slab.position = Vector3(0, 5.8, 3.0 * s)
		slab.rotation.x = 0.437 * s
		hall.add_child(slab)
		_solid_box(slab, Vector3(18.0, 0.4, 6.8), Vector3.ZERO, ROOF)
	_box(hall, Vector3(18.6, 0.5, 0.7), Vector3(0, 7.3, 0), ROOF.darkened(0.3)) # 용마루
	## 편액 — 이름은 이 판 것.
	_box(hall, Vector3(3.2, 1.0, 0.15), Vector3(0, 3.7, 4.25), Color(0.2, 0.16, 0.12))
	_box(hall, Vector3(2.8, 0.7, 0.16), Vector3(0, 3.7, 4.27), Color(0.85, 0.7, 0.3))
	## 기단 둘레 물에 잠긴 담장 조각(물 밑에 보인다)
	for w in [[Vector3(-14.0, SEABED + 1.0, 2.0), 0.3], [Vector3(13.0, SEABED + 1.0, -3.0), -0.2], [Vector3(-4.0, SEABED + 1.0, -13.0), 1.5]]:
		var wall := _box(root, Vector3(10.0, 2.0, 0.8), w[0], STONE_DARK)
		wall.rotation.y = float(w[1])
	_label(root, "잠긴 궁궐", Vector3(0, 11.5, 0), Color(0.95, 0.88, 0.72))

## 돌다리 — 모래밭에서 궁궐 기단까지 물 위 +0.25 로 이어진 옛 다리(받침 기둥이 물속까지).
func _build_causeway() -> void:
	var a := at(CAUSEWAY_FROM, TERRACE_Y)
	var b := at(CAUSEWAY_TO, TERRACE_Y)
	var span := _span("Causeway", a, b, 4.0, 0.6, STONE)
	var length := a.distance_to(b)
	var n := int(length / 10.0)
	for k in n:
		var z := -length * 0.5 + 6.0 + k * 10.0
		_box(span, Vector3(3.0, 3.2, 1.6), Vector3(0, -1.9, z), STONE_DARK) # 받침 기둥
		for side in [-1.0, 1.0]:
			_box(span, Vector3(0.4, 0.5, 1.2), Vector3(side * 1.8, 0.45, z + 3.0), STONE) # 난간 돌(듬성듬성 — 무너진 다리)

## 디딤 지붕 — 물에 잠긴 몸 + 물 위로 드러난 윗면(충돌). 헤엄쳐 가다 올라서 숨을 고른다.
func _build_steps() -> void:
	var i := 0
	for s in STEPS:
		var c: Vector2 = s[0]
		var top: float = s[1]
		var root := _root_at("Step%d" % i, c, 0.0)
		i += 1
		match String(s[2]):
			"roof":
				_box(root, Vector3(5.0, top - SEABED, 5.0), Vector3(0, (top + SEABED) * 0.5 - 0.3, 0), Color(0.72, 0.68, 0.6))
				_solid_box(root, Vector3(9.0, 0.4, 7.0), Vector3(0, top - 0.2, 0), ROOF)
				_box(root, Vector3(9.4, 0.4, 0.6), Vector3(0, top + 0.1, 0), ROOF.darkened(0.3))
			"gate":
				for x in [-3.0, 3.0]:
					_box(root, Vector3(0.8, top - SEABED, 0.8), Vector3(x, (top + SEABED) * 0.5 - 0.4, 0), PILLAR)
				_solid_box(root, Vector3(10.0, 0.4, 4.0), Vector3(0, top - 0.2, 0), ROOF)
				_box(root, Vector3(2.4, 0.8, 0.12), Vector3(0, top - 0.9, 2.05), Color(0.2, 0.16, 0.12))
			"pagoda":
				for k in 3:
					var w := 5.0 - k * 1.2
					_box(root, Vector3(w, 1.0, w), Vector3(0, SEABED + 0.5 + k * 1.1, 0), STONE_DARK)
				_solid_box(root, Vector3(3.4, 0.5, 3.4), Vector3(0, top - 0.25, 0), STONE)
				_box(root, Vector3(0.4, 1.2, 0.4), Vector3(0, top + 0.6, 0), STONE_DARK) # 상륜 토막

## 해저 연구 기지·잠수정 선착장 — 모래밭 끝 갑판(+0.5, 북쪽 경사로) · 컨테이너 둘 · 관제실·안테나 · 기지로 내려가는 통로 ·
## 빛 돔까지 잔교(+0.5, 16m 마다 수중 조명 기둥) · 잔교 동쪽 선착장에 매인 노란 잠수정.
func _build_base() -> void:
	var root := _root_at("ResearchBase", BASE_CELL, 0.0)
	_solid_box(root, Vector3(16.0, 0.4, 12.0), Vector3(0, DECK_Y - 0.2, 0), STEEL)
	_box(root, Vector3(16.1, 0.12, 0.3), Vector3(0, DECK_Y + 0.02, 5.9), HAZARD)
	for x in [-7.0, 0.0, 7.0]:
		for z in [-5.0, 5.0]:
			_box(root, Vector3(0.4, 3.6, 0.4), Vector3(x, DECK_Y - 2.2, z), STEEL_DARK) # 다리 기둥
	_ramp(root, Vector3(0, DECK_Y, -6.0), Vector3(0, 0.05, -10.5), 4.0, STEEL)
	_solid_box(root, Vector3(6.0, 2.6, 2.6), Vector3(-5.0, DECK_Y + 1.3, -3.6), Color(0.9, 0.45, 0.15)) # 컨테이너
	_solid_box(root, Vector3(6.0, 2.6, 2.6), Vector3(-5.0, DECK_Y + 3.9, -3.6), Color(0.85, 0.87, 0.9))
	_solid_box(root, Vector3(4.0, 3.0, 4.0), Vector3(4.5, DECK_Y + 1.5, -3.0), Color(0.82, 0.84, 0.86)) # 관제실
	_box(root, Vector3(3.2, 0.9, 0.1), Vector3(4.5, DECK_Y + 2.0, -0.98), GLOW).material_override = _glow(GLOW, 0.8)
	_box(root, Vector3(0.2, 8.0, 0.2), Vector3(5.8, DECK_Y + 7.0, -4.2), STEEL_DARK) # 안테나
	var dish := MeshInstance3D.new()
	var dm := CylinderMesh.new()
	dm.top_radius = 1.2
	dm.bottom_radius = 0.2
	dm.height = 0.5
	dish.mesh = dm
	dish.material_override = _mat(ALLOY)
	dish.rotation.x = -0.8
	dish.position = Vector3(5.8, DECK_Y + 9.0, -3.6)
	root.add_child(dish)
	## 기지로 내려가는 통로 — 갑판을 뚫고 물 밑으로 내려가는 원통과 빛 해치.
	var shaft := MeshInstance3D.new()
	var sm := CylinderMesh.new()
	sm.top_radius = 1.3
	sm.bottom_radius = 1.3
	sm.height = 5.0
	shaft.mesh = sm
	shaft.material_override = _mat(STEEL_DARK)
	shaft.position = Vector3(4.0, DECK_Y - 1.9, 3.2)
	root.add_child(shaft)
	var hatch := MeshInstance3D.new()
	var hm := CylinderMesh.new()
	hm.top_radius = 1.0
	hm.bottom_radius = 1.0
	hm.height = 0.1
	hatch.mesh = hm
	hatch.material_override = _glow(GLOW, 1.2)
	hatch.position = Vector3(4.0, DECK_Y + 0.62, 3.2)
	root.add_child(hatch)
	_label(root, "해저 연구 기지", Vector3(0, 9.0, 0), Color(0.85, 0.95, 1.0))
	## 잔교
	var ends := pier_ends()
	var p0: Vector3 = ends[0]
	var p1: Vector3 = ends[1]
	var pier := _span("Pier", p0, p1, 3.0, 0.4, STEEL)
	var length := p0.distance_to(p1)
	var k := 0
	var z := -length * 0.5 + 6.0
	while z < length * 0.5 - 2.0:
		_box(pier, Vector3(0.3, 3.4, 0.3), Vector3(1.3, -1.9, z), STEEL_DARK)
		_box(pier, Vector3(0.3, 3.4, 0.3), Vector3(-1.3, -1.9, z), STEEL_DARK)
		if k % 2 == 0:
			_box(pier, Vector3(0.15, 1.4, 0.15), Vector3(-1.35, 0.9, z), STEEL_DARK)
			_box(pier, Vector3(0.3, 0.3, 0.3), Vector3(-1.35, 1.7, z), GLOW).material_override = _glow(GLOW, 1.6) # 수중 조명 기둥
		z += 8.0
		k += 1
	## 선착장 — 잔교 40% 자리 동쪽(잔교 진행 방향 오른쪽)에 붙은 판, 그 옆에 잠수정.
	var dock := Node3D.new()
	dock.name = "SubDock"
	dock.position = Vector3(4.5, 0.0, -length * 0.5 + length * 0.4)
	pier.add_child(dock)
	_solid_box(dock, Vector3(6.0, 0.4, 12.0), Vector3(0, -0.2, 0), STEEL)
	_box(dock, Vector3(0.3, 0.12, 12.0), Vector3(2.9, 0.02, 0), HAZARD)
	_box(dock, Vector3(0.3, 5.0, 0.3), Vector3(-2.0, 2.5, -5.0), STEEL_DARK) # 기중기 기둥
	_box(dock, Vector3(6.0, 0.3, 0.3), Vector3(0.8, 5.0, -5.0), HAZARD)
	var sub := Node3D.new()
	sub.name = "Submarine"
	sub.position = Vector3(6.2, TerrainBuilder.WATER_LEVEL + 0.15, 0)
	dock.add_child(sub)
	var hull := MeshInstance3D.new()
	var cap := CapsuleMesh.new()
	cap.radius = 1.5
	cap.height = 10.0
	hull.mesh = cap
	hull.material_override = _mat(HAZARD)
	hull.rotation.x = PI * 0.5
	sub.add_child(hull)
	_box(sub, Vector3(1.4, 1.6, 2.4), Vector3(0, 1.8, -0.5), HAZARD.darkened(0.1)) # 조종탑
	_box(sub, Vector3(1.0, 0.5, 0.1), Vector3(0, 2.0, 0.72), GLOW).material_override = _glow(GLOW, 1.0)
	for pz in [-2.5, 0.5, 3.0]:
		_box(sub, Vector3(0.1, 0.5, 0.5), Vector3(1.48, 0.3, pz), GLOW).material_override = _glow(GLOW, 1.2) # 둥근 창
	_box(sub, Vector3(0.2, 1.6, 0.2), Vector3(0, 0, 5.2), STEEL_DARK) # 추진기
	_label(dock, "잠수정 선착장", Vector3(3.0, 5.5, 0), Color(1.0, 0.92, 0.6))

## 빛 돔 — 물을 밀어낸 둥근 받침(RING_IN~RING_OUT, 윗면 DECK_Y) + 유리 반구(반지름 RING_IN) + 받침 둘레 물 위 빛 테.
## 안은 마른 바닥(지형 U, −10) — 북쪽 문 안 층계참에서 남쪽으로 내려가는 경사로, 남쪽에 기록실.
func _build_dome() -> void:
	var root := _root_at("LightDome", DOME_CELL, 0.0)
	var floor_y: float = TerrainBuilder.LEGEND["U"].height
	## 받침 — 윗면 고리·바깥 벽(바다 밑까지)·안 벽(마른 바닥까지).
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	for i in RING_SEG:
		var a0 := TAU * float(i) / RING_SEG
		var a1 := TAU * float(i + 1) / RING_SEG
		var d0 := Vector3(cos(a0), 0, sin(a0))
		var d1 := Vector3(cos(a1), 0, sin(a1))
		var up := Vector3(0, DECK_Y, 0)
		_quad(st, d0 * RING_IN + up, d1 * RING_IN + up, d1 * RING_OUT + up, d0 * RING_OUT + up, Vector3.UP)
		_quad(st, d0 * RING_OUT + up, d1 * RING_OUT + up, d1 * RING_OUT + Vector3(0, SEABED - 0.3, 0), d0 * RING_OUT + Vector3(0, SEABED - 0.3, 0), (d0 + d1).normalized())
		_quad(st, d1 * RING_IN + up, d0 * RING_IN + up, d0 * RING_IN + Vector3(0, floor_y - 0.2, 0), d1 * RING_IN + Vector3(0, floor_y - 0.2, 0), -(d0 + d1).normalized())
	var ring := MeshInstance3D.new()
	ring.name = "Ring"
	ring.mesh = st.commit()
	var rm := _mat(ALLOY)
	rm.cull_mode = BaseMaterial3D.CULL_DISABLED
	ring.material_override = rm
	root.add_child(ring)
	_trimesh_body(root, ring.mesh)
	## 받침 바깥 가장자리 빛 줄 + 물 위 빛 테(물이 밀려난 자리).
	_band(root, RING_OUT - 0.6, RING_OUT + 0.05, DECK_Y + 0.02, _glow(GLOW, 1.4))
	var halo := StandardMaterial3D.new()
	halo.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	halo.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	halo.albedo_color = Color(GLOW.r, GLOW.g, GLOW.b, 0.28)
	halo.cull_mode = BaseMaterial3D.CULL_DISABLED
	_band(root, RING_OUT, RING_OUT + 7.0, TerrainBuilder.WATER_LEVEL + 0.04, halo)
	## 유리 반구 — 북쪽 문 자리(DOOR_K 경도 칸 × 아래 DOOR_LAT 위도 칸)는 비운다(그림·충돌 모두).
	var gs := SurfaceTool.new()
	gs.begin(Mesh.PRIMITIVE_TRIANGLES)
	var lon_step := TAU / GLASS_LON
	for j in GLASS_LAT:
		var f0 := PI * 0.5 * float(j) / GLASS_LAT
		var f1 := PI * 0.5 * float(j + 1) / GLASS_LAT
		for k in GLASS_LON:
			if k == DOOR_K and j < DOOR_LAT:
				continue
			var t0 := (k - 0.5) * lon_step
			var t1 := (k + 0.5) * lon_step
			var q00 := _sphere_pt(f0, t0)
			var q01 := _sphere_pt(f0, t1)
			var q10 := _sphere_pt(f1, t0)
			var q11 := _sphere_pt(f1, t1)
			_quad(gs, q00, q01, q11, q10, (q00 + q11 - Vector3(0, 2.0 * DECK_Y, 0)).normalized())
	var glass := MeshInstance3D.new()
	glass.name = "Glass"
	glass.mesh = gs.commit()
	var gm := StandardMaterial3D.new()
	gm.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	gm.cull_mode = BaseMaterial3D.CULL_DISABLED
	gm.albedo_color = Color(0.7, 0.95, 1.0, 0.16)
	gm.emission_enabled = true
	gm.emission = GLOW
	gm.emission_energy_multiplier = 0.15
	gm.metallic_specular = 1.0
	gm.roughness = 0.05
	glass.material_override = gm
	glass.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	root.add_child(glass)
	_trimesh_body(root, glass.mesh)
	var cap := MeshInstance3D.new()
	var cm := SphereMesh.new()
	cm.radius = 1.2
	cm.height = 2.4
	cap.mesh = cm
	cap.material_override = _glow(GLOW, 2.0)
	cap.position = Vector3(0, DECK_Y + RING_IN, 0)
	root.add_child(cap)
	## 문틀 — 문 자리 양옆 빛 기둥과 위 인방.
	var door_hw := RING_IN * sin(lon_step * 0.5)
	var door_h := RING_IN * sin(PI * 0.5 * DOOR_LAT / GLASS_LAT)
	var door_z := -RING_IN * cos(lon_step * 0.5)
	for x in [-door_hw, door_hw]:
		_box(root, Vector3(0.3, door_h, 0.3), Vector3(x, DECK_Y + door_h * 0.5, door_z), GLOW).material_override = _glow(GLOW, 1.5)
	_box(root, Vector3(door_hw * 2.0 + 0.3, 0.3, 0.3), Vector3(0, DECK_Y + door_h, door_z), GLOW).material_override = _glow(GLOW, 1.5)
	_door_veil = Node3D.new()
	_door_veil.name = "DoorVeil"
	root.add_child(_door_veil)
	var veil := MeshInstance3D.new()
	var qm := QuadMesh.new()
	qm.size = Vector2(door_hw * 2.0, door_h)
	veil.mesh = qm
	var vm := StandardMaterial3D.new()
	vm.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	vm.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	vm.cull_mode = BaseMaterial3D.CULL_DISABLED
	vm.albedo_color = Color(GLOW.r, GLOW.g, GLOW.b, 0.55)
	veil.material_override = vm
	veil.position = Vector3(0, DECK_Y + door_h * 0.5, door_z)
	_door_veil.add_child(veil)
	var lbl := Label3D.new()
	lbl.text = "빛 돔 — 문이 잠겨 있다"
	lbl.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	lbl.font_size = 40
	lbl.outline_size = 8
	lbl.pixel_size = 0.008
	lbl.modulate = Color(0.85, 0.97, 1.0)
	lbl.position = Vector3(0, DECK_Y + door_h + 1.2, door_z - 0.5)
	_door_veil.add_child(lbl)
	_door_body = StaticBody3D.new()
	_door_body.name = "DoorBody"
	var dcs := CollisionShape3D.new()
	var dbs := BoxShape3D.new()
	dbs.size = Vector3(door_hw * 2.0 + 0.4, door_h + 0.4, 1.2)
	dcs.shape = dbs
	_door_body.add_child(dcs)
	_door_body.position = Vector3(0, DECK_Y + door_h * 0.5, door_z)
	root.add_child(_door_body)
	## 안 — 문 안 층계참(받침 높이) → 남쪽으로 내려가는 경사로 → 마른 바닥.
	_solid_box(root, Vector3(5.0, 0.6, 5.4), Vector3(0, DECK_Y - 0.3, -19.6), ALLOY)
	_ramp(root, Vector3(0, DECK_Y, -17.0), Vector3(0, floor_y, RAMP_END_Z), 4.0, ALLOY)
	## 바닥 빛 무늬
	_band(root, 6.0, 6.6, floor_y + 0.03, _glow(GLOW, 1.0))
	_band(root, 15.0, 15.4, floor_y + 0.03, _glow(GLOW, 0.8))
	## 기록실 — 옛 궁궐 돌 기단 위 빛 판 기둥 넷과 지붕(과거 기단 + 미래 기록 단말).
	var arc := Node3D.new()
	arc.name = "Archive"
	arc.position = Vector3(0, floor_y, 12.0)
	root.add_child(arc)
	_solid_box(arc, Vector3(12.0, 0.6, 8.0), Vector3(0, 0.3, 0), STONE)
	for x in [-5.0, 5.0]:
		for z in [-3.2, 3.2]:
			_solid_box(arc, Vector3(0.6, 4.0, 0.6), Vector3(x, 2.6, z), PILLAR)
	_box(arc, Vector3(13.0, 0.5, 9.0), Vector3(0, 4.85, 0), ROOF)
	for x in [-2.5, 0.0, 2.5]:
		_box(arc, Vector3(1.6, 2.2, 0.12), Vector3(x, 1.9, 2.6), GLOW).material_override = _glow(GLOW, 1.1) # 기록 단말
	_label(arc, "기록실", Vector3(0, 6.4, 0), Color(0.85, 0.97, 1.0))
	_label(root, "빛 돔", Vector3(0, DECK_Y + RING_IN + 3.5, 0), Color(0.8, 0.96, 1.0))

func _sphere_pt(phi: float, theta: float) -> Vector3:
	return Vector3(RING_IN * cos(phi) * cos(theta), DECK_Y + RING_IN * sin(phi), RING_IN * cos(phi) * sin(theta))

## 옛 등대 — K 바위섬 꼭대기의 15m 돌탑(흰·붉은 띠, 벽 타기)·난간 판(올라설 수 있다)·빛 등롱·빛줄기(켜진 뒤 돈다).
func _build_lighthouse() -> void:
	var root := _root("OldLighthouse", LIGHT_CELL)
	var tower := MeshInstance3D.new()
	var tm := CylinderMesh.new()
	tm.top_radius = LIGHT_R
	tm.bottom_radius = LIGHT_R
	tm.height = LIGHT_H + 2.0
	tower.mesh = tm
	tower.material_override = _mat(Color(0.9, 0.88, 0.84))
	tower.position = Vector3(0, LIGHT_H * 0.5 - 1.0, 0)
	root.add_child(tower)
	var body := StaticBody3D.new()
	var cs := CollisionShape3D.new()
	var cyl := CylinderShape3D.new()
	cyl.radius = LIGHT_R
	cyl.height = LIGHT_H + 2.0
	cs.shape = cyl
	body.add_child(cs)
	body.position = tower.position
	root.add_child(body)
	for y in [3.5, 8.5, 13.0]:
		var band := MeshInstance3D.new()
		var bm := CylinderMesh.new()
		bm.top_radius = LIGHT_R + 0.03
		bm.bottom_radius = LIGHT_R + 0.03
		bm.height = 1.6
		band.mesh = bm
		band.material_override = _mat(Color(0.72, 0.2, 0.16))
		band.position = Vector3(0, y, 0)
		root.add_child(band)
	_box(root, Vector3(1.4, 2.2, 0.3), Vector3(0, 1.1, LIGHT_R), WOOD) # 문
	## 난간 판(윗면 LIGHT_H + 0.3) — 탑 위로 1m 씩 내민 둥근 판. 가운데 등롱.
	var gallery := MeshInstance3D.new()
	var gl := CylinderMesh.new()
	gl.top_radius = LIGHT_R + 1.0
	gl.bottom_radius = LIGHT_R + 1.0
	gl.height = 0.3
	gallery.mesh = gl
	gallery.material_override = _mat(STONE_DARK)
	gallery.position = Vector3(0, LIGHT_H + 0.15, 0)
	root.add_child(gallery)
	var gbody := StaticBody3D.new()
	var gcs := CollisionShape3D.new()
	var gcyl := CylinderShape3D.new()
	gcyl.radius = LIGHT_R + 1.0
	gcyl.height = 0.3
	gcs.shape = gcyl
	gbody.add_child(gcs)
	gbody.position = gallery.position
	root.add_child(gbody)
	var lamp := MeshInstance3D.new()
	var lm := CylinderMesh.new()
	lm.top_radius = 1.3
	lm.bottom_radius = 1.3
	lm.height = 2.2
	lamp.mesh = lm
	_lamp_mat = _glow(Color(1.0, 0.93, 0.7), 0.2)
	lamp.material_override = _lamp_mat
	lamp.position = Vector3(0, LIGHT_H + 1.4, 0)
	root.add_child(lamp)
	_collider(root, Vector3(1.8, 2.2, 1.8), lamp.position) # 등롱 충돌(난간 판 위 서는 자리는 둘레 1m)
	var roof := MeshInstance3D.new()
	var rm := CylinderMesh.new()
	rm.top_radius = 0.05
	rm.bottom_radius = 1.8
	rm.height = 1.6
	roof.mesh = rm
	roof.material_override = _mat(ROOF)
	roof.position = Vector3(0, LIGHT_H + 3.3, 0)
	root.add_child(roof)
	## 빛줄기 — 앞 시대 빛 고리에서 뻗는 옅은 원뿔 둘(켜졌을 때만 보인다).
	_beam = Node3D.new()
	_beam.name = "Beam"
	_beam.position = lamp.position
	root.add_child(_beam)
	var bmat := StandardMaterial3D.new()
	bmat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	bmat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	bmat.cull_mode = BaseMaterial3D.CULL_DISABLED
	bmat.albedo_color = Color(1.0, 0.95, 0.75, 0.18)
	for s in [-1.0, 1.0]:
		var cone := MeshInstance3D.new()
		var cm := CylinderMesh.new()
		cm.top_radius = 0.3
		cm.bottom_radius = 5.0
		cm.height = 40.0
		cone.mesh = cm
		cone.material_override = bmat
		cone.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		cone.rotation.z = -PI * 0.5 * s
		cone.position = Vector3(20.0 * s, 0, 0)
		_beam.add_child(cone)
	var ring := MeshInstance3D.new()
	var tor := TorusMesh.new()
	tor.inner_radius = 1.9
	tor.outer_radius = 2.1
	ring.mesh = tor
	ring.material_override = _glow(GLOW, 1.8)
	ring.position = Vector3(0, LIGHT_H + 4.6, 0)
	root.add_child(ring)
	_floaters.append([ring, LIGHT_H + 4.6, 0.5])
	_label(root, "옛 등대", Vector3(0, LIGHT_H + 7.0, 0), Color(1.0, 0.94, 0.8))

func _set_light(on: bool) -> void:
	_light_on = on
	_lamp_mat.emission_energy_multiplier = 3.0 if on else 0.2
	_beam.visible = on

## 고개 경계비 — 포구 모래와 같은 돌, 물빛 판.
func _build_pass_stone() -> void:
	var root := _root("PassStone", PASS_STONE_CELL)
	_solid_box(root, Vector3(1.2, 0.6, 0.6), Vector3(0, 0.3, 0), STONE_DARK)
	_box(root, Vector3(0.9, 2.2, 0.12), Vector3(0, 1.7, 0), GLOW).material_override = _glow(GLOW, 0.7)
	_label(root, "잠긴 도읍", Vector3(0, 3.4, 0), Color(0.85, 0.95, 1.0))

## 해무 문 — 고개 칸 북쪽 변의 흰 막(충돌 상자 — 5부를 마치면 걷힌다). 틈새 갈림길 시간 틈 문과 같은 틀.
func _build_gate() -> void:
	var p := TestMap.world_pos(GATE_CELL.x, GATE_CELL.y, REGION)
	p.y = TerrainBuilder.height_at(REGION, TestMap.world_pos(1.0, 0.0, REGION))
	var root := Node3D.new()
	root.name = "MistGate"
	add_child(root)
	root.position = p
	_gate_veil = Node3D.new()
	_gate_veil.name = "Veil"
	root.add_child(_gate_veil)
	var vm := StandardMaterial3D.new()
	vm.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	vm.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	vm.cull_mode = BaseMaterial3D.CULL_DISABLED
	vm.albedo_color = Color(MIST.r, MIST.g, MIST.b, 0.5)
	for k in 3: # 겹겹이 선 해무
		var veil := MeshInstance3D.new()
		var qm := QuadMesh.new()
		qm.size = Vector2(TestMap.TILE_SIZE, 14.0)
		veil.mesh = qm
		veil.material_override = vm
		veil.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		veil.position = Vector3(0, 7.0, k * 1.5)
		_gate_veil.add_child(veil)
	var lbl := Label3D.new()
	lbl.text = "짙은 해무 — 아직 길이 보이지 않는다"
	lbl.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	lbl.font_size = 40
	lbl.outline_size = 8
	lbl.pixel_size = 0.008
	lbl.modulate = Color(0.95, 0.98, 1.0)
	lbl.position = Vector3(0, 4.0, -0.5)
	_gate_veil.add_child(lbl)
	_gate_body = StaticBody3D.new()
	_gate_body.name = "GateBody"
	var cs := CollisionShape3D.new()
	var bs := BoxShape3D.new()
	bs.size = Vector3(TestMap.TILE_SIZE, 20.0, 1.0)
	cs.shape = bs
	_gate_body.add_child(cs)
	_gate_body.position = Vector3(0, 10.0, 0)
	root.add_child(_gate_body)

func _set_gate(open: bool) -> void:
	_gate_open = open
	_gate_veil.visible = not open
	_gate_body.collision_layer = 0 if open else 1

func _set_door(open: bool) -> void:
	_dome_open = open
	_door_veil.visible = not open
	_door_body.collision_layer = 0 if open else 1

## 작은 발견 — 모양마다 몇 개 도형. 충돌 없음(길을 막지 않게). 물 칸이면 뿌리가 바다 밑(−3)이라 물 위로 내밀게 높이를 잡는다.
func _build_small(id: String, c: Vector2, shape: String) -> void:
	var r := _root("Small_" + id, c)
	if shape in FLOAT_SHAPES:
		r.position.y = TerrainBuilder.WATER_LEVEL
		_floaters.append([r, TerrainBuilder.WATER_LEVEL, c.x + c.y])
	match shape:
		"tewak":
			var gourd := MeshInstance3D.new()
			var gm := SphereMesh.new()
			gm.radius = 0.45
			gm.height = 0.8
			gourd.mesh = gm
			gourd.material_override = _mat(Color(0.95, 0.5, 0.15))
			gourd.position = Vector3(0, 0.4, 0)
			r.add_child(gourd)
			_box(r, Vector3(1.0, 0.5, 0.8), Vector3(0.9, 0.25, 0.3), Color(0.35, 0.45, 0.3)) # 망사리
			_box(r, Vector3(0.5, 0.08, 1.4), Vector3(-0.8, 0.04, 0.2), Color(0.2, 0.2, 0.22)) # 빗창
		"helmet":
			var h := MeshInstance3D.new()
			var hm := SphereMesh.new()
			hm.radius = 0.55
			hm.height = 1.1
			h.mesh = hm
			h.material_override = _mat(Color(0.78, 0.5, 0.25))
			h.position = Vector3(0, 0.35, 0)
			h.rotation.z = 0.4
			r.add_child(h)
			_box(r, Vector3(0.1, 0.35, 0.35), Vector3(0.5, 0.5, 0), GLOW).material_override = _glow(Color(0.6, 0.8, 0.9), 0.3)
		"crates":
			_box(r, Vector3(1.4, 1.0, 1.0), Vector3(0, 0.5, 0), Color(0.3, 0.45, 0.6))
			_box(r, Vector3(1.0, 0.8, 1.0), Vector3(0.2, 1.4, 0.1), Color(0.85, 0.85, 0.82)).rotation.y = 0.4
			_box(r, Vector3(1.2, 0.9, 0.9), Vector3(-1.4, 0.45, 0.4), Color(0.3, 0.45, 0.6)).rotation.y = -0.3
		"pearl":
			for s in [-1.0, 1.0]:
				var shell := MeshInstance3D.new()
				var sm := SphereMesh.new()
				sm.radius = 0.9
				sm.height = 0.8
				sm.is_hemisphere = true
				shell.mesh = sm
				shell.material_override = _mat(Color(0.85, 0.78, 0.7))
				shell.rotation.x = 0.0 if s < 0 else PI * 0.8
				shell.position = Vector3(0, 0.1 if s < 0 else 0.5, 0 if s < 0 else -0.4)
				r.add_child(shell)
			var pearl := MeshInstance3D.new()
			var pm := SphereMesh.new()
			pm.radius = 0.25
			pm.height = 0.5
			pearl.mesh = pm
			pearl.material_override = _glow(Color(1.0, 0.97, 0.92), 0.8)
			pearl.position = Vector3(0, 0.45, 0.1)
			r.add_child(pearl)
		"buoy":
			var b := MeshInstance3D.new()
			var bm := CylinderMesh.new()
			bm.top_radius = 0.3
			bm.bottom_radius = 0.9
			bm.height = 1.6
			b.mesh = bm
			b.material_override = _mat(Color(0.9, 0.2, 0.15))
			b.position = Vector3(0, 0.5, 0)
			r.add_child(b)
			_box(r, Vector3(0.12, 1.2, 0.12), Vector3(0, 1.9, 0), STEEL_DARK)
			_box(r, Vector3(0.3, 0.3, 0.3), Vector3(0, 2.6, 0), HAZARD).material_override = _glow(HAZARD, 1.8)
		"turtle":
			_box(r, Vector3(3.0, 1.2, 4.0), Vector3(0, 0.6, 0), STONE_DARK)
			_box(r, Vector3(1.2, 0.9, 1.2), Vector3(0, 0.6, 2.4), STONE_DARK)
			_box(r, Vector3(1.4, 4.6, 0.5), Vector3(0, 3.5, -0.2), STONE) # 비석 — 물 위로 약 1.4m
		"plaque":
			var p := _box(r, Vector3(2.4, 0.15, 0.9), Vector3(0, 0.05, 0), Color(0.2, 0.16, 0.12))
			p.rotation.y = 0.5
			var q := _box(r, Vector3(2.0, 0.16, 0.6), Vector3(0, 0.06, 0), Color(0.85, 0.7, 0.3))
			q.rotation.y = 0.5
		"haetae":
			_box(r, Vector3(2.4, 2.4, 3.0), Vector3(0, 1.2, 0), STONE)
			_box(r, Vector3(1.8, 1.4, 1.6), Vector3(0, 2.7, 1.0), STONE) # 머리 — 물 위로 조금
			for k in 4:
				var coral := _box(r, Vector3(0.3, 0.9, 0.3), Vector3(-0.9 + k * 0.6, 1.8 + (k % 2) * 0.4, -1.2), Color(0.95, 0.45, 0.5))
				coral.rotation.z = (k - 1.5) * 0.3
		"jelly":
			for k in 5:
				var j := MeshInstance3D.new()
				var jm := SphereMesh.new()
				jm.radius = 0.4
				jm.height = 0.5
				jm.is_hemisphere = true
				j.mesh = jm
				j.material_override = _glow(Color(0.7, 0.6, 1.0) if k % 2 == 0 else GLOW, 1.6)
				j.position = Vector3(cos(k * 1.3) * 2.0, 0.15, sin(k * 1.3) * 2.0)
				r.add_child(j)
		"drone":
			_box(r, Vector3(1.4, 0.5, 1.8), Vector3(0, 0.1, 0), ALLOY)
			_box(r, Vector3(0.9, 0.12, 0.2), Vector3(0, 0.2, 0.92), GLOW).material_override = _glow(Color(1.0, 0.3, 0.2), 1.2)
			for x in [-0.9, 0.9]:
				var prop := MeshInstance3D.new()
				var pm := CylinderMesh.new()
				pm.top_radius = 0.3
				pm.bottom_radius = 0.3
				pm.height = 0.5
				prop.mesh = pm
				prop.material_override = _mat(STEEL_DARK)
				prop.rotation.x = PI * 0.5
				prop.position = Vector3(x, 0.0, -0.6)
				r.add_child(prop)

# ---------------------------------------------------------------- 도우미(region6_crossing.gd 와 같은 결)

func _root(n: String, c: Vector2) -> Node3D:
	var r := Node3D.new()
	r.name = n
	add_child(r)
	r.position = cell_pos(c)
	return r

func _root_at(n: String, c: Vector2, y: float) -> Node3D:
	var r := Node3D.new()
	r.name = n
	add_child(r)
	r.position = at(c, y)
	return r

## a → b(월드, 윗면 높이) 로 곧게 뻗은 판(다리·잔교). 돌려 세운 뿌리를 돌려준다 — 뿌리 로컬 z 가 진행 방향, 원점은 가운데 윗면.
func _span(n: String, a: Vector3, b: Vector3, width: float, thick: float, color: Color) -> Node3D:
	var r := Node3D.new()
	r.name = n
	add_child(r)
	r.position = (a + b) * 0.5
	r.rotation.y = atan2(b.x - a.x, b.z - a.z)
	_solid_box(r, Vector3(width, thick, a.distance_to(b)), Vector3(0, -thick * 0.5, 0), color)
	return r

## 경사로 — 부모 로컬 from → to(윗면), 폭 width. 윗면이 두 점을 잇게 두께만큼 아래로 내린다.
func _ramp(parent: Node3D, from: Vector3, to: Vector3, width: float, color: Color) -> void:
	var r := Node3D.new()
	var flat := Vector2(to.x - from.x, to.z - from.z)
	var drop := from.y - to.y
	r.rotation = Vector3(atan2(drop, flat.length()), atan2(flat.x, flat.y), 0)
	var up := r.basis * Vector3.UP
	r.position = (from + to) * 0.5 - up * 0.2
	parent.add_child(r)
	_solid_box(r, Vector3(width, 0.4, from.distance_to(to)), Vector3.ZERO, color)

## 가로 고리 판(안 반지름 r0 ~ 바깥 r1, 높이 y) — 받침 빛 줄·물 위 빛 테·바닥 무늬.
func _band(parent: Node3D, r0: float, r1: float, y: float, mat: Material) -> void:
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	for i in RING_SEG:
		var a0 := TAU * float(i) / RING_SEG
		var a1 := TAU * float(i + 1) / RING_SEG
		var d0 := Vector3(cos(a0), 0, sin(a0))
		var d1 := Vector3(cos(a1), 0, sin(a1))
		var h := Vector3(0, y, 0)
		_quad(st, d0 * r0 + h, d1 * r0 + h, d1 * r1 + h, d0 * r1 + h, Vector3.UP)
	var mi := MeshInstance3D.new()
	mi.mesh = st.commit()
	mi.material_override = mat
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	parent.add_child(mi)

func _quad(st: SurfaceTool, a: Vector3, b: Vector3, c: Vector3, d: Vector3, n: Vector3) -> void:
	for v in [a, b, c, a, c, d]:
		st.set_normal(n)
		st.add_vertex(v)

func _trimesh_body(parent: Node3D, mesh: Mesh) -> void:
	var body := StaticBody3D.new()
	var shape := mesh.create_trimesh_shape() as ConcavePolygonShape3D
	shape.backface_collision = true
	var cs := CollisionShape3D.new()
	cs.shape = shape
	body.add_child(cs)
	parent.add_child(body)

func _mat(c: Color) -> StandardMaterial3D:
	var m := StandardMaterial3D.new()
	m.albedo_color = c
	return m

func _glow(c: Color, energy: float) -> StandardMaterial3D:
	var m := StandardMaterial3D.new()
	m.albedo_color = c
	m.emission_enabled = true
	m.emission = c
	m.emission_energy_multiplier = energy
	return m

func _box(parent: Node3D, size: Vector3, pos: Vector3, color: Color) -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	var bm := BoxMesh.new()
	bm.size = size
	mi.mesh = bm
	mi.material_override = _mat(color)
	mi.position = pos
	parent.add_child(mi)
	return mi

func _solid_box(parent: Node3D, size: Vector3, pos: Vector3, color: Color) -> void:
	_box(parent, size, pos, color)
	_collider(parent, size, pos)

func _collider(parent: Node3D, size: Vector3, pos: Vector3) -> void:
	var body := StaticBody3D.new()
	body.position = pos
	var cs := CollisionShape3D.new()
	var bs := BoxShape3D.new()
	bs.size = size
	cs.shape = bs
	body.add_child(cs)
	parent.add_child(body)

func _label(parent: Node3D, text: String, pos: Vector3, color: Color) -> void:
	var l := Label3D.new()
	l.text = text
	l.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	l.font_size = 44
	l.outline_size = 8
	l.pixel_size = 0.008
	l.modulate = color
	l.position = pos
	parent.add_child(l)

func _add_discovery(codex_id: String, pos: Vector3, radius: float) -> void:
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
			CodexState.discover("place", codex_id))
