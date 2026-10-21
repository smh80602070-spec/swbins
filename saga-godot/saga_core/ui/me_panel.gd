extends CanvasLayer

## G-0286 「내 정보」 창(웹 W-0361 me-panel.js 짝) — ☰ 칸 하나: 왼쪽 입은 것 · 오른쪽 능력치 · 아래 "어디서 올리나"(판 패시브 그물).
## 판 어댑터(판 HUD MenuHook 의 `me_adapter` 경로 — saga_core 는 판 경로를 모른다)의 `model(hud)` 가 판 기존 함수만 읽어 model 을 준다:
##   {name, sub, slots:[{label,item}], stats:[{label,value,detail}], grow:{label, open:Callable}}
## 창은 읽기만(세이브·균형 안 건드림). 열린 동안 멈춤(passive_web_screen 과 같은 결), Esc·✕ 로 닫힘.
## 점검은 `rows(model)` 글 줄을 본다(화면 없이).

const UiKit := preload("res://saga_core/ui/ui_kit.gd")
const GROUP := "me_panel"
const GOLD := Color(1.0, 0.86, 0.5)
const DIM := Color(0.78, 0.78, 0.78)

var game := "dungeon"
var model: Dictionary = {}
var _was_paused := false


## 판 HUD 를 받아 어댑터 model 로 연다 — 어댑터가 없거나 다른 창이 떠 있으면 null.
static func open_for(hud: Node, p_game: String, path: String) -> CanvasLayer:
	if hud == null or path == "" or not ResourceLoader.exists(path):
		return null
	if hud.get_tree().get_nodes_in_group("ui_modal").any(func(n): return n.get("visible") != false):
		return null
	var m: Dictionary = (load(path) as GDScript).call("model", hud)
	return open(hud.get_tree().current_scene, p_game, m)


static func open(parent: Node, p_game: String, p_model: Dictionary) -> CanvasLayer:
	var layer: CanvasLayer = (load("res://saga_core/ui/me_panel.gd") as GDScript).new()
	layer.game = p_game
	layer.model = p_model
	layer.layer = 9
	layer.process_mode = Node.PROCESS_MODE_ALWAYS
	layer.add_to_group("ui_modal")
	layer.add_to_group(GROUP)
	parent.add_child(layer)
	return layer


## model → 글 줄(점검·접근성) — 이름 · 칸마다 "부위: 물건" · 능력치마다 "이름 값" · 그물 단추 이름.
static func rows(m: Dictionary) -> PackedStringArray:
	var out := PackedStringArray([String(m.get("name", ""))])
	for s: Dictionary in m.get("slots", []):
		out.append("%s: %s" % [s.get("label", ""), s.get("item", "") if String(s.get("item", "")) != "" else "—"])
	for st: Dictionary in m.get("stats", []):
		out.append("%s %s" % [st.get("label", ""), st.get("value", "")])
	var g: Dictionary = m.get("grow", {})
	if not g.is_empty():
		out.append("▶ " + String(g.get("label", "")))
	return out


func _ready() -> void:
	_was_paused = get_tree().paused
	get_tree().paused = true
	var dim := ColorRect.new()
	dim.color = Color(0, 0, 0, 0.45)
	dim.set_anchors_preset(Control.PRESET_FULL_RECT)
	dim.mouse_filter = Control.MOUSE_FILTER_STOP
	add_child(dim)
	var card := PanelContainer.new()
	card.name = "MeCard"
	card.set_anchors_preset(Control.PRESET_CENTER)
	card.grow_horizontal = Control.GROW_DIRECTION_BOTH
	card.grow_vertical = Control.GROW_DIRECTION_BOTH
	card.custom_minimum_size = Vector2(640, 0)
	var th := UiKit.theme_for(game)
	if th != null:
		card.theme = th
	add_child(card)
	var box := VBoxContainer.new()
	box.add_theme_constant_override("separation", 10)
	card.add_child(box)
	var top := HBoxContainer.new()
	box.add_child(top)
	var title := Label.new()
	title.text = "👤 " + String(model.get("name", "내 정보"))
	title.add_theme_font_size_override("font_size", 24)
	title.add_theme_color_override("font_color", GOLD)
	title.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	top.add_child(title)
	var close := Button.new()
	close.name = "MeClose"
	close.text = "✕"
	close.custom_minimum_size = Vector2(44, 40)
	close.pressed.connect(close_panel)
	top.add_child(close)
	if String(model.get("sub", "")) != "":
		var sub := Label.new()
		sub.text = String(model.sub)
		sub.add_theme_font_size_override("font_size", 16)
		sub.add_theme_color_override("font_color", DIM)
		box.add_child(sub)
	var cols := HBoxContainer.new()
	cols.add_theme_constant_override("separation", 24)
	box.add_child(cols)
	cols.add_child(_grid(model.get("slots", []), "label", "item", String(model.get("slots_head", "입은 것"))))
	cols.add_child(_grid(model.get("stats", []), "label", "value", "능력치", "detail"))
	var g: Dictionary = model.get("grow", {})
	if not g.is_empty():
		var b := Button.new()
		b.name = "MeGrow"
		b.text = "▶ 어디서 올리나 — " + String(g.get("label", ""))
		b.custom_minimum_size = Vector2(0, 48)
		b.pressed.connect(_grow)
		box.add_child(b)


## 머리글 + 두 칸 격자(왼쪽 이름·오른쪽 값, detail 은 값 밑 작은 글)
func _grid(list: Array, k_label: String, k_value: String, head: String, k_detail := "") -> Control:
	var v := VBoxContainer.new()
	v.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	var h := Label.new()
	h.text = head
	h.add_theme_font_size_override("font_size", 18)
	h.add_theme_color_override("font_color", GOLD)
	v.add_child(h)
	if list.is_empty():
		var none := Label.new()
		none.text = "—"
		v.add_child(none)
		return v
	var gr := GridContainer.new()
	gr.columns = 2
	gr.add_theme_constant_override("h_separation", 14)
	v.add_child(gr)
	for it: Dictionary in list:
		var l := Label.new()
		l.text = String(it.get(k_label, ""))
		l.add_theme_font_size_override("font_size", 16)
		l.add_theme_color_override("font_color", DIM)
		gr.add_child(l)
		var cell := VBoxContainer.new()
		cell.add_theme_constant_override("separation", 0)
		gr.add_child(cell)
		var r := Label.new()
		var val := String(it.get(k_value, ""))
		r.text = val if val != "" else "—"
		r.add_theme_font_size_override("font_size", 16)
		cell.add_child(r)
		var det := String(it.get(k_detail, "")) if k_detail != "" else ""
		if det != "":
			var d := Label.new()
			d.text = det
			d.add_theme_font_size_override("font_size", 13)
			d.add_theme_color_override("font_color", DIM)
			cell.add_child(d)
	return v


## 그물 화면은 ui_modal 이 비어야 열린다 — 그룹에서 먼저 빼고 닫은 뒤 다음 차례에 연다.
func _grow() -> void:
	var cb: Callable = (model.get("grow", {}) as Dictionary).get("open", Callable())
	remove_from_group("ui_modal")
	close_panel()
	if cb.is_valid():
		cb.call_deferred()


func close_panel() -> void:
	if is_queued_for_deletion():
		return
	remove_from_group("ui_modal")
	get_tree().paused = _was_paused
	queue_free()


func _unhandled_input(event: InputEvent) -> void:
	if event.is_action_pressed("ui_cancel"):
		get_viewport().set_input_as_handled()
		close_panel()
