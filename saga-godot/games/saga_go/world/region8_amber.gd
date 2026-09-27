extends Node3D

## PLAN 106장 53-1 — 여덟째 지역 "굳은 거리"(REGIONS["amber"], test_map.gd). 이야기 9부의 무대(`scenario/saga-go.md` 9부).
## 틈이 닫힐 때 제자리로 못 돌아간 시대 조각이 한 순간째 굳어 붙은 번화가. 곳곳의 "굳은 자리"(호박빛 결정) 안에 사람·물건이 멈춰 있다.
## 은하 나루 (3,0) 북쪽 고개가 이 지역 (3,8) 길 칸과 맞닿는다. 1차 결말(29장)을 마치기 전(ch < 29)엔 고개에 호박빛 결정 막(충돌)이 서서 못 지나간다.
## 이 파일이 짓는 것: 지형·식생(TerrainBuilder·VegetationBuilder region_id 인스턴스) · 고정 명소 넷 · 고가 선로 · 고개 경계비·결정 막 · 발견 지점.
## 순간이동 지점·들판 무리·상자·별조각·채집·탐사지는 각 표(waypoints·field_spawner·treasure_spawner·star_shards·cooking·dispatch)에 "amber" 줄로.
##   현대 — 네거리(CROSS_CELL): 모서리 신호등 넷(빨강에 멈춤 — 32장 뒤 초록) · 굳은 자리 셋(CRYSTALS — 신호등 앞·버스 정류장·우체통, 결정 속 사람)
##     · 시계방(SHOP_CELL, 충돌 건물 + 서쪽 앞 큰 괘종시계) · 고가 선로(보기만, 기둥은 길 밖) 위 멈춘 전철
##   과거 — 호박 속 장터(MARKET_CELL, H 칸): 반지름 MARKET_R 호박 결정 돔 안 좌판 셋·천막·굳은 장돌뱅이(31장 석등 뒤 깨짐)
##   미래 — 짓다 만 부양탑(TOWER_CELL): TOWER_H m 심 기둥(벽 타기, 윗면 턱 없음) · 윗면 가운데 시간 태엽 심장(호박 알 — 32장 원소로 녹임)
##     · 그 위 공중에 걸린 층판 둘·크레인(보기만)
##   고개 경계비((3.35,7.4)) · 결정 막(고개 칸 남쪽 변)
## 세이브 없음(이야기 진행 PartyState.story 만 읽는다).

const TestMap := preload("res://games/saga_go/data/test_map.gd")
const TerrainBuilder := preload("res://games/saga_go/world/terrain_builder.gd")
const VegetationBuilder := preload("res://games/saga_go/world/vegetation_builder.gd")

const REGION := "amber"
const DISCOVER_R := 30.0

## [codex id, 칸(소수), 반지름] — CodexState "place"(codex_state.gd TOTAL 에 더함).
const DISCOVERIES := [
	["amber_region", Vector2(4.0, 4.0), 60.0],
	["amber_pass", Vector2(3.0, 7.5), DISCOVER_R],
	["amber_cross", Vector2(4.3, 4.2), DISCOVER_R],
	["amber_shop", Vector2(6.4, 5.3), DISCOVER_R],
	["amber_market", Vector2(1.5, 3.5), DISCOVER_R],
	["amber_tower", Vector2(4.0, 1.4), DISCOVER_R],
]
## 작은 발견(선택지 없는 순수 발견). [codex id, 칸, 모양]
const SMALL := [
	["amber_bike", Vector2(2.4, 5.6), "bike"],           # 현대 — 쓰러지다 멈춘 자전거
	["amber_phone", Vector2(5.6, 6.3), "phone"],         # 현대 — 공중전화 부스
	["amber_pigeons", Vector2(5.2, 3.2), "pigeons"],     # 현대·틈 — 날아오르다 굳은 비둘기 떼
	["amber_scale", Vector2(1.3, 5.2), "scale"],         # 과거 — 장터 저울
	["amber_coins", Vector2(2.2, 2.4), "coins"],         # 과거 — 흩어진 엽전 꾸러미
	["amber_blueprint", Vector2(6.2, 1.6), "blueprint"], # 미래 — 공중에 뜬 빛 설계 도면
	["amber_surveyor", Vector2(7.2, 3.4), "surveyor"],   # 미래 — 멈춘 측량 드론
	["amber_kiosk", Vector2(3.2, 6.4), "kiosk"],         # 현대 — 신문 가판대
	["amber_shard", Vector2(6.6, 7.0), "shard"],         # 틈 — 땅에서 솟은 호박 결정 덩이
	["amber_umbrella", Vector2(1.6, 6.9), "umbrella"],   # 현대 — 허공에 멈춘 빗방울과 우산
]
const SMALL_R := 14.0

