extends Node3D

## PLAN 106장 ㊽ — 다섯째 지역 "은하 나루"(REGIONS["skyport"], test_map.gd). 이야기 4부의 무대.
## 15장 끝에 별배가 뜨자 "틈이 닫히는 방향"(마을 서쪽 숲 끝)에 별배가 온 시대의 땅이 이어 붙었다 — 마을 (0,4) 숲 칸과
## 이 지역 (8,3) 길 칸이 맞닿는 틈 고개. 15장을 마치기 전엔 고개에 시간 틈 문(보랏빛 막, 충돌)이 서서 못 지나간다.
## 이 파일이 짓는 것: 지형·식생(TerrainBuilder·VegetationBuilder region_id 인스턴스) · 고정 명소 넷(미래 중심에 과거·현대를 섞어) ·
## 틈 고개 경계비·시간 틈 문 · 발견 지점.
## 순간이동 지점·들판 무리·상자·별조각·채집은 각 표(waypoints·field_spawner·treasure_spawner·star_shards·cooking)에 "skyport" 줄로.
##   미래 — 별배 나루(M (4..6,1..2)): 둥근 착륙판·계류 탑(빛 고리)·계류 팔·떠 있는 빛 부표
##   과거 — 옛 절터(R (2..3,3..4)): 삼층 돌탑·주춧돌 줄·깨진 돌계단·빈 종각(17장에 종을 다시 건다)
##   현대 — 은하역(H (5,5)): 승강장·녹슨 객차(18장 막차 — 전기를 넣으면 전조등·창이 켜진다)·역 간판·철로(남쪽 길 따라)
##   현대·미래 — 태양광 밭(F (3..4,6)): 기운 전지판 줄·변전함
##   틈 고개 경계비((7.55,3.3)) · 길가 빛 가로등

const PropMaterial := preload("res://games/saga_go/world/prop_material.gd")
const TestMap := preload("res://games/saga_go/data/test_map.gd")
const TerrainBuilder := preload("res://games/saga_go/world/terrain_builder.gd")
const VegetationBuilder := preload("res://games/saga_go/world/vegetation_builder.gd")

const REGION := "skyport"
const DISCOVER_R := 30.0

## [codex id, 칸(소수), 반지름] — CodexState "place"(codex_state.gd TOTAL 에 더함).
const DISCOVERIES := [
	["skyport_region", Vector2(4.0, 4.0), 60.0],
	["skyport_pass", Vector2(7.55, 3.0), DISCOVER_R],
	["skyport_port", Vector2(5.3, 1.6), DISCOVER_R],
	["skyport_temple", Vector2(2.5, 3.5), DISCOVER_R],
	["skyport_station", Vector2(5.0, 5.0), DISCOVER_R],
	["skyport_solar", Vector2(3.5, 6.0), DISCOVER_R],
]
## 작은 발견(선택지 없는 순수 발견 — 고원·폐허 잔해와 같은 결). 발견 밀도(104-5, 반경 60m) 빈 칸을 덮는 자리. [codex id, 칸, 모양]
const SMALL := [
	["skyport_drone", Vector2(2.3, 1.2), "drone"],       # 미래 — 풀숲에 멈춘 배달 기계
	["skyport_bell", Vector2(1.2, 5.0), "bell"],         # 과거 — 쓰러진 절 종
	["skyport_phone", Vector2(6.6, 6.5), "phone"],       # 현대 — 빈 공중전화 칸
	["skyport_capsule", Vector2(2.3, 6.9), "capsule"],   # 미래 — 반쯤 묻힌 시간 캡슐
	["skyport_totem", Vector2(7.2, 2.2), "totem"],       # 과거 — 틈 고개 돌무더기 탑
	["skyport_sign", Vector2(0.9, 1.6), "sign"],         # 현대 — 숲속 녹슨 이정표
	["skyport_crates", Vector2(4.3, 0.9), "crates"],     # 미래 — 나루 뒤 화물 상자 더미
	["skyport_busstop", Vector2(3.9, 2.7), "busstop"],   # 현대 — 빈 버스 정류장
	["skyport_jars", Vector2(0.8, 3.6), "jars"],         # 과거 — 절터 서쪽 옹기 더미
	["skyport_antenna", Vector2(6.5, 3.9), "antenna"],   # 미래 — 쓰러진 안테나
]
const SMALL_R := 14.0

