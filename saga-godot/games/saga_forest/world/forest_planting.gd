extends Node3D

## VERTICAL_SLICE_FOREST.md 4절 "제외" 목록 6번 — 꽃 교배. 웹판
## js/village.js의 심기(PLANT_DAYS=3)·markHybrids()(자리 해시로 정하는
## 교배)를 옮긴다.
##
## **재해석한 부분** — 웹판은 열매(나무)·밤(소나무)·꽃 셋 다 심을 수
## 있지만("PLANT_KIND"), 이 항목이 요청받은 것은 "꽃 교배"뿐이라 **꽃만**
## 심을 수 있게 좁혔다 — 열매·밤 심기는 범위 밖으로 남겨 둔다(다음에
## "농사"류 콘텐츠를 넓힐 때 참고).
##
## 심은 자리는 forest_save_state.gd의 planted(신규, 순수 추가 배열)에
## 저장된다. 자란 뒤(PLANT_DAYS)엔 gatherable_builder.gd와 같은 "하루
## 1회" 채집 대상이 되고, 곁에 다른 꽃이 있었으면(HYBRID_NEAR 반경)
## 드문 항목("교배꽃")을 낼 수도 있다 — 판정은 **자리 해시**라 심어 놓고
## 사흘 뒤에 와도 같은 결과가 나온다(난수가 아니다).
##
## **교배 깊이(2026-09-15 추가)** — 이전까진 "교배꽃"이 한 번 나오면 그걸로
## 끝이었다(더 곁에 심어도 항상 같은 두 갈래뿐). 이제 **이미 하이브리드인
## 꽃 곁에 심으면** 더 희귀한 2단("진교배꽃")을 노릴 수 있다 — 진짜 동물의숲
## 튤립 교배(파랑→검정처럼 하이브리드끼리 교배해야 더 깊은 색이 나오는 것)의
## 정신을 옮긴 것. 판정은 여전히 결정적 자리 해시 하나뿐(주사위를 두 번
## 굴리지 않는다) — 문턱만 둘(HYBRID_ROLL·HYBRID2_ROLL)이라 결과가 갈린다.

const ForestMap := preload("res://games/saga_forest/data/village_map.gd")
const TerrainBuilder := preload("res://games/saga_forest/world/forest_terrain_builder.gd")
const WorldCurveMaterial := preload("res://saga_core/world/world_curve_material.gd")
const Toast := preload("res://saga_core/ui/toast.gd")

const CURVE_AMOUNT := 0.004
const PLANT_DAYS := 3
## village_map.gd TILE_SIZE(3.0)*1.6 / *0.9 — 상수 접기(const folding)가
## 다른 스크립트의 const를 식으로 못 받아들여(터닙 MIGRATIONS 삽질과 같은
## 종류의 제약, forest_save_state.gd _migrate_step 주석 참고) 값을 직접 적었다.
const HYBRID_NEAR := 4.8
const PLANT_MIN_GAP := 2.7
const GATHER_RADIUS := 3.5
const ITEM_LABEL_NORMAL := "꽃"
const ITEM_LABEL_HYBRID := "교배꽃"
const ITEM_LABEL_HYBRID2 := "진교배꽃"
const HYBRID_ROLL := 0.45   # near>0이면 이 문턱을 넘어야 1단(교배꽃) — 그대로
const HYBRID2_ROLL := 0.7   # near_best_tier>=1이면 이 더 높은 문턱을 넘어야 2단(진교배꽃)

var _nodes: Array[Node3D] = []   # ForestSaveState.planted와 같은 인덱스
var _in_range: Dictionary = {}   # index(int) -> bool


func _ready() -> void:
	for i in ForestSaveState.planted.size():
		_spawn_visual(i)
	add_child(load("res://games/saga_forest/world/plant_grid_overlay.gd").new())   # G-0186 발밑 심을 칸·심은 꽃 둘레 격자


## G-0186 — 심기와 칸 표시가 같은 식을 쓰게 뽑았다(규칙은 그대로: 자리 = 발 위치, 칸 = 3m 격자, 풀밭 '.' 만).
static func cell_of(pos: Vector3) -> Vector2i:
	var grid := ForestMap.size()
	return Vector2i(int(floor(pos.x / ForestMap.TILE_SIZE + grid.x * 0.5)), int(floor(pos.z / ForestMap.TILE_SIZE + grid.y * 0.5)))


static func can_plant_at(cell: Vector2i) -> bool:
	return ForestMap.tile_at(cell.x, cell.y) == "."


func _process(_delta: float) -> void:
	for i in _nodes.size():
		if _in_range.get(i, false) and Input.is_action_just_pressed("forest_gather"):
			_gather(i)
	if Input.is_action_just_pressed("forest_plant"):
		_try_plant()


