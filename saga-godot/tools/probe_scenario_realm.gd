extends SceneTree

## G-0088 사가천하 이야기 1막(games/saga_realm/data/scenario.gd·world/scenario_runner.gd) 자동 점검 — 세이브 파일을 쓰지 않는다(효과는 메모리에서만).
##   godot --headless --path saga-godot --script res://tools/probe_scenario_realm.gd
## ① 표: 카드 셋 id 정본(r1_start·r1_rift_sign·r1_first_ally) · 시대 섞기 셋 · 고르기 셋(atk·def·util) · fx 종류가 엔진이 아는 것 · 실제 사건 이름 없음 · 설전 단계 모양
## ② 때: 지난 달 계산(194년 1월 = 0, 195년 1월 = 12) · 첫 카드 바로 · 둘째 12달 · 셋째 24달 또는 성 5 · 표 순서대로 하나씩
## ③ 고르기: 답 저장·다음 카드 · 첫 화친 "def" 만 설전 단계 · 설전 맞힌 수 2 → win(우호 +15·금 +300), 1 → lose
## ④ 엔진 효과(새 판 194 메모리): 금·수도 치안(100 상한)·훈련·군량·책사 충성·이웃 우호 · {책사}·{이웃} 칸이 도감 가명으로 채워짐
## ②-2 G-0092 2막: 하늘에서 떨어진 사람들(36달·성 8) → 관도 결전(48·10, 성 차지 단계 — 단계 동안 다음 카드 쉼, 성 하나 더 → win·기한 → lose) → 논객의 설전(60·12, 아무 답이나 설전)
## ②-3 G-0096 3막: 항법사가 본 강(72달·성 15, 재야 인재) → 적벽 강 위(84·18, 성 차지) → 의체 무사의 일기토(96·20 — 예물은 일기토 없음, 정면·정중은 일기토), 일기토 이김 = 재야 인재·짐 = 효과 없음
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
	check(ids == ["r1_start", "r1_rift_sign", "r1_first_ally", "r2_fallen", "r2_plains", "r2_debate", "r3_navigator", "r3_river", "r3_duel"], "카드 아홉 id 정본 %s" % [ids])
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
		if not (String(sg.kind) in ["debate", "own", "duel"]) or not sg.has("win") or not sg.has("lose") or (not (sg.get("on", "") is Array) and String(sg.get("on", "")) == ""):
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
	check((r.stage as Dictionary).is_empty() and String(S.next_card(st).id) == "r2_fallen", "선전 포고는 설전 없음 · 1막 끝 → 2막")

	# ②-2 2막
	check(not S.due(st, 35, 7) and S.due(st, 36, 3) and S.due(st, 30, 8), "하늘에서 떨어진 사람들 36달 또는 성 8")
	var rf: Dictionary = S.pick(st, "atk")
	check((rf.stage as Dictionary).is_empty() and String((rf.choice.fx as Array)[0].t) == "recruitFree", "강서 고르기 = 재야 인재 합류")
	check(S.due(st, 48, 3) and not S.due(st, 47, 9), "관도 결전 48달 또는 성 10")
	var rp: Dictionary = S.pick(st, "def")
	check(String((rp.stage as Dictionary).get("kind", "")) == "own", "관도 결전 → 성 차지 단계(아무 답)")
	S.start_own(st, "r2_plains", 48, 5)
	check(not S.due(st, 70, 20), "단계 동안 다음 카드 쉼")
	check(S.objective(st, 50, 5).contains("2달") == false and S.objective(st, 50, 5).contains("8달 남음"), "단계 목표판 \"%s\"" % S.objective(st, 50, 5))
	check(S.own_status(st, 50, 5) == "", "성 그대로 · 기한 전 → 아직")
	check(S.own_status(st, 52, 6) == "win" and (st.stage as Dictionary).is_empty() and String(st.own.r2_plains) == "win", "성 하나 더 → 이김, 단계 닫힘")
	var lose_st: Dictionary = S.normalize({"next": 5, "stage": {}})
	S.start_own(lose_st, "r2_plains", 48, 5)
	check(S.own_status(lose_st, 58, 5) == "lose", "열 달 지나면 짐")
	check(S.due(st, 60, 3), "논객의 설전 60달")
	var rd: Dictionary = S.pick(st, "util")
	check(String((rd.stage as Dictionary).get("kind", "")) == "debate" and String(S.next_card(st).id) == "r3_navigator", "논객의 설전 → 설전(아무 답) · 2막 끝 → 3막")

	# ②-3 3막
	check(not S.due(st, 71, 14) and S.due(st, 72, 3) and S.due(st, 60, 15), "항법사가 본 강 72달 또는 성 15")
	var rn: Dictionary = S.pick(st, "util")
	check((rn.stage as Dictionary).is_empty() and String((rn.choice.fx as Array)[0].t) == "recruitFree", "궤도 고르기 = 재야 인재")
	check(S.due(st, 84, 3) and S.due(st, 80, 18), "적벽 강 위 84달 또는 성 18")
	var rr: Dictionary = S.pick(st, "atk")
	check(String((rr.stage as Dictionary).get("kind", "")) == "own", "적벽 → 성 차지 단계")
	S.start_own(st, "r3_river", 84, 18)
	check(S.own_status(st, 94, 18) == "lose" and String(st.own.r3_river) == "lose", "열 달 동안 성 그대로 → 짐")
	check(S.due(st, 96, 3), "의체 무사의 일기토 96달")
	var st_b: Dictionary = st.duplicate(true)
	var ru: Dictionary = S.pick(st, "util")
	check((ru.stage as Dictionary).is_empty() and S.finished(st), "예물 → 일기토 없음 · 3막 끝")
	var ra: Dictionary = S.pick(st_b, "atk")
	check(String((ra.stage as Dictionary).get("kind", "")) == "duel", "정면 → 일기토")
	var w3: Dictionary = S.duel_outcome(st_b, "r3_duel", true)
	var l3: Dictionary = S.duel_outcome(S.fresh(), "r3_duel", false)
	check(String((w3.fx as Array)[0].t) == "recruitFree" and (l3.fx as Array).is_empty() and String(st_b.duel.r3_duel) == "win", "일기토 이김 → 재야 인재 · 짐 → 효과 없음")
	check(S.fill("{맹장}", {"맹장": "가명"}) == "가명", "{맹장} 칸")
	var dw: Dictionary = S.debate_outcome(st, "r2_debate", 2)
	check((dw.fx as Array).any(func(x): return String(x.t) == "quiz" and int(x.n) == 20), "설전 이김 → 문화 문답 +20")
	var st2: Dictionary = S.normalize({"next": 2, "done": ["r1_start", "r1_rift_sign"], "picks": {}, "debate": {}})
	var r2: Dictionary = S.pick(st2, "def")
	check(String((r2.stage as Dictionary).get("kind", "")) == "debate", "화친 → 설전 단계")
	var win: Dictionary = S.debate_outcome(st2, "r1_first_ally", 2)
	var lose: Dictionary = S.debate_outcome(S.fresh(), "r1_first_ally", 1)
	check(String(win.hint).contains("+15") and String(lose.hint).contains("-5") and int((st2.debate as Dictionary).r1_first_ally) == 2, "설전 2 맞힘 win · 1 lose")
	check(st.picks == {"r1_start": "def", "r1_rift_sign": "util", "r1_first_ally": "atk", "r2_fallen": "atk", "r2_plains": "def", "r2_debate": "util", "r3_navigator": "util", "r3_river": "atk", "r3_duel": "util"} and (st.done as Array).size() == 9, "고른 답 저장 %s" % [st.picks])

	# ④ 엔진 효과(메모리)
	var rs: Node = root.get_node_or_null("RealmSaveState")
	var R: GDScript = load("res://games/saga_realm/world/scenario_runner.gd")
	check(rs != null and R != null and R.can_instantiate(), "RealmSaveState·scenario_runner.gd")
	if rs != null and R != null:
		rs.call("start_scenario", "194")
		check((rs.get("story") as Dictionary).is_empty(), "start_scenario 가 story 를 비움")
		var run: Node = R.new()
		run.set("save_enabled", false)   # 세이브 파일을 쓰지 않는다
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
		var ros0: int = (rs.get("roster") as Array).size()
		var got: String = run.call("recruit_free", 5)
		check((got != "" and (rs.get("roster") as Array).size() == ros0 + 1 and (rs.get("roster") as Array).has(got) and String((rs.get("officer_city") as Dictionary).get(got, "")) == cap) or got == "",
			"재야 등용 %s(roster %d→%d)" % [got, ros0, (rs.get("roster") as Array).size()])
		var q0 := int((rs.get("quiz") as Dictionary).get("correct", 0))
		run.call("apply_fx", [{"t": "quiz", "n": 20}])
		check(int((rs.get("quiz") as Dictionary).get("correct", 0)) == q0 + 20, "문화 문답 +20")
		var champ: String = run.call("champion_id")
		check(champ != "" and String(run.call("names").get("맹장", "")) != "", "{맹장} %s" % run.call("names").get("맹장", ""))
		var W: GDScript = load("res://games/saga_realm/data/realm_war.gd")
		var win_pair := ["", ""]
		for a in W.DUEL_MOVES:
			for b in W.DUEL_MOVES:
				if W.duel_round_result(a, b) == "win":
					win_pair = [a, b]
		run.set("_duel_card", "r3_duel")
		run.set("_duel_round", 1)
		check(run.call("duel_step", "slash", "slash") == "", "일기토 비김 → 다음 수")
		var ros1: int = (rs.get("roster") as Array).size()
		var dr: String = run.call("duel_step", win_pair[0], win_pair[1])
		check(dr == "win" and ((rs.get("roster") as Array).size() == ros1 + 1 or (rs.get("roster") as Array).size() == ros1), "일기토 이김 %s 대 %s → %s" % [win_pair[0], win_pair[1], dr])
		run.set("_duel_round", 5)
		check(run.call("duel_step", "guard", "guard") == "lose", "다섯 수 다 비기면 짐")
		run.queue_free()

	# ⑤ 컴파일
	var city_gd: GDScript = load("res://games/saga_realm/world/realm_city.gd")
	check(city_gd != null and city_gd.can_instantiate(), "realm_city.gd 컴파일(엔진 배선)")
	_end()


func _end() -> void:
	print("PROBE scenario_realm %s" % ("OK" if fails == 0 else "FAIL %d" % fails))
	quit(0 if fails == 0 else 1)
