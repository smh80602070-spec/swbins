extends Button

## PLAN.md 51장 "장비→빌드" — vendor_button.gd·socket_button.gd와 같은
## 경계(HUD 버튼 하나가 ChoicePrompt로 선택지를 연다). 지금 장착한
## 무기가 정하는 직업(dungeon_items.gd::class_key_for_weapon())의 무예
## 셋(dungeon_skills.gd::skills_of())을 보여주고, 누르면 그 무예에 점
## 하나를 투자한다.

const ChoicePrompt := preload("res://saga_core/ui/choice_prompt.gd")
const Toast := preload("res://saga_core/ui/toast.gd")


func _ready() -> void:
	pressed.connect(_on_pressed)


func _on_pressed() -> void:
	var cls_key := DungeonItems.class_key_for_weapon(DungeonEquipmentState.weapon)
	var cls_name := DungeonItems.class_name_for_weapon(DungeonEquipmentState.weapon)
	var pts := DungeonSkillState.points_for(cls_key)

	var choices: Array = []
	for sk: Dictionary in DungeonSkills.skills_of(cls_key):
		var rank := DungeonSkillState.rank_of(str(sk.key))
		choices.append({
			"label": "%s (%d/%d단) — %s" % [sk.name, rank, DungeonSkills.MAX_RANK, sk.desc],
			"cb": func() -> void: _invest(str(sk.key), str(sk.name)),
		})

	ChoicePrompt.build(get_tree().current_scene,
		"🥋 %s — 남은 점수 %d" % [cls_name, pts], choices)


func _invest(skill_key: String, skill_name: String) -> void:
	if DungeonSkillState.invest(skill_key):
		var rank := DungeonSkillState.rank_of(skill_key)
		Toast.show(self, "🥋 %s 단을 올렸다 (%d단)." % [skill_name, rank], 2.5)
		return
	var sk := DungeonSkills.skill_by_key(skill_key)
	var cls_key := str(sk.get("cls", ""))
	if DungeonSkillState.points_for(cls_key) <= 0:
		Toast.show(self, "무예 점수가 없다 — 방을 클리어하면 하나씩 생긴다.", 2.5)
		return
	if DungeonSkillState.rank_of(skill_key) >= DungeonSkills.MAX_RANK:
		Toast.show(self, "이미 최고 단(%d단)이다." % DungeonSkills.MAX_RANK, 2.5)
		return
	var pre := DungeonSkills.prereq_of(sk)
	if not pre.is_empty():
		Toast.show(self, "먼저 「%s」에 1단 이상 올려야 한다." % str(pre.get("name", "?")), 2.5)
