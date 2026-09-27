extends Node3D

## PLAN 106장 55-1 — 열째 지역 "세갈래 고을"(REGIONS["fork"], test_map.gd). 이야기 11부의 무대(`scenario/saga-go-part10.md` 11부).
## 틈이 처음 찢어진 순간째 갈무리가 "가장 깊은 진열장"에 갈무리해 둔 땅 — 세 길(옛 역참길·선로·종루길)이 만나던 옛 고을.
## 서리봉 고원 북쪽 변에 붙어 있지만 순간이 풀리기 전(38장 MOMENT_FREE_STEP 전)엔 고개에 호박 장막(충돌)이 서서 못 지나간다 —
## 그동안은 갈무리 벌 금고의 가장 깊은 진열장(36장 sail)으로만 들어온다. 순간이 풀리면 고원 (4,0) 고개와 이 지역 (4,8) 길이 걸어서 이어진다.
## 이 파일이 짓는 것: 지형·식생(TerrainBuilder·VegetationBuilder region_id 인스턴스) · 고정 명소 · 격자 말뚝 셋 · 하늘 틈·멈춘 별까마귀 ·
##   공중에 멈춘 호박 알갱이 · 고개 호박 장막 · 발견 지점.
## 순간이동 지점·들판 무리·상자·별조각·채집·탐사지는 각 표(waypoints·field_spawner·treasure_spawner·star_shards·cooking·dispatch)에 "fork" 줄로.
##   과거(중심) — 고을 성문(GATE_TOWN_CELL, 충돌 문루 둘·짧은 성벽) · 대장간(FORGE_CELL, 충돌 — 화덕 불이 그대로 멈춤) · 종루(TOWER_CELL, 벽 타기 TOWER_H) ·
##     세갈래 길목(JUNCTION_CELL — 이정표, 머리 위 하늘 틈과 틈을 막 삼키려던 별까마귀가 멈춰 있다)
##   현대 — 선로 공사장(WORKS_CELL — 천막·측량 삼각대) · 선로와 멈춘 증기 기관차(LOCO_CELL, 충돌)
##   미래 — 갈무리의 격자 말뚝 셋(LATTICES — 순간을 붙든 틀, 37장 원소로 끈다) · 떨어진 보관 드론
## 세이브 없음(이야기 진행 PartyState.story 만 읽는다).

const TestMap := preload("res://games/saga_go/data/test_map.gd")
const TerrainBuilder := preload("res://games/saga_go/world/terrain_builder.gd")
const VegetationBuilder := preload("res://games/saga_go/world/vegetation_builder.gd")
const CreatureBuilder := preload("res://games/saga_go/world/creature_builder.gd")

const REGION := "fork"
const DISCOVER_R := 30.0

## [codex id, 칸(소수), 반지름] — CodexState "place"(codex_state.gd TOTAL 에 더함).
const DISCOVERIES := [
	["fork_region", Vector2(4.0, 4.0), 60.0],
	["fork_gate", Vector2(4.0, 6.6), DISCOVER_R],
	["fork_junction", Vector2(4.0, 3.5), DISCOVER_R],
	["fork_forge", Vector2(2.4, 5.2), DISCOVER_R],
	["fork_works", Vector2(6.5, 4.8), DISCOVER_R],
	["fork_tower", Vector2(4.0, 1.2), DISCOVER_R],
]
## 작은 발견(선택지 없는 순수 발견). [codex id, 칸, 모양]
const SMALL := [
	["fork_well", Vector2(3.1, 4.7), "well"],                  # 과거 — 고을 우물(두레박이 반쯤 올라오다 멈춤)
	["fork_laundry", Vector2(1.9, 6.4), "laundry"],            # 과거 — 바람에 날리다 멈춘 빨래
	["fork_kite", Vector2(5.2, 5.9), "kite"],                  # 과거 — 공중에 멈춘 방패연
	["fork_tripod", Vector2(5.5, 4.3), "tripod"],              # 현대 — 측량 삼각대
	["fork_rails", Vector2(7.2, 4.4), "rails"],                # 현대 — 깔다 만 레일 더미
	["fork_flag", Vector2(5.9, 2.1), "flag"],                  # 현대 — 측량 깃발
	["fork_drone", Vector2(6.3, 1.5), "drone_down"],           # 미래 — 떨어진 보관 드론
	["fork_shard", Vector2(2.5, 2.1), "lattice_shard"],        # 미래 — 부러진 격자 조각
	["fork_rain", Vector2(3.3, 2.5), "frozen_rain"],           # 틈 — 떨어지다 멈춘 빗방울
	["fork_birds", Vector2(4.8, 5.3), "frozen_birds"],         # 틈 — 날아오르다 멈춘 새 떼
]
const SMALL_R := 14.0

