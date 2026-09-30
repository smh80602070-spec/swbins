extends RefCounted

## 사건 선택지 패널(예: "맞선다/값을 치른다/달아난다", "맡는다/사양한다")을
## 세우는 공용 헬퍼. bandit_encounter.gd(전투 사건 조우)와 npc_builder.gd
## (퀘스트 제안)가 같은 모양의 패널을 쓰게 되면서 뽑았다 — 웹판 event.js가
## 모든 사건 선택지를 한 패널로 그리는 것과 같은 경계.

## choices: Array of {"label": String, "cb": Callable}
static func build(parent: Node, title_text: String, choices: Array) -> CanvasLayer:
	var layer := CanvasLayer.new()
	## 106장 ⑧ — 창이 열려 있는 동안 GO 마우스 시점이 커서를 풀어 준다(camera_rig.gd).
	layer.add_to_group("ui_modal")
	parent.add_child(layer)

	var panel := PanelContainer.new()
	panel.anchor_left = 0.5
	panel.anchor_right = 0.5
	panel.anchor_top = 0.5
	panel.anchor_bottom = 0.5
	panel.offset_left = -190.0
	panel.offset_right = 190.0
	panel.offset_top = -120.0
	panel.offset_bottom = -120.0 + 90.0 + choices.size() * 54.0
	layer.add_child(panel)

	var vbox := VBoxContainer.new()
	vbox.add_theme_constant_override("separation", 10)
	panel.add_child(vbox)

	var title := Label.new()
	title.text = title_text
	title.autowrap_mode = 3 # TextServer.AUTOWRAP_WORD_SMART
	vbox.add_child(title)

	for c in choices:
		var b := Button.new()
		b.text = c.label
		b.custom_minimum_size = Vector2(0, 44)
		b.pressed.connect(c.cb)
		vbox.add_child(b)

	return layer
