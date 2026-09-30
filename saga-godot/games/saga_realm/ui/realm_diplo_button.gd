extends Button

## "외교" 버튼 — diplo.js의 조공(tribute)·화친(truce)을 좁혀 옮긴 첫
## 외교 슬라이스(2026-09-12, "외교도 이어해" — 전쟁 슬라이스가 남긴
## 첫 후보). city_button.gd/order_button.gd와 같은 ChoicePrompt 패턴.
##
## **2026-09-13 추가 — 하비(xiapi, 여포령) 목표 추가.** 상대가 소패
## 하나뿐이던 것을 realm_attack_button.gd·realm_transfer_button.gd와
## 같은 결로 일반화했다 — 대상 고르기(1단) → 조공/화친 고르기(2단).
## `RealmCities.ENEMY_CITIES`가 늘 때마다 이 파일은 다시 안 고쳐도 된다.
##
## **2026-09-14 추가 — 주인 없는 성(77개, 한국/일본/교주/서역/남중/
## 천축/막북/임읍/균열/폐허/묘역) 목록에서 제외.** `diplo.js`가 원작부터
## `if (!c.force) return {ok:false, why:'주인 없는 성입니다'}`로 걸러온
## 규칙을 처음으로 코드에 옮겼다 — 지금까지는 이 코드에 손이 안 갔다
## (삼국지 30성만 있을 땐 전부 force가 있었다). 새 규칙이 아니라 원작
## 규칙을 이제야 만난 것뿐이다.

const ChoicePrompt := preload("res://saga_core/ui/choice_prompt.gd")
const Toast := preload("res://saga_core/ui/toast.gd")
const Characters := preload("res://saga_core/data/characters.gd")
const RealmCities := preload("res://games/saga_realm/data/realm_cities.gd")
const RealmDiplo := preload("res://games/saga_realm/data/realm_diplo.gd")

const TOAST_SEC := 3.5


func _ready() -> void:
	text = "외교"
	pressed.connect(_on_pressed)


## **2026-09-14 정정 — `enemy_def.get("lord")`(정적, 194 기준) 대신
## `RealmSaveState.lord_of()`를 쓴다.** 200에서 force가 재배정된 성은
## 정적 lord가 옛 주인을 가리켜(예: 계는 이제 shao 소속인데 정적 lord는
## 여전히 공손찬) 이 라벨이 틀린 이름을 보여줬다 — 27절 "놓칠 뻔한 것"
## 항목의 마지막 남은 자리.
func _lord_name(target_id: String) -> String:
	var h = Characters.find(RealmSaveState.lord_of(target_id))
	return String(h.name) if h else "상대"


func _on_pressed() -> void:
	var layer_box := {}
	var choices: Array = []
	for e: Dictionary in RealmCities.ENEMY_CITIES:
		var eid := String(e.id)
		## **2026-09-14 추가 — 시나리오가 우리 것으로 준 성은 목록에서 뺀다**
		## (realm_attack_button.gd와 같은 이유).
		if not RealmSaveState.enemies.has(eid):
			continue
		if bool(RealmSaveState.enemies[eid].get("captured", false)):
			continue
		if RealmSaveState.force_of(eid).is_empty():
			continue
		choices.append({
			"label": "%s — %s" % [String(e.get("name", eid)), _lord_name(eid)],
			"cb": func() -> void: _pick_action(eid, layer_box),
		})
	if choices.is_empty():
		Toast.show(self, "외교할 상대가 없습니다", TOAST_SEC)
		return
	layer_box["layer"] = ChoicePrompt.build(self, "외교 — 누구와", choices)


func _pick_action(target_id: String, layer_box: Dictionary) -> void:
	(layer_box["layer"] as CanvasLayer).queue_free()
	var action_box := {}
	var choices: Array = [
		{"label": "🎁 조공 — 금을 보내 우호를 올린다(확정)",
		 "cb": func() -> void: _run_tribute(target_id, action_box)},
		{"label": "🤝 화친 — 정전을 청한다(성공하면 %d개월간 공격 못 함)" % RealmDiplo.TRUCE_MONTHS,
		 "cb": func() -> void: _run_truce(target_id, action_box)},
	]
	action_box["layer"] = ChoicePrompt.build(self, "외교 — %s" % _lord_name(target_id), choices)


func _run_tribute(target_id: String, layer_box: Dictionary) -> void:
	(layer_box["layer"] as CanvasLayer).queue_free()
	var r := RealmSaveState.envoy_tribute(target_id)
	if not r.get("ok", false):
		Toast.show(self, "조공 — %s" % r.get("why", "실패"), TOAST_SEC)
		return
	Toast.show(self, "🎁 조공 — 우호 +%d (지금 %d)" % [int(r.up), int(r.relation)], TOAST_SEC)


## **2026-09-17 추가 — PLAN 101-2 REALM ④후보 "설전".** 화친을 청하기
## 전에 사자(`envoy_truce()`가 고를 사람과 같은 지력 으뜸)가 3문 설전을
## 치른다. 사자가 없으면(로스터가 텅 비면) 설전 없이 바로 `envoy_truce()`
## 가 그 사정을 그대로 실패로 돌려준다.
func _run_truce(target_id: String, layer_box: Dictionary) -> void:
	(layer_box["layer"] as CanvasLayer).queue_free()
	var officer_id := RealmSaveState.envoy_officer()
	if officer_id.is_empty():
		_truce_result(target_id, 1.0, -1)
		return
	_debate_round(target_id, RealmSaveState.debate_draw(officer_id), [])


func _debate_round(target_id: String, questions: Array, answers: Array) -> void:
	var box := {}
	var q: Dictionary = questions[answers.size()]
	var choice_list: Array = q.choices
	var choices: Array = []
	for i in range(choice_list.size()):
		choices.append({
			"label": String(choice_list[i]),
			"cb": func() -> void: _debate_pick(target_id, questions, answers, i, box),
		})
	box["layer"] = ChoicePrompt.build(self, "설전(%d/%d) — %s" % [answers.size() + 1, questions.size(), String(q.q)], choices)


func _debate_pick(target_id: String, questions: Array, answers: Array, choice_idx: int, layer_box: Dictionary) -> void:
	(layer_box["layer"] as CanvasLayer).queue_free()
	var next_answers: Array = answers.duplicate()
	next_answers.append(choice_idx)
	if next_answers.size() < questions.size():
		_debate_round(target_id, questions, next_answers)
	else:
		var res := RealmSaveState.debate_result(questions, next_answers)
		_truce_result(target_id, float(res.mul), int(res.correct))


func _truce_result(target_id: String, debate_mul: float, correct: int) -> void:
	var r := RealmSaveState.envoy_truce(target_id, debate_mul)
	if not r.get("ok", false):
		Toast.show(self, "화친 — %s" % r.get("why", "실패"), TOAST_SEC)
		return
	var prefix := "🗣️ 설전 %d/3 정답 — " % correct if correct >= 0 else ""
	if r.accepted:
		Toast.show(self, "%s🤝 화친을 맺었다! (우호 %d)" % [prefix, int(r.relation)], TOAST_SEC)
	else:
		Toast.show(self, "%s📜 화친을 사양했다 (우호 %d)" % [prefix, int(r.relation)], TOAST_SEC)
