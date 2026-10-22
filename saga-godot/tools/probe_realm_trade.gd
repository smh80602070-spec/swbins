extends SceneTree

## G-0310 5천하 교역로(웹 W-0301 짝) 점검 —
##   godot --headless --path saga-godot --script res://tools/probe_realm_trade.gd   → "PROBE realm_trade OK" / "FAIL n"
## ① 길: 우리 성끼리 이어짐 · 남의 성은 막힘 · 화친이면 지남 ② 띄우기: 금 −300 · 같은 길 거절 · 둘까지 · 금 모자람
## ③ 한 달: (상업 합)×0.1×경륜도 금 · 남은 달 −1 · 길 끊기면 상단 잃음 · 다 되면 끝 ④ SAGA_TRADE=0 → 벌이 없음
## ⑤ 세이브 왕복 · 옛 24 → 빈 배열 · 판 25 ⑥ 단추 줄 · 지도 금빛 띠 · 달 넘김·☰ 배선. 진짜 세이브는 안 건드린다.

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
	var TR: GDScript = load("res://games/saga_realm/data/realm_trade.gd")
	var SUP: GDScript = load("res://games/saga_realm/data/realm_supply.gd")
	var saved := {"gold": RS.gold, "path": RS.path_override, "cities": (RS.cities as Dictionary).duplicate(true), "trade": (RS.trade as Array).duplicate(true),
		"diplomacy": (RS.diplomacy as Dictionary).duplicate(true), "camps": (RS.camps as Array).duplicate(true), "cur": RS.current_city}
	RS.trade = []
	RS.camps = []
	var cid: String = RS.current_city
	## 이웃 둘 — 하나는 우리 성으로 넣고(a), 다른 하나(b)는 남의 성 그대로
	var nb: Array = SUP.neighbors(cid).filter(func(n: String) -> bool: return String(SUP.owner(RS, n)) != "" and n != cid)
	var a: String = nb[0] if nb.size() > 0 else ""
	var b: String = ""
	for n: String in nb:
		if n != a and String(SUP.owner(RS, n)) != SUP.ME:
			b = n
			break
	if a != "" and String(SUP.owner(RS, a)) != SUP.ME:
		var c0: Dictionary = (RS.cities[cid] as Dictionary).duplicate(true)
		c0.comm = 500
		RS.cities[a] = c0
	RS.cities[cid].comm = 300
	RS.cities[a].comm = 500
	check(a != "" and b != "", "준비: 우리 %s · 새 우리 성 %s · 남의 성 %s" % [cid, a, b])

	# ① 길
	var bf: String = SUP.owner(RS, b)
	RS.diplomacy[bf] = {"relation": 0, "truce_months": 0}
	check(TR.path(RS, cid, a) == [cid, a], "① 우리 성끼리 %s" % str(TR.path(RS, cid, a)))
	check(TR.path(RS, cid, b).is_empty(), "① 남의 성(%s)은 막힘" % bf)
	RS.diplomacy[bf].truce_months = 3
	check(not TR.path(RS, cid, b).is_empty(), "① 화친이면 지남")

	# ② 띄우기
	RS.gold = 1000
	var r1: Dictionary = TR.start(RS, cid, a)
	check(bool(r1.ok) and RS.gold == 700 and RS.trade.size() == 1 and int(RS.trade[0].left) == 12, "② 띄움 — 금 −300 · 12달")
	check(String(TR.why(RS, a, cid)).contains("이미"), "② 같은 길(거꾸로도) 거절")
	var r2: Dictionary = TR.start(RS, cid, b)
	check(bool(r2.ok) and RS.trade.size() == 2 and String(TR.why(RS, a, b)).contains("둘까지"), "② 둘까지")
	RS.trade.pop_back()
	RS.gold = 10
	check(String(TR.why(RS, cid, b)).contains("금이 모자란다"), "② 금 모자람")

	# ③ 한 달
	var base: int = TR.base_gold(RS, cid, a)
	var want: int = int(RS.call("_sc_apply", base, "gold"))
	RS.gold = 0
	var msgs: Array = TR.monthly(RS)
	check(base == 80 and RS.gold == want and int(RS.trade[0].left) == 11 and str(msgs).contains("교역 +"), "③ 달마다 금 (300+500)×0.1=%d → 경륜도 %d · 11달 남음" % [base, want])
	RS.trade[0].left = 1
	RS.gold = 0
	msgs = TR.monthly(RS)
	check(RS.trade.is_empty() and RS.gold == want and str(msgs).contains("마쳤다"), "③ 마지막 달 — 벌고 끝")
	RS.trade = [{"from": cid, "to": b, "left": 5}]
	RS.diplomacy[bf].truce_months = 0
	RS.gold = 0
	msgs = TR.monthly(RS)
	check(RS.trade.is_empty() and RS.gold == 0 and str(msgs).contains("잃었다"), "③ 화친이 끝나 길이 끊기면 상단을 잃음(금 없음)")

	# ④ 끄기
	RS.trade = [{"from": cid, "to": a, "left": 5}]
	OS.set_environment("SAGA_TRADE", "0")
	RS.gold = 0
	TR.monthly(RS)
	check(RS.gold == 0 and int(RS.trade[0].left) == 5, "④ SAGA_TRADE=0 → 벌이·달 셈 없음")
	OS.set_environment("SAGA_TRADE", "")

	# ⑤ 세이브
	RS.path_override = "user://probe_realm_trade_save.json"
	var ok_save: bool = RS.save()
	RS.trade = []
	var ok_load: bool = RS.try_load()
	var rt: bool = RS.trade.size() == 1 and String(RS.trade[0].to) == a and int(RS.trade[0].left) == 5
	var f := FileAccess.open(RS.path_override, FileAccess.READ)
	var dd: Dictionary = JSON.parse_string(f.get_as_text())
	f.close()
	dd.erase("trade")
	dd["version"] = 24
	f = FileAccess.open(RS.path_override, FileAccess.WRITE)
	f.store_string(JSON.stringify(dd))
	f.close()
	var ok_old: bool = RS.try_load()
	var old_empty: bool = (RS.trade as Array).is_empty()
	DirAccess.remove_absolute(ProjectSettings.globalize_path(RS.path_override))
	DirAccess.remove_absolute(ProjectSettings.globalize_path(RS.path_override + ".bak"))
	check(ok_save and ok_load and rt and ok_old and old_empty and RS.SAVE_VERSION >= 25, "⑤ 세이브 왕복 · 옛 24 → 빈 배열 · 버전 %d" % RS.SAVE_VERSION)

	# ⑥ 단추·지도·배선 (불러오기로 바뀐 성을 다시 맞춘다)
	RS.cities = (saved.cities as Dictionary).duplicate(true)
	var c1: Dictionary = (RS.cities[cid] as Dictionary).duplicate(true)
	c1.comm = 500
	RS.cities[a] = c1
	RS.current_city = cid
	RS.trade = [{"from": cid, "to": a, "left": 7}]
	RS.gold = 1000
	var stage := Node.new()
	root.add_child(stage)
	current_scene = stage
	var btn := Button.new()
	btn.set_script(load("res://games/saga_realm/ui/realm_trade_button.gd"))
	stage.add_child(btn)
	var ls: Array = btn.call("lines")
	var txt := str(ls.map(func(l: Dictionary) -> String: return String(l.label)))
	check(ls.size() >= 1 and txt.contains("7달 남음") and bool(btn.call("open_screen")), "⑥ 단추 줄 %d: %s" % [ls.size(), txt.left(120)])
	var sl := Node3D.new()
	sl.set_script(load("res://games/saga_realm/world/realm_supply_lines.gd"))
	stage.add_child(sl)
	var n_rib: int = sl.call("refresh")
	check(n_rib == 1, "⑥ 지도 금빛 띠 %d" % n_rib)
	var mo := FileAccess.get_file_as_string("res://games/saga_realm/data/realm_rules_month.gd")
	var hud := FileAccess.get_file_as_string("res://games/saga_realm/ui/RealmHUD.tscn")
	check(mo.contains("realm_trade.gd\").monthly(self)") and hud.contains("TradeButton|🐫|교역") and hud.contains("realm_trade_button.gd"), "⑥ 달 넘김·☰ 메뉴 배선")
	stage.queue_free()

	RS.gold = saved.gold
	RS.path_override = saved.path
	RS.cities = saved.cities
	RS.trade = saved.trade
	RS.diplomacy = saved.diplomacy
	RS.camps = saved.camps
	RS.current_city = saved.cur
	await process_frame
	print("PROBE realm_trade ", "OK" if fails == 0 else "FAIL %d" % fails)
	quit(1 if fails > 0 else 0)
