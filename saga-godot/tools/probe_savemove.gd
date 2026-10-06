extends Node
## G-0035 세이브 옮기기(saga_core/data/save_base.gd export_string·import_string · ui/save_transfer.gd) 자동 점검 — 평소엔 안 붙는다.
## test_village.gd 가 SAGA_SAVEMOVE_PROBE 가 있을 때만 단다. 진짜 세이브는 안 건드린다(SaveState.path_override 로 임시 파일).
##
##   SAGA_SAVEMOVE_PROBE=1 "$GODOT" --headless --path saga-godot res://games/saga_go/world/TestVillage.tscn
##
## ① 저장 → 내보내기 문자열(SAGA1|go|…) ② 다른 내용으로 덮은 뒤 불러오기 → 파일이 내보낸 것과 같다·직전본이 .before_import 로 남음
## ③ 틀린 글·다른 판·깨진 글·이 빌드보다 새 버전 → 이유를 돌려주고 파일은 그대로 ④ 화면: 내보내기 → 칸·클립보드, 불러오기는 두 번 눌러야, 메뉴에 항목.
## ⑤ 다섯 판 세이브가 다 같은 부모를 써서 export/import 가 있다.

const TMP := "user://savemove_probe.json"

var _p: Node3D
var _frame := 0
var _fails := 0
var _done := false

func _ready() -> void:
	_p = get_tree().get_first_node_in_group("player")

func _check(name: String, ok: bool, info := "") -> void:
	print("SAVEMOVE_PROBE %s %s %s" % [name, "ok" if ok else "FAIL", info])
	if not ok:
		_fails += 1

func _read(path: String) -> String:
	return FileAccess.get_file_as_string(path) if FileAccess.file_exists(path) else ""

func _physics_process(_delta: float) -> void:
	_frame += 1
	if _done or _frame < 10:
		return
	_done = true
	var old_override := String(SaveState.path_override)
	SaveState.path_override = TMP
	for suffix in ["", ".bak", ".tmp", ".before_import"]:
		DirAccess.remove_absolute(ProjectSettings.globalize_path(TMP + suffix))
	# ①
	var saved: bool = SaveState.save()
	var s: String = SaveState.export_string("go")
	var parts := s.split("|")
	_check("export", saved and parts.size() == 4 and parts[0] == "SAGA1" and parts[1] == "go" and s.length() < 200000, "len=%d" % s.length())
	var original: Variant = JSON.parse_string(_read(TMP))
	# ② 다른 내용으로 덮고 불러오기
	SafeFileWrite.write(TMP, JSON.stringify({"version": SaveState.save_version(), "party_members": ["__other__"]}))
	var other := _read(TMP)
	var err: String = SaveState.import_string(s, "go")
	var now: Variant = JSON.parse_string(_read(TMP))
	_check("import", err == "" and now == original and _read(TMP + ".before_import") == other, "err=%s same=%s backup=%s" % [err, now == original, _read(TMP + ".before_import") == other])
	# ③ 거절 — 파일은 그대로
	var before := _read(TMP)
	var bad := {}
	bad.garbage = SaveState.import_string("hello", "go")
	bad.other_game = SaveState.import_string(s.replace("SAGA1|go|", "SAGA1|dungeon|"), "go")
	bad.broken = SaveState.import_string(s.substr(0, s.length() - 40), "go")
	var future := JSON.stringify({"version": SaveState.save_version() + 5}).to_utf8_buffer()
	bad.future = SaveState.import_string("SAGA1|go|%d|%s" % [future.size(), Marshalls.raw_to_base64(future.compress(FileAccess.COMPRESSION_GZIP))], "go")
	var all_refused := true
	for k in bad:
		if String(bad[k]) == "":
			all_refused = false
	_check("refuse", all_refused and _read(TMP) == before, "reasons=%s" % bad)
	# ④ 화면
	var ui := get_tree().get_first_node_in_group("go_save_transfer")
	ui.set("reload_after", false)
	_p.set("frozen", false)
	var opened: bool = ui.call("open_screen")
	var out: String = ui.call("export_now")
	var clip_ok := DisplayServer.get_name() == "headless" or DisplayServer.clipboard_get() == out
	var first: bool = ui.call("import_now")
	var second: bool = ui.call("import_now")
	ui.call("close_screen")
	var menu := get_tree().get_first_node_in_group("go_hud_menu")
	var in_menu := false
	for e in menu.get("ENTRIES"):
		if String(e[0]) == "go_save_transfer":
			in_menu = true
	_check("screen", opened and out.begins_with("SAGA1|go|") and clip_ok and not first and second and in_menu and not bool(_p.get("frozen")),
		"opened=%s first=%s second=%s menu=%s status=%s" % [opened, first, second, in_menu, ui.get("status")])
	# ⑤ 다섯 판
	var miss := []
	for n in ["SaveState", "DungeonSaveState", "ForestSaveState", "StorySaveState", "RealmSaveState"]:
		var st := get_tree().root.get_node_or_null(n)
		if st == null or not st.has_method("export_string") or not st.has_method("import_string"):
			miss.append(n)
	_check("five_games", miss.is_empty(), "miss=%s" % [miss])
	SaveState.path_override = old_override
	for suffix in ["", ".bak", ".tmp", ".before_import"]:
		DirAccess.remove_absolute(ProjectSettings.globalize_path(TMP + suffix))
	print("SAVEMOVE_PROBE_DONE fails=%d" % _fails)
	get_tree().quit()


class SafeFileWrite:
	static func write(path: String, text: String) -> void:
		var f := FileAccess.open(path, FileAccess.WRITE)
		f.store_string(text)
		f.close()
