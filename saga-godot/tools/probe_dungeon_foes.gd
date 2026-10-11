extends SceneTree

## G-0208 2나락 잡몹 싸우는 법(world/dungeon_enemy.gd 무기 박자·world/dungeon_shot.gd 화살·탄환·player_health 원소 피해) 자동 점검.
##   godot --headless --path saga-godot --script res://tools/probe_dungeon_foes.gd
## ① 원거리(bow)는 RANGED_STOP 안으로 안 들어오고 사거리 안이면 쿨(×1.4)마다 하나씩 쏜다 — 서 있으면 맞는다
## ② take_damage 원소: 원소 없음·phys 는 값 그대로 · 독은 장비 독 저항만큼 깎임 ③ 화살이 닿으면 피해(저항 반영) · 옆으로 비키면 수명 끝에 사라짐
## ④ club 은 같은 시간 sword 보다 멀리 감(lunge 평균 > 1) · axe 는 옆으로 비틀 ⑤ spear 는 sword 보다 0.57m 멀리서 맞힘(원소 공격 = 저항 반영)
## ⑥ 무기 없는 짐승·sword 는 옛 동작(속도 CHASE_SPEED·닿는 거리 2.0·알아채기 9) · 원거리만 멀리서 알아챔.
## 끝에 "PROBE dungeon_foes OK" 또는 "PROBE dungeon_foes FAIL n".

var fails := 0
var Enemy: GDScript
var Shot: GDScript
var stage: Node3D
var player: Node3D
var ph: Node


func check(cond: bool, msg: String) -> void:
	if cond:
		print("  ok   ", msg)
	else:
		fails += 1
		print("  FAIL ", msg)


func frames(n: int) -> void:
	for i in n:
		await physics_frame


func foe(weapon: String, el: String, pos: Vector3) -> Node:
	var e: Node = Enemy.new(1)
	e.species = {"name": "점검 " + weapon, "kind": "human", "color": "#808080", "form": "", "weapon": weapon, "tier": 1, "resist": {}, "atk_el": el}
	e.elite_key = ""
	e._elite_def = {}
	e._scale_mul = 1.0
	e.attack_damage = 5.0
	e._phase = 0.0
	stage.add_child(e)
	e.global_position = pos
	return e


func full_hp() -> void:
	ph.max_hp = 99999.0
	ph.hp = 99999.0


func flat(v: Vector3) -> Vector3:
	return Vector3(v.x, 0.0, v.z)


