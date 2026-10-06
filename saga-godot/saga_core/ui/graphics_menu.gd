extends Node

## G-0054 — "화질/성능" 고르기 창. 네 판 HUD 단추(graphics_button.gd)와 사가고 메뉴 항목(그룹 go_graphics)이 open_screen 으로 연다.
## 공용 선택 창 두 줄 — 지금 고른 쪽엔 "(지금)".

const ChoicePrompt := preload("res://saga_core/ui/choice_prompt.gd")
const Gfx := preload("res://saga_core/data/graphics_settings.gd")

signal changed


func open_screen() -> bool:
	var box := {}
	var cur := Gfx.mode()
	var choices: Array = [
		{"label": "화질 — 그림자·빛 다 켜기%s" % (" (지금)" if cur == Gfx.QUALITY else ""),
		 "cb": func() -> void: _pick(Gfx.QUALITY, box)},
		{"label": "성능 — 30fps·해상도 낮춤·빛 효과 끔(폰 발열·배터리)%s" % (" (지금)" if cur == Gfx.PERFORMANCE else ""),
		 "cb": func() -> void: _pick(Gfx.PERFORMANCE, box)},
	]
	box["layer"] = ChoicePrompt.build(self, "화질 설정", choices)
	return true


func _pick(m: String, box: Dictionary) -> void:
	(box["layer"] as CanvasLayer).queue_free()
	Gfx.set_mode(m, get_tree())
	changed.emit()