const PORT_CELL := Vector2(5.3, 1.6)
## 칸 좌표는 정수가 칸 한가운데(TestMap.world_pos — 칸 i 는 i ± 0.5). R 넷 (2..3,3..4) 가운데 = (2.5,3.5), F 둘 가운데 = (3.5,6).
const TEMPLE_CELL := Vector2(2.5, 3.5)
const STATION_CELL := Vector2(5.0, 5.0)
const SOLAR_CELL := Vector2(3.5, 6.0)
const PASS_STONE_CELL := Vector2(7.55, 3.3)
## 시간 틈 문 — 이 지역 (8,3) 고개 칸 동쪽 변(x 8.5 = 마을 (0,4) 서쪽 변, 월드 x −288), 칸 폭 가운데(y 3.0). 15장(ch 14)을 마치면 열린다.
const GATE_CELL := Vector2(8.5, 3.0)
const GATE_OPEN_CH := 15
const PAD_R := 9.0 # 착륙판 반지름 — 4부에서 별배가 내려앉는다
## 106장 ㊽-2 — 16장 계류 탑 신호를 켠 뒤(DOCK_FROM_STEP)부터 별배가 착륙판 위 DOCK_H m 에 매여 있다(고원의 별배는 사라진다).
## 선체 밑은 비어 있어 무리가 지나다닌다(계류대 지키기). 윗면은 올라설 수 있다.
const CH16 := 15
const DOCK_FROM_STEP := 6
const DOCK_H := 6.0
## 106장 ㊽-3 — 절터 종각(탑 동쪽). 17장 반디가 별배로 쓰러진 종을 들어 건 뒤(HANG_FROM_STEP)부터 종이 걸려 있고,
## 서쪽 비탈의 쓰러진 종(작은 발견 skyport_bell 모양)은 사라진다. 원소로 울리면(story_quest light bell) 흔들린다.
const CH17 := 16
const HANG_FROM_STEP := 8
const BELFRY_OFF := Vector3(10.0, 0.0, 2.0) # TEMPLE_CELL 한가운데에서
const BELL_Y := 2.6 # 종 한가운데 높이(종각 바닥 위)
const RING_SEC := 3.0
## 106장 ㊽-4 — 18장 태양광 밭 변전함에 전기를 넣은 뒤(POWER_FROM_STEP)부터 막차(녹슨 객차)에 전조등·창 빛이 켜지고
## 변전함 표시등이 빨강 → 초록.
const CH18 := 17
const POWER_FROM_STEP := 5
const SUBSTATION_OFF := Vector3(22.0, 0.0, 0.0) # SOLAR_CELL 한가운데에서
const OFF_RED := Color(1.0, 0.25, 0.2)
const ON_GREEN := Color(0.3, 1.0, 0.5)
const LAMP := Color(1.0, 0.92, 0.6)

const STONE := Color(0.6, 0.58, 0.55)
const STONE_DARK := Color(0.42, 0.41, 0.4)
const ALLOY := Color(0.76, 0.79, 0.84)
const ALLOY_DARK := Color(0.28, 0.31, 0.38)
const GLOW := Color(0.55, 0.8, 1.0)
const RIFT := Color(0.72, 0.5, 1.0)
const RUST := Color(0.5, 0.3, 0.2)
const PANEL := Color(0.1, 0.17, 0.34)

var _dock: Node3D = null
var _dock_body: StaticBody3D = null
var _docked := false
var _gate_body: StaticBody3D = null
var _gate_veil: Node3D = null
var _gate_open := false
var _beacon_rings: Array = []
var _hung_bell: Node3D = null
var _fallen_bell: Node3D = null
var _hung := false
var _ring_t := 0.0
var rings := 0 # 점검용 — 울린 번수
var _powered := false
var _sub_lamp: MeshInstance3D = null
var _train_lights: Array = [] # 전조등·창 빛(전기가 들어오면 보임)
var _train_windows: MeshInstance3D = null
var _t := 0.0
var _check_t := 0.0

func _ready() -> void:
	add_to_group("go_skyport_region")
	var terrain := Node3D.new()
	terrain.set_script(TerrainBuilder)
	terrain.name = "SkyportTerrain"
	terrain.set("region_id", REGION)
	add_child(terrain)
	var veg := Node3D.new()
	veg.set_script(VegetationBuilder)
	veg.name = "SkyportVegetation"
	veg.set("region_id", REGION)
	add_child(veg)
	_build_port()
	_build_temple()
	_build_station()
	_build_solar()
	_build_pass_stone()
	_build_lamps()
	_build_gate()
	for d in DISCOVERIES:
		_add_discovery(String(d[0]), cell_pos(d[1]), float(d[2]))
	for d in SMALL:
		_build_small(String(d[0]), d[1], String(d[2]))
		_add_discovery(String(d[0]), cell_pos(d[1]), SMALL_R)
	_set_gate(gate_open())
	_build_docked_ship()
	_set_dock(ship_docked())
	_set_hung(bell_hung())
	_set_power(train_powered())

static func cell_pos(c: Vector2) -> Vector3:
	var p := TestMap.world_pos(c.x, c.y, REGION)
	p.y = TerrainBuilder.height_at(REGION, p)
	return p

## 15장을 마쳤는가 — 틈 고개 시간 틈 문이 열려 있다.
static func gate_open() -> bool:
	return int(PartyState.story.get("ch", 0)) >= GATE_OPEN_CH

