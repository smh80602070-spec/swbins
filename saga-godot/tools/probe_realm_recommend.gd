extends SceneTree

## G-0383 5천하 인재 천거(data/realm_recommend.gd) 점검 —
##   godot --headless --path saga-godot --script res://tools/probe_realm_recommend.gd   → "PROBE realm_recommend OK" / "FAIL n"
## ① 굴림 결정적·대략 CHANCE(240달 중) ② 천거자 = 충성 문턱 넘는 장수 중 지력 으뜸 · 문턱 밑은 빠짐 · 없으면 ""
## ③ 굴림 맞는 달: 숨은 재야 하나가 found 에 · 천거자 충성 +5 · 메시지 한 줄 ④ 손잡이 끄면 없음 ⑤ 달 끝 배선. 상태는 되돌린다.

var fails := 0


func check(cond: bool, msg: String) -> void:
	if cond:
		print("  ok   ", msg)
	else:
		fails += 1
		print("  FAIL ", msg)


func _initialize() -> void:
	await process_frame
	var RC: GDScript = load("res://games/saga_realm/data/realm_recommend.gd")
	var RS: Node = root.get_node("RealmSaveState")
	var saved := {"found": (RS.found as Array).duplicate(), "roster": (RS.roster as Array).duplicate(), "loyal": (RS.officer_loyal as Dictionary).duplicate(), "y": RS.year, "m": RS.month}

	# ① 굴림
	var hits := 0
	for y in range(194, 214):
		for m in range(1, 13):
			hits += 1 if RC.rolls("194", y, m) else 0
	check(hits > 10 and hits < 50 and RC.rolls("194", 200, 3) == RC.rolls("194", 200, 3), "① 240달 중 %d 달 천거(결정적)" % hits)

	# ② 천거자
	var who: String = RC.recommender(["sg_zhangfei", "sg_zhugeliang", "sg_guanyu"], {"sg_zhangfei": 90, "sg_zhugeliang": 90, "sg_guanyu": 90})
	var low: String = RC.recommender(["sg_zhangfei", "sg_zhugeliang"], {"sg_zhangfei": 90, "sg_zhugeliang": 30})
	var none: String = RC.recommender(["sg_zhangfei"], {"sg_zhangfei": 10})
	check(who == "sg_zhugeliang" and low == "sg_zhangfei" and none == "", "② 지력 으뜸 %s · 문턱 밑 빠짐 %s · 없음 '%s'" % [who, low, none])

	# ③ 굴림 맞는 달 찾아 한 번
	var ym := []
	for y in range(194, 214):
		for m in range(1, 13):
			if ym.is_empty() and RC.rolls(String(RS.scenario_id), y, m):
				ym = [y, m]
	RS.year = ym[0]
	RS.month = ym[1]
	RS.roster = ["sg_zhangfei"]
	RS.officer_loyal = {"sg_zhangfei": 80}
	var f0 := (RS.found as Array).size()
	var msgs: Array = RC.monthly(RS)
	var grew := (RS.found as Array).size() == f0 + 1
	check(msgs.size() == 1 and grew and int(RS.officer_loyal.sg_zhangfei) == 85 and String(msgs[0]).contains("천거"), "③ 재야 +1 · 충성 85 · 「%s」" % (msgs[0] if not msgs.is_empty() else ""))

	# ④ 손잡이
	OS.set_environment("SAGA_RECOMMEND", "0")
	var off: Array = RC.monthly(RS)
	OS.set_environment("SAGA_RECOMMEND", "")
	check(off.is_empty(), "④ 끄면 없음")

	# ⑤ 배선
	var src := FileAccess.get_file_as_string("res://games/saga_realm/data/realm_rules_month.gd")
	check(src.contains("realm_recommend.gd\").monthly(self)"), "⑤ 달 끝 배선")

	RS.found = saved.found
	RS.roster = saved.roster
	RS.officer_loyal = saved.loyal
	RS.year = saved.y
	RS.month = saved.m
	print("PROBE realm_recommend ", "OK" if fails == 0 else "FAIL %d" % fails)
	quit(1 if fails > 0 else 0)
