extends Node3D

## VERTICAL_SLICE_FOREST.md 4절 "제외" 목록 4번 — 박물관(사고). 웹판
## data-village.js MUSEUM_GRADES/MUSEUM_CATS 조사 결과: 원작은 "기증한
## 종 수"로 등급을 매기지만(곤충/물고기/화석/조개 네 갈래 각각 몇 종
## 있는지), 이 슬라이스엔 종 카탈로그 자체가 없다(갈래당 아이템 하나뿐 —
## 다른 물고기 도감을 새로 만들지 않는다, 44장 "에셋은 무작정 많이 넣지
## 않는다"와 같은 절제). 그래서 **누적 기증 개수**로 단순화했다 — 등급
## 이름·문턱 수치(0/5/12/22/32)는 웹판 그대로.

const ForestMap := preload("res://games/saga_forest/data/village_map.gd")
const TerrainBuilder := preload("res://games/saga_forest/world/forest_terrain_builder.gd")
const WorldCurveMaterial := preload("res://saga_core/world/world_curve_material.gd")
const Toast := preload("res://saga_core/ui/toast.gd")
const ChoicePrompt := preload("res://saga_core/ui/choice_prompt.gd")

const GRID := Vector2i(12, 6)
const RADIUS := 3.5
const CURVE_AMOUNT := 0.004
const GREET_GAP_SEC := 45.0

## 이 슬라이스에서 기증 가능한 갈래 — 웹판 MUSEUM_CATS(bug→곤충·fish→
## 물고기·fossil→화석·shell→조개) + PLAN 101-2 FOREST ③후보 "마을 번들"
## (웹판 §5.3)을 채우며 둘을 늘렸다(꽃·과일 — 둘 다 이미 있는 갈래라
## villager_builder.gd 선물·quest 소비와 그대로 경합한다, 기존 넷과
## 같은 결).
const DONATE_CATS := ["곤충", "물고기", "화석", "조개", "꽃", "과일"]

## **PLAN 101-2 FOREST ③후보 "마을 번들"(웹판 §5.3) — 재해석.** 웹판은
## "번들당 종 5~8종 기증"이지만 이 판엔 종 카탈로그가 없어(위 GRADES
## 머리말과 같은 이유) "갈래당 기증 개수 5개"로 좁혔다 — DONATE_CATS의
## 여섯 갈래가 그대로 웹판 번들 여섯 개에 대응한다. 번들 완성 시 마을에
## 고정 장식 하나가 생긴다(웹판 "보이는 것 1개", SAGA-DESIGN §3-G) —
## 새 GLB 없이 museum.gd 자신의 BoxMesh 표시처럼 primitive로 짓는다.
const BUNDLE_THRESHOLD := 5
const BUNDLE_DECOR := {
	"꽃":    {"name": "등롱길",     "emoji": "🏮", "color": Color(1.0, 0.72, 0.32)},
	"물고기": {"name": "호수 정자", "emoji": "🎣", "color": Color(0.32, 0.55, 0.75)},
	"곤충":  {"name": "반딧불이 정원", "emoji": "✨", "color": Color(0.62, 0.92, 0.42)},
	"화석":  {"name": "사고 앞 석비", "emoji": "🪨", "color": Color(0.55, 0.55, 0.55)},
	"조개":  {"name": "조개 길",     "emoji": "🐚", "color": Color(0.86, 0.8, 0.7)},
	"과일":  {"name": "장터 천막",  "emoji": "🎪", "color": Color(0.8, 0.36, 0.3)},
}
const BUNDLE_SLOT_RADIUS := 4.5

const GRADES := [
	{"at": 0, "name": "빈 사고"},
	{"at": 5, "name": "문을 연 사고"},
	{"at": 12, "name": "갖춰지는 사고"},
	{"at": 22, "name": "이름난 사고"},
	{"at": 32, "name": "온전한 사고"},
]

var _in_range := false
var _last_greet_ms := -GREET_GAP_SEC * 1000.0


