extends Node3D

## VERTICAL_SLICE_FOREST.md 4절 "집 하나 + 들어가기/나가기 — 구면 투영이
## 실제로 꺼졌다 켜지는 것을 증명하는 자리". 1절 결정 그대로: 외부는
## 마을 좌표계에서 곡률 셰이더(WorldCurveMaterial)를 쓰고, 내부는
## world_curve.gdshaderinc의 include를 아예 안 쓰는 평범한
## StandardMaterial3D로 짓는다. 씬 전환(로딩) 없이 텔레포트로만 오간다
## — 내부는 마을과 절대 안 겹치는 먼 좌표(INTERIOR_ORIGIN)에 짓는다.
##
## GO landmarks_builder.gd의 마을집(_add_village, _build_wall_perimeter)과
## 같은 GLB·재질 재사용이지만, 그쪽은 "들어가는 씬이 아니다"(장식)라 문
## 구멍이 없다 — 이 집은 실제로 들어가야 해서 남쪽 벽 가운데를 비우고
## (문틀 없이 뚫린 개구부, 프로토타입 수준) 충돌도 그 자리만 비운다.

const ForestMap := preload("res://games/saga_forest/data/village_map.gd")
const TerrainBuilder := preload("res://games/saga_forest/world/forest_terrain_builder.gd")
const GLBUtils := preload("res://saga_core/world/glb_utils.gd")
const WorldCurveMaterial := preload("res://saga_core/world/world_curve_material.gd")
const Toast := preload("res://saga_core/ui/toast.gd")
const ChoicePrompt := preload("res://saga_core/ui/choice_prompt.gd")
const ForestHome := preload("res://games/saga_forest/data/forest_home.gd")

## 제외 목록 6번(벽지/장판) — 웹판 js/data-village.js WALLS/FLOORS 그대로
## (이름·값·색 하나 안 바꿈). 웹판은 방 크기·가구·증축(빚)까지 딸린 큰
## "집 꾸미기" 체계지만, 이번 항목이 요청받은 것은 벽지·장판뿐이라 그
## 둘만 옮긴다 — 가구 배치·증축은 범위 밖으로 남긴다(다음에 "집 꾸미기"
## 자체를 넓힐 때 이 표를 이어 쓰면 된다).
##
## **신규 종류(2026-09-15 추가)** — 웹판엔 없던, 이 슬라이스만의 프리미엄
## 티어 둘씩. `_daily_pick()`·`_open_finish_menu()`·ForestSaveState.owns_finish()
## 전부 키를 문자열로만 다뤄 목록 길이에 의존하지 않는 데이터 기반 구조라
## (32장 원칙) 코드 변경 없이 항목만 더했다. 기존 최고가(벽 5200·장판
## 4200)보다 확실히 비싸게 잡아 "다음 목표"로 남게 했다 — 도감 펫과
## 달리 이건 창작 항목이라 id 고정 걱정 없이 자유롭게 늘릴 수 있다.
const WALLS := [
	{"key": "earth", "name": "흙벽", "price": 0, "c": "#e6d8bd"},
	{"key": "hanji", "name": "한지벽", "price": 2000, "c": "#f4ecda"},
	{"key": "sol", "name": "솔빛벽", "price": 3800, "c": "#5f7f5a"},
	{"key": "muk", "name": "먹빛벽", "price": 3200, "c": "#5a5f6a"},
	{"key": "dan", "name": "단청벽", "price": 5200, "c": "#c05a44"},
	{"key": "cheonghwa", "name": "청화벽", "price": 6400, "c": "#3d5a80"},
	{"key": "geumbak", "name": "금박벽", "price": 8000, "c": "#d4af37"},
]
const FLOORS := [
	{"key": "wood", "name": "마루", "price": 0, "a": "#c2925c"},
	{"key": "mat", "name": "돗자리", "price": 1800, "a": "#c8b98a"},
	{"key": "jangpan", "name": "장판", "price": 2200, "a": "#d8b26a"},
	{"key": "stone", "name": "박석", "price": 3400, "a": "#9aa0a6"},
	{"key": "ondol", "name": "구들장", "price": 4200, "a": "#b0a08a"},
	{"key": "hongmok", "name": "홍목마루", "price": 5800, "a": "#8a3d2b"},
	{"key": "okdol", "name": "옥돌마루", "price": 6600, "a": "#6fa287"},
]
const FINISH_SHOP_RADIUS := 1.6

