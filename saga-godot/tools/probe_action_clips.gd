extends SceneTree
## G-0284 2나락·1만리 공격·무예 몸짓 점검 —
##   godot --headless --path saga-godot --script res://tools/probe_action_clips.gd   → "PROBE action_clips OK" / "FAIL n"
## 1만리 TestVillage: ① play_action("skill") → 모캡 cast · ("strong") → strong(field_combat.charged_attack 이 부름) · SAGA_ACTION_MOCAP=0 이면 skill·attack
## 2나락 TestRoom: ② MeleeAttack.try_attack → attack ③ 잠금 — 동작 직후 걸음새(_play_anim walk)가 안 덮고 구간 뒤엔 덮음
## ④ SkillCaster.SHAPE_POSE 값마다 몸에 클립 있음 · play_once 가 그 클립 ⑤ SAGA_ACTION_MOCAP=0 이면 play_once false·동작 안 바뀜.

const GO := "res://games/saga_go/world/TestVillage.tscn"
const DUNGEON := "res://games/saga_dungeon/world/TestRoom.tscn"

var fails := 0


func _fail(msg: String) -> void:
	fails += 1
	print("  FAIL ", msg)


func _load(path: String) -> Node:
	var sc := (load(path) as PackedScene).instantiate()
	root.add_child(sc)
	current_scene = sc
	for _i in 30:
		await process_frame
	return sc


func _anim(p: Node) -> AnimationPlayer:
	return p.get("_anim") as AnimationPlayer


func _initialize() -> void:
	await process_frame
	## ① 1만리
	var sc: Node = await _load(GO)
	var p := get_first_node_in_group("player")
	var ap := _anim(p)
	if ap == null:
		_fail("① 1만리 몸 AnimationPlayer 없음")
	else:
		p.call("play_action", "skill", 0.4, 0.0)
		var a1 := ap.current_animation
		await create_timer(0.6).timeout
		p.call("play_action", "strong", 0.5, 0.0)
		var a2 := ap.current_animation
		await create_timer(0.7).timeout
		OS.set_environment("SAGA_ACTION_MOCAP", "0")
		p.call("play_action", "skill", 0.4, 0.0)
		var a3 := ap.current_animation
		await create_timer(0.6).timeout
		p.call("play_action", "strong", 0.5, 0.0)
		var a4 := ap.current_animation
		OS.set_environment("SAGA_ACTION_MOCAP", "")
		print("ACT go skill=%s strong=%s off: skill=%s strong=%s" % [a1, a2, a3, a4])
		if a1 != "cast" or a2 != "strong":
			_fail("① 1만리 시전 %s·강공격 %s (기대 cast·strong)" % [a1, a2])
		if a3 != "skill" or a4 != "attack":
			_fail("① 1만리 손잡이 0 인데 %s·%s (기대 skill·attack)" % [a3, a4])
	sc.queue_free()
	for _i in 3:
		await process_frame
	## ②~⑤ 2나락
	sc = await _load(DUNGEON)
	for m in get_nodes_in_group("ui_modal"):
		if m is CanvasLayer:
			m.queue_free()
	p = get_first_node_in_group("player")
	ap = _anim(p)
	var melee := p.get_node_or_null("MeleeAttack")
	var caster := p.find_child("SkillCaster", true, false)
	if ap == null or melee == null:
		_fail("② 2나락 몸·MeleeAttack 없음 ap=%s melee=%s" % [ap, melee])
	else:
		melee.set("_cooldown_left", 0.0)
		melee.call("try_attack")
		if ap.current_animation != "attack":
			_fail("② try_attack → %s (기대 attack)" % ap.current_animation)
		## ③ 잠금
		p.call("_play_anim", "walk")
		if ap.current_animation != "attack":
			_fail("③ 동작 직후 걸음새가 덮음(%s)" % ap.current_animation)
		await create_timer(0.5).timeout
		p.call("_play_anim", "walk")
		if ap.current_animation != "walk":
			_fail("③ 잠금이 안 풀림(%s)" % ap.current_animation)
		## ④ 무예 모양 표
		var table: Dictionary = (caster.get_script() as GDScript).get_script_constant_map().get("SHAPE_POSE", {}) if caster != null else {}
		if table.is_empty():
			_fail("④ SkillCaster SHAPE_POSE 없음(caster=%s)" % caster)
		for shape in table:
			var clip := String(table[shape])
			await create_timer(0.5).timeout
			if not bool(p.call("play_once", clip, 0.4)) or ap.current_animation != clip:
				_fail("④ %s → %s 안 틂(%s)" % [shape, clip, ap.current_animation])
		print("ACT dungeon shapes=%s" % [table])
		## ⑤ 손잡이
		await create_timer(0.5).timeout
		p.call("_play_anim", "idle")
		OS.set_environment("SAGA_ACTION_MOCAP", "0")
		var r := bool(p.call("play_once", "cast", 0.4))
		OS.set_environment("SAGA_ACTION_MOCAP", "")
		if r or ap.current_animation != "idle":
			_fail("⑤ 손잡이 0 인데 play_once=%s anim=%s" % [r, ap.current_animation])
	sc.queue_free()
	await process_frame
	print("PROBE action_clips ", "OK" if fails == 0 else "FAIL %d" % fails)
	quit(1 if fails > 0 else 0)
