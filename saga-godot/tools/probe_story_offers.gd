extends SceneTree

## G-0197 4종횡 레벨업 무예 3택·사냥터 결과 등급 자동 점검(games/saga_story/data/story_save_state.gd · story_skill_meta.gd).
##   godot --headless --path saga-godot --script res://tools/probe_story_offers.gd
## ① 옛 세이브(sp_cut_lv 없음, Lv.30·무예 20) 를 불러오면 남은 SP 가 전과 같다 ② 새 판(컷 1): 무사 Lv1 → Lv4 = 3택 세 장 · 장마다 유파가 서로 다름 · SP 는 0
## ③ 레벨 100개로 굴린 3택에 같은 유파·같은 무예 겹침 0 ④ 고르기 = 그 무예 +1·SP 그대로 · 거절 = SP +1 ⑤ 전직 전(고를 무예 없음)은 레벨마다 SP 3 그대로
## ⑥ 등급: (피격 0·연속 20·90초) S · (15·3·600초) C · 사이 값 ⑦ 판 셈: 타격 셋 → 연속 3 · 맞으면 끊기고 피격 1 · 나오면 last_run ⑧ 무예 92 이름·유파 다 있음 · 저장 왕복(3택).
## 상태는 끝에 되돌린다. 끝에 "PROBE story_offers OK|FAIL n".

const SAVED_VARS := ["level", "exp", "job", "skills", "sp_cut_lv", "sp_bonus", "skill_offers", "skill_free", "quests_done", "achievements", "feat", "last_run", "run_t0_ms", "run_hits", "run_combo", "run_combo_max", "path_override"]

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


func _fresh(lv: int, job: String) -> void:
	S.level = lv
	S.exp = 0
	S.job = job
	S.skills = {}
	S.sp_cut_lv = 1
	S.sp_bonus = 0
	S.skill_offers = []
	S.skill_free = {}


