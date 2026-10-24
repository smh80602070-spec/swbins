extends SceneTree
## G-0347 5천하 전술판 화계 점검(규칙 층, 화면 없음) —
##   godot --headless --path saga-godot --script res://tools/probe_realm_fire.gd   → "PROBE realm_fire OK" / "FAIL n"
## ① 지력 70 이상 내 장수만(무력 장수·적 안 됨) ② 놓을 칸 = 3칸 안 숲, 불 붙은 칸 빠짐 ③ 성공률 clamp(40 + (지력−60)×2, 30, 90)
## ④ 붙으면 그 칸 위 유닛(적·아군)이 곧바로 탐(6 + 지력/10) · 장수 차례 끝 ⑤ 적 턴 끝마다 다시 탐 · 두 번 타고 꺼짐
## ⑥ 실패도 차례는 끝 ⑦ 불 안 쓰면 판에 fire 칸이 생기지 않음(웹 맞춤은 probe_realm_tactics ⓪)
## ⑧ 혼란 — 성공률 식·걸린 적은 다음 차례를 쉬고 풀림 ⑨ 회복 — 2칸 안 다친 아군 +15+지력/5(최대 넘지 않음) ⑩ 책략 셋이 한 판 두 번을 같이 씀

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


func _board(seed: String) -> Dictionary:
	var b: Dictionary = T.call("make_board", seed, "mount", false)
	b.units = T.call("units_of", b, ["m1", "m2"], ["f1", "f2"], [800], STATS)
	return b


## 내 m1 곁 3칸 안 숲 칸 하나(없으면 {})
func _forest_near(b: Dictionary) -> Dictionary:
	var cells: Array = T.call("fire_cells", b, "me:m1")
	return cells[0] if not cells.is_empty() else {}


