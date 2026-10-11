extends SceneTree

## 사가종횡 규칙 층(games/saga_story/data — story_combat.gd 표·공식, story_save_state.gd 거래·사명·업적·전직·무예 점수, *_map.gd 지도 아홉) 자동 점검 — 화면 없는 순수 규칙. 씨앗 고정(20260824).
##   godot --headless --path saga-godot --script res://tools/probe_story_rules.gd
## ① 지도 9(사냥터 넷+마을 다섯): 발판·밧줄/사다리가 폭 안·문 자리가 폭 안·월드 치수 = px×0.02 · 사냥터마다 stage_key 유일·잡졸 자리·레벨이 오름(1·6·14·26)·보스 체력 배율·재등장 시간이 오름 · 원거리 잡졸
## ② 장비: 밑감 40(부위 10 × 등급 4)·요구 레벨 1·5·12·20·등급이 오를수록 수치·값 오름·고유 10 은 밑감 위·gear_pool_for·gear_totals · 주문서 7(성공률↓ 수치↑)
## ③ 공식: 적 체력 18×1.22^(lv-1)·공격 4+1.6lv·방어 상한 60%·경험치 곡선·금·업적 8(공적 합 215 = 칭호 끝)·칭호·사명 13+반복 7·NPC 대사 4
## ④ 직업·무예: 1차 넷·2~4차 열둘(사슬·레벨 문턱·수치 오름) · 무예 표(키가 직업 표와 서로 맞물림·선행 무예·비용 ≤ 기력·쿨다운·배율) · 고유 조작 넷 · 스승(시드로 결정)
## ⑤ 상태: add_exp(여러 레벨)·장비 끼우기(레벨 문턱·주문서 초기화)·주문서·업적 한 번만·사명 자동 완수(한 번만)·반복/일일 사명·채집·전직(1차·진급·무예 문턱)·SP 투자(선행·만렙)·사제 유대 문턱·관문 대장 주간.
## 상태는 끝에 되돌린다. 끝에 "PROBE story_rules OK" 또는 "PROBE story_rules FAIL n".

const Combat := preload("res://games/saga_story/data/story_combat.gd")

const SAVED_VARS := ["level", "exp", "kills", "stage_kills", "visited_stages", "talks", "bosses", "feat", "achievements", "quests_done", "repeat_progress", "daily_done_day", "mats",
	"equipped", "gold", "job", "scroll_bonus", "scroll_left", "skills", "weekly_champion_week", "memory_fragments", "memory_tier", "mentor_bond", "sp_cut_lv", "sp_bonus", "skill_offers", "skill_free"]
const HUNT_MAPS := ["field", "forest", "cave", "gorge"]
const TOWN_MAPS := ["heodo", "gangneungjin", "gisanchae", "namjeongseong", "sinya"]

var fails := 0


func check(cond: bool, msg: String) -> void:
	if cond:
		print("  ok   ", msg)
	else:
		fails += 1
		print("  FAIL ", msg)


func _map(n: String) -> GDScript:
	return load("res://games/saga_story/data/%s_map.gd" % n)


func _fresh(S: Node, lv: int = 1, done: bool = true) -> void:
	S.level = lv
	S.exp = 0
	S.kills = 0
	S.stage_kills = {}
	S.visited_stages = {}
	S.talks = 0
	S.bosses = 0
	S.feat = 0
	S.achievements = {}
	S.quests_done = {}
	S.repeat_progress = {}
	S.daily_done_day = {}
	S.mats = {}
	S.equipped = {}
	S.gold = 0
	S.job = "none"
	S.scroll_bonus = {}
	S.scroll_left = {}
	S.skills = {}
	S.sp_cut_lv = 999   # G-0197 — 이 점검은 옛 규칙(레벨마다 SP)을 본다 · 3택은 probe_story_offers
	S.sp_bonus = 0
	S.skill_offers = []
	S.skill_free = {}
	S.mentor_bond = 0
	if done:
		_all_quests_done(S)
		S.achievements["a_quest10"] = true  # 사명 13 을 다 끝낸 걸로 두면 이 업적이 켜져 공적이 섞인다


func _all_quests_done(S: Node) -> void:
	for k in Combat.QUESTS:
		S.quests_done[k] = true


