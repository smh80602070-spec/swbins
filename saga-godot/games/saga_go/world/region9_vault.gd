extends Node3D

## PLAN 106장 54-1 — 아홉째 지역 "갈무리 벌"(REGIONS["vault"], test_map.gd). 이야기 10부의 무대(`scenario/saga-go-part10.md`).
## 서리봉 고원 동쪽 절벽 너머, 지도에서 비어 있던 북동쪽 끝. 세 시대가 저마다 무언가를 쌓아 두던 벌판이 한데 붙었다.
## 서리봉 고원 (8,3) 동쪽 고개가 이 지역 (0,3) 길 칸과 맞닿는다. 9부(32장)를 마치기 전(ch < 32)엔 고개에 빛 울타리(충돌)가 서서 못 지나간다.
## 이 파일이 짓는 것: 지형·식생(TerrainBuilder·VegetationBuilder region_id 인스턴스) · 고정 명소 넷 · 고개 장승·빛 울타리 · 발견 지점.
## 순간이동 지점·들판 무리·상자·별조각·채집·탐사지는 각 표(waypoints·field_spawner·treasure_spawner·star_shards·cooking·dispatch)에 "vault" 줄로.
##   미래 — 시간 씨앗 금고(VAULT_CELL): 반지름 VAULT_R 둥근 벽(충돌, 높이 VAULT_WALL_H·지붕 충돌)·남쪽 문(34장 뒤 열림) ·
##     안: 굳은 순간 진열장 다섯 + 해미 진열장(35장 대결 뒤 깨짐) · 가운데 기록 기둥(PILLAR_H m 벽 타기, 윗면 갈무리의 핵 — 35장에 꺼짐)
##     · 금고 앞 동력 기둥 둘(PYLONS — 34장 원소로 끔) · 야적장과 금고 사이를 오가는 운반 드론(보기만)
##   과거 — 곳간 마을(GRANARY_CELL, H 칸): 다락 곳간(충돌, 34장 석등 뒤 문이 열림) · 장독대·볏가리(작은 발견) · 고개 어귀 장승
##   현대 — 물류 야적장(WAREHOUSE_CELL): 창고(충돌)·컨테이너 더미(충돌)·갠트리 크레인(보기만)
## 세이브 없음(이야기 진행 PartyState.story 만 읽는다).

const PropMaterial := preload("res://games/saga_go/world/prop_material.gd")
const TestMap := preload("res://games/saga_go/data/test_map.gd")
const Fork := preload("res://games/saga_go/world/region10_fork.gd")
const TerrainBuilder := preload("res://games/saga_go/world/terrain_builder.gd")
const VegetationBuilder := preload("res://games/saga_go/world/vegetation_builder.gd")

const REGION := "vault"
const DISCOVER_R := 30.0

## [codex id, 칸(소수), 반지름] — CodexState "place"(codex_state.gd TOTAL 에 더함).
const DISCOVERIES := [
	["vault_region", Vector2(4.0, 4.0), 60.0],
	["vault_pass", Vector2(0.5, 3.0), DISCOVER_R],
	["vault_dome", Vector2(4.0, 1.5), DISCOVER_R],
	["vault_pylons", Vector2(4.0, 2.6), DISCOVER_R],
	["vault_granary", Vector2(1.4, 5.4), DISCOVER_R],
	["vault_yard", Vector2(6.3, 4.6), DISCOVER_R],
]
## 작은 발견(선택지 없는 순수 발견). [codex id, 칸, 모양]
const SMALL := [
	["vault_haystack", Vector2(2.2, 6.6), "haystack"],     # 과거 — 볏가리
	["vault_jars", Vector2(0.9, 4.8), "jars"],             # 과거 — 장독대
	["vault_mortar", Vector2(1.0, 6.4), "mortar"],         # 과거 — 디딜방아
	["vault_sotdae", Vector2(1.2, 3.6), "sotdae"],         # 과거 — 솟대
	["vault_forklift", Vector2(5.4, 5.6), "forklift"],     # 현대 — 멈춘 지게차
	["vault_parcels", Vector2(7.3, 4.8), "parcels"],       # 현대 — 택배 상자 더미
	["vault_container", Vector2(5.6, 3.6), "container"],   # 현대 — 문 열린 컨테이너(빈 속)
	["vault_seedpod", Vector2(2.8, 1.4), "seedpod"],       # 미래 — 떨어진 씨앗 캡슐
	["vault_drone_down", Vector2(6.4, 2.2), "drone_down"], # 미래 — 떨어진 운반 드론
	["vault_case_shard", Vector2(5.4, 1.2), "case_shard"], # 미래·틈 — 깨진 진열장 조각(속에 굳은 빗방울)
]
const SMALL_R := 14.0