func _run() -> void:
	await process_frame
	T = load("res://games/saga_realm/data/realm_tactics.gd")

	# ①
	var b := _board("fire-1")
	check(bool(T.call("can_fire", b, "me:m1")) and not bool(T.call("can_fire", b, "me:m2")) and not bool(T.call("can_fire", b, "foe:f2")), "① 지력 90 장수만 화계(지력 40·적 안 됨)")

	# ②
	var lit_b: Dictionary = {}
	var cell: Dictionary = {}
	var r: Dictionary = {}
	for i in 40:
		var bb := _board("fire-%d" % i)
		var c := _forest_near(bb)
		if c.is_empty():
			continue
		var f2: Dictionary = T.call("unit", bb, "foe:f2")
		f2.x = int(c.x)
		f2.y = int(c.y)
		var rr: Dictionary = T.call("fire", bb, "me:m1", int(c.x), int(c.y))
		if bool(rr.get("lit", false)):
			lit_b = bb
			cell = c
			r = rr
			break
	var ok2 := not lit_b.is_empty()
	if ok2:
		var m1: Dictionary = T.call("unit", lit_b, "me:m1")
		for c2: Dictionary in T.call("fire_cells", lit_b, "me:m2"):
			ok2 = false
		var u: Dictionary = T.call("unit", _board("fire-1"), "me:m1")
		for c3: Dictionary in T.call("fire_cells", _board("fire-1"), "me:m1"):
			if T.call("cell_at", _board("fire-1"), int(c3.x), int(c3.y)) != "forest" or absi(int(c3.x) - int(u.x)) + absi(int(c3.y) - int(u.y)) > 3:
				ok2 = false
	check(ok2, "② 놓을 칸 = 3칸 안 숲(지력 낮은 장수는 빈 목록)")

	# ③
	check(int(T.call("fire_chance", {"wis": 90.0})) == 90 and int(T.call("fire_chance", {"wis": 70.0})) == 60 and int(T.call("fire_chance", {"wis": 40.0})) == 30 and int(T.call("fire_chance", {"wis": 99.0})) == 90, "③ 성공률 90·60·30(아래 막힘)·90(위 막힘)")

	# ④
	if lit_b.is_empty():
		check(false, "④ 40판 안에 붙은 불이 없음")
		_finish()
		return
	var f2u: Dictionary = T.call("unit", lit_b, "foe:f2")
	var dmg := int(T.call("js_round", 6.0 + 90.0 / 10.0))
	var hp_after := float(f2u.hp)
	var hit_f2 := false
	for h: Dictionary in r.hits:
		hit_f2 = hit_f2 or (String(h.uid) == "foe:f2" and int(h.dmg) == dmg)
	check(hit_f2 and hp_after == float(f2u.max) - float(dmg) and bool((T.call("unit", lit_b, "me:m1") as Dictionary).acted) and (lit_b.fire as Dictionary).has("%d,%d" % [int(cell.x), int(cell.y)]),
		"④ 붙음 — 그 칸 위 적 −%d(%d → %.0f) · 장수 차례 끝 · 불 칸 %d" % [dmg, int(f2u.max), hp_after, (lit_b.fire as Dictionary).size()])

	# ⑤
	var key := "%d,%d" % [int(cell.x), int(cell.y)]
	var t1: Array = T.call("burn_tick", lit_b)
	f2u.x = int(cell.x)
	f2u.y = int(cell.y)
	var hp1 := float(f2u.hp)
	var left1 := int((lit_b.fire as Dictionary).get(key, {"left": -1}).left)
	var t2: Array = T.call("burn_tick", lit_b)
	var gone := not (lit_b.fire as Dictionary).has(key)
	check(left1 == 1 and float(f2u.hp) == maxf(0.0, hp1 - float(dmg)) and gone and not t2.is_empty() and t1.size() >= 0, "⑤ 적 턴마다 다시 탐 · 두 번 뒤 꺼짐(%.0f → %.0f)" % [hp1, float(f2u.hp)])

	# ⑥
	var miss_seen := false
	for i in 40:
		var bb := _board("miss-%d" % i)
		var c := _forest_near(bb)
		if c.is_empty():
			continue
		var m2s: Dictionary = T.call("unit", bb, "me:m1")
		m2s.wis = 70.0   # 성공 60%
		var rr: Dictionary = T.call("fire", bb, "me:m1", int(c.x), int(c.y))
		if bool(rr.get("ok", false)) and not bool(rr.lit):
			miss_seen = bool(m2s.acted) and not bb.has("fire") or (bb.fire as Dictionary).is_empty()
			break
	check(miss_seen, "⑥ 실패해도 차례는 끝 · 불 없음")

	# ⑦
	var clean := _board("clean")
	T.call("auto_play", clean)
	check(not clean.has("fire") or (clean.fire as Dictionary).is_empty(), "⑦ 불 안 쓰면 fire 칸 없음")

	# ⑧
	var cb: Dictionary = T.call("make_board_srpg", "plots", "plain", false, "rout")
	T.call("units_of_srpg", cb, ["m1", "m2"], ["f1", "f2"], [800], STATS)
	var m1: Dictionary = T.call("unit", cb, "me:m1")
	var f1: Dictionary = T.call("unit", cb, "foe:f1")
	f1.x = int(m1.x) + 2
	f1.y = int(m1.y)
	var ch := int(T.call("confuse_chance", m1, f1))
	var hit := false
	var tries := 0
	while not hit and tries < 30:
		tries += 1
		var bb: Dictionary = cb.duplicate(true)
		bb.seed = "plots-%d" % tries
		var rc: Dictionary = T.call("plot", bb, "me:m1", "confuse", "foe:f1")
		if bool(rc.get("hit", false)):
			hit = true
			var ff: Dictionary = T.call("unit", bb, "foe:f1")
			var fx0 := int(ff.x)
			var hp_me := 0.0
			for u: Dictionary in bb.units:
				if String(u.side) == "me":
					hp_me += float(u.hp)
			bb.side = "foe"
			T.call("act_auto", bb, ff)
			check(int(ff.x) == fx0 and not bool(ff.confused) and bool(ff.acted), "⑧ 혼란 %d%%(지력 90 대 50) · 걸린 적 한 차례 쉼 → 풀림" % ch)
	if not hit:
		check(false, "⑧ 30번에 한 번도 혼란 안 걸림")

	# ⑨
	var hb: Dictionary = cb.duplicate(true)
	var m2: Dictionary = T.call("unit", hb, "me:m2")
	m2.hp = float(m2.max) - 40.0
	m2.x = int((T.call("unit", hb, "me:m1") as Dictionary).x)
	m2.y = int((T.call("unit", hb, "me:m1") as Dictionary).y) + 1
	var hr: Dictionary = T.call("plot", hb, "me:m1", "heal", "me:m2")
	var want := int(T.call("js_round", 15.0 + 90.0 / 5.0))
	check(bool(hr.ok) and int(hr.amount) == want and float(m2.hp) == float(m2.max) - 40.0 + float(want), "⑨ 회복 +%d" % int(hr.amount))

	# ⑩
	check(int(hb.plots) == 1 and int(T.call("unit", hb, "me:m1").acted) == 1, "⑩ 책략 한 번 쓰면 %d번 남음 · 장수 차례 끝" % int(hb.plots))
	_finish()


func _finish() -> void:
	print("PROBE realm_fire %s" % ("OK" if fails == 0 else "FAIL %d" % fails))
	quit(0 if fails == 0 else 1)
