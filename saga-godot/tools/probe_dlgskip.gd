extends Node
## G-0055 대화 건너뛰기(story_quest.gd skip_dialogue) 자동 점검 — 평소엔 안 붙는다. test_village.gd 가 SAGA_DLGSKIP_PROBE 가 있을 때만 단다.
##
##   SAGA_DLGSKIP_PROBE=1 "$GODOT" --headless --path saga-godot res://games/saga_go/world/TestVillage.tscn
##
## ① 고르는 줄 없는 네 줄 → 한 번에 닫히고 끝 콜백 1번 ② 셋째 줄이 고르는 줄 → 거기서 멈추고, 고르기 전엔 더 안 넘어감
## ③ 고른 뒤 다시 건너뛰기 → 닫히고 끝 콜백 ④ 대화창에 건너뛰기 단추 ⑤ 대화 밖에서 부르면 아무 일 없음 ⑥ Esc 키 = 건너뛰기
## 세이브는 안 건드린다(대화만 열고 닫는다). 끝에 "DLGSKIP_PROBE_DONE fails=N".

var _frame := 0
var _fails := 0
var _done := false


func _check(name: String, ok: bool, info := "") -> void:
	print("DLGSKIP_PROBE %s %s %s" % [name, "ok" if ok else "FAIL", info])
	if not ok:
		_fails += 1


func _physics_process(_delta: float) -> void:
	_frame += 1
	if _done or _frame < 10:
		return
	_done = true
	var sq: Node = get_tree().get_first_node_in_group("go_story")
	if sq == null:
		_check("story_node", false)
		_finish()
		return
	var calls := [0]
	var cb := func() -> void: calls[0] += 1

	# ⑤ 대화 밖
	sq.call("skip_dialogue")
	_check("outside_noop", not bool(sq.call("is_dialogue_open")) and calls[0] == 0)

	# ① 고르는 줄 없음
	sq.call("open_dialogue", [["촌장", "하나"], ["나", "둘"], ["촌장", "셋"], ["나", "넷"]], cb)
	_check("open", bool(sq.call("is_dialogue_open")))
	var btn := sq.find_child("SkipButton", true, false) as Button
	_check("skip_button", btn != null and btn.text.contains("건너뛰기"), "btn=%s" % btn)
	sq.call("skip_dialogue")
	_check("plain_closed", not bool(sq.call("is_dialogue_open")) and calls[0] == 1, "open=%s calls=%d" % [sq.call("is_dialogue_open"), calls[0]])

	# ② 셋째 줄이 고르는 줄
	calls[0] = 0
	sq.call("open_dialogue", [["촌장", "하나"], ["촌장", "둘"], ["?", ["예", "아니오"]], ["촌장", "넷"]], cb)
	sq.call("skip_dialogue")
	_check("stop_at_choice", bool(sq.call("is_dialogue_open")) and int(sq.get("_dlg_i")) == 2 and bool(sq.get("_dlg_waiting_choice")),
		"i=%s waiting=%s" % [sq.get("_dlg_i"), sq.get("_dlg_waiting_choice")])
	sq.call("skip_dialogue")
	_check("choice_blocks_skip", int(sq.get("_dlg_i")) == 2 and calls[0] == 0)

	# ③ 고른 뒤 다시 건너뛰기
	sq.call("choose", 0)
	sq.call("skip_dialogue")
	_check("after_choice_closed", not bool(sq.call("is_dialogue_open")) and calls[0] == 1, "calls=%d" % calls[0])

	# ⑥ Esc 키
	calls[0] = 0
	sq.call("open_dialogue", [["촌장", "하나"], ["나", "둘"]], cb)
	var k := InputEventKey.new()
	k.keycode = KEY_ESCAPE
	k.physical_keycode = KEY_ESCAPE
	k.pressed = true
	sq.call("_unhandled_input", k)
	_check("esc_skips", not bool(sq.call("is_dialogue_open")) and calls[0] == 1)
	_finish()


func _finish() -> void:
	print("DLGSKIP_PROBE_DONE fails=%d" % _fails)
	get_tree().quit()
