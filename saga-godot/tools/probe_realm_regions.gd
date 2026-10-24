extends SceneTree
## G-0347 ① 5천하 지역 묶음 점검(화면 없음) —
##   godot --headless --path saga-godot --script res://tools/probe_realm_regions.gd   → "PROBE realm_regions OK" / "FAIL n"
## ① 성 107 전부 한 지역 ② 지역마다 성 1~12(첫 화면 ≤ 12) ③ 이웃 대칭·자기 자신 없음 ④ 고립 지역 없음(길로 다 이어짐)
## ⑤ 허창(옛 기본 성)은 중원 · 이름 표
## ⑥ 지도(TestCity): 지금 지역 성표만 보임 · 지역 바꾸면 거르기·화살표(이웃 수)·초점 ⑦ 천하도 카드 글 ⑧ view_region 저장 왕복 ⑨ SAGA_REALM_SRPG=0 → 안 붙음

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

	# ⑥
	var sc := (load("res://games/saga_realm/world/TestCity.tscn") as PackedScene).instantiate()   # check_refs:allow — 5천하 대표 씬
	root.add_child(sc)
	current_scene = sc
	for _i in 20:
		await process_frame
	var rs: Node = root.get_node("/root/RealmSaveState")
	rs.set("scenario_ready", true)
	rs.set("view_region", "")
	rs.set("viewing_map", true)
	for _i in 10:
		await process_frame
	var wm := sc.get_node("WorldMap")
	var rv := get_first_node_in_group("realm_region_view")
	var cur_r := String(R.call("region_of", String(rs.get("current_city"))))
	var markers: Dictionary = wm.get("_markers")
	var vis_ok := markers.size() > 0
	for cid: String in markers:
		if (markers[cid] as Node3D).visible != (String(R.call("region_of", cid)) == cur_r):
			vis_ok = false
	check(rv != null and String(rv.call("region")) == cur_r and vis_ok, "⑥ 첫 지도 = 지금 성 지역 %s · 성표 %d 중 그 지역만 보임" % [cur_r, markers.size()])
	rs.set("view_region", "hebei")
	for _i in 5:
		await process_frame
	var hidden_all := true
	for cid: String in markers:
		if String(R.call("region_of", cid)) != "hebei" and (markers[cid] as Node3D).visible:
			hidden_all = false
	var arrows := rv.find_children("Arrow_*", "", false, false).filter(func(n: Node) -> bool: return not n.is_queued_for_deletion())
	var fc: Vector3 = rv.call("focus")
	var want: Vector3 = load("res://games/saga_realm/world/realm_region_view.gd").call("center", "hebei")
	check(hidden_all and arrows.size() == (R.call("neighbors", "hebei") as Array).size() and fc.is_equal_approx(want), "⑥ 하북으로 — 다른 지역 숨김 · 화살표 %d · 초점 지역 가운데" % arrows.size())

	# ⑦
	var ct := String(rv.call("card_text", "hebei"))
	check(ct.begins_with("● 하북 · 성 6"), "⑦ 천하도 카드 「%s」" % ct)

	# ⑧
	var old_path := String(rs.get("path_override"))
	rs.set("path_override", "user://probe_realm_regions.json")
	rs.set("view_region", "kr")
	rs.call("save")
	rs.set("view_region", "")
	rs.call("try_load")
	var back := String(rs.get("view_region"))
	DirAccess.remove_absolute(ProjectSettings.globalize_path("user://probe_realm_regions.json"))
	rs.set("path_override", old_path)
	check(back == "kr", "⑧ view_region 저장 왕복 %s" % back)

	# ⑨
	OS.set_environment("SAGA_REALM_SRPG", "0")
	check(load("res://games/saga_realm/world/realm_region_view.gd").call("attach", Node3D.new()) == null, "⑨ SAGA_REALM_SRPG=0 → 안 붙음")
	OS.set_environment("SAGA_REALM_SRPG", "")
	rs.set("view_region", "")
	rs.set("viewing_map", false)
	_finish()


func _finish() -> void:
	print("PROBE realm_regions %s" % ("OK" if fails == 0 else "FAIL %d" % fails))
	quit(0 if fails == 0 else 1)
