extends SceneTree

## G-0217 2나락 경락도(data/dungeon_meridian.gd · DungeonSaveState.passive · 효과 자리 · ui/skill_button.gd) 자동 점검.
##   godot --headless --path saga-godot --script res://tools/probe_dungeon_meridian.gd
## ① 점수 = 1 + 그 직업 무예 점수 누계(남은 점 + 올린 단) + 보스 처치, 상한 60 · 직업마다 따로 ② 첫 점은 무명·지금 직업 문만
## ③ 빈 경락도 = 기존 수치(공격·체력·치명·공속·이동·사거리·받는 피해·저항·재사용) ④ 찍으면 공격·체력·치명·공속·이동이 합만큼, 저항 +, 무기를 바꾸면 그 직업 그물
## ⑤ 규칙 열 — 금강 단약 0 · 일격 치명 0·×1.3 · 독행 분신 막음·동료 합 0 · 역린 체력 문턱 · 천리안 거리별 · 혈공 체력 냄·재사용 ×0.6 · 무심 · 유수 · 귀신걸음 · 오행귀일
## ⑥ 되돌리기 — 은총 자리 밖 거절·금 모자람 거절·은총 방에서 금 100 내고(무예 창 선택지로 연 화면) · F2 ⑦ 세이브 왕복(path_override)·옛 세이브 = 빈 칸.
## 끝에 "PROBE dungeon_meridian OK" 또는 "PROBE dungeon_meridian FAIL n".

var fails := 0


func check(cond: bool, msg: String) -> void:
	if cond:
		print("  ok   ", msg)
	else:
		fails += 1
		print("  FAIL ", msg)


class FakeHealth extends Node:
	signal hp_changed(h: float, m: float)
	var max_hp := 200.0
	var hp := 200.0

	func heal_by(a: float) -> void:
		hp = minf(max_hp, hp + a)


