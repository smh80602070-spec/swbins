extends Node
## GO 신수 알·동행(data/eggs.gd · world/egg_incubator.gd) 자동 점검 — 평소엔 안 붙는다.
## test_village.gd 가 SAGA_EGGS_PROBE 가 있을 때만 단다.
##
##   SAGA_EGGS_PROBE=1 "$GODOT" --headless --path saga-godot res://games/saga_go/world/TestVillage.tscn
##
## ① 표(알 종류·후보 신수 id·거리 오름·곳 표) ② 부화기 칸(모험 등급) ③ 주머니 한도·넣기·빼기 오류 ④ 굴림이 결정적이고 곳마다 다름
## ⑤ 걸으면 차서 부화(299m 는 아직, 1m 더 = 부화) · 새 신수는 도감 도장, 다 가지면 냥·경험 ⑥ 안 가진 신수 우선
## ⑦ award(의뢰 = 작은 알 확정 · 보스 = 빛나는 알) · 가득 차면 냥 ⑧ 세이브 JSON 을 거쳐도 그대로
## ⑨ 실제 움직임만 센다(1틱 3m 넘는 순간이동은 안 센다) ⑩ 동행: 모르는 신수 거절 · 몸이 붙어 따라옴 · 400m 마다 냥
## ⑫ 친밀: 500m 마다 +1(최대 10) · 힘=공격력/지혜=경험치/통솔=방어력 배율이 친밀×value/10 %
## ⑪ 화면: 열면 얼림·닫으면 풀림. 도감·가방·경험·알 상태·지점은 끝에 되돌린다. 저장은 안 한다.

const Eggs := preload("res://games/saga_go/data/eggs.gd")
const Pets := preload("res://saga_core/data/pets.gd")

var _p: Node3D
var _n: Node
var _fails := 0
var _saved := {}


func _ready() -> void:
	Weather.force("clear")
	_p = get_tree().get_first_node_in_group("player")
	_run.call_deferred()


func _frames(n: int) -> void:
	for i in n:
		await get_tree().physics_frame


func _check(name: String, ok: bool, detail: String) -> void:
	if not ok:
		_fails += 1
	print("EGGS_PROBE %s %s %s" % ["ok  " if ok else "FAIL", name, detail])


