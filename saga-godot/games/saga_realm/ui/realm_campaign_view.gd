extends CanvasLayer

## G-0413 — 5천하 장 진행 화면. 정본 데이터는 scenario.gd / realm_campaign.gd.
const Campaign := preload("res://games/saga_realm/data/realm_campaign.gd")
const Scenario := preload("res://games/saga_realm/data/scenario.gd")
const Characters := preload("res://saga_core/data/characters.gd")
const Treasure := preload("res://games/saga_realm/data/realm_treasure.gd")
const CampaignGear := preload("res://games/saga_realm/data/realm_campaign_gear.gd")
const CampaignCommand := preload("res://games/saga_realm/data/realm_commander.gd")
const CampaignClass := preload("res://games/saga_realm/data/realm_class.gd")
const CampaignSkills := preload("res://games/saga_realm/data/realm_hero_skills.gd")
const BattleScript := preload("res://games/saga_realm/data/realm_battle_script.gd")
const Support := preload("res://games/saga_realm/data/realm_support.gd")
const RealmTacticsView := preload("res://games/saga_realm/world/realm_tactics_view.gd")
const RealmTactics := preload("res://games/saga_realm/data/realm_tactics.gd")
const RealmWar := preload("res://games/saga_realm/data/realm_war.gd")
const Toast := preload("res://saga_core/ui/toast.gd")

var _root: Control
var _body: VBoxContainer
var _tab := "party"
var _gear_officer := ""
var _questions: Array = []
var _answers: Array = []
var _question_index := 0
var _duel_rng := RandomNumberGenerator.new()
var _duel_round := 0
var _duel_done := false
var _last_side_result: Dictionary = {}
var _last_side_gold := 0
var _last_end_line := ""
var _last_chest_gear: Array = []


static func attach(host: Node) -> Node:
	var scene := host.get_tree().current_scene
	if scene == null: return null
	var existing: Node = scene.get_node_or_null("RealmCampaignView")
	if existing != null: return existing
	var view: CanvasLayer = (load("res://games/saga_realm/ui/realm_campaign_view.gd") as GDScript).new()
	view.name = "RealmCampaignView"
	scene.add_child(view)
	return view


func _ready() -> void:
	layer = 3
	set_process(true)
	_build()
	_rebuild()


func _process(_delta: float) -> void:
	visible = Campaign.enabled() and RealmSaveState.scenario_ready and String(Campaign.data().step) != "battle"


func _build() -> void:
	_root = Control.new()
	_root.name = "CampaignRoot"
	_root.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	add_child(_root)
	var bg := ColorRect.new()
	bg.color = Color("111a24")
	bg.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	_root.add_child(bg)
	var margin := MarginContainer.new()
	margin.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	margin.add_theme_constant_override("margin_left", 28)
	margin.add_theme_constant_override("margin_top", 20)
	margin.add_theme_constant_override("margin_right", 28)
	margin.add_theme_constant_override("margin_bottom", 20)
	_root.add_child(margin)
	var frame := VBoxContainer.new()
	frame.add_theme_constant_override("separation", 12)
	margin.add_child(frame)
	var header := HBoxContainer.new()
	frame.add_child(header)
	var title := Label.new()
	title.name = "CampaignTitle"
	title.add_theme_font_size_override("font_size", 30)
	title.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	header.add_child(title)
	var gold := Label.new()
	gold.name = "CampaignGold"
	gold.add_theme_font_size_override("font_size", 22)
	header.add_child(gold)
	var save_btn := Button.new()
	save_btn.text = "저장"
	save_btn.custom_minimum_size = Vector2(100, 48)
	save_btn.pressed.connect(func() -> void: RealmSaveState.save(); _rebuild())
	header.add_child(save_btn)
	var menu_btn := Button.new()
	menu_btn.text = "☰"
	menu_btn.tooltip_text = "설정·메뉴"
	menu_btn.custom_minimum_size = Vector2(64, 48)
	menu_btn.pressed.connect(_open_menu)
	header.add_child(menu_btn)
	var rule := HSeparator.new()
	frame.add_child(rule)
	_body = VBoxContainer.new()
	_body.name = "CampaignBody"
	_body.size_flags_vertical = Control.SIZE_EXPAND_FILL
	_body.add_theme_constant_override("separation", 12)
	frame.add_child(_body)


