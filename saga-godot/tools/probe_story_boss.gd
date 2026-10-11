extends SceneTree

## G-0205 4종횡 보스 패턴전 1차(games/saga_story/world/story_boss_pattern.gd) 자동 점검 — 패턴은 가짜 api 로 값만 굴리고, 연결은 진짜 story_enemy 로.
##   godot --headless --path saga-godot --script res://tools/probe_story_boss.gd
## ① 단계 경계(0.67·0.65·0.34·0.32)·단계별 후보(1단계에 지진·휩쓸기·부르기 없음) ② 내려찍기: 예고 전 0 → 원 안 ×1.3 · 밖 0
## ③ 지진: 땅이면 ×1.2 · 공중·발판 위면 0 ④ 휩쓸기: 안전지대 안 0 · 밖 최대 체력 55% ⑤ 단계 넘어감: 걸린 패턴 거둠·포효·광폭 ×1.25
## ⑥ 부르기는 단계마다 한 번(부하 둘) · 1단계는 내려찍기·낙석만 ⑦ 예고 그림 생기고 스스로 지움(실제 시간) ⑧ 사냥터 보스 = 패턴전 · 관문 대장 = 고유 기술만(gate) · 잡졸 없음.
## G-0206 ⑨ 고유 기술 표가 고돗 보스 넷을 덮음·첫 기술 = 고유 기술(이름 띠) ⑩ 도넛·화살비·쇠뇌·불기둥 두 박자 피하는 법
## ⑪ 그로기: 셋 다 피하면 5초·그동안 새 패턴 없음·받는 피해 ×1.5(story_enemy 경유), 하나라도 맞으면 셈 0 ⑫ 달려들기: 쿨 전 이동 0 · 1.1초 동안만 미끄러짐
## ⑬ 관문 대장: 공용 없이 고유 기술만 4초 뒤 첫 번째·8초마다.
## 끝에 "PROBE story_boss OK" 또는 "PROBE story_boss FAIL n".

const BP := preload("res://games/saga_story/world/story_boss_pattern.gd")

var fails := 0


func check(cond: bool, msg: String) -> void:
	if cond:
		print("  ok   ", msg)
	else:
		fails += 1
		print("  FAIL ", msg)


