extends SceneTree

## G-0241 2나락 무예별 작은 나무(data/dungeon_skill_tree.gd, 웹 skill-tree.js W-0280) 자동 점검 — 적 노드를 직접 세워 시전기 규칙만 본다(그림은 안 봄).
##   godot --headless --path saga-godot --script res://tools/probe_dungeon_skilltree.gd
## ① 시전 성공마다 경험 1(빗나감은 0)·Lv 2 = 8 · 누적 1520 이면 Lv 20 · 점 = Lv-1
## ② 점 찍기: 앞 마디 1점 · 갈래 하나 · 마디 최대 3(결·연타 1) · 점 없음 거절
## ③ 효과: 재냉각 ×(1-cd%)(경락 cd 와 곱) · 기력 축도 재냉각 · 하한 ×0.3 · 반경 r ×(1+범위%) · 위력 ×(1+dmg%) · 결 덧붙임(없으면 el, 있으면 ×1.05) · 연타(bolt 화살 +1) · 흡수 = 시전 때 drainPct 임시 · 원본 표는 안 바뀜
## ④ 되돌리기: 금 200·경험 유지 · 금 모자람 실패 · 빈 나무 실패
## ⑤ 저장 왕복(skill_tree, path_override 임시 파일) · 옛 세이브(칸 없음) = {}
## 상태는 끝에 되돌린다. 끝에 "PROBE dungeon_skilltree OK" 또는 "PROBE dungeon_skilltree FAIL n".

const SkTree := preload("res://games/saga_dungeon/data/dungeon_skill_tree.gd")
const Meridian := preload("res://games/saga_dungeon/data/dungeon_meridian.gd")

var fails := 0


func check(cond: bool, msg: String) -> void:
	if cond:
		print("  ok   ", msg)
	else:
		fails += 1
		print("  FAIL ", msg)


class FakePlayer extends CharacterBody3D:
	var dash_dir := Vector3.ZERO
	var dash_speed := 0.0


