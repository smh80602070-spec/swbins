extends SceneTree

## G-0211 4종횡 사냥터 우연 사건 1차 — 미니보스·몬스터 습격·붙잡힌 사람 구조(world/story_enemy_spawner.gd·story_enemy.gd) 자동 점검.
##   godot --headless --path saga-godot --script res://tools/probe_story_events.gd
## ① roll_events 300번: 습격 ≈15% · 미니 ≈9% · 구조 ≈10%(±5%p) · 자리 x 는 [5.2, 폭−5.2] ② event_seed 같으면 같은 사건
##    · 사건 RNG 를 달리해도 첫 셋 종·역할·희귀 그대로(종 RNG 불변)
## ③ 미니 — 자리 밖에선 안 나고 R(1.4m) 안에서 한 번만 · 체력 ×7·공격 ×1.7·마법/희귀 안 붙음·몸 1.25·토스트
##    · 경험 ×8 · is_boss 아님(보스 처치 수 그대로) · 사명 킬 1 · 잡으면 하나 더 ④ 희귀도 몸 1.25(판정 상자는 그대로)
## ⑤ 습격 — R 안에서 셋(x±2.2, 가장자리 1.2m 안쪽으로 자름)·토스트 ⑥ 구조 — R(1.8m) 안에서 지키는 둘(x±1.1)·사람 몸·토스트
##    · 하나만 잡으면 아직 · 다 잡으면 금 (30+lv×10)×(0.8~1.2) 바로 · "🙏" 토스트 · 사람 몸 사라짐.
## G-0212 ①에 상자 ≈22%·채집 ≈18%·상인 ≈12% ⑦ 상자 — R(0.92m) 안에서 한 번 · 금 (40+lv×12)×(0.8~1.4) · 장비 줍기 하나(풀 안) · 상자 숨음
##    ⑧ 채집 구간 — 처음 들어설 때 🍀 한 번 · 안 +2·밖 +1 ⑨ 이동 상인 — R(1.4m) 안에서 90초 ×0.7 · 상점 표시·지불 · 지나면 ×1 · save() 에 안 들어감.
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


