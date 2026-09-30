extends Node

## 도움말·첫 걸음 안내 (2026-09-30) — 표는 data/help.gd, 본 안내 기록은 PartyState.tips. test_village.gd 가 붙인다.
##   F1(왼쪽 위 "도움말" 단추) → 갈래(이동·싸움·화면·성장) 탭이 있는 도움말 창. 열려 있는 동안 플레이어는 얼음.
##   첫 걸음 안내 — 조건이 처음 맞을 때 화면 아래에 한 줄(4.5초)을 띄우고 기록한다(다시는 안 띄운다). 여럿이 겹치면 줄을 세워 하나씩.
##   tip(id) 를 그룹 "go_help" 로 부르면 그 안내를 (안 봤으면) 세운다 — 상자 등이 부른다.

signal tip_shown(id: String)

const Help := preload("res://games/saga_go/data/help.gd")
const Cycle := preload("res://games/saga_go/data/cycle.gd")
const Adventure := preload("res://games/saga_go/data/adventure.gd")
const Mounts := preload("res://games/saga_go/data/mounts.gd")

const START_SEC := 6.0
const SHOW_SEC := 4.5
const GAP_SEC := 1.5
const POLL_SEC := 1.0

var is_open := false
var tab := 0
var shown: Array[String] = [] # 이번 실행에 띄운 것(점검용)

var _player: Node3D
var _t := 0.0
var _poll := 0.0
var _queue: Array[String] = []
var _busy := 0.0
var _frozen_before := false
var _layer: CanvasLayer
var _panel: PanelContainer
var _tabs: HBoxContainer
var _body: VBoxContainer
var _banner: PanelContainer
var _banner_label: Label
var _btn: Button


func _ready() -> void:
	add_to_group("go_help")
	if not InputMap.has_action("go_help"):
		InputMap.add_action("go_help")
		var ev := InputEventKey.new()
		ev.physical_keycode = KEY_F1
		InputMap.action_add_event("go_help", ev)
	_build()
	_hook_signals.call_deferred()


func _hook_signals() -> void:
	var eggs := get_tree().get_first_node_in_group("go_eggs")
	if eggs != null and eggs.has_signal("egg_gained"):
		eggs.connect("egg_gained", func(_t: String) -> void: tip("egg_got"))


## 안 본 안내면 줄에 세운다.
func tip(id: String) -> void:
	if not Help.TIPS.has(id) or Help.seen(id) or _queue.has(id):
		return
	_queue.append(id)


func _physics_process(delta: float) -> void:
	_t += delta
	if _player == null or not is_instance_valid(_player):
		_player = get_tree().get_first_node_in_group("player") as Node3D
	_btn.visible = not is_open and _player != null and not bool(_player.get("frozen")) and not get_tree().has_group("go_hud_menu")
	_busy = maxf(_busy - delta, 0.0)
	if _busy <= 0.0 and _banner.visible:
		_banner.visible = false
	_poll += delta
	if _poll >= POLL_SEC and _player != null:
		_poll = 0.0
		_check_conditions()
	if _busy <= 0.0 and not _queue.is_empty() and not is_open and _player != null and not bool(_player.get("frozen")):
		_show(_queue.pop_front())


func _check_conditions() -> void:
	if _t >= START_SEC and int(PartyState.story.get("ch", 0)) == 0 and int(PartyState.story.get("step", 0)) == 0:
		tip("start")
	var yard := get_tree().get_first_node_in_group("go_homestead")
	if yard != null and bool(yard.call("near")):
		tip("yard")
	if Mounts.unlocked(int(PartyState.story.get("ch", 0))).size() > 0:
		tip("mount")
	if Adventure.world_level() >= 1:
		tip("world_level")
	if Cycle.story_done():
		tip("sail")


func _show(id: String) -> void:
	Help.mark(id)
	shown.append(id)
	_banner_label.text = "💡 " + Help.tip(id)
	_banner.visible = true
	_busy = SHOW_SEC + GAP_SEC
	tip_shown.emit(id)


# ---------------------------------------------------------------- 화면

func _unhandled_input(event: InputEvent) -> void:
	if event.is_action_pressed("go_help"):
		if is_open:
			close_screen()
		else:
			open_screen()
		get_viewport().set_input_as_handled()
	elif is_open and event is InputEventKey and (event as InputEventKey).pressed and (event as InputEventKey).keycode == KEY_ESCAPE:
		close_screen()
		get_viewport().set_input_as_handled()


func open_screen() -> bool:
	if is_open or _player == null or _player.get("frozen"):
		return false
	if get_tree().get_nodes_in_group("duel_active").size() > 0:
		return false
	is_open = true
	_panel.visible = true
	_frozen_before = bool(_player.get("frozen"))
	_player.set("frozen", true)
	_refresh()
	return true


