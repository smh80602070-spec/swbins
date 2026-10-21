extends SceneTree

## G-0288 발밑 금테 자동 점검 —
##   godot --headless --path saga-godot --script res://tools/probe_rank_ring.gd   → "PROBE rank_ring OK" / "FAIL n"
## ① build(1~6) 도형 수가 단마다 늘어남(1·1·2·3·9·15) ② set_rank 같은 단이면 같은 노드 · 0 이면 지움
## ③ 1만리 씬: 지금 몸 편성원 승급을 3 으로 → growth_changed → RankRing 단 3 · 되돌리면 0(지움). 세이브는 안 함.
## ④ 4종횡 씬(G-0289): job = general(2차, 무사 갈래) → job_changed → 단 2·붉은 테 · 되돌리면 지움.

const RankRing := preload("res://saga_core/world/rank_ring.gd")
const WANT := [0, 1, 1, 2, 3, 9, 15]

var fails := 0


func _fail(msg: String) -> void:
	fails += 1
	print("  FAIL ", msg)


func _init() -> void:
	await process_frame
	for r in range(1, 7):
		var n := RankRing.build(r)
		if n.get_child_count() != WANT[r]:
			_fail("① 단 %d 도형 %d != %d" % [r, n.get_child_count(), WANT[r]])
		n.free()
	var body := Node3D.new()
	root.add_child(body)
	var a := RankRing.set_rank(body, 2)
	if RankRing.set_rank(body, 2) != a:
		_fail("② 같은 단인데 다시 지음")
	RankRing.set_rank(body, 0)
	await process_frame
	if body.get_node_or_null(RankRing.NAME) != null:
		_fail("② 0 인데 남음")
	body.queue_free()
	## ③
	var sc := (load("res://games/saga_go/world/TestVillage.tscn") as PackedScene).instantiate()
	root.add_child(sc)
	current_scene = sc
	for _i in 30:
		await process_frame
	var pl := get_first_node_in_group("player")
	var ps := root.get_node("/root/PartyState")
	var id: String = pl.get("_body_id")
	if id == "":
		var mem: Array = ps.get("members")
		id = mem[0] if not mem.is_empty() else ""
	var gr: Dictionary = ps.get("growth")
	var had := gr.has(id)
	var g: Dictionary = gr.get(id, {"lv": 1, "exp": 0.0, "asc": 0})
	var asc0 := int(g.get("asc", 0))
	g["asc"] = 3
	gr[id] = g
	ps.emit_signal("growth_changed", id)
	var ring := pl.get_node_or_null(RankRing.NAME)
	if ring == null or int(ring.get_meta("rank", -1)) != 3:
		_fail("③ 승급 3 인데 금테 %s" % [ring.get_meta("rank", -1) if ring else "없음"])
	g["asc"] = asc0
	if not had:
		gr.erase(id)
	ps.emit_signal("growth_changed", id)
	await process_frame
	var r2 := pl.get_node_or_null(RankRing.NAME)
	if asc0 == 0 and r2 != null and not r2.is_queued_for_deletion():
		_fail("③ 되돌려 0 인데 금테 남음")
	print("RANK id=%s asc0=%d" % [id, asc0])
	sc.queue_free()
	await process_frame
	## ④
	var ss := (load("res://games/saga_story/world/SinyaField.tscn") as PackedScene).instantiate()
	root.add_child(ss)
	current_scene = ss
	for _i in 30:
		await process_frame
	var sp := get_first_node_in_group("player")
	var st := root.get_node("/root/StorySaveState")
	var job0: String = st.get("job")
	st.set("job", "general")
	st.emit_signal("job_changed", "general")
	var jr := sp.get_node_or_null(RankRing.NAME)
	if jr == null or int(jr.get_meta("rank", -1)) != 2 or (jr.get_meta("tint") as Color).r < 0.9:
		_fail("④ 2차 무사인데 표식 %s" % [jr.get_meta("rank", -1) if jr else "없음"])
	st.set("job", job0)
	st.emit_signal("job_changed", job0)
	print("JOB job0=%s" % job0)
	print("PROBE rank_ring ", "OK" if fails == 0 else "FAIL %d" % fails)
	quit(1 if fails > 0 else 0)
