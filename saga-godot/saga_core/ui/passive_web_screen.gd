extends CanvasLayer

## G-0213 공용 패시브 그물 화면 — 웹 saga-web/shared/js/passive-web-ui.js(W-0179) 의 고돗판.
## 규칙은 saga_core/data/passive_web.gd(api), 정의·효과 글은 판이 넘긴다(saga_core 는 games 를 안 부른다).
##
##   PassiveWebScreen.open(parent, api, {title, fmt: Callable(stats)->String, gate: Callable(id)->String, on_drop: Callable(id), on_close: Callable})
##
## 끌어 옮기기·휠/두 손가락 확대(0.4~3) · 찍은 마디 금색 · 지금 찍을 수 있는 이웃 밝게 · 나머지 흐림 · 시작점은 정의 색.
## 마디를 누르면 아래 카드(이름·효과·까닭·"찍기 (경로 n점)"/"되돌리기"), 위 줄은 제목·남은 점수·검색칸·✕.
## 391마디를 노드로 만들지 않고 판 하나의 _draw 로 그린다 — 바뀔 때만 queue_redraw(매 틱 그리기 없음).
## 열린 동안 게임을 멈춘다(이 층만 PROCESS_MODE_ALWAYS). 닫기 Esc·✕. gate 는 판의 막음(되돌리기는 마을에서만 등) — "" 면 됨.

const ZOOM_MIN := 0.4
const ZOOM_MAX := 3.0
const GOLD := Color(1.0, 0.8, 0.28)
const CAN := Color(0.92, 0.96, 1.0)
const DIM := Color(0.42, 0.45, 0.55)
const BG := Color(0.04, 0.05, 0.1, 1.0)   # 뒤 HUD 글자가 비치면 시끄럽다(pw_screen 촬영)
const FIND := Color(0.35, 0.95, 1.0)
const WHY := {"far": "찍은 마디에 이웃해야 찍힌다", "points": "점수가 모자란다", "nostart": "먼저 시작점을 고른다",
	"start": "시작점은 하나만 고른다", "none": "없는 마디", "taken": ""}

var api: RefCounted
var opts: Dictionary = {}
var board: Control
var _title: Label
var _points: Label
var _search: LineEdit
var _found: Label
var _card: PanelContainer
var _card_name: Label
var _card_body: Label
var _card_btn: Button
var _was_paused := false


static func open(parent: Node, p_api: RefCounted, p_opts: Dictionary = {}) -> CanvasLayer:
	var layer := new()
	layer.api = p_api
	layer.opts = p_opts
	layer.layer = 8
	layer.process_mode = Node.PROCESS_MODE_ALWAYS
	layer.add_to_group("ui_modal")
	layer.add_to_group("passive_web_screen")
	parent.add_child(layer)
	return layer


func _ready() -> void:
	_was_paused = get_tree().paused
	get_tree().paused = true
	board = Board.new()
	board.screen = self
	board.set_anchors_preset(Control.PRESET_FULL_RECT)
	board.mouse_filter = Control.MOUSE_FILTER_STOP
	add_child(board)
	_build_top()
	_build_card()
	api.changed.connect(_refresh)
	_refresh()


func _build_top() -> void:
	var bar := HBoxContainer.new()
	bar.set_anchors_preset(Control.PRESET_TOP_WIDE)
	bar.offset_left = 12
	bar.offset_right = -12
	bar.offset_top = 8
	bar.offset_bottom = 52
	bar.add_theme_constant_override("separation", 10)
	add_child(bar)
	_title = Label.new()
	_title.text = String(opts.get("title", "패시브 그물"))
	_title.add_theme_font_size_override("font_size", 22)
	_title.add_theme_color_override("font_color", GOLD)
	bar.add_child(_title)
	_points = Label.new()
	_points.add_theme_font_size_override("font_size", 18)
	bar.add_child(_points)
	var gap := Control.new()
	gap.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	bar.add_child(gap)
	_search = LineEdit.new()
	_search.placeholder_text = "찾기(이름·효과)"
	_search.custom_minimum_size = Vector2(170, 0)
	_search.text_changed.connect(func(_t: String) -> void: board.set_search(_search.text))
	bar.add_child(_search)
	_found = Label.new()
	_found.add_theme_font_size_override("font_size", 16)
	_found.add_theme_color_override("font_color", FIND)
	bar.add_child(_found)
	var close := Button.new()
	close.text = "✕"
	close.custom_minimum_size = Vector2(44, 40)
	close.pressed.connect(close_screen)
	bar.add_child(close)


