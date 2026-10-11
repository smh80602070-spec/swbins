extends Node
## G-0195 1만리 사냥 의뢰 흔적 자동 점검 — 평소엔 안 붙는다. test_village.gd 가 SAGA_TRAIL_PROBE 가 있을 때만 단다.
##   SAGA_TRAIL_PROBE=1 "$GODOT" --headless --path saga-godot res://games/saga_go/world/TestVillage.tscn
## ① 흔적 자리: 결정적(두 번 = 같음) · 여섯 종 다 나옴 · 걸을 수 있는 칸만 · 지역마다 몫(≈0.42) · 재미 표준 E(네 지역 걸을 칸 중 흔적 없는 칸 %)
## ② 읽기: 같은 날 셋 → 그 지역 들판 보스 · 넷째는 새 보스 없음 · 같은 흔적 두 번 안 됨 · 실제 노드에서 곁에 서서 읽기
## ③ 날이 바뀌면 새로 ④ 사냥: 다른 보스면 없음 · 부위 3 = 작은 광석 12·중간 2 · 하루 한 번
## ⑤ 미니맵 표식·목표판 "지금" 줄 · 들판 보스 boss_died 신호 → 가방에 광석. 상태·가방은 끝에 되돌린다. 끝에 TRAIL_PROBE_DONE fails=N.

const Trail := preload("res://games/saga_go/data/trail.gd")
const TestMap := preload("res://games/saga_go/data/test_map.gd")
const TerrainBuilder := preload("res://games/saga_go/world/terrain_builder.gd")

var _fails := 0


func _check(name: String, ok: bool, detail: String) -> void:
	if ok:
		print("TRAIL_PROBE ok   ", name, " — ", detail)
	else:
		_fails += 1
		print("TRAIL_PROBE FAIL ", name, " — ", detail)


func _frames(n: int) -> void:
	for i in n:
		await get_tree().physics_frame


func _ready() -> void:
	_run.call_deferred()


