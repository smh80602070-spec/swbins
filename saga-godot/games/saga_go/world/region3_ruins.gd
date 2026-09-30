extends Node3D

## GO 진짜 세 번째 지역 — "폐허"(REGIONS["ruins"], test_map.gd 참고).
## region2_coast.gd가 재설계로 확인한 payoff를 그대로 쓴 자리다: 새
## `REGIONS` 항목 하나 + 이 파일 하나(TerrainBuilder region_id 인스턴스
## 하나)로 지역 하나가 통째로 생긴다.
##
## **일부러 최소만 짓는다** — region2_coast.gd도 처음엔(2026-09-15)
## "역참으로 이어지는 자리" 하나뿐이었고 어부·게·표류물·조각배 같은
## 내용은 이후 세션에서 하나씩 얹혔다. 이 파일도 같은 순서를 따른다:
## 지형 + 왕복(입구/복귀) + 발견 지점을 먼저 잇고, NPC·사건·짐승은
## 다음에(hero_encounter.gd·animal_builder.gd 등은 지금도 region_id
## 없는 마을 격자에 고정돼 있어, 여기 쓰려면 그 파일들도 region2_coast.gd
## 안 사건들처럼 이 파일 안에서 다시 짜야 한다 — 아직 안 함).
##
## 2026-09-16, 폐허 콘텐츠 1호(사용자 지시 "순서대로 이어해줘"의 1번째) —
## simple_event.gd 계열(표류물·조각배와 같은 결, 한 번뿐) 첫 사건 "옛
## 유물"을 얹었다. simple_event.gd를 그대로 재사용하지 않은 이유는
## region2_coast.gd의 표류물·조각배와 같다(그 파일이 region_id 없는
## 마을 격자에 고정돼 있어서, 단방향 의존으로 다시 짜는 게 더 쌈).
##
## 포구 쪽 입구는 이 파일이 아니라 region2_coast.gd `_build_ruins_gate()`에
## 있다(그 파일이 포구의 갈림길을 이미 갖고 있어서, 새 파일이 포구 좌표를
## 또 아는 것보다 그쪽에 세 번째 선택지를 얹는 게 더 쌌다). 이 파일은
## 반대 방향(폐허→포구)만 안다 — 단방향 의존 두 개로 왕복이 완성된다.

const TestMap := preload("res://games/saga_go/data/test_map.gd")
const TerrainBuilder := preload("res://games/saga_go/world/terrain_builder.gd")
const ChoicePrompt := preload("res://saga_core/ui/choice_prompt.gd")
const Toast := preload("res://saga_core/ui/toast.gd")
const BeaconTower := preload("res://games/saga_go/world/beacon_tower.gd")
const VegetationBuilder := preload("res://games/saga_go/world/vegetation_builder.gd")

const RUINS_REGION := "ruins"

## region2_coast.gd RUINS_ENTRY_GRID와 반드시 같은 값이어야 한다(그
## 파일이 플레이어를 내려놓는 자리와 여기가 발견을 찍는 중심이 같아야
## 하니) — 7×7 격자의 정중앙.
const ENTRY_GRID := Vector2i(3, 3)
const ENTRY_DISCOVERY_RADIUS := 60.0

## 복귀 트리거 — 입구에서 두 칸(96m) 떨어뜨려 도착 즉시 다시 뜨지 않게
## 한다(region2_coast.gd ARRIVAL_GRID/RETURN_GRID와 같은 여유).
const RETURN_GRID := Vector2i(3, 5)
const TRAVEL_TRIGGER_RADIUS := 5.0

## region2_coast.gd RUINS_GATE_GRID와 같은 값(그 칸에 내려놓아야 문이
## 열린 자리로 돌아간 느낌이 난다) — 코드로 서로를 참조하지 않고 좌표만
## 중복해 둔다(35장 예외, region2_coast.gd RUINS_GATE_GRID 주석 참고).
const HARBOR_GATE_GRID := Vector2i(1, 6)