const CROSS_CELL := Vector2(4.3, 4.2)
const SHOP_CELL := Vector2(6.4, 5.3)
const MARKET_CELL := Vector2(1.5, 3.5)
const TOWER_CELL := Vector2(4.0, 1.4)
const PASS_STONE_CELL := Vector2(3.35, 7.4)
## 굳은 자리 셋 — [이름, 칸, 속 물건]. 30장(CH30)에 원소로 녹인다(CRYSTAL_OFF_FROM 단계부터 녹아 있음).
const CRYSTALS := [
	["신호등 앞", Vector2(4.6, 3.9), "signal"],
	["버스 정류장", Vector2(4.95, 4.55), "bus"],
	["우체통", Vector2(3.7, 4.55), "post"],
]
const CRYSTAL_R := 1.3
## 결정 막 — 이 지역 (3,8) 고개 칸 남쪽 변(y 8.5 = 은하 나루 (3,0) 북쪽 변). 1차 결말(ch ≥ 29)을 마치면 풀린다.
const GATE_CELL := Vector2(3.0, 8.5)
const GATE_OPEN_CH := 29
const MARKET_R := 4.6 # 장터 결정 돔 — 31장 석등 고리(SEAL_RING 6m)가 바깥에 선다
const SHOP_SIZE := Vector3(5.0, 4.2, 5.0)
const TOWER_W := 6.0
const TOWER_H := 12.0
const RAIL_Y := 7.0
const RAIL_ROW := 2.35
## 이야기 9부 — 장(0부터)·단계. 30장 굳은 자리 셋 · 31장 장터 · 32장 태엽 심장·시간이 다시 흐름.
const CH30 := 29
const CH31 := 30
const CH32 := 31
const CRYSTAL_OFF_FROM := [5, 6, 7]
const MARKET_FREE_STEP := 2
const CLOCK_WIND_STEP := 5 # 31장 시계방 지키기(defend) 동안 괘종시계 바늘이 빙빙 돈다(되감기)
const HEART_OFF_STEP := 3
const FLOW_STEP := 5

const AMBER := Color(1.0, 0.68, 0.22)
const AMBER_DARK := Color(0.62, 0.38, 0.12)
const ASPHALT := Color(0.26, 0.26, 0.28)
const CONCRETE := Color(0.66, 0.65, 0.62)
const STEEL := Color(0.62, 0.65, 0.68)
const STEEL_DARK := Color(0.28, 0.3, 0.33)
const BRICK := Color(0.55, 0.32, 0.26)
const WOOD := Color(0.45, 0.3, 0.18)
const CLOTH := Color(0.78, 0.7, 0.52)
const ALLOY := Color(0.84, 0.88, 0.93)
const GLOW := Color(0.5, 0.88, 1.0)
const RED := Color(1.0, 0.22, 0.18)
const GREEN := Color(0.3, 1.0, 0.45)

var _gate_body: StaticBody3D = null
var _gate_veil: Node3D = null
var _gate_open := false
var _crystals: Array = [] # [결정 Node3D(속 사람 포함)]
var _market_dome: Node3D = null
var _heart: MeshInstance3D = null
var _clock_hand: MeshInstance3D = null
var _lamps: Array = [] # 신호등 빛 재질
var _floaters: Array = [] # [node, base_y, phase]
var _state := ""
var _t := 0.0
var _check_t := 0.0

