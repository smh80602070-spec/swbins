extends SceneTree

## G-0243 5천하 불가사의 경쟁(games/saga_realm/data/realm_wonder.gd · RealmSaveState.wonders · 두 경륜도 fx · ui/realm_wonder_button.gd · world/realm_wonder_towers.gd) 자동 점검.
##   godot --headless --path saga-godot --script res://tools/probe_realm_wonder.gd
## ① 표 여섯·문 닫힘(「큰 도면」 전) ② 먼저 지은 쪽만 효과(우리 큰 다리 → 공격 ×1.06) · 금·인부 빠졌다 돌아옴
## ③ 늦은 쪽 금 반 환급·인부 귀환(AI 가 먼저 → 우리 +1500) · AI 늦으면 인부 귀환 ④ AI 착공: 첫 해 없음 · 둘째 해 hash 차례에 착공·병력 빠짐
## ⑤ AI fx: 만리 장벽 → 받는 피해 −10% ⑥ 저장 왕복·옛 23 = 빈 것·버전 24 ⑦ 단추 「🏛️ 불가사의」 여섯 줄 ⑧ 지도 탑 ⑨ 새 판 비움.
## 진짜 세이브는 안 건드린다(path_override 임시 파일, 끝에 지움). 끝에 "PROBE realm_wonder OK" 또는 "PROBE realm_wonder FAIL n".

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
	var W: GDScript = load("res://games/saga_realm/data/realm_wonder.gd")
	var T: GDScript = load("res://games/saga_realm/data/realm_tech.gd")
	var SC: GDScript = load("res://games/saga_realm/data/realm_statecraft.gd")
	var AI: GDScript = load("res://games/saga_realm/data/realm_ai_statecraft.gd")
	var saved := {"tech": (RS.tech as Dictionary).duplicate(true), "gold": RS.gold, "path": RS.path_override, "year": RS.year, "month": RS.month,
		"passive": (RS.passive as Dictionary).duplicate(true), "cities": (RS.cities as Dictionary).duplicate(true),
		"enemies": (RS.enemies as Dictionary).duplicate(true), "wonders": (RS.wonders as Dictionary).duplicate(true),
		"ai_passive": (RS.ai_passive as Dictionary).duplicate(true), "cur": RS.current_city}
	RS.passive = {"start": null, "taken": []}
	RS._passive_api = null
	RS.wonders = {"built": {}, "jobs": {}}
	W.bump()
	var me: String = W.ME
	var cid: String = RS.current_city

	# ① 표·문
	RS.tech = {"pts": 0, "done": []}
	T.bump()
	RS.gold = 99999
	RS.cities[cid].troops = 5000
	var shut: String = W.why(RS, me, "bridge", cid)
	check(W.WONDERS.size() == 6 and W.REFUND == 0.5 and W.AI_MEN == 2.5 and shut.contains("큰 도면") and W.men(W.by_id("wall")) == 750,
		"① 표 여섯 · 큰 도면 전엔 막힘(「%s」) · 만리 장벽 인부 %d" % [shut, W.men(W.by_id("wall"))])

	# ② 먼저 지은 쪽만 효과 — 우리 큰 다리(6달) vs AI 같은 것(더 늦게 시작한 꼴로 left 9)
	RS.tech = {"pts": 0, "done": ["l1", "l2", "l3"]}
	T.bump()
	var ai_f := ""
	var ai_c := ""
	for eid in RS.enemies:
		var f: String = RS.force_of(String(eid))
		if f != "" and not bool(RS.enemies[eid].captured):
			ai_f = f
			ai_c = String(eid)
			break
	RS.enemies[ai_c].troops = 3000
	var atk0: float = SC.mul("atk")
	var gold0 := int(RS.gold)
	var r_me: Dictionary = W.start(RS, me, "bridge", cid)
	var r_ai: Dictionary = W.start(RS, ai_f, "bridge", ai_c)
	RS.wonders.jobs[ai_f].left = 9
	var paid := gold0 - int(RS.gold) == 2400 and int(RS.cities[cid].troops) == 4500 and int(RS.enemies[ai_c].troops) == 2500
	var msgs: Array = []
	for m in 6:
		msgs.append_array(W.monthly(RS))
	var atk1: float = SC.mul("atk")
	check(bool(r_me.ok) and bool(r_ai.ok) and paid and W.built_by(RS, "bridge") == me and is_equal_approx(atk1, atk0 * 1.06 / 1.0) and int(RS.cities[cid].troops) == 5000,
		"② 우리 큰 다리 먼저 완공 · 금 2400·인부 500 빠졌다 인부 돌아옴 · 공격 %.2f → %.2f" % [atk0, atk1])
	check(not RS.wonders.jobs.has(ai_f) and int(RS.enemies[ai_c].troops) == 3000 and W.pct(ai_f, "atkPct") == 0.0,
		"③' AI 늦음 — 공사 멈춤 · 인부 귀환(%d) · AI 효과 없음" % int(RS.enemies[ai_c].troops))

	# ③ 우리가 늦음 — AI 가 별 보는 대를 먼저(1달 남음) → 우리 금 반(1500) 환급·인부 귀환
	W.start(RS, ai_f, "star", ai_c)
	RS.wonders.jobs[ai_f].left = 1
	var g1 := int(RS.gold)
	var r_late: Dictionary = W.start(RS, me, "star", cid)
	var lost: Array = W.monthly(RS)
	var refund := int(RS.gold) - (g1 - 3000)
	check(bool(r_late.ok) and W.built_by(RS, "star") == ai_f and refund == 1500 and int(RS.cities[cid].troops) == 5000 and not RS.wonders.jobs.has(me)
		and str(lost).contains("😞") and W.pct(me, "plotPct") == 0.0,
		"③ 우리 늦음 — %s 완공 · 금 반 환급 %d · 인부 귀환 · 알림 %d줄" % [W.force_name(ai_f), refund, lost.size()])
	var dup: String = W.why(RS, me, "star", cid)
	check(dup.contains("이미"), "③'' 지어진 것은 다시 못 지음(「%s」)" % dup)

	# ⑤ AI fx — 만리 장벽 → 받는 피해 −10%
	AI.call("store", RS, ai_f)
	var take0: float = AI.mul(RS, ai_f, "take")
	RS.wonders.built["wall"] = {"by": ai_f, "at": "x", "city": ai_c}
	W.bump()
	var take1: float = AI.mul(RS, ai_f, "take")
	check(is_equal_approx(take1, maxf(0.5, take0 - 0.10)), "⑤ AI 만리 장벽 — 받는 피해 %.2f → %.2f" % [take0, take1])

	# ④ AI 착공 — 첫 해 없음 · 둘째 해 차례 달에 착공·병력 빠짐
	RS.wonders = {"built": {}, "jobs": {}}
	W.bump()
	var start_y := int(String(RS.scenario_id))
	RS.year = start_y
	RS.month = 1
	var first: Array = []
	for m in 11:
		RS.month = m + 1
		first.append_array(W.ai_all(RS))
	var troops_before := {}
	for eid in RS.enemies:
		troops_before[eid] = int(RS.enemies[eid].troops)
	RS.year = start_y + 1
	var second: Array = []
	for m in 12:
		RS.month = m + 1
		second.append_array(W.ai_all(RS))
	var drop_ok: bool = not (RS.wonders.jobs as Dictionary).is_empty()
	for f in RS.wonders.jobs:
		var j: Dictionary = RS.wonders.jobs[f]
		drop_ok = drop_ok and int(RS.enemies[j.city].troops) == int(troops_before[j.city]) - int(j.men) and int(j.gold) == 0
	check(first.is_empty() and not second.is_empty() and drop_ok, "④ AI 착공 — 첫 해 %d · 둘째 해 %d세력 · 인부만큼 병력 빠짐" % [first.size(), RS.wonders.jobs.size()])

	# ⑥ 세이브
	RS.wonders = {"built": {"bridge": {"by": me, "at": "195.3", "city": cid}}, "jobs": {ai_f: {"id": "wall", "city": ai_c, "left": 4, "gold": 0, "men": 750}}}
	RS.path_override = "user://probe_realm_wonder_save.json"
	var ok_save: bool = RS.save()
	RS.wonders = {}
	var ok_load: bool = RS.try_load()
	var rt: bool = W.built_by(RS, "bridge") == me and int(W.job_of(RS, ai_f).get("left", -1)) == 4
	var f := FileAccess.open(RS.path_override, FileAccess.READ)
	var dd: Dictionary = JSON.parse_string(f.get_as_text())
	f.close()
	dd.erase("wonders")
	dd["version"] = 23
	f = FileAccess.open(RS.path_override, FileAccess.WRITE)
	f.store_string(JSON.stringify(dd))
	f.close()
	var ok_old: bool = RS.try_load()
	var old_empty: bool = (RS.wonders.built as Dictionary).is_empty() and (RS.wonders.jobs as Dictionary).is_empty()
	DirAccess.remove_absolute(ProjectSettings.globalize_path(RS.path_override))
	DirAccess.remove_absolute(ProjectSettings.globalize_path(RS.path_override + ".bak"))
	check(ok_save and ok_load and rt and ok_old and old_empty and RS.SAVE_VERSION >= 24, "⑥ 세이브 왕복 · 옛 23 → 빈 것 · 버전 %d(24 이상, G-0310 에 25)" % RS.SAVE_VERSION)

	# ⑦ 단추
	RS.wonders = {"built": {"bridge": {"by": me, "at": "195.3", "city": cid}, "wall": {"by": ai_f, "at": "195.4", "city": ai_c}}, "jobs": {}}
	W.bump()
	var stage := Node.new()
	root.add_child(stage)
	current_scene = stage
	var btn := Button.new()
	btn.set_script(load("res://games/saga_realm/ui/realm_wonder_button.gd"))
	stage.add_child(btn)
	var opened := bool(btn.call("open_screen"))
	await process_frame
	var layer: Variant = btn.get("_layer")
	var n_btn := 0
	if layer is CanvasLayer:
		n_btn = (layer as CanvasLayer).find_children("*", "Button", true, false).size()
	var l_bridge: String = btn.call("line", W.by_id("bridge"))
	btn.call("_close")
	check(opened and btn.text == "🏛️ 불가사의" and n_btn == 7 and l_bridge.contains("우리 완공"), "⑦ 단추 「%s」 · 줄 %d(여섯 + 닫기) · 큰 다리 줄 우리 완공" % [btn.text, n_btn])

	# ⑧ 지도 탑
	var towers := Node3D.new()
	towers.set_script(load("res://games/saga_realm/world/realm_wonder_towers.gd"))
	stage.add_child(towers)
	var n_tw := int(towers.call("refresh"))
	check(n_tw == 2, "⑧ 지도 탑 %d(완공 둘)" % n_tw)
	stage.queue_free()

	# ⑨ 새 판 비움
	RS.start_scenario(String(RS.scenario_id))
	check((RS.wonders.built as Dictionary).is_empty() and (RS.wonders.jobs as Dictionary).is_empty(), "⑨ 새 판 — 불가사의 비움")

	RS.tech = saved.tech
	RS.gold = saved.gold
	RS.path_override = saved.path
	RS.year = saved.year
	RS.month = saved.month
	RS.passive = saved.passive
	RS._passive_api = null
	RS.cities = saved.cities
	RS.enemies = saved.enemies
	RS.wonders = saved.wonders
	RS.ai_passive = saved.ai_passive
	RS.current_city = saved.cur
	T.bump()
	W.bump()
	print("PROBE realm_wonder %s" % ("OK" if fails == 0 else "FAIL %d" % fails))
	quit(0 if fails == 0 else 1)