## FOREST 콘텐츠 확장 1호(가구) — 웹판 home.js "놓기·집어 들기"를
## 이어서 옮긴다. 타일 개념이 없는 이 3D 방이라 간단한 격자로 자리를
## 가른다(웹판의 "타일 하나에 하나" 규칙과 같은 정신).
const PLACE_CELL := 1.0
const PLACE_MARGIN := 0.5    # 방 벽에서 이만큼은 비워 둔다
const DOOR_CLEAR := 1.5      # 문 앞은 비워 둔다(웹판 canPlaceHere()의 door 검사)
const SHOP_CLEAR := 1.0      # 장(FinishShop) 자리도 비워 둔다
const ITEM_CLEAR := 0.9      # 이미 놓인 것과 이만큼은 떨어져야 한다

## G-0020 — 벽 블록·지붕 조각(Kenney) 대신 통일 툰 오두막 한 채. 문이 모델 +z 쪽이라 180° 돌려 남쪽(-z)에 맞춘다.
const HOUSE_GLB := "res://assets/world/forest_cottage_01.glb"   # 6.8×6.6×7.6m, z -7.0~0.6
const HOUSE_SCALE := 0.85
const CURVE_AMOUNT := 0.004

const FOOTPRINT := Vector3(6, 4, 6)
const DOOR_HALF_WIDTH := 1.0
const HOUSE_GRID := Vector2i(15, 9)  # village_map.gd의 "H" 타일과 같은 자리

## 마을과 절대 안 겹치는 먼 좌표 — 씬 전환 없이 텔레포트만으로 오간다.
const INTERIOR_ORIGIN := Vector3(500, 0, 500)
const INTERIOR_WALL_HEIGHT := 4.0

var _exterior_spawn := Vector3.ZERO
var _interior_spawn := Vector3.ZERO
var _floor_mat: StandardMaterial3D = null
var _wall_mat: StandardMaterial3D = null
var _in_finish_shop := false
var _interior_node: Node3D = null
var _player_indoors := false
var _home_items_synced := false
var _furniture_nodes: Array = []  # ForestSaveState.home_items와 같은 인덱스

## FOREST 콘텐츠 확장 2호(증축) — 방 크기가 ForestSaveState.home_tier에
## 따라 바뀌므로, 그 crust(바닥·벽·장·나가는 자리)만 따로 추적해 두고
## 증축할 때 이것만 지우고 다시 짓는다(가구는 _furniture_nodes로 별도
## 관리라 안 건드린다).
var _shell_nodes: Array = []
var _half_x := 0.0
var _half_z := 0.0


func _ready() -> void:
	_build_exterior()
	_build_interior()


func _process(_delta: float) -> void:
	_apply_finish_visuals()
	if not _home_items_synced:
		## forest_village.gd(부모)의 _ready()가 이 노드의 _ready()보다
		## 나중에 돌아 ForestSaveState.try_load()가 아직 안 끝났을 수
		## 있다(GO test_village.gd·FOREST forest_village.gd 상단 주석의
		## 그 순서 규칙) — 그래서 _build_interior() 시점이 아니라 첫
		## _process() 프레임(모든 _ready()가 끝난 뒤)에 한 번만 놓는다.
		_home_items_synced = true
		for it: Dictionary in ForestSaveState.home_items:
			_spawn_furniture_visual(it)
	if _in_finish_shop and Input.is_action_just_pressed("forest_gather"):
		_open_finish_menu()
		return
	if _player_indoors and Input.is_action_just_pressed("forest_gather"):
		_try_pickup()
	if _player_indoors and Input.is_action_just_pressed("forest_plant"):
		_open_place_menu()