func _rebuild() -> void:
	if _body == null: return
	for child in _body.get_children():
		child.queue_free()
	var cp := Campaign.data()
	var title := _root.find_child("CampaignTitle", true, false) as Label
	var gold := _root.find_child("CampaignGold", true, false) as Label
	if title != null: title.text = "⚔ 5천하 · %d회차" % (int(cp.round) + 1)
	if gold != null: gold.text = "금 %d" % int(cp.gold)
	match String(cp.step):
		"story": _show_story(int(cp.ch))
		"camp", "battle": _show_camp(int(cp.ch))
		"debate": _show_debate()
		"duel": _show_duel()
		"result": _show_result()
		"round_end": _show_round_end()
		_: _show_route()


func _show_route() -> void:
	var cp := Campaign.data()
	_add_label(_body, "노선도", 26)
	_add_label(_body, "현재 장 %d · 완료한 장 %d/19" % [mini(int(cp.ch), 19), (cp.cleared as Dictionary).size()], 16)
	var scroll := ScrollContainer.new()
	scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	_body.add_child(scroll)
	var list := VBoxContainer.new()
	list.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	list.add_theme_constant_override("separation", 6)
	scroll.add_child(list)
	for ch: Dictionary in Campaign.cards():
		var no := int(ch.chapter)
		var unlocked := Campaign.is_unlocked(no)
		var done := (cp.cleared as Dictionary).has(no)
		var prefix := "✓" if done else ("▶" if no == int(cp.ch) else "🔒")
		var line := "%s  %02d · %s — %s" % [prefix, no, String(ch.title), String(ch.get("actName", Scenario.ACT_NAMES.get(int(ch.act), "")))]
		var b := _button(line, unlocked and no == int(cp.ch))
		b.pressed.connect(_open_card.bind(no))
		list.add_child(b)
	if int(cp.ch) > Campaign.ALL:
		_add_button(_body, "👑 천하 평정 — 회차를 새로 시작", _start_round)


func _open_card(no: int) -> void:
	if not Campaign.is_unlocked(no) or no != int(Campaign.data().ch): return
	Campaign.data().ch = no
	Campaign.data().step = "story"
	RealmSaveState.save()
	_rebuild()


func _show_story(no: int) -> void:
	var ch := Campaign.card(no)
	if ch.is_empty(): Campaign.data().step = "route"; _rebuild(); return
	_add_label(_body, "%s  %s" % [String(ch.get("emoji", "⚔️")), String(ch.title)], 28)
	_add_label(_body, String(ch.get("actName", Scenario.ACT_NAMES.get(int(ch.act), ""))), 16)
	var story := _add_label(_body, Scenario.fill(String(ch.text), _campaign_names()), 20)
	story.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	story.size_flags_vertical = Control.SIZE_EXPAND_FILL
	for option: Dictionary in ch.get("choices", []):
		var label := Scenario.fill("%s — %s" % [String(option.get("label", "")), String(option.get("hint", ""))], _campaign_names())
		var b := _button(label, true)
		b.pressed.connect(_choose.bind(no, String(option.get("k", ""))))
		_body.add_child(b)
	var back := _button("노선도로", true)
	back.pressed.connect(func() -> void: Campaign.data().step = "route"; RealmSaveState.save(); _rebuild())
	_body.add_child(back)


func _choose(no: int, key: String) -> void:
	var r := Campaign.choose(no, key)
	if not bool(r.get("ok", false)):
		_add_label(_body, String(r.get("why", "선택을 적용하지 못했습니다")), 18)
		return
	if bool(r.get("epilogue", false)) and bool(r.get("end", false)):
		Campaign.data().step = "round_end"
	_rebuild()


