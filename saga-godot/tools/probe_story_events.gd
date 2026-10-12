extends SceneTree

## G-0211 4종횡 사냥터 우연 사건 1차 — 미니보스·몬스터 습격·붙잡힌 사람 구조(world/story_enemy_spawner.gd·story_enemy.gd) 자동 점검.
##   godot --headless --path saga-godot --script res://tools/probe_story_events.gd
## ① roll_events 300번: 습격 ≈15% · 미니 ≈9% · 구조 ≈10%(±5%p) · 자리 x 는 [5.2, 폭−5.2] ② event_seed 같으면 같은 사건
##    · 사건 RNG 를 달리해도 첫 셋 종·역할·희귀 그대로(종 RNG 불변)
## ③ 미니 — 자리 밖에선 안 나고 R(1.4m) 안에서 한 번만 · 체력 ×7·공격 ×1.7·마법/희귀 안 붙음·몸 1.25·토스트
##    · 경험 ×8 · is_boss 아님(보스 처치 수 그대로) · 사명 킬 1 · 잡으면 하나 더 ④ 희귀도 몸 1.25(판정 상자는 그대로)
## ⑤ 습격 — R 안에서 셋(x±2.2, 가장자리 1.2m 안쪽으로 자름)·토스트 ⑥ 구조 — R(1.8m) 안에서 지키는 둘(x±1.1)·사람 몸·토스트
##    · 하나만 잡으면 아직 · 다 잡으면 금 (30+lv×10)×(0.8~1.2) 바로 · "🙏" 토스트 · 사람 몸 사라짐.
## 끝에 "PROBE story_events OK" 또는 "PROBE story_events FAIL n".

const SE := preload("res://games/saga_story/data/story_enemies.gd")
const SC := preload("res://games/saga_story/data/story_combat.gd")

var fails := 0
var Enemy: GDScript
var Spawner: GDScript
var stage: Node3D
var player: Node3D
var toast: Label


func check(cond: bool, msg: String) -> void:
	if cond:
		print("  ok   ", msg)
	else:
		fails += 1
		print("  FAIL ", msg)


func frames(n: int) -> void:
	for i in n:
		await physics_frame


func make_spawner(ev_seed: int) -> Node3D:
	var sp := Node3D.new()
	sp.set_script(Spawner)
	sp.map_path = "res://games/saga_story/data/field_map.gd"
	sp.event_seed = ev_seed
	stage.add_child(sp)
	return sp


func foes(sp: Node3D) -> Array:
	return sp.get_children().filter(func(n): return n.is_in_group("story_enemy") and not n._dead)


func sig(e: Node3D) -> String:
	return "%s/%s/%s" % [e.species.name, e.role, e.is_rare]


