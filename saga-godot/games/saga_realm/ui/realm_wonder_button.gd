extends Button

## G-0243 불가사의 입구 — HUD 단추 「🏛️ 불가사의」(왼쪽 줄 맨 위). 공용 선택 창에 여섯 줄(값·효과·남의 진행률·짓기)·닫기.
## 줄을 누르면 지금 보는 성(current_city)에서 짓기 시작한다(못 하면 까닭 알림 — 문은 학 갈래 「큰 도면」, realm_tech.wonder_open).
## 웹 wonder.js cardHtml 의 고돗판 — 창은 다시 열려 바뀐 것을 보여 준다.

const ChoicePrompt := preload("res://saga_core/ui/choice_prompt.gd")
const Toast := preload("res://saga_core/ui/toast.gd")
const Wonder := preload("res://games/saga_realm/data/realm_wonder.gd")

var _layer: CanvasLayer = null


func _ready() -> void:
	text = "🏛️ 불가사의"
	focus_mode = Control.FOCUS_NONE
	add_to_group("realm_wonder")
	pressed.connect(open_screen)


func _close() -> void:
	if _layer != null and is_instance_valid(_layer):
		_layer.queue_free()
	_layer = null


func line(w: Dictionary) -> String:
	var rs: Object = RealmSaveState
	var id := String(w.id)
	var by := Wonder.built_by(rs, id)
	var race := ""
	if by != "":
		race = "%s 완공" % Wonder.force_name(by)
	else:
		var parts: Array = []
		for r: Dictionary in Wonder.racers(rs, id):
			parts.append("%s %d%%" % [Wonder.force_name(String(r.force)), roundi((1.0 - float(r.left) / float(r.months)) * 100.0)])
		race = "아무도 안 짓는 중" if parts.is_empty() else " · ".join(parts)
	var mine := Wonder.job_of(rs, Wonder.ME)
	var tail := ""
	if not mine.is_empty() and String(mine.id) == id:
		tail = "짓는 중 — %d달 남음(%s)" % [int(mine.left), Wonder.city_name(String(mine.city))]
	elif by == "":
		var why := Wonder.why(rs, Wonder.ME, id, String(rs.current_city))
		tail = "▶ 짓기 시작(%s)" % Wonder.city_name(String(rs.current_city)) if why == "" else why
	return "%s %s — 💰%d · 인부 %d · %d달\n%s — %s%s" % [w.emoji, w.name, int(w.gold), Wonder.men(w), int(w.months), w.desc, race,
		"" if tail == "" else "\n" + tail]


func open_screen() -> bool:
	_close()
	var choices: Array = []
	for w: Dictionary in Wonder.WONDERS:
		var id := String(w.id)
		choices.append({"label": line(w), "cb": func() -> void: _build(id)})
	choices.append({"label": "닫기", "cb": _close})
	_layer = ChoicePrompt.build(get_tree().current_scene, "🏛️ 불가사의 — 먼저 다 지은 세력만 효과 · 늦으면 금 반 환급", choices)
	return true


func _build(id: String) -> void:
	var r := Wonder.start(RealmSaveState, Wonder.ME, id, String(RealmSaveState.current_city))
	if bool(r.ok):
		var w := Wonder.by_id(id)
		Toast.show(self, "%s %s 짓기 시작 — %d달" % [w.emoji, w.name, int(r.months)], 3.0)
	else:
		Toast.show(self, String(r.why), 2.0)
	open_screen()
