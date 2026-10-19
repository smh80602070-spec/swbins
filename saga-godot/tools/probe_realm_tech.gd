extends SceneTree

## G-0234 5천하 기술 나무(games/saga_realm/data/realm_tech.gd · RealmSaveState.tech · 경륜도 합산·명령 금·달 연구점 · ui/realm_tech_button.gd) 자동 점검.
##   godot --headless --path saga-godot --script res://tools/probe_realm_tech.gd
## ① 표 4×6·마디 값 6~25·id 겹침 없음 ② 연구점: 12달 = 12 · 진짜 next_month 도 쌓음 · 「글 모으기」 +1/달
## ③ 차례(앞 마디가 문)·모자라면 막음·점 차감 ④ 경륜도 자리: 「물꼬 트기」 → 수확 ×1.05 ⑤ 조선 비용 −20%(150→120) · 훈련 −20% 실제 금 차감(50→40)
## ⑥ 세이브 왕복·옛 21 = 0점 · 버전 22 ⑦ 단추 「📜 연구」 열림. 끝에 "PROBE realm_tech OK" 또는 "PROBE realm_tech FAIL n".

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
	var T: GDScript = load("res://games/saga_realm/data/realm_tech.gd")
	var SC: GDScript = load("res://games/saga_realm/data/realm_statecraft.gd")
	var saved := {"tech": (RS.tech as Dictionary).duplicate(true), "gold": RS.gold, "done": (RS._done_this_month as Dictionary).duplicate(),
		"path": RS.path_override, "year": RS.year, "month": RS.month, "passive": (RS.passive as Dictionary).duplicate(true)}
	RS.passive = {"start": null, "taken": []}
	RS._passive_api = null

	# ① 표
	var ids := {}
	var shape_ok: bool = T.BRANCHES.size() == 4
	for b: Dictionary in T.BRANCHES:
		shape_ok = shape_ok and (b.nodes as Array).size() == 6
		for n: Dictionary in b.nodes:
			ids[String(n.id)] = true
	check(shape_ok and ids.size() == 24 and T.PTS == [6, 9, 12, 16, 20, 25] and int(T.node("l6").pts) == 25, "① 갈래 4 × 마디 6 · id 24 · 값 6~25")

	# ② 연구점
	RS.tech = {}
	for m in 12:
		T.monthly(0)
	var p12 := int(T.state().pts)
	var before := int(T.state().pts)
	RS.next_month()
	var real_add := int(T.state().pts) - before
	check(p12 == 12 and real_add >= 1 and real_add <= 1 + T.SCHOLAR_MAX, "② 학자 없이 12달 = %d점 · 진짜 달 넘김 +%d" % [p12, real_add])

	# ③ 차례·막음
	RS.tech = {"pts": 5, "done": []}
	var poor: Dictionary = T.research("farm")
	RS.tech.pts = 6
	var r1: Dictionary = T.research("farm")
	var nxt: Dictionary = T.next_of("farm")
	check(not bool(poor.ok) and String(poor.why).contains("모자란다") and bool(r1.ok) and int(T.state().pts) == 0 and String(nxt.id) == "f2" and T.done_count("farm") == 1,
		"③ 5점 막음 · 6점에 「물꼬 트기」 · 남은 점 %d · 다음 %s" % [int(T.state().pts), nxt.get("id", "")])

	# ④ 경륜도 자리
	RS.tech = {"pts": 0, "done": []}
	T.bump()
	var food0: float = SC.mul("food")
	RS.tech = {"pts": 0, "done": ["f1"]}
	T.bump()
	var food1: float = SC.mul("food")
	check(is_equal_approx(food0, 1.0) and is_equal_approx(food1, 1.05), "④ 수확 배수 %.2f → %.2f(물꼬 트기 +5%%)" % [food0, food1])

	# ⑤ 명령 금
	RS.tech = {"pts": 100, "done": []}
	var ships0: int = T.cost("ships", 150)
	T.research("trade")
	T.research("trade")
	var ships1: int = T.cost("ships", 150)
	T.research("mil")
	T.research("mil")
	T.research("mil")
	RS.gold = 1000
	RS._done_this_month = {}
	var r_train: Dictionary = RS.execute_order("train", 1.0)
	var spent: int = 1000 - int(RS.gold)
	check(ships0 == 150 and ships1 == 120 and bool(r_train.get("ok", false)) and spent == 40, "⑤ 조선 150→%d · 훈련 실제 금 %d(50 × 0.8)" % [ships1, spent])

	# ②' 글 모으기
	RS.tech = {"pts": 0, "done": ["l1", "l2"]}
	check(T.pts_per_month(0) == 2 and T.pts_per_month(9) == 2 + T.SCHOLAR_MAX - 1 + 1, "②' 「글 모으기」 +1/달 · 학자는 넷까지")

	# ⑥ 세이브
	RS.tech = {"pts": 7, "done": ["f1", "t1"]}
	RS.path_override = "user://probe_realm_tech_save.json"
	var ok_save: bool = RS.save()
	RS.tech = {}
	var ok_load: bool = RS.try_load()
	var round_ok: bool = int(RS.tech.get("pts", -1)) == 7 and (RS.tech.done as Array) == ["f1", "t1"]
	var f := FileAccess.open(RS.path_override, FileAccess.READ)
	var dd: Dictionary = JSON.parse_string(f.get_as_text())
	f.close()
	dd.erase("tech")
	dd["version"] = 21
	f = FileAccess.open(RS.path_override, FileAccess.WRITE)
	f.store_string(JSON.stringify(dd))
	f.close()
	var ok_old: bool = RS.try_load()
	var old_zero: bool = int(T.state().pts) == 0 and (T.state().done as Array).is_empty()
	DirAccess.remove_absolute(ProjectSettings.globalize_path(RS.path_override))
	DirAccess.remove_absolute(ProjectSettings.globalize_path(RS.path_override + ".bak"))
	check(ok_save and ok_load and round_ok and ok_old and old_zero and RS.SAVE_VERSION == 22, "⑥ 세이브 왕복 · 옛 21 → 0점 · 버전 %d" % RS.SAVE_VERSION)

	# ⑦ 단추
	var stage := Node.new()
	root.add_child(stage)
	current_scene = stage
	var btn := Button.new()
	btn.set_script(load("res://games/saga_realm/ui/realm_tech_button.gd"))
	stage.add_child(btn)
	var opened := bool(btn.call("open_screen"))
	await process_frame
	var layer: Variant = btn.get("_layer")
	var n_btn := 0
	if layer is CanvasLayer:
		n_btn = (layer as CanvasLayer).find_children("*", "Button", true, false).size()
	btn.call("_close")
	check(opened and btn.text == "📜 연구" and n_btn == 5, "⑦ 단추 「%s」 · 줄 %d(갈래 넷 + 닫기)" % [btn.text, n_btn])

	RS.tech = saved.tech
	RS.gold = saved.gold
	RS._done_this_month = saved.done
	RS.path_override = saved.path
	RS.year = saved.year
	RS.month = saved.month
	RS.passive = saved.passive
	RS._passive_api = null
	T.bump()
	print("PROBE realm_tech %s" % ("OK" if fails == 0 else "FAIL %d" % fails))
	quit(0 if fails == 0 else 1)
