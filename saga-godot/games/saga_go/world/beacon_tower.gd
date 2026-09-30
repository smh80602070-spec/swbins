extends Node3D

## PLAN.md 101-2 GO ⑤"봉수대(烽燧臺)"(표준 A E G) — 웹판 PLAN.md §5-①을
## 이 판에 맞춰 옮긴다. 웹은 권역이 GPS 27곳이고 "반경 1.5km 안 미니맵에
## 뜬다"인데, 이 판은 권역이 `test_map.gd` REGIONS 지역 3(마을·포구·폐허)
## 뿐이고 미니맵 자체가 없다 — 그래서 "그 지역의 아직 안 본 place 갈래
## 도감을 한 번에 전부 발견 처리"로 옮겼다. "가 보기 전까지 안 뜬다"
## (discovery area 규칙)의 예외를 봉수대만 허용한다는 웹 규칙의 정신은
## 그대로다 — 대상만 미니맵 점 대신 `codex_discoverable` 그룹(104-5에서
## 이미 태그해 둔 그 place 항목들)이다. 웹의 "3초 홀드"는 이 판에 그런
## 입력이 없어(전부 ChoicePrompt 버튼 확인, 사당 시련과 같은 판단)
## "불을 올린다" 확인으로 갈아탔고, 재화("금 120·단사 5")는 경험치로.

const ChoicePrompt := preload("res://saga_core/ui/choice_prompt.gd")
const Toast := preload("res://saga_core/ui/toast.gd")
const TestMap := preload("res://games/saga_go/data/test_map.gd")
const TerrainBuilder := preload("res://games/saga_go/world/terrain_builder.gd")
const GLBUtils := preload("res://saga_core/world/glb_utils.gd")

const PILLAR_GLB := "res://assets/buildings/pillar-stone.glb"
const TOWER_HEIGHT := 12.0
const TOWER_RADIUS := 2.0
const TRIGGER_RADIUS := 9.0
const LIGHT_EXP := 40.0 # 웹 "공적 40" 상당

@export var region_id := "village"
@export var grid := Vector2i(1, 1)
@export var region_label := "마을"

var _area: Area3D
var _prompt_layer: CanvasLayer
var _fire: MeshInstance3D
var _lit := false


func _ready() -> void:
	var ch: String = TestMap.tile_at(grid.x, grid.y, region_id)
	var ground: float = TerrainBuilder.height_at(region_id, TestMap.world_pos(grid.x, grid.y, region_id))  # 09-30 평지 기복 — LEGEND 평탄 값이 아니라 실제 지면
	position = TestMap.world_pos(grid.x, grid.y, region_id) + Vector3(0, ground, 0)
	_spawn_visual()
	_spawn_area()
	_build_prompt_ui()


func _spawn_visual() -> void:
	var pillar_mesh: Mesh = GLBUtils.extract_mesh(PILLAR_GLB)
	if pillar_mesh != null:
		var mi := MeshInstance3D.new()
		mi.mesh = pillar_mesh
		mi.name = "TowerPillar"
		mi.transform = Transform3D(Basis().scaled(Vector3(TOWER_RADIUS, TOWER_HEIGHT, TOWER_RADIUS)), Vector3.ZERO)
		add_child(mi)
	## 밤엔 불빛이 멀리서 보인다(웹 §5-①) — 안 켰을 땐 꺼진 잿빛, 켜면
	## 밝은 주황 이맛시브로 바뀐다(파티클 대신 primitive, 44장과 같은
	## 판단 — 새 킷을 안 받는다).
	_fire = MeshInstance3D.new()
	_fire.name = "Fire"
	var sphere := SphereMesh.new()
	sphere.radius = 0.7
	sphere.height = 1.4
	_fire.mesh = sphere
	_fire.position = Vector3(0, TOWER_HEIGHT + 0.6, 0)
	var mat := StandardMaterial3D.new()
	mat.albedo_color = Color(0.3, 0.28, 0.26)
	_fire.material_override = mat
	add_child(_fire)


func _spawn_area() -> void:
	_area = Area3D.new()
	var cs := CollisionShape3D.new()
	var shape := SphereShape3D.new()
	shape.radius = TRIGGER_RADIUS
	cs.shape = shape
	_area.add_child(cs)
	add_child(_area)


func _process(_delta: float) -> void:
	if _lit or _prompt_layer.visible:
		return
	if _player_in_range():
		_prompt_layer.show()


func _player_in_range() -> bool:
	for b in _area.get_overlapping_bodies():
		if b.is_in_group("player"):
			return true
	return false


func _build_prompt_ui() -> void:
	_prompt_layer = ChoicePrompt.build(self, "🔥 봉수대 — %s\n\"불을 올리면 이 권역이 눈에 익는다.\"" % region_label, [
		{"label": "불을 올린다", "cb": _light_beacon},
		{"label": "물러난다", "cb": func() -> void: _prompt_layer.hide()},
	])
	_prompt_layer.visible = false


## 두 번 올려도 보상은 한 번(웹 수치 그대로) — _lit이 그 경계다.
func _light_beacon() -> void:
	_prompt_layer.hide()
	if _lit:
		return
	_lit = true
	var mat := StandardMaterial3D.new()
	mat.albedo_color = Color(1.0, 0.55, 0.15)
	mat.emission_enabled = true
	mat.emission = Color(1.0, 0.45, 0.1)
	mat.emission_energy_multiplier = 3.0
	_fire.material_override = mat

	var revealed := _reveal_region_codex()
	PartyState.add_exp(LIGHT_EXP)
	Toast.show(self, "🔥 %s 봉수대에 불을 올렸다 — 명소 %d곳이 눈에 익었다(경험치 +%d)." % [region_label, revealed, int(LIGHT_EXP)], 4.0)


## "가 보기 전까지 안 뜬다"의 예외 — 이 지역의 codex_discoverable(place
## 갈래) 중 아직 못 본 것을 전부 발견 처리한다. 노드 이름이
## "Discover_<codex_id>"(landmarks_builder.gd·region2_coast.gd·
## region3_ruins.gd의 `_add_discovery_area()`와 같은 규칙)라 이름에서
## id를 그대로 뽑는다.
func _reveal_region_codex() -> int:
	var origin: Vector3 = TestMap.origin_of(region_id)
	var size: Vector2i = TestMap.size(region_id)
	var tile: float = TestMap.tile_size_of(region_id)
	var half_w := size.x * 0.5 * tile
	var half_h := size.y * 0.5 * tile
	var revealed := 0
	for node in get_tree().get_nodes_in_group("codex_discoverable"):
		if not String(node.name).begins_with("Discover_"):
			continue
		var local: Vector3 = (node as Node3D).global_position - origin
		if abs(local.x) > half_w or abs(local.z) > half_h:
			continue
		var codex_id := String(node.name).substr("Discover_".length())
		if CodexState.discover("place", codex_id):
			revealed += 1
	return revealed