func _initialize() -> void:
	await process_frame
	S = root.get_node("StorySaveState")
	Combat = load("res://games/saga_story/data/story_combat.gd")
	Meta = load("res://games/saga_story/data/story_skill_meta.gd")
	var saved := {}
	for v in SAVED_VARS:
		var cur: Variant = S.get(v)
		saved[v] = cur.duplicate(true) if (cur is Dictionary or cur is Array) else cur

	# ①
	var skills20 := {"w_cut": 5, "w_whirl": 5, "w_rush": 5, "w_iron": 5}
	var old_left := (30 - 1) * int(Combat.SP_PER_LEVEL) - 20
	S.path_override = "user://probe_story_offers_old.json"
	var f := FileAccess.open(S.path_override, FileAccess.WRITE)
	f.store_string(JSON.stringify({"version": 18, "level": 30, "exp": 0, "job": "warrior", "skills": skills20, "gold": 0, "player_pos": [0.0, 0.1, 0.0]}))
	f.close()
	var ld: bool = S.try_load()
	check(ld and S.sp_cut_lv == 30 and S.sp_left() == old_left, "옛 세이브(Lv.30·무예 20): 컷 = 불러온 레벨 30 · 남은 SP %d = 전과 같음(%d)" % [S.sp_left(), old_left])
	DirAccess.remove_absolute(ProjectSettings.globalize_path(S.path_override))
	# ②
	_fresh(1, "warrior")
	var need := 0
	for lv in range(1, 4):
		need += Combat.exp_need(lv)
	S.add_exp(need)
	var distinct_ok := true
	for o: Dictionary in S.skill_offers:
		var sc := {}
		for k: String in o.keys:
			sc[Meta.school_of(k)] = true
		distinct_ok = distinct_ok and sc.size() == (o.keys as Array).size() and (o.keys as Array).size() >= 1
	check(S.level == 4 and S.skill_offers.size() == 3 and distinct_ok and S.sp_left() == 0, "새 판 무사 Lv1 → 4: 3택 세 장(Lv%s) · 장마다 유파 서로 다름 · SP 0" % str(S.skill_offers.map(func(o): return o.lv)))
	# ③
	_fresh(40, "warrior")
	var dup := 0
	for lv in range(2, 102):
		var keys: Array = S.offer3(lv)
		var sc2 := {}
		var kk := {}
		for k: String in keys:
			if sc2.has(Meta.school_of(k)) or kk.has(k):
				dup += 1
			sc2[Meta.school_of(k)] = true
			kk[k] = true
	check(dup == 0, "레벨 100개 3택 — 같은 유파·같은 무예 겹침 0")
	# ④
	_fresh(5, "warrior")
	S.sp_cut_lv = 5   # SP 12 가 있는 상태에서 — 공짜 올리기가 SP 를 안 깎는지 본다
	S.skill_offers = [{"lv": 5, "keys": S.offer3(5)}]
	var k0: String = S.skill_offers[0].keys[0]
	var sp0: int = S.sp_left()
	var picked: bool = S.pick_offer(0, k0)
	var after_pick: int = S.sp_left()
	S.skill_offers = [{"lv": 6, "keys": S.offer3(6)}]
	S.decline_offer(0)
	check(picked and S.skill_level(k0) == 1 and after_pick == sp0 and S.sp_left() == sp0 + 1 and S.skill_offers.is_empty() and not S.pick_offer(0, k0), "고르기: %s +1 · SP 그대로 · 거절: SP +1 · 장이 사라짐" % Meta.name_of(k0))
	# ⑤
	_fresh(1, "none")
	var need5 := 0
	for lv in range(1, 6):
		need5 += Combat.exp_need(lv)
	S.add_exp(need5)
	check(S.level == 6 and S.skill_offers.is_empty() and S.sp_total() == 5 * int(Combat.SP_PER_LEVEL), "전직 전(고를 무예 없음): 3택 없이 레벨마다 SP %d 그대로(총 %d)" % [int(Combat.SP_PER_LEVEL), S.sp_total()])
	# ⑥
	check(S.rank_of(90.0, 0, 20) == "S" and S.rank_of(600.0, 15, 3) == "C" and S.rank_of(200.0, 3, 10) == "B" and S.rank_of(150.0, 1, 9) == "A", "등급: S(0·20·90초) · C(15·3·600초) · B(3·10·200초) · A(1·9·150초)")
	# ⑦
	S.begin_run()
	S.note_player_hit()
	S.note_player_hit()
	S.note_player_hit()
	var c3: int = S.run_combo_max
	S.note_hurt()
	var cut: int = S.run_combo
	var r: Dictionary = S.end_run()
	var again: Dictionary = S.end_run()
	check(c3 == 3 and cut == 0 and int(r.hits) == 1 and int(r.combo) == 3 and S.last_run == r and again.is_empty() and "⭐ 지난 사냥 등급" in S.run_line(r), "판 셈: 연속 3 · 맞으면 끊김·피격 1 · 나오면 last_run(%s) · 두 번 나와도 하나" % S.run_line(r))
	# ⑧
	var all_meta := true
	for k: String in Combat.SKILL_JOB.keys():
		all_meta = all_meta and Meta.SKILLS.has(k) and Meta.SCHOOL_NAMES.has(Meta.school_of(k))
	_fresh(12, "warrior")
	S.skill_offers = [{"lv": 12, "keys": ["w_cut", "w_whirl"]}]
	S.sp_bonus = 4
	S.path_override = "user://probe_story_offers_rt.json"
	var dummy := Node3D.new()
	dummy.add_to_group("player")
	root.add_child(dummy)
	var sv: bool = S.save()
	S.skill_offers = []
	S.sp_bonus = 0
	var ld2: bool = S.try_load()
	check(all_meta and sv and ld2 and S.skill_offers.size() == 1 and S.sp_bonus == 4 and S.sp_cut_lv == 1, "무예 %d 이름·유파 다 있음 · 저장 왕복(3택·SP 덤·컷)" % Combat.SKILL_JOB.size())
	DirAccess.remove_absolute(ProjectSettings.globalize_path(S.path_override))
	dummy.queue_free()
	await process_frame

	for v in SAVED_VARS:
		S.set(v, saved[v])
	print("PROBE story_offers ", "OK" if fails == 0 else "FAIL %d" % fails)
	quit(1 if fails > 0 else 0)
