extends Node
## G-0031 — 사가고 도감 화면. X(터치 "도감")로 연다. 탭 셋:
##   인물 — 도감 인물 105(HEROES 중 시대가 삼국지·한국사·일본사·세계사이고 국지 전용 rf_ 가 아닌 것). 영입(PartyState.members)·
##          만남(CodexState "record")·모름("???"). 고른 칸은 오른쪽에 새 인물 몸(characters_dex, 같은 이름)이 돈다.
##   신수 — PETS 11. 잡음(CodexState "pet")이면 CreatureBuilder 몸·설명, 아니면 검은 실루엣.
##   발견 — CodexState 갈래(지역·사람·짐승·사건·기록·신수)별 찾은 수/전체 막대 + 이름 목록(data/codex_catalog.gd, 지역은 땅마다, 못 찾은 것은 ???).
## 읽기만 한다(새 저장 없음). 화면·열기/닫기·ui_modal 은 world/achievements.gd 와 같은 결.

const Characters := preload("res://saga_core/data/characters.gd")
const Pets := preload("res://saga_core/data/pets.gd")
const VroidBody := preload("res://saga_core/world/vroid_body.gd")
const CreatureBuilder := preload("res://saga_core/world/creature_builder.gd")
const Catalog := preload("res://games/saga_go/data/codex_catalog.gd")

const DEX_ERAS := ["삼국지", "한국사", "일본사", "세계사"]
const KIND_NAMES := {"place": "지역", "people": "사람", "beast": "짐승", "event": "사건", "record": "역사 인물", "pet": "신수"}
const KIND_ORDER := ["place", "people", "beast", "event", "record", "pet"]
const SPIN := 0.6   # 미리보기 몸이 도는 빠르기(rad/s)
const SILHOUETTE := Color(0.05, 0.05, 0.07)

var is_open := false
var tab := "hero"
var selected := ""   # 고른 칸 id(점검용)
var _player: Node3D = null
var _frozen_before := false
var _layer: CanvasLayer
var _panel: PanelContainer
var _title: Label
var _tabs: HBoxContainer
var _grid: GridContainer
var _detail_name: Label
var _detail_text: Label
var _view: SubViewport
var _view_box: SubViewportContainer
var _model: Node3D = null
var _open_btn: Button

func _ready() -> void:
	add_to_group("go_codex")
	if not InputMap.has_action("go_codex"):
		InputMap.add_action("go_codex")
		var ev := InputEventKey.new()
		ev.physical_keycode = KEY_X
		InputMap.action_add_event("go_codex", ev)
	_build_screen()

## 도감 인물 105 — 표 순서 그대로.
static func dex_heroes() -> Array:
	var out: Array = []
	for h: Dictionary in Characters.HEROES:
		if DEX_ERAS.has(String(h.era)) and not String(h.id).begins_with("rf_"):
			out.append(h)
	return out

## "owned" 영입 · "met" 만남 · "" 모름.
static func hero_state(id: String) -> String:
	if PartyState.members.has(id):
		return "owned"
	if CodexState.has("record", id):
		return "met"
	return ""

static func kind_count(kind: String) -> int:
	var n := 0
	for k in CodexState.book.keys():
		if String(k).begins_with(kind + ":"):
			n += 1
	return n

