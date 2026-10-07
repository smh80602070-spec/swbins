extends Node
## G-0064 사가마을 관계 하트 줄(villager_builder.gd _add_heart_row) — scene_probe_host 로 돈다(오토로드 필요).
## ① 하트 10칸 ② 친밀도 3 → 채움 3·빔 7 ③ 줄 아래 끝 ≤ 선택 창 패널 위 끝(겹치지 않음, G-0052 뒤 회귀) ④ 0·10 끝값 ⑤ 하트 40px.

const Villager := preload("res://games/saga_forest/world/villager_builder.gd")
const ChoicePrompt := preload("res://saga_core/ui/choice_prompt.gd")

var fails := 0


func _fail(msg: String) -> void:
	fails += 1
	print("  FAIL ", msg)


func _row(heart: int, n_choices: int) -> Dictionary:
	var choices: Array = []
	for i in n_choices:
		choices.append({"label": "고르기 %d" % i, "cb": func() -> void: pass})
	var layer := ChoicePrompt.build(self, "숲지기", choices)
	Villager._add_heart_row(layer, heart)
	var row := layer.find_child("HeartRow", true, false) as HBoxContainer
	var panel: PanelContainer = null
	for c in layer.get_children():
		if c is PanelContainer:
			panel = c
	var out := {"row": row, "panel": panel, "layer": layer}
	return out


func run() -> int:
	for case in [[3, 5], [0, 2], [10, 7]]:
		var r := _row(case[0], case[1])
		var row: HBoxContainer = r.row
		if row == null or row.get_child_count() != 10:
			_fail("하트 10칸이 아님 (%s)" % [case])
			continue
		var filled := 0
		for t in row.get_children():
			if (t as TextureRect).texture == Villager.HEART_ICON_FILLED:
				filled += 1
		if filled != int(case[0]):
			_fail("친밀도 %d → 채움 %d" % [case[0], filled])
		var panel: PanelContainer = r.panel
		if panel == null or row.offset_bottom > panel.offset_top:
			_fail("하트 줄이 패널과 겹침 row_bottom=%s panel_top=%s" % [row.offset_bottom, panel.offset_top if panel else "?"])
		if (row.get_child(0) as TextureRect).custom_minimum_size.x < 40.0:
			_fail("하트가 작음")
		(r.layer as CanvasLayer).queue_free()
	return fails