func _initialize() -> void:
	await process_frame
	var stage := Node3D.new()
	root.add_child(stage)
	current_scene = stage
	var me := Node3D.new()
	stage.add_child(me)
	me.global_position = Vector3(10.0, 0.0, 0.0)
	var pl := Node3D.new()
	stage.add_child(pl)
	var hurts: Array = []
	var spawns: Array = []
	var toasts: Array = []
	var ground := [true]
	var api := {
		"hurt": func(a: float) -> void: hurts.append(a),
		"spawn": func(x: float) -> void: spawns.append(x),
		"toast": func(m: String) -> void: toasts.append(m),
		"shake": func(_a: float, _s: float) -> void: pass,
		"on_ground": func() -> bool: return ground[0],
		"dmg": 10.0, "hp": 100.0, "hp_max": 100.0, "player_hp_max": 200.0, "name": "황건 두목", "width": 30.0,
	}

	# ①
	check(BP.phase_of(67, 100) == 0 and BP.phase_of(65, 100) == 1 and BP.phase_of(34, 100) == 1 and BP.phase_of(32, 100) == 2, "① 단계 경계 66%·33%")
	check(not BP.pool_of(0).has("quake") and not BP.pool_of(0).has("sweep") and BP.pool_of(1).has("quake") and BP.pool_of(1).has("summon") and not BP.pool_of(1).has("sweep") and BP.pool_of(2).has("sweep"), "① 단계별 후보 %s · %s · %s" % [BP.pool_of(0), BP.pool_of(1), BP.pool_of(2)])

	# ② 내려찍기
	var bp: RefCounted = BP.new(7)
	pl.global_position = Vector3(12.0, 0.0, 0.0)
	bp.begin(me, pl, "slam", api)
	var tells: int = stage.get_children().filter(func(c): return c is MeshInstance3D).size()
	bp.step(me, pl, 0.5, true, api)
	var early := hurts.size()
	bp.step(me, pl, 0.55, true, api)
	check(early == 0 and hurts == [13.0], "② 내려찍기: 예고 전 0 → 원 안 %s(×1.3)" % str(hurts))
	hurts.clear()
	bp.begin(me, pl, "slam", api)
	pl.global_position.x += BP.SLAM_R + 0.2 # 예고 뒤 원 밖으로
	bp.step(me, pl, 1.1, true, api)
	check(hurts.is_empty(), "② 내려찍기 원(%.2fm) 밖은 0" % BP.SLAM_R)

	# ③ 지진
	hurts.clear()
	pl.global_position = Vector3(14.0, 0.0, 0.0)
	bp.begin(me, pl, "quake", api)
	bp.step(me, pl, 1.3, true, api)
	var on_ground_hit := hurts.duplicate()
	hurts.clear()
	ground[0] = false
	bp.begin(me, pl, "quake", api)
	bp.step(me, pl, 1.3, true, api)
	var air := hurts.size()
	ground[0] = true
	pl.global_position.y = 1.0 # 발판 위
	bp.begin(me, pl, "quake", api)
	bp.step(me, pl, 1.3, true, api)
	pl.global_position.y = 0.0
	check(on_ground_hit == [12.0] and air == 0 and hurts.is_empty(), "③ 지진: 땅 %s · 공중 0 · 발판 0" % str(on_ground_hit))

	# ④ 휩쓸기(새 패턴 — 앞 절의 다 피함 셈이 그로기로 번지지 않게, G-0206)
	hurts.clear()
	bp = BP.new(8)
	bp.begin(me, pl, "sweep", api)
	var sx: float = bp.safe_x
	pl.global_position.x = sx
	bp.step(me, pl, 1.9, true, api)
	var safe_hurt := hurts.size()
	bp.begin(me, pl, "sweep", api)
	pl.global_position.x = bp.safe_x + BP.SWEEP_W
	bp.step(me, pl, 1.9, true, api)
	check(safe_hurt == 0 and hurts == [110.0] and sx > BP.SWEEP_W * 0.5 and sx < 30.0 - BP.SWEEP_W * 0.5, "④ 휩쓸기: 안전지대(%.1f) 0 · 밖 %s(최대 체력 55%%)" % [sx, str(hurts)])

	# ⑤ 단계 넘어감
	hurts.clear()
	toasts.clear()
	var b5: RefCounted = BP.new(9)
	b5.begin(me, pl, "slam", api)
	api.hp = 30.0
	var o5: Dictionary = b5.step(me, pl, 0.05, true, api)
	check(o5.changed and b5.phase == 2 and b5.kind == "" and is_equal_approx(b5.dmg_mul(), 1.25) and toasts.size() == 1, "⑤ 단계 넘어감: 패턴 거둠·포효 %s·광폭 ×%.2f" % [str(toasts), b5.dmg_mul()])
	api.hp = 100.0

	# ⑥ 부르기 한 번 · 1단계 후보
	var b6: RefCounted = BP.new(11)
	var kinds0 := {}
	for i in 60:
		b6.step(me, pl, 0.5, true, api)
		if b6.kind != "":
			kinds0[b6.kind] = true
	spawns.clear()
	api.hp = 50.0
	var b7: RefCounted = BP.new(13)
	b7.phase = 1
	for i in 200:
		b7.step(me, pl, 0.5, true, api)
	api.hp = 100.0
	check(kinds0.keys().all(func(k): return k == "slam" or k == "rock") and kinds0.size() == 2 and spawns.size() == 2 and b7.summoned == 1,
		"⑥ 1단계는 %s · 2단계 부르기 %d번(부하 %d)" % [str(kinds0.keys()), b7.summoned, spawns.size()])
	var far: RefCounted = BP.new(15)
	far.cd = 0.0
	far.step(me, pl, 0.1, false, api)
	check(far.kind == "", "⑥ 보스가 안 보면(near 아님) 새 패턴 안 검")

	# ⑦ 예고 그림
	var t0 := Time.get_ticks_msec()
	while Time.get_ticks_msec() - t0 < 2500:
		await process_frame
	var left := stage.get_children().filter(func(c): return c is MeshInstance3D or c is CPUParticles3D).size()
	check(tells > 0 and left == 0, "⑦ 예고 그림 %d 생김 → 2.5초 뒤 남은 그림 %d" % [tells, left])

	# ⑧ 연결 — 사냥터 보스만
	var Enemy: GDScript = load("res://games/saga_story/world/story_enemy.gd")
	var made := []
	for spec in [[true, false], [true, true], [false, false]]:
		var e := Node3D.new()
		e.set_script(Enemy)
		e.is_boss = spec[0]
		e.is_champion = spec[1]
		e.boss_name = "황건 두목"
		stage.add_child(e)
		made.append("없음" if e.boss_pattern == null else ("gate" if e.boss_pattern.gate else "패턴전"))
	check(made == ["패턴전", "gate", "없음"], "⑧ 패턴: 사냥터 보스 %s · 관문 대장 %s · 잡졸 %s" % made)

	# ⑨ 고유 기술 표·첫 기술
	var names: Array = []
	for mp in ["field", "forest", "cave", "gorge"]:
		names.append(String((load("res://games/saga_story/data/%s_map.gd" % mp) as GDScript).get("BOSS_NAME")))
	toasts.clear()
	var b9: RefCounted = BP.new(3, "황건 두목")
	b9.cd = 0.0
	pl.global_position = Vector3(11.0, 0.0, 0.0)
	b9.step(me, pl, 0.05, true, api)
	check(names.all(func(n): return BP.SIG.has(n)) and b9.kind == "ring" and toasts.size() == 1 and String(toasts[0]).contains("황천 부적진") and BP.pool_of(0, "ring").has("ring"),
		"⑨ 고유 기술 표 %s · 첫 기술 %s · 이름 띠 %s" % [str(names), b9.kind, str(toasts)])

	# ⑩ 고유 기술 넷
	var b10: RefCounted = BP.new(17)
	hurts.clear()
	b10.begin(me, pl, "ring", api) # 보스 x 10 · 내 x 11(곁)
	b10.step(me, pl, 1.4, true, api)
	var ring_in := hurts.size()
	b10.begin(me, pl, "ring", api)
	pl.global_position.x = 10.0 + BP.RING_R + 0.5
	b10.step(me, pl, 1.4, true, api)
	check(ring_in == 0 and hurts == [11.0], "⑩ 도넛: 곁 0 · 밖 %s(×1.1)" % str(hurts))
	hurts.clear()
	pl.global_position = Vector3(14.0, 0.0, 0.0)
	b10.begin(me, pl, "volley", api)
	b10.step(me, pl, 1.3, true, api)
	var vol_hit := hurts.duplicate()
	hurts.clear()
	b10.begin(me, pl, "volley", api)
	pl.global_position.x = float(b10.marks[2][0].x) + BP.VOLLEY_GAP * 0.5 # 점 사이 틈
	b10.step(me, pl, 1.3, true, api)
	check(vol_hit == [8.0] and hurts.is_empty(), "⑩ 화살비: 점 위 %s · 틈 0" % str(vol_hit))
	hurts.clear()
	pl.global_position = Vector3(14.0, 0.0, 0.0)
	ground[0] = true
	b10.begin(me, pl, "beam", api)
	b10.step(me, pl, 1.2, true, api)
	var beam_ground := hurts.size()
	ground[0] = false
	b10.begin(me, pl, "beam", api)
	b10.step(me, pl, 1.2, true, api)
	ground[0] = true
	check(beam_ground == 0 and hurts == [11.0], "⑩ 쇠뇌: 땅 0 · 공중 %s" % str(hurts))
	hurts.clear()
	b10.begin(me, pl, "pillar", api)
	b10.step(me, pl, 1.05, true, api) # 첫 박자 — 내 칸은 비었다
	var w1 := hurts.size()
	var mid_busy: bool = b10.kind == "pillar" and b10.wave == 2
	b10.step(me, pl, 0.85, true, api) # 둘째 박자 — 그대로 서 있으면 맞음
	var stay := hurts.duplicate()
	hurts.clear()
	pl.global_position.x = 14.0
	b10.begin(me, pl, "pillar", api)
	b10.step(me, pl, 1.05, true, api)
	pl.global_position.x = 14.0 + BP.PILLAR_GAP # 한 칸 옮겨 딛음
	b10.step(me, pl, 0.85, true, api)
	check(w1 == 0 and mid_busy and stay == [10.0] and hurts.is_empty() and b10.kind == "", "⑩ 불기둥: 첫 박자 0 · 둘째 그대로 %s · 한 칸 옮기면 0" % str(stay))

	# ⑪ 그로기
	var b11: RefCounted = BP.new(19)
	toasts.clear()
	pl.global_position = Vector3(25.0, 0.0, 0.0)
	for i in 3:
		b11.begin(me, pl, "slam", api)
		pl.global_position.x = 28.0 # 예고 뒤 비킴
		b11.step(me, pl, 1.1, true, api)
		pl.global_position.x = 25.0
	var gro: float = b11.groggy
	b11.cd = 0.0
	b11.step(me, pl, 1.0, true, api)
	var no_new: bool = b11.kind == ""
	var b11b: RefCounted = BP.new(21)
	for i in 2:
		b11b.begin(me, pl, "slam", api)
		pl.global_position.x = 28.0
		b11b.step(me, pl, 1.1, true, api)
		pl.global_position.x = 25.0
	b11b.begin(me, pl, "slam", api)
	b11b.step(me, pl, 1.1, true, api) # 맞음 — 셈 0
	var eg := Node3D.new()
	eg.set_script(Enemy)
	eg.is_boss = true
	stage.add_child(eg)
	eg.boss_pattern.groggy = 3.0
	var hp0: float = eg.hp
	eg.take_damage(10.0)
	check(is_equal_approx(gro, BP.GROGGY_T) and no_new and b11.busy() and is_equal_approx(b11.dmg_taken_mul(), 1.5) and toasts.any(func(t): return String(t).contains("그로기"))
		and b11b.dodge == 0 and b11b.groggy == 0.0 and is_equal_approx(hp0 - eg.hp, 15.0),
		"⑪ 그로기: 셋 피함 → %.1f초 · 새 패턴 없음 · 받는 피해 %.1f(story_enemy) · 맞으면 셈 %d" % [gro, hp0 - eg.hp, b11b.dodge])

	# ⑫ 달려들기 — 진짜 story_enemy, 플레이어 흉내(그룹 player·take_damage)
	var fake := GDScript.new()
	fake.source_code = "extends Node3D
