extends Button

## GO save_button.gd·FOREST forest_save_button.gd와 완전히 같은 패턴 —
## StorySaveState만 다르다.

const TOAST_SEC := 3.0
const SessionCard := preload("res://saga_core/ui/session_card.gd")


func _ready() -> void:
	text = "저장"
	pressed.connect(_on_pressed)


## PLAN.md 101-4 표준 B(세션 마무리 카드) — GO·FOREST save_button.gd와
## 같은 경계 결정(명확한 "세션 끝" 이벤트가 없어 저장 시점을 그 자리로
## 쓴다).
func _on_pressed() -> void:
	var ok := StorySaveState.save()
	if ok:
		var lines: Array[String] = [
			"처치 +%d" % StorySaveState.session_kills_gained(),
			"골드 +%d" % StorySaveState.session_gold_gained(),
			"Lv.%d" % StorySaveState.level,
		]
		if not StorySaveState.last_run.is_empty():   # G-0197 — 지난 사냥 등급
			lines.append(StorySaveState.run_line(StorySaveState.last_run))
		SessionCard.show(get_tree().current_scene, "저장했다 — 이번 세션", lines)
	else:
		_toast("저장 실패 — 플레이어를 못 찾았다.")


func _toast(text_: String) -> void:
	var labels := get_tree().get_nodes_in_group("dialogue_label")
	if labels.is_empty():
		return
	var label: Label = labels[0]
	label.text = text_
	label.show()
	get_tree().create_timer(TOAST_SEC).timeout.connect(func() -> void:
		if is_instance_valid(label) and label.text == text_:
			label.hide()
	)
