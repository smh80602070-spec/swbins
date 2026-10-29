extends Node

const Campaign := preload("res://games/saga_realm/data/realm_campaign.gd")
const Tactics := preload("res://games/saga_realm/data/realm_tactics.gd")

var _save: Node
var _scene: Node

func _ready() -> void:
	call_deferred("_run")

func _run() -> void:
	await get_tree().process_frame
	OS.set_environment("SAGA_REALM_CAMPAIGN", "1")
	var save := get_tree().root.get_node("RealmSaveState")
	var temp_path := OS.get_environment("TEMP").path_join("saga_side_goal_shot_%d.json" % Time.get_ticks_usec())
	save.path_override = temp_path
	save.start_scenario("194")
	Campaign.data(save).ch = 3
	Campaign.data(save).step = "camp"
	for attempt in 40:
		Campaign.data(save).tries = attempt
		var preview: Dictionary = Campaign.battle_board(3, save)
		if bool(preview.get("ok", false)) and String(preview.board.get("weather", "")) == "fog": break
	save.save()
	_scene = (load("res://games/saga_realm/world/TestCity.tscn") as PackedScene).instantiate()
	get_tree().root.add_child(_scene)
	get_tree().current_scene = _scene
	for _i in 3: await get_tree().process_frame
	var view := _scene.get_node_or_null("RealmCampaignView")
	if view == null:
		(load("res://games/saga_realm/ui/realm_campaign_view.gd") as GDScript).call("attach", _scene.get_node("City"))
		await get_tree().process_frame
		view = _scene.get_node("RealmCampaignView")
	view.call("_rebuild")
	view.set("_tab", "gear")
	view.call("_rebuild")
	for _i in 3: await get_tree().process_frame
	var out := ProjectSettings.globalize_path("res://tools/_out/realm_side_goal_g0423")
	DirAccess.make_dir_recursive_absolute(out)
	DisplayServer.window_set_size(Vector2i(1280, 720))
	for _i in 3: await get_tree().process_frame
	var gear_image := get_viewport().get_texture().get_image()
	var gear_path := out.path_join("campaign_auto_equip_button_forward_plus.png")
	var gear_error := gear_image.save_png(gear_path)
	if gear_error != OK: push_error("SHOT auto-equip save failed: %s" % error_string(gear_error))
	var equip_out := ProjectSettings.globalize_path("res://tools/_out/realm_auto_equip_g0424")
	DirAccess.make_dir_recursive_absolute(equip_out)
	gear_image.save_png(equip_out.path_join("gear_tab_auto_equip_button_forward_plus.png"))
	view.set("_tab", "party")
	view.call("_rebuild")
	view.call("_dispatch")
	for _i in 35: await get_tree().process_frame
	var tactics := _scene.get_node_or_null("TacticsView")
	if tactics == null or tactics.get("_side_status") == null:
		push_error("SHOT side-goal tactical HUD missing")
		get_tree().quit(1)
		return
	var status: Label = tactics.get("_side_status")
	if not status.visible or not status.text.contains("보물") or not status.text.contains("마을"):
		push_error("SHOT side-goal status missing: %s" % status.text)
		get_tree().quit(1)
		return
	var weather_status: Label = tactics.get("_weather_status")
	if String((tactics.get("board") as Dictionary).weather) == "fog" and (not weather_status.visible or not weather_status.text.contains("안개")):
		push_error("SHOT fog weather chip missing")
		get_tree().quit(1)
		return
	DisplayServer.window_set_size(Vector2i(1280, 720))
	for _i in 4: await get_tree().process_frame
	var image := get_viewport().get_texture().get_image()
	var path := out.path_join("campaign_chest_village_status_forward_plus.png")
	var err := image.save_png(path)
	if err != OK: push_error("SHOT side-goal save failed: %s" % error_string(err))
	else: print("SHOT realm_side_goal %s" % path)
	var weather_out := ProjectSettings.globalize_path("res://tools/_out/realm_weather_g0425")
	DirAccess.make_dir_recursive_absolute(weather_out)
	image.save_png(weather_out.path_join("campaign_fog_weather_chip_forward_plus.png"))
	var outcome := Tactics.apply({"kind":"win","winPct":10,"lossMul":1.0,"fallen":[],"wounded":[],"side":{"loot":2,"chests":2,"kept":2,"total":2}}, "campaign_3")
	tactics.call("_finish", outcome)
	for _i in 8: await get_tree().process_frame
	var result_image := get_viewport().get_texture().get_image()
	var result_path := out.path_join("campaign_chest_gear_victory_line_forward_plus.png")
	err = result_image.save_png(result_path)
	if err != OK: push_error("SHOT side-goal result save failed: %s" % error_string(err))
	else: print("SHOT realm_side_goal result %s" % result_path)
	result_image.save_png(equip_out.path_join("campaign_result_officer_line_forward_plus.png"))
	for suffix in ["", ".tmp", ".bak"]:
		var generated: String = temp_path + suffix
		if FileAccess.file_exists(generated): DirAccess.remove_absolute(generated)
	get_tree().quit(1 if err != OK else 0)
