extends SceneTree

## G-0332 5천하 혼인 동맹 점검 —
##   godot --headless --path saga-godot --script res://tools/probe_realm_marriage.gd   → "PROBE realm_marriage OK" / "FAIL n"
## ① 거절: 우호 모자람·금 모자람·우리 무장 아님 ② 맺기: 금 −1500 · 우호 +15 · 충성 +10 · 정전 ≥ 2 · 같은 세력·같은 무장 거절 · 둘까지
## ③ 달 끝: 정전 2 이상 유지·우호 +1 ④ 얽힘: 맺은 무장이 로스터에서 빠지면 깨짐(우호 −30·정전 0·알림) ⑤ SAGA_MARRIAGE=0
## ⑥ 세이브 왕복·옛 28 → 혼인 없음·판 29 ⑦ 외교 창·달 끝 배선.

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
	var MA: GDScript = load("res://games/saga_realm/data/realm_marriage.gd")
	var saved := {"m": RS.marriages.duplicate(), "dip": RS.diplomacy.duplicate(true), "gold": RS.gold, "roster": RS.roster.duplicate(), "ol": RS.officer_loyal.duplicate(true)}
	var fa := "probe_fa"
	var fb := "probe_fb"
	var fc := "probe_fc"
	RS.marriages = {}
	RS.diplomacy[fa] = {"relation": 60, "truce_months": 0}
	RS.diplomacy[fb] = {"relation": 80, "truce_months": 0}
	RS.diplomacy[fc] = {"relation": 90, "truce_months": 0}
	RS.roster = ["sg_guanyu", "sg_liubei", "sg_zhangfei"]
	RS.officer_loyal = {"sg_guanyu": 50, "sg_liubei": 50, "sg_zhangfei": 50}

	# ①
	RS.gold = 1000
	var w1: String = MA.why(RS, fa, "sg_guanyu")
	var w2: String = MA.why(RS, fb, "sg_guanyu")
	RS.gold = 9000
	check(w1.contains("우호") and w2.contains("금") and String(MA.why(RS, fb, "sg_lubu")).contains("우리 무장"), "① 우호·금·남의 무장 거절")

	# ②
	var r: Dictionary = MA.marry(RS, fb, "sg_guanyu")
	var after: bool = bool(r.ok) and RS.gold == 7500 and int(RS.diplomacy[fb].relation) == 95 and int(RS.officer_loyal.sg_guanyu) == 60 and int(RS.diplomacy[fb].truce_months) >= 2
	var again: String = MA.why(RS, fb, "sg_liubei")
	var same_off: String = MA.why(RS, fc, "sg_guanyu")
	MA.marry(RS, fc, "sg_liubei")
	RS.diplomacy[fa].relation = 99
	var third: String = MA.why(RS, fa, "sg_zhangfei")
	check(after and again.contains("이미") and same_off.contains("이미 혼인한") and third.contains("2까지"), "② 맺기 금 −1500·우호 95·충성 60·정전 · 같은 세력/무장 거절 · 둘까지")

	# ③
	RS.diplomacy[fb].truce_months = 0
	MA.monthly(RS)
	check(int(RS.diplomacy[fb].truce_months) >= 2 and int(RS.diplomacy[fb].relation) == 96, "③ 달 끝 정전 유지·우호 +1")

	# ④
	RS.roster.erase("sg_liubei")
	var msgs: Array = MA.monthly(RS)
	check(not RS.marriages.has(fc) and int(RS.diplomacy[fc].relation) == 70 and int(RS.diplomacy[fc].truce_months) == 0 and msgs.size() == 1, "④ 맺은 무장이 사라지면 깨짐 「%s」" % (msgs[0] if msgs.size() > 0 else ""))

	# ⑤
	OS.set_environment("SAGA_MARRIAGE", "0")
	check(String(MA.why(RS, fa, "sg_zhangfei")).contains("꺼져") and MA.monthly(RS).is_empty(), "⑤ SAGA_MARRIAGE=0")
	OS.set_environment("SAGA_MARRIAGE", "")

	# ⑥
	RS.path_override = "user://probe_realm_marriage_save.json"
	var ok_save: bool = RS.save()
	RS.marriages = {}
	var ok_load: bool = RS.try_load()
	var rt: bool = String(RS.marriages.get(fb, "")) == "sg_guanyu"
	var f := FileAccess.open(RS.path_override, FileAccess.READ)
	var dd: Dictionary = JSON.parse_string(f.get_as_text())
	f.close()
	dd.erase("marriages")
	dd["version"] = 28
	f = FileAccess.open(RS.path_override, FileAccess.WRITE)
	f.store_string(JSON.stringify(dd))
	f.close()
	var ok_old: bool = RS.try_load()
	var old_empty: bool = (RS.marriages as Dictionary).is_empty()
	DirAccess.remove_absolute(ProjectSettings.globalize_path(RS.path_override))
	DirAccess.remove_absolute(ProjectSettings.globalize_path(RS.path_override + ".bak"))
	RS.path_override = ""
	check(ok_save and ok_load and rt and ok_old and old_empty and RS.SAVE_VERSION >= 29, "⑥ 세이브 왕복 · 옛 28 → 혼인 없음 · 판 %d" % RS.SAVE_VERSION)

	# ⑦
	var db := FileAccess.get_file_as_string("res://games/saga_realm/ui/realm_diplo_button.gd")
	var mo := FileAccess.get_file_as_string("res://games/saga_realm/data/realm_rules_month.gd")
	check(db.contains("_pick_bride(target_id, action_box)") and mo.contains("realm_marriage.gd\").monthly(self)"), "⑦ 외교 창·달 끝 배선")

	RS.marriages = saved.m
	RS.diplomacy = saved.dip
	RS.gold = saved.gold
	RS.roster = saved.roster
	RS.officer_loyal = saved.ol
	print("PROBE realm_marriage ", "OK" if fails == 0 else "FAIL %d" % fails)
	quit(1 if fails > 0 else 0)