func _build_exterior() -> void:
	var ground: float = TerrainBuilder.LEGEND["H"].height
	var base_pos := ForestMap.world_pos(HOUSE_GRID.x, HOUSE_GRID.y) + Vector3(0, ground, 0)

	var house := Node3D.new()
	house.name = "House"
	house.position = base_pos
	house.add_to_group("codex_discoverable")
	add_child(house)

	var house_mesh := GLBUtils.extract_mesh(HOUSE_GLB)
	if house_mesh != null:
		var visual := MeshInstance3D.new()
		visual.name = "Cottage"
		visual.mesh = WorldCurveMaterial.textured_surfaces(house_mesh, CURVE_AMOUNT)
		## 모델 중심 z=-3.2 → 180° 돌린 뒤 +3.2 → 배율 → 집 중심(0,0)에 오도록 옮긴다. 문 면은 z≈-3.2(남쪽 개구부 자리).
		visual.transform = Transform3D(Basis(Vector3.UP, PI).scaled(Vector3.ONE * HOUSE_SCALE), Vector3(0, 0, -3.2 * HOUSE_SCALE))
		house.add_child(visual)

	_build_exterior_wall_collision(house)

	var enter_area := Area3D.new()
	enter_area.name = "EnterTrigger"
	enter_area.position = Vector3(0, 1.0, -4.0)
	var cs := CollisionShape3D.new()
	var shape := BoxShape3D.new()
	shape.size = Vector3(DOOR_HALF_WIDTH * 2, 3.0, 2.0)
	cs.shape = shape
	enter_area.add_child(cs)
	house.add_child(enter_area)
	enter_area.body_entered.connect(_on_enter_house)

	## 밖에서 다시 나왔을 때 서는 자리 — EnterTrigger(local z=-4, 범위
	## -5..-3)보다 확실히 더 남쪽이라 도착하자마자 다시 안으로 빨려들지 않는다.
	_exterior_spawn = base_pos + Vector3(0, 0.1, -6.0)


## 시각 메시(MultiMesh)와 별도로 벽 넷을 충돌체로 놓는다 — 남쪽만 문
## 자리만큼 갈라 틈을 남긴다(DUNGEON test_room.gd의 _spawn_walls와 같은
## 발상). GO landmarks_builder.gd의 마을집은 문이 없어 한 박스로 충분했지만
## 이 집은 실제로 들어가야 해서 갈라야 한다.
func _build_exterior_wall_collision(parent: Node3D) -> void:
	var half: float = FOOTPRINT.x * 0.5
	var height: float = FOOTPRINT.y
	_wall(Vector3(FOOTPRINT.x, height, 1.0), Vector3(0, height * 0.5, half), parent)  # 북
	_wall(Vector3(1.0, height, FOOTPRINT.z), Vector3(half, height * 0.5, 0), parent)  # 동
	_wall(Vector3(1.0, height, FOOTPRINT.z), Vector3(-half, height * 0.5, 0), parent)  # 서

	var seg_len: float = half - DOOR_HALF_WIDTH
	if seg_len > 0.0:
		var seg_center: float = DOOR_HALF_WIDTH + seg_len * 0.5
		_wall(Vector3(seg_len, height, 1.0), Vector3(seg_center, height * 0.5, -half), parent)
		_wall(Vector3(seg_len, height, 1.0), Vector3(-seg_center, height * 0.5, -half), parent)


func _wall(size: Vector3, local_pos: Vector3, parent: Node3D) -> void:
	var body := StaticBody3D.new()
	body.position = local_pos
	var cs := CollisionShape3D.new()
	var box := BoxShape3D.new()
	box.size = size
	cs.shape = box
	body.add_child(cs)
	parent.add_child(body)


func _build_interior() -> void:
	var interior := Node3D.new()
	interior.name = "Interior"
	interior.position = INTERIOR_ORIGIN
	add_child(interior)
	_interior_node = interior

	## 평범한 StandardMaterial3D — world_curve.gdshaderinc를 아예 안 쓴다
	## (1절 "집 안·동굴 안은 이 include를 아예 안 쓰는 머티리얼로 남긴다").
	## 색은 _apply_finish_visuals()가 ForestSaveState.floor_key/wall_key를
	## 보고 매 프레임 다시 칠한다(제외 목록 6번, 벽지/장판) — 여기 값은
	## 첫 프레임까지의 임시 기본값일 뿐이다. 증축(_rebuild_interior_shell)이
	## 지오메트리를 다시 지어도 이 머티리얼 객체는 그대로 재사용한다.
	_floor_mat = StandardMaterial3D.new()
	_floor_mat.albedo_color = Color(0.55, 0.42, 0.28)
	_floor_mat.roughness = 0.9

	_wall_mat = StandardMaterial3D.new()
	_wall_mat.albedo_color = Color(0.42, 0.36, 0.3)
	_wall_mat.roughness = 0.95

	_rebuild_interior_shell()


