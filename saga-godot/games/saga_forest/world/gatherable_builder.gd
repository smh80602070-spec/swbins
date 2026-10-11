extends Node3D

## VERTICAL_SLICE_FOREST.md 4절 "제외" 목록 1번 착수 — 나무 이외 채집
## 대상(소나무·바위·꽃) + 진짜 하루 1회 리셋(day 시스템, ForestDay.gd).
## 웹판 data-village.js PROPS 그대로: 넷 다 reset:1이다(낚시터만 reset:0
## — 그건 "제외" 목록 2번, 이번 범위 밖).
##
## 이전 슬라이스의 gatherable_tree.gd(나무 하나, 무제한 흔들기 프로토타입)를
## 대체한다 — 여러 채집 대상을 데이터 배열 하나로 두고 한 스크립트가 전부
## 만든다(villager_builder.gd의 VILLAGERS 배열과 같은 패턴).
##
## 1절 결정(구면 투영)에 따라 이 채집물들도 땅과 같은 곡률 머티리얼을
## 쓴다. 소나무는 새 GLB를 안 구하고 tree_oak.glb를 재사용하되
## tint_color로 살짝 푸르스름하게 튼다(44장 "에셋은 무작정 많이 넣지
## 않는다") — 바위는 GO가 이미 쓰는 rock_largeA.glb를 그대로. 꽃은 어울리는
## CC0 GLB가 없어 primitive(작은 구)로 표시한다(waterfall 물웅덩이 등
## 이 저장소가 이미 쓰는 "적당한 에셋이 없으면 primitive" 예외와 같은 결).
##
## 2026-09-12 — 제외 목록 3번(주민 5명)에서 6명으로 늘어난 NPC 대화 반경
## (5m)과 겹치지 않게 나무 자리를 (19,7)→(24,3)으로 옮겼다(캐릭터
## 무게중심은 그대로, 격자 자리만 이동 — id·저장 데이터는 안 바뀐다).
##
## 2026-09-12② — 제외 목록 4번(곤충/화석/조개) 착수 — 셋 다 웹판
## PROPS처럼 reset:1(하루 1회)이라 이 파일에 그대로 얹었다. 화석("갈라진
## 자리")만 웹판처럼 도구(삽)가 있어야 한다 — `tool` 필드가 채워진
## DEFS는 `ForestSaveState.has_tool()`을 먼저 본다. 삽은 상인(villager_
## builder.gd의 npc_merchant)에게서 산다.

const ForestCraft := preload("res://games/saga_forest/data/forest_craft.gd")   # G-0196 도구 갈래 덤
const ForestMap := preload("res://games/saga_forest/data/village_map.gd")
const TerrainBuilder := preload("res://games/saga_forest/world/forest_terrain_builder.gd")
const GLBUtils := preload("res://saga_core/world/glb_utils.gd")
const WorldCurveMaterial := preload("res://saga_core/world/world_curve_material.gd")
const Toast := preload("res://saga_core/ui/toast.gd")

const CURVE_AMOUNT := 0.004
const GATHER_RADIUS := 3.5

const TOOL_NAMES := {"spade": "삽"}

const DEFS := [
	{"id": "gather_tree", "name": "나무", "hint": "흔든다", "item_label": "과일",
	 "grid": Vector2i(24, 3), "glb": "res://assets/world/tree_broadleaf_01.glb",
	 "scale": 0.837, "tint": Color(1, 1, 1), "trunk_radius": 0.4, "trunk_height": 3.0, "tool": ""},
	{"id": "gather_pine", "name": "소나무", "hint": "흔든다", "item_label": "솔방울",
	 "grid": Vector2i(9, 12), "glb": "res://assets/world/tree_pine_01.glb",
	 "scale": 0.53, "tint": Color(0.72, 0.84, 0.95), "trunk_radius": 0.4, "trunk_height": 3.0, "tool": ""},
	{"id": "gather_rock", "name": "바위", "hint": "캔다", "item_label": "광석",
	 "grid": Vector2i(22, 12), "glb": "res://assets/world/rock_large_01.glb",
	 "scale": 0.43, "tint": Color(1, 1, 1), "trunk_radius": 0.0, "trunk_height": 0.0, "tool": ""},
	{"id": "gather_flower", "name": "꽃", "hint": "꺾는다", "item_label": "꽃",
	 "grid": Vector2i(9, 5), "glb": "", "scale": 1.0,
	 "tint": Color(1, 0.55, 0.72), "trunk_radius": 0.0, "trunk_height": 0.0, "tool": ""},
	{"id": "gather_bug", "name": "풀숲", "hint": "잡는다", "item_label": "곤충",
	 "grid": Vector2i(14, 4), "glb": "", "scale": 1.0,
	 "tint": Color(0.85, 0.75, 0.25), "trunk_radius": 0.0, "trunk_height": 0.0, "tool": ""},
	{"id": "gather_shell", "name": "조개", "hint": "줍는다", "item_label": "조개",
	 "grid": Vector2i(18, 13), "glb": "", "scale": 1.0,
	 "tint": Color(0.92, 0.88, 0.8), "trunk_radius": 0.0, "trunk_height": 0.0, "tool": ""},
	{"id": "gather_fossil", "name": "갈라진 자리", "hint": "판다", "item_label": "화석",
	 "grid": Vector2i(6, 11), "glb": "", "scale": 1.0,
	 "tint": Color(0.45, 0.38, 0.3), "trunk_radius": 0.0, "trunk_height": 0.0, "tool": "spade"},
	## 제외 목록 7번(바이옴 지형 다양성) — 웹판은 약초(herb)를 버섯숲
	## 바이옴 전용 채집물로 못박아 둔다(data-village.js "숲 고리 버섯숲
	## 바이옴 전용" 주석). 이 슬라이스도 같은 자리(SW 사분면, forest_
	## biome.gd 기준 "mush")에 놓아 그 경계를 지킨다.
	{"id": "gather_herb", "name": "약초", "hint": "캔다", "item_label": "약초",
	 "grid": Vector2i(8, 15), "glb": "", "scale": 1.0,
	 "tint": Color(0.35, 0.55, 0.28), "trunk_radius": 0.0, "trunk_height": 0.0, "tool": ""},
]

