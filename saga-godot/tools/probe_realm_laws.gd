extends SceneTree

## G-0321 5천하 법령 점검 —
##   godot --headless --path saga-godot --script res://tools/probe_realm_laws.gd   → "PROBE realm_laws OK" / "FAIL n"
## ① 빈 법전: 곱 전부 1 · 수 = 1 + 최고 관직 ② 내리기: 상업령 → _sc("gold") ×1.15·_sc("food") ×0.9 · 이미 내림 거절
## ③ 6달 틈 · 관직 모자람 거절 → 승진하면 열림 ④ 실제 판정: 징병령 → _do_draft 몫 ×1.25 · 엄법령 → 이탈 곱 ×0.5
## ⑤ SAGA_LAWS=0 → 곱 1·못 내림 ⑥ 세이브 왕복·옛 26 → 빈 법전·판 27 ⑦ 창 줄·HUD 단추·메뉴 칸.

var fails := 0


func check(cond: bool, msg: String) -> void:
	if cond:
		print("  ok   ", msg)
	else:
		fails += 1
		print("  FAIL ", msg)


func _initialize() -> void:
	await process_frame
	var RS: Node = root.get_node("RealmSaveState")
	var LW: GDScript = load("res://games/saga_realm/data/realm_laws.gd")
	var saved := {"laws": RS.laws.duplicate(true), "og": RS.officer_growth.duplicate(true), "y": RS.year, "m": RS.month, "roster": RS.roster.duplicate(),
		"cities": RS.cities.duplicate(true), "cur": RS.current_city}

	# ①
	RS.laws = {}
	RS.officer_growth = {}
	RS.roster = ["sg_zhugeliang"]
	var ones := true
	for k in ["gold", "food", "eat", "draft", "hire", "defect", "exp"]:
		if not is_equal_approx(LW.mul(RS, k), 1.0):
			ones = false
	check(ones and LW.cap(RS) == 1, "① 빈 법전 곱 1 · 수 %d" % LW.cap(RS))

	# ②
	RS.year = 200
	RS.month = 1
	var g0: float = RS._sc("gold")
	var r: Dictionary = LW.enact(RS, "commerce")
	check(bool(r.ok) and is_equal_approx(RS._sc("gold"), g0 * 1.15) and is_equal_approx(LW.mul(RS, "food"), 0.9) and String(LW.why(RS, "commerce")).contains("이미"), "② 상업령 → 금 ×1.15·수확 ×0.9 · 둘째 거절")

	# ③
	check(String(LW.why(RS, "strict")).contains("관직"), "③ 관직 모자람 거절")
	RS.officer_growth = {"sg_zhugeliang": {"lv": 1, "rank": 2, "exp": 0}}
	var gap_why: String = LW.why(RS, "strict")
	RS.month = 7
	var open_why: String = LW.why(RS, "strict")
	check(LW.cap(RS) == 3 and gap_why.contains("6달") and open_why == "", "③ 승진 → 수 3 · 6달 틈(「%s」) · 7월 열림" % gap_why)

	# ④
	LW.enact(RS, "conscript")
	var o: Dictionary = {}
	for x: Dictionary in (load("res://games/saga_realm/data/realm_orders.gd") as GDScript).ORDERS:
		if String(x.key) == "draft":
			o = x
	RS.current_city = RS.cities.keys()[0]
	var c: Dictionary = RS.cities[RS.current_city]
	c.pop = 1000000
	c.troops = 0
	seed(1)
	RS._rng.seed = 77
	var with_law: int = int(RS._do_draft(o, "sg_zhugeliang").amount)
	RS.laws.list.erase("conscript")
	c.troops = 0
	RS._rng.seed = 77
	var without: int = int(RS._do_draft(o, "sg_zhugeliang").amount)
	RS.laws.list.append("conscript")
	RS.month = 1
	RS.year = 201
	LW.enact(RS, "strict")
	check(without > 0 and with_law == roundi(without * 1.25) and is_equal_approx(RS._sc("defect"), 0.5), "④ 징병 %d → %d(×1.25) · 이탈 곱 ×0.5" % [without, with_law])

	# ⑤
	OS.set_environment("SAGA_LAWS", "0")
	check(is_equal_approx(LW.mul(RS, "gold"), 1.0) and not bool(LW.enact(RS, "tuntian").ok), "⑤ SAGA_LAWS=0 → 곱 1·못 내림")
	OS.set_environment("SAGA_LAWS", "")

	# ⑥
	RS.path_override = "user://probe_realm_laws_save.json"
	var ok_save: bool = RS.save()
	RS.laws = {}
	var ok_load: bool = RS.try_load()
	var rt: bool = LW.enacted(RS).size() == 3 and int(RS.laws.next) == 201 * 12 + 1 + 6 and typeof(RS.laws.next) == TYPE_INT
	var f := FileAccess.open(RS.path_override, FileAccess.READ)
	var dd: Dictionary = JSON.parse_string(f.get_as_text())
	f.close()
	dd.erase("laws")
	dd["version"] = 26
	f = FileAccess.open(RS.path_override, FileAccess.WRITE)
	f.store_string(JSON.stringify(dd))
	f.close()
	var ok_old: bool = RS.try_load()
	var old_empty: bool = LW.enacted(RS).is_empty()
	DirAccess.remove_absolute(ProjectSettings.globalize_path(RS.path_override))
	DirAccess.remove_absolute(ProjectSettings.globalize_path(RS.path_override + ".bak"))
	RS.path_override = ""
	check(ok_save and ok_load and rt and ok_old and old_empty and RS.SAVE_VERSION >= 27, "⑥ 세이브 왕복 · 옛 26 → 빈 법전 · 판 %d" % RS.SAVE_VERSION)

	# ⑦
	var lines: Array = LW.lines(RS)
	var hud := FileAccess.get_file_as_string("res://games/saga_realm/ui/RealmHUD.tscn")
	check(lines.size() == 4 and String(lines[0].label).contains("🏪") and hud.contains("realm_law_button.gd") and hud.contains("\"LawButton|📜|법령\""), "⑦ 창 줄 넷 · HUD 단추·메뉴 칸")

	RS.laws = saved.laws
	RS.officer_growth = saved.og
	RS.year = saved.y
	RS.month = saved.m
	RS.roster = saved.roster
	RS.cities = saved.cities
	RS.current_city = saved.cur
	print("PROBE realm_laws ", "OK" if fails == 0 else "FAIL %d" % fails)
	quit(1 if fails > 0 else 0)