## FOREST 콘텐츠 확장 2호(증축) — 바닥·벽·장·나가는 자리를 ForestSaveState.
## home_tier가 가리키는 크기로 (다시) 짓는다. _build_interior()의 첫
## 호출도 이걸 거치고, 증축 직후에도 같은 함수를 한 번 더 불러 그 자리에서
## 방을 넓힌다(씬 재로드 없이 — 웹판 expand()의 core.emit('changed')와
## 같은 즉시 반영).
func _rebuild_interior_shell() -> void:
	for n: Node in _shell_nodes:
		if is_instance_valid(n):
			n.queue_free()
	_shell_nodes.clear()

	var tier: Dictionary = ForestHome.tier_at(ForestSaveState.home_tier)
	_half_x = float(tier.half_x)
	_half_z = float(tier.half_z)
	var interior := _interior_node

	var floor_mesh := PlaneMesh.new()
	floor_mesh.size = Vector2(_half_x * 2, _half_z * 2)
	var floor_mi := MeshInstance3D.new()
	floor_mi.name = "InteriorFloor"
	floor_mi.mesh = floor_mesh
	floor_mi.material_override = _floor_mat
	interior.add_child(floor_mi)
	_shell_nodes.append(floor_mi)

	var floor_box := BoxShape3D.new()
	floor_box.size = Vector3(_half_x * 2, 0.4, _half_z * 2)
	var floor_cs := CollisionShape3D.new()
	floor_cs.shape = floor_box
	var floor_body := StaticBody3D.new()
	floor_body.name = "InteriorFloorCollision"
	floor_body.position = Vector3(0, -0.2, 0)
	floor_body.add_child(floor_cs)
	interior.add_child(floor_body)
	_shell_nodes.append(floor_body)

	_shell_nodes.append(_interior_wall(Vector3(_half_x * 2, INTERIOR_WALL_HEIGHT, 1.0),
		Vector3(0, INTERIOR_WALL_HEIGHT * 0.5, _half_z), _wall_mat, interior))  # 북
	_shell_nodes.append(_interior_wall(Vector3(1.0, INTERIOR_WALL_HEIGHT, _half_z * 2),
		Vector3(_half_x, INTERIOR_WALL_HEIGHT * 0.5, 0), _wall_mat, interior))  # 동
	_shell_nodes.append(_interior_wall(Vector3(1.0, INTERIOR_WALL_HEIGHT, _half_z * 2),
		Vector3(-_half_x, INTERIOR_WALL_HEIGHT * 0.5, 0), _wall_mat, interior))  # 서

	var south_seg_len: float = _half_x - DOOR_HALF_WIDTH
	var south_seg_center: float = DOOR_HALF_WIDTH + south_seg_len * 0.5
	_shell_nodes.append(_interior_wall(Vector3(south_seg_len, INTERIOR_WALL_HEIGHT, 1.0),
		Vector3(south_seg_center, INTERIOR_WALL_HEIGHT * 0.5, -_half_z), _wall_mat, interior))
	_shell_nodes.append(_interior_wall(Vector3(south_seg_len, INTERIOR_WALL_HEIGHT, 1.0),
		Vector3(-south_seg_center, INTERIOR_WALL_HEIGHT * 0.5, -_half_z), _wall_mat, interior))

	## 제외 목록 6번(벽지/장판) — 방 한쪽 구석에 둔 "장"(가구 없이 자리만).
	## 문(-z)·나가는 자리와 충분히 떨어져 있어(FINISH_SHOP_RADIUS=1.6m)
	## 들어오자마자 걸리지 않는다.
	var shop_area := Area3D.new()
	shop_area.name = "FinishShop"
	shop_area.position = Vector3(_half_x - 1.5, 1.0, 0)
	var shop_cs := CollisionShape3D.new()
	var shop_shape := SphereShape3D.new()
	shop_shape.radius = FINISH_SHOP_RADIUS
	shop_cs.shape = shop_shape
	shop_area.add_child(shop_cs)
	interior.add_child(shop_area)
	shop_area.body_entered.connect(_on_finish_shop_entered)
	shop_area.body_exited.connect(_on_finish_shop_exited)
	_shell_nodes.append(shop_area)

	var exit_area := Area3D.new()
	exit_area.name = "ExitTrigger"
	exit_area.position = Vector3(0, 1.0, -_half_z + 1.0)
	var exit_cs := CollisionShape3D.new()
	var exit_shape := BoxShape3D.new()
	exit_shape.size = Vector3(DOOR_HALF_WIDTH * 2, 3.0, 2.0)
	exit_cs.shape = exit_shape
	exit_area.add_child(exit_cs)
	interior.add_child(exit_area)
	exit_area.body_entered.connect(_on_exit_house)
	_shell_nodes.append(exit_area)

	## ExitTrigger(local z=-half_z+1, 범위 half_z-2..half_z)보다 확실히 더
	## 안쪽이라 들어오자마자 다시 밖으로 안 튕겨 나간다.
	_interior_spawn = INTERIOR_ORIGIN + Vector3(0, 0.1, _half_z * 0.5)


