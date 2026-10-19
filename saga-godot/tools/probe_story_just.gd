extends SceneTree

## G-0233 사가종횡 저스트 회피(games/saga_story/data/story_just.gd · story_player take_damage 무적 가지·_do_dash · base _effective_atk) 자동 점검.
##   godot --headless --path saga-godot --script res://tools/probe_story_just.gd
## ① 창: 대시 0.1초 뒤 닿음 → 저스트 · 0.3초 뒤 → 아님 ② 진짜 대시 → 무적 중 맞음 → 피해 없음·슬로 0.35·다음 한 타 ×1.3 한 번
## ③ 쿨 4초 중엔 다시 안 됨 ④ 0.8초(실시간) 뒤 time_scale 1 로 돌아옴 ⑤ 일시정지 중엔 시간을 안 건드림. 끝에 "PROBE story_just OK" 또는 "PROBE story_just FAIL n".

var fails := 0


func check(cond: bool, msg: String) -> void:
	if cond:
		print("  ok   ", msg)
	else:
		fails += 1
		print("  FAIL ", msg)


func _initialize() -> void:
	await process_frame
	var J: GDScript = load("res://games/saga_story/data/story_just.gd")
	var S: Node = root.get_node("StorySaveState")
	var Combat: GDScript = load("res://games/saga_story/data/story_combat.gd")
	var saved := {"job": S.job, "equipped": S.equipped.duplicate()}
	S.equipped = {}
	S.job = "warrior"
	J.reset()

	# ① 창(순수)
	J.on_dash(10000)
	var in_win: bool = J.qualifies(10100)
	var late: bool = J.qualifies(10300)
	check(in_win and not late, "대시 0.1초 뒤 닿음 → 저스트(%s) · 0.3초 뒤 → 아님(%s)" % [in_win, late])
	J.reset()

	var p: CharacterBody3D = (load("res://games/saga_story/player/StoryPlayer.tscn") as PackedScene).instantiate()
	root.add_child(p)
	p.set_physics_process(false)
	p.set_process(false)
	await process_frame
	var base_atk: float = Combat.START_ATK + float(S.gear_totals().atk) + float(S.job_grow().atk)

	# ② 진짜 대시 → 무적 중 맞음
	p._dash_cd_left = 0.0
	p._invuln_time_left = 0.0
	var hp0: float = p.hp
	p._do_dash()
	p.take_damage(30.0)
	var slowed := is_equal_approx(Engine.time_scale, J.SLOW_MUL)
	var a1: float = p._effective_atk()
	var a2: float = p._effective_atk()
	check(p.hp == hp0 and J.count == 1 and slowed and is_equal_approx(a1, base_atk * J.NEXT_MUL) and is_equal_approx(a2, base_atk),
		"저스트: 피해 없음 · time_scale %.2f · 다음 한 타 %.1f → 이후 %.1f" % [Engine.time_scale, a1, a2])

	# ③ 쿨 중
	p._dash_cd_left = 0.0
	p._invuln_time_left = 0.0
	p._do_dash()
	p.take_damage(30.0)
	check(J.count == 1 and J.cooldown_left() > 3.0 and is_equal_approx(J.bonus(), 1.0), "쿨 4초 중엔 다시 안 됨(count %d · 남은 쿨 %.1f)" % [J.count, J.cooldown_left()])

	# ④ 복구(실시간 0.8초)
	await create_timer(1.0, true, false, true).timeout
	check(is_equal_approx(Engine.time_scale, 1.0) and not J.slowing, "0.8초 뒤 time_scale 1 로 돌아옴(%.2f)" % Engine.time_scale)

	# ⑤ 일시정지 중
	J.reset()
	paused = true
	p._dash_cd_left = 0.0
	p._invuln_time_left = 0.0
	p._do_dash()
	p.take_damage(30.0)
	check(J.count == 1 and is_equal_approx(Engine.time_scale, 1.0), "일시정지 중엔 저스트는 세되 시간은 안 건드림(%.2f)" % Engine.time_scale)
	paused = false

	J.reset()
	J.take_bonus()
	p.queue_free()
	S.job = saved.job
	S.equipped = saved.equipped
	print("PROBE story_just %s" % ("OK" if fails == 0 else "FAIL %d" % fails))
	quit(0 if fails == 0 else 1)
