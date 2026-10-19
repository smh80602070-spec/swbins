extends Button

## G-0231 전리품 거르기 창 — HUD 🧹 단추(hud_column_layout.gd 가 오른쪽 줄에 쌓는다).
## 공용 선택 창(choice_prompt.gd) 두 겹: 목록(규칙 줄 · 빠른 추가 넷 · 기본으로 · 닫기) → 규칙 하나(하는 일 바꾸기·위·아래·끄기·지우기).
## 바꾼 규칙은 다음 방 출구 자동 저장 때 세이브에 실린다(방 한가운데서 저장하면 자리까지 저장돼 안 한다).

const ChoicePrompt := preload("res://saga_core/ui/choice_prompt.gd")
const Toast := preload("res://saga_core/ui/toast.gd")
const LootFilter := preload("res://games/saga_dungeon/data/loot_filter.gd")

var _layer: CanvasLayer = null


func _ready() -> void:
	add_to_group("dungeon_loot_filter")
	pressed.connect(open_screen)


func _close() -> void:
	if _layer != null and is_instance_valid(_layer):
		_layer.queue_free()
	_layer = null


func _rule_line(i: int, r: Dictionary) -> String:
	return "%d. %s → %s%s" % [i + 1, LootFilter.describe(r), LootFilter.DO_NAMES.get(str(r.get("do", "show")), "보이기"),
		" (꺼짐)" if bool(r.get("off", false)) else ""]


func open_screen() -> bool:
	_close()
	var rs := LootFilter.rules()
	var choices: Array = []
	for i in rs.size():
		var k := i
		choices.append({"label": _rule_line(i, rs[i]), "cb": func() -> void: _open_rule(k)})
	for p: Dictionary in LootFilter.PRESETS:
		var key := String(p.key)
		choices.append({"label": "＋ " + String(p.label), "cb": func() -> void: _do(func() -> bool: return LootFilter.add_preset(key), -1)})
	choices.append({"label": "기본으로", "cb": func() -> void: _do(_reset_rules, -1)})
	choices.append({"label": "닫기", "cb": _close})
	_layer = ChoicePrompt.build(get_tree().current_scene,
		"🧹 전리품 거르기 — %d/%d 규칙\n위에서부터 처음 맞는 규칙대로. 금·단약·재료는 늘 보이고, 숨긴 장비는 떨어지지 않는다." % [rs.size(), LootFilter.MAX_RULES],
		choices)
	return true


func _open_rule(i: int) -> void:
	_close()
	var rs := LootFilter.rules()
	if i < 0 or i >= rs.size():
		open_screen()
		return
	var r: Dictionary = rs[i]
	var choices: Array = [
		{"label": "하는 일 바꾸기 (보이기 → 숨기기 → 빛기둥)", "cb": func() -> void: _do(func() -> bool: return LootFilter.cycle_do(i), i)},
		{"label": "▲ 위로", "cb": func() -> void: _do(func() -> bool: return LootFilter.move(i, -1), maxi(i - 1, 0))},
		{"label": "▼ 아래로", "cb": func() -> void: _do(func() -> bool: return LootFilter.move(i, 1), mini(i + 1, rs.size() - 1))},
		{"label": "켜기" if bool(r.get("off", false)) else "끄기", "cb": func() -> void: _do(func() -> bool: return LootFilter.toggle(i), i)},
		{"label": "✕ 지우기", "cb": func() -> void: _do(func() -> bool: return LootFilter.remove(i), -1)},
		{"label": "◀ 목록", "cb": open_screen},
	]
	_layer = ChoicePrompt.build(get_tree().current_scene, _rule_line(i, r), choices)


func _reset_rules() -> bool:
	LootFilter.reset()
	return true


## 바꾸고 다시 연다(again = 규칙 칸이면 그 규칙 창, -1 이면 목록). 못 바꿨으면(가득 참 등) 알린다.
func _do(change: Callable, again: int) -> void:
	if not bool(change.call()):
		Toast.show(self, "규칙은 %d줄까지다." % LootFilter.MAX_RULES, 2.0)
	if again >= 0:
		_open_rule(again)
	else:
		open_screen()
