extends SceneTree

## G-0390 5천하 지원 단계(웹 W-0425 짝) 점검 —
##   godot --headless --path saga-godot --script res://tools/probe_realm_support.gd   → "PROBE realm_support OK" / "FAIL n"
## ① 단계: 3·7·12 → C·B·A · 의형제 B 부터 · 원수 0 ② 덤 없는 판(b.sup 없음·단계 0) = 옛 hit_chance 그대로
## ③ 이웃 지원 C → 명중 +5 · 대상 이웃 B → −10 · 떨어지면 0 ④ 붙어서 친 쌍 → 판 기록 → outcome supPairs → apply grid.sup
## ⑤ 판 끝 셈(세이브): 세 판 → C, 원수 쌍은 판 표에 없음 ⑥ 무장 줄 「🤝지원」 ⑦ SAGA_SUPPORT=0 → 표·셈·줄 없음
## ⑧ 세이브 왕복 · 키 없는 세이브 → 빈 것 · 버전 그대로 ⑨ 배선(판 세우기·attack·무장 줄·판 끝 글).

const RT := preload("res://games/saga_realm/data/realm_tactics.gd")
const SP := preload("res://games/saga_realm/data/realm_support.gd")

var fails := 0


func check(cond: bool, msg: String) -> void:
	if cond:
		print("  ok   ", msg)
	else:
		fails += 1
		print("  FAIL ", msg)


func _board(sup: Variant) -> Dictionary:
	var b := RT.make_board("probe-sup", "plain", false)
	var st := {"might": 60, "wisdom": 50, "command": 60}
	RT.units_of(b, ["sg_guanyu", "sg_luxun"], ["sg_lubu"], [3000, 3000], {"sg_guanyu": st, "sg_luxun": st, "sg_lubu": st})
	for i in (b.cells as Array).size():
		b.cells[i] = "plain"
	var a := RT.unit(b, "me:sg_guanyu")
	var m := RT.unit(b, "me:sg_luxun")
	var f := RT.unit(b, "foe:sg_lubu")
	a.x = 3; a.y = 2
	m.x = 3; m.y = 3
	f.x = 4; f.y = 2
	var n := 0
	for u: Dictionary in b.units:
		u.atk = 10.0   # 명중 73% — 위아래 끝(10·95)에 안 걸리게
		u.def = 6.0
		if String(u.kind) == "troop":
			u.x = 7; u.y = n
			n += 1
	if sup != null:
		b["sup"] = sup
	return b