## 16장 계류 신호를 켰거나 지났는가 — 별배가 나루에 매여 있다(region4_frost.gd 는 고원의 별배를 숨긴다).
static func ship_docked() -> bool:
	var ch := int(PartyState.story.get("ch", 0))
	return ch > CH16 or (ch == CH16 and int(PartyState.story.get("step", 0)) >= DOCK_FROM_STEP)

func is_docked() -> bool:
	return _docked

## 17장 종을 다시 걸었거나 지났는가 — 절터 종각에 종이 걸려 있다.
static func bell_hung() -> bool:
	var ch := int(PartyState.story.get("ch", 0))
	return ch > CH17 or (ch == CH17 and int(PartyState.story.get("step", 0)) >= HANG_FROM_STEP)

func is_hung() -> bool:
	return _hung

## 18장 변전함에 전기를 넣었거나 지났는가 — 막차 전조등이 켜져 있다.
static func train_powered() -> bool:
	var ch := int(PartyState.story.get("ch", 0))
	return ch > CH18 or (ch == CH18 and int(PartyState.story.get("step", 0)) >= POWER_FROM_STEP)

func is_powered() -> bool:
	return _powered

## 변전함 자리(월드, 바닥 높이).
static func substation_pos() -> Vector3:
	return cell_pos(SOLAR_CELL) + SUBSTATION_OFF

## 종각 자리(월드, 바닥 높이).
static func belfry_pos() -> Vector3:
	return cell_pos(TEMPLE_CELL) + BELFRY_OFF

## 걸린 종을 울린다 — RING_SEC 초 동안 잦아드는 흔들림(story_quest light bell 이 부른다).
func ring_bell() -> void:
	if bell_hung() != _hung: # 1초 확인보다 먼저 울려도 걸린 종이 흔들리게
		_set_hung(bell_hung())
	if not _hung:
		return
	rings += 1
	_ring_t = RING_SEC

func is_gate_open() -> bool:
	return _gate_open

## 착륙판 윗면 한가운데(월드).
static func pad_top() -> Vector3:
	return cell_pos(PORT_CELL) + Vector3(0, 0.3, 0)

func _process(delta: float) -> void:
	_t += delta
	for i in _beacon_rings.size():
		var r: Node3D = _beacon_rings[i]
		r.position.y = 16.0 + i * 3.0 + sin(_t * 1.3 + i) * 0.5
		r.rotation.y += delta * (0.6 + i * 0.3)
	_check_t -= delta
	if _check_t <= 0.0:
		_check_t = 1.0
		if gate_open() != _gate_open:
			_set_gate(gate_open())
		if ship_docked() != _docked:
			_set_dock(ship_docked())
		if bell_hung() != _hung:
			_set_hung(bell_hung())
		if train_powered() != _powered:
			_set_power(train_powered())
	if _ring_t > 0.0:
		_ring_t = maxf(0.0, _ring_t - delta)
		var k := _ring_t / RING_SEC
		_hung_bell.rotation.x = sin((RING_SEC - _ring_t) * 9.0) * 0.28 * k * k

# ---------------------------------------------------------------- 명소

