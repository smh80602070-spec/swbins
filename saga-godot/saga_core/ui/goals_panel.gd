extends CanvasLayer

## G-0351 「오늘」 창(웹 W-0380 goals-panel.js 짝) — ☰ 칸 하나: 오늘 줄 · 이번 주 줄 · 다 하면 받는 보상 단추 · 다음 갈림까지.
## 판 어댑터(판 MenuHook 의 `goals_adapter` 경로 — saga_core 는 판 경로를 모른다)의 `model(hud)` 가 판 기존 함수만 읽어 model 을 준다:
##   {title, today_head·week_head(머리글 — 기본 "오늘"·"이번 주", G-0364 5천하 "이번 달"·"천하"), reset_in(초 — 다음 갈림, 0 = 모름), reset_label(기본 "새 날까지"), today:[{label, cur, max, done, go:Callable}], week:[같은 꼴],
##    claim:{label, ready, done, take:Callable} | {}, note}
## 창은 읽기만 — 받기 단추만 판의 기존 받기 함수(take)를 부른다(세이브·균형은 판 몫). 열린 동안 멈춤, Esc·✕ 로 닫힘.
## 줄을 누르면 go() — 판의 기존 창·자리로(창을 닫고 다음 차례에). 점검은 `rows(model)` 글 줄을 본다(화면 없이).

const UiKit := preload("res://saga_core/ui/ui_kit.gd")
const GROUP := "goals_panel"
const GOLD := Color(1.0, 0.86, 0.5)
const DIM := Color(0.78, 0.78, 0.78)
const DONE := Color(0.55, 0.9, 0.55)

var game := "dungeon"
var model: Dictionary = {}
var adapter := ""
var _hud: Node = null
var _was_paused := false
var _box: VBoxContainer = null


## 판 HUD 를 받아 어댑터 model 로 연다 — 어댑터가 없거나 다른 창이 떠 있으면 null.
static func open_for(hud: Node, p_game: String, path: String) -> CanvasLayer:
	if hud == null or path == "" or not ResourceLoader.exists(path):
		return null
	if hud.get_tree().get_nodes_in_group("ui_modal").any(func(n): return n.get("visible") != false):
		return null
	var m: Dictionary = (load(path) as GDScript).call("model", hud)
	var layer: CanvasLayer = open(hud.get_tree().current_scene, p_game, m)
	layer.set("adapter", path)
	layer.set("_hud", hud)
	return layer


static func open(parent: Node, p_game: String, p_model: Dictionary) -> CanvasLayer:
	var layer: CanvasLayer = (load("res://saga_core/ui/goals_panel.gd") as GDScript).new()
	layer.game = p_game
	layer.model = p_model
	layer.layer = 9
	layer.process_mode = Node.PROCESS_MODE_ALWAYS
	layer.add_to_group("ui_modal")
	layer.add_to_group(GROUP)
	parent.add_child(layer)
	return layer


## 남은 초 → "3시간 12분" · "12분" · 0 이하면 ""
static func left_text(sec: int) -> String:
	if sec <= 0:
		return ""
	var h := sec / 3600
	var m := (sec % 3600) / 60
	return ("%d시간 %d분" % [h, m]) if h > 0 else ("%d분" % maxi(1, m))


## 한 줄 글 — "✔ 이름 3/3" · "· 이름 1/3"(max 0 이면 숫자 없이)
static func line_text(g: Dictionary) -> String:
	var mx := int(g.get("max", 0))
	var num := (" %d/%d" % [mini(int(g.get("cur", 0)), mx), mx]) if mx > 0 else ""
	return "%s %s%s" % ["✔" if bool(g.get("done", false)) else "·", String(g.get("label", "")), num]