## 시각(MeshInstance3D)+충돌(StaticBody3D) 한 쌍을 감싸는 Node3D를 돌려준다
## — 증축 때 _shell_nodes에 하나로 담아 한 번에 지울 수 있게.
func _interior_wall(size: Vector3, local_pos: Vector3, mat: StandardMaterial3D, parent: Node3D) -> Node3D:
	var root := Node3D.new()
	root.position = local_pos
	parent.add_child(root)

	var mi := MeshInstance3D.new()
	var box_mesh := BoxMesh.new()
	box_mesh.size = size
	mi.mesh = box_mesh
	mi.material_override = mat
	root.add_child(mi)

	var body := StaticBody3D.new()
	var cs := CollisionShape3D.new()
	var box := BoxShape3D.new()
	box.size = size
	cs.shape = box
	body.add_child(cs)
	root.add_child(body)
	return root


func _on_enter_house(body: Node3D) -> void:
	if not body.is_in_group("player"):
		return
	body.global_position = _interior_spawn
	_player_indoors = true
	Toast.show(self, "집 안으로 들어왔다 — 굽었던 땅이 평평해졌다.", 3.0)


func _on_exit_house(body: Node3D) -> void:
	if not body.is_in_group("player"):
		return
	body.global_position = _exterior_spawn
	_player_indoors = false
	Toast.show(self, "밖으로 나왔다 — 다시 마을이 둥글게 휘어 보인다.", 3.0)


func _on_finish_shop_entered(body: Node3D) -> void:
	if body.is_in_group("player"):
		_in_finish_shop = true


func _on_finish_shop_exited(body: Node3D) -> void:
	if body.is_in_group("player"):
		_in_finish_shop = false


func _apply_finish_visuals() -> void:
	if _wall_mat == null or _floor_mat == null:
		return
	_wall_mat.albedo_color = Color(String(_wall_by_key(ForestSaveState.wall_key).c))
	_floor_mat.albedo_color = Color(String(_floor_by_key(ForestSaveState.floor_key).a))


static func _wall_by_key(key: String) -> Dictionary:
	for w: Dictionary in WALLS:
		if String(w.key) == key:
			return w
	return WALLS[0]


static func _floor_by_key(key: String) -> Dictionary:
	for f: Dictionary in FLOORS:
		if String(f.key) == key:
			return f
	return FLOORS[0]


## 웹판 home.js shopFinish() — 날짜 해시로 오늘 하나씩만 들어온다(값이
## 0인 기본 한 벌은 진열하지 않는다). 이 파일 상단의 재접기 주석 참고 —
## 다른 스크립트 const를 식으로 못 쓰는 제약이 있어 곱은 여기서 한다.
static func _daily_pick(kind: String, day_key: int) -> Dictionary:
	var catalog: Array = WALLS if kind == "wall" else FLOORS
	var priced: Array = catalog.filter(func(f: Dictionary) -> bool: return int(f.price) > 0)
	var salt: int = 11 if kind == "wall" else 47
	var idx: int = int(floor(_hash2(day_key * 17 + salt, day_key % 733 + 5) * priced.size())) % priced.size()
	return priced[idx]


## forest_planting.gd·forest_turnip.gd와 같은 hash2 포트 — 각자 자기
## 파일에 둔다(공용화할 이유가 없다는 이 코드베이스의 확립된 결).
static func _hash2(x: int, y: int) -> float:
	var h: int = (x * 374761393 + y * 668265263) & 0xFFFFFFFF
	h = ((h ^ (h >> 13)) * 1274126177) & 0xFFFFFFFF
	h = h ^ (h >> 16)
	return float(h & 0x7fffffff) / float(0x7fffffff)