func _ready() -> void:
	add_to_group("go_amber_region")
	var terrain := Node3D.new()
	terrain.set_script(TerrainBuilder)
	terrain.name = "AmberTerrain"
	terrain.set("region_id", REGION)
	add_child(terrain)
	var veg := Node3D.new()
	veg.set_script(VegetationBuilder)
	veg.name = "AmberVegetation"
	veg.set("region_id", REGION)
	add_child(veg)
	_build_crossroad()
	_build_shop()
	_build_market()
	_build_tower()
	_build_rail()
	_build_pass_stone()
	_build_gate()
	for d in DISCOVERIES:
		_add_discovery(String(d[0]), cell_pos(d[1]), float(d[2]))
	for d in SMALL:
		_build_small(String(d[0]), d[1], String(d[2]))
		_add_discovery(String(d[0]), cell_pos(d[1]), SMALL_R)
	_refresh()

static func cell_pos(c: Vector2) -> Vector3:
	var p := TestMap.world_pos(c.x, c.y, REGION)
	p.y = TerrainBuilder.height_at(REGION, p)
	return p

static func _ch() -> int:
	return int(PartyState.story.get("ch", 0))

static func _reached(ch: int, step: int) -> bool:
	var c := _ch()
	return c > ch or (c == ch and int(PartyState.story.get("step", 0)) >= step)

## 1차 결말(29장)을 마쳤는가 — 고개 결정 막이 풀려 있다.
static func gate_open() -> bool:
	return _ch() >= GATE_OPEN_CH

static func crystal_melted(k: int) -> bool:
	return _reached(CH30, int(CRYSTAL_OFF_FROM[k]))

static func market_free() -> bool:
	return _reached(CH31, MARKET_FREE_STEP)

static func heart_melted() -> bool:
	return _reached(CH32, HEART_OFF_STEP)

## 32장 이야기 보스를 쓰러뜨렸거나 지났는가 — 거리 시간이 다시 흐른다(신호등 초록).
static func time_flows() -> bool:
	return _reached(CH32, FLOW_STEP)

## 부양탑 윗면 한가운데(월드) · 시간 태엽 심장 자리.
static func clock_winding() -> bool:
	return _ch() == CH31 and int(PartyState.story.get("step", 0)) == CLOCK_WIND_STEP

static func tower_top() -> Vector3:
	return cell_pos(TOWER_CELL) + Vector3(0, TOWER_H, 0)

static func crystal_pos(k: int) -> Vector3:
	return cell_pos(CRYSTALS[k][1])

func is_gate_open() -> bool:
	return _gate_open

func crystal_visible(k: int) -> bool:
	return k < _crystals.size() and (_crystals[k] as Node3D).visible

func market_sealed() -> bool:
	return _market_dome != null and _market_dome.visible

func heart_lit() -> bool:
	return _heart != null and _heart.visible

func lamp_green() -> bool:
	return not _lamps.is_empty() and (_lamps[0] as StandardMaterial3D).albedo_color == GREEN

func _refresh() -> void:
	var key := "%d:%d" % [_ch(), int(PartyState.story.get("step", 0))]
	if key == _state:
		return
	_state = key
	_set_gate(gate_open())
	for k in _crystals.size():
		(_crystals[k] as Node3D).visible = not crystal_melted(k)
	_market_dome.visible = not market_free()
	_heart.visible = not heart_melted()
	var c := GREEN if time_flows() else RED
	for m in _lamps:
		(m as StandardMaterial3D).albedo_color = c
		(m as StandardMaterial3D).emission = c

func _process(delta: float) -> void:
	_t += delta
	for f in _floaters:
		(f[0] as Node3D).position.y = float(f[1]) + sin(_t * 0.35 + float(f[2])) * 0.2
	if _clock_hand and clock_winding():
		_clock_hand.rotation.x -= delta * 4.0
	_check_t -= delta
	if _check_t <= 0.0:
		_check_t = 1.0
		_refresh()

# ---------------------------------------------------------------- 명소