## simple_event.gd 계열 첫 사건 — 입구(ENTRY_GRID)·복귀(RETURN_GRID)와
## 최소 두 칸(96m) 이상 떨어진 구석 칸.
const RELIC_ID := "ruins_relic"
const RELIC_GRID := Vector2i(1, 1)
const RELIC_TRIGGER_RADIUS := 14.0

## 2026-09-18, PLAN 101-1 E(발견 밀도) 진단 — `SAGA_DENSITY_REPORT=1`로
## 재보니 폐허가 80.0% 빈 칸(HISTORY 09-16)이었다. 이유는 이 지역
## `codex_discoverable` 점이 ENTRY_GRID·RELIC_GRID 단 둘뿐이라서다(NPC·
## 짐승·인물 조우는 이 그룹에 안 든다 — density_report.gd는 순수 "장소"
## 발견만 잰다). "결사"(HeroEncounter3, TestVillage.tscn (5,5))의 최후
## 항전이라는 이 지역 자리값 그대로, 흩어진 전장 잔해 넷을 숲 칸(T,
## (2,2)(4,2)(2,4)(4,4) — ENTRY·RELIC과 안 겹치는 자리)에 얹는다.
## whalebone(region2_coast.gd)과 같은 결 — 선택지 없는 순수 발견, kind
## 기본값 "place" 그대로. 재측정: 80.0%→28.0%(HISTORY 09-18 상세).
const DEBRIS := [
	{"id": "ruins_shield", "grid": Vector2i(2, 2), "shape": "box"},
	{"id": "ruins_helm", "grid": Vector2i(4, 2), "shape": "sphere"},
	{"id": "ruins_arrows", "grid": Vector2i(2, 4), "shape": "box_thin"},
	{"id": "ruins_banner", "grid": Vector2i(4, 4), "shape": "capsule"},
]
const DEBRIS_TRIGGER_RADIUS := 14.0
const DEBRIS_COLOR := Color(0.4, 0.36, 0.3)

## 2026-09-20, PLAN 101-1 E 재점검 — 재보니 여전히 32.0%(ENTRY_GRID·
## RELIC_GRID·DEBRIS 넷 다 R 바닥 8칸까지는 안 닿는다, RELIC은 kind
## "event"라 이 밀도(place 전용)에도 안 잡힌다). R 바닥 8칸에 위 DEBRIS와
## 같은 결(선택지 없는 순수 발견)로 여덟을 더 얹는다 — 전장 잔해와
## 구별되는 "무너진 건물 자체의 잔해"로.
const FLOOR_DEBRIS := [
	{"id": "ruins_brick", "grid": Vector2i(1, 1), "shape": "brick"},
	{"id": "ruins_step", "grid": Vector2i(3, 1), "shape": "step"},
	{"id": "ruins_urn", "grid": Vector2i(5, 1), "shape": "urn"},
	{"id": "ruins_column", "grid": Vector2i(1, 3), "shape": "column"},
	{"id": "ruins_mural", "grid": Vector2i(5, 3), "shape": "mural"},
	{"id": "ruins_ash", "grid": Vector2i(1, 5), "shape": "ash"},
	{"id": "ruins_well", "grid": Vector2i(3, 5), "shape": "well"},
	{"id": "ruins_gateframe", "grid": Vector2i(5, 5), "shape": "gateframe"},
]

var _layer: CanvasLayer
var _triggered := false


func _ready() -> void:
	_build_terrain()
	_build_vegetation()
	_build_entry_discovery()
	_build_return_trigger()
	_build_relic()
	_build_beacon()
	_build_debris()
	_build_floor_debris()


## PLAN.md 101-2 GO ⑤"봉수대" — 폐허 몫. 기존 콘텐츠(입구·귀환·유물)와
## 안 겹치는 자리(5,1).
func _build_beacon() -> void:
	var tower := BeaconTower.new()
	tower.name = "BeaconTower_ruins"
	tower.region_id = RUINS_REGION
	tower.grid = Vector2i(5, 1)
	tower.region_label = "폐허"
	add_child(tower)