func _initialize() -> void:
	await process_frame
	seed(20260824)
	var S: Node = root.get_node("DungeonSaveState")
	var Run: Node = root.get_node("DungeonRunState")
	var Eq: Node = root.get_node("DungeonEquipmentState")
	var SS: Node = root.get_node("DungeonSkillState")
	var Gold: Node = root.get_node("DungeonGoldState")
	var Party: Node = root.get_node("DungeonPartyState")
	var Pot: Node = root.get_node("DungeonPotionState")
	var M: GDScript = load("res://games/saga_dungeon/data/dungeon_meridian.gd")
	var Melee: GDScript = load("res://games/saga_dungeon/player/melee_attack.gd")
	var Caster: GDScript = load("res://games/saga_dungeon/player/skill_caster.gd")
	var Enemy: GDScript = load("res://games/saga_dungeon/world/dungeon_enemy.gd")
	var saved_equip := {}
	for s in Eq.SLOT_NAMES:
		saved_equip[s] = (Eq.item_for(s) as Dictionary).duplicate(true)
		Eq.equip(s, {})
	var saved := {"boons": Run.boons.duplicate(), "points": SS.points.duplicate(), "ranks": SS.ranks.duplicate(), "slots": SS.slots.duplicate(true),
		"gold": Gold.gold, "passive": S.passive.duplicate(true), "scenario": S.scenario.duplicate(true), "path": S.path_override,
		"members": Party.members.duplicate(true), "belt": Pot.belt.duplicate(true)}
	Run.boons = {}
	Run._temp_buffs.clear()
	SS.points = {}
	SS.ranks = {}
	S.passive = {}
	S._passive_apis = {}
	S.scenario = {"boss_kills": 0}

	# ① 점수 — 직업마다 따로
	var p0: int = M.points_total("warrior")
	SS.points = {"warrior": 4, "archer": 9}
	SS.ranks = {"w_whirl": 2, "w_rage": 1}
	S.scenario = {"boss_kills": 3}
	var pw: int = M.points_total("warrior")
	var pa: int = M.points_total("archer")
	SS.points = {"warrior": 200}
	var pc: int = M.points_total("warrior")
	var api_w: RefCounted = S.passive_api("warrior")
	var api_a: RefCounted = S.passive_api("archer")
	check(p0 == 1 and pw == 1 + 4 + 3 + 3 and pa == 1 + 9 + 3 and pc == 60 and api_w != api_a and api_w == S.passive_api(),
		"① 점수 빈 %d · 무장(남은 4+단 3+보스 3) %d · 궁장 %d · 상한 %d · 직업마다 다른 그물·맨손 = 무장" % [p0, pw, pa, pc])

	# ② 첫 점 — 지금 직업 문·무명만
	var g_arch: String = M.gate(self, "o_archer")
	check(g_arch != "" and M.gate(self, "o_warrior") == "" and M.gate(self, "o_none") == "", "② 무장은 무명·무장의 문만 · 궁장의 문 막음(\"%s\")" % g_arch)

	# ③ 빈 경락도 = 기존 수치
	var base := {"atk": Run.atk_mult(), "hp": Run.hp_mult(), "crit": Run.crit_chance(), "spd": Run.atk_speed_mult(), "move": Run.move_speed_mult(),
		"reach": Run.reach_mult(), "guard": Run.guard_mult(), "res": Eq.elem_resist("fire")}
	var empty_ok: bool = base.atk == 1.0 and base.hp == 1.0 and base.crit == 0.0 and base.guard == 1.0 and base.res == 0.0 \
		and M.mul("cd") == 1.0 and M.mul("skill") == 1.0 and M.mul("dash") == 1.0 and M.add("boltShotAdd") == 0.0 and M.hit_mul(self, null, null) == 1.0
	check(empty_ok, "③ 빈 경락도 — 배수 전부 1·더함 0 (공격 %.2f 체력 %.2f 받는 피해 %.2f 재사용 %.2f)" % [base.atk, base.hp, base.guard, M.mul("cd")])

	# ④ 찍기 — 무장 문에서 공격·체력·치명·공속·이동·저항 마디까지 가장 가까운 길
	SS.points = {"warrior": 59 - 3 - 3}
	var fired := [0]
	Run.boons_changed.connect(func() -> void: fired[0] += 1)
	api_w.take("o_warrior")
	for want in ["atkPct", "hpPct", "critPct", "atkSpdPct", "moveSpdPct", "allResPct"]:
		var best := ""
		var best_cost := 999
		for nd: Dictionary in api_w.def.nodes:
			if String(nd.k) != "k" and (nd.get("stats", {}) as Dictionary).has(want) and not api_w.is_taken(String(nd.id)):
				var pp: Dictionary = api_w.path_to(String(nd.id))
				if not pp.is_empty() and int(pp.cost) < best_cost:
					best_cost = int(pp.cost)
					best = String(nd.id)
		api_w.take_path(best)
	var near := func(a: float, b: float) -> bool: return absf(a - b) < 1e-5
	var sums := {}
	for k in ["atkPct", "hpPct", "critPct", "atkSpdPct", "moveSpdPct", "allResPct"]:
		sums[k] = float(api_w.sum(k))
	var up_ok: bool = near.call(Run.atk_mult(), 1.0 + sums.atkPct / 100.0) and near.call(Run.hp_mult(), 1.0 + sums.hpPct / 100.0) \
		and near.call(Run.crit_chance(), sums.critPct) and near.call(Run.atk_speed_mult(), 1.0 + sums.atkSpdPct / 100.0) \
		and near.call(Run.move_speed_mult(), 1.0 + sums.moveSpdPct / 100.0) and near.call(Eq.elem_resist("fire"), sums.allResPct) \
		and sums.atkPct > 0.0 and sums.hpPct > 0.0 and sums.critPct > 0.0 and sums.atkSpdPct > 0.0 and sums.moveSpdPct > 0.0 and sums.allResPct > 0.0
	var used_w: int = api_w.used()
	Eq.equip("weapon", {"base": "w_gakgung", "tier": 0, "ilvl": 1})
	var arch_ok: bool = M.class_key() == "archer" and near.call(Run.atk_mult(), 1.0) and near.call(Run.hp_mult(), 1.0)
	Eq.equip("weapon", {})
	check(up_ok and fired[0] > 0 and arch_ok and near.call(Run.atk_mult(), 1.0 + sums.atkPct / 100.0),
		"④ %d마디 — 공격 ×%.2f 체력 ×%.2f 치명 +%.1f 공속 ×%.2f 이동 ×%.2f 저항 +%.1f (= 합) · 찍으면 boons_changed · 궁장 무기 쥐면 빈 그물" % [used_w, Run.atk_mult(), Run.hp_mult(), Run.crit_chance(), Run.atk_speed_mult(), Run.move_speed_mult(), Eq.elem_resist("fire")])

	# ⑤ 규칙 — 각각 무명에서 그 규칙까지 길만 찍는다
	SS.points = {"warrior": 59}
	SS.ranks = {"w_rage": 1}
	S.scenario = {"boss_kills": 0}
	var rule := func(r: String) -> bool:
		api_w.reset(true)
		api_w.take("o_none")
		return api_w.take_path("k_" + r) and M.has_rule(r)
	var stage := Node.new()   # 무예 그림(CombatFx)이 current_scene 에 붙는다
	root.add_child(stage)
	current_scene = stage
	var player := Node3D.new()
	player.add_to_group("player")
	root.add_child(player)
	var melee: Node = Melee.new()
	player.add_child(melee)
	var caster: Node = Caster.new()
	player.add_child(caster)
	var health := FakeHealth.new()
	health.add_to_group("player_health")
	root.add_child(health)
	await process_frame
	var foe: Node = Enemy.new(12)
	root.add_child(foe)
	(foe as Node3D).global_position = Vector3(0, 0, 10)
	foe.resist = {}
	foe._elite_def = {}
	var hit := func() -> float:
		foe.hp = 50000.0
		foe.max_hp = 50000.0
		melee._strike(foe)
		return 50000.0 - float(foe.hp)

	# 금강
	Pot.belt.assign([{"g": 0, "n": 2}, {}, {}, {}])
	health.hp = 50.0
	var d_ok: bool = rule.call("diamond")
	var pot: Dictionary = Pot.use(0)
	check(d_ok and not bool(pot.ok) and String(pot.reason) == "diamond" and health.hp == 50.0 and int(Pot.belt[0].n) == 2, "⑤ 금강 — 단약이 체력을 안 채운다(한 알 아낌) · 체력 +%d%%" % int(api_w.sum("hpPct")))
	# 일격 — 치명 100% 버프여도 치명 없이 ×1.3
	health.hp = health.max_hp
	Run.add_temp_buff("critPct", 100.0, 60.0)
	var o_ok: bool = rule.call("onecut")
	var want_o: float = Melee.ATK_DAMAGE * Run.atk_mult() * 1.3 * (1.0 + api_w.sum("piercePct") / 200.0)
	var got_o: float = hit.call()
	api_w.reset(true)
	var got_crit: float = hit.call()
	Run._temp_buffs.clear()
	check(o_ok and near.call(got_o, want_o) and near.call(got_crit, Melee.ATK_DAMAGE * Melee.CRIT_MULT), "⑤ 일격 — 치명 확정 버프에도 %.2f(= 9×공격×1.3) · 경락 없으면 치명 %.2f" % [got_o, got_crit])
	# 독행 — 분신 막음·동료 합 0·피해 ×1.25
	Party.members.assign(["probe_a", "probe_b"])
	var with_party: float = Party.world_eff_sum("atkPct")
	var l_ok: bool = rule.call("lone")
	var atk_l: float = Run.atk_mult()
	var summon_ok: bool = caster._cast_summon({"key": "y_skel", "sec": 5.0, "v": 2.0, "grow": 0.0}, 1)
	Party.members.assign(saved.members)
	check(l_ok and not summon_ok and near.call(atk_l, 1.0 + api_w.sum("atkPct") / 100.0) and near.call(M.hit_mul(self, foe, player), 1.25 * (1.0 + api_w.sum("piercePct") / 200.0)),
		"⑤ 독행 — 분신 못 부름 · 동료 공격 %+.0f%% 안 더함 · 피해 ×%.2f" % [with_party, M.hit_mul(self, foe, player)])
	# 역린 — 체력 35% 밑만
	var s_ok: bool = rule.call("scale")
	var dm: float = M.mul("dmg")
	health.hp = 60.0
	var low: float = M.hit_mul(self, foe, player)
	health.hp = 80.0
	var high: float = M.hit_mul(self, foe, player)
	health.hp = health.max_hp
	check(s_ok and near.call(low, dm * 1.5) and near.call(high, dm), "⑤ 역린 — 체력 30%% ×%.2f · 40%% ×%.2f" % [low, high])
	# 천리안 — 붙어서 −30%
	var f_ok: bool = rule.call("farsight")
	var dm_f: float = M.mul("dmg")
	var far_m: float = M.hit_mul(self, foe, player)
	(foe as Node3D).global_position = Vector3(0, 0, 2)
	var near_m: float = M.hit_mul(self, foe, player)
	(foe as Node3D).global_position = Vector3(0, 0, 10)
	check(f_ok and near.call(far_m, dm_f) and near.call(near_m, dm_f * 0.7) and near.call(Run.reach_mult(), 1.0 + api_w.sum("reachPct") / 100.0) and api_w.sum("reachPct") >= 40.0,
		"⑤ 천리안 — 10m ×%.2f · 2m ×%.2f · 사거리 ×%.2f" % [far_m, near_m, Run.reach_mult()])
	# 혈공 — 무예마다 최대 체력 5%·재사용 ×0.6
	var b_ok: bool = rule.call("bloodcast")
	var regen: float = api_w.sum("mpRegen")
	var want_cd: float = 18.0 * maxf(0.5, 7.0 / (7.0 + regen)) * 0.6
	health.hp = health.max_hp
	var cast_b: bool = caster.try_cast("w_rage")
	var hp_b: float = health.hp
	var cd_b: float = caster.cooldown_left("w_rage")
	caster._cd.clear()
	health.hp = 5.0
	var cast_low: bool = caster.try_cast("w_rage")
	health.hp = health.max_hp
	Run._temp_buffs.clear()
	check(b_ok and cast_b and near.call(hp_b, 190.0) and near.call(cd_b, want_cd) and not cast_low, "⑤ 혈공 — 체력 200→%.0f · 재사용 %.2f초(18×기력×0.6) · 체력 5 면 못 씀" % [hp_b, cd_b])
	# 무심 — 재사용 ×0.5·무예 피해 ×0.7
	var m_ok: bool = rule.call("mindless")
	var regen_m: float = api_w.sum("mpRegen")
	check(m_ok and near.call(M.mul("cd"), maxf(0.5, 7.0 / (7.0 + regen_m)) * 0.5) and near.call(M.mul("skill"), 0.7), "⑤ 무심 — 재사용 ×%.2f · 무예 피해 ×%.2f" % [M.mul("cd"), M.mul("skill")])
	# 유수 — 막기 없음·돌진 ×1.5
	Run.add_temp_buff("guardPct", 20.0, 60.0)
	var guard_plain: float = Run.guard_mult()
	var w_ok: bool = rule.call("flow")
	var guard_flow: float = Run.guard_mult()
	check(w_ok and guard_plain < 1.0 and guard_flow == 1.0 and M.mul("dash") == 1.5, "⑤ 유수 — 받는 피해 %.2f → %.2f(막기 없음) · 돌진 ×%.1f" % [guard_plain, guard_flow, M.mul("dash")])
	# 귀신걸음 — 받는 피해 +10%·이동 +20%
	var gh_ok: bool = rule.call("ghost")
	var guard_g: float = Run.guard_mult()
	var want_g: float = (1.0 - (20.0 + api_w.sum("guardPct")) / 100.0) * 1.1
	Run._temp_buffs.clear()
	check(gh_ok and near.call(guard_g, want_g) and api_w.sum("moveSpdPct") >= 20.0 and near.call(Run.move_speed_mult(), 1.0 + api_w.sum("moveSpdPct") / 100.0), "⑤ 귀신걸음 — 받는 피해 ×%.3f · 이동 ×%.2f" % [guard_g, Run.move_speed_mult()])
	# 오행귀일
	var e_ok: bool = rule.call("fiveone")
	var merged: Dictionary = M.elem({"fire": 3.0, "cold": 5.0})
	api_w.reset(true)
	var kept: Dictionary = M.elem({"fire": 3.0, "cold": 5.0})
	check(e_ok and merged == {"cold": 8.0} and kept.size() == 2, "⑤ 오행귀일 — 불 3·얼음 5 → %s · 없으면 그대로" % str(merged))

	# ⑥ 되돌리기 — 은총 방에서만·금 100 · 무예 창 선택지로 연 화면
	api_w.take("o_warrior")
	var leaf: String = api_w.neighbors("o_warrior").filter(func(x): return String(api_w.node(x).k) != "o")[0]
	api_w.take(leaf)
	var g_out: String = M.gate(self, leaf)
	var grace: Node3D = load("res://games/saga_dungeon/world/grace_sites.gd").new()
	grace.setup([0.0, 20.0], ["fight", "well"])
	root.add_child(grace)
	player.global_position = Vector3(0, 0, 1)
	Gold.gold = 50
	var g_poor: String = M.gate(self, leaf)
	Gold.gold = 500
	var btn := Button.new()
	btn.set_script(load("res://games/saga_dungeon/ui/skill_button.gd"))
	stage.add_child(btn)
	btn._on_pressed()
	var prompt: CanvasLayer = null
	for n in get_nodes_in_group("ui_modal"):
		if n is CanvasLayer and (n as CanvasLayer).visible:
			prompt = n
	var mer_btn: Button = null
	if prompt != null:
		for b in prompt.find_children("*", "Button", true, false):
			if (b as Button).text.begins_with("☯ 경락도"):
				mer_btn = b
	var mer_label: String = mer_btn.text if mer_btn != null else ""
	if mer_btn != null:
		mer_btn.pressed.emit()
	await process_frame
	var scr: CanvasLayer = null
	for n in get_nodes_in_group("ui_modal"):
		if n is CanvasLayer and is_instance_valid(n) and not n.is_queued_for_deletion() and n.has_method("select"):
			scr = n
	var dropped := false
	var had_scr := scr != null   # 닫은 뒤엔 풀려 null 로 보인다
	var label := ""
	if scr != null:
		scr.select(leaf)
		label = scr._card_btn.text
		scr._on_card_btn()
		dropped = not api_w.is_taken(leaf)
		scr.close_screen()
	var gold_after: int = Gold.gold
	await process_frame
	check(g_out == "되돌리기는 은총 자리 방에서만" and g_poor != "" and had_scr and label == "되돌리기" and dropped and gold_after == 400 and not btn.meridian_open and InputMap.has_action("dungeon_meridian"),
		"⑥ 은총 밖 \"%s\" · 금 모자람 거절 · 선택지 「%s」로 연 화면에서 \"%s\" → 금 500→%d · 키 dungeon_meridian(F2)" % [g_out, mer_label, label, gold_after])
	stage.free()
	grace.free()

	# ⑦ 세이브 왕복·옛 세이브
	S.path_override = "user://probe_meridian_save.json"
	api_w.reset(true)
	api_w.take("o_warrior")
	api_w.take(leaf)
	S.save(player)
	S.passive = {}
	S._passive_apis = {}
	var load_ok: bool = S.try_load()
	var round_ok: bool = (S.passive.get("warrior", {}) as Dictionary).get("start") == "warrior" and S.passive_api("warrior").is_taken(leaf)
	var f := FileAccess.open(S.path_override, FileAccess.WRITE)
	f.store_string(JSON.stringify({"version": 2, "rooms_cleared": [], "player_pos": [0, 0, 0]}))
	f.close()
	var old_ok: bool = S.try_load()
	var old_empty: bool = S.passive.is_empty() and S.passive_api("warrior").store.start == null
	DirAccess.remove_absolute(ProjectSettings.globalize_path(S.path_override))
	check(load_ok and round_ok and old_ok and old_empty, "⑦ 세이브 왕복(무장 시작·%d마디) · passive 없는 옛 세이브 → 빈 경락도" % (S.passive.get("warrior", {"taken": []}).taken as Array).size())

	for s in Eq.SLOT_NAMES:
		Eq.equip(s, saved_equip[s])
	Run.boons = saved.boons
	SS.points = saved.points
	SS.ranks = saved.ranks
	SS.slots = saved.slots
	Gold.gold = saved.gold
	S.passive = saved.passive
	S._passive_apis = {}
	S.scenario = saved.scenario
	S.path_override = saved.path
	Pot.belt.assign(saved.belt)
	foe.free()
	health.free()
	player.free()
	print("PROBE dungeon_meridian OK" if fails == 0 else "PROBE dungeon_meridian FAIL %d" % fails)
	quit(1 if fails > 0 else 0)