## G를 누르면 오늘의 벽지·장판 진열(안 가졌으면 사기) + 가진 것 갈아 바르기.
func _open_finish_menu() -> void:
	var layer_box := {}
	var choices: Array = []
	var day := ForestDay.today_key()

	for kind in ["wall", "floor"]:
		var today: Dictionary = _daily_pick(kind, day)
		if not ForestSaveState.owns_finish(kind, String(today.key)):
			var word := "벽지" if kind == "wall" else "장판"
			choices.append({
				"label": "%s %s 사기 (🪙%d)" % [word, today.name, int(today.price)],
				"cb": func() -> void: _buy_finish(kind, today, layer_box),
			})

	var owned_walls: Array = WALLS.filter(func(w: Dictionary) -> bool: return ForestSaveState.owns_finish("wall", String(w.key)))
	for w: Dictionary in owned_walls:
		if String(w.key) != ForestSaveState.wall_key:
			choices.append({
				"label": "벽지 — %s 바르기" % w.name,
				"cb": func() -> void: _set_finish("wall", String(w.key), layer_box),
			})
	var owned_floors: Array = FLOORS.filter(func(f: Dictionary) -> bool: return ForestSaveState.owns_finish("floor", String(f.key)))
	for f: Dictionary in owned_floors:
		if String(f.key) != ForestSaveState.floor_key:
			choices.append({
				"label": "장판 — %s 깔기" % f.name,
				"cb": func() -> void: _set_finish("floor", String(f.key), layer_box),
			})

	## FOREST 콘텐츠 확장 1호(가구) — 오늘 전방에 들어온 가구 넉 점(웹판
	## home.js shopToday() 그대로, 날짜 해시라 하루 한 벌).
	for f: Dictionary in ForestHome.daily_shop(day):
		choices.append({
			"label": "🪑 %s 사기 (🪙%d)" % [f.name, int(f.price)],
			"cb": func() -> void: _buy_furniture(f, layer_box),
		})
	if not ForestSaveState.home_stock.is_empty():
		choices.append({
			"label": "🏠 집 평가 보기",
			"cb": func() -> void: _show_home_score(layer_box),
		})

	## FOREST 콘텐츠 확장 2호(증축) — 웹판 home.js expand()/repay() 그대로:
	## 빚이 있으면 증축 신청 자체를 막고 "빚 갚기"만 보여준다.
	if ForestSaveState.home_debt > 0:
		choices.append({
			"label": "🪙 빚 갚기 (남은 🪙%d)" % ForestSaveState.home_debt,
			"cb": func() -> void: _repay_home_debt(layer_box),
		})
	else:
		var nx: Dictionary = ForestHome.next_tier(ForestSaveState.home_tier)
		if not nx.is_empty():
			choices.append({
				"label": "🏠 %s (으)로 넓히기 (빚 🪙%d 생김)" % [nx.name, int(nx.cost)],
				"cb": func() -> void: _expand_home(nx, layer_box),
			})

	if choices.is_empty():
		Toast.show(self, "장 — 지금은 딱히 바꿀 게 없다.", 2.0)
		return
	layer_box["layer"] = ChoicePrompt.build(self, "장(벽지·장판·가구)", choices)


func _buy_furniture(f: Dictionary, layer_box: Dictionary) -> void:
	(layer_box["layer"] as CanvasLayer).queue_free()
	if ForestSaveState.gold < int(f.price):
		Toast.show(self, "골드가 모자란다 (🪙%d 필요)" % int(f.price), 2.5)
		return
	ForestSaveState.gold -= int(f.price)
	ForestSaveState.home_stock_add(String(f.key), 1)
	Toast.show(self, "🪑 %s 을(를) 샀다 — 창고에 들었다([H]로 놓을 수 있다)." % f.name, 3.0)


func _show_home_score(layer_box: Dictionary) -> void:
	(layer_box["layer"] as CanvasLayer).queue_free()
	var fin := 0
	if ForestSaveState.wall_key != "earth":
		fin += 12
	if ForestSaveState.floor_key != "wood":
		fin += 12
	var sc: Dictionary = ForestHome.score(ForestSaveState.home_items, fin, ForestSaveState.home_tier)
	Toast.show(self, "🏠 %s — 평가 %d점(가구 %d점)" %
		[ForestHome.grade(int(sc.total)), int(sc.total), int(sc.n)], 4.0)


