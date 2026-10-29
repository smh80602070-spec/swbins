extends Node

const Tactics := preload("res://games/saga_realm/data/realm_tactics.gd")

var checks := 0
var fails := 0

func check(ok: bool, label: String) -> void:
	checks += 1
	if ok: print("REALM_WEATHER_PROBE %s ok" % label)
	else:
		fails += 1
		push_error("REALM_WEATHER_PROBE %s FAIL" % label)

func _ready() -> void:
	var weather_counts := {"clear":0,"rain":0,"fog":0}
	for i in 200:
		var seed := "weather-%03d" % i
		var first := Tactics.weather_of(seed)
		weather_counts[first] = int(weather_counts[first]) + 1
		if i == 0: check(Tactics.weather_of(seed) == first, "seed_weather_deterministic")
	check(int(weather_counts["clear"]) >= 95 and int(weather_counts["clear"]) <= 125 and int(weather_counts["rain"]) >= 35 and int(weather_counts["rain"]) <= 65 and int(weather_counts["fog"]) >= 25 and int(weather_counts["fog"]) <= 55, "weather_distribution_near_55_25_20")
	var saved_weather_switch := Tactics.weather_enabled
	Tactics.weather_enabled = false
	check(Tactics.weather_of("forced-sunny") == "clear", "disabled_weather_forces_clear")
	Tactics.weather_enabled = saved_weather_switch
	var clear_seed := ""
	var fog_seed := ""
	for i in 2000:
		var seed := "arm-weather-%d" % i
		if int(floor(Tactics.hash01(seed, "arm") * 3.0)) != 0: continue
		if fog_seed == "" and Tactics.weather_of(seed) == "fog": fog_seed = seed
		if clear_seed == "" and Tactics.weather_of(seed) == "clear": clear_seed = seed
		if fog_seed != "" and clear_seed != "": break
	var fog_board := Tactics.make_board_srpg(fog_seed, "plain", false, "rout")
	var stats := {"m":{"might":60,"wisdom":80,"command":60},"f":{"might":60,"wisdom":80,"command":60}}
	Tactics.units_of_srpg(fog_board, ["m"], ["f"], [3000], stats, [3000])
	var fog_bow_range := -1
	for unit: Dictionary in fog_board.units:
		if String(unit.get("arm", "")) == "bow": fog_bow_range = int(unit.rng)
	check(String(fog_board.weather) == "fog" and fog_bow_range == 1, "fog_reduces_bow_range_after_setup")
	var clear_board := Tactics.make_board_srpg(clear_seed, "plain", false, "rout")
	Tactics.units_of_srpg(clear_board, ["m"], ["f"], [3000], stats, [3000])
	var clear_bow_range := -1
	for unit: Dictionary in clear_board.units:
		if String(unit.get("arm", "")) == "bow": clear_bow_range = int(unit.rng)
	check(String(clear_board.weather) == "clear" and clear_bow_range == 2, "clear_keeps_bow_range")
	var board := {"cols":6,"rows":4,"cells":[],"weather":"rain","units":[],"side":"me","done":"","plots":2,"turn":1}
	board.cells.resize(24); board.cells.fill("plain"); board.cells[2 * 6 + 3] = "forest"; board.cells[2 * 6 + 5] = "forest"
	var caster := {"uid":"me:caster","id":"caster","side":"me","kind":"officer","hp":80,"max":80,"wis":90,"x":2,"y":2,"acted":false,"moved":false}
	var target := {"uid":"foe:target","id":"target","side":"foe","kind":"officer","hp":80,"max":80,"wis":20,"x":5,"y":2,"acted":false,"moved":false}
	board.units = [caster,target]
	check(Tactics.fire_cells(board, caster.uid).is_empty(), "rain_blocks_fire")
	board.weather = "clear"
	check(Tactics.fire_cells(board, caster.uid).has({"x":5,"y":2}), "clear_fire_keeps_full_range")
	board.weather = "fog"
	check(not Tactics.fire_cells(board, caster.uid).has({"x":5,"y":2}) and Tactics.fire_cells(board, caster.uid).has({"x":3,"y":2}), "fog_reduces_fire_cell_range")
	check(Tactics.plot_targets(board, caster.uid, "confuse").is_empty(), "fog_reduces_confuse_range")
	check(Tactics.weather_text({"weather":"rain"}).contains("화계 불가") and Tactics.weather_text({"weather":"fog"}).contains("사거리 −1") and Tactics.weather_text({"weather":"clear"}) == "", "weather_hud_text_only_for_nonclear")
	print("PROBE realm_weather %d checks, %d failures" % [checks, fails])
	get_tree().quit(1 if fails else 0)
