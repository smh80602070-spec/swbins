extends Node3D

## G-0196 — 3마을 제작대(웹 W-0103 의 고돗 짝). 집 동쪽 앞(GRID)에 작업대 하나 — 곁에서 [G] 로 제작대 화면:
##   레시피 13(도구 승급 6 · 가구 짓기 6 · 작은 빈 집 — data/forest_craft.gd) + "🏠 빈 집 꾸미기"(G-0237 data/forest_lots.gd). 도구를 올리면 곧바로 세 갈래(수확·풍성·손재주) 중 하나, 거절하면 💰100.
## 모양은 박물관(museum.gd)처럼 코드 도형 — 상판·다리 넷·모루(구면 곡률 재질). 새 에셋 없음.

const ForestMap := preload("res://games/saga_forest/data/village_map.gd")
const TerrainBuilder := preload("res://games/saga_forest/world/forest_terrain_builder.gd")
const WorldCurveMaterial := preload("res://saga_core/world/world_curve_material.gd")
const ForestCraft := preload("res://games/saga_forest/data/forest_craft.gd")
const ForestHome := preload("res://games/saga_forest/data/forest_home.gd")
const Lots := preload("res://games/saga_forest/data/forest_lots.gd")   # G-0237 입주 조건
const Livestock := preload("res://games/saga_forest/data/forest_livestock.gd")   # G-0311 가축
const Crops := preload("res://games/saga_forest/data/forest_crops.gd")   # G-0391 밭
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
	if String(r.kind) == "lot":
		return "작은 빈 집 (%d/%d)" % [Lots.count(ForestSaveState), Lots.MAX]
	if String(r.kind) == "pen":
		return "작은 우리"
	return String(ForestHome.furn(String(r.furn)).get("name", r.furn))


## 제작대 화면 — 레시피 13(만들 수 있는 것 ✓, 아니면 까닭)
func open_menu() -> void:
	var box := {}
	var choices: Array = []
	for r: Dictionary in ForestCraft.RECIPES:
		var why := ForestCraft.why_not(ForestSaveState, r)
		var key := String(r.key)
		choices.append({
			"label": "%s %s — %s%s" % [{"tool": "🛠️", "lot": "🏠", "pen": "🐔"}.get(String(r.kind), "🪑"), recipe_name(r), need_text(r), "  ✓" if why == "" else "  (%s)" % why],
			"cb": func() -> void:
				(box["layer"] as CanvasLayer).queue_free()
				make(key),
		})
	if Lots.count(ForestSaveState) > 0:
		choices.append({"label": "🏠 빈 집 꾸미기 — 가구를 넣어 손님을 부른다", "cb": func() -> void:
			(box["layer"] as CanvasLayer).queue_free()
			open_lots()})
	if Livestock.on() and Livestock.has_pen(ForestSaveState):
		choices.append({"label": "🐔 작은 우리 — 새끼 들이기·먹이·쓰다듬기 (%d/%d)" % [Livestock.animals(ForestSaveState).size(), Livestock.MAX], "cb": func() -> void:
			(box["layer"] as CanvasLayer).queue_free()
			open_pen()})
	if Crops.on() and not Crops.has_field(ForestSaveState):   # G-0391 밭 — 레시피 표 밖 한 줄(지으면 집 앞에서 [G])
		var why_f := Crops.why_not_build(ForestSaveState)
		choices.append({"label": "🌾 밭 — %s %d · 집 앞 네 칸%s" % [Crops.FRUIT, Crops.FIELD_COST, "  ✓" if why_f == "" else "  (%s)" % why_f], "cb": func() -> void:
			(box["layer"] as CanvasLayer).queue_free()
			var r := Crops.build(ForestSaveState)
			Toast.show(self, "🌾 밭을 지었다 — 집 앞 · 씨(%s 1)를 뿌리고 날마다 물을 준다" % Crops.FRUIT if bool(r.ok) else "🔨 아직 못 짓는다 — %s" % String(r.why), 3.0)})
	if preload("res://games/saga_forest/data/forest_brew.gd").on():   # G-0320 물약 달이기
		choices.append({"label": "⚗️ 물약 달이기 — 약초 + 재료 하나 (찾은 %d/%d)" % [(preload("res://games/saga_forest/data/forest_brew.gd").st(ForestSaveState).found as Array).size(), preload("res://games/saga_forest/data/forest_brew.gd").MIXES.size()], "cb": func() -> void:
			(box["layer"] as CanvasLayer).queue_free()
			open_brew()})
	choices.append({"label": "닫기", "cb": func() -> void: (box["layer"] as CanvasLayer).queue_free()})
	var lv_line := "바구니 Lv%d · 잠자리채 Lv%d · 삽 Lv%d" % [ForestCraft.tool_lv(ForestSaveState, "basket"), ForestCraft.tool_lv(ForestSaveState, "net"), ForestCraft.tool_lv(ForestSaveState, "spade")]
	box["layer"] = ChoicePrompt.build(self, "🔨 제작대 — %s" % lv_line, choices)


