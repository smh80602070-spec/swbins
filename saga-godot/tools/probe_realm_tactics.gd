extends SceneTree

## 사가천하 격자 전술(G-0182, games/saga_realm/data/realm_tactics.gd — 웹 tactics.js 이식) 자동 점검. 화면 없음. 씨앗 고정(20260824).
##   godot --headless --path saga-godot --script res://tools/probe_realm_tactics.gd
## ⓪ 웹 값과 맞춤: 해시 둘 · 판 넷(강·산·평지·구릉)의 칸·자리·양쪽 AI 끝까지 둔 결과가 node 로 돌린 tactics.js 와 같다
## ① 판: 8×6 · 내 편 2·3열 · 적 6·7열 · 강 칸엔 못 섬 · 강 판 건널목 둘 ② 명중 clamp 10~95 · 숲 −30 · 성벽 −50 ③ AI 가 닿으면 친다
## ④ 3턴 뒤 결과 넷 판정식 ⑤ 같은 씨앗 → 같은 판·같은 결과 ⑥ grid 없이 attack = 옛 결과 ⑦ grid lose → 잃는 병력 그대로·rout → 위력·받는 피해
## ⑧ 전사가 로스터에서 빠지고 열전 기록 ⑨ 중상은 3달 명령·출진 못 함 ⑩ 저장 왕복(officer_hurt·annals). 상태는 끝에 되돌린다.
## 끝에 "PROBE realm_tactics OK" 또는 "PROBE realm_tactics FAIL n".

const SAVED := ["gold", "year", "month", "cities", "current_city", "roster", "found", "officer_city", "officer_loyal", "officer_growth", "officer_ambition", "enemies_subverted", "active_events", "events_done",
	"lord_succession_enabled", "current_lord_id", "heir_id", "_succession_shock_until", "enemies", "enemy_officer_loyal", "diplomacy", "city_force", "quiz", "result", "diplomacy_peace_streak",
	"scenario_id", "_done_this_month", "scenario_ready", "viewing_map", "officer_hurt", "annals", "story", "path_override"]
const SEED := 20260824
## node 로 돌린 웹 tactics.js 값(10-11, scratchpad ref.mjs — 같은 stats·mine [m1,m2]·foes [f1,f2]·foeTroops [800])
const WEB_HASH := [["20260824", "c0,0", 0.2874564337544143], ["a|b", "x#3", 0.5516939780209213]]
const WEB_STATS := {"m1": {"might": 80, "wisdom": 90, "command": 70}, "m2": {"might": 95, "wisdom": 40, "command": 85},
	"f1": {"might": 90, "wisdom": 50, "command": 80}, "f2": {"might": 70, "wisdom": 75, "command": 60}}
const WEB_BOARDS := [
	["xiaopei|194|1", "river", true, "pppprpwpppfprpppppppppwppppprppppppprpwppppppppp", "lose", 3, 0, 60, 8, 16],
	["g-0182", "mount", false, "ppfppppppppppfppppppffppppwwpppppppfppppppppwwpp", "lose", 3, 0, 61, 11, 19],
	["s3", "plain", true, "ppppppwpppppppppppppppwppppppfppppppppwpppfpfppp", "lose", 3, 0, 35, 10, 20],
	["s4", "hill", true, "ppfpppwppppfpfppppppppwpppfppppppppfpfwppppppfpp", "draw", 3, 18, 53, 11, 19],
]
const WEB_POS := "me:m1@1,1 me:m2@2,1 foe:f1@6,1 foe:f2@5,1 foe:troop0@6,3"

var fails := 0
var S: Node
var T: GDScript
var Diplo: GDScript


func check(cond: bool, msg: String) -> void:
	if cond:
		print("  ok   ", msg)
	else:
		fails += 1
		print("  FAIL ", msg)


func _reset() -> void:
	S.start_scenario("194")
	S.active_events = []
	S.events_done = {}
	S.lord_succession_enabled = false
	S.current_lord_id = Diplo.LORD_ID
	S.heir_id = ""
	S._succession_shock_until = {}
	S.diplomacy_peace_streak = 0
	S._rng.seed = SEED
	S.gold = 9000
	for cid in S.cities.keys():
		S.cities[cid].troops = maxi(int(S.cities[cid].troops), 2000)
		S.cities[cid].food = maxi(int(S.cities[cid].food), 30000)


func _board_str(b: Dictionary) -> String:
	var s := ""
	for c: String in b.cells:
		s += c.substr(0, 1)
	return s


