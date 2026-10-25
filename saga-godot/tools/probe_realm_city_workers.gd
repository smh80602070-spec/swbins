extends SceneTree

## G-0392 5천하 눈에 보이는 일꾼(유니티 U-0224 짝) 점검 —
##   godot --headless --path saga-godot --script res://tools/probe_realm_city_workers.gd   → "PROBE realm_city_workers OK" / "FAIL n"
## ① 수: 밭 3·시장 2 → 8 · 치안 20 → 4 · 밭 6·시장 5 → 상한 12 · SAGA_CITY_WORKERS=0 → 0
## ② 길: 성문에서 시작·소품 곁에서 끝 · 끝 둘 말고는 모두 둘레(반지름 RING) 위 — 성벽·망루(반지름 4.6 안)를 안 지난다 · 갈래 셋(밭·시장·곡창)
## ③ 몸: rebuild → 일꾼 8 · 키 0.5m 남짓 · 걷다가 끝에서 돌아서면 짐(자루·상자) · 다시 세우면 몸 다시 씀(줄면 남는 것만 지움)
## ④ 배선: realm_city.gd 가 디오라마 다시 지을 때 rebuild · 밭·시장 자리를 넘김 · 수치 안 바꿈(쓰는 줄 없음).

const W := preload("res://games/saga_realm/world/realm_city_workers.gd")

var fails := 0


func check(cond: bool, msg: String) -> void:
	if cond:
		print("  ok   ", msg)
	else:
		fails += 1
		print("  FAIL ", msg)


func _ring(n: int, r: float, start: float) -> Array:
	var out: Array = []
	for i in n:
		var a := start + float(i) / float(n) * TAU
		out.append(Vector3(cos(a) * r, 0, sin(a) * r))
	return out


func _initialize() -> void:
	await process_frame
	# ①
	var a := W.count(3, 2, 60)
	var b := W.count(3, 2, 20)
	var c := W.count(6, 5, 90)
	OS.set_environment("SAGA_CITY_WORKERS", "0")
	var off := W.count(3, 2, 60)
	OS.set_environment("SAGA_CITY_WORKERS", "")
	check(a == 8 and b == 4 and c == 12 and off == 0, "① 밭3·시장2 → %d · 치안 20 → %d · 상한 %d · 끔 %d" % [a, b, c, off])

	# ②
	var farms := _ring(3, 6.4, -2.0)
	var markets := _ring(2, 5.6, 1.1)
	var gran := Vector3(-6.4, 0, -3.4)
	var rs: Array = W.routes(farms, markets, gran, 8)
	var kinds := {}
	var inside := 0
	var on_ring := true
	for r: Dictionary in rs:
		kinds[String(r.kind)] = true
		var pts: Array = r.pts
		for k in pts.size():
			var p: Vector3 = pts[k]
			if Vector2(p.x, p.z).length() < 4.6:
				inside += 1
			if k > 0 and k < pts.size() - 1 and absf(Vector2(p.x, p.z).length() - W.RING) > 0.01:
				on_ring = false
	var first: Array = rs[0].pts
	check(rs.size() == 8 and kinds.size() == 3 and (first[0] as Vector3).is_equal_approx(W.GATE) and inside == 0 and on_ring,
		"② 길 %d · 갈래 %s · 성 안 점 %d · 가운데 점은 둘레 위" % [rs.size(), str(kinds.keys()), inside])

	# ③
	var stage := Node3D.new()
	root.add_child(stage)
	var wk: Node3D = W.new()
	stage.add_child(wk)
	var n: int = wk.rebuild(farms, markets, gran, 60)
	var w0 := wk.get_node_or_null("Worker0") as Node3D
	var aabb := AABB()
	if w0 != null:
		for g in w0.find_children("*", "VisualInstance3D", true, false):
			var vi := g as VisualInstance3D
			if vi.name != "Sack" and vi.name != "Crate":
				aabb = aabb.merge(vi.global_transform * vi.get_aabb()) if aabb.size != Vector3.ZERO else vi.global_transform * vi.get_aabb()
	var carry0: int = wk.carrying()
	var vis0: Array = []
	for ch in wk.get_children():
		vis0.append((ch.get_node("Sack") as Node3D).visible or (ch.get_node("Crate") as Node3D).visible)
	var start_pos := w0.position if w0 != null else Vector3.ZERO
	for i in 80:
		wk._process(0.5)   # 40초 — 길(9~25m)마다 끝에 닿아 돌아선다
	var flipped := 0
	var kids0 := wk.get_children()
	for k in kids0.size():
		flipped += 1 if ((kids0[k].get_node("Sack") as Node3D).visible or (kids0[k].get_node("Crate") as Node3D).visible) != bool(vis0[k]) else 0
	check(n == 8 and w0 != null and aabb.size.y > 0.3 and aabb.size.y < 0.8 and carry0 == 3 and flipped >= 1 and int(wk.turns) >= 8 and not w0.position.is_equal_approx(start_pos),
		"③ 일꾼 %d · 키 %.2fm · 짐 처음 %d(곡창 길) · 40초에 돌아섬 %d번(짐 바뀐 일꾼 %d) · 움직임" % [n, aabb.size.y, carry0, int(wk.turns), flipped])
	var n2: int = wk.rebuild(farms, markets, gran, 20)
	await process_frame
	var same := wk.get_node_or_null("Worker0") == w0
	var n3: int = wk.rebuild(farms, markets, gran, 60)
	await process_frame
	var kids := 0
	for ch in wk.get_children():
		kids += 1 if String(ch.name).begins_with("Worker") else 0
	check(n2 == 4 and same and n3 == 8 and kids == 8, "③ 다시 세움: 치안 낮음 %d → %d · 몸 다시 씀 · 남는 몸 없음(자식 %d)" % [n2, n3, kids])
	stage.queue_free()

	# ④
	var src := FileAccess.get_file_as_string("res://games/saga_realm/world/realm_city.gd")
	var wsrc := FileAccess.get_file_as_string("res://games/saga_realm/world/realm_city_workers.gd")
	check(src.contains("_workers.call(\"rebuild\", _farm_pts, _market_pts, _granary_pt") and src.contains("_farm_pts.append(") and src.contains("_market_pts.append(")
		and not wsrc.contains("RealmSaveState"), "④ 배선(디오라마 다시 지을 때) · 수치 안 건드림")

	await process_frame
	print("PROBE realm_city_workers ", "OK" if fails == 0 else "FAIL %d" % fails)
	quit(1 if fails > 0 else 0)