func _build_screen() -> void:
	_layer = CanvasLayer.new()
	_layer.layer = 6
	add_child(_layer)
	_open_btn = Button.new()
	_open_btn.text = "도감 (X)"
	_open_btn.position = Vector2(754, 20)
	_open_btn.custom_minimum_size = Vector2(96, 40)
	_open_btn.pressed.connect(toggle)
	_layer.add_child(_open_btn)
	_panel = PanelContainer.new()
	_panel.anchor_left = 0.5
	_panel.anchor_right = 0.5
	_panel.anchor_top = 0.5
	_panel.anchor_bottom = 0.5
	_panel.offset_left = -470
	_panel.offset_right = 470
	_panel.offset_top = -290
	_panel.offset_bottom = 290
	_panel.visible = false
	var sb := StyleBoxFlat.new()
	sb.bg_color = Color(0.07, 0.07, 0.09, 0.93)
	sb.set_corner_radius_all(10)
	sb.content_margin_left = 16
	sb.content_margin_right = 16
	sb.content_margin_top = 12
	sb.content_margin_bottom = 12
	_panel.add_theme_stylebox_override("panel", sb)
	_layer.add_child(_panel)
	var box := VBoxContainer.new()
	box.add_theme_constant_override("separation", 8)
	_panel.add_child(box)
	_title = Label.new()
	_title.add_theme_font_size_override("font_size", 20)
	_title.add_theme_color_override("font_color", Color(1.0, 0.86, 0.5))
	box.add_child(_title)
	_tabs = HBoxContainer.new()
	box.add_child(_tabs)
	for t in ["hero", "pet", "find"]:
		var b := Button.new()
		b.custom_minimum_size = Vector2(150, 36)
		var tt: String = t
		b.pressed.connect(func() -> void: show_tab(tt))
		_tabs.add_child(b)
	var body := HBoxContainer.new()
	body.add_theme_constant_override("separation", 14)
	body.size_flags_vertical = Control.SIZE_EXPAND_FILL
	box.add_child(body)
	var scroll := ScrollContainer.new()
	scroll.custom_minimum_size = Vector2(520, 420)
	scroll.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	body.add_child(scroll)
	_grid = GridContainer.new()
	_grid.columns = 4
	_grid.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_grid.add_theme_constant_override("h_separation", 6)
	_grid.add_theme_constant_override("v_separation", 6)
	scroll.add_child(_grid)
	var side := VBoxContainer.new()
	side.custom_minimum_size = Vector2(340, 0)
	side.add_theme_constant_override("separation", 6)
	body.add_child(side)
	_view_box = SubViewportContainer.new()
	_view_box.custom_minimum_size = Vector2(340, 300)
	_view_box.stretch = true
	side.add_child(_view_box)
	_view = SubViewport.new()
	_view.own_world_3d = true
	_view.transparent_bg = false
	_view.size = Vector2i(340, 300)
	_view.render_target_update_mode = SubViewport.UPDATE_WHEN_VISIBLE
	_view_box.add_child(_view)
	var env := Environment.new()
	env.background_mode = Environment.BG_COLOR
	env.background_color = Color(0.3, 0.34, 0.42)   # 실루엣(거의 검정)이 어두운 판 위에서도 보이게
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.ambient_light_color = Color(0.82, 0.86, 0.95)
	env.ambient_light_energy = 0.9
	var we := WorldEnvironment.new()
	we.environment = env
	_view.add_child(we)
	var sun := DirectionalLight3D.new()
	sun.transform = Transform3D(Basis.from_euler(Vector3(-0.7, 0.5, 0.0)), Vector3.ZERO)
	sun.light_energy = 1.1
	_view.add_child(sun)
	var cam := Camera3D.new()
	cam.position = Vector3(0.0, 1.05, 2.9)
	cam.fov = 40.0
	_view.add_child(cam)
	cam.look_at_from_position(cam.position, Vector3(0.0, 0.85, 0.0))
	_detail_name = Label.new()
	_detail_name.add_theme_font_size_override("font_size", 20)
	side.add_child(_detail_name)
	_detail_text = Label.new()
	_detail_text.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_detail_text.custom_minimum_size = Vector2(340, 0)
	side.add_child(_detail_text)
	var foot := HBoxContainer.new()
	box.add_child(foot)
	var close := Button.new()
	close.text = "닫기 (X·Esc)"
	close.custom_minimum_size = Vector2(160, 40)
	close.pressed.connect(close_screen)
	foot.add_child(close)

func _unhandled_input(event: InputEvent) -> void:
	if event.is_action_pressed("go_codex"):
		toggle()
		get_viewport().set_input_as_handled()
	elif is_open and event is InputEventKey and (event as InputEventKey).pressed and (event as InputEventKey).keycode == KEY_ESCAPE:
		close_screen()
		get_viewport().set_input_as_handled()

func _process(delta: float) -> void:
	if is_open and _model != null:
		_model.rotation.y += SPIN * delta

func toggle() -> void:
	if is_open:
		close_screen()
	else:
		open_screen()