func _show_camp(no: int) -> void:
	var ch := Campaign.card(no)
	_add_label(_body, "진영 준비 · %02d장 %s" % [no, String(ch.get("title", ""))], 26)
	if not _last_side_result.is_empty():
		_add_label(_body, _side_result_text(_last_side_result, _last_side_gold), 16)
	if _last_end_line != "": _add_label(_body, _last_end_line, 16)
	if not _last_chest_gear.is_empty(): _add_label(_body, _chest_gear_text(_last_chest_gear), 16)
	var tabs := HBoxContainer.new()
	_body.add_child(tabs)
	for spec in [["party", "편성"], ["gear", "장비"], ["shop", "상점"], ["talk", "대화"]]:
		var tab_button := _button(String(spec[1]), true)
		tab_button.pressed.connect(func() -> void: _tab = String(spec[0]); _rebuild())
		tabs.add_child(tab_button)
	var scroll := ScrollContainer.new()
	scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	_body.add_child(scroll)
	var content := VBoxContainer.new()
	content.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	content.add_theme_constant_override("separation", 8)
	scroll.add_child(content)
	match _tab:
		"gear": _tab_gear(content)
		"shop": _tab_shop(content)
		"talk": _tab_talk(content)
		_: _tab_party(content)
	var footer := HBoxContainer.new()
	_body.add_child(footer)
	var route := _button("노선도", true)
	route.pressed.connect(func() -> void: Campaign.data().step = "route"; RealmSaveState.save(); _rebuild())
	footer.add_child(route)
	if no <= Campaign.MAIN:
		var dispatch := _button("출진 ▶", not Campaign.party().is_empty())
		dispatch.pressed.connect(_dispatch)
		footer.add_child(dispatch)


func _tab_party(parent: VBoxContainer) -> void:
	_add_label(parent, "출진은 세 명까지. 선택을 비우면 자동으로 세기 순 편성합니다.", 16)
	var selected := Campaign.party()
	for id: String in Campaign.roster():
		var info: Dictionary = Characters.find(id)
		var on := selected.has(id)
		var stats := "무 %d · 지 %d · 통 %d" % [roundi(RealmSaveState._effective_stat(id, "might")), roundi(RealmSaveState._effective_stat(id, "wisdom")), roundi(RealmSaveState._effective_stat(id, "command"))]
		var skill := CampaignSkills.of(id)
		var cls := Campaign.class_of(id)
		var cls_name := String(CampaignClass.CLS.get(cls, {}).get("name", "미전직"))
		var row := _button("%s  %s   %s   ✦%s   · %s" % ["☑" if on else "□", String(info.get("name", id)), stats, String(skill.get("name", "없음")), cls_name], true)
		row.pressed.connect(_toggle_party.bind(id))
		parent.add_child(row)
		var choices := Campaign.class_choices(id)
		for class_key_v: Variant in choices:
			var class_key := String(class_key_v)
			var desc := CampaignClass.line(class_key)
			var class_btn := _button("직업 선택 · %s" % desc, true)
			class_btn.pressed.connect(_choose_class.bind(id, class_key))
			parent.add_child(class_btn)
	if int(Campaign.data().ch) <= Campaign.MAIN and not selected.is_empty():
		var no := int(Campaign.data().ch)
		var count := Campaign.merc_count(no)
		_add_label(parent, "용병 병종 · 장수마다 %d명 · 버튼을 눌러 창→기→궁으로 변경" % count, 16)
		for id: String in selected:
			var order := selected.find(id)
			var arms := Campaign.merc_arms(id)
			for slot in count:
				var officer_name := String(Characters.find(id).get("name", id))
				var arm_name := String(CampaignCommand.ARM_NAME[String(arms[slot])])
				var arm_btn := _button("%s 휘하 %d번 · %s병  ▸ 병종 변경" % [officer_name, slot + 1, arm_name], true)
				arm_btn.pressed.connect(_cycle_merc.bind(id, slot))
				parent.add_child(arm_btn)
		_add_label(parent, "적 편성 미리 보기", 16)
		var preview: Dictionary = Campaign.battle_board(no)
		if bool(preview.get("ok", false)):
			var enemy_ids: Array = preview.get("foes", [])
			var enemy_arms: Dictionary = CampaignCommand.foe_arms(String((preview.board as Dictionary).seed), enemy_ids)
			for foe_id_v: Variant in enemy_ids:
				var foe_id := String(foe_id_v)
				var foe_name := String(Characters.find(foe_id).get("name", foe_id))
				_add_label(parent, "%s 휘하 · %s병" % [foe_name, CampaignCommand.arm_names(enemy_arms.get(foe_id, []))], 15)
				var foe_class := String((preview.board as Dictionary).get("classes", {}).get(foe_id, ""))
				if foe_class != "": _add_label(parent, CampaignClass.line(foe_class), 14)
	if selected.is_empty(): _add_label(parent, "현재 출진할 수 있는 장수가 없습니다.", 18)


