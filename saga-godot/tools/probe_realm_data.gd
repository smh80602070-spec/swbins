extends SceneTree

## 사가천하 데이터·공식 층(games/saga_realm/data — realm_cities·realm_orders·realm_war·realm_diplo·realm_growth·realm_traits·realm_events·realm_officer_pool) 자동 점검 — 화면·상태 없이 표와 순수 공식만. 씨앗 고정(20260824).
##   godot --headless --path saga-godot --script res://tools/probe_realm_data.gd
## ① 성 107(우리 3 + 적 104): id 유일·땅·좌표·시작값·군웅/군주 일치·무장이 도감에 있음·출진 성(from_city) 사슬이 우리 3성에 닿고 순환 없음·인접 대칭·월드맵 좌표(중심 평균)·땅별 상한(개간·상업·성벽·조선)·시나리오 3(성 3·8·19, 덮어쓰기 표)·성향 14와 군웅 표
## ② 명령 10: 키 유일·능력치·값·상한 표 · 공식(군량 유지·통치 배율·치안 배율·금/군량 수입·인구 증감·저치안 패널티) · 재해 5(풍년만 좋음)
## ③ 전투: 병력 위력 공식 · 한 판 규칙(출격 판정·성벽 깎임·퇴각 35%·승패) 시드 고정 · 일기토(베기>막기>찌르기>베기·배율 ×1.3/1.0/0.8)
## ④ 외교·계략: 계략 4·확률 상하한·화친 확률·조공 우호·충성 기본값(25~85) · 성장(경험치 곡선·능력 배율·승급 비용·계급 이름)
## ⑤ 특성 12·야망 6(결정적·두 특성이 다름·모두 쓰임) · 이벤트 10(선택 셋·축·체인이 표 안·특성/야망으로 고름) · 재야 무장 풀. 끝에 "PROBE realm_data OK" 또는 "PROBE realm_data FAIL n".

var fails := 0


func check(cond: bool, msg: String) -> void:
	if cond:
		print("  ok   ", msg)
	else:
		fails += 1
		print("  FAIL ", msg)


