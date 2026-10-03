extends CanvasLayer

## PLAN 106장 ⑱ — 요리·음식 화면(G · 냄비 곁 F · 왼쪽 위 "요리" 단추). 규칙은 world/kitchen.gd·data/cooking.gd.
##   왼쪽: 요리 여덟(가진 재료로 만들 수 있으면 밝게) · 가운데: 고른 요리의 효과(품질 셋)·재료·숙련,
##   "조리 시작" → 바늘이 오가는 막대에서 "불 끄기"(Space·F) — 초록 칸이면 맛있는, 노란 칸이면 보통, 그 밖은 이상한.
##   숙련 5 면 "자동 조리 ×1"(보통). 조리는 냄비 3m 안에서만(음식 먹기는 어디서나).
##   오른쪽: 먹을 인물(명단 차례로) · 체력·포만감 · 켜진 버프 · 가진 음식마다 "먹기".
## 열려 있는 동안 그룹 ui_modal + 플레이어 frozen(인물 화면과 같다).

const Cooking := preload("res://games/saga_go/data/cooking.gd")
const Growth := preload("res://games/saga_go/data/growth.gd")
const ItemIcons := preload("res://games/saga_go/data/item_icons.gd")

const BAR_W := 420.0
const BAR_H := 30.0

var is_open := false
var selected := "honey_cake"
var target_index := 0
var cooking := false
var cook_t := 0.0
var last_quality := -1

var _player: Node = null
var _root: Control = null
var _recipe_buttons: Dictionary = {}
var _title: Label = null
var _detail: Label = null
var _ing_box: HBoxContainer = null # G-0016 재료 아이콘 줄 — 그림이 없는 재료는 글자만
var _bar: Control = null
var _zone_normal: ColorRect = null
var _zone_perfect: ColorRect = null
var _needle: ColorRect = null
var _cook_btn: Button = null
var _auto_btn: Button = null
var _cook_note: Label = null
var _target_btn: Button = null
var _status: Label = null
var _food_box: VBoxContainer = null
var _frozen_before := false
var _tick := 0.0

func _ready() -> void:
	layer = 6
	add_to_group("go_cooking_screen")
	if not InputMap.has_action("go_food"):
		InputMap.add_action("go_food")
		var ev := InputEventKey.new()
		ev.physical_keycode = KEY_G
		InputMap.action_add_event("go_food", ev)
	_build()
	var open_btn := Button.new()
	open_btn.text = "요리 (G)"
	open_btn.position = Vector2(326, 20)
	open_btn.size = Vector2(96, 40)
	open_btn.pressed.connect(open_screen)
	add_child(open_btn)
	PartyState.bag_changed.connect(func() -> void:
		if is_open:
			_refresh())
	PartyState.food_changed.connect(func() -> void:
		if is_open:
			_refresh())

func _kitchen() -> Node:
	return get_tree().get_first_node_in_group("go_kitchen")

func _combat() -> Node:
	return get_tree().get_first_node_in_group("go_field_combat")

func _unhandled_input(event: InputEvent) -> void:
	if is_open and cooking and (event.is_action_pressed("go_cook") or event.is_action_pressed("jump")):
		stop_cook()
		get_viewport().set_input_as_handled()
	elif event.is_action_pressed("go_food"):
		if is_open:
			close_screen()
		else:
			open_screen()
		get_viewport().set_input_as_handled()
	elif is_open and event is InputEventKey and (event as InputEventKey).pressed and (event as InputEventKey).keycode == KEY_ESCAPE:
		close_screen()
		get_viewport().set_input_as_handled()

# ---------------------------------------------------------------- 짓기

