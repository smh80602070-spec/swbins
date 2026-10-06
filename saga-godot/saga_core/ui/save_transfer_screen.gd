extends Node
## 세이브 옮기기 화면 — 다섯 판 공용(G-0035 사가고 화면을 G-0037 에서 옮김). SAGA-BACKLOG P0 #6 최소안: 서버 없이 문자열 하나로 다른 PC·기기로.
##   내보내기 — 지금을 저장(save_call)하고 state.export_string(game_id) 를 칸에 띄우고 클립보드에 복사.
##   불러오기 — 칸(또는 "붙여넣기"로 클립보드)의 문자열을 state.import_string 으로 쓴다. 두 번 눌러야 한다(지금 세이브를 바꾸므로).
##     성공하면 자동 저장을 치우고(옛 상태로 덮지 않게) 장면을 다시 띄운다 — load_before_reload 면 autoload 에 먼저 try_load.
##     지금 세이브는 <세이브 경로>.before_import 로 남는다(save_base.gd).
## 판마다 설정: game_id · state(세이브 autoload, SagaSaveBase) · save_call · group_name. 사가고는 games/saga_go/ui/save_transfer.gd 가 상속해 채운다,
## 네 판은 saga_core/ui/save_transfer_button.gd 가 만든다. 화면·열기/닫기·ui_modal 은 사가고 world/achievements.gd 와 같은 결.

const AUTOSAVE_GROUPS := ["go_autosave", "autosave_timer"]

var game_id := ""
var state: Node = null   # SagaSaveBase(export_string·import_string·save_path)
var save_call := Callable()   # 내보내기 전에 지금을 저장. 비면 안 함(점검이 막을 때도)
var group_name := "save_transfer"
var load_before_reload := false   # 불러온 뒤 장면을 다시 띄우기 전에 state.try_load()

var is_open := false
var status := ""   # 점검용 — 마지막 안내 글
var reload_after := true   # 점검이 끈다(장면을 다시 띄우지 않고 결과만 본다)
var _armed := false
var _player: Node = null
var _frozen_before := false
var _layer: CanvasLayer
var _panel: PanelContainer
var _text: TextEdit
var _status: Label
var _import_btn: Button

func _ready() -> void:
	add_to_group(group_name)
	_build()

func _build() -> void:
	_layer = CanvasLayer.new()
	_layer.layer = 6
	add_child(_layer)
	_panel = PanelContainer.new()
	_panel.anchor_left = 0.5
	_panel.anchor_right = 0.5
	_panel.anchor_top = 0.5
	_panel.anchor_bottom = 0.5
	_panel.offset_left = -360
	_panel.offset_right = 360
	_panel.offset_top = -250
	_panel.offset_bottom = 250
	_panel.visible = false
	var sb := StyleBoxFlat.new()
	sb.bg_color = Color(0.07, 0.07, 0.09, 0.94)
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
	title.text = "세이브 옮기기"
	title.add_theme_font_size_override("font_size", 20)
	title.add_theme_color_override("font_color", Color(1.0, 0.86, 0.5))
	box.add_child(title)
	var help := Label.new()
	var file_name: String = state.call("save_path").get_file() if state != null else "save.json"
	help.text = "내보내기 → 나온 글을 다른 PC 로 옮겨(메신저·메모) → 그쪽에서 붙여넣기 → 불러오기.\n불러오면 그쪽 세이브가 이 글로 바뀐다(바뀌기 전 것은 %s.before_import 로 남는다)." % file_name
	help.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	help.custom_minimum_size = Vector2(680, 0)
	box.add_child(help)
	_text = TextEdit.new()
	_text.custom_minimum_size = Vector2(680, 220)
	_text.wrap_mode = TextEdit.LINE_WRAPPING_BOUNDARY
	_text.placeholder_text = "여기에 세이브 글이 나온다 / 붙여 넣는다"
	box.add_child(_text)
	_status = Label.new()
	_status.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_status.custom_minimum_size = Vector2(680, 0)
	box.add_child(_status)
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 8)
	box.add_child(row)
	for spec in [["내보내기 (복사)", export_now], ["붙여넣기", paste], ["불러오기", import_now], ["닫기 (Esc)", close_screen]]:
		var b := Button.new()
		b.text = String(spec[0])
		b.custom_minimum_size = Vector2(160, 42)
		b.pressed.connect(spec[1])
		row.add_child(b)
		if String(spec[0]) == "불러오기":
			_import_btn = b

