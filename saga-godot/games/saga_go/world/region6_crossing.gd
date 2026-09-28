extends Node3D

## PLAN 106장 ㊾ — 여섯째 지역 "틈새 갈림길"(REGIONS["crossing"], test_map.gd). 이야기 5부의 무대.
## 18장 막차 운행 기록부의 행선지 "틈 너머 첫 정거장" — 은하 나루 은하역 선로가 남쪽 산 사이 (5,8) 고개로 이어져
## 이 지역 (5,0) 선로 칸과 맞닿는다. 4부를 마치기 전(ch < 18)엔 고개에 시간 틈 문(보랏빛 막, 충돌)이 서서 못 지나간다.
## 시간 틈 안쪽이라 여러 시대가 가장 심하게 뒤엉킨 땅 — 성문 조각이 허공에 멈추고, 시계는 멈췄고, 돌이 떠 있다.
## 이 파일이 짓는 것: 지형·식생(TerrainBuilder·VegetationBuilder region_id 인스턴스) · 고정 명소 넷 · 틈 고개 경계비·시간 틈 문 ·
## 은하역에서 이어지는 선로 · 발견 지점.
## 순간이동 지점·들판 무리·상자·별조각·채집은 각 표(waypoints·field_spawner·treasure_spawner·star_shards·cooking)에 "crossing" 줄로.
##   현대·미래 — 첫 정거장(H (5,2)): 선로 끝 승강장·빛 표지 지붕·시간표 판·차막이
##   과거 — 뒤엉킨 성문(R (2..3,4..5)): 기운 성문 누각 + 허공에 멈춘 성벽 조각 넷(올라설 수 있다)
##   현대 — 멈춘 시계탑((6.6,5.8)): 16m 돌탑(벽 타기 — 윗면에 턱 없이 곧게, 지붕은 모서리 기둥 위)·네 면 빛 문자판
##     (바늘이 멈춤 — 19장 태엽을 푼 뒤(CLOCK_FROM_STEP)부터 다시 돈다)
##   미래·틈 — 떠 있는 섬돌(M (2..3,7)): 틈 수정 바닥 위로 나선으로 솟는 섬돌 열다섯 → 17.6m 꼭대기 판·틈 수정
##   틈 고개 경계비((5.35,0.65)) · 길가 틈 등롱

const PropMaterial := preload("res://games/saga_go/world/prop_material.gd")
const TestMap := preload("res://games/saga_go/data/test_map.gd")
const TerrainBuilder := preload("res://games/saga_go/world/terrain_builder.gd")
const VegetationBuilder := preload("res://games/saga_go/world/vegetation_builder.gd")

const REGION := "crossing"
const DISCOVER_R := 30.0

## [codex id, 칸(소수), 반지름] — CodexState "place"(codex_state.gd TOTAL 에 더함).
const DISCOVERIES := [
	["crossing_region", Vector2(4.0, 4.0), 60.0],
	["crossing_pass", Vector2(5.0, 0.6), DISCOVER_R],
	["crossing_station", Vector2(5.0, 2.0), DISCOVER_R],
	["crossing_gate", Vector2(2.5, 4.5), DISCOVER_R],
	["crossing_clock", Vector2(6.6, 5.8), DISCOVER_R],
	["crossing_stones", Vector2(2.5, 7.0), DISCOVER_R],
]
## 작은 발견(선택지 없는 순수 발견). 발견 밀도(104-5, 반경 60m) 빈 칸을 덮는 자리. [codex id, 칸, 모양]
const SMALL := [
	["crossing_dial", Vector2(1.4, 1.4), "dial"],         # 과거·현대 — 풀숲에 떨어진 큰 시계 문자판
	["crossing_lantern", Vector2(3.2, 1.3), "lantern"],   # 과거 — 허공에 멈춘 등롱
	["crossing_robot", Vector2(7.0, 1.6), "robot"],       # 미래 — 멈춘 경비 기계
	["crossing_tiles", Vector2(1.3, 3.1), "tiles"],       # 과거 — 허공에 멈춘 기와 조각
	["crossing_signal", Vector2(7.1, 3.5), "signal"],     # 현대 — 철도 신호기
	["crossing_crystal", Vector2(4.2, 6.3), "crystal"],   # 틈 — 땅에서 솟은 틈 수정
	["crossing_cart", Vector2(1.2, 5.6), "cart"],         # 과거 — 바퀴 빠진 수레
	["crossing_pod", Vector2(5.3, 7.2), "pod"],           # 미래 — 반쯤 묻힌 탈출 포드
	["crossing_ticket", Vector2(3.6, 2.9), "ticket"],     # 현대 — 표 파는 기계
	["crossing_helm", Vector2(7.2, 7.0), "helm"],         # 과거 — 꽂힌 칼과 투구
]
const SMALL_R := 14.0

