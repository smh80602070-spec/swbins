extends Node
## G-0035 — 세이브 옮기기 화면(메뉴 → "세이브 옮기기"). SAGA-BACKLOG P0 #6 최소안: 서버 없이 문자열 하나로 다른 PC·기기로.
##   내보내기 — 지금을 저장(SaveState.save)하고 SaveState.export_string("go") 를 칸에 띄우고 클립보드에 복사.
##   불러오기 — 칸(또는 "붙여넣기"로 클립보드)의 문자열을 SaveState.import_string 으로 쓴다. 두 번 눌러야 한다(지금 세이브를 바꾸므로).
##     성공하면 자동 저장을 치우고(옛 상태로 덮지 않게) 장면을 다시 띄운다 — 다시 뜬 마을이 새 세이브를 읽는다.
##     지금 세이브는 user://save.json.before_import 로 남는다(save_base.gd).
## 화면·열기/닫기·ui_modal 은 world/achievements.gd 와 같은 결.

const GAME_ID := "go"

var is_open := false
var status := ""   # 점검용 — 마지막 안내 글
var reload_after := true   # 점검이 끈다(장면을 다시 띄우지 않고 결과만 본다)
var _armed := false
var _player: Node3D = null
var _frozen_before := false
var _layer: CanvasLayer
var _panel: PanelContainer
var _text: TextEdit
var _status: Label
var _import_btn: Button

func _ready() -> void:
	add_to_group("go_save_transfer")
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
	help.text = "내보내기 → 나온 글을 다른 PC 로 옮겨(메신저·메모) → 그쪽에서 붙여넣기 → 불러오기.\n불러오면 그쪽 세이브가 이 글로 바뀐다(바뀌기 전 것은 save.json.before_import 로 남는다)."
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
	SaveState.save()
	var s: String = SaveState.export_string(GAME_ID)
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
	var err: String = SaveState.import_string(t, GAME_ID)
	if err != "":
		_say("못 불러왔다 — " + err + ". 지금 세이브는 그대로다.")
		return false
	_say("불러왔다 — 다시 시작한다.")
	var auto := get_tree().get_first_node_in_group("go_autosave")
	if auto != null:
		auto.queue_free()   # 다시 띄우기 전에 옛 상태로 덮어쓰지 않게
	if reload_after:
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

func open_screen() -> bool:
	if is_open:
		return false
	_player = get_tree().get_first_node_in_group("player") as Node3D
	if _player == null or _player.get("frozen"):
		return false
	is_open = true
	_panel.visible = true
	add_to_group("ui_modal")
	_frozen_before = bool(_player.get("frozen"))
	_player.set("frozen", true)
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
	if _player:
		_player.set("frozen", _frozen_before)