func _try_plant() -> void:
	if ForestSaveState.item_count(ITEM_LABEL_NORMAL) < 1:
		Toast.show(self, "심을 꽃이 없다 — 먼저 꽃을 꺾어 오게.", 2.0)
		return
	var player := get_tree().get_first_node_in_group("player")
	if player == null:
		return
	var pos: Vector3 = (player as Node3D).global_position

	if not can_plant_at(cell_of(pos)):
		Toast.show(self, "풀밭에만 심을 수 있다.", 2.0)
		return

	var near := 0
	var near_best_tier := 0
	for entry: Dictionary in ForestSaveState.planted:
		var d := Vector2(pos.x - float(entry.x), pos.z - float(entry.z)).length()
		if d < PLANT_MIN_GAP:
			Toast.show(self, "너무 붙어 있다.", 2.0)
			return
		if d <= HYBRID_NEAR:
			near += 1
			near_best_tier = maxi(near_best_tier, _tier_of(entry))

	var roll := _hash2(int(round(pos.x)), int(round(pos.z)))
	var tier := 0
	if near_best_tier >= 1 and roll > HYBRID2_ROLL:
		tier = 2
	elif near > 0 and roll > HYBRID_ROLL:
		tier = 1

	ForestSaveState.items[ITEM_LABEL_NORMAL] = ForestSaveState.item_count(ITEM_LABEL_NORMAL) - 1
	var entry := {"x": pos.x, "z": pos.z, "day": ForestDay.epoch_day_index(), "hybrid": tier >= 1, "tier": tier}
	ForestSaveState.planted.append(entry)
	_spawn_visual(ForestSaveState.planted.size() - 1)
	var hint := ""
	if near_best_tier >= 1:
		hint = "(하이브리드 곁이라 더 진귀한 색을 노려볼 만하다)"
	elif near > 0:
		hint = "(곁에 꽃이 있어 드문 색이 필지도 모른다)"
	Toast.show(self, "꽃을 심었다 — %d일 뒤 자란다%s." % [PLANT_DAYS, hint], 3.0)


func _spawn_visual(i: int) -> void:
	var entry: Dictionary = ForestSaveState.planted[i]
	var root := Node3D.new()
	root.name = "Planted_%d" % i
	root.position = Vector3(float(entry.x), TerrainBuilder.LEGEND["."].height, float(entry.z))
	add_child(root)

	var grown: bool = _elapsed(entry) >= PLANT_DAYS
	var mi := MeshInstance3D.new()
	var sphere := SphereMesh.new()
	sphere.radius = 0.5 if grown else 0.22
	sphere.height = sphere.radius * 2.0
	mi.mesh = sphere
	mi.position = Vector3(0, sphere.radius, 0)
	var tint := Color(1, 0.55, 0.72)
	if grown:
		match _tier_of(entry):
			2: tint = Color(0.95, 0.78, 0.15)   # 진교배꽃 — 금빛(가장 희귀)
			1: tint = Color(0.82, 0.35, 0.65)   # 교배꽃
	mi.material_override = WorldCurveMaterial.vertex_color_material(CURVE_AMOUNT, 0.6, tint)
	root.add_child(mi)

	var area := Area3D.new()
	var cs := CollisionShape3D.new()
	var shape := SphereShape3D.new()
	shape.radius = GATHER_RADIUS
	cs.shape = shape
	area.add_child(cs)
	root.add_child(area)
	area.body_entered.connect(_on_entered.bind(i))
	area.body_exited.connect(_on_exited.bind(i))

	_nodes.append(root)
	_in_range[i] = false


func _elapsed(entry: Dictionary) -> int:
	return ForestDay.epoch_day_index() - int(entry.day)


func _on_entered(body: Node3D, i: int) -> void:
	if not body.is_in_group("player"):
		return
	_in_range[i] = true
	var entry: Dictionary = ForestSaveState.planted[i]
	if _elapsed(entry) < PLANT_DAYS:
		Toast.show(self, "심은 꽃 — 아직 자라는 중(%d일 남음)." % (PLANT_DAYS - _elapsed(entry)), 2.0)
		return
	var tier := _tier_of(entry)
	var rarity_hint := " — 진귀한 색이다!!" if tier == 2 else (" — 드문 색이다!" if tier == 1 else "")
	if ForestSaveState.can_gather("planted_%d" % i):
		Toast.show(self, "[G] 심은 꽃을 꺾는다%s" % rarity_hint, 2.0)
	else:
		Toast.show(self, "심은 꽃 — 오늘 몫은 이미 다 썼다.", 2.0)


func _on_exited(body: Node3D, i: int) -> void:
	if body.is_in_group("player"):
		_in_range[i] = false


func _gather(i: int) -> void:
	var entry: Dictionary = ForestSaveState.planted[i]
	if _elapsed(entry) < PLANT_DAYS:
		return
	var prop_id := "planted_%d" % i
	if not ForestSaveState.can_gather(prop_id):
		Toast.show(self, "심은 꽃 — 오늘 몫은 이미 다 썼다.", 2.0)
		return
	ForestSaveState.mark_gathered(prop_id)
	var tier := _tier_of(entry)
	var label: String = ITEM_LABEL_HYBRID2 if tier == 2 else (ITEM_LABEL_HYBRID if tier == 1 else ITEM_LABEL_NORMAL)
	ForestSaveState.add_item(label, 1)
	Toast.show(self, "심은 꽃을 꺾었다 — %s +1" % label, 2.5)


## 옛 세이브(하이브리드 여부만 bool로 있던 시절)와도 호환 — "tier" 필드가
## 있으면 그걸 쓰고, 없으면 "hybrid" bool에서 역산한다(true→1, false→0).
static func _tier_of(entry: Dictionary) -> int:
	if entry.has("tier"):
		return int(entry.tier)
	return 1 if bool(entry.get("hybrid", false)) else 0


## 웹판 core.hash2(x, y)의 Godot 포트 — forest_turnip.gd의 _hash2()와
## 완전히 같은 알고리즘(그 파일 주석 참고: 순무 시세와 이 판정은 서로
## 다른 자리라 각자 자기 파일에 둔다, 공용화할 이유가 없다).
static func _hash2(x: int, y: int) -> float:
	var h: int = (x * 374761393 + y * 668265263) & 0xFFFFFFFF
	h = ((h ^ (h >> 13)) * 1274126177) & 0xFFFFFFFF
	h = h ^ (h >> 16)
	return float(h & 0x7fffffff) / float(0x7fffffff)
