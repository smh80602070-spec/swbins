extends Node

const Campaign := preload("res://games/saga_realm/data/realm_campaign.gd")
const BattleEvent := preload("res://games/saga_realm/data/realm_battle_event.gd")
const Characters := preload("res://saga_core/data/characters.gd")
const LivePortrait := preload("res://saga_core/ui/live_portrait.gd")

var _scene: Node
var _view: Node
var _out_dir := ""
var _temp_save_path := ""

func _ready() -> void:
	call_deferred("_run")

func _run() -> void:
	await get_tree().process_frame
	OS.set_environment("SAGA_REALM_CAMPAIGN", "1")
	OS.set_environment("SAGA_REALM_BATTLE_EVENT", "1")
	var save: Node = get_tree().root.get_node("RealmSaveState")
	_temp_save_path = OS.get_environment("TEMP").path_join("saga_godot_battle_event_shot_%d.json" % Time.get_ticks_usec())
	save.path_override = _temp_save_path
	save.start_scenario("194")
	Campaign.data(save).ch = 4
	Campaign.data(save).step = "camp"
	save.save()
	_scene = (load("res://games/saga_realm/world/TestCity.tscn") as PackedScene).instantiate()
	get_tree().root.add_child(_scene)
	get_tree().current_scene = _scene
	for _frame in 2: await get_tree().process_frame
	_view = _scene.get_node_or_null("RealmCampaignView")
	if _view == null:
		(load("res://games/saga_realm/ui/realm_campaign_view.gd") as GDScript).call("attach", _scene.get_node("City"))
		await get_tree().process_frame
		_view = _scene.get_node("RealmCampaignView")
	_view.call("_rebuild")
	_view.call("_dispatch")
	for _frame in 35: await get_tree().process_frame
	var tactics_view := _scene.get_node_or_null("TacticsView")
	if tactics_view == null:
		push_error("SHOT realm_battle_event could not open tactical board")
		get_tree().quit(1)
		return
	var board: Dictionary = tactics_view.get("board")
	board.evLog.clear()
	if (board.ev.ally as Dictionary).is_empty():
		var portrait_ally := ""
		for hero: Dictionary in Characters.HEROES:
			var used := false
			for unit: Dictionary in board.units:
				if String(unit.get("id", "")) == String(hero.id): used = true; break
			if not used and LivePortrait.available(String(hero.id)): portrait_ally = String(hero.id); break
		if portrait_ally != "":
			var spec := {"id":portrait_ally, "arms":["spear","bow"], "hp":30}
			board.ev.ally = spec
			board.events.ally = spec
			board.battle_stats[portrait_ally] = {"might":60,"wisdom":60,"command":60}
	tactics_view.set("_event_seen", 0)
	tactics_view.set("_event_queue", [])
	tactics_view.set("_event_current", {})
	tactics_view.set("_event_elapsed", 0.0)
	board.turn = 3
	for unit: Dictionary in board.units:
		if String(unit.get("side", "")) == "me": unit.hp = float(unit.max) * 0.3
	BattleEvent.turn_start(board)
	tactics_view.call("_refresh")
	tactics_view.call("_process", 0.0)
	for _frame in 5: await get_tree().process_frame
	_out_dir = ProjectSettings.globalize_path("res://tools/_out/realm_battle_event_g0420")
	DirAccess.make_dir_recursive_absolute(_out_dir)
	await _capture_pair("reinforcement")
	tactics_view.set("_event_elapsed", BattleEvent.SHOW_SECONDS + 0.1)
	tactics_view.call("_process", 0.0)
	for _frame in 5: await get_tree().process_frame
	await _capture_pair("ally")
	print("SHOT realm_battle_event %s" % _out_dir)
	for suffix in ["", ".tmp", ".bak"]:
		var generated: String = _temp_save_path + suffix
		if FileAccess.file_exists(generated): DirAccess.remove_absolute(generated)
	get_tree().quit(0)

func _capture_pair(tag: String) -> void:
	for spec in [["wide", Vector2i(1280, 720)], ["tall", Vector2i(720, 1280)]]:
		DisplayServer.window_set_size(spec[1])
		for _frame in 3: await get_tree().process_frame
		var image := get_viewport().get_texture().get_image()
		var path := _out_dir.path_join("%s_%s.png" % [tag, String(spec[0])])
		var err := image.save_png(path)
		if err != OK: push_error("SHOT realm_battle_event failed %s: %s" % [path, error_string(err)])