func _pos_str(b: Dictionary) -> String:
	var parts: Array = []
	for u: Dictionary in b.units:
		parts.append("%s@%d,%d" % [u.uid, u.x, u.y])
	return " ".join(parts)


func _grid(kind: String, fallen: Array = [], wounded: Array = []) -> Dictionary:
	var o: Dictionary = T.OUT[kind]
	return T.apply({"kind": kind, "winPct": o.winPct, "lossMul": o.lossMul, "fallen": fallen, "wounded": wounded}, "xiaopei")


## 같은 시작에서 attack 한 번 — 결과와 출진 성 병력
func _attack_once(troops: int, grid: Dictionary) -> Dictionary:
	_reset()
	S.cities.xuchang.troops = troops
	S.cities.xuchang.train = 10
	S.cities.xuchang.tech = 100
	var at: Dictionary = S.attack("xiaopei", [], grid)
	at["left"] = int(S.cities.xuchang.troops)
	at["enemy_left"] = int(S.enemies.xiaopei.troops)
	return at


func _initialize() -> void:
	await process_frame
	S = root.get_node("RealmSaveState")
	T = load("res://games/saga_realm/data/realm_tactics.gd")
	Diplo = load("res://games/saga_realm/data/realm_diplo.gd")
	var saved := {}
	for v in SAVED:
		var cur: Variant = S.get(v)
		saved[v] = cur.duplicate(true) if (cur is Dictionary or cur is Array) else cur
	var saved_rng_seed: int = S._rng.seed
	var saved_rng_state: int = S._rng.state

	# ⓪ 웹 값과 맞춤
	for h: Array in WEB_HASH:
		check(is_equal_approx(T.hash01(h[0], h[1]), h[2]), "해시(%s, %s) = 웹 %.6f" % [h[0], h[1], h[2]])
	for w: Array in WEB_BOARDS:
		var b: Dictionary = T.make_board(w[0], w[1], w[2])
		T.units_of(b, ["m1", "m2"], ["f1", "f2"], [800], WEB_STATS)
		var cells_ok: bool = _board_str(b) == w[3]
		var pos_ok: bool = _pos_str(b) == WEB_POS
		var o: Dictionary = T.auto_play(b)
		check(cells_ok and pos_ok and o.kind == w[4] and o.turn == w[5] and o.hpMe == w[6] and o.hpFoe == w[7] and (b.log as Array).size() == w[8] and int(b.n) == w[9],
			"웹과 같은 판(%s·%s): 칸 %s·자리 %s·결과 %s 턴 %d hp %d/%d 기록 %d 굴림 %d" % [w[0], w[1], cells_ok, pos_ok, o.kind, o.turn, o.hpMe, o.hpFoe, (b.log as Array).size(), int(b.n)])

	# ① 판
	var br: Dictionary = T.make_board("river-check", "river", true)
	T.units_of(br, ["m1", "m2"], ["f1", "f2"], [800, 600], WEB_STATS)
	var river_cols := {}
	var crossings := 0
	for y in T.ROWS:
		for x in T.COLS:
			if T.cell_at(br, x, y) == "river":
				river_cols[x] = true
	for rx: int in river_cols.keys():
		for y in T.ROWS:
			if T.cell_at(br, rx, y) != "river":
				crossings += 1
	var sides_ok := true
	for u: Dictionary in br.units:
		var col_ok: bool = (int(u.x) >= 1 and int(u.x) <= 2) if u.side == "me" else (int(u.x) >= 5 and int(u.x) <= 6)
		sides_ok = sides_ok and col_ok and T.cell_at(br, int(u.x), int(u.y)) != "river" and T.cell_at(br, int(u.x), int(u.y)) != "wall"
	check((br.cells as Array).size() == 48 and T.cell_at(br, 8, 0) == "" and T.cell_at(br, -1, 0) == "" and sides_ok, "판 8×6 · 밖은 빈 칸 · 내 편 2·3열 · 적 6·7열(0부터 1·2 / 5·6) · 강·성벽 위엔 안 섬")
	check(river_cols.size() == 1 and crossings == 2, "강 판: 세로 강 한 줄 · 건널목 둘(%d)" % crossings)
	var mv: Array = T.moves(br, "me:m1")
	var mv_ok := true
	for c: Dictionary in mv:
		mv_ok = mv_ok and T.cell_at(br, int(c.x), int(c.y)) != "river" and absi(int(c.x) - 1) + absi(int(c.y) - 1) <= 3
	check(mv.size() > 1 and mv_ok and not T.move(br, "me:m1", 7, 5) and T.move(br, "me:m1", 1, 2) and T.moves(br, "me:m1").size() == 1, "이동: mov 3 안·강 못 지남 · 먼 칸 거절 · 한 번 움직이면 제자리만")
	# ② 명중
	var att := {"atk": 30.0}
	check(T.hit_chance(att, {"def": 0.0}, 0) == 95 and T.hit_chance({"atk": 0.0}, {"def": 40.0}, 0) == 10 and T.hit_chance({"atk": 20.0}, {"def": 10.0}, 0) == 85
		and T.hit_chance({"atk": 20.0}, {"def": 10.0}, T.COVER.forest) == 55 and T.hit_chance({"atk": 20.0}, {"def": 10.0}, T.COVER.wall) == 35, "명중 clamp 10~95 · 65+(atk−def)×2 · 숲 −30 · 성벽 −50")
	# ③ AI 가 닿으면 친다
	var ba: Dictionary = T.make_board("ai", "plain", false)
	T.units_of(ba, ["m1"], ["f1"], [800], WEB_STATS)
	var me_u: Dictionary = T.unit(ba, "me:m1")
	var foe_u: Dictionary = T.unit(ba, "foe:f1")
	foe_u.x = int(me_u.x) + 1
	foe_u.y = int(me_u.y)
	T.ai_turn(ba)
	var logged: Array = ba.log
	check(logged.size() >= 1 and String(logged[0].a) == "foe:f1" and String(logged[0].to) == "me:m1", "적 AI: 닿는 내 장수를 친다")
	# ④ 결과 넷
	var bo: Dictionary = T.make_board("out", "plain", false)
	T.units_of(bo, ["m1"], ["f1"], [800], WEB_STATS)
	for u: Dictionary in bo.units:
		if u.side == "foe":
			u.hp = 0.0
	var o_rout: Dictionary = T.outcome(bo)
	var bl: Dictionary = T.make_board("out2", "plain", false)
	T.units_of(bl, ["m1"], ["f1"], [800], WEB_STATS)
	T.unit(bl, "me:m1").hp = 0.0
	var o_lose: Dictionary = T.outcome(bl)
	var bw: Dictionary = T.make_board("out3", "plain", false)
	T.units_of(bw, ["m1"], ["f1"], [800], WEB_STATS)
	bw.turn = T.TURNS + 1
	for u: Dictionary in bw.units:
		if u.side == "foe":
			u.hp = float(u.max) * 0.5
	var o_win: Dictionary = T.outcome(bw)
	var bd: Dictionary = T.make_board("out4", "plain", false)
	T.units_of(bd, ["m1"], ["f1"], [800], WEB_STATS)
	bd.turn = T.TURNS + 1
	var o_draw: Dictionary = T.outcome(bd)
	var bn: Dictionary = T.make_board("out5", "plain", false)
	T.units_of(bn, ["m1"], ["f1"], [800], WEB_STATS)
	check(o_rout.kind == "rout" and o_rout.winPct == 25 and is_equal_approx(o_rout.lossMul, 0.7) and o_lose.kind == "lose" and o_lose.fallen == ["m1"] and o_win.kind == "win" and o_draw.kind == "draw"
		and T.outcome(bn).is_empty(), "결과 넷: 적 전멸 대승 · 내 전멸 패(전사 m1) · 3턴 뒤 비율 2.0 승 · 1.0 무승부 · 안 끝났으면 빈 값")
	T.permadeath = false
	var o_wound: Dictionary = T.outcome(bl)
	T.permadeath = true
	var ap: Dictionary = T.apply(o_wound, "xiaopei")
	check(o_wound.fallen.is_empty() and o_wound.wounded == ["m1"] and ap.wounded == [{"id": "m1", "months": 3}] and ap.where == "xiaopei", "영구 전사를 끄면 중상(3달)")
	# ⑤ 결정성
	var b1: Dictionary = T.make_board("same", "hill", true)
	T.units_of(b1, ["m1", "m2"], ["f1"], [900, 500], WEB_STATS)
	var r1: Dictionary = T.auto_play(b1)
	var b2: Dictionary = T.make_board("same", "hill", true)
	T.units_of(b2, ["m1", "m2"], ["f1"], [900, 500], WEB_STATS)
	var r2: Dictionary = T.auto_play(b2)
	check(_board_str(b1) == _board_str(b2) and r1 == r2 and str(b1.log) == str(b2.log), "같은 씨앗 → 같은 판·같은 기록·같은 결과(%s)" % r1.kind)

	# ⑥ grid 없이 attack = 옛 결과(같은 시작 두 번)
	var a0: Dictionary = _attack_once(2000, {})
	var a1: Dictionary = _attack_once(2000, {})
	check(a0.ok and a0.won == a1.won and a0.left == a1.left and a0.enemy_left == a1.enemy_left and a0.loss_a == a1.loss_a and not a0.has("grid") and not a0.has("fallen"), "grid 없음: 같은 시작 → 같은 결과·돌려받는 키도 옛 그대로(남은 병력 %d·적 %d)" % [a0.left, a0.enemy_left])
	# ⑦ 보정
	var g_draw: Dictionary = _attack_once(2000, _grid("draw"))
	check(g_draw.won == a0.won and g_draw.left == a0.left and g_draw.enemy_left == a0.enemy_left, "draw(위력 ×1·피해 ×1) = 보정 없음과 같은 수")
	var g_lose: Dictionary = _attack_once(2000, _grid("lose"))
	var g_rout: Dictionary = _attack_once(2000, _grid("rout"))
	check(not g_lose.won and int(g_lose.loss_d) < int(a0.loss_d) and int(g_rout.loss_d) > int(a0.loss_d), "lose → 적에게 준 피해 줄어듦(%d<%d) · rout → 늘어남(%d)" % [g_lose.loss_d, a0.loss_d, g_rout.loss_d])
	print("  잰값 2000 출진 — 보정 없음 잃음 %d · 패 %d · 대승 %d" % [a0.loss_a, g_lose.loss_a, g_rout.loss_a])
	# ⑧ 전사
	_reset()
	S.cities.xuchang.troops = 2000
	var hero := String(S.roster[0])
	var at_dead: Dictionary = S.attack("xiaopei", [], _grid("lose", [hero]))
	check(at_dead.ok and at_dead.fallen == [hero] and not (hero in S.roster) and not S.officer_city.has(hero) and S.annals.has(hero) and S.annals[hero].where == "xiaopei" and S.annals[hero].by == "bei", "전사: 로스터·배치에서 빠지고 열전에 (어디 소패 · 누구 bei)")
	_reset()
	S.cities.xuchang.troops = 2000
	S.roster.append(S.current_lord_id)
	S.officer_city[S.current_lord_id] = "xuchang"
	var lord: String = S.current_lord_id
	S.attack("xiaopei", [], _grid("lose", [lord]))
	check(lord in S.roster and int(S.officer_hurt.get(lord, 0)) == 3 and not S.annals.has(lord), "군주가 쓰러지면 전사 대신 중상 3달")
	# ⑨ 중상 3달
	_reset()
	S.cities.xuchang.troops = 2000
	var at_hurt: Dictionary = S.attack("xiaopei", [], _grid("lose", [], [hero]))
	var blocked := 0
	for m in 3:
		S.next_month()
		S.cities.xuchang.troops = maxi(int(S.cities.xuchang.troops), 2000)
		if int(S.officer_hurt.get(hero, 0)) > 0 and not S.execute_order("agri").ok:
			blocked += 1
	check(at_hurt.hurt == [hero] and blocked == 2 and not S.officer_hurt.has(hero) and S.execute_order("agri").ok, "중상: 다음 두 달 명령 못 함 · 셋째 달에 나음(막힌 달 %d)" % blocked)
	# ⑩ 저장 왕복
	_reset()
	S.officer_hurt = {hero: 2}
	S.annals = {"zz": {"year": 194, "month": 3, "where": "xiaopei", "by": "bei"}}
	S.path_override = "user://probe_realm_tactics_save.json"
	var saved_ok: bool = S.save()
	S.officer_hurt = {}
	S.annals = {}
	var loaded_ok: bool = S.try_load()
	check(saved_ok and loaded_ok and int(S.officer_hurt.get(hero, 0)) == 2 and S.annals.has("zz") and int(S.annals.zz.month) == 3, "저장 왕복: 중상·열전")
	DirAccess.remove_absolute(ProjectSettings.globalize_path("user://probe_realm_tactics_save.json"))
	# tactics_board / tactics_auto
	_reset()
	S.cities.xuchang.troops = 2000
	var tb: Dictionary = S.tactics_board("xiaopei")
	var ta: Dictionary = S.tactics_auto("xiaopei")
	check(tb.ok and (tb.board.units as Array).size() >= 4 and String(tb.officer) == hero and ta.has("kind") and ta.has("winPct"), "tactics_board: 내 장수 %s + 적(수비 장수·부대) %d · tactics_auto → %s" % [tb.officer, (tb.board.units as Array).size() - 1, ta.get("kind", "?")])

	# G-0183 화면 ① 광선 → 칸 ② 판을 열고 아무것도 안 한 채 턴 끝 ×3 = 규칙만 돌린 결과 ③ 물러나기 = 빈 보정
	var View: GDScript = load("res://games/saga_realm/world/realm_tactics_view.gd")
	var c00: Vector3 = View.cell_center(0, 0)
	var c75: Vector3 = View.cell_center(7, 5)
	var down := Vector3(0, -1, 0)
	var o: Vector3 = View.ORIGIN
	check(View.ray_to_cell(c00 + Vector3(0, 10, 0), down, o) == Vector2i(0, 0) and View.ray_to_cell(c75 + Vector3(0, 10, 0), down, o) == Vector2i(7, 5)
		and View.ray_to_cell(o + Vector3(-8.01, 10, 0), down, o) == Vector2i(-1, -1) and View.ray_to_cell(o + Vector3(-7.99, 10, 0), down, o).x == 0
		and View.ray_to_cell(o + Vector3(7.99, 10, 5.99), down, o) == Vector2i(7, 5) and View.ray_to_cell(o + Vector3(0, 10, 6.01), down, o) == Vector2i(-1, -1)
		and View.ray_to_cell(o + Vector3(0, 10, 0), Vector3(0, 1, 0), o) == Vector2i(-1, -1)
		and View.ray_to_cell(o + Vector3(0, 10, 10), Vector3(0, -10, -10).normalized(), o) == Vector2i(4, 3), "광선 → 칸: 모서리 (0,0)·(7,5) · 판 밖·위를 보면 (-1,-1) · 비스듬히 칸 (4,3)")
	_reset()
	S.cities.xuchang.troops = 2000
	var tb2: Dictionary = S.tactics_board("xiaopei")
	var shadow: Dictionary = (tb2.board as Dictionary).duplicate(true)
	var guard2 := 0
	while T.outcome(shadow).is_empty() and guard2 < 10:
		guard2 += 1
		T.ai_turn(shadow)
	var expect: Dictionary = T.apply(T.outcome(shadow), "xiaopei")
	var got := {"grid": null}
	var view: Node = View.open(root, "xiaopei", tb2, func(g: Dictionary) -> void: got.grid = g, true)
	await process_frame
	var bodies := 0
	for u: Dictionary in tb2.board.units:
		if view._units.has(String(u.uid)):
			bodies += 1
	for k in 6:
		if got.grid != null:
			break
		await view._on_end_turn()
	var g2: Variant = got.grid
	check(bodies == (tb2.board.units as Array).size() and g2 != null and String(g2.kind) == String(expect.kind) and g2.fallen == expect.fallen and int(g2.winPct) == int(expect.winPct) and g2.mine == tb2.mine,
		"판을 열고 턴 끝만 → 규칙만 돌린 결과와 같다(%s · 유닛 몸 %d · 함께 선 장수 %s)" % [expect.kind, bodies, str(tb2.mine)])
	await process_frame
	_reset()
	S.cities.xuchang.troops = 2000
	var got2 := {"grid": null}
	var view2: Node = View.open(root, "xiaopei", S.tactics_board("xiaopei"), func(g: Dictionary) -> void: got2.grid = g, true)
	await process_frame
	view2._on_cancel()
	await process_frame
	check(got2.grid is Dictionary and (got2.grid as Dictionary).is_empty() and not is_instance_valid(view2), "물러나기 → 빈 보정(그냥 출진)·판 닫힘")
	S.cities.xuchang.troops = 100
	var tb3: Dictionary = S.tactics_board("xiaopei")
	check(not tb3.ok and "오백" in String(tb3.why) and S.attack_check("xiaopei") == String(tb3.why), "판을 열기 전에 attack 과 같은 이유로 거절(%s)" % tb3.why)

	# 되돌리기
	for v in SAVED:
		S.set(v, saved[v])
	S._rng.seed = saved_rng_seed
	S._rng.state = saved_rng_state
	print("PROBE realm_tactics ", "OK" if fails == 0 else "FAIL %d" % fails)
	quit(1 if fails > 0 else 0)
