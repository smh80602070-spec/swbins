extends Button

## G-0214 사방 성좌도 입구 — HUD 단추 「✨ 성좌」 + 키 L(story_passive). 공용 화면(saga_core/ui/passive_web_screen.gd)을
## 4종횡 성좌(data/story_constellation.gd — 효과 글·막음·되돌리기 금)로 연다. 다른 선택 창(ui_modal)이 떠 있으면 안 연다.

const Screen := preload("res://saga_core/ui/passive_web_screen.gd")
const StoryConstellation := preload("res://games/saga_story/data/story_constellation.gd")


func _ready() -> void:
	text = "✨ 성좌"
	focus_mode = Control.FOCUS_NONE   # 단추에 초점이 남아 스페이스(점프)가 단추를 누르지 않게
	pressed.connect(open_screen)


func _process(_delta: float) -> void:
	if Input.is_action_just_pressed("story_passive"):
		open_screen()


func open_screen() -> CanvasLayer:
	if not get_tree().get_nodes_in_group("ui_modal").is_empty():
		return null
	var api: RefCounted = StorySaveState.passive_api()
	var tree := get_tree()
	return Screen.open(tree.current_scene, api, {
		"title": "✨ 사방 성좌",
		"fmt": func(st: Dictionary) -> String: return StoryConstellation.fmt(st),
		"gate": func(id: String) -> String: return StoryConstellation.gate(tree, id),
		"on_drop": func(_id: String) -> void: StoryConstellation.pay_drop(),
	})
