extends SceneTree

## G-0219 5천하 AI 세력 경륜도(data/realm_ai_statecraft.gd · RealmSaveState.ai_passive · 달 넘김·AI 출병·수비·성장) 자동 점검.
##   godot --headless --path saga-godot --script res://tools/probe_realm_ai_statecraft.gd
## ① 해시 = 웹 hashOf · 시작점 성향별(CREED_START[성향][hash%2]) ② 점수 = 1 + 이긴 출병 + ⌊달/6⌋(상한 56) · 찍기는 결정적(두 번 같은 결과)·테마 이름난 마디부터
## ③ 20마디 넘으면 성향 규칙 하나 ④ 효과 식(출병·받는 피해·성장 배수) · 빈 세력 = 1 ⑤ 성장 — 같은 난수에서 보안 성장이 gov 배수만큼
## ⑥ AI 출병 — 같은 난수에서 공격 배수가 오르면 우리 손실이 는다 · 이기면 won+1 ⑦ 달 넘김 찍기 — 살아 있는 세력마다 시작점 ⑧ 세이브 왕복·옛 20 빈 칸.
## 끝에 "PROBE realm_ai_statecraft OK" 또는 "PROBE realm_ai_statecraft FAIL n".

var fails := 0


func check(cond: bool, msg: String) -> void:
	if cond:
		print("  ok   ", msg)
	else:
		fails += 1
		print("  FAIL ", msg)


