extends SceneTree

## 사가국지 상태 규칙(RealmSaveState = realm_rules·realm_rules_war·realm_rules_month 상속 사슬) 자동 점검 — 화면 없이 명령·문답·전쟁·외교·계략·편입·월 진행·승리·야망·이벤트·계승을 돌려 본다. 씨앗 고정(20260824).
##   godot --headless --path saga-godot --script res://tools/probe_realm_state.gd
## ① 시나리오 셋(194·200·208): 성 3·8·19 · 적 성 수 · 군웅 덮어쓰기 · 금 2000+성×400 · 모르는 시나리오는 무시
## ② 명령: 금 차감·한 달 한 번(같은 무장)·상한·징병은 인구↔병력 보존·조선은 강가만·수색→등용 · 성장(경험치·승급 비용·탐욕 보상) · 전임(인접·한 달 한 번)
## ③ 문답: 260문항 표(분야 6·키 유일·정답 범위) · 처음 맞히면 학습+상금·복습은 적은 상금·틀리면 연속 0·학식이 차면 재야가 드러남 · 설전 3문항 배율(0 → 0.8 … 3 → 1.3)
## ④ 전쟁·편입: 목표 검사(맹약·500 미만·군량·장수) · 이기면 성이 편입(병력·군량·무장·공적) · 지면 퇴각 병력 복귀 · 외교(화친 비용·성공 +12/실패 +2·조공 +5) · 계략 4(들통/성공 결과가 규칙 안)
## ⑤ 월 진행: 수입 = 상업×배율 − 유지비 · 수확 달에만 군량 · 치안 -1 · 인구 하한 · 재해 만료 · 12월 → 다음 해 · 적 AI 출진 확률(0.2×성향)·맹약이면 안 침 · 적 내정 순서
## ⑥ 승리 셋(천하통일·문화·화친)·우선순위·결과가 나면 달이 안 감 · 야망 여섯 진행·달성 보상·좌절 · 이탈 확률 · 이벤트 체인 · 계승(후계 지정·충성 충격·야심 가중). 상태는 끝에 되돌린다.
## 끝에 "PROBE realm_state OK" 또는 "PROBE realm_state FAIL n".

const SAVED := ["gold", "year", "month", "cities", "current_city", "roster", "found", "officer_city", "officer_loyal", "officer_growth", "officer_ambition", "enemies_subverted", "active_events", "events_done",
	"lord_succession_enabled", "current_lord_id", "heir_id", "_succession_shock_until", "enemies", "enemy_officer_loyal", "diplomacy", "city_force", "quiz", "result", "diplomacy_peace_streak",
	"scenario_id", "_done_this_month", "scenario_ready", "viewing_map"]
const SEED := 20260824

var fails := 0
var S: Node
var Cities: GDScript
var Orders: GDScript
var Traits: GDScript
var Diplo: GDScript
var Quiz: GDScript
var Chars: GDScript


func check(cond: bool, msg: String) -> void:
	if cond:
		print("  ok   ", msg)
	else:
		fails += 1
		print("  FAIL ", msg)


func _reset(scenario: String = "194") -> void:
	S.start_scenario(scenario)
	S.active_events = []
	S.events_done = {}
	S.lord_succession_enabled = false
	S.current_lord_id = Diplo.LORD_ID
	S.heir_id = ""
	S._succession_shock_until = {}
	S.diplomacy_peace_streak = 0
	S._rng.seed = SEED


func _with_trait(key: String, skip: Array = []) -> String:
	for h in Chars.HEROES:
		var id := String(h.id)
		if id != "sg_zhugeliang" and not skip.has(id) and Traits.has_trait(id, key):
			return id
	return ""


func _hit(id: String) -> int:  # 계승 때 충성 변화 — 충직 0 · 야심 -25 · 그 밖 -15
	if Traits.has_trait(id, "loyal_heart"):
		return 0
	return -25 if Traits.has_trait(id, "ambitious") else -15


func _fund() -> void:
	S.gold = 9000
	for cid in S.cities.keys():
		S.cities[cid].troops = maxi(int(S.cities[cid].troops), 2000)
		S.cities[cid].food = maxi(int(S.cities[cid].food), 30000)


