extends Node
## GO 목표판 3줄(일과판)·저장 마무리 카드(101-4 ①: test_village.gd::_refresh_goal_board · ui/save_button.gd · saga_core/ui/session_card.gd) 자동 점검 —
## 평소엔 안 붙는다. test_village.gd 가 SAGA_DAYCARD_PROBE 가 있을 때만 단다. 진짜 세이브는 안 건드리고 임시 파일로 돈다.
##
##   SAGA_DAYCARD_PROBE=1 "$GODOT" --headless --path saga-godot res://games/saga_go/world/TestVillage.tscn
##
## ① 목표판이 세 줄(🎯 지금·⏱ 이번 세션·📅 이번 주) ② 세션 줄이 새로 발견한 것·얻은 경험치를 따라 저절로 바뀐다(codex_changed 신호)
## ③ 저장 단추를 누르면 마무리 카드가 뜨고 줄이 실제 값과 같다(경험치·발견·부대) · 닫기를 누르면 사라진다.
## 끝에 DAYCARD_PROBE_DONE fails=N. 상태는 끝에 되돌린다.

const TMP := "user://daycard_probe.json"

var _scene: Node
var _fails := 0


func _ready() -> void:
	Weather.force("clear")
	_scene = get_tree().current_scene
	_run.call_deferred()


func _frames(n: int) -> void:
	for i in n:
		await get_tree().physics_frame


func _check(name: String, ok: bool, detail: String) -> void:
	if not ok:
		_fails += 1
	print("DAYCARD_PROBE %s %s %s" % ["ok  " if ok else "FAIL", name, detail])


func _rm() -> void:
	for suffix in ["", ".bak", ".tmp"]:
		if FileAccess.file_exists(TMP + suffix):
			DirAccess.remove_absolute(ProjectSettings.globalize_path(TMP + suffix))


func _by_script(root: Node, file: String) -> Node:
	var s: Script = root.get_script()
	if s != null and s.resource_path.ends_with("/" + file):
		return root
	for c in root.get_children():
		var r := _by_script(c, file)
		if r != null:
			return r
	return null


func _board_lines() -> PackedStringArray:
	var b := get_tree().get_first_node_in_group("goal_board") as Label
	return b.text.split("\n") if b != null else PackedStringArray()


func _run() -> void:
	await _frames(4)
	var saved_book: Dictionary = CodexState.book.duplicate()
	var saved_exp: float = PartyState.exp
	var saved_override: String = SaveState.path_override
	_rm()
	SaveState.path_override = TMP

	# ① 세 줄
	PartyState.begin_session()
	CodexState.begin_session()
	_scene.call("_refresh_goal_board")
	var lines := _board_lines()
	_check("board_3lines", lines.size() == 3 and lines[0].begins_with("🎯 ") and lines[1].begins_with("⏱ ") and lines[2].begins_with("📅 "), str(lines))
	_check("session_zero", lines.size() == 3 and lines[1].contains("경험치 +0") and lines[1].contains("발견 +0"), lines[1] if lines.size() == 3 else "")

	# ② 저절로 갱신
	CodexState.restore({})
	CodexState.begin_session()
	CodexState.discover("place", "probe_dc")
	await _frames(2)
	lines = _board_lines()
	var gained := PartyState.session_exp_gained()
	_check("session_follows", lines.size() == 3 and lines[1].contains("발견 +1") and lines[1].contains("경험치 +%.0f" % gained) and gained > 0.0, lines[1] if lines.size() == 3 else "")

	# ③ 저장 카드
	var btn := _by_script(get_tree().root, "save_button.gd")
	_check("save_button 있음", btn != null, str(btn))
	if btn != null:
		var before := get_tree().get_nodes_in_group("ui_modal").size()
		btn._on_pressed()
		await _frames(2)
		var cards := get_tree().get_nodes_in_group("ui_modal")
		var card: CanvasLayer = null
		for c in cards:
			if c is CanvasLayer and c.find_children("*", "Button", true, false).size() == 1:
				card = c
		var labels: Array = []
		var close_btn: Button = null
		if card != null:
			for l in card.find_children("*", "Label", true, false):
				labels.append((l as Label).text)
			close_btn = card.find_children("*", "Button", true, false)[0]
		var want_exp := "경험치 +%.0f" % PartyState.session_exp_gained()
		var want_found := "발견 +%d" % CodexState.session_discovered()
		var want_party := "부대 %d명" % PartyState.members.size()
		var gb := get_tree().get_first_node_in_group("goal_board")   # G-0179 — 끝에 "▶ 다음: <목표판 🎯 줄>"
		var want_next := "▶ 다음: %s" % String(gb.get("now_line")) if gb else ""
		_check("card_shown", cards.size() == before + 1 and card != null and labels.size() == 5 and labels[0] == "저장했다 — 이번 세션" and labels[1] == want_exp and labels[2] == want_found and labels[3] == want_party and labels[4] == want_next and want_next.length() > 7, str(labels))
		if close_btn != null:
			close_btn.emit_signal("pressed")
			await _frames(2)
		_check("card_closed", card == null or not is_instance_valid(card) or card.is_queued_for_deletion(), "닫기 → 사라짐")

	_rm()
	SaveState.path_override = saved_override
	CodexState.restore(saved_book)
	PartyState.exp = saved_exp
	print("DAYCARD_PROBE_DONE fails=%d" % _fails)
	get_tree().quit()
