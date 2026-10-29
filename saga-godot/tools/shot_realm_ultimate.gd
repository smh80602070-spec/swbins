extends Node

const Campaign := preload("res://games/saga_realm/data/realm_campaign.gd")

var _save: Node
var _root: Node
var _out := ""
var _temp := ""


func _ready() -> void:
	call_deferred("_run")


func _run() -> void:
	await get_tree().process_frame
	OS.set_environment("SAGA_REALM_CAMPAIGN", "1")
	_save = get_tree().root.get_node("RealmSaveState")
	_temp = OS.get_environment("TEMP").path_join("saga_godot_ultimate_shot_%d.json" % Time.get_ticks_usec())
	_save.path_override = _temp
	_save.start_scenario("194")
	_save.save()
	_root = (load("res://games/saga_realm/world/TestCity.tscn") as PackedScene).instantiate()
	get_tree().root.add_child(_root)
	get_tree().current_scene = _root
	_out = ProjectSettings.globalize_path("res://tools/_out/realm_ultimate_g0418")
	DirAccess.make_dir_recursive_absolute(_out)
	await get_tree().process_frame
	await get_tree().process_frame
	var view := _root.get_node_or_null("RealmCampaignView")
	if view == null:
		(load("res://games/saga_realm/ui/realm_campaign_view.gd") as GDScript).call("attach", _root.get_node("City"))
		await get_tree().process_frame
		view = _root.get_node("RealmCampaignView")
	view.call("_open_battle")
	for _i in 3: await get_tree().process_frame
	var battle := _root.get_node("TacticsView")
	battle.set("instant", true)
	var board: Dictionary = battle.get("board")
	var actor: Dictionary = (board.units as Array).filter(func(u: Dictionary) -> bool: return String(u.get("side", "")) == "me" and String(u.get("kind", "")) == "officer")[0]
	var foe: Dictionary = (board.units as Array).filter(func(u: Dictionary) -> bool: return String(u.get("side", "")) == "foe" and String(u.get("kind", "")) == "officer")[0]
	actor.skill.group = "might"
	actor.sp = 100
	actor.acted = false
	actor.moved = false
	var tx := int(actor.x) + 1
	if tx >= int(board.cols): tx = int(actor.x) - 1
	foe.x = tx
	foe.y = int(actor.y)
	foe.hp = foe.max
	foe.acted = false
	battle.call("_place", String(foe.uid), int(foe.x), int(foe.y))
	battle.set("_sel", String(actor.uid))
	battle.call("_refresh")
	for _frame in 4: await get_tree().process_frame
	var ready_image := get_viewport().get_texture().get_image()
	var ready_path: String = _out.path_join("gauge_ready.png")
	var ready_err := ready_image.save_png(ready_path)
	if ready_err != OK: push_error("SHOT realm_ultimate failed %s: %s" % [ready_path, error_string(ready_err)])
	await battle.call("_on_ultimate")
	await battle.call("pick_cell", tx, int(actor.y))
	for spec: Array in [["wide", Vector2i(1280, 720)], ["tall", Vector2i(720, 1280)]]:
		DisplayServer.window_set_size(spec[1])
		for _frame in 5: await get_tree().process_frame
		var image := get_viewport().get_texture().get_image()
		var path: String = _out.path_join("cutin_%s.png" % String(spec[0]))
		var err := image.save_png(path)
		if err != OK: push_error("SHOT realm_ultimate failed %s: %s" % [path, error_string(err)])
	var friend: Dictionary = (board.units as Array).filter(func(u: Dictionary) -> bool: return String(u.get("side", "")) == "me" and String(u.get("kind", "")) == "officer" and float(u.get("hp", 0.0)) > 0.0)[0]
	var enemy: Dictionary = (board.units as Array).filter(func(u: Dictionary) -> bool: return String(u.get("side", "")) == "foe" and String(u.get("kind", "")) == "officer" and float(u.get("hp", 0.0)) > 0.0)[0]
	enemy.skill.group = "might"
	enemy.sp = 100
	enemy.acted = false
	enemy.moved = false
	enemy.x = int(friend.x) + 1 if int(friend.x) + 1 < int(board.cols) else int(friend.x) - 1
	enemy.y = int(friend.y)
	battle.call("_place", String(enemy.uid), int(enemy.x), int(enemy.y))
	for unit: Dictionary in board.units:
		if String(unit.get("side", "")) == "me" and String(unit.get("kind", "")) == "troop": unit.acted = true
	board.side = "me"
	await battle.call("_on_end_turn")
	print("SHOT enemy ultimate history=%s side=%s" % [str(board.get("ultLog", [])), String(board.get("side", ""))])
	for spec: Array in [["wide", Vector2i(1280, 720)], ["tall", Vector2i(720, 1280)]]:
		DisplayServer.window_set_size(spec[1])
		for _frame in 5: await get_tree().process_frame
		var enemy_image := get_viewport().get_texture().get_image()
		var enemy_path: String = _out.path_join("enemy_cutin_%s.png" % String(spec[0]))
		var enemy_err := enemy_image.save_png(enemy_path)
		if enemy_err != OK: push_error("SHOT realm_ultimate failed %s: %s" % [enemy_path, error_string(enemy_err)])
	print("SHOT realm_ultimate %s" % _out)
	for suffix: String in ["", ".tmp", ".bak"]:
		var path: String = _temp + suffix
		if FileAccess.file_exists(path): DirAccess.remove_absolute(path)
	get_tree().quit(0)