const VAULT_CELL := Vector2(4.0, 1.5)
const GRANARY_CELL := Vector2(1.4, 5.4)
const WAREHOUSE_CELL := Vector2(6.3, 5.0)
const PASS_STONE_CELL := Vector2(0.4, 3.35)
## 동력 기둥 둘 — [이름, 칸]. 34장(CH34)에 원소로 끈다(PYLON_OFF_FROM 단계부터 꺼져 있음).
const PYLONS := [
	["서쪽 동력 기둥", Vector2(3.2, 2.6)],
	["동쪽 동력 기둥", Vector2(4.8, 2.6)],
]
const PYLON_H := 10.0
## 빛 울타리 — 이 지역 (0,3) 고개 칸 서쪽 변(x −0.5 = 서리봉 고원 (8,3) 동쪽 변). 9부(ch ≥ 32)를 마치면 꺼진다.
const GATE_CELL := Vector2(-0.5, 3.0)
const GATE_OPEN_CH := 32
const VAULT_R := 11.0
const VAULT_WALL_H := 12.0
const VAULT_SEGS := 16
const DOOR_W := 4.6
const PILLAR_W := 3.0
const PILLAR_H := 9.0
const CASE_R := 6.5
## 진열장 — [각도(도, 남쪽 0·시계 방향), 머리 글자, 속 모양]. 해미 진열장은 북쪽(HAEMI_CASE_DEG).
const CASES := [
	[60.0, "청하 잔치", "feast"],
	[120.0, "별배가 떨어지던 밤", "ship"],
	[240.0, "막차가 떠나던 역", "train"],
	[300.0, "잠기던 궁궐", "palace"],
	[210.0, "굳은 네거리", "signal"],
]
const HAEMI_CASE_DEG := 160.0
## 가장 깊은 진열장(106장 55 이야기 11부) — 북쪽 벽 앞(진열장 고리 CASE_R 보다 벽에 가깝게). 10부를 마친 뒤(ch ≥ DEEP_CASE_CH) 드러나고,
## 11부 38장에 순간이 풀리면(region10_fork.gd moment_free) 유리가 깨진다. 속엔 하늘 틈이 처음 찢어지던 고을의 작은 모형.
const DEEP_CASE_R := 9.5
const DEEP_CASE_CH := 35
const GRANARY_SIZE := Vector3(5.0, 4.2, 4.0)
const WAREHOUSE_SIZE := Vector3(12.0, 7.0, 8.0)
const CONTAINERS := [Vector2(5.2, 4.1), Vector2(7.1, 4.2), Vector2(7.2, 5.9)]
## 이야기 10부 — 장(0부터)·단계. 33장 드론 쫓기 · 34장 곳간·동력 기둥·금고 문 · 35장 핵·해미.
const CH33 := 32
const CH34 := 33
const CH35 := 34
const GRANARY_OPEN_STEP := 2 # 34장 seal(1) 을 마친 뒤 곳간 문이 열림
const PYLON_OFF_FROM := [5, 6] # 34장 light 4·5 를 마친 뒤
const DOOR_OPEN_STEP := 6 # 34장 동력 기둥 둘을 끈 뒤 금고 문이 열림
const CORE_DIM_STEP := 5 # 35장 갈무리가 핵을 버리고 달아난 뒤(talk 4 다음)
const HAEMI_FREE_STEP := 6 # 35장 드론 여왕을 쓰러뜨린 뒤 해미 진열장이 깨짐

const ALLOY := Color(0.84, 0.88, 0.93)
const STEEL := Color(0.6, 0.64, 0.68)
const STEEL_DARK := Color(0.28, 0.3, 0.33)
const GLOW := Color(0.45, 0.85, 1.0)
const SEED := Color(0.55, 1.0, 0.6)
const AMBER := Color(1.0, 0.68, 0.22)
const WOOD := Color(0.45, 0.3, 0.18)
const THATCH := Color(0.72, 0.6, 0.34)
const STONE := Color(0.52, 0.5, 0.47)
const CONCRETE := Color(0.62, 0.62, 0.6)
const RUST := Color(0.62, 0.34, 0.2)
const DIM := Color(0.18, 0.2, 0.24)

var _gate_body: StaticBody3D = null
var _gate_veil: Node3D = null
var _gate_open := false
var _door: Node3D = null
var _door_body: StaticBody3D = null
var _pylon_orbs: Array = [] # [MeshInstance3D]
var _core: MeshInstance3D = null
var _deep_case: Node3D = null
var _deep_glass: Node3D = null
var _haemi_case: Node3D = null
var _granary_door: Node3D = null
var _floaters: Array = [] # [node, base_y, phase]
var _drones: Array = [] # [node, from, to, phase]
var _state := ""
var _t := 0.0
var _check_t := 0.0

func _ready() -> void:
	add_to_group("go_vault_region")
	var terrain := Node3D.new()
	terrain.set_script(TerrainBuilder)
	terrain.name = "VaultTerrain"
	terrain.set("region_id", REGION)
	add_child(terrain)
	var veg := Node3D.new()
	veg.set_script(VegetationBuilder)
	veg.name = "VaultVegetation"
	veg.set("region_id", REGION)
	add_child(veg)
	_build_vault()
	_build_pylons()
	_build_granary()
	_build_yard()
	_build_drones()
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