## 잡몹 하나(spawner 밖) — 몸 크기 비교용
func plain_of(sp: Dictionary, x: float, rare := false) -> Node3D:
	var e := Node3D.new()
	e.set_script(Enemy)
	e.species = sp
	e.is_rare = rare
	e.role = SE.role_of(sp)
	e.enemy_lv = 1.0
	e.stage_key = "field"
	e.stage_width_m = 44.0
	e.position = Vector3(x, 0, 0)
	stage.add_child(e)
	return e


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
	toast = Label.new()
	toast.add_to_group("dialogue_label")
	stage.add_child(toast)
	var ss: Node = root.get_node("StorySaveState")
	var W := 44.0

	# ① 굴림 비율·자리
	var rng := RandomNumberGenerator.new()
	rng.seed = 20260824
	var N := 300
	var na := 0
	var nm := 0
	var nr := 0
	var x_ok := true
	for i in N:
		var ev: Dictionary = Spawner.roll_events(rng, W)
		for k in ["ambush", "miniboss", "rescue"]:
			if not (ev[k] as Dictionary).is_empty():
				var x: float = ev[k].x
				x_ok = x_ok and x >= 5.2 - 0.001 and x <= W - 5.2 + 0.001
		na += 0 if (ev.ambush as Dictionary).is_empty() else 1
		nm += 0 if (ev.miniboss as Dictionary).is_empty() else 1
		nr += 0 if (ev.rescue as Dictionary).is_empty() else 1
	var ra := float(na) / N
	var rm := float(nm) / N
	var rr := float(nr) / N
	check(absf(ra - 0.15) <= 0.05 and absf(rm - 0.09) <= 0.05 and absf(rr - 0.10) <= 0.05 and x_ok,
		"① %d번: 습격 %.1f%% · 미니 %.1f%% · 구조 %.1f%% · 자리 x [5.2, %.1f] 안" % [N, ra * 100, rm * 100, rr * 100, W - 5.2])

	# ② 결정적·종 RNG 불변
	var seed_ev := -1
	for s in 400:
		var r2 := RandomNumberGenerator.new()
		r2.seed = s
		var ev2: Dictionary = Spawner.roll_events(r2, W)
		if not (ev2.ambush as Dictionary).is_empty() and not (ev2.miniboss as Dictionary).is_empty() and not (ev2.rescue as Dictionary).is_empty():
			seed_ev = s
			break
	var a := make_spawner(seed_ev)
	var b := make_spawner(seed_ev)
	var c := make_spawner(7)
	var same_ev: bool = a.ambush == b.ambush and a.miniboss == b.miniboss and a.rescue == b.rescue and not a.ambush.is_empty()
	var sa: Array = foes(a).map(sig)
	var sc: Array = foes(c).map(sig)
	check(same_ev and sa.size() == 3 and sa == sc,
		"② 사건 씨앗 %d 두 번 = 같은 사건(셋 다) · 사건 씨앗을 달리해도 첫 셋 %s 그대로" % [seed_ev, sa])
	for n in [a, b, c]:
		n.free()

	# ③ 미니보스
	var sp := make_spawner(1)
	sp.ambush = {}
	sp.rescue = {}
	sp.miniboss = {"x": 30.0, "triggered": false}
	var n0 := foes(sp).size()
	player.global_position = Vector3(30.0 - 1.5, 0, 0)
	await frames(3)
	var n_out := foes(sp).size()
	toast.text = ""
	player.global_position = Vector3(30.0 - 1.3, 0, 0)
	await frames(1)
	var mini: Node3D = sp.mini_enemy
	var toast_mini := toast.text
	await frames(5)
	var n_in := foes(sp).size()
	check(n_out == n0 and n_in == n0 + 1 and mini != null and mini.is_mini and absf(mini.global_position.x - 30.0) < 0.1,
		"③ 미니 R 밖(1.5m) %d → R 안(1.3m) %d · 한 번만(5틱 뒤에도 +1)" % [n_out - n0, n_in - n0])
	var role_mul: float = 2.2 if mini.role == "tank" else 1.0
	var dmg_role: float = 0.85 if mini.role == "tank" else 1.0
	var ref := plain_of(mini.species, 10.0)
	var ref_rare := plain_of(mini.species, 12.0, true)
	var look: float = mini._creature.scale.x / ref._creature.scale.x
	var look_rare: float = ref_rare._creature.scale.x / ref._creature.scale.x
	var name_m := String(mini.species.name)
	check(is_equal_approx(mini.max_hp, SC.enemy_base_hp(1.0) * role_mul * 7.0) and is_equal_approx(mini.dmg_mul(), dmg_role * 1.7)
		and mini.role != "magic" and not mini.is_rare and not mini.is_boss and is_equal_approx(look, 1.25)
		and toast_mini == "👹 미니보스 %s 등장!" % name_m,
		"③ 미니 %s(%s) 체력 %.0f(×7) · 공격 ×%.2f · 마법·희귀 아님 · 보스 아님 · 몸 ×%.2f · 토스트 \"%s\"" % [name_m, mini.role, mini.max_hp, mini.dmg_mul(), look, toast_mini])
	var cs: CollisionShape3D = ref_rare.get_children().filter(func(n): return n is CollisionShape3D)[0]
	check(is_equal_approx(look_rare, 1.25) and is_equal_approx((cs.shape as CapsuleShape3D).radius, 0.6),
		"④ 희귀 몸 ×%.2f · 판정 상자 그대로(반지름 0.6)" % look_rare)
	var old_lv: int = ss.level
	var old_exp: int = ss.exp
	ss.level = 60
	ss.exp = 0
	var k0 := int(ss.stage_kills.get("field", 0))
	var b0: int = ss.bosses
	var r0: int = sp.respawned
	ref.take_damage(99999.0)
	var e1: int = ss.exp
	mini.take_damage(99999.0)
	var e2: int = ss.exp - e1
	await frames(2)
	var k1 := int(ss.stage_kills.get("field", 0))
	ss.level = old_lv
	ss.exp = old_exp
	check(e2 == e1 * 8 and k1 - k0 == 2 and ss.bosses == b0 and sp.respawned == r0 + 1,
		"③ 경험 %d = %d×8 · 사명 킬 +%d(보통·미니 각 1) · 보스 처치 그대로 · 잡으면 하나 더(+%d)" % [e2, e1, k1 - k0, sp.respawned - r0])
	ref_rare.free()
	sp.free()

	# ⑤ 습격 — 왼쪽 끝 자리(가장자리 자름)
	sp = make_spawner(1)
	sp.miniboss = {}
	sp.rescue = {}
	sp.ambush = {"x": 2.0, "triggered": false}
	var before: Array = foes(sp)
	player.global_position = Vector3(2.0 + 1.5, 0, 0)
	await frames(2)
	var none_out := foes(sp).size() == before.size()
	toast.text = ""
	player.global_position = Vector3(2.0 + 1.3, 0, 0)
	await frames(1)
	var toast_amb := toast.text
	var added: Array = foes(sp).filter(func(e): return not before.has(e))
	var xs: Array = added.map(func(e): return snappedf(e.global_position.x, 0.1))
	await frames(5)
	var once := foes(sp).size() == before.size() + 3
	check(none_out and added.size() == 3 and absf(xs[0] - 1.2) < 0.06 and absf(xs[1] - 2.0) < 0.06 and absf(xs[2] - 4.2) < 0.06 and once
		and toast_amb == "🚨 몬스터 무리가 덮쳤다!",
		"⑤ 습격 R 밖 없음 · R 안 셋 x %s(1.2·2.0·4.2 — 왼쪽 끝 자름) · 한 번만 · 토스트 \"%s\"" % [xs, toast_amb])
	sp.free()

	# ⑥ 구조
	sp = make_spawner(1)
	sp.miniboss = {}
	sp.ambush = {}
	sp.rescue = {"x": 40.0, "spawned": false, "done": false}
	player.global_position = Vector3(40.0 - 1.9, 0, 0)
	await frames(2)
	var none_r: bool = not sp.rescue.spawned
	toast.text = ""
	player.global_position = Vector3(40.0 - 1.7, 0, 0)
	await frames(1)
	var toast_r := toast.text
	var guards: Array = foes(sp).filter(func(e): return e.guard)
	var gx: Array = guards.map(func(e): return snappedf(e.global_position.x, 0.1))
	var captive: Node3D = sp._captive
	check(none_r and guards.size() == 2 and absf(gx[0] - 38.9) < 0.06 and absf(gx[1] - 41.1) < 0.06 and captive != null and is_instance_valid(captive)
		and absf(captive.position.x - 40.0) < 0.01 and toast_r == "😱 도적에게 붙잡힌 사람이 있다!",
		"⑥ 구조 R 밖(1.9m) 없음 · R 안(1.7m) 지키는 둘 x %s · 사람 몸 · 토스트 \"%s\"" % [gx, toast_r])
	var g0: int = ss.gold
	guards[0].take_damage(99999.0)
	await frames(3)
	var not_yet: bool = not sp.rescue.done
	guards[1].take_damage(99999.0)
	var g1: int = ss.gold   # 처치 업적 금이 있으면 여기까지 — 사례금은 다음 틱
	await frames(3)
	var got: int = ss.gold - g1
	var lo := roundi(40.0 * 0.8)
	var hi := roundi(40.0 * 1.2)
	check(not_yet and sp.rescue.done and got == sp.rescue_gold and got >= lo and got <= hi
		and toast.text == "🙏 구해줘서 고맙다며 사례금을 줬다 · 🪙+%d" % got and not is_instance_valid(captive),
		"⑥ 하나 잡으면 아직 · 둘 다 잡으면 금 +%d(%d~%d) · 토스트 \"%s\" · 사람 몸 사라짐" % [got, lo, hi, toast.text])
	ss.gold = g0
	sp.free()

	print("PROBE story_events OK" if fails == 0 else "PROBE story_events FAIL %d" % fails)
	quit(1 if fails > 0 else 0)
