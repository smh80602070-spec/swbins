extends SceneTree

## 사가종횡 비경(games/saga_story/data/story_labyrinth.gd 축복 9·노드·주간 보정·기억 조각 비용, story_labyrinth_state.gd 회차 상태, story_save_state.gd 기억 조각·단·주문서 보상) 자동 점검 — 화면 없는 순수 규칙. 씨앗 고정(20260824).
##   godot --headless --path saga-godot --script res://tools/probe_story_labyrinth.gd
## ① 축복 9: 키 유일·세 축(atk·def·util) 셋씩·희귀도·상한·설명·효과 ② roll_choice 600번: 카드 셋·겹침 없음·세 축에서 하나씩·상한 찬 것 제외·축이 다 차면 나머지에서 채움·전부 차면 빈 손·희귀도(common > rare)
## ③ 노드: 종류 5·아이콘/이름·한 층에 2~3개(겹침 없음)·5층(노드 4 + 보스) ④ 주간 보정: 짝수 주만 적 체력 ×1.3·보상 ×1.5 ⑤ 기억 조각: 단 비용 3·6·9…·10단 상한·단마다 체력 +2%%
## ⑥ 회차 상태: start_run 비움·apply_boon 상한·합산(공격·속도·사거리·받는 피해(하한 0.2)·보상)·end_run 조각 = 깬 층 + 보스 클리어 1 + 기억 축복 · 기억 조각 쌓기/올리기(비용·단·체력 배율) · 주문서 보상(낄 수 있는 부위에 하나).
## 상태는 끝에 되돌린다. 끝에 "PROBE story_labyrinth OK" 또는 "PROBE story_labyrinth FAIL n".

