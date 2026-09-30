extends Button

## "서고" 버튼 — quiz.js learnedList()를 옮긴 것(2026-09-12, "1,2,3
## 다해줘" 세 번째이자 마지막). 익힌 문제를 최근 순으로 다시 볼 수
## 있게 한다 — 목록에서 하나를 고르면 그 문제·정답·해설을 다시 보여준다
## (원작 서고가 "복습·확인" 용도인 것과 같은 결). realm_quiz_button.gd
## 와 같은 ChoicePrompt 패턴.
##
## **2026-09-12 추가 — 전체·분야 필터 메뉴.** 눌렀을 때 곧장 "최근 20개"
## 목록으로 가지 않고, 먼저 "전체" + 학습이 있는 분야만 골라 보여주는
## 한 단계를 더 둔다(각 분야는 최대 15문항이라 quiz_learned_list의
## limit=20에 걸릴 일이 없다 — 분야 목록은 항상 그 분야 전체다).

const ChoicePrompt := preload("res://saga_core/ui/choice_prompt.gd")
const Toast := preload("res://saga_core/ui/toast.gd")
const RealmQuizData := preload("res://games/saga_realm/data/realm_quiz_data.gd")

const TOAST_SEC := 5.0
const LIST_LIMIT := 20


func _ready() -> void:
	text = "서고"
	pressed.connect(_on_pressed)


func _on_pressed() -> void:
	var progress := RealmSaveState.quiz_progress()
	if int(progress.learned) == 0:
		Toast.show(self, "아직 익힌 지식이 없습니다 — 문답을 풀어 보세요", TOAST_SEC)
		return

	var layer_box := {}
	var choices: Array = []
	choices.append({
		"label": "전체 — 최근 %d개" % mini(LIST_LIMIT, int(progress.learned)),
		"cb": func() -> void: _open_list("", "서고 — 전체(최근 순)", layer_box),
	})
	for c: Dictionary in RealmSaveState.quiz_cat_counts():
		if int(c.learned) == 0:
			continue
		choices.append({
			"label": "%s (%d/%d)" % [String(c.name), int(c.learned), int(c.total)],
			"cb": func() -> void: _open_list(String(c.key), "서고 — %s" % String(c.name), layer_box),
		})
	var title := "서고 — 익힌 지식 %d/%d" % [int(progress.learned), int(progress.total)]
	layer_box["layer"] = ChoicePrompt.build(self, title, choices)


func _open_list(cat_key: String, title: String, layer_box: Dictionary) -> void:
	(layer_box["layer"] as CanvasLayer).queue_free()
	var entries := RealmSaveState.quiz_learned_list(cat_key, LIST_LIMIT)

	var list_box := {}
	var choices: Array = []
	for entry: Dictionary in entries:
		var label := "[%s·%s] %s" % [
			String(entry.cat_name), String(entry.lv_name), RealmQuizData.short_q(String(entry.q))]
		choices.append({
			"label": label,
			"cb": func() -> void: _show_detail(entry, list_box),
		})
	list_box["layer"] = ChoicePrompt.build(self, "%s (%d개)" % [title, entries.size()], choices)


func _show_detail(entry: Dictionary, layer_box: Dictionary) -> void:
	(layer_box["layer"] as CanvasLayer).queue_free()
	var msg := "%s\n정답: %s\n%s" % [String(entry.q), String(entry.answer), String(entry.why)]
	Toast.show(self, msg, TOAST_SEC)
