extends Button

## G-0218 솜씨도 입구 — HUD 「🌿 솜씨」 단추(저장 단추 위)와 키 F2(액션 forest_workshop 은 실행 때 단다).
## 공용 화면(saga_core/ui/passive_web_screen.gd)을 3마을 솜씨도(data/forest_workshop.gd — 효과 글·되돌리기 집 안·하루 무료)로 연다.

const Screen := preload("res://saga_core/ui/passive_web_screen.gd")
const Workshop := preload("res://games/saga_forest/data/forest_workshop.gd")

var is_open := false


func _ready() -> void:
	text = "🌿 솜씨"
	pressed.connect(open_screen)
	if not InputMap.has_action("forest_workshop"):
		InputMap.add_action("forest_workshop")
		var ev := InputEventKey.new()
		ev.physical_keycode = KEY_F2
		InputMap.action_add_event("forest_workshop", ev)
	ForestSaveState.sync_walk.call_deferred()


func _unhandled_input(event: InputEvent) -> void:
	if event.is_action_pressed("forest_workshop") and not is_open:
		open_screen()
		get_viewport().set_input_as_handled()


## 보이는 창(ui_modal)이 있으면 안 연다
func open_screen() -> CanvasLayer:
	if is_open or get_tree().get_nodes_in_group("ui_modal").any(func(n): return n is CanvasLayer and (n as CanvasLayer).visible):
		return null
	var api: RefCounted = ForestSaveState.passive_api()
	is_open = true
	return Screen.open(get_tree().current_scene, api, {
		"title": "🌿 솜씨도",
		"fmt": func(st: Dictionary) -> String: return Workshop.fmt(st),
		"desc": func(nd: Dictionary) -> String: return Workshop.desc(nd),
		"gate": func(id: String) -> String: return Workshop.gate(get_tree(), id),
		"on_drop": func(_id: String) -> void: Workshop.pay_drop(),
		"on_close": func() -> void: is_open = false,
	})
