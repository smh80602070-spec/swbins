extends Node
## GO 첫걸음 사명(data/tutorial.gd · world/tutorial.gd · 세이브 "tut") 자동 점검 — 평소엔 안 붙는다.
## test_village.gd 가 SAGA_TUTORIAL_PROBE 가 있을 때만 단다. 진짜 세이브(user://save.json)는 안 건드리고 임시 파일로 돈다.
##
##   SAGA_TUTORIAL_PROBE=1 "$GODOT" --headless --path saga-godot res://games/saga_go/world/TestVillage.tscn
##
## ① 새 세이브(tut 비어 있음) 목표판 첫 줄 = 첫 사명 ② 다섯 사명을 실제 경로(걷기·등반 / 동행 등용 / 상자 opened 신호 /
## 필드 전투 reacted 신호 / 세이브 파일 쓰기)로 차례로 → 줄이 n/5 로 바뀜 ③ 다 하면 평소 줄로 돌아감 ④ 세이브에 "tut" 가 실림
## ⑤ "tut" 없는 옛 세이브를 불러오면 전부 완료. 끝에 TUTORIAL_PROBE_DONE fails=N. 상태는 끝에 되돌린다.

const Data := preload("res://games/saga_go/data/tutorial.gd")
const GoPlayer := preload("res://games/saga_go/player/go_player.gd")
const TMP := "user://tutorial_probe.json"

var _p: Node3D
var _fails := 0


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
	print("TUTORIAL_PROBE %s %s %s" % ["ok  " if ok else "FAIL", name, detail])


func _rm() -> void:
	for suffix in ["", ".bak", ".tmp"]:
		if FileAccess.file_exists(TMP + suffix):
			DirAccess.remove_absolute(ProjectSettings.globalize_path(TMP + suffix))


func _board() -> String:
	get_tree().current_scene.call("_refresh_goal_board")
	var b := get_tree().get_first_node_in_group("goal_board") as Label
	return b.text.get_slice("\n", 0) if b != null else "(목표판 없음)"


func _run() -> void:
	await _frames(4)
	var tn := get_tree().get_first_node_in_group("go_tutorial")
	var saved_tut: Array = PartyState.tut.duplicate()
	var saved_members: Array = PartyState.members.duplicate()
	var saved_override: String = SaveState.path_override
	var saved_pos := _p.global_position
	var saved_mode: Variant = _p.get("mode")
	_rm()
	SaveState.path_override = TMP
	tn.set_physics_process(false)  # 점검이 직접 _check() 를 부른다(배경 폴링이 끼어들지 않게)
	PartyState.members.clear()
	PartyState.tut = []
	tn.call("reset_for_test")

	# ① 새 세이브
	_check("start", tn.call("active") and _board().begins_with("🎯 첫걸음 0/5 둘러보기"), _board())

	# ② 다섯 사명
	tn.call("_check")  # 시작 자리·세이브 시각 기록
	_p.set("mode", GoPlayer.Mode.CLIMB)
	tn.call("_check")
	_p.set("mode", GoPlayer.Mode.GROUND)
	_p.global_position = saved_pos + Vector3(25, 0, 0)
	tn.call("_check")
	_check("move", PartyState.tut == ["move"] and _board().begins_with("🎯 첫걸음 1/5 동행 만나기"), _board())

	PartyState.members.append("probe_member")
	tn.call("_check")
	_check("recruit", PartyState.tut.has("recruit") and _board().begins_with("🎯 첫걸음 2/5 상자 열기"), _board())

	var chest_src := GDScript.new()
	chest_src.source_code = "extends Node3D\nsignal opened(chest)\n"
	chest_src.reload()
	var chest := Node3D.new()
	chest.set_script(chest_src)
	chest.add_to_group("treasure_chest")
	add_child(chest)
	tn.call("_check")  # 새 상자에 신호 연결
	chest.emit_signal("opened", chest)
	_check("chest", PartyState.tut.has("chest") and _board().begins_with("🎯 첫걸음 3/5 원소 맞부딪치기"), _board())

	var fc := get_tree().get_first_node_in_group("go_field_combat")
	_check("field_combat 있음", fc != null, str(fc))
	if fc != null:
		fc.emit_signal("reacted", "melt")
	_check("react", PartyState.tut.has("react") and _board().begins_with("🎯 첫걸음 4/5 기록 남기기"), _board())

	SaveState.save()  # 임시 파일에 씀 — 수정 시각이 시작(없음)보다 늦다
	tn.call("_check")
	_check("save", PartyState.tut.has("save") and PartyState.tut.size() == 5, str(PartyState.tut))

	# ③ 다 했으면 평소 줄
	_check("done_board", not bool(tn.call("active")) and not _board().contains("첫걸음"), _board())

	# ④ 세이브에 tut
	SaveState.save()
	var parsed: Variant = JSON.parse_string(FileAccess.get_file_as_string(TMP))
	_check("saved_tut", typeof(parsed) == TYPE_DICTIONARY and (parsed as Dictionary).get("tut", []).size() == 5, "")

	# ⑤ 옛 세이브(tut 없음)
	if typeof(parsed) == TYPE_DICTIONARY:
		(parsed as Dictionary).erase("tut")
		var f := FileAccess.open(TMP, FileAccess.WRITE)
		f.store_string(JSON.stringify(parsed))
		f.close()
		PartyState.tut = []
		SaveState.try_load()
		_check("old_save_all_done", PartyState.tut.size() == Data.MISSIONS.size(), str(PartyState.tut))

	# 되돌리기
	_rm()
	chest.queue_free()
	SaveState.path_override = saved_override
	PartyState.tut = saved_tut
	PartyState.members.assign(saved_members)
	_p.global_position = saved_pos
	_p.set("mode", saved_mode)
	tn.set_physics_process(true)
	print("TUTORIAL_PROBE_DONE fails=%d" % _fails)
	get_tree().quit()
