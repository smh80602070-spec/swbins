extends SceneTree

## 사가나락 직업·무예(games/saga_dungeon/data/dungeon_skills.gd 표 90개, dungeon_items.gd 무기→직업, dungeon_skill_state.gd 점수·단) 자동 점검 — 화면 없는 순수 표·규칙.
##   godot --headless --path saga-godot --script res://tools/probe_dungeon_skills.gd
## ① 직업 5(무장·궁장·책사·도독·방사): 무기 밑감 12개의 모양이 다 직업에 닿고 직업마다 무기가 있음·장착 무기로 직업이 갈림(빈 손·모르는 밑감은 무장)
## ② 무예 표: 90개·키 유일·직업 5×갈래 6×단 3 이 빠짐없이 한 칸씩·직업마다 18 · 모양 9(bolt·buff·chain·curse·dash·heal·nova·summon·swing)이 다 쓰임
## ③ 칸 내용: 모양 무예는 쿨다운·위력(v·grow)>0·eff 비어 있음 / 패시브는 모양 없이 eff 가 있고 / 원소는 6결 중(물리 아님) / 이름·설명이 있음 / 광역 모양(nova·swing)은 r>0
## ④ 선행(prereq_of): 0단은 없음·1단은 같은 갈래 0단·2단은 1단 · value_at: 0단 0, 그 뒤 v+grow×(단-1)·오름
## ⑤ DungeonSkillState: 점수가 없으면 못 올림·직업별 점수·선행 없으면 막힘·단이 오를수록 점수가 줆·MAX_RANK(5)에서 막힘·모르는 키 거절·world_eff_sum(패시브 단 비례·무예 모양은 0)·restore 가 통째로 갈아 끼움.
## 상태는 끝에 되돌린다. 끝에 "PROBE dungeon_skills OK" 또는 "PROBE dungeon_skills FAIL n".

const Skills := preload("res://games/saga_dungeon/data/dungeon_skills.gd")
const Items := preload("res://games/saga_dungeon/data/dungeon_items.gd")

const SHAPES := ["bolt", "buff", "chain", "curse", "dash", "heal", "nova", "summon", "swing"]
const CLASSES := ["warrior", "archer", "scholar", "marshal", "mystic"]

var fails := 0


func check(cond: bool, msg: String) -> void:
	if cond:
		print("  ok   ", msg)
	else:
		fails += 1
		print("  FAIL ", msg)


