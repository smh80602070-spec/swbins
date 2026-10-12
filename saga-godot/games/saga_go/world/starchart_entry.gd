extends Node

## G-0215 성도 입구 — 메뉴(hud_menu ENTRIES "go_starchart")와 키 F2(go_starchart, 1만리는 글자 26자를 다 써서). test_village.gd 가 붙인다.
## 공용 화면(saga_core/ui/passive_web_screen.gd)을 1만리 성도(data/go_starchart.gd — 효과 글·되돌리기 모라)로 연다.

const Screen := preload("res://saga_core/ui/passive_web_screen.gd")
const GoStarchart := preload("res://games/saga_go/data/go_starchart.gd")

var is_open := false
var _layer: CanvasLayer = null


func _ready() -> void:
	add_to_group("go_starchart")
	if not InputMap.has_action("go_starchart"):
		InputMap.add_action("go_starchart")
		var ev := InputEventKey.new()
		ev.physical_keycode = KEY_F2
		InputMap.action_add_event("go_starchart", ev)


func _unhandled_input(event: InputEvent) -> void:
	if event.is_action_pressed("go_starchart") and not is_open:
		open_screen()
		get_viewport().set_input_as_handled()


func open_screen() -> CanvasLayer:
	## 1만리 화면들은 숨긴 채 ui_modal 에 늘 들어 있다(아홉) — 보이는 창이 있을 때만 막는다
	if is_open or get_tree().get_nodes_in_group("ui_modal").any(func(n): return n is CanvasLayer and (n as CanvasLayer).visible):
		return null
	var api: RefCounted = PartyState.passive_api()
	is_open = true
	_layer = Screen.open(get_tree().current_scene, api, {
		"title": "✨ 성도",
		"fmt": func(st: Dictionary) -> String: return GoStarchart.fmt(st),
		"desc": func(nd: Dictionary) -> String: return GoStarchart.desc(nd),
		"gate": func(id: String) -> String: return GoStarchart.gate(id),
		"on_drop": func(_id: String) -> void: GoStarchart.pay_drop(),
		"on_close": func() -> void: is_open = false,
	})
	return _layer