func _initialize() -> void:
	await process_frame
	var RS: Node = root.get_node("RealmSaveState")
	var saved := {"sup": RS.support.duplicate(true), "roster": RS.roster.duplicate()}
	var K := SP.key("sg_guanyu", "sg_luxun")

	# ①
	check(SP.level_of(2, "") == 0 and SP.level_of(3, "") == 1 and SP.level_of(7, "") == 2 and SP.level_of(12, "") == 3 and SP.level_of(0, "sworn") == 2
		and SP.level_of(12, "sworn") == 3 and SP.level_of(12, "foe") == 0 and SP.rel_kind("sg_liubei", "sg_guanyu") == "sworn" and SP.rel_kind("sg_zhangfei", "sg_lubu") == "foe",
		"① 3·7·12 → C·B·A · 의형제 B 부터 · 원수 0")

	# ②
	var b0 := _board(null)
	var a0 := RT.unit(b0, "me:sg_guanyu")
	var f0 := RT.unit(b0, "foe:sg_lubu")
	var old := RT.hit_chance(a0, f0, RT.cover_at(b0, int(f0.x), int(f0.y)))
	var b1 := _board({K: 0})
	check(RT.hit_chance_b(b0, a0, f0) == old and RT.hit_chance_b(b1, RT.unit(b1, "me:sg_guanyu"), RT.unit(b1, "foe:sg_lubu")) == old
		and RT.hit_chance_b(b0, f0, a0) == RT.hit_chance(f0, a0, 0), "② 지원 없음·단계 0 = 옛 명중 %d%%" % old)

	# ③
	var bc := _board({K: 1})
	var up := RT.hit_chance_b(bc, RT.unit(bc, "me:sg_guanyu"), RT.unit(bc, "foe:sg_lubu"))
	var bb := _board({K: 2})
	var foe_old := RT.hit_chance(RT.unit(bb, "foe:sg_lubu"), RT.unit(bb, "me:sg_guanyu"), 0)
	var dn := RT.hit_chance_b(bb, RT.unit(bb, "foe:sg_lubu"), RT.unit(bb, "me:sg_guanyu"))
	var far := _board({K: 3})
	RT.unit(far, "me:sg_luxun").x = 0
	var far_ch := RT.hit_chance_b(far, RT.unit(far, "me:sg_guanyu"), RT.unit(far, "foe:sg_lubu"))
	var mods := RT.hit_mods(bc, RT.unit(bc, "me:sg_guanyu"), RT.unit(bc, "foe:sg_lubu"))
	check(up == old + 5 and dn == foe_old - 10 and far_ch == old and mods.size() == 1 and String(mods[0][0]) == "지원 C",
		"③ 지원 C %d→%d · 막음 B %d→%d · 떨어지면 %d · 표시 「%s」" % [old, up, foe_old, dn, far_ch, String(mods[0][0]) if not mods.is_empty() else ""])

	# ④
	var ba := _board({K: 0})
	var r: Dictionary = RT.attack(ba, "me:sg_guanyu", "foe:sg_lubu")
	var noted := (ba.get("sup_pairs", {}) as Dictionary).has(K)
	var bn := _board(null)
	RT.attack(bn, "me:sg_guanyu", "foe:sg_lubu")
	ba.done = "win"
	bn.done = "win"
	var oa := RT.outcome(ba)
	var on_ := RT.outcome(bn)
	var ga := RT.apply(oa, "x")
	var gn := RT.apply(on_, "x")
	check(bool(r.ok) and noted and (oa.get("supPairs", []) as Array) == [K] and (ga.get("sup", []) as Array) == [K] and not on_.has("supPairs") and not gn.has("sup"),
		"④ 붙어서 친 쌍 → 판 기록 → supPairs → grid.sup · 지원 없는 판은 키 없음")

	# ⑤
	RS.support = {}
	var u1: Array = SP.on_end(RS, [K])
	SP.on_end(RS, [K])
	var u3: Array = SP.on_end(RS, [K])
	var tbl: Dictionary = SP.board_table(RS, ["sg_guanyu", "sg_luxun", "sg_liubei", "sg_zhangfei", "sg_lubu"])
	check(u1.is_empty() and u3.size() == 1 and int(u3[0].lv) == 1 and int(RS.support[K]) == 3 and int(tbl[K]) == 1 and int(tbl[SP.key("sg_guanyu", "sg_liubei")]) == 2
		and not tbl.has(SP.key("sg_lubu", "sg_zhangfei")) and SP.preview(RS, [K])[0].contains("+1"),
		"⑤ 세 판 → C(점수 %d) · 의형제 B · 원수 쌍 표에 없음" % int(RS.support.get(K, 0)))

	# ⑥
	var line: String = RS.officer_hint("sg_guanyu")
	check(line.contains("🤝지원 ") and line.contains("C ") and line.contains("B "), "⑥ 무장 줄 「%s」" % SP.hint(RS, "sg_guanyu"))

	# ⑦
	OS.set_environment("SAGA_SUPPORT", "0")
	var off_tbl: Dictionary = SP.board_table(RS, ["sg_guanyu", "sg_luxun"])
	SP.on_end(RS, [K])
	var off_hint: String = SP.hint(RS, "sg_guanyu")
	OS.set_environment("SAGA_SUPPORT", "")
	check(off_tbl.is_empty() and int(RS.support[K]) == 3 and off_hint == "", "⑦ SAGA_SUPPORT=0 → 표·셈·줄 없음")

	# ⑧
	var ver: int = RS.SAVE_VERSION
	RS.path_override = "user://probe_realm_support_save.json"
	var ok_save: bool = RS.save()
	RS.support = {}
	var ok_load: bool = RS.try_load()
	var rt: bool = int(RS.support.get(K, 0)) == 3 and typeof(RS.support[K]) == TYPE_INT
	var f := FileAccess.open(RS.path_override, FileAccess.READ)
	var dd: Dictionary = JSON.parse_string(f.get_as_text())
	f.close()
	dd.erase("support")
	f = FileAccess.open(RS.path_override, FileAccess.WRITE)
	f.store_string(JSON.stringify(dd))
	f.close()
	var ok_old: bool = RS.try_load()
	var old_empty: bool = (RS.support as Dictionary).is_empty()
	DirAccess.remove_absolute(ProjectSettings.globalize_path(RS.path_override))
	DirAccess.remove_absolute(ProjectSettings.globalize_path(RS.path_override + ".bak"))
	RS.path_override = ""
	check(ok_save and ok_load and rt and ok_old and old_empty and ver == 31, "⑧ 세이브 왕복 · 키 없음 → 빈 것 · 버전 %d 그대로" % ver)

	# ⑨
	var war := FileAccess.get_file_as_string("res://games/saga_realm/data/realm_rules_war.gd")
	var mon := FileAccess.get_file_as_string("res://games/saga_realm/data/realm_rules_month.gd")
	var view := FileAccess.get_file_as_string("res://games/saga_realm/world/realm_tactics_view.gd")
	check(war.count("_put_support(") == 3 and war.contains("realm_support.gd\").on_end(self, grid.get(\"sup\", []))") and mon.contains("realm_support.gd\").hint(self, id)")
		and view.contains("realm_support.gd\").preview(RealmSaveState"), "⑨ 배선 넷(판 세우기 둘·판 끝 셈·무장 줄·판 끝 글)")

	RS.support = saved.sup
	RS.roster = saved.roster
	print("PROBE realm_support ", "OK" if fails == 0 else "FAIL %d" % fails)
	quit(0 if fails == 0 else 1)