## 9부(32장)를 마쳤는가 — 고개 빛 울타리가 꺼져 있다.
static func gate_open() -> bool:
	return _ch() >= GATE_OPEN_CH

static func granary_open() -> bool:
	return _reached(CH34, GRANARY_OPEN_STEP)

static func pylon_off(k: int) -> bool:
	return _reached(CH34, int(PYLON_OFF_FROM[k]))

static func door_open() -> bool:
	return _reached(CH34, DOOR_OPEN_STEP)

static func core_dim() -> bool:
	return _reached(CH35, CORE_DIM_STEP)

static func haemi_free() -> bool:
	return _reached(CH35, HAEMI_FREE_STEP)

## 기록 기둥 윗면 한가운데(월드) · 갈무리의 핵 자리.
static func pillar_top() -> Vector3:
	return cell_pos(VAULT_CELL) + Vector3(0, PILLAR_H, 0)

static func pylon_pos(k: int) -> Vector3:
	return cell_pos(PYLONS[k][1])

## 진열장 자리(월드) — 금고 가운데에서 deg(남쪽 0·시계 방향)로 CASE_R.
static func case_pos(deg: float) -> Vector3:
	var a := deg_to_rad(deg)
	return cell_pos(VAULT_CELL) + Vector3(-sin(a), 0.0, cos(a)) * CASE_R

func is_gate_open() -> bool:
	return _gate_open

func is_door_open() -> bool:
	return _door != null and not _door.visible

func pylon_lit(k: int) -> bool:
	return k < _pylon_orbs.size() and (_pylon_orbs[k] as MeshInstance3D).visible

func core_lit() -> bool:
	return _core != null and _core.visible

func haemi_sealed() -> bool:
	return _haemi_case != null and _haemi_case.visible

## 가장 깊은 진열장 — "hidden"(10부 전) · "sealed"(유리 그대로) · "broken"(11부 순간이 풀린 뒤).
func deep_case_state() -> String:
	if not _deep_case.visible:
		return "hidden"
	return "sealed" if _deep_glass.visible else "broken"

## 가장 깊은 진열장 자리(월드) — 금고 가운데에서 북쪽 DEEP_CASE_R.
static func deep_case_pos() -> Vector3:
	return cell_pos(VAULT_CELL) + Vector3(0, 0, -DEEP_CASE_R)

func granary_locked() -> bool:
	return _granary_door != null and _granary_door.visible

func _refresh() -> void:
	var key := "%d:%d" % [_ch(), int(PartyState.story.get("step", 0))]
	if key == _state:
		return
	_state = key
	_set_gate(gate_open())
	for k in _pylon_orbs.size():
		(_pylon_orbs[k] as Node3D).visible = not pylon_off(k)
	var open := door_open()
	_door.visible = not open
	_door_body.collision_layer = 0 if open else 1
	_core.visible = not core_dim()
	_haemi_case.visible = not haemi_free()
	_granary_door.visible = not granary_open()
	_deep_case.visible = _ch() >= DEEP_CASE_CH
	_deep_glass.visible = not Fork.moment_free()

func _process(delta: float) -> void:
	_t += delta
	for f in _floaters:
		(f[0] as Node3D).position.y = float(f[1]) + sin(_t * 0.6 + float(f[2])) * 0.25
	for d in _drones:
		var u := 0.5 - 0.5 * cos(_t * 0.18 + float(d[3])) # 0 → 1 → 0 오간다
		var p: Vector3 = (d[1] as Vector3).lerp(d[2], u)
		p.y += sin(u * PI) * 6.0
		(d[0] as Node3D).global_position = p
	_check_t -= delta
	if _check_t <= 0.0:
		_check_t = 1.0
		_refresh()

# ---------------------------------------------------------------- 명소