## 웹판 home.js expand() — 즉시 넓어지고 그 자리에서 빚이 생긴다(선불이
## 아니다). 방 지오메트리는 _rebuild_interior_shell()로 그 자리에서 다시
## 짓는다(씬 재로드 없음) — 이미 놓인 가구는 새 방이 항상 더 커서
## (tier가 오르기만 하지 내려가진 않는다) 좌표가 그대로 유효하다.
func _expand_home(nx: Dictionary, layer_box: Dictionary) -> void:
	(layer_box["layer"] as CanvasLayer).queue_free()
	if not ForestSaveState.expand_home(int(nx.cost)):
		Toast.show(self, "빚이 남아 있어 증축을 신청할 수 없다.", 2.5)
		return
	_rebuild_interior_shell()
	Toast.show(self, "🏠 %s (으)로 넓혔다 — 빚 🪙%d 이 생겼다." % [nx.name, int(nx.cost)], 3.0)


## 웹판 home.js repay() — 가진 금 안에서 최대한 갚는다.
func _repay_home_debt(layer_box: Dictionary) -> void:
	(layer_box["layer"] as CanvasLayer).queue_free()
	var paid := ForestSaveState.repay_home_debt(ForestSaveState.home_debt)
	if paid <= 0:
		Toast.show(self, "금이 없다.", 2.0)
		return
	if ForestSaveState.home_debt <= 0:
		Toast.show(self, "🪙 빚을 다 갚았다 (-%d)." % paid, 3.0)
	else:
		Toast.show(self, "🪙 빚을 갚았다 (-%d) — 남은 빚 🪙%d" % [paid, ForestSaveState.home_debt], 3.0)


func _buy_finish(kind: String, f: Dictionary, layer_box: Dictionary) -> void:
	(layer_box["layer"] as CanvasLayer).queue_free()
	if ForestSaveState.buy_finish(kind, String(f.key), int(f.price)):
		Toast.show(self, "🎨 %s 을(를) 샀다 — 집 시트에서 갈아 끼운다." % f.name, 3.0)
	else:
		Toast.show(self, "골드가 모자란다 (🪙%d 필요)" % int(f.price), 2.5)


func _set_finish(kind: String, key: String, layer_box: Dictionary) -> void:
	(layer_box["layer"] as CanvasLayer).queue_free()
	ForestSaveState.set_finish(kind, key)
	var name_: String = (_wall_by_key(key).name if kind == "wall" else _floor_by_key(key).name)
	Toast.show(self, "🎨 %s (으)로 바꿨다." % name_, 3.0)


## [H] — 창고에 있는 가구 하나를 지금 선 자리에 놓는다(웹판 home.js
## place()). 격자 칸(PLACE_CELL)에 반올림해 자리를 정한다 — 타일 개념이
## 없는 방이라 "한 칸에 하나" 규칙을 이걸로 흉내 낸다.
func _open_place_menu() -> void:
	var choices: Array = []
	var layer_box := {}
	for key in ForestSaveState.home_stock.keys():
		var key_s := String(key)
		var n: int = ForestSaveState.home_stock_count(key_s)
		if n <= 0:
			continue
		var f := ForestHome.furn(key_s)
		if f.is_empty():
			continue
		choices.append({
			"label": "%s 놓기(%d개 있음)" % [f.name, n],
			"cb": func() -> void: _place_furniture(key_s, layer_box),
		})
	if choices.is_empty():
		Toast.show(self, "창고에 놓을 가구가 없다 — 먼저 장에서 사 오게.", 2.5)
		return
	layer_box["layer"] = ChoicePrompt.build(self, "가구 놓기", choices)


func _place_furniture(key: String, layer_box: Dictionary) -> void:
	(layer_box["layer"] as CanvasLayer).queue_free()
	var player := get_tree().get_first_node_in_group("player")
	if player == null:
		return
	var local_pos: Vector3 = (player as Node3D).global_position - INTERIOR_ORIGIN
	var sx: float = roundf(local_pos.x / PLACE_CELL) * PLACE_CELL
	var sz: float = roundf(local_pos.z / PLACE_CELL) * PLACE_CELL

	var reason := _place_blocked_reason(sx, sz)
	if reason != "":
		Toast.show(self, reason, 2.5)
		return

	ForestSaveState.home_stock[key] = ForestSaveState.home_stock_count(key) - 1
	var entry := {"key": key, "x": sx, "z": sz}
	ForestSaveState.home_items.append(entry)
	_spawn_furniture_visual(entry)
	var f := ForestHome.furn(key)
	Toast.show(self, "🪑 %s 을(를) 놓았다." % f.name, 2.5)


