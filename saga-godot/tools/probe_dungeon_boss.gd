extends SceneTree

## G-0204 2나락 보스 패턴(games/saga_dungeon/world/boss_pattern.gd) 자동 점검 — 진짜 DungeonEnemy 보스를 무대(current_scene)에 세우고
## _physics_process 를 직접 돌린다(평타는 _attack_cd_left 로 막음).
##   godot --headless --path saga-godot --script res://tools/probe_dungeon_boss.gd
## ① 층별 무기(tier 목록에서 층 번호로 — 1~30층에 네 패턴이 다 나옴) · 잡몹은 패턴 없음
## ② 강타: 예고(0.7초) 전엔 피해 0, 지나면 반경 안만 ×1.8 · 사망 카드 이름에 "(강타)"
## ③ 관통: 예고 시작에 방향 고정 — 옆으로 비키면 안 맞고, 그대로면 ×1.5 ④ 돌진: 3.65m 까지 다가서 붙으면 ×1.6 ⑤ 연격: 세 번 ×0.7
## ⑥ 예고 그림이 생기고 1.2초 안에 스스로 지워짐(실제 시간 프레임 루프). 끝에 "PROBE dungeon_boss OK" 또는 "PROBE dungeon_boss FAIL n".

const BossPattern := preload("res://games/saga_dungeon/world/boss_pattern.gd")

var fails := 0


func check(cond: bool, msg: String) -> void:
	if cond:
		print("  ok   ", msg)
	else:
		fails += 1
		print("  FAIL ", msg)


class FakeHealth extends Node:
	var hits: Array = [] # [amount, who]

	func take_damage(a: float, src: Node = null) -> void:
		hits.append([a, String(src.call("who_label")) if src != null and src.has_method("who_label") else ""])


var _stage: Node3D
var _player: CharacterBody3D
var _health: FakeHealth


func _boss(weapon: String, player_at: Vector3) -> Node:
	var Enemy: GDScript = load("res://games/saga_dungeon/world/dungeon_enemy.gd")
	var e: Node = Enemy.new(3, true)
	e.boss_pattern = BossPattern.new(3, weapon)
	e.boss_pattern.cd = 0.01
	_stage.add_child(e)
	e.set_physics_process(false)
	(e as Node3D).global_position = Vector3.ZERO
	_player.global_position = player_at
	_health.hits.clear()
	return e


func _run(e: Node, secs: float) -> void:
	for i in int(ceil(secs / 0.05)):
		e._attack_cd_left = 999.0
		e._physics_process(0.05)


func _initialize() -> void:
	await process_frame
	OS.set_environment("SAGA_BOSS_INTRO", "0")   # G-0339 등장 띠가 첫 강타를 2초 미룬다 — 여긴 패턴 시각 점검(띠는 probe_boss_banner)
	_stage = Node3D.new()
	root.add_child(_stage)
	current_scene = _stage
	_player = CharacterBody3D.new()
	_player.add_to_group("player")
	_health = FakeHealth.new()
	_health.name = "PlayerHealth"
	_player.add_child(_health)
	_stage.add_child(_player)

	# ①
	var seen := {}
	for fl in range(1, 31):
		seen[BossPattern.weapon_for(fl)] = true
	var Enemy: GDScript = load("res://games/saga_dungeon/world/dungeon_enemy.gd")
	var mob: Node = Enemy.new(3, false)
	_stage.add_child(mob)
	var boss_auto: Node = Enemy.new(6, true)
	_stage.add_child(boss_auto)
	check(seen.has("club") and seen.has("axe") and seen.has("sword") and (seen.has("spear") or seen.has("halberd"))
		and BossPattern.weapon_for(1) == "axe" and BossPattern.weapon_for(6) == "sword" and mob.boss_pattern == null and boss_auto.boss_pattern != null and boss_auto.boss_pattern.weapon == "sword",
		"① 층별 무기 %s · 1층 %s · 6층 %s · 잡몹 패턴 없음" % [str(seen.keys()), BossPattern.weapon_for(1), BossPattern.weapon_for(6)])
	mob.free()
	boss_auto.free()

	# ② 강타
	var e := _boss("club", Vector3(3.0, 0, 0))
	var dmg: float = e.attack_damage
	_run(e, 0.05)
	var tells := _stage.get_children().filter(func(c): return c is MeshInstance3D).size()
	_run(e, 0.55)
	var before_n := _health.hits.size()
	_run(e, 0.2)
	check(before_n == 0 and _health.hits.size() == 1 and is_equal_approx(float(_health.hits[0][0]), dmg * BossPattern.SLAM_MUL) and String(_health.hits[0][1]) == "굴혈의 우두머리(강타)",
		"② 강타: 예고 전 0 → 뒤 %s · 이름 %s" % [str(_health.hits.map(func(h): return h[0])), str(_health.hits.map(func(h): return h[1]))])
	check(e.who_label() == "굴혈의 우두머리", "② 패턴 밖에선 이름 그대로")
	e.free()
	e = _boss("club", Vector3(5.0, 0, 0))
	_run(e, 1.0)
	check(_health.hits.is_empty(), "② 강타 반경(%.2fm) 밖은 안 맞음" % BossPattern.SLAM_RANGE)
	e.free()

	# ③ 관통
	e = _boss("spear", Vector3(4.0, 0, 0))
	_run(e, 0.05)
	_player.global_position = Vector3(0, 0, 4.0) # 예고 뒤 옆으로 비킴
	_run(e, 0.6)
	var dodged := _health.hits.is_empty()
	e.free()
	e = _boss("spear", Vector3(4.0, 0, 0))
	_run(e, 0.65)
	check(dodged and _health.hits.size() == 1 and is_equal_approx(float(_health.hits[0][0]), float(e.attack_damage) * BossPattern.THRUST_MUL), "③ 관통: 비키면 0 · 그대로면 ×1.5")
	e.free()

	# ④ 돌진
	e = _boss("axe", Vector3(5.0, 0, 0))
	_run(e, 0.65) # 예고 0.55 가 끝나는 틱(+뜬소수 한 틱) — 그 뒤로는 평소처럼 쫓는다(틱당 0.12m)
	var moved: float = (e as Node3D).global_position.x
	var want := minf(BossPattern.CHARGE_STEP, 5.0 - BossPattern.BOSS_R - BossPattern.P_R)
	check(moved >= want - 0.05 and moved <= want + 0.13 and _health.hits.size() == 1, "④ 돌진: %.2fm 다가서 맞힘 %d" % [moved, _health.hits.size()])
	e.free()

	# ⑤ 연격
	e = _boss("sword", Vector3(1.5, 0, 0))
	_run(e, 1.6)
	check(_health.hits.size() == 3 and _health.hits.all(func(h): return is_equal_approx(float(h[0]), float(e.attack_damage) * BossPattern.FLURRY_MUL)), "⑤ 연격 세 번 ×0.7 — %d" % _health.hits.size())
	e.free()

	# ⑥ 예고 그림
	var t0 := Time.get_ticks_msec()
	while Time.get_ticks_msec() - t0 < 1200:
		await process_frame
	var left := _stage.get_children().filter(func(c): return c is MeshInstance3D or c is CPUParticles3D).size()
	check(tells > 0 and left == 0, "⑥ 예고 그림 %d 생김 → 1.2초 뒤 남은 그림 %d" % [tells, left])
	Engine.time_scale = 1.0
	print("PROBE dungeon_boss OK" if fails == 0 else "PROBE dungeon_boss FAIL %d" % fails)
	quit(1 if fails > 0 else 0)