func _run() -> void:
	await _frames(10)
	var saved_trail: Dictionary = PartyState.trail.duplicate(true)
	var s0: int = PartyState.count("ore_s")
	var m0: int = PartyState.count("ore_m")
	# ①
	var a := Trail.all_cells()
	var b := Trail.all_cells()
	var same := a.size() == b.size()
	for i in mini(a.size(), b.size()):
		same = same and String(a[i].key) == String(b[i].key) and (a[i].pos as Vector3).is_equal_approx(b[i].pos)
	var kinds := {}
	var walk_ok := true
	for c: Dictionary in a:
		kinds[String(c.kind)] = true
		var gp := TestMap.grid_at(String(c.region), c.pos)
		walk_ok = walk_ok and bool(TerrainBuilder.LEGEND[TestMap.tile_at(gp.x, gp.y, String(c.region))].walkable)
	_check("자리", same and kinds.size() == 6 and walk_ok and a.size() > 20, "흔적 %d · 결정적 · 여섯 종 %s · 걸을 수 있는 칸만" % [a.size(), str(kinds.keys())])
	var lines: Array = []
	var walk_total := 0
	for r: String in Trail.REGION_KINDS.keys():
		var sz := TestMap.size(r)
		var w := 0
		for y in sz.y:
			for x in sz.x:
				var t := TestMap.tile_at(x, y, r)
				if bool(TerrainBuilder.LEGEND[t].walkable) and t != "H" and t != "B":
					w += 1
		walk_total += w
		lines.append("%s %d/%d" % [r, Trail.cells(r).size(), w])
	var empty_pct := 100.0 * (1.0 - float(a.size()) / float(maxi(1, walk_total)))
	print("TRAIL_PROBE 잰값 지역 흔적/걸을 칸 %s · 흔적 없는 걸을 칸 %.0f%%(재미 표준 E — 1차 목표 ≤60%%, 웹 W-0101 은 ≤50%% 를 다른 셈으로)" % [", ".join(lines), empty_pct])
	_check("몫", empty_pct > 40.0 and empty_pct < 75.0, "흔적 없는 칸 %.0f%%(몫 0.42 → 약 58%%)" % empty_pct)
	# ②
	var st := {}
	var day := 1000
	var vc: Array = Trail.cells("village")
	var r1 := Trail.read(st, day, String(vc[0].key), "village")
	var r1b := Trail.read(st, day, String(vc[0].key), "village")
	Trail.read(st, day, String(vc[1].key), "village")
	var r3 := Trail.read(st, day, String(vc[2].key), "village")
	var r4 := Trail.read(st, day, String(vc[3].key), "village")
	_check("셋 읽기", bool(r1.ok) and not bool(r1b.ok) and String(r3.boss) == "gale_roc" and String(r4.boss) == "" and String(st.boss) == "gale_roc", "셋째에 마을 들판 보스(gale_roc) · 같은 흔적 두 번 안 됨 · 넷째는 새 보스 없음")
	# ③
	Trail.ensure_day(st, day + 1)
	_check("하루", (st.read as Array).is_empty() and String(st.boss) == "" and not bool(st.done), "날이 바뀌면 읽은 것·큰 짐승이 새로")
	# ④
	for k in 3:
		Trail.read(st, day + 1, String(vc[k].key), "village")
	var wrong := Trail.on_kill(st, day + 1, "tide_turtle", 3)
	var right := Trail.on_kill(st, day + 1, "gale_roc", Trail.parts_of(true, true))
	var again := Trail.on_kill(st, day + 1, "gale_roc", 3)
	_check("사냥", wrong.is_empty() and int(right.get("ore_s", 0)) == 12 and int(right.get("ore_m", 0)) == 2 and again.is_empty(), "다른 보스 없음 · 부위 3 = 작은 광석 12·중간 2 · 하루 한 번")
	# ⑤ 실제 노드
	var tn := get_tree().get_first_node_in_group("go_trail")
	var pl := get_tree().get_first_node_in_group("player") as Node3D
	if tn == null or pl == null:
		_check("노드", false, "Trail·플레이어 노드를 못 찾음")
	else:
		PartyState.trail = {}
		var picked := 0
		for c: Dictionary in tn.cells:
			if String(c.region) != "village" or picked >= 3:
				continue
			pl.global_position = (c.pos as Vector3) + Vector3(0.5, 0.3, 0)
			tn.call("tick")
			if String(tn.near_key) == String(c.key):
				tn.call("read_near")
				picked += 1
		var marks: Array = tn.call("map_marks")
		var line := String(tn.call("now_line"))
		get_parent().call("_refresh_goal_board")
		var board := get_tree().get_first_node_in_group("goal_board")
		var board_now := String(board.get("now_line")) if board != null else ""
		_check("노드 읽기", picked == 3 and String(tn.call("hunted")) == "gale_roc" and marks.size() == 1 and String(marks[0].kind) == "trail_track" and line.begins_with("🐾 큰 짐승을 쫓는다"),
			"곁에 서서 셋 읽음 → 큰 짐승 · 미니맵 표식 trail_track · 목표 줄 \"%s\"" % line)
		var tut := get_tree().get_first_node_in_group("go_tutorial")
		var tut_on := tut != null and bool(tut.call("active"))
		_check("목표판", tut_on or board_now == line, "목표판 지금 줄 = 흔적 줄(안내가 켜져 있으면 안내가 먼저 — 지금 %s)" % ("안내 켜짐" if tut_on else "\"" + board_now + "\""))
		var fb := get_tree().get_first_node_in_group("go_field_bosses")
		fb.emit_signal("boss_died", "gale_roc", null)
		_check("보스 신호", PartyState.count("ore_s") == s0 + 4 and PartyState.count("ore_m") == m0 + 2 and String(tn.call("hunted")) == "", "들판 보스 쓰러짐 신호 → 부위 1 · 작은 광석 +4 · 중간 +2 · 사냥 끝(목표 줄 사라짐)")
	# 되돌리기
	var extra_s: int = PartyState.count("ore_s") - s0
	var extra_m: int = PartyState.count("ore_m") - m0
	if extra_s > 0 or extra_m > 0:
		PartyState.spend_items({"ore_s": maxi(0, extra_s), "ore_m": maxi(0, extra_m)})
	PartyState.trail = saved_trail
	print("TRAIL_PROBE_DONE fails=%d" % _fails)
	get_tree().quit()
