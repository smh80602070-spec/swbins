extends SceneTree

## G-0210 4종횡 잡몹 2차 — 역할(돌진·탱커·마법·원거리)·희귀형·세 시대 적(world/story_enemy.gd·story_enemy_spawner.gd·story_enemy_shot.gd) 자동 점검.
##   godot --headless --path saga-godot --script res://tools/probe_story_roles.gd
## ① 역할 판정(웹 enemyRole — 이름·무기 표) · 시대 적 8(단계마다 둘) ② spawner 300번: 시대 ≈40% · 마법(근접 중) ≈12% · 희귀 ≈7%(±5%p)
##    · 마법은 근접에서만 · 같은 사냥터 두 번 = 같은 결과 ③ tank 체력×2.2·걷기×0.6·붙어 치기×0.85
## ④ dash 첫 쿨 3~5 · 쿨 전엔 보통 걸음 · 돌진 1.1초 ×2.6 + "!" · 다음 쿨 5~8 ⑤ magic 체력×0.85 · 높이 달라도 쏘고 멈춰 섬
##    · 구슬이 높이 차를 줄임(활 화살은 y 그대로) · 속도 5.2·수명 2.6·피해×1.15 · 다음 쿨 2.2×(0.8~1.2)
## ⑥ 희귀 체력×3.2·공격×1.35·토스트·✨·경험 ×4 ⑦ 종 없는 적(부하·비경)·보스는 배수 1.
## 끝에 "PROBE story_roles OK" 또는 "PROBE story_roles FAIL n".

const SE := preload("res://games/saga_story/data/story_enemies.gd")

var fails := 0
var Enemy: GDScript
var Spawner: GDScript
var stage: Node3D
var player: Node3D


func check(cond: bool, msg: String) -> void:
	if cond:
		print("  ok   ", msg)
	else:
		fails += 1
		print("  FAIL ", msg)


func frames(n: int) -> void:
	for i in n:
		await physics_frame


func row(name: String) -> Dictionary:
	for e: Dictionary in SE.ENEMIES + SE.ERA_ENEMIES:
		if String(e.name) == name:
			return e
	return {}


func foe(sp: Dictionary, x: float, role := "", rare := false) -> Node3D:
	var e := Node3D.new()
	e.set_script(Enemy)
	e.species = sp
	e.role = role
	e.is_rare = rare
	e.role_seed = 4242
	e.walk_dir = 1.0
	e.enemy_lv = 1.0
	e.stage_key = "field"
	e.stage_width_m = 60.0
	e.position = Vector3(x, 0, 0)
	stage.add_child(e)
	return e


func shots() -> Array:
	return stage.get_children().filter(func(n): return n is Area3D and n.get_script() != null and String(n.get_script().resource_path).ends_with("story_enemy_shot.gd"))


func clear_shots() -> void:
	for s in shots():
		s.free()


func make_spawner(key: String) -> Node3D:
	var sp := Node3D.new()
	sp.set_script(Spawner)
	sp.map_path = "res://games/saga_story/data/%s_map.gd" % key
	stage.add_child(sp)
	return sp