const GATE_TOWN_CELL := Vector2(4.0, 6.3)
const FORGE_CELL := Vector2(2.4, 5.2)
const FORGE_SIZE := Vector3(6.0, 4.0, 5.0)
const JUNCTION_CELL := Vector2(4.0, 3.5)
const WORKS_CELL := Vector2(6.5, 4.9)
const LOCO_CELL := Vector2(6.2, 3.0)
const LOCO_SIZE := Vector3(8.0, 3.6, 3.0)
const TOWER_CELL := Vector2(4.0, 1.2)
const TOWER_W := 5.0
const TOWER_H := 10.0
## 격자 말뚝 셋 — [이름, 칸]. 셋째는 종루 윗면(lift TOWER_H). 37장(CH37)에 원소로 끈다(LATTICE_OFF_FROM 단계부터 꺼져 있음).
const LATTICES := [
	["역참길 격자 말뚝", Vector2(1.2, 3.5)],
	["선로 격자 말뚝", Vector2(7.2, 3.0)],
	["종루 격자 말뚝", Vector2(4.0, 1.2)],
]
const LATTICE_H := 6.0
## 멈춘 별까마귀·하늘 틈 높이(길목 땅 위).
const CROW_Y := 20.0
const RIFT_Y := 42.0
## 호박 장막 — 이 지역 (4,8) 고개 칸 남쪽 변(z 8.5 = 서리봉 고원 (4,0) 북쪽 변). 순간이 풀리면(38장 MOMENT_FREE_STEP) 걷힌다.
const GATE_CELL := Vector2(4.0, 8.5)
const SPECKS := 48
## 이야기 11부 — 장(0부터)·단계. 37장 격자 말뚝 · 38장 별까마귀가 깨어나고 순간이 풀림.
const CH36 := 35
const CH37 := 36
const CH38 := 37
const LATTICE_OFF_FROM := [2, 5, 7] # 37장 light 1·4·6 을 마친 뒤
const CROW_WAKE_STEP := 1 # 38장 벼리와 이야기한 뒤 멈춘 별까마귀가 깨어나 이야기 보스로(모형은 사라짐)
const MOMENT_FREE_STEP := 4 # 38장 갈무리 참몸을 쓰러뜨린 뒤 — 알갱이·하늘 틈이 걷히고 고개 장막이 열림

const WOOD := Color(0.45, 0.3, 0.18)
const THATCH := Color(0.72, 0.6, 0.34)
const TILE_ROOF := Color(0.28, 0.3, 0.34)
const STONE := Color(0.55, 0.52, 0.48)
const PLASTER := Color(0.86, 0.82, 0.72)
const IRON := Color(0.2, 0.2, 0.22)
const RAIL := Color(0.42, 0.36, 0.32)
const CANVAS := Color(0.82, 0.74, 0.55)
const ALLOY := Color(0.84, 0.88, 0.93)
const GLOW := Color(0.45, 0.85, 1.0)
const AMBER := Color(1.0, 0.68, 0.22)
const EMBER := Color(1.0, 0.45, 0.15)
const RIFT := Color(0.75, 0.5, 1.0)

var _gate_body: StaticBody3D = null
var _gate_veil: Node3D = null
var _gate_open := false
var _lattice_cores: Array = [] # [Node3D] 말뚝마다 빛 틀(꺼지면 숨김)
var _crow: Node3D = null
var _rift: Node3D = null
var _specks: Node3D = null
var _floaters: Array = [] # [node, base_y, phase] — 순간이 풀린 뒤에만 흔들린다
var _state := ""
var _t := 0.0
var _check_t := 0.0

