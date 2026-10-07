extends CanvasLayer
## G-0086 — 이야기 대화 창(다섯 판 공용). 사가나락·사가마을 장 엔진(games/<판>/world/scenario_runner.gd)이 부른다.
##   TalkBox.open(부모, 제목, 줄들, 끝 콜백, 고르기)
##     줄들   [[말한 이 표시 이름, 말], …]
##     끝     func(답: String) — 끝 줄 뒤 닫힐 때(고르기가 있으면 고른 key, 없으면 "")
##     고르기 {"prompt": 물음, "options": [{"key", "label"}, …]} — 끝 줄에서 "다음" 대신 단추로
## 열린 동안 게임을 멈춘다(이미 멈춰 있었으면 그대로 두고 닫을 때도 안 푼다). ui_modal 그룹(다른 선택 창과 겹치지 않게).
## Space·Enter 는 맨 앞 단추(포커스)를 누른다.

var _title := ""
var _lines: Array = []
var _choice: Dictionary = {}
var _on_done: Callable
var _i := 0
var _paused_by_me := false
var _name_label: Label
var _text_label: Label
var _buttons: HBoxContainer


static func open(parent: Node, title: String, lines: Array, on_done: Callable, choice: Dictionary = {}) -> CanvasLayer:
	var box: CanvasLayer = load("res://saga_core/ui/talk_box.gd").new()
	box.set("_title", title)
	box.set("_lines", lines)
	box.set("_on_done", on_done)
	box.set("_choice", choice)
	parent.add_child(box)
	return box


func _ready() -> void:
	name = "TalkBox"
	layer = 40
	process_mode = Node.PROCESS_MODE_ALWAYS
	add_to_group("ui_modal")
	_build()
	if not get_tree().paused:
		get_tree().paused = true
		_paused_by_me = true
	_show()


func _build() -> void:
	var panel := PanelContainer.new()
	panel.anchor_left = 0.05
	panel.anchor_right = 0.95
	panel.anchor_top = 0.7
	panel.anchor_bottom = 0.96
	var box := StyleBoxFlat.new()
	box.bg_color = Color(0.06, 0.05, 0.08, 0.92)
	box.border_color = Color(0.85, 0.7, 0.4)
	box.set_border_width_all(2)
	box.set_corner_radius_all(10)
	box.set_content_margin_all(18)
	panel.add_theme_stylebox_override("panel", box)
	var v := VBoxContainer.new()
	v.add_theme_constant_override("separation", 8)
	var title := Label.new()
	title.text = _title
	title.add_theme_font_size_override("font_size", 20)
	title.add_theme_color_override("font_color", Color(0.85, 0.7, 0.4))
	v.add_child(title)
	_name_label = Label.new()
	_name_label.add_theme_font_size_override("font_size", 28)
	_name_label.add_theme_color_override("font_color", Color(1.0, 0.92, 0.7))
	v.add_child(_name_label)
	_text_label = Label.new()
	_text_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_text_label.size_flags_vertical = Control.SIZE_EXPAND_FILL
	_text_label.add_theme_font_size_override("font_size", 27)
	v.add_child(_text_label)
	_buttons = HBoxContainer.new()
	_buttons.alignment = BoxContainer.ALIGNMENT_END
	_buttons.add_theme_constant_override("separation", 12)
	v.add_child(_buttons)
	panel.add_child(v)
	add_child(panel)


func _button(text: String, cb: Callable) -> Button:
	var b := Button.new()
	b.text = text
	b.custom_minimum_size = Vector2(150, 48)
	b.add_theme_font_size_override("font_size", 24)
	b.pressed.connect(cb)
	_buttons.add_child(b)
	return b


func _show() -> void:
	var line: Array = _lines[_i] if _i < _lines.size() else ["", ""]
	_name_label.text = String(line[0])
	_text_label.text = String(line[1])
	for c in _buttons.get_children():
		c.queue_free()
	var last := _i >= _lines.size() - 1
	if last and not _choice.is_empty():
		if String(_choice.get("prompt", "")) != "":
			_text_label.text += "\n\n▶ " + String(_choice.prompt)
		var first: Button = null
		for o: Dictionary in _choice.get("options", []):
			var b := _button(String(o.label), pick.bind(String(o.key)))
			if first == null:
				first = b
		if first != null:
			first.grab_focus()
	else:
		_button("닫기 ✓" if last else "다음 ▶", next_line).grab_focus()


## 다음 줄(끝 줄이면 닫음 — 고르기가 있으면 pick 으로만 닫힌다).
func next_line() -> void:
	if _i >= _lines.size() - 1:
		if _choice.is_empty():
			_close("")
		return
	_i += 1
	_show()


## 고르기 답(끝 줄에서).
func pick(key: String) -> void:
	_close(key)


func is_last_line() -> bool:
	return _i >= _lines.size() - 1


func _close(answer: String) -> void:
	if _paused_by_me:
		get_tree().paused = false
		_paused_by_me = false
	remove_from_group("ui_modal")
	queue_free()
	if _on_done.is_valid():
		_on_done.call(answer)
