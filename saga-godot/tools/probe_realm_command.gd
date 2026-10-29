extends Node

const Tactics := preload("res://games/saga_realm/data/realm_tactics.gd")
const Campaign := preload("res://games/saga_realm/data/realm_campaign.gd")
const Command := preload("res://games/saga_realm/data/realm_commander.gd")

var _fails := 0
var _checks := 0
var _save: Node
var _temp_path := ""


func _ready() -> void:
	call_deferred("_run")


func _check(ok: bool, label: String) -> void:
	_checks += 1
	if ok:
		print("REALM_COMMAND_PROBE %s ok" % label)
	else:
		_fails += 1
		push_error("REALM_COMMAND_PROBE %s FAIL" % label)


func _units(units: Array, side: String, merc_only := false) -> Array:
	return units.filter(func(u: Dictionary) -> bool: return String(u.get("side", "")) == side and (not merc_only or bool(u.get("merc", false))))


func _run() -> void:
	await get_tree().process_frame
	_save = get_tree().root.get_node("RealmSaveState")
	_temp_path = OS.get_environment("TEMP").path_join("saga_godot_command_probe_%d.json" % Time.get_ticks_usec())
	_save.path_override = _temp_path
	_save.start_scenario("194")
	var cp := Campaign.data()
	cp.ch = 1
	cp.step = "camp"
	var party: Array = Campaign.party()
	var first := String(party[0])
	Campaign.cycle_merc(first, 0)
	Campaign.cycle_merc(first, 0)
	_check(String(Campaign.merc_arms(first)[0]) == "bow", "merc_choice_persists")
	var built: Dictionary = Campaign.battle_board(1)
	var board: Dictionary = built.get("board", {})
	_check(bool(built.get("ok", false)) and bool(board.get("command", false)), "campaign_command_board_enabled")
	var mine := _units(board.get("units", []), "me", true)
	var foes := _units(board.get("units", []), "foe", true)
	_check(mine.size() == party.size() * 2 and foes.size() == built.get("foes", []).size() * 2, "two_mercs_per_officer")
	var selected_bow := false
	for u: Dictionary in mine:
		if String(u.get("cmd", "")) == "me:" + first and String(u.get("arm", "")) == "bow": selected_bow = true
	_check(selected_bow, "selected_merc_arm_used_in_battle")
	var foe_arm_a := Command.foe_arms(String(board.seed), built.foes)
	var foe_arm_b := Command.foe_arms(String(board.seed), built.foes)
	_check(foe_arm_a == foe_arm_b and foe_arm_a.size() == built.foes.size(), "foe_arms_seed_deterministic")
	var leader: Dictionary = Tactics.unit(board, "me:" + first)
	var expected_range := 2 + int(floor(float(_save._effective_stat(first, "command")) / 45.0))
	_check(int(leader.get("cmdR", 0)) == expected_range and int(leader.get("cmdA", 0)) == roundi(6.0 + float(_save._effective_stat(first, "command")) / 10.0), "command_radius_and_bonus")
	var merc: Dictionary = mine[0]
	merc.x = int(leader.x) + 1
	merc.y = int(leader.y)
	var foe := Tactics.unit(board, String(foes[0].uid))
	var mods := Tactics.hit_mods(board, merc, foe)
	_check(mods.has(["지휘", int(leader.cmdA)]), "command_aura_in_range")
	merc.x = 0
	merc.y = int(board.rows) - 1
	mods = Tactics.hit_mods(board, merc, foe)
	_check(not mods.has(["지휘", int(leader.cmdA)]), "command_aura_outside_range")
	merc.x = int(leader.x) + 1
	merc.y = int(leader.y)
	merc.hp = 10.0
	var before_resupply := float(merc.hp)
	Command.turn_start(board)
	_check(float(merc.hp) == minf(float(merc.max), before_resupply + roundi(float(merc.max) * 0.25)), "adjacent_resupply_25pct")
	var rout_board: Dictionary = board.duplicate(true)
	var rout_leader: Dictionary = Tactics.unit(rout_board, "me:" + first)
	rout_leader.hp = 0.0
	Command.sweep(rout_board)
	var routed := (rout_board.units as Array).filter(func(u: Dictionary) -> bool: return String(u.get("cmd", "")) == String(rout_leader.uid) and bool(u.get("merc", false)))
	_check(not routed.is_empty() and routed.all(func(u: Dictionary) -> bool: return float(u.hp) <= 0.0 and bool(u.get("fled", false))) and (rout_board.get("fled", []) as Array).size() == routed.size(), "leader_loss_causes_rout")
	var combat := {"seed":"G0417-counter", "n":0, "turn":1, "side":"me", "done":"", "srpg":true, "campaign":true, "command":true, "goal":"rout", "cols":5, "rows":4, "cells":[], "units":[], "log":[], "fled":[]}
	combat.cells.resize(20)
	combat.cells.fill("plain")
	var attacker := {"uid":"me:a", "kind":"officer", "side":"me", "hp":100.0, "max":100.0, "atk":1.0, "def":1.0, "rng":1, "x":1, "y":1, "moved":false, "acted":false, "fx":1, "fy":0}
	var defender := {"uid":"foe:d", "kind":"officer", "side":"foe", "hp":100.0, "max":100.0, "atk":20.0, "def":1.0, "rng":1, "x":2, "y":1, "moved":false, "acted":false, "fx":-1, "fy":0}
	combat.units = [attacker, defender]
	var strike: Dictionary = Tactics.attack(combat, "me:a", "foe:d")
	_check(bool(strike.get("ok", false)) and (combat.log as Array).size() >= 2 and bool((combat.log as Array)[-1].get("counter", false)), "adjacent_attack_gets_counter")
	var long_board: Dictionary = combat.duplicate(true)
	long_board.done = ""
	long_board.log = []
	long_board.units[0].acted = false
	long_board.units[0].moved = false
	long_board.units[0].rng = 2
	long_board.units[1].x = 3
	long_board.units[1].hp = 100.0
	Tactics.attack(long_board, "me:a", "foe:d")
	_check((long_board.log as Array).size() == 1, "two_cell_attack_no_counter")
	var skill_target: Dictionary = {"uid":"foe:s", "kind":"officer", "side":"foe", "hp":100.0, "max":100.0, "atk":20.0, "def":1.0, "rng":1, "x":2, "y":1, "skill":{"key":"bangyeok"}}
	var skill_board: Dictionary = combat.duplicate(true)
	skill_board.log = []
	skill_board.units = [attacker.duplicate(true), skill_target]
	var no_generic := Command.counter(skill_board, skill_board.units[0], skill_target, 95, Tactics.dmg_mul)
	_check(no_generic.is_empty() and (skill_board.log as Array).is_empty(), "inherent_counter_replaces_generic")
	var ai_board: Dictionary = {"seed":"G0417-ai", "n":0, "turn":1, "side":"me", "done":"", "srpg":true, "campaign":false, "command":true, "goal":"rout", "cols":5, "rows":4, "cells":combat.cells.duplicate(), "units":[], "log":[], "fled":[], "gate":[4,2], "hold":6}
	var ai_boss := {"uid":"me:boss", "id":"boss", "kind":"officer", "side":"me", "hp":100.0, "max":100.0, "atk":1.0, "def":1.0, "rng":1, "mov":2, "x":1, "y":2, "moved":false, "acted":false, "cmdR":3, "cmdA":12}
	var ai_merc := {"uid":"me:merc", "id":"", "kind":"troop", "merc":true, "cmd":"me:boss", "arm":"spear", "side":"me", "hp":100.0, "max":100.0, "atk":9.0, "def":3.0, "rng":1, "mov":2, "x":1, "y":1, "moved":false, "acted":false}
	var ai_foe := {"uid":"foe:boss", "id":"foe", "kind":"officer", "side":"foe", "hp":100.0, "max":100.0, "atk":1.0, "def":1.0, "rng":1, "mov":2, "x":3, "y":1, "moved":false, "acted":false}
	ai_board.units = [ai_boss, ai_merc, ai_foe]
	Tactics.ai_turn(ai_board)
	_check((ai_board.log as Array).any(func(e: Dictionary) -> bool: return String(e.get("a", "")) == "me:merc"), "unacted_merc_auto_turn_action")
	var saved := bool(_save.save()) and bool(_save.try_load())
	_check(saved and String(Campaign.merc_arms(first)[0]) == "bow", "merc_choice_save_roundtrip")
	print("PROBE realm_command %s (%d checks)" % ["OK" if _fails == 0 else "FAIL %d" % _fails, _checks])
	for suffix in ["", ".tmp", ".bak"]:
		var path: String = _temp_path + suffix
		if FileAccess.file_exists(path): DirAccess.remove_absolute(path)
	get_tree().quit(0 if _fails == 0 else 1)
