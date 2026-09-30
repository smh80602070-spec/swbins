extends Button

## "제외" 목록 2번(소켓+부문어) — attack_button.gd와 같은 경계(HUD 버튼
## 하나가 진입점 하나를 그대로 부른다). 지금 박을 수 있는 부위(무기부터
## 본다, DungeonEquipmentState.first_socketable_slot())를 찾아, 가진
## 부문 중 고를 수 있게 GO의 ChoicePrompt를 그대로 재사용한다(cross-game
## 재사용 경계 — bandit_encounter.gd의 은사 선택과 같은 패턴).
##
## "제외" 목록 4번(원소 6결+저항) — 목록에 **보석**(키+등급별로 묶어서)과
## **주옥**(낱개라 하나씩)도 같이 올린다. 부문·보석·주옥 셋 다 박고 나면
## 부문어가 안 된다는 걸 사용자가 알 수 있게, 이미 룬이 아닌 것이 섞여
## 있으면 목록 맨 위에 그 사실만 짧게 알린다(막지는 않는다 — 원작도 안 막는다).

const ChoicePrompt := preload("res://saga_core/ui/choice_prompt.gd")
const Toast := preload("res://saga_core/ui/toast.gd")


func _ready() -> void:
	pressed.connect(_on_pressed)


func _on_pressed() -> void:
	var slot_name := DungeonEquipmentState.first_socketable_slot()
	if slot_name == "":
		Toast.show(self, "박을 빈 소켓이 없다.", 2.5)
		return

	var choices: Array = []
	for r: Dictionary in DungeonItems.RUNES:
		var key := str(r.key)
		var n := DungeonMaterialsState.count(key)
		if n <= 0:
			continue
		choices.append({
			"label": "%s(%s) × %d" % [r.glyph, r.name, n],
			"cb": func() -> void: _on_rune_picked(slot_name, key),
		})
	for g: Dictionary in DungeonItems.GEMS:
		for grade_num in range(DungeonItems.GRADES.size()):
			var n := DungeonMaterialsState.gem_count(str(g.key), grade_num)
			if n <= 0:
				continue
			var gr := DungeonItems.grade(grade_num)
			choices.append({
				"label": "%s %s × %d" % [gr.name, g.name, n],
				"cb": func() -> void: _on_gem_picked(slot_name, str(g.key), grade_num),
			})
	for j: Dictionary in DungeonMaterialsState.jewels:
		var jid := str(j.id)
		choices.append({
			"label": DungeonItems.jewel_name(j),
			"cb": func() -> void: _on_jewel_picked(slot_name, jid),
		})
	if choices.is_empty():
		Toast.show(self, "박을 재료가 없다(부문·보석·주옥).", 2.5)
		return
	ChoicePrompt.build(get_tree().current_scene, "🔨 무엇을 박을까", choices)


func _on_rune_picked(slot_name: String, key: String) -> void:
	if not DungeonMaterialsState.take_rune(key):
		return
	var word := DungeonEquipmentState.socket_rune(slot_name, key)
	if not word.is_empty():
		Toast.show(self, "《%s》 완성 — %s" % [word.name, word.desc], 4.0)
	else:
		var r := DungeonItems.rune_by_key(key)
		Toast.show(self, "%s(%s)을(를) 박았다." % [r.glyph, r.name], 3.0)


func _on_gem_picked(slot_name: String, key: String, grade_num: int) -> void:
	if not DungeonMaterialsState.take_gem(key, grade_num):
		return
	DungeonEquipmentState.socket_gem(slot_name, key, grade_num)
	var g := DungeonItems.gem_by_key(key)
	var gr := DungeonItems.grade(grade_num)
	Toast.show(self, "%s %s 을(를) 박았다." % [gr.name, g.name], 3.0)


func _on_jewel_picked(slot_name: String, jewel_id: String) -> void:
	var j := DungeonMaterialsState.remove_jewel(jewel_id)
	if j.is_empty():
		return
	DungeonEquipmentState.socket_jewel(slot_name, j)
	Toast.show(self, "%s 을(를) 박았다." % DungeonItems.jewel_name(j), 3.0)
