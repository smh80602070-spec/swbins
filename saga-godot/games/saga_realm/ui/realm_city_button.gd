extends Button

## "성" 버튼 — 2026-09-12 여러 성 추가. 이 세력이 시작부터 갖고 있는 성
## 셋(진류·복양·허창, `realm_cities.gd`) 중 조망·명령 대상을 고른다.
## GO ChoicePrompt를 그대로 재사용(realm_order_button.gd와 같은 패턴) —
## 콜백이 ChoicePrompt.build()가 반환한 레이어를 직접 닫아야 하는 것도 같다.
##
## **2026-09-12 추가 — 정복 성 편입.** `RealmCities.CITIES` 대신
## `playable_ids()`를 돈다 — 소패를 함락하면 목록에 그대로 나타난다.
##
## 실제 3D 디오라마·카메라는 그대로 하나뿐이다(1절 "성 하나를 3D로
## 조망한다") — 성을 바꾸면 realm_city.gd가 current_city를 읽어 같은
## 자리에서 다시 짓는다.

const RealmCities := preload("res://games/saga_realm/data/realm_cities.gd")
const ChoicePrompt := preload("res://saga_core/ui/choice_prompt.gd")
const Toast := preload("res://saga_core/ui/toast.gd")

const TOAST_SEC := 2.0


func _ready() -> void:
	text = "성"
	pressed.connect(_on_pressed)


func _on_pressed() -> void:
	var layer_box := {}
	var choices: Array = []
	for cid: String in RealmCities.playable_ids():
		var mark := " (조망 중)" if cid == RealmSaveState.current_city else ""
		var name_ := String(RealmCities.any_by_id(cid).get("name", cid))
		choices.append({
			"label": "%s%s" % [name_, mark],
			"cb": func() -> void: _switch(cid, layer_box),
		})
	layer_box["layer"] = ChoicePrompt.build(self, "성 선택", choices)


func _switch(city_id: String, layer_box: Dictionary) -> void:
	(layer_box["layer"] as CanvasLayer).queue_free()
	RealmSaveState.current_city = city_id
	var city_def := RealmCities.any_by_id(city_id)
	Toast.show(self, "%s 조망" % String(city_def.get("name", "")), TOAST_SEC)
