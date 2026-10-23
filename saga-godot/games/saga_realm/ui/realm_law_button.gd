extends Button

## G-0321 법령 입구 — ☰ 메뉴 「📜 법령」. 공용 선택 창: 법령 넷(득·실·시행 중 ✓·못 내리는 까닭) · 닫기.
## 줄을 누르면 내리고(되돌릴 수 없다 — 창 머리에 적음) 창이 다시 열린다. realm_trade_button.gd 와 같은 꼴.

const ChoicePrompt := preload("res://saga_core/ui/choice_prompt.gd")
const Toast := preload("res://saga_core/ui/toast.gd")
const Laws := preload("res://games/saga_realm/data/realm_laws.gd")
const Ages := preload("res://games/saga_realm/data/realm_ages.gd")   # G-0329 국세
const Tech := preload("res://games/saga_realm/data/realm_tech.gd")

var _layer: CanvasLayer = null


func _ready() -> void:
	text = "📜 법령"
	focus_mode = Control.FOCUS_NONE
	add_to_group("realm_laws")
	pressed.connect(open_screen)


func _close() -> void:
	if _layer != null and is_instance_valid(_layer):
		_layer.queue_free()
	_layer = null


func open_screen() -> bool:
	_close()
	var rs: Object = RealmSaveState
	var choices: Array = []
	if Ages.on():   # G-0329 국세 줄(맨 위) — 누르면 올리기(못 하면 까닭)
		var techs: int = (Tech.state().done as Array).size()
		choices.append({"label": Ages.line(rs, techs), "cb": func() -> void: _advance_age()})
	for l: Dictionary in Laws.lines(rs):
		var key := String(l.key)
		choices.append({"label": String(l.label), "cb": func() -> void: _enact(key)})
	choices.append({"label": "닫기", "cb": _close})
	_layer = ChoicePrompt.build(get_tree().current_scene, "📜 법령 %d/%d — 한 번 내리면 거둘 수 없다 · 내린 뒤 %d달은 다음 법령을 못 낸다 · 수는 최고 관직 +1" %
		[Laws.enacted(rs).size(), Laws.cap(rs), Laws.GAP_MONTHS], choices)
	return true


func _advance_age() -> void:
	var r := Ages.advance(RealmSaveState, (Tech.state().done as Array).size())
	Toast.show(self, ("🏯 국세가 %s(으)로 올랐다 — 금·수확이 늘어난다" % String(r.name)) if bool(r.ok) else String(r.why), 3.0)
	open_screen()


func _enact(key: String) -> void:
	var r := Laws.enact(RealmSaveState, key)
	Toast.show(self, ("📜 %s 을(를) 내렸다 — %s" % [r.name, r.text]) if bool(r.ok) else String(r.why), 3.0)
	open_screen()
