extends SceneTree

## G-0246 4종횡 5차 전직·각성기 여덟(웹 data-job.js 09-30 이식) 자동 점검. 씨앗 고정(20260824). 진짜 세이브는 안 건드린다(상태는 끝에 되돌림).
##   godot --headless --path saga-godot --script res://tools/probe_story_awaken.gd
## ① 표: 5차 넷(군신·천궁·무영·태허) 사슬·tier 5·Lv80·게이트 10 · 각성기 여덟 SKILL_JOB·선행 = 그 4차 사슬 무예 5(같은 유파)·이름 · 입력 story_job_skill5_1·5_2 키가 다른 액션·탈것 키와 안 겹침
## ② 진급: Lv79·4차 무예 9 막힘 → Lv80·10 이면 5차 · add_exp 로 Lv80 에 닿음(상한 없음) · 사슬 수치 합
## ③ need: 각성기는 선행 4차 무예 5 부터 · 4차 무예는 5차가 돼도 그대로 올림
## ④ 시전: 천멸격 5타(기력 74·쿨 13) · 4차 파멸격 4타 그대로 · 입력 5_1 이 천멸격으로 · 유명문 무적 2초 · 만상환생 회복 · 저장 왕복(job·skills)
## 끝에 "PROBE story_awaken OK" 또는 "PROBE story_awaken FAIL n".

const SAVED_VARS := ["level", "exp", "job", "skills", "sp_cut_lv", "sp_bonus", "skill_offers", "skill_free", "quests_done", "achievements", "feat", "gold", "mentor_bond", "path_override"]
const TIER5 := {"godwar": "warlord", "skybow": "falcon", "noshadow": "reaper", "voidsage": "ascendant"}
const AWAKEN := {"p_wrath": "o_ruin", "p_banner": "o_conquer", "p_stars": "h_swarm", "p_sun": "h_ray",
	"p_afterimage": "d_carve", "p_gate": "d_veil", "p_void": "z_collapse", "p_all": "z_rebirth"}

var fails := 0
var S: Node
var Combat: GDScript
var Meta: GDScript


func check(cond: bool, msg: String) -> void:
	if cond:
		print("  ok   ", msg)
	else:
		fails += 1
		print("  FAIL ", msg)


func _fresh(lv: int, job: String, skills: Dictionary) -> void:
	S.level = lv
	S.exp = 0
	S.job = job
	S.skills = skills.duplicate()
	S.sp_cut_lv = 999   # 옛 규칙(레벨마다 SP) — 3택 창이 안 끼게
	S.sp_bonus = 0
	S.skill_offers = []
	S.skill_free = {}
	S.mentor_bond = 0


func _keys_of(action: String) -> Array:
	var out: Array = []
	for ev in InputMap.action_get_events(action):
		if ev is InputEventKey:
			out.append(int((ev as InputEventKey).physical_keycode))
	return out


