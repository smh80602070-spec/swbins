extends Button

## PLAN 101-2 DUNGEON ④(부적 던전, 2026-09-17) — hardcore_button.gd와
## 같은 경계(HUD 버튼 하나 + ChoicePrompt 확인). 웹 원안의 "굴혈 앞
## 선택 카드"를 이 슬라이스엔 따로 없는 허브 UI 대신 버튼 하나로
## 근사했다 — 인벤 중 티어가 가장 높은 부적을 골라 켠다. 켜진 뒤엔
## 결사처럼 "회차 한정"이라 마지막 방(test_room.gd is_final)에 닿을
## 때까지 못 끈다(dungeon_sigil_state.gd::activate() 참고 — is_active()
## 인 동안은 다시 activate() 해도 실패한다).

const ChoicePrompt := preload("res://saga_core/ui/choice_prompt.gd")
const Toast := preload("res://saga_core/ui/toast.gd")


func _ready() -> void:
	pressed.connect(_on_pressed)
	DungeonSigilState.sigil_changed.connect(_refresh_look)
	_refresh_look()


func _refresh_look() -> void:
	if DungeonSigilState.is_active():
		text = "🔺%d" % int(DungeonSigilState.active_sigil().get("tier", 0))
	else:
		text = "🔻%d" % DungeonSigilState.sigils.size()


func _on_pressed() -> void:
	if DungeonSigilState.is_active():
		var s := DungeonSigilState.active_sigil()
		var mods: Array = s.get("mods", [])
		Toast.show(self, "부적 던전 진행 중(티어 %d) — %s. 마지막 방까지 못 끈다." %
			[int(s.get("tier", 0)), ", ".join(mods)], 4.0)
		return
	if DungeonSigilState.sigils.is_empty():
		Toast.show(self, "부적이 없다 — 보스를 잡으면 나온다.", 3.0)
		return
	var best_idx := _best_index()
	var s: Dictionary = DungeonSigilState.sigils[best_idx]
	var choices: Array = [
		{"label": "🔺 켠다 — 되돌릴 수 없다", "cb": func() -> void: _on_confirm(best_idx)},
		{"label": "그만둔다", "cb": func() -> void: pass},
	]
	ChoicePrompt.build(get_tree().current_scene,
		"부적 던전(티어 %d)을 켭니다.\n변형자: %s\n적이 세지는 대신 보상이 늘고, 마지막 방까지 못 끕니다." %
			[int(s.get("tier", 0)), ", ".join(s.get("mods", []) as Array)], choices)


func _best_index() -> int:
	var best := 0
	for i in range(DungeonSigilState.sigils.size()):
		if int(DungeonSigilState.sigils[i].get("tier", 0)) > int(DungeonSigilState.sigils[best].get("tier", 0)):
			best = i
	return best


func _on_confirm(idx: int) -> void:
	if DungeonSigilState.activate(idx):
		var s: Dictionary = DungeonSigilState.active_sigil()
		Toast.show(self, "🔺 부적 던전 시작 — 티어 %d(%s)." %
			[int(s.get("tier", 0)), ", ".join(s.get("mods", []) as Array)], 4.0)