func _build_terrain() -> void:
	var terrain := Node3D.new()
	terrain.set_script(TerrainBuilder)
	terrain.name = "RuinsTerrain"
	terrain.set("region_id", RUINS_REGION)
	add_child(terrain)


## 103-3 스냅(2026-09-19) — TerrainBuilder와 같은 패턴으로 vegetation_
## builder.gd를 region_id="ruins"로 인스턴스한다. 이 지역 T(숲) 4칸·
## ^(산) 테두리에 나무·바위가 서고, go_ruins 팔레트 변형 GLB를 쓴다
## (REGION_TREE_VARIANTS·REGION_ROCK_*_GLB, vegetation_builder.gd 참고).
func _build_vegetation() -> void:
	var vegetation := Node3D.new()
	vegetation.set_script(VegetationBuilder)
	vegetation.name = "RuinsVegetation"
	vegetation.set("region_id", RUINS_REGION)
	add_child(vegetation)


## region2_coast.gd `_travel_to_ruins()`가 도착 즉시 discover()를 부르니
## 이 영역은 걸어서 온 경우(지금은 텔레포트뿐이라 이론상뿐)의 안전망이다
## — harbor 쪽 `_add_discovery_area("harbor", ...)`와 같은 판단.
func _build_entry_discovery() -> void:
	## id는 "ruins"가 아니라 "ruins_far"다 — landmarks_builder.gd _add_ruins()가
	## 마을 안 폐허에 이미 codex id "ruins"를 쓰고 있어(discover("place","ruins")),
	## 그대로 쓰면 서로 다른 두 랜드마크가 같은 book 키를 공유해 하나를
	## 발견하면 둘 다 발견된 걸로 잘못 찍히는 충돌이 생긴다.
	_add_discovery_area("ruins_far", TestMap.world_pos(ENTRY_GRID.x, ENTRY_GRID.y, RUINS_REGION), ENTRY_DISCOVERY_RADIUS)


func _build_return_trigger() -> void:
	var ground: float = TerrainBuilder.LEGEND["R"].height
	var pos := TestMap.world_pos(RETURN_GRID.x, RETURN_GRID.y, RUINS_REGION) + Vector3(0, ground, 0)
	var area := Area3D.new()
	area.name = "RuinsReturn"
	var cs := CollisionShape3D.new()
	var shape := SphereShape3D.new()
	shape.radius = TRAVEL_TRIGGER_RADIUS
	cs.shape = shape
	area.add_child(cs)
	area.position = pos
	add_child(area)
	area.body_entered.connect(_on_return_entered)


func _on_return_entered(body: Node3D) -> void:
	if _triggered or not body.is_in_group("player"):
		return
	_triggered = true
	var choices: Array = [
		{"label": "🏝️ 포구로 돌아간다", "cb": func() -> void: _travel_to_harbor(body)},
		{"label": "그만둔다", "cb": _close_prompt},
	]
	_layer = ChoicePrompt.build(self, "폐허 — 여기서 포구로 돌아가는 길이 있다.", choices)


func _close_prompt() -> void:
	if _layer:
		_layer.queue_free()
	_triggered = false


func _travel_to_harbor(player: Node3D) -> void:
	if _layer:
		_layer.queue_free()
	var ground: float = TerrainBuilder.LEGEND["D"].height
	(player as Node3D).global_position = TestMap.world_pos(HARBOR_GATE_GRID.x, HARBOR_GATE_GRID.y, "coast") + Vector3(0, ground + 1.0, 0)
	Toast.show(self, "포구로 돌아왔다.", 2.5)
	_triggered = false


