extends RefCounted

## 화면 위쪽에 잠깐 뜨는 한 마디(NPC 대사·사건 결과 토스트 등)를 보여주는
## 공용 헬퍼. bandit_encounter.gd·simple_event.gd·npc_builder.gd 세 곳이
## 각자 dialogue_label 그룹을 찾아 text를 얹고 몇 초 뒤 숨기는 같은 코드를
## 따로 두고 있던 걸 choice_prompt.gd와 같은 이유로 하나로 뽑았다.

static func show(node: Node, text: String, show_sec: float) -> void:
	var labels := node.get_tree().get_nodes_in_group("dialogue_label")
	if labels.is_empty():
		return
	var label: Label = labels[0]
	## 102-7 "UI 폰트·패널 불일치" — dialogue_panel 그룹이 있는 씬에서만
	## 9-slice 배경을 같이 켜고 끈다. 없는 씬(그룹 비어있음)은 그대로 label만.
	var panels := node.get_tree().get_nodes_in_group("dialogue_panel")
	label.text = text
	label.show()
	for panel in panels:
		panel.show()
	## G-0299 — 타이머를 글자 칸 자식으로: 장면이 바뀌어 칸이 지워지면 타이머도 같이 사라진다(전엔 SceneTree 타이머 람다가
	## 지워진 칸을 붙잡아 "Lambda capture was freed" 오류 — 4종횡 문에서 K 를 바로 누를 때). 멈춤 중에도 도는 건 그대로.
	var t := Timer.new()
	t.one_shot = true
	t.wait_time = maxf(show_sec, 0.01)
	t.process_mode = Node.PROCESS_MODE_ALWAYS
	label.add_child(t)
	t.start()
	t.timeout.connect(t.queue_free)
	t.timeout.connect(func() -> void:
		if is_instance_valid(label) and label.text == text:
			label.hide()
			for panel in panels:
				if is_instance_valid(panel):
					panel.hide()
	)
