extends Button

## PLAN.md 51장 "장비→빌드" — vendor_button.gd·socket_button.gd와 같은
## 경계(HUD 버튼 하나가 ChoicePrompt로 선택지를 연다). 지금 장착한
## 무기가 정하는 직업(dungeon_items.gd::class_key_for_weapon())의 무예
## 셋(dungeon_skills.gd::skills_of())을 보여주고, 누르면 그 무예에 점
## 하나를 투자한다.
## G-0198 — 맨 위 "🎯 자리에 걸기"로 배운 활성 무예를 Z·X·C·V 넉 자리 중 하나에 건다(이미 걸린 것이면 맞바꿈, 웹 setSlot).
## 이 흐름의 창 둘(무예 고르기·자리 고르기)은 고르면 스스로 닫힌다.
## G-0241 — 배운 활성 무예 줄 밑에 "🌳 나무 Lv·점" 줄 → 마디 8(갈래 가/나) + ↩ 되돌리기(금 200) 창(data/dungeon_skill_tree.gd).
## G-0217 — 둘째 줄 "☯ 경락도"(키 F2, 액션 dungeon_meridian 은 실행 때 단다)가 공용 패시브 그물 화면을 지금 직업 경락도로 연다.

const ChoicePrompt := preload("res://saga_core/ui/choice_prompt.gd")
const Toast := preload("res://saga_core/ui/toast.gd")
const Screen := preload("res://saga_core/ui/passive_web_screen.gd")
const Meridian := preload("res://games/saga_dungeon/data/dungeon_meridian.gd")
const SkillTree := preload("res://games/saga_dungeon/data/dungeon_skill_tree.gd")

var meridian_open := false


func _ready() -> void:
	pressed.connect(_on_pressed)
	if not InputMap.has_action("dungeon_meridian"):
		InputMap.add_action("dungeon_meridian")
		var ev := InputEventKey.new()
		ev.physical_keycode = KEY_F2
		InputMap.action_add_event("dungeon_meridian", ev)


func _unhandled_input(event: InputEvent) -> void:
	if event.is_action_pressed("dungeon_meridian") and not meridian_open:
		open_meridian()
		get_viewport().set_input_as_handled()


## 경락도 화면 — 보이는 창(ui_modal)이 있으면 안 연다
func open_meridian() -> CanvasLayer:
	if meridian_open or get_tree().get_nodes_in_group("ui_modal").any(func(n): return n is CanvasLayer and (n as CanvasLayer).visible):
		return null
	var api: RefCounted = DungeonSaveState.passive_api()
	var cls_name := DungeonItems.class_name_for_weapon(DungeonEquipmentState.weapon)
	meridian_open = true
	return Screen.open(get_tree().current_scene, api, {
		"title": "☯ 경락도 — %s" % cls_name,
		"fmt": func(st: Dictionary) -> String: return Meridian.fmt(st),
		"desc": func(nd: Dictionary) -> String: return Meridian.desc(nd),
		"gate": func(id: String) -> String: return Meridian.gate(get_tree(), id),
		"on_drop": func(_id: String) -> void: Meridian.pay_drop(),
		"on_close": func() -> void: meridian_open = false,
	})


func _on_pressed() -> void:
	var cls_key := DungeonItems.class_key_for_weapon(DungeonEquipmentState.weapon)
	var cls_name := DungeonItems.class_name_for_weapon(DungeonEquipmentState.weapon)
	var pts := DungeonSkillState.points_for(cls_key)

	var choices: Array = []
	var box: Array = []
	choices.append({"label": "🎯 자리에 걸기 — 지금 %s" % _slots_text(cls_key), "cb": _pick_skill.bind(cls_key, box)})
	var mapi: RefCounted = DungeonSaveState.passive_api(cls_key)
	choices.append({"label": "☯ 경락도 — 남은 경락 점수 %d / %d (F2)" % [mapi.left(), mapi.points()], "cb": func() -> void:
		if not box.is_empty() and is_instance_valid(box[0]):
			(box[0] as CanvasLayer).visible = false   # queue_free 는 프레임 끝 — 숨겨야 open_meridian 의 ui_modal 막음에 안 걸린다
		_close(box)
		open_meridian()})
	for sk: Dictionary in DungeonSkills.skills_of(cls_key):
		var rank := DungeonSkillState.rank_of(str(sk.key))
		choices.append({
			"label": "%s (%d/%d단) — %s" % [sk.name, rank, DungeonSkills.MAX_RANK, sk.desc],
			"cb": func() -> void: _invest(str(sk.key), str(sk.name)),
		})
		if DungeonSkills.is_active(sk) and rank > 0:   # G-0241 무예별 작은 나무(passive 는 시전이 없어 나무 없음)
			choices.append({"label": "　%s — %s" % [SkillTree.line(str(sk.key)), sk.name], "cb": func() -> void:
				_close(box)
				open_tree(str(sk.key))})

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


## G-0241 — 무예 하나의 나무 창. 찍거나 되돌리면 창을 다시 그린다.
func open_tree(skill_key: String) -> CanvasLayer:
	var sk := DungeonSkills.skill_by_key(skill_key)
	var choices: Array = []
	var box: Array = []
	for i in SkillTree.NODES:
		for side: String in ["a", "b"]:
			var opt: Dictionary = SkillTree.TREE[i][side]
			var cur := 0
			var t: Variant = DungeonSkillState.tree.get(skill_key, {})
			if typeof(t) == TYPE_DICTIONARY and i < (t.get("pts", []) as Array).size():
				cur = int(t.pts[i])
			var mine := (side == "a" and cur > 0) or (side == "b" and cur < 0)
			var w := SkillTree.why(skill_key, i, side)
			choices.append({"label": "%s 마디 %d %s · %s%s%s" % ["●" if mine else "○", i + 1, "가" if side == "a" else "나", SkillTree.label(opt),
				(" ×%d" % absi(cur)) if mine else "", "" if w == "" else " (%s)" % TREE_WHY.get(w, w)],
				"cb": _tree_put.bind(skill_key, i, side, box)})
	choices.append({"label": "↩ 되돌리기 — 금 %d (경험은 남음)" % SkillTree.RESET_GOLD, "cb": _tree_reset.bind(skill_key, box)})
	choices.append({"label": "닫기", "cb": _close.bind(box)})
	box.append(ChoicePrompt.build(get_tree().current_scene, "🌳 %s %s — %s" % [str(sk.get("icon", "")), str(sk.get("name", skill_key)), SkillTree.line(skill_key)], choices))
	return box[0]


const TREE_WHY := {"prereq": "앞 마디 먼저", "side": "다른 갈래", "max": "끝", "point": "점 없음", "arg": "?"}


func _tree_put(skill_key: String, i: int, side: String, box: Array) -> void:
	var r := SkillTree.put(skill_key, i, side)
	if not bool(r.ok):
		Toast.show(self, "찍을 수 없다 — %s." % TREE_WHY.get(str(r.reason), str(r.reason)), 2.0)
		return
	_close(box)
	open_tree(skill_key)


func _tree_reset(skill_key: String, box: Array) -> void:
	var r := SkillTree.reset(skill_key)
	if not bool(r.ok):
		Toast.show(self, "찍은 점이 없다." if str(r.reason) == "empty" else "금이 모자란다 — %d 금." % SkillTree.RESET_GOLD, 2.0)
		return
	Toast.show(self, "↩ 나무를 되돌렸다 — 금 %d." % SkillTree.RESET_GOLD, 2.0)
	_close(box)
	open_tree(skill_key)
