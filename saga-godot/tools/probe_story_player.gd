extends SceneTree

## 사가종횡 플레이어(games/saga_story/player/story_player.gd·story_player_base.gd) 이동 손맛·직업 고유 조작·피해 규칙 자동 점검 — StoryPlayer 씬을 세워 규칙 함수만 부른다(그림·물리 바닥은 안 봄). 씨앗 고정(20260824).
##   godot --headless --path saga-godot --script res://tools/probe_story_player.gd
## ① 이동 손맛: 코요테 0.1초·점프 선입력 0.12초 — 공중에서 코요테가 남았고 선입력이 있으면 점프(속도 15·두 값 소모)·코요테가 없으면 안 뜀·선입력은 시간이 지나면 사라짐·코요테는 공중에서 줄어듦·탈것 점프 배율 · 점프 높이 15²/(2×36)=3.1m · 대시(3m·쿨다운 0.9·무적 0.12초)
## ② 직업 고유 조작: 무사 받아치기(0.25초 창 안에 맞으면 무효 + 다음 공격 ×1.5)·협객 그림자 걷기(0.5초 무적 + ×1.8)·방사 원소 전환(불→얼음→번개 순환 + ×1.15)·궁수 당기기(0.4~1.2초 눌러 ×1.0~2.2) — 기력 12·공통 쿨다운 6초·기력 모자라면 안 나감·다음 공격 배율은 한 번만 쓰임
## ③ 피해: 방어구 컷(def/(def+40))·무적 중 무효·철벽 은사·회복 한도·공격력 합(기본+장비+직업 + 기합 ×1.35 + 맹공 은사). 끝에 "PROBE story_player OK" 또는 "PROBE story_player FAIL n".

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
	var S: Node = root.get_node("StorySaveState")
	var R: Node = root.get_node("StoryLabyrinthState")
	var Base: GDScript = load("res://games/saga_story/player/story_player_base.gd")
	var Combat: GDScript = load("res://games/saga_story/data/story_combat.gd")
	var saved := {"job": S.job, "equipped": S.equipped.duplicate(), "level": S.level, "skills": S.skills.duplicate(), "boons": R.boons.duplicate(), "scroll_bonus": S.scroll_bonus.duplicate(true), "scroll_left": S.scroll_left.duplicate(),
		"quests": S.quests_done.duplicate(), "gold": S.gold, "exp": S.exp, "ach": S.achievements.duplicate()}
	for k in Combat.QUESTS:
		S.quests_done[k] = true
	S.achievements["a_quest10"] = true
	S.equipped = {}
	S.scroll_bonus = {}
	R.boons = {}
	S.job = "warrior"
	var scene: PackedScene = load("res://games/saga_story/player/StoryPlayer.tscn")
	var p: CharacterBody3D = scene.instantiate()
	root.add_child(p)
	p.set_physics_process(false)
	p.set_process(false)
	await process_frame
	var near := func(a: float, b: float) -> bool: return absf(a - b) < 1e-4

	# ① 이동 손맛
	check(Base.COYOTE_TIME == 0.1 and Base.JUMP_BUFFER_TIME == 0.12 and Base.JUMP_SPEED == 15.0 and Base.GRAVITY == 36.0 and near.call(Base.JUMP_SPEED * Base.JUMP_SPEED / (2.0 * Base.GRAVITY), 3.125) and near.call(Base.DASH_DIST_M, Base.RUN_SPEED * 0.5) and Base.DASH_COOLDOWN > Base.DASH_INVULN_SEC and Base.DASH_INVULN_SEC == 0.12 and Base.ATTACK_COOLDOWN == 0.36, "이동 상수: 코요테 0.1·선입력 0.12 · 점프 15 · 중력 36(높이 3.1m) · 대시 3m·쿨다운 0.9·무적 0.12")
	p.velocity = Vector3.ZERO
	p._coyote_time_left = 0.05
	p._jump_buffer_left = 0.1
	p._walk(1.0 / 60.0)
	check(p.velocity.y == Base.JUMP_SPEED and p._jump_buffer_left == 0.0 and p._coyote_time_left == 0.0, "코요테가 남은 공중 + 선입력 → 점프(속도 15) · 두 값 소모")
	p.velocity = Vector3.ZERO
	p._coyote_time_left = 0.0
	p._jump_buffer_left = 0.1
	p._walk(1.0 / 60.0)
	check(p.velocity.y < 0.0 and near.call(p._jump_buffer_left, 0.1 - 1.0 / 60.0), "코요테가 없으면 점프 안 함(떨어짐) · 선입력은 시간이 가며 줆")
	p._jump_buffer_left = 0.1
	for i in 10:
		p._walk(1.0 / 60.0)
	check(p._jump_buffer_left == 0.0, "선입력은 0.12초가 지나면 사라짐")
	p._coyote_time_left = Base.COYOTE_TIME
	p.velocity = Vector3.ZERO
	p._jump_buffer_left = 0.0
	p._walk(0.05)
	var c1: float = p._coyote_time_left
	p._walk(0.06)
	check(near.call(c1, 0.05) and p._coyote_time_left == 0.0 and p.velocity.y < -Base.GRAVITY * 0.1 + 0.01, "공중에서 코요테가 줄어 0 이 되고 · 중력이 쌓임")
	p.mount_jump_mul = 1.5
	p._coyote_time_left = 0.05
	p._jump_buffer_left = 0.1
	p._walk(1.0 / 60.0)
	check(near.call(p.velocity.y, 22.5), "탈것 점프 배율 ×1.5 = 22.5")
	p.mount_jump_mul = 1.0
	# 대시
	p.global_position = Vector3.ZERO
	p._facing = -1.0
	p._dash_cd_left = 0.0
	## G-0118 — 예전엔 입력이 안 읽히면 check(true) 로 건너뛰었다. 이제 입력을 뗀 _do_dash 를 바로 부른다.
	p._do_dash()
	check(p._dash_cd_left == Base.DASH_COOLDOWN and near.call(p.global_position.x, -3.0) and p._invuln_time_left == Base.DASH_INVULN_SEC, "대시: 보는 쪽으로 3m · 0.12초 무적 · 쿨다운 0.9")
	p._dash_cd_left = 0.5
	var x_before: float = p.global_position.x
	p._do_dash()
	check(p.global_position.x == x_before, "쿨다운 중에는 대시 안 함")
	p._invuln_time_left = 0.0
	p._dash_cd_left = 0.0

	# ② 직업 고유 조작
	p.mp = 100.0
	p._signature_cd_left = 0.0
	p._fire_warrior_parry()
	check(p.mp == 88.0 and p._signature_cd_left == 6.0 and p._parry_time_left == Combat.WARRIOR_PARRY_SEC and not p._signature_ready(), "무사 받아치기: 기력 12 · 쿨다운 6초 · 0.25초 창")
	var hp0: float = p.hp
	p.take_damage(50.0)
	check(p.hp == hp0 and p._parry_time_left == 0.0 and p._signature_next_mul == 1.5, "창 안에 맞으면 피해 무효 · 창 소모 · 다음 공격 ×1.5")
	var base_atk: float = Combat.START_ATK + float(S.gear_totals().atk) + float(S.job_grow().atk)
	var boosted: float = p._effective_atk()
	var plain: float = p._effective_atk()
	check(near.call(boosted, base_atk * 1.5) and near.call(plain, base_atk) and p._signature_next_mul == 1.0, "다음 공격 한 번만 ×1.5 (%.1f → 이후 %.1f)" % [boosted, plain])
	p._fire_warrior_parry()
	check(p.mp == 88.0 and p._parry_time_left == 0.0, "쿨다운 중에는 안 나감(기력 불변)")
	p._signature_cd_left = 0.0
	p.mp = 11.9
	p._fire_warrior_parry()
	check(p.mp == 11.9 and p._parry_time_left == 0.0 and not p._signature_ready(), "기력 12 미만이면 안 나감")
	p.mp = 100.0
	p._signature_cd_left = 0.0
	p._fire_rogue_shadow_step()
	p.take_damage(40.0)
	check(p._invuln_time_left == Combat.ROGUE_SHADOW_INVULN_SEC and p.hp == hp0 and p._signature_next_mul == 1.8 and p.mp == 88.0, "협객 그림자 걷기: 0.5초 무적(맞아도 무효) · 다음 공격 ×1.8")
	p._effective_atk()
	p._invuln_time_left = 0.0
	p._signature_cd_left = 0.0
	var idx0: int = p._mage_element_idx
	var seq: Array = []
	for i in 3:
		p._signature_cd_left = 0.0
		p._fire_mage_element()
		seq.append(p._mage_element_idx)
		p._effective_atk()
	check(idx0 == 0 and seq == [1, 2, 0] and Combat.MAGE_ELEMENTS == ["fire", "ice", "lightning"], "방사 원소 전환: 불 → 얼음 → 번개 → 불 순환 %s" % str(seq))
	p._signature_cd_left = 0.0
	p._fire_mage_element()
	check(p._signature_next_mul == 1.15, "원소 전환 직후 다음 공격 ×1.15")
	p._effective_atk()
	var muls: Array = []
	for hold in [0.2, 0.4, 0.8, 1.2, 3.0]:
		p._signature_cd_left = 0.0
		p.mp = 100.0
		p._dash_hold_time = hold
		p._release_archer_draw()
		muls.append(snappedf(p._signature_next_mul, 0.001))
		p._effective_atk()
	check(muls == [1.0, 1.0, 1.6, 2.2, 2.2], "궁수 당기기: 눌린 시간 0.4초 미만·이상 → ×1.0, 0.8초 ×1.6, 1.2초 이상 ×2.2(상한) %s" % str(muls))
	# 입력 경로 — 길게 눌러야 발동
	await process_frame
	await process_frame
	S.job = "warrior"
	p.mp = 100.0
	p._signature_cd_left = 0.0
	p._dash_hold_time = 0.0
	p._signature_fired_this_hold = false
	Input.action_press("story_dash")
	p._try_signature(Combat.SIGNATURE_HOLD_SEC * 0.5)
	var early: bool = p._parry_time_left == 0.0
	p._try_signature(Combat.SIGNATURE_HOLD_SEC * 0.6)
	var fired: bool = p._parry_time_left > 0.0 and p.mp == 88.0
	p._try_signature(1.0)
	var once: bool = p.mp == 88.0
	Input.action_release("story_dash")
	check(early and fired and once, "고유 조작은 길게(0.35초) 눌러야 발동 · 한 번 눌러 한 번만")
	p._signature_cd_left = 0.0
	p._parry_time_left = 0.0

	# ③ 피해
	await process_frame
	var full: float = p.max_hp
	p.hp = full
	p._invuln_time_left = 0.0
	p.take_damage(20.0)
	check(near.call(p.hp, full - 20.0), "방어가 없으면 받는 피해 그대로(20)")
	p.hp = full
	S.level = 30
	S.equip_gear("top1")  # def 3
	S.equip_gear("hat1")  # def 2
	full = p.max_hp  # 장비 체력이 더해짐
	p.hp = full
	var cut: float = Combat.damage_cut(5.0)
	p.take_damage(100.0)
	check(near.call(p.hp, full - 100.0 * (1.0 - cut)) and near.call(cut, 5.0 / 45.0), "방어구 컷: def 5 → %.1f%% 덜 받음" % (cut * 100.0))
	p.hp = full
	R.boons = {"wall": 2}
	p.take_damage(100.0)
	check(near.call(p.hp, full - 100.0 * (1.0 - cut) * 0.76), "철벽 은사 2겹: 받는 피해 ×0.76 더")
	R.boons = {}
	p.hp = full
	p._invuln_time_left = 0.2
	p.take_damage(100.0)
	check(p.hp == full, "무적 중에는 피해 무효")
	p._invuln_time_left = 0.0
	p.take_damage(0.0)
	p.take_damage(-5.0)
	check(p.hp == full, "0·음수 피해는 무시")
	p.hp = 10.0
	p.heal_pct(0.25)
	var healed: float = p.hp
	p.heal_pct(5.0)
	var capped: float = p.hp
	p.heal_pct(0.0)
	p.heal_pct(-0.5)
	check(near.call(healed, 10.0 + full * 0.25) and capped == full and p.hp == full, "회복: 최대 체력의 비율만큼 · 최대에서 멈춤 · 0·음수 무시")
	p.take_damage(1e9)
	check(p.hp == 0.0, "체력은 0 아래로 안 내려감")
	p.hp = full
	var a0: float = p._effective_atk()
	p._buff_time_left = 5.0
	var a_buff: float = p._effective_atk()
	p._buff_time_left = 0.0
	R.boons = {"fury": 2}
	var a_fury: float = p._effective_atk()
	R.boons = {}
	check(near.call(a_buff, a0 * Combat.BRACE_ATK_MUL) and near.call(a_fury, a0 * 1.30) and a0 >= Combat.START_ATK + float(S.gear_totals().atk), "공격력: 기본+장비+직업 · 기합 ×1.35 · 맹공 은사 2겹 ×1.30")

	p.queue_free()
	S.job = saved.job
	S.equipped = saved.equipped
	S.level = saved.level
	S.skills = saved.skills
	S.scroll_bonus = saved.scroll_bonus
	S.scroll_left = saved.scroll_left
	S.quests_done = saved.quests
	S.gold = saved.gold
	S.exp = saved.exp
	S.achievements = saved.ach
	R.boons = saved.boons
	print("PROBE story_player ", "OK" if fails == 0 else "FAIL %d" % fails)
	quit(1 if fails > 0 else 0)