const STATION_CELL := Vector2(5.0, 2.0)
const GATE_RUIN_CELL := Vector2(2.5, 4.5)
const CLOCK_CELL := Vector2(6.6, 5.8)
const STONES_CELL := Vector2(2.5, 7.0)
const PASS_STONE_CELL := Vector2(5.35, 0.65)
## 시간 틈 문 — 이 지역 (5,0) 고개 칸 북쪽 변(y −0.5 = 은하 나루 (5,8) 남쪽 변, 월드 z 192), 칸 폭 가운데(x 5.0). 4부를 마치면(ch ≥ 18) 열린다.
const GATE_CELL := Vector2(5.0, -0.5)
const GATE_OPEN_CH := 18
## 떠 있는 섬돌 — 나선 한 바퀴 반, 섬돌마다 STONE_RISE m 씩(점프 정점 1.4m 안), 꼭대기 판은 TOP_H.
const STONE_COUNT := 15
const STONE_RISE := 1.1
const STONE_RING := 5.0
const TOP_H := 17.6
const CLOCK_H := 16.0
const ROOF_POST_H := 2.6 # 탑 윗면에서 지붕 밑까지(서는 자리 위로 머리가 걸리지 않게)
## 106장 ㊾-2 — 19장 시계탑 꼭대기에 선 뒤(CLOCK_FROM_STEP)부터 네 면 바늘이 다시 돈다.
const CH19 := 18
const CLOCK_FROM_STEP := 5

const STONE := Color(0.56, 0.54, 0.52)
const STONE_DARK := Color(0.38, 0.37, 0.38)
const ALLOY := Color(0.76, 0.79, 0.84)
const ALLOY_DARK := Color(0.28, 0.31, 0.38)
const GLOW := Color(0.55, 0.8, 1.0)
const RIFT := Color(0.72, 0.5, 1.0)
const RUST := Color(0.5, 0.3, 0.2)
const WOOD := Color(0.42, 0.24, 0.15)
const ROOF := Color(0.24, 0.25, 0.3)

var _gate_body: StaticBody3D = null
var _gate_veil: Node3D = null
var _gate_open := false
var _floaters: Array = [] # [node, base_y, phase] — 허공에 멈춘 조각이 아주 느리게 떠오르내린다(충돌 없는 것만)
var _hands: Array = [] # [시침 축, 분침 축] 네 면
var _clock_running := false
var _t := 0.0
var _check_t := 0.0

func _ready() -> void:
	add_to_group("go_crossing_region")
	var terrain := Node3D.new()
	terrain.set_script(TerrainBuilder)
	terrain.name = "CrossingTerrain"
	terrain.set("region_id", REGION)
	add_child(terrain)
	var veg := Node3D.new()
	veg.set_script(VegetationBuilder)
	veg.name = "CrossingVegetation"
	veg.set("region_id", REGION)
	add_child(veg)
	_build_rails()
	_build_station()
	_build_gate_ruin()
	_build_clock()
	_build_stones()
	_build_pass_stone()
	_build_lanterns()
	_build_gate()
	for d in DISCOVERIES:
		_add_discovery(String(d[0]), cell_pos(d[1]), float(d[2]))
	for d in SMALL:
		_build_small(String(d[0]), d[1], String(d[2]))
		_add_discovery(String(d[0]), cell_pos(d[1]), SMALL_R)
	_set_gate(gate_open())
	_clock_running = clock_running()

