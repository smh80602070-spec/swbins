extends SceneTree

## 사가블로 회차 구조 — 부적 던전(dungeon_sigil_state.gd)·난입(dungeon_horde_state.gd)·월드 보스(dungeon_worldboss_state.gd)·유품 비율 자동 점검 — 화면 없는 순수 규칙. 씨앗 고정(20260824).
##   godot --headless --path saga-godot --script res://tools/probe_dungeon_run.gd
## ① 부적: 티어 1~10 으로 끼움·id 가 이어짐·모드 2~3개가 풀 안에서 겹치지 않고 id 로 결정적·저항 강화일 때만 저항 원소·최대 20개(넘으면 가장 옛것 버림·활성 번호도 한 칸 당김)·activate 규칙·배율(적 1+0.35×T · 금 1+0.25×T, 보물 ×1.5)·유리대포 공격 +50/받는 피해 -50·클리어하면 최고 티어 기록+다음 티어 60% 드랍·restore
## ② 난입: start/tick(30초마다 파도·900초에 끝)·파도 적 수 6+2w(상한 40)·티어 w/8·티어 배율·킬 경험치 곡선 lv²×10·즉석 3택이 비급을 빼고 난입 한정 카운트에만 쌓임·합산은 켜졌을 때만·finish 가 금(초당 15)·600초 이상이면 부적 1·기록·restore
## ③ 월드 보스: 15분 슬롯·3분 예고·보상은 슬롯마다 한 번(도망은 금 30%)·보스 층 = 깬 방 수+1·처치는 노획물과 부적(층 티어)
## ④ 유품: 사망 시 지갑 20% 를 걸고(player_health) 되찾는 금액은 set_grave 값 그대로. 상태는 끝에 되돌린다. 끝에 "PROBE dungeon_run OK" 또는 "PROBE dungeon_run FAIL n".

const Items := preload("res://games/saga_dungeon/data/dungeon_items.gd")

var fails := 0


func check(cond: bool, msg: String) -> void:
	if cond:
		print("  ok   ", msg)
	else:
		fails += 1
		print("  FAIL ", msg)


