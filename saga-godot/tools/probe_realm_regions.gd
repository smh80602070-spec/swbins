extends SceneTree
## G-0347 ① 5천하 지역 묶음 점검(화면 없음) —
##   godot --headless --path saga-godot --script res://tools/probe_realm_regions.gd   → "PROBE realm_regions OK" / "FAIL n"
## ① 성 107 전부 한 지역 ② 지역마다 성 1~12(첫 화면 ≤ 12) ③ 이웃 대칭·자기 자신 없음 ④ 고립 지역 없음(길로 다 이어짐)
## ⑤ 허창(옛 기본 성)은 중원 · 이름 표

var fails := 0


func check(ok: bool, msg: String) -> void:
	print("  %s %s" % ["OK  " if ok else "FAIL", msg])
	if not ok:
		fails += 1


func _initialize() -> void:
	_run.call_deferred()


func _run() -> void:
	await process_frame
	var R: GDScript = load("res://games/saga_realm/data/realm_regions.gd")
	var C: GDScript = load("res://games/saga_realm/data/realm_cities.gd")
	var regions: Array = R.get("REGIONS")

	# ①
	var all_ids: Array = []
	for c: Dictionary in (C.get("CITIES") as Array) + (C.get("ENEMY_CITIES") as Array):
		all_ids.append(String(c.id))
	var no_region: Array = []
	for cid in all_ids:
		if String(R.call("region_of", cid)) == "":
			no_region.append(cid)
	check(all_ids.size() == 107 and no_region.is_empty(), "① 성 %d 전부 지역 있음(없는 성 %s)" % [all_ids.size(), no_region])

	# ②
	var sizes := {}
	var bad: Array = []
	var total := 0
	for r: Dictionary in regions:
		var n: int = (R.call("cities_of", r.id) as Array).size()
		sizes[r.id] = n
		total += n
		if n < 1 or n > 12:
			bad.append("%s=%d" % [r.id, n])
	check(bad.is_empty() and total == 107, "② 지역 %d · 성 1~12 · 합 %d %s" % [regions.size(), total, sizes])

	# ③ ④
	var asym: Array = []
	var lonely: Array = []
	for r: Dictionary in regions:
		var nb: Array = R.call("neighbors", r.id)
		if nb.has(r.id):
			asym.append(r.id + "(자기)")
		for o in nb:
			if not (R.call("neighbors", o) as Array).has(r.id):
				asym.append("%s→%s" % [r.id, o])
		if nb.is_empty():
			lonely.append(r.id)
	check(asym.is_empty(), "③ 이웃 대칭 %s" % [asym])
	var seen := {regions[0].id: true}
	var stack: Array = [regions[0].id]
	while not stack.is_empty():
		var cur: String = stack.pop_back()
		for o in R.call("neighbors", cur):
			if not seen.has(o):
				seen[o] = true
				stack.append(o)
	check(lonely.is_empty() and seen.size() == regions.size(), "④ 고립 없음 · 하북에서 길로 닿는 지역 %d/%d %s" % [seen.size(), regions.size(), lonely])

	# ⑤
	check(String(R.call("region_of", "xuchang")) == "zhongyuan" and String(R.call("name_of", "zhongyuan")) == "중원", "⑤ 허창 = 중원")
	for r: Dictionary in regions:
		print("    %s %s 성 %d · 이웃 %s" % [r.id, r.name, sizes[r.id], R.call("neighbors", r.id)])
	_finish()


func _finish() -> void:
	print("PROBE realm_regions %s" % ("OK" if fails == 0 else "FAIL %d" % fails))
	quit(0 if fails == 0 else 1)