func _initialize() -> void:
	await process_frame
	var S: Node = root.get_node("DungeonSkillState")
	var saved_points: Dictionary = S.points.duplicate()
	var saved_ranks: Dictionary = S.ranks.duplicate()

	# ① 직업
	var cls_names: Array = Items.CLASS_NAMES.keys()
	cls_names.sort()
	var want: Array = CLASSES.duplicate()
	want.sort()
	check(cls_names == want and Items.CLASS_NAMES.warrior == "무장" and Items.CLASS_NAMES.archer == "궁장" and Items.CLASS_NAMES.scholar == "책사" and Items.CLASS_NAMES.marshal == "도독" and Items.CLASS_NAMES.mystic == "방사", "직업 5: 무장·궁장·책사·도독·방사")
	var looks_ok := true
	var weapons_of := {}
	for b: Dictionary in Items.BASES:
		if b.slot != "weapon":
			continue
		var c: String = String(Items.WEAPON_CLASS.get(b.look, ""))
		looks_ok = looks_ok and CLASSES.has(c)
		weapons_of[c] = int(weapons_of.get(c, 0)) + 1
	check(looks_ok and weapons_of.size() == 5, "무기 밑감 12개의 모양이 다 직업에 닿고 직업마다 무기가 있음 %s" % str(weapons_of))
	check(Items.class_key_for_weapon({"base": "w_gakgung"}) == "archer" and Items.class_key_for_weapon({"base": "w_seonchae"}) == "scholar" and Items.class_key_for_weapon({"base": "w_hwando"}) == "marshal" and Items.class_key_for_weapon({"base": "w_jukjang"}) == "mystic" and Items.class_key_for_weapon({"base": "w_bugae"}) == "warrior", "장착 무기로 직업이 갈림(각궁 궁장·선채 책사·환도 도독·죽장 방사·부월 무장)")
	check(Items.class_key_for_weapon({}) == "warrior" and Items.class_key_for_weapon({"base": "zzz"}) == "warrior" and Items.class_name_for_weapon({"base": "w_gakgung"}) == "궁장" and Items.class_name_for_weapon({}) == "무장", "빈 손·모르는 밑감은 무장 · 직업 이름")

	# ② 무예 표
	var keys := {}
	var cells := {}
	var per_cls := {}
	var shapes_used := {}
	for s: Dictionary in Skills.SKILLS:
		keys[s.key] = true
		cells["%s/%d/%d" % [s.cls, int(s.br), int(s.row)]] = s.key
		per_cls[s.cls] = int(per_cls.get(s.cls, 0)) + 1
		if s.has("shape"):
			shapes_used[s.shape] = int(shapes_used.get(s.shape, 0)) + 1
	check(Skills.SKILLS.size() == 90 and keys.size() == 90 and cells.size() == 90, "무예 90개 · 키 유일 · (직업, 갈래, 단) 칸이 겹치지 않음")
	var grid_ok := true
	for c in CLASSES:
		for br in 6:
			for row in 3:
				grid_ok = grid_ok and cells.has("%s/%d/%d" % [c, br, row])
	check(grid_ok and per_cls.size() == 5 and per_cls.values().all(func(n): return n == 18), "직업 5 × 갈래 6 × 단 3 이 빠짐없이 한 칸씩(직업마다 18)")
	var shape_names: Array = shapes_used.keys()
	shape_names.sort()
	check(shape_names == SHAPES, "모양 9가 다 쓰임 %s" % str(shapes_used))

	# ③ 칸 내용
	var bad: Array = []
	var passives := 0
	for s: Dictionary in Skills.SKILLS:
		var ok: bool = String(s.name) != "" and String(s.desc) != "" and float(s.v) > 0.0 and float(s.grow) >= 0.0
		if s.has("shape"):
			ok = ok and SHAPES.has(String(s.shape)) and float(s.get("cd", 0.0)) > 0.0 and String(s.eff) == "" and (float(s.grow) > 0.0 or String(s.shape) == "summon")  # 소환(토우)은 단이 올라도 위력이 고정
			if ["nova", "swing"].has(String(s.shape)):
				ok = ok and float(s.get("r", 0.0)) > 0.0  # 사슬(chain)은 r 를 안 적으면 기본 반경
		else:
			passives += 1
			ok = ok and String(s.eff) != ""
		if s.has("el"):
			ok = ok and not Items.elem_by_key(String(s.el)).is_empty() and String(s.el) != "phys"
		if not ok:
			bad.append(s.key)
	check(bad.is_empty() and passives == 90 - 76, "칸 내용: 모양 무예 76(쿨다운·위력>0·eff 비어 있음·광역 모양은 반경) · 패시브 %d(eff 있음) · 원소는 6결 중 %s" % [passives, str(bad)])

	# ④ 선행·값
	var pre_ok := true
	for s: Dictionary in Skills.SKILLS:
		var pre: Dictionary = Skills.prereq_of(s)
		if int(s.row) == 0:
			pre_ok = pre_ok and pre.is_empty()
		else:
			pre_ok = pre_ok and pre.cls == s.cls and int(pre.br) == int(s.br) and int(pre.row) == int(s.row) - 1
	check(pre_ok, "선행: 0단은 없음 · 1단은 같은 갈래 0단 · 2단은 1단")
	var eye: Dictionary = Skills.skill_by_key("a_eye")
	check(Skills.value_at(eye, 0) == 0.0 and Skills.value_at(eye, -2) == 0.0 and Skills.value_at(eye, 1) == 4.0 and Skills.value_at(eye, 3) == 10.0 and Skills.value_at(eye, 5) > Skills.value_at(eye, 4) and Skills.skill_by_key("nope").is_empty() and Skills.skills_of("archer").size() == 18 and Skills.skills_of("nobody").is_empty(), "value_at: 0단 0 · 1단 v · v+grow×(단-1) · skill_by_key·skills_of")

	# ⑤ 상태
	S.restore({}, {})
	check(not S.can_invest("a_pierce") and not S.invest("a_pierce") and S.rank_of("a_pierce") == 0, "점수가 없으면 못 올림")
	S.award_point("archer")
	S.award_point("archer")
	check(S.points_for("archer") == 2 and S.points_for("warrior") == 0 and not S.can_invest("w_whirl") and S.can_invest("a_pierce") and not S.can_invest("nope"), "점수는 직업별 · 다른 직업 무예는 못 올림 · 모르는 키 거절")
	var row1: Dictionary = {}
	for s: Dictionary in Skills.skills_of("archer"):
		if int(s.br) == int(Skills.skill_by_key("a_pierce").br) and int(s.row) == 1:
			row1 = s
	check(not S.can_invest(String(row1.key)), "선행(0단)이 없으면 1단은 막힘")
	check(S.invest("a_pierce") and S.rank_of("a_pierce") == 1 and S.points_for("archer") == 1 and S.can_invest(String(row1.key)), "올리면 단 +1·점수 -1 · 0단에 점이 생기면 1단이 열림")
	for i in 10:
		S.award_point("archer")
	var ups := 0
	for i in 10:
		if S.invest("a_pierce"):
			ups += 1
	check(S.rank_of("a_pierce") == Skills.MAX_RANK and ups == Skills.MAX_RANK - 1 and not S.can_invest("a_pierce") and S.points_for("archer") == 1 + 10 - ups, "MAX_RANK(%d)에서 막히고 점수는 쓴 만큼만 줆" % Skills.MAX_RANK)
	S.restore({}, {})
	S.award_point("archer")
	S.award_point("archer")
	S.award_point("archer")
	S.invest("a_eye")
	S.invest("a_eye")
	S.invest("a_eye")
	check(S.world_eff_sum("critPct") == 10.0 and S.world_eff_sum("hpPct") == 0.0 and S.world_eff_sum("") == 0.0, "world_eff_sum: 패시브 매의 눈 3단 = 치명 +10 · 다른 eff 0 · 빈 키 0")
	S.award_point("archer")
	S.invest("a_pierce")
	check(S.world_eff_sum("critPct") == 10.0, "무예 모양은 world_eff_sum 에 안 섞임")
	S.restore({"warrior": "2"}, {"w_whirl": "3", "a_eye": 0})
	check(S.points_for("warrior") == 2 and S.points_for("archer") == 0 and S.rank_of("w_whirl") == 3 and S.rank_of("a_eye") == 0 and S.world_eff_sum("critPct") == 0.0, "restore: 문자열 값을 정수로 · 이전 상태를 통째로 갈아 끼움")

	S.restore(saved_points, saved_ranks)
	print("PROBE dungeon_skills ", "OK" if fails == 0 else "FAIL %d" % fails)
	quit(1 if fails > 0 else 0)