## 별배 나루 — 둥근 착륙판(올라설 수 있는 0.3m 판)·계류 탑(빛 고리 셋이 오르내림)·계류 팔 둘·표지 부스.
func _build_port() -> void:
	var root := _root("StarPort", PORT_CELL)
	var pad := MeshInstance3D.new()
	var pm := CylinderMesh.new()
	pm.top_radius = PAD_R
	pm.bottom_radius = PAD_R + 0.3
	pm.height = 0.3
	pm.radial_segments = 32
	pad.mesh = pm
	pad.material_override = _mat(ALLOY_DARK)
	pad.position = Vector3(0, 0.15, 0)
	root.add_child(pad)
	_solid_cyl(root, PAD_R, 0.3, Vector3(0, 0.15, 0))
	## 착륙판 빛 테두리·가운데 표지(원 + 십자).
	var rim := MeshInstance3D.new()
	var tm := TorusMesh.new()
	tm.inner_radius = PAD_R - 0.6
	tm.outer_radius = PAD_R - 0.3
	tm.rings = 40
	rim.mesh = tm
	rim.material_override = _glow(GLOW, 1.4)
	rim.scale = Vector3(1, 0.12, 1)
	rim.position = Vector3(0, 0.32, 0)
	root.add_child(rim)
	for k in 2:
		var bar := _box(root, Vector3(6.0, 0.02, 0.5), Vector3(0, 0.31, 0), GLOW)
		bar.material_override = _glow(GLOW, 1.0)
		bar.rotation.y = PI * 0.5 * k
	## 계류 탑 — 동쪽 끝. 가는 기둥 + 꼭대기 빛 공, 빛 고리 셋이 떠서 돈다(_process).
	var mast := Vector3(PAD_R + 3.0, 0, 0)
	_solid_box(root, Vector3(1.2, 18.0, 1.2), mast + Vector3(0, 9.0, 0), ALLOY)
	for y in [4.0, 8.0, 12.0]:
		_box(root, Vector3(1.6, 0.25, 1.6), mast + Vector3(0, y, 0), ALLOY_DARK)
	var top := MeshInstance3D.new()
	var ts := SphereMesh.new()
	ts.radius = 0.8
	ts.height = 1.6
	top.mesh = ts
	top.material_override = _glow(GLOW, 2.0)
	top.position = mast + Vector3(0, 20.4, 0) # 꼭대기(18m)에 서는 자리 위로 띄운다 — 16장 오르기
	root.add_child(top)
	for i in 3:
		var ring := MeshInstance3D.new()
		var rm := TorusMesh.new()
		rm.inner_radius = 1.6 + i * 0.3
		rm.outer_radius = 1.8 + i * 0.3
		ring.mesh = rm
		ring.material_override = _glow(GLOW.lightened(0.2), 1.2)
		ring.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		var holder := Node3D.new()
		holder.position = Vector3(mast.x, 16.0 + i * 3.0, mast.z)
		root.add_child(holder)
		holder.add_child(ring)
		ring.rotation.x = 0.25 * (i - 1)
		_beacon_rings.append(holder)
	## 계류 팔 둘 — 탑에서 착륙판 위로 뻗은 들보(별배 선체를 붙잡는 자리).
	for k in [-1, 1]:
		var arm := _box(root, Vector3(7.0, 0.5, 0.5), mast + Vector3(-3.6, 10.0, k * 1.6), ALLOY)
		arm.rotation.z = -0.12
		_box(root, Vector3(0.6, 1.2, 0.8), mast + Vector3(-7.0, 9.4, k * 1.6), GLOW).material_override = _glow(GLOW, 1.0)
	## 표지 부스 — 남서쪽(현대 매표소 모양, 창은 빛).
	var booth := Vector3(-PAD_R - 2.5, 0, 4.0)
	_solid_box(root, Vector3(2.4, 2.6, 2.0), booth + Vector3(0, 1.3, 0), Color(0.86, 0.87, 0.9))
	_box(root, Vector3(2.0, 0.9, 2.05), booth + Vector3(0, 1.7, 0), GLOW).material_override = _glow(GLOW, 0.6)
	_box(root, Vector3(2.8, 0.2, 2.4), booth + Vector3(0, 2.7, 0), ALLOY_DARK)
	_label(root, "별배 나루", Vector3(0, 7.0, 0), Color(0.7, 0.9, 1.0))

## 옛 절터 — 삼층 돌탑·주춧돌 줄(3×4)·깨진 돌계단.
func _build_temple() -> void:
	var root := _root("OldTemple", TEMPLE_CELL)
	_solid_box(root, Vector3(4.2, 0.8, 4.2), Vector3(0, 0.4, 0), STONE_DARK) # 기단
	var y := 0.8
	for k in 3:
		var w := 2.6 - k * 0.55
		var h := 1.4 - k * 0.2
		_solid_box(root, Vector3(w, h, w), Vector3(0, y + h * 0.5, 0), STONE)
		y += h
		_box(root, Vector3(w + 1.1, 0.25, w + 1.1), Vector3(0, y + 0.12, 0), STONE_DARK) # 지붕돌
		y += 0.25
	_box(root, Vector3(0.25, 1.4, 0.25), Vector3(0, y + 0.7, 0), Color(0.4, 0.34, 0.26)) # 머리 장식
	## 주춧돌 줄 — 사라진 법당 자리(북쪽).
	for i in 3:
		for j in 4:
			_box(root, Vector3(1.0, 0.3, 1.0), Vector3(-6.0 + j * 4.0, 0.15, -8.0 - i * 4.0), STONE)
	## 깨진 돌계단 — 남쪽.
	for k in 3:
		_box(root, Vector3(4.0 - k * 0.4, 0.25, 1.0), Vector3(0, 0.12 + k * 0.25, 6.0 - k * 1.0), STONE_DARK)
	_label(root, "옛 절터", Vector3(0, y + 2.4, 0), Color(0.95, 0.88, 0.72))
	_build_belfry(root)