func _initialize() -> void:
	await process_frame
	seed(20260824)
	var S: Node = root.get_node("DungeonSigilState")
	var H: Node = root.get_node("DungeonHordeState")
	var W: Node = root.get_node("DungeonWorldBossState")
	var Run: Node = root.get_node("DungeonRunState")
	var Gold: Node = root.get_node("DungeonGoldState")
	var Save: Node = root.get_node("DungeonSaveState")
	var saved := {
		"sigils": S.sigils.duplicate(true), "active": S.active_index, "best": S.best_tier_cleared, "next": S._next_id,
		"gold": Gold.gold, "best_h": H.best_survive_sec, "runs": H.runs, "last": W.last_rewarded_slot, "rooms": Save.rooms_cleared.duplicate(), "boons": Run.boons.duplicate(),
	}
	Run.boons = {}

	# ① 부적 던전
	S.restore([], -1, 0, 1)
	var a: Dictionary = S.add_sigil(0)
	var b: Dictionary = S.add_sigil(99)
	var c: Dictionary = S.add_sigil(5)
	check(a.tier == 1 and b.tier == S.MAX_TIER and c.tier == 5 and a.id == 1 and b.id == 2 and c.id == 3 and S.next_id_for_save() == 4, "add_sigil: 티어는 1~10 으로 끼움 · id 가 1·2·3 으로 이어짐")
	var mods_ok := true
	var two := 0
	var all_mods := {}
	var res_ok := true
	for id in range(1, 1501):
		var m: Array[String] = S.roll_mods(id)
		var uniq := {}
		for k in m:
			uniq[k] = true
			all_mods[k] = true
			mods_ok = mods_ok and S.MOD_POOL.has(k)
		mods_ok = mods_ok and (m.size() == 2 or m.size() == 3) and uniq.size() == m.size() and m == S.roll_mods(id)
		if m.size() == 2:
			two += 1
		res_ok = res_ok and S.RESIST_BOOST_ELEMENTS.has(S.roll_resist_el(id)) and S.roll_resist_el(id) == S.roll_resist_el(id)
	check(mods_ok and res_ok and all_mods.size() == S.MOD_POOL.size() and two > 600 and two < 900, "모드 1500개 id: 2~3개·풀 안·겹침 없음·같은 id 면 같은 모드 · 6가지가 다 나옴 · 2개 %d/1500(약 50%%)" % two)
	var rs_ok := true
	for s: Dictionary in S.sigils:
		rs_ok = rs_ok and ((s.mods as Array).has("resist_boost") == (String(s.resist_el) != ""))
	check(rs_ok, "저항 원소는 저항 강화 모드가 있을 때만")
	check(not S.is_active() and S.active_sigil().is_empty() and S.enemy_stat_mult() == 1.0 and S.gold_mult() == 1.0 and S.world_eff_sum("atkPct") == 0.0 and not S.has_mod("swift") and S.resist_boost_el() == "", "비활성이면 배율 1 · 효과 0")
	var base_atk: float = Run.atk_mult()
	var base_guard: float = Run.guard_mult()
	S.sigils[2]["mods"] = ["glass_cannon", "treasure"] as Array[String]
	S.sigils[2]["resist_el"] = ""
	check(not S.activate(-1) and not S.activate(9) and S.activate(2) and not S.activate(0) and S.active_index == 2, "activate: 범위 밖 거절 · 이미 켜져 있으면 거절")
	check(absf(S.enemy_stat_mult() - (1.0 + 0.35 * 5)) < 1e-9 and absf(S.gold_mult() - (1.0 + 0.25 * 5) * 1.5) < 1e-9 and S.world_eff_sum("atkPct") == 50.0 and S.world_eff_sum("guardPct") == -50.0 and S.world_eff_sum("critPct") == 0.0 and S.has_mod("treasure") and not S.has_mod("swift"),
		"5티어 부적: 적 ×2.75 · 금 ×2.25×1.5(보물) · 유리대포 공격 +50/받는 피해 -50")
	check(absf(Run.atk_mult() - base_atk - 0.5) < 1e-9 and absf(Run.guard_mult() - base_guard - 0.5) < 1e-9, "합산 채널(DungeonRunState)이 유리대포를 읽음(공격 +50% · 받는 피해 +50%)")
	S.deactivate()
	check(not S.is_active() and S.enemy_stat_mult() == 1.0, "deactivate")
	S.restore([], -1, 0, 1)
	for i in 25:
		S.add_sigil(1 + i % 3)
	check(S.sigils.size() == S.MAX_SIGILS and S.sigils[0].id == 6 and S.sigils[19].id == 25 and S.next_id_for_save() == 26, "20개를 넘으면 가장 옛것을 버림(id 6~25 가 남음)")
	S.activate(10)
	var act_id: int = S.sigils[10].id
	S.add_sigil(1)
	check(S.active_index == 9 and S.sigils[9].id == act_id, "가득 찼을 때 새로 끼우면 활성 번호도 한 칸 당겨져 같은 부적을 가리킴(10→9)")
	S.restore([{"id": 1, "tier": 4, "mods": ["swift", "regen"], "resist_el": ""}, "junk"], 0, 3, -5)
	check(S.sigils.size() == 1 and S.active_index == 0 and S.best_tier_cleared == 3 and S.next_id_for_save() == 1, "restore: 깨진 칸은 거르고 id 는 1 이상")
	var drops := 0
	for n in 1000:
		S.restore([{"id": 1, "tier": 4, "mods": ["swift"], "resist_el": ""}], 0, 2, 1)
		S.clear_run()
		if S.sigils.size() == 2:
			drops += 1
			if S.sigils[1].tier != 5:
				drops = -99999
		if S.is_active() or S.best_tier_cleared != 4:
			drops = -99999
	check(drops > 540 and drops < 660, "클리어: 최고 티어 갱신(2→4) · 활성 해제 · 다음 티어(5) 부적 %d/1000(60%%)" % drops)
	S.restore([], -1, 7, 1)
	S.clear_run()
	check(S.best_tier_cleared == 7 and S.sigils.is_empty(), "활성 부적 없이 clear_run 은 아무 일 없음")

	# ② 난입
	H.restore(0, 0)
	check(H.start() and not H.start() and H.active and H.wave == 0 and H.kills == 0 and H.level == 1, "난입 start: 한 번만 true")
	check(H.tick(10.0) == "" and H.tick(19.9) == "" and H.tick(0.2) == "wave" and H.wave == 1 and H.tick(30.0) == "wave" and H.wave == 2, "30초마다 파도(tick 이 \"wave\")")
	H.elapsed = 899.0
	check(H.tick(0.5) != "finished" and H.tick(1.0) == "finished", "RUN_LIMIT_SEC(900)에서 finished")
	check(H.enemy_count_for_wave(0) == 6 and H.enemy_count_for_wave(5) == 16 and H.enemy_count_for_wave(17) == 40 and H.enemy_count_for_wave(99) == 40, "파도 적 수 6+2w · 상한 40")
	check(H.tier_for_wave(0) == 0 and H.tier_for_wave(7) == 0 and H.tier_for_wave(8) == 1 and H.tier_for_wave(16) == 2 and absf(H.enemy_stat_mult_for_wave(16) - 1.7) < 1e-9, "티어 = 파도/8 · 티어 2 는 적 ×1.7")
	var lv_up := false
	for i in 9:
		lv_up = lv_up or H.register_kill()
	var up10: bool = H.register_kill()
	check(not lv_up and up10 and H.level == 2 and H.xp == 0 and H.kills == 10, "킬 10(=1²×10)이면 레벨 2·경험치 0")
	for i in 39:
		H.register_kill()
	check(H.level == 2 and H.register_kill() and H.level == 3, "다음 레벨은 40킬(2²×10)")
	var pool_ok := true
	for n in 300:
		pool_ok = pool_ok and not H.roll_choice().has("skillpoint") and H.roll_choice().size() == 3
	var atk_before: float = Run.atk_mult()
	var got: Dictionary = H.apply_boon("fury")
	H.apply_boon("fury")
	check(pool_ok and got.key == "fury" and H.run_boons.get("fury") == 2 and Run.boons.is_empty() and H.apply_boon("skillpoint").key == "skillpoint" and not Run.boons.has("skillpoint"), "즉석 3택: 비급은 후보에서 빠지고 · 은사는 난입 한정 카운트(run_boons)에만 쌓임(영구 boons 불변)")
	check(H.world_eff_sum("atkPct") == 36.0 and absf(Run.atk_mult() - atk_before - 0.36) < 1e-9, "난입 중 맹공 2 = 공격 +36 (DungeonRunState 합산에도 얹힘)")
	H.active = false
	check(H.world_eff_sum("atkPct") == 0.0 and H.tick(5.0) == "" and not H.register_kill() and H.finish(true).is_empty(), "꺼져 있으면 합산 0 · tick/킬/finish 는 아무 일 없음")
	S.restore([], -1, 0, 1)
	Gold.gold = 0
	H.start()
	H.elapsed = 100.4
	var f1: Dictionary = H.finish(false)
	check(f1.gold == int(roundf(100.4 * 15.0)) and Gold.gold == f1.gold and not f1.sigil and S.sigils.is_empty() and not H.active and H.runs == 1 and H.best_survive_sec == 100, "finish: 금 = 생존초×15(%d) · 600초 미만이면 부적 없음 · 기록 갱신" % f1.gold)
	H.start()
	H.elapsed = 650.0
	var f2: Dictionary = H.finish(true)
	check(f2.sigil and S.sigils.size() == 1 and S.sigils[0].tier == 1 and H.best_survive_sec == 650 and H.runs == 2, "600초 이상이면 티어 1 부적 하나 · 최고 기록 650")
	H.start()
	H.elapsed = 30.0
	H.finish(false)
	check(H.best_survive_sec == 650 and H.runs == 3, "짧은 회차는 최고 기록을 안 깎음")
	H.restore(-5, -2)
	check(H.best_survive_sec == 0 and H.runs == 0, "restore 는 음수를 0 으로")

	# ③ 월드 보스
	check(W.SLOT_SEC == 900.0 and W.WARN_SEC == 180.0 and W.FIGHT_SEC == 75.0 and W.HP_MULT == 8.0 and W.LEGENDARY_MULT == 3.0 and W.FLEE_REWARD_PCT == 0.30, "상수: 15분 슬롯 · 3분 예고 · 75초 전투 · 체력 ×8 · 전설 ×3 · 도망 30%")
	var left: float = W.seconds_to_next_boundary()
	var slot: int = W.current_slot()
	check(left > 0.0 and left <= 900.0 and slot > 1_000_000 and W.is_warning() == (left <= 180.0), "슬롯: 다음 경계까지 0~900초 · 예고는 180초 이내")
	W.restore(-1)
	Save.rooms_cleared.assign([true, true, false, true])
	check(W.boss_floor_num() == 4 and not W.slot_already_rewarded(slot), "보스 층 = 깬 방 수(3)+1")
	Gold.gold = 0
	W.reward_flee(slot)
	var flee_gold: int = Gold.gold
	var expect: int = int(roundf(float(int(roundf(5.0 * pow(1.19, 3.0) * Run.gold_mult() * 5.0 * S.gold_mult()))) * 0.30))
	W.reward_flee(slot)
	check(flee_gold == expect and flee_gold > 0 and Gold.gold == flee_gold and W.slot_already_rewarded(slot) and W.last_rewarded_slot == slot, "도망 보상 = 보스 금(층 4)의 30%%(%d) · 같은 슬롯에서 두 번은 없음" % flee_gold)
	var parent := Node3D.new()
	root.add_child(parent)
	S.restore([], -1, 0, 1)
	W.reward_defeat(slot, parent, Vector3.ZERO)
	check(S.sigils.is_empty() and parent.get_child_count() == 0, "이미 보상한 슬롯에서는 처치 보상도 없음")
	W.restore(slot - 1)
	W.reward_defeat(slot, parent, Vector3(1, 0, 1))
	check(parent.get_child_count() >= 1 and S.sigils.size() == 1 and S.sigils[0].tier == 4 and W.last_rewarded_slot == slot, "처치 보상: 노획물이 서고 · 층(4) 티어 부적이 들어오고 · 슬롯 기록")
	parent.queue_free()

	# ④ 유품 비율
	var Health: GDScript = load("res://games/saga_dungeon/player/player_health.gd")
	check(Health.GRAVE_GOLD_LOSS_PCT == 0.20 and int(roundf(1234 * Health.GRAVE_GOLD_LOSS_PCT)) == 247, "사망 비용: 지갑 20%% (1234금 → 247금 유품)")

	S.restore(saved.sigils, saved.active, saved.best, saved.next)
	Gold.gold = saved.gold
	H.restore(saved.best_h, saved.runs)
	W.restore(saved.last)
	Save.rooms_cleared.assign(saved.rooms)
	Run.boons = saved.boons
	print("PROBE dungeon_run ", "OK" if fails == 0 else "FAIL %d" % fails)
	quit(1 if fails > 0 else 0)