func _toggle_party(id: String) -> void:
	var selected := Campaign.party()
	if selected.has(id): selected.erase(id)
	else:
		if selected.size() >= 3: selected.pop_back()
		selected.push_front(id)
	if selected.is_empty(): selected = Campaign.roster().slice(0, 1)
	Campaign.set_party(selected)
	_rebuild()


func _cycle_merc(id: String, slot: int) -> void:
	Campaign.cycle_merc(id, slot)
	RealmSaveState.save()
	_rebuild()


func _choose_class(id: String, key: String) -> void:
	var result := Campaign.choose_class(id, key)
	if not bool(result.get("ok", false)): Toast.show(self, String(result.get("why", "직업을 고를 수 없습니다")), 2.5)
	_rebuild()


func _tab_gear(parent: VBoxContainer) -> void:
	var auto_button := _button("⚡ 좋은 장비 끼우기", true)
	auto_button.pressed.connect(func() -> void:
		var result := Campaign.auto_equip()
		Toast.show(self, "더 좋은 장비 %d칸을 자동 장착했습니다." % int(result.get("changed", 0)), 2.2)
		_rebuild()
	)
	parent.add_child(auto_button)
	var party := Campaign.party()
	if party.is_empty(): _add_label(parent, "먼저 출진 장수를 편성하세요.", 18); return
	if not party.has(_gear_officer): _gear_officer = String(party[0])
	_add_label(parent, "장수 고유 기술 · 무기·방어구·장신구 세 칸 · 보물 칸은 별도", 16)
	var select := HBoxContainer.new()
	parent.add_child(select)
	for id: String in party:
		var label := String(Characters.find(id).get("name", id))
		var btn := _button(label, true)
		btn.pressed.connect(func() -> void: _gear_officer = id; _rebuild())
		select.add_child(btn)
	var skill := CampaignSkills.of(_gear_officer)
	_add_label(parent, "✦ %s — %s" % [String(skill.get("name", "고유 기술 없음")), String(skill.get("desc", ""))], 18)
	var equipped_gear := Campaign.gear_of(_gear_officer)
	for slot: String in ["w", "a", "c"]:
		var iid := String(equipped_gear[slot])
		var item := CampaignGear.item(iid)
		var slot_name := String(CampaignGear.SLOT_NAMES[slot])
		_add_label(parent, "%s · %s%s" % [slot_name, String(item.get("name", "비어 있음")), (" — " + CampaignGear.line_of(item)) if not item.is_empty() else ""], 17)
		if iid != "":
			var unequip_btn := _button("%s 빼기" % slot_name, true)
			unequip_btn.pressed.connect(func() -> void: Campaign.unequip_gear(_gear_officer, slot); _rebuild())
			parent.add_child(unequip_btn)
	_add_label(parent, "장비 가방", 17)
	var gear_bag: Array = Campaign.data().gbag
	for gear_id_v: Variant in gear_bag.duplicate():
		var gear_id := String(gear_id_v)
		var gear_item := CampaignGear.item(gear_id)
		if gear_item.is_empty(): continue
		var gear_btn := _button("%s %s · %s · %s 장착" % [String(gear_item.emoji), String(CampaignGear.SLOT_NAMES[gear_item.slot]), String(gear_item.name), CampaignGear.line_of(gear_item)], true)
		gear_btn.pressed.connect(func() -> void: Campaign.equip_gear(_gear_officer, gear_id); _rebuild())
		parent.add_child(gear_btn)
	_add_label(parent, "기존 보물(별도 칸)", 16)
	var equipped := String(RealmSaveState.officer_item.get(_gear_officer, ""))
	var current := Treasure.item(equipped)
	_add_label(parent, "착용 중: %s" % (String(current.get("name", "없음"))), 18)
	if equipped != "":
		var off := _button("빼기", true)
		off.pressed.connect(func() -> void: Campaign.unequip(_gear_officer); _rebuild())
		parent.add_child(off)
	var bag: Array = Campaign.data().bag
	if bag.is_empty(): _add_label(parent, "가방이 비었습니다. 상점 탭에서 보물을 살 수 있습니다.", 16)
	for item_v: Variant in bag.duplicate():
		var iid := String(item_v)
		var it := Treasure.item(iid)
		var equip_btn := _button("%s %s · +%d 장착" % [String(it.get("emoji", "")), String(it.get("name", iid)), int(it.get("bonus", 0))], true)
		equip_btn.pressed.connect(func() -> void: Campaign.equip(_gear_officer, iid); _rebuild())
		parent.add_child(equip_btn)


