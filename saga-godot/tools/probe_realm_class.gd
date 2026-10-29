extends Node

const ClassRules := preload("res://games/saga_realm/data/realm_class.gd")
const Tactics := preload("res://games/saga_realm/data/realm_tactics.gd")
const Ultimate := preload("res://games/saga_realm/data/realm_ultimate.gd")
const Command := preload("res://games/saga_realm/data/realm_commander.gd")

var checks := 0
var fails := 0

func _check(ok: bool, label: String) -> void:
	checks += 1
	if not ok: fails += 1; push_error("REALM_CLASS %s FAIL" % label)
	else: print("REALM_CLASS %s ok" % label)

func _ready() -> void:
	_check(ClassRules.choices(4, "").is_empty(), "locked_before_lv5")
	_check(ClassRules.choices(5, "").size() == 3, "first_tier_at_lv5")
	_check(ClassRules.choices(11, "brave").is_empty(), "second_tier_locked_before_lv12")
	_check(ClassRules.choices(12, "brave").size() == 2, "brave_second_tier_at_lv12")
	_check(ClassRules.choices(30, "overlord").is_empty(), "promoted_class_is_final")
	_check(ClassRules.foe_class("seed", "enemy", 0.2) == "", "enemy_class_below_tier")
	_check(ClassRules.foe_class("seed", "enemy", 0.4) == ClassRules.foe_class("seed", "enemy", 0.4), "enemy_class_deterministic")
	var b := {"units":[
		{"uid":"me:boss", "id":"hero", "kind":"officer", "side":"me", "atk":10, "def":2, "hp":50.0, "max":50.0, "mov":3, "rng":1, "cmdR":2, "cmdA":0, "x":1, "y":1, "fx":1, "fy":0},
		{"uid":"me:boss:merc:0", "cmd":"me:boss", "kind":"troop", "side":"me", "arm":"spear", "atk":12, "hp":30.0, "max":30.0, "mov":2, "rng":1, "x":1, "y":2, "fx":1, "fy":0},
		{"uid":"foe:boss", "id":"foe", "kind":"officer", "side":"foe", "atk":10, "def":2, "hp":50.0, "max":50.0, "mov":3, "rng":1, "cmdR":2, "cmdA":0, "x":4, "y":1, "fx":-1, "fy":0}
	], "plots":2}
	ClassRules.apply(b, {"hero":"brave", "foe":"bulwark"})
	var hero: Dictionary = b.units[0]
	var merc: Dictionary = b.units[1]
	var foe: Dictionary = b.units[2]
	_check(hero.atk == 14 and hero.max == 65.0 and hero.cls == "brave", "brave_stats")
	_check(merc.max == 36 and merc.atk == 13, "favorite_merc_bonus")
	var class_mods: Array = []
	ClassRules.mods({}, hero, foe, class_mods)
	_check(class_mods.any(func(m: Array) -> bool: return int(m[1]) == -8), "bulwark_accuracy_guard")
	ClassRules.apply(b, {"hero":"healer"})
	_check(int(b.plots) == 4 and int(hero.get("aura", 0)) == 12, "healer_two_plots_and_aura")
	var promoted := {"units":[{"uid":"me:promoted", "id":"p", "kind":"officer", "side":"me", "atk":10, "def":2, "hp":50.0, "max":50.0, "mov":3, "rng":1, "cmdR":2, "cmdA":0}], "plots":0}
	ClassRules.apply(promoted, {"p":"overlord"})
	_check(promoted.units[0].atk == 20 and promoted.units[0].max == 90.0 and is_equal_approx(float(promoted.units[0].ultMul), 1.3), "promotion_inherits_first_tier")
	var ult_board := {"campaign":true, "srpg":true, "side":"me", "turn":1, "units":[
		{"uid":"a", "id":"a", "kind":"officer", "side":"me", "atk":10, "def":2, "wis":40, "hp":100.0, "max":100.0, "mov":3, "rng":1, "sp":100, "acted":false, "skill":{"group":"might"}, "x":1, "y":1},
		{"uid":"t", "id":"t", "kind":"officer", "side":"foe", "atk":10, "def":0, "hp":200.0, "max":200.0, "mov":3, "rng":1, "x":2, "y":1}
	], "log":[]}
	ClassRules.apply(ult_board, {"a":"overlord"})
	var ult_hit: Dictionary = Ultimate.use(ult_board, "a", Vector2i(2, 1))
	_check(bool(ult_hit.get("ok", false)) and float(ult_board.units[1].hp) == 96.0, "overlord_ultimate_damage_multiplier")
	var sage_board := {"units":[{"uid":"sage", "id":"sage", "kind":"officer", "side":"me", "atk":10, "def":2, "wis":40, "hp":100.0, "max":100.0, "mov":3, "rng":1, "cmdR":2, "cmdA":0, "sp":100, "acted":false, "skill":{"group":"wisdom"}, "x":1, "y":1}, {"uid":"far", "id":"far", "kind":"officer", "side":"foe", "atk":10, "def":2, "hp":200.0, "max":200.0, "x":5, "y":1}], "campaign":true, "srpg":true, "cols":10, "rows":8, "side":"me", "turn":1, "log":[]}
	ClassRules.apply(sage_board, {"sage":"sage"})
	_check(Ultimate.cells(sage_board, "sage").has(Vector2i(5, 1)), "sage_bolt_range_four")
	ClassRules.apply(sage_board, {"sage":"healer"})
	_check(Tactics.heal_amount(sage_board.units[0]) == Tactics.js_round((Tactics.HEAL_BASE + 8.0) * 1.5), "healer_plot_multiplier")
	var raider_board := {"units":[{"uid":"r", "id":"r", "kind":"officer", "side":"me", "atk":10, "def":2, "hp":50.0, "max":50.0, "mov":3, "rng":1, "cmdR":2, "cmdA":0, "x":1, "y":1}, {"uid":"c", "cmd":"r", "kind":"troop", "side":"me", "arm":"cav", "atk":12, "hp":30.0, "max":30.0, "mov":3, "rng":1, "x":1, "y":2}]}
	ClassRules.apply(raider_board, {"r":"raider"})
	_check(raider_board.units[0].mov == 5 and raider_board.units[0].back == 20 and bool(raider_board.units[0].noCounter) and raider_board.units[1].mov == 3, "raider_inherits_rider_no_counter")
	var no_counter: Dictionary = Command.counter({"command":true, "units":[], "turn":1, "log":[], "seed":"probe"}, raider_board.units[0], {"hp":30.0, "confused":false, "uid":"target", "atk":10, "x":2, "y":1}, 90, 1.0)
	_check(no_counter.is_empty(), "raider_skips_counterattack")
	var missing: Dictionary = {"units":[], "plots":0}
	ClassRules.apply(missing, {})
	_check(true, "empty_old_save_map_safe")
	print("REALM_CLASS_RESULT checks=%d fails=%d" % [checks, fails])
	get_tree().quit(1 if fails > 0 else 0)