func _build_card() -> void:
	_card = PanelContainer.new()
	_card.anchor_left = 0.5
	_card.anchor_right = 0.5
	_card.anchor_top = 1.0
	_card.anchor_bottom = 1.0
	_card.grow_horizontal = Control.GROW_DIRECTION_BOTH
	_card.grow_vertical = Control.GROW_DIRECTION_BEGIN
	_card.offset_bottom = -16
	_card.visible = false
	add_child(_card)
	var box := VBoxContainer.new()
	box.add_theme_constant_override("separation", 6)
	_card.add_child(box)
	_card_name = Label.new()
	_card_name.add_theme_font_size_override("font_size", 22)
	box.add_child(_card_name)
	_card_body = Label.new()
	_card_body.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_card_body.add_theme_font_size_override("font_size", 17)
	box.add_child(_card_body)
	_card_btn = Button.new()
	_card_btn.custom_minimum_size = Vector2(0, 44)
	_card_btn.pressed.connect(_on_card_btn)
	box.add_child(_card_btn)


## 카드 폭은 화면에 맞춘다(세로 화면에서 위 줄·카드가 안 겹치게 — 카드는 아래, 위 줄은 위)
func _card_width() -> float:
	return minf(520.0, board.size.x - 32.0)


func _refresh() -> void:
	_points.text = "남은 점수 %d / %d" % [api.left(), api.points()]
	_fill_card()
	board.queue_redraw()


func select(id: String) -> void:
	board.selected = id
	_fill_card()
	## 고른 마디가 아래 카드(약 140px)에 가리면 판을 올린다(pw_screen 촬영 — 바깥 고리 마디가 카드 밑에 숨었다)
	if id != "" and not api.node(id).is_empty():
		var p: Vector2 = board.to_screen(api.node(id))
		var top := board.size.y - 16.0 - 140.0
		if p.y > top - 24.0:
			board.pan.y -= p.y - (top - 48.0)
	board.queue_redraw()


func _gate(id: String) -> String:
	var g: Callable = opts.get("gate", Callable())
	return String(g.call(id)) if g.is_valid() else ""


func _fill_card() -> void:
	var id: String = board.selected
	if id == "" or api.node(id).is_empty():
		_card.visible = false
		return
	var nd: Dictionary = api.node(id)
	var w := _card_width()
	_card.offset_left = -w * 0.5
	_card.offset_right = w * 0.5
	_card.custom_minimum_size = Vector2(w, 0)
	_card.visible = true
	var kind := {"s": "", "n": "★ ", "k": "◆ ", "o": "● "}
	_card_name.text = String(kind.get(String(nd.k), "")) + String(nd.name)
	var fmt: Callable = opts.get("fmt", Callable())
	var lines: Array = []
	var st: Dictionary = nd.get("stats", {})
	if not st.is_empty():
		lines.append(String(fmt.call(st)) if fmt.is_valid() else _plain_stats(st))
	if nd.has("desc"):
		lines.append(String(nd.desc))
	var state: String = api.state(id)
	var gate := _gate(id)
	if state == "taken":
		if String(nd.k) == "o":
			_card_btn.text = "시작점"
			_card_btn.disabled = true
		else:
			_card_btn.text = "되돌리기"
			_card_btn.disabled = not api.can_drop(id) or gate != ""
			if not api.can_drop(id):
				lines.append("되돌리면 다른 마디가 끊긴다")
	else:
		var p: Dictionary = api.path_to(id)
		if p.is_empty():
			_card_btn.text = "닿을 길 없음"
			_card_btn.disabled = true
			if api.store.start != null and String(nd.k) == "o":
				lines.append(WHY.start)
		elif String(nd.k) == "o":
			_card_btn.text = "여기서 시작"
			_card_btn.disabled = gate != ""
		else:
			_card_btn.text = "찍기 (경로 %d점)" % int(p.cost)
			_card_btn.disabled = int(p.cost) > api.left() or gate != ""
			if int(p.cost) > api.left():
				lines.append(WHY.points)
	if gate != "":
		lines.append(gate)
	_card_body.text = "\n".join(lines)


