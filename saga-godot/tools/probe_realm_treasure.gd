extends SceneTree

## G-0402 5천하 장수 보물·보물 세트(웹 W-0440 짝) 점검 —
##   godot --headless --path saga-godot --script res://tools/probe_realm_treasure.gd   → "PROBE realm_treasure OK" / "FAIL n"
## ① 보물 11 · 등급(+6 기본 · +8 상급 · +9 희귀 · +10 영웅) · 세트 셋(조각 셋씩) ② 보물 → 그 축 능력치 +bonus · 다른 축 그대로 · 보물 없으면 옛 값
## ③ 세트: 우리 장수 둘이 무장 조각 나눠 지님 → 무력 +5% · 셋 → +10% · 로스터 밖 조각은 안 셈 ④ 세트 전법: 둘 이상 → 전술판 유닛 돌격진 공격 +3 · 군사 원거리 사거리 +1(최대 3)
## ⑤ 보스전 승리 → 데려간 장수에게 보물(해시 — 같은 성·장수 같은 보물) ⑥ 무장 줄 「🗡️무쇠검(기본 +6) 🧩무장의 채비」 ⑦ 세이브 왕복·키 없음 → 빈 것·버전 그대로 ⑧ 손잡이 0 = 끔.

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
	var TR: GDScript = load("res://games/saga_realm/data/realm_treasure.gd")
	var RT: GDScript = load("res://games/saga_realm/data/realm_tactics.gd")
	var saved := {"oi": (RS.officer_item as Dictionary).duplicate(), "roster": (RS.roster as Array).duplicate()}
	var A := "sg_guanyu"
	var B := "sg_zhangfei"
	var C := "sg_liubei"

	# ①
	check(TR.ITEMS.size() == 11 and TR.grade_of(TR.item("itm_ironblade")) == 1 and TR.grade_of(TR.item("itm_armor")) == 2 and TR.grade_of(TR.item("itm_timeshard")) == 3 and TR.grade_of(TR.item("itm_drum")) == 4 and TR.SETS.size() == 3,
		"① 보물 11 · 등급 기본·상급·희귀·영웅 · 세트 셋")

	# ②
	RS.roster = [A, B, C]
	RS.officer_item = {}
	var m0: float = RS._effective_stat(A, "might")
	var w0: float = RS._effective_stat(A, "wisdom")
	RS.officer_item = {A: "itm_ironblade"}
	var m1: float = RS._effective_stat(A, "might")
	var w1: float = RS._effective_stat(A, "wisdom")
	check(is_equal_approx(m1 - m0, 6.0) and is_equal_approx(w1, w0), "② 무쇠검 → 무력 %.0f → %.0f · 지력 그대로" % [m0, m1])

	# ③
	RS.officer_item = {A: "itm_ironblade", B: "itm_armor"}
	var m2: float = RS._effective_stat(A, "might")
	RS.officer_item = {A: "itm_ironblade", B: "itm_armor", C: "itm_warhorse"}
	var m3: float = RS._effective_stat(A, "might")
	RS.roster = [A, B]
	var out_roster: int = TR.count_in(RS, TR.SETS[0])
	RS.roster = [A, B, C]
	check(is_equal_approx(m2, (m0 + 6.0) * 1.05) and is_equal_approx(m3, (m0 + 6.0) * 1.1) and out_roster == 2, "③ 세트 둘 ×1.05 · 셋 ×1.10 · 로스터 밖 조각 안 셈(%d)" % out_roster)

	# ④
	var u: Dictionary = RT.officer_unit(A, "me", {"might": 90, "wisdom": 60, "command": 80})
	var atk0 := float(u.atk)
	TR.tactic(RS, u)
	RS.officer_item = {A: "itm_scroll", B: "itm_compass"}
	var w: Dictionary = RT.officer_unit(A, "me", {"might": 50, "wisdom": 90, "command": 60})
	var rng0 := int(w.rng)
	TR.tactic(RS, w)
	var foe: Dictionary = RT.officer_unit(A, "foe", {"might": 90, "wisdom": 60, "command": 80})
	var foe_atk := float(foe.atk)
	TR.tactic(RS, foe)
	check(is_equal_approx(float(u.atk) - atk0, 3.0) and String(u.get("tactic", "")) == "돌격진" and int(w.rng) == mini(3, rng0 + 1) and String(w.get("tactic", "")) == "원거리 계책" and float(foe.atk) == foe_atk,
		"④ 돌격진 공격 +3 · 원거리 계책 사거리 %d → %d · 적 유닛엔 안 붙음" % [rng0, int(w.rng)])
	var war := FileAccess.get_file_as_string("res://games/saga_realm/data/realm_rules_war.gd")
	check(war.contains("realm_treasure.gd\").tactic(self, u)") and war.contains("realm_treasure.gd\").give(self, officer_id, enemy_id)"), "④ 배선(전술판 세우기·보스전 보상)")

	# ⑤
	RS.officer_item = {}
	var g1: Dictionary = TR.give(RS, A, "xiapi")
	var g1b: String = String(RS.officer_item.get(A, ""))
	RS.officer_item = {}
	var g2: Dictionary = TR.give(RS, A, "xiapi")
	check(not g1.is_empty() and g1b == String(g1.id) and String(g2.id) == String(g1.id), "⑤ 보스전 보물 %s %s → 장수 · 같은 성·장수 같은 보물" % [String(g1.get("emoji", "")), String(g1.get("name", ""))])

	# ⑥
	RS.officer_item = {A: "itm_ironblade"}
	var line: String = RS.officer_hint(A)
	check(line.contains("🗡️무쇠검(기본 +6) 🧩무장의 채비"), "⑥ 무장 줄 「%s」" % TR.hint(RS, A))

	# ⑦
	RS.path_override = "user://probe_realm_treasure_save.json"
	var ver: int = RS.SAVE_VERSION
	var ok_save: bool = RS.save()
	RS.officer_item = {}
	var ok_load: bool = RS.try_load()
	var rt: bool = String(RS.officer_item.get(A, "")) == "itm_ironblade"
	var f := FileAccess.open(RS.path_override, FileAccess.READ)
	var dd: Dictionary = JSON.parse_string(f.get_as_text())
	f.close()
	dd.erase("officer_item")
	f = FileAccess.open(RS.path_override, FileAccess.WRITE)
	f.store_string(JSON.stringify(dd))
	f.close()
	var ok_old: bool = RS.try_load()
	var empty_old: bool = (RS.officer_item as Dictionary).is_empty()
	DirAccess.remove_absolute(ProjectSettings.globalize_path(RS.path_override))
	DirAccess.remove_absolute(ProjectSettings.globalize_path(RS.path_override + ".bak"))
	RS.path_override = ""
	check(ok_save and ok_load and rt and ok_old and empty_old and ver == 31, "⑦ 세이브 왕복 · 키 없음 → 빈 것 · 버전 %d 그대로" % ver)

	# ⑧
	RS.roster = [A, B, C]
	RS.officer_item = {A: "itm_ironblade"}
	OS.set_environment("SAGA_TREASURE", "0")
	var off_m: float = RS._effective_stat(A, "might")
	var off_give: Dictionary = TR.give(RS, B, "xiapi")
	OS.set_environment("SAGA_TREASURE", "")
	check(is_equal_approx(off_m, m0) and off_give.is_empty() and TR.hint(RS, B) == "", "⑧ 손잡이 0 = 끔")

	RS.officer_item = saved.oi
	RS.roster = saved.roster
	print("PROBE realm_treasure ", "OK" if fails == 0 else "FAIL %d" % fails)
	quit(1 if fails > 0 else 0)
