extends SceneTree
## G-0283 4종횡 공격·무예 몸짓 점검 —
##   godot --headless --path saga-godot --script res://tools/probe_story_action.gd   → "PROBE story_action OK" / "FAIL n"
## StoryPlayer 를 띄워(스킬 3렙·MP 가득·쿨다운 0 — probe_story_golden 과 같은 차림) 무예를 직접 부르고 몸 AnimationPlayer 를 본다.
## ① 기본 공격 → attack ② 갈래마다 하나(전사 strong·궁수 skill·마법 cast·도적 attack·각성 burst·물러서기 dodge·돌진 sprint)
## ③ 잠금 — 동작 직후 걸음새(_play_anim walk)가 안 덮고, ACT_SEC 뒤엔 덮음 ④ 같은 클립 연타 → 매번 동작 구간 시작으로 되감김
## ⑤ 80곳 전부 pose_clip 이 클립 이름(dex 몸에 있는 것이거나 sprint) ⑥ SAGA_STORY_ACTION=0 이면 sprint. 진짜 세이브는 안 건드린다.

const PLAYER_DIR := "res://games/saga_story/player/"
const SAMPLE := {"_attack": "attack", "_cast_warrior_cut": "strong", "_cast_archer_shot": "skill", "_cast_mage_fire": "cast",
	"_cast_rogue_twin": "attack", "_cast_godwar_wrath": "burst", "_cast_archer_retreat": "dodge", "_cast_warrior_rush": "sprint"}

var fails := 0


func _fail(msg: String) -> void:
	fails += 1
	print("  FAIL ", msg)


func _skill_keys() -> Dictionary:
	var keys := {}
	var rx := RegEx.create_from_string("skill_level\\(\"([a-z_0-9]+)\"\\)")
	for f in DirAccess.get_files_at(PLAYER_DIR):
		if f.ends_with(".gd"):
			for m in rx.search_all(FileAccess.get_file_as_string(PLAYER_DIR + f)):
				keys[m.get_string(1)] = 3
	return keys


func _fresh(stage: Node) -> Node:
	var p: Node = (load(PLAYER_DIR + "StoryPlayer.tscn") as PackedScene).instantiate()
	stage.add_child(p)
	p.set("mp", 99999.0)
	return p


func _ready_player(p: Node) -> void:
	for prop in p.get_property_list():
		if String(prop.name).begins_with("_cd_") or prop.name == "_attack_cd_left":
			p.set(prop.name, 0.0)
	p.set("mp", 99999.0)
	p.set_meta("act_until", 0)


func _initialize() -> void:
	await process_frame
	var save: Node = root.get_node("StorySaveState")
	var saved_skills: Dictionary = save.skills.duplicate()
	save.skills = _skill_keys()
	var stage := Node3D.new()
	root.add_child(stage)
	var p := _fresh(stage)
	for _i in 3:
		await process_frame
	var ap := p.get("_anim") as AnimationPlayer
	if ap == null:
		_fail("몸 AnimationPlayer 없음")
	else:
		## ①② 갈래 표본
		for m: String in SAMPLE:
			_ready_player(p)
			p.call(m)
			var got := ap.current_animation
			if got != String(SAMPLE[m]):
				_fail("② %s → %s (기대 %s)" % [m, got, SAMPLE[m]])
			print("ACT %s → %s" % [m, got])
		## ③ 잠금
		_ready_player(p)
		p.call("_cast_warrior_cut")
		p.call("_play_anim", "walk")
		if ap.current_animation != "strong":
			_fail("③ 동작 직후 걸음새가 덮음(%s)" % ap.current_animation)
		var sec: float = float(p.get_script().get_script_constant_map().get("ACT_SEC", {}).get("strong", 0.4))
		await create_timer(sec + 0.1).timeout
		p.call("_play_anim", "walk")
		if ap.current_animation != "walk":
			_fail("③ 잠금이 안 풀림(%s)" % ap.current_animation)
		## ④ 연타 되감기
		_ready_player(p)
		p.call("_attack")
		await create_timer(0.2).timeout
		var t1 := ap.current_animation_position
		_ready_player(p)
		p.call("_attack")
		if ap.current_animation_position > t1 - 0.05:
			_fail("④ 연타가 안 되감김(%.2f → %.2f)" % [t1, ap.current_animation_position])
	## ⑤ 80곳 표
	var B := p.get_script() as GDScript
	var rx := RegEx.create_from_string("_skill_pose\\(\"([a-z_0-9]+)\"\\)")
	var n := 0
	for f in DirAccess.get_files_at(PLAYER_DIR):
		if f.ends_with(".gd"):
			for m in rx.search_all(FileAccess.get_file_as_string(PLAYER_DIR + f)):
				var c: String = load(PLAYER_DIR + "story_player_base.gd").pose_clip(m.get_string(1))
				n += 1
				if c != "sprint" and ap != null and not ap.has_animation(c):
					_fail("⑤ %s → %s 클립 없음" % [m.get_string(1), c])
	if n != 80:
		_fail("⑤ _skill_pose 부름 %d ≠ 80" % n)
	print("ACT calls=%d script=%s" % [n, B.resource_path.get_file()])
	## ⑥ 손잡이
	OS.set_environment("SAGA_STORY_ACTION", "0")
	_ready_player(p)
	p.call("_play_anim", "idle")
	p.call("_cast_mage_fire")
	if ap != null and ap.current_animation != "sprint":
		_fail("⑥ SAGA_STORY_ACTION=0 인데 %s" % ap.current_animation)
	OS.set_environment("SAGA_STORY_ACTION", "")
	save.skills = saved_skills
	stage.queue_free()
	await process_frame
	print("PROBE story_action ", "OK" if fails == 0 else "FAIL %d" % fails)
	quit(1 if fails > 0 else 0)