func _initialize() -> void:
	await process_frame
	S = root.get_node("RealmSaveState")
	Cities = load("res://games/saga_realm/data/realm_cities.gd")
	Orders = load("res://games/saga_realm/data/realm_orders.gd")
	Traits = load("res://games/saga_realm/data/realm_traits.gd")
	Diplo = load("res://games/saga_realm/data/realm_diplo.gd")
	Quiz = load("res://games/saga_realm/data/realm_quiz_data.gd")
	Chars = load("res://saga_core/data/characters.gd")
	var saved := {}
	for v in SAVED:
		var cur: Variant = S.get(v)
		saved[v] = cur.duplicate(true) if (cur is Dictionary or cur is Array) else cur
	var saved_rng_seed: int = S._rng.seed
	var saved_rng_state: int = S._rng.state

	# ① 시나리오
	_reset("194")
	check(S.cities.size() == 3 and S.enemies.size() == 104 and S.year == 194 and S.month == 1 and S.gold == 2000 + 3 * 400 and S.roster == ["sg_zhugeliang"] and S.current_city == "xuchang" and S.result == "" and S.cities.xuchang.troops == 0, "시나리오 194: 성 3 · 적 104 · 금 3200 · 시작 무장 제갈량 허창")
	var forces194 := {}
	for k in S.city_force:
		forces194[S.city_force[k]] = true
	check(S.force_of("xiaopei") == "bei" and S.lord_of("xiaopei") == "sg_liubei" and S.diplomacy.has("bei") and S.diplomacy.bei == {"relation": 40, "truce_months": 0} and S.force_of("zzz") == "" and S.lord_of("zzz") == "", "군웅·군주·외교 초기값(우호 40·맹약 0)")
	_reset("200")
	var xp200: bool = S.cities.has("xiaopei") and S.cities.has("luoyang")
	check(S.cities.size() == 8 and S.enemies.size() == 104 - 5 and S.year == 200 and S.gold == 2000 + 8 * 400 and xp200 and int(S.cities.luoyang.troops) > 0 and S.force_of("jixian") == "shao" and S.force_of("jianye") == "quan" and S.force_of("runan") == "bei" and not S.enemies.has("xiaopei"), "시나리오 200: 성 8(소패·낙양 포함·병력 있음) · 적 99 · 군웅 덮어쓰기(기주→원소·건업→손권·여남→유비)")
	_reset("208")
	check(S.cities.size() == 19 and S.enemies.size() == 104 - 16 and S.gold == 2000 + 19 * 400 and S.force_of("jiangxia") == "bei" and S.force_of("tianshui") == "chao" and S.diplomacy.has("chao") and not S.diplomacy.has("teng"), "시나리오 208: 성 19 · 적 88 · 유표 소멸→유비 · 마등→마초")
	S.start_scenario("999")
	check(S.scenario_id == "208" and S.cities.size() == 19, "모르는 시나리오는 무시(그대로)")

	# ② 명령
	_reset()
	var g0: int = S.gold
	var r: Dictionary = S.execute_order("agri")
	var ag: int = S.cities.xuchang.agri
	check(not S.execute_order("zzz").ok and r.ok and r.officer == "sg_zhugeliang" and S.gold == g0 - 60 and ag == 400 + int(r.amount) and r.amount >= 3 and S._done_this_month.sg_zhugeliang, "개간: 금 -60 · 개간 +%d · 그 무장은 이번 달 끝" % int(r.amount))
	var g1: int = S.gold
	var r2: Dictionary = S.execute_order("comm")
	check(not r2.ok and S.gold == g1, "같은 달에 같은 무장은 또 못 씀(금 불변)")
	var gr: Dictionary = S.officer_growth.sg_zhugeliang
	check(gr.feats == 1 and gr.exp == 4 and S.officer_loyal.sg_zhugeliang == Diplo.base_loyal("sg_zhugeliang") + 1, "명령을 쓰면 공 +1 · 경험치 +4 · 충성 +1")
	S._done_this_month.clear()
	S.cities.xuchang.agri = 899
	var rc: Dictionary = S.execute_order("agri")
	check(rc.amount == 1 and S.cities.xuchang.agri == 900, "상한(900)에서 멈춤 — 오른 만큼만(+1)")
	S._done_this_month.clear()
	S.gold = 10
	check(not S.execute_order("agri").ok and S.gold == 10, "금이 모자라면 거절(금 불변)")
	S.gold = 9000
	check(not S.execute_order("ships").ok and S.cities.xuchang.ships == 0, "조선은 물길 없는 성(허창)에서 불가")
	S.current_city = "puyang"
	S.officer_city.sg_zhugeliang = "puyang"
	var sh: Dictionary = S.execute_order("ships")
	check(sh.ok and S.cities.puyang.ships > 60, "조선은 강가 성(복양)에서 가능 · 배 +%d" % int(sh.amount))
	S.current_city = "xuchang"
	S.officer_city.sg_zhugeliang = "xuchang"
	S._done_this_month.clear()
	S.cities.xuchang.pop = 100000
	S.cities.xuchang.troops = 0
	var total_before: int = S.cities.xuchang.pop + S.cities.xuchang.troops
	var dr: Dictionary = S.execute_order("draft")
	check(dr.ok and dr.amount > 0 and S.cities.xuchang.pop + S.cities.xuchang.troops == total_before and S.cities.xuchang.troops == dr.amount and S.cities.xuchang.troops <= int(100000 * 0.06), "징병: 인구가 병력으로 옮겨감(합계 보존 · 인구 6%% 이내) +%d" % int(dr.amount))
	S._done_this_month.clear()
	S.cities.xuchang.pop = 6000
	S.cities.xuchang.troops = 400
	var dr2: Dictionary = S.execute_order("draft")
	check(dr2.ok and dr2.amount == 0 and S.cities.xuchang.troops == 400, "인구 대비 병력이 이미 차면 더 못 뽑음")
	# 수색·등용
	_reset()
	S.current_city = "chenliu"
	S.officer_city.sg_zhugeliang = "chenliu"
	var se: Dictionary = S.execute_order("search")
	check(se.ok and se.found == "jp_musashi" and S.found == ["jp_musashi"], "수색: 그 성의 재야를 찾아냄(진류 → 숨은 인재)")
	var hired := false
	var tries := 0
	while not hired and tries < 300:
		tries += 1
		S._done_this_month.clear()
		S.gold = 9000
		var hr: Dictionary = S.execute_order("hire", 1.3)
		hired = String(hr.get("hired", "")) != ""
	check(hired and S.roster.has("jp_musashi") and S.found.is_empty() and S.officer_city.jp_musashi == "chenliu" and S.officer_loyal.jp_musashi == Diplo.base_loyal("jp_musashi", S.current_lord_id) and S._done_this_month.jp_musashi, "등용: 영입되면 로스터·그 성 배치·충성 기본값·그 달은 일 안 함(%d번째 시도)" % tries)
	S._done_this_month.clear()
	S.gold = 9000
	var se2: Dictionary = S.execute_order("search")
	check(se2.ok and se2.found == "" and S.found.is_empty(), "찾을 재야가 없으면 아무 일 없음")
	# 성장
	_reset()
	S._growth("sg_zhugeliang")
	var gx: Dictionary = S.gain_exp("sg_zhugeliang", 27)
	var gy: Dictionary = S.gain_exp("sg_zhugeliang", 1)
	check(gx.levels == 0 and gy.levels == 1 and S.officer_growth.sg_zhugeliang.lv == 2 and S.officer_growth.sg_zhugeliang.exp == 0 and S.gain_exp("zzz", 10).gained == 0 and S.gain_exp("sg_zhugeliang", 0).gained == 0, "경험치 28 에서 레벨 2 · 모르는 인물·0 은 무시")
	S.officer_growth.sg_zhugeliang.lv = 29
	S.gain_exp("sg_zhugeliang", 99999)
	check(S.officer_growth.sg_zhugeliang.lv == 30 and S.officer_growth.sg_zhugeliang.exp == 0 and S.gain_exp("sg_zhugeliang", 50).gained == 0, "레벨 30 이 끝")
	S.officer_growth.sg_zhugeliang.feats = 5
	var pc: Dictionary = S.promote_check("sg_zhugeliang")
	check(not pc.ok and not S.promote_check("zzz").ok and not S.promote_check("sg_caocao").ok, "승급: 공이 모자라면 거절 · 없는 무장·재야도 거절")
	S.officer_growth.sg_zhugeliang.feats = 25
	S.gold = 200
	check(not S.promote("sg_zhugeliang").ok and S.officer_growth.sg_zhugeliang.rank == 0, "금이 모자라면 거절")
	S.gold = 1000
	var l_before: int = S.officer_loyal.sg_zhugeliang
	var pr: Dictionary = S.promote("sg_zhugeliang")
	check(pr.ok and pr.rank == 1 and S.gold == 700 and S.officer_growth.sg_zhugeliang.feats == 5 and S.officer_loyal.sg_zhugeliang == l_before + (18 if Traits.has_trait("sg_zhugeliang", "greedy") else 12) and pr.name == "교위(校尉)", "승급: 공 20·금 300 을 내고 교위가 됨 · 충성 +12")
	S.officer_growth.sg_zhugeliang.rank = 5
	check(not S.promote("sg_zhugeliang").ok, "계급 끝(도독)에서 더 못 올림")
	var greedy := _with_trait("greedy")
	S.roster.append(greedy)
	S.officer_city[greedy] = "xuchang"
	S.officer_loyal[greedy] = 40
	S._growth(greedy).feats = 30
	S.gold = 2000
	S.promote(greedy)
	check(greedy != "" and S.officer_loyal[greedy] == 40 + 18, "탐욕 특성은 승급 충성 보상 ×1.5(+18)")
	# 전임
	_reset()
	check(not S.transfer_officer("sg_caocao", "chenliu").ok and not S.transfer_officer("sg_zhugeliang", "xuchang").ok and not S.transfer_officer("sg_zhugeliang", "puyang").ok and S.transfer_officer("sg_zhugeliang", "chenliu").ok and S.officer_city.sg_zhugeliang == "chenliu" and not S.transfer_officer("sg_zhugeliang", "xuchang").ok, "전임: 로스터 밖·같은 성·맞닿지 않은 성(허창→복양)은 거절 · 인접이면 이동하고 그 달은 끝")

	# ③ 문답
	var qids := {}
	var qok: bool = Quiz.BANK.size() == 260 and Quiz.CATS.size() == 6
	var per_cat := {}
	var cat_keys := {}
	for c in Quiz.CATS:
		cat_keys[c.key] = true
	for ref: Dictionary in Quiz.BANK:
		qids[ref.id] = true
		per_cat[ref.cat] = int(per_cat.get(ref.cat, 0)) + 1
		qok = qok and (ref.c as Array).size() == 4 and int(ref.a) >= 0 and int(ref.a) < 4 and [1, 2, 3].has(Quiz.lv_of(ref)) and cat_keys.has(ref.cat) and String(ref.q) != "" and String(ref.why) != ""
		var uc := {}
		for t in ref.c:
			uc[t] = true
		qok = qok and uc.size() == 4
	check(qok and qids.size() == 260 and per_cat == {"hist": 50, "idiom": 50, "sense": 50, "mz": 50, "world": 30, "proverb": 30}, "문답 260: 키 유일 · 선택지 넷(겹침 없음) · 정답 범위 · 분야별 50·50·50·50·30·30 %s" % str(per_cat))
	check(Quiz.lv_of({"lv": 3}) == 3 and Quiz.lv_of({}) == 1 and Quiz.lv_of({"lv": 9}) == 1 and Quiz.cat_name("hist") != "hist" and Quiz.cat_name("zzz") == "zzz" and Quiz.short_q("가".repeat(30)).length() == 26 and Quiz.short_q("짧은 문제") == "짧은 문제" and Quiz.LORE_PER_FIND == 6, "lv_of·cat_name·short_q·학식 6")
	_reset()
	var p1: Dictionary = S.quiz_draw()
	var ord_ok: bool = (p1.order as Array).size() == 4 and (p1.order as Array).duplicate().size() == 4
	var os := (p1.order as Array).duplicate()
	os.sort()
	check(os == [0, 1, 2, 3] and p1.lv == 1 and p1.choices.size() == 4 and not p1.review and Quiz.by_id(p1.id).c[p1.order[0]] == p1.choices[0], "quiz_draw: 처음엔 초급 신규 문제 · 선택지가 섞인 순열")
	var ref1: Dictionary = Quiz.by_id(p1.id)
	var right_idx: int = (p1.order as Array).find(int(ref1.a))
	var gold_before: int = S.gold
	var sm: float = 1.3 if Traits.has_trait("sg_zhugeliang", "scholarly") else 1.0  # 태수가 학구면 상금 ×1.3
	var a1: Dictionary = S.quiz_answer(p1, right_idx)
	check(a1.ok and a1.correct and a1.first and S.quiz.learned.has(p1.id) and S.gold == gold_before + roundi(float(Quiz.LV_REWARD[1].gold) * sm) and S.quiz.total == 1 and S.quiz.correct == 1 and S.quiz.streak == 1 and S.quiz.lore == 1, "처음 맞힘: 학습·상금(초급)·연속 1·학식 +1")
	var p2: Dictionary = {"id": p1.id, "order": [0, 1, 2, 3]}
	var gb2: int = S.gold
	var a2: Dictionary = S.quiz_answer(p2, int(ref1.a))
	check(a2.correct and not a2.first and S.gold == gb2 + roundi(float(Quiz.LV_REWARD[1].rgold) * sm) and S.quiz.lore == 1 and S.quiz.streak == 2 and S.quiz.best_streak == 2, "복습 정답: 적은 상금(rgold) · 학식은 안 오름 · 최고 연속 갱신")
	var wrong_idx: int = (int(ref1.a) + 1) % 4
	var a3: Dictionary = S.quiz_answer(p2, wrong_idx)
	check(a3.ok and not a3.correct and S.quiz.streak == 0 and S.quiz.wrongs[p1.id] == 1 and S.quiz.best_streak == 2 and not S.quiz_answer({"id": "zzz"}, 0).ok, "틀리면 연속 0 · 오답 기록 · 모르는 문제는 거절")
	S.quiz_answer(p2, int(ref1.a))
	check(not S.quiz.wrongs.has(p1.id), "오답을 다시 맞히면 오답 기록이 지워짐")
	# 학식이 차면 재야가 드러남
	S.quiz.lore = Quiz.LORE_PER_FIND - 1
	S.found = []
	var fresh: Dictionary = {}
	for ref: Dictionary in Quiz.BANK:
		if not S.quiz.learned.has(ref.id):
			fresh = ref
			break
	S.quiz_answer({"id": fresh.id, "order": [0, 1, 2, 3]}, int(fresh.a))
	check(S.found.size() == 1 and S.quiz.lore < Quiz.LORE_PER_FIND, "학식이 6 에 닿으면 재야가 하나 드러남(%s)" % str(S.found))
	# 모든 문제를 다 익히면 복습으로
	for ref: Dictionary in Quiz.BANK:
		S.quiz.learned[ref.id] = 1
	var rev: Dictionary = S.quiz_draw()
	check(rev.review and S.quiz_progress().learned == 260 and S.quiz_progress().total == 260, "전부 익히면 복습 문제만 나옴 · 진행도 260/260")
	_reset()
	var cc: Array = S.quiz_cat_counts()
	var cc_total := 0
	for x in cc:
		cc_total += int(x.total)
	S.quiz.learned["h02"] = 5
	S.quiz.learned["i01"] = 9
	var ll: Array = S.quiz_learned_list()
	check(cc.size() == 6 and cc_total == 260 and ll.size() == 2 and ll[0].id == "i01" and ll[1].id == "h02" and S.quiz_learned_list("hist").size() == 1 and S.quiz_learned_list("", 1).size() == 1 and S.quiz_cat_counts()[0].learned == 1, "서고: 분야별 개수 합 260 · 최근 익힌 순 · 분야·개수 필터")
	var dq: Array = S.debate_draw("sg_zhugeliang")
	var lv_ok := true
	for q in dq:
		lv_ok = lv_ok and q.lv <= 3
	var low: Array = S.debate_draw("zzz")
	check(dq.size() == 3 and lv_ok and low.size() == 3 and low.all(func(q): return q.lv == 1) and S.DEBATE_ROUNDS == 3, "설전: 3문항 · 지력이 낮으면 초급만")
	var dres0: Dictionary = S.debate_result(dq, [0, 0, 0])
	var perfect: Array = []
	for q in dq:
		perfect.append((q.order as Array).find(int(Quiz.by_id(q.id).a)))
	var dres3: Dictionary = S.debate_result(dq, perfect)
	check(dres3.correct == 3 and dres3.mul == 1.3 and dres0.mul == S.DEBATE_MUL_BY_CORRECT[dres0.correct] and S.DEBATE_MUL_BY_CORRECT == {0: 0.8, 1: 0.95, 2: 1.1, 3: 1.3}, "설전 결과: 전부 맞히면 ×1.3 · 배율표 0.8·0.95·1.1·1.3")

	# ④ 전쟁·편입
	_reset()
	_fund()
	check(not S.attack("zzz").ok and not S.attack("luoyang_x").ok, "없는 목표 거절")
	S.diplomacy.bei.truce_months = 3
	check(not S.attack("xiaopei").ok and "맹약" in String(S.attack("xiaopei").why), "맹약이 있으면 못 침")
	S.diplomacy.bei.truce_months = 0
	S.cities.xuchang.troops = 400
	check("오백" in String(S.attack("xiaopei").why), "병력 500 미만이면 출진 못 함")
	S.cities.xuchang.troops = 5000
	S.cities.xuchang.food = 10
	check("군량" in String(S.attack("xiaopei").why), "군량이 모자라면 출진 못 함")
	S.cities.xuchang.food = 30000
	S.cities.xuchang.troops = 20000
	S.cities.xuchang.train = 100
	S.cities.xuchang.tech = 900
	S.enemies.xiaopei.troops = 100
	S.enemies.xiaopei.wall = 100
	S.enemies.xiaopei.officers = []
	var food_before: int = S.cities.xuchang.food
	var feats_before: int = int(S._growth("sg_zhugeliang").feats)
	var loyal_before: int = S.officer_loyal.sg_zhugeliang
	var at: Dictionary = S.attack("xiaopei")
	check(at.ok and at.won and S.enemies.xiaopei.captured and S.cities.has("xiaopei") and S.cities.xiaopei.troops > 0 and S.cities.xuchang.troops == 0 and S.cities.xuchang.food == food_before - Orders.food_upkeep(20000) * 2 and S.officer_city.sg_zhugeliang == "xiaopei" and S.officer_growth.sg_zhugeliang.feats == feats_before + 3 and S.officer_loyal.sg_zhugeliang == loyal_before + 3, "이김: 성이 편입(주둔 병력)·출진 성 병력 0·군량 2달치 소모·장수가 입성·공 +3·충성 +3")
	var an: Dictionary = S.cities.xiaopei
	check(an.agri == 220 and an.comm == 200 and an.pop == 120000 and an.sec == 30 and an.disaster == "" and an.food == Cities.food_start("xiaopei") and an.wall == S.enemies.xiaopei.wall, "편입된 성: 개간·상업·인구는 시작값 · 치안 30(절반) · 군량 시작값")
	check(not S.attack("xiaopei").ok and "이미" in String(S.attack("xiaopei").why) and S.cities.size() == 4, "함락한 성은 다시 못 침")
	_reset()
	_fund()
	S.cities.xuchang.troops = 500
	S.cities.xuchang.train = 10
	S.cities.xuchang.tech = 100
	var guard_troops: int = S.enemies.xiaopei.troops
	var at2: Dictionary = S.attack("xiaopei")
	check(at2.ok and not at2.won and not S.enemies.xiaopei.captured and not S.cities.has("xiaopei") and S.cities.xuchang.troops < 500 and S.enemies.xiaopei.troops <= guard_troops and S.officer_city.sg_zhugeliang == "xuchang", "지면 퇴각: 남은 병력이 성으로 돌아오고 성은 그대로(적 병력 %d→%d)" % [guard_troops, S.enemies.xiaopei.troops])
	_reset()
	_fund()
	S.cities.xuchang.troops = 5000
	var at3: Dictionary = S.attack("xiaopei", ["slash", "stab", "guard"])
	check(at3.ok and (at3.duel_rounds as Array).size() == 3 and at3.duel_mul >= 0.8 and at3.duel_mul <= 1.3, "일기토 3판이 붙으면 위력 배율 0.8~1.3")
	# 외교
	_reset()
	_fund()
	var gtr: int = S.gold
	var et: Dictionary = {}
	for n in 60:
		S._done_this_month.clear()
		S.gold = 9000
		S.diplomacy.bei = {"relation": 40, "truce_months": 0}
		et = S.envoy_truce("xiaopei")
		if et.accepted:
			break
	check(et.ok and et.accepted and S.diplomacy.bei.truce_months == 8 and S.diplomacy.bei.relation == 52 and S.gold == 9000 - 400, "화친 성공: 맹약 8달 · 우호 +12 · 비용 400(300+수수료 100)")
	var ef: Dictionary = {}
	for n in 80:
		S._done_this_month.clear()
		S.gold = 9000
		S.diplomacy.bei = {"relation": 40, "truce_months": 0}
		ef = S.envoy_truce("xiaopei")
		if not ef.accepted:
			break
	check(ef.ok and not ef.accepted and S.diplomacy.bei.truce_months == 0 and S.diplomacy.bei.relation == 42, "화친 거절: 우호만 +2")
	S._done_this_month.clear()
	S.gold = 9000
	S.diplomacy.bei = {"relation": 40, "truce_months": 0}
	var tb: Dictionary = S.envoy_tribute("xiaopei")
	check(tb.ok and tb.up == 5 and S.diplomacy.bei.relation == 45 and S.gold == 9000 - 700 and not S.envoy_tribute("xiaopei").ok, "조공: 우호 +5(600÷120) · 비용 700 · 같은 달 무장은 끝")
	S._done_this_month.clear()
	S.gold = 100
	check(not S.envoy_truce("xiaopei").ok and not S.envoy_tribute("xiaopei").ok and not S.envoy_truce("zzz").ok and not S.envoy_tribute("zzz").ok, "금이 모자라거나 없는 상대면 거절")
	# 계략
	_reset()
	check(not S.plot("zzz", "xiaopei").ok and not S.plot("rumor", "zzz").ok, "없는 계략·목표 거절")
	var far := ""
	for c: Dictionary in Cities.ENEMY_CITIES:
		if not Cities.is_adjacent(String(c.id), "xuchang") and not Cities.is_adjacent(String(c.id), "chenliu") and not Cities.is_adjacent(String(c.id), "puyang"):
			far = String(c.id)
			break
	check(not S.plot("rumor", far).ok and "손이" in String(S.plot("rumor", far).why), "손이 안 닿는 성에는 계략을 못 씀")
	S.gold = 10
	check(not S.plot("bribe", "xiaopei").ok, "금이 모자라면 거절")
	var pv: Dictionary = {}
	_reset()
	S.gold = 9000
	pv = S.plot_preview("rumor", "xiaopei")
	check(pv.ok and pv.chance >= 0.05 and pv.chance <= 0.9 and S.gold == 9000 and not S._done_this_month.has("sg_zhugeliang"), "plot_preview: 확률만 보고 아무것도 안 바꿈")
	var kinds_done := {"rumor": 0, "fire": 0, "discord": 0, "bribe": 0}
	var rule_ok := true
	var sec_ok := true
	for t in 160:
		_reset()
		S._rng.seed = 1000 + t
		S.gold = 9000
		var kind: String = ["rumor", "fire", "discord", "bribe"][t % 4]
		var rel0: int = S.diplomacy.bei.relation
		var food0: int = S.enemies.xiaopei.food
		var sec0: int = S.enemies.xiaopei.sec
		var pr2: Dictionary = S.plot(kind, "xiaopei")
		rule_ok = rule_ok and pr2.ok and S.gold == 9000 - int(Diplo.plot_by_key(kind).gold) and S._done_this_month.sg_zhugeliang
		if pr2.done:
			kinds_done[kind] += 1
			rule_ok = rule_ok and S.diplomacy.bei.relation == rel0 - 4
			match kind:
				"rumor": sec_ok = sec_ok and sec0 - pr2.sec_to >= 10 and sec0 - pr2.sec_to <= 22
				"fire": sec_ok = sec_ok and pr2.burned >= roundi(food0 * 0.25) - 1 and pr2.burned <= roundi(food0 * 0.55) + 1 and S.enemies.xiaopei.food == food0 - pr2.burned
				"discord": sec_ok = sec_ok and ((pr2.loyal_to <= pr2.loyal_from - 12 and pr2.loyal_to >= pr2.loyal_from - 26) or pr2.loyal_to == 0)
				"bribe": sec_ok = sec_ok and S.roster.has(pr2.target) and S.officer_loyal[pr2.target] == 40 and S.officer_city[pr2.target] == "xuchang" and not S.enemies.xiaopei.officers.has(pr2.target) and S.enemies_subverted == 1
		else:
			rule_ok = rule_ok and S.diplomacy.bei.relation == rel0 - 4 - 6
	check(rule_ok and sec_ok and kinds_done.rumor > 0 and kinds_done.fire > 0 and kinds_done.discord > 0 and kinds_done.bribe > 0, "계략 160번: 비용·우호 하락(-4, 들통나면 -6 더)·유언비어 치안 -10~22·화계 군량 25~55%%·이간 충성 -12~25·매수는 로스터로 %s" % str(kinds_done))
	var plot_rate := 0
	for t in 300:
		_reset()
		S._rng.seed = 5000 + t
		S.gold = 9000
		if S.plot("rumor", "xiaopei").done:
			plot_rate += 1
	var expect_rate: float = Diplo.plot_chance(float(S._effective_stat("sg_zhugeliang", "wisdom")), S._enemy_guard_wisdom("xiaopei"), 60)
	check(absf(float(plot_rate) / 300.0 - expect_rate) < 0.09, "유언비어 성공률 %.2f ≈ 확률 %.2f" % [float(plot_rate) / 300.0, expect_rate])

	# ⑤ 월 진행
	_reset()
	S.gold = 1000
	S.cities.xuchang.comm = 360
	var mul_gov: float = Orders.gov_mul(S._effective_stat("sg_zhugeliang", "wisdom"), S._effective_stat("sg_zhugeliang", "command"))
	var inc: int = 0
	for cid in S.cities:
		var cc2: Dictionary = S.cities[cid]
		inc += Orders.gold_income(int(cc2.comm), mul_gov if cid == "xuchang" else 1.0, int(cc2.sec))
	var m0: int = S.month
	var sec0: int = S.cities.xuchang.sec
	var pop0: int = S.cities.xuchang.pop
	var food0b: int = S.cities.xuchang.food
	S.next_month()
	check(S.gold == 1000 + inc - 12 * S.roster.size() and S.month == m0 + 1 and S.cities.xuchang.sec == sec0 - 1 and S._done_this_month.is_empty(), "월 진행: 금 += 수입(상업×0.55×치안·통치) - 무장 유지비 12 · 치안 -1 · 달 +1 · 명령 기록 비움(수입 %d)" % inc)
	check(S.cities.xuchang.food == food0b - Orders.food_upkeep(int(S.cities.xuchang.troops)) or S.cities.xuchang.food == food0b, "수확 달이 아니면 군량은 늘지 않음(유지비만)")
	_reset()
	S.month = 6
	S.cities.xuchang.troops = 1000
	var fb: int = S.cities.xuchang.food
	S.next_month()
	check(S.cities.xuchang.food > fb and S.month == 7, "수확 달(6월)에는 군량이 늘어남")
	_reset()
	S.cities.xuchang.food = 0
	S.cities.xuchang.troops = 3000
	S.next_month()
	check(S.cities.xuchang.food == 0 and S.cities.xuchang.troops < 3000, "군량이 바닥나면 병력이 굶어 줆")
	_reset()
	S.month = 12
	S.year = 194
	S.next_month()
	check(S.month == 1 and S.year == 195, "12월 다음은 다음 해 1월")
	_reset()
	S.cities.puyang.disaster = "flood"
	S.cities.puyang.d_left = 2
	var wall_p: int = S.cities.puyang.wall
	var pop_p: int = S.cities.puyang.pop
	S.next_month()
	check(S.cities.puyang.d_left == 1 and S.cities.puyang.wall == wall_p - 400 and S.cities.puyang.pop < pop_p, "수해: 성벽 -400 · 인구 감소 · 남은 달 -1")
	S.next_month()
	check(S.cities.puyang.disaster == "" and S.cities.puyang.d_left == 0, "재해는 남은 달이 0 이면 걷힘")
	_reset()
	S.cities.chenliu.pop = 5100
	S.cities.chenliu.sec = 0
	for i in 6:
		S.next_month()
	check(S.cities.chenliu.pop >= Orders.POP_FLOOR and S.cities.chenliu.sec == 0, "인구는 하한(5000) 아래로 안 내려가고 치안은 0 에서 멈춤")
	var ds_ok := true
	var seen_dis := {}
	_reset()
	S.gold = 99999
	for i in 120:
		S.gold = 99999
		for cid in S.cities.keys():
			S.cities[cid].troops = maxi(int(S.cities[cid].troops), 3000)
			S.cities[cid].food = maxi(int(S.cities[cid].food), 20000)
		S.next_month()
		for cid in S.cities:
			var dd: String = String(S.cities[cid].get("disaster", ""))
			if dd != "":
				seen_dis[dd] = true
				ds_ok = ds_ok and Orders.DISASTERS.has(dd) and int(S.cities[cid].d_left) > 0
			ds_ok = ds_ok and int(S.cities[cid].pop) >= Orders.POP_FLOOR and int(S.cities[cid].sec) >= 0 and int(S.cities[cid].sec) <= 100
	check(ds_ok and S.month >= 1 and S.month <= 12 and seen_dis.size() >= 2, "120달 진행: 재해가 표 안에서 생기고(%d종) 인구·치안 범위 유지" % seen_dis.size())

	# 적 AI
	_reset()
	var adj: Array = []
	for c: Dictionary in Cities.ENEMY_CITIES:
		if S.cities.has(String(c.from_city)) and S.enemies.has(String(c.id)) and String(c.force) != "":
			adj.append(String(c.id))
	check(not adj.is_empty(), "허창 곁에 칠 수 있는 군웅 성이 있음(%s)" % str(adj))
	for eid in adj:
		var atk_n := 0
		for t in 500:
			S._rng.seed = 7000 + t
			for k in S.enemies:
				S.enemies[k].troops = 0
			S.enemies[eid].troops = 3000
			S.enemies[eid].captured = false
			var msgs: Array = S._run_enemy_ai()
			if not msgs.is_empty():
				atk_n += 1
		var expect2: float = 0.2 * Cities.creed_chance_mul(S.force_of(eid))
		check(absf(float(atk_n) / 500.0 - expect2) < 0.07, "적 AI(%s·%s): 출진률 %.3f ≈ 0.2×성향 %.2f" % [eid, Cities.creed_of(S.force_of(eid)), float(atk_n) / 500.0, expect2])
	if not adj.is_empty():
		var one: String = adj[0]
		for k in S.enemies:
			S.enemies[k].troops = 0
		S.enemies[one].troops = 3000
		S.diplomacy[S.force_of(one)].truce_months = 5
		var none_cnt := 0
		for t in 200:
			S._rng.seed = 9000 + t
			none_cnt += (S._run_enemy_ai() as Array).size()
		S.diplomacy[S.force_of(one)].truce_months = 0
		S.enemies[one].troops = 400
		var low_cnt := 0
		for t in 200:
			S._rng.seed = 9100 + t
			low_cnt += (S._run_enemy_ai() as Array).size()
		check(none_cnt == 0 and low_cnt == 0, "맹약 중이거나 병력 500 미만이면 적이 안 침")
	var pick_ok: bool = S._enemy_pick_order({"sec": 30, "wall": 0, "max_wall": 100, "train": 0, "tech": 0}) == "sec" and S._enemy_pick_order({"sec": 60, "wall": 50, "max_wall": 100, "train": 0, "tech": 0}) == "wall" and S._enemy_pick_order({"sec": 60, "wall": 90, "max_wall": 100, "train": 50, "tech": 0}) == "train" and S._enemy_pick_order({"sec": 60, "wall": 90, "max_wall": 100, "train": 80, "tech": 300}) == "tech" and S._enemy_pick_order({"sec": 60, "wall": 90, "max_wall": 100, "train": 80, "tech": 500}) == "sec" and S._enemy_pick_order({"sec": 90, "wall": 90, "max_wall": 100, "train": 80, "tech": 500}) == ""
	check(pick_ok, "적 내정 순서: 치안 45 → 성벽 70% → 훈련 70 → 기술 400 → 치안 85 → 멈춤")
	_reset()
	S.enemies.xiaopei.sec = 20
	S._run_enemy_economy()
	check(S.enemies.xiaopei.sec > 20 and S.enemies.xiaopei.sec <= 100, "적 내정: 치안이 낮으면 올림")

	# ⑥ 승리
	_reset()
	check(S.check_result() == "" and S.result == "", "평소엔 결과 없음")
	S.quiz.correct = 200
	check(S.check_result() == "win_culture" and S.result == "win_culture", "문화 승리: 문답 정답 200")
	S.diplomacy_peace_streak = 99
	check(S.check_result() == "win_culture", "결과는 한 번 정해지면 안 바뀜")
	var m_keep: int = S.month
	S.next_month()
	check(S.month == m_keep, "결과가 나면 달이 안 감")
	_reset()
	S.diplomacy_peace_streak = 36
	check(S.check_result() == "win_diplomacy", "화친 승리: 36달 연속")
	_reset()
	S.diplomacy_peace_streak = 35
	check(S.check_result() == "", "화친 35달은 아직")
	_reset()
	for c: Dictionary in Cities.ENEMY_CITIES:
		if not S.cities.has(c.id):
			S.cities[c.id] = {"agri": 1, "comm": 1, "sec": 1, "tech": 1, "wall": 1, "train": 1, "pop": 1, "troops": 0, "food": 0, "ships": 0, "disaster": "", "d_left": 0}
	S.quiz.correct = 500
	check(S.cities.size() == 107 and S.check_result() == "win", "천하통일(성 107)이 문화 승리보다 먼저")
	_reset()
	var all_peace := true
	for fid in S.diplomacy:
		S.diplomacy[fid].truce_months = 2
	all_peace = S._all_alive_forces_at_peace()
	S.diplomacy.bei.truce_months = 0
	check(all_peace and not S._all_alive_forces_at_peace(), "화친 판정: 살아 있는 모든 세력과 맹약이 있어야 함")
	_reset()
	for fid in S.diplomacy:
		S.diplomacy[fid].truce_months = 30
	S.gold = 99999
	S.next_month()
	S.next_month()
	check(S.diplomacy_peace_streak == 2, "모든 세력과 맹약이면 화친 연속 달이 쌓임")
	S.diplomacy.bei.truce_months = 0
	S.next_month()
	check(S.diplomacy_peace_streak == 0, "한 세력이라도 맹약이 풀리면 연속이 끊김")

	# 야망·이탈
	_reset()
	var zid := "sg_zhugeliang"
	S.officer_ambition[zid] = {"k": "wealth", "prog": 0, "done": false, "fail_months": 0}
	S.officer_loyal[zid] = 50
	S.gold = 6000
	var lw: int = S.officer_loyal[zid]
	S._tick_ambitions()
	check(S.officer_ambition[zid].done and S.officer_loyal[zid] == lw + 20 and S.officer_growth[zid].bonus.wisdom == 2 and not S.officer_hint(zid).is_empty(), "야망 부귀(5000금): 달성 → 충성 +20 · 지력 +2 영구")
	S._tick_ambitions()
	check(S.officer_growth[zid].bonus.wisdom == 2, "달성한 야망은 보상을 한 번만")
	S.officer_ambition[zid] = {"k": "hometown", "prog": 0, "done": false, "fail_months": 0}
	S._tick_ambitions()
	var h3: int = S.officer_ambition[zid].prog
	S.cities["a"] = {"x": 1}
	S.cities["b"] = {"x": 1}
	S._tick_ambitions()
	check(h3 == 3 and S.officer_ambition[zid].done and S.officer_growth[zid].bonus.command == 2, "야망 고향: 성 4개에서 달성 · 지휘 +2")
	S.cities.erase("a")
	S.cities.erase("b")
	S.officer_ambition[zid] = {"k": "fame", "prog": 0, "done": false, "fail_months": 0}
	S.officer_growth[zid].rank = 2
	S._tick_ambitions()
	check(S.officer_ambition[zid].done, "야망 명성: 중랑장(2단)")
	S.officer_ambition[zid] = {"k": "scholar", "prog": 0, "done": false, "fail_months": 0}
	for i in 10:
		S.quiz.learned["q%d" % i] = i
	S._tick_ambitions()
	check(S.officer_ambition[zid].done and S.officer_growth[zid].bonus.wisdom == 4, "야망 학문: 문답 10개 · 지력 +2 더")
	S.officer_ambition[zid] = {"k": "rival", "prog": 0, "done": false, "fail_months": 0}
	S.enemies_subverted = 0
	S._tick_ambitions()
	var rv0: bool = S.officer_ambition[zid].done
	S.enemies_subverted = 1
	S._tick_ambitions()
	check(not rv0 and S.officer_ambition[zid].done and S.officer_growth[zid].bonus.might == 2, "야망 숙적: 적 무장 하나를 꺾으면")
	S.officer_ambition[zid] = {"k": "governor", "prog": 0, "done": false, "fail_months": 0}
	S._tick_ambitions()
	S._tick_ambitions()
	var gv2: int = S.officer_ambition[zid].prog
	S._tick_ambitions()
	check(gv2 == 2 and S.officer_ambition[zid].done, "야망 태수: 한 성을 3달 연속 다스리면")
	S.officer_ambition[zid] = {"k": "wealth", "prog": 0, "done": false, "fail_months": 0}
	S.gold = 100
	S.officer_loyal[zid] = 50
	var lf: int = S.officer_loyal[zid]
	for i in 12:
		S._tick_ambitions()
	var lf12: int = S.officer_loyal[zid]
	S._tick_ambitions()
	check(lf12 == lf and S.officer_loyal[zid] == lf - 3 and S.officer_ambition[zid].fail_months == 13, "야망 좌절: 12달까진 그대로 · 13달째부터 충성 -3/달")
	# 이탈
	_reset()
	var leave := 0
	var leave_lh := 0
	var lh := _with_trait("loyal_heart")
	for t in 600:
		S.roster = [zid, lh]
		S.officer_city = {zid: "xuchang", lh: "xuchang"}
		S.officer_loyal = {zid: 10, lh: 10}
		S.officer_ambition = {}
		S._rng.seed = 20000 + t
		S._check_defection()
		if not S.roster.has(zid):
			leave += 1
		if not S.roster.has(lh):
			leave_lh += 1
	check(absf(float(leave) / 600.0 - 0.35 * (0.75 if Traits.has_trait(zid, "loyal_heart") else 1.0)) < 0.07 and absf(float(leave_lh) / 600.0 - 0.35 * 0.75) < 0.07, "이탈: 충성 12 이하면 달마다 35%%(충직은 ×0.75) — 실측 %.2f·%.2f" % [float(leave) / 600.0, float(leave_lh) / 600.0])
	S.roster = [zid]
	S.officer_city = {zid: "xuchang"}
	S.officer_loyal = {zid: 13}
	var stay := true
	for t in 100:
		S._rng.seed = 30000 + t
		S._check_defection()
		stay = stay and S.roster.has(zid)
	check(stay, "충성 13 이상이면 안 떠남")

	# 이벤트 체인
	_reset()
	S.month = 11
	S.year = 194
	S.active_events = [{"id": "greedy_bribe", "officer": zid, "due_month": 11, "due_year": 194}, {"id": "militant_challenge", "officer": zid, "due_month": 12, "due_year": 194}]
	check(S.ready_events().size() == 1 and S.ready_events()[0] == 0 and not S.resolve_event(9, 0) and not S.resolve_event(0, 7) and not S.resolve_event(-1, 0), "ready_events: 때가 된 것만 · 없는 번호·선택지는 거절")
	var lg: int = S.officer_loyal[zid]
	var gg: int = S.gold
	check(S.resolve_event(0, 2) and S.officer_loyal[zid] == lg - 3 and S.gold == gg + 250 and S.events_done.greedy_bribe == 1 and S.active_events.size() == 2 and S.active_events[1].id == "greedy_bribe_2" and S.active_events[1].due_month == 3 and S.active_events[1].due_year == 195, "체인 선택(눈감아준다): 충성 -3·금 +250 · 4달 뒤(다음 해 3월)에 후속 이벤트")
	S.active_events = [{"id": "rival_chance", "officer": zid, "due_month": 11, "due_year": 194}]
	S.officer_ambition[zid] = {"k": "rival", "prog": 0, "done": false, "fail_months": 0}
	S.resolve_event(0, 0)
	check(S.officer_ambition[zid].prog == 1 and S.active_events.is_empty(), "숙적 이벤트의 공격 선택은 야망 진행 +1")
	S.active_events = [{"id": "militant_challenge", "officer": zid, "due_month": 11, "due_year": 194}]
	var ex0: int = S._growth(zid).exp
	S.resolve_event(0, 0)
	check(S.officer_growth[zid].exp != ex0 or S.officer_growth[zid].lv > 1, "응한다 → 경험치 +15 · 3달 뒤 재대결 체인")
	check(S.active_events.size() == 1 and S.active_events[0].id == "militant_rematch" and S.active_events[0].due_month == 2 and S.active_events[0].due_year == 195, "대련 체인: 3달 뒤 재대결")
	_reset()
	S.active_events = [{"id": "x", "officer": zid, "due_month": 1, "due_year": 194}, {"id": "y", "officer": zid, "due_month": 1, "due_year": 194}]
	var before_n: int = S.active_events.size()
	S._tick_events()
	check(S.active_events.size() == before_n, "동시 진행 체인은 최대 2")
	var born := 0
	for t in 400:
		_reset()
		S._rng.seed = 40000 + t
		S.roster = [zid, _with_trait("greedy"), _with_trait("militant"), _with_trait("cunning")]
		S._tick_events()
		born += S.active_events.size()
	check(born > 15 and born < 130, "이벤트 발생: 달마다 18%% 안팎의 확률(400달 중 %d번)" % born)

	# 계승
	_reset()
	var amb := _with_trait("ambitious")
	var loyal_h := _with_trait("loyal_heart", [amb])
	var plain := ""
	for h in Chars.HEROES:
		var hid := String(h.id)
		if hid != zid and hid != amb and hid != loyal_h and not Traits.has_trait(hid, "ambitious") and not Traits.has_trait(hid, "loyal_heart"):
			plain = hid
			break
	S.roster = [zid, amb, loyal_h, plain]
	S.officer_loyal = {zid: 80, amb: 70, loyal_h: 60, plain: 90}
	S.officer_city = {zid: "xuchang", amb: "xuchang", loyal_h: "xuchang", plain: "xuchang"}
	S.heir_id = ""
	check(S._pick_heir() == plain, "후계 자동 선택: 충성이 가장 높은 무장")
	S.heir_id = loyal_h
	check(S._pick_heir() == loyal_h, "지정한 후계가 우선(로스터에 있을 때)")
	S.heir_id = "zzz"
	check(S._pick_heir() == plain, "로스터에 없는 지정은 무시")
	S.heir_id = loyal_h
	S.month = 11
	S.year = 194
	S.current_lord_id = Diplo.LORD_ID
	S._succeed_lord()
	check(S.current_lord_id == loyal_h and S.officer_loyal[loyal_h] == 100 and S.officer_loyal[zid] == 80 + _hit(zid) and S.officer_loyal[plain] == 75 and S.officer_loyal[amb] == 70 + _hit(amb) and S.heir_id == "" and (Traits.has_trait(amb, "loyal_heart") or S._succession_shock_until[amb] == {"month": 2, "year": 195}), "계승: 새 군주 충성 100 · 일반 -15 · 야심 -25(+3달 충격) · 지정 소비")
	S.lord_succession_enabled = false
	var lord_now: String = S.current_lord_id
	for t in 300:
		S._tick_succession()
	check(S.current_lord_id == lord_now and S.LORD_DEATH_CHANCE_MONTHLY == 0.006 and S.SUCCESSION_AMBITIOUS_LOYAL_HIT == -25 and S.SUCCESSION_SHOCK_MONTHS == 3, "계승이 꺼져 있으면 군주가 안 바뀜 · 월 사망 확률 0.6%")
	S.lord_succession_enabled = true
	var changed := 0
	for t in 3000:
		S.current_lord_id = Diplo.LORD_ID
		S.roster = [zid, plain]
		S.officer_loyal = {zid: 50, plain: 60}
		S.heir_id = ""
		S._rng.seed = 60000 + t
		S._tick_succession()
		if S.current_lord_id != Diplo.LORD_ID:
			changed += 1
	check(changed > 6 and changed < 45, "계승 켬: 달마다 0.6%% 확률(3000달 중 %d번)" % changed)
	# 세션 카운터(목표판)
	_reset()
	S.begin_session()
	S.gold += 500
	S.cities["zz1"] = {"x": 1}
	check(S.session_gold_gained() == 500 and S.session_cities_gained() == 1, "세션 카운터: 시작 대비 금·성 증가분")

	# 되돌리기
	for v in SAVED:
		S.set(v, saved[v])
	S._rng.seed = saved_rng_seed
	S._rng.state = saved_rng_state
	print("PROBE realm_state ", "OK" if fails == 0 else "FAIL %d" % fails)
	quit(1 if fails > 0 else 0)
