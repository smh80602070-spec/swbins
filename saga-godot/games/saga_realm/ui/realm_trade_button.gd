extends Button

## G-0310 교역로 입구 — ☰ 메뉴 「🐫 교역」. 공용 선택 창: 다니는 상단(남은 달·이번 달 벌이·길 상태) + 지금 보는 성(current_city)에서
## 띄울 만한 곳 셋(벌이 큰 순) · 닫기. 줄을 누르면 띄우고(못 하면 까닭 알림) 창이 다시 열린다. 웹 traderoute.js cardHtml 의 고돗판.

const ChoicePrompt := preload("res://saga_core/ui/choice_prompt.gd")
const Toast := preload("res://saga_core/ui/toast.gd")
const Trade := preload("res://games/saga_realm/data/realm_trade.gd")

var _layer: CanvasLayer = null


func _ready() -> void:
	text = "🐫 교역"
	focus_mode = Control.FOCUS_NONE
	add_to_group("realm_trade")
	pressed.connect(open_screen)


func _close() -> void:
	if _layer != null and is_instance_valid(_layer):
		_layer.queue_free()
	_layer = null


## 창에 들어갈 줄 [{label, to}] — to 가 "" 면 다니는 상단 줄(누르면 아무 일 없음). 점검도 읽는다.
func lines() -> Array:
	var rs: Object = RealmSaveState
	var out: Array = []
	for r: Dictionary in Trade.routes(rs):
		var alive := not Trade.path(rs, String(r.from), String(r.to)).is_empty()
		out.append({"to": "", "label": "🐫 %s ↔ %s — %d달 남음 · 달마다 💰%d%s" % [Trade.city_name(String(r.from)), Trade.city_name(String(r.to)),
			int(r.left), Trade.base_gold(rs, String(r.from), String(r.to)), "" if alive else " · ⚠️ 길 끊김(다음 달 잃음)"]})
	var from := String(rs.current_city)
	for c: Dictionary in Trade.candidates(rs, from):
		var w := Trade.why(rs, from, String(c.to))
		out.append({"to": String(c.to), "label": "▶ %s → %s 상단 띄우기 💰%d · %d달 · 달마다 💰%d(%d칸)%s" % [Trade.city_name(from), Trade.city_name(String(c.to)),
			Trade.COST, Trade.MONTHS, int(c.gold), int(c.hops), "" if w == "" else "\n" + w]})
	return out


func open_screen() -> bool:
	_close()
	var choices: Array = []
	for l: Dictionary in lines():
		var to := String(l.to)
		choices.append({"label": String(l.label), "cb": func() -> void: _start(to) if to != "" else open_screen()})
	choices.append({"label": "닫기", "cb": _close})
	_layer = ChoicePrompt.build(get_tree().current_scene, "🐫 교역로 — 우리·화친 땅만 지나는 길 · 둘까지 · 길이 끊기면 상단을 잃는다(%d/%d)" %
		[Trade.routes(RealmSaveState).size(), Trade.MAX_ROUTES], choices)
	return true


func _start(to: String) -> void:
	var r := Trade.start(RealmSaveState, String(RealmSaveState.current_city), to)
	if bool(r.ok):
		Toast.show(self, "🐫 상단이 떠났다 — %s, 달마다 💰%d" % [Trade.city_name(to), int(r.gold)], 3.0)
	else:
		Toast.show(self, String(r.why), 2.0)
	open_screen()