## 네거리 — 모서리 신호등 넷 · 건널목 줄 · 굳은 자리 셋(결정 속 사람 + 신호등·정류장·우체통).
func _build_crossroad() -> void:
	var root := _root("Crossroad", CROSS_CELL)
	for i in 6:
		_box(root, Vector3(0.7, 0.03, 5.0), Vector3(-4.0 + i * 1.6, 0.05, -7.5), Color(0.92, 0.92, 0.88))
	for x in [-6.5, 6.5]:
		for z in [-6.5, 6.5]:
			_signal(root, Vector3(x, 0, z))
	for k in CRYSTALS.size():
		var c: Vector2 = CRYSTALS[k][1]
		var r := _root("Stuck_%d" % k, c)
		match String(CRYSTALS[k][2]):
			"signal":
				_signal(r, Vector3(1.6, 0, 0))
			"bus":
				_box(r, Vector3(3.2, 0.12, 1.6), Vector3(0, 2.5, -0.6), ALLOY)
				_box(r, Vector3(3.2, 2.4, 0.08), Vector3(0, 1.25, -1.35), Color(0.6, 0.8, 0.9, 1.0))
				for x in [-1.5, 1.5]:
					_box(r, Vector3(0.1, 2.5, 0.1), Vector3(x, 1.25, -1.3), STEEL_DARK)
				_box(r, Vector3(2.4, 0.08, 0.5), Vector3(0, 0.5, -1.0), WOOD)
				_label(r, "정류장", Vector3(0, 3.1, -0.6), Color(0.9, 0.95, 1.0))
			"post":
				_box(r, Vector3(0.7, 1.2, 0.6), Vector3(1.3, 0.6, 0), RED)
				_box(r, Vector3(0.75, 0.2, 0.65), Vector3(1.3, 1.25, 0), RED.darkened(0.3))
		## 결정 — 호박빛 달걀꼴 + 속에 굳은 사람(캡슐)
		var shell := Node3D.new()
		shell.name = "Crystal"
		r.add_child(shell)
		var person := MeshInstance3D.new()
		var pm := CapsuleMesh.new()
		pm.radius = 0.32
		pm.height = 1.7
		person.mesh = pm
		person.material_override = _mat(Color(0.35, 0.3, 0.28))
		person.position = Vector3(0, 0.9, 0)
		shell.add_child(person)
		var egg := MeshInstance3D.new()
		var em := SphereMesh.new()
		em.radius = CRYSTAL_R
		em.height = CRYSTAL_R * 2.0
		egg.mesh = em
		egg.material_override = _amber_glass(0.5)
		egg.scale = Vector3(1.0, 1.4, 1.0)
		egg.position = Vector3(0, 1.1, 0)
		egg.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		shell.add_child(egg)
		_label(shell, "굳은 자리 — %s" % String(CRYSTALS[k][0]), Vector3(0, 3.4, 0), AMBER)
		_crystals.append(shell)

## 신호등 — 기둥·팔·등 셋(빨강 등만 빛남 — 재질을 _lamps 에 모아 시간이 흐르면 초록으로).
func _signal(parent: Node3D, pos: Vector3) -> void:
	_box(parent, Vector3(0.18, 4.2, 0.18), pos + Vector3(0, 2.1, 0), STEEL_DARK)
	_box(parent, Vector3(0.45, 1.2, 0.35), pos + Vector3(0, 4.3, 0), Color(0.12, 0.12, 0.14))
	var lamp := _box(parent, Vector3(0.3, 0.3, 0.38), pos + Vector3(0, 4.62, 0), RED)
	var m := _glow(RED, 1.8)
	lamp.material_override = m
	_lamps.append(m)
	_box(parent, Vector3(0.3, 0.3, 0.38), pos + Vector3(0, 3.98, 0), Color(0.2, 0.2, 0.18))

## 시계방 — 벽돌 가게(충돌) · 지붕 차양 · 간판 · 서쪽 앞 큰 괘종시계(보기만, 바늘 멈춤).
func _build_shop() -> void:
	var root := _root("ClockShop", SHOP_CELL)
	_solid_box(root, SHOP_SIZE, Vector3(0, SHOP_SIZE.y * 0.5, 0), BRICK)
	_box(root, Vector3(5.4, 0.25, 5.4), Vector3(0, SHOP_SIZE.y + 0.12, 0), STEEL_DARK)
	_box(root, Vector3(0.1, 1.8, 3.2), Vector3(-2.55, 1.2, 0), Color(0.55, 0.75, 0.85)) # 진열창
	var awning := _box(root, Vector3(1.4, 0.1, 5.2), Vector3(-3.1, 3.2, 0), Color(0.2, 0.42, 0.36))
	awning.rotation.z = -0.25
	_label(root, "초롱 시계방", Vector3(-2.7, 4.0, 0), Color(1.0, 0.92, 0.7))
	var clock := Node3D.new()
	clock.position = Vector3(-3.6, 0, 2.0)
	root.add_child(clock)
	_box(clock, Vector3(0.9, 2.6, 0.6), Vector3(0, 1.3, 0), WOOD)
	var dial := MeshInstance3D.new()
	var dm := CylinderMesh.new()
	dm.top_radius = 0.38
	dm.bottom_radius = 0.38
	dm.height = 0.05
	dial.mesh = dm
	dial.material_override = _glow(Color(0.98, 0.94, 0.8), 0.6)
	dial.rotation.z = PI * 0.5
	dial.position = Vector3(-0.47, 2.1, 0)
	clock.add_child(dial)
	_clock_hand = _box(clock, Vector3(0.05, 0.5, 0.06), Vector3(-0.52, 2.1, 0.0), Color(0.1, 0.1, 0.12))
	_clock_hand.rotation.x = 0.6

