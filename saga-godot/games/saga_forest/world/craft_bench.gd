extends Node3D

## G-0196 — 3마을 제작대(웹 W-0103 의 고돗 짝). 집 동쪽 앞(GRID)에 작업대 하나 — 곁에서 [G] 로 제작대 화면:
##   레시피 12(도구 승급 6 · 가구 짓기 6 — data/forest_craft.gd). 도구를 올리면 곧바로 세 갈래(수확·풍성·손재주) 중 하나, 거절하면 💰100.
## 모양은 박물관(museum.gd)처럼 코드 도형 — 상판·다리 넷·모루(구면 곡률 재질). 새 에셋 없음.

const ForestMap := preload("res://games/saga_forest/data/village_map.gd")
const TerrainBuilder := preload("res://games/saga_forest/world/forest_terrain_builder.gd")
const WorldCurveMaterial := preload("res://saga_core/world/world_curve_material.gd")
const ForestCraft := preload("res://games/saga_forest/data/forest_craft.gd")
const ForestHome := preload("res://games/saga_forest/data/forest_home.gd")
const ChoicePrompt := preload("res://saga_core/ui/choice_prompt.gd")
const Toast := preload("res://saga_core/ui/toast.gd")

const GRID := Vector2i(17, 7)   # 집(15,9) 북동 — 마을 사람·채집 자리·박물관 반경 밖(10-11 조사)
const RADIUS := 3.0
const CURVE_AMOUNT := 0.004
const WOOD := Color(0.55, 0.38, 0.22)
const IRON := Color(0.32, 0.33, 0.36)

var _in_range := false


func _ready() -> void:
	name = "CraftBench"
	var ground: float = TerrainBuilder.LEGEND["."].height
	position = ForestMap.world_pos(GRID.x, GRID.y) + Vector3(0, ground, 0)
	_box(Vector3(2.2, 0.18, 1.1), Vector3(0, 0.95, 0), WOOD)
	for sx in [-1, 1]:
		for sz in [-1, 1]:
			_box(Vector3(0.14, 0.9, 0.14), Vector3(0.95 * sx, 0.45, 0.42 * sz), WOOD.darkened(0.25))
	_box(Vector3(0.5, 0.22, 0.32), Vector3(0.55, 1.15, 0.0), IRON)    # 모루
	_box(Vector3(0.36, 0.08, 0.5), Vector3(-0.5, 1.08, 0.1), WOOD.lightened(0.15))   # 도마
	var body := StaticBody3D.new()
	var cs := CollisionShape3D.new()
	var shape := BoxShape3D.new()
	shape.size = Vector3(2.2, 1.1, 1.1)
	cs.shape = shape
	cs.position = Vector3(0, 0.55, 0)
	body.add_child(cs)
	add_child(body)
	var l := Label3D.new()
	l.text = "🔨 제작대 [G]"
	l.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	l.fixed_size = true
	l.pixel_size = 0.0012
	l.font_size = 24
	l.outline_size = 7
	l.position = Vector3(0, 2.0, 0)
	add_child(l)
	var area := Area3D.new()
	var acs := CollisionShape3D.new()
	var sph := SphereShape3D.new()
	sph.radius = RADIUS
	acs.shape = sph
	area.add_child(acs)
	add_child(area)
	area.body_entered.connect(func(b: Node3D) -> void:
		if b.is_in_group("player"):
			_in_range = true
			Toast.show(self, "🔨 제작대 — [G] 도구 승급·가구 짓기", 2.5))
	area.body_exited.connect(func(b: Node3D) -> void:
		if b.is_in_group("player"):
			_in_range = false)


func _box(size: Vector3, pos: Vector3, c: Color) -> void:
	var mi := MeshInstance3D.new()
	var bm := BoxMesh.new()
	bm.size = size
	mi.mesh = bm
	mi.position = pos
	mi.material_override = WorldCurveMaterial.vertex_color_material(CURVE_AMOUNT, 0.85, c)
	add_child(mi)


