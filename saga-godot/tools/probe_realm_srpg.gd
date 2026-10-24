extends SceneTree
## G-0347 ③ 5천하 격자 SRPG 규칙 점검(화면 없음, 씨앗 고정) —
##   godot --headless --path saga-godot --script res://tools/probe_realm_srpg.gd   → "PROBE realm_srpg OK" / "FAIL n"
## ① 판 크기 땅별(10×8·11×8·11×9·12×10) · 구릉 판에 언덕 · 공성 성문 칸 · 성문 목표는 공성에서만 ② 병종(기 이동 3·궁 사거리 2·창 방어 +2)·대장 표시
## ③ 명중 덤 — 높이 +10 · 상성 ±20 · 뒤 +20 ④ 걸어간 쪽을 봄 ⑤ 승리 조건 넷(대장·성문 = 대승, 버팀 = 승) ⑥ 자동 대국 60판 승률 45~65%·평균 턴 ≤ 12
## ⑦ 옛 판(make_board)은 8×6 그대로 · 책략 한 판 두 번

var fails := 0
var T: GDScript


func check(ok: bool, msg: String) -> void:
	print("  %s %s" % ["OK  " if ok else "FAIL", msg])
	if not ok:
		fails += 1


func _initialize() -> void:
	_run.call_deferred()


func _stats(seed: String, ids: Array) -> Dictionary:
	var out := {}
	for id: String in ids:
		out[id] = {"might": 55 + int(T.call("hash01", seed, id + "m") * 35.0), "wisdom": 50 + int(T.call("hash01", seed, id + "w") * 45.0),
			"command": 55 + int(T.call("hash01", seed, id + "c") * 35.0)}
	return out


func _game(i: int) -> Dictionary:
	var lands := ["plain", "river", "hill", "mount"]
	var goal: String = T.get("GOALS")[i % 4]
	var siege := goal == "gate" or i % 3 == 0
	var seed := "srpg-%d" % i
	var b: Dictionary = T.call("make_board_srpg", seed, lands[i % 4], siege, goal)
	var mine := ["m1", "m2", "m3"]
	var foes := ["f1", "f2", "f3"]
	T.call("units_of_srpg", b, mine, foes, [1500 + (i % 5) * 400], _stats(seed, mine + foes), [1500 + ((i + 2) % 5) * 400])
	return b