static func cell_pos(c: Vector2) -> Vector3:
	var p := TestMap.world_pos(c.x, c.y, REGION)
	p.y = TerrainBuilder.height_at(REGION, p)
	return p

## 4부(18장)를 마쳤는가 — 틈 고개 시간 틈 문이 열려 있다.
static func gate_open() -> bool:
	return int(PartyState.story.get("ch", 0)) >= GATE_OPEN_CH

func is_gate_open() -> bool:
	return _gate_open

## 19장 시계탑 태엽을 풀었거나 지났는가 — 바늘이 돈다.
static func clock_running() -> bool:
	var ch := int(PartyState.story.get("ch", 0))
	return ch > CH19 or (ch == CH19 and int(PartyState.story.get("step", 0)) >= CLOCK_FROM_STEP)

func is_clock_running() -> bool:
	return _clock_running

## 점검용 — 첫 면 분침 축 각도.
func minute_angle() -> float:
	return (_hands[0][1] as Node3D).rotation.z if not _hands.is_empty() else 0.0

## 떠 있는 섬돌 꼭대기 판 윗면 한가운데(월드).
static func stones_top() -> Vector3:
	return cell_pos(STONES_CELL) + Vector3(0, TOP_H + 0.3, 0)

## 시계탑 윗면 한가운데(월드).
static func clock_top() -> Vector3:
	return cell_pos(CLOCK_CELL) + Vector3(0, CLOCK_H, 0)

func _process(delta: float) -> void:
	_t += delta
	for f in _floaters:
		(f[0] as Node3D).position.y = float(f[1]) + sin(_t * 0.4 + float(f[2])) * 0.25
	_check_t -= delta
	if _check_t <= 0.0:
		_check_t = 1.0
		if gate_open() != _gate_open:
			_set_gate(gate_open())
		_clock_running = clock_running()
	if _clock_running:
		for h in _hands:
			(h[0] as Node3D).rotation.z -= delta * 0.05
			(h[1] as Node3D).rotation.z -= delta * 0.6

# ---------------------------------------------------------------- 명소

## 은하역에서 이어지는 선로 — 은하 나루 (5,7) 끝에서 고개를 지나 첫 정거장 차막이까지(월드 z, 은하역 철로와 같은 x).
func _build_rails() -> void:
	var root := Node3D.new()
	root.name = "Rails"
	add_child(root)
	var x := TestMap.world_pos(5.0, 0.0, REGION).x
	var z0 := TestMap.world_pos(5.0, 7.0, "skyport").z
	var z1 := TestMap.world_pos(5.0, 2.3, REGION).z
	var mid := (z0 + z1) * 0.5
	root.position = Vector3(x, 0.0, mid)
	var span := z1 - z0
	for dx in [-0.8, 0.8]:
		_box(root, Vector3(0.12, 0.1, span), Vector3(dx, 0.08, 0), RUST)
	var n := int(span / 3.8)
	for k in n:
		_box(root, Vector3(2.4, 0.06, 0.35), Vector3(0, 0.03, -span * 0.5 + 1.9 + k * 3.8), Color(0.3, 0.24, 0.18))

