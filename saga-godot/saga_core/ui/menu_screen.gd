extends CanvasLayer

## G-0278 ☰ 메뉴 화면(웹 W-0253 menu-grid 짝, 원신 일시정지 메뉴 꼴) — 오른쪽 위 ☰ 단추·Esc·패드 Start 로 덮는 카드 격자.
## 칸 = 판이 넘기는 [{id, name, icon(글자·이모지), action(입력 액션 이름) 또는 open(Callable), badge(Callable→int)·shown(Callable→bool) 선택}]. 칸을 누르면 메뉴를 닫고
## 그 액션을 한 번 눌렀다 뗀다(각 화면의 원래 키 길 그대로 — 화면 코드를 안 고친다).
## Esc 순서: 다른 창(그룹 ui_modal)이 떠 있으면 그 창 몫(여기선 안 연다) · 메뉴가 떠 있으면 닫는다 · 아무것도 없으면 연다.
## 틀은 ui_kit.theme_for(판) — 칸 바탕 card.png. 손잡이: SAGA_MENU_SCREEN=0 이면 attach 가 null.

const UiKit := preload("res://saga_core/ui/ui_kit.gd")
const SaveTransferScreen := preload("res://saga_core/ui/save_transfer_screen.gd")
const GROUP := "saga_menu_screen"
const COLS := 5
const CARD := Vector2(150, 118)
const BURGER := Vector2(56, 56)   # 1280×720 기준 — 폰 2배면 112px(최소 터치 96)

var game := "go"
var items: Array = []
var is_open := false
var _root: Control
var _grid: GridContainer
var _burger: Button
var _frozen_before := false
var _player: Node = null
var burger_top := 52.0


static func enabled() -> bool:
	return OS.get_environment("SAGA_MENU_SCREEN") != "0"


## parent(씬) 에 메뉴를 단다 — 이미 있으면 그것(칸만 새로).
static func attach(parent: Node, game_id: String, item_list: Array) -> Node:
	if not enabled() or parent == null:
		return null
	var have := parent.get_tree().get_first_node_in_group(GROUP) if parent.is_inside_tree() else null
	if have != null:
		have.call("set_items", item_list)
		return have
	var m: CanvasLayer = (load("res://saga_core/ui/menu_screen.gd") as GDScript).new()
	m.name = "MenuScreen"
	m.game = game_id
	m.items = item_list
	parent.add_child(m)
	return m


func _ready() -> void:
	layer = 40
	add_to_group(GROUP)
	var th := UiKit.theme_for(game)
	_burger = Button.new()
	_burger.name = "MenuBurger"
	_burger.text = "☰"
	_burger.add_theme_font_size_override("font_size", 28)
	_burger.custom_minimum_size = BURGER
	_burger.size = BURGER
	_burger.anchor_left = 1.0
	_burger.anchor_right = 1.0
	_burger.offset_left = -BURGER.x - 12.0
	_burger.offset_right = -12.0
	_burger.offset_top = burger_top
	_burger.offset_bottom = burger_top + BURGER.y
	_burger.tooltip_text = "메뉴 (Esc)"
	_burger.focus_mode = Control.FOCUS_NONE
	if th != null:
		_burger.theme = th
	_burger.pressed.connect(toggle)
	add_child(_burger)
	_root = Control.new()
	_root.name = "MenuRoot"
	_root.set_anchors_preset(Control.PRESET_FULL_RECT)
	_root.visible = false
	if th != null:
		_root.theme = th
	add_child(_root)
	var dim := ColorRect.new()
	dim.color = Color(0.02, 0.03, 0.06, 0.62)
	dim.set_anchors_preset(Control.PRESET_FULL_RECT)
	dim.mouse_filter = Control.MOUSE_FILTER_STOP
	_root.add_child(dim)
	var center := CenterContainer.new()
	center.set_anchors_preset(Control.PRESET_FULL_RECT)
	_root.add_child(center)
	var panel := PanelContainer.new()
	panel.name = "MenuPanel"
	center.add_child(panel)
	var col := VBoxContainer.new()
	col.add_theme_constant_override("separation", 12)
	panel.add_child(col)
	var head := HBoxContainer.new()
	col.add_child(head)
	var title := Label.new()
	title.text = "메뉴"
	title.add_theme_font_size_override("font_size", 26)
	title.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	head.add_child(title)
	var close := Button.new()
	close.name = "MenuClose"
	close.text = "닫기 (Esc)"
	close.custom_minimum_size = Vector2(120, 48)
	close.pressed.connect(close_menu)
	head.add_child(close)
	_grid = GridContainer.new()
	_grid.name = "MenuGrid"
	_grid.columns = COLS
	_grid.add_theme_constant_override("h_separation", 10)
	_grid.add_theme_constant_override("v_separation", 10)
	col.add_child(_grid)
	_fill()


## ☰ 위 여백 — 판 HUD 오른쪽 위와 겹치면 판이 내린다(G-0280).
func set_burger_top(v: float) -> void:
	burger_top = v
	if _burger != null:
		_burger.offset_top = v
		_burger.offset_bottom = v + BURGER.y