var _in_range: Dictionary = {}  # id(String) -> bool
var _roots: Dictionary = {}  # id(String) -> Node3D, CombatFeel.pickup() 팝업 자리용


func _ready() -> void:
	for d: Dictionary in DEFS:
		_build(d)


func _build(d: Dictionary) -> void:
	var ground: float = TerrainBuilder.LEGEND["."].height
	var root := Node3D.new()
	root.name = "Gather_%s" % d.id
	root.position = ForestMap.world_pos(d.grid.x, d.grid.y) + Vector3(0, ground, 0)
	add_child(root)
	_roots[d.id] = root

	var mesh: Mesh = GLBUtils.extract_mesh(d.glb) if d.glb != "" else null
	var mi := MeshInstance3D.new()
	mi.name = "Visual"
	if mesh != null:
		## G-0020 — 통일 툰 GLB(표면별 텍스처)라 정점색 재질 대신 곡률 텍스처 재질에 tint 를 곱한다.
		mi.mesh = WorldCurveMaterial.textured_surfaces(mesh, CURVE_AMOUNT, 0.95, d.tint)
		mi.scale = Vector3.ONE * float(d.scale)
	else:
		var sphere := SphereMesh.new()
		sphere.radius = 0.5
		sphere.height = 1.0
		mi.mesh = sphere
		mi.position = Vector3(0, 0.5, 0)
		mi.material_override = WorldCurveMaterial.vertex_color_material(CURVE_AMOUNT, 0.6, d.tint)
	root.add_child(mi)

	if float(d.trunk_radius) > 0.0:
		var trunk := StaticBody3D.new()
		trunk.name = "Trunk"
		var cs := CollisionShape3D.new()
		var shape := CylinderShape3D.new()
		shape.radius = d.trunk_radius
		shape.height = d.trunk_height
		cs.shape = shape
		cs.position = Vector3(0, d.trunk_height * 0.5, 0)
		trunk.add_child(cs)
		root.add_child(trunk)

	var area := Area3D.new()
	area.name = "GatherArea"
	var area_cs := CollisionShape3D.new()
	var area_shape := SphereShape3D.new()
	area_shape.radius = GATHER_RADIUS
	area_cs.shape = area_shape
	area.add_child(area_cs)
	root.add_child(area)

	_in_range[d.id] = false
	area.body_entered.connect(_on_entered.bind(d))
	area.body_exited.connect(_on_exited.bind(d))


func _process(_delta: float) -> void:
	for d: Dictionary in DEFS:
		if _in_range.get(d.id, false) and Input.is_action_just_pressed("forest_gather"):
			_gather(d)


func _on_entered(body: Node3D, d: Dictionary) -> void:
	if not body.is_in_group("player"):
		return
	_in_range[d.id] = true
	if d.tool != "" and not ForestSaveState.has_tool(d.tool):
		Toast.show(self, "%s — %s이(가) 있어야 한다." % [d.name, TOOL_NAMES.get(d.tool, d.tool)], 2.5)
		return
	if ForestSaveState.can_gather(d.id):
		Toast.show(self, "[G] %s를 %s" % [d.name, d.hint], 2.0)
	else:
		Toast.show(self, "%s — 오늘 몫은 이미 다 썼다." % d.name, 2.0)


func _on_exited(body: Node3D, d: Dictionary) -> void:
	if body.is_in_group("player"):
		_in_range[d.id] = false


func _gather(d: Dictionary) -> void:
	if d.tool != "" and not ForestSaveState.has_tool(d.tool):
		Toast.show(self, "%s — %s이(가) 있어야 한다." % [d.name, TOOL_NAMES.get(d.tool, d.tool)], 2.5)
		return
	if not ForestSaveState.can_gather(d.id):
		Toast.show(self, "%s — 오늘 몫은 이미 다 썼다." % d.name, 2.0)
		return
	ForestSaveState.mark_gathered(d.id)
	## G-0196 — 제작대에서 고른 도구 갈래(수확·풍성·손재주)의 덤. 갈래가 없으면 늘 +1 그대로.
	var tool_key := String(ForestCraft.GATHER_TOOL.get(d.id, ""))
	var today := ForestDay.today_key()
	var roll := ForestCraft.gather_roll(ForestCraft.perks(ForestSaveState, tool_key), "%d|%s" % [today, d.id])
	var n := 1 + int(roll.extra)
	ForestSaveState.add_item(d.item_label, n)
	var tail := ""
	if bool(roll.again) and int(ForestSaveState.knack_used.get(d.id, -1)) != today:
		ForestSaveState.knack_used[d.id] = today
		ForestSaveState.used.erase(d.id)
		tail = " · 손재주 — 오늘 한 번 더"
	Toast.show(self, "%s(을)를 %s — %s +%d%s" % [d.name, d.hint, d.item_label, n, tail], 2.5)
	CombatFeel.pickup(_roots.get(d.id), "%s +%d" % [d.item_label, n])