func _build() -> void:
	_root = Control.new()
	_root.set_anchors_preset(Control.PRESET_FULL_RECT)
	_root.visible = false
	add_child(_root)
	var dim := ColorRect.new()
	dim.color = Color(0.08, 0.06, 0.05, 0.84)
	dim.set_anchors_preset(Control.PRESET_FULL_RECT)
	_root.add_child(dim)
	var close := Button.new()
	close.text = "닫기 (G)"
	close.position = Vector2(30, 18)
	close.size = Vector2(110, 40)
	close.pressed.connect(close_screen)
	_root.add_child(close)

	var cols := HBoxContainer.new()
	cols.set_anchors_preset(Control.PRESET_FULL_RECT)
	cols.offset_left = 30
	cols.offset_right = -30
	cols.offset_top = 70
	cols.offset_bottom = -30
	cols.add_theme_constant_override("separation", 24)
	_root.add_child(cols)

	var left := VBoxContainer.new()
	left.custom_minimum_size = Vector2(220, 0)
	left.add_theme_constant_override("separation", 6)
	cols.add_child(left)
	for rid in Cooking.RECIPE_ORDER:
		var b := Button.new()
		b.custom_minimum_size = Vector2(0, 42)
		b.alignment = HORIZONTAL_ALIGNMENT_LEFT
		var r: String = rid
		b.pressed.connect(func() -> void: select(r))
		left.add_child(b)
		_recipe_buttons[rid] = b

	var mid := VBoxContainer.new()
	mid.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	mid.add_theme_constant_override("separation", 10)
	cols.add_child(mid)
	_title = _label(mid, 26)
	_detail = _label(mid, 16)
	_ing_box = HBoxContainer.new()
	_ing_box.add_theme_constant_override("separation", 14)
	mid.add_child(_ing_box)
	_bar = Control.new()
	_bar.custom_minimum_size = Vector2(BAR_W, BAR_H)
	mid.add_child(_bar)
	var bg := ColorRect.new()
	bg.color = Color(0.55, 0.3, 0.22)
	bg.size = Vector2(BAR_W, BAR_H)
	_bar.add_child(bg)
	_zone_normal = ColorRect.new()
	_zone_normal.color = Color(0.9, 0.78, 0.3)
	_bar.add_child(_zone_normal)
	_zone_perfect = ColorRect.new()
	_zone_perfect.color = Color(0.45, 0.85, 0.35)
	_bar.add_child(_zone_perfect)
	_needle = ColorRect.new()
	_needle.color = Color(1, 1, 1)
	_needle.size = Vector2(4, BAR_H + 10)
	_needle.position = Vector2(0, -5)
	_bar.add_child(_needle)
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 8)
	mid.add_child(row)
	_cook_btn = Button.new()
	_cook_btn.custom_minimum_size = Vector2(160, 48)
	_cook_btn.pressed.connect(func() -> void:
		if cooking:
			stop_cook()
		else:
			start_cook())
	row.add_child(_cook_btn)
	_auto_btn = Button.new()
	_auto_btn.custom_minimum_size = Vector2(160, 48)
	_auto_btn.pressed.connect(func() -> void:
		var k := _kitchen()
		if k and k.call("near_pot"):
			k.call("auto_cook", selected, 1))
	row.add_child(_auto_btn)
	_cook_note = _label(mid, 15)

	var right := VBoxContainer.new()
	right.custom_minimum_size = Vector2(380, 0)
	right.add_theme_constant_override("separation", 6)
	cols.add_child(right)
	_target_btn = Button.new()
	_target_btn.custom_minimum_size = Vector2(0, 40)
	_target_btn.pressed.connect(next_target)
	right.add_child(_target_btn)
	_status = _label(right, 15)
	var scroll := ScrollContainer.new()
	scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	right.add_child(scroll)
	_food_box = VBoxContainer.new()
	_food_box.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	scroll.add_child(_food_box)

func _label(parent: Control, size: int) -> Label:
	var l := Label.new()
	l.add_theme_font_size_override("font_size", size)
	l.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	parent.add_child(l)
	return l

# ---------------------------------------------------------------- 열고 닫기

func open_screen() -> void:
	if is_open:
		return
	if get_tree().get_nodes_in_group("duel_active").size() > 0:
		return
	for g in ["go_world_map", "go_character_screen"]:
		var other := get_tree().get_first_node_in_group(g)
		if other and other.get("is_open"):
			return
	_player = get_tree().get_first_node_in_group("player")
	is_open = true
	cooking = false
	_root.visible = true
	add_to_group("ui_modal")
	if _player:
		_frozen_before = bool(_player.get("frozen"))
		_player.set("frozen", true)
	_refresh()

