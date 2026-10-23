extends CanvasLayer

## G-0339 보스 등장 띠(다섯 판 공용) — 가운데 큰 이름 + 아랫줄(원소·Lv·패턴 등), 0.3초 나타남 · HOLD_SEC 머묾 · 0.4초 사라짐, 그리고 스스로 지운다.
## 처음엔 1만리 등장 컷(games/saga_go/ui/boss_intro.gd G-0338) 안에 있었다 → 2나락 우두머리·4종횡 사냥터 보스도 같은 띠.
## 카메라는 판마다 따로(1만리만 어깨 너머 구도) — 이 파일은 띠만. SAGA_BOSS_INTRO=0 이면 안 뜬다(판 연출도 같이 끔).

const HOLD_SEC := 1.4
const NAME_FONT := 54
const SUB_FONT := 24
const IN_SEC := 0.3
const OUT_SEC := 0.4

static var shown := 0   # 점검용 — 몇 번 띄웠나


static func on() -> bool:
	return OS.get_environment("SAGA_BOSS_INTRO") != "0"


## host 아래에 띠 하나 — 꺼져 있으면 null
static func pop(host: Node, title: String, sub: String = "", tint: Color = Color(1.0, 0.9, 0.7)) -> CanvasLayer:
	if not on() or host == null or not host.is_inside_tree():
		return null
	var n: CanvasLayer = load("res://saga_core/ui/boss_banner.gd").new()
	n.name = "BossBanner"
	host.add_child(n)
	n.call("_build", title, sub, tint)
	shown += 1
	return n


func _build(title: String, sub: String, tint: Color) -> void:
	layer = 6
	var panel := PanelContainer.new()   # 반투명 검은 바탕 — 밝은 보스 몸·하늘 위에서도 읽히게(촬영: 바탕 없으면 노란 몸 위 글자가 묻힘)
	var band := StyleBoxFlat.new()
	band.bg_color = Color(0, 0, 0, 0.5)
	band.set_corner_radius_all(12)
	band.content_margin_left = 36.0
	band.content_margin_right = 36.0
	band.content_margin_top = 8.0
	band.content_margin_bottom = 10.0
	panel.add_theme_stylebox_override("panel", band)
	panel.set_anchors_preset(Control.PRESET_CENTER)
	panel.anchor_top = 0.38
	panel.anchor_bottom = 0.38
	panel.grow_horizontal = Control.GROW_DIRECTION_BOTH
	panel.grow_vertical = Control.GROW_DIRECTION_BOTH
	panel.mouse_filter = Control.MOUSE_FILTER_IGNORE
	panel.modulate.a = 0.0
	add_child(panel)
	var box := VBoxContainer.new()
	box.alignment = BoxContainer.ALIGNMENT_CENTER
	box.mouse_filter = Control.MOUSE_FILTER_IGNORE
	panel.add_child(box)
	box.add_child(_label(title, NAME_FONT, Color(1.0, 0.93, 0.78), 6))
	if sub != "":
		box.add_child(_label(sub, SUB_FONT, tint.lerp(Color.WHITE, 0.35), 4))
	var tw := create_tween()
	tw.tween_property(panel, "modulate:a", 1.0, IN_SEC)
	tw.tween_interval(HOLD_SEC)
	tw.tween_property(panel, "modulate:a", 0.0, OUT_SEC)
	tw.tween_callback(queue_free)


func _label(t: String, size: int, col: Color, outline: int) -> Label:
	var l := Label.new()
	l.text = t
	l.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	l.add_theme_font_size_override("font_size", size)
	l.add_theme_color_override("font_color", col)
	l.add_theme_color_override("font_outline_color", Color(0, 0, 0, 1))
	l.add_theme_constant_override("outline_size", outline)
	l.mouse_filter = Control.MOUSE_FILTER_IGNORE
	return l
