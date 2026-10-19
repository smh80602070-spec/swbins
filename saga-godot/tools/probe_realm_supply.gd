extends SceneTree

## G-0239 5천하 진·보급선(games/saga_realm/data/realm_supply.gd · realm_rules_war.gd 진 · 계략 ✂️ · world/realm_supply_lines.gd) 자동 점검.
##   godot --headless --path saga-godot --script res://tools/probe_realm_supply.gd
## ① 비김 → 진 생김(병력·치중이 진으로, 같은 성 다시 치기 막음) ② 길: 바로 이웃 · 함락한 성을 지나는 두 마디 · 적 진 선 성은 못 지남
## ③ 끊긴 달 사기 ×0.85·병력 −5% ④ 계략 ✂️ — 표적 진 없으면 금 안 씀 · 맞으면 2달 끊김 → 3달째 풀림 ⑤ 사기 0.60 밑 → 물러나 병력 돌아옴
## ⑥ 진의 한 달 싸움(이어지거나 함락·물러남) ⑦ 세이브 왕복 · 옛 22 → 빈 배열 · 버전 23 ⑧ 지도 띠 초록/빨강.
## 진짜 세이브는 안 건드린다(path_override). 끝에 "PROBE realm_supply OK" 또는 "PROBE realm_supply FAIL n".

var fails := 0


func check(cond: bool, msg: String) -> void:
	if cond:
		print("  ok   ", msg)
	else:
		fails += 1
		print("  FAIL ", msg)


func _fresh(RS: Node) -> void:
	RS.start_scenario("194")
	RS.result = ""
	RS.gold = 5000
	RS.camps = []
	RS._done_this_month = {}