func _ready() -> void:
	add_to_group("go_fork_region")
	var terrain := Node3D.new()
	terrain.set_script(TerrainBuilder)
	terrain.name = "ForkTerrain"
	terrain.set("region_id", REGION)
	add_child(terrain)
	var veg := Node3D.new()
	veg.set_script(VegetationBuilder)
	veg.name = "ForkVegetation"
	veg.set("region_id", REGION)
	add_child(veg)
	_build_town_gate()
	_build_forge()
	_build_junction()
	_build_works()
	_build_tower()
	_build_lattices()
	_build_specks()
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

## 순간이 풀렸는가(38장 갈무리 참몸 뒤) — 고개 장막이 걷히고 알갱이·하늘 틈이 사라진다.
static func moment_free() -> bool:
	return _reached(CH38, MOMENT_FREE_STEP)

static func gate_open() -> bool:
	return moment_free()

static func lattice_off(k: int) -> bool:
	return _reached(CH37, int(LATTICE_OFF_FROM[k]))

static func crow_frozen() -> bool:
	return not _reached(CH38, CROW_WAKE_STEP)

## 종루 윗면 한가운데(월드).
static func tower_top() -> Vector3:
	return cell_pos(TOWER_CELL) + Vector3(0, TOWER_H, 0)

## 격자 말뚝 k 자리(월드) — 셋째는 종루 윗면.
static func lattice_pos(k: int) -> Vector3:
	return tower_top() if k == 2 else cell_pos(LATTICES[k][1])

## 멈춘 별까마귀 자리(월드).
static func crow_pos() -> Vector3:
	return cell_pos(JUNCTION_CELL) + Vector3(0, CROW_Y, 0)

func is_gate_open() -> bool:
	return _gate_open

func lattice_lit(k: int) -> bool:
	return k < _lattice_cores.size() and (_lattice_cores[k] as Node3D).visible

func crow_visible() -> bool:
	return _crow != null and _crow.visible

func rift_visible() -> bool:
	return _rift != null and _rift.visible

func specks_visible() -> bool:
	return _specks != null and _specks.visible

func _refresh() -> void:
	var key := "%d:%d" % [_ch(), int(PartyState.story.get("step", 0))]
	if key == _state:
		return
	_state = key
	var free := moment_free()
	_set_gate(free)
	for k in _lattice_cores.size():
		(_lattice_cores[k] as Node3D).visible = not lattice_off(k)
	_crow.visible = crow_frozen()
	_rift.visible = not free
	_specks.visible = not free

func _process(delta: float) -> void:
	_t += delta
	## 순간이 멈춰 있는 동안엔 아무것도 흔들리지 않는다 — 풀린 뒤에만 연·빨래가 바람에 논다.
	if moment_free():
		for f in _floaters:
			(f[0] as Node3D).position.y = float(f[1]) + sin(_t * 1.1 + float(f[2])) * 0.15
	_check_t -= delta
	if _check_t <= 0.0:
		_check_t = 1.0
		_refresh()

# ---------------------------------------------------------------- 명소

## 고을 성문 — 문루 둘(충돌)·기와 문지붕·짧은 성벽 둘(충돌). 가운데 5m 는 열려 있다.
func _build_town_gate() -> void:
	var root := _root("TownGate", GATE_TOWN_CELL)
	for x in [-4.0, 4.0]:
		_solid_box(root, Vector3(3.0, 6.0, 3.0), Vector3(x, 3.0, 0), STONE)
		_box(root, Vector3(3.6, 0.5, 3.6), Vector3(x, 6.25, 0), TILE_ROOF)
	_box(root, Vector3(11.5, 1.0, 3.2), Vector3(0, 6.6, 0), WOOD)
	var roof := _box(root, Vector3(12.5, 0.4, 4.2), Vector3(0, 7.4, 0), TILE_ROOF)
	roof.rotation.x = 0.05
	_box(root, Vector3(4.0, 0.9, 0.2), Vector3(0, 5.6, 1.65), WOOD.darkened(0.3)) # 현판
	_label(root, "세갈래 고을", Vector3(0, 9.0, 0), Color(1.0, 0.92, 0.7))
	for x in [-1.0, 1.0]:
		_solid_box(root, Vector3(12.0, 4.5, 1.4), Vector3(x * 11.5, 2.25, 0), STONE.darkened(0.08))
	## 문 앞 장승 둘(보기만)
	for x in [-3.2, 3.2]:
		_box(root, Vector3(0.45, 2.6, 0.45), Vector3(x, 1.3, 3.2), WOOD)
		_box(root, Vector3(0.55, 0.6, 0.5), Vector3(x, 2.7, 3.2), Color(0.7, 0.25, 0.18))