func _initialize() -> void:
	await process_frame
	var RS: Node = root.get_node("RealmSaveState")
	var AI: GDScript = load("res://games/saga_realm/data/realm_ai_statecraft.gd")
	var Cities: GDScript = load("res://games/saga_realm/data/realm_cities.gd")
	var saved := {"enemies": (RS.enemies as Dictionary).duplicate(true), "cities": (RS.cities as Dictionary).duplicate(true), "year": RS.year, "month": RS.month,
		"scen": RS.scenario_id, "ai": (RS.ai_passive as Dictionary).duplicate(true), "path": RS.path_override}
	RS.ai_passive = {}
	RS._ai_apis = {}

	# ① 해시·시작점
	var h_ok: bool = AI.hash_of("shao") == 3529027 and AI.hash_of("zan") == 120359 and AI.hash_of("rong") == 3506358 and AI.hash_of("biao") == 3023541
	var starts_ok: bool = AI.creed_start("shao") == "talent" and AI.creed_start("zan") == "schemer" and AI.creed_start("rong") == "builder" and AI.creed_start("biao") == "diplomat"
	check(h_ok and starts_ok, "① 해시 = 웹 hashOf · 시작점 원소(균형)→인재 · 공손(공세)→모사 · 공융(수비)→축성 · 유표(수비)→종횡가")

	# 실제 세력 하나(성이 있는) — 공세 성향이면 좋다
	var eid := ""
	var fid := ""
	var ids: Array = (RS.enemies as Dictionary).keys()
	ids.sort()
	for k: String in ids:
		var f: String = RS.force_of(k)
		if f != "" and not (RS.enemies[k].get("officers", []) as Array).is_empty() and (fid == "" or (Cities.creed_of(f) == "aggressive" and Cities.creed_of(fid) != "aggressive")):
			eid = k
			fid = f
	RS.scenario_id = "194"
	RS.year = 197
	RS.month = 1
	# ② 점수·찍기
	var pts: int = AI.points_total(RS, fid)
	var n1: int = AI.spend(RS, fid)
	var st: Dictionary = RS.ai_passive[fid]
	var taken1: Array = (st.taken as Array).duplicate()
	var theme: Array = AI.THEME[AI.creed_start(fid)]
	var a: RefCounted = RS.ai_passive_api(fid)
	var themed := taken1.any(func(id): return String(a.node(id).k) == "n" and (a.node(id).get("stats", {}) as Dictionary).keys().any(func(k): return theme.has(k)))
	RS.ai_passive = {}
	RS._ai_apis = {}
	AI.spend(RS, fid)
	var same: bool = (RS.ai_passive[fid].taken as Array) == taken1
	st = RS.ai_passive[fid]
	st["won"] = 200
	var cap: int = AI.points_total(RS, fid)
	st["won"] = 0
	check(pts == 1 + 36 / 6 and n1 == pts and String(st.start) == AI.creed_start(fid) and themed and same and cap == 56,
		"② %s(%s) 점수 %d(=1+36달/6) · %d마디 찍음 · 시작점 %s · 테마 이름난 마디 · 두 번 같은 결과 · 상한 %d" % [fid, Cities.creed_of(fid), pts, n1, st.start, cap])

	# ③ 20마디 넘으면 성향 규칙
	st["won"] = 40
	AI.spend(RS, fid)
	a = RS.ai_passive_api(fid)
	var key: String = AI.creed_key(fid)
	check(a.used() > 20 and a.is_taken(key) and AI.rule_name(RS, fid) != "", "③ %d마디 — 성향 규칙 %s(%s) 익힘" % [a.used(), key, AI.rule_name(RS, fid)])

	# ④ 효과 식
	var pct := func(k: String) -> float: return 1.0 + float(a.sum(k)) / 100.0
	var r: Dictionary = AI.fx(RS, fid).rules
	var e_atk: float = pct.call("atkPct") * (0.8 if r.cheolgi else 1.0)
	var e_gov: float = pct.call("govPct") * (2.0 if r.muwi else 1.0) * (0.8 if r.cheongya else 1.0) * (1.5 if r.tunjeon else 1.0)
	var e_ok: bool = is_equal_approx(AI.mul(RS, fid, "atk"), e_atk) and is_equal_approx(AI.mul(RS, fid, "take"), maxf(0.5, 1.0 - a.sum("defPct") / 100.0)) \
		and is_equal_approx(AI.order_mul(RS, fid, "sec"), e_gov) and is_equal_approx(AI.order_mul(RS, fid, "wall"), pct.call("wallPct")) \
		and AI.mul(RS, fid, "atk") != 1.0 and AI.mul(RS, "nobody_force", "atk") == 1.0
	check(e_ok, "④ 공격 ×%.2f · 받는 피해 ×%.2f · 보안·기술 ×%.2f · 성벽 ×%.2f · 훈련 ×%.2f · 빈 세력 = 1" % [AI.mul(RS, fid, "atk"), AI.mul(RS, fid, "take"), e_gov, AI.order_mul(RS, fid, "wall"), AI.order_mul(RS, fid, "train")])

	# ⑤ 성장 — 같은 난수
	var e0: Dictionary = (saved.enemies[eid] as Dictionary).duplicate(true)
	e0["sec"] = 90   # 보안이 차 있으면 성벽부터(_enemy_pick_order)
	e0["wall"] = 0
	var grow := func() -> int:
		for k: String in ids:
			RS.enemies[k] = (saved.enemies[k] as Dictionary).duplicate(true)
			RS.enemies[k]["captured"] = k != eid
		RS.enemies[eid] = e0.duplicate(true)
		RS._rng.seed = 20260824
		RS._run_enemy_economy()
		return int(RS.enemies[eid].wall)
	var keep_ai: Dictionary = (RS.ai_passive as Dictionary).duplicate(true)
	RS.ai_passive = {}
	RS._ai_apis = {}
	var g0: int = grow.call()
	RS.ai_passive = keep_ai
	RS._ai_apis = {}
	var gm: float = AI.order_mul(RS, fid, "wall")
	var g1: int = grow.call()
	check(g0 > 0 and gm != 1.0 and g1 == roundi(float(g0) * gm), "⑤ 성벽 성장 %d → %d(×%.2f)" % [g0, g1, gm])

	# ⑥ AI 출병 — 같은 난수에서 우리 손실
	var target: String = (RS.cities as Dictionary).keys()[0]
	var hit := func() -> Array:
		RS.cities = (saved.cities as Dictionary).duplicate(true)
		RS.cities[target]["troops"] = 12000
		var e: Dictionary = (saved.enemies[eid] as Dictionary).duplicate(true)
		e["troops"] = 20000
		RS.enemies[eid] = e
		RS._rng.seed = 7
		var before := int(RS.cities[target].troops)
		RS._enemy_attack(eid, e, target)
		return [before - int(RS.cities[target].troops), int((RS.ai_passive.get(fid, {}) as Dictionary).get("won", 0))]
	RS.ai_passive = {}
	RS._ai_apis = {}
	var l0: Array = hit.call()
	RS.ai_passive = keep_ai
	RS._ai_apis = {}
	a = RS.ai_passive_api(fid)
	for nd: Dictionary in a.def.nodes:   # 공격 마디를 몇 더(점수 늘려)
		if (nd.get("stats", {}) as Dictionary).has("atkPct") and a.left() > 0:
			a.take_path(String(nd.id))
	var l1: Array = hit.call()
	var stronger: bool = AI.mul(RS, fid, "atk") > 1.0
	check(stronger and int(l1[0]) != int(l0[0]) and (int(l1[0]) > int(l0[0]) or AI.mul(RS, fid, "take") < 1.0) and int(l1[1]) >= 0,
		"⑥ 같은 난수 — 우리 손실 %d → %d(AI 공격 ×%.2f) · 이긴 출병 won %d" % [int(l0[0]), int(l1[0]), AI.mul(RS, fid, "atk"), int(l1[1])])

	# ⑦ 달 넘김 찍기
	for k: String in ids:
		RS.enemies[k] = (saved.enemies[k] as Dictionary).duplicate(true)
	RS.ai_passive = {}
	RS._ai_apis = {}
	RS._run_enemy_statecraft()
	var forces := {}
	for k: String in ids:
		if RS.force_of(k) != "" and not bool(RS.enemies[k].get("captured", false)):
			forces[RS.force_of(k)] = true
	var all_started := forces.keys().all(func(f): return RS.ai_passive.has(f) and RS.ai_passive[f].start == AI.creed_start(String(f)))
	check(forces.size() > 0 and all_started, "⑦ 달 넘김 — 살아 있는 세력 %d 곳 전부 성향 시작점에서 찍음" % forces.size())

	# ⑧ 세이브 왕복·옛 세이브
	RS.path_override = "user://probe_ai_statecraft_save.json"
	var keep_taken: Array = (RS.ai_passive[fid].taken as Array).duplicate()
	var saved_ok: bool = RS.save()
	RS.ai_passive = {}
	var load_ok: bool = RS.try_load()
	var round_ok: bool = RS.ai_passive.has(fid) and (RS.ai_passive[fid].taken as Array) == keep_taken
	var f := FileAccess.open(RS.path_override, FileAccess.READ)
	var d: Dictionary = JSON.parse_string(f.get_as_text())
	f.close()
	d.erase("ai_passive")
	d["version"] = 20
	f = FileAccess.open(RS.path_override, FileAccess.WRITE)
	f.store_string(JSON.stringify(d))
	f.close()
	var old_ok: bool = RS.try_load()
	var old_empty: bool = (RS.ai_passive as Dictionary).is_empty()
	DirAccess.remove_absolute(ProjectSettings.globalize_path(RS.path_override))
	check(saved_ok and load_ok and round_ok and old_ok and old_empty and RS.SAVE_VERSION >= 21, "⑧ 세이브 왕복(%s %d마디) · 옛 20 → 빈 칸 · 버전 21 이상(G-0234 에 22)" % [fid, keep_taken.size()])

	RS.enemies = saved.enemies
	RS.cities = saved.cities
	RS.year = saved.year
	RS.month = saved.month
	RS.scenario_id = saved.scen
	RS.ai_passive = saved.ai
	RS._ai_apis = {}
	RS.path_override = saved.path
	print("PROBE realm_ai_statecraft OK" if fails == 0 else "PROBE realm_ai_statecraft FAIL %d" % fails)
	quit(1 if fails > 0 else 0)