func _say(t: String) -> void:
	status = t
	_status.text = t

func export_now() -> String:
	if save_call.is_valid():
		save_call.call()
	var s: String = state.call("export_string", game_id)
	if s == "":
		_say("내보낼 세이브가 없다 — 먼저 한 번 저장하자.")
		return ""
	_text.text = s
	DisplayServer.clipboard_set(s)
	_say("복사했다 (%d자). 다른 PC 의 같은 화면에서 붙여넣기 → 불러오기." % s.length())
	return s

func paste() -> void:
	_text.text = DisplayServer.clipboard_get()
	_disarm()
	_say("붙여 넣었다. 불러오기를 누르면 확인을 한 번 더 묻는다.")

## 첫 번째 누름은 확인만, 두 번째에 바꾼다. 성공이면 true(장면을 다시 띄운다).
func import_now() -> bool:
	var t := _text.text.strip_edges()
	if t == "":
		_say("붙여 넣은 글이 없다.")
		return false
	if not _armed:
		_armed = true
		_import_btn.text = "정말 불러오기"
		_say("지금 세이브가 이 글로 바뀐다. 한 번 더 누르면 불러온다.")
		return false
	_disarm()
	var err: String = state.call("import_string", t, game_id)
	if err != "":
		_say("못 불러왔다 — " + err + ". 지금 세이브는 그대로다.")
		return false
	_say("불러왔다 — 다시 시작한다.")
	for g in AUTOSAVE_GROUPS:
		for auto in get_tree().get_nodes_in_group(g):
			auto.queue_free()   # 다시 띄우기 전에 옛 상태로 덮어쓰지 않게
	if reload_after:
		if load_before_reload and state.has_method("try_load"):
			state.call("try_load")
		get_tree().reload_current_scene.call_deferred()
	return true

func _disarm() -> void:
	_armed = false
	if _import_btn:
		_import_btn.text = "불러오기"

func _unhandled_input(event: InputEvent) -> void:
	if is_open and event is InputEventKey and (event as InputEventKey).pressed and (event as InputEventKey).keycode == KEY_ESCAPE:
		close_screen()
		get_viewport().set_input_as_handled()

## 플레이어가 이미 멈춰 있으면(다른 창이 열림) 안 연다. 플레이어가 없는 판(국지)은 그냥 연다.
func open_screen() -> bool:
	if is_open:
		return false
	_player = get_tree().get_first_node_in_group("player")
	if _player != null and _is_frozen(_player):
		return false
	is_open = true
	_panel.visible = true
	add_to_group("ui_modal")
	if _player != null:
		_frozen_before = _is_frozen(_player)
		_set_frozen(_player, true)
	_disarm()
	_text.text = ""
	_say("")
	return true

func close_screen() -> void:
	if not is_open:
		return
	is_open = false
	_panel.visible = false
	remove_from_group("ui_modal")
	if is_instance_valid(_player):
		_set_frozen(_player, _frozen_before)

## `frozen` 이 있는 플레이어(사가고·숲·블로 공용 player.gd)는 그것, 없으면(스토리) 물리 처리를 끈다.
static func _is_frozen(p: Node) -> bool:
	if "frozen" in p:
		return bool(p.get("frozen"))
	return not p.is_physics_processing()

static func _set_frozen(p: Node, on: bool) -> void:
	if "frozen" in p:
		p.set("frozen", on)
	else:
		p.set_physics_process(not on)