var max_hp := 100.0
func take_damage(_a: float) -> void:
	pass
func is_on_floor() -> bool:
	return true
"
	fake.reload()
	var fp := Node3D.new()
	fp.set_script(fake)
	fp.add_to_group("player")
	stage.add_child(fp)
	fp.global_position = Vector3(15.0, 0.0, 0.0)
	var ec := Node3D.new()
	ec.set_script(Enemy)
	ec.is_boss = true
	ec.stage_width_m = 40.0
	stage.add_child(ec)
	ec.set_physics_process(false)
	ec.global_position = Vector3(10.0, 0.0, 0.0)
	ec.boss_pattern.cd = 999.0
	ec._charge_cd = 5.0
	for i in 10:
		ec._physics_process(0.05)
	var still: float = ec.global_position.x
	ec._charge_cd = 0.01
	ec._physics_process(0.05) # 달려들기 시작
	for i in 22:
		ec._physics_process(0.05)
	var after: float = ec.global_position.x
	for i in 8:
		ec._physics_process(0.05)
	check(is_equal_approx(still, 10.0) and after > 11.5 and is_equal_approx(after, ec.global_position.x), "⑫ 달려들기: 쿨 전 %.2f · 1.1초 뒤 %.2f · 그 뒤 멈춤 %.2f" % [still, after, ec.global_position.x])
	fp.remove_from_group("player")

	# ⑬ 관문 대장 — 고유 기술만
	var b13: RefCounted = BP.new(23, "황건 두목", true)
	var kinds13 := {}
	var first_at := -1.0
	var tt := 0.0
	pl.global_position = Vector3(11.0, 0.0, 0.0)
	for i in 120:
		b13.step_sig(me, pl, 0.25, true, api)
		tt += 0.25
		if b13.kind != "":
			kinds13[b13.kind] = true
			if first_at < 0.0:
				first_at = tt
	check(kinds13.keys() == ["ring"] and first_at >= 4.0 and first_at <= 4.5 and b13.phase == 0, "⑬ 관문 대장: 기술 %s · 첫 번째 %.2f초" % [str(kinds13.keys()), first_at])
	print("PROBE story_boss OK" if fails == 0 else "PROBE story_boss FAIL %d" % fails)
	quit(1 if fails > 0 else 0)
