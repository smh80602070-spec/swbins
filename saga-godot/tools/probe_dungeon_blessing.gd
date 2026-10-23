extends SceneTree

## G-0335 2나락 신의 가호(data/dungeon_blessing.gd) 점검.
##   godot --headless --path saga-godot --script res://tools/probe_dungeon_blessing.gd   → "PROBE dungeon_blessing OK" / "FAIL n"
## ① 은사 스물 전부 한 신에(빠짐·겹침 없음) ② 단 문턱 3·6 · 신마다 겹친 수 ③ 덤 = 실제 getter(atk_mult·crit·skill_mul·gold_mult)
## ④ 카드 글·단 오름 알림 ⑤ 난입 한정 run_boons 는 안 셈 ⑥ SAGA_BLESSING=0 → 덤·글 없음(기존 식 그대로) ⑦ 배선(3택 카드·알림·내 정보)

var fails := 0


func check(cond: bool, msg: String) -> void:
	if cond:
		print("  ok   ", msg)
	else:
		fails += 1
		print("  FAIL ", msg)


func _initialize() -> void:
	await process_frame
	var B: GDScript = load("res://games/saga_dungeon/data/dungeon_blessing.gd")
	var RS: Node = root.get_node("DungeonRunState")
	var saved: Dictionary = (RS.get("boons") as Dictionary).duplicate()

	# ① 빠짐·겹침
	var miss: Array = []
	var seen := {}
	var dup := false
	for b: Dictionary in DungeonBoons.BOONS:
		var g: String = B.god_of(String(b.key))
		if g == "" and not String(b.key).begins_with("syn_"):
			miss.append(b.key)
	for g: String in B.ORDER:
		for k in (B.GODS[g].boons as Array):
			dup = dup or seen.has(k)
			seen[k] = true
			if DungeonBoons.by_key(String(k)).is_empty():
				check(false, "① %s 의 %s 는 실제 은사" % [g, k])
	check(miss.is_empty() and not dup and seen.size() == DungeonBoons.BOONS.size() - DungeonBoons.SYNERGIES.size() and B.god_of("syn_fire_lit") == "", "① 은사 %d 중 원소 결 셋 빼고 전부 한 신에(빠짐 %s)" % [DungeonBoons.BOONS.size(), str(miss)])

	# ② 단
	check(int(B.step_of(2)) == 0 and int(B.step_of(3)) == 1 and int(B.step_of(5)) == 1 and int(B.step_of(6)) == 2 and int(B.step_of(20)) == 2, "② 문턱 3·6")
	var st: Dictionary = B.stacks({"fury": 2, "crit": 1, "wall": 1, "greed": 4, "nope": 3})
	check(int(st.war) == 3 and int(st.earth) == 1 and int(st.wealth) == 4 and int(st.wind) == 0, "② 신마다 겹친 수 %s" % str(st))

	# ③ 실제 getter
	RS.set("boons", {})
	var a0: float = RS.atk_mult()
	var c0: float = RS.crit_chance()
	var s0: float = RS.skill_mul()
	var g0: float = RS.gold_mult()
	RS.set("boons", {"fury": 2})
	var a2: float = RS.atk_mult()
	RS.set("boons", {"fury": 2, "haste": 1})   # 무신 3 → 1단 공격 +8%
	var a3: float = RS.atk_mult()
	check(is_equal_approx(a3 - a2, 0.08), "③ 무신 1단 — 공격 배율 +0.08 (%.2f → %.2f)" % [a2, a3])
	RS.set("boons", {"fury": 2, "haste": 2, "crit": 2})   # 무신 6 → 2단 치명 +5
	var c6: float = RS.crit_chance()
	check(is_equal_approx(c6 - c0, 5.0 + 2 * float(DungeonBoons.by_key("crit").eff.critPct)), "③ 무신 2단 — 치명 +5%%p (%.1f)" % c6)
	RS.set("boons", {"skillamp1": 3})
	check(is_equal_approx(RS.skill_mul() - s0, 0.10 + 3 * float(DungeonBoons.by_key("skillamp1").eff.skillPct) / 100.0), "③ 선인 1단 — 무예 +10%")
	RS.set("boons", {"greed": 3, "eye": 3})
	check(is_equal_approx(RS.gold_mult() - g0, 0.25 + 3 * float(DungeonBoons.by_key("greed").eff.get("goldPct", 0.0)) / 100.0), "③ 재신 2단 — 금 +25%% (%.2f)" % RS.gold_mult())
	check(is_equal_approx(a0, 1.0 + 0.0) or a0 > 0.0, "③ 은사 없을 때 바탕 %.2f" % a0)

	# ④ 글
	var cnt := {"fury": 1, "haste": 1}
	check(String(B.tag("crit", cnt)) == "⚔️무신 2/3 → 가호 1단!" and String(B.tag("wall", cnt)) == "🛡️지신 0/3", "④ 카드 글: %s · %s" % [B.tag("crit", cnt), B.tag("wall", cnt)])
	var after := cnt.duplicate()
	after["crit"] = 1
	check(String(B.up_text(cnt, after)) == "⚔️ 무신(武神)의 가호 1단 — 공격 +8%" and String(B.up_text(after, after)) == "", "④ 오름 알림: %s" % B.up_text(cnt, after))
	check(String(B.tag("fury", {"fury": 5, "crit": 1})) == "⚔️무신 가호 2단" and String(B.summary({"fury": 3, "greed": 3})) == "⚔️무신 1단 · 💰재신 1단", "④ 다 찬 글·요약")

	# ⑤ 난입 한정은 안 셈
	RS.set("boons", {})
	var H: Node = root.get_node("DungeonHordeState")
	var hb: Variant = H.get("run_boons")
	var ha: Variant = H.get("active")
	H.set("run_boons", {"fury": 3})
	H.set("active", true)
	var ah: float = RS.atk_mult()
	H.set("run_boons", {"fury": 2})
	var ah2: float = RS.atk_mult()
	check(is_equal_approx(ah - ah2, float(DungeonBoons.by_key("fury").eff.atkPct) / 100.0), "⑤ 난입 run_boons 무신 3 — 가호 덤 없음(맹공 한 개 몫만 차이)")
	H.set("run_boons", hb)
	H.set("active", ha)

	# ⑥ 끄기
	RS.set("boons", {"fury": 2, "haste": 1})
	OS.set_environment("SAGA_BLESSING", "0")
	check(is_equal_approx(RS.atk_mult(), a2 + float(DungeonBoons.by_key("haste").eff.get("atkPct", 0.0)) / 100.0) and String(B.tag("crit", cnt)) == "" and String(B.up_text(cnt, after)) == "", "⑥ SAGA_BLESSING=0 → 덤·글 없음")
	OS.set_environment("SAGA_BLESSING", "")

	# ⑦ 배선
	var tr := FileAccess.get_file_as_string("res://games/saga_dungeon/world/test_room.gd")
	var me := FileAccess.get_file_as_string("res://games/saga_dungeon/ui/me_adapter.gd")
	var rs := FileAccess.get_file_as_string("res://games/saga_dungeon/data/dungeon_run_state.gd")
	check(tr.contains("dungeon_blessing.gd\").tag(key") and tr.contains("dungeon_blessing.gd\").up_text(") and me.contains("dungeon_blessing.gd\").summary(")
		and rs.contains("Blessing.eff(boons, eff_key)"), "⑦ 카드·알림·내 정보·_sum_eff")

	RS.set("boons", saved)
	print("PROBE dungeon_blessing ", "OK" if fails == 0 else "FAIL %d" % fails)
	quit(1 if fails > 0 else 0)