## 첫 정거장 — 선로 동쪽 승강장(올라설 수 있다)·빛 표지 지붕·시간표 판·걸상, 남쪽 끝 차막이.
func _build_station() -> void:
	var root := _root("FirstStop", STATION_CELL)
	_solid_box(root, Vector3(4.0, 0.9, 16.0), Vector3(4.2, 0.45, 0), Color(0.6, 0.6, 0.62))
	_box(root, Vector3(0.4, 0.1, 16.1), Vector3(2.4, 0.95, 0), Color(0.85, 0.75, 0.2)) # 노란 선
	for z in [-5.0, 0.0, 5.0]:
		_solid_box(root, Vector3(0.25, 3.0, 0.25), Vector3(5.6, 2.4, z), ALLOY_DARK)
	_box(root, Vector3(3.4, 0.16, 12.0), Vector3(4.6, 3.95, 0), ALLOY)
	_box(root, Vector3(3.5, 0.08, 12.1), Vector3(4.6, 3.85, 0), GLOW).material_override = _glow(GLOW, 0.6) # 지붕 밑 빛 띠
	## 역명판 — 옛 한지 두루마리 모양 판에 빛 글씨(과거·미래가 섞인 판).
	_box(root, Vector3(0.12, 0.9, 3.4), Vector3(5.9, 3.0, -2.0), Color(0.88, 0.83, 0.7))
	_box(root, Vector3(0.14, 0.2, 3.0), Vector3(5.92, 3.0, -2.0), RIFT).material_override = _glow(RIFT, 1.2)
	## 시간표 판 — 바늘 없는 시계 셋.
	_box(root, Vector3(0.12, 1.2, 1.8), Vector3(5.9, 2.0, 3.5), Color(0.15, 0.18, 0.25))
	for k in 3:
		var dial := MeshInstance3D.new()
		var cm := CylinderMesh.new()
		cm.top_radius = 0.22
		cm.bottom_radius = 0.22
		cm.height = 0.04
		dial.mesh = cm
		dial.material_override = _glow(Color(0.95, 0.9, 0.7), 0.8)
		dial.rotation.z = PI * 0.5
		dial.position = Vector3(5.83, 2.2, 2.9 + k * 0.6)
		root.add_child(dial)
	_box(root, Vector3(0.5, 0.1, 2.4), Vector3(5.2, 1.4, -5.5), WOOD) # 걸상
	## 차막이 — 선로 남쪽 끝(선로 x 0).
	_solid_box(root, Vector3(3.0, 1.2, 0.8), Vector3(0, 0.6, 15.0), Color(0.75, 0.2, 0.15))
	_box(root, Vector3(2.6, 0.2, 0.1), Vector3(0, 1.0, 14.55), Color(0.95, 0.9, 0.3))
	_label(root, "첫 정거장", Vector3(4.2, 6.0, 0), Color(0.85, 0.92, 1.0))

## 뒤엉킨 성문 — 누각을 인 돌 성문이 12° 기울고, 끊긴 성벽 조각 넷이 허공에 멈췄다(충돌 — 조각을 밟고 누각까지 오를 수 있다).
func _build_gate_ruin() -> void:
	var root := _root("TangledGate", GATE_RUIN_CELL)
	var gate := Node3D.new()
	gate.name = "Gate"
	gate.rotation.z = 0.21
	root.add_child(gate)
	for x in [-4.0, 4.0]:
		_solid_box(gate, Vector3(3.2, 7.0, 4.0), Vector3(x, 3.5, 0), STONE)
	_solid_box(gate, Vector3(11.2, 1.4, 4.4), Vector3(0, 7.7, 0), STONE_DARK) # 홍예 위 들보
	_box(gate, Vector3(8.0, 2.4, 3.2), Vector3(0, 9.6, 0), Color(0.55, 0.22, 0.16)) # 누각 몸
	_solid_box(gate, Vector3(10.0, 0.4, 5.2), Vector3(0, 11.0, 0), ROOF) # 누각 지붕(올라설 수 있다)
	_box(gate, Vector3(7.0, 0.5, 3.6), Vector3(0, 11.45, 0), ROOF)
	## 허공에 멈춘 성벽 조각 — 조금씩 기울고, 서쪽에서 누각 쪽으로 계단처럼.
	var pieces := [[Vector3(-11.0, 2.2, 3.0), 0.2], [Vector3(-9.0, 4.4, -2.5), -0.3], [Vector3(-12.0, 6.8, -5.0), 0.5], [Vector3(-8.5, 9.0, -3.0), -0.15]]
	for i in pieces.size():
		var pc := Node3D.new()
		pc.name = "Piece%d" % i
		pc.position = pieces[i][0]
		pc.rotation = Vector3(0.05 * i, float(pieces[i][1]), 0.04)
		root.add_child(pc)
		_solid_box(pc, Vector3(4.0, 1.0, 3.0), Vector3.ZERO, STONE)
		_box(pc, Vector3(4.0, 0.5, 0.6), Vector3(0, 0.75, -1.2), STONE_DARK) # 여장(성가퀴)
		## 조각 밑 틈 빛(시간이 멈춘 자리)
		_box(pc, Vector3(3.2, 0.06, 2.2), Vector3(0, -0.55, 0), RIFT).material_override = _glow(RIFT, 0.9)
	## 땅에 떨어진 기와 더미
	for k in 5:
		var t := _box(root, Vector3(1.2, 0.3, 0.8), Vector3(5.5 + k * 0.7, 0.15 + (k % 2) * 0.3, 4.0 - k * 0.4), ROOF)
		t.rotation.y = k * 0.6
	_label(root, "뒤엉킨 성문", Vector3(0, 14.0, 0), Color(0.95, 0.88, 0.72))