## 시간 씨앗 금고 — 둥근 벽(조각 VAULT_SEGS, 남쪽 한 칸은 문) · 지붕 충돌 + 반투명 돔 · 진열장 · 기록 기둥·핵.
func _build_vault() -> void:
	var root := _root("SeedVault", VAULT_CELL)
	var seg_w := 2.0 * VAULT_R * sin(PI / VAULT_SEGS) + 0.5
	for i in VAULT_SEGS:
		var a := TAU * float(i) / float(VAULT_SEGS)
		var seg := Node3D.new()
		seg.position = Vector3(-sin(a), 0.0, cos(a)) * VAULT_R
		seg.rotation.y = -a
		root.add_child(seg)
		if i == 0: # 남쪽 — 문
			_door = Node3D.new()
			_door.name = "Door"
			seg.add_child(_door)
			_box(_door, Vector3(DOOR_W, VAULT_WALL_H, 0.7), Vector3(0, VAULT_WALL_H * 0.5, 0), STEEL)
			var ring := _box(_door, Vector3(DOOR_W * 0.7, 0.2, 0.75), Vector3(0, 3.5, 0), GLOW)
			ring.material_override = _glow(GLOW, 1.4)
			_label(_door, "시간 씨앗 금고 — 잠김", Vector3(0, 6.0, 0.6), Color(0.8, 0.95, 1.0))
			_door_body = StaticBody3D.new()
			_door_body.name = "DoorBody"
			var cs := CollisionShape3D.new()
			var bs := BoxShape3D.new()
			bs.size = Vector3(DOOR_W, VAULT_WALL_H, 0.7)
			cs.shape = bs
			_door_body.add_child(cs)
			_door_body.position = Vector3(0, VAULT_WALL_H * 0.5, 0)
			seg.add_child(_door_body)
			continue
		_solid_box(seg, Vector3(seg_w, VAULT_WALL_H, 0.7), Vector3(0, VAULT_WALL_H * 0.5, 0), ALLOY)
		var band := _box(seg, Vector3(seg_w, 0.25, 0.75), Vector3(0, VAULT_WALL_H - 1.0, 0), GLOW)
		band.material_override = _glow(GLOW, 0.9)
	## 지붕 — 둥근 판(충돌)·반투명 돔(보기만). 벽을 타고 올라서도 지붕 위에 설 뿐 안으로는 문으로만.
	var roof := StaticBody3D.new()
	roof.name = "Roof"
	var rcs := CollisionShape3D.new()
	var cyl := CylinderShape3D.new()
	cyl.radius = VAULT_R + 0.3
	cyl.height = 0.5
	rcs.shape = cyl
	roof.add_child(rcs)
	roof.position = Vector3(0, VAULT_WALL_H + 0.25, 0)
	root.add_child(roof)
	var disc := MeshInstance3D.new()
	var dm := CylinderMesh.new()
	dm.top_radius = VAULT_R + 0.3
	dm.bottom_radius = VAULT_R + 0.3
	dm.height = 0.5
	disc.mesh = dm
	disc.material_override = _mat(STEEL_DARK)
	disc.position = roof.position
	root.add_child(disc)
	var dome := MeshInstance3D.new()
	var sm := SphereMesh.new()
	sm.radius = VAULT_R
	sm.height = VAULT_R * 2.0
	sm.is_hemisphere = true
	dome.mesh = sm
	dome.material_override = _glass(GLOW, 0.25)
	dome.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	dome.scale = Vector3(1.0, 0.45, 1.0)
	dome.position = Vector3(0, VAULT_WALL_H + 0.5, 0)
	root.add_child(dome)
	_label(root, "시간 씨앗 금고", Vector3(0, VAULT_WALL_H + 7.0, 0), Color(0.8, 0.95, 1.0))
	## 안 바닥 — 빛 줄 고리
	var floor_ring := MeshInstance3D.new()
	var tm := TorusMesh.new()
	tm.inner_radius = CASE_R - 0.15
	tm.outer_radius = CASE_R + 0.15
	floor_ring.mesh = tm
	floor_ring.material_override = _glow(GLOW, 0.8)
	floor_ring.position = Vector3(0, 0.05, 0)
	floor_ring.scale = Vector3(1.0, 0.1, 1.0)
	root.add_child(floor_ring)
	## 굳은 순간 진열장 다섯(보기만 — 길을 막지 않게 충돌 없음)
	for c in CASES:
		var cp := case_pos(float(c[0])) - cell_pos(VAULT_CELL)
		var case_root := Node3D.new()
		case_root.position = cp
		root.add_child(case_root)
		_build_case(case_root, String(c[2]))
		_label(case_root, "갈무리된 순간 — %s" % String(c[1]), Vector3(0, 3.2, 0), AMBER)
	## 해미 진열장 — 속 사람은 이야기 인물(data/story.gd haemi)이 선다. 여기는 유리·받침만(35장 대결 뒤 깨짐).
	_haemi_case = Node3D.new()
	_haemi_case.name = "HaemiCase"
	_haemi_case.position = case_pos(HAEMI_CASE_DEG) - cell_pos(VAULT_CELL)
	root.add_child(_haemi_case)
	var glass := _box(_haemi_case, Vector3(1.9, 2.8, 1.9), Vector3(0, 1.5, 0), GLOW)
	glass.material_override = _glass(GLOW, 0.3)
	_label(_haemi_case, "갈무리된 사람 — 보관사", Vector3(0, 3.4, 0), Color(0.75, 1.0, 0.8))
	_box(root, Vector3(2.0, 0.15, 2.0), _haemi_case.position + Vector3(0, 0.07, 0), STEEL_DARK)
	## 가장 깊은 진열장 — 큰 호박 유리 + 받침 + 속 모형(세 갈래 길·하늘 틈 금). 충돌 없음.
	_deep_case = Node3D.new()
	_deep_case.name = "DeepCase"
	_deep_case.position = deep_case_pos() - cell_pos(VAULT_CELL)
	root.add_child(_deep_case)
	_box(_deep_case, Vector3(2.6, 0.4, 2.6), Vector3(0, 0.2, 0), STEEL_DARK)
	_deep_glass = Node3D.new()
	_deep_glass.name = "Glass"
	_deep_case.add_child(_deep_glass)
	var dg := _box(_deep_glass, Vector3(2.4, 3.4, 2.4), Vector3(0, 2.1, 0), AMBER)
	dg.material_override = _glass(AMBER, 0.3)
	for k in 3: # 세 갈래 길(서·동·북)
		var yaw: float = [PI, 0.0, PI * 0.5][k]
		var road := _box(_deep_case, Vector3(0.9, 0.04, 0.18), Vector3(-cos(yaw) * 0.45, 0.45, sin(yaw) * 0.45), THATCH)
		road.rotation.y = yaw
	var crack := _box(_deep_case, Vector3(1.6, 0.1, 0.05), Vector3(0, 3.2, 0), Color(0.75, 0.5, 1.0))
	crack.material_override = _glow(Color(0.75, 0.5, 1.0), 2.0)
	crack.rotation.z = 0.25
	_label(_deep_case, "가장 깊은 진열장 — 처음의 순간", Vector3(0, 4.2, 0), AMBER)
	## 기록 기둥(충돌 — 벽 타기, 윗면 턱 없음)·갈무리의 핵
	_solid_box(root, Vector3(PILLAR_W, PILLAR_H, PILLAR_W), Vector3(0, PILLAR_H * 0.5, 0), STEEL)
	for y in [2.0, 4.5, 7.0]:
		var line := _box(root, Vector3(PILLAR_W + 0.1, 0.12, PILLAR_W + 0.1), Vector3(0, y, 0), GLOW)
		line.material_override = _glow(GLOW, 1.0)
	_core = MeshInstance3D.new()
	var cm := SphereMesh.new()
	cm.radius = 0.7
	cm.height = 1.4
	_core.mesh = cm
	_core.material_override = _glow(Color(0.8, 0.95, 1.0), 2.4)
	_core.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	_core.position = Vector3(0, PILLAR_H + 1.4, 0)
	root.add_child(_core)
	_floaters.append([_core, _core.position.y, 0.0])
	## 꺼진 핵 자리 — 늘 있는 받침(핵이 꺼지면 이것만 남는다)
	_box(root, Vector3(1.0, 0.3, 1.0), Vector3(0, PILLAR_H + 0.15, 0), DIM)