func _plain_stats(st: Dictionary) -> String:
	var parts: Array = []
	for k in st:
		var v := float(st[k])
		parts.append("%s %s%s" % [k, "+" if v >= 0.0 else "", str(v)])
	return " · ".join(parts)


func _on_card_btn() -> void:
	var id: String = board.selected
	if id == "":
		return
	if api.state(id) == "taken":
		if api.drop(id):
			var cb: Callable = opts.get("on_drop", Callable())   # 판이 되돌리기 값을 받는다(4종횡 금 200 등)
			if cb.is_valid():
				cb.call(id)
	else:
		api.take_path(id)


func close_screen() -> void:
	if is_queued_for_deletion():
		return
	get_tree().paused = _was_paused
	var cb: Callable = opts.get("on_close", Callable())
	queue_free()
	if cb.is_valid():
		cb.call()


func _unhandled_input(event: InputEvent) -> void:
	if event.is_action_pressed("ui_cancel"):
		get_viewport().set_input_as_handled()
		close_screen()


## 그물 판 — 끌기·확대·고르기와 그리기(정의 좌표 −1~1 → 화면)
class Board extends Control:
	var screen: CanvasLayer
	var pan := Vector2.ZERO
	var zoom := 1.0
	var selected := ""
	var hits: Dictionary = {}
	var _press := Vector2.ZERO
	var _dragging := false
	var _touches: Dictionary = {}
	var _pinch0 := 0.0
	var _zoom0 := 1.0

	func base() -> float:
		return minf(size.x, size.y) * 0.44

	func to_screen(nd: Dictionary) -> Vector2:
		return size * 0.5 + pan + Vector2(float(nd.x), float(nd.y)) * base() * zoom

	func set_search(q: String) -> void:
		hits = {}
		q = q.strip_edges()
		if q != "":
			var fmt: Callable = screen.opts.get("fmt", Callable())
			for nd: Dictionary in screen.api.def.nodes:
				var hay := String(nd.name) + " " + String(nd.get("desc", ""))
				var st: Dictionary = nd.get("stats", {})
				if not st.is_empty():
					hay += " " + (String(fmt.call(st)) if fmt.is_valid() else str(st))
				if hay.contains(q):
					hits[String(nd.id)] = true
		screen._found.text = ("%d곳" % hits.size()) if q != "" else ""
		queue_redraw()

	func zoom_at(f: float, at: Vector2) -> void:
		var nz := clampf(zoom * f, ZOOM_MIN, ZOOM_MAX)
		var c := size * 0.5 + pan
		pan += (at - c) * (1.0 - nz / zoom)
		zoom = nz
		queue_redraw()

	func pick(at: Vector2) -> String:
		var best := ""
		var best_d := 22.0
		for nd: Dictionary in screen.api.def.nodes:
			var d := to_screen(nd).distance_to(at)
			if d < best_d:
				best_d = d
				best = String(nd.id)
		return best

	func _gui_input(event: InputEvent) -> void:
		if event is InputEventMouseButton:
			var mb := event as InputEventMouseButton
			if mb.button_index == MOUSE_BUTTON_WHEEL_UP and mb.pressed:
				zoom_at(1.15, mb.position)
			elif mb.button_index == MOUSE_BUTTON_WHEEL_DOWN and mb.pressed:
				zoom_at(1.0 / 1.15, mb.position)
			elif mb.button_index == MOUSE_BUTTON_LEFT:
				if mb.pressed:
					_press = mb.position
					_dragging = false
				elif not _dragging and _touches.size() < 2:
					screen.select(pick(mb.position))
			accept_event()
		elif event is InputEventMouseMotion and (event.button_mask & MOUSE_BUTTON_MASK_LEFT) != 0 and _touches.size() < 2:
			if _dragging or event.position.distance_to(_press) > 8.0:
				_dragging = true
				pan += event.relative
				queue_redraw()
			accept_event()
		elif event is InputEventMagnifyGesture:
			zoom_at(event.factor, event.position)
			accept_event()
		elif event is InputEventScreenTouch:
			if event.pressed:
				_touches[event.index] = event.position
			else:
				_touches.erase(event.index)
			if _touches.size() == 2:
				var ps: Array = _touches.values()
				_pinch0 = (ps[0] as Vector2).distance_to(ps[1])
				_zoom0 = zoom
		elif event is InputEventScreenDrag:
			_touches[event.index] = event.position
			if _touches.size() == 2 and _pinch0 > 1.0:
				var ps: Array = _touches.values()
				var d := (ps[0] as Vector2).distance_to(ps[1])
				var mid := ((ps[0] as Vector2) + (ps[1] as Vector2)) * 0.5
				zoom_at(_zoom0 * d / _pinch0 / zoom, mid)
				_dragging = true

	func _draw() -> void:
		draw_rect(Rect2(Vector2.ZERO, size), BG)
		var api: RefCounted = screen.api
		var nodes: Array = api.def.nodes
		var adj: Array = api.adjacency()
		var st_of: Array = []
		for nd: Dictionary in nodes:
			st_of.append(api.state(String(nd.id)))
		var wline := clampf(1.2 * sqrt(zoom), 1.0, 3.0)
		for i in adj.size():
			for j: int in adj[i]:
				if j <= i:
					continue
				var a: String = st_of[i]
				var b: String = st_of[j]
				var col := DIM
				col.a = 0.45
				if a == "taken" and b == "taken":
					col = GOLD
				elif (a == "taken" and b == "can") or (a == "can" and b == "taken"):
					col = CAN
					col.a = 0.8
				draw_line(to_screen(nodes[i]), to_screen(nodes[j]), col, wline, true)
		## 고른 마디까지 찍을 길(점선 대신 주황 테)
		var path: Array = []
		if selected != "" and api.state(selected) != "taken":
			path = (api.path_to(selected) as Dictionary).get("path", [])
		var font := ThemeDB.fallback_font
		var start_col := {}
		for s: Dictionary in api.def.get("starts", []):
			start_col[String(s.key)] = Color(String(s.get("color", "#ffffff")))
		var rmul := clampf(sqrt(zoom), 0.7, 1.8)
		for i in nodes.size():
			var nd: Dictionary = nodes[i]
			var k := String(nd.k)
			var p := to_screen(nd)
			if p.x < -40 or p.y < -40 or p.x > size.x + 40 or p.y > size.y + 40:
				continue
			var r: float = {"o": 10.0, "k": 8.0, "n": 6.5, "s": 3.6}.get(k, 4.0) * rmul
			var st: String = st_of[i]
			var col: Color = GOLD if st == "taken" else (CAN if st == "can" else DIM)
			if k == "o":
				col = start_col.get(String(nd.get("s", "")), col)
				if st != "taken":
					col = col.darkened(0.35)
			draw_circle(p, r, col)
			if k == "k":
				draw_arc(p, r + 3.0, 0.0, TAU, 20, col, 2.0, true)
			var id := String(nd.id)
			if hits.has(id):
				draw_arc(p, r + 6.0, 0.0, TAU, 20, FIND, 2.0, true)
			if path.has(id):
				draw_arc(p, r + 4.0, 0.0, TAU, 16, Color(1.0, 0.55, 0.2), 2.0, true)
			if id == selected:
				draw_arc(p, r + 8.0, 0.0, TAU, 24, Color.WHITE, 2.5, true)
			if k == "o" or ((k == "n" or k == "k") and zoom >= 1.5):
				draw_string(font, p + Vector2(r + 4.0, 5.0), String(nd.name), HORIZONTAL_ALIGNMENT_LEFT, -1, 15 if k == "o" else 13, col.lightened(0.2))
