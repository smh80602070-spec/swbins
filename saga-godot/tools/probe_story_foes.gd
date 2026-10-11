extends SceneTree

## G-0209 4종횡 잡몹 명단(data/story_enemies.gd)·순찰·추격·다시 남(world/story_enemy.gd·story_enemy_spawner.gd) 자동 점검.
##   godot --headless --path saga-godot --script res://tools/probe_story_foes.gd
## ① 표 = 웹 saga-story data-enemy.js ENEMIES 수(웹 파일이 있으면 세서 비교) · 단계 넷 풀 · lv1 tier1 만 · lv26 tier4 만
## ② 같은 사냥터를 두 번 세우면 같은 종 순서(결정적) ③ 사냥터 넷 첫 셋이 그 단계 풀 안 · 여러 종이 섞임 · 색·몸이 종대로
## ④ near 밖은 순찰(×0.7)·안은 쫓기(×1.25, 플레이어 쪽) · 사냥터 끝 여백에서 돌아섬 ⑤ bow 는 사거리 안·1.87m 밖이면 멈춰 쏨 · staff 탄환 값
## ⑥ 하나 잡으면 플레이어 4m 밖에 새로 나 셋 유지 · 종 없는 적(보스·부하)은 안 걷는다.
## 끝에 "PROBE story_foes OK" 또는 "PROBE story_foes FAIL n".

const SE := preload("res://games/saga_story/data/story_enemies.gd")
const MAPS := ["field", "forest", "cave", "gorge"]

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


func map_path(key: String) -> String:
	return "res://games/saga_story/data/%s_map.gd" % key


func make_spawner(key: String) -> Node3D:
	var sp := Node3D.new()
	sp.set_script(Spawner)
	sp.map_path = map_path(key)
	stage.add_child(sp)
	return sp


func roamers(sp: Node) -> Array:
	return sp.get_children().filter(func(n): return n.get_script() == Enemy and not n.species.is_empty() and not n._dead)


func foe(weapon: String, x: float, dir: float, width := 40.0) -> Node3D:
	var e := Node3D.new()
	e.set_script(Enemy)
	e.species = {"name": "점검 " + weapon, "kind": "human", "color": "#808080", "form": "", "weapon": weapon, "tier": 1}
	e.walk_dir = dir
	e.enemy_lv = 1.0
	e.stage_key = "field"
	e.stage_width_m = width
	e.position = Vector3(x, 0, 0)
	stage.add_child(e)
	return e