func _place_blocked_reason(x: float, z: float) -> String:
	if absf(x) > _half_x - PLACE_MARGIN or absf(z) > _half_z - PLACE_MARGIN:
		return "벽에 너무 붙었다."
	if Vector2(x, z + _half_z).length() < DOOR_CLEAR:
		return "문 앞은 비워 둔다."
	if Vector2(x - (_half_x - 1.5), z).length() < SHOP_CLEAR:
		return "장 앞은 비워 둔다."
	for it: Dictionary in ForestSaveState.home_items:
		if Vector2(x - float(it.x), z - float(it.z)).length() < ITEM_CLEAR:
			return "그 자리엔 이미 무언가 있다."
	return ""


## [G] — FinishShop 반경 밖에서, 놓인 가구 가까이 서서 누르면 창고로
## 거둔다(웹판 home.js pickUp()).
func _try_pickup() -> void:
	var player := get_tree().get_first_node_in_group("player")
	if player == null:
		return
	var local_pos: Vector3 = (player as Node3D).global_position - INTERIOR_ORIGIN
	for i in ForestSaveState.home_items.size():
		var it: Dictionary = ForestSaveState.home_items[i]
		if Vector2(local_pos.x - float(it.x), local_pos.z - float(it.z)).length() < PLACE_CELL:
			var key := String(it.key)
			ForestSaveState.home_items.remove_at(i)
			ForestSaveState.home_stock_add(key, 1)
			if i < _furniture_nodes.size():
				var node: Node3D = _furniture_nodes[i]
				if is_instance_valid(node):
					node.queue_free()
				_furniture_nodes.remove_at(i)
			var f := ForestHome.furn(key)
			Toast.show(self, "🪑 %s 을(를) 거두었다." % f.name, 2.5)
			return


## primitive(GLB 없음, ForestHome.gd 상단 주석 참고) — set별 색, form별
## 대략적인 모양(상자/원기둥 크기만 다르게).
func _spawn_furniture_visual(entry: Dictionary) -> void:
	var f := ForestHome.furn(String(entry.key))
	if f.is_empty() or _interior_node == null:
		return
	var shape := _furniture_shape(String(f.form))
	var mi := MeshInstance3D.new()
	mi.mesh = shape.mesh
	mi.position = Vector3(float(entry.x), float(shape.y), float(entry.z))
	var mat := StandardMaterial3D.new()
	mat.albedo_color = _furniture_color(String(f.set))
	mi.material_override = mat
	_interior_node.add_child(mi)
	_furniture_nodes.append(mi)


func _furniture_shape(form: String) -> Dictionary:
	var box_size := Vector3(0.7, 0.35, 0.5)  # "table" 포함 기본값
	var cyl_radius := 0.0
	var cyl_height := 0.0
	match form:
		"cushion":
			box_size = Vector3(0.5, 0.15, 0.5)
		"plant":
			box_size = Vector3(0.3, 0.4, 0.3)
		"lamp":
			box_size = Vector3(0.2, 0.6, 0.2)
		"vase":
			cyl_radius = 0.18
			cyl_height = 0.5
		"scroll":
			box_size = Vector3(0.15, 0.9, 0.15)
		"brazier":
			cyl_radius = 0.25
			cyl_height = 0.3
		"chest":
			box_size = Vector3(0.6, 0.45, 0.4)
		"screen":
			box_size = Vector3(0.9, 1.0, 0.1)
		"gayageum":
			box_size = Vector3(1.3, 0.15, 0.3)

	if cyl_radius > 0.0:
		var cyl := CylinderMesh.new()
		cyl.top_radius = cyl_radius
		cyl.bottom_radius = cyl_radius
		cyl.height = cyl_height
		return {"mesh": cyl, "y": cyl_height * 0.5}

	var box := BoxMesh.new()
	box.size = box_size
	return {"mesh": box, "y": box_size.y * 0.5}


func _furniture_color(set_name: String) -> Color:
	match set_name:
		"ddeul":
			return Color(0.35, 0.55, 0.3)
		"buok":
			return Color(0.6, 0.42, 0.25)
		"sarang":
			return Color(0.45, 0.35, 0.55)
		_:  # "anbang" 포함 기본값
			return Color(0.55, 0.4, 0.3)