func _initialize() -> void:
	await process_frame
	var RS: Node = root.get_node("RealmSaveState")
	var SUP: GDScript = load("res://games/saga_realm/data/realm_supply.gd")
	var saved_path: String = RS.path_override
	var ME: String = SUP.ME

	# ① 비김 → 진 — 씨앗을 바꿔 가며 승부가 안 나는 출진 하나를 찾는다(수비를 두텁게).
	var camp_r := {}
	var left_city := -1
	var seed_used := -1
	for s in 400:
		_fresh(RS)
		RS._rng.seed = 1000 + s
		RS.cities.xuchang.troops = 3000
		RS.cities.xuchang.food = 99999
		RS.enemies.xiaopei.troops = 2600
		var r: Dictionary = RS.attack("xiaopei")
		if bool(r.get("camp", false)):
			camp_r = r
			left_city = int(RS.cities.xuchang.troops)
			seed_used = 1000 + s
			break
	var cp0: Dictionary = SUP.camp_at(RS, "xiaopei", ME) if not camp_r.is_empty() else {}
	var again: Dictionary = RS.attack("xiaopei") if not cp0.is_empty() else {}
	check(not cp0.is_empty() and not bool(camp_r.won) and not bool(camp_r.routed) and left_city == 0 and int(cp0.troops) > 0 and int(cp0.food) > 0
		and String(cp0.from) == "xuchang" and not bool(again.get("ok", true)) and String(again.get("why", "")).contains("진"),
		"① 비김(씨앗 %d) → 진: 병력 %s · 치중 %s · 허창 남은 병력 %d · 다시 치기 「%s」" % [seed_used, cp0.get("troops", "-"), cp0.get("food", "-"), left_city, again.get("why", "")])

	# ② 길
	_fresh(RS)
	var cpa: Dictionary = SUP.encamp(RS, ME, "xuchang", "xuchang", "xiaopei", 5000, 50, 100, 9999, "")
	var p1: Array = SUP.path(RS, cpa)
	RS.camps = []
	RS.enemies.xiaopei.captured = true
	RS._annex_city("xiaopei", RS.RealmCities.enemy_by_id("xiaopei"), 1000, 40)
	var cpb: Dictionary = SUP.encamp(RS, ME, "xuchang", "xuchang", "xiapi", 5000, 50, 100, 9999, "")
	var p2: Array = SUP.path(RS, cpb)
	var foe: String = RS.force_of("xiapi")
	SUP.encamp(RS, foe, "xiapi", "xiapi", "xiaopei", 3000, 40, 100, 9999, "")
	var p3: Array = SUP.path(RS, cpb)
	check(p1 == ["xuchang", "xiaopei"] and p2 == ["xuchang", "xiaopei", "xiapi"] and p3.is_empty(),
		"② 길 %s · 함락한 소패를 지나 %s · 적 진 선 소패 막힘 %s" % [p1, p2, p3])

	# ③ 끊긴 달
	var cut_cp := {"force": ME, "from": "xuchang", "to": "xiapi", "troops": 10000, "morale": 1.0, "cut_t": 0}
	RS.camps.append(cut_cp)
	var mo: Dictionary = SUP.monthly(RS, cut_cp)
	check(bool(mo.cut) and is_equal_approx(float(cut_cp.morale), 0.85) and int(cut_cp.troops) == 9500, "③ 끊긴 달 사기 %.2f · 병력 %d(−%d)" % [float(cut_cp.morale), int(cut_cp.troops), int(mo.lost)])

	# ④ 계략 ✂️
	_fresh(RS)
	var none: Dictionary = RS.plot_preview("cut", "xiaopei")
	var ecp: Dictionary = SUP.encamp(RS, RS.force_of("xiaopei"), "xiaopei", "xiaopei", "xuchang", 3000, 40, 100, 99999, "")
	var ok_before: bool = SUP.ok(RS, ecp)
	var pre: Dictionary = RS.plot_preview("cut", "xiaopei")
	var done := false
	var spent := 0
	for t in 60:
		RS._done_this_month = {}
		var g0: int = RS.gold
		var r: Dictionary = RS.plot("cut", "xiaopei")
		spent = g0 - int(RS.gold)
		if bool(r.get("done", false)):
			done = int(r.get("cut", 0)) == 1
			break
	var cut2 := int(ecp.get("cut_t", 0))
	var m1: Dictionary = SUP.monthly(RS, ecp)
	var m2: Dictionary = SUP.monthly(RS, ecp)
	var m3: Dictionary = SUP.monthly(RS, ecp)
	check(not bool(none.ok) and String(none.why).contains("끊을 진") and ok_before and bool(pre.ok) and done and spent == 250 and cut2 == 2
		and bool(m1.cut) and bool(m2.cut) and not bool(m3.cut),
		"④ 표적 없음 「%s」 · 맞음 → 2달(%d) 끊김 %s/%s → 3달째 풀림 %s · 금 %d" % [none.get("why", ""), cut2, m1.cut, m2.cut, not bool(m3.cut), spent])

	# ⑤ 사기 0.60 밑 → 물러남
	_fresh(RS)
	var home0: int = int(RS.cities.xuchang.troops)
	var tired: Dictionary = SUP.encamp(RS, ME, "xuchang", "xuchang", "xiaopei", 5000, 50, 100, 99999, "")
	tired.morale = 0.62
	var msgs: Array = RS._resolve_camps()
	var back: int = int(RS.cities.xuchang.troops) - home0
	check(RS.camps.is_empty() and back == 5000 and msgs.size() == 1 and String(msgs[0]).contains("지쳐"), "⑤ 사기 0.62×0.94 → 물러남 · 허창 +%d · 「%s」" % [back, msgs[0] if msgs.size() > 0 else ""])

	# ⑥ 진의 한 달 싸움 — 이어지면 2달째, 아니면 함락(소패 우리 것) 또는 물러남(병력 돌아옴)
	_fresh(RS)
	RS._rng.seed = 20260824
	var fight_cp: Dictionary = SUP.encamp(RS, ME, "xuchang", "xuchang", "xiaopei", 4000, 60, 100, 99999, String(RS.roster[0]))
	var t0: int = int(RS.cities.xuchang.troops)
	var fm: Array = RS._resolve_camps()
	var outcome := "?"
	if not RS.camps.is_empty() and int(fight_cp.months) == 2:
		outcome = "이어짐"
	elif bool(RS.enemies.xiaopei.get("captured", false)) and RS.cities.has("xiaopei"):
		outcome = "함락"
	elif RS.camps.is_empty() and int(RS.cities.xuchang.troops) > t0:
		outcome = "물러남"
	check(outcome != "?" and fm.size() == 1, "⑥ 진 한 달 → %s · 「%s」" % [outcome, String(fm[0]).replace("\n", " / ") if fm.size() > 0 else ""])

	# ⑦ 세이브
	_fresh(RS)
	SUP.encamp(RS, ME, "xuchang", "xuchang", "xiaopei", 4321, 60, 100, 777, "")
	RS.camps[0].cut_t = 1
	RS.path_override = "user://probe_realm_supply_save.json"
	var ok_save: bool = RS.save()
	RS.camps = []
	var ok_load: bool = RS.try_load()
	var rt: bool = RS.camps.size() == 1 and int(RS.camps[0].troops) == 4321 and int(RS.camps[0].food) == 777 and int(RS.camps[0].cut_t) == 1 and String(RS.camps[0].to) == "xiaopei"
	var f := FileAccess.open(RS.path_override, FileAccess.READ)
	var dd: Dictionary = JSON.parse_string(f.get_as_text())
	f.close()
	dd.erase("camps")
	dd["version"] = 22
	f = FileAccess.open(RS.path_override, FileAccess.WRITE)
	f.store_string(JSON.stringify(dd))
	f.close()
	var ok_old: bool = RS.try_load()
	var old_empty: bool = RS.camps.is_empty()
	DirAccess.remove_absolute(ProjectSettings.globalize_path(RS.path_override))
	DirAccess.remove_absolute(ProjectSettings.globalize_path(RS.path_override + ".bak"))
	RS.path_override = saved_path
	check(ok_save and ok_load and rt and ok_old and old_empty and RS.SAVE_VERSION >= 23, "⑦ 세이브 왕복 · 옛 22 → 빈 배열 · 버전 %d(23 이상, G-0243 에 24)" % RS.SAVE_VERSION)

	# ⑧ 지도 띠
	_fresh(RS)
	var good_cp: Dictionary = SUP.encamp(RS, ME, "xuchang", "xuchang", "xiaopei", 4000, 60, 100, 999, "")
	var lines := Node3D.new()
	lines.set_script(load("res://games/saga_realm/world/realm_supply_lines.gd"))
	root.add_child(lines)
	var n_good: int = lines.call("refresh")
	var col_good: Color = ((lines.get_child(0) as MeshInstance3D).material_override as StandardMaterial3D).albedo_color if n_good > 0 else Color.BLACK
	good_cp.cut_t = 2
	var n_cut: int = lines.call("refresh")
	await process_frame
	var col_cut: Color = ((lines.get_child(0) as MeshInstance3D).material_override as StandardMaterial3D).albedo_color if lines.get_child_count() > 0 else Color.BLACK
	check(n_good == 1 and n_cut == 1 and col_good.g > col_good.r and col_cut.r > col_cut.g, "⑧ 지도 띠 %d개 초록 → 끊기면 빨강" % n_good)
	lines.queue_free()

	_fresh(RS)
	print("PROBE realm_supply %s" % ("OK" if fails == 0 else "FAIL %d" % fails))
	quit(0 if fails == 0 else 1)