func shots() -> Array:
	return stage.get_children().filter(func(n): return n is Area3D and n.get_script() != null and String(n.get_script().resource_path).ends_with("story_enemy_shot.gd"))


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

	# ①
	var web_n := -1
	var web_path := ProjectSettings.globalize_path("res://").path_join("../saga-web/saga-story/js/data-enemy.js")
	if FileAccess.file_exists(web_path):
		var src := FileAccess.get_file_as_string(web_path)
		var block := src.substr(src.find("var ENEMIES = ["), src.find("var BOSSES") - src.find("var ENEMIES = ["))
		web_n = RegEx.create_from_string("\\{ name: '").search_all(block).size()
	var tiers_ok := true
	for lv in [1.0, 6.0, 14.0, 26.0]:
		tiers_ok = tiers_ok and not SE.pool_for(lv).is_empty()
	check((web_n < 0 or web_n == SE.ENEMIES.size()) and SE.ENEMIES.size() == 32 and tiers_ok
		and SE.pool_for(1.0).all(func(e): return int(e.tier) == 1) and SE.pool_for(26.0).all(func(e): return int(e.tier) == 4),
		"① 표 %d종(웹 %d) · 단계 넷 풀 · lv1 tier1 만 · lv26 tier4 만" % [SE.ENEMIES.size(), web_n])

	# ② 결정적
	var a := make_spawner("field")
	var names_a: Array = roamers(a).map(func(n): return String(n.species.name))
	a.free()
	var b := make_spawner("field")
	var names_b: Array = roamers(b).map(func(n): return String(n.species.name))
	b.free()
	check(names_a.size() == 3 and names_a == names_b, "② field 두 번 세움 = 같은 종 %s" % str(names_a))

	# ③ 사냥터 넷
	var in_pool := true
	var looks_ok := true
	var all_names := {}
	var mixed := false
	for key in MAPS:
		var sp := make_spawner(key)
		var lv: float = float(sp._map.enemy_lv())
		var names := {}
		for e in roamers(sp):
			in_pool = in_pool and int(e.species.tier) == SE.tier_of(lv)
			names[String(e.species.name)] = true
			all_names[String(e.species.name)] = true
			var w := String(e.species.weapon)
			looks_ok = looks_ok and e.enemy_color.is_equal_approx(Color(String(e.species.color))) and e.is_ranged == (w == "bow" or w == "staff") and e.body_kind() == (("beast" if String(e.species.name).contains("코끼리") else "wolf") if String(e.species.form) == "quad" else "goblin")
		mixed = mixed or names.size() >= 2
		print("    %s lv%d: %s" % [key, int(lv), str(names.keys())])
		sp.free()
	check(in_pool and mixed and all_names.size() >= 6, "③ 사냥터 넷 첫 셋이 그 단계 풀 안 · 섞임 · 모두 %d종" % all_names.size())
	check(looks_ok, "③ 색·원거리·몸이 종대로")

	# ④ 순찰·추격·끝에서 돌아섬
	player.global_position = Vector3(40, 0, 0)
	var pat := foe("sword", 20.0, -1.0)
	await frames(60)
	var pat_run: float = 20.0 - pat.global_position.x
	var spd: float = pat.walk_speed()
	pat.free()
	player.global_position = Vector3(23, 0, 0)
	var ch := foe("sword", 20.0, -1.0)
	await frames(60)
	var ch_run: float = ch.global_position.x - 20.0
	ch.free()
	check(absf(pat_run - spd * 0.7) < 0.08 and absf(ch_run - spd * 1.25) < 0.08 and ch_run > 0.0,
		"④ 순찰 %.2fm(×0.7 = %.2f, 제 방향) · 쫓기 %.2fm(×1.25 = %.2f, 플레이어 쪽)" % [pat_run, spd * 0.7, ch_run, spd * 1.25])
	player.global_position = Vector3(500, 0, 0)
	var edge := foe("sword", 0.6, -1.0, 20.0)
	await frames(30)
	var turned_l: bool = edge.walk_dir > 0.0 and edge.global_position.x >= 0.4 - 0.001
	edge.free()
	var edge_r := foe("sword", 19.0, 1.0, 20.0)
	await frames(30)
	var turned_r: bool = edge_r.walk_dir < 0.0 and edge_r.global_position.x <= 19.2 + 0.001
	edge_r.free()
	check(turned_l and turned_r, "④ 사냥터 끝 여백(왼 0.4·오른 0.8m)에서 돌아섬")

	# ⑤ 원거리
	player.global_position = Vector3(25, 0, 0)
	var bow := foe("bow", 20.0, 1.0)
	await frames(30)
	var bow_moved: float = absf(bow.global_position.x - 20.0)
	var bow_shots := shots()
	var bow_ok: bool = bow_moved < 0.001 and bow_shots.size() == 1 and is_equal_approx(float(bow_shots[0].speed), 8.6)
	bow.free()
	for s in shots():
		s.free()
	var staff := foe("staff", 20.0, 1.0)
	await frames(5)
	var st_shots := shots()
	var staff_ok: bool = st_shots.size() == 1 and is_equal_approx(float(st_shots[0].speed), 11.2) and is_equal_approx(staff.shot_range(), 8.4)
	staff.free()
	for s in shots():
		s.free()
	check(bow_ok, "⑤ bow 5m(사거리 7.2 안·1.87 밖): 안 움직임 %.3fm · 한 발(속도 8.6)" % bow_moved)
	check(staff_ok, "⑤ staff 탄환 속도 11.2 · 사거리 8.4")

	# ⑥ 다시 남·종 없는 적
	player.global_position = Vector3(10.4, 0, 0)
	var sp := make_spawner("field")
	await frames(2)
	var first: Array = roamers(sp)
	first[0].take_damage(99999.0)
	await frames(3)
	var now: Array = roamers(sp)
	var fresh: Array = now.filter(func(n): return not first.has(n))
	check(now.size() == 3 and sp.respawned == 1 and fresh.size() == 1 and absf(fresh[0].global_position.x - player.global_position.x) >= 4.0,
		"⑥ 하나 잡으면 다른 자리(플레이어와 %.1fm)에 새로 나 셋 유지" % (absf(fresh[0].global_position.x - player.global_position.x) if fresh.size() == 1 else -1.0))
	sp.free()
	player.global_position = Vector3(23, 0, 0)
	var plain := Node3D.new()
	plain.set_script(Enemy)
	plain.enemy_lv = 1.0
	plain.stage_key = "field"
	plain.position = Vector3(20, 0, 0)
	stage.add_child(plain)
	await frames(30)
	check(is_equal_approx(plain.global_position.x, 20.0) and not plain.roams() and plain.body_kind() == "goblin", "⑥ 종 없는 적(부하·비경)은 그 자리 · 사냥터 몸")
	plain.free()

	print("PROBE story_foes OK" if fails == 0 else "PROBE story_foes FAIL %d" % fails)
	quit(1 if fails > 0 else 0)
