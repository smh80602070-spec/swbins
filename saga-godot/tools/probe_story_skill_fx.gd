extends SceneTree

## G-0201 4종횡 무예 시전 그림 자동 점검 — StoryPlayer 를 무대(current_scene)에 세워 `_cast_*` 95 를 하나씩 부른다(그림은 노드 수만 본다).
##   godot --headless --path saga-godot --script res://tools/probe_story_skill_fx.gd
## ① 무예 표 SKILLS 전부 fx 칸이 웹 아홉 종류 안 ② 시전마다 그림 노드가 생김 · 숫자(popup) 수 = 맞은 수
## ③ 여럿 맞혀도 멈칫은 한 번(선풍·참격), 두 번 치는 패왕격은 둘 — 둘째부터의 치명 +50ms 는 세지 않는다(HITSTOP_MS 미만)
## ④ 그림 노드는 실제 시간 1.2초 안에 스스로 지워짐. 진짜 세이브는 안 건드린다(스킬 표만 임시로 갈아 끼우고 되돌림).
## 끝에 "PROBE story_skill_fx OK" 또는 "PROBE story_skill_fx FAIL n".

const KINDS := ["melee", "aoe", "bolt", "arrow", "volley", "dash", "rain", "heal", "buff"]
const PLAYER_DIR := "res://games/saga_story/player/"

var fails := 0


func check(cond: bool, msg: String) -> void:
	if cond:
		print("  ok   ", msg)
	else:
		fails += 1
		print("  FAIL ", msg)


func _fx_nodes(stage: Node) -> Array:
	return stage.get_children().filter(func(c): return c is CPUParticles3D or c is MeshInstance3D)


func _initialize() -> void:
	await process_frame
	seed(20260824)
	var Meta: GDScript = load("res://games/saga_story/data/story_skill_meta.gd")
	var bad: Array = []
	for k in Meta.SKILLS:
		if not KINDS.has(Meta.fx_of(k)):
			bad.append(k)
	check(Meta.SKILLS.size() == 100 and bad.is_empty(), "① 무예 100(G-0246 각성기 여덟 포함) 전부 fx 가 웹 아홉 종류 안 %s" % str(bad))

	var save: Node = root.get_node("StorySaveState")
	var saved_skills: Dictionary = save.skills.duplicate()
	var keys := {}
	var rx := RegEx.create_from_string("skill_level\\(\"([a-z_0-9]+)\"\\)")
	for f in DirAccess.open(PLAYER_DIR).get_files():
		if f.ends_with(".gd"):
			for m in rx.search_all(FileAccess.get_file_as_string(PLAYER_DIR + f)):
				keys[m.get_string(1)] = 3
	save.skills = keys

	var feel: Node = root.get_node("CombatFeel")
	var pops := [0]
	var stops := [0]
	feel.popup_triggered.connect(func(_a, _c): pops[0] += 1)
	feel.hitstop_triggered.connect(func(d): if d >= feel.HITSTOP_MS: stops[0] += 1)
	var dummy := GDScript.new()
	dummy.source_code = "extends Node3D\nvar hp := 0.0\nvar hits := 0\nfunc take_damage(a: float) -> void:\n\thp += a\n\thits += 1\n"
	dummy.reload()
	var packed: PackedScene = load("res://games/saga_story/player/StoryPlayer.tscn")
	var stage := Node3D.new()
	root.add_child(stage)
	current_scene = stage

	var probe_p: Node = packed.instantiate()
	var names: Array = []
	for m in probe_p.get_method_list():
		if String(m.name).begins_with("_cast_"):
			names.append(String(m.name))
	probe_p.free()
	names.sort()

	var no_fx: Array = []
	var pop_bad: Array = []
	var stop_of := {}
	for n in names:
		var p: Node = packed.instantiate()
		stage.add_child(p)
		var dummies: Array = []
		for dx in [0.6, 2.0, 5.0, -1.5]:
			var e: Node3D = Node3D.new()
			e.set_script(dummy)
			e.add_to_group("story_enemy")
			stage.add_child(e)
			e.global_position = Vector3(dx, 0.0, 0.0)
			dummies.append(e)
		await process_frame
		p.set_physics_process(false)
		p.set_process(false)
		p.mp = 999.0
		for prop in p.get_property_list():
			if String(prop.name).begins_with("_cd_"):
				p.set(prop.name, 0.0)
		var before := _fx_nodes(stage)
		pops[0] = 0
		stops[0] = 0
		p.call(n)
		var hits := 0
		for e in dummies:
			hits += int(e.hits)
		var fx_n: int = _fx_nodes(stage).filter(func(c): return not before.has(c)).size()
		if fx_n == 0:
			no_fx.append(n)
		if pops[0] != hits:
			pop_bad.append("%s 맞음%d 숫자%d" % [n, hits, pops[0]])
		stop_of[n] = [hits, stops[0]]
		Engine.time_scale = 1.0
		p.queue_free()
		for e in dummies:
			e.queue_free()
		await process_frame
	check(names.size() == 103 and no_fx.is_empty(), "② 시전 %d 전부 그림 노드가 생김 %s" % [names.size(), str(no_fx)])
	check(pop_bad.is_empty(), "② 숫자 수 = 맞은 수 %s" % str(pop_bad))
	var w: Array = stop_of.get("_cast_warrior_whirl", [0, 0])
	var c: Array = stop_of.get("_cast_warrior_cut", [0, 0])
	var g: Array = stop_of.get("_cast_general_smash", [0, 0])
	check(w[0] >= 2 and w[1] == 1 and c[0] >= 2 and c[1] == 1 and g[0] >= 4 and g[1] == 2,
		"③ 멈칫: 선풍 %d맞음→%d · 참격 %d맞음→%d · 패왕격(두 번) %d맞음→%d" % [w[0], w[1], c[0], c[1], g[0], g[1]])

	## create_timer 는 첫 프레임 delta(앞 시전이 쓴 시간)에 바로 끝난다 — 실제 시간으로 1.2초 프레임을 돈다(G-0200).
	var fx_on := _fx_nodes(stage).size()
	var t0 := Time.get_ticks_msec()
	while Time.get_ticks_msec() - t0 < 1200:
		await process_frame
	check(_fx_nodes(stage).size() == 0, "④ 그림 노드는 1.2초 안에 스스로 지워짐 %d → %d" % [fx_on, _fx_nodes(stage).size()])

	save.skills = saved_skills
	Engine.time_scale = 1.0
	print("PROBE story_skill_fx OK" if fails == 0 else "PROBE story_skill_fx FAIL %d" % fails)
	quit(1 if fails > 0 else 0)
