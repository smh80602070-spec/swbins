extends Button

## G-0334 「🏆 시즌」 — ☰ 메뉴. 이번 시즌 번호·남은 날·점수·단계·좋은 판 다섯·지난 시즌 넷을 보여 주는 창(읽기만).
## guild_button.gd(4종횡)와 같은 꼴 — 공용 선택 창에 줄을 늘어놓고 닫기. 규칙은 data/dungeon_season.gd.

const ChoicePrompt := preload("res://saga_core/ui/choice_prompt.gd")
const Toast := preload("res://saga_core/ui/toast.gd")
const Season := preload("res://games/saga_dungeon/data/dungeon_season.gd")

var _layer: CanvasLayer = null


func _ready() -> void:
	text = "🏆"
	focus_mode = Control.FOCUS_NONE
	pressed.connect(open_screen)


func _close() -> void:
	if _layer != null and is_instance_valid(_layer):
		_layer.queue_free()
	_layer = null


func open_screen() -> bool:
	_close()
	if not Season.on():
		return false
	var rolled := Season.roll()   # 노는 사이 주가 바뀌었으면 여기서 닫는다
	if not rolled.is_empty():
		Toast.show(self, Season.roll_text(rolled), 5.0)
	var choices: Array = []
	for l: String in Season.lines().slice(1):
		choices.append({"label": l, "cb": open_screen})
	choices.append({"label": "닫기", "cb": _close})
	_layer = ChoicePrompt.build(get_tree().current_scene,
		String(Season.lines()[0]) + "\n살아 나온 등급 판 = 등급(D1~S5) × 급수(난도·부적) · 좋은 판 다섯 합 · 시즌이 넘어가면 단계 금", choices)
	return true