func _tab_shop(parent: VBoxContainer) -> void:
	_add_label(parent, "장비 진열 · 장 진행에 따라 높은 등급 해제", 16)
	for gear_item: Dictionary in Campaign.gear_stock():
		var gear_price := CampaignGear.price(gear_item)
		var gear_grade := String(CampaignGear.GRADES[int(gear_item.grade)].name)
		var gear_btn := _button("%s %s %s · %s · 금 %d" % [gear_grade, String(CampaignGear.SLOT_NAMES[gear_item.slot]), String(gear_item.name), CampaignGear.line_of(gear_item), gear_price], int(Campaign.data().gold) >= gear_price)
		gear_btn.pressed.connect(func() -> void: Campaign.buy_gear(String(gear_item.id)); _rebuild())
		parent.add_child(gear_btn)
	_add_label(parent, "보물 상점 · 기존 보물 11종", 16)
	for it: Dictionary in Treasure.ITEMS:
		var p := Campaign.price(String(it.id))
		var btn := _button("%s %s · +%d · 금 %d" % [String(it.emoji), String(it.name), int(it.bonus), p], int(Campaign.data().gold) >= p)
		btn.pressed.connect(func() -> void: Campaign.buy(String(it.id)); _rebuild())
		parent.add_child(btn)


func _tab_talk(parent: VBoxContainer) -> void:
	var party := Campaign.party()
	_add_label(parent, "출진 짝의 기존 지원 단계와 관계를 확인합니다.", 16)
	if party.size() < 2: _add_label(parent, "대화할 짝을 보려면 두 명 이상 편성하세요.", 18); return
	for i in party.size():
		for j in range(i + 1, party.size()):
			var a := String(party[i]); var b := String(party[j])
			var lv := Support.level(RealmSaveState, a, b)
			var points := Support.points(RealmSaveState, a, b)
			var kind := Support.rel_kind(a, b)
			var names := "%s · %s" % [String(Characters.find(a).get("name", a)), String(Characters.find(b).get("name", b))]
			_add_label(parent, "%s — 지원 %s (%d점) · 관계 %s" % [names, Support.name_of(lv) if lv > 0 else "없음", points, kind if kind != "" else "없음"], 18)


func _dispatch() -> void:
	var cp := Campaign.data()
	var ch := Campaign.card(int(cp.ch))
	var stage: Dictionary = Scenario.STAGES.get(String(ch.get("id", "")), {})
	var key := String(cp.bonus.get("k", ""))
	var on: Variant = stage.get("on", "")
	var opens := not stage.is_empty() and (on is Array and (on as Array).has(key) or (not on is Array and (String(on) == "*" or String(on) == key)))
	if opens and String(stage.get("kind", "")) == "debate":
		_questions = RealmSaveState.debate_draw(String(Campaign.party()[0]))
		_answers = []
		_question_index = 0
		cp.step = "debate"
		_rebuild()
	elif opens and String(stage.get("kind", "")) == "duel":
		_duel_round = 0
		_duel_done = false
		_duel_rng.seed = hash("campaign|%d|%d|%d" % [int(cp.round), int(cp.ch), int(cp.tries)])
		cp.step = "duel"
		_rebuild()
	else:
		_open_battle()