func set_items(item_list: Array) -> void:
	items = item_list
	if _grid != null:
		_fill()


func _fill() -> void:
	for c in _grid.get_children():
		c.queue_free()
	var card := UiKit.card_box(game)
	for it: Dictionary in items:
		var b := Button.new()
		b.name = "Item_" + String(it.get("id", ""))
		b.custom_minimum_size = CARD
		b.text = "\n\n" + String(it.get("name", ""))   # 이름은 아래, 아이콘은 위 큰 글자(Icon Label)
		b.add_theme_font_size_override("font_size", 20)
		var ic := Label.new()
		ic.name = "Icon"
		ic.text = String(it.get("icon", ""))
		ic.add_theme_font_size_override("font_size", 38)
		ic.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		ic.mouse_filter = Control.MOUSE_FILTER_IGNORE
		ic.position = Vector2(0, 12)
		ic.size = Vector2(CARD.x, 50)
		b.add_child(ic)
		if card != null:
			for st in ["normal", "hover", "pressed", "focus"]:
				b.add_theme_stylebox_override(st, card)
			b.add_theme_color_override("font_hover_color", Color(1.0, 0.93, 0.7))
		b.set_meta("item", it)
		b.pressed.connect(_pick.bind(it))
		## 알림 점 자리(판이 item.badge Callable → int 를 넘기면 그 수가 0 보다 클 때 ●)
		var dot := Label.new()
		dot.name = "Badge"
		dot.text = "●"
		dot.add_theme_color_override("font_color", Color(1.0, 0.42, 0.32))
		dot.position = Vector2(CARD.x - 26, 4)
		dot.visible = false
		b.add_child(dot)
		_grid.add_child(b)


func toggle() -> void:
	if is_open:
		close_menu()
	else:
		open_menu()


func open_menu() -> void:
	if is_open or _other_modal() != null:
		return
	is_open = true
	_root.visible = true
	add_to_group("ui_modal")
	for b in _grid.get_children():
		var it: Dictionary = b.get_meta("item", {})
		(b as Control).visible = not (it.get("shown") is Callable) or bool((it.shown as Callable).call())   # 판이 "지금은 없음" 이라 한 칸(마당 곁에서만 등)
		var dot := b.get_node_or_null("Badge") as Label
		if dot != null:
			dot.visible = it.get("badge") is Callable and int((it.badge as Callable).call()) > 0
	_player = get_tree().get_first_node_in_group("player")
	if _player != null:   # frozen 없는 판 몸(4종횡)은 물리 처리를 멈춘다 — 세이브 옮기기 창과 같은 길(G-0280 R-5)
		_frozen_before = SaveTransferScreen._is_frozen(_player)
		SaveTransferScreen._set_frozen(_player, true)
	if _grid.get_child_count() > 0:
		(_grid.get_child(0) as Control).grab_focus.call_deferred()


func close_menu() -> void:
	if not is_open:
		return
	is_open = false
	_root.visible = false
	remove_from_group("ui_modal")
	if _player != null and is_instance_valid(_player):
		SaveTransferScreen._set_frozen(_player, _frozen_before)
	_player = null


## 칸 고름 — 메뉴를 닫고 그 화면의 원래 키(액션)를 한 번 누른 것처럼.
func _pick(it: Dictionary) -> void:
	close_menu()
	if it.get("open") is Callable:
		(it.open as Callable).call_deferred()
		return
	var a := String(it.get("action", ""))
	if a == "" or not InputMap.has_action(a):
		return
	_press.call_deferred(a)


func _press(a: String) -> void:
	for down in [true, false]:
		var ev := InputEventAction.new()
		ev.action = a
		ev.pressed = down
		Input.parse_input_event(ev)


## 다른 창이 떠 있나 — 그룹 ui_modal(보이는 것) 또는 씬 안 is_open 이 참인 노드(사냥 기록·사진첩처럼 그룹 없이 여는 화면).
## 씬을 훑는 건 Esc·☰ 누를 때 한 번뿐이라 틱 셈은 아니다.
func _other_modal() -> Node:
	for n in get_tree().get_nodes_in_group("ui_modal"):
		if n != self and n.get("visible") != false:
			return n
	var scene := get_tree().current_scene
	if scene != null:
		for n in scene.find_children("*", "Node", true, false):
			if n != self and n.get("is_open") == true and not n.is_in_group("go_hud_menu"):
				return n
	return null


func _unhandled_input(event: InputEvent) -> void:
	var esc := event is InputEventKey and (event as InputEventKey).pressed and not (event as InputEventKey).echo \
		and (event as InputEventKey).keycode == KEY_ESCAPE
	var start := event is InputEventJoypadButton and (event as InputEventJoypadButton).pressed \
		and (event as InputEventJoypadButton).button_index == JOY_BUTTON_START
	if not esc and not start:
		return
	if is_open:
		close_menu()
		get_viewport().set_input_as_handled()
	elif _other_modal() == null:
		open_menu()
		get_viewport().set_input_as_handled()
