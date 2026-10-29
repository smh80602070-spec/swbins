extends Node

const Ultimate := preload("res://games/saga_realm/data/realm_ultimate.gd")
const Tactics := preload("res://games/saga_realm/data/realm_tactics.gd")

var checks := 0
var failures := 0


func _ready() -> void:
	call_deferred("_run")


func _check(ok: bool, name: String) -> void:
	checks += 1
	if ok:
		print("REALM_ULTIMATE %s ok" % name)
	else:
		failures += 1
		push_error("REALM_ULTIMATE %s FAIL" % name)


func _board() -> Dictionary:
	var cells: Array = []
	cells.resize(25)
	cells.fill("plain")
	return {"seed":"ultimate-probe", "n":0, "turn":1, "side":"me", "done":"", "srpg":true, "campaign":true, "goal":"rout", "hold":6, "gate":[4, 2], "cols":5, "rows":5, "cells":cells, "units":[], "log":[], "ultLog":[]}


func _officer(uid: String, side: String, group: String, x: int, y: int) -> Dictionary:
	return {"uid":uid, "id":uid, "kind":"officer", "side":side, "skill":{"group":group}, "hp":100.0, "max":100.0, "atk":10.0, "def":2.0, "wis":40.0, "rng":1, "cmdR":2, "x":x, "y":y, "moved":false, "acted":false}


func _run() -> void:
	var start := _officer("me:start", "me", "might", 0, 0)
	var foe_start := _officer("foe:start", "foe", "wisdom", 4, 4)
	_check(Ultimate.gauge(start) == 30 and Ultimate.gauge(foe_start) == 0, "side_start_gauges")
	_check(Ultimate.kind_of(start) == "musang" and Ultimate.kind_of(foe_start) == "cheonroe" and Ultimate.kind_of(_officer("me:cmd", "me", "command", 0, 0)) == "chonggong", "three_skill_branches")
	var b := _board()
	var boss := _officer("me:boss", "me", "might", 1, 1)
	boss.sp = 100
	var main := _officer("foe:main", "foe", "wisdom", 2, 1)
	var splash := {"uid":"foe:side", "kind":"troop", "side":"foe", "hp":100.0, "max":100.0, "x":2, "y":2}
	b.units = [boss, main, splash]
	_check(Ultimate.ready(b, "me:boss") and Ultimate.cells(b, "me:boss").has(Vector2i(2, 1)), "musang_target_ready")
	var invalid := Ultimate.use(b, "me:boss", Vector2i(4, 4))
	_check(not bool(invalid.ok) and int(boss.sp) == 100, "invalid_cell_does_not_spend")
	var cast := Ultimate.use(b, "me:boss", Vector2i(2, 1))
	_check(bool(cast.ok) and int(main.hp) == 60 and int(splash.hp) == 90 and int(boss.sp) == 0 and bool(boss.acted), "musang_guaranteed_double_and_splash")

	var bolt_board := _board()
	var bolt_leader := _officer("me:bolt", "me", "wisdom", 1, 1)
	bolt_leader.sp = 100
	var bolt_a := {"uid":"foe:bolt_a", "kind":"troop", "side":"foe", "hp":100.0, "max":100.0, "x":4, "y":1}
	var bolt_b := {"uid":"foe:bolt_b", "kind":"officer", "side":"foe", "hp":100.0, "max":100.0, "x":4, "y":2}
	bolt_board.units = [bolt_leader, bolt_a, bolt_b]
	_check(Ultimate.cells(bolt_board, "me:bolt").has(Vector2i(4, 1)), "cheonroe_three_cell_range")
	var bolt_cast := Ultimate.use(bolt_board, "me:bolt", Vector2i(4, 1))
	_check(bool(bolt_cast.ok) and int(bolt_a.hp) == 52 and int(bolt_b.hp) == 52 and bolt_cast.hits.size() == 2, "cheonroe_hits_center_and_adjacent")

	var rally_board := _board()
	var rally := _officer("me:rally", "me", "command", 1, 1)
	rally.sp = 100
	var near_merc := {"uid":"me:near", "kind":"troop", "merc":true, "cmd":"me:rally", "side":"me", "hp":50.0, "max":100.0, "x":2, "y":1}
	var far_merc := {"uid":"me:far", "kind":"troop", "merc":true, "cmd":"me:rally", "side":"me", "hp":50.0, "max":100.0, "x":4, "y":1}
	rally_board.units = [rally, near_merc, far_merc]
	var rally_cast := Ultimate.use(rally_board, "me:rally", Vector2i(1, 1))
	var mods: Array = []
	Ultimate.mods(rally_board, near_merc, {}, mods)
	_check(bool(rally_cast.ok) and int(near_merc.hp) == 90 and int(far_merc.hp) == 50 and int(near_merc.rallyT) == 1 and mods.has(["총공격", 25]), "chonggong_heal_range_and_turn_bonus")

	var charge_board := _board()
	var charge_a := _officer("me:charge", "me", "might", 1, 1)
	var charge_t := _officer("foe:charge", "foe", "wisdom", 2, 1)
	var dead_merc := {"uid":"foe:dead", "kind":"troop", "merc":true, "cmd":"foe:charge", "side":"foe", "hp":0.0, "max":20.0, "x":2, "y":2}
	charge_board.units = [charge_a, charge_t, dead_merc]
	Ultimate.on_attack(charge_board, charge_a, charge_t, true)
	_check(int(charge_a.sp) == 60 and int(charge_t.sp) == 15, "attack_and_hit_gain_with_enemy_scale")
	Ultimate.on_attack(charge_board, charge_a, dead_merc, true)
	_check(int(charge_t.sp) == 30, "mercenary_loss_gain_to_commander")
	var hooked := _board()
	var hooked_a := _officer("me:hooked", "me", "might", 1, 1)
	var hooked_t := _officer("foe:hooked", "foe", "wisdom", 2, 1)
	hooked.units = [hooked_a, hooked_t]
	var basic := Tactics.attack(hooked, String(hooked_a.uid), String(hooked_t.uid))
	_check(bool(basic.ok) and int(hooked_a.sp) == 60 and int(hooked_t.sp) == (15 if bool(basic.hit) else 0), "regular_attack_hook_charges_gauges")

	var ai_board := _board()
	ai_board.side = "foe"
	var ai_boss := _officer("foe:ai", "foe", "might", 2, 1)
	ai_boss.sp = 100
	var ai_target := _officer("me:ai_target", "me", "wisdom", 3, 1)
	ai_board.units = [ai_boss, ai_target]
	Tactics.act_auto(ai_board, ai_boss)
	_check(int(ai_boss.sp) == 0 and int(ai_target.hp) == 60 and bool(ai_boss.acted), "enemy_ai_uses_ready_ultimate")
	var legacy := _board()
	legacy.campaign = false
	var legacy_a := _officer("me:legacy", "me", "might", 0, 0)
	_check(not Ultimate.ready(legacy, String(legacy_a.uid)), "disabled_outside_campaign")
	print("PROBE realm_ultimate %s (%d checks)" % ["OK" if failures == 0 else "FAIL %d" % failures, checks])
	get_tree().quit(0 if failures == 0 else 1)