## 절터 종각 — 돌 기단(올라설 수 있다)·나무 기둥 넷(충돌)·들보·기와 지붕 둘. 들보 한가운데 종(17장부터 보임) —
## 걸기 전엔 부러진 종고리만 늘어져 있다.
func _build_belfry(temple: Node3D) -> void:
	var b := Node3D.new()
	b.name = "Belfry"
	temple.add_child(b)
	b.position = BELFRY_OFF
	var wood := Color(0.42, 0.22, 0.14)
	_solid_box(b, Vector3(4.6, 0.4, 4.6), Vector3(0, 0.2, 0), STONE_DARK)
	for x in [-1.7, 1.7]:
		for z in [-1.7, 1.7]:
			_solid_cyl(b, 0.16, 4.2, Vector3(x, 0.4 + 2.1, z))
			var post := MeshInstance3D.new()
			var pm := CylinderMesh.new()
			pm.top_radius = 0.16
			pm.bottom_radius = 0.18
			pm.height = 4.2
			post.mesh = pm
			post.material_override = _mat(wood)
			post.position = Vector3(x, 0.4 + 2.1, z)
			b.add_child(post)
	_box(b, Vector3(4.0, 0.25, 0.3), Vector3(0, 4.45, 0), wood) # 들보(동서)
	_box(b, Vector3(0.3, 0.25, 4.0), Vector3(0, 4.45, 0), wood)
	var roof := Color(0.26, 0.27, 0.3)
	_solid_box(b, Vector3(5.6, 0.3, 5.6), Vector3(0, 4.75, 0), roof)
	_box(b, Vector3(3.6, 0.5, 3.6), Vector3(0, 5.1, 0), roof)
	_box(b, Vector3(4.2, 0.14, 0.2), Vector3(0, 5.42, 0), Color(0.72, 0.7, 0.66)) # 용마루
	var hook := _box(b, Vector3(0.08, 0.5, 0.08), Vector3(0.1, 4.08, 0), ALLOY_DARK) # 부러진 옛 종고리
	hook.rotation.z = 0.5
	_hung_bell = Node3D.new()
	_hung_bell.name = "HungBell"
	_hung_bell.position = Vector3(0, 4.3, 0) # 흔들림 축 = 고리
	b.add_child(_hung_bell)
	_box(_hung_bell, Vector3(0.12, 0.5, 0.12), Vector3(0, -0.2, 0), GLOW).material_override = _glow(GLOW, 1.2) # 새 종고리(별배 쇠)
	var bell := MeshInstance3D.new()
	var cm := CylinderMesh.new()
	cm.top_radius = 0.55
	cm.bottom_radius = 0.9
	cm.height = 1.8
	bell.mesh = cm
	bell.material_override = _mat(Color(0.35, 0.42, 0.35))
	bell.position = Vector3(0, BELL_Y - 4.3, 0)
	_hung_bell.add_child(bell)
	var lip := MeshInstance3D.new()
	var lm := TorusMesh.new()
	lm.inner_radius = 0.82
	lm.outer_radius = 0.95
	lip.mesh = lm
	lip.material_override = _mat(Color(0.3, 0.36, 0.3))
	lip.position = Vector3(0, BELL_Y - 4.3 - 0.85, 0)
	_hung_bell.add_child(lip)

## 은하역 — 승강장(올라설 수 있다)·녹슨 객차 한 칸·역 간판·철로(남쪽 길 두 칸 따라).
func _build_station() -> void:
	var root := _root("GalaxyStation", STATION_CELL)
	_solid_box(root, Vector3(6.0, 0.9, 22.0), Vector3(-5.0, 0.45, 0), Color(0.62, 0.6, 0.56)) # 승강장
	_box(root, Vector3(6.1, 0.1, 0.4), Vector3(-5.0, 0.95, 10.9), Color(0.85, 0.75, 0.2)) # 노란 선
	## 지붕 — 기둥 넷 + 판.
	for z in [-8.0, -2.5, 2.5, 8.0]:
		_solid_box(root, Vector3(0.3, 3.2, 0.3), Vector3(-6.5, 2.5, z), ALLOY_DARK)
	_box(root, Vector3(4.2, 0.2, 20.0), Vector3(-5.6, 4.2, 0), ALLOY)
	## 철로 두 줄 — 역에서 남쪽으로(길 (5,6)(5,7) 위).
	for x in [-0.8, 0.8]:
		_box(root, Vector3(0.12, 0.1, 118.0), Vector3(x, 0.08, 38.0), RUST)
	for k in 30:
		_box(root, Vector3(2.4, 0.06, 0.35), Vector3(0, 0.03, -18.0 + k * 3.8), Color(0.3, 0.24, 0.18))
	## 녹슨 객차 — 승강장 곁 철로 위(몸 충돌, 창은 빛 없는 유리).
	_solid_box(root, Vector3(3.0, 3.0, 12.0), Vector3(0, 1.8, -2.0), RUST)
	_train_windows = _box(root, Vector3(3.05, 0.9, 10.0), Vector3(0, 2.3, -2.0), Color(0.35, 0.45, 0.5))
	_box(root, Vector3(3.2, 0.25, 12.4), Vector3(0, 3.4, -2.0), RUST.darkened(0.3))
	## 18장 막차 — 남쪽 끝(선로 쪽) 전조등 둘·행선 표시판. 전기가 들어오면 보인다.
	for x in [-0.9, 0.9]:
		var hl := _box(root, Vector3(0.5, 0.35, 0.08), Vector3(x, 1.2, 4.05), LAMP)
		hl.material_override = _glow(LAMP, 3.0)
		_train_lights.append(hl)
	var sign := _box(root, Vector3(2.2, 0.4, 0.08), Vector3(0, 2.9, 4.06), GLOW)
	sign.material_override = _glow(GLOW, 1.6)
	_train_lights.append(sign)
	## 역 간판.
	_box(root, Vector3(0.2, 1.0, 3.6), Vector3(-7.9, 3.4, 0), Color(0.15, 0.3, 0.55))
	_label(root, "은하역", Vector3(-5.0, 6.0, 0), Color(0.85, 0.92, 1.0))

