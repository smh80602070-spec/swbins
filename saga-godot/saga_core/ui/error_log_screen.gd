extends Node
## G-0068 — 오류 기록 창(다섯 판 공용). 화질 설정 창(graphics_menu.gd) 셋째 줄이 연다.
## 글 칸(읽기 전용, error_log.gd report()) · "복사"(클립보드) · "닫기". 열려 있는 동안 ui_modal 그룹(사가만리 마우스 시점이 커서를 풀어 준다).

const ErrorLog := preload("res://saga_core/data/error_log.gd")

var is_open := false
var text := ""   # 점검용
var _layer: CanvasLayer = null


func open_screen() -> bool:
	if is_open:
		return true
	text = ErrorLog.report()
	_layer = CanvasLayer.new()
	_layer.layer = 8
	_layer.add_to_group("ui_modal")
	add_child(_layer)
	var panel := PanelContainer.new()
	panel.anchor_left = 0.5
	panel.anchor_right = 0.5
	panel.anchor_top = 0.5
	panel.anchor_bottom = 0.5
	panel.offset_left = -560
	panel.offset_right = 560
	panel.offset_top = -420
	panel.offset_bottom = 420
	var bg := StyleBoxFlat.new()
	bg.bg_color = Color(0.07, 0.06, 0.09, 0.95)
	bg.border_color = Color(0.85, 0.7, 0.4, 0.8)
	bg.set_border_width_all(2)
	bg.set_corner_radius_all(14)
	bg.set_content_margin_all(18)
	panel.add_theme_stylebox_override("panel", bg)
	_layer.add_child(panel)
	var box := VBoxContainer.new()
	box.add_theme_constant_override("separation", 12)
	panel.add_child(box)
	var title := Label.new()
	title.text = "오류 기록 — 멈춤·이상할 때 복사해 보내 주세요"
	title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	title.add_theme_font_size_override("font_size", 30)
	title.add_theme_color_override("font_color", Color(1.0, 0.88, 0.6))
	box.add_child(title)
	var body := TextEdit.new()
	body.name = "Body"
	body.text = text
	body.editable = false
	body.wrap_mode = TextEdit.LINE_WRAPPING_BOUNDARY
	body.size_flags_vertical = Control.SIZE_EXPAND_FILL
	body.add_theme_font_size_override("font_size", 20)
	box.add_child(body)
	var row := HBoxContainer.new()
	row.alignment = BoxContainer.ALIGNMENT_CENTER
	row.add_theme_constant_override("separation", 20)
	box.add_child(row)
	var copy := Button.new()
	copy.name = "CopyButton"
	copy.text = "복사"
	copy.custom_minimum_size = Vector2(220, 64)
	copy.add_theme_font_size_override("font_size", 26)
	copy.pressed.connect(func() -> void:
		DisplayServer.clipboard_set(text)
		copy.text = "복사됨 ✓")
	row.add_child(copy)
	var close := Button.new()
	close.name = "CloseButton"
	close.text = "닫기"
	close.custom_minimum_size = Vector2(220, 64)
	close.add_theme_font_size_override("font_size", 26)
	close.pressed.connect(close_screen)
	row.add_child(close)
	is_open = true
	return true


func close_screen() -> void:
	if _layer != null:
		_layer.queue_free()
		_layer = null
	is_open = false
