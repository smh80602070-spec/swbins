extends Button

## G-0375 포로 처리 입구 — ☰ 메뉴 「🔒 포로」. 공용 선택 창: 포로마다 한 줄(이름·옛 세력·몸값) → 누르면 그 포로 처분 창(등용 권유·풀어 줌·몸값·돌아가기).
## realm_focus_button.gd 와 같은 꼴. 규칙은 data/realm_captives.gd.

const ChoicePrompt := preload("res://saga_core/ui/choice_prompt.gd")
const Toast := preload("res://saga_core/ui/toast.gd")
const Captives := preload("res://games/saga_realm/data/realm_captives.gd")
const RealmWonder := preload("res://games/saga_realm/data/realm_wonder.gd")   # force_name

var _layer: CanvasLayer = null


func _ready() -> void:
	text = "🔒 포로"
	focus_mode = Control.FOCUS_NONE
	add_to_group("realm_captive")
	pressed.connect(open_screen)


func _close() -> void:
	if _layer != null and is_instance_valid(_layer):
		_layer.queue_free()
	_layer = null


func open_screen() -> bool:
	_close()
	if not Captives.on():
		return false
	var choices: Array = []
	for oid: String in Captives.ids(RealmSaveState):
		var id := oid
		choices.append({"label": "%s · %s 출신 · 몸값 %d" % [Captives.name_of(id), _force_name(String(RealmSaveState.captives[id])), Captives.ransom_of(id)],
			"cb": func() -> void: _open_one(id)})
	choices.append({"label": "닫기", "cb": _close})
	var head := "🔒 포로 %d — 성을 뺏을 때 사로잡은 적장" % (choices.size() - 1) if choices.size() > 1 else "🔒 포로 없음 — 성을 뺏으면 수비 장수를 사로잡는다"
	_layer = ChoicePrompt.build(get_tree().current_scene, head, choices)
	return true


func _open_one(oid: String) -> void:
	_close()
	var choices: Array = [
		{"label": "등용 권유 — 재야에 두고 등용 명령으로", "cb": func() -> void: _act(oid, "recruit")},
		{"label": "풀어 준다 — 옛 세력 우호 +%d" % Captives.RELEASE_REL, "cb": func() -> void: _act(oid, "release")},
		{"label": "몸값을 받는다 — 금 +%d · 우호 %d" % [Captives.ransom_of(oid), Captives.RANSOM_REL], "cb": func() -> void: _act(oid, "ransom")},
		{"label": "돌아가기", "cb": func() -> void: open_screen()},
	]
	_layer = ChoicePrompt.build(get_tree().current_scene, "🔒 %s 을(를) 어떻게 하나" % Captives.name_of(oid), choices)


func _act(oid: String, what: String) -> void:
	var r := Captives.act(RealmSaveState, oid, what)
	Toast.show(self, String(r.msg), 3.0)
	open_screen()


static func _force_name(fid: String) -> String:
	return RealmWonder.force_name(fid)
