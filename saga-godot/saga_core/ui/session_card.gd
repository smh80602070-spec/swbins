extends RefCounted

## 표준 B "세션 마무리 카드"(PLAN.md 101-1·101-4) — games/saga_go/ui/
## choice_prompt.gd와 같은 자급자족 패턴(다섯 판 HUD 에 미리 박아 두지
## 않고, 부르는 쪽이 그 자리에서 짓는다). 선택지 없이 "닫기" 하나뿐이라는
## 점만 choice_prompt.gd와 다르다.

## G-0159 — 기준 화면이 가로 1920×1280(orientation_scale.gd)이라 1280×720 창에선 0.56배. 예전 폭 340·기본 16pt·기본 판은
## 약 9px 회색 상자라 못 읽었다(g40_daycard) — choice_prompt.gd 와 같은 진한 판·금 테두리·글자 크기로.
const WIDTH := 600.0
const TITLE_FONT := 30
const LINE_FONT := 26
const BUTTON_FONT := 28
const BUTTON_H := 64.0
const SEP := 10.0

## lines: Array of String — 이번 세션에 쌓인 것을 한 줄씩.
static func show(parent: Node, title_text: String, lines: Array) -> CanvasLayer:
	var layer := CanvasLayer.new()
	layer.layer = 7   # 막는 창 층(choice_prompt 와 같음 — 인물·요리 화면 위)
	layer.add_to_group("ui_modal") # GO 마우스 시점이 커서를 풀어 준다(다른 판엔 영향 없음)
	parent.add_child(layer)

	var panel_h := 36.0 + TITLE_FONT * 1.4 + lines.size() * (LINE_FONT * 1.35 + SEP) + BUTTON_H + SEP * 2
	var panel := PanelContainer.new()
	panel.anchor_left = 0.5
	panel.anchor_right = 0.5
	panel.anchor_top = 0.5
	panel.anchor_bottom = 0.5
	panel.offset_left = -WIDTH * 0.5
	panel.offset_right = WIDTH * 0.5
	panel.offset_top = -panel_h * 0.5
	panel.offset_bottom = panel_h * 0.5
	panel.grow_horizontal = Control.GROW_DIRECTION_BOTH
	panel.grow_vertical = Control.GROW_DIRECTION_BOTH
	var bg := StyleBoxFlat.new()
	bg.bg_color = Color(0.07, 0.06, 0.09, 0.93)
	bg.border_color = Color(0.85, 0.7, 0.4, 0.8)
	bg.set_border_width_all(2)
	bg.set_corner_radius_all(14)
	bg.set_content_margin_all(18)
	panel.add_theme_stylebox_override("panel", bg)
	layer.add_child(panel)

	var vbox := VBoxContainer.new()
	vbox.add_theme_constant_override("separation", int(SEP))
	panel.add_child(vbox)

	var title := Label.new()
	title.text = title_text
	title.autowrap_mode = 3 # TextServer.AUTOWRAP_WORD_SMART
	title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	title.add_theme_font_size_override("font_size", TITLE_FONT)
	title.add_theme_color_override("font_color", Color(1.0, 0.88, 0.6))
	vbox.add_child(title)

	for line in lines:
		var lbl := Label.new()
		lbl.text = String(line)
		lbl.autowrap_mode = 3
		lbl.add_theme_font_size_override("font_size", LINE_FONT)
		vbox.add_child(lbl)

	var btn := Button.new()
	btn.text = "닫기"
	btn.custom_minimum_size = Vector2(0, BUTTON_H)
	btn.add_theme_font_size_override("font_size", BUTTON_FONT)
	btn.pressed.connect(func() -> void:
		CombatFeel.ui()
		layer.queue_free()
	)
	vbox.add_child(btn)

	return layer