## 태양광 밭 — 기운 전지판 여섯 줄 + 변전함(빛 표시등).
func _build_solar() -> void:
	var root := _root("SolarField", SOLAR_CELL)
	for row in 6:
		for col in 5:
			var p := Vector3(-18.0 + col * 9.0, 0, -15.0 + row * 6.0)
			var panel := _box(root, Vector3(6.4, 0.08, 2.6), p + Vector3(0, 1.3, 0), PANEL)
			panel.rotation.x = -0.45
			_box(root, Vector3(0.12, 1.2, 0.12), p + Vector3(0, 0.6, 0), ALLOY)
	_solid_box(root, Vector3(2.0, 2.2, 1.6), SUBSTATION_OFF + Vector3(0, 1.1, 0), Color(0.82, 0.84, 0.86))
	_sub_lamp = _box(root, Vector3(0.3, 0.3, 0.05), SUBSTATION_OFF + Vector3(0.4, 1.6, 0.82), ON_GREEN)
	_label(root, "태양광 밭", Vector3(0, 4.0, 0), Color(0.8, 0.92, 1.0))

## 틈 고개 경계비 — "은하 나루" 빛 비석(돌 받침 + 빛 판).
func _build_pass_stone() -> void:
	var root := _root("PassStone", PASS_STONE_CELL)
	_solid_box(root, Vector3(1.2, 0.6, 0.6), Vector3(0, 0.3, 0), STONE_DARK)
	_box(root, Vector3(0.9, 2.2, 0.12), Vector3(0, 1.7, 0), GLOW).material_override = _glow(GLOW, 0.8)
	_label(root, "은하 나루", Vector3(0, 3.4, 0), Color(0.85, 0.92, 1.0))

## 길가 빛 가로등 — 고개에서 나루·역까지 길 곁에(충돌 없음 — 길을 막지 않게).
func _build_lamps() -> void:
	var spots := [Vector2(6.6, 3.2), Vector2(5.4, 3.3), Vector2(5.35, 4.2), Vector2(4.65, 5.3), Vector2(5.35, 6.3)]
	for c in spots:
		var r := _root("Lamp", c)
		_box(r, Vector3(0.14, 4.2, 0.14), Vector3(0, 2.1, 0), ALLOY_DARK)
		_box(r, Vector3(0.9, 0.12, 0.3), Vector3(0.35, 4.2, 0), ALLOY_DARK)
		var bulb := MeshInstance3D.new()
		var bs := SphereMesh.new()
		bs.radius = 0.22
		bs.height = 0.44
		bulb.mesh = bs
		bulb.material_override = _glow(GLOW, 2.0)
		bulb.position = Vector3(0.7, 4.0, 0)
		r.add_child(bulb)

## 시간 틈 문 — 고개 칸 동쪽 변에 선 보랏빛 막(충돌 상자 — 15장을 마치면 사라지고 옅은 빛 테만 남는다).
func _build_gate() -> void:
	var p := TestMap.world_pos(GATE_CELL.x, GATE_CELL.y, REGION)
	p.y = TerrainBuilder.height_at(REGION, TestMap.world_pos(8.0, 3.0, REGION))
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
	veil.rotation.y = PI * 0.5
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
	## 늘 남는 빛 테 — 문 기둥 둘.
	for k in [-1, 1]:
		var post := _box(root, Vector3(0.6, 14.0, 0.6), Vector3(0, 7.0, k * TestMap.TILE_SIZE * 0.5), RIFT)
		post.material_override = _glow(RIFT, 1.0)
	_gate_body = StaticBody3D.new()
	_gate_body.name = "GateBody"
	var cs := CollisionShape3D.new()
	var bs := BoxShape3D.new()
	bs.size = Vector3(1.0, 20.0, TestMap.TILE_SIZE)
	cs.shape = bs
	_gate_body.add_child(cs)
	_gate_body.position = Vector3(0, 10.0, 0)
	root.add_child(_gate_body)