## 대장간 — 초가 건물(충돌) · 앞마당 화덕(멈춘 불꽃)·모루.
func _build_forge() -> void:
	var r := _root("Forge", FORGE_CELL)
	_solid_box(r, FORGE_SIZE, Vector3(0, FORGE_SIZE.y * 0.5, 0), PLASTER)
	_box(r, Vector3(FORGE_SIZE.x + 1.0, 0.4, FORGE_SIZE.z + 1.0), Vector3(0, FORGE_SIZE.y + 0.5, 0), THATCH)
	_box(r, Vector3(1.0, 3.0, 1.0), Vector3(2.0, FORGE_SIZE.y + 1.5, -1.2), STONE) # 굴뚝
	_box(r, Vector3(1.6, 2.2, 0.1), Vector3(-1.0, 1.1, FORGE_SIZE.z * 0.5 + 0.06), Color(0.1, 0.07, 0.05)) # 문
	## 화덕 — 불꽃이 솟다 멈춘 모양(호박빛, 흔들리지 않는다)
	var hearth := Vector3(1.8, 0, FORGE_SIZE.z * 0.5 + 2.2)
	_box(r, Vector3(1.6, 1.0, 1.4), hearth + Vector3(0, 0.5, 0), STONE)
	for k in 3:
		var fl := _box(r, Vector3(0.3 - k * 0.06, 0.8 + k * 0.3, 0.3 - k * 0.06), hearth + Vector3(-0.3 + k * 0.3, 1.4 + k * 0.1, 0), EMBER)
		fl.material_override = _glow(EMBER, 1.6)
		fl.rotation.z = 0.2 - k * 0.2
	## 모루·망치
	_box(r, Vector3(0.8, 0.7, 0.5), Vector3(-1.4, 0.35, FORGE_SIZE.z * 0.5 + 2.4), IRON)
	_box(r, Vector3(1.2, 0.3, 0.4), Vector3(-1.4, 0.85, FORGE_SIZE.z * 0.5 + 2.4), IRON)
	_label(r, "대장간", Vector3(0, FORGE_SIZE.y + 2.2, 0), Color(1.0, 0.85, 0.6))

## 세갈래 길목 — 세 갈래 이정표(보기만) · 머리 위 하늘 틈(보라빛 금)·멈춘 번개 줄기·틈을 삼키려다 멈춘 별까마귀.
func _build_junction() -> void:
	var root := _root("Junction", JUNCTION_CELL)
	_box(root, Vector3(0.3, 3.0, 0.3), Vector3(0, 1.5, 0), WOOD)
	for k in 3:
		var arm := _box(root, Vector3(1.6, 0.35, 0.08), Vector3.ZERO, WOOD.lightened(0.15))
		var yaw: float = [PI, 0.0, PI * 0.5][k] # 서(역참길)·동(선로)·북(종루)
		arm.rotation.y = yaw
		arm.position = Vector3(cos(yaw) * -0.8, 2.4 - k * 0.4, sin(yaw) * 0.8)
	_label(root, "세갈래 길목", Vector3(0, 3.8, 0), Color(1.0, 0.92, 0.7))
	## 하늘 틈 — 들쭉날쭉한 빛 금(보기만)
	_rift = Node3D.new()
	_rift.name = "SkyRift"
	_rift.position = Vector3(0, RIFT_Y, 0)
	root.add_child(_rift)
	var pts := [Vector3(-14, 0, -2), Vector3(-8, 1.5, 1), Vector3(-3, -1, -1), Vector3(2, 1.2, 2), Vector3(7, -0.8, 0), Vector3(13, 1.0, -2)]
	for i in pts.size() - 1:
		var a: Vector3 = pts[i]
		var b: Vector3 = pts[i + 1]
		var seg := _box(_rift, Vector3((b - a).length(), 1.4 - absf(float(i) - 2.5) * 0.25, 0.3), (a + b) * 0.5, RIFT)
		seg.material_override = _glow(RIFT, 2.4)
		seg.rotation.y = -atan2(b.z - a.z, b.x - a.x)
		seg.rotation.z = atan2(b.y - a.y, Vector2(b.x - a.x, b.z - a.z).length())
		seg.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	var bolt := _box(_rift, Vector3(0.25, RIFT_Y - CROW_Y - 3.0, 0.25), Vector3(0.4, -(RIFT_Y - CROW_Y) * 0.5 + 1.5, 0), AMBER)
	bolt.material_override = _glow(AMBER, 1.8)
	bolt.rotation.z = 0.08
	## 멈춘 별까마귀 — 코드 몸 bird(틈 삼킨 별까마귀와 같은 빛깔), 부리를 하늘 틈 쪽으로
	_crow = CreatureBuilder.build("bird", [Color(0.14, 0.13, 0.22), Color(0.62, 0.45, 1.0), Color(1.0, 0.84, 0.35)])
	CreatureBuilder._fit(_crow, "bird", 4.4)
	_crow.name = "FrozenCrow"
	_crow.position = Vector3(0, CROW_Y, 0)
	_crow.rotation = Vector3(-0.5, 0.6, 0.0)
	root.add_child(_crow)
	var shell := MeshInstance3D.new()
	var sm := SphereMesh.new()
	sm.radius = 1.2 # 몸 배율(_fit)을 받아 약 4.4m
	sm.height = 2.4
	shell.mesh = sm
	shell.material_override = _glass(AMBER, 0.18)
	shell.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	shell.position = Vector3(0, 0.6, 0)
	_crow.add_child(shell)

