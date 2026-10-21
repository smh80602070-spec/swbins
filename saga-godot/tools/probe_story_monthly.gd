extends SceneTree

## G-0296 4종횡 달 사명 자동 점검(웹 W-0242 짝) —
##   godot --headless --path saga-godot --script res://tools/probe_story_monthly.gd   → "PROBE story_monthly OK" / "FAIL n"
## ① 이달의 사냥터: 같은 달 같은 곳·앞쪽 여섯 중 · 달마다 바뀔 수 있음 ② 그곳 처치는 2, 다른 곳 1 ③ GOAL 채우면 문장 하나(한 번만)
## ④ 새 달 = 셈만 새로·문장 그대로 ⑤ StorySaveState.add_kill 이 달 셈을 올림(끝에 되돌림, 세이브 안 함)

const M := preload("res://games/saga_story/data/story_monthly.gd")

var fails := 0


func _fail(msg: String) -> void:
	fails += 1
	print("  FAIL ", msg)


func _init() -> void:
	await process_frame
	var k1 := "2026-10"
	var k2 := "2026-11"
	var f1 := M.featured_of(k1)
	if f1 != M.featured_of(k1) or not M.FEATURED.has(f1):
		_fail("① 이달의 사냥터 %s" % f1)
	var seen := {}
	for mth in range(1, 13):
		seen[M.featured_of("2026-%02d" % mth)] = true
	if seen.size() < 3:
		_fail("① 열두 달이 %d 곳에만 몰림" % seen.size())
	var other := "gorge"
	var st := {}
	M.on_kill(st, f1, k1)
	M.on_kill(st, other, k1)
	if int(st.n) != 3:
		_fail("② 이달의 사냥터 2 + 다른 곳 1 = 3 인데 %d" % int(st.n))
	var got := 0
	for _i in M.GOAL:
		if M.on_kill(st, other, k1):
			got += 1
	if got != 1 or int(st.n) != M.GOAL or (st.badges as Array) != [k1]:
		_fail("③ 채움 %d번 · n %d · 문장 %s" % [got, int(st.n), st.badges])
	M.on_kill(st, other, k2)
	if String(st.key) != k2 or int(st.n) != 1 or (st.badges as Array) != [k1]:
		_fail("④ 새 달 %s n %d 문장 %s" % [st.key, int(st.n), st.badges])
	print("MONTH %s → %s · %s" % [k1, f1, M.line(st, k2, {})])
	## ⑤
	var ss := root.get_node("/root/StorySaveState")
	var keep: Dictionary = (ss.get("monthly") as Dictionary).duplicate(true)
	var kills0 := int(ss.get("kills"))
	var n0 := int((ss.get("monthly") as Dictionary).get("n", 0)) if String((ss.get("monthly") as Dictionary).get("key", "")) == M.now_key() else 0
	ss.call("add_kill", "gorge")
	var mo: Dictionary = ss.get("monthly")
	if String(mo.get("key", "")) != M.now_key() or int(mo.get("n", 0)) != n0 + (2 if M.featured_of(M.now_key()) == "gorge" else 1):
		_fail("⑤ add_kill 뒤 달 셈 %s" % [mo])
	ss.set("monthly", keep)
	ss.set("kills", kills0)
	print("PROBE story_monthly ", "OK" if fails == 0 else "FAIL %d" % fails)
	quit(1 if fails > 0 else 0)
