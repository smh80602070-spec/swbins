extends Button

## "명령" 버튼 — GO ChoicePrompt를 그대로 재사용해 rtk.js ORDERS 10종
## 전부(개간/상업/기술/치안/축성/징병/훈련/조선/수색/등용)를 고르는 패널을
## 띄운다(villager_builder.gd가 선물/구매 메뉴에 쓰는 것과 같은 패턴).
## 결과는 saga_core Toast로 한 줄 알린다.

const RealmOrders := preload("res://games/saga_realm/data/realm_orders.gd")
const ChoicePrompt := preload("res://saga_core/ui/choice_prompt.gd")
const Toast := preload("res://saga_core/ui/toast.gd")
const Characters := preload("res://saga_core/data/characters.gd")

const TOAST_SEC := 3.0


func _ready() -> void:
	text = "명령"
	pressed.connect(_on_pressed)


func _on_pressed() -> void:
	## GDScript 람다는 바깥 지역 변수를 "생성 시점 값"으로 캡처한다 —
	## villager_builder.gd의 선물/구매 메뉴와 같은 layer_box 우회
	## (ChoicePrompt.build() 호출 전에 만든 콜백이 그 결과를 미리 참조할
	## 수 없어서다).
	var layer_box := {}
	var choices: Array = []
	for o: Dictionary in RealmOrders.ORDERS:
		choices.append({
			"label": "%s %s (💰%d) — %s" % [o.emoji, o.name, int(o.gold), o.desc],
			"cb": func() -> void: _start_order(String(o.key), String(o.name), layer_box),
		})
	layer_box["layer"] = ChoicePrompt.build(self, "명령", choices)


## **2026-09-17 추가 — PLAN 101-2 REALM ④후보 "설전".** 등용(hire)만
## 사자(`envoy_officer()`)가 3문 설전을 먼저 치른다 — 나머지 아홉 명령은
## 그대로 곧장 실행한다.
func _start_order(key: String, name_: String, layer_box: Dictionary) -> void:
	(layer_box["layer"] as CanvasLayer).queue_free()
	if key != "hire":
		_run_order(key, name_)
		return
	var officer_id := RealmSaveState.envoy_officer()
	if officer_id.is_empty():
		_run_order(key, name_)
		return
	_debate_round(key, name_, RealmSaveState.debate_draw(officer_id), [])


func _debate_round(key: String, name_: String, questions: Array, answers: Array) -> void:
	var box := {}
	var q: Dictionary = questions[answers.size()]
	var choice_list: Array = q.choices
	var choices: Array = []
	for i in range(choice_list.size()):
		choices.append({
			"label": String(choice_list[i]),
			"cb": func() -> void: _debate_pick(key, name_, questions, answers, i, box),
		})
	box["layer"] = ChoicePrompt.build(self, "설전(%d/%d) — %s" % [answers.size() + 1, questions.size(), String(q.q)], choices)


func _debate_pick(key: String, name_: String, questions: Array, answers: Array, choice_idx: int, layer_box: Dictionary) -> void:
	(layer_box["layer"] as CanvasLayer).queue_free()
	var next_answers: Array = answers.duplicate()
	next_answers.append(choice_idx)
	if next_answers.size() < questions.size():
		_debate_round(key, name_, questions, next_answers)
	else:
		var res := RealmSaveState.debate_result(questions, next_answers)
		_run_order(key, name_, float(res.mul), int(res.correct))


func _run_order(key: String, name_: String, debate_mul: float = 1.0, debate_correct: int = -1) -> void:
	var r := RealmSaveState.execute_order(key, debate_mul)
	if not r.get("ok", false):
		Toast.show(self, "%s — %s" % [name_, r.get("why", "실패")], TOAST_SEC)
		return

	var prefix := "🗣️ 설전 %d/3 정답 — " % debate_correct if debate_correct >= 0 else ""
	var msg: String
	if key == "search":
		var found_id: String = r.get("found", "")
		if found_id.is_empty():
			msg = "수색 — 더 찾을 사람이 없다."
		else:
			var h = Characters.find(found_id)
			msg = "🔍 %s 을(를) 찾았다!" % String(h.name)
	elif key == "hire":
		var hired_id: String = r.get("hired", "")
		if hired_id.is_empty():
			msg = prefix + "등용 — 상대가 사양했다."
		else:
			var h2 = Characters.find(hired_id)
			msg = prefix + "🤝 %s 이(가) 합류했다!" % String(h2.name)
	else:
		var amount: int = int(r.get("amount", 0))
		msg = "%s %s" % [name_, ("+%d" % amount if amount > 0 else "더 올릴 곳이 없다")]
		if r.get("crit", false):
			msg += " (대성공!)"

	Toast.show(self, msg, TOAST_SEC)
