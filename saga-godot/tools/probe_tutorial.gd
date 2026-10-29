extends Node
## G-0426 per-scene probe. It exercises ordered progress and save compatibility
## against temporary files, never the player's real save slot.
const DATA := {
	"dungeon": "res://games/saga_dungeon/data/tutorial.gd",
	"forest": "res://games/saga_forest/data/tutorial.gd",
	"story": "res://games/saga_story/data/tutorial.gd",
	"realm": "res://games/saga_realm/data/tutorial.gd",
}
const STATE := {"dungeon":"DungeonSaveState", "forest":"ForestSaveState", "story":"StorySaveState", "realm":"RealmSaveState"}
var game := ""
var fails := 0

func setup(game_key: String) -> void:
	game = game_key
	_run.call_deferred()

func _check(label: String, ok: bool, detail: String = "") -> void:
	if not ok:
		fails += 1
	print("TUTORIAL_PROBE %s %s %s" % ["ok" if ok else "FAIL", label, detail])

func _cleanup(path: String) -> void:
	for suffix in ["", ".bak", ".tmp"]:
		var full: String = path + String(suffix)
		if FileAccess.file_exists(full):
			DirAccess.remove_absolute(ProjectSettings.globalize_path(full))

func _run() -> void:
	if not DATA.has(game) or not STATE.has(game):
		_check("game", false, game)
		_finish()
		return
	var table: GDScript = load(DATA[game])
	var missions: Array = table.MISSIONS
	var ids: Array[String] = []
	for item: Dictionary in missions:
		ids.append(String(item.id))
	var done: Array[String] = []
	_check("fresh_line", table.line(done).begins_with("첫걸음 0/5"), table.line(done))
	_check("out_of_order_blocked", not table.complete(done, ids[1]) and done.is_empty())
	var state: Node = get_node("/root/" + String(STATE[game]))
	var saved_done: Array[String] = []
	for value: Variant in state.get("tutorial_done"):
		saved_done.append(String(value))
	var old_path := String(state.get("path_override"))
	state.set("tutorial_done", done)
	_refresh_goal_board()
	var goal_board := get_tree().get_first_node_in_group("goal_board")
	_check("goal_board_start", goal_board != null and String(goal_board.get("now_line")).begins_with("첫걸음 0/5"), String(goal_board.get("now_line")) if goal_board != null else "missing")
	if game == "realm":
		state.call("start_scenario", "194")
		_perform_action(game, ids[0], state)
		_check("real_map_open", (state.get("tutorial_done") as Array).has(ids[0]))
	else:
		var player := get_tree().get_first_node_in_group("player") as Node3D
		if player == null:
			_check("real_walk", false, "player group missing")
		else:
			var start := player.global_position
			player.set_physics_process(false)
			for observer: Node in get_tree().get_nodes_in_group("first_run_walk_observer"):
				observer.call("_process", 0.016)
			player.global_position = start + Vector3(6.0, 0.0, 0.0)
			for observer: Node in get_tree().get_nodes_in_group("first_run_walk_observer"):
				observer.call("_process", 0.016)
			var walk_done: bool = (get_node("/root/" + String(STATE[game])).get("tutorial_done") as Array).has(ids[0])
			_check("real_walk", walk_done, "observers=%d position=%s" % [get_tree().get_nodes_in_group("first_run_walk_observer").size(), str(player.global_position)])
			player.global_position = start
			player.set_physics_process(true)
	for i in range(1, ids.size()):
		var id: String = ids[i]
		_perform_action(game, id, state)
		_check("ordered_" + id, (state.get("tutorial_done") as Array).size() == i + 1, str(state.get("tutorial_done")))
	_check("finished_line", table.line(state.get("tutorial_done") as Array).is_empty())
	_check("legacy_complete", table.line(table.legacy_done()).is_empty())

	var temp_path := "user://tutorial_probe_%s.json" % game
	_cleanup(temp_path)
	state.set("path_override", temp_path)
	var partial: Array[String] = [ids[0], ids[1]]
	state.set("tutorial_done", partial)
	var save_ok := false
	if game == "dungeon":
		var save_player := get_tree().get_first_node_in_group("player") as Node3D
		save_ok = save_player != null
		if save_ok:
			state.call("save", save_player)
	else:
		save_ok = bool(state.call("save"))
	_check("temp_save", save_ok and FileAccess.file_exists(temp_path))
	var parsed: Variant = JSON.parse_string(FileAccess.get_file_as_string(temp_path)) if FileAccess.file_exists(temp_path) else null
	_check("saved_progress", parsed is Dictionary and (parsed as Dictionary).get("tutorial_done", []).size() == 2)
	state.set("tutorial_done", [])
	var loaded_ok := bool(state.call("try_load"))
	_check("round_trip", loaded_ok and (state.get("tutorial_done") as Array) == [ids[0], ids[1]])
	if parsed is Dictionary:
		(parsed as Dictionary).erase("tutorial_done")
		var f := FileAccess.open(temp_path, FileAccess.WRITE)
		if f != null:
			f.store_string(JSON.stringify(parsed))
			f.close()
			_check("legacy_load", bool(state.call("try_load")) and (state.get("tutorial_done") as Array).size() == ids.size())
		else:
			_check("legacy_load", false, "could not rewrite temporary fixture")
	else:
		_check("legacy_load", false, "saved JSON unavailable")
	var four_done: Array[String] = []
	for i in range(ids.size() - 1):
		four_done.append(ids[i])
	state.set("tutorial_done", four_done)
	if game == "dungeon":
		var save_player := get_tree().get_first_node_in_group("player") as Node3D
		if save_player != null:
			state.call("save", save_player)
	else:
		state.call("save")
	var after_save: Variant = JSON.parse_string(FileAccess.get_file_as_string(temp_path)) if FileAccess.file_exists(temp_path) else null
	_check("save_finishes_guide", after_save is Dictionary and (after_save as Dictionary).get("tutorial_done", []).size() == ids.size())
	_refresh_goal_board()
	_check("goal_board_return", goal_board != null and not String(goal_board.get("now_line")).contains("첫걸음"))
	state.set("tutorial_done", saved_done)
	state.set("path_override", old_path)
	_cleanup(temp_path)
	_finish()