## 진열장 하나 — 유리 상자 + 받침 + 속 모양(굳은 순간의 작은 모형, 호박빛).
func _build_case(r: Node3D, shape: String) -> void:
	_box(r, Vector3(1.7, 0.4, 1.7), Vector3(0, 0.2, 0), STEEL_DARK)
	var glass := _box(r, Vector3(1.6, 2.2, 1.6), Vector3(0, 1.5, 0), AMBER)
	glass.material_override = _glass(AMBER, 0.22)
	var inner := Node3D.new()
	inner.position = Vector3(0, 0.8, 0)
	r.add_child(inner)
	match shape:
		"feast": # 청하 잔치 — 상·등불
			_box(inner, Vector3(1.0, 0.1, 0.6), Vector3(0, 0.3, 0), WOOD)
			for k in 3:
				var lamp := _box(inner, Vector3(0.18, 0.25, 0.18), Vector3(-0.4 + k * 0.4, 0.9, 0), Color(1.0, 0.5, 0.3))
				lamp.material_override = _glow(Color(1.0, 0.5, 0.3), 1.2)
		"ship": # 별배가 떨어지던 밤 — 기운 별배
			var hull := _box(inner, Vector3(1.0, 0.25, 0.35), Vector3(0, 0.6, 0), Color(0.3, 0.36, 0.5))
			hull.rotation.z = -0.5
			_box(inner, Vector3(0.1, 0.5, 0.1), Vector3(0.1, 0.9, 0), ALLOY).rotation.z = -0.5
		"train": # 막차가 떠나던 역 — 전동차 한 칸
			_box(inner, Vector3(1.1, 0.4, 0.4), Vector3(0, 0.3, 0), Color(0.82, 0.84, 0.86))
			_box(inner, Vector3(1.12, 0.1, 0.42), Vector3(0, 0.2, 0), Color(0.2, 0.45, 0.7))
		"palace": # 잠기던 궁궐 — 기와 지붕
			_box(inner, Vector3(0.9, 0.35, 0.6), Vector3(0, 0.2, 0), Color(0.6, 0.25, 0.2))
			_box(inner, Vector3(1.2, 0.12, 0.8), Vector3(0, 0.5, 0), Color(0.25, 0.28, 0.32))
			var wave := _box(inner, Vector3(1.3, 0.05, 1.3), Vector3(0, 0.05, 0), Color(0.3, 0.55, 0.8))
			wave.material_override = _glass(Color(0.3, 0.55, 0.8), 0.6)
		"signal": # 굳은 네거리 — 빨간 신호등
			_box(inner, Vector3(0.08, 1.0, 0.08), Vector3(0, 0.5, 0), STEEL_DARK)
			var red := _box(inner, Vector3(0.22, 0.22, 0.12), Vector3(0, 1.0, 0.05), Color(1.0, 0.22, 0.18))
			red.material_override = _glow(Color(1.0, 0.22, 0.18), 1.4)

