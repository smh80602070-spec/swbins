extends Node

## G-0417 — 실제 autoload와 Forward+로 진영 용병 편성·지휘 범위를 촬영한다.
const Campaign := preload("res://games/saga_realm/data/realm_campaign.gd")
const TacticsView := preload("res://games/saga_realm/world/realm_tactics_view.gd")

var _out_dir := ""
var _save: Node
var _scene: Node


func _ready() -> void:
	call_deferred("_run")


func _run() -> void:
	OS.set_environment("SAGA_REALM_CAMPAIGN", "1")
	_save = get_tree().root.get_node("RealmSaveState")
	var temp_path := OS.get_environment("TEMP").path_join("saga_godot_command_shot_%d.json" % Time.get_ticks_usec())
	_save.path_override = temp_path
	_save.start_scenario("194")
	Campaign.data().step = "camp"
	_save.save()
	_out_dir = ProjectSettings.globalize_path("res://tools/_out/realm_command_g0417")
	DirAccess.make_dir_recursive_absolute(_out_dir)
	_scene = (load("res://games/saga_realm/world/TestCity.tscn") as PackedScene).instantiate()
	get_tree().root.add_child(_scene)
	get_tree().current_scene = _scene
	var view := _scene.get_node_or_null("RealmCampaignView")
	if view == null:
		(load("res://games/saga_realm/ui/realm_campaign_view.gd") as GDScript).call("attach", _scene.get_node("City"))
		await get_tree().process_frame
		view = _scene.get_node("RealmCampaignView")
	view.set("_tab", "party")
	view.call("_rebuild")
	await _capture_pair("formation")
	view.call("_open_battle")
	var battle := _scene.get_node("TacticsView")
	var uid := "me:" + String(Campaign.party()[0])
	battle.set("_sel", uid)
	battle.call("_refresh")
	await _capture_pair("command")
	print("SHOT realm_command %s" % _out_dir)
	for suffix in ["", ".tmp", ".bak"]:
		var path: String = temp_path + String(suffix)
		if FileAccess.file_exists(path): DirAccess.remove_absolute(path)
	get_tree().quit(0)


func _capture_pair(tag: String) -> void:
	for spec in [["wide", Vector2i(1280, 720)], ["tall", Vector2i(720, 1280)]]:
		DisplayServer.window_set_size(spec[1])
		for _frame in 4:
			await get_tree().process_frame
		var image := get_viewport().get_texture().get_image()
		var path := _out_dir.path_join("%s_%s.png" % [tag, String(spec[0])])
		var err := image.save_png(path)
		if err != OK: push_error("SHOT realm_command failed %s: %s" % [path, error_string(err)])