const Lab := preload("res://games/saga_story/data/story_labyrinth.gd")

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
	var R: Node = root.get_node("StoryLabyrinthState")
	var S: Node = root.get_node("StorySaveState")
	var saved := {"frag": S.memory_fragments, "tier": S.memory_tier, "eq": S.equipped.duplicate(), "sb": S.scroll_bonus.duplicate(true), "sl": S.scroll_left.duplicate(), "level": S.level,
		"wk": S.weekly_champion_week.duplicate(), "in_run": R.in_run, "floor": R.floor_index, "boons": R.boons.duplicate()}

	# ① 축복
	var keys := {}
	var axes := {}
	var rar := {}
	var ok := true
	for b: Dictionary in Lab.BLESSINGS:
		keys[b.key] = true
		axes[b.axis] = int(axes.get(b.axis, 0)) + 1
		rar[b.rarity] = int(rar.get(b.rarity, 0)) + 1
		ok = ok and int(b.max) >= 1 and String(b.name) != "" and String(b.desc) != "" and String(b.emoji) != "" and (b.eff as Dictionary).size() == 1
	check(ok and keys.size() == 9 and axes == {"atk": 3, "def": 3, "util": 3} and rar.has("common") and rar.has("rare") and Lab.by_key("fury").max == 5 and Lab.by_key("zzz").is_empty(), "축복 9: 키 유일 · 축 셋(공·방·보조)에 셋씩 · 희귀도 · 상한 · 설명 · 효과")

	# ② roll_choice
	var bad := 0
	var by_rar := {"common": 0, "rare": 0}
	for n in 600:
		var c: Array[String] = Lab.roll_choice({})
		var seen_axes := {}
		var uniq := {}
		for k in c:
			uniq[k] = true
			seen_axes[Lab.by_key(k).axis] = true
			by_rar[Lab.by_key(k).rarity] += 1
		if not (c.size() == 3 and uniq.size() == 3 and seen_axes.size() == 3):
			bad += 1
	check(bad == 0 and by_rar.common > by_rar.rare and by_rar.rare > 0, "roll_choice 600번: 카드 셋·겹침 없음·세 축에서 하나씩(탈락 %d) · common > rare %s" % [bad, str(by_rar)])
	var capped := {}
	for b: Dictionary in Lab.BLESSINGS:
		if b.axis == "def":
			capped[b.key] = b.max
	var free_ok := true
	var fill_ok := true
	for n in 200:
		var c2: Array[String] = Lab.roll_choice(capped)
		fill_ok = fill_ok and c2.size() == 3
		for k in c2:
			free_ok = free_ok and Lab.by_key(k).axis != "def"
	var all_full := {}
	for b: Dictionary in Lab.BLESSINGS:
		all_full[b.key] = b.max
	var one_left := all_full.duplicate()
	one_left.erase("dash")
	var last: Array[String] = Lab.roll_choice(one_left)
	check(free_ok and fill_ok and Lab.roll_choice(all_full).is_empty() and last == ["dash"], "한 축이 다 차면 그 축 은사는 안 나오고 나머지에서 셋을 채움 · 전부 차면 빈 손 · 하나만 남으면 그것만")

	# ③ 노드
	var nodes_ok: bool = Lab.NODE_TYPES.size() == 5 and Lab.FLOOR_COUNT == 5
	for t in Lab.NODE_TYPES:
		nodes_ok = nodes_ok and Lab.NODE_ICON.has(t) and Lab.NODE_LABEL.has(t)
	var sizes := {}
	var node_roll_ok := true
	for n in 300:
		var nn: Array[String] = Lab.roll_floor_nodes()
		sizes[nn.size()] = true
		var u := {}
		for t in nn:
			u[t] = true
			node_roll_ok = node_roll_ok and Lab.NODE_TYPES.has(t)
		node_roll_ok = node_roll_ok and u.size() == nn.size() and (nn.size() == 2 or nn.size() == 3)
	check(nodes_ok and node_roll_ok and sizes.has(2) and sizes.has(3) and sizes.size() == 2, "노드 5종(아이콘·이름) · 한 층에 2~3개(겹침 없음) · 노드 4층 + 보스 1층")

	# ④ 주간 보정·기억 조각 비용
	check(Lab.weekly_modifier_active(0) and not Lab.weekly_modifier_active(1) and Lab.weekly_modifier_active(2802) and Lab.WEEKLY_ENEMY_HP_MUL == 1.3 and Lab.WEEKLY_REWARD_MUL == 1.5, "주간 보정: 짝수 주만 · 적 체력 ×1.3 · 보상 ×1.5")
	check(Lab.memory_upgrade_cost(0) == 3 and Lab.memory_upgrade_cost(1) == 6 and Lab.memory_upgrade_cost(9) == 30 and Lab.MEMORY_TIER_MAX == 10 and Lab.MEMORY_HP_PCT_PER_TIER == 2.0, "기억 조각 단 비용 3·6·…·30 · 10단 상한 · 단마다 체력 +2%")

	# ⑥ 회차 상태
	R.boons = {"fury": 9}
	R.floor_index = 3
	R.start_run()
	check(R.in_run and R.floor_index == 0 and R.boons.is_empty(), "start_run: 회차 시작 · 층 0 · 축복 비움")
	var base := {"atk": R.atk_mult(), "spd": R.atk_speed_mult(), "move": R.move_speed_mult(), "reach": R.reach_mult(), "taken": R.dmg_taken_mult(), "reward": R.reward_mult(), "wk": R.weekly_enemy_hp_mult()}
	check(R.apply_boon("zzz").is_empty() and R.apply_boon("fury").key == "fury" and R.boons.fury == 1, "apply_boon: 모르는 키 거절 · 하나씩 쌓임")
	for i in 7:
		R.apply_boon("fury")
	check(R.boons.fury == 5 and R.apply_boon("fury").is_empty(), "상한(맹공 5)에서 막힘")
	R.boons = {"fury": 2, "haste": 1, "dash": 3, "reach": 2, "wall": 2, "fortune": 2}
	var near := func(a: float, b: float) -> bool: return absf(a - b) < 1e-6
	check(near.call(R.atk_mult(), 1.30) and near.call(R.atk_speed_mult(), 1.12) and near.call(R.move_speed_mult(), 1.45) and near.call(R.reach_mult(), 1.40) and near.call(R.dmg_taken_mult(), 0.76), "합산: 공격 +30% · 속도 +12% · 이동 +45% · 사거리 +40% · 받는 피해 -24%")
	var wk_even: bool = Lab.weekly_modifier_active(S.current_week())
	var rw_expect: float = 1.5 * (1.5 if wk_even else 1.0)
	check(near.call(R.reward_mult(), rw_expect) and near.call(R.weekly_enemy_hp_mult(), 1.3 if wk_even else 1.0), "보상 배율: 재물운 2 = ×1.5 (짝수 주면 ×1.5 더) · 적 체력 주간 보정이 이번 주(%s)와 맞음" % ("짝수" if wk_even else "홀수"))
	R.boons = {"wall": 5, "fury": 5}
	check(R.dmg_taken_mult() == maxf(0.2, 1.0 - 0.60) and near.call(R.dmg_taken_mult(), 0.4), "받는 피해 감소 5겹 = -60%")
	R.boons = {"wall": 99}
	check(R.dmg_taken_mult() == 0.2, "받는 피해는 0.2 아래로 안 내려감")
	# end_run
	S.memory_fragments = 0
	R.in_run = true
	R.boons = {}
	R.floor_index = 3
	var f1: int = R.end_run(false)
	check(f1 == 3 and S.memory_fragments == 3 and not R.in_run and R.floor_index == 0 and R.boons.is_empty(), "회차 끝(실패): 조각 = 깬 층 수(3) · 상태 초기화")
	R.in_run = true
	R.floor_index = 4
	R.boons = {"memory": 2}
	var f2: int = R.end_run(true)
	check(f2 == 4 + 1 + 2 and S.memory_fragments == 3 + 7, "회차 끝(보스 클리어): 조각 = 4 + 1 + 기억 축복 2 = 7")
	var f0: int = S.memory_fragments
	S.add_memory_fragments(0)
	S.add_memory_fragments(-4)
	check(S.memory_fragments == f0, "조각 0·음수는 무시")
	# 단 올리기
	S.memory_tier = 0
	S.memory_fragments = 2
	check(not S.can_upgrade_memory() and not S.upgrade_memory() and S.memory_tier == 0 and S.memory_hp_mult() == 1.0, "조각이 모자라면 단을 못 올림")
	S.memory_fragments = 10
	check(S.can_upgrade_memory() and S.upgrade_memory() and S.memory_tier == 1 and S.memory_fragments == 7 and near.call(S.memory_hp_mult(), 1.02), "1단: 조각 3 을 내고 체력 +2%")
	check(S.upgrade_memory() and S.memory_tier == 2 and S.memory_fragments == 1 and not S.can_upgrade_memory() and near.call(S.memory_hp_mult(), 1.04), "2단: 조각 6 · 남은 1 로는 3단(9) 못 올림")
	S.memory_tier = Lab.MEMORY_TIER_MAX
	S.memory_fragments = 9999
	check(not S.can_upgrade_memory() and not S.upgrade_memory() and near.call(S.memory_hp_mult(), 1.20), "10단이 끝(체력 +20%)")
	# 주문서 보상
	S.equipped = {}
	S.scroll_bonus = {}
	S.scroll_left = {}
	S.grant_labyrinth_scroll()
	check(S.scroll_bonus.is_empty(), "낄 수 있는 부위가 없으면 조용히 건너뜀")
	S.level = 30
	S.equip_gear("sword1")
	S.equip_gear("hat1")
	var left_before: int = int(S.scroll_left.weapon) + int(S.scroll_left.hat)
	for i in 12:
		S.grant_labyrinth_scroll()
	var left_after: int = int(S.scroll_left.weapon) + int(S.scroll_left.hat)
	check(left_after < left_before and left_after >= 0, "주문서 보상: 낀 장비의 업횟이 줄며 적용(%d → %d)" % [left_before, left_after])

	R.in_run = saved.in_run
	R.floor_index = saved.floor
	R.boons = saved.boons
	S.memory_fragments = saved.frag
	S.memory_tier = saved.tier
	S.equipped = saved.eq
	S.scroll_bonus = saved.sb
	S.scroll_left = saved.sl
	S.level = saved.level
	S.weekly_champion_week = saved.wk
	print("PROBE story_labyrinth ", "OK" if fails == 0 else "FAIL %d" % fails)
	quit(1 if fails > 0 else 0)
