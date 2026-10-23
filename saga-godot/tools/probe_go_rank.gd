extends SceneTree

## G-0313 1만리 무리 토벌 한 판 등급(웹 W-0379 짝) 점검 —
##   godot --headless --path saga-godot --script res://tools/probe_go_rank.gd   → "PROBE go_rank OK" / "FAIL n"
## ① 실제 들판 적 둘(같은 무리)을 apply_damage 로 쓰러뜨림 → 둘째가 쓰러질 때 토벌 등급 · 첫째만으론 없음
## ② 지속 피해 틱(FeelTuning.kind "dot")은 연속으로 안 셈 · 피격 hurt 가 연속을 끊음 ③ 덤 = 토벌 동안 늘어난 냥 × 배율 · 무리별 최고 기록
## ④ 무리 둘이 따로 셈 ⑤ SAGA_RUNRANK=0 → 셈 없음 ⑥ 저장 왕복·옛 세이브 ⑦ 배선(spawner meta·register · field_combat 피격 같은 줄)
## 진짜 세이브는 안 건드린다.

var fails := 0


func check(cond: bool, msg: String) -> void:
	if cond:
		print("  ok   ", msg)
	else:
		fails += 1
		print("  FAIL ", msg)


func _foe(camp: String, i: int) -> Node3D:
	var e: Node3D = (load("res://games/saga_go/combat/field_enemy.gd") as GDScript).new()
	e.name = "ProbeFoe_%s_%d" % [camp.replace("#", "_"), i]
	e.call("setup", "wolf", Vector3(1000 + i * 3, 0, 1000), 777 + i)
	e.set("respawns", false)
	e.set_meta("go_camp", camp)
	root.add_child(e)
	return e


func _kill(e: Node3D) -> void:
	for t in 40:
		if bool(e.call("is_dead")):
			return
		e.call("apply_damage", 9999.0, false)