func open_screen() -> bool:
	if is_open:
		return false
	_player = get_tree().get_first_node_in_group("player") as Node3D
	if _player == null or _player.get("frozen"):
		return false
	if get_tree().get_nodes_in_group("duel_active").size() > 0:
		return false
	for g in ["go_world_map", "go_character_screen", "go_cooking_screen", "go_achievements"]:
		var other := get_tree().get_first_node_in_group(g)
		if other and other.get("is_open"):
			return false
	is_open = true
	_panel.visible = true
	add_to_group("ui_modal")
	_frozen_before = bool(_player.get("frozen"))
	_player.set("frozen", true)
	show_tab(tab)
	return true

func close_screen() -> void:
	if not is_open:
		return
	is_open = false
	_panel.visible = false
	remove_from_group("ui_modal")
	_clear_model()
	if _player:
		_player.set("frozen", _frozen_before)

func show_tab(t: String) -> void:
	tab = t
	var heroes := dex_heroes()
	var h_got := 0
	for h: Dictionary in heroes:
		if hero_state(String(h.id)) != "":
			h_got += 1
	var p_got := 0
	for p: Dictionary in Pets.PETS:
		if CodexState.has("pet", String(p.id)):
			p_got += 1
	var labels := {"hero": "인물 %d/%d" % [h_got, heroes.size()], "pet": "신수 %d/%d" % [p_got, Pets.PETS.size()],
		"find": "발견 %d/%d" % [CodexState.count(), CodexState.total()]}
	var keys := ["hero", "pet", "find"]
	for i in keys.size():
		(_tabs.get_child(i) as Button).text = ("▶ " if keys[i] == tab else "") + String(labels[keys[i]])
	_title.text = "도감 — 인물 %d/%d · 신수 %d/%d · 발견 %d/%d" % [h_got, heroes.size(), p_got, Pets.PETS.size(), CodexState.count(), CodexState.total()]
	for c in _grid.get_children():
		_grid.remove_child(c)
		c.queue_free()
	_clear_model()
	_view_box.visible = tab != "find"   # 발견 탭엔 3D 몸이 없다
	_detail_name.text = ""
	_detail_text.text = ""
	if tab == "hero":
		_grid.columns = 4
		var first := ""
		for h: Dictionary in heroes:
			var id := String(h.id)
			var st := hero_state(id)
			var b := _cell("%s %s" % [String(h.emoji), String(h.name)] if st != "" else "???", st)
			b.pressed.connect(func() -> void: select(id))
			_grid.add_child(b)
			if first == "" and st != "":
				first = id
		select(first if first != "" else String((heroes[0] as Dictionary).id))
	elif tab == "pet":
		_grid.columns = 3
		var first := ""
		for p: Dictionary in Pets.PETS:
			var id := String(p.id)
			var got := CodexState.has("pet", id)
			var b := _cell("%s %s" % [String(p.emoji), String(p.name)] if got else "???", "owned" if got else "")
			b.pressed.connect(func() -> void: select(id))
			_grid.add_child(b)
			if first == "" and got:
				first = id
		select(first if first != "" else String((Pets.PETS[0] as Dictionary).id))
	else:
		_grid.columns = 1
		for k: String in KIND_ORDER:
			var row := VBoxContainer.new()
			var lb := Label.new()
			var n := kind_count(k)
			var all := int(CodexState.TOTAL.get(k, 0))
			lb.text = "%s  %d / %d" % [KIND_NAMES[k], n, all]
			lb.add_theme_font_size_override("font_size", 17)
			lb.add_theme_color_override("font_color", Color(1.0, 0.86, 0.5))
			row.add_child(lb)
			var bar := ProgressBar.new()
			bar.max_value = maxi(all, 1)
			bar.value = n
			bar.show_percentage = false
			bar.custom_minimum_size = Vector2(480, 10)
			row.add_child(bar)
			## G-0032 — 이름 목록(Catalog). 지역은 땅마다 묶고, 찾은 것은 이름·못 찾은 것은 ???.
			if k == "place":
				for r: String in Catalog.REGION_ORDER:
					var items: Array = Catalog.places_in(r)
					var got := 0
					for e: Array in items:
						if CodexState.has(k, String(e[0])):
							got += 1
					var rl := Label.new()
					rl.text = "  %s %d/%d" % [Catalog.REGION_NAMES[r], got, items.size()]
					rl.add_theme_color_override("font_color", Color(0.75, 0.85, 1.0))
					row.add_child(rl)
					row.add_child(_name_flow(k, items))
			else:
				row.add_child(_name_flow(k, Catalog.entries(k)))
			_grid.add_child(row)
		_detail_name.text = "발견 %d / %d" % [CodexState.count(), CodexState.total()]
		_detail_text.text = "들판에서 처음 본 것마다 도장이 찍히고 경험치를 받는다.\n찾은 것은 이름이, 아직 못 찾은 것은 ??? 로 보인다."