## 금고 앞 동력 기둥 둘 — 기둥(충돌)·꼭대기 빛 알(34장에 원소로 끄면 알이 사라짐)·금고로 가는 빛 줄.
func _build_pylons() -> void:
	for k in PYLONS.size():
		var r := _root("Pylon_%d" % k, PYLONS[k][1])
		_solid_box(r, Vector3(1.2, PYLON_H, 1.2), Vector3(0, PYLON_H * 0.5, 0), STEEL)
		for y in [3.0, 6.0]:
			_box(r, Vector3(1.6, 0.3, 1.6), Vector3(0, y, 0), STEEL_DARK)
		var orb := MeshInstance3D.new()
		var om := SphereMesh.new()
		om.radius = 0.9
		om.height = 1.8
		orb.mesh = om
		orb.material_override = _glow(GLOW, 2.0)
		orb.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		orb.position = Vector3(0, PYLON_H + 1.0, 0)
		r.add_child(orb)
		_pylon_orbs.append(orb)
		_box(r, Vector3(1.0, 0.3, 1.0), Vector3(0, PYLON_H + 0.15, 0), DIM)
		_label(r, String(PYLONS[k][0]), Vector3(0, PYLON_H + 2.6, 0), Color(0.8, 0.95, 1.0))

## 곳간 마을 — 다락 곳간(충돌, 돌 받침 넷 위) · 초가지붕 · 앞문(34장 석등 뒤 열림 — 문짝이 사라짐).
func _build_granary() -> void:
	var r := _root("Granary", GRANARY_CELL)
	for x in [-2.0, 2.0]:
		for z in [-1.6, 1.6]:
			_box(r, Vector3(0.5, 1.0, 0.5), Vector3(x, 0.5, z), STONE)
	_solid_box(r, GRANARY_SIZE, Vector3(0, GRANARY_SIZE.y * 0.5 + 0.2, 0), WOOD)
	var roof_l := _box(r, Vector3(GRANARY_SIZE.x + 0.8, 0.3, GRANARY_SIZE.z * 0.65), Vector3(0, GRANARY_SIZE.y + 1.0, -1.0), THATCH)
	roof_l.rotation.x = 0.55
	var roof_r := _box(r, Vector3(GRANARY_SIZE.x + 0.8, 0.3, GRANARY_SIZE.z * 0.65), Vector3(0, GRANARY_SIZE.y + 1.0, 1.0), THATCH)
	roof_r.rotation.x = -0.55
	_granary_door = Node3D.new()
	_granary_door.name = "GranaryDoor"
	r.add_child(_granary_door)
	_box(_granary_door, Vector3(1.6, 2.2, 0.12), Vector3(0, 2.0, GRANARY_SIZE.z * 0.5 + 0.08), WOOD.darkened(0.3))
	_box(_granary_door, Vector3(0.5, 0.2, 0.14), Vector3(0, 2.0, GRANARY_SIZE.z * 0.5 + 0.12), Color(0.3, 0.3, 0.32)) # 자물쇠
	_box(r, Vector3(1.6, 2.2, 0.05), Vector3(0, 2.0, GRANARY_SIZE.z * 0.5 + 0.03), Color(0.08, 0.06, 0.05)) # 문 뒤 어둠
	_label(r, "곳간", Vector3(0, GRANARY_SIZE.y + 2.4, 0), Color(1.0, 0.92, 0.7))

## 물류 야적장 — 창고(충돌, 남쪽 셔터)·컨테이너 더미(충돌)·갠트리 크레인(보기만).
func _build_yard() -> void:
	var r := _root("Warehouse", WAREHOUSE_CELL)
	_solid_box(r, WAREHOUSE_SIZE, Vector3(0, WAREHOUSE_SIZE.y * 0.5, 0), CONCRETE)
	_box(r, Vector3(WAREHOUSE_SIZE.x + 0.4, 0.4, WAREHOUSE_SIZE.z + 0.4), Vector3(0, WAREHOUSE_SIZE.y + 0.2, 0), STEEL_DARK)
	_box(r, Vector3(4.0, 4.5, 0.1), Vector3(-2.5, 2.25, WAREHOUSE_SIZE.z * 0.5 + 0.06), Color(0.55, 0.58, 0.6)) # 셔터
	_box(r, Vector3(1.0, 2.2, 0.1), Vector3(3.5, 1.1, WAREHOUSE_SIZE.z * 0.5 + 0.06), Color(0.2, 0.36, 0.55)) # 사무실 문
	_label(r, "갈무리 물류", Vector3(0, WAREHOUSE_SIZE.y + 1.4, 0), Color(0.95, 0.95, 0.85))
	var colors := [Color(0.75, 0.3, 0.2), Color(0.2, 0.45, 0.65), Color(0.3, 0.55, 0.35)]
	for i in CONTAINERS.size():
		var cr := _root("Containers_%d" % i, CONTAINERS[i])
		cr.rotation.y = 0.3 * i
		for lvl in 2:
			_solid_box(cr, Vector3(6.0, 2.6, 2.4), Vector3(0, 1.3 + lvl * 2.6, lvl * 0.3), colors[(i + lvl) % 3])
	var crane := _root("Gantry", Vector2(6.3, 4.1))
	for x in [-6.0, 6.0]:
		_box(crane, Vector3(0.5, 11.0, 0.5), Vector3(x, 5.5, 0), Color(0.95, 0.72, 0.15))
	_box(crane, Vector3(12.5, 0.6, 0.6), Vector3(0, 11.0, 0), Color(0.95, 0.72, 0.15))
	_box(crane, Vector3(0.06, 4.0, 0.06), Vector3(1.5, 9.0, 0), STEEL_DARK)