func _show_debate() -> void:
	var ch := Campaign.card(int(Campaign.data().ch))
	var stage: Dictionary = Scenario.STAGES.get(String(ch.get("id", "")), {})
	if _question_index >= _questions.size():
		var res: Dictionary = RealmSaveState.debate_result(_questions, _answers)
		var st := Scenario.fresh()
		var outcome := Scenario.debate_outcome(st, String(ch.id), int(res.correct))
		_apply_stage(outcome)
		Campaign.data().step = "camp"
		_open_battle()
		return
	var q: Dictionary = _questions[_question_index]
	_add_label(_body, "설전 · %s" % String(stage.get("title", "")), 25)
	_add_label(_body, "문답 %d/3 · %s" % [_question_index + 1, String(q.get("q", ""))], 20)
	for i in q.get("choices", []).size():
		var b := _button(String(q.choices[i]), true)
		b.pressed.connect(_answer_debate.bind(i))
		_body.add_child(b)


func _answer_debate(idx: int) -> void:
	_answers.append(idx)
	_question_index += 1
	_rebuild()


func _show_duel() -> void:
	var ch := Campaign.card(int(Campaign.data().ch))
	var stage: Dictionary = Scenario.STAGES.get(String(ch.get("id", "")), {})
	_add_label(_body, "일기토 · %s" % String(stage.get("title", "")), 25)
	_add_label(_body, "장수: %s · 상대: %s" % [_officer_name(String(Campaign.party()[0])), String(stage.get("foe", "상대"))], 18)
	_add_label(_body, "%d수째 — 어떤 수를 낼까요? 베기 > 막기 > 찌르기 > 베기" % (_duel_round + 1), 20)
	for move: String in RealmWar.DUEL_MOVES:
		var b := _button(String(RealmWar.DUEL_MOVE_NAME[move]), true)
		b.pressed.connect(_pick_duel.bind(move))
		_body.add_child(b)
	var cancel := _button("일기토 건너뛰기", true)
	cancel.pressed.connect(_open_battle)
	_body.add_child(cancel)


func _pick_duel(move: String) -> void:
	if _duel_done: return
	_duel_round += 1
	var foe := RealmWar.duel_ai_move(_duel_rng)
	var result := String(RealmWar.duel_round_result(move, foe))
	if result == "tie" and _duel_round < Scenario.DUEL_MAX:
		_rebuild()
		return
	_duel_done = true
	var st := Scenario.fresh()
	var outcome := Scenario.duel_outcome(st, String(Campaign.card(int(Campaign.data().ch)).id), result == "win")
	_apply_stage(outcome)
	_open_battle()


func _apply_stage(outcome: Dictionary) -> void:
	var runner := get_tree().get_first_node_in_group("realm_scenario")
	if runner != null: runner.call("apply_fx", outcome.get("fx", []))
	RealmSaveState.save()


func _open_battle() -> void:
	var cp := Campaign.data()
	var no := int(cp.ch)
	_last_side_result = {}
	_last_side_gold = 0
	Campaign.auto_equip()
	_last_end_line = ""
	_last_chest_gear = []
	var built := Campaign.battle_board(no)
	if not bool(built.get("ok", false)):
		cp.step = "camp"
		RealmSaveState.save()
		_rebuild()
		return
	cp.step = "battle"
	RealmSaveState.save()
	var scene := get_tree().current_scene
	RealmTacticsView.open(scene, String(built.enemy_id), {"board": built.board, "mine": built.mine}, _on_battle_done.bind(no))


func _on_battle_done(grid: Dictionary, no: int) -> void:
	var result: Dictionary = Campaign.apply_result(no, grid)
	_last_side_result = (result.get("side", {}) as Dictionary).duplicate(true)
	_last_side_gold = int(result.get("sideGold", 0))
	_last_chest_gear = result.get("chestGear", []).duplicate(true)
	var speaker_ids: Array = Campaign.party()
	var speaker := _officer_name(String(speaker_ids[0])) if not speaker_ids.is_empty() else "첫째 장수"
	_last_end_line = "🗨️ %s: %s" % [speaker, BattleScript.end_line(String(Campaign.card(no).get("id", "")), bool(result.get("win", false)))]
	_rebuild()