func make(key: String) -> void:
	var r := ForestCraft.make(ForestSaveState, key)
	if not bool(r.ok):
		Toast.show(self, "🔨 아직 못 만든다 — %s" % String(r.why), 2.5)
		return
	var pl := get_tree().get_first_node_in_group("player")
	if pl != null and pl.has_method("play_once"):
		pl.call("play_once", "hammer", 1.2)   # G-0282 망치질
	var rec := ForestCraft.recipe(key)
	if String(rec.kind) == "pen":
		Toast.show(self, "🐔 작은 우리를 지었다 — 길 남쪽 · 제작대 \"작은 우리\"에서 새끼를 들인다", 3.0)
		return
	if String(rec.kind) == "lot":
		Toast.show(self, "🏠 작은 빈 집을 지었다 (%d/%d) — 제작대 \"빈 집 꾸미기\"로 가구를 넣는다" % [Lots.count(ForestSaveState), Lots.MAX], 3.0)
		return
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


## G-0311 작은 우리 — 짐승마다 한 줄(안 먹였으면 먹이, 먹였으면 쓰다듬기) · 새끼 들이기 · 닫기. 누르면 창이 다시 열린다.
## G-0320 물약 달이기 창 — 고르면 곧바로 달여 마신다(오늘 하루)
func open_brew() -> void:
	var box := {}
	var choices: Array = []
	for l: Dictionary in preload("res://games/saga_forest/data/forest_brew.gd").lines(ForestSaveState):
		var mix := String(l.mix)
		choices.append({"label": String(l.label), "cb": func() -> void:
			(box["layer"] as CanvasLayer).queue_free()
			var r: Dictionary = preload("res://games/saga_forest/data/forest_brew.gd").brew(ForestSaveState, mix, ForestDay.today_key())
			Toast.show(self, ("%s %s%s — %s (오늘 하루)" % [r.emoji, r.name, " 을(를) 처음 찾았다" if bool(r.fresh) else "", r.text]) if bool(r.ok) else String(r.why), 3.0)})
	choices.append({"label": "닫기", "cb": func() -> void: (box["layer"] as CanvasLayer).queue_free()})
	box["layer"] = ChoicePrompt.build(self, "⚗️ 물약 달이기 — 약초 %d개 · 달이면 곧바로 마신다" % ForestSaveState.item_count(preload("res://games/saga_forest/data/forest_brew.gd").BASE), choices)


func pen_lines() -> Array:
	var F := ForestSaveState
	var out: Array = []
	var list := Livestock.animals(F)
	for i in list.size():
		var a: Dictionary = list[i]
		var k: Dictionary = Livestock.KINDS.get(String(a.kind), {})
		var act := "feed" if not bool(a.fed) else ("pet" if not bool(a.petted) else "")
		var tail: String = {"feed": "▶ 먹이(%s 1, 가방 %d)" % [Livestock.FEED, F.item_count(Livestock.FEED)], "pet": "▶ 쓰다듬기", "": "오늘 다 함 — 내일 아침 %s" % String(k.get("product", ""))}[act]
		out.append({"act": act, "i": i, "label": "%s %s %s%s — %s" % [String(k.get("emoji", "")), String(a.name), Livestock.hearts(a), "" if int(a.hungry) == 0 else " · 굶은 날 %d" % int(a.hungry), tail]})
	for kind: String in Livestock.KINDS:
		var k: Dictionary = Livestock.KINDS[kind]
		var why := Livestock.why_not_buy(F, kind)
		out.append({"act": "buy", "kind": kind, "label": "%s %s 새끼 들이기 💰%d%s" % [String(k.emoji), String(k.name), int(k.price), "" if why == "" else "  (%s)" % why]})
	return out