func _initialize() -> void:
	await process_frame
	Enemy = load("res://games/saga_dungeon/world/dungeon_enemy.gd")
	Shot = load("res://games/saga_dungeon/world/dungeon_shot.gd")
	stage = Node3D.new()
	root.add_child(stage)
	current_scene = stage
	player = Node3D.new()
	player.name = "Player"
	player.add_to_group("player")
	var vis := Node3D.new()
	vis.name = "Visual"
	player.add_child(vis)
	ph = (load("res://games/saga_dungeon/player/player_health.gd") as GDScript).new()
	ph.name = "PlayerHealth"
	player.add_child(ph)
	stage.add_child(player)
	await process_frame
	var guard: float = root.get_node("DungeonRunState").guard_mult()
	var eq: Node = root.get_node("DungeonEquipmentState")
	var old_armor: Dictionary = eq.item_for("armor").duplicate(true)

	# ① 원거리 — 9m 에서 시작, 5초
	full_hp()
	var bow: Node = foe("bow", "", Vector3(9, 0, 0))
	var min_d := 99.0
	for i in 300:
		await physics_frame
		min_d = minf(min_d, flat(bow.global_position).length())
	var lost: float = 99999.0 - ph.hp
	var want_shots := int(floor(5.0 / (Enemy.ATTACK_COOLDOWN * Enemy.RANGED_CD_MUL))) + 1
	check(bow.is_ranged() and min_d >= Enemy.RANGED_STOP - 0.1 and bow.shots_fired == want_shots,
		"① bow 가장 가까이 %.2fm(≥ %.1f) · 5초에 %d발(기대 %d)" % [min_d, Enemy.RANGED_STOP, bow.shots_fired, want_shots])
	await frames(40)
	lost = 99999.0 - ph.hp
	check(is_equal_approx(lost, 5.0 * guard * bow.shots_fired) and get_nodes_in_group("dungeon_shot").is_empty(),
		"① 서 있으면 다 맞음: 잃은 체력 %.1f = 5×%.2f×%d" % [lost, guard, bow.shots_fired])
	bow.free()

	# ② 원소 피해
	eq.equip("armor", {"base": "a_dujeong", "sock": [{"t": "gem", "key": "jade", "g": 2}]})
	var res: float = eq.elem_resist("pois")
	full_hp()
	ph.take_damage(10.0)
	var d_none: float = 99999.0 - ph.hp
	full_hp()
	ph.take_damage(10.0, null, "phys")
	var d_phys: float = 99999.0 - ph.hp
	full_hp()
	ph.take_damage(10.0, null, "pois")
	var d_pois: float = 99999.0 - ph.hp
	check(res > 0.0 and is_equal_approx(d_none, 10.0 * guard) and is_equal_approx(d_phys, 10.0 * guard) and is_equal_approx(d_pois, 10.0 * guard * (1.0 - res / 100.0)),
		"② 독 저항 %.0f%% — 원소 없음 %.2f · phys %.2f · 독 %.2f(×%.2f)" % [res, d_none, d_phys, d_pois, 1.0 - res / 100.0])

	# ③ 화살 — 닿으면 저항 반영 피해 · 비키면 사라짐
	full_hp()
	var s1: Node = Shot.fire(stage, Vector3(6, 1, 0), Vector3(0, 1, 0), 10.0, "pois", Color.GREEN, "궁수", "화살")
	await frames(60)
	var d_shot: float = 99999.0 - ph.hp
	check(not is_instance_valid(s1) and is_equal_approx(d_shot, 10.0 * guard * (1.0 - res / 100.0)) and String(ph.last_hit.who) == "궁수(화살)",
		"③ 화살 맞음 %.2f(독 저항 반영) · 누구에게 \"%s\"" % [d_shot, String(ph.last_hit.who)])
	full_hp()
	var s2: Node = Shot.fire(stage, Vector3(8, 1, 0), Vector3(0, 1, 0), 10.0, "phys", Color.WHITE, "궁수", "화살")
	player.global_position = Vector3(0, 0, 3)
	await frames(60)
	var alive_mid := is_instance_valid(s2)
	await frames(80)
	check(alive_mid and not is_instance_valid(s2) and is_equal_approx(ph.hp, 99999.0), "③ 옆으로 비키면 안 맞고 수명(%.1f초) 끝에 사라짐" % Shot.LIFE)
	player.global_position = Vector3.ZERO

	# ④ club·axe·sword 같은 1초
	full_hp()
	var club: Node = foe("club", "", Vector3(8, 0, 0))
	var sword: Node = foe("sword", "", Vector3(-8, 0, 0))
	var axe: Node = foe("axe", "", Vector3(0, 0, 8))
	var max_side := 0.0
	for i in 60:
		await physics_frame
		max_side = maxf(max_side, absf(axe.global_position.x))
	var run_club: float = 8.0 - flat(club.global_position).length()
	var run_sword: float = 8.0 - flat(sword.global_position).length()
	check(run_club > run_sword * 1.1 and absf(run_sword - Enemy.CHASE_SPEED) < 0.15,
		"④ 1초에 club %.2fm > sword %.2fm(CHASE_SPEED %.1f)" % [run_club, run_sword, Enemy.CHASE_SPEED])
	check(max_side > 0.15 and absf(sword.global_position.z) < 0.01, "④ axe 옆으로 비틀 %.2fm · sword 곧장" % max_side)
	for n in [club, sword, axe]:
		n.free()

	# ⑤ spear 긴 팔(독 공격 — 갑주 저항 반영) vs sword
	full_hp()
	var spear: Node = foe("spear", "pois", Vector3(2.4, 0, 0))
	await frames(2)
	var d_spear: float = 99999.0 - ph.hp
	var spear_moved: float = absf(flat(spear.global_position).length() - 2.4)
	spear.free()
	full_hp()
	var sword2: Node = foe("sword", "", Vector3(-2.4, 0, 0))
	await frames(2)
	var d_sword: float = 99999.0 - ph.hp
	sword2.free()
	check(is_equal_approx(d_spear, 5.0 * guard * (1.0 - res / 100.0)) and spear_moved < 0.01 and d_sword == 0.0,
		"⑤ 2.4m: spear(닿는 거리 %.2f) 섰자리 독 %.2f · sword(%.1f) 아직 못 맞힘 %.1f" % [Enemy.ATTACK_RANGE + Enemy.REACH_BONUS, d_spear, Enemy.ATTACK_RANGE, d_sword])
	eq.equip("armor", old_armor)

	# ⑥ 옛 동작 · 알아채는 거리
	full_hp()
	var beast: Node = foe("", "", Vector3(6, 0, 0))
	await frames(60)
	var run_beast: float = 6.0 - flat(beast.global_position).length()
	var old_ok: bool = absf(run_beast - Enemy.CHASE_SPEED) < 0.15 and is_equal_approx(beast.melee_reach(), 2.0) and is_equal_approx(beast.detect_radius(), 9.0) and not beast.is_ranged() and beast.shots_fired == 0
	beast.free()
	var bow2: Node = foe("bow", "", Vector3(11, 0, 0))
	var sword3: Node = foe("sword", "", Vector3(-11, 0, 0))
	await frames(30)
	var bow_woke: bool = flat(bow2.global_position).length() < 10.9
	var sword_slept: bool = is_equal_approx(flat(sword3.global_position).length(), 11.0)
	check(old_ok, "⑥ 무기 없는 짐승 1초 %.2fm · 닿는 거리 2.0 · 알아채기 9 · 안 쏨" % run_beast)
	check(bow_woke and sword_slept, "⑥ 11m: bow 알아챔(%.2fm) · sword 못 알아챔" % (Enemy.DETECT_RADIUS * Enemy.RANGED_DETECT_MUL))
	bow2.free()
	sword3.free()
	for s in get_nodes_in_group("dungeon_shot"):
		s.free()

	print("PROBE dungeon_foes OK" if fails == 0 else "PROBE dungeon_foes FAIL %d" % fails)
	quit(1 if fails > 0 else 0)
