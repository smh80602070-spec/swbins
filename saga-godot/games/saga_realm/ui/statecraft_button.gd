extends Button

## G-0216 경륜도 입구 — HUD 단추 「🧭 경륜」 + 키 F2(go 성도처럼 실행 때 add_action — 천하는 키를 거의 안 쓴다).
## 공용 화면(saga_core/ui/passive_web_screen.gd)을 천하 경륜도(data/realm_statecraft.gd — 효과 글·막음·되돌리기 금)로 연다.

const Screen := preload("res://saga_core/ui/passive_web_screen.gd")
const RealmStatecraft := preload("res://games/saga_realm/data/realm_statecraft.gd")


func _ready() -> void:
	text = "🧭 경륜"
	focus_mode = Control.FOCUS_NONE
	pressed.connect(open_screen)
	if not InputMap.has_action("realm_statecraft"):
		InputMap.add_action("realm_statecraft")
		var ev := InputEventKey.new()
		ev.physical_keycode = KEY_F2
		InputMap.action_add_event("realm_statecraft", ev)


func _unhandled_input(event: InputEvent) -> void:
	if event.is_action_pressed("realm_statecraft"):
		if open_screen() != null:
			get_viewport().set_input_as_handled()


func open_screen() -> CanvasLayer:
	if get_tree().get_nodes_in_group("ui_modal").any(func(n): return n is CanvasLayer and (n as CanvasLayer).visible):
		return null
	var api: RefCounted = RealmSaveState.passive_api()
	return Screen.open(get_tree().current_scene, api, {
		"title": "🧭 경륜도",
		"fmt": func(st: Dictionary) -> String: return RealmStatecraft.fmt(st),
		"desc": func(nd: Dictionary) -> String: return RealmStatecraft.desc(nd),
		"gate": func(id: String) -> String: return RealmStatecraft.gate(id),
		"on_drop": func(_id: String) -> void: RealmStatecraft.pay_drop(),
	})