## 호박 속 장터 — 좌판 셋·천막·굳은 장돌뱅이, 둘레 결정 돔(31장 석등 뒤 걷힘).
func _build_market() -> void:
	var root := _root("AmberMarket", MARKET_CELL)
	for i in 3:
		var a := TAU * i / 3.0 + 0.4
		var st := Node3D.new()
		st.position = Vector3(cos(a), 0, sin(a)) * 2.6
		st.rotation.y = -a
		root.add_child(st)
		_box(st, Vector3(1.8, 0.8, 1.0), Vector3(0, 0.4, 0), WOOD)
		_box(st, Vector3(2.0, 0.08, 1.2), Vector3(0, 2.1, 0), CLOTH)
		for x in [-0.85, 0.85]:
			_box(st, Vector3(0.08, 2.1, 0.08), Vector3(x, 1.05, 0.5), WOOD.darkened(0.2))
		for k in 3:
			_box(st, Vector3(0.3, 0.25, 0.3), Vector3(-0.5 + k * 0.5, 0.92, 0), [Color(0.85, 0.3, 0.2), Color(0.9, 0.75, 0.3), Color(0.4, 0.6, 0.3)][k])
	_market_dome = Node3D.new()
	_market_dome.name = "MarketCrystal"
	root.add_child(_market_dome)
	var man := MeshInstance3D.new()
	var mm := CapsuleMesh.new()
	mm.radius = 0.34
	mm.height = 1.7
	man.mesh = mm
	man.material_override = _mat(Color(0.5, 0.4, 0.3))
	man.position = Vector3(0, 0.9, 0)
	_market_dome.add_child(man)
	var dome := MeshInstance3D.new()
	var sm := SphereMesh.new()
	sm.radius = MARKET_R
	sm.height = MARKET_R * 2.0
	sm.is_hemisphere = true
	dome.mesh = sm
	dome.material_override = _amber_glass(0.35)
	dome.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	_market_dome.add_child(dome)
	_label(_market_dome, "굳은 장터", Vector3(0, MARKET_R + 1.2, 0), AMBER)
	for k in 5:
		var mote := _box(_market_dome, Vector3(0.25, 0.25, 0.25), Vector3(cos(k * 1.3) * 5.4, 1.5 + k * 0.5, sin(k * 1.3) * 5.4), AMBER)
		mote.material_override = _glow(AMBER, 1.4)
		_floaters.append([mote, mote.position.y, float(k)])

