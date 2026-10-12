extends SceneTree

## G-0213 공용 패시브 그물 엔진·화면(saga_core/data/passive_web.gd · saga_core/ui/passive_web_screen.gd) 자동 점검 — 웹 test.mjs ①~⑧ 의 고돗판.
##   godot --headless --path saga-godot --script res://tools/probe_passive_web.gd
## ① 4종횡 정의 크기(마디 ≥300·이름난 ≥40·규칙 ≥8·시작점 5) ② 시작점마다 모든 마디에 닿음(다른 시작점 안 지남)·id/간선 온전
## ③ 시작점 없음·이웃 아님·점수 없음·다른 시작점 거절, 이웃은 찍힘 ④ 끊기는 되돌리기 거절·잎 허용 ⑤ 정의 두 번 읽기 같음·생성 머리 줄
## ⑥ path_to 비용 = 길이 · take_path · 웹 엔진과 같은 비용(무사 시작 — 웹 node 로 뽑은 값) ⑦ sum·has·store JSON 왕복·되돌리면 규칙 꺼짐(웹과 같은 합)
## ⑧ 낡은 store 정리 ⑨ 화면 — 열면 멈춤·카드·찍기 단추·검색·Esc 로 닫히면 멈춤 풀림.
## 끝에 "PROBE passive_web OK" 또는 "PROBE passive_web FAIL n".

const DEF_PATH := "res://games/saga_story/data/passive_def.json"
## 웹 saga-web/shared/js/passive-web.js 로 같은 정의에서 뽑은 값(10-12) — 무사 시작, 점수 60
const WEB_COSTS := {"n_first_step": 23, "n_lesson": 18, "n_war_rhythm": 16, "k_biyeon": 45, "k_cheolgak": 41}
const WEB_AFTER_BIYEON := {"left": 15, "atkPct": 20.0, "hpPct": 3.0, "movePct": 20.0}

var fails := 0
var PW: GDScript
var pts := 60


func check(cond: bool, msg: String) -> void:
	if cond:
		print("  ok   ", msg)
	else:
		fails += 1
		print("  FAIL ", msg)


func make(store: Dictionary, d: Dictionary) -> RefCounted:
	return PW.new(d, store, func() -> int: return pts)