## 선로 공사장(현대) — 선로(보기만)·멈춘 증기 기관차(충돌, 멈춘 김)·천막·측량 말뚝.
func _build_works() -> void:
	var rail_from := TestMap.world_pos(4.7, LOCO_CELL.y, REGION)
	var rail_to := TestMap.world_pos(7.6, LOCO_CELL.y, REGION)
	var rr := Node3D.new()
	rr.name = "Rails"
	add_child(rr)
	var n := int((rail_to.x - rail_from.x) / 2.0)
	for i in n:
		var p := rail_from + Vector3(i * 2.0, 0, 0)
		p.y = TerrainBuilder.height_at(REGION, p)
		_box(rr, Vector3(0.4, 0.15, 2.6), p + Vector3(0, 0.08, 0), WOOD.darkened(0.2)) # 침목
		for z in [-0.75, 0.75]:
			_box(rr, Vector3(2.05, 0.14, 0.12), p + Vector3(0, 0.22, z), RAIL)
	var lo := _root("Locomotive", LOCO_CELL)
	_solid_box(lo, LOCO_SIZE, Vector3(0, LOCO_SIZE.y * 0.5 + 0.3, 0), IRON)
	_box(lo, Vector3(2.6, 1.6, 3.1), Vector3(-2.2, LOCO_SIZE.y + 1.1, 0), IRON.lightened(0.1)) # 기관실
	_box(lo, Vector3(0.8, 1.6, 0.8), Vector3(2.6, LOCO_SIZE.y + 1.1, 0), IRON) # 굴뚝
	_box(lo, Vector3(8.1, 0.25, 3.1), Vector3(0, 0.9, 0), Color(0.6, 0.15, 0.12)) # 붉은 띠
	for k in 4: # 멈춘 김 — 굴뚝에서 뿜다 굳은 흰 덩이
		var puff := MeshInstance3D.new()
		var pm := SphereMesh.new()
		pm.radius = 0.6 + k * 0.25
		pm.height = pm.radius * 2.0
		puff.mesh = pm
		puff.material_override = _glass(Color(0.95, 0.95, 0.92), 0.7)
		puff.position = Vector3(2.6 - k * 0.9, LOCO_SIZE.y + 2.4 + k * 0.9, 0)
		lo.add_child(puff)
	_label(lo, "멈춘 기관차", Vector3(0, LOCO_SIZE.y + 4.6, 0), Color(0.95, 0.95, 0.85))
	var w := _root("Works", WORKS_CELL)
	for k in 2:
		var tent := Node3D.new()
		tent.position = Vector3(k * 7.0 - 3.5, 0, k * 1.5)
		w.add_child(tent)
		for s in [-1.0, 1.0]:
			var side := _box(tent, Vector3(4.0, 0.08, 2.4), Vector3(0, 1.1, s * 0.85), CANVAS)
			side.rotation.x = s * 0.9
		for x in [-1.9, 1.9]:
			_box(tent, Vector3(0.08, 2.0, 0.08), Vector3(x, 1.0, 0), WOOD)
	_box(w, Vector3(2.0, 0.8, 1.0), Vector3(0.5, 0.4, 3.0), Color(0.35, 0.4, 0.3)) # 공구 상자
	_label(w, "선로 공사장", Vector3(0, 3.6, 0), Color(0.95, 0.95, 0.85))

