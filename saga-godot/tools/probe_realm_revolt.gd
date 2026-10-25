extends SceneTree

## G-0410 5천하 민란 자동 점검 —
##   godot --headless --path saga-godot --script res://tools/probe_realm_revolt.gd   → "PROBE realm_revolt OK" / "FAIL n"
## ① rolls: 치안 20 이상은 늘 안 남 · 치안 5 성은 120달 가운데 CHANCE 쯤(15~45%) · 같은 입력은 같은 답
## ② strike: 병력 −20% · 치안 +15 · 금 = 인구/1000 × GOLD_PER_POP
## ③ monthly(RealmSaveState): 치안 5 성이 터지는 달을 골라 부르면 메시지 한 줄 · 병력·금·치안이 ② 대로 · SAGA_REVOLT=0 이면 아무 일 없음
## RealmSaveState 는 메모리에서만 바꾸고 끝에 되돌린다(저장 안 함).

var fails := 0


func _fail(msg: String) -> void:
	fails += 1
	print("  FAIL ", msg)


func _initialize() -> void:   # autoload 이름은 _init 뒤에야 등록된다
	await process_frame
	var R: GDScript = load("res://games/saga_realm/data/realm_revolt.gd")
	# ①
	var hit := 0
	var hi_hit := 0
	for k in 120:
		if R.rolls("194", 194 + k / 12, k % 12 + 1, "c_test", 5):
			hit += 1
		if R.rolls("194", 194 + k / 12, k % 12 + 1, "c_test", 20):
			hi_hit += 1
	print("REVOLT 치안5 %d/120 · 치안20 %d/120" % [hit, hi_hit])
	if hi_hit != 0 or hit < 18 or hit > 54 or R.rolls("194", 195, 3, "c_test", 5) != R.rolls("194", 195, 3, "c_test", 5):
		_fail("① rolls")
	# ②
	var c := {"troops": 1000, "sec": 5, "pop": 50000}
	var lost: Dictionary = R.strike(c)
	if int(c.troops) != 800 or int(c.sec) != 20 or int(lost.troops) != 200 or int(lost.gold) != R.GOLD_PER_POP * 50:
		_fail("② strike %s %s" % [c, lost])
	# ③
	var S: Node = root.get_node("RealmSaveState")
	var keep := {"cities": (S.get("cities") as Dictionary).duplicate(true), "gold": S.get("gold"), "year": S.get("year"), "month": S.get("month")}
	var ids: Array = (S.get("cities") as Dictionary).keys()
	if ids.is_empty():
		_fail("③ 우리 성 없음")
	else:
		var cid: String = ids[0]
		for other: String in ids:
			S.cities[other].sec = 100
		S.cities[cid].sec = 5
		var found := false
		for k in 120:
			if R.rolls(String(S.get("scenario_id")), 194 + k / 12, k % 12 + 1, cid, 5):
				S.set("year", 194 + k / 12)
				S.set("month", k % 12 + 1)
				found = true
				break
		OS.set_environment("SAGA_REVOLT", "0")
		var none: Array = R.monthly(S)
		OS.set_environment("SAGA_REVOLT", "")
		S.set("gold", 5000)
		var t0 := int(S.cities[cid].troops)
		var p0 := int(S.cities[cid].pop)
		var msgs: Array = R.monthly(S)
		print("MONTHLY %s · 병력 %d → %d · 금 5000 → %d · 치안 → %d" % [msgs, t0, int(S.cities[cid].troops), int(S.get("gold")), int(S.cities[cid].sec)])
		if not found or not none.is_empty() or msgs.size() != 1 or int(S.cities[cid].troops) != t0 - roundi(float(t0) * 0.2) or int(S.cities[cid].sec) != 20 or int(S.get("gold")) != maxi(0, 5000 - R.GOLD_PER_POP * p0 / 1000):
			_fail("③ monthly")
	for k: String in keep:
		S.set(k, keep[k])
	print("PROBE realm_revolt ", "OK" if fails == 0 else "FAIL %d" % fails)
	quit(1 if fails > 0 else 0)
