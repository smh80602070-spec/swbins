extends Node
## GO 도움말·첫 걸음 안내(data/help.gd · world/help_guide.gd) 자동 점검 — 평소엔 안 붙는다.
## test_village.gd 가 SAGA_HELP_PROBE 가 있을 때만 단다.
##
##   SAGA_HELP_PROBE=1 "$GODOT" --headless --path saga-godot res://games/saga_go/world/TestVillage.tscn
##
## ① 표: 갈래·줄 모양 · 안내 id ② 도움말에 적힌 키가 실제 입력 지도와 맞는다(글이 낡지 않았나) ③ 안내는 한 번만(기록·세이브 JSON)
## ④ 조건: 시작 6초 · 마당 곁 · 이야기 끝 · 알 얻음 신호 ⑤ 화면: 열면 얼림·탭 넷·줄 수 · 닫으면 풀림. 안내 기록·이야기·위치는 끝에 되돌린다.

const Help := preload("res://games/saga_go/data/help.gd")

var _p: Node3D
var _g: Node
var _fails := 0
var _saved := {}


func _ready() -> void:
	Weather.force("clear")
	_p = get_tree().get_first_node_in_group("player")
	_run.call_deferred()


func _frames(n: int) -> void:
	for i in n:
		await get_tree().physics_frame


func _check(name: String, ok: bool, detail: String) -> void:
	if not ok:
		_fails += 1
	print("HELP_PROBE %s %s %s" % ["ok  " if ok else "FAIL", name, detail])


func _has_key(action: String, keycode: int) -> bool:
	if not InputMap.has_action(action):
		return false
	for ev in InputMap.action_get_events(action):
		if ev is InputEventKey and ((ev as InputEventKey).physical_keycode == keycode or (ev as InputEventKey).keycode == keycode):
			return true
	return false


func _all_text() -> String:
	var s := ""
	for sec in Help.SECTIONS:
		for line in sec.lines:
			s += String(line[0]) + " " + String(line[1]) + "\n"
	return s


func _drain() -> void:
	for i in 8:
		_g.set("_busy", 0.0)
		_g.set("_poll", 5.0)
		await _frames(3)
		if (_g.get("_queue") as Array).is_empty():
			break


func _run() -> void:
	await _frames(4)
	_g = get_tree().get_first_node_in_group("go_help")
	_saved = {"tips": PartyState.tips.duplicate(), "story": PartyState.story.duplicate(true), "pos": _p.global_position}
	PartyState.tips = []

	# ① 표
	var bad: Array = []
	for sec in Help.SECTIONS:
		if String(sec.name) == "" or (sec.lines as Array).is_empty():
			bad.append("section")
		for line in sec.lines:
			if (line as Array).size() != 2 or String(line[0]) == "" or String(line[1]) == "":
				bad.append("line " + str(line))
	for id in Help.TIPS:
		if Help.tip(String(id)) == "":
			bad.append("tip " + String(id))
	_check("tables", bad.is_empty() and Help.SECTIONS.size() == 4 and _g != null, "bad=%s sections=%d tips=%d" % [bad, Help.SECTIONS.size(), Help.TIPS.size()])

	# ② 글이 실제 키와 맞는가
	var wrong: Array = []
	var pairs := [["combat_quick", KEY_J], ["combat_ult", KEY_K], ["combat_dodge", KEY_L], ["jump", KEY_SPACE], ["run", KEY_SHIFT], ["move_forward", KEY_W],
		["go_eggs", KEY_I], ["go_homestead", KEY_T], ["go_cycle", KEY_N], ["go_help", KEY_F1], ["go_hunt", KEY_H]]
	for pr in pairs:
		if not _has_key(String(pr[0]), int(pr[1])):
			wrong.append(String(pr[0]))
	var txt := _all_text()
	var mention := ["Shift", "Space", "J", "E · K", "F1", "I", "T", "N", "V", "M", "C", "G", "U", "O", "Y", "F", "H"]
	var missing: Array = []
	for m in mention:
		if not txt.contains(String(m)):
			missing.append(m)
	_check("keys_match", wrong.is_empty() and missing.is_empty(), "wrong=%s missing=%s" % [wrong, missing])

	# ③ 한 번만
	PartyState.tips = []
	_g.set("_busy", 0.0)
	_g.call("tip", "first_chest")
	await _frames(3)
	var shown1: Array = (_g.get("shown") as Array).duplicate()
	var banner_vis := (_g.get("_banner") as Control).visible
	var recorded: bool = (PartyState.tips as Array).has("first_chest")
	_g.set("_busy", 0.0)
	_g.call("tip", "first_chest")
	await _frames(3)
	var count_after := (_g.get("shown") as Array).count("first_chest")
	var js := JSON.stringify(PartyState.tips)
	var back: Variant = JSON.parse_string(js)
	_check("once", shown1.has("first_chest") and banner_vis and recorded and count_after == 1 and (back as Array).has("first_chest"),
		"shown=%s banner=%s recorded=%s count=%d" % [shown1, banner_vis, recorded, count_after])

	# ④ 조건
	PartyState.tips = []
	PartyState.story = {}
	_g.set("_busy", 0.0)
	_g.set("_t", 100.0)
	_g.set("_poll", 5.0)
	await _frames(3)
	var start_ok := (_g.get("shown") as Array).has("start")
	var yard := get_tree().get_first_node_in_group("go_homestead")
	_p.global_position = (yard.call("center") as Vector3) + Vector3(1, 0, 1)
	await _frames(3)
	_g.set("_busy", 0.0)
	_g.set("_poll", 5.0)
	await _frames(4)
	var yard_ok := (_g.get("shown") as Array).has("yard")
	_p.global_position = _saved.pos
	PartyState.story = {"ch": load("res://games/saga_go/data/story.gd").CHAPTERS.size()}
	await _drain()
	var sail_ok := (_g.get("shown") as Array).has("sail")
	var eggs := get_tree().get_first_node_in_group("go_eggs")
	eggs.emit_signal("egg_gained", "e_small")
	await _drain()
	var egg_ok := (_g.get("shown") as Array).has("egg_got")
	_check("conditions", start_ok and yard_ok and sail_ok and egg_ok, "start=%s yard=%s sail=%s egg=%s" % [start_ok, yard_ok, sail_ok, egg_ok])

	# ⑤ 화면
	PartyState.story = _saved.story
	await _frames(2)
	var opened := bool(_g.call("open_screen"))
	var frozen := bool(_p.get("frozen"))
	await _frames(2)
	var tabs := (_g.get("_tabs") as Node).get_child_count()
	var rows0 := (_g.get("_body") as Node).get_child_count()
	_g.set("tab", 2)
	_g.call("_refresh")
	await _frames(2)
	var rows2 := (_g.get("_body") as Node).get_child_count()
	_g.call("close_screen")
	_check("screen", opened and frozen and tabs == 4 and rows0 == (Help.SECTIONS[0].lines as Array).size() and rows2 == (Help.SECTIONS[2].lines as Array).size() and not bool(_p.get("frozen")),
		"opened=%s frozen=%s tabs=%d rows=%d/%d" % [opened, frozen, tabs, rows0, rows2])

	PartyState.tips = _saved.tips
	PartyState.story = _saved.story
	_p.global_position = _saved.pos
	print("HELP_PROBE_DONE fails=%d" % _fails)
	get_tree().quit()