## 멈춘 시계탑 — 4m 네모 돌탑 16m(벽 타기로 오른다)·네 면 빛 문자판(바늘이 같은 시각에 멈춤)·뾰족 지붕.
func _build_clock() -> void:
	var root := _root("StoppedClock", CLOCK_CELL)
	_solid_box(root, Vector3(4.0, CLOCK_H, 4.0), Vector3(0, CLOCK_H * 0.5, 0), Color(0.62, 0.55, 0.48))
	_box(root, Vector3(4.4, 0.4, 4.4), Vector3(0, CLOCK_H - 3.4, 0), STONE_DARK) # 문자판 밑 띠
	var dial_y := CLOCK_H - 1.8
	for face in 4:
		var yaw := face * PI * 0.5
		var f := Node3D.new()
		f.rotation.y = yaw
		root.add_child(f)
		var dial := MeshInstance3D.new()
		var cm := CylinderMesh.new()
		cm.top_radius = 1.3
		cm.bottom_radius = 1.3
		cm.height = 0.1
		dial.mesh = cm
		dial.material_override = _glow(Color(0.98, 0.94, 0.8), 0.9)
		dial.rotation.x = PI * 0.5
		dial.position = Vector3(0, dial_y, 2.05)
		f.add_child(dial)
		## 바늘 — 문자판 한가운데 축에 매달아 돌린다(멈춘 시각 = 시침 -0.6·분침 0.55 rad).
		var hour := Node3D.new()
		hour.position = Vector3(0, dial_y, 2.12)
		hour.rotation.z = -0.6
		f.add_child(hour)
		_box(hour, Vector3(0.12, 0.8, 0.05), Vector3(0, 0.4, 0), Color(0.1, 0.1, 0.12))
		var minute := Node3D.new()
		minute.position = Vector3(0, dial_y, 2.13)
		minute.rotation.z = 0.55
		f.add_child(minute)
		_box(minute, Vector3(0.08, 1.1, 0.05), Vector3(0, 0.55, 0), Color(0.1, 0.1, 0.12))
		_hands.append([hour, minute])
	var roof := MeshInstance3D.new()
	var rm := CylinderMesh.new()
	rm.top_radius = 0.05
	rm.bottom_radius = 3.1
	rm.height = 3.2
	rm.radial_segments = 4
	roof.mesh = rm
	roof.material_override = _mat(ROOF)
	roof.rotation.y = PI * 0.25
	roof.position = Vector3(0, CLOCK_H + ROOF_POST_H + 1.6, 0)
	root.add_child(roof)
	## 지붕을 받친 모서리 기둥 넷 — 윗면 가장자리 턱이 없어 벽을 곧게 타고 올라선다(처마 밑에 걸리지 않게).
	for x in [-1.8, 1.8]:
		for z in [-1.8, 1.8]:
			_solid_box(root, Vector3(0.3, ROOF_POST_H, 0.3), Vector3(x, CLOCK_H + ROOF_POST_H * 0.5, z), STONE_DARK)
	_label(root, "멈춘 시계탑", Vector3(0, CLOCK_H + ROOF_POST_H + 4.6, 0), Color(0.95, 0.9, 0.78))