func _initialize() -> void:
	await process_frame  # RealmSaveState autoload 가 올라온 뒤에 불러야 realm_cities 가 컴파일된다
	seed(20260824)
	var Cities: GDScript = load("res://games/saga_realm/data/realm_cities.gd")
	var Orders: GDScript = load("res://games/saga_realm/data/realm_orders.gd")
	var War: GDScript = load("res://games/saga_realm/data/realm_war.gd")
	var Diplo: GDScript = load("res://games/saga_realm/data/realm_diplo.gd")
	var Growth: GDScript = load("res://games/saga_realm/data/realm_growth.gd")
	var Traits: GDScript = load("res://games/saga_realm/data/realm_traits.gd")
	var Events: GDScript = load("res://games/saga_realm/data/realm_events.gd")
	var Pool: GDScript = load("res://games/saga_realm/data/realm_officer_pool.gd")
	var Characters: GDScript = load("res://saga_core/data/characters.gd")

	# ① 성
	var ids := {}
	var city_ok := true
	var lands := ["plain", "river", "hill", "mount"]
	var all_cities: Array = []
	for c: Dictionary in Cities.CITIES:
		all_cities.append(c)
	for c: Dictionary in Cities.ENEMY_CITIES:
		all_cities.append(c)
	var bad_city: Array = []
	for c: Dictionary in all_cities:
		var ok: bool = not ids.has(c.id) and lands.has(String(c.land)) and String(c.name) != "" and String(c.hanja) != "" and int(c.agri_start) > 0 and int(c.comm_start) > 0 and int(c.pop_start) > 0 and int(c.wall_start) > 0
		ids[c.id] = true
		if not ok:
			bad_city.append(c.id)
	check(Cities.CITIES.size() == 3 and Cities.ENEMY_CITIES.size() == 104 and ids.size() == 107 and bad_city.is_empty(), "성 107(3+104): id 유일·땅·이름·시작값 %s" % str(bad_city))
	var en_bad: Array = []
	var forces := {}
	for c: Dictionary in Cities.ENEMY_CITIES:
		var ok2: bool = ids.has(String(c.from_city)) and int(c.troops_start) > 0 and int(c.train_start) >= 0 and int(c.tech_start) >= 0
		var f := String(c.force)
		if f != "":
			forces[f] = true
			ok2 = ok2 and Cities.FORCE_LORD.has(f) and String(c.lord) == String(Cities.FORCE_LORD[f]) and Cities.CREED.has(f)
		for oid in c.officers:
			ok2 = ok2 and Characters.find(String(oid)) != null
		if not ok2:
			en_bad.append(c.id)
	check(en_bad.is_empty() and forces.size() >= 10, "적 성: 출진 성이 실재 · 군웅이 있으면 군주가 표와 같고 성향이 있음 · 무장이 도감에 있음(군웅 %d) %s" % [forces.size(), str(en_bad)])
	var chain_ok := true
	var max_depth := 0
	var playable := ["chenliu", "puyang", "xuchang"]
	for c: Dictionary in Cities.ENEMY_CITIES:
		var cur: String = String(c.id)
		var depth := 0
		var seen := {}
		while not playable.has(cur) and depth < 200:
			if seen.has(cur):
				chain_ok = false
				break
			seen[cur] = true
			cur = String(Cities.enemy_by_id(cur).get("from_city", ""))
			depth += 1
			if cur == "":
				chain_ok = false
				break
		chain_ok = chain_ok and playable.has(cur)
		max_depth = maxi(max_depth, depth)
	check(chain_ok and max_depth >= 5, "출진 성 사슬: 모든 적 성이 순환 없이 우리 3성에 닿음(가장 먼 곳 %d단)" % max_depth)
	check(Cities.is_adjacent("puyang", "chenliu") and Cities.is_adjacent("chenliu", "puyang") and Cities.is_adjacent("chenliu", "xuchang") and not Cities.is_adjacent("puyang", "xuchang") and Cities.is_adjacent("xiaopei", "xuchang") and Cities.is_adjacent("xuchang", "xiaopei") and not Cities.is_adjacent("xiaopei", "puyang"), "인접: 복양↔진류↔허창 · 소패↔허창 · 대칭 · 복양↔허창은 아님")
	var center: Vector2 = Cities.map_center()
	var c0: Dictionary = Cities.by_id("chenliu")
	check(Cities.world_pos("zzz") == Vector3.ZERO and absf(Cities.world_pos("chenliu").x - (float(c0.x) - center.x) * Cities.WORLD_SCALE) < 1e-4 and Cities.world_pos("chenliu").y == 0.0 and Cities.WORLD_SCALE == 14.0 and absf(center.x - (63.0 + 68.0 + 58.0) / 3.0) < 1e-4 and Cities.world_pos("xuchang") != Cities.world_pos("puyang"), "월드맵 좌표: 3성 평균이 중심 · 성마다 다른 자리 · 없는 성은 원점")
	check(Cities.agri_cap("chenliu") == 900 and Cities.comm_cap("puyang") == roundi(900.0 * 1.15) and Cities.ships_cap("puyang") == 300 and Cities.ships_cap("xuchang") == 0 and Cities.ships_start("puyang") == 60 and Cities.wall_cap("xuchang") == 10800 and Cities.food_start("xuchang") == 8000 + 400 * 8 and Cities.agri_cap("zzz") == 900, "땅별 상한: 강가 상업 ×1.15·조선 300 · 성벽 상한 = 시작값 ×2 · 군량 시작 8000+개간×8")
	check(Cities.land_def("mount") == 1.3 and Cities.land_siege("mount") == 0.75 and Cities.land_def("zzz") == 1.0 and Cities.land_def("plain") < Cities.land_def("river") and Cities.land_def("river") < Cities.land_def("hill") and Cities.land_siege("hill") < Cities.land_siege("plain"), "땅 방어·공성 배율: 산이 가장 단단하고 공성은 느림")
	var scen_ok := true
	var scen: Dictionary = Cities.SCENARIO_CAO_CITIES
	for k in scen:
		var seen2 := {}
		for cid in scen[k]:
			scen_ok = scen_ok and ids.has(String(cid)) and not seen2.has(cid)
			seen2[cid] = true
	for k in Cities.SCENARIO_FORCE_OVERRIDE:
		for cid in Cities.SCENARIO_FORCE_OVERRIDE[k]:
			scen_ok = scen_ok and ids.has(String(cid)) and Cities.CREED.has(String(Cities.SCENARIO_FORCE_OVERRIDE[k][cid]))
	check(scen_ok and (scen["194"] as Array).size() == 3 and (scen["200"] as Array).size() == 8 and (scen["208"] as Array).size() == 19 and (scen["194"] as Array).all(func(x): return (scen["200"] as Array).has(x)) and (scen["200"] as Array).all(func(x): return (scen["208"] as Array).has(x)), "시나리오 3: 우리 성 3·8·19(앞이 뒤에 포함) · 덮어쓰기 표가 실재 성·군웅")
	check(Cities.creed_of("zan") == "aggressive" and Cities.creed_of("rong") == "turtle" and Cities.creed_of("") == "balanced" and Cities.creed_chance_mul("zan") == 1.5 and Cities.creed_chance_mul("rong") == 0.35 and Cities.creed_chance_mul("xyz") == 1.0 and Cities.CREED.size() == 14 and Cities.FORCE_LORD.size() == 14, "성향: 호전 ×1.5·신중 ×0.35·그 밖 ×1.0 · 군웅 14")

	# ② 명령
	var keys := {}
	var ord_ok: bool = Orders.ORDERS.size() == 10
	for o: Dictionary in Orders.ORDERS:
		keys[o.key] = true
		ord_ok = ord_ok and ["wisdom", "command", "might"].has(String(o.stat)) and int(o.gold) > 0 and String(o.name) != "" and String(o.desc) != ""
	check(ord_ok and keys.size() == 10 and Orders.by_key("draft").gold == 200 and Orders.by_key("zzz").is_empty(), "명령 10: 키 유일·능력치·값·설명")
	check(Orders.cap_of("agri", "chenliu") == 900 and Orders.cap_of("tech", "xuchang") == 900 and Orders.cap_of("sec", "xuchang") == 100 and Orders.cap_of("train", "xuchang") == 100 and Orders.cap_of("draft", "xuchang") == 999999 and Orders.cap_of("ships", "puyang") == 300, "상한: 개간·상업은 땅별, 기술 900·치안·훈련 100")
	check(Orders.food_upkeep(1000) == 10 and Orders.food_upkeep(0) == 0 and Orders.food_upkeep(5500) == 55, "군량 유지: 병사 1000명당 10")
	check(absf(Orders.gov_mul(60.0, 40.0) - (1.0 + (36.0 + 16.0) / 100.0 * 0.35)) < 1e-9 and Orders.gov_mul(0.0, 0.0) == 1.0 and Orders.sec_mul(0) == 0.5 and Orders.sec_mul(100) == 1.0 and Orders.sec_mul(500) == 1.0 and Orders.sec_mul(-5) == 0.5, "통치 배율 · 치안 배율 0.5~1.0")
	check(Orders.gold_income(360, 1.0, 100) == roundi(360.0 * 0.55) and Orders.gold_income(360, 1.0, 0) == roundi(360.0 * 0.55 * 0.5) and Orders.gold_income(360, 1.0, 100, 0.5) < Orders.gold_income(360, 1.0, 100) and Orders.food_income(400, 1.0, 100) == 2400 and Orders.food_income(400, 1.2, 60) > Orders.food_income(400, 1.0, 60), "금·군량 수입: 상업×0.55·개간×6 · 치안·수확·통치 배율")
	var g_hi: float = Orders.pop_growth_delta(260000, 400, 80, 0.0)
	var g_lo: float = Orders.pop_growth_delta(260000, 400, 20, 0.0)
	check(g_hi > 0.0 and g_lo < g_hi and absf(g_lo - (260000.0 * 0.006 * (400.0 / 320.0) * (Orders.sec_mul(20) * 2.0 - 0.8) - 260000.0 * 0.008)) < 1e-6 and Orders.pop_growth_delta(100000, 300, 80, -0.04) < Orders.pop_growth_delta(100000, 300, 80, 0.0) and Orders.POP_FLOOR == 5000, "인구 증감: 치안이 낮으면 줄고(<35 패널티) · 재해가 더함")
	var dis_ok: bool = Orders.DISASTERS.size() == 5 and Orders.DISASTER_CHANCE == 0.42 and Orders.HARVEST_MONTHS == [6, 10]
	for k in Orders.DISASTERS:
		var d: Dictionary = Orders.DISASTERS[k]
		dis_ok = dis_ok and int(d.months) >= 2 and float(d.harvest) > 0.0 and String(d.text) != "" and (bool(d.get("good", false)) == (float(d.harvest) > 1.0))
	check(dis_ok and Orders.disaster_by_key("flood").wall == -400 and Orders.disaster_by_key("zzz").is_empty(), "재해 5: 풍년만 수확이 늘고 좋음 · 수해는 성벽 -400 · 역병은 병력 -5%")

	# ③ 전투
	var ap_full: float = War.army_power(1000, 100, 900, 100.0, 100.0, 3)
	check(absf(War.army_power(1000, 0, 0, 0.0, 0.0, 1) - 1000.0 * 0.5 * 0.7 * 1.0) < 1e-6 and absf(War.army_power(1000, 50, 450, 0.0, 0.0, 0) - 1000.0 * 0.75 * 1.0 * 0.6) < 1e-6 and absf(ap_full - 1000.0 * 1.0 * 1.3 * (1.0 + 0.5 + 0.25 + 0.06)) < 1e-6 and absf(War.army_power(1000, 999, 9999, 0.0, 0.0, 1) - War.army_power(1000, 100, 900, 0.0, 0.0, 1)) < 1e-6 and War.army_power(2000, 40, 100, 50.0, 50.0, 2) > War.army_power(1000, 40, 100, 50.0, 50.0, 2), "병력 위력: 훈련·기술·장수 보정 · 상한(훈련 100·기술 900) · 장수 없으면 ×0.6")
	var rng := RandomNumberGenerator.new()
	rng.seed = 20260824
	var a1 := {"troops": 5000, "start": 5000, "train": 80, "tech": 300, "best_command": 80.0, "best_might": 80.0, "officer_count": 3}
	var d1 := {"troops": 1000, "start": 1000, "train": 40, "tech": 100, "best_command": 50.0, "best_might": 50.0, "officer_count": 1}
	var w1 := {"wall": 3000, "max_wall": 3000}
	var r1: Dictionary = War.fight(a1, d1, w1, 1.0, 1.0, rng)
	check(r1.won and not r1.routed and not r1.sortie and r1.loss_a == 5000 - r1.atk_troops_left and r1.loss_d == 1000 - r1.def_troops_left and r1.wall_to < r1.wall_from, "큰 병력이 작은 수비를 이김: 성벽이 깎이고 손실 계산이 맞음(수비 %d→%d)" % [1000, r1.def_troops_left])
	var a2 := {"troops": 600, "start": 600, "train": 20, "tech": 100, "best_command": 30.0, "best_might": 30.0, "officer_count": 1}
	var d2 := {"troops": 5000, "start": 5000, "train": 80, "tech": 300, "best_command": 80.0, "best_might": 80.0, "officer_count": 3}
	var w2 := {"wall": 6000, "max_wall": 6000}
	var r2: Dictionary = War.fight(a2, d2, w2, 1.3, 0.75, rng)
	check(r2.routed and not r2.won and r2.sortie and r2.wall_to == r2.wall_from and a2.troops <= 600 * War.ROUT, "약한 공격은 수비의 출격에 밀려 퇴각(처음의 35%% 이하) · 출격이면 성벽은 안 깎임")
	var a3 := {"troops": 1000, "start": 1000, "train": 50, "tech": 100, "best_command": 50.0, "best_might": 50.0, "officer_count": 1}
	var d3 := {"troops": 800, "start": 800, "train": 50, "tech": 100, "best_command": 50.0, "best_might": 50.0, "officer_count": 1}
	var f3: Dictionary = War.fight(a3, d3, {"wall": 100, "max_wall": 100}, 1.0, 1.0, rng)
	check(f3.sortie == (800.0 > 1000.0 * 0.85) and War.ROUNDS == 10 and War.ROUT == 0.35 and f3.loss_a >= 0 and f3.loss_d >= 0, "출격 판정: 수비 병력 > 공격 ×0.85 이면 출격 · 한 달 10번")
	check(War.duel_beats("slash") == "guard" and War.duel_beats("guard") == "stab" and War.duel_beats("stab") == "slash" and War.duel_beats("zzz") == "", "일기토: 베기>막기>찌르기>베기")
	var duel_ok := true
	for p in War.DUEL_MOVES:
		for e in War.DUEL_MOVES:
			var res: String = War.duel_round_result(p, e)
			duel_ok = duel_ok and (res == "tie") == (p == e) and War.duel_round_result(e, p) == ({"tie": "tie", "win": "lose", "lose": "win"})[res]
	var ai_seen := {}
	for n in 100:
		ai_seen[War.duel_ai_move(rng)] = true
	check(duel_ok and ai_seen.size() == 3 and War.duel_round_mul("win") == 1.3 and War.duel_round_mul("tie") == 1.0 and War.duel_round_mul("lose") == 0.8 and War.DUEL_ROUNDS == 3, "일기토 3판: 결과가 서로 맞물리고 AI 가 세 수를 다 씀 · 이기면 ×1.3·비기면 ×1.0·지면 ×0.8")

	# ④ 외교·계략·성장
	check(Diplo.PLOTS.size() == 4 and Diplo.plot_by_key("bribe").gold == 600 and Diplo.plot_by_key("zzz").is_empty() and Diplo.plot_by_key("fire").emoji == "🔥", "계략 4(이간·유언비어·매수·화계)")
	var loy_ok := true
	for c in Characters.HEROES.slice(0, 120):
		var l: int = Diplo.base_loyal(String(c.id))
		loy_ok = loy_ok and l >= 25 and l <= 85
	check(loy_ok and Diplo.base_loyal("zzz") == 50, "충성 기본값: 도감 인물 120명이 25~85 · 모르는 인물 50")
	check(Diplo.plot_chance(100.0, 0.0, 0) == 0.9 and Diplo.plot_chance(0.0, 100.0, 100) == 0.05 and absf(Diplo.plot_chance(50.0, 50.0, 60) - 0.30) < 1e-9 and Diplo.plot_chance(50.0, 50.0, 0) > Diplo.plot_chance(50.0, 50.0, 100), "계략 성공 확률 5~90%%: 지력 차이·치안이 낮을수록 높음")
	check(Diplo.discord_chance(50.0, 50.0, 60, 10) > Diplo.discord_chance(50.0, 50.0, 60, 90) and Diplo.bribe_chance(50.0, 50.0, 60, 20, 3) > Diplo.bribe_chance(50.0, 50.0, 60, 80, 3) and Diplo.bribe_chance(50.0, 50.0, 60, 40, 5) < Diplo.bribe_chance(50.0, 50.0, 60, 40, 1) and Diplo.bribe_chance(0.0, 100.0, 100, 100, 5) == 0.05, "이간·매수: 충성이 낮을수록·희귀할수록 어려움 · 하한 5%")
	check(Diplo.truce_chance(0.0, 0, 0) == 0.30 and Diplo.truce_chance(100.0, 100, 100000) == 0.95 and Diplo.truce_chance(60.0, 40, 1200) > Diplo.truce_chance(60.0, 40, 0) and Diplo.tribute_up(0) == 1 and Diplo.tribute_up(1200) == 10 and Diplo.tribute_up(99999) == 30 and Diplo.clamp_relation(-9) == 0 and Diplo.clamp_relation(500) == 100 and Diplo.TRUCE_MONTHS == 8 and Diplo.DEFAULT_RELATION == 40, "화친 확률 3~95%% · 조공 우호 1~30 · 우호 0~100 · 휴전 8달")
	check(Growth.exp_need(1) == 28 and Growth.exp_need(2) == roundi(28.0 * 1.22) and Growth.exp_need(10) > Growth.exp_need(9) and Growth.grow_mul(1, 0) == 1.0 and absf(Growth.grow_mul(11, 2) - (1.0 + 10.0 * 0.022) * (1.0 + 2.0 * 0.06)) < 1e-9 and Growth.MAX_LV == 30 and Growth.MAX_RANK == 5, "성장: 경험치 28×1.22^(lv-1) · 능력 배율 레벨 +2.2%%·승급 +6%%")
	check(Growth.rank_name(0) == "무관(無官)" and Growth.rank_name(5) == "도독(都督)" and Growth.rank_name(9) == "무관(無官)" and Growth.rank_name(-1) == "무관(無官)" and Growth.RANK_KOR.size() == Growth.MAX_RANK + 1 and Growth.promote_cost(0) == {"feats": 20, "gold": 300} and Growth.promote_cost(4) == {"feats": 100, "gold": 1500} and Growth.EXP.size() == 4, "계급 이름 6 · 승급 비용 공적 20+20r·금 300+300r")

	# ⑤ 특성·야망·이벤트
	var trait_keys: Array = Traits.TRAIT_KEYS
	var tr_ok: bool = trait_keys.size() == 12 and Traits.TRAITS.size() == 12
	for k in trait_keys:
		tr_ok = tr_ok and Traits.TRAITS.has(k)
	var seen_t := {}
	var seen_a := {}
	var amb_ok := true
	for c in Characters.HEROES:
		var t: Array = Traits.traits_of(String(c.id))
		tr_ok = tr_ok and t.size() == 2 and t[0] != t[1] and trait_keys.has(t[0]) and trait_keys.has(t[1]) and t == Traits.traits_of(String(c.id)) and Traits.has_trait(String(c.id), String(t[0]))
		seen_t[t[0]] = true
		seen_t[t[1]] = true
		var a: String = Traits.ambition_of(String(c.id))
		amb_ok = amb_ok and Traits.AMBITION_KEYS.has(a) and a == Traits.ambition_of(String(c.id))
		seen_a[a] = true
	check(tr_ok and seen_t.size() == 12 and Traits.trait_badge("sg_caocao").length() >= 2 and not Traits.has_trait("sg_caocao", "zzz"), "특성 12: 인물마다 서로 다른 둘(결정적) · 열두 가지가 다 쓰임")
	var amb_tbl_ok: bool = Traits.AMBITIONS.size() == 6
	for k in Traits.AMBITIONS:
		amb_tbl_ok = amb_tbl_ok and Traits.AMBITION_KEYS.has(k) and int(Traits.AMBITIONS[k].target) > 0 and ["wisdom", "command", "might"].has(String(Traits.AMBITIONS[k].reward_stat))
	check(amb_ok and amb_tbl_ok and seen_a.size() == 6 and Traits.AMBITION_DONE_LOYAL == 20 and Traits.AMBITION_DONE_STAT == 2 and Traits.AMBITION_FRUSTRATE_MONTHS == 12 and Traits.AMBITION_FRUSTRATE_LOYAL_HIT == 3 and Traits.TRAIT_GREEDY_BRIBE_MUL > 1.0 and Traits.TRAIT_HONEST_BRIBE_MUL < 1.0 and Traits.TRAIT_SCHOLARLY_QUIZ_MUL == 1.3, "야망 6: 인물마다 하나(결정적) · 여섯이 다 쓰임 · 달성 충성 +20·능력 +2 · 좌절 12달 후 충성 -3 · 특성 배율")
	var ev_ok: bool = Events.EVENTS.size() == 10 and Events.EVENT_CHANCE == 0.18 and Events.MAX_CONCURRENT == 2
	var chain_refs_ok := true
	for k in Events.EVENTS:
		var e: Dictionary = Events.EVENTS[k]
		var ch: Array = e.choices
		ev_ok = ev_ok and ch.size() == 3 and String(e.name) != "" and String(e.text).find("%s") >= 0 and (String(e.trait) == "" or trait_keys.has(String(e.trait))) and (String(e.get("ambition", "")) == "" or Traits.AMBITION_KEYS.has(String(e.ambition)))
		var axes := {}
		for c: Dictionary in ch:
			axes[c.axis] = true
			ev_ok = ev_ok and absi(int(c.loyal)) <= 10
			if c.has("chain"):
				chain_refs_ok = chain_refs_ok and Events.EVENTS.has(String(c.chain)) and int(c.chain_months) > 0 and String(Events.EVENTS[c.chain].trait) == ""
		ev_ok = ev_ok and axes.size() == 3 and axes.has("공격") and axes.has("방어") and axes.has("유틸")
	check(ev_ok and chain_refs_ok, "이벤트 10: 선택 셋(공격·방어·유틸) · 충성 변화 ±10 이내 · 체인이 표 안(체인 안은 특성 없는 후속)")
	var rng2 := RandomNumberGenerator.new()
	rng2.seed = 20260824
	var pick_ok := true
	var any_pick := 0
	for c in Characters.HEROES.slice(0, 200):
		var k: String = Events.pick_for(String(c.id), "", rng2)
		if k != "":
			any_pick += 1
			pick_ok = pick_ok and Traits.has_trait(String(c.id), String(Events.EVENTS[k].trait))
	check(pick_ok and any_pick > 40 and Events.pick_for("sg_caocao", "rival", rng2) != "" and Events.by_key("rival_chance").ambition == "rival" and Events.by_key("zzz").is_empty(), "이벤트 고르기: 그 인물의 특성에 맞는 것만(%d/200명) · 야망 숙적이면 숙적 이벤트도 후보" % any_pick)
	var pool_ok: bool = Characters.find(String(Pool.STARTING_OFFICER)) != null and Pool.HIDDEN_POOL_BY_CITY.size() == 3
	for cid in Pool.HIDDEN_POOL_BY_CITY:
		pool_ok = pool_ok and Cities.by_id(String(cid)).size() > 0
		for oid in Pool.HIDDEN_POOL_BY_CITY[cid]:
			pool_ok = pool_ok and Characters.find(String(oid)) != null
	check(pool_ok, "재야 무장 풀: 시작 무장·성마다 숨은 인재가 도감에 있음")

	print("PROBE realm_data ", "OK" if fails == 0 else "FAIL %d" % fails)
	quit(1 if fails > 0 else 0)
