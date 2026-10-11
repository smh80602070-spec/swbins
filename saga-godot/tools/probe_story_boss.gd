extends SceneTree

## G-0205 4종횡 보스 패턴전 1차(games/saga_story/world/story_boss_pattern.gd) 자동 점검 — 패턴은 가짜 api 로 값만 굴리고, 연결은 진짜 story_enemy 로.
##   godot --headless --path saga-godot --script res://tools/probe_story_boss.gd
## ① 단계 경계(0.67·0.65·0.34·0.32)·단계별 후보(1단계에 지진·휩쓸기·부르기 없음) ② 내려찍기: 예고 전 0 → 원 안 ×1.3 · 밖 0
## ③ 지진: 땅이면 ×1.2 · 공중·발판 위면 0 ④ 휩쓸기: 안전지대 안 0 · 밖 최대 체력 55% ⑤ 단계 넘어감: 걸린 패턴 거둠·포효·광폭 ×1.25
## ⑥ 부르기는 단계마다 한 번(부하 둘) · 1단계는 내려찍기·낙석만 ⑦ 예고 그림 생기고 스스로 지움(실제 시간) ⑧ 사냥터 보스만 패턴(관문 대장·잡졸 없음).
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

	# ④ 휩쓸기
	hurts.clear()
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
		stage.add_child(e)
		made.append(e.boss_pattern != null)
	check(made == [true, false, false], "⑧ 패턴: 사냥터 보스 %s · 관문 대장 %s · 잡졸 %s" % made)
	print("PROBE story_boss OK" if fails == 0 else "PROBE story_boss FAIL %d" % fails)
	quit(1 if fails > 0 else 0)