## model → 글 줄(점검·접근성) — 제목 · "오늘" 줄들 · "이번 주" 줄들 · 받기 상태
static func rows(m: Dictionary) -> PackedStringArray:
	var out := PackedStringArray([String(m.get("title", "오늘"))])
	for k: String in ["today", "week"]:
		var list: Array = m.get(k, [])
		if list.is_empty():
			continue
		out.append(String(m.get("today_head", "오늘")) if k == "today" else String(m.get("week_head", "이번 주")))
		for g: Dictionary in list:
			out.append(line_text(g))
	var c: Dictionary = m.get("claim", {})
	if not c.is_empty():
		out.append("🎁 %s %s" % [c.get("label", ""), "받음" if bool(c.get("done", false)) else ("받기" if bool(c.get("ready", false)) else "아직")])
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
	card.name = "GoalsCard"
	card.set_anchors_preset(Control.PRESET_CENTER)
	card.grow_horizontal = Control.GROW_DIRECTION_BOTH
	card.grow_vertical = Control.GROW_DIRECTION_BOTH
	card.custom_minimum_size = Vector2(560, 0)
	var th := UiKit.theme_for(game)
	if th != null:
		card.theme = th
	add_child(card)
	_box = VBoxContainer.new()
	_box.add_theme_constant_override("separation", 8)
	card.add_child(_box)
	_build()


func _build() -> void:
	for c in _box.get_children():
		c.queue_free()
	var top := HBoxContainer.new()
	_box.add_child(top)
	var title := Label.new()
	title.text = "📅 " + String(model.get("title", "오늘"))
	title.add_theme_font_size_override("font_size", 24)
	title.add_theme_color_override("font_color", GOLD)
	title.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	top.add_child(title)
	var left := left_text(int(model.get("reset_in", 0)))
	if left != "":
		var lt := Label.new()
		lt.name = "GoalsLeft"
		lt.text = String(model.get("reset_label", "새 날까지")) + " " + left
		lt.add_theme_font_size_override("font_size", 14)
		lt.add_theme_color_override("font_color", DIM)
		top.add_child(lt)
	var close := Button.new()
	close.name = "GoalsClose"
	close.text = "✕"
	close.custom_minimum_size = Vector2(44, 40)
	close.pressed.connect(close_panel)
	top.add_child(close)
	_section(String(model.get("today_head", "오늘")), model.get("today", []))
	_section(String(model.get("week_head", "이번 주")), model.get("week", []))
	var c: Dictionary = model.get("claim", {})
	if not c.is_empty():
		var b := Button.new()
		b.name = "GoalsClaim"
		var done := bool(c.get("done", false))
		var ready := bool(c.get("ready", false))
		b.text = "🎁 %s — %s" % [c.get("label", "보상"), "받았음" if done else ("받기" if ready else "다 하면 받음")]
		b.disabled = done or not ready
		b.custom_minimum_size = Vector2(0, 48)
		b.pressed.connect(_claim)
		_box.add_child(b)
	if String(model.get("note", "")) != "":
		var n := Label.new()
		n.text = String(model.note)
		n.add_theme_font_size_override("font_size", 14)
		n.add_theme_color_override("font_color", DIM)
		n.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		_box.add_child(n)


## 머리글 + 줄 단추(누르면 go — 판의 기존 창으로)
func _section(head: String, list: Array) -> void:
	if list.is_empty():
		return
	var h := Label.new()
	h.text = head
	h.add_theme_font_size_override("font_size", 18)
	h.add_theme_color_override("font_color", GOLD)
	_box.add_child(h)
	for g: Dictionary in list:
		var b := Button.new()
		b.text = line_text(g)
		b.alignment = HORIZONTAL_ALIGNMENT_LEFT
		b.custom_minimum_size = Vector2(0, 40)
		b.flat = true
		if bool(g.get("done", false)):
			b.add_theme_color_override("font_color", DONE)
		var cb: Callable = g.get("go", Callable())
		b.disabled = not cb.is_valid()
		b.pressed.connect(_go.bind(cb))
		_box.add_child(b)


## 줄 → 판 창. 판 창은 ui_modal 이 비어야 열린다 — 그룹에서 먼저 빼고 닫은 뒤 다음 차례에 연다.
func _go(cb: Callable) -> void:
	remove_from_group("ui_modal")
	close_panel()
	if cb.is_valid():
		cb.call_deferred()


## 받기 — 판의 받기 함수를 부르고 model 을 다시 읽어 그린다(어댑터가 있을 때).
func _claim() -> void:
	var cb: Callable = (model.get("claim", {}) as Dictionary).get("take", Callable())
	if cb.is_valid():
		cb.call()
	if adapter != "" and _hud != null and is_instance_valid(_hud):
		model = (load(adapter) as GDScript).call("model", _hud)
	_build()


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
