extends Button

## PLAN 101-2 REALM ⑤후보(웹판 §5-2 "관계·이벤트 체인") — realm_promote_
## button.gd와 같은 ChoicePrompt 패턴이되 2단(대기 중인 카드 고르기 →
## 그 카드의 선택지 3개 고르기)이다. `RealmSaveState.ready_events()`가
## 빈 배열이면 "대기 중인 이벤트가 없습니다"만 띄운다(다른 버튼들과 같은
## 결 — 새 빈 상태 UI를 안 만든다).

const ChoicePrompt := preload("res://saga_core/ui/choice_prompt.gd")
const Toast := preload("res://saga_core/ui/toast.gd")
const Characters := preload("res://saga_core/data/characters.gd")
const RealmEvents := preload("res://games/saga_realm/data/realm_events.gd")

const TOAST_SEC := 2.5


func _ready() -> void:
	text = "사건"
	pressed.connect(_on_pressed)


func _on_pressed() -> void:
	var ready: Array[int] = RealmSaveState.ready_events()
	if ready.is_empty():
		Toast.show(self, "대기 중인 사건이 없습니다", TOAST_SEC)
		return
	var layer_box := {}
	var choices: Array = []
	for idx: int in ready:
		var e: Dictionary = RealmSaveState.active_events[idx]
		var def := RealmEvents.by_key(String(e.id))
		var h = Characters.find(String(e.officer))
		var name_text := String(h.name) if h != null else String(e.officer)
		choices.append({
			"label": "%s %s — %s" % [String(def.get("emoji", "📜")), name_text, String(def.get("name", ""))],
			"cb": func() -> void: _open_card(idx, layer_box),
		})
	layer_box["layer"] = ChoicePrompt.build(self, "사건 — 어느 것을", choices)


func _open_card(index: int, outer_box: Dictionary) -> void:
	(outer_box["layer"] as CanvasLayer).queue_free()
	if index < 0 or index >= RealmSaveState.active_events.size():
		return
	var e: Dictionary = RealmSaveState.active_events[index]
	var def := RealmEvents.by_key(String(e.id))
	if def.is_empty():
		return
	var h = Characters.find(String(e.officer))
	var name_text := String(h.name) if h != null else String(e.officer)
	var card_box := {}
	var choices: Array = []
	var opts: Array = def.get("choices", [])
	for i in opts.size():
		var c: Dictionary = opts[i]
		choices.append({
			"label": String(c.label),
			"cb": func() -> void: _resolve(index, i, card_box),
		})
	card_box["layer"] = ChoicePrompt.build(self, String(def.text) % name_text, choices)


func _resolve(index: int, choice_idx: int, card_box: Dictionary) -> void:
	(card_box["layer"] as CanvasLayer).queue_free()
	RealmSaveState.resolve_event(index, choice_idx)
