extends Button

## G-0336 국가 방침 입구 — ☰ 메뉴 「🎯 방침」. 공용 선택 창: 방침 일곱(완수 ✓·진행 중 ⏳·고를 수 있으면 ▶ 달 수·못 고르면 까닭) · 닫기.
## 줄을 누르면 그 방침을 시작하고 창이 다시 열린다. realm_law_button.gd 와 같은 꼴. 규칙은 data/realm_focus.gd.

const ChoicePrompt := preload("res://saga_core/ui/choice_prompt.gd")
const Toast := preload("res://saga_core/ui/toast.gd")
const Focus := preload("res://games/saga_realm/data/realm_focus.gd")

var _layer: CanvasLayer = null


func _ready() -> void:
	text = "🎯 방침"
	focus_mode = Control.FOCUS_NONE
	add_to_group("realm_focus")
	pressed.connect(open_screen)


func _close() -> void:
	if _layer != null and is_instance_valid(_layer):
		_layer.queue_free()
	_layer = null


func open_screen() -> bool:
	_close()
	if not Focus.on():
		return false
	var choices: Array = []
	for l: Dictionary in Focus.lines(RealmSaveState):
		var id := String(l.id)
		choices.append({"label": String(l.label), "cb": func() -> void: _pick(id)})
	choices.append({"label": "닫기", "cb": _close})
	_layer = ChoicePrompt.build(get_tree().current_scene,
		"🎯 국가 방침 %d/%d — 한 번에 하나 · 달이 차면 덤이 영구로 · 부국과 강병은 하나만" % [Focus.done(RealmSaveState).size(), Focus.MAX_DONE], choices)
	return true


func _pick(id: String) -> void:
	var r := Focus.pick(RealmSaveState, id)
	Toast.show(self, ("🎯 방침 「%s」 시작 — %d달 뒤 완수" % [r.name, int(r.months)]) if bool(r.ok) else String(r.why), 3.0)
	open_screen()