## 떠 있는 섬돌 — 틈 수정 바닥(반지름 7m) 위로 나선 섬돌 STONE_COUNT 개가 STONE_RISE m 씩 솟고, 꼭대기 판(TOP_H)에 큰 틈 수정.
func _build_stones() -> void:
	var root := _root("FloatingStones", STONES_CELL)
	var base := MeshInstance3D.new()
	var bm := CylinderMesh.new()
	bm.top_radius = 7.0
	bm.bottom_radius = 7.2
	bm.height = 0.2
	base.mesh = bm
	base.material_override = _glow(Color(0.35, 0.25, 0.55), 0.35)
	base.position = Vector3(0, 0.1, 0)
	root.add_child(base)
	for i in STONE_COUNT:
		var a := i * deg_to_rad(40.0)
		var h := 1.1 + i * STONE_RISE
		var p := Vector3(cos(a) * STONE_RING, h, sin(a) * STONE_RING)
		_solid_box(root, Vector3(2.6, 0.6, 2.6), p, STONE)
		_box(root, Vector3(2.0, 0.06, 2.0), p + Vector3(0, -0.33, 0), RIFT).material_override = _glow(RIFT, 1.0)
	_solid_box(root, Vector3(6.0, 0.6, 6.0), Vector3(0, TOP_H, 0), STONE_DARK)
	var crystal := MeshInstance3D.new()
	var cm := CylinderMesh.new()
	cm.top_radius = 0.0
	cm.bottom_radius = 0.9
	cm.height = 3.2
	cm.radial_segments = 6
	crystal.mesh = cm
	crystal.material_override = _glow(RIFT, 2.2)
	crystal.position = Vector3(0, TOP_H + 1.9, 0)
	root.add_child(crystal)
	_floaters.append([crystal, TOP_H + 1.9, 0.0])
	_label(root, "떠 있는 섬돌", Vector3(0, TOP_H + 5.0, 0), Color(0.85, 0.8, 1.0))

## 틈 고개 경계비 — 은하 나루 경계비와 짝(빛 판이 보랏빛).
func _build_pass_stone() -> void:
	var root := _root("PassStone", PASS_STONE_CELL)
	_solid_box(root, Vector3(1.2, 0.6, 0.6), Vector3(0, 0.3, 0), STONE_DARK)
	_box(root, Vector3(0.9, 2.2, 0.12), Vector3(0, 1.7, 0), RIFT).material_override = _glow(RIFT, 0.9)
	_label(root, "틈새 갈림길", Vector3(0, 3.4, 0), Color(0.9, 0.85, 1.0))

## 길가 틈 등롱 — 옛 돌 등롱에 보랏빛 불(충돌 없음 — 길을 막지 않게). 첫 정거장에서 갈림목·성문·시계탑·섬돌 쪽으로.
func _build_lanterns() -> void:
	var spots := [Vector2(5.4, 3.2), Vector2(4.6, 4.4), Vector2(3.8, 4.9), Vector2(5.4, 5.3), Vector2(5.9, 6.1), Vector2(3.9, 6.6)]
	for c in spots:
		var r := _root("Lantern", c)
		_box(r, Vector3(0.5, 0.3, 0.5), Vector3(0, 0.15, 0), STONE_DARK)
		_box(r, Vector3(0.22, 1.2, 0.22), Vector3(0, 0.9, 0), STONE)
		_box(r, Vector3(0.7, 0.55, 0.7), Vector3(0, 1.75, 0), STONE)
		_box(r, Vector3(0.45, 0.35, 0.72), Vector3(0, 1.75, 0), RIFT).material_override = _glow(RIFT, 2.0)
		_box(r, Vector3(0.95, 0.18, 0.95), Vector3(0, 2.12, 0), STONE_DARK)