func _initialize() -> void:
	await process_frame
	Enemy = load("res://games/saga_story/world/story_enemy.gd")
	Spawner = load("res://games/saga_story/world/story_enemy_spawner.gd")
	stage = Node3D.new()
	root.add_child(stage)
	current_scene = stage
	var ps := GDScript.new()
	ps.source_code = "extends Node3D\nvar max_hp := 100.0\nvar taken := 0.0\nfunc take_damage(a: float) -> void:\n\ttaken += a\n"
	ps.reload()
	player = Node3D.new()
	player.set_script(ps)
	player.add_to_group("player")
	stage.add_child(player)
	player.global_position = Vector3(500, 0, 0)
	var toast := Label.new()
	toast.add_to_group("dialogue_label")
	stage.add_child(toast)

	# ① 역할 표
	var want := {"노략 궁수": "ranged", "왜군 조총병": "ranged", "정찰 드론": "ranged", "거란 기병": "dash", "흑기병": "dash",
		"남만 코끼리병": "tank", "중장 방패병": "tank", "강철 거신": "tank", "황건적": "melee", "들개": "melee", "별바다 손님": "melee"}
	var role_ok := true
	for n: String in want:
		var got := SE.role_of(row(n))
		if got != want[n]:
			role_ok = false
			print("    %s → %s(기대 %s)" % [n, got, want[n]])
	var era_ok := SE.ERA_ENEMIES.size() == 8
	for lv in [1.0, 6.0, 14.0, 26.0]:
		var p := SE.era_pool_for(lv)
		era_ok = era_ok and p.size() == 2 and p.all(func(e): return int(e.tier) == SE.tier_of(lv))
	check(role_ok, "① 역할 판정 %d종 = 웹 enemyRole(기병 dash·코끼리/미늘창 tank·활/조총 ranged)" % want.size())
	check(era_ok, "① 시대 적 8 · 단계마다 둘")

	# ② 굴림 비율·결정적
	var sp := make_spawner("field")
	for c in sp.get_children():
		c.free()
	var n_era := 0
	var n_melee := 0
	var n_magic := 0
	var n_rare := 0
	var magic_only_melee := true
	var seq_a: Array = []
	var N := 300
	for i in N:
		var e: Node3D = sp.spawn_at(20.0)
		var era: bool = e.species.has("era")
		n_era += 1 if era else 0
		var base_role := SE.role_of(e.species)
		if base_role == "melee":
			n_melee += 1
			n_magic += 1 if e.role == "magic" else 0
		elif e.role == "magic":
			magic_only_melee = false
		n_rare += 1 if e.is_rare else 0
		if i < 20:
			seq_a.append("%s/%s/%s" % [e.species.name, e.role, e.is_rare])
		e.free()
	sp.free()
	var sp2 := make_spawner("field")
	for c in sp2.get_children():
		c.free()
	var seq_b: Array = []
	for i in 20:
		var e: Node3D = sp2.spawn_at(20.0)
		seq_b.append("%s/%s/%s" % [e.species.name, e.role, e.is_rare])
		e.free()
	sp2.free()
	var r_era := float(n_era) / N
	var r_magic := float(n_magic) / maxf(1.0, n_melee)
	var r_rare := float(n_rare) / N
	check(absf(r_era - 0.4) <= 0.05 and absf(r_magic - 0.12) <= 0.05 and absf(r_rare - 0.07) <= 0.05 and magic_only_melee,
		"② %d번: 시대 %.1f%% · 마법 %.1f%%(근접 %d 중) · 희귀 %.1f%% · 마법은 근접에서만" % [N, r_era * 100, r_magic * 100, n_melee, r_rare * 100])
	check(seq_a == seq_b, "② 같은 사냥터 두 번 = 같은 종·역할·희귀 순서(20)")
	toast.text = ""

	# ③ tank
	var plain := foe(row("황건적"), 20.0)
	var tank := foe(row("중장 방패병"), 30.0)
	var hp_r: float = tank.max_hp / plain.max_hp
	var spd_r: float = tank.walk_speed() / plain.walk_speed()
	player.taken = 0.0
	player.global_position = plain.global_position
	await frames(2)
	var d_plain: float
	d_plain = player.taken
	player.taken = 0.0
	player.global_position = tank.global_position
	await frames(2)
	var d_tank: float = player.taken
	check(is_equal_approx(hp_r, 2.2) and is_equal_approx(spd_r, 0.6) and is_equal_approx(d_tank, d_plain * 0.85),
		"③ tank 체력 ×%.2f · 걷기 ×%.2f · 붙어 치기 %.2f(보통 %.2f ×0.85)" % [hp_r, spd_r, d_tank, d_plain])
	tank.free()
	player.global_position = Vector3(500, 0, 0)
	var base_dmg := d_plain

	# ④ dash
	player.global_position = Vector3(25, 0, 0)
	var dash := foe(row("거란 기병"), 20.0)
	var cd0: float = dash._dash_cd
	dash._dash_cd = 0.5
	var x0: float = dash.global_position.x
	await frames(15)
	var pre: float = dash.global_position.x - x0
	var started := -1
	var x_start := 0.0
	var dash_frames := 0
	var bang := false
	var cd_next := 0.0
	var mid := 0.0
	for i in 160:
		await physics_frame
		if dash.dashing():
			if started < 0:
				started = i
				x_start = dash.global_position.x
				cd_next = dash._dash_cd
				bang = dash.get_children().any(func(c): return c is Label3D and c.text == "!")
			dash_frames += 1
			if dash_frames == 31:
				mid = dash.global_position.x - x_start
	var walk: float = dash.walk_speed() * 1.25
	check(cd0 >= 3.0 and cd0 <= 5.0 and absf(pre - walk * 0.25) < 0.03,
		"④ dash 첫 쿨 %.2f(3~5) · 쿨 전 0.25초 %.2fm(보통 ×1.25 = %.2f)" % [cd0, pre, walk * 0.25])
	check(started >= 0 and absf(dash_frames - 66) <= 2 and absf(mid - walk * 2.6 * 0.5) < 0.06 and bang and cd_next >= 5.0 and cd_next <= 8.0,
		"④ 돌진 %d틱(1.1초) · 0.5초 %.2fm(×2.6 = %.2f) · \"!\" %s · 다음 쿨 %.2f(5~8)" % [dash_frames, mid, walk * 2.6 * 0.5, bang, cd_next])
	dash.free()

	# ⑤ magic — 플레이어가 2.5m 높이(near·같은 높이 밖)
	player.global_position = Vector3(25, 2.5, 0)
	var magic := foe(row("황건적"), 20.0, "magic")
	var bow := foe(row("노략 궁수"), 30.0)
	await frames(2)
	var orbs := shots().filter(func(s): return s.homing)
	var arrows := shots().filter(func(s): return not s.homing)
	var orb_ok: bool = orbs.size() == 1 and is_equal_approx(orbs[0].speed, 5.2) and is_equal_approx(orbs[0].damage, base_dmg * 1.15)
	var life0: float = orbs[0].life_left if orbs.size() == 1 else 0.0
	var cd_m: float = magic._shot_cd_left
	var oy0: float = orbs[0].global_position.y if orbs.size() == 1 else 0.0
	var ay0: float = arrows[0].global_position.y if arrows.size() == 1 else -9.0
	await frames(30)
	var oy1: float = orbs[0].global_position.y if is_instance_valid(orbs[0]) else oy0
	var ay1: float = arrows[0].global_position.y if arrows.size() == 1 and is_instance_valid(arrows[0]) else -9.0
	check(orb_ok and life0 > 2.5 and life0 <= 2.6 and cd_m >= 2.2 * 0.8 - 0.05 and cd_m <= 2.2 * 1.2 and is_equal_approx(magic.max_hp / plain.max_hp, 0.85)
		and absf(magic.global_position.x - 20.0) < 0.001,
		"⑤ magic 높이 달라도 한 발(속도 5.2·수명 %.2f·피해 ×1.15) · 다음 쿨 %.2f · 체력 ×0.85 · 멈춰 섬" % [life0, cd_m])
	check(oy1 - oy0 > 1.2 and arrows.size() == 1 and is_equal_approx(ay0, ay1),
		"⑤ 구슬 0.5초에 %.2fm 올라감(높이 차 줄임) · 활 화살 y %.2f 그대로" % [oy1 - oy0, ay1])
	magic.free()
	bow.free()
	clear_shots()

	# ⑥ 희귀
	player.global_position = Vector3(500, 0, 0)
	toast.text = ""
	var rare := foe(row("황건적"), 20.0, "", true)
	var sparkle: bool = rare.get_children().any(func(c): return c is Label3D and c.text == "✨")
	var toast_txt := toast.text   # 처치 뒤엔 업적 토스트가 덮어쓴다 — 나온 자리에서 읽음
	var ss: Node = root.get_node("StorySaveState")
	var old_lv: int = ss.level
	var old_exp: int = ss.exp
	ss.level = 60
	ss.exp = 0
	plain.take_damage(99999.0)
	var e1: int = ss.exp
	rare.take_damage(99999.0)
	var e2: int = ss.exp - e1
	ss.level = old_lv
	ss.exp = old_exp
	check(is_equal_approx(rare.max_hp / plain.max_hp, 3.2) and is_equal_approx(rare.dmg_mul(), 1.35) and toast_txt == "✨ 희귀 황건적 등장!" and sparkle and e2 == e1 * 4,
		"⑥ 희귀 체력 ×%.2f · 공격 ×%.2f · 토스트 \"%s\" · ✨ %s · 경험 %d = %d×4" % [rare.max_hp / plain.max_hp, rare.dmg_mul(), toast_txt, sparkle, e2, e1])
	for n in stage.get_children():
		if n != player and n != toast and n is Node3D:
			n.free()

	# ⑦ 종 없는 적·보스
	var bare := Node3D.new()
	bare.set_script(Enemy)
	bare.enemy_lv = 1.0
	bare.stage_key = "field"
	stage.add_child(bare)
	var boss := Node3D.new()
	boss.set_script(Enemy)
	boss.is_boss = true
	boss.enemy_lv = 1.0
	boss.stage_key = "field"
	stage.add_child(boss)
	check(bare.role == "" and not bare.is_rare and is_equal_approx(bare.hp_mul(), 1.0) and is_equal_approx(bare.dmg_mul(), 1.0)
		and boss.role == "" and is_equal_approx(boss.max_hp, 18.0 * boss.boss_hp_mul),
		"⑦ 종 없는 적·보스는 역할 없음·배수 1(보스 체력 %.0f)" % boss.max_hp)
	bare.free()
	boss.free()

	print("PROBE story_roles OK" if fails == 0 else "PROBE story_roles FAIL %d" % fails)
	quit(1 if fails > 0 else 0)