func open_pen() -> void:
	var box := {}
	var choices: Array = []
	for l: Dictionary in pen_lines():
		var line := l
		choices.append({"label": String(l.label), "cb": func() -> void:
			(box["layer"] as CanvasLayer).queue_free()
			_pen_act(line)})
	choices.append({"label": "닫기", "cb": func() -> void: (box["layer"] as CanvasLayer).queue_free()})
	box["layer"] = ChoicePrompt.build(self, "🐔 작은 우리 %d/%d — 날마다 %s 하나를 먹이면 아침에 산물(하트 %d 이상 둘) · 사흘 굶으면 떠난다" % [Livestock.animals(ForestSaveState).size(), Livestock.MAX, Livestock.FEED, Livestock.HEART_TWO], choices)


func _pen_act(l: Dictionary) -> void:
	var r := {}
	match String(l.act):
		"feed":
			r = Livestock.feed(ForestSaveState, int(l.i))
		"pet":
			r = Livestock.pet(ForestSaveState, int(l.i))
			if bool(r.get("ok", false)):
				Toast.show(self, "♥ 하트 %d" % int(r.heart), 1.5)
		"buy":
			r = Livestock.buy(ForestSaveState, String(l.kind))
			if bool(r.get("ok", false)):
				Toast.show(self, "🐣 %s 이(가) 우리에 들어왔다" % String(r.name), 2.5)
	if not r.is_empty() and not bool(r.get("ok", false)):
		Toast.show(self, String(r.why), 2.0)
	if String(l.act) != "":
		open_pen()


## G-0237 빈 집 고르기 — 집마다 "어울릴 손님" 줄
func open_lots() -> void:
	var box := {}
	var choices: Array = []
	for i in Lots.count(ForestSaveState):
		var idx := i
		choices.append({"label": "🏠 %d번째 집 — %s" % [i + 1, Lots.hint_for(ForestSaveState, i)], "cb": func() -> void:
			(box["layer"] as CanvasLayer).queue_free()
			open_lot(idx)})
	choices.append({"label": "닫기", "cb": func() -> void: (box["layer"] as CanvasLayer).queue_free()})
	box["layer"] = ChoicePrompt.build(self, "🏠 작은 빈 집 %d/%d — 서로 다른 태그 셋 + 손님이 좋아하는 태그 둘이면 다음 날 눌러앉는다" % [Lots.count(ForestSaveState), Lots.MAX], choices)


## 집 하나 — 든 가구(누르면 창고로) · 창고 가구(누르면 넣기). 산 집은 잠김(닫기만)
func open_lot(i: int) -> void:
	var F := ForestSaveState
	var lot: Dictionary = Lots.lots(F)[i]
	var locked := String(lot.get("who", "")) != ""
	var box := {}
	var choices: Array = []
	if not locked:
		for k in lot.furn:
			var key := String(k)
			choices.append({"label": "↩ %s %s 거두기" % [_furn_name(key), _tags_text(key)], "cb": func() -> void:
				(box["layer"] as CanvasLayer).queue_free()
				var r := Lots.take(F, i, key)
				Toast.show(self, "🪑 창고로 거두었다" if bool(r.ok) else String(r.why), 2.0)
				open_lot(i)})
		if (lot.furn as Array).size() < Lots.FURN_MAX:
			for k in F.home_stock.keys():
				var key := String(k)
				if F.home_stock_count(key) < 1 or ForestHome.furn(key).is_empty():
					continue
				choices.append({"label": "＋ %s %s 넣기 (창고 %d)" % [_furn_name(key), _tags_text(key), F.home_stock_count(key)], "cb": func() -> void:
					(box["layer"] as CanvasLayer).queue_free()
					var r := Lots.put(F, i, key)
					Toast.show(self, "🪑 넣었다 — %s" % Lots.hint_for(F, i) if bool(r.ok) else String(r.why), 2.5)
					open_lot(i)})
	choices.append({"label": "닫기", "cb": func() -> void: (box["layer"] as CanvasLayer).queue_free()})
	var tags: Array = []
	for t: String in Lots.lot_tags(F, i):
		tags.append(Lots.tag_name(t))
	var have: Array = []
	for k in lot.furn:
		have.append(_furn_name(String(k)))
	box["layer"] = ChoicePrompt.build(self, "🏠 %d번째 집 — %s
가구 %d/%d: %s · 태그: %s" % [i + 1, Lots.hint_for(F, i), (lot.furn as Array).size(), Lots.FURN_MAX,
		", ".join(have) if not have.is_empty() else "없음", " · ".join(tags) if not tags.is_empty() else "없음"], choices)


static func _furn_name(key: String) -> String:
	return String(ForestHome.furn(key).get("name", key))


static func _tags_text(key: String) -> String:
	var names: Array = []
	for t: String in Lots.tags_of(key):
		names.append(Lots.tag_name(t))
	return "[%s]" % "·".join(names)