## 이름 칸 줄(넘치면 다음 줄로) — 칸마다 meta kind·id·found(점검용).
func _name_flow(kind: String, items: Array) -> HFlowContainer:
	var flow := HFlowContainer.new()
	flow.custom_minimum_size = Vector2(500, 0)
	flow.add_theme_constant_override("h_separation", 10)
	for e: Array in items:
		var found := CodexState.has(kind, String(e[0]))
		var l := Label.new()
		l.text = String(e[1]) if found else "???"
		l.add_theme_font_size_override("font_size", 15)
		l.add_theme_color_override("font_color", Color(0.92, 0.92, 0.88) if found else Color(0.45, 0.45, 0.5))
		l.set_meta("codex_kind", kind)
		l.set_meta("codex_id", String(e[0]))
		l.set_meta("found", found)
		flow.add_child(l)
	return flow

func _cell(text: String, state: String) -> Button:
	var b := Button.new()
	b.text = text
	b.custom_minimum_size = Vector2(124, 38)
	b.clip_text = true
	if state == "":
		b.add_theme_color_override("font_color", Color(0.5, 0.5, 0.55))
	elif state == "owned":
		b.add_theme_color_override("font_color", Color(1.0, 0.86, 0.5))
	return b

## 칸 하나를 고른다 — 오른쪽 글과 3D 몸을 그 칸으로.
func select(id: String) -> void:
	selected = id
	_clear_model()
	if tab == "hero":
		var h: Variant = Characters.find(id)
		if h == null:
			return
		var st := hero_state(id)
		var stars := "★".repeat(int(h.rarity))
		if st == "":
			_detail_name.text = "???"
			_detail_text.text = "아직 만나지 못한 인물 (%s)" % String(h.era)
		else:
			_detail_name.text = "%s %s (%s) %s" % [String(h.emoji), String(h.name), String(h.hanja), stars]
			_detail_text.text = "%s · %s — %s\n힘 %d · 지혜 %d · 통솔 %d\n\"%s\"" % [String(h.era), String(h.faction), "영입함" if st == "owned" else "만남",
				int(h.stats.might), int(h.stats.wisdom), int(h.stats.command), String(h.quote)]
		_show_model(VroidBody.build_hero(id, int(h.rarity)), st == "")
	elif tab == "pet":
		var p: Variant = Pets.find(id)
		if p == null:
			return
		var got := CodexState.has("pet", id)
		_detail_name.text = ("%s %s %s" % [String(p.emoji), String(p.name), "★".repeat(int(p.rarity))]) if got else "???"
		_detail_text.text = String(p.desc) if got else "아직 잡지 못한 신수"
		_show_model(CreatureBuilder.build_pet(id, 1.3), not got)

func _show_model(m: Node3D, silhouette: bool) -> void:
	if m == null:
		return
	_model = m
	_view.add_child(m)
	if silhouette:
		var mat := StandardMaterial3D.new()
		mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
		mat.albedo_color = SILHOUETTE
		for mi in m.find_children("*", "MeshInstance3D", true, false):
			(mi as MeshInstance3D).material_override = mat

func _clear_model() -> void:
	if _model != null and is_instance_valid(_model):
		_model.queue_free()
	_model = null

## 점검용 — 지금 미리보기 몸(없으면 null).
func preview_model() -> Node3D:
	return _model