func _initialize() -> void:
	await process_frame
	seed(20260824)
	S = root.get_node("StorySaveState")
	Combat = load("res://games/saga_story/data/story_combat.gd")
	Meta = load("res://games/saga_story/data/story_skill_meta.gd")
	var saved := {}
	for v in SAVED_VARS:
		var cur: Variant = S.get(v)
		saved[v] = cur.duplicate(true) if (cur is Dictionary or cur is Array) else cur

	# ① 표
	var t_ok: bool = Combat.JOBS_TIER5.size() == 4
	for k: String in TIER5:
		var below: String = TIER5[k]
		var ki: Dictionary = Combat.job_info(k)
		var bi: Dictionary = Combat.job_info(below)
		t_ok = t_ok and Combat.job_tier(k) == 5 and Combat.job_prereq(k) == below and Combat.job_next(below) == k and Combat.job_level_need(k) == 80 \
			and Combat.job_advance_skill_gate(k) == 10 and float(ki.hp) > float(bi.hp) and float(ki.atk) > float(bi.atk) and (Combat.job_chain(k) as Array).size() == 5 \
			and (Combat.JOB_SKILL_KEYS.get(k, []) as Array).size() == 2
	check(t_ok, "5차 넷: 사슬(4차 위)·tier 5·Lv80·게이트 10·수치 오름·무예 둘")
	var a_ok := true
	for k: String in AWAKEN:
		var need: Dictionary = Combat.SKILL_NEED.get(k, {})
		var tip: String = AWAKEN[k]
		a_ok = a_ok and TIER5.has(String(Combat.SKILL_JOB.get(k, ""))) and String(need.get("key", "")) == tip and int(need.get("lv", 0)) == 5 \
			and TIER5[Combat.SKILL_JOB[k]] == Combat.SKILL_JOB[tip] and Meta.school_of(k) == Meta.school_of(tip) and Meta.name_of(k) != k and Meta.fx_of(k) == Meta.fx_of(tip)
	check(a_ok and Combat.SKILL_JOB.size() == 100, "각성기 여덟: 5차 무예 · 선행 = 그 4차 사슬 무예 5 · 같은 유파·같은 효과 꼴 · 이름 (무예 %d)" % Combat.SKILL_JOB.size())
	var k1 := _keys_of("story_job_skill5_1")
	var k2 := _keys_of("story_job_skill5_2")
	var clash: Array = []
	for a in InputMap.get_actions():
		var an := String(a)
		if an.begins_with("ui_") or an.begins_with("story_job_skill5_"):
			continue
		for c in _keys_of(an):
			if k1.has(c) or k2.has(c):
				clash.append(an)
	for c in [KEY_BRACKETLEFT, KEY_BRACKETRIGHT, KEY_MINUS, KEY_EQUAL]:   # 탈것 키(mount.gd 가 실행 중에 넣는다)
		if k1.has(c) or k2.has(c):
			clash.append("mount")
	check(k1 == [KEY_BACKSLASH] and k2 == [KEY_QUOTELEFT] and clash.is_empty(), "입력 5_1 = \\ · 5_2 = ` · 다른 액션·탈것 키와 안 겹침 %s" % str(clash))

	# ② 진급
	_fresh(79, "warlord", {"o_ruin": 9})
	var b1: bool = not S.can_advance_job("godwar")
	S.level = 80
	var b2: bool = not S.can_advance_job("godwar")
	S.level = 79
	S.skills["o_ruin"] = 10
	var b3: bool = not S.can_advance_job("godwar")
	S.level = 80
	check(b1 and b2 and b3 and S.can_advance_job("godwar") and not S.can_advance_job("skybow") and S.advance_job("godwar") and S.job == "godwar", "5차: Lv79·무예 9 / Lv80·9 / Lv79·10 막힘 → Lv80·10 이면 군신 · 다른 갈래는 못 감")
	var gr: Dictionary = Combat.job_grow_chain("godwar")
	check(is_equal_approx(float(gr.hp), 40.0 + 110.0 + 190.0 + 300.0 + 420.0) and is_equal_approx(float(gr.atk), 2.0 + 7.0 + 13.0 + 20.0 + 27.0), "사슬 수치 합(군신 hp %d·atk %d)" % [int(gr.hp), int(gr.atk)])
	_fresh(79, "warlord", {})
	S.add_exp(Combat.exp_need(79) * 2)
	check(S.level >= 80, "add_exp 로 Lv80 에 닿음(상한 없음, 지금 Lv%d · Lv79→80 필요 %d)" % [S.level, Combat.exp_need(79)])

	# ③ need
	_fresh(85, "godwar", {"o_ruin": 10, "o_conquer": 4})
	var n1: bool = not S.can_raise_free("p_banner")
	S.skills["o_conquer"] = 5
	check(n1 and S.can_raise_free("p_banner") and S.can_raise_free("p_wrath") and S.can_raise_free("w_cut") and not S.can_raise_free("p_stars"), "각성기는 선행 4차 무예 5 부터 · 아래 무예도 계속 · 다른 갈래 각성기는 못 올림")

	# ④ 시전
	var dummy := GDScript.new()
	dummy.source_code = "extends Node3D\nvar hp := 0.0\nvar hits := 0\nfunc take_damage(a: float) -> void:\n\thp += a\n\thits += 1\n"
	dummy.reload()
	var stage := Node3D.new()
	root.add_child(stage)
	current_scene = stage
	_fresh(85, "godwar", {"o_ruin": 10, "p_wrath": 5})
	var packed: PackedScene = load("res://games/saga_story/player/StoryPlayer.tscn")
	var p: Node = packed.instantiate()
	stage.add_child(p)
	var e: Node3D = Node3D.new()
	e.set_script(dummy)
	e.add_to_group("story_enemy")
	stage.add_child(e)
	e.global_position = Vector3(0.6, 0.0, 0.0)
	await process_frame
	p.set_physics_process(false)
	p.set_process(false)
	p.global_position = Vector3.ZERO
	p._facing = 1.0
	p.mp = 999.0
	p._cast_godwar_wrath()
	check(int(e.hits) == 5 and float(e.hp) > 0.0 and is_equal_approx(float(p.mp), 999.0 - 74.0) and is_equal_approx(float(p._cd_godwar_wrath), 13.0), "천멸격: 5타(피해 %d) · 기력 74 · 쿨 13" % int(e.hp))
	var h5: int = int(e.hits)
	p._cast_godwar_wrath()
	check(int(e.hits) == h5, "쿨 중엔 안 나감")
	e.hits = 0
	p._cast_warlord_ruin()
	check(int(e.hits) == 4, "5차(군신)에서도 4차 파멸격 그대로 4타")
	p._cd_godwar_wrath = 0.0
	e.hits = 0
	Input.action_press("story_job_skill5_1")
	p._awaken_input(Combat.job_chain(S.job))
	Input.action_release("story_job_skill5_1")
	check(int(e.hits) == 5, "입력 story_job_skill5_1 → 천멸격(맞음 %d)" % int(e.hits))
	p._tick_awaken_cd(20.0)
	check(p._cd_godwar_wrath == 0.0, "쿨다운은 시간이 가면 0")
	S.job = "noshadow"
	S.skills = {"p_gate": 1}
	p._invuln_time_left = 0.0
	p._cast_noshadow_gate()
	check(is_equal_approx(float(p._invuln_time_left), 2.0) and p.global_position.x > 9.0, "유명문: 9.2m 나아감 · 무적 2초")
	S.job = "voidsage"
	S.skills = {"p_all": 10}
	p.hp = 1.0
	p._cast_voidsage_all()
	check(is_equal_approx(float(p.hp), float(p.max_hp)), "만상환생: 80%+ 회복(Lv10 = 140% → 가득)")
	p.queue_free()
	e.queue_free()
	await process_frame

	# 저장 왕복
	_fresh(80, "godwar", {"o_ruin": 10, "p_wrath": 3, "p_banner": 1})
	S.path_override = "user://probe_story_awaken_rt.json"
	var pl := Node3D.new()
	pl.add_to_group("player")
	root.add_child(pl)
	var sv: bool = S.save()
	S.job = "none"
	S.skills = {}
	var ld: bool = S.try_load()
	check(sv and ld and S.job == "godwar" and S.skill_level("p_wrath") == 3 and S.skill_level("p_banner") == 1 and S.save_version() >= 22, "저장 왕복: job 군신·각성기 레벨 그대로(버전 %d 그대로)" % S.save_version())
	DirAccess.remove_absolute(ProjectSettings.globalize_path(S.path_override))
	pl.queue_free()
	await process_frame

	for v in SAVED_VARS:
		S.set(v, saved[v])
	print("PROBE story_awaken ", "OK" if fails == 0 else "FAIL %d" % fails)
	quit(1 if fails > 0 else 0)