## 나루에 매인 별배 — 고원 별배(region4_frost _build_airship)와 같은 모양을 수평으로, 날개 셋까지. 계류 팔 사이(동서로 길게).
func _build_docked_ship() -> void:
	_dock = Node3D.new()
	_dock.name = "DockedShip"
	add_child(_dock)
	_dock.position = cell_pos(PORT_CELL) + Vector3(0, DOCK_H, 0)
	var hull := MeshInstance3D.new()
	var cap := CapsuleMesh.new()
	cap.radius = 2.4
	cap.height = 16.0
	hull.mesh = cap
	var hm := _mat(Color(0.72, 0.76, 0.82))
	hm.metallic = 0.7
	hm.roughness = 0.35
	hull.material_override = hm
	hull.rotation.z = PI * 0.5
	_dock.add_child(hull)
	for k in [-1, 1]:
		_box(_dock, Vector3(11.0, 0.18, 0.1), Vector3(0.5, 0.6, k * 2.36), GLOW).material_override = _glow(GLOW, 1.6)
		var wing := _box(_dock, Vector3(5.0, 0.16, 4.2), Vector3(-0.5, 0.2, k * 4.3), GLOW)
		wing.material_override = _glow(GLOW, 1.2)
		wing.rotation.x = k * -0.12
	_box(_dock, Vector3(3.2, 1.8, 0.14), Vector3(0.8, 3.1, 0), GLOW).material_override = _glow(GLOW, 1.0)
	_box(_dock, Vector3(2.4, 2.6, 0.2), Vector3(-7.4, 2.2, 0), Color(0.72, 0.76, 0.82))
	_box(_dock, Vector3(2.2, 0.2, 5.2), Vector3(-7.4, 0.2, 0), Color(0.72, 0.76, 0.82))
	var nose := MeshInstance3D.new()
	var ns := SphereMesh.new()
	ns.radius = 1.6
	ns.height = 2.6
	nose.mesh = ns
	nose.material_override = _mat(Color(0.3, 0.5, 0.7))
	nose.position = Vector3(8.0, 0.1, 0)
	_dock.add_child(nose)
	_dock_body = StaticBody3D.new()
	_dock_body.name = "DockBody"
	var cs := CollisionShape3D.new()
	var bs := BoxShape3D.new()
	bs.size = Vector3(16.0, 4.2, 4.6)
	cs.shape = bs
	_dock_body.add_child(cs)
	_dock_body.position = Vector3(0, 0.0, 0)
	_dock.add_child(_dock_body)
	var l := Label3D.new()
	l.text = "별배"
	l.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	l.font_size = 44
	l.outline_size = 8
	l.pixel_size = 0.008
	l.modulate = Color(0.6, 0.95, 1.0)
	l.position = Vector3(0, 4.6, 0)
	_dock.add_child(l)

func _set_dock(on: bool) -> void:
	_docked = on
	_dock.visible = on
	_dock_body.collision_layer = 1 if on else 0

func _set_hung(on: bool) -> void:
	_hung = on
	_hung_bell.visible = on
	if _fallen_bell:
		for n in _fallen_bell.get_children():
			if n is MeshInstance3D and String(n.name) == "Bell":
				(n as Node3D).visible = not on

func _set_power(on: bool) -> void:
	_powered = on
	_sub_lamp.material_override = _glow(ON_GREEN if on else OFF_RED, 2.0)
	for n in _train_lights:
		(n as Node3D).visible = on
	_train_windows.material_override = _glow(LAMP, 0.7) if on else _mat(Color(0.35, 0.45, 0.5))

func _set_gate(open: bool) -> void:
	_gate_open = open
	_gate_veil.visible = not open
	_gate_body.collision_layer = 0 if open else 1

