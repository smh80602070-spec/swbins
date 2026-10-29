extends Node

const Tactics := preload("res://games/saga_realm/data/realm_tactics.gd")
const CampaignGear := preload("res://games/saga_realm/data/realm_campaign_gear.gd")
const CampaignSkills := preload("res://games/saga_realm/data/realm_hero_skills.gd")
const CampaignClass := preload("res://games/saga_realm/data/realm_class.gd")
const BattleScript := preload("res://games/saga_realm/data/realm_battle_script.gd")
const Characters := preload("res://saga_core/data/characters.gd")

var _fails := 0
var _checks := 0
var _save: Node
var _campaign: GDScript
var _temp_save_path := ""


func _ready() -> void:
	call_deferred("_run")


func _check(ok: bool, name: String) -> void:
	_checks += 1
	if not ok:
		_fails += 1
		push_error("REALM_CAMPAIGN_PROBE %s FAIL" % name)
	else:
		print("REALM_CAMPAIGN_PROBE %s ok" % name)


func _tree_has_text(root: Node, needle: String) -> bool:
	if root is Label and String((root as Label).text).contains(needle): return true
	if root is Button and String((root as Button).text).contains(needle): return true
	for child: Node in root.get_children():
		if _tree_has_text(child, needle): return true
	return false

func _find_button(root: Node, needle: String) -> Button:
	if root is Button and String((root as Button).text).contains(needle): return root as Button
	for child in root.get_children():
		var found := _find_button(child, needle)
		if found != null: return found
	return null


