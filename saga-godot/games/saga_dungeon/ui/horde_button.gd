extends Button

## PLAN 101-2 DUNGEON ⑤(난입, 2026-09-17) — hardcore_button.gd·sigil_button.gd
## 와 같은 경계(HUD 버튼 + ChoicePrompt 확인). 이 버튼은 확인만 받고,
## 실제 시작·스폰·HUD는 형제 노드 `horde_arena.gd`(그룹 "horde_arena")가
## 맡는다.

const ChoicePrompt := preload("res://saga_core/ui/choice_prompt.gd")
const Toast := preload("res://saga_core/ui/toast.gd")


func _ready() -> void:
	pressed.connect(_on_pressed)
	DungeonHordeState.horde_changed.connect(_refresh_look)
	_refresh_look()


func _refresh_look() -> void:
	text = "⏳" if DungeonHordeState.active else "🌊"
	disabled = DungeonHordeState.active


func _on_pressed() -> void:
	if DungeonHordeState.active:
		Toast.show(self, "이미 난입 중입니다.", 2.0)
		return
	var choices: Array = [
		{"label": "🌊 시작", "cb": _on_confirm},
		{"label": "그만둔다", "cb": func() -> void: pass},
	]
	ChoicePrompt.build(get_tree().current_scene,
		"난입(亂入)을 시작합니다.\n파도가 30초마다 밀려온다 — 15분을 버티면 보상, 쓰러지면 그 자리에서 끝난다.", choices)


func _on_confirm() -> void:
	var arenas := get_tree().get_nodes_in_group("horde_arena")
	if not arenas.is_empty():
		arenas[0].start_run()
