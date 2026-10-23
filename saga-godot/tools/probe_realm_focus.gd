extends SceneTree

## G-0336 5천하 국가 방침 나무 점검 —
##   godot --headless --path saga-godot --script res://tools/probe_realm_focus.gd   → "PROBE realm_focus OK" / "FAIL n"
## ① 처음엔 근본만 · 진행 중엔 다른 방침 못 고름 ② 달 끝마다 1 — 3달 뒤 완수·금 300·알림 ③ 갈림길: 부국 고르면 강병 닫힘
## ④ "둔전 확장 또는 조련" 앞 조건 · 대계까지 다섯 · 곱(금 1.1×1.05·수확 1.1×1.05·등용 1.15·계략 1.1) = _sc
## ⑤ SAGA_FOCUS=0 → 곱 1·못 고름·달 끝 그대로 ⑥ 세이브 왕복·옛 29 → 방침 없음·판 30 ⑦ 창·달 끝·징병·메뉴 배선.

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
	var FO: GDScript = load("res://games/saga_realm/data/realm_focus.gd")
	var saved := {"f": RS.focus.duplicate(true), "gold": RS.gold}
	RS.focus = {}

	# ①
	check(String(FO.why(RS, "root")) == "" and String(FO.why(RS, "rich")).contains("나라의 근본 먼저") and String(FO.why(RS, "talent")).contains("둔전 확장 또는 조련 먼저"), "① 처음엔 근본만 · 앞 조건 글")
	var p: Dictionary = FO.pick(RS, "root")
	check(bool(p.ok) and int(p.months) == 3 and String(FO.why(RS, "root")) == "진행 중", "① 근본 시작 3달")

	# ②
	RS.gold = 100
	var m1: Array = FO.monthly(RS)
	var m2: Array = FO.monthly(RS)
	check(m1.is_empty() and m2.is_empty() and int(RS.focus.left) == 1 and FO.mul(RS, "gold") == 1.0, "② 두 달 — 아직(남은 1)")
	var m3: Array = FO.monthly(RS)
	check(m3.size() == 1 and String(m3[0]).contains("「나라의 근본」 완수") and int(RS.gold) == 400 and (FO.done(RS) as Array).has("root") and String(RS.focus.cur) == "", "② 셋째 달 완수 · 금 +300: %s" % str(m3))
	check(FO.monthly(RS).is_empty(), "② 빈 방침이면 달 끝 아무것도 없음")

	# ③
	FO.pick(RS, "rich")
	check(String(FO.why(RS, "army")).contains("갈림길") and String(FO.why(RS, "farm")).contains("부국 먼저"), "③ 부국 진행 중 — 강병 닫힘")
	for i in 4:
		FO.monthly(RS)
	check((FO.done(RS) as Array).has("rich") and String(FO.why(RS, "army")).contains("갈림길") and String(FO.why(RS, "drill")) != "" and is_equal_approx(FO.mul(RS, "gold"), 1.1), "③ 부국 완수 — 금 ×1.1 · 강병·조련 못 고름")

	# ④
	for id in ["farm", "talent", "grand"]:
		var r: Dictionary = FO.pick(RS, id)
		for i in int(r.get("months", 0)):
			FO.monthly(RS)
	check((FO.done(RS) as Array).size() == FO.MAX_DONE and (FO.done(RS) as Array).has("grand"), "④ 근본→부국→둔전→인재→대계 다섯 %s" % str(FO.done(RS)))
	check(is_equal_approx(FO.mul(RS, "gold"), 1.1 * 1.05) and is_equal_approx(FO.mul(RS, "food"), 1.1 * 1.05) and is_equal_approx(FO.mul(RS, "hire"), 1.15)
		and is_equal_approx(FO.mul(RS, "plot"), 1.1) and FO.mul(RS, "draft") == 1.0, "④ 곱 표")
	var sc_on: float = RS._sc("plot")
	var all_lines: Array = FO.lines(RS)
	check(all_lines.size() == 7 and String(all_lines[0].label).contains("✓ 완수") and String(all_lines[3].label).contains("갈림길"), "④ 창 줄: %s / %s" % [all_lines[0].label, all_lines[3].label])

	# ⑤
	OS.set_environment("SAGA_FOCUS", "0")
	var sc_off: float = RS._sc("plot")
	var off_ok: bool = FO.mul(RS, "gold") == 1.0 and String(FO.why(RS, "army")) == "꺼져 있다" and is_equal_approx(sc_on / sc_off, 1.1)
	RS.focus = {"done": ["root"], "cur": "army", "left": 1}
	off_ok = off_ok and FO.monthly(RS).is_empty() and int(RS.focus.left) == 1
	OS.set_environment("SAGA_FOCUS", "")
	check(off_ok, "⑤ SAGA_FOCUS=0 → 곱 1·못 고름·달 끝 그대로")

	# ⑥
	RS.focus = {"done": ["root", "army"], "cur": "drill", "left": 2}
	RS.path_override = "user://probe_realm_focus_save.json"
	var ok_save: bool = RS.save()
	RS.focus = {}
	var ok_load: bool = RS.try_load()
	var rt: bool = (RS.focus.done as Array) == ["root", "army"] and String(RS.focus.cur) == "drill" and typeof(RS.focus.left) == TYPE_INT and int(RS.focus.left) == 2
	var f := FileAccess.open(RS.path_override, FileAccess.READ)
	var dd: Dictionary = JSON.parse_string(f.get_as_text())
	f.close()
	dd.erase("focus")
	dd["version"] = 29
	f = FileAccess.open(RS.path_override, FileAccess.WRITE)
	f.store_string(JSON.stringify(dd))
	f.close()
	var ok_old: bool = RS.try_load()
	var old_empty: bool = (FO.done(RS) as Array).is_empty() and String(FO.st(RS).cur) == ""
	DirAccess.remove_absolute(ProjectSettings.globalize_path(RS.path_override))
	DirAccess.remove_absolute(ProjectSettings.globalize_path(RS.path_override + ".bak"))
	RS.path_override = ""
	check(ok_save and ok_load and rt and ok_old and old_empty and RS.SAVE_VERSION >= 30, "⑥ 세이브 왕복 · 옛 29 → 방침 없음 · 판 %d" % RS.SAVE_VERSION)

	# ⑦
	var mo := FileAccess.get_file_as_string("res://games/saga_realm/data/realm_rules_month.gd")
	var ru := FileAccess.get_file_as_string("res://games/saga_realm/data/realm_rules.gd")
	var hud := FileAccess.get_file_as_string("res://games/saga_realm/ui/RealmHUD.tscn")
	check(mo.contains("realm_focus.gd\").monthly(self)") and ru.contains("realm_focus.gd\").mul(self, \"draft\")") and hud.contains("realm_focus_button.gd") and hud.contains("\"FocusButton|🎯|방침\""), "⑦ 달 끝·징병·단추·메뉴 칸")

	RS.focus = saved.f
	RS.gold = saved.gold
	print("PROBE realm_focus ", "OK" if fails == 0 else "FAIL %d" % fails)
	quit(1 if fails > 0 else 0)