## quiet — 굴린 사건 여섯을 다 지우고(상자·상인 몸·채집 판도) 절마다 필요한 것만 넣는다(G-0212)
func make_spawner(ev_seed: int, quiet := false) -> Node3D:
	var sp := Node3D.new()
	sp.set_script(Spawner)
	sp.map_path = "res://games/saga_story/data/field_map.gd"
	sp.event_seed = ev_seed
	stage.add_child(sp)
	if quiet:
		for k in ["chest", "forage", "ambush", "miniboss", "merchant", "rescue"]:
			sp.set(k, {})
		sp._build_props()
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
	## G-0212 — 상자 22%(x [4, 폭−4]) · 채집 18%(가운데 [3.4, 폭−3.4], 폭 5.2) · 상인 12%(x [5.2, 폭−5.2])
	var nc := 0
	var nf := 0
	var nmer := 0
	var x2_ok := true
	for i in N:
		var ev: Dictionary = Spawner.roll_events(rng, W)
		if not (ev.chest as Dictionary).is_empty():
			nc += 1
			x2_ok = x2_ok and float(ev.chest.x) >= 4.0 - 0.001 and float(ev.chest.x) <= W - 4.0 + 0.001
		if not (ev.forage as Dictionary).is_empty():
			nf += 1
			var cx: float = (float(ev.forage.x1) + float(ev.forage.x2)) * 0.5
			x2_ok = x2_ok and cx >= 3.4 - 0.001 and cx <= W - 3.4 + 0.001 and is_equal_approx(float(ev.forage.x2) - float(ev.forage.x1), 5.2)
		if not (ev.merchant as Dictionary).is_empty():
			nmer += 1
			x2_ok = x2_ok and float(ev.merchant.x) >= 5.2 - 0.001 and float(ev.merchant.x) <= W - 5.2 + 0.001
	check(absf(float(nc) / N - 0.22) <= 0.05 and absf(float(nf) / N - 0.18) <= 0.05 and absf(float(nmer) / N - 0.12) <= 0.05 and x2_ok,
		"① %d번: 상자 %.1f%% · 채집 %.1f%% · 상인 %.1f%% · 자리 범위 안" % [N, nc * 100.0 / N, nf * 100.0 / N, nmer * 100.0 / N])

	# ② 결정적·종 RNG 불변
	var seed_ev := -1
	for s in 20000:   # 셋 다 = 0.15×0.09×0.10 ≈ 0.14% — 굴림 순서(G-0212)가 바뀌어도 찾게 넉넉히
		var r2 := RandomNumberGenerator.new()
		r2.seed = s
		var ev2: Dictionary = Spawner.roll_events(r2, W)
		if not (ev2.ambush as Dictionary).is_empty() and not (ev2.miniboss as Dictionary).is_empty() and not (ev2.rescue as Dictionary).is_empty():
			seed_ev = s
			break
	var a := make_spawner(seed_ev)
	var b := make_spawner(seed_ev)
	var c := make_spawner(7)
	var same_ev: bool = a.ambush == b.ambush and a.miniboss == b.miniboss and a.rescue == b.rescue and a.chest == b.chest and a.forage == b.forage and a.merchant == b.merchant and not a.ambush.is_empty()
	var sa: Array = foes(a).map(sig)
	var sc: Array = foes(c).map(sig)
	check(same_ev and sa.size() == 3 and sa == sc,
		"② 사건 씨앗 %d 두 번 = 같은 사건(셋 다) · 사건 씨앗을 달리해도 첫 셋 %s 그대로" % [seed_ev, sa])
	for n in [a, b, c]:
		n.free()

	# ③ 미니보스
	var sp := make_spawner(1, true)
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
	sp = make_spawner(1, true)
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
	sp = make_spawner(1, true)
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
		and toast.text == "🙏 구해줘서 고맙다며 사례금을 줬다 · 💰+%d" % got and not is_instance_valid(captive),
		"⑥ 하나 잡으면 아직 · 둘 다 잡으면 금 +%d(%d~%d) · 토스트 \"%s\" · 사람 몸 사라짐" % [got, lo, hi, toast.text])
	ss.gold = g0
	sp.free()

	# ⑦ 보물상자 (G-0212)
	sp = make_spawner(1, true)
	sp.chest = {"x": 20.0, "opened": false}
	sp._build_props()
	var chest_box: Node3D = sp._chest_node
	player.global_position = Vector3(20.0 - 1.0, 0, 0)
	await frames(2)
	var shut: bool = not sp.chest.opened and chest_box.visible
	toast.text = ""
	var gc0: int = ss.gold
	player.global_position = Vector3(20.0 - 0.8, 0, 0)
	await frames(1)
	var cg: int = ss.gold - gc0
	var pickups: Array = sp.get_children().filter(func(n): return n is Area3D and n.name.begins_with("GearPickup"))
	var key: String = sp.chest_gear
	var toast_c := toast.text
	await frames(3)
	var once_c: bool = ss.gold - gc0 == cg and sp.get_children().filter(func(n): return n is Area3D and n.name.begins_with("GearPickup")).size() == 1
	var item_name := String(SC.item_def(key).get("name", ""))
	check(shut and sp.chest.opened and cg == sp.chest_gold and cg >= roundi(52 * 0.8) and cg <= roundi(52 * 1.4)
		and pickups.size() == 1 and SC.gear_pool_for(1.0).has(key) and absf(pickups[0].position.x - 20.0) < 0.01
		and not chest_box.visible and once_c and toast_c == "💰 보물상자! 💰+%d · 📦 %s" % [cg, item_name],
		"⑦ 상자 R 밖(1.0m) 닫힘 · R 안(0.8m) 금 +%d(42~73) · 장비 %s 줍기 하나(풀 안) · 상자 숨음 · 한 번만 · 토스트 \"%s\"" % [cg, key, toast_c])
	ss.gold = gc0
	## R-5 리뷰 — 지금 낀 바로 그 키는 상자 후보에서 빠진다(같은 걸 다시 끼면 주문서 강화가 지워짐)
	var eq_save: Dictionary = ss.equipped.duplicate()
	var kq: String = SC.gear_pool_for(1.0)[0]
	ss.equipped[String(SC.GEAR_ITEMS[kq].slot)] = kq
	var cp: Array = Spawner.chest_pool(1.0)
	ss.equipped = eq_save
	check(not cp.has(kq) and cp.size() == SC.gear_pool_for(1.0).size() - 1,
		"⑦ 낀 %s 는 상자 후보에서 빠짐(%d → %d)" % [kq, SC.gear_pool_for(1.0).size(), cp.size()])
	sp.free()

	# ⑧ 채집 보너스 지역 (G-0212)
	sp = make_spawner(1, true)
	sp.forage = {"x1": 10.0, "x2": 15.2, "notified": false}
	sp._build_props()
	var patch := sp.get_node_or_null("ForagePatch") as MeshInstance3D
	player.global_position = Vector3(9.5, 0, 0)
	await frames(2)
	var quiet_f: bool = not sp.forage.notified
	toast.text = ""
	player.global_position = Vector3(10.2, 0, 0)
	await frames(1)
	var toast_f := toast.text
	toast.text = ""
	player.global_position = Vector3(16.0, 0, 0)
	await frames(1)
	player.global_position = Vector3(11.0, 0, 0)
	await frames(1)
	var again_f := toast.text
	var Gather: GDScript = load("res://games/saga_story/world/story_gather.gd")
	var gin := Node3D.new()
	gin.set_script(Gather)
	gin.kind = "herb"
	gin.position = Vector3(12.0, 0, 0)
	stage.add_child(gin)
	var gout := Node3D.new()
	gout.set_script(Gather)
	gout.kind = "herb"
	gout.position = Vector3(18.0, 0, 0)
	stage.add_child(gout)
	var h0 := int(ss.mats.get("herb", 0))
	var lx0 := int(ss.life.get("gather", 0))
	ss.life["gather"] = 0   # G-0238 — 랭크 F(두 개 없음)에서 🍀 ×2 만 잰다
	gin._gather()
	var d_in := int(ss.mats.get("herb", 0)) - h0
	var toast_in := toast.text
	gout._gather()
	var d_out := int(ss.mats.get("herb", 0)) - h0 - d_in
	var toast_out := toast.text
	ss.mats["herb"] = h0
	ss.life["gather"] = lx0
	check(patch != null and is_equal_approx((patch.mesh as PlaneMesh).size.x, 5.2) and quiet_f and toast_f == "🍀 채집이 넘치는 곳이다!" and again_f == "",
		"⑧ 채집 판 폭 5.2 · 구간 밖 조용 · 처음 들어설 때 토스트 \"%s\" · 다시 들어와도 한 번만" % toast_f)
	check(d_in == 2 and d_out == 1 and toast_in.contains("+2 🍀 · 🌿 채집 F") and toast_out.contains("+1 · 🌿 채집 F") and sp.forage_mul_at(12.0) == 2 and sp.forage_mul_at(18.0) == 1,
		"⑧ 구간 안 채집 +%d(\"%s\") · 밖 +%d(\"%s\")" % [d_in, toast_in, d_out, toast_out])
	gin.free()
	gout.free()
	sp.free()

	# ⑨ 이동 상인 (G-0212)
	sp = make_spawner(1, true)
	sp.merchant = {"x": 30.0, "triggered": false}
	sp._build_props()
	var mbody: Node3D = sp._merchant_body
	ss.merchant_until_ms = 0
	player.global_position = Vector3(30.0 - 1.5, 0, 0)
	await frames(2)
	var quiet_m: bool = not sp.merchant.triggered and is_equal_approx(ss.price_mul(), 1.0)
	toast.text = ""
	player.global_position = Vector3(30.0 - 1.3, 0, 0)
	await frames(1)
	var left_ms: int = ss.merchant_until_ms - Time.get_ticks_msec()
	var toast_m := toast.text
	var Merchant: GDScript = load("res://games/saga_story/world/story_merchant.gd")
	var shop := Node3D.new()
	shop.set_script(Merchant)
	stage.add_child(shop)
	var offers: Array = shop._gear_offers()
	var gk: String = offers[0]
	var base := int(SC.GEAR_ITEMS[gk].price)
	var old_eq: Dictionary = ss.equipped.duplicate()
	var gm0: int = ss.gold
	ss.gold = 999999
	shop._on_gear_picked(gk, {})
	var paid: int = 999999 - ss.gold
	ss.gold = gm0
	ss.equipped = old_eq
	var shown: int = shop._price(base)
	ss.merchant_until_ms = Time.get_ticks_msec() - 1
	var after: float = ss.price_mul()
	var save_src: String = (ss.get_script() as GDScript).source_code
	var sb := save_src.find("func save() -> bool:")
	var save_body := save_src.substr(sb, save_src.find("\nfunc ", sb + 10) - sb)
	check(quiet_m and mbody != null and sp.merchant.triggered and left_ms > 89000 and left_ms <= 90000
		and toast_m == "🛒 지나가던 상인 — 90초 동안 상점이 30% 싸집니다! · K: 물목",
		"⑨ 상인 몸 · R 밖(1.5m) 그대로 · R 안(1.3m) 할인 %.1f초 · 토스트 \"%s\"" % [left_ms / 1000.0, toast_m])
	check(shown == roundi(base * 0.7) and paid == shown and is_equal_approx(after, 1.0) and not save_body.contains("merchant"),
		"⑨ 상점 %s 값 %d → 표시 %d·지불 %d(×0.7) · 시각 지나면 ×%.1f · save() 에 상인 키 없음" % [gk, base, shown, paid, after])
	## R-5 리뷰 — 이동 상인은 그 자리 상점 · 고른 값은 연 순간 값 · 불러오면 할인 끊김
	var gp0: int = ss.gold
	ss.gold = 999999
	shop._on_gear_picked(gk, {}, 50)
	var paid_locked: int = 999999 - ss.gold
	ss.gold = gp0
	ss.equipped = old_eq
	var load_body := save_src.substr(save_src.find("func try_load() -> bool:"), 600)
	check(mbody.get_script() == Merchant and mbody.has_method("_open_shop") and paid_locked == 50 and load_body.contains("merchant_until_ms = 0"),
		"⑨ 이동 상인 = 그 자리 상점(K) · 보인 값 50 그대로 냄(%d) · try_load 가 할인을 끊음" % paid_locked)
	ss.merchant_until_ms = 0
	shop.free()
	sp.free()

	print("PROBE story_events OK" if fails == 0 else "PROBE story_events FAIL %d" % fails)
	quit(1 if fails > 0 else 0)
