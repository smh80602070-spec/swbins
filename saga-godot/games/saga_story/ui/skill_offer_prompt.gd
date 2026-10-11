extends Node

## G-0197 — 4종횡 레벨업 무예 3택 창(웹 W-0104 의 고돗 짝). StorySaveState.skill_offers 에 장이 쌓여 있으면 한 장씩 띄운다 —
## 유파가 서로 다른 무예 셋(이름·유파·지금 Lv → Lv+1·한 줄) + 거절(강화 점수 +1). 다른 창이 떠 있으면 기다린다. 0.5초마다 본다(매 틱 셈 금지).
## 사냥터(story_field.gd)·허도(story_town.gd)가 붙인다.

const ChoicePrompt := preload("res://saga_core/ui/choice_prompt.gd")
const Toast := preload("res://saga_core/ui/toast.gd")
const Meta := preload("res://games/saga_story/data/story_skill_meta.gd")

const TICK_SEC := 0.5

var _acc := 0.0
var _open := false


func _process(delta: float) -> void:
	_acc += delta
	if _acc < TICK_SEC or _open:
		return
	_acc = 0.0
	if StorySaveState.skill_offers.is_empty():
		return
	for n in get_tree().get_nodes_in_group("ui_modal"):
		if n.get("visible") != false:
			return
	open_first()


static func label_of(key: String) -> String:
	var m: Dictionary = Meta.SKILLS.get(key, {})
	var lv := StorySaveState.skill_level(key)
	var desc := String(m.get("desc", ""))
	return "%s %s · %s  Lv%d → %d%s" % [String(m.get("emoji", "")), String(m.get("name", key)), String(Meta.SCHOOL_NAMES.get(String(m.get("school", "")), "")), lv, lv + 1, (" — " + desc) if desc != "" else ""]


func open_first() -> void:
	if StorySaveState.skill_offers.is_empty():
		return
	_open = true
	var o: Dictionary = StorySaveState.skill_offers[0]
	var box := {}
	var choices: Array = []
	for key: String in o.keys:
		choices.append({"label": label_of(key), "cb": func() -> void:
			(box["layer"] as CanvasLayer).queue_free()
			_open = false
			if StorySaveState.pick_offer(0, key):
				Toast.show(get_tree().current_scene, "📜 %s +1" % Meta.name_of(key), 2.0)})
	choices.append({"label": "거절한다 — 강화 점수 +1(직업 사범에게서 쓴다)", "cb": func() -> void:
		(box["layer"] as CanvasLayer).queue_free()
		_open = false
		StorySaveState.decline_offer(0)})
	box["layer"] = ChoicePrompt.build(get_tree().current_scene, "⬆️ Lv.%d — 무예 하나를 고른다(유파가 서로 다른 셋)" % int(o.lv), choices)
