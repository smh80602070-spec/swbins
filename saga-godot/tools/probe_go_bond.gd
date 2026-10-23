extends SceneTree

## G-0340 동료 우정(공용 saga_core/data/bond.gd + 1만리 data/go_bond.gd) 점검.
##   godot --headless --path saga-godot --script res://tools/probe_go_bond.gd   → "PROBE go_bond OK" / "FAIL n"
## ① 공용: Lv 문턱·단계 넷·성향별 대사·지기는 인물 한마디 ② 1만리 add: 단 오름 알림 · "나" 안 셈 · 지기 처음 인연 매듭 1(한 번)
## ③ 처치: 앞에 선 동료 +2 · 명단 다른 동료 +1(TestVillage) ④ 인물 창 줄 ⑤ SAGA_BOND=0 → 점수 없음 ⑥ 세이브 왕복·옛 세이브 빈 것 ⑦ 배선

var fails := 0


func check(cond: bool, msg: String) -> void:
	if cond:
		print("  ok   ", msg)
	else:
		fails += 1
		print("  FAIL ", msg)


func _frames(n: int) -> void:
	for _i in n:
		await process_frame


func _initialize() -> void:
	await process_frame
	var B: GDScript = load("res://saga_core/data/bond.gd")
	var GB: GDScript = load("res://games/saga_go/data/go_bond.gd")
	var PS: Node = root.get_node("PartyState")
	var SS: Node = root.get_node("SaveState")
	var saved := {"bond": (PS.get("bond") as Dictionary).duplicate(true), "knot": int(PS.call("count", "fate_knot")), "members": (PS.get("members") as Array).duplicate()}

	# ①
	check(int(B.level_of(0)) == 0 and int(B.level_of(19.9)) == 0 and int(B.level_of(20)) == 1 and int(B.level_of(650)) == 10 and int(B.level_of(9999)) == 10, "① Lv 문턱 0·20·650")
	check(int(B.tier_of(2)) == 0 and int(B.tier_of(3)) == 1 and int(B.tier_of(6)) == 2 and int(B.tier_of(9)) == 3, "① 단계 낯섦·친근·신뢰·지기")
	check(String(B.line("might", 0)) != String(B.line("wisdom", 0)) and String(B.line("nope", 4)) == String(B.LINES.virtue[1]) and String(B.line("might", 9, "한마디")) == "한마디"
		and String(B.line("might", 10)) == String(B.LINES.might[2]), "① 성향별 대사 · 모르면 virtue · 지기 = 한마디(없으면 신뢰 줄)")
	check(int(B.to_next(15)) == 5 and int(B.to_next(700)) == 0, "① 다음까지")

	# ②
	PS.set("bond", {})
	check(String(GB.add("self", 100.0)) == "" and not (PS.get("bond") as Dictionary).has("self"), "② 나는 안 셈")
	var m1: String = GB.add("sg_guanyu", 19.0)
	var m2: String = GB.add("sg_guanyu", 1.0)
	check(m1 == "" and m2.contains("명운과의 우정 Lv.1") and m2.contains("낯섦") and m2.contains("명운"), "② 단 오름 알림: %s" % m2)
	var k0: int = PS.call("count", "fate_knot")
	var m9: String = GB.add("sg_guanyu", 520.0)   # 540 → Lv 9 지기
	check(m9.contains("지기") and m9.contains("의(義)를 아는 이와") and m9.contains("인연 매듭 +1") and int(PS.call("count", "fate_knot")) == k0 + 1, "② 지기 — 한마디·인연 매듭: %s" % m9)
	GB.add("sg_guanyu", 200.0)
	check(int(PS.call("count", "fate_knot")) == k0 + 1, "② 매듭은 한 번")

	# ④
	var sl: String = GB.screen_line("sg_guanyu")
	check(sl.contains("우정 Lv.10") and sl.contains("지기") and not sl.contains("다음까지") and String(GB.screen_line("self")) == "", "④ 인물 창: %s" % sl)

	# ⑤
	OS.set_environment("SAGA_BOND", "0")
	var before := float(GB.pts("sg_zhangfei"))
	GB.add("sg_zhangfei", 50.0)
	check(is_equal_approx(float(GB.pts("sg_zhangfei")), before) and String(GB.screen_line("sg_guanyu")) == "", "⑤ SAGA_BOND=0 → 점수·글 없음")
	OS.set_environment("SAGA_BOND", "")

	# ③ 처치(1만리 씬)
	var sc := (load("res://games/saga_go/world/TestVillage.tscn") as PackedScene).instantiate()
	root.add_child(sc)
	current_scene = sc
	await _frames(40)
	var fc := get_first_node_in_group("go_field_combat")
	var roster: Array = fc.call("roster") if fc != null else []
	if roster.size() < 2:
		PS.set("members", ["sg_guanyu", "sg_zhangfei"] as Array[String])
		await _frames(2)
		roster = fc.call("roster") if fc != null else []
	PS.set("bond", {})
	var active := String(fc.call("active_id")) if fc != null else ""
	GB.on_kill(self)
	var ok_kill := roster.size() >= 2
	for id in roster:
		var want: float = 0.0 if String(id) == "self" else (GB.KILL_ACTIVE if String(id) == active else GB.KILL_PARTY)
		ok_kill = ok_kill and is_equal_approx(float(GB.pts(String(id))), want)
	check(ok_kill, "③ 처치 — 명단 %s · 앞 %s · 점수 %s" % [str(roster), active, str(PS.get("bond"))])

	# ⑥
	PS.set("bond", {"sg_zhangfei": 77.0, "_knot": ["sg_guanyu"]})
	var old_path: String = SS.path_override
	SS.path_override = "user://probe_go_bond_tmp.json"
	var ok_save: bool = SS.save()
	PS.set("bond", {})
	var ok_load: bool = SS.try_load()
	var rt: bool = is_equal_approx(float(GB.pts("sg_zhangfei")), 77.0) and ((PS.get("bond") as Dictionary).get("_knot", []) as Array).has("sg_guanyu")
	var d: Dictionary = JSON.parse_string(FileAccess.get_file_as_string(SS.save_path()))
	d.erase("bond")
	var f := FileAccess.open(SS.save_path(), FileAccess.WRITE)
	f.store_string(JSON.stringify(d))
	f.close()
	var ok_old: bool = SS.try_load()
	check(ok_save and ok_load and rt and ok_old and (PS.get("bond") as Dictionary).is_empty(), "⑥ 세이브 왕복 · 옛 세이브 빈 것")
	DirAccess.remove_absolute(ProjectSettings.globalize_path("user://probe_go_bond_tmp.json"))
	DirAccess.remove_absolute(ProjectSettings.globalize_path("user://probe_go_bond_tmp.json.bak"))
	SS.path_override = old_path

	# ⑦
	var src := {}
	for p in ["world/achievements.gd", "world/dispatch.gd", "ui/character_screen.gd", "data/save_state.gd"]:
		src[p] = FileAccess.get_file_as_string("res://games/saga_go/" + p)
	check(String(src["world/achievements.gd"]).contains("go_bond.gd\").on_kill(") and String(src["world/dispatch.gd"]).contains("go_bond.gd\").add(who")
		and String(src["ui/character_screen.gd"]).contains("go_bond.gd\").screen_line(id)") and String(src["data/save_state.gd"]).contains("\"bond\": PartyState.bond"), "⑦ 처치·탐사·인물 창·저장 배선")

	PS.set("bond", saved.bond)
	PS.set("members", saved.members)
	var dk: int = int(PS.call("count", "fate_knot")) - int(saved.knot)
	if dk != 0:
		PS.call("add_items", {"fate_knot": -dk})
	print("PROBE go_bond ", "OK" if fails == 0 else "FAIL %d" % fails)
	quit(1 if fails > 0 else 0)