func _run() -> void:
	await _frames(4)
	_n = get_tree().get_first_node_in_group("go_eggs")
	_saved = {"eggs": PartyState.eggs.duplicate(true), "book": CodexState.book.duplicate(), "bag": PartyState.bag.duplicate(),
		"exp": PartyState.exp, "pos": _p.global_position}
	PartyState.eggs = {}
	for k in CodexState.book.keys():
		if String(k).begins_with("pet:"):
			CodexState.book.erase(k)

	# ① 표
	var bad: Array = []
	var last := 0.0
	for t in Eggs.TIERS:
		if float(t.need) <= last:
			bad.append("need " + t.id)
		last = float(t.need)
		for id in t.pool:
			if Pets.find(String(id)) == null:
				bad.append(String(id))
	for src in Eggs.SOURCES:
		for row in Eggs.SOURCES[src]:
			if Eggs.tier(String(row[1])).is_empty():
				bad.append(src)
	_check("tables", bad.is_empty() and _n != null, "bad=%s node=%s" % [bad, _n != null])

	# ② 칸
	_check("slots", Eggs.slots_for_ar(1) == 1 and Eggs.slots_for_ar(3) == 1 and Eggs.slots_for_ar(4) == 2 and Eggs.slots_for_ar(8) == 3 and Eggs.slots_for_ar(30) == 3,
		"%d %d %d %d" % [Eggs.slots_for_ar(1), Eggs.slots_for_ar(4), Eggs.slots_for_ar(8), Eggs.slots_for_ar(30)])

	# ③ 주머니
	var full_ok := true
	for i in Eggs.BAG_MAX:
		full_ok = full_ok and Eggs.add_egg("e_small") == "ok"
	var over := Eggs.add_egg("e_small")
	var no_egg := Eggs.start(99, 30)
	var start_ok := Eggs.start(0, 1)
	var no_slot := Eggs.start(0, 1)
	Eggs.add_egg("e_small") # 주머니 다시 9
	var stop_full_err := Eggs.stop(0)
	PartyState.eggs = {}
	Eggs.add_egg("e_small")
	Eggs.start(0, 1)
	var back := Eggs.stop(0)
	_check("bag", full_ok and over == "full" and no_egg != "" and start_ok == "" and no_slot.contains("칸") and stop_full_err.contains("가득")
		and back == "" and (Eggs.state().bag as Array).size() == 1 and (Eggs.state().inc as Array).is_empty(),
		"over=%s start=%s noslot=%s stopfull=%s back=%s" % [over, start_ok, no_slot, stop_full_err, back])

	# ④ 굴림
	var a1 := Eggs.roll("chest:luxurious", "k1")
	var a2 := Eggs.roll("chest:luxurious", "k1")
	var c1 := Eggs.roll("commission", "x")
	var varied := {}
	for i in 60:
		varied[str(Eggs.roll("chest:common", "c%d" % i).size())] = true
	_check("roll", a1 == a2 and c1 == ["e_small"] and varied.size() == 2 and Eggs.roll("nothing", "x").is_empty(),
		"same=%s commission=%s varied=%s" % [a1 == a2, c1, varied.keys()])

	# ⑤ 걸음 → 부화
	PartyState.eggs = {}
	Eggs.add_egg("e_small")
	Eggs.start(0, 1)
	var r0 := Eggs.walk(299.0)
	var mid := float((Eggs.state().inc as Array)[0].walked)
	var r1 := Eggs.walk(1.0)
	var got: Dictionary = r1[0] if r1.size() == 1 else {}
	var pet1 := String(got.get("pet", ""))
	_check("hatch", r0.is_empty() and absf(mid - 299.0) < 0.01 and r1.size() == 1 and pet1 != "" and not bool(got.dup)
		and CodexState.has("pet", pet1) and (Eggs.state().inc as Array).is_empty() and int(Eggs.state().hatched) == 1,
		"mid=%.1f got=%s" % [mid, got])

	# ⑥ 안 가진 신수 우선 → 다 가지면 냥
	var pool: Array = Eggs.tier("e_small").pool
	var seen := {pet1: true}
	var all_fresh := true
	for i in pool.size() - 1:
		var pk := Eggs.pick_pet("e_small", 10 + i)
		all_fresh = all_fresh and not CodexState.has("pet", pk)
		CodexState.discover("pet", pk)
		seen[pk] = true
	var mora0 := PartyState.count("mora")
	var exp0 := PartyState.exp
	Eggs.add_egg("e_small")
	Eggs.start(0, 1)
	var rd := Eggs.walk(300.0)
	_check("fresh_then_dup", all_fresh and seen.size() == pool.size() and rd.size() == 1 and bool(rd[0].dup)
		and PartyState.count("mora") >= mora0 + Eggs.DUP_MORA and PartyState.exp > exp0,
		"seen=%d/%d dup=%s mora=%d" % [seen.size(), pool.size(), rd, PartyState.count("mora") - mora0])

	# ⑦ award
	PartyState.eggs = {}
	_n.call("award", "commission", "t")
	_n.call("award", "weekly", "t")
	var bag: Array = (Eggs.state().bag as Array).duplicate()
	var full_m0 := PartyState.count("mora")
	for i in Eggs.BAG_MAX:
		Eggs.add_egg("e_mid")
	_n.call("award", "commission", "t2")
	_check("award", bag == ["e_small", "e_rare"] and (Eggs.state().bag as Array).size() == Eggs.BAG_MAX
		and PartyState.count("mora") >= full_m0 + Eggs.DUP_MORA, "bag=%s mora+=%d" % [bag, PartyState.count("mora") - full_m0])

	# ⑧ 세이브 JSON
	PartyState.eggs = {}
	Eggs.add_egg("e_mid")
	Eggs.add_egg("e_rare")
	Eggs.start(0, 1)
	Eggs.walk(123.0)
	Eggs.set_buddy("")
	var js := JSON.stringify(PartyState.eggs)
	var back_d: Variant = JSON.parse_string(js)
	PartyState.eggs = (back_d as Dictionary).duplicate(true)
	var st := Eggs.state()
	_check("save_json", (st.bag as Array) == ["e_rare"] and (st.inc as Array).size() == 1 and absf(float(st.inc[0].walked) - 123.0) < 0.01
		and int(st.hatched) == 0, "st=%s" % [st])

	# ⑨ 실제 움직임만
	PartyState.eggs = {}
	Eggs.add_egg("e_rare")
	Eggs.start(0, 1)
	var pos0 := _p.global_position
	var w0 := float(Eggs.state().walk)
	for i in 10:
		_p.global_position += Vector3(1.0, 0, 0)
		await get_tree().physics_frame
	var walked := float(Eggs.state().walk) - w0
	var w1 := float(Eggs.state().walk)
	_p.global_position += Vector3(60.0, 0, 0)
	await _frames(2)
	var jump := float(Eggs.state().walk) - w1
	_check("real_steps", walked > 8.0 and walked <= 11.0 and jump < 1.0, "walked=%.1f jump=%.1f" % [walked, jump])
	_p.global_position = pos0
	await _frames(2)

	# ⑩ 동행
	var unknown := Eggs.set_buddy("pt_cheongryong")
	CodexState.discover("pet", "pt_gumiho")
	var known := Eggs.set_buddy("pt_gumiho")
	await _frames(6)
	var buddy := _n.get("_buddy") as Node3D
	var near0 := buddy != null and Vector2(buddy.global_position.x - _p.global_position.x, buddy.global_position.z - _p.global_position.z).length() < 4.0
	var m0 := PartyState.count("mora")
	var steps := int(Eggs.BUDDY_M / 2.0) + 2
	for i in steps:
		_p.global_position += Vector3(0, 0, 2.0)
		await get_tree().physics_frame
	var earned := PartyState.count("mora") - m0
	await _frames(30)
	var follow := buddy != null and Vector2(buddy.global_position.x - _p.global_position.x, buddy.global_position.z - _p.global_position.z).length() < 6.0
	_check("buddy", unknown.contains("만나지") and known == "" and buddy != null and near0 and earned >= Eggs.BUDDY_MORA and follow,
		"unknown=%s known=%s body=%s near=%s earned=%d follow=%s" % [unknown, known, buddy != null, near0, earned, follow])
	Eggs.set_buddy("")
	await _frames(2)
	_p.global_position = _saved.pos
	await _frames(2)

	# ⑫ 친밀 → 힘 = 공격력 · 지혜 = 경험치 · 통솔 = 방어력 (500m 마다 친밀 +1, 최대 10)
	PartyState.eggs = {}
	CodexState.discover("pet", "pt_baekho")   # might 13
	CodexState.discover("pet", "pt_gumiho")   # wisdom 9
	CodexState.discover("pet", "pt_bulgasari") # command 9
	var atk0 := PartyState.atk_mul()
	var def0 := PartyState.def_mul()
	Eggs.set_buddy("pt_baekho")
	var lv_a := PartyState.buddy_level()
	Eggs.walk(499.0)
	var lv_b := PartyState.buddy_level()
	Eggs.walk(1.0)
	var lv_c := PartyState.buddy_level()
	Eggs.walk(9000.0)
	var lv_d := PartyState.buddy_level()
	var atk_b := PartyState.atk_mul() / atk0
	PartyState.refresh_power()
	var exp_none := PartyState.buddy_bonus("exp")
	Eggs.set_buddy("pt_gumiho")
	Eggs.walk(9000.0)
	var e0 := PartyState.exp
	PartyState.add_exp(100.0)
	var gained := PartyState.exp - e0
	var base_gain := 100.0 * Weather.exp_bonus_mul() * (1.0 + PartyState._support_bonus())
	Eggs.set_buddy("pt_bulgasari")
	Eggs.walk(9000.0)
	var def_b := PartyState.def_mul() / def0
	Eggs.set_buddy("")
	_check("friend", lv_a == 0 and lv_b == 0 and lv_c == 1 and lv_d == 10 and absf(atk_b - 1.13) < 0.001 and exp_none == 0.0
		and absf(gained / base_gain - 1.09) < 0.001 and absf(def_b - 1.09) < 0.001 and PartyState.atk_mul() / atk0 < 1.0001 and Eggs.bonus_label("pt_baekho").contains("공격력"),
		"lv=%d %d %d %d atk×%.3f exp×%.3f def×%.3f label=%s" % [lv_a, lv_b, lv_c, lv_d, atk_b, gained / base_gain, def_b, Eggs.bonus_label("pt_gumiho")])

	# ⑪ 화면
	var pre := "frozen=%s modal=%d duel=%d" % [_p.get("frozen"), get_tree().get_nodes_in_group("ui_modal").size(), get_tree().get_nodes_in_group("duel_active").size()]
	var opened := bool(_n.call("open_screen"))
	var frozen := bool(_p.get("frozen"))
	await _frames(2)
	var kids := (_n.get("_body") as Node).get_child_count()
	_n.call("close_screen")
	_check("screen", opened and frozen and kids >= 6 and not bool(_p.get("frozen")), "opened=%s frozen=%s kids=%d pre=%s" % [opened, frozen, kids, pre])

	PartyState.eggs = _saved.eggs
	CodexState.book = _saved.book
	PartyState.bag = _saved.bag
	PartyState.exp = _saved.exp
	_p.global_position = _saved.pos
	print("EGGS_PROBE_DONE fails=%d" % _fails)
	get_tree().quit()