## 시간 틈 문 — 고개 칸 북쪽 변에 선 보랏빛 막(충돌 상자 — 4부를 마치면 사라지고 옅은 빛 테만 남는다). 은하 나루 문과 같은 틀(돌려 세움).
func _build_gate() -> void:
	var p := TestMap.world_pos(GATE_CELL.x, GATE_CELL.y, REGION)
	p.y = TerrainBuilder.height_at(REGION, TestMap.world_pos(5.0, 0.0, REGION))
	var root := Node3D.new()
	root.name = "RiftGate"
	add_child(root)
	root.position = p
	_gate_veil = Node3D.new()
	_gate_veil.name = "Veil"
	root.add_child(_gate_veil)
	var veil := MeshInstance3D.new()
	var qm := QuadMesh.new()
	qm.size = Vector2(TestMap.TILE_SIZE, 14.0)
	veil.mesh = qm
	var vm := StandardMaterial3D.new()
	vm.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	vm.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	vm.cull_mode = BaseMaterial3D.CULL_DISABLED
	vm.albedo_color = Color(RIFT.r, RIFT.g, RIFT.b, 0.45)
	veil.material_override = vm
	veil.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	veil.position = Vector3(0, 7.0, 0)
	_gate_veil.add_child(veil)
	var lbl := Label3D.new()
	lbl.text = "시간 틈 — 아직 닫혀 있다"
	lbl.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	lbl.font_size = 40
	lbl.outline_size = 8
	lbl.pixel_size = 0.008
	lbl.modulate = Color(0.9, 0.8, 1.0)
	lbl.position = Vector3(0, 4.0, 0)
	_gate_veil.add_child(lbl)
	for k in [-1, 1]:
		var post := _box(root, Vector3(0.6, 14.0, 0.6), Vector3(k * TestMap.TILE_SIZE * 0.5, 7.0, 0), RIFT)
		post.material_override = _glow(RIFT, 1.0)
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

