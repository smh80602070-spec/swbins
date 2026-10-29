extends Node

## G-0416 visual QA — 실제 프로젝트 autoload로 1장 캠페인을 가로·세로 저장한다.
const Tactics := preload("res://games/saga_realm/data/realm_tactics.gd")
const Campaign := preload("res://games/saga_realm/data/realm_campaign.gd")

var _out_dir := ""
var _scene: Node
var _view: Node
var _save: Node
var _temp_save_path := ""


func _ready() -> void:
	call_deferred("_run")


func _run() -> void:
	await get_tree().process_frame
	OS.set_environment("SAGA_REALM_CAMPAIGN", "1")
	_save = get_tree().root.get_node("RealmSaveState")
	_temp_save_path = OS.get_environment("TEMP").path_join("saga_godot_campaign_shot_%d.json" % Time.get_ticks_usec())
	_save.path_override = _temp_save_path
	_save.start_scenario("194")
	Campaign.data().gold = 2000
	_save.save()
	_out_dir = ProjectSettings.globalize_path("res://tools/_out/realm_campaign_g0419")
	DirAccess.make_dir_recursive_absolute(_out_dir)
	_scene = (load("res://games/saga_realm/world/TestCity.tscn") as PackedScene).instantiate()
	get_tree().root.add_child(_scene)
	get_tree().current_scene = _scene
	await get_tree().process_frame
	await get_tree().process_frame
	_view = _scene.get_node_or_null("RealmCampaignView")
	if _view == null:
		(load("res://games/saga_realm/ui/realm_campaign_view.gd") as GDScript).call("attach", _scene.get_node("City"))
		await get_tree().process_frame
		_view = _scene.get_node("RealmCampaignView")
	await _capture_pair("route")
	_view.call("_open_card", 1)
	_view.call("_choose", 1, "atk")
	await get_tree().process_frame
	await _capture_pair("camp")
	_view.set("_tab", "gear")
	_view.call("_rebuild")
	await get_tree().process_frame
	await _capture_pair("gear")
	_view.set("_tab", "shop")
	_view.call("_rebuild")
	await get_tree().process_frame
	await _capture_pair("shop")
	_view.set("_tab", "party")
	_view.call("_rebuild")
	await get_tree().process_frame
	var class_officer := String(Campaign.party()[0])
	var class_growth: Dictionary = _save._growth(class_officer)
	class_growth.lv = 5
	_view.call("_rebuild")
	await get_tree().process_frame
	await _capture_pair("class_available")
	Campaign.choose_class(class_officer, "brave")
	class_growth.lv = 12
	_view.call("_rebuild")
	await get_tree().process_frame
	await _capture_pair("class_promote")
	Campaign.data().ch = 7
	_view.call("_rebuild")
	await get_tree().process_frame
	await _capture_pair("class_enemy_preview")
	Campaign.data().ch = 1
	_view.call("_rebuild")
	await get_tree().process_frame
	_view.call("_dispatch")
	for _frame in 30:
		await get_tree().process_frame
	await _capture_pair("battle")
	var tactics_view := _scene.get_node_or_null("TacticsView")
	if tactics_view != null:
		tactics_view.call("_select", "me:" + class_officer)
		for _frame in 4:
			await get_tree().process_frame
		await _capture_pair("battle_class")
		var win := Tactics.apply({"kind": "win", "winPct": 10, "lossMul": 1.0, "fallen": [], "wounded": []}, "campaign_1")
		tactics_view.call("_finish", win)
		for _frame in 3:
			await get_tree().process_frame
		await _capture_pair("result")
	print("SHOT realm_campaign %s" % _out_dir)
	for suffix in ["", ".tmp", ".bak"]:
		var generated: String = _temp_save_path + suffix
		if FileAccess.file_exists(generated): DirAccess.remove_absolute(generated)
	get_tree().quit(0)


func _capture_pair(tag: String) -> void:
	for spec in [["wide", Vector2i(1280, 720)], ["tall", Vector2i(720, 1280)]]:
		DisplayServer.window_set_size(spec[1])
		for _frame in 3:
			await get_tree().process_frame
		var img := get_viewport().get_texture().get_image()
		var path := _out_dir.path_join("%s_%s.png" % [tag, String(spec[0])])
		var err := img.save_png(path)
		if err != OK: push_error("SHOT realm_campaign failed %s: %s" % [path, error_string(err)])
