extends Button

## G-0234 기술 나무 입구 — HUD 단추 「📜 연구」(오른쪽 줄 맨 위). 공용 선택 창에 갈래 넷(마디 ●○·다음 마디·값·효과)·닫기.
## 갈래 줄을 누르면 그 갈래 다음 마디를 산다(모자라면 까닭 알림) — 창은 다시 열려 바뀐 점을 보여 준다.

const ChoicePrompt := preload("res://saga_core/ui/choice_prompt.gd")
const Toast := preload("res://saga_core/ui/toast.gd")
const Tech := preload("res://games/saga_realm/data/realm_tech.gd")

var _layer: CanvasLayer = null


func _ready() -> void:
	text = "📜 연구"
	focus_mode = Control.FOCUS_NONE
	add_to_group("realm_tech")
	pressed.connect(open_screen)


func scholars() -> int:
	var n := 0
	for oid in RealmSaveState.roster:
		if RealmSaveState._effective_stat(String(oid), "wisdom") >= float(Tech.SCHOLAR_WIS):
			n += 1
	return mini(n, Tech.SCHOLAR_MAX)


func _close() -> void:
	if _layer != null and is_instance_valid(_layer):
		_layer.queue_free()
	_layer = null


func _line(b: Dictionary) -> String:
	var n := Tech.done_count(String(b.key))
	var dots := ""
	for i in (b.nodes as Array).size():
		dots += "●" if i < n else "○"
	var nd := Tech.next_of(String(b.key))
	var tail := "다 연구했다" if nd.is_empty() else "다음: %s — %s (%d점)" % [nd.name, nd.desc, int(nd.pts)]
	return "%s %s %s %d/%d\n%s" % [b.emoji, b.name, dots, n, (b.nodes as Array).size(), tail]


func open_screen() -> bool:
	_close()
	var st := Tech.state()
	var choices: Array = []
	for b: Dictionary in Tech.BRANCHES:
		var key := String(b.key)
		choices.append({"label": _line(b), "cb": func() -> void: _buy(key)})
	choices.append({"label": "닫기", "cb": _close})
	_layer = ChoicePrompt.build(get_tree().current_scene,
		"📜 기술 나무 — 연구점 %d · 달마다 +%d(학자 %d)" % [int(st.pts), Tech.pts_per_month(scholars()), scholars()], choices)
	return true


func _buy(key: String) -> void:
	var r := Tech.research(key)
	if bool(r.ok):
		var b := Tech.branch(key)
		Toast.show(self, "%s 「%s」 — %s" % [b.emoji, r.node.name, r.node.desc], 3.0)
	else:
		Toast.show(self, String(r.why), 2.0)
	open_screen()
