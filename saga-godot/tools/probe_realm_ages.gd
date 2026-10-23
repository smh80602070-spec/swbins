extends SceneTree

## G-0329 5천하 국세 올리기 점검 —
##   godot --headless --path saga-godot --script res://tools/probe_realm_ages.gd   → "PROBE realm_ages OK" / "FAIL n"
## ① 난세: 곱 1 · 모자람 까닭(성·기술·금) ② 올리기: 금 −1500 · 기틀 · _sc("gold")·("food") ×1.05 ③ 성세: ×1.05³ · 경험 ×1.1 · 더 못 올림
## ④ SAGA_AGES=0 → 곱 1·못 올림 ⑤ 세이브 왕복·옛 27 → 난세·판 28 ⑥ 법령 창 맨 위 줄.

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
	var AG: GDScript = load("res://games/saga_realm/data/realm_ages.gd")
	var saved := {"age": RS.age, "gold": RS.gold, "cities": RS.cities.duplicate(true)}

	# ①
	RS.age = 0
	RS.gold = 100
	var w0: String = AG.why(RS, 1)
	check(is_equal_approx(AG.mul(RS, "gold"), 1.0) and w0.contains("성") and w0.contains("기술 1/4") and w0.contains("금 100/1500"), "① 난세 곱 1 · 까닭 「%s」" % w0)

	# ②
	var c4 := {}
	for i in 4:
		c4["probe_%d" % i] = (RS.cities.values()[0] as Dictionary).duplicate(true)
	RS.cities = c4
	RS.gold = 2000
	var g0: float = RS._sc("gold")
	var r: Dictionary = AG.advance(RS, 4)
	check(bool(r.ok) and RS.gold == 500 and RS.age == 1 and is_equal_approx(RS._sc("gold"), g0 * 1.05) and is_equal_approx(AG.mul(RS, "food"), 1.05), "② 기틀 — 금 2000 → %d · 금 곱 ×1.05" % RS.gold)

	# ③
	RS.age = 3
	check(is_equal_approx(AG.mul(RS, "gold"), pow(1.05, 3)) and is_equal_approx(AG.mul(RS, "exp"), 1.1) and String(AG.why(RS, 99)).contains("이미"), "③ 성세 ×%.3f · 경험 ×1.1 · 더 못 올림" % AG.mul(RS, "gold"))

	# ④
	OS.set_environment("SAGA_AGES", "0")
	check(is_equal_approx(AG.mul(RS, "gold"), 1.0) and not bool(AG.advance(RS, 99).ok), "④ SAGA_AGES=0 → 곱 1·못 올림")
	OS.set_environment("SAGA_AGES", "")

	# ⑤
	RS.age = 2
	RS.path_override = "user://probe_realm_ages_save.json"
	var ok_save: bool = RS.save()
	RS.age = 0
	var ok_load: bool = RS.try_load()
	var rt: bool = RS.age == 2
	var f := FileAccess.open(RS.path_override, FileAccess.READ)
	var dd: Dictionary = JSON.parse_string(f.get_as_text())
	f.close()
	dd.erase("age")
	dd["version"] = 27
	f = FileAccess.open(RS.path_override, FileAccess.WRITE)
	f.store_string(JSON.stringify(dd))
	f.close()
	var ok_old: bool = RS.try_load()
	var old0: bool = RS.age == 0
	DirAccess.remove_absolute(ProjectSettings.globalize_path(RS.path_override))
	DirAccess.remove_absolute(ProjectSettings.globalize_path(RS.path_override + ".bak"))
	RS.path_override = ""
	check(ok_save and ok_load and rt and ok_old and old0 and RS.SAVE_VERSION >= 28, "⑤ 세이브 왕복 · 옛 27 → 난세 · 판 %d" % RS.SAVE_VERSION)

	# ⑥
	var lb := FileAccess.get_file_as_string("res://games/saga_realm/ui/realm_law_button.gd")
	var st := FileAccess.get_file_as_string("res://games/saga_realm/data/realm_state.gd")
	check(lb.contains("Ages.line(rs, techs)") and st.contains("realm_ages.gd\").mul(self, key)") and String(AG.line(RS, 0)).begins_with("🏯 국세"), "⑥ 법령 창 맨 위 줄 · _sc 곱")

	RS.age = saved.age
	RS.gold = saved.gold
	RS.cities = saved.cities
	print("PROBE realm_ages ", "OK" if fails == 0 else "FAIL %d" % fails)
	quit(1 if fails > 0 else 0)
