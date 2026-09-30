extends Button

## PLAN 101-2 REALM ⑥후보(웹판 §5-8 "군주 사망·계승") — realm_promote_
## button.gd와 같은 ChoicePrompt 패턴, 한 화면에 손잡이 켜기/끄기와 후계
## 지정을 같이 담는다(HUD 자리를 아끼려고 새 버튼을 둘로 안 늘렸다).

const ChoicePrompt := preload("res://saga_core/ui/choice_prompt.gd")
const Toast := preload("res://saga_core/ui/toast.gd")
const Characters := preload("res://saga_core/data/characters.gd")

const TOAST_SEC := 2.5


func _ready() -> void:
	text = "계승"
	pressed.connect(_on_pressed)


func _lord_name() -> String:
	var h = Characters.find(RealmSaveState.current_lord_id)
	return String(h.name) if h != null else RealmSaveState.current_lord_id


func _on_pressed() -> void:
	var layer_box := {}
	var choices: Array = []
	var on := RealmSaveState.lord_succession_enabled
	choices.append({
		"label": "손잡이: %s (누르면 %s)" % ["켜짐" if on else "꺼짐", "끄기" if on else "켜기"],
		"cb": func() -> void: _toggle(layer_box),
	})
	for id: String in RealmSaveState.roster:
		var h = Characters.find(id)
		var mark := " ★후계" if id == RealmSaveState.heir_id else ""
		choices.append({
			"label": "후계로 지정 — %s%s" % [String(h.name) if h != null else id, mark],
			"cb": func() -> void: _designate(id, layer_box),
		})
	if not RealmSaveState.heir_id.is_empty():
		choices.append({"label": "후계 해제(자동으로 되돌림)", "cb": func() -> void: _clear_heir(layer_box)})
	layer_box["layer"] = ChoicePrompt.build(self, "계승 — 지금 군주: %s" % _lord_name(), choices)


func _toggle(layer_box: Dictionary) -> void:
	(layer_box["layer"] as CanvasLayer).queue_free()
	RealmSaveState.lord_succession_enabled = not RealmSaveState.lord_succession_enabled
	Toast.show(self, "계승 손잡이 — %s" % ("켜짐" if RealmSaveState.lord_succession_enabled else "꺼짐"), TOAST_SEC)


func _designate(id: String, layer_box: Dictionary) -> void:
	(layer_box["layer"] as CanvasLayer).queue_free()
	RealmSaveState.heir_id = id
	var h = Characters.find(id)
	Toast.show(self, "후계 지정 — %s" % (String(h.name) if h != null else id), TOAST_SEC)


func _clear_heir(layer_box: Dictionary) -> void:
	(layer_box["layer"] as CanvasLayer).queue_free()
	RealmSaveState.heir_id = ""
	Toast.show(self, "후계 지정을 해제했다 — 자동(충성·관직 최고)으로 정해진다", TOAST_SEC)
