extends Button

## "문답" 버튼 — quiz.js를 좁혀 옮긴 첫 슬라이스(2026-09-12, "1,2,3
## 순서대로 다해" 세 번째 — 완전히 새로운 시스템). 안 익힌 문제부터
## 쉬운 등급 순으로 내고, 다 익혔으면 틀린 것 위주로 복습한다
## (`RealmSaveState.quiz_draw()`). 보기 넷을 ChoicePrompt로 띄워
## 고르면 그대로 채점 — 다른 realm UI 버튼들과 같은 패턴.

const ChoicePrompt := preload("res://saga_core/ui/choice_prompt.gd")
const Toast := preload("res://saga_core/ui/toast.gd")
const Characters := preload("res://saga_core/data/characters.gd")

const TOAST_SEC := 5.0


func _ready() -> void:
	text = "문답"
	pressed.connect(_on_pressed)


func _on_pressed() -> void:
	var p := RealmSaveState.quiz_draw()
	if p.is_empty():
		Toast.show(self, "낼 문제가 없습니다", TOAST_SEC)
		return

	var layer_box := {}
	var choices: Array = []
	var opts: Array = p.choices
	for i in opts.size():
		var idx := i
		choices.append({
			"label": String(opts[idx]),
			"cb": func() -> void: _submit(p, idx, layer_box),
		})
	var mark := " (복습)" if bool(p.review) else ""
	var title := "[%s]%s %s" % [String(p.lv_name), mark, String(p.q)]
	layer_box["layer"] = ChoicePrompt.build(self, title, choices)


func _submit(p: Dictionary, idx: int, layer_box: Dictionary) -> void:
	(layer_box["layer"] as CanvasLayer).queue_free()
	var r := RealmSaveState.quiz_answer(p, idx)
	if not bool(r.get("ok", false)):
		return

	var msg: String
	if bool(r.correct):
		msg = "⭕ 정답! %s" % String(r.why)
		var reward: Dictionary = r.reward
		if bool(r.first):
			msg += " (첫 정답 +🪙%d)" % int(reward.gold)
			var got_id: String = String(reward.found)
			if not got_id.is_empty():
				var h = Characters.find(got_id)
				msg += " · 📚 %s 의 이름이 들려왔다" % (String(h.name) if h else got_id)
		else:
			msg += " (복습 +🪙%d)" % int(reward.gold)
	else:
		msg = "❌ 오답 — 정답은 「%s」. %s" % [String(r.answer_text), String(r.why)]
	Toast.show(self, msg, TOAST_SEC)