func close_screen() -> void:
	if not is_open:
		return
	is_open = false
	cooking = false
	_root.visible = false
	remove_from_group("ui_modal")
	if _player:
		_player.set("frozen", _frozen_before)

# ---------------------------------------------------------------- 조리

func select(recipe: String) -> void:
	if cooking:
		return
	selected = recipe
	last_quality = -1
	_refresh()

func cook_block() -> String:
	var k := _kitchen()
	if k == null or not k.call("near_pot"):
		return "냄비 곁에서만 조리할 수 있다 (신상 옆 냄비)"
	if not PartyState.has_items(Cooking.RECIPES[selected].ing):
		return "재료가 모자라다"
	return ""

func start_cook() -> bool:
	if cooking or cook_block() != "":
		return false
	cooking = true
	cook_t = 0.0
	_refresh()
	return true

## 불 끄기 — 지금 바늘 자리로 품질을 정하고 조리한다. 품질(못 했으면 -1).
func stop_cook() -> int:
	if not cooking:
		return -1
	cooking = false
	var q := Cooking.quality_at(selected, Cooking.needle_at(cook_t))
	var k := _kitchen()
	if k and k.call("cook", selected, q):
		last_quality = q
	_refresh()
	return last_quality

func _process(delta: float) -> void:
	if not is_open:
		return
	if cooking:
		cook_t += delta
		_needle.position.x = Cooking.needle_at(cook_t) * BAR_W - 2.0
	_tick -= delta
	if _tick <= 0.0:
		_tick = 0.5
		_refresh_status()

# ---------------------------------------------------------------- 먹기

func roster() -> Array:
	var fc := _combat()
	return fc.call("roster") if fc else ["self"]

func target_id() -> String:
	var r := roster()
	return r[clampi(target_index, 0, r.size() - 1)]

func next_target() -> void:
	target_index = (target_index + 1) % roster().size()
	_refresh()

func _name(id: String) -> String:
	var fc := _combat()
	return fc.call("display_name", id) if fc else id

# ---------------------------------------------------------------- 그리기

func _refresh() -> void:
	if _root == null:
		return
	for rid in _recipe_buttons:
		var b: Button = _recipe_buttons[rid]
		var ok := PartyState.has_items(Cooking.RECIPES[rid].ing)
		b.text = ("▶ " if rid == selected else "   ") + Cooking.RECIPES[rid].name + ("" if ok else "  (재료 부족)")
		b.modulate = Color(1, 1, 1) if ok else Color(0.65, 0.65, 0.65)
	var r: Dictionary = Cooking.RECIPES[selected]
	_title.text = r.name
	var lines: Array[String] = []
	for q in Cooking.QUALITY_COUNT:
		lines.append("%s: %s" % [Cooking.QUALITY_NAMES[q], Cooking.effect_text(selected, q)])
	var ing: Array[String] = []
	for item in r.ing:
		ing.append("%s %d/%d" % [Growth.item_name(item), PartyState.count(item), int(r.ing[item])])
	lines.append("재료: " + " · ".join(ing))
	_refresh_ingredients(r)
	var pr := int(PartyState.cook_prof.get(selected, 0))
	lines.append("숙련 %d/%d%s" % [pr, Cooking.PROF_MAX, "  — 자동 조리 가능" if pr >= Cooking.PROF_MAX else ""])
	_detail.text = "\n".join(lines)
	var z: float = r.zone
	_zone_normal.position = Vector2((z - Cooking.NORMAL_HALF) * BAR_W, 0)
	_zone_normal.size = Vector2(Cooking.NORMAL_HALF * 2.0 * BAR_W, BAR_H)
	_zone_perfect.position = Vector2((z - Cooking.PERFECT_HALF) * BAR_W, 0)
	_zone_perfect.size = Vector2(Cooking.PERFECT_HALF * 2.0 * BAR_W, BAR_H)
	var block := cook_block()
	_cook_btn.text = "불 끄기! (Space)" if cooking else "조리 시작"
	_cook_btn.disabled = not cooking and block != ""
	_auto_btn.text = "자동 조리 ×1"
	_auto_btn.disabled = cooking or block != "" or pr < Cooking.PROF_MAX
	if cooking:
		_cook_note.text = "바늘이 초록 칸에 올 때 불을 끈다"
	elif block != "":
		_cook_note.text = block
	elif last_quality >= 0:
		_cook_note.text = "%s 완성!" % Cooking.dish_name(selected, last_quality)
	else:
		_cook_note.text = ""
	_refresh_status()
	_refresh_food()