func _initialize() -> void:
	await process_frame
	PW = load("res://saga_core/data/passive_web.gd")
	var d: Dictionary = PW.load_def(DEF_PATH)
	var nodes: Array = d.get("nodes", [])
	var cnt := {"s": 0, "n": 0, "k": 0, "o": 0}
	for nd: Dictionary in nodes:
		cnt[String(nd.k)] = int(cnt.get(String(nd.k), 0)) + 1
	check(nodes.size() >= 300 and cnt.n >= 40 and cnt.k >= 8 and cnt.o == 5 and (d.starts as Array).size() == 5,
		"① 마디 %d(작은 %d·이름난 %d·규칙 %d·시작점 %d) · 간선 %d" % [nodes.size(), cnt.s, cnt.n, cnt.k, cnt.o, (d.edges as Array).size()])

	# ② 닿음·온전
	var api0: RefCounted = make({}, d)
	var adj: Array = api0.adjacency()
	var ids := {}
	var dup := false
	for nd: Dictionary in nodes:
		dup = dup or ids.has(String(nd.id))
		ids[String(nd.id)] = true
	var edge_ok := true
	for e: Array in d.edges:
		edge_ok = edge_ok and e[0] != e[1] and e[0] >= 0 and e[1] >= 0 and e[0] < nodes.size() and e[1] < nodes.size()
	var reach_bad: Array = []
	for i in nodes.size():
		if String(nodes[i].k) != "o":
			continue
		var seen := {i: true}
		var q: Array = [i]
		var head := 0
		while head < q.size():
			var a: int = q[head]
			head += 1
			for b: int in adj[a]:
				if seen.has(b) or String(nodes[b].k) == "o":
					continue
				seen[b] = true
				q.append(b)
		if seen.size() - 1 != nodes.size() - cnt.o:
			reach_bad.append(String(nodes[i].id))
	check(not dup and edge_ok and reach_bad.is_empty(), "② 시작점 다섯이 다 모든 마디에 닿음 · id 겹침 없음 · 간선 온전 %s" % [reach_bad])

	# ③ 거절·찍힘
	var st: Dictionary = {}
	var api: RefCounted = make(st, d)
	var nb: String = api.neighbors("o_warrior").filter(func(x): return String(api.node(x).k) != "o")[0]
	var no_start: bool = api.why(nb) == "nostart"
	var took_start: bool = api.take("o_warrior") and st.start == "warrior"
	var other: bool = api.why("o_archer") == "start"
	var far_id := ""
	for nd: Dictionary in nodes:
		if String(nd.k) != "o" and not api.can_take(String(nd.id)):
			far_id = String(nd.id)
			break
	var far_rej: bool = api.why(far_id) == "far"
	pts = 0
	var no_pts: bool = api.why(nb) == "points"
	pts = 60
	var nb_ok: bool = api.take(nb) and api.is_taken(nb) and api.left() == 59
	check(no_start and took_start and other and far_rej and no_pts and nb_ok,
		"③ 시작점 없음·다른 시작점·이웃 아님(%s)·점수 없음 거절 · 이웃 %s 찍힘(남은 %d)" % [far_id, nb, api.left()])

	# ④ 끊김 — 시작점 곁 이웃은 다 시작점에 붙어 있어, 먼 이름난 마디까지 길째 찍고 그 길 위에서 본다
	var st4: Dictionary = {}
	var a4: RefCounted = make(st4, d)
	a4.take("o_warrior")
	var p4: Array = (a4.path_to("n_war_rhythm") as Dictionary).get("path", [])
	a4.take_path("n_war_rhythm")
	var mid := ""
	for x: String in p4:
		if not a4.can_drop(x):
			mid = x
			break
	var leaf: String = p4[p4.size() - 1] if not p4.is_empty() else ""
	var mid_rej: bool = mid != "" and not a4.drop(mid) and a4.is_taken(mid)
	var leaf_ok: bool = leaf != "" and a4.can_drop(leaf) and a4.drop(leaf) and not a4.is_taken(leaf)
	check(mid_rej and leaf_ok, "④ 길 %d마디 중 %s 되돌리기 거절(뒤가 끊김) · 끝 %s 는 되돌림" % [p4.size(), mid, leaf])

	# ⑤ 두 번 읽기
	var d2: Dictionary = PW.load_def(DEF_PATH)
	check(JSON.stringify(d2) == JSON.stringify(PW.load_def(DEF_PATH)) and String(d2.get("_from", "")).contains("passive_from_web.mjs") and int(d2.v) == 1,
		"⑤ 정의 두 번 읽기 같음 · 생성 머리 줄 · v 1")

	# ⑥ 경로 — 웹과 같은 비용
	var st6: Dictionary = {}
	var a6: RefCounted = make(st6, d)
	a6.take("o_warrior")
	var costs := {}
	var len_ok := true
	for id: String in WEB_COSTS:
		var p: Dictionary = a6.path_to(id)
		costs[id] = int(p.get("cost", -1))
		len_ok = len_ok and int(p.get("cost", -1)) == (p.get("path", []) as Array).size()
	check(costs == WEB_COSTS and len_ok, "⑥ 무사 시작 경로 비용 %s = 웹 · 비용 = 길이" % [costs])

	# ⑦ sum·has·왕복
	var took: bool = a6.take_path("k_biyeon")
	var sums := {"left": a6.left(), "atkPct": a6.sum("atkPct"), "hpPct": a6.sum("hpPct"), "movePct": a6.sum("movePct")}
	var has_rule: bool = a6.has("biyeon")
	var saved := JSON.stringify(st6)
	var st7: Dictionary = JSON.parse_string(saved)
	var a7: RefCounted = make(st7, d)
	var round_ok: bool = a7.has("biyeon") and is_equal_approx(a7.sum("movePct"), a6.sum("movePct")) and a7.left() == a6.left()
	var dropped: bool = a7.drop("k_biyeon") and not a7.has("biyeon")
	check(took and has_rule and sums == WEB_AFTER_BIYEON and round_ok and dropped,
		"⑦ 비연 길째 찍기 · 합 %s = 웹 · JSON 왕복 같음 · 비연 되돌리면 규칙 꺼짐" % [sums])

	# ⑧ 낡은 store
	var dirty := {"start": "warrior", "taken": ["없는마디", nb, nb, far_id, "o_archer"]}
	make(dirty, d)
	var bad_start := {"start": "모르는별", "taken": [nb]}
	make(bad_start, d)
	check(dirty.taken == [nb] and bad_start.start == null and (bad_start.taken as Array).is_empty(),
		"⑧ 낡은 store 정리 → %s · 모르는 시작점은 비움" % [dirty.taken])

	# ⑨ 화면
	var Screen: GDScript = load("res://saga_core/ui/passive_web_screen.gd")
	var stage := Node.new()
	root.add_child(stage)
	var st9: Dictionary = {}
	var a9: RefCounted = make(st9, d)
	var closed := [false]
	var scr: CanvasLayer = Screen.open(stage, a9, {"title": "점검", "on_close": func() -> void: closed[0] = true})
	await process_frame
	var paused_open := paused
	scr.select("o_warrior")
	var btn_start: String = scr._card_btn.text
	scr._on_card_btn()
	scr.select(nb)
	var btn_take: String = scr._card_btn.text
	var card_on: bool = scr._card.visible
	scr._on_card_btn()
	var took9: bool = a9.is_taken(nb)
	scr._search.text = "비연"
	scr.board.set_search("비연")
	var found: int = scr.board.hits.size()
	var ev := InputEventAction.new()
	ev.action = "ui_cancel"
	ev.pressed = true
	scr._unhandled_input(ev)
	await process_frame
	check(paused_open and btn_start == "여기서 시작" and card_on and btn_take == "찍기 (경로 1점)" and took9 and found >= 1
		and closed[0] and not paused and not is_instance_valid(scr),
		"⑨ 열면 멈춤 · \"%s\" → \"%s\" 눌러 찍힘 · 검색 비연 %d곳 · Esc 로 닫힘·멈춤 풀림" % [btn_start, btn_take, found])

	print("PROBE passive_web OK" if fails == 0 else "PROBE passive_web FAIL %d" % fails)
	quit(1 if fails > 0 else 0)
