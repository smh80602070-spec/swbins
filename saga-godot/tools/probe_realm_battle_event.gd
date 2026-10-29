extends Node

const Tactics := preload("res://games/saga_realm/data/realm_tactics.gd")
const BattleEvent := preload("res://games/saga_realm/data/realm_battle_event.gd")
const BattleScript := preload("res://games/saga_realm/data/realm_battle_script.gd")
const CampaignClass := preload("res://games/saga_realm/data/realm_class.gd")
const Characters := preload("res://saga_core/data/characters.gd")

var _checks := 0
var _fails := 0

func _check(ok: bool, label: String) -> void:
	_checks += 1
	if not ok:
		_fails += 1
		push_error("REALM_BATTLE_EVENT_PROBE %s FAIL" % label)
	else:
		print("REALM_BATTLE_EVENT_PROBE %s ok" % label)

func _run() -> void:
	var save: Node = get_tree().root.get_node("RealmSaveState")
	var campaign := load("res://games/saga_realm/data/realm_campaign.gd")
	OS.set_environment("SAGA_REALM_CAMPAIGN", "1")
	save.start_scenario("194")
	var heroes: Array = Characters.HEROES
	var reserve_me := String(heroes[1].id)
	var reserve_foe := String(heroes[2].id)
	var me_stats := {"might":60,"wisdom":60,"command":70}
	var foe_stats := {"might":65,"wisdom":50,"command":68}
	var b := Tactics.make_board_srpg("g0420-event-probe", "plain", false, "rout")
	b.campaign = true
	b.command = true
	b.merc_n = 2
	b.battle_stats = {"sg_zhugeliang":me_stats, reserve_me:me_stats, reserve_foe:foe_stats}
	b.classes = {reserve_me:"brave", reserve_foe:"brave"}
	var me := Tactics.officer_unit("sg_zhugeliang", "me", me_stats)
	me.x = 2; me.y = 2; me.hp = 10.0; me.max = 100.0
	var foe := Tactics.officer_unit("sg_lubu", "foe", foe_stats)
	foe.x = 5; foe.y = 2; foe.leader = true
	b.units = [me, foe]
	b.turn = 3
	var events := {"ally":{"id":reserve_me,"arms":["spear","bow"],"hp":27,"cls":"brave"},
		"reinforce":{"turn":3,"id":reserve_foe,"arms":["cav","spear"],"hp":28,"cls":"brave"}}
	BattleEvent.setup(b, events)
	var opening: Dictionary = b.evLog[0] if not b.evLog.is_empty() else {}
	_check(String(opening.get("kind", "")) == "start" and String(opening.get("text", "")).contains("「"), "seeded_opening_dialogue")
	_check(BattleEvent._pick(b, "start") == BattleEvent._pick(b, "start"), "dialogue_seed_deterministic")
	BattleEvent.turn_start(b)
	var arrived_ally := {}
	var arrived_foe := {}
	for unit: Dictionary in b.units:
		if String(unit.get("id", "")) == reserve_me: arrived_ally = unit
		if String(unit.get("id", "")) == reserve_foe: arrived_foe = unit
	_check(not arrived_ally.is_empty() and int(arrived_ally.x) == 0 and bool(arrived_ally.get("arrived", false)), "ally_enters_left_edge")
	_check(not arrived_foe.is_empty() and int(arrived_foe.x) == int(b.cols) - 1, "reinforcement_enters_right_edge")
	var merc_count := 0
	var ally_ready := not bool(arrived_ally.get("moved", true)) and not bool(arrived_ally.get("acted", true))
	for unit: Dictionary in b.units:
		if String(unit.get("cmd", "")) == String(arrived_ally.get("uid", "")):
			merc_count += 1
			ally_ready = ally_ready and not bool(unit.get("moved", true)) and not bool(unit.get("acted", true))
	_check(merc_count == 2 and ally_ready, "ally_squad_and_same_turn_actions")
	_check(String(b.classes.get(reserve_me, "")) == "brave", "arrival_class_applied")
	var event_count: int = b.evLog.size()
	BattleEvent.turn_start(b)
	_check(b.evLog.size() == event_count and b.units.size() == 8, "each_arrival_happens_once")
	me.hp = 50.0
	foe.hp = 49.0
	BattleEvent.scan(b)
	BattleEvent.scan(b)
	var low_lines: Array = b.evLog.filter(func(line: Dictionary) -> bool: return String(line.get("kind", "")) == "low")
	_check(low_lines.size() == 1 and String(low_lines[0].get("text", "")).contains(": "), "leader_low_dialogue_once")
	foe.hp = 0
	BattleEvent.scan(b)
	var downs: Array = b.evLog.filter(func(line: Dictionary) -> bool: return String(line.get("kind", "")) == "leaderDown")
	_check(downs.size() == 1, "leader_down_dialogue")
	arrived_foe.hp = 0
	BattleEvent.scan(b)
	var foe_down: Array = b.evLog.filter(func(line: Dictionary) -> bool: return String(line.get("kind", "")) == "foeDown")
	_check(foe_down.size() == 1, "foe_officer_down_dialogue")
	me.hp = 0
	BattleEvent.scan(b)
	var my_down: Array = b.evLog.filter(func(line: Dictionary) -> bool: return String(line.get("kind", "")) == "myDown")
	_check(my_down.size() == 1, "player_officer_down_dialogue")
	var boundary := Tactics.make_board_srpg("g0420-threshold", "plain", false, "rout")
	boundary.campaign = true
	boundary.turn = 3
	var boundary_me := Tactics.officer_unit("sg_zhugeliang", "me", me_stats)
	var boundary_foe := Tactics.officer_unit("sg_lubu", "foe", foe_stats)
	boundary_me.hp = 45.0; boundary_me.max = 100.0
	boundary_foe.hp = 100.0; boundary_foe.max = 100.0
	boundary.units = [boundary_me, boundary_foe]
	boundary.battle_stats = {reserve_me:me_stats}
	var boundary_events := {"ally":{"id":reserve_me,"arms":[],"hp":20}}
	BattleEvent.setup(boundary, boundary_events)
	BattleEvent.turn_start(boundary)
	var at_boundary: bool = boundary.units.any(func(unit: Dictionary) -> bool: return String(unit.get("id", "")) == reserve_me)
	_check(not at_boundary, "ally_not_triggered_at_exact_45_percent")
	boundary_me.hp = 44.99
	BattleEvent.turn_start(boundary)
	var below_boundary: bool = boundary.units.any(func(unit: Dictionary) -> bool: return String(unit.get("id", "")) == reserve_me)
	_check(below_boundary, "ally_triggers_below_45_percent")
	var old_log: int = b.evLog.size()
	OS.set_environment("SAGA_REALM_BATTLE_EVENT", "0")
	BattleEvent.setup(b, events)
	_check(b.get("ev", null) == null and b.evLog.is_empty(), "event_switch_off")
	OS.set_environment("SAGA_REALM_BATTLE_EVENT", "1")
	OS.set_environment("SAGA_REALM_CAMPAIGN", "0")
	b.campaign = false
	BattleEvent.setup(b, events)
	_check(b.get("ev", null) == null and b.evLog.is_empty(), "noncampaign_events_disabled")
	OS.set_environment("SAGA_REALM_CAMPAIGN", "1")
	_check(old_log > 0 and CampaignClass.CLS.has("brave"), "campaign_class_rules_available")
	_check(BattleScript.SCRIPTS.size() == 16 and BattleScript.of("r1_start").has("open") and BattleScript.of("unknown").is_empty(), "sixteen_chapter_scripts_and_safe_fallback")
	var story_board := Tactics.make_board_srpg("g0421-story-probe", "plain", false, "rout")
	story_board.campaign = true
	story_board.command = false
	var story_me := Tactics.officer_unit("sg_zhugeliang", "me", me_stats)
	var story_foe := Tactics.officer_unit("sg_lubu", "foe", foe_stats)
	story_me.x = 2; story_me.y = 2
	story_foe.x = 5; story_foe.y = 2; story_foe.leader = true
	story_board.units = [story_me, story_foe]
	story_board.events = {"script":BattleScript.of("r1_start")}
	BattleEvent.setup(story_board, story_board.events)
	_check(story_board.evLog.size() == 3 and String(story_board.evLog[0].get("kind", "")) == "story" and String(story_board.evLog[0].get("text", "")).begins_with("책사: "), "offboard_opening_speaker_queued")
	story_board.turn = 3
	BattleEvent.turn_start(story_board)
	var turn_lines: Array = story_board.evLog.filter(func(line: Dictionary) -> bool: return String(line.get("kind", "")) == "story")
	_check(turn_lines.size() == 2 and String(turn_lines[1].get("text", "")).begins_with("척후: "), "chapter_turn_script_queued_once")
	story_foe.hp = float(story_foe.max) * 0.4
	BattleEvent.scan(story_board)
	story_foe.hp = 0
	BattleEvent.scan(story_board)
	var scripted_low: Array = story_board.evLog.filter(func(line: Dictionary) -> bool: return String(line.get("kind", "")) == "low")
	var scripted_down: Array = story_board.evLog.filter(func(line: Dictionary) -> bool: return String(line.get("kind", "")) == "leaderDown")
	_check(scripted_low.size() == 1 and String(scripted_low[0].text).contains("이 성에") and scripted_down.size() == 1 and String(scripted_down[0].text).contains("첫 성의 밤"), "chapter_low_and_down_lines_override_common")
	print("PROBE realm_battle_event %s (%d checks)" % ["OK" if _fails == 0 else "FAIL %d" % _fails, _checks])
	get_tree().quit(0 if _fails == 0 else 1)

func _ready() -> void:
	call_deferred("_run")