## 종루 — 돌 기단 탑(충돌, 벽 타기 TOWER_H) · 윗면 턱 없음 · 옆 종(보기만).
func _build_tower() -> void:
	var root := _root("BellTower", TOWER_CELL)
	_solid_box(root, Vector3(TOWER_W, TOWER_H, TOWER_W), Vector3(0, TOWER_H * 0.5, 0), STONE)
	for y in [3.0, 6.5]:
		_box(root, Vector3(TOWER_W + 0.2, 0.3, TOWER_W + 0.2), Vector3(0, y, 0), WOOD)
	var bell := MeshInstance3D.new()
	var cm := CylinderMesh.new()
	cm.top_radius = 0.5
	cm.bottom_radius = 0.9
	cm.height = 1.5
	bell.mesh = cm
	bell.material_override = _mat(Color(0.4, 0.34, 0.22))
	bell.position = Vector3(0, TOWER_H - 2.5, TOWER_W * 0.5 + 0.8)
	bell.rotation.x = 0.35 # 울리다 멈춘 채 기울어 있다
	root.add_child(bell)
	_box(root, Vector3(0.2, 0.2, 1.4), Vector3(0, TOWER_H - 1.6, TOWER_W * 0.5 + 0.5), WOOD)
	_label(root, "종루", Vector3(0, TOWER_H + 5.0, 0), Color(1.0, 0.92, 0.7))

## 격자 말뚝 셋 — 빛 틀(기둥 넷·가로대)·가운데 호박 심. 땅의 둘은 밑동만 충돌. 꺼지면 빛 틀·심이 사라지고 밑동만 남는다.
func _build_lattices() -> void:
	for k in LATTICES.size():
		var r := Node3D.new()
		r.name = "Lattice_%d" % k
		add_child(r)
		r.position = lattice_pos(k)
		if k < 2:
			_solid_box(r, Vector3(1.4, 0.8, 1.4), Vector3(0, 0.4, 0), Color(0.3, 0.32, 0.36))
		else:
			_box(r, Vector3(1.4, 0.2, 1.4), Vector3(0, 0.1, 0), Color(0.3, 0.32, 0.36))
		var frame := Node3D.new()
		frame.name = "Frame"
		r.add_child(frame)
		for i in 4:
			var a := i * PI * 0.5 + PI * 0.25
			var post := _box(frame, Vector3(0.12, LATTICE_H, 0.12), Vector3(cos(a) * 0.6, LATTICE_H * 0.5 + 0.2, sin(a) * 0.6), GLOW)
			post.material_override = _glow(GLOW, 1.3)
		for y in [1.5, 3.5, 5.5]:
			var bar := _box(frame, Vector3(1.3, 0.08, 1.3), Vector3(0, y, 0), GLOW)
			bar.material_override = _glow(GLOW, 1.0)
		var core := _box(frame, Vector3(0.6, 0.6, 0.6), Vector3(0, LATTICE_H * 0.5, 0), AMBER)
		core.material_override = _glow(AMBER, 2.0)
		core.rotation = Vector3(0.6, 0.6, 0)
		_label(r, String(LATTICES[k][0]), Vector3(0, LATTICE_H + 1.2, 0), Color(0.8, 0.95, 1.0))
		_lattice_cores.append(frame)