func _ready() -> void:
	var ground: float = TerrainBuilder.LEGEND["."].height
	position = ForestMap.world_pos(GRID.x, GRID.y) + Vector3(0, ground, 0)
	add_to_group("codex_discoverable")

	## 이 판에 어울리는 CC0 건물 조각이 없어 primitive로 표시한다(집
	## (wall-block.glb)만큼 공을 들일 자리는 아니라고 판단 — gatherable_
	## builder.gd의 꽃·곤충·조개와 같은 결).
	var mesh := BoxMesh.new()
	mesh.size = Vector3(2.0, 2.4, 2.0)
	var mi := MeshInstance3D.new()
	mi.name = "Visual"
	mi.mesh = mesh
	mi.position = Vector3(0, 1.2, 0)
	mi.material_override = WorldCurveMaterial.vertex_color_material(CURVE_AMOUNT, 0.8, Color(0.5, 0.45, 0.35))
	add_child(mi)

	var body := StaticBody3D.new()
	var cs := CollisionShape3D.new()
	var box := BoxShape3D.new()
	box.size = mesh.size
	cs.shape = box
	cs.position = Vector3(0, 1.2, 0)
	body.add_child(cs)
	add_child(body)

	var area := Area3D.new()
	area.name = "MuseumArea"
	var area_cs := CollisionShape3D.new()
	var area_shape := SphereShape3D.new()
	area_shape.radius = RADIUS
	area_cs.shape = area_shape
	area.add_child(area_cs)
	add_child(area)
	area.body_entered.connect(_on_entered)
	area.body_exited.connect(_on_exited)

	## 세이브에 이미 완성된 번들이 있으면 다시 켤 때도 장식이 그대로
	## 보여야 한다(forest_house.gd가 home_items로 가구를 다시 짓는 것과
	## 같은 "저장은 값만, 그림은 로드 때 다시 짓는다" 원칙).
	for cat in DONATE_CATS:
		if ForestSaveState.bundles_done.get(cat, false):
			_spawn_bundle_decoration(cat)
	if ForestSaveState.village_bundle_grand_reward:
		_spawn_grand_flag()


## PLAN 101-2 FOREST ③후보 "마을 번들" — 번들마다 고정 자리 하나(사고를
## 중심으로 여섯 칸에 둘러 세운다, 웹판 "고정 자리" 원칙). primitive
## 기둥 + 위에 뜬 이모지 라벨(Label3D, GO 숫자 팝과 같은 billboard
## 기법이지만 안 사라진다 — 영구 장식이라 tween 없이 그대로 둔다).
func _spawn_bundle_decoration(cat: String) -> void:
	var meta: Dictionary = BUNDLE_DECOR.get(cat, {})
	if meta.is_empty():
		return
	var idx := DONATE_CATS.find(cat)
	var angle := float(idx) / float(DONATE_CATS.size()) * TAU
	var offset := Vector3(cos(angle) * BUNDLE_SLOT_RADIUS, 0, sin(angle) * BUNDLE_SLOT_RADIUS)

	var mesh := CylinderMesh.new()
	mesh.top_radius = 0.35
	mesh.bottom_radius = 0.45
	mesh.height = 1.6
	var mi := MeshInstance3D.new()
	mi.name = "Bundle_%s" % cat
	mi.mesh = mesh
	mi.position = offset + Vector3(0, 0.8, 0)
	mi.material_override = WorldCurveMaterial.vertex_color_material(CURVE_AMOUNT, 0.7, Color(meta.color))
	add_child(mi)

	var label := Label3D.new()
	label.text = "%s %s" % [String(meta.emoji), String(meta.name)]
	label.font_size = 32
	label.position = offset + Vector3(0, 2.0, 0)
	label.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	label.no_depth_test = true
	add_child(label)


