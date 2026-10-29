extends Button

## "지도" 버튼 — 성 하나짜리 디오라마(realm_city.gd)와 realm3d.js식
## 월드맵(realm_worldmap.gd, 성 셋을 한눈에)을 오간다. 두 화면·두 카메라가
## RealmSaveState.viewing_map을 각자 폴링해 visible/current를 맞춘다
## (FOREST gather_label.gd와 같은 폴링 패턴) — 이 버튼은 그 값 하나만
## 뒤집을 뿐이다.

func _ready() -> void:
	text = "지도"
	pressed.connect(_on_pressed)


func _on_pressed() -> void:
	RealmSaveState.viewing_map = not RealmSaveState.viewing_map
	if RealmSaveState.viewing_map:
		RealmSaveState.tutorial_action("map")
	if RealmSaveState.viewing_map:
		RealmSaveState.tutorial_action("map")