## 작은 발견 — 모양마다 몇 개 도형. 충돌 없음(길을 막지 않게).
func _build_small(id: String, c: Vector2, shape: String) -> void:
	var r := _root("Small_" + id, c)
	match shape:
		"dial":
			var d := MeshInstance3D.new()
			var cm := CylinderMesh.new()
			cm.top_radius = 1.6
			cm.bottom_radius = 1.6
			cm.height = 0.2
			d.mesh = cm
			d.material_override = _mat(Color(0.9, 0.86, 0.74))
			d.rotation = Vector3(0.5, 0.0, 0.2)
			d.position = Vector3(0, 0.6, 0)
			r.add_child(d)
			_box(r, Vector3(0.1, 1.2, 0.08), Vector3(0.2, 0.95, 0.35), Color(0.1, 0.1, 0.12)).rotation.x = 0.5
		"lantern":
			var l := Node3D.new()
			r.add_child(l)
			_box(l, Vector3(0.6, 0.9, 0.6), Vector3(0, 0, 0), Color(0.75, 0.2, 0.15))
			_box(l, Vector3(0.45, 0.6, 0.62), Vector3(0, 0, 0), Color(1.0, 0.8, 0.4)).material_override = _glow(Color(1.0, 0.8, 0.4), 1.6)
			l.position = Vector3(0, 3.2, 0)
			_floaters.append([l, 3.2, 1.3])
		"robot":
			_box(r, Vector3(1.0, 1.4, 0.8), Vector3(0, 0.9, 0), ALLOY)
			_box(r, Vector3(0.7, 0.5, 0.6), Vector3(0, 1.85, 0), ALLOY_DARK)
			_box(r, Vector3(0.5, 0.1, 0.62), Vector3(0, 1.9, 0.01), Color(1.0, 0.3, 0.2)).material_override = _glow(Color(1.0, 0.3, 0.2), 1.2)
			for k in [-1, 1]:
				_box(r, Vector3(0.25, 0.9, 0.25), Vector3(k * 0.65, 0.8, 0), ALLOY_DARK)
			r.rotation.z = 0.15
		"tiles":
			for k in 6:
				var t := Node3D.new()
				r.add_child(t)
				_box(t, Vector3(0.9, 0.12, 0.6), Vector3.ZERO, ROOF)
				t.rotation = Vector3(k * 0.4, k * 0.9, 0.3)
				var y := 1.4 + k * 0.45
				t.position = Vector3(cos(k * 1.1) * 1.2, y, sin(k * 1.1) * 1.0)
				_floaters.append([t, y, float(k)])
		"signal":
			_box(r, Vector3(0.18, 4.0, 0.18), Vector3(0, 2.0, 0), ALLOY_DARK)
			_box(r, Vector3(0.5, 1.3, 0.3), Vector3(0, 3.8, 0), Color(0.12, 0.12, 0.14))
			_box(r, Vector3(0.28, 0.28, 0.32), Vector3(0, 4.15, 0.02), Color(1.0, 0.25, 0.2)).material_override = _glow(Color(1.0, 0.25, 0.2), 1.8)
			_box(r, Vector3(0.28, 0.28, 0.32), Vector3(0, 3.5, 0.02), Color(0.2, 0.3, 0.2))
		"crystal":
			for k in 3:
				var cr := MeshInstance3D.new()
				var cm := CylinderMesh.new()
				cm.top_radius = 0.0
				cm.bottom_radius = 0.45 - k * 0.1
				cm.height = 2.4 - k * 0.5
				cm.radial_segments = 6
				cr.mesh = cm
				cr.material_override = _glow(RIFT, 1.5)
				cr.position = Vector3(k * 0.6 - 0.6, cm.height * 0.5, k * 0.3)
				cr.rotation.z = (k - 1) * 0.3
				r.add_child(cr)
		"cart":
			_box(r, Vector3(2.4, 0.3, 1.4), Vector3(0, 0.7, 0), WOOD).rotation.z = 0.2
			_box(r, Vector3(2.4, 0.6, 0.1), Vector3(0, 1.0, 0.7), WOOD).rotation.z = 0.2
			var wheel := MeshInstance3D.new()
			var wm := CylinderMesh.new()
			wm.top_radius = 0.6
			wm.bottom_radius = 0.6
			wm.height = 0.12
			wheel.mesh = wm
			wheel.material_override = _mat(WOOD.darkened(0.2))
			wheel.position = Vector3(1.6, 0.08, 1.2)
			r.add_child(wheel)
		"pod":
			var pod := MeshInstance3D.new()
			var pm := CapsuleMesh.new()
			pm.radius = 0.9
			pm.height = 3.0
			pod.mesh = pm
			pod.material_override = _mat(Color(0.88, 0.9, 0.94))
			pod.rotation = Vector3(0.9, 0.3, 0.2)
			pod.position = Vector3(0, 0.4, 0)
			r.add_child(pod)
			_box(r, Vector3(0.9, 0.6, 0.1), Vector3(0.2, 1.0, 0.7), GLOW).material_override = _glow(GLOW, 1.0)
		"ticket":
			_box(r, Vector3(1.0, 1.8, 0.7), Vector3(0, 0.9, 0), Color(0.2, 0.42, 0.62))
			_box(r, Vector3(0.7, 0.45, 0.72), Vector3(0, 1.35, 0.01), GLOW).material_override = _glow(GLOW, 0.8)
			_box(r, Vector3(0.3, 0.06, 0.2), Vector3(0, 0.8, 0.4), Color(0.9, 0.85, 0.7))
		"helm":
			var blade := _box(r, Vector3(0.1, 1.6, 0.25), Vector3(0, 0.7, 0), Color(0.72, 0.74, 0.76))
			blade.rotation.z = 0.12
			_box(r, Vector3(0.6, 0.1, 0.1), Vector3(-0.1, 1.4, 0), Color(0.5, 0.36, 0.18))
			var helm := MeshInstance3D.new()
			var hm := SphereMesh.new()
			hm.radius = 0.3
			hm.height = 0.4
			hm.is_hemisphere = true
			helm.mesh = hm
			helm.material_override = _mat(Color(0.35, 0.33, 0.3))
			helm.position = Vector3(0.8, 0.05, 0.3)
			helm.rotation.z = 0.6
			r.add_child(helm)

# ---------------------------------------------------------------- 도우미(region5_skyport.gd 와 같은 결)

func _root(n: String, c: Vector2) -> Node3D:
	var r := Node3D.new()
	r.name = n
	add_child(r)
	r.position = cell_pos(c)
	return r

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
	PropMaterial.apply_box(mi, size, color) # 09-29 돌 결·모서리 선 셀 재질(prop_material.gd)
	mi.position = pos
	parent.add_child(mi)
	return mi

func _solid_box(parent: Node3D, size: Vector3, pos: Vector3, color: Color) -> void:
	_box(parent, size, pos, color)
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