func _initialize() -> void:
	await process_frame
	seed(20260824)
	var S: Node = root.get_node("StorySaveState")
	var saved := {}
	for v in SAVED_VARS:
		var cur: Variant = S.get(v)
		saved[v] = cur.duplicate(true) if (cur is Dictionary or cur is Array) else cur

	# ① 지도
	var all_ok := true
	var keys := {}
	var prev_lv := 0.0
	var prev_hp := 0.0
	var prev_cool := 0.0
	var order_ok := true
	var bad: Array = []
	for n in HUNT_MAPS + TOWN_MAPS:
		var M: GDScript = _map(n)
		var consts: Dictionary = M.get_script_constant_map()
		var width: float = float(consts.WIDTH_PX)
		var ok: bool = width > 0.0 and float(consts.FLOOR_PX) > 0.0 and absf(float(M.call("width_m")) - width * 0.02) < 1e-6 and not (M.call("plats_m") as Array).is_empty() and (M.call("plats_m") as Array).size() == (consts.PLATS_PX as Array).size() \
			and (M.call("ropes_m") as Array).size() == (consts.ROPES_PX as Array).size()
		for p: Array in consts.PLATS_PX:
			ok = ok and float(p[0]) > 0.0 and float(p[0]) < width and float(p[1]) < float(consts.FLOOR_PX) and float(p[2]) > 0.0 and float(p[0]) + float(p[2]) * 0.5 <= width + 1.0
		var ropes_ok := true
		for r: Array in consts.ROPES_PX:
			ropes_ok = ropes_ok and float(r[0]) > 0.0 and float(r[0]) < width and float(r[1]) < float(r[2]) and float(r[2]) <= float(consts.FLOOR_PX) and ["rope", "ladder"].has(String(r[3]))
		ok = ok and ropes_ok
		for cname in consts:
			var cs := String(cname)
			if (cs.begins_with("PORTAL_") or cs.begins_with("ARRIVAL_") or cs.begins_with("MERCHANT_")) and cs.ends_with("_X_PX"):
				ok = ok and float(consts[cname]) > 0.0 and float(consts[cname]) < width
		if not ok:
			bad.append(n)
		if HUNT_MAPS.has(n):
			var key := String(M.call("stage_key"))
			keys[key] = true
			var lv := float(M.call("enemy_lv"))
			var hpm := float(M.call("boss_hp_mul"))
			var cool := float(M.call("boss_cool_sec"))
			order_ok = order_ok and lv > prev_lv and hpm > prev_hp and cool > prev_cool and key == n
			prev_lv = lv
			prev_hp = hpm
			prev_cool = cool
			var ex: Array = M.call("enemy_positions_m")
			var gx: Array = M.call("gather_positions_m")
			var bx: float = float(M.call("boss_position_m"))
			var hunt_ok: bool = ex.size() == 3 and not gx.is_empty() and bx > 0.0 and bx <= float(M.call("width_m")) and float(M.call("boss_dmg_mul")) >= 2.0
			for x in ex:
				hunt_ok = hunt_ok and float(x) > 0.0 and float(x) < float(M.call("width_m"))
			for g: Dictionary in gx:
				hunt_ok = hunt_ok and float(g.x) > 0.0 and float(g.x) < float(M.call("width_m")) and Combat.GATHER_INFO.has(String(g.kind))
			if not hunt_ok:
				bad.append(n + ":hunt")
	check(bad.is_empty(), "지도 9: 발판·밧줄·사다리·문·치수 · 사냥터는 잡졸 3·채집·보스 자리 유효 %s" % str(bad))
	check(keys.size() == 4 and order_ok, "사냥터 넷: stage_key 유일(=이름) · 잡졸 레벨·보스 체력 배율·재등장 시간이 1·6·14·26 순으로 오름")
	var ropes_kinds := {}
	for n in HUNT_MAPS + TOWN_MAPS:
		for r: Array in (_map(n).get_script_constant_map().ROPES_PX as Array):
			ropes_kinds[r[3]] = true
	check(ropes_kinds.has("rope") and ropes_kinds.has("ladder"), "밧줄과 사다리가 둘 다 있음")
	var ranged := 0
	for n in HUNT_MAPS:
		if bool(_map(n).call("enemy_is_ranged")):
			ranged += 1
	check(ranged >= 1 and ranged < 4 and Combat.RANGED_RANGE_M > 5.0 and Combat.RANGED_MUL < 1.0 and Combat.RANGED_CD_SEC > 1.0 and Combat.RANGED_SPD_M > 0.0 and Combat.RANGED_LIFE_SEC * Combat.RANGED_SPD_M >= Combat.RANGED_RANGE_M, "원거리 잡졸: 일부 사냥터만 · 사거리 7.2m·피해 ×0.8·쿨 2.2초 · 탄 수명이 사거리를 덮음(%d곳)" % ranged)

	# ② 장비
	var slots := {}
	var gear_ok := true
	var per_slot_tier := {}
	for key: String in Combat.GEAR_ITEMS:
		var it: Dictionary = Combat.GEAR_ITEMS[key]
		slots[it.slot] = int(slots.get(it.slot, 0)) + 1
		var tier := int(key.right(1))
		per_slot_tier["%s/%d" % [it.slot, tier]] = key
		gear_ok = gear_ok and [1, 5, 12, 20][tier - 1] == int(it.need) and int(it.up) >= 5 and int(it.price) > 0 and Combat.SLOT_LABEL.has(it.slot)
	check(Combat.GEAR_ITEMS.size() == 40 and slots.size() == 10 and slots.values().all(func(n): return n == 4) and gear_ok, "밑감 40: 부위 10 × 등급 4 · 요구 레벨 1·5·12·20 · 값·업횟·라벨")
	var mono_ok := true
	for slot in slots:
		for t in range(2, 5):
			var a: Dictionary = Combat.GEAR_ITEMS[per_slot_tier["%s/%d" % [slot, t - 1]]]
			var b: Dictionary = Combat.GEAR_ITEMS[per_slot_tier["%s/%d" % [slot, t]]]
			mono_ok = mono_ok and int(b.price) > int(a.price) and float(b.atk) + float(b.def) + float(b.hp) > float(a.atk) + float(a.def) + float(a.hp)
	check(mono_ok and Combat.ARMOR_SLOTS.size() == 9 and not Combat.ARMOR_SLOTS.has("weapon"), "등급이 오를수록 값·수치가 오름 · 방어구 부위 9(무기 제외)")
	var uniq_ok := Combat.UNIQUE_ITEMS.size() == 10
	for key: String in Combat.UNIQUE_ITEMS:
		var u: Dictionary = Combat.UNIQUE_ITEMS[key]
		var base: Dictionary = Combat.GEAR_ITEMS.get(String(u.base), {})
		uniq_ok = uniq_ok and not base.is_empty() and base.slot == u.slot and int(u.need) == 20 and int(u.price) > int(base.price) and float(u.atk) + float(u.def) + float(u.hp) > float(base.atk) + float(base.def) + float(base.hp) and int(u.up) >= int(base.up) and Combat.unique_for_base(String(u.base)) == key and Combat.item_def(key) == u
	check(uniq_ok and Combat.unique_for_base("sword1") == "" and Combat.item_def("zzz").is_empty() and Combat.UNIQUE_CHANCE == 0.16, "고유 10: 4등급 밑감 위 · 부위 같음 · 값·수치·업횟이 더 큼 · unique_for_base / item_def")
	var p1: Array = Combat.gear_pool_for(1.0)
	var p5: Array = Combat.gear_pool_for(2.0)
	var p20: Array = Combat.gear_pool_for(20.0)
	check(p1.size() == 10 and p5.size() == 20 and p20.size() == 40 and Combat.gear_pool_for(0.0).size() == 10 and Combat.GEAR_DROP_CHANCE_GRUNT < Combat.GEAR_DROP_CHANCE_BOSS, "드롭 풀: 레벨 1 은 1등급 10개 · 2 는 +2등급(요구 5 ≤ 레벨+3) · 20 은 전부 · 보스 드롭률이 높음")
	var tot: Dictionary = Combat.gear_totals(["sword1", "hat1", "u_sword", "zzz"])
	check(tot.atk == 4.0 + 56.0 and tot.def == 2.0 + 2.0 and tot.hp == 6.0 and Combat.gear_totals([]) == {"atk": 0.0, "def": 0.0, "hp": 0.0}, "gear_totals: 밑감·고유 합 · 모르는 키는 0")
	var sc_ok := Combat.SCROLLS.size() == 7
	for key: String in Combat.SCROLLS:
		var sc: Dictionary = Combat.SCROLLS[key]
		sc_ok = sc_ok and ["weapon", "armor"].has(String(sc["for"])) and float(sc.rate) > 0.0 and float(sc.rate) <= 1.0 and int(sc.price) > 0 and float(sc.atk) + float(sc.def) + float(sc.hp) > 0.0
	check(sc_ok and float(Combat.SCROLLS.atk10.atk) > float(Combat.SCROLLS.atk60.atk) and float(Combat.SCROLLS.atk60.atk) > float(Combat.SCROLLS.atk100.atk) and int(Combat.SCROLLS.atk10.price) > int(Combat.SCROLLS.atk60.price) and int(Combat.SCROLLS.hp10.price) > int(Combat.SCROLLS.hp60.price), "주문서 7: 성공률이 낮을수록 수치·값이 큼")

	# ③ 공식
	check(Combat.enemy_base_hp(1.0) == 18.0 and Combat.enemy_base_hp(10.0) == roundf(18.0 * pow(1.22, 9.0)) and Combat.enemy_base_hp(-5.0) >= 1.0 and Combat.enemy_base_dmg(1.0) == 6.0 and Combat.enemy_base_dmg(10.0) == 20.0, "적 체력 18×1.22^(lv-1) · 공격 4+1.6lv")
	check(Combat.damage_cut(0.0) == 0.0 and Combat.damage_cut(-5.0) == 0.0 and absf(Combat.damage_cut(40.0) - 0.5) < 1e-9 and Combat.damage_cut(9999.0) == 0.6 and Combat.damage_cut(20.0) < Combat.damage_cut(60.0), "방어: def/(def+40) · 상한 60%")
	check(Combat.exp_need(1) == 50 and Combat.exp_need(2) == 64 and Combat.exp_need(10) == roundi(50.0 * pow(1.28, 9.0)) and Combat.enemy_exp(false, 1.0) == 10 and Combat.enemy_exp(true, 1.0) == 150, "경험치: 필요 50·64… · 잡졸 10 · 보스 ×15")
	var gold_ok := true
	for n in 300:
		var g := Combat.roll_gold(false, 10.0)
		var b := Combat.roll_gold(true, 10.0)
		gold_ok = gold_ok and g >= roundi(36.0 * 0.8) and g <= roundi(36.0 * 1.4) and b >= roundi(36.0 * 0.8 * 12.0) and b <= roundi(36.0 * 1.4 * 12.0)
	check(gold_ok, "금: (6+3lv)×0.8~1.4 · 보스 ×12")
	var feat_sum := 0
	for key: String in Combat.ACHIEVES:
		feat_sum += int(Combat.ACHIEVES[key].feat)
	check(Combat.ACHIEVES.size() == 8 and feat_sum == 215 and Combat.TITLES[-1].at == 215 and Combat.title_for(0) == "무명(無名)" and Combat.title_for(19) == "무명(無名)" and Combat.title_for(20) == "유사(有司)" and Combat.title_for(214) == "제후(諸侯)" and Combat.title_for(215) == "패왕(霸王)", "업적 8 의 공적 합 215 = 칭호 끝(패왕) · 칭호 문턱")
	var q_ok := Combat.QUESTS.size() == 13 and Combat.REPEAT_QUESTS.size() == 7
	var daily := 0
	for tbl in [Combat.QUESTS, Combat.REPEAT_QUESTS]:
		for key: String in tbl:
			var q: Dictionary = tbl[key]
			q_ok = q_ok and int(q.need) >= 1 and int(q.n) > 0 and ["kill", "gather", "gear", "boss", "skill", "gold", "visit", "talk"].has(String(q.goal_type)) and int(q.exp) > 0 and (String(q.scroll) == "" or Combat.SCROLLS.has(String(q.scroll)))
			if q.has("stage"):
				q_ok = q_ok and HUNT_MAPS.has(String(q.stage))
			if bool(q.get("daily", false)):
				daily += 1
	check(q_ok and daily == 2, "사명 13 + 반복 7(일일 2): 목표 종류·보상 주문서·사냥터 이름이 표 안")
	var npc_ok := Combat.NPC_TALK.size() == 4
	for key: String in Combat.NPC_TALK:
		var nt: Dictionary = Combat.NPC_TALK[key]
		npc_ok = npc_ok and String(nt.name) != "" and String(nt.emoji) != "" and (nt.lines as Array).size() >= 3 and (nt.lines as Array).all(func(l): return String(l) != "")
	check(npc_ok and Combat.GATHER_INFO.size() == 4 and Combat.GATHER_RESPAWN_SEC > 0.0 and Combat.GATHER_RADIUS_M > 0.0, "NPC 대사 4명(각 3줄+) · 채집물 4종")

	# ④ 직업·무예
	var tiers := [Combat.JOBS_TIER1, Combat.JOBS_TIER2, Combat.JOBS_TIER3, Combat.JOBS_TIER4]
	var job_ok := true
	for t in 4:
		job_ok = job_ok and (tiers[t] as Dictionary).size() == 4
		for k: String in tiers[t]:
			job_ok = job_ok and Combat.job_tier(k) == t + 1 and String(Combat.job_info(k).name) != ""
			if t > 0:
				var below: String = Combat.job_prereq(k)
				var bi: Dictionary = Combat.job_info(below)
				var ki: Dictionary = Combat.job_info(k)
				job_ok = job_ok and Combat.job_tier(below) == t and float(ki.hp) > float(bi.hp) and float(ki.atk) > float(bi.atk) and float(ki.mp) >= float(bi.mp) and Combat.job_level_need(k) > Combat.job_level_need(below) and Combat.job_next(below) == k
	check(job_ok, "직업 16(4×4 갈래): 사슬(prereq)·tier·수치가 오르고 · 레벨 문턱이 오름 · job_next")
	check(Combat.job_chain("warlord") == ["warlord", "marshal", "general", "warrior"] and Combat.job_chain("none").is_empty() and Combat.job_root("ascendant") == "mage" and Combat.job_root("mage") == "mage" and Combat.job_level_need("warrior") == 10 and Combat.job_level_need("zzz") == 999999 and Combat.job_tier("zzz") == 0, "job_chain·job_root·레벨 문턱(1차 10)")
	var gr: Dictionary = Combat.job_grow_chain("general")
	check(gr.hp == 40.0 + 110.0 and gr.atk == 2.0 + 7.0 and gr.mp == 0.0 and Combat.job_grow_chain("none") == {"hp": 0.0, "atk": 0.0, "mp": 0.0} and Combat.job_grow_chain("sage").mp == 130.0 and Combat.job_advance_skill_gate("general") == 5 and Combat.job_advance_skill_gate("warlord") == 10 and Combat.job_advance_skill_gate("warrior") == 0, "사슬 수치 합(장군 hp 150·atk 9) · 진급 무예 문턱 5·8·10")
	var skill_ok := true
	var count := 0
	for job: String in Combat.JOB_SKILL_KEYS:
		var arr: Array = Combat.JOB_SKILL_KEYS[job]
		skill_ok = skill_ok and arr.size() >= 5 and arr.size() <= 6
		for k in arr:
			count += 1
			skill_ok = skill_ok and Combat.SKILL_JOB.get(k, "") == job
			if Combat.SKILL_NEED.has(k):
				var need: Dictionary = Combat.SKILL_NEED[k]
				skill_ok = skill_ok and int(need.lv) == 5 and Combat.job_chain(job).has(String(Combat.SKILL_JOB.get(need.key, "")))
	check(skill_ok and count == Combat.SKILL_JOB.size() and Combat.JOB_SKILL_KEYS.size() == 16, "무예 표: 직업 16 × 5~6(%d) · 키가 SKILL_JOB 과 서로 맞물림 · 선행 무예는 사슬 아래 직업의 5렙" % count)
	var combat_script: GDScript = Combat
	var consts: Dictionary = combat_script.get_script_constant_map()
	var cost_ok := true
	var cost_n := 0
	var per_n := 0
	for cname in consts:
		var cs := String(cname)
		if cs.ends_with("_COST") and consts[cname] is float:
			cost_n += 1
			cost_ok = cost_ok and float(consts[cname]) > 0.0 and float(consts[cname]) <= Combat.MP_MAX
		elif cs.ends_with("_CD") and consts[cname] is float:
			cost_ok = cost_ok and float(consts[cname]) > 0.0
		elif cs.ends_with("_PER") and consts[cname] is float:
			per_n += 1
			var base_name := cs.replace("_PER", "_BASE")
			cost_ok = cost_ok and consts.has(base_name) and float(consts[cname]) >= 0.0 and Combat.skill_mul(float(consts[base_name]), float(consts[cname]), 10) >= Combat.skill_mul(float(consts[base_name]), float(consts[cname]), 1)
	check(cost_ok and cost_n >= 20 and per_n >= 10 and Combat.MP_MAX == 100.0 and Combat.MP_REGEN == 8.0 and Combat.skill_mul(1.15, 0.09, 10) > 2.0, "무예 수치: 기력 비용 %d개 모두 0<비용≤100 · 쿨다운>0 · 레벨 10 배율 ≥ 레벨 1(×_PER %d개) · 기력 재생 8/초" % [cost_n, per_n])
	check(Combat.SIGNATURE_NAME.size() == 4 and Combat.SIGNATURE_MP_COST < Combat.MP_MAX and Combat.SIGNATURE_COOLDOWN > 0.0 and Combat.ARCHER_DRAW_MIN_SEC < Combat.ARCHER_DRAW_MAX_SEC and Combat.ARCHER_DRAW_MIN_MUL < Combat.ARCHER_DRAW_MAX_MUL and Combat.MAGE_ELEMENTS.size() == 3 and Combat.ROGUE_SHADOW_NEXT_MUL > 1.0 and Combat.WARRIOR_PARRY_NEXT_MUL > 1.0, "고유 조작 넷(받아치기·당기기·그림자 걷기·원소 전환) 상수")
	var mentor_ok := true
	for job: String in Combat.JOB_TIER:
		if job == "none":
			continue
		var m: Dictionary = Combat.mentor_of(job)
		mentor_ok = mentor_ok and not m.is_empty() and String(m.name) != "" and m == Combat.mentor_of(job)
	check(mentor_ok, "스승: 직업 16 모두 도감 인물을 시드로 결정(같은 직업이면 늘 같은 사람)")
	check(Combat.BOSS_HP_MUL == 12.0 and Combat.BOSS_DMG_MUL == 2.0 and Combat.BOSS_COOL_SEC == 900.0 and Combat.BRACE_COST < Combat.MP_MAX and Combat.SWEEP_COST < Combat.BOLT_COST, "기본 보스 ×12/×2 · 15분 · 기본 무예 비용 순서")

	# ⑤ 상태 — 경험치·장비
	_fresh(S)
	S.add_exp(49)
	var lv1: bool = S.level == 1 and S.exp == 49
	S.add_exp(1)
	var lv2: bool = S.level == 2 and S.exp == 0
	S.add_exp(Combat.exp_need(2) + Combat.exp_need(3) + 5)
	S.add_exp(0)
	S.add_exp(-9)
	check(lv1 and lv2 and S.level == 4 and S.exp == 5, "add_exp: 49→레벨 1 · 50→2 · 한 번에 두 레벨 · 남은 경험치 · 0·음수는 무시")
	_fresh(S)
	_all_quests_done(S)
	check(not S.equip_gear("sword2") and not S.equip_gear("zzz") and S.equip_gear("sword1") and S.equipped.weapon == "sword1" and S.scroll_left.weapon == 5 and not S.equip_gear("u_sword"), "끼우기: 요구 레벨 미달·모르는 키는 거절 · 목검은 업횟 5")
	S.scroll_bonus["weapon"] = {"atk": 3.0, "def": 0.0, "hp": 0.0}
	S.level = 5
	S.equip_gear("sword2")
	check(S.equipped.weapon == "sword2" and not S.scroll_bonus.has("weapon") and S.scroll_left.weapon == 6, "새 물건을 물리면 그 부위 주문서 값이 사라지고 업횟이 새로 참(환도 6)")
	S.equip_gear("hat1")
	var sw: Dictionary = Combat.SCROLLS.atk100
	var before_atk: float = S.gear_totals().atk
	check(S.can_scroll("weapon") and not S.can_scroll("top") and S.apply_scroll("weapon", sw) and S.scroll_left.weapon == 5 and S.gear_totals().atk == before_atk + 1.0, "주문서 100%%: 항상 성공 · 업횟 -1 · 합계에 반영(+1)")
	for i in 5:
		S.apply_scroll("weapon", sw)
	check(not S.can_scroll("weapon") and S.scroll_left.weapon == 0 and S.scroll_bonus.weapon.atk == 6.0, "업횟이 0 이면 더 못 부음(성공 6번 = +6)")
	var hits := 0
	for i in 1000:
		S.scroll_left["top"] = 1
		if S.apply_scroll("top", Combat.SCROLLS.def60):
			hits += 1
	check(hits > 540 and hits < 660, "주문서 60%%: 1000번 중 %d번 성공" % hits)
	# 업적·사명
	_fresh(S)
	_all_quests_done(S)
	S.kills = 99
	S.add_kill("field")
	var f1: int = S.feat
	S.add_kill("field")
	check(S.achievements.get("a_kill100", false) and f1 == 15 and S.feat == 15 and S.kills == 101 and S.stage_kills.field == 2, "업적 a_kill100: 100번째 킬에 한 번만(공적 +15) · 사냥터별 킬 수")
	S.gold = 4999
	S.add_gold(1)
	check(S.achievements.get("a_gold5000", false) and S.feat == 35 and not S.achievements.get("a_gear7", false), "업적 a_gold5000(금 5000) · 공적 합산")
	S.add_gold(-99999)
	check(S.gold == 0 and not S.spend_gold(1) and not S.spend_gold(0), "금은 0 아래로 안 내려감 · 모자라면 spend_gold 거절")
	S.gold = 100
	check(S.spend_gold(40) and S.gold == 60 and not S.spend_gold(61) and S.gold == 60, "spend_gold: 쓴 만큼만 줄고 모자라면 불변")
	_fresh(S, 1, false)
	for i in 9:
		S.add_kill()
	var before_done: bool = S.quests_done.get("q_first", false)
	S.add_kill()
	var lvl_after: int = S.level
	check(not before_done and S.quests_done.get("q_first", false) and S.gold == 200 and lvl_after == 2 and S.exp == 10, "사명 q_first: 10킬에 자동 완수 · 보상 금 200·경험치 60(→레벨 2)")
	var g_after: int = S.gold
	for i in 5:
		S.add_kill()
	check(S.gold == g_after and S.kills == 15, "한 번 낸 사명은 다시 안 줌")
	S.add_mat("herb", 14)
	var not_yet: bool = not S.quests_done.get("q_gather1", false) and S.gathered_total() == 14 and not S.gather_quest_done()
	S.add_mat("berry", 1)
	check(not_yet and S.quests_done.get("q_gather1", false) and S.gather_quest_done() and S.gathered_total() == 15, "q_gather1: 채집물 합 15 에서 완수(종류를 안 가림)")
	S.visit_stage("field")
	S.visit_stage("field")
	S.visit_stage("")
	S.add_talk()
	S.add_talk()
	check(S.visited_stages.size() == 1 and S.talks == 2, "방문은 사냥터마다 한 번만 · 말 걸기는 매번 셈")
	# 반복·일일
	_fresh(S, 3)
	_all_quests_done(S)
	for i in 60:
		S.add_kill()
	var today := int(Time.get_unix_time_from_system() / 86400.0)
	check(S.gold == 1500 + 900 + 900 and S.repeat_progress.d_hunt == 20 and S.daily_done_day.d_hunt == today and S.repeat_progress.r_hunt == 60, "반복·일일: 일일 토벌은 20킬에 하루 한 번(금 1500) · 토벌령은 30킬마다(30·60 에서 금 900 두 번)")
	_fresh(S, 3)
	_all_quests_done(S)
	S.daily_done_day["d_hunt"] = today - 1
	for i in 20:
		S.add_kill()
	check(S.daily_done_day.d_hunt == today and S.gold >= 1500, "다음 날이면 일일 사명이 다시 열림")
	# 전직
	_fresh(S, 9)
	check(not S.can_change_job() and not S.choose_job("warrior"), "9레벨에는 전직 못 함")
	S.level = 10
	check(S.can_change_job() and not S.choose_job("general") and S.choose_job("mage") and S.job == "mage" and not S.can_change_job() and not S.choose_job("warrior"), "10레벨 1차 전직: 1차 직업만 · 한 번 정하면 되돌릴 수 없음")
	check(S.job_grow() == {"hp": 12.0, "atk": 3.0, "mp": 40.0}, "전직 후 사슬 수치 합")
	_fresh(S, 25)
	S.job = "warrior"
	S.skills = {"w_cut": 4}
	var no_gate: bool = not S.can_advance_job("general")
	S.skills = {"w_cut": 5}
	check(no_gate and S.can_advance_job("general") and not S.can_advance_job("sage") and not S.can_advance_job("marshal") and S.advance_job("general") and S.job == "general" and not S.advance_job("general"), "2차 진급: 무예 5렙 문턱 · 바로 다음 사슬만 · 직업 바뀜")
	S.level = 24
	S.job = "warrior"
	check(not S.can_advance_job("general"), "레벨 문턱(25)에 못 미치면 진급 못 함")
	# SP
	_fresh(S, 10)
	S.job = "warrior"
	check(S.sp_total() == 27 and S.sp_left() == 27 and S.sp_spent() == 0 and not S.can_raise_skill("a_shot") and not S.can_raise_skill("zzz") and S.can_raise_skill("w_cut"), "SP: (레벨-1)×3 = 27 · 사슬 밖 무예·모르는 키는 못 올림")
	for i in 12:
		S.raise_skill("w_cut")
	check(S.skill_level("w_cut") == Combat.SKILL_MAX_LEVEL and S.sp_spent() == 10 and S.sp_left() == 17 and not S.raise_skill("w_cut"), "무예는 만렙 10 에서 멈춤")
	S.level = 25
	S.job = "general"
	S.skills = {"w_cut": 4}
	var need_blocks: bool = not S.can_raise_skill("g_smash")
	S.skills = {"w_cut": 5}
	check(need_blocks and S.can_raise_skill("g_smash") and S.can_raise_skill("w_cut") and S.raise_skill("g_smash") and S.skill_level("g_smash") == 1 and not S.can_raise_skill("n_heaven"), "선행 무예(베기 5렙)가 있어야 장군 무예 · 하위 직업 무예에도 계속 투자 · 윗 직업 무예는 못 올림")
	S.skills = {"w_cut": 10, "w_whirl": 10, "w_rush": 10, "w_iron": 10, "w_edge": 10, "w_vital": 10}
	S.level = 2
	check(S.sp_left() == 0 and not S.can_raise_skill("g_smash") and not S.can_raise_skill("w_cut"), "점수가 없으면 못 올림(sp_left 0)")
	# 사제 유대
	_fresh(S, 10)
	S.add_mentor_bond(30)
	check(S.mentor_bond == 0, "전직 전에는 사제 유대가 안 쌓임")
	S.choose_job("archer")
	S.gold = 0
	S.add_mentor_bond(19)
	S.add_mentor_bond(1)
	S.add_mentor_bond(40)
	var g50: int = S.gold
	S.add_mentor_bond(49)
	S.add_mentor_bond(0)
	S.add_mentor_bond(-5)
	check(g50 == 0 and S.mentor_bond == 109 and S.gold == 200 and S.MENTOR_BOND_MAX_GOLD == 200, "사제 유대 20·50·100: 마지막 문턱에서 사례금 200 한 번만")
	S.job = "archer"
	S.level = 30
	S.skills = {"a_shot": 5}
	S.advance_job("sniper")
	check(S.mentor_bond == 0 and S.job == "sniper", "진급하면 스승이 바뀌어 유대가 0 으로")
	# 관문 대장
	S.weekly_champion_week = {}
	var avail0: bool = S.champion_available("cave")
	S.claim_champion("cave")
	check(avail0 and not S.champion_available("cave") and S.champion_available("forest"), "관문 대장: 한 주에 사냥터마다 한 번")
	S.weekly_champion_week["cave"] = S.current_week() - 1
	check(S.champion_available("cave"), "다음 주엔 다시 도전 가능")
	# 비경 기억 조각
	S.memory_fragments = 0
	S.memory_tier = 0
	check(not S.can_upgrade_memory() and S.memory_hp_mult() == 1.0, "기억 조각이 없으면 단을 못 올림 · 체력 ×1.0")

	for v in SAVED_VARS:
		S.set(v, saved[v])
	print("PROBE story_rules ", "OK" if fails == 0 else "FAIL %d" % fails)
	quit(1 if fails > 0 else 0)
