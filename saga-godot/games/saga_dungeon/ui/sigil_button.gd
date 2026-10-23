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
		Toast.show(self, "부적 던전 진행 중(티어 %d) — %s. 마지막 방까지 못 끈다." %
			[int(s.get("tier", 0)), DungeonSigilState.mods_text(s)], 4.0)
		return
	if DungeonSigilState.sigils.is_empty():
		Toast.show(self, "부적이 없다 — 보스를 잡으면 나온다.", 3.0)
		return
	var best_idx := _best_index()
	var s: Dictionary = DungeonSigilState.sigils[best_idx]
	var choices: Array = [
		{"label": "🔺 켠다 — 되돌릴 수 없다", "cb": func() -> void: _on_confirm(best_idx)},
	]
	var ins := inscribe_label(s)
	if ins != "":
		choices.append({"label": ins, "cb": func() -> void: _on_inscribe(best_idx)})
	choices.append({"label": "그만둔다", "cb": func() -> void: pass})
	ChoicePrompt.build(get_tree().current_scene,
		"부적 던전(티어 %d)을 켭니다.\n변형자: %s\n적이 세지는 대신 보상이 늘고, 마지막 방까지 못 끕니다." %
			[int(s.get("tier", 0)), DungeonSigilState.mods_text(s)], choices)


## G-0308 지도 장치 — 켜기 전 고르기 창의 ✒️ 줄(새길 수 없으면 "" — 줄을 안 만든다)
static func inscribe_label(s: Dictionary) -> String:
	if not DungeonSigilState.atlas_on():
		return ""
	var n := DungeonSigilState.extra_of(s).size()
	if n >= DungeonSigilState.ATLAS_MAX_EXTRA or DungeonSigilState.next_mod(s) == "":
		return ""
	return "✒️ 변형자 새기기 %d금 (%d/%d) · 금 ×%.1f" % [DungeonSigilState.inscribe_cost(s), n,
		DungeonSigilState.ATLAS_MAX_EXTRA, 1.0 + DungeonSigilState.ATLAS_LOOT_PER * (n + 1)]


func _on_inscribe(idx: int) -> void:
	var r: Dictionary = DungeonSigilState.inscribe(idx)
	if bool(r.get("ok", false)):
		Toast.show(self, "✒️ %s 새김 (−%d금)" % [str(r.get("key", "")), int(r.get("cost", 0))], 3.0)
		_on_pressed.call_deferred()   # 고르기 창 다시 — 이어 새기거나 켠다
	elif str(r.get("reason", "")) == "gold":
		Toast.show(self, "금이 모자란다(%d금)." % int(r.get("cost", 0)), 3.0)
	else:
		Toast.show(self, "더 새길 수 없다.", 3.0)


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
			[int(s.get("tier", 0)), DungeonSigilState.mods_text(s)], 4.0)