func _side_result_text(side: Dictionary, gold: int) -> String:
	var line := "보조 목표 — 보물 %d/%d · 마을 %d/%d" % [int(side.get("loot", 0)), int(side.get("chests", 0)), int(side.get("kept", 0)), int(side.get("total", 0))]
	if gold > 0: line += " · 추가 금 +%d" % gold
	return line

func _chest_gear_text(items: Array) -> String:
	var names: Array[String] = []
	for item: Dictionary in items: names.append("%s %s" % [String(CampaignGear.SLOT_NAMES.get(String(item.slot), "장비")), String(item.name)])
	return "📦 상자에서 장비 획득 · " + " · ".join(names)


func _show_result() -> void:
	var cp := Campaign.data()
	var no := int(cp.ch) - 1
	var last := Campaign.card(no)
	_add_label(_body, "승리 · %s" % String(last.get("title", "")), 30)
	_add_label(_body, "%d장 보상: 금 · 경험 · 전리품을 받았습니다." % no, 20)
	if _last_end_line != "": _add_label(_body, _last_end_line, 18)
	if not _last_side_result.is_empty(): _add_label(_body, _side_result_text(_last_side_result, _last_side_gold), 18)
	if not _last_chest_gear.is_empty(): _add_label(_body, _chest_gear_text(_last_chest_gear), 18)
	var last_gear: Dictionary = cp.get("last_gear", {})
	if not last_gear.is_empty():
		_add_label(_body, "🎁 장비 획득 · %s %s — %s" % [String(CampaignGear.SLOT_NAMES[last_gear.slot]), String(last_gear.name), CampaignGear.line_of(last_gear)], 18)
	if no < Campaign.ALL:
		_add_button(_body, "다음 장으로", func() -> void: Campaign.continue_after_result(); _rebuild())
	else:
		_add_button(_body, "천하 평정", func() -> void: Campaign.continue_after_result(); _rebuild())


func _show_round_end() -> void:
	_add_label(_body, "👑 천하 평정", 32)
	_add_label(_body, "19장 후일담을 모두 마쳤습니다. 장수·성장·보물은 이어지고, 다음 회차 적 병력은 정본대로 15% 늘어납니다.", 20)
	_add_button(_body, "새 회차 시작", _start_round)
	_add_button(_body, "노선도 보기", func() -> void: Campaign.data().step = "route"; _rebuild())


func _start_round() -> void:
	Campaign.new_round()
	_rebuild()


func _open_menu() -> void:
	var menu := get_tree().get_first_node_in_group("saga_menu_screen")
	if menu != null: menu.call("toggle")


func _officer_name(id: String) -> String:
	var h: Variant = Characters.find(id)
	return String(h.get("name", id)) if h is Dictionary else id


func _campaign_names() -> Dictionary:
	var strategist := String(RealmSaveState._best_officer_for("wisdom"))
	var champion := String(RealmSaveState._best_officer_for("might"))
	if strategist == "": strategist = String(RealmSaveState.current_lord_id)
	if champion == "": champion = String(RealmSaveState.current_lord_id)
	return {"책사": _officer_name(strategist), "맹장": _officer_name(champion), "이웃": "이웃 군주"}


func _add_label(parent: Control, text: String, size: int) -> Label:
	var label := Label.new()
	label.text = text
	label.add_theme_font_size_override("font_size", size)
	label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	parent.add_child(label)
	return label


func _button(text: String, enabled: bool) -> Button:
	var b := Button.new()
	b.text = text
	b.disabled = not enabled
	b.custom_minimum_size = Vector2(0, 48)
	b.add_theme_font_size_override("font_size", 18)
	b.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	return b


func _add_button(parent: Control, text: String, action: Callable) -> void:
	var b := _button(text, true)
	b.pressed.connect(action)
	parent.add_child(b)
