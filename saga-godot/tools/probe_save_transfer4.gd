extends SceneTree

## G-0037 세이브 옮기기 화면 네 판(saga_core/ui/save_transfer_screen.gd 공용 화면 · saga_core/ui/save_transfer_button.gd HUD "옮기기" 단추) 자동 점검. 씨앗 고정(20260824).
##   godot --headless --path saga-godot --script res://tools/probe_save_transfer4.gd
## 판마다(dungeon·forest·story·realm): ① 단추 글 "옮기기"·화면이 생기고 그 판 세이브 autoload·판 이름을 쥠·장면 다시 띄우기 전 try_load
## ② 열기 → 플레이어 멈춤(frozen 이 있으면 그것, 없으면 물리 처리) · 이미 멈춘 플레이어면 안 열림 · 플레이어가 없어도 열림
## ③ 내보내기: `SAGA1|<판>|` 이거나 빈 세이브 안내 ④ 다른 판 글: 첫 누름은 확인만·둘째에 "다른 게임" 거절·세이브 파일 그대로 ⑤ 닫으면 플레이어 풀림
## ⑥ HUD 씬 넷에 단추와 판 이름. 진짜 세이브는 안 쓴다(save_call 을 막고 거절되는 글만 넣는다). 끝에 "PROBE save_transfer4 OK" 또는 "PROBE save_transfer4 FAIL n".

const BUTTON := "res://saga_core/ui/save_transfer_button.gd"
const HUDS := {"dungeon": "res://games/saga_dungeon/ui/DungeonHUD.tscn", "forest": "res://games/saga_forest/ui/ForestHUD.tscn",
	"story": "res://games/saga_story/ui/StoryHUD.tscn", "realm": "res://games/saga_realm/ui/RealmHUD.tscn"}

var fails := 0


func check(cond: bool, msg: String) -> void:
	if cond:
		print("  ok   ", msg)
	else:
		fails += 1
		print("  FAIL ", msg)


func _read(path: String) -> String:
	return FileAccess.get_file_as_string(path) if FileAccess.file_exists(path) else ""


func _initialize() -> void:
	await process_frame
	seed(20260824)
	var frozen_src := GDScript.new()
	frozen_src.source_code = "extends Node3D\nvar frozen := false\n"
	frozen_src.reload()
	var Btn: GDScript = load(BUTTON)

	for gid in ["dungeon", "forest", "story", "realm"]:
		var st: Node = root.get_node(String(Btn.STATES[gid]))
		var b: Button = Btn.new()
		b.game_id = gid
		root.add_child(b)
		await process_frame
		var sc: Node = b.screen
		check(b.text == "옮기기" and sc != null and sc.get("state") == st and sc.get("game_id") == gid and sc.get("load_before_reload") and (sc.get("save_call") as Callable).is_valid(),
			"%s: 단추 '옮기기' · 화면이 %s·판 이름을 쥠 · 저장 함수 · 다시 띄우기 전 try_load" % [gid, st.name])
		sc.set("save_call", Callable())   # 진짜 세이브를 안 쓴다
		sc.set("reload_after", false)
		# 플레이어: 블로·숲은 frozen 있는 공용 player.gd, 스토리는 없음(물리 처리), 국지는 플레이어 없음
		var p: Node3D = null
		if gid == "story":
			p = CharacterBody3D.new()
		elif gid != "realm":
			p = Node3D.new()
			p.set_script(frozen_src)
		if p != null:
			p.add_to_group("player")
			root.add_child(p)
			p.set_physics_process(true)
			if gid == "dungeon":   # 이미 멈춘 플레이어(다른 창)면 안 열림
				p.set("frozen", true)
				check(not sc.call("open_screen"), "dungeon: 이미 멈춘 플레이어면 안 열림")
				p.set("frozen", false)
		var opened: bool = sc.call("open_screen")
		var stopped: bool = p == null or (bool(p.get("frozen")) if "frozen" in p else not p.is_physics_processing())
		check(opened and stopped and sc.is_in_group("ui_modal"), "%s: 열림 · 플레이어 멈춤%s" % [gid, "" if p != null else "(플레이어 없음)"])
		var out: String = sc.call("export_now")
		check((out == "" and String(sc.get("status")).begins_with("내보낼 세이브가 없다")) or out.begins_with("SAGA1|%s|" % gid), "%s: 내보내기 = SAGA1|%s| 또는 빈 세이브 안내 (%d자)" % [gid, gid, out.length()])
		var path: String = st.call("save_path")
		var before := _read(path)
		(sc.get("_text") as TextEdit).text = "SAGA1|go|3|AAAA"
		var first: bool = sc.call("import_now")
		var first_status := String(sc.get("status"))
		var second: bool = sc.call("import_now")
		check(not first and first_status.contains("한 번 더") and not second and String(sc.get("status")).contains("다른 게임") and _read(path) == before,
			"%s: 다른 판 글 — 첫 누름은 확인만 · 둘째에 거절 · 세이브 파일 그대로" % gid)
		sc.call("close_screen")
		var released: bool = p == null or (not bool(p.get("frozen")) if "frozen" in p else p.is_physics_processing())
		check(not sc.get("is_open") and released and not sc.is_in_group("ui_modal"), "%s: 닫으면 플레이어 풀림" % gid)
		b.free()
		if p != null:
			p.free()

	# ⑥ HUD 씬
	for gid in HUDS:
		var txt := FileAccess.get_file_as_string(String(HUDS[gid]))
		check(txt.contains(BUTTON) and txt.contains("[node name=\"TransferSaveButton\"") and txt.contains("game_id = \"%s\"" % gid), "%s HUD: 옮기기 단추 · game_id \"%s\"" % [gid, gid])

	print("PROBE save_transfer4 ", "OK" if fails == 0 else "FAIL %d" % fails)
	quit(1 if fails > 0 else 0)