func close_screen() -> void:
	if not is_open:
		return
	is_open = false
	_panel.visible = false
	if _player:
		_player.set("frozen", _frozen_before)


func _build() -> void:
	_layer = CanvasLayer.new()
	_layer.layer = 8
	add_child(_layer)
	_btn = Button.new()
	_btn.text = "도움말 (F1)"
	## 화면 기준 크기(1920×1280, orientation_scale)에 맞춘 값 — 왼쪽 위 단추 줄(인물·요리·의뢰·임무·업적) 바로 오른쪽.
	_btn.offset_left = 760
	_btn.offset_right = 930
	_btn.offset_top = 21
	_btn.offset_bottom = 61
	_btn.add_theme_font_size_override("font_size", 15)
	_btn.visible = false
	_btn.pressed.connect(func() -> void: open_screen())
	_layer.add_child(_btn)
	_banner = PanelContainer.new()
	_banner.anchor_left = 0.5
	_banner.anchor_right = 0.5
	_banner.anchor_top = 1.0
	_banner.anchor_bottom = 1.0
	_banner.offset_left = -340
	_banner.offset_right = 340
	_banner.offset_top = -140
	_banner.offset_bottom = -90
	_banner.visible = false
	var bs := StyleBoxFlat.new()
	bs.bg_color = Color(0.1, 0.13, 0.2, 0.92)
	bs.border_color = Color(1.0, 0.86, 0.5, 0.9)
	bs.set_border_width_all(1)
	bs.set_corner_radius_all(8)
	bs.content_margin_left = 14
	bs.content_margin_right = 14
	bs.content_margin_top = 8
	bs.content_margin_bottom = 8
	_banner.add_theme_stylebox_override("panel", bs)
	_layer.add_child(_banner)
	_banner_label = Label.new()
	_banner_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_banner_label.add_theme_font_size_override("font_size", 15)
	_banner.add_child(_banner_label)
	_panel = PanelContainer.new()
	_panel.anchor_left = 0.5
	_panel.anchor_right = 0.5
	_panel.anchor_top = 0.5
	_panel.anchor_bottom = 0.5
	_panel.offset_left = -400
	_panel.offset_right = 400
	_panel.offset_top = -300
	_panel.offset_bottom = 300
	_panel.visible = false
	var sb := StyleBoxFlat.new()
	sb.bg_color = Color(0.07, 0.07, 0.1, 0.95)
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
	var title := Label.new()
	title.text = "📖 도움말"
	title.add_theme_font_size_override("font_size", 20)
	title.add_theme_color_override("font_color", Color(1.0, 0.86, 0.5))
	box.add_child(title)
	_tabs = HBoxContainer.new()
	box.add_child(_tabs)
	var scroll := ScrollContainer.new()
	scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	scroll.custom_minimum_size = Vector2(0, 440)
	box.add_child(scroll)
	_body = VBoxContainer.new()
	_body.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_body.add_theme_constant_override("separation", 6)
	scroll.add_child(_body)
	var row := HBoxContainer.new()
	box.add_child(row)
	var replay := Button.new()
	replay.text = "첫 걸음 안내 다시 보기"
	replay.pressed.connect(func() -> void:
		PartyState.tips = []
		_queue.clear()
		close_screen())
	row.add_child(replay)
	var close := Button.new()
	close.text = "닫기 (F1)"
	close.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	close.pressed.connect(close_screen)
	row.add_child(close)


func _refresh() -> void:
	for c in _tabs.get_children():
		c.queue_free()
	for c in _body.get_children():
		c.queue_free()
	for i in Help.SECTIONS.size():
		var b := Button.new()
		b.text = ("▶ " if i == tab else "") + String(Help.SECTIONS[i].name)
		b.custom_minimum_size = Vector2(110, 34)
		var idx := i
		b.pressed.connect(func() -> void:
			tab = idx
			_refresh())
		_tabs.add_child(b)
	for line in Help.SECTIONS[tab].lines:
		var row := HBoxContainer.new()
		row.add_theme_constant_override("separation", 14)
		_body.add_child(row)
		var k := Label.new()
		k.text = String(line[0])
		k.custom_minimum_size = Vector2(210, 0)
		k.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		k.add_theme_font_size_override("font_size", 15)
		k.add_theme_color_override("font_color", Color(1.0, 0.9, 0.6))
		row.add_child(k)
		var d := Label.new()
		d.text = String(line[1])
		d.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		d.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		d.add_theme_font_size_override("font_size", 15)
		row.add_child(d)