func _process(_delta: float) -> void:
	if _in_range and Input.is_action_just_pressed("forest_gather"):
		open_menu()


static func need_text(r: Dictionary) -> String:
	var parts: Array = []
	for label: String in (r.need as Dictionary).keys():
		parts.append("%s %d" % [label, int(r.need[label])])
	return " · ".join(parts)


static func recipe_name(r: Dictionary) -> String:
	if String(r.kind) == "tool":
		return "%s Lv%d" % [ForestCraft.TOOLS[r.tool], int(r.lv)]
	return String(ForestHome.furn(String(r.furn)).get("name", r.furn))


## 제작대 화면 — 레시피 12(만들 수 있는 것 ✓, 아니면 까닭)
func open_menu() -> void:
	var box := {}
	var choices: Array = []
	for r: Dictionary in ForestCraft.RECIPES:
		var why := ForestCraft.why_not(ForestSaveState, r)
		var key := String(r.key)
		choices.append({
			"label": "%s %s — %s%s" % ["🛠️" if String(r.kind) == "tool" else "🪑", recipe_name(r), need_text(r), "  ✓" if why == "" else "  (%s)" % why],
			"cb": func() -> void:
				(box["layer"] as CanvasLayer).queue_free()
				make(key),
		})
	choices.append({"label": "닫기", "cb": func() -> void: (box["layer"] as CanvasLayer).queue_free()})
	var lv_line := "바구니 Lv%d · 잠자리채 Lv%d · 삽 Lv%d" % [ForestCraft.tool_lv(ForestSaveState, "basket"), ForestCraft.tool_lv(ForestSaveState, "net"), ForestCraft.tool_lv(ForestSaveState, "spade")]
	box["layer"] = ChoicePrompt.build(self, "🔨 제작대 — %s" % lv_line, choices)


func make(key: String) -> void:
	var r := ForestCraft.make(ForestSaveState, key)
	if not bool(r.ok):
		Toast.show(self, "🔨 아직 못 만든다 — %s" % String(r.why), 2.5)
		return
	var rec := ForestCraft.recipe(key)
	if String(r.tool) == "":
		Toast.show(self, "🪑 %s 을(를) 지었다 — 집 창고로(집 안에서 [H] 로 놓는다)" % recipe_name(rec), 3.0)
		return
	open_perks(String(r.tool))


## 도구 승급 세 갈래 — 서로 다른 축 셋 + 거절(💰100)
func open_perks(tool: String) -> void:
	var box := {}
	var choices: Array = []
	for axis: String in ForestCraft.offer3():
		choices.append({
			"label": ForestCraft.AXIS_NAMES[axis],
			"cb": func() -> void:
				(box["layer"] as CanvasLayer).queue_free()
				ForestCraft.pick(ForestSaveState, tool, axis)
				Toast.show(self, "🛠️ %s Lv%d — %s" % [ForestCraft.TOOLS[tool], ForestCraft.tool_lv(ForestSaveState, tool), ForestCraft.AXIS_SHORT[axis]], 3.0),
		})
	choices.append({
		"label": "거절한다 — 💰%d" % ForestCraft.DECLINE_GOLD,
		"cb": func() -> void:
			(box["layer"] as CanvasLayer).queue_free()
			ForestCraft.decline(ForestSaveState)
			Toast.show(self, "🛠️ %s Lv%d — 갈래 없이 💰%d" % [ForestCraft.TOOLS[tool], ForestCraft.tool_lv(ForestSaveState, tool), ForestCraft.DECLINE_GOLD], 3.0),
	})
	box["layer"] = ChoicePrompt.build(self, "🛠️ %s 을(를) Lv%d 로 올렸다 — 갈래 하나" % [ForestCraft.TOOLS[tool], ForestCraft.tool_lv(ForestSaveState, tool)], choices)