## PLAN 101-1 E — 위 DEBRIS 상수 참고. 넷 다 region2_coast.gd
## _build_whalebone()과 같은 결(선택지 없는 순수 발견, primitive
## 하나+`_add_discovery_area()`) — 모양만 넷이 서로 달라 한눈에 구별된다.
func _build_debris() -> void:
	var ground: float = TerrainBuilder.LEGEND["T"].height
	for d in DEBRIS:
		var pos: Vector3 = TestMap.world_pos(d.grid.x, d.grid.y, RUINS_REGION) + Vector3(0, ground, 0)
		var mi := MeshInstance3D.new()
		match d.shape:
			"box":
				var mesh := BoxMesh.new()
				mesh.size = Vector3(1.1, 0.15, 0.7)
				mi.mesh = mesh
				mi.position = pos + Vector3(0, 0.1, 0)
			"sphere":
				var mesh := SphereMesh.new()
				mesh.radius = 0.4
				mesh.height = 0.7
				mi.mesh = mesh
				mi.position = pos + Vector3(0, 0.35, 0)
			"box_thin":
				var mesh := BoxMesh.new()
				mesh.size = Vector3(1.6, 0.08, 0.08)
				mi.mesh = mesh
				mi.rotation = Vector3(0, deg_to_rad(35.0), 0)
				mi.position = pos + Vector3(0, 0.1, 0)
			"capsule":
				var mesh := CapsuleMesh.new()
				mesh.radius = 0.08
				mesh.height = 2.4
				mi.mesh = mesh
				mi.rotation = Vector3(0, 0, deg_to_rad(12.0))
				mi.position = pos + Vector3(0, 1.2, 0)
		var mat := StandardMaterial3D.new()
		mat.albedo_color = DEBRIS_COLOR
		mi.material_override = mat
		add_child(mi)
		_add_discovery_area(d.id, pos, DEBRIS_TRIGGER_RADIUS)


## PLAN 101-1 E — 위 FLOOR_DEBRIS 상수 참고, R 바닥(폐허 건물 자체가
## 무너진 잔해) 여덟 — _build_debris()의 "전장 잔해"(T 칸, 결사의 최후
## 항전)와 자리값이 다르다는 걸 모양·색으로도 가른다(더 밝은 돌색).
func _build_floor_debris() -> void:
	var ground: float = TerrainBuilder.LEGEND["R"].height
	for d in FLOOR_DEBRIS:
		var pos: Vector3 = TestMap.world_pos(d.grid.x, d.grid.y, RUINS_REGION) + Vector3(0, ground, 0)
		if d.grid == RELIC_GRID:
			pos += Vector3(2.5, 0, 2.5) # RELIC_GRID와 같은 칸 — 유물 기둥과 안 겹치게 살짝 비켜 놓는다.
		var mi := MeshInstance3D.new()
		match d.shape:
			"brick":
				var mesh := BoxMesh.new()
				mesh.size = Vector3(0.6, 0.25, 0.4)
				mi.mesh = mesh
				mi.rotation = Vector3(0, deg_to_rad(20.0), deg_to_rad(8.0))
				mi.position = pos + Vector3(0, 0.12, 0)
			"step":
				var mesh := BoxMesh.new()
				mesh.size = Vector3(1.3, 0.2, 0.5)
				mi.mesh = mesh
				mi.position = pos + Vector3(0, 0.1, 0)
			"urn":
				var mesh := CylinderMesh.new()
				mesh.top_radius = 0.25
				mesh.bottom_radius = 0.4
				mesh.height = 0.7
				mi.mesh = mesh
				mi.rotation = Vector3(0, 0, deg_to_rad(60.0))
				mi.position = pos + Vector3(0, 0.2, 0)
			"column":
				var mesh := CylinderMesh.new()
				mesh.top_radius = 0.3
				mesh.bottom_radius = 0.3
				mesh.height = 1.8
				mi.mesh = mesh
				mi.rotation = Vector3(0, 0, deg_to_rad(85.0))
				mi.position = pos + Vector3(0, 0.15, 0)
			"mural":
				var mesh := BoxMesh.new()
				mesh.size = Vector3(1.4, 1.0, 0.1)
				mi.mesh = mesh
				mi.position = pos + Vector3(0, 0.5, 0)
			"ash":
				var mesh := CylinderMesh.new()
				mesh.top_radius = 0.55
				mesh.bottom_radius = 0.65
				mesh.height = 0.12
				mi.mesh = mesh
				mi.position = pos + Vector3(0, 0.06, 0)
			"well":
				var mesh := CylinderMesh.new()
				mesh.top_radius = 0.5
				mesh.bottom_radius = 0.55
				mesh.height = 0.5
				mi.mesh = mesh
				mi.position = pos + Vector3(0, 0.25, 0)
			"gateframe":
				var mesh := BoxMesh.new()
				mesh.size = Vector3(0.2, 1.6, 0.9)
				mi.mesh = mesh
				mi.rotation = Vector3(0, 0, deg_to_rad(18.0))
				mi.position = pos + Vector3(0, 0.8, 0)
		var mat := StandardMaterial3D.new()
		mat.albedo_color = Color(0.58, 0.54, 0.48) if d.shape != "ash" else Color(0.22, 0.2, 0.19)
		mi.material_override = mat
		add_child(mi)
		_add_discovery_area(d.id, pos, DEBRIS_TRIGGER_RADIUS)