## 짓다 만 부양탑 — 심 기둥(충돌, 벽 타기 — 윗면에 턱 없음) · 윗면 시간 태엽 심장(호박 알) · 공중에 걸린 층판 둘·크레인(보기만).
func _build_tower() -> void:
	var root := _root("FloatTower", TOWER_CELL)
	_solid_box(root, Vector3(TOWER_W, TOWER_H, TOWER_W), Vector3(0, TOWER_H * 0.5, 0), CONCRETE)
	for y in [3.0, 6.0, 9.0]:
		_box(root, Vector3(TOWER_W + 0.1, 0.25, TOWER_W + 0.1), Vector3(0, y, 0), STEEL_DARK)
	for i in 4:
		var yaw := i * PI * 0.5
		var strip := _box(root, Vector3(0.12, TOWER_H - 1.0, 0.12), Vector3(sin(yaw) * 3.05, TOWER_H * 0.5, cos(yaw) * 3.05), GLOW)
		strip.material_override = _glow(GLOW, 0.8)
	_heart = MeshInstance3D.new()
	var hm := SphereMesh.new()
	hm.radius = 0.8
	hm.height = 1.6
	_heart.mesh = hm
	_heart.material_override = _glow(AMBER, 2.2)
	_heart.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	_heart.position = Vector3(0, TOWER_H + 1.3, 0)
	root.add_child(_heart)
	var cradle := _box(root, Vector3(1.2, 0.3, 1.2), Vector3(0, TOWER_H + 0.15, 0), STEEL_DARK)
	cradle.name = "HeartCradle"
	## 공중에 걸린 층판 둘 — 띄우다 멈춤(보기만, 떠 돈다)
	for i in 2:
		var slab := Node3D.new()
		slab.position = Vector3(0, TOWER_H + 5.0 + i * 3.5, 0)
		slab.rotation = Vector3(0.05 * (i + 1), 0.4 * i, -0.04)
		root.add_child(slab)
		_box(slab, Vector3(TOWER_W + 1.0, 0.4, TOWER_W + 1.0), Vector3.ZERO, ALLOY)
		var rim := _box(slab, Vector3(TOWER_W + 1.1, 0.1, TOWER_W + 1.1), Vector3(0, -0.25, 0), GLOW)
		rim.material_override = _glow(GLOW, 1.2)
		_floaters.append([slab, slab.position.y, float(i) * 2.0])
	var crane := Node3D.new()
	crane.position = Vector3(5.5, 0, -2.0)
	root.add_child(crane)
	_box(crane, Vector3(0.6, 20.0, 0.6), Vector3(0, 10.0, 0), Color(0.95, 0.72, 0.15))
	_box(crane, Vector3(14.0, 0.5, 0.5), Vector3(-4.0, 20.2, 0), Color(0.95, 0.72, 0.15))
	_box(crane, Vector3(0.06, 6.0, 0.06), Vector3(-9.5, 17.0, 0), STEEL_DARK)
	_label(root, "짓다 만 부양탑", Vector3(0, TOWER_H + 12.5, 0), Color(0.85, 0.95, 1.0))

## 고가 선로 — 기둥(길 밖)·들보·멈춘 전철 한 칸(모두 보기만 — 밑으로 걸어 지난다).
func _build_rail() -> void:
	var a := cell_pos(Vector2(0.8, RAIL_ROW))
	var b := cell_pos(Vector2(7.2, RAIL_ROW))
	var root := Node3D.new()
	root.name = "ElevatedRail"
	add_child(root)
	var y := maxf(a.y, b.y) + RAIL_Y
	var mid := (a + b) * 0.5
	var beam := _box(root, Vector3(b.x - a.x, 0.8, 3.2), Vector3(mid.x, y, mid.z), CONCRETE)
	beam.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_ON
	for x in [1.2, 2.6, 5.4, 6.8]:
		var p := cell_pos(Vector2(x, RAIL_ROW))
		_box(root, Vector3(1.0, y - p.y, 1.0), Vector3(p.x, (y + p.y) * 0.5, p.z), CONCRETE.darkened(0.15))
	var car := cell_pos(Vector2(5.6, RAIL_ROW))
	_box(root, Vector3(16.0, 3.0, 2.8), Vector3(car.x, y + 1.9, car.z), Color(0.82, 0.84, 0.86))
	_box(root, Vector3(16.05, 0.5, 2.85), Vector3(car.x, y + 1.2, car.z), Color(0.2, 0.45, 0.7))
	for k in 6:
		_box(root, Vector3(1.6, 1.0, 2.9), Vector3(car.x - 6.0 + k * 2.4, y + 2.4, car.z), Color(0.55, 0.72, 0.82))

func _build_pass_stone() -> void:
	var root := _root("PassStone", PASS_STONE_CELL)
	_solid_box(root, Vector3(1.2, 0.6, 0.6), Vector3(0, 0.3, 0), CONCRETE.darkened(0.3))
	_box(root, Vector3(0.9, 2.2, 0.12), Vector3(0, 1.7, 0), AMBER).material_override = _glow(AMBER, 0.9)
	_label(root, "굳은 거리", Vector3(0, 3.4, 0), Color(1.0, 0.9, 0.7))