func _refresh_status() -> void:
	var id := target_id()
	_target_btn.text = "먹을 인물: %s  ▶" % _name(id)
	var fc := _combat()
	var k := _kitchen()
	var lines: Array[String] = []
	if fc:
		lines.append("체력 %d/%d · 포만감 %d/%d" % [int(fc.call("hp_of", id)), int(fc.call("max_hp_of", id)),
			int(k.call("full_of", id)) if k else 0, int(Cooking.FULL_MAX)])
	for cat in ["attack", "defense", "adventure"]:
		if PartyState.food_buffs.has(cat):
			var b: Dictionary = PartyState.food_buffs[cat]
			lines.append("%s: %s (%d초)" % [Cooking.CAT_NAMES[cat], Cooking.dish_name(b.recipe, int(b.q)), int(ceil(float(b.left)))])
	_status.text = "\n".join(lines)

## 재료마다 아이콘(40px) + 가진 수/필요 수. 아이콘이 없는 재료는 글자만 — 위 "재료:" 줄과 같은 정보라 빠져도 비는 정보가 없다.
func _refresh_ingredients(r: Dictionary) -> void:
	for c in _ing_box.get_children():
		c.queue_free()
	for item in r.ing:
		var cell := HBoxContainer.new()
		cell.add_theme_constant_override("separation", 4)
		var ic := ItemIcons.make_rect("material", String(item), 40)
		if ic != null:
			cell.add_child(ic)
		var l := Label.new()
		l.add_theme_font_size_override("font_size", 15)
		var have := PartyState.count(item)
		var need := int(r.ing[item])
		l.text = "%s %d/%d" % [Growth.item_name(item), have, need]
		l.modulate = Color(1, 1, 1) if have >= need else Color(1, 0.6, 0.55)
		cell.add_child(l)
		_ing_box.add_child(cell)


func _refresh_food() -> void:
	for c in _food_box.get_children():
		c.queue_free()
	var k := _kitchen()
	var id := target_id()
	var any := false
	for rid in Cooking.RECIPE_ORDER:
		for q in range(Cooking.QUALITY_COUNT - 1, -1, -1):
			var dish := Cooking.dish_id(rid, q)
			var n := PartyState.count(dish)
			if n <= 0:
				continue
			any = true
			var row := HBoxContainer.new()
			row.add_theme_constant_override("separation", 6)
			_food_box.add_child(row)
			var l := Label.new()
			l.add_theme_font_size_override("font_size", 14)
			l.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
			l.size_flags_horizontal = Control.SIZE_EXPAND_FILL
			l.text = "%s ×%d\n%s" % [Cooking.dish_name(rid, q), n, Cooking.effect_text(rid, q)]
			row.add_child(l)
			var b := Button.new()
			var why: String = k.call("eat_block", dish, id) if k else "없음"
			b.text = "먹기" if why == "" else why
			b.disabled = why != ""
			b.custom_minimum_size = Vector2(96, 40)
			var d := dish
			b.pressed.connect(func() -> void:
				var kk := _kitchen()
				if kk:
					kk.call("eat", d, target_id())
				_refresh())
			row.add_child(b)
	if not any:
		var l := Label.new()
		l.text = "음식이 없다 — 들판에서 재료를 모아 냄비에서 조리한다"
		l.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		_food_box.add_child(l)