## 웹판 §5.3 "6개 완성 → 마을 평가 상한 해제 + 깃발 문양" — 재해석(평가
## 시스템 자체가 3D엔 없다, museum.gd 상단 주석과 같은 이유). 사고 바로
## 위에 깃발 하나를 더 세우는 것으로 "다 모았다"는 표시만 남긴다.
func _spawn_grand_flag() -> void:
	var pole := MeshInstance3D.new()
	pole.name = "BundleGrandFlag"
	var pole_mesh := CylinderMesh.new()
	pole_mesh.top_radius = 0.06
	pole_mesh.bottom_radius = 0.06
	pole_mesh.height = 3.0
	pole.mesh = pole_mesh
	pole.position = Vector3(0, 2.4 + 1.5, 0)
	pole.material_override = WorldCurveMaterial.vertex_color_material(CURVE_AMOUNT, 0.6, Color(0.35, 0.3, 0.25))
	add_child(pole)

	var flag := MeshInstance3D.new()
	var flag_mesh := BoxMesh.new()
	flag_mesh.size = Vector3(1.0, 0.6, 0.05)
	flag.mesh = flag_mesh
	flag.position = Vector3(0.55, 2.4 + 2.6, 0)
	flag.material_override = WorldCurveMaterial.vertex_color_material(CURVE_AMOUNT, 0.85, Color(0.85, 0.2, 0.2))
	add_child(flag)


func _grade_name() -> String:
	var chosen: String = GRADES[0].name
	for g: Dictionary in GRADES:
		if ForestSaveState.museum_donated >= int(g.at):
			chosen = g.name
	return chosen


func _on_entered(body: Node3D) -> void:
	if not body.is_in_group("player"):
		return
	_in_range = true
	var now := Time.get_ticks_msec()
	if now - _last_greet_ms < GREET_GAP_SEC * 1000.0:
		return
	_last_greet_ms = now
	Toast.show(self, "🏛️ %s — [G] 기증하기 (누적 %d개)" % [_grade_name(), ForestSaveState.museum_donated], 3.0)


func _on_exited(body: Node3D) -> void:
	if body.is_in_group("player"):
		_in_range = false


func _process(_delta: float) -> void:
	if _in_range and Input.is_action_just_pressed("forest_gather"):
		_open_donate_menu()


func _open_donate_menu() -> void:
	var available: Array = []
	for cat in DONATE_CATS:
		if ForestSaveState.item_count(cat) > 0:
			available.append(cat)
	if available.is_empty():
		Toast.show(self, "🏛️ 기증할 것이 없다 — 곤충·물고기·화석·조개를 모아 오게.", 2.5)
		return

	## 다른 선택지 메뉴(gatherable_builder.gd는 안 쓰지만 villager_builder.gd
	## 는 쓰는)와 같은 layer_box 우회 — ChoicePrompt.build() 결과를 콜백이
	## 생성 시점엔 아직 모른다.
	var layer_box := {}
	var choices: Array = []
	for cat in available:
		choices.append({
			"label": "%s 기증하기 (%d개 있음)" % [cat, ForestSaveState.item_count(cat)],
			"cb": func() -> void: _donate(cat, layer_box),
		})
	layer_box["layer"] = ChoicePrompt.build(self, "🏛️ 사고에 기증하기", choices)


func _donate(cat: String, layer_box: Dictionary) -> void:
	(layer_box["layer"] as CanvasLayer).queue_free()
	if not ForestSaveState.donate_to_museum(cat):
		return
	Toast.show(self, "🏛️ %s 을(를) 기증했다 — %s (누적 %d개)" %
		[cat, _grade_name(), ForestSaveState.museum_donated], 3.0)

	if ForestSaveState.check_bundle_complete(cat, BUNDLE_THRESHOLD):
		_spawn_bundle_decoration(cat)
		var meta: Dictionary = BUNDLE_DECOR.get(cat, {})
		Toast.show(self, "🎉 %s 번들 완성 — %s %s 이(가) 마을에 생겼다!" %
			[cat, String(meta.get("emoji", "")), String(meta.get("name", ""))], 4.0)
		if ForestSaveState.bundles_done_count() >= DONATE_CATS.size() and not ForestSaveState.village_bundle_grand_reward:
			ForestSaveState.village_bundle_grand_reward = true
			ForestSaveState.add_gold(3000)
			_spawn_grand_flag()
			Toast.show(self, "🚩 번들 여섯을 다 모았다 — 사고 위에 깃발이 올랐다! 🪙 +3000", 4.0)