## 결정 막 — 고개 칸 남쪽 변에 선 호박빛 막(충돌 — 1차 결말 뒤 사라지고 옅은 테만). 틈새 갈림길 시간 틈 문과 같은 틀.
func _build_gate() -> void:
	var p := TestMap.world_pos(GATE_CELL.x, GATE_CELL.y, REGION)
	p.y = TerrainBuilder.height_at(REGION, TestMap.world_pos(3.0, 8.0, REGION))
	var root := Node3D.new()
	root.name = "AmberGate"
	add_child(root)
	root.position = p
	_gate_veil = Node3D.new()
	_gate_veil.name = "Veil"
	root.add_child(_gate_veil)
	var veil := MeshInstance3D.new()
	var qm := QuadMesh.new()
	qm.size = Vector2(TestMap.TILE_SIZE, 14.0)
	veil.mesh = qm
	veil.material_override = _amber_glass(0.5)
	veil.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	veil.position = Vector3(0, 7.0, 0)
	_gate_veil.add_child(veil)
	var lbl := Label3D.new()
	lbl.text = "굳은 결정 — 아직 풀리지 않았다"
	lbl.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	lbl.font_size = 40
	lbl.outline_size = 8
	lbl.pixel_size = 0.008
	lbl.modulate = Color(1.0, 0.85, 0.55)
	lbl.position = Vector3(0, 4.0, 0)
	_gate_veil.add_child(lbl)
	for k in [-1, 1]:
		_box(root, Vector3(0.6, 14.0, 0.6), Vector3(k * TestMap.TILE_SIZE * 0.5, 7.0, 0), AMBER).material_override = _glow(AMBER, 1.0)
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
		"bike":
			var b := Node3D.new()
			b.rotation.z = 0.5
			b.position = Vector3(0, 0.5, 0)
			r.add_child(b)
			for x in [-0.6, 0.6]:
				var w := MeshInstance3D.new()
				var tm := TorusMesh.new()
				tm.inner_radius = 0.28
				tm.outer_radius = 0.34
				w.mesh = tm
				w.material_override = _mat(Color(0.1, 0.1, 0.12))
				w.rotation.x = PI * 0.5
				w.position = Vector3(x, 0, 0)
				b.add_child(w)
			_box(b, Vector3(1.2, 0.08, 0.08), Vector3(0, 0.3, 0), Color(0.2, 0.5, 0.8))
			_box(b, Vector3(0.08, 0.6, 0.08), Vector3(0.4, 0.5, 0), Color(0.2, 0.5, 0.8))
		"phone":
			_box(r, Vector3(1.2, 2.4, 1.2), Vector3(0, 1.2, 0), Color(0.75, 0.2, 0.15))
			_box(r, Vector3(1.0, 1.6, 1.22), Vector3(0, 1.3, 0), Color(0.6, 0.78, 0.86))
			_box(r, Vector3(1.3, 0.25, 1.3), Vector3(0, 2.5, 0), Color(0.75, 0.2, 0.15))
		"pigeons":
			for k in 7:
				var bird := _box(r, Vector3(0.35, 0.18, 0.2), Vector3(cos(k * 0.9) * 1.4, 1.2 + k * 0.35, sin(k * 0.9) * 1.2), Color(0.6, 0.62, 0.66))
				bird.rotation = Vector3(0.3, k * 0.7, 0.2)
				var halo := _box(r, Vector3(0.5, 0.35, 0.35), bird.position, AMBER)
				halo.material_override = _amber_glass(0.4)
				_floaters.append([bird, bird.position.y, float(k)])
				_floaters.append([halo, halo.position.y, float(k)])
		"scale":
			_box(r, Vector3(0.1, 1.4, 0.1), Vector3(0, 0.7, 0), WOOD)
			_box(r, Vector3(1.4, 0.06, 0.06), Vector3(0, 1.4, 0), WOOD).rotation.z = 0.15
			for x in [-0.65, 0.65]:
				var pan := MeshInstance3D.new()
				var pm := CylinderMesh.new()
				pm.top_radius = 0.28
				pm.bottom_radius = 0.2
				pm.height = 0.08
				pan.mesh = pm
				pan.material_override = _mat(Color(0.7, 0.55, 0.3))
				pan.position = Vector3(x, 1.0 - x * 0.15, 0)
				r.add_child(pan)
		"coins":
			for k in 5:
				var coin := MeshInstance3D.new()
				var cm := CylinderMesh.new()
				cm.top_radius = 0.15
				cm.bottom_radius = 0.15
				cm.height = 0.03
				coin.mesh = cm
				coin.material_override = _mat(Color(0.72, 0.58, 0.3))
				coin.position = Vector3(cos(k * 1.7) * 0.6, 0.05 + k * 0.02, sin(k * 1.7) * 0.5)
				r.add_child(coin)
			_box(r, Vector3(0.8, 0.05, 0.05), Vector3(0, 0.06, 0), Color(0.6, 0.2, 0.15))
		"blueprint":
			var bp := _box(r, Vector3(2.4, 1.6, 0.03), Vector3(0, 2.6, 0), GLOW)
			bp.material_override = _glow(GLOW, 0.9)
			bp.rotation.x = -0.3
			_floaters.append([bp, 2.6, 0.7])
		"surveyor":
			var d := Node3D.new()
			d.position = Vector3(0, 1.8, 0)
			r.add_child(d)
			_box(d, Vector3(0.8, 0.3, 0.8), Vector3.ZERO, ALLOY)
			_box(d, Vector3(0.2, 0.2, 0.2), Vector3(0, -0.25, 0.3), RED).material_override = _glow(RED, 1.0)
			for k in 4:
				_box(d, Vector3(0.5, 0.04, 0.12), Vector3(cos(k * PI * 0.5) * 0.6, 0.18, sin(k * PI * 0.5) * 0.6), STEEL_DARK)
			_floaters.append([d, 1.8, 2.2])
		"kiosk":
			_box(r, Vector3(1.8, 2.2, 1.2), Vector3(0, 1.1, 0), Color(0.3, 0.5, 0.35))
			_box(r, Vector3(2.0, 0.15, 1.5), Vector3(0, 2.3, 0.1), Color(0.8, 0.75, 0.6))
			for k in 4:
				_box(r, Vector3(0.35, 0.5, 0.04), Vector3(-0.6 + k * 0.4, 1.3, 0.62), Color(0.92, 0.9, 0.84))
		"shard":
			for k in 4:
				var cr := MeshInstance3D.new()
				var cm := CylinderMesh.new()
				cm.top_radius = 0.0
				cm.bottom_radius = 0.5 - k * 0.08
				cm.height = 2.6 - k * 0.4
				cm.radial_segments = 6
				cr.mesh = cm
				cr.material_override = _glow(AMBER, 1.2)
				cr.position = Vector3(k * 0.5 - 0.7, cm.height * 0.5, (k % 2) * 0.4)
				cr.rotation.z = (k - 1.5) * 0.25
				r.add_child(cr)
		"umbrella":
			var um := MeshInstance3D.new()
			var cm := CylinderMesh.new()
			cm.top_radius = 0.05
			cm.bottom_radius = 1.0
			cm.height = 0.5
			um.mesh = cm
			um.material_override = _mat(Color(0.25, 0.3, 0.6))
			um.position = Vector3(0, 2.2, 0)
			um.rotation.z = 0.3
			r.add_child(um)
			_box(r, Vector3(0.05, 1.6, 0.05), Vector3(0.2, 1.3, 0), STEEL_DARK).rotation.z = 0.3
			for k in 8:
				var drop := _box(r, Vector3(0.05, 0.2, 0.05), Vector3(cos(k * 2.1) * 2.0, 1.0 + (k % 4) * 0.7, sin(k * 2.1) * 2.0), Color(0.7, 0.85, 1.0))
				drop.material_override = _amber_glass(0.7)

# ---------------------------------------------------------------- 도우미(region6_crossing.gd 와 같은 결)

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

## 호박빛 반투명 — 결정·막.
func _amber_glass(alpha: float) -> StandardMaterial3D:
	var m := StandardMaterial3D.new()
	m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	m.albedo_color = Color(AMBER.r, AMBER.g, AMBER.b, alpha)
	m.emission_enabled = true
	m.emission = AMBER_DARK
	m.emission_energy_multiplier = 0.6
	m.cull_mode = BaseMaterial3D.CULL_DISABLED
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