func _run() -> void:
	await get_tree().process_frame
	_save = get_tree().root.get_node("RealmSaveState")
	_campaign = load("res://games/saga_realm/data/realm_campaign.gd")
	OS.set_environment("SAGA_REALM_CAMPAIGN", "1")
	_temp_save_path = OS.get_environment("TEMP").path_join("saga_godot_campaign_probe_%d.json" % Time.get_ticks_usec())
	_save.path_override = _temp_save_path
	_save.start_scenario("194")
	var did_save: bool = bool(_save.save())
	var did_load: bool = bool(_save.try_load())
	print("REALM_CAMPAIGN_PROBE temp_save=%s load=%s path=%s" % [did_save, did_load, _save.save_path()])
	var scene: Node = (load("res://games/saga_realm/world/TestCity.tscn") as PackedScene).instantiate()
	get_tree().root.add_child(scene)
	get_tree().current_scene = scene
	await get_tree().process_frame
	_save.start_scenario("194")
	var all_gear := CampaignGear.items()
	_check(all_gear.size() == 60, "campaign_gear_60_items")
	var stock: Array = _campaign.gear_stock()
	_check(not stock.is_empty() and stock.size() <= 9, "campaign_gear_stock")
	var test_id := String(stock[0].id)
	var test_slot := String(stock[0].slot)
	_campaign.data().gold = 10000
	var bought: Dictionary = _campaign.buy_gear(test_id)
	_check(bool(bought.get("ok", false)) and _campaign.data().gbag.has(test_id), "campaign_gear_buy")
	var test_officer := String(_campaign.party()[0])
	var equipped: Dictionary = _campaign.equip_gear(test_officer, test_id)
	_check(bool(equipped.get("ok", false)) and String(_campaign.gear_of(test_officer)[test_slot]) == test_id, "campaign_gear_equip")
	var gear_unit := {"kind":"officer", "side":"me", "id":test_officer, "atk":20.0, "hp":50.0, "max":50.0, "mov":3, "gearDef":0, "gearHit":0, "gearCrit":0}
	CampaignGear.apply(gear_unit, _save)
	var test_item := CampaignGear.item(test_id)
	_check(float(gear_unit.atk) == 20.0 + int(test_item.atk) and int(gear_unit.mov) == 3 + int(test_item.mov), "campaign_gear_stats_apply")
	var replacement: Dictionary = {}
	for candidate: Dictionary in all_gear:
		if String(candidate.slot) == test_slot and String(candidate.id) != test_id: replacement = candidate; break
	_check(not replacement.is_empty(), "campaign_gear_replacement_candidate")
	if not replacement.is_empty():
		_campaign.data().gbag.append(String(replacement.id))
		var swapped: Dictionary = _campaign.equip_gear(test_officer, String(replacement.id))
		_check(bool(swapped.get("ok", false)) and _campaign.data().gbag.has(test_id), "campaign_gear_replaces_and_returns_old")
		test_id = String(replacement.id)
		test_item = CampaignGear.item(test_id)
	var skill_checks := 0
	var deterministic := true
	var has_epic := false
	var epic_ok := true
	var skill_keys: Dictionary = {}
	for hero: Dictionary in Characters.HEROES:
		var sk: Dictionary = CampaignSkills.of(String(hero.id))
		if sk.is_empty(): deterministic = false; continue
		if sk != CampaignSkills.of(String(hero.id)): deterministic = false
		skill_keys[String(sk.key)] = true
		if int(hero.get("rarity", 0)) >= 5:
			has_epic = true
			if float(sk.k) != 1.5 or not String(sk.name).ends_with("·극"): epic_ok = false
		skill_checks += 1
	_check(deterministic and skill_checks == Characters.HEROES.size(), "campaign_skills_all_deterministic")
	_check(skill_keys.size() == CampaignSkills.SKILLS.size(), "campaign_all_20_skills_assigned")
	_check(has_epic and epic_ok, "campaign_skill_epic_multiplier")
	var combat_probe := {"seed":"g0416", "turn":1, "hsN":0, "log":[], "units":[]}
	var skill_attacker := {"uid":"me:test", "kind":"officer", "side":"me", "hp":20.0, "max":100.0, "atk":20.0, "skill":{"key":"seonbong", "name":"선봉", "k":1.0}, "hsFirst":false}
	var skill_target := {"uid":"foe:test", "kind":"officer", "side":"foe", "hp":100.0, "max":100.0, "skill":{"key":"cheolbyeok", "name":"철벽", "k":1.0}}
	combat_probe.units = [skill_attacker, skill_target]
	_check(CampaignSkills.damage(combat_probe, skill_attacker, skill_target, 100) == 113, "campaign_skill_damage_and_first_strike")
	skill_target.skill = {"key":"bulgul", "name":"불굴", "k":1.0}
	skill_target.hp = 50.0
	_check(CampaignSkills.damage(combat_probe, skill_attacker, skill_target, 100) == 49, "campaign_skill_once_per_battle_survival")
	skill_attacker.skill = {"key":"heupyeol", "name":"흡혈", "k":1.0}
	skill_attacker.hp = 20.0
	skill_target.hp = 70.0
	CampaignSkills.after(combat_probe, skill_attacker, skill_target, true, 40)
	_check(float(skill_attacker.hp) == 34.0, "campaign_skill_lifesteal")
	var drop_a := CampaignGear.drop(8, "2:4", 1)
	var drop_b := CampaignGear.drop(8, "2:4", 1)
	_check(not drop_a.is_empty() and drop_a.id == drop_b.id and int(drop_a.grade) <= CampaignGear.top_grade(8, 1), "campaign_gear_deterministic_drop")
	var view_script: GDScript = load("res://games/saga_realm/ui/realm_campaign_view.gd")
	view_script.call("attach", scene.get_node("City"))
	await get_tree().process_frame
	var view := scene.get_node_or_null("RealmCampaignView")
	_check(view != null and (view as CanvasLayer).visible, "testcity_boot_route")
	if view == null:
		print("PROBE realm_campaign FAIL (%d checks)" % _checks)
		get_tree().quit(1)
		return
	_check(scene.get_node("City").visible == false and scene.get_node("WorldMap").visible == false, "campaign_hides_old_views")
	_check(_campaign.cards().size() == 19 and int(_campaign.data().ch) == 1, "card_count_and_start")
	var growth: Dictionary = _save._growth(test_officer)
	growth.lv = 5
	_check(_campaign.class_choices(test_officer).size() == 3 and bool(_campaign.choose_class(test_officer, "brave").get("ok", false)), "first_class_choice_saved_at_lv5")
	growth.lv = 12
	_check(_campaign.class_choices(test_officer).size() == 2 and bool(_campaign.choose_class(test_officer, "overlord").get("ok", false)), "promotion_choice_saved_at_lv12")
	var blocked: Dictionary = _campaign.choose(2, "atk")
	_check(not bool(blocked.get("ok", false)), "locked_chapter")
	view.call("_open_card", 1)
	view.call("_choose", 1, "atk")
	_check(String(_campaign.data().step) == "camp" and String(_campaign.data().bonus.k) == "atk", "story_choice")
	view.set("_gear_officer", test_officer)
	view.set("_tab", "gear")
	view.call("_rebuild")
	await get_tree().process_frame
	_check(_tree_has_text(view, String(CampaignSkills.of(test_officer).name)) and _tree_has_text(view, String(test_item.name)), "campaign_skill_gear_ui")
	view.set("_tab", "shop")
	view.call("_rebuild")
	await get_tree().process_frame
	var shop_stock: Array = _campaign.gear_stock()
	_check(_tree_has_text(view, "장비 진열") and not shop_stock.is_empty() and _tree_has_text(view, String(shop_stock[0].name)), "campaign_gear_shop_ui")
	view.set("_tab", "party")
	view.call("_rebuild")
	await get_tree().process_frame
	var built: Dictionary = _campaign.battle_board(1)
	_check(bool(built.get("ok", false)) and (built.board as Dictionary).get("srpg", false), "srpg_board_build")
	var chapter_one_open: Array = (built.board as Dictionary).events.get("script", {}).get("open", [])
	_check(not chapter_one_open.is_empty() and String(chapter_one_open[0][0]) == "n", "chapter_one_script_reaches_battle_board")
	var all_campaign_scripts := true
	for no in 16:
		if BattleScript.of(String(_campaign.card(no + 1).id)).is_empty(): all_campaign_scripts = false
	_check(all_campaign_scripts, "all_sixteen_campaign_battles_have_scripts")
	var chapter_before_event_check := int(_campaign.data().ch)
	_campaign.data().ch = 4
	var chapter_four: Dictionary = _campaign.battle_board(4)
	_check(bool(chapter_four.get("ok", false)) and String((chapter_four.board as Dictionary).events.get("reinforce", {}).get("id", "")) != "" and int((chapter_four.board as Dictionary).events.reinforce.get("turn", 0)) == 3, "chapter_four_turn3_reinforcement_spec")
	var chapter_four_open: Array = (chapter_four.board as Dictionary).events.get("script", {}).get("open", [])
	_check(not chapter_four_open.is_empty() and String(chapter_four_open[0][0]) == "n", "chapter_four_story_script_embedded")
	_campaign.data().ch = 3
	var chapter_three: Dictionary = _campaign.battle_board(3)
	_check(bool(chapter_three.get("ok", false)) and not (chapter_three.board as Dictionary).events.has("reinforce"), "nonreinforcement_chapter_no_extra_spec")
	_campaign.data().ch = chapter_before_event_check
	var skill_units: Array = built.board.units.filter(func(u: Dictionary) -> bool: return String(u.kind) == "officer")
	_check((built.board as Dictionary).campaign and skill_units.size() >= 2 and skill_units.all(func(u: Dictionary) -> bool: return not (u as Dictionary).get("skill", {}).is_empty()), "campaign_battle_skill_units")
	_check(String((built.board as Dictionary).classes.get(test_officer, "")) == "overlord", "class_choice_attached_to_campaign_board")
	var wearer_found := false
	for unit: Dictionary in built.board.units:
		if String(unit.get("id", "")) == test_officer:
			wearer_found = is_equal_approx(float(unit.atk), float(Tactics.js_round(10.0 + _save._effective_stat(test_officer, "might") / 5.0 + int(test_item.atk) + 10))) and float(unit.max) >= 90.0 and int(unit.get("gearDef", 0)) == int(test_item.def) and int(unit.get("gearHit", 0)) == int(test_item.hit) and int(unit.get("gearCrit", 0)) == int(test_item.crit) and int(unit.mov) == 3 + int(test_item.mov)
			break
	_check(wearer_found, "campaign_battle_equips_gear_stats")
	_check(_campaign.unequip_gear(test_officer, test_slot) and _campaign.data().gbag.has(test_id), "campaign_gear_unequip")
	var saved_party: Array = _campaign.party().duplicate()
	var saved_gear: Dictionary = _campaign.data().gear.duplicate(true)
	var saved_bag: Array = _campaign.data().gbag.duplicate()
	_campaign.set_party([test_officer])
	_campaign.data().gear[test_officer] = {"w":"gr_sword_n", "a":"gr_hide_n", "c":""}
	_campaign.data().gbag = ["gr_sword_u", "gr_sword_r", "gr_hide_u", "gr_scale_r", "gr_stirrup_n"]
	var auto_result: Dictionary = _campaign.auto_equip()
	var auto_slots: Dictionary = _campaign.gear_of(test_officer)
	_check(int(auto_result.changed) == 3 and auto_slots.w == "gr_sword_r" and auto_slots.a == "gr_scale_r" and auto_slots.c == "gr_stirrup_n", "auto_equip_chooses_best_grade_per_slot")
	_check(_campaign.data().gbag.has("gr_sword_n") and _campaign.data().gbag.has("gr_hide_n"), "auto_equip_returns_replaced_gear")
	var auto_bag_after: Array = _campaign.data().gbag.duplicate()
	_check(int(_campaign.auto_equip().changed) == 0 and _campaign.data().gbag == auto_bag_after, "auto_equip_repeat_is_idempotent")
	var old_tab := String(view.get("_tab"))
	_campaign.data().gbag.append("gr_sword_e")
	view.set("_tab", "gear")
	view.call("_rebuild")
	var auto_button := _find_button(view, "⚡ 좋은 장비 끼우기")
	_check(auto_button != null, "auto_equip_button_in_gear_tab")
	if auto_button != null: auto_button.emit_signal("pressed")
	_check(String(_campaign.gear_of(test_officer).w) == "gr_sword_e", "auto_equip_button_runs_upgrade")
	_campaign.data().gear = saved_gear
	_campaign.data().gbag = saved_bag
	_campaign.set_party(saved_party)
	view.set("_tab", old_tab)
	view.call("_rebuild")
	_campaign.data().gbag.append("gr_sword_l")
	view.call("_dispatch")
	await get_tree().process_frame
	var tv := scene.get_node_or_null("TacticsView")
	_check(tv != null, "tactics_view_open")
	_check(String(_campaign.gear_of(test_officer).w) == "gr_sword_l", "battle_open_auto_equips_best_gear")
	var gold_before_campaign_win := int(_campaign.data().gold)
	if tv != null:
		_check((tv.get("board") as Dictionary).events.get("script", {}).has("open"), "campaign_view_opens_same_board_with_script")
		var weather_label: Label = tv.get("_weather_status")
		var weather_line := Tactics.weather_text(tv.get("board"))
		_check(weather_label.visible == (weather_line != "") and weather_label.text == weather_line, "campaign_weather_chip_matches_board")
		var side_cells: Dictionary = (tv.get("board") as Dictionary).get("sg", {})
		_check(not side_cells.is_empty() and side_cells.get("chests", []).size() == 1, "campaign_chest_attached_to_board")
		var win: Dictionary = Tactics.apply({"kind": "win", "winPct": 10, "lossMul": 1.0, "fallen": [], "wounded": [], "side":{"loot":1,"chests":1,"kept":2,"total":2}}, "campaign_1")
		tv.call("_finish", win)
		await get_tree().process_frame
	_check(int(_campaign.data().ch) == 2 and String(_campaign.data().step) == "result", "done_callback_unlocks_next")
	var reward_gear: Dictionary = _campaign.data().get("last_gear", {})
	_check(not reward_gear.is_empty() and _campaign.data().gbag.has(String(reward_gear.id)), "campaign_victory_gear_drop")
	_check(_tree_has_text(view, String(reward_gear.get("name", ""))), "campaign_result_shows_gear")
	_check(int(_campaign.data().gold) >= gold_before_campaign_win + 190 + 270, "campaign_chest_village_and_all_kept_gold")
	_check(_tree_has_text(view, "보물"), "campaign_chest_result_summary")
	_check(String(view.get("_last_end_line")).contains("🗨️") and _tree_has_text(view, String(view.get("_last_end_line"))), "campaign_victory_officer_end_line")
	var gold_after_win := int(_campaign.data().gold)
	var duplicate: Dictionary = _campaign.apply_result(1, {"kind": "win"})
	_check(not bool(duplicate.get("ok", false)) and int(_campaign.data().gold) == gold_after_win, "duplicate_reward_blocked")
	_campaign.continue_after_result()
	_campaign.data().step = "battle"
	var gold_before_loss := int(_campaign.data().gold)
	var loss_payload := {"kind": "lose", "fallen": [], "wounded": [], "side":{"loot":2,"chests":2,"kept":1,"total":2}}
	var lost: Dictionary = _campaign.apply_result(2, loss_payload)
	_check(bool(lost.get("ok", false)) and not bool(lost.get("win", true)) and int(_campaign.data().ch) == 2 and String(_campaign.data().step) == "camp", "loss_retries_same_chapter")
	_check(int(lost.get("sideGold", 0)) == 140 and int(_campaign.data().gold) == gold_before_loss + 140, "loss_keeps_chest_reward_only")
	var chest_gear: Array = lost.get("chestGear", [])
	_check(chest_gear.size() == 1 and _campaign.data().gbag.has(String(chest_gear[0].id)), "one_in_three_chests_add_deterministic_gear")
	var repeated_loss: Dictionary = _campaign.apply_result(2, {"kind": "win"})
	_check(not bool(repeated_loss.get("ok", false)), "loss_callback_idempotent")
	_campaign.data().step = "battle"
	view.call("_on_battle_done", loss_payload, 2)
	_check(String(view.get("_last_end_line")).contains("🗨️") and _tree_has_text(view, "상자에서 장비 획득"), "campaign_loss_end_line_and_chest_gear_summary")
	var before_cancel := int(_campaign.data().gold)
	_campaign.data().step = "battle"
	view.call("_on_battle_done", {}, 2)
	_check(String(_campaign.data().step) == "camp" and int(_campaign.data().gold) == before_cancel, "cancel_returns_to_camp")
	var price_item: Dictionary = _campaign.buy("itm_scroll")
	_check(bool(price_item.get("ok", false)) and int(_campaign.data().gold) == before_cancel - _campaign.price("itm_scroll"), "shop_source_price")
	var round_trip: bool = bool(_save.save()) and bool(_save.try_load())
	_check(round_trip and String(_campaign.data().step) == "camp" and int(_campaign.data().ch) == 2 and _campaign.class_of(test_officer) == "overlord", "save_round_trip")
	var old: Variant = _save._migrate({"version": 31})
	_check(old is Dictionary and int(old.version) == 32, "save_version_migration")
	_check(_campaign.card(17).epilogue and _campaign.card(19).epilogue, "epilogues")
	OS.set_environment("SAGA_REALM_CAMPAIGN", "0")
	scene.get_node("City").call("_process", 0.0)
	scene.get_node("WorldMap").call("_process", 0.0)
	(view as CanvasLayer).visible = false
	_check(scene.get_node("City").visible and not (view as CanvasLayer).visible, "legacy_map_switch")
	print("PROBE realm_campaign %s (%d checks)" % ["OK" if _fails == 0 else "FAIL %d" % _fails, _checks])
	for suffix in ["", ".tmp", ".bak"]:
		var generated: String = _temp_save_path + suffix
		if FileAccess.file_exists(generated): DirAccess.remove_absolute(generated)
	get_tree().quit(0 if _fails == 0 else 1)
