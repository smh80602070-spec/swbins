extends SceneTree
## G-0347 ⑤-c 5천하 전장 안 일기토·설전 점검(규칙 층) —
##   godot --headless --path saga-godot --script res://tools/probe_realm_duel.gd   → "PROBE realm_duel OK" / "FAIL n"
## ① 일기토 상대 = 붙은(1칸) 적 장수만(부대·먼 장수 아님) ② 이기면 상대 −40%·한 차례 쉼 ③ 지면 내가 −40% ④ 비기면 둘 다 −10%
## ⑤ 설전 상대 = 3칸 안 적 장수 · 정답 2 → 기세 꺾임(공격 ×0.8·쉼, 다시는 못 걺) · 정답 1 → 헛말 ⑥ 적 수 셋(판 굴림) ⑦ 화면 스크립트 읽힘

const STATS := {"m1": {"might": 80, "wisdom": 90, "command": 70}, "m2": {"might": 95, "wisdom": 40, "command": 85},
	"f1": {"might": 90, "wisdom": 50, "command": 80}, "f2": {"might": 70, "wisdom": 75, "command": 60}}

var fails := 0
var T: GDScript


func check(ok: bool, msg: String) -> void:
	print("  %s %s" % ["OK  " if ok else "FAIL", msg])
	if not ok:
		fails += 1


func _initialize() -> void:
	_run.call_deferred()


func _board() -> Dictionary:
	var b: Dictionary = T.call("make_board_srpg", "duel", "plain", false, "rout")
	T.call("units_of_srpg", b, ["m1", "m2"], ["f1", "f2"], [800], STATS)
	var m1: Dictionary = T.call("unit", b, "me:m1")
	var f1: Dictionary = T.call("unit", b, "foe:f1")
	var f2: Dictionary = T.call("unit", b, "foe:f2")
	var tr: Dictionary = T.call("unit", b, "foe:troop0")
	m1.x = 4
	m1.y = 3
	f1.x = 5
	f1.y = 3
	f2.x = 4
	f2.y = 6
	tr.x = 3
	tr.y = 3
	return b


func _run() -> void:
	await process_frame
	T = load("res://games/saga_realm/data/realm_tactics.gd")

	# ①
	var b := _board()
	var dt: Array = T.call("duel_targets", b, "me:m1")
	check(dt == ["foe:f1"], "① 일기토 상대 %s(붙은 장수만 — 부대·3칸 장수 빠짐)" % [dt])

	# ②
	var r2: Dictionary = T.call("duel", b, "me:m1", "foe:f1", 2)
	var f1: Dictionary = T.call("unit", b, "foe:f1")
	check(bool(r2.ok) and int(r2.dmg_foe) == int(T.call("js_round", float(f1.max) * 0.4)) and bool(f1.confused) and bool((T.call("unit", b, "me:m1") as Dictionary).acted), "② 이김 → 상대 −%d·쉼·내 차례 끝" % int(r2.dmg_foe))

	# ③
	var b3 := _board()
	var r3: Dictionary = T.call("duel", b3, "me:m1", "foe:f1", -1)
	var m3: Dictionary = T.call("unit", b3, "me:m1")
	check(int(r3.dmg_me) == int(T.call("js_round", float(m3.max) * 0.4)) and int(r3.dmg_foe) == 0 and float(m3.hp) == float(m3.max) - float(r3.dmg_me), "③ 짐 → 내가 −%d" % int(r3.dmg_me))

	# ④
	var b4 := _board()
	var r4: Dictionary = T.call("duel", b4, "me:m1", "foe:f1", 0)
	check(int(r4.dmg_me) > 0 and int(r4.dmg_foe) > 0 and not bool((T.call("unit", b4, "foe:f1") as Dictionary).get("confused", false)), "④ 비김 → 둘 다 −%d·−%d" % [int(r4.dmg_me), int(r4.dmg_foe)])

	# ⑤
	var b5 := _board()
	var db: Array = T.call("debate_targets", b5, "me:m1")
	var f2: Dictionary = T.call("unit", b5, "foe:f2")
	var atk0 := float(f2.atk)
	var r5: Dictionary = T.call("debate", b5, "me:m1", "foe:f2", 2)
	var again: Array = T.call("debate_targets", b5, "me:m2")
	var b5b := _board()
	var r5b: Dictionary = T.call("debate", b5b, "me:m1", "foe:f2", 1)
	check(db.has("foe:f1") and db.has("foe:f2") and not db.has("foe:troop0") and bool(r5.won) and is_equal_approx(float(f2.atk), atk0 * 0.8) and bool(f2.confused) and not again.has("foe:f2") and not bool(r5b.won),
		"⑤ 설전 상대 %s · 정답 2 → 공격 %.1f→%.1f·쉼 · 다시 못 걺 · 정답 1 → 헛말" % [db, atk0, float(f2.atk)])

	# ⑥
	var b6 := _board()
	var mv: Array = T.call("duel_foe_moves", b6)
	var ok6 := mv.size() == 3
	for m in mv:
		ok6 = ok6 and ["slash", "stab", "guard"].has(m)
	check(ok6, "⑥ 적 수 %s" % [mv])

	# ⑦
	var view: GDScript = load("res://games/saga_realm/world/realm_tactics_view.gd")
	check(view != null and view.can_instantiate(), "⑦ 화면 스크립트 읽힘")
	_finish()


func _finish() -> void:
	print("PROBE realm_duel %s" % ("OK" if fails == 0 else "FAIL %d" % fails))
	quit(0 if fails == 0 else 1)
