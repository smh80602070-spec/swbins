extends SceneTree

## G-0088 사가천하 이야기 1막(games/saga_realm/data/scenario.gd·world/scenario_runner.gd) 자동 점검 — 세이브 파일을 쓰지 않는다(효과는 메모리에서만).
##   godot --headless --path saga-godot --script res://tools/probe_scenario_realm.gd
## ① 표: 카드 셋 id 정본(r1_start·r1_rift_sign·r1_first_ally) · 시대 섞기 셋 · 고르기 셋(atk·def·util) · fx 종류가 엔진이 아는 것 · 실제 사건 이름 없음 · 설전 단계 모양
## ② 때: 지난 달 계산(194년 1월 = 0, 195년 1월 = 12) · 첫 카드 바로 · 둘째 12달 · 셋째 24달 또는 성 5 · 표 순서대로 하나씩
## ③ 고르기: 답 저장·다음 카드 · 첫 화친 "def" 만 설전 단계 · 설전 맞힌 수 2 → win(우호 +15·금 +300), 1 → lose
## ④ 엔진 효과(새 판 194 메모리): 금·수도 치안(100 상한)·훈련·군량·책사 충성·이웃 우호 · {책사}·{이웃} 칸이 도감 가명으로 채워짐
## ⑤ 엔진·realm_city 컴파일 · 세이브 칸 story 가 start_scenario 에서 비워짐
## 끝에 "PROBE scenario_realm OK" 또는 "PROBE scenario_realm FAIL n".

var fails := 0


func check(cond: bool, msg: String) -> void:
	if cond:
		print("  ok   ", msg)
	else:
		fails += 1
		print("  FAIL ", msg)


