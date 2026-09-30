extends Button

## "전임" 버튼 — war.js moveOfficer()를 옮긴 것(2026-09-12). 무장을 맞닿은
## 성으로 옮긴다(그 달의 명령을 쓴다). city_button.gd·order_button.gd와 같은
## ChoicePrompt 패턴이되 2단(무장 고르기 → 갈 성 고르기)이다.

const RealmCities := preload("res://games/saga_realm/data/realm_cities.gd")
const ChoicePrompt := preload("res://saga_core/ui/choice_prompt.gd")
const Toast := preload("res://saga_core/ui/toast.gd")
const Characters := preload("res://saga_core/data/characters.gd")

const TOAST_SEC := 2.5


func _ready() -> void:
	text = "전임"
	pressed.connect(_on_pressed)


func _on_pressed() -> void:
	var layer_box := {}
	var choices: Array = []
	for id: String in RealmSaveState.roster:
		var city_id: String = RealmSaveState.officer_city.get(id, "")
		var city_name := String(RealmCities.any_by_id(city_id).get("name", city_id))
		var h = Characters.find(id)
		choices.append({
			"label": "%s (%s) %s" % [String(h.name), city_name, RealmSaveState.officer_hint(id)],
			"cb": func() -> void: _pick_destination(id, city_id, layer_box),
		})
	layer_box["layer"] = ChoicePrompt.build(self, "전임 — 누구를", choices)


func _pick_destination(officer_id: String, from_city: String, layer_box: Dictionary) -> void:
	(layer_box["layer"] as CanvasLayer).queue_free()
	var dest_box := {}
	var choices: Array = []
	for city_id: String in RealmCities.playable_ids():
		if city_id == from_city or not RealmCities.is_adjacent(from_city, city_id):
			continue
		var name_ := String(RealmCities.any_by_id(city_id).get("name", city_id))
		choices.append({
			"label": name_,
			"cb": func() -> void: _run(officer_id, city_id, dest_box),
		})
	if choices.is_empty():
		Toast.show(self, "맞닿은 성이 없습니다", TOAST_SEC)
		return
	dest_box["layer"] = ChoicePrompt.build(self, "전임 — 어디로", choices)


func _run(officer_id: String, to_city_id: String, layer_box: Dictionary) -> void:
	(layer_box["layer"] as CanvasLayer).queue_free()
	var r := RealmSaveState.transfer_officer(officer_id, to_city_id)
	if not r.get("ok", false):
		Toast.show(self, "전임 — %s" % r.get("why", "실패"), TOAST_SEC)
		return
	var h = Characters.find(officer_id)
	var name_ := String(RealmCities.any_by_id(to_city_id).get("name", to_city_id))
	Toast.show(self, "%s 이(가) %s(으)로 갔다." % [String(h.name), name_], TOAST_SEC)