func _perform_action(game_key: String, id: String, state: Node) -> void:
	match game_key + ":" + id:
		"dungeon:fight":
			state.call("mark_room_cleared", 0)
		"dungeon:recruit":
			get_node("/root/DungeonPartyState").call("recruit", "tutorial_probe")
		"dungeon:skill":
			state.call("tutorial_action", id)
		"forest:gather":
			state.call("add_item", "tutorial_probe", 1)
		"forest:talk":
			state.call("tutorial_action", id)
		"forest:quest":
			state.call("mark_quest_done", "tutorial_probe")
		"story:fight":
			state.call("add_kill", "tutorial_probe")
		"story:gather":
			state.call("add_mat", "tutorial_probe", 1)
		"story:talk":
			state.call("add_talk")
		"realm:map":
			var map_button := Button.new()
			map_button.set_script(load("res://games/saga_realm/ui/realm_map_button.gd"))
			add_child(map_button)
			map_button.call("_on_pressed")
		"realm:order":
			var result: Dictionary = state.call("execute_order", "agri")
			if bool(result.get("ok", false)):
				state.call("tutorial_action", id)
		"realm:month":
			var month_button := Button.new()
			month_button.set_script(load("res://games/saga_realm/ui/realm_month_button.gd"))
			add_child(month_button)
			month_button.call("_on_pressed")
		"realm:hire":
			state.call("tutorial_action", id)
		_:
			state.call("tutorial_action", id)

func _finish() -> void:
	print("TUTORIAL_PROBE %s fails=%d" % [game, fails])
	get_tree().quit()

func _refresh_goal_board() -> void:
	var root := get_tree().current_scene
	if root != null and root.has_method("_refresh_goal_board"):
		root.call("_refresh_goal_board")
	var city := root.get_node_or_null("City") if root != null else null
	if city != null and city.has_method("_refresh_goal_board"):
		city.call("_refresh_goal_board")
	for feed: Node in get_tree().get_nodes_in_group("story_goal_feed"):
		feed.call("_process", 0.016)