## 공중에 멈춘 호박 알갱이 — 땅 위 2~14m, 고을 안쪽 칸에 고르게(보기만). 순간이 풀리면 사라진다.
func _build_specks() -> void:
	_specks = Node3D.new()
	_specks.name = "FrozenSpecks"
	add_child(_specks)
	var mat := _glow(AMBER, 1.2)
	for i in SPECKS:
		var c := Vector2(1.2 + fmod(float(i) * 2.618, 5.6), 1.4 + fmod(float(i) * 1.733, 5.4))
		var p := cell_pos(c) + Vector3(0, 2.0 + fmod(float(i) * 3.7, 12.0), 0)
		var s := _box(_specks, Vector3(0.18, 0.18, 0.18), Vector3.ZERO, AMBER)
		s.material_override = mat
		s.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		s.global_position = p
		s.rotation = Vector3(i * 0.7, i * 1.3, 0)

## 호박 장막 — 고개 칸 남쪽 변에 선 호박빛 막(충돌 — 순간이 풀리면 걷힘). 굳은 거리 결정 막과 같은 틀.
func _build_gate() -> void:
	var p := TestMap.world_pos(GATE_CELL.x, GATE_CELL.y, REGION)
	p.y = TerrainBuilder.height_at(REGION, TestMap.world_pos(4.0, 8.0, REGION))
	var root := Node3D.new()
	root.name = "ForkGate"
	add_child(root)
	root.position = p
	_gate_veil = Node3D.new()
	_gate_veil.name = "Veil"
	root.add_child(_gate_veil)
	var veil := MeshInstance3D.new()
	var qm := QuadMesh.new()
	qm.size = Vector2(TestMap.TILE_SIZE, 14.0)
	veil.mesh = qm
	veil.material_override = _glass(AMBER, 0.5)
	veil.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	veil.position = Vector3(0, 7.0, 0)
	_gate_veil.add_child(veil)
	var lbl := Label3D.new()
	lbl.text = "호박 장막 — 굳은 순간"
	lbl.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	lbl.font_size = 40
	lbl.outline_size = 8
	lbl.pixel_size = 0.008
	lbl.modulate = Color(1.0, 0.85, 0.55)
	lbl.position = Vector3(0, 4.0, 0)
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

