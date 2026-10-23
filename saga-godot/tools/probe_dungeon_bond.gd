extends SceneTree

## G-0341 2나락 부대 우정(data/dungeon_bond.gd, 공용 saga_core/data/bond.gd) 점검.
##   godot --headless --path saga-godot --script res://tools/probe_dungeon_bond.gd   → "PROBE dungeon_bond OK" / "FAIL n"
## ① 방 깸 → 부대 전원 +5 · 완주 +15 ② 단 오름 알림(공용 글) · 지기 처음 금 +500(한 번) ③ HUD 부대 줄 꼬리표(TestRoom)
## ④ SAGA_BOND=0 → 점수 없음·꼬리표 없음 ⑤ 저장 왕복·옛 세이브 빈 것 ⑥ 1만리 어댑터도 공용 gain ⑦ 배선

var fails := 0


func check(cond: bool, msg: String) -> void:
	if cond:
		print("  ok   ", msg)
	else:
		fails += 1
		print("  FAIL ", msg)


func _initialize() -> void:
	await process_frame
	var DB: GDScript = load("res://games/saga_dungeon/data/dungeon_bond.gd")
	var Save: Node = root.get_node("DungeonSaveState")
	var Party: Node = root.get_node("DungeonPartyState")
	var G: Node = root.get_node("DungeonGoldState")
	var saved := {"bond": (Save.get("bond") as Dictionary).duplicate(true), "members": (Party.get("members") as Array).duplicate(), "gold": G.gold}
	Party.set("members", ["sg_guanyu", "sg_zhangfei"] as Array[String])
	Save.set("bond", {})

	# ①
	DB.on_room(false)
	DB.on_room(true)
	check(is_equal_approx(float(DB.pts("sg_guanyu")), 20.0) and is_equal_approx(float(DB.pts("sg_zhangfei")), 20.0), "① 방 +5 · 완주 +15 → 둘 다 20")

	# ②
	G.gold = 0
	var m: String = DB.add("sg_guanyu", 520.0)
	check(m.contains("명운과의 우정 Lv.9") and m.contains("지기") and m.contains("💰 +500") and int(G.gold) == 500, "② 지기 — 금 +500: %s" % m)
	DB.add("sg_guanyu", 200.0)
	check(int(G.gold) == 500, "② 금은 한 번")

	# ④
	OS.set_environment("SAGA_BOND", "0")
	DB.on_room(true)
	check(is_equal_approx(float(DB.pts("sg_zhangfei")), 20.0) and String(DB.name_tag("sg_zhangfei", "뇌호")) == "뇌호", "④ SAGA_BOND=0 → 점수·꼬리표 없음")
	OS.set_environment("SAGA_BOND", "")

	# ⑤
	var old_path: String = Save.path_override
	Save.path_override = "user://probe_dungeon_bond_tmp.json"
	var body := Node3D.new()
	root.add_child(body)
	Save.save(body)
	Save.set("bond", {})
	var ld: bool = Save.try_load()
	var rt: bool = ld and is_equal_approx(float(DB.pts("sg_guanyu")), 740.0) and ((Save.get("bond") as Dictionary).get("_knot", []) as Array).has("sg_guanyu")
	var d: Dictionary = JSON.parse_string(FileAccess.get_file_as_string(Save.save_path()))
	d.erase("bond")
	var f := FileAccess.open(Save.save_path(), FileAccess.WRITE)
	f.store_string(JSON.stringify(d))
	f.close()
	check(rt and Save.try_load() and (Save.get("bond") as Dictionary).is_empty(), "⑤ 저장 왕복 · 옛 세이브 빈 것")
	DirAccess.remove_absolute(ProjectSettings.globalize_path("user://probe_dungeon_bond_tmp.json"))
	DirAccess.remove_absolute(ProjectSettings.globalize_path("user://probe_dungeon_bond_tmp.json.bak"))
	Save.path_override = old_path
	body.queue_free()

	# ③ HUD(TestRoom)
	var sc := (load("res://games/saga_dungeon/world/TestRoom.tscn") as PackedScene).instantiate()
	root.add_child(sc)
	current_scene = sc
	for _i in 30:
		await process_frame
	Party.set("members", ["sg_guanyu", "sg_zhangfei"] as Array[String])
	Save.set("bond", {"sg_guanyu": 300.0})
	call_group("dungeon_party_label", "_refresh")
	await process_frame
	var lab := sc.find_child("PartyLabel", true, false) as Label
	var lt := lab.text if lab != null else ""
	check(lt.contains("명운 💛6") and lt.contains("뇌호 🤝0"), "③ HUD 부대 줄: %s" % lt)

	# ⑥·⑦
	var gb := FileAccess.get_file_as_string("res://games/saga_go/data/go_bond.gd")
	var tr := FileAccess.get_file_as_string("res://games/saga_dungeon/world/test_room.gd")
	var pl := FileAccess.get_file_as_string("res://games/saga_dungeon/ui/party_label.gd")
	check(gb.contains("Bond.gain(PartyState.bond"), "⑥ 1만리도 공용 gain")
	check(tr.contains("dungeon_bond.gd\").on_room(is_final, self)") and pl.contains("dungeon_bond.gd\").name_tag("), "⑦ 방 깸·부대 줄 배선")

	Save.set("bond", saved.bond)
	Party.set("members", saved.members)
	G.gold = saved.gold
	print("PROBE dungeon_bond ", "OK" if fails == 0 else "FAIL %d" % fails)
	quit(1 if fails > 0 else 0)
