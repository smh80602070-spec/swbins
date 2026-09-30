extends Button

## "제외" 목록 6번(결사) — socket_button.gd·vendor_button.gd와 같은 경계
## (HUD 버튼 하나가 ChoicePrompt로 확인을 받는다). 웹판 ui.js의
## `global.confirm('결사(決死)로 바꿉니다. 쓰러지면 이 판이 끝나고
## 다시 내려갈 수 없습니다. 되돌릴 수 없습니다.')`를 브라우저 confirm()
## 대신 기존 ChoicePrompt(켠다/그만둔다)로 옮겼다. admin.js가 이미 켜진
## 뒤엔 버튼을 비활성화하는 것과 같은 뜻으로, 여기서도 이미 켜져 있으면
## 확인창을 안 열고 바로 "이미 결사입니다"만 보여준다.

const ChoicePrompt := preload("res://saga_core/ui/choice_prompt.gd")
const Toast := preload("res://saga_core/ui/toast.gd")


func _ready() -> void:
	pressed.connect(_on_pressed)
	DungeonHardcoreState.hardcore_changed.connect(_refresh_look)
	_refresh_look()


## 켜진 뒤엔 해골을 채워(굵게) 표시 — 원작 admin.js가 버튼 문구를
## "이미 결사입니다"로 바꾸는 것과 같은 뜻의 최소 시각 신호.
func _refresh_look() -> void:
	text = "☠️" if not DungeonHardcoreState.hardcore else "💀"


func _on_pressed() -> void:
	if DungeonHardcoreState.hardcore:
		Toast.show(self, "이미 결사(決死)입니다 — 쓰러지면 이 판이 끝납니다.", 3.0)
		return
	var choices: Array = [
		{"label": "☠️ 켠다 — 되돌릴 수 없다", "cb": _on_confirm},
		{"label": "그만둔다", "cb": func() -> void: pass},
	]
	ChoicePrompt.build(get_tree().current_scene,
		"결사(決死)로 바꿉니다.\n쓰러지면 이 판이 끝나고 다시 내려갈 수 없습니다.\n되돌릴 수 없습니다.", choices)


func _on_confirm() -> void:
	if DungeonHardcoreState.enable():
		Toast.show(self, "☠️ 결사(決死) — 이제 쓰러지면 이 판이 끝난다.", 4.0)