## 운반 드론 셋 — 야적장과 금고 문 앞을 오간다(보기만, 굳은 조각 호박 알을 매달았다).
func _build_drones() -> void:
	var from := cell_pos(Vector2(6.0, 4.3)) + Vector3(0, 5.0, 0)
	var to := cell_pos(VAULT_CELL) + Vector3(0, VAULT_WALL_H + 3.0, VAULT_R * 0.5)
	for k in 3:
		var d := Node3D.new()
		d.name = "CarrierDrone_%d" % k
		add_child(d)
		_box(d, Vector3(0.9, 0.3, 0.9), Vector3.ZERO, ALLOY)
		for j in 4:
			_box(d, Vector3(0.6, 0.05, 0.14), Vector3(cos(j * PI * 0.5) * 0.7, 0.2, sin(j * PI * 0.5) * 0.7), STEEL_DARK)
		var egg := MeshInstance3D.new()
		var em := SphereMesh.new()
		em.radius = 0.3
		em.height = 0.6
		egg.mesh = em
		egg.material_override = _glow(AMBER, 1.3)
		egg.position = Vector3(0, -0.55, 0)
		d.add_child(egg)
		_drones.append([d, from + Vector3(k * 2.0 - 2.0, k * 0.6, 0), to + Vector3(k * 2.0 - 2.0, 0, 0), float(k) * 2.1])

## 고개 어귀 장승 둘(과거) — 받침만 충돌.
func _build_pass_stone() -> void:
	var root := _root("PassStone", PASS_STONE_CELL)
	for z in [0.0, -1.8]:
		_solid_box(root, Vector3(0.6, 0.4, 0.6), Vector3(0, 0.2, z), STONE)
		_box(root, Vector3(0.45, 2.6, 0.45), Vector3(0, 1.7, z), WOOD)
		_box(root, Vector3(0.55, 0.6, 0.5), Vector3(0, 3.1, z), Color(0.7, 0.25, 0.18))
	_label(root, "갈무리 벌", Vector3(0, 4.2, -0.9), Color(1.0, 0.92, 0.7))