## region2_coast.gd _build_driftwood()/_build_boat()와 같은 결 — primitive
## 하나(GLB 없음), 한 번뿐. 표류물·조각배는 나무 상자꼴이라 이번엔
## 돌기둥(CylinderMesh)으로 모양을 갈라 폐허라는 자리값을 살렸다.
func _build_relic() -> void:
	var ground: float = TerrainBuilder.LEGEND["R"].height
	var pos := TestMap.world_pos(RELIC_GRID.x, RELIC_GRID.y, RUINS_REGION) + Vector3(0, ground, 0)

	var mi := MeshInstance3D.new()
	var mesh := CylinderMesh.new()
	mesh.top_radius = 0.5
	mesh.bottom_radius = 0.65
	mesh.height = 1.6
	mi.position = pos + Vector3(0, 0.8, 0)
	mi.mesh = mesh
	var mat := StandardMaterial3D.new()
	mat.albedo_color = Color(0.5, 0.48, 0.44)
	mi.material_override = mat
	add_child(mi)

	var area := Area3D.new()
	area.name = "Relic"
	var cs := CollisionShape3D.new()
	var shape := SphereShape3D.new()
	shape.radius = RELIC_TRIGGER_RADIUS
	cs.shape = shape
	area.add_child(cs)
	area.position = pos
	add_child(area)
	area.body_entered.connect(_on_relic_entered)


func _on_relic_entered(body: Node3D) -> void:
	if not body.is_in_group("player") or EventState.is_resolved(RELIC_ID):
		return
	CodexState.discover("event", RELIC_ID)
	_show_relic_prompt()


func _show_relic_prompt() -> void:
	var layer_box := {}
	layer_box["layer"] = ChoicePrompt.build(self, "🗿 옛 유물\n이끼 낀 돌기둥 하나가 무너진 벽 사이에 홀로 서 있다.", [
		{"label": "글자를 살펴본다", "cb": func() -> void: _resolve_relic(layer_box, "알아볼 수 없는 옛 글자뿐이었지만, 살핀 보람은 있었다.", 15.0)},
		{"label": "그냥 둔다", "cb": func() -> void: _resolve_relic(layer_box, "돌기둥을 지나쳤다.", 0.0)},
	])


func _resolve_relic(layer_box: Dictionary, text: String, exp_reward: float) -> void:
	(layer_box["layer"] as CanvasLayer).queue_free()
	if exp_reward > 0.0:
		PartyState.add_exp(exp_reward)
		text += " (경험 +%d)" % int(exp_reward)
	Toast.show(self, text, 4.0)
	EventState.mark_resolved(RELIC_ID)


## region2_coast.gd `_add_discovery_area()`와 같은 계약·같은 판단(코드
## 세 줄 수준이라 복제, 단방향 의존).
func _add_discovery_area(codex_id: String, pos: Vector3, radius: float, kind: String = "place") -> void:
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
			CodexState.discover(kind, codex_id))
