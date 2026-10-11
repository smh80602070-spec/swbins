extends Button

## PLAN.md 51장 "장비→빌드" — vendor_button.gd·socket_button.gd와 같은
## 경계(HUD 버튼 하나가 ChoicePrompt로 선택지를 연다). 지금 장착한
## 무기가 정하는 직업(dungeon_items.gd::class_key_for_weapon())의 무예
## 셋(dungeon_skills.gd::skills_of())을 보여주고, 누르면 그 무예에 점
## 하나를 투자한다.
## G-0198 — 맨 위 "🎯 자리에 걸기"로 배운 활성 무예를 Z·X·C·V 넉 자리 중 하나에 건다(이미 걸린 것이면 맞바꿈, 웹 setSlot).
## 이 흐름의 창 둘(무예 고르기·자리 고르기)은 고르면 스스로 닫힌다.

const ChoicePrompt := preload("res://saga_core/ui/choice_prompt.gd")
const Toast := preload("res://saga_core/ui/toast.gd")


func _ready() -> void:
	pressed.connect(_on_pressed)


func _on_pressed() -> void:
	var cls_key := DungeonItems.class_key_for_weapon(DungeonEquipmentState.weapon)
	var cls_name := DungeonItems.class_name_for_weapon(DungeonEquipmentState.weapon)
	var pts := DungeonSkillState.points_for(cls_key)

	var choices: Array = []
	var box: Array = []
	choices.append({"label": "🎯 자리에 걸기 — 지금 %s" % _slots_text(cls_key), "cb": _pick_skill.bind(cls_key, box)})
	for sk: Dictionary in DungeonSkills.skills_of(cls_key):
		var rank := DungeonSkillState.rank_of(str(sk.key))
		choices.append({
			"label": "%s (%d/%d단) — %s" % [sk.name, rank, DungeonSkills.MAX_RANK, sk.desc],
			"cb": func() -> void: _invest(str(sk.key), str(sk.name)),
		})

	box.append(ChoicePrompt.build(get_tree().current_scene,
		"🥋 %s — 남은 점수 %d" % [cls_name, pts], choices))


const SLOT_KEYS := ["Z", "X", "C", "V"]


static func _close(box: Array) -> void:
	if not box.is_empty() and is_instance_valid(box[0]):
		(box[0] as Node).queue_free()


func _slots_text(cls_key: String) -> String:
	var parts: Array = []
	var eq: Array = DungeonSkillState.equipped(cls_key)
	for i in eq.size():
		var k := str(eq[i])
		parts.append("%s %s" % [SLOT_KEYS[i], str(DungeonSkills.skill_by_key(k).get("icon", "")) if k != "" else "·"])
	return " ".join(parts)


## 자리에 걸 무예 고르기 — 이 직업에서 배운 활성 무예만(패시브는 못 건다).
func _pick_skill(cls_key: String, from_box: Array) -> void:
	_close(from_box)
	var choices: Array = []
	var box: Array = []
	for sk: Dictionary in DungeonSkills.skills_of(cls_key):
		if not DungeonSkills.is_active(sk) or DungeonSkillState.rank_of(str(sk.key)) <= 0:
			continue
		var at: int = DungeonSkillState.slots_of(cls_key).find(str(sk.key))
		choices.append({
			"label": "%s %s%s" % [str(sk.get("icon", "")), sk.name, (" — 지금 %s" % SLOT_KEYS[at]) if at >= 0 else ""],
			"cb": _pick_slot.bind(cls_key, str(sk.key), box),
		})
	if choices.is_empty():
		Toast.show(self, "걸 무예가 없다 — 활성 무예에 1단 이상 올려야 한다.", 2.5)
		return
	choices.append({"label": "닫기", "cb": _close.bind(box)})
	box.append(ChoicePrompt.build(get_tree().current_scene, "🎯 어느 무예를 걸까", choices))


func _pick_slot(cls_key: String, skill_key: String, from_box: Array) -> void:
	_close(from_box)
	var choices: Array = []
	var box: Array = []
	var eq: Array = DungeonSkillState.equipped(cls_key)
	var nm := str(DungeonSkills.skill_by_key(skill_key).name)
	for i in DungeonSkillState.SLOTS:
		var cur := str(eq[i])
		choices.append({
			"label": "%s 자리 — %s" % [SLOT_KEYS[i], str(DungeonSkills.skill_by_key(cur).name) if cur != "" else "빈 칸"],
			"cb": _set_slot.bind(cls_key, i, skill_key, box),
		})
	box.append(ChoicePrompt.build(get_tree().current_scene, "🎯 「%s」 — 어느 자리에" % nm, choices))


func _set_slot(cls_key: String, idx: int, skill_key: String, from_box: Array) -> void:
	_close(from_box)
	if DungeonSkillState.set_slot(cls_key, idx, skill_key):
		Toast.show(self, "🎯 「%s」를 %s 자리에 걸었다." % [str(DungeonSkills.skill_by_key(skill_key).name), SLOT_KEYS[idx]], 2.5)


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