## 빛 울타리 — 고개 칸 서쪽 변에 선 푸른 빛 막(충돌 — 9부를 마치면 꺼짐). 굳은 거리 결정 막과 같은 틀(방향만 남북).
func _build_gate() -> void:
	var p := TestMap.world_pos(GATE_CELL.x, GATE_CELL.y, REGION)
	p.y = TerrainBuilder.height_at(REGION, TestMap.world_pos(0.0, 3.0, REGION))
	var root := Node3D.new()
	root.name = "VaultGate"
	add_child(root)
	root.position = p
	root.rotation.y = PI * 0.5
	_gate_veil = Node3D.new()
	_gate_veil.name = "Veil"
	root.add_child(_gate_veil)
	var veil := MeshInstance3D.new()
	var qm := QuadMesh.new()
	qm.size = Vector2(TestMap.TILE_SIZE, 14.0)
	veil.mesh = qm
	veil.material_override = _glass(GLOW, 0.45)
	veil.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	veil.position = Vector3(0, 7.0, 0)
	_gate_veil.add_child(veil)
	var lbl := Label3D.new()
	lbl.text = "빛 울타리 — 통행 허가 없음"
	lbl.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	lbl.font_size = 40
	lbl.outline_size = 8
	lbl.pixel_size = 0.008
	lbl.modulate = Color(0.75, 0.95, 1.0)
	lbl.position = Vector3(0, 4.0, 0)
	_gate_veil.add_child(lbl)
	for k in [-1, 1]:
		_box(root, Vector3(0.6, 14.0, 0.6), Vector3(k * TestMap.TILE_SIZE * 0.5, 7.0, 0), ALLOY)
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
		"haystack":
			for k in 3:
				var h := MeshInstance3D.new()
				var hm := CylinderMesh.new()
				hm.top_radius = 0.2
				hm.bottom_radius = 1.0
				hm.height = 2.0
				h.mesh = hm
				h.material_override = _mat(THATCH)
				h.position = Vector3(k * 2.2 - 2.2, 1.0, (k % 2) * 0.8)
				r.add_child(h)
		"jars":
			_box(r, Vector3(3.0, 0.3, 1.6), Vector3(0, 0.15, 0), STONE)
			for k in 5:
				var j := MeshInstance3D.new()
				var jm := SphereMesh.new()
				jm.radius = 0.35 + (k % 2) * 0.1
				jm.height = 0.9 + (k % 2) * 0.2
				j.mesh = jm
				j.material_override = _mat(Color(0.35, 0.22, 0.14))
				j.position = Vector3(-1.1 + k * 0.55, 0.7, (k % 2) * 0.4 - 0.2)
				r.add_child(j)
		"mortar":
			_box(r, Vector3(0.3, 0.8, 0.3), Vector3(0, 0.4, 0), WOOD)
			var beam := _box(r, Vector3(3.0, 0.2, 0.25), Vector3(0.4, 0.85, 0), WOOD.darkened(0.2))
			beam.rotation.z = 0.12
			_box(r, Vector3(0.6, 0.4, 0.6), Vector3(-1.1, 0.2, 0), STONE)
		"sotdae":
			_box(r, Vector3(0.12, 5.0, 0.12), Vector3(0, 2.5, 0), WOOD)
			var bird := _box(r, Vector3(0.6, 0.15, 0.18), Vector3(0.1, 5.1, 0), WOOD.lightened(0.2))
			bird.rotation.z = 0.2
		"forklift":
			_box(r, Vector3(1.4, 1.0, 2.2), Vector3(0, 0.8, 0), Color(0.95, 0.72, 0.15))
			_box(r, Vector3(1.2, 1.4, 0.1), Vector3(0, 2.0, -0.4), STEEL_DARK)
			for x in [-0.4, 0.4]:
				_box(r, Vector3(0.12, 0.08, 1.4), Vector3(x, 0.2, 1.7), STEEL_DARK)
			_box(r, Vector3(0.1, 2.6, 0.1), Vector3(0, 1.4, 1.1), STEEL_DARK)
		"parcels":
			for k in 6:
				var b := _box(r, Vector3(0.7, 0.5, 0.6), Vector3((k % 3) * 0.75 - 0.75, 0.25 + int(k / 3) * 0.5, 0), Color(0.72, 0.56, 0.36))
				b.rotation.y = k * 0.2
		"container":
			_box(r, Vector3(6.0, 2.6, 0.1), Vector3(0, 1.3, -1.2), RUST)
			_box(r, Vector3(6.0, 2.6, 0.1), Vector3(0, 1.3, 1.2), RUST)
			_box(r, Vector3(6.0, 0.1, 2.4), Vector3(0, 2.6, 0), RUST)
			var door := _box(r, Vector3(0.1, 2.5, 1.2), Vector3(3.4, 1.25, 1.6), RUST.darkened(0.2))
			door.rotation.y = 0.9
		"seedpod":
			var pod := MeshInstance3D.new()
			var pm := CapsuleMesh.new()
			pm.radius = 0.5
			pm.height = 1.8
			pod.mesh = pm
			pod.material_override = _mat(ALLOY)
			pod.rotation.z = 1.3
			pod.position = Vector3(0, 0.5, 0)
			r.add_child(pod)
			var core := _box(r, Vector3(0.3, 0.3, 0.3), Vector3(0.2, 0.9, 0), SEED)
			core.material_override = _glow(SEED, 1.5)
			_floaters.append([core, 0.9, 1.1])
		"drone_down":
			var d := Node3D.new()
			d.rotation = Vector3(0.4, 0.3, 0.6)
			d.position = Vector3(0, 0.4, 0)
			r.add_child(d)
			_box(d, Vector3(0.9, 0.3, 0.9), Vector3.ZERO, ALLOY)
			for j in 3:
				_box(d, Vector3(0.6, 0.05, 0.14), Vector3(cos(j * 2.0) * 0.7, 0.2, sin(j * 2.0) * 0.7), STEEL_DARK)
		"case_shard":
			for k in 3:
				var s := _box(r, Vector3(0.9 - k * 0.2, 1.4 - k * 0.3, 0.06), Vector3(k * 0.6 - 0.6, 0.6, (k % 2) * 0.3), AMBER)
				s.material_override = _glass(AMBER, 0.35)
				s.rotation = Vector3(0.3 * k, 0.8 * k, 0.4)
			for k in 6:
				var drop := _box(r, Vector3(0.05, 0.18, 0.05), Vector3(cos(k * 1.9) * 1.2, 1.2 + (k % 3) * 0.5, sin(k * 1.9) * 1.2), Color(0.7, 0.85, 1.0))
				drop.material_override = _glass(AMBER, 0.7)

# ---------------------------------------------------------------- 도우미(region8_amber.gd 와 같은 결)

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

## 반투명 빛 유리 — 돔·진열장·울타리.
func _glass(c: Color, alpha: float) -> StandardMaterial3D:
	var m := StandardMaterial3D.new()
	m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	m.albedo_color = Color(c.r, c.g, c.b, alpha)
	m.emission_enabled = true
	m.emission = c.darkened(0.4)
	m.emission_energy_multiplier = 0.6
	m.cull_mode = BaseMaterial3D.CULL_DISABLED
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