## 작은 발견 — 모양마다 몇 개 도형. 공중전화 칸만 몸 충돌.
func _build_small(id: String, c: Vector2, shape: String) -> void:
	var r := _root("Small_" + id, c)
	match shape:
		"drone":
			var body := MeshInstance3D.new()
			var sm := SphereMesh.new()
			sm.radius = 0.5
			sm.height = 0.7
			body.mesh = sm
			body.material_override = _mat(Color(0.92, 0.94, 0.97))
			body.position = Vector3(0, 0.35, 0)
			body.rotation.z = 0.5
			r.add_child(body)
			_box(r, Vector3(0.7, 0.1, 0.12), Vector3(0.1, 0.5, 0.42), GLOW).material_override = _glow(GLOW, 0.6)
			for k in [-1, 1]:
				_box(r, Vector3(0.9, 0.05, 0.9), Vector3(k * 0.9, 0.12, 0), ALLOY_DARK)
		"bell":
			var bell := MeshInstance3D.new()
			var cm := CylinderMesh.new()
			cm.top_radius = 0.55
			cm.bottom_radius = 0.9
			cm.height = 1.8
			bell.mesh = cm
			bell.material_override = _mat(Color(0.35, 0.42, 0.35))
			bell.rotation.z = PI * 0.5
			bell.position = Vector3(0, 0.85, 0)
			bell.name = "Bell"
			r.add_child(bell)
			_fallen_bell = r # 17장에 종각으로 옮겨 걸면 종만 사라진다(부러진 들보 조각은 남음)
			_box(r, Vector3(0.2, 2.6, 0.2), Vector3(-1.6, 1.3, 0.6), Color(0.35, 0.26, 0.18))
			_box(r, Vector3(0.2, 1.1, 0.2), Vector3(1.4, 0.55, -0.7), Color(0.35, 0.26, 0.18))
		"phone":
			_solid_box(r, Vector3(1.1, 2.3, 1.1), Vector3(0, 1.15, 0), Color(0.75, 0.2, 0.18))
			_box(r, Vector3(0.9, 1.3, 1.15), Vector3(0, 1.3, 0), Color(0.55, 0.7, 0.8))
		"capsule":
			var cap := MeshInstance3D.new()
			var ca := CapsuleMesh.new()
			ca.radius = 0.5
			ca.height = 2.2
			cap.mesh = ca
			cap.material_override = _mat(ALLOY)
			cap.rotation = Vector3(0.6, 0.3, 0.9)
			cap.position = Vector3(0, 0.3, 0)
			r.add_child(cap)
			_box(r, Vector3(0.12, 0.8, 0.12), Vector3(0.3, 0.9, 0.2), GLOW).material_override = _glow(GLOW, 1.0)
		"sign":
			_box(r, Vector3(0.15, 2.4, 0.15), Vector3(0, 1.2, 0), RUST)
			var board := _box(r, Vector3(1.4, 0.35, 0.06), Vector3(0.45, 2.1, 0), Color(0.2, 0.42, 0.3))
			board.rotation.z = -0.15
		"crates":
			for k in 4:
				var cr := _box(r, Vector3(1.4, 1.1, 1.4), Vector3((k % 2) * 1.5 - 0.7, 0.55 + (k / 2) * 1.1, (k % 3) * 0.2), ALLOY if k % 2 == 0 else ALLOY_DARK)
				cr.rotation.y = 0.2 * k
			_box(r, Vector3(1.45, 0.08, 0.1), Vector3(-0.7, 0.9, 0.72), GLOW).material_override = _glow(GLOW, 1.0)
		"busstop":
			_box(r, Vector3(3.0, 0.12, 1.3), Vector3(0, 2.4, 0), ALLOY_DARK)
			for x in [-1.4, 1.4]:
				_box(r, Vector3(0.1, 2.4, 0.1), Vector3(x, 1.2, -0.55), ALLOY)
			_box(r, Vector3(2.6, 0.1, 0.5), Vector3(0, 0.5, -0.4), Color(0.4, 0.3, 0.2)) # 걸상
			_box(r, Vector3(2.8, 1.6, 0.05), Vector3(0, 1.4, -0.62), Color(0.6, 0.72, 0.8)) # 뒤 유리
		"jars":
			for k in 5:
				var jar := MeshInstance3D.new()
				var jm := SphereMesh.new()
				jm.radius = 0.45 - (k % 3) * 0.08
				jm.height = jm.radius * 2.3
				jar.mesh = jm
				jar.material_override = _mat(Color(0.36, 0.24, 0.16))
				jar.position = Vector3(cos(k * 1.3) * 1.1, jm.radius * 1.1, sin(k * 1.3) * 0.8)
				r.add_child(jar)
		"antenna":
			var mast := _box(r, Vector3(0.2, 6.0, 0.2), Vector3(0, 0.4, 0), ALLOY)
			mast.rotation.z = PI * 0.47
			var dish := MeshInstance3D.new()
			var dm := CylinderMesh.new()
			dm.top_radius = 1.0
			dm.bottom_radius = 0.2
			dm.height = 0.4
			dish.mesh = dm
			dish.material_override = _mat(Color(0.9, 0.92, 0.95))
			dish.position = Vector3(-3.0, 0.8, 0)
			dish.rotation = Vector3(0.0, 0.0, 1.2)
			r.add_child(dish)
			_box(r, Vector3(0.3, 0.3, 0.3), Vector3(2.8, 0.3, 0), GLOW).material_override = _glow(Color(1.0, 0.3, 0.2), 2.0)
		"totem":
			for k in 5:
				_box(r, Vector3(1.0 - k * 0.15, 0.4, 0.9 - k * 0.12), Vector3(0.05 * (k % 2), 0.2 + k * 0.4, 0), STONE if k % 2 == 0 else STONE_DARK)

# ---------------------------------------------------------------- 도우미(region4_frost.gd 와 같은 결)

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

## 빛나는 재질(emission). energy 는 빛 세기.
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

func _solid_cyl(parent: Node3D, r: float, h: float, pos: Vector3) -> void:
	var body := StaticBody3D.new()
	body.position = pos
	var cs := CollisionShape3D.new()
	var shape := CylinderShape3D.new()
	shape.radius = r
	shape.height = h
	cs.shape = shape
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
