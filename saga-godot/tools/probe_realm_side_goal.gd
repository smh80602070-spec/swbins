extends Node

const Side := preload("res://games/saga_realm/data/realm_side_goal.gd")
const Tactics := preload("res://games/saga_realm/data/realm_tactics.gd")
const BattleScript := preload("res://games/saga_realm/data/realm_battle_script.gd")

var checks := 0
var fails := 0

func check(ok: bool, label: String) -> void:
	checks += 1
	if ok: print("REALM_SIDE_GOAL_PROBE %s ok" % label)
	else:
		fails += 1
		push_error("REALM_SIDE_GOAL_PROBE %s FAIL" % label)

func _ready() -> void:
	var board := {"campaign":true,"srpg":true,"seed":"side-probe","cols":10,"rows":8,"cells":[],"units":[],"evLog":[],"turn":1}
	board.cells.resize(80)
	board.cells.fill("plain")
	board.units = [{"uid":"me","side":"me","kind":"troop","hp":10,"max":10,"x":1,"y":1},{"uid":"foe","side":"foe","kind":"troop","hp":10,"max":10,"x":8,"y":6}]
	Side.setup(board, {"side":{"chests":1,"villages":2}})
	var placed: Dictionary = Side.cells(board)
	check(board.sg.chests.size() == 1 and board.sg.villages.size() == 2, "campaign_objective_counts_attached")
	var valid := true
	for point: Dictionary in board.sg.chests:
		valid = valid and int(point.x) >= 5 and int(point.x) <= 7 and point.x != 8
	for point: Dictionary in board.sg.villages:
		valid = valid and int(point.x) >= 4 and int(point.x) <= 5
	check(valid and placed.size() == 3, "deterministic_objectives_on_target_half")
	var chest: Dictionary = board.sg.chests[0]
	board.units[0].x = int(chest.x); board.units[0].y = int(chest.y)
	Side.scan(board)
	Side.scan(board)
	check(int(board.sg.loot) == 1 and board.evLog.size() == 1, "chest_opens_once_and_logs")
	var village: Dictionary = board.sg.villages[0]
	board.units[1].x = int(village.x); board.units[1].y = int(village.y)
	Side.foe_turn_end(board)
	check(not bool(village.burnt), "adjacent_player_protects_village")
	board.units[0].x = 0; board.units[0].y = 0
	Side.foe_turn_end(board)
	Side.foe_turn_end(board)
	check(bool(village.burnt) and board.evLog.size() == 2, "unguarded_village_burns_once")
	var outcome: Dictionary = Side.result(board)
	check(outcome == {"loot":1,"chests":1,"kept":1,"total":2}, "result_counts_loot_and_villages")
	var board_copy := {"sg":board.sg.duplicate(true)}
	var copied: Dictionary = Side.result(board_copy)
	check(copied == outcome, "result_state_copy_survives")
	board.done = "win"
	var grid_result: Dictionary = Tactics.apply(Tactics.outcome(board))
	check(grid_result.get("side", {}) == outcome, "tactics_result_carries_side_objectives")
	var lure_board := {"campaign":true,"srpg":true,"seed":"lure-probe","cols":10,"rows":8,"cells":[],"units":[],"evLog":[],"turn":1,"side":"foe","done":"","log":[],"goal":"rout","gate":[7,4],"hold":3}
	lure_board.cells.resize(80); lure_board.cells.fill("plain")
	var hunter := {"uid":"hunter","side":"foe","kind":"troop","hp":10,"max":10,"x":3,"y":3,"mov":2,"rng":1,"atk":5,"def":1,"moved":false,"acted":false}
	var rival := {"uid":"rival","side":"foe","kind":"troop","hp":10,"max":10,"x":9,"y":7,"mov":2,"rng":1,"atk":5,"def":1,"moved":false,"acted":false}
	var target := {"uid":"target","side":"me","kind":"troop","hp":10,"max":10,"x":0,"y":0,"mov":2,"rng":1,"atk":5,"def":1,"moved":false,"acted":false}
	lure_board.units = [hunter, rival, target]
	Side.setup(lure_board, {"side":{"chests":0,"villages":1}})
	lure_board.sg.villages = [{"x":5,"y":3,"burnt":false}]
	check(Side.lure(lure_board, hunter) == {"x":5,"y":3,"village":true}, "closest_enemy_troop_gets_village_lure")
	Tactics.act_auto(lure_board, hunter)
	check(int(hunter.x) > 3 and int(hunter.y) == 3, "enemy_troop_moves_toward_lured_village")
	hunter.x = 3; hunter.y = 3
	rival.x = 4; rival.y = 3
	check(Side.lure(lure_board, hunter).is_empty(), "only_closest_enemy_troop_lured")
	target.x = 5; target.y = 2
	check(Side.lure(lure_board, hunter).is_empty(), "player_adjacent_cancels_lure")
	var officer := hunter.duplicate(true); officer.kind = "officer"
	check(Side.lure(lure_board, officer).is_empty(), "only_enemy_troops_are_lured")
	hunter.x = 0; hunter.y = 7; rival.x = 9; rival.y = 7; target.x = 0; target.y = 0
	check(Side.lure(lure_board, hunter).is_empty(), "village_outside_five_cell_lure_range")
	check(BattleScript.end_line("r6_end", true) == "「천하의 끝… 함께 온 모두의 이름으로 맺는다.」", "chapter_specific_victory_line")
	check(BattleScript.end_line("r1_start", false) != "" and BattleScript.end_line("r1_start", false) == BattleScript.end_line("r1_start", false), "deterministic_common_defeat_line")
	print("PROBE realm_side_goal %d checks, %d failures" % [checks, fails])
	get_tree().quit(1 if fails else 0)