func _run() -> void:
	await process_frame
	T = load("res://games/saga_realm/data/realm_tactics.gd")

	# ①
	var sz := {}
	for land in ["plain", "river", "hill", "mount"]:
		var b: Dictionary = T.call("make_board_srpg", "size", land, false, "rout")
		sz[land] = "%dx%d" % [int(b.cols), int(b.rows)]
	var hb: Dictionary = T.call("make_board_srpg", "hills", "hill", false, "rout")
	var hills := (hb.cells as Array).count("hill")
	var sb: Dictionary = T.call("make_board_srpg", "siege", "plain", true, "gate")
	var g: Array = sb.gate
	var fb: Dictionary = T.call("make_board_srpg", "nogate", "plain", false, "gate")
	check(sz == {"plain": "10x8", "river": "11x8", "hill": "11x9", "mount": "12x10"} and hills > 3 and T.call("cell_at", sb, int(g[0]), int(g[1])) == "gate" and String(fb.goal) == "rout",
		"① 판 %s · 구릉 언덕 %d · 성문 %s · 공성 아니면 성문 목표 → 전멸" % [sz, hills, g])

	# ②
	var b2 := _game(0)
	var arms := {}
	var ok2 := true
	var leader := 0
	for u: Dictionary in b2.units:
		if bool(u.get("leader", false)):
			leader += 1
		if String(u.kind) == "troop":
			arms[u.arm] = true
			if String(u.arm) == "cav" and int(u.mov) != 3 or String(u.arm) == "bow" and int(u.rng) != 2 or String(u.arm) == "spear" and float(u.def) != 4.0:
				ok2 = false
	check(ok2 and leader == 1 and not arms.is_empty(), "② 병종 %s 수치 · 대장 %d" % [arms.keys(), leader])

	# ③
	var b3: Dictionary = T.call("make_board_srpg", "mods", "plain", false, "rout")
	b3.cells[2 * int(b3.cols) + 2] = "hill"
	var a := {"x": 2, "y": 2, "arm": "spear", "fx": 1, "fy": 0, "atk": 20.0, "def": 2.0}
	var t := {"x": 3, "y": 2, "arm": "cav", "fx": 1, "fy": 0, "atk": 20.0, "def": 2.0}
	var mods: Array = T.call("hit_mods", b3, a, t)
	var names := mods.map(func(m: Array) -> String: return "%s%+d" % [m[0], m[1]])
	var t2 := {"x": 3, "y": 2, "arm": "bow", "fx": -1, "fy": 0, "atk": 20.0, "def": 2.0}
	var mods2: Array = T.call("hit_mods", b3, a, t2)
	check(names == ["높이+10", "상성+20", "뒤+20"] and mods2.map(func(m: Array) -> String: return "%s%+d" % [m[0], m[1]]) == ["높이+10", "상성-20"],
		"③ 덤 %s · 정면 궁 상대 %s" % [names, mods2])

	# ④
	var b4 := _game(1)
	var me: Dictionary = (T.call("alive", b4, "me") as Array)[0]
	var mv: Array = T.call("moves", b4, String(me.uid))
	var down := {}
	for c: Dictionary in mv:
		if int(c.y) > int(me.y) and int(c.x) == int(me.x):
			down = c
	var faced := false
	if not down.is_empty():
		T.call("move", b4, String(me.uid), int(down.x), int(down.y))
		faced = int(me.fx) == 0 and int(me.fy) == 1
	check(faced, "④ 아래로 걸으면 아래를 봄")

	# ⑤
	var b5 := _game(1)   # leader
	b5.goal = "leader"
	for u: Dictionary in b5.units:
		if bool(u.get("leader", false)):
			u.hp = 0.0
	var k1 := String(T.call("check", b5))
	var b6 := _game(2)
	b6.goal = "gate"
	var gg: Array = b6.gate
	var mu: Dictionary = (T.call("alive", b6, "me") as Array)[0]
	mu.x = int(gg[0])
	mu.y = int(gg[1])
	var k2 := String(T.call("check", b6)) if int(gg[0]) >= 0 else "rout"
	var b7 := _game(3)
	b7.goal = "hold"
	b7.turn = 7
	var k3 := String(T.call("check", b7))
	check(k1 == "rout" and k2 == "rout" and k3 == "win", "⑤ 대장 격파 %s · 성문 %s · 6턴 버팀 %s" % [k1, k2, k3])

	# ⑥
	var wins := 0
	var turns := 0
	var by_goal := {}
	for i in 60:
		var b := _game(i)
		var o: Dictionary = T.call("auto_play", b)
		var won := String(o.kind) == "rout" or String(o.kind) == "win"
		if won:
			wins += 1
		turns += int(o.turn)
		var gk := String(b.goal)
		if not by_goal.has(gk):
			by_goal[gk] = [0, 0]
		by_goal[gk][1] += 1
		if won:
			by_goal[gk][0] += 1
	var rate := float(wins) / 60.0
	var avg := float(turns) / 60.0
	check(rate >= 0.45 and rate <= 0.65 and avg <= 12.0, "⑥ 자동 대국 60판 승률 %.0f%% · 평균 %.1f턴 · 목표별 %s" % [rate * 100.0, avg, by_goal])

	# ⑦
	var old: Dictionary = T.call("make_board", "old", "plain", false)
	var pb := _game(5)
	pb.plots = 0
	var hi_wis: Dictionary = (T.call("alive", pb, "me") as Array)[0]
	hi_wis.wis = 95.0
	check(int(old.cols) == 8 and int(old.rows) == 6 and not old.has("srpg") and not bool(T.call("can_fire", pb, String(hi_wis.uid))), "⑦ 옛 판 8×6 그대로 · 책략 다 쓰면 화계 못 함")
	_finish()


func _finish() -> void:
	print("PROBE realm_srpg %s" % ("OK" if fails == 0 else "FAIL %d" % fails))
	quit(0 if fails == 0 else 1)
