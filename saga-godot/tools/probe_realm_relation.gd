extends SceneTree

## G-0316 5천하 장수 관계망(웹 W-0308 짝) 점검 —
##   godot --headless --path saga-godot --script res://tools/probe_realm_relation.gd   → "PROBE realm_relation OK" / "FAIL n"
## ① 짝 표: 웹 PAIRS 33 · 도감에 없는 id 짝은 빠짐 ② 의형제: 같은 출진 성에 우리 무장이면 ×1.05 · 다른 성·로스터 밖이면 ×1
## ③ 원수: 둘 다 우리 무장이면 달마다 충성 -2 ④ 사제: 스승 전사(annals) → 제자 무력·지력·통솔 +3 한 번
## ⑤ 무장 줄 꼬리(officer_hint) ⑥ SAGA_RELATION=0 → 효과 없음 ⑦ 세이브 왕복·옛 25 → 빈 것·버전 26 ⑧ 배선(출진·달 끝·줄).

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
	var RL: GDScript = load("res://games/saga_realm/data/realm_relation.gd")
	var saved := {"roster": RS.roster.duplicate(), "oc": RS.officer_city.duplicate(true), "ol": RS.officer_loyal.duplicate(true),
		"annals": RS.annals.duplicate(true), "rm": RS.rel_master.duplicate(true), "og": RS.officer_growth.duplicate(true)}

	# ①
	var gy: Array = RL.pairs_of("sg_guanyu")
	var caohong: Array = RL.pairs_of("sg_caocao").filter(func(p: Array) -> bool: return p[0] == "rf_caohong")
	check(RL.PAIRS.size() == 33 and gy.size() == 3 and caohong.is_empty(), "① 짝 33 · 명운 짝 셋 · 도감에 없는 id 짝 빠짐")

	# ②
	RS.roster = ["sg_guanyu", "sg_liubei"]
	RS.officer_city = {"sg_guanyu": "xuchang", "sg_liubei": "xuchang"}
	var same: float = RL.attack_mul(RS, "sg_guanyu", "xuchang")
	RS.officer_city["sg_liubei"] = "chenliu"
	var other_city: float = RL.attack_mul(RS, "sg_guanyu", "xuchang")
	RS.roster = ["sg_guanyu"]
	var gone: float = RL.attack_mul(RS, "sg_guanyu", "xuchang")
	check(is_equal_approx(same, 1.05) and is_equal_approx(other_city, 1.0) and is_equal_approx(gone, 1.0), "② 의형제 같은 성 ×%.2f · 다른 성 ×%.2f · 로스터 밖 ×%.2f" % [same, other_city, gone])

	# ③
	RS.roster = ["sg_lubu", "sg_zhangfei"]
	RS.officer_loyal = {"sg_lubu": 60, "sg_zhangfei": 70}
	RS.annals = {}
	RS.rel_master = {}
	RL.monthly(RS)
	check(int(RS.officer_loyal.sg_lubu) == 58 and int(RS.officer_loyal.sg_zhangfei) == 68, "③ 원수 한 세력 → 둘 다 충성 -2")

	# ④
	RS.roster = ["sg_luxun"]
	RS.officer_growth = {}
	var before: float = RS._effective_stat("sg_luxun", "wisdom")
	var none: Array = RL.monthly(RS)
	RS.annals = {"sg_zhouyu": {"year": 200, "month": 1, "where": "x", "by": "y"}}
	var msgs: Array = RL.monthly(RS)
	var after: float = RS._effective_stat("sg_luxun", "wisdom")
	RL.monthly(RS)
	var again: float = RS._effective_stat("sg_luxun", "wisdom")
	check(none.is_empty() and msgs.size() == 1 and is_equal_approx(after - before, 3.0) and is_equal_approx(again, after) and RS.rel_master.has("sg_luxun"),
		"④ 스승 전사 → 제자 지력 %.0f→%.0f(+3) 한 번" % [before, after])

	# ⑤
	var tail: String = RL.hint(RS, "sg_luxun")
	check(tail.contains("📖") and tail.contains("(스승) †") and tail.contains("📖+3") and RS.officer_hint("sg_luxun").ends_with(tail), "⑤ 무장 줄 꼬리 「%s」" % tail)

	# ⑥
	OS.set_environment("SAGA_RELATION", "0")
	RS.roster = ["sg_guanyu", "sg_liubei"]
	RS.officer_city = {"sg_guanyu": "xuchang", "sg_liubei": "xuchang"}
	check(is_equal_approx(RL.attack_mul(RS, "sg_guanyu", "xuchang"), 1.0) and RL.monthly(RS).is_empty() and RL.hint(RS, "sg_guanyu") == "", "⑥ SAGA_RELATION=0 → 효과·줄 없음")
	OS.set_environment("SAGA_RELATION", "")

	# ⑦
	RS.rel_master = {"sg_luxun": "sg_zhouyu"}
	RS.path_override = "user://probe_realm_relation_save.json"
	var ok_save: bool = RS.save()
	RS.rel_master = {}
	var ok_load: bool = RS.try_load()
	var rt: bool = String(RS.rel_master.get("sg_luxun", "")) == "sg_zhouyu"
	var f := FileAccess.open(RS.path_override, FileAccess.READ)
	var dd: Dictionary = JSON.parse_string(f.get_as_text())
	f.close()
	dd.erase("rel_master")
	dd["version"] = 25
	f = FileAccess.open(RS.path_override, FileAccess.WRITE)
	f.store_string(JSON.stringify(dd))
	f.close()
	var ok_old: bool = RS.try_load()
	var old_empty: bool = (RS.rel_master as Dictionary).is_empty()
	DirAccess.remove_absolute(ProjectSettings.globalize_path(RS.path_override))
	DirAccess.remove_absolute(ProjectSettings.globalize_path(RS.path_override + ".bak"))
	RS.path_override = ""
	check(ok_save and ok_load and rt and ok_old and old_empty and RS.SAVE_VERSION >= 26, "⑦ 세이브 왕복 · 옛 25 → 빈 것 · 버전 %d" % RS.SAVE_VERSION)

	# ⑧
	var war := FileAccess.get_file_as_string("res://games/saga_realm/data/realm_rules_war.gd")
	var mon := FileAccess.get_file_as_string("res://games/saga_realm/data/realm_rules_month.gd")
	check(war.contains("realm_relation.gd\").attack_mul(self, officer_id, from_city)") and mon.contains("realm_relation.gd\").monthly(self))") and mon.contains("realm_relation.gd\").hint(self, id)"), "⑧ 배선 셋")

	RS.roster = saved.roster
	RS.officer_city = saved.oc
	RS.officer_loyal = saved.ol
	RS.annals = saved.annals
	RS.rel_master = saved.rm
	RS.officer_growth = saved.og
	print("PROBE realm_relation ", "OK" if fails == 0 else "FAIL %d" % fails)
	quit(1 if fails > 0 else 0)