func _initialize() -> void:
	await process_frame
	var S: GDScript = load("res://games/saga_realm/data/scenario.gd")
	check(S != null, "scenario.gd 를 불러옴")
	if S == null:
		_end()
		return

	# ① 표
	var ids: Array = S.CARDS.map(func(c): return String(c.id))
	check(ids == ["r1_start", "r1_rift_sign", "r1_first_ally"], "카드 셋 id 정본 %s" % [ids])
	var bad: Array = []
	for c: Dictionary in S.CARDS:
		for era in ["past", "now", "future"]:
			if String((c.mix as Dictionary).get(era, "")) == "":
				bad.append("%s 시대 %s" % [c.id, era])
		var ks: Array = (c.choices as Array).map(func(o): return String(o.k))
		if ks != ["atk", "def", "util"]:
			bad.append("%s 고르기 %s" % [c.id, ks])
		for o: Dictionary in c.choices:
			for f: Dictionary in o.fx:
				if not S.FX_KINDS.has(String(f.t)):
					bad.append("%s fx %s" % [c.id, f.t])
		for word in ["적벽대전", "관도대전", "조조", "유비", "손권"]:
			if String(c.text).contains(word):
				bad.append("%s 실명/사건 %s" % [c.id, word])
	for sid in S.STAGES:
		var sg: Dictionary = S.STAGES[sid]
		if String(sg.kind) != "debate" or not sg.has("win") or not sg.has("lose") or String(sg.get("on", "")) == "":
			bad.append("단계 %s" % sid)
	check(bad.is_empty(), "표 규칙 %s" % [bad])

	# ② 때
	check(S.elapsed("194", 194, 1) == 0 and S.elapsed("194", 195, 1) == 12 and S.elapsed("200", 202, 3) == 26, "지난 달 계산")
	var st: Dictionary = S.fresh()
	check(S.due(st, 0, 3) and String(S.next_card(st).id) == "r1_start", "첫 카드 바로")
	S.pick(st, "def")
	check(not S.due(st, 11, 3) and S.due(st, 12, 3), "둘째 카드 12달")
	check(S.objective(st, 5, 3).contains("7달 뒤"), "목표판 \"%s\"" % S.objective(st, 5, 3))
	S.pick(st, "util")
	check(not S.due(st, 20, 4) and S.due(st, 20, 5) and S.due(st, 24, 3), "셋째 카드 24달 또는 성 5")

	# ③ 고르기·설전
	var r: Dictionary = S.pick(st, "atk")
	check((r.stage as Dictionary).is_empty() and S.finished(st), "선전 포고는 설전 없음 · 1막 끝")
	var st2: Dictionary = S.normalize({"next": 2, "done": ["r1_start", "r1_rift_sign"], "picks": {}, "debate": {}})
	var r2: Dictionary = S.pick(st2, "def")
	check(String((r2.stage as Dictionary).get("kind", "")) == "debate", "화친 → 설전 단계")
	var win: Dictionary = S.debate_outcome(st2, "r1_first_ally", 2)
	var lose: Dictionary = S.debate_outcome(S.fresh(), "r1_first_ally", 1)
	check(String(win.hint).contains("+15") and String(lose.hint).contains("-5") and int((st2.debate as Dictionary).r1_first_ally) == 2, "설전 2 맞힘 win · 1 lose")
	check(st.picks == {"r1_start": "def", "r1_rift_sign": "util", "r1_first_ally": "atk"} and (st.done as Array).size() == 3, "고른 답 저장 %s" % [st.picks])

	# ④ 엔진 효과(메모리)
	var rs: Node = root.get_node_or_null("RealmSaveState")
	var R: GDScript = load("res://games/saga_realm/world/scenario_runner.gd")
	check(rs != null and R != null and R.can_instantiate(), "RealmSaveState·scenario_runner.gd")
	if rs != null and R != null:
		rs.call("start_scenario", "194")
		check((rs.get("story") as Dictionary).is_empty(), "start_scenario 가 story 를 비움")
		var run: Node = R.new()
		root.add_child(run)
		var cap: String = run.call("capital")
		var nm: Dictionary = run.call("names")
		check(cap != "" and String(nm.get("책사", "")) != "" and String(nm.get("이웃", "")) != "이웃 군주", "수도 %s · 책사 %s · 이웃 %s" % [cap, nm.get("책사", ""), nm.get("이웃", "")])
		var g0: int = int(rs.get("gold"))
		var city: Dictionary = (rs.get("cities") as Dictionary)[cap]
		city.sec = 95
		var tr0 := int(city.get("train", 0))
		var fd0 := int(city.get("food", 0))
		var sid: String = run.call("strategist_id")
		var loy0 := int((rs.get("officer_loyal") as Dictionary).get(sid, 50))
		var nb: String = run.call("neighbor_city")
		var fid: String = rs.call("force_of", nb)
		var rel0 := int(((rs.get("diplomacy") as Dictionary).get(fid, {"relation": 40}) as Dictionary).get("relation", 40))
		run.call("apply_fx", [{"t": "gold", "n": 500}, {"t": "sec", "n": 8}, {"t": "train", "n": 5}, {"t": "food", "n": 1500}, {"t": "loyal", "n": 3}, {"t": "rel", "n": 25}])
		var rel1 := int(((rs.get("diplomacy") as Dictionary).get(fid, {}) as Dictionary).get("relation", -1))
		check(int(rs.get("gold")) == g0 + 500 and int(city.sec) == 100 and int(city.train) == tr0 + 5 and int(city.food) == fd0 + 1500
			and int((rs.get("officer_loyal") as Dictionary).get(sid, 0)) == mini(100, loy0 + 3) and rel1 == mini(100, rel0 + 25),
			"효과 — 금·치안(상한 100)·훈련·군량·충성·우호(%d→%d, 세력 %s)" % [rel0, rel1, fid])
		check(S.fill("{책사} 와 {이웃}", nm) == "%s 와 %s" % [nm["책사"], nm["이웃"]], "칸 채우기")
		run.queue_free()

	# ⑤ 컴파일
	var city_gd: GDScript = load("res://games/saga_realm/world/realm_city.gd")
	check(city_gd != null and city_gd.can_instantiate(), "realm_city.gd 컴파일(엔진 배선)")
	_end()


func _end() -> void:
	print("PROBE scenario_realm %s" % ("OK" if fails == 0 else "FAIL %d" % fails))
	quit(0 if fails == 0 else 1)
