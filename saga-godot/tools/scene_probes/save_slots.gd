extends Node
## G-0070 저장 슬롯(saga_core/data/save_slots.gd · ui/save_transfer_screen.gd switch_slot) — scene_probe_host 로 돈다(오토로드 필요).
## ① 다섯 판 모두 슬롯 1 의 save_path() = 원래 상수 SAVE_PATH(옛 진행 그대로) ② 슬롯 2·3 경로는 서로·원래와 다르다 ③ cfg 왕복
## ④ 빈 슬롯으로 바꾸면 지금 파일이 복사되고, 같은 슬롯은 아무 일 없음 ⑤ 화면에 슬롯 단추 셋·글.
## 진짜 세이브·user://save_slots.cfg 는 안 건드린다 — 임시 cfg·임시 판(probe)·reload_after=false.

const SaveSlots := preload("res://saga_core/data/save_slots.gd")
const Screen := preload("res://saga_core/ui/save_transfer_screen.gd")
const STATES := ["DungeonSaveState", "ForestSaveState", "SaveState", "RealmSaveState", "StorySaveState"]
const GAMES := {"DungeonSaveState": "dungeon", "ForestSaveState": "forest", "SaveState": "go", "RealmSaveState": "realm", "StorySaveState": "story"}

var fails := 0


func _fail(msg: String) -> void:
	fails += 1
	print("  FAIL ", msg)


func run() -> int:
	var tmp_dir := OS.get_temp_dir().path_join("saga_probe_slots_%d" % OS.get_process_id())
	DirAccess.make_dir_recursive_absolute(tmp_dir)
	var old_cfg := SaveSlots.cfg_path
	SaveSlots.cfg_path = tmp_dir.path_join("slots.cfg")
	SaveSlots.forget()

	# ① ②
	for st_name in STATES:
		var st: Node = get_tree().root.get_node_or_null(st_name)
		if st == null:
			_fail("%s 없음" % st_name)
			continue
		var base := String((st.get_script() as Script).get_script_constant_map().get("SAVE_PATH", ""))
		if String(st.call("save_path")) != base:
			_fail("%s 슬롯 1 경로 %s ≠ %s" % [st_name, st.call("save_path"), base])
		var g: String = GAMES[st_name]
		var p2 := SaveSlots.path_for(g, base, 2)
		var p3 := SaveSlots.path_for(g, base, 3)
		if p2 == base or p3 == base or p2 == p3 or not p2.ends_with("_slot2.json"):
			_fail("%s 슬롯 경로 %s / %s" % [st_name, p2, p3])

	# ③
	SaveSlots.set_current("forest", 3)
	SaveSlots.forget()
	if SaveSlots.current("forest") != 3 or SaveSlots.current("realm") != 1:
		_fail("cfg 왕복 forest=%d realm=%d" % [SaveSlots.current("forest"), SaveSlots.current("realm")])
	SaveSlots.set_current("forest", 1)

	# ④ ⑤ — 임시 판
	var base := tmp_dir.path_join("save_probe.json")
	var src := "extends Node\nconst SAVE_PATH := \"%s\"\nconst SaveSlots := preload(\"res://saga_core/data/save_slots.gd\")\nfunc save_path() -> String:\n\treturn SaveSlots.path_for(\"probe\", SAVE_PATH)\n" % base
	var gs := GDScript.new()
	gs.source_code = src
	gs.reload()
	var fake := Node.new()
	fake.set_script(gs)
	add_child(fake)
	var f := FileAccess.open(base, FileAccess.WRITE)
	f.store_string("{\"hello\": 1}")
	f.close()
	var scr: Node = Screen.new()
	scr.set("game_id", "probe")
	scr.set("state", fake)
	scr.set("reload_after", false)
	add_child(scr)
	scr.call("open_screen")
	var btns: Array = scr.find_children("Slot*", "Button", true, false)
	if btns.size() != 3 or not String((btns[0] as Button).text).begins_with("▶ 슬롯 1") or not String((btns[1] as Button).text).contains("비어 있음"):
		_fail("슬롯 단추 %s" % [btns.map(func(b): return (b as Button).text)])
	if bool(scr.call("switch_slot", 1)):
		_fail("같은 슬롯인데 바뀜")
	if not bool(scr.call("switch_slot", 2)):
		_fail("슬롯 2 로 안 바뀜")
	var p2 := SaveSlots.path_for("probe", base, 2)
	if not FileAccess.file_exists(p2) or FileAccess.get_file_as_string(p2) != "{\"hello\": 1}":
		_fail("빈 슬롯 2 에 복사 안 됨")
	if String(fake.call("save_path")) != p2:
		_fail("바꾼 뒤 save_path %s" % fake.call("save_path"))
	if not bool(scr.call("switch_slot", 1)) or String(fake.call("save_path")) != base:
		_fail("슬롯 1 로 못 돌아옴")
	scr.call("close_screen")

	# 치우기
	for p in [base, p2, SaveSlots.cfg_path]:
		DirAccess.remove_absolute(p)
	DirAccess.remove_absolute(tmp_dir)
	SaveSlots.cfg_path = old_cfg
	SaveSlots.forget()
	return fails