func _initialize() -> void:
	await process_frame
	seed(20260824)
	var Enemy: GDScript = load("res://games/saga_dungeon/world/dungeon_enemy.gd")
	var Caster: GDScript = load("res://games/saga_dungeon/player/skill_caster.gd")
	var Melee: GDScript = load("res://games/saga_dungeon/player/melee_attack.gd")
	var Skills: GDScript = load("res://games/saga_dungeon/data/dungeon_skills.gd")
	var Run: Node = root.get_node("DungeonRunState")
	var Eq: Node = root.get_node("DungeonEquipmentState")
	var SS: Node = root.get_node("DungeonSkillState")
	var Gold: Node = root.get_node("DungeonGoldState")
	var Save: Node = root.get_node("DungeonSaveState")
	var saved := [SS.points.duplicate(true), SS.ranks.duplicate(true), SS.slots.duplicate(true), SS.tree.duplicate(true), Run.boons.duplicate(true), Gold.gold]
	var saved_equip := {}
	for s in Eq.SLOT_NAMES:
		saved_equip[s] = (Eq.item_for(s) as Dictionary).duplicate(true)
		Eq.equip(s, {})
	Run.boons = {}
	Run._temp_buffs.clear()
	SS.restore({}, {"w_whirl": 1, "s_wave": 1, "a_multi": 1}, {})
	SS.restore_tree({})

	var world := Node3D.new()
	root.add_child(world)
	current_scene = world
	var player := FakePlayer.new()
	world.add_child(player)
	var vis := Node3D.new()
	vis.name = "Visual"
	player.add_child(vis)
	var caster: Node = Caster.new()
	player.add_child(caster)
	await process_frame
	var spawn := func(pos: Vector3) -> Node:
		var e: Node = Enemy.new(12)
		world.add_child(e)
		(e as Node3D).global_position = pos
		e.hp = 5000.0
		e.max_hp = 5000.0
		e.resist = {}
		e._elite_def = {}
		return e
	var clear := func() -> void:
		for c in world.get_children():
			if c != player:
				c.free()
		Run._temp_buffs.clear()
		Run.add_temp_buff("critPct", -1000.0, 60.0)
		caster._cd.clear()

	# ① 경험·레벨
	clear.call()
	check(not caster.try_cast("w_whirl") and int(SkTree.progress("w_whirl").xp) == 0 and SkTree.lv_of("w_whirl") == 1, "빗나간 시전(적 없음)은 경험 0 · 처음 Lv 1")
	for i in 8:
		clear.call()
		spawn.call(Vector3(1.0, 0, 0))
		caster.try_cast("w_whirl")
	check(SkTree.lv_of("w_whirl") == 2 and SkTree.points_left("w_whirl") == 1 and SkTree.lv_of("s_wave") == 1, "시전 8 = Lv 2 · 점 1 · 나무는 무예마다(s_wave 그대로) %s" % str(SkTree.progress("w_whirl")))
	SS.tree["w_whirl"].xp = 1519
	check(SkTree.lv_of("w_whirl") == 19, "누적 1519 = Lv 19")
	SkTree.gain("w_whirl")
	check(SkTree.lv_of("w_whirl") == 20 and int(SkTree.progress("w_whirl").need) == 0 and SkTree.points_left("w_whirl") == 19, "누적 1520 = Lv 20(끝) · 점 19")

	# ② 찍기 규칙
	check(SkTree.why("w_whirl", 1, "a") == "prereq" and not bool(SkTree.put("w_whirl", 1, "a").ok), "앞 마디에 점이 없으면 못 찍음")
	check(bool(SkTree.put("w_whirl", 0, "a").ok) and SkTree.why("w_whirl", 0, "b") == "side", "마디 0 가 찍으면 같은 마디 나는 막힘")
	SkTree.put("w_whirl", 0, "a")
	SkTree.put("w_whirl", 0, "a")
	check(SkTree.why("w_whirl", 0, "a") == "max" and SkTree.spent("w_whirl") == 3, "한 마디 최대 3점")
	SkTree.put("w_whirl", 1, "b")
	SkTree.put("w_whirl", 1, "b")
	SkTree.put("w_whirl", 1, "b")
	SkTree.put("w_whirl", 2, "a")
	SkTree.put("w_whirl", 3, "a")
	check(SkTree.why("w_whirl", 3, "a") == "max" and (SS.tree.w_whirl.pts as Array) == [3, -3, 1, 1], "결 마디는 1점 · pts %s" % str(SS.tree.w_whirl.pts))
	SS.tree["s_wave"] = {"xp": 8, "pts": [1]}
	check(SkTree.why("s_wave", 1, "a") == "point", "점 없음 거절(s_wave Lv2 점 1 다 씀)")

	# ③ 효과 — w_whirl: 위력 12+5=17% · 범위 18% · 불 결(el 없음 → fire)
	clear.call()
	var whirl: Dictionary = Skills.skill_by_key("w_whirl")
	var m: Dictionary = SkTree.mods(whirl)
	check(is_equal_approx(float(m.r), 2.3 * 1.18) and str(m.el) == "fire" and is_equal_approx(float(m.tree_dmg), 1.17) and not whirl.has("tree_dmg") and is_equal_approx(float(whirl.r), 2.3) and not whirl.has("el"), "범위 r×1.18 · 불 결 덧붙임 · 위력 ×1.17 · 원본 표 그대로")
	var e_far: Node = spawn.call(Vector3(2.3 * 1.18 * Run.reach_mult() - 0.05, 0, 0))
	var e_near: Node = spawn.call(Vector3(1.0, 0, 0))
	var want := maxf(1.0, roundf(Melee.ATK_DAMAGE * Run.atk_mult() * Skills.value_at(whirl, 1) * Run.skill_mul() * 1.17 * Meridian.hit_mul(self, e_near, player) * Meridian.mul("skill")))
	check(caster.try_cast("w_whirl") and 5000.0 - e_far.hp > 0.0 and is_equal_approx(5000.0 - e_near.hp, want), "넓어진 반경 끝의 적도 맞음 · 피해 ×1.17 (%.0f / %.0f)" % [5000.0 - e_near.hp, want])
	check(is_equal_approx(float(caster._cd.w_whirl), 5.0 * Meridian.mul("cd")), "재냉각 점 없으면 cd 그대로(경락 배수만)")
	# 재냉각·기력·하한 — 손으로 나무를 세움
	SS.tree["w_whirl"].pts = [-3, 3, 0, 0, 3, 0, -3, -3]   # 기력 18 · 재냉각 12 · 기력 15 · 재냉각 15 · 기력 24
	var mc: Dictionary = SkTree.mods(whirl)
	var cd_want := maxf(0.3, (1.0 - 0.27) * (1.0 - 0.57))
	check(is_equal_approx(float(mc.tree_cd), cd_want), "재냉각 27%%·기력 57%%(기력 = 재냉각) 곱 %.3f" % float(mc.tree_cd))
	clear.call()
	spawn.call(Vector3(1.0, 0, 0))
	caster.try_cast("w_whirl")
	check(is_equal_approx(float(caster._cd.w_whirl), 5.0 * Meridian.mul("cd") * cd_want), "cd = 표 × 경락 cd × 나무 (덮지 않고 곱)")
	SS.tree["w_whirl"].pts = [-3, 20, 0, 0, -3, 0, -3, -3]   # 정상 찍기론 못 닿는 값(재냉각 36+기력 57 이 최대 ×0.31)을 손으로
	check(is_equal_approx(float(SkTree.mods(whirl).tree_cd), 0.3), "하한 ×0.3")
	# 흡수·결 겹침·연타 — s_wave(bolt, el chi)
	var wave: Dictionary = Skills.skill_by_key("s_wave")
	SS.tree["s_wave"] = {"xp": 1520, "pts": [1, -1, -3, -1, 0, 0, 0]}
	var mw: Dictionary = SkTree.mods(wave)
	check(str(mw.el) == "chi" and is_equal_approx(float(mw.tree_dmg), 1.04 * 1.03 * 1.05) and is_equal_approx(float(mw.tree_drain), 9.0), "결이 이미 있으면 ×1.05 · 범위 없는 모양은 위력 +범위/2 · 흡수 9")
	clear.call()
	spawn.call(Vector3(1.0, 0, 0))
	check(caster.try_cast("s_wave") and is_equal_approx(float(Run._temp_buffs.drainPct.v), 9.0), "흡수 = 시전 때 drainPct 9 임시")
	SS.tree["s_wave"].pts = [1, 1, 1, 1, 1, 1, 1]
	clear.call()
	var es := [spawn.call(Vector3(1.0, 0, 0)), spawn.call(Vector3(2.0, 0, 0)), spawn.call(Vector3(3.0, 0, 0))]
	caster.try_cast("s_wave")
	check(es.filter(func(e): return e.hp < 5000.0).size() == 2 and int(SkTree.mods(wave).shots) == 2, "연타: bolt 화살 1 → 2")
	SS.tree["w_whirl"].pts = [1, 1, 1, 1, 1, 1, 1]
	check(is_equal_approx(float(SkTree.mods(whirl).tree_dmg), 1.15 * 1.06), "연타 없는 모양(swing)은 ×1.06")

	# ④ 되돌리기
	var xp_before := int(SS.tree.w_whirl.xp)
	Gold.restore(150)
	check(not bool(SkTree.reset("w_whirl").ok) and Gold.gold == 150 and SkTree.spent("w_whirl") == 7, "금 모자람(150) 실패 · 점 그대로")
	Gold.restore(250)
	check(bool(SkTree.reset("w_whirl").ok) and Gold.gold == 50 and SkTree.spent("w_whirl") == 0 and int(SS.tree.w_whirl.xp) == xp_before, "되돌리기 금 200 · 경험 유지")
	check(str(SkTree.reset("w_whirl").reason) == "empty" and Gold.gold == 50, "빈 나무는 되돌리기 안 됨(금 안 냄)")
	check(SkTree.mods(whirl) == whirl, "점이 없으면 원본 그대로")

	# ⑤ 저장 왕복
	SkTree.put("w_whirl", 0, "b")
	var want_tree: Dictionary = SS.tree.duplicate(true)
	var old_override: String = Save.path_override
	Save.path_override = "user://probe_skilltree_save.json"
	Save.save(player)
	SS.restore_tree({})
	check(SS.tree.is_empty(), "restore_tree({}) 비움")
	check(Save.try_load() and want_tree.keys().all(func(k): return str(SS.tree.get(k)) == str(want_tree[k])) and SS.tree.size() == want_tree.size(), "저장 왕복 skill_tree %s" % str(SS.tree))
	SS.restore_tree(null)
	check(SS.tree.is_empty() and SkTree.lv_of("w_whirl") == 1, "옛 세이브(칸 없음) = {} · Lv 1")
	DirAccess.remove_absolute(ProjectSettings.globalize_path("user://probe_skilltree_save.json"))
	DirAccess.remove_absolute(ProjectSettings.globalize_path("user://probe_skilltree_save.json.bak"))
	Save.path_override = old_override

	# 되돌림
	world.queue_free()
	SS.restore(saved[0], saved[1], saved[2])
	SS.restore_tree(saved[3])
	Run.boons = saved[4]
	Run._temp_buffs.clear()
	Gold.restore(saved[5])
	for s in Eq.SLOT_NAMES:
		Eq.equip(s, saved_equip[s])
	await process_frame
	print("PROBE dungeon_skilltree ", "OK" if fails == 0 else "FAIL %d" % fails)
	quit(fails)
