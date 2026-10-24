extends SceneTree

## G-0375 5천하 포로 처리(data/realm_captives.gd) 점검 —
##   godot --headless --path saga-godot --script res://tools/probe_realm_captives.gd   → "PROBE realm_captives OK" / "FAIL n"
## ① 사로잡음 → 재야 + 포로 표시 · 손잡이 끄면 표시 없음 ② 등용 권유 = 표시만 지움(재야 그대로) ③ 풀어 줌 = 재야에서 빠짐·우호 +15
## ④ 몸값 = 재야에서 빠짐·금 + 몸값·우호 −10 ⑤ 재야에서 빠지면 표시 정리(prune) · 없는 포로 처분 거절 ⑥ 세이브 왕복(31)·옛 세이브 빈 것
## ⑦ 배선(_capture_city 기록·HUD 단추·☰ 칸). 진짜 세이브는 안 건드린다(상태 되돌림).

var fails := 0


func check(cond: bool, msg: String) -> void:
	if cond:
		print("  ok   ", msg)
	else:
		fails += 1
		print("  FAIL ", msg)


func _initialize() -> void:
	await process_frame
	var CP: GDScript = load("res://games/saga_realm/data/realm_captives.gd")
	var RS: Node = root.get_node("RealmSaveState")
	var saved := {"cap": (RS.captives as Dictionary).duplicate(), "found": (RS.found as Array).duplicate(), "gold": RS.gold, "dip": (RS.diplomacy as Dictionary).duplicate(true)}
	var a := "sg_guanyu"
	var b := "sg_zhangfei"
	var c := "sg_lubu"
	RS.captives = {}
	RS.found = [a, b, c]
	RS.diplomacy = {}

	# ① 사로잡음
	for oid in [a, b, c]:
		CP.record(RS, oid, "bei")
	OS.set_environment("SAGA_CAPTIVES", "0")
	CP.record(RS, "sg_zhaoyun", "bei")
	OS.set_environment("SAGA_CAPTIVES", "")
	check(CP.ids(RS).size() == 3 and not RS.captives.has("sg_zhaoyun"), "① 포로 셋 · 끄면 안 적음")

	# ② 등용 권유
	var r1: Dictionary = CP.act(RS, a, "recruit")
	check(bool(r1.ok) and not RS.captives.has(a) and (RS.found as Array).has(a), "② 등용 권유 — 재야 그대로")

	# ③ 풀어 줌
	var r2: Dictionary = CP.act(RS, b, "release")
	var rel2 := int((RS.diplomacy.bei as Dictionary).relation)
	check(bool(r2.ok) and not (RS.found as Array).has(b) and rel2 == 40 + CP.RELEASE_REL, "③ 풀어 줌 — 재야에서 빠짐 · 우호 %d" % rel2)

	# ④ 몸값
	var g0: int = RS.gold
	var want: int = CP.ransom_of(c)
	var r3: Dictionary = CP.act(RS, c, "ransom")
	var rel3 := int((RS.diplomacy.bei as Dictionary).relation)
	check(bool(r3.ok) and not (RS.found as Array).has(c) and RS.gold == g0 + want and want > CP.RANSOM_BASE and rel3 == rel2 + CP.RANSOM_REL, "④ 몸값 금 +%d · 우호 %d" % [want, rel3])

	# ⑤ 정리·거절
	RS.found = ["sg_zhaoyun"]
	RS.captives = {"sg_zhaoyun": "bei", "sg_machao": "bei"}
	var left: Array = CP.ids(RS)
	var bad: Dictionary = CP.act(RS, "sg_machao", "ransom")
	var odd: Dictionary = CP.act(RS, "sg_zhaoyun", "eat")
	check(left == ["sg_zhaoyun"] and not bool(bad.ok) and not bool(odd.ok) and RS.captives.has("sg_zhaoyun"), "⑤ 재야에 없으면 정리 · 없는 포로·모르는 처분 거절")

	# ⑥ 세이브
	var src := FileAccess.get_file_as_string("res://games/saga_realm/data/realm_save_state.gd")
	var rt: Dictionary = CP.restore(JSON.parse_string(JSON.stringify(RS.captives)))
	check(int(RS.get("SAVE_VERSION")) >= 31 and src.contains("\"captives\": captives") and src.contains("data.get(\"captives\", {})") and rt == RS.captives and CP.restore(null).is_empty(),
		"⑥ 세이브 왕복 · 옛 세이브 빈 것 · 판 %d" % int(RS.get("SAVE_VERSION")))

	# ⑦ 배선
	var war := FileAccess.get_file_as_string("res://games/saga_realm/data/realm_rules_war.gd")
	var hud := FileAccess.get_file_as_string("res://games/saga_realm/ui/RealmHUD.tscn")
	check(war.contains("realm_captives.gd\").record(self, oid, cap_force)") and hud.contains("realm_captive_button.gd") and hud.contains("\"CaptiveButton|"), "⑦ 배선 셋(사로잡음·단추·☰ 칸)")

	RS.captives = saved.cap
	RS.found = saved.found
	RS.gold = saved.gold
	RS.diplomacy = saved.dip
	print("PROBE realm_captives ", "OK" if fails == 0 else "FAIL %d" % fails)
	quit(1 if fails > 0 else 0)
