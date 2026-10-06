extends RefCounted

## 사건 선택지 패널(예: "맞선다/값을 치른다/달아난다", "맡는다/사양한다")을
## 세우는 공용 헬퍼. bandit_encounter.gd(전투 사건 조우)와 npc_builder.gd
## (퀘스트 제안)가 같은 모양의 패널을 쓰게 되면서 뽑았다 — 웹판 event.js가
## 모든 사건 선택지를 한 패널로 그리는 것과 같은 경계.

## G-0052 — 기준 화면이 가로 1920×1280(orientation_scale.gd)이라 1280×720 창에선 0.56배. 기본 글씨 16·폭 380 은
## 9px 로 찍혀 못 읽었다(G-0050 촬영) — 다른 HUD(목표판 22)보다 크게 잡고, 판을 진하게, 긴 글은 줄바꿈.
const WIDTH := 760.0
const TITLE_FONT := 32
const BUTTON_FONT := 28
const BUTTON_H := 72.0
const SEP := 12.0
const MAX_SCREEN_FRAC := 0.85 # 단추 줄이 화면 높이의 이만큼을 넘으면 스크롤


## choices: Array of {"label": String, "cb": Callable}
static func build(parent: Node, title_text: String, choices: Array) -> CanvasLayer:
	var layer := CanvasLayer.new()
	## 고를 때까지 막는 창이라 인물·요리 화면(layer 6) 위에 — 기본 1 이면 화면 뒤에 숨는다(10-06 눈 확인).
	layer.layer = 7
	## 106장 ⑧ — 창이 열려 있는 동안 GO 마우스 시점이 커서를 풀어 준다(camera_rig.gd).
	layer.add_to_group("ui_modal")
	parent.add_child(layer)

	## 부모가 아직 트리 밖이면 뷰포트가 없다 — 가로 기준 높이 1280 으로 셈한다.
	var vp := parent.get_viewport()
	var screen_h := vp.get_visible_rect().size.y if vp != null else 1280.0
	var list_h := choices.size() * (BUTTON_H + SEP)
	var scroll_h := minf(list_h, screen_h * MAX_SCREEN_FRAC - 120.0)
	var panel_h := 90.0 + scroll_h

	var panel := PanelContainer.new()
	panel.anchor_left = 0.5
	panel.anchor_right = 0.5
	panel.anchor_top = 0.5
	panel.anchor_bottom = 0.5
	panel.offset_left = -WIDTH * 0.5
	panel.offset_right = WIDTH * 0.5
	panel.offset_top = -panel_h * 0.5
	panel.offset_bottom = panel_h * 0.5
	## 줄바꿈으로 키가 더 크면 가운데에서 위아래로 같이 자란다(예전엔 왼쪽 위가 고정이라 오른쪽·아래로만 밀렸다).
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
	title.add_theme_color_override("font_outline_color", Color(0, 0, 0))
	title.add_theme_constant_override("outline_size", 6)
	vbox.add_child(title)

	## 단추 줄이 화면에 다 안 들어가면 스크롤 안에 — 점검들은 find_children 으로 단추를 찾아 구조에 안 기댄다.
	var list: VBoxContainer = vbox
	if list_h > scroll_h:
		var sc := ScrollContainer.new()
		sc.custom_minimum_size = Vector2(0, scroll_h)
		sc.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
		vbox.add_child(sc)
		list = VBoxContainer.new()
		list.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		list.add_theme_constant_override("separation", int(SEP))
		sc.add_child(list)

	for c in choices:
		var b := Button.new()
		b.text = c.label
		b.custom_minimum_size = Vector2(0, BUTTON_H)
		b.autowrap_mode = 3 # TextServer.AUTOWRAP_WORD_SMART — 긴 명령 설명이 판을 옆으로 밀지 않게
		b.add_theme_font_size_override("font_size", BUTTON_FONT)
		## 기본 단추 바탕은 진한 판에 묻혀 글만 떠 보였다(G-0052 촬영) — 판보다 밝은 칸 + 금빛 테(올림·누름).
		b.add_theme_stylebox_override("normal", _button_box(Color(0.2, 0.18, 0.25), Color(0.45, 0.4, 0.5)))
		b.add_theme_stylebox_override("hover", _button_box(Color(0.28, 0.25, 0.33), Color(0.95, 0.8, 0.45)))
		b.add_theme_stylebox_override("focus", _button_box(Color(0.28, 0.25, 0.33), Color(0.95, 0.8, 0.45)))
		b.add_theme_stylebox_override("pressed", _button_box(Color(0.4, 0.33, 0.18), Color(1.0, 0.85, 0.5)))
		b.pressed.connect(c.cb)
		list.add_child(b)

	return layer


static func _button_box(bg: Color, border: Color) -> StyleBoxFlat:
	var sb := StyleBoxFlat.new()
	sb.bg_color = bg
	sb.border_color = border
	sb.set_border_width_all(2)
	sb.set_corner_radius_all(10)
	sb.content_margin_left = 14
	sb.content_margin_right = 14
	sb.content_margin_top = 6
	sb.content_margin_bottom = 6
	return sb