func _initialize() -> void:
	await process_frame
	var GR: GDScript = load("res://games/saga_go/data/go_rank.gd")
	var PS: Node = root.get_node("PartyState")
	var FT: GDScript = load("res://games/saga_go/combat/feel_tuning.gd")
	var saved := {"bag": (PS.bag as Dictionary).duplicate(true), "best": (GR.get("best") as Dictionary).duplicate()}
	GR.set("runs", {})
	GR.set("best", {})
	GR.set("last", {})

	# ①③
	var a := _foe("probe#0", 0)
	var b := _foe("probe#0", 1)
	await process_frame
	GR.register("probe#0", [a, b])
	var m0: int = int(PS.count("mora"))
	_kill(a)
	check((GR.get("runs") as Dictionary).has("probe#0") and int(((GR.get("runs") as Dictionary)["probe#0"] as RefCounted).get("kills")) == 1, "① 첫째만 — 판 진행 중(처치 1, 등급 없음)")
	var r0: Dictionary = GR.get("last")
	PS.add_items({"mora": 100})   # 토벌 동안 냥 100 더 벎(둘째 냥과 합쳐짐)
	_kill(b)
	var r: Dictionary = GR.get("last")
	var gained: int = int(PS.count("mora")) - m0 - int(r.get("bonus_gold", 0))
	check(not r.is_empty() and r != r0 and int(r.kills) == 2 and not (GR.get("runs") as Dictionary).has("probe#0"), "① 둘째가 쓰러지자 토벌 등급 %s(처치 %d)" % [String(r.get("rank", "")), int(r.get("kills", 0))])
	var want := int(round(float(gained) * float({"S": 0.5, "A": 0.2, "B": 0.1}.get(String(r.get("rank", "")), 0.0))))
	check(int(r.get("bonus_gold", -1)) == want and bool(r.get("best", false)) and String((GR.get("best") as Dictionary).get("probe#0", "")) == String(r.get("rank", "")),
		"③ 덤 냥 %d(번 냥 %d × 배율) · 첫 기록" % [int(r.get("bonus_gold", -1)), gained])
	check(String(GR.text(r)).begins_with("★ 토벌 등급 ") and String(GR.text(r)).contains("첫 기록"), "③ 글: %s" % String(GR.text(r)).replace("\n", " / "))

	# ② 지속 피해·피격
	var c := _foe("probe#1", 2)
	var d := _foe("probe#1", 3)
	await process_frame
	GR.register("probe#1", [c, d])
	c.call("apply_damage", 1.0, false)
	var prev: String = FT.get("kind")
	FT.set("kind", "dot")
	for i in 10:
		c.call("apply_damage", 0.5, false)
	FT.set("kind", prev)
	var k: RefCounted = (GR.get("runs") as Dictionary).get("probe#1")
	check(k != null and int(k.get("combo_max")) == 1, "② 지속 피해 틱 열 번은 연속에 안 셈(연속 %d)" % (int(k.get("combo_max")) if k != null else -1))
	c.call("apply_damage", 1.0, false)
	GR.hurt()
	c.call("apply_damage", 1.0, false)
	check(int(k.get("hits")) == 1 and int(k.get("combo")) == 1 and int(k.get("combo_max")) == 2, "② 피격이 연속을 끊음(피격 %d · 최대 %d)" % [int(k.get("hits")), int(k.get("combo_max"))])

	# ④ 무리 둘 따로
	var e2 := _foe("probe#2", 4)
	await process_frame
	GR.register("probe#2", [e2])
	e2.call("apply_damage", 1.0, false)
	check((GR.get("runs") as Dictionary).has("probe#1") and (GR.get("runs") as Dictionary).has("probe#2") and int(((GR.get("runs") as Dictionary)["probe#2"] as RefCounted).get("combo_max")) == 1, "④ 무리 둘 셈이 따로")
	_kill(c)
	_kill(d)
	_kill(e2)

	# ⑤ 끄기
	OS.set_environment("SAGA_RUNRANK", "0")
	var f := _foe("probe#3", 5)
	await process_frame
	GR.register("probe#3", [f])
	_kill(f)
	check(not (GR.get("runs") as Dictionary).has("probe#3") and not (GR.get("best") as Dictionary).has("probe#3"), "⑤ SAGA_RUNRANK=0 → 셈 없음")
	OS.set_environment("SAGA_RUNRANK", "")

	# ⑥ 저장
	var SV: Node = root.get_node("SaveState")
	var src := FileAccess.get_file_as_string("res://games/saga_go/data/save_state.gd")
	check(src.contains("\"go_rank_best\": preload(\"res://games/saga_go/data/go_rank.gd\").best") and src.contains("go_rank.gd\").restore(data.get(\"go_rank_best\", {}))"), "⑥ 저장·불러오기 칸(go_rank_best)")
	GR.restore({"village#0": "A", "x": "Z"})
	check((GR.get("best") as Dictionary) == {"village#0": "A"}, "⑥ restore — 등급 글자만")
	GR.restore(null)
	check((GR.get("best") as Dictionary).is_empty(), "⑥ 옛 세이브(칸 없음) = 빈 것")

	# ⑦ 배선
	var sp := FileAccess.get_file_as_string("res://games/saga_go/combat/field_spawner.gd")
	var fc := FileAccess.get_file_as_string("res://games/saga_go/combat/field_combat.gd")
	check(sp.contains("e.set_meta(\"go_camp\", camp_id)") and sp.contains("go_rank.gd\").register(camp_id, camp_list)") and fc.contains("hp = maxf(hp - dmg, 0.0); preload(\"res://games/saga_go/data/go_rank.gd\").hurt()"), "⑦ 무리 meta·등록 · 피격 같은 줄")

	for n in [a, b, c, d, e2, f]:
		if is_instance_valid(n):
			n.queue_free()
	PS.bag = saved.bag
	GR.set("best", saved.best)
	GR.set("runs", {})
	await process_frame
	print("PROBE go_rank ", "OK" if fails == 0 else "FAIL %d" % fails)
	quit(1 if fails > 0 else 0)
