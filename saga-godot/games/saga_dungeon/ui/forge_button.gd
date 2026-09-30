extends Button

## "제외" 목록 3번(연단) — forge.js의 조합 넷 중 **부문 셋→다음 글자**만
## 옮겼다(dungeon_materials_state.gd::combine_rune() 헤더에 이유 있음).
## socket_button.gd와 같은 경계(HUD 버튼 하나가 ChoicePrompt를 연다).
##
## "제외" 목록 4번(원소 6결+저항) — **보석 셋→한 등급 위**를 이제 더한다
## (forge.js makeGem(), dungeon_materials_state.gd::combine_gem() 참고).
## 나머지 둘(장비 셋·접사 다시 굴리기)은 여전히 가방이 없어 이 슬라이스 밖.

const ChoicePrompt := preload("res://saga_core/ui/choice_prompt.gd")
const Toast := preload("res://saga_core/ui/toast.gd")


func _ready() -> void:
	pressed.connect(_on_pressed)


func _on_pressed() -> void:
	var choices: Array = []
	for r: Dictionary in DungeonItems.RUNES:
		var key := str(r.key)
		if DungeonMaterialsState.count(key) < 3:
			continue
		var next_key := DungeonItems.next_rune_key(key)
		if next_key == "":
			continue
		var nr := DungeonItems.rune_by_key(next_key)
		choices.append({
			"label": "%s(%s) ×3 → %s(%s) ×1" % [r.glyph, r.name, nr.glyph, nr.name],
			"cb": func() -> void: _combine_rune(key),
		})
	for g: Dictionary in DungeonItems.GEMS:
		for grade_num in range(DungeonItems.GRADES.size() - 1):
			if DungeonMaterialsState.gem_count(str(g.key), grade_num) < 3:
				continue
			var gr := DungeonItems.grade(grade_num)
			var up := DungeonItems.grade(grade_num + 1)
			choices.append({
				"label": "%s %s ×3 → %s %s ×1" % [gr.name, g.name, up.name, g.name],
				"cb": func() -> void: _combine_gem(str(g.key), grade_num),
			})
	if choices.is_empty():
		Toast.show(self, "지금 태울 수 있는 재료가 없다(부문·보석 셋 필요).", 2.5)
		return
	ChoicePrompt.build(get_tree().current_scene, "⚗️ 연단", choices)


func _combine_rune(key: String) -> void:
	var r := DungeonMaterialsState.combine_rune(key)
	if not bool(r.get("ok", false)):
		return
	var nr := DungeonItems.rune_by_key(str(r.next_key))
	Toast.show(self, "⚗️ 연단 · 부문 %s(%s) 이 나왔다." % [nr.glyph, nr.name], 3.0)


func _combine_gem(key: String, grade_num: int) -> void:
	var r := DungeonMaterialsState.combine_gem(key, grade_num)
	if not bool(r.get("ok", false)):
		return
	var g := DungeonItems.gem_by_key(key)
	var up := DungeonItems.grade(int(r.next_grade))
	Toast.show(self, "⚗️ 연단 · %s %s 이 나왔다." % [up.name, g.name], 3.0)