## 작은 발견 — 모양마다 몇 개 도형. 충돌 없음(길을 막지 않게).
func _build_small(id: String, c: Vector2, shape: String) -> void:
	var r := _root("Small_" + id, c)
	match shape:
		"well":
			var ring := MeshInstance3D.new()
			var cm := CylinderMesh.new()
			cm.top_radius = 1.0
			cm.bottom_radius = 1.1
			cm.height = 0.9
			ring.mesh = cm
			ring.material_override = _mat(STONE)
			ring.position = Vector3(0, 0.45, 0)
			r.add_child(ring)
			for x in [-0.9, 0.9]:
				_box(r, Vector3(0.15, 2.2, 0.15), Vector3(x, 1.1, 0), WOOD)
			_box(r, Vector3(2.0, 0.15, 0.15), Vector3(0, 2.2, 0), WOOD)
			_box(r, Vector3(0.04, 1.0, 0.04), Vector3(0, 1.7, 0), Color(0.6, 0.55, 0.4))
			_box(r, Vector3(0.4, 0.35, 0.4), Vector3(0, 1.15, 0), WOOD.darkened(0.2)) # 올라오다 멈춘 두레박
		"laundry":
			for x in [-2.0, 2.0]:
				_box(r, Vector3(0.12, 2.2, 0.12), Vector3(x, 1.1, 0), WOOD)
			_box(r, Vector3(4.0, 0.03, 0.03), Vector3(0, 2.1, 0), Color(0.8, 0.8, 0.75))
			for k in 3:
				var cloth := _box(r, Vector3(0.8, 0.9, 0.04), Vector3(-1.2 + k * 1.2, 1.6, 0.25), [Color(0.95, 0.95, 0.9), Color(0.55, 0.65, 0.8), Color(0.85, 0.6, 0.55)][k])
				cloth.rotation.x = -0.9 # 바람에 들린 채
		"kite":
			var kite := Node3D.new()
			kite.position = Vector3(0, 9.0, 0)
			kite.rotation = Vector3(0.2, 0.4, 0.3)
			r.add_child(kite)
			_box(kite, Vector3(1.2, 1.5, 0.04), Vector3.ZERO, Color(0.95, 0.92, 0.85))
			var hole := MeshInstance3D.new()
			var hm := CylinderMesh.new()
			hm.top_radius = 0.25
			hm.bottom_radius = 0.25
			hm.height = 0.05
			hole.mesh = hm
			hole.material_override = _mat(Color(0.7, 0.2, 0.18))
			hole.rotation.x = PI * 0.5
			kite.add_child(hole)
			_box(r, Vector3(0.02, 9.0, 0.02), Vector3(0.6, 4.5, 0), Color(0.9, 0.9, 0.85)) # 연줄
			_floaters.append([kite, kite.position.y, 0.3])
		"tripod":
			for k in 3:
				var a := k * TAU / 3.0
				var leg := _box(r, Vector3(0.06, 1.6, 0.06), Vector3(cos(a) * 0.35, 0.75, sin(a) * 0.35), Color(0.85, 0.7, 0.2))
				leg.rotation = Vector3(sin(a) * 0.25, 0, -cos(a) * 0.25)
			_box(r, Vector3(0.4, 0.25, 0.25), Vector3(0, 1.65, 0), IRON)
		"rails":
			for k in 4:
				_box(r, Vector3(5.0, 0.14, 0.14), Vector3(0, 0.1 + k * 0.15, k * 0.2 - 0.3), RAIL)
			for k in 3:
				_box(r, Vector3(0.3, 0.2, 2.4), Vector3(-1.6 + k * 1.6, 0.1, 1.8), WOOD.darkened(0.2))
		"flag":
			_box(r, Vector3(0.06, 2.4, 0.06), Vector3(0, 1.2, 0), Color(0.9, 0.9, 0.9))
			var fl := _box(r, Vector3(0.8, 0.5, 0.03), Vector3(0.43, 2.1, 0), Color(0.95, 0.4, 0.15))
			fl.rotation.y = 0.3
			_floaters.append([fl, fl.position.y, 1.4])
		"drone_down":
			var d := Node3D.new()
			d.rotation = Vector3(0.4, 0.3, 0.6)
			d.position = Vector3(0, 0.4, 0)
			r.add_child(d)
			_box(d, Vector3(0.9, 0.3, 0.9), Vector3.ZERO, ALLOY)
			for j in 3:
				_box(d, Vector3(0.6, 0.05, 0.14), Vector3(cos(j * 2.0) * 0.7, 0.2, sin(j * 2.0) * 0.7), IRON)
			var eye := _box(d, Vector3(0.3, 0.1, 0.1), Vector3(0, 0, 0.46), GLOW)
			eye.material_override = _glow(GLOW, 0.6)
		"lattice_shard":
			for k in 3:
				var bar := _box(r, Vector3(0.12, 2.2 - k * 0.5, 0.12), Vector3(k * 0.5 - 0.5, 0.4, (k % 2) * 0.4), GLOW)
				bar.material_override = _glow(GLOW, 0.8)
				bar.rotation = Vector3(1.2, k * 0.7, 0.2)
			var cc := _box(r, Vector3(0.35, 0.35, 0.35), Vector3(0.2, 0.25, 0.3), AMBER)
			cc.material_override = _glow(AMBER, 1.4)
		"frozen_rain":
			for k in 24:
				var drop := _box(r, Vector3(0.05, 0.22, 0.05), Vector3(cos(k * 2.4) * (0.5 + fmod(k * 0.37, 2.5)), 1.0 + fmod(k * 0.61, 5.0), sin(k * 2.4) * (0.5 + fmod(k * 0.37, 2.5))), Color(0.7, 0.85, 1.0))
				drop.material_override = _glass(Color(0.7, 0.85, 1.0), 0.75)
		"frozen_birds":
			for k in 5:
				var b := Node3D.new()
				b.position = Vector3(cos(k * 1.3) * 2.0, 3.0 + k * 0.7, sin(k * 1.3) * 2.0)
				b.rotation.y = k * 0.9
				r.add_child(b)
				_box(b, Vector3(0.25, 0.15, 0.4), Vector3.ZERO, Color(0.25, 0.22, 0.2))
				for s in [-1.0, 1.0]:
					var wing := _box(b, Vector3(0.5, 0.04, 0.25), Vector3(s * 0.35, 0.05, 0), Color(0.3, 0.27, 0.24))
					wing.rotation.z = s * 0.5

# ---------------------------------------------------------------- 도우미(region9_vault.gd 와 같은 결)

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

## 반투명 빛 유리 — 장막·껍질·빗방울.
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
