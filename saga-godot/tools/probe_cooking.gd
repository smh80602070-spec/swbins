extends Node
## GO 채집·요리(106장 ⑱) 자동 점검 — 평소엔 안 붙는다. test_village.gd 가 SAGA_COOK_PROBE 가 있을 때만 단다.
##
##   SAGA_COOK_PROBE=1 "$GODOT" --headless --path saga-godot res://games/saga_go/world/TestVillage.tscn
##
## ① 채집 55개·세 지역·특산물 지역마다 6·냄비 3 ② 다가가면 줍기(가방·gather_t) ③ 일반 30분·특산물 1시간 뒤 다시 남
## ④ 냄비에서 멀면 조리 못 함·곁이면 됨 ⑤ 불 끄기 바늘 자리 → 맛있는/보통/이상한·재료 차감·숙련 ⑥ 숙련 5 → 자동 조리(보통)
## ⑦ 한 인물 회복·포만감 ⑧ 배부름 막기 ⑨ 쓰러진 인물 되살리기 ⑩ 공격 계열 버프·갈아 끼움·끝남
## ⑪ 모험 요리 → 스태미나 소모 배율 ⑫ 돌파에 특산물(주인공 청하란 3·동료 셋 갈래) ⑬ restore_cooking.
## 저장은 안 한다. 시계는 Cooking.time_offset 으로 돌리고 끝에 되돌린다.

const Cooking := preload("res://games/saga_go/data/cooking.gd")
const Gathering := preload("res://games/saga_go/world/gathering.gd")
const Growth := preload("res://games/saga_go/data/growth.gd")
const TestMap := preload("res://games/saga_go/data/test_map.gd")
const TerrainBuilder := preload("res://games/saga_go/world/terrain_builder.gd")
const Characters := preload("res://saga_core/data/characters.gd")

var _p: CharacterBody3D
var _ga: Node
var _ki: Node
var _sc: Node
var _fc: Node
var _frame := 0
var _step := 0
var _fails := 0
var _v: Variant = null
var _mint_id := ""
var _orchid_id := ""

func _ready() -> void:
	Weather.force("clear")
	_p = get_tree().get_first_node_in_group("player")

func _physics_process(_delta: float) -> void:
	_frame += 1
	if _ga == null:
		_ga = get_tree().get_first_node_in_group("go_gathering")
		_ki = get_tree().get_first_node_in_group("go_kitchen")
		_sc = get_tree().get_first_node_in_group("go_cooking_screen")
		_fc = get_tree().get_first_node_in_group("go_field_combat")
		return
	match _step:
		0: # ① 배치
			var regions := {}
			var special := {}
			for row in Gathering.all_nodes():
				regions[row[2]] = int(regions.get(row[2], 0)) + 1
				if Cooking.is_special(row[1]):
					special[row[2]] = int(special.get(row[2], 0)) + 1
			var total := Gathering.all_nodes().size()
			var ok: bool = total == 113 and regions.size() == 9 and special.get("village") == 6 and special.get("coast") == 6 \
				and special.get("ruins") == 6 and special.get("frost") == 6 and int(_ga.call("grown_count")) + PartyState.gather_t.size() == 113 \
				and (_ki.call("pots") as Array).size() == 9 # 106장 ㊺ 고원 채집 일곱·신상 냄비 하나 더 · ㊻-3 고원 눈꽃 여섯 · ㊽ 은하 나루 채집 넷·냄비 하나 · ㊾ 틈새 갈림길 채집 넷·냄비 하나 · ㊿ 잠긴 도읍 채집 넷·냄비 하나
			_check("layout", ok, "total=%d regions=%s special=%s pots=%d" % [total, regions, special, (_ki.call("pots") as Array).size()])
			_next()
		1: # ② 줍기 — 마을 서쪽 박하
			if _frame == 1:
				_mint_id = "v_mint_w_0"
				_v = [PartyState.count("mint"), int(_ga.call("grown_count", "mint"))]
				_stand(_ga.call("node_pos", _mint_id))
			if _frame == 6:
				var ok: bool = PartyState.count("mint") == int(_v[0]) + 1 and PartyState.gather_t.has(_mint_id) \
					and int(_ga.call("grown_count", "mint")) == int(_v[1]) - 1 and _ga.call("node_pos", _mint_id) == Vector3.INF
				_check("pick", ok, "mint %d→%d grown %d→%d" % [_v[0], PartyState.count("mint"), _v[1], _ga.call("grown_count", "mint")])
				_next()
		2: # ③ 다시 자라기 — 특산물 하나 줍고 시계를 30분·1시간 돌린다
			if _frame == 1:
				_orchid_id = "v_orchid_fall_0"
				_stand(_ga.call("node_pos", _orchid_id))
			if _frame == 6:
				_park()
				Cooking.time_offset += Cooking.RESPAWN_SEC.common + 1.0
				_ga.call("refresh")
				var mint_back: bool = _ga.call("node_pos", _mint_id) != Vector3.INF
				var orchid_still: bool = _ga.call("node_pos", _orchid_id) == Vector3.INF
				Cooking.time_offset += Cooking.RESPAWN_SEC.special
				_ga.call("refresh")
				var orchid_back: bool = _ga.call("node_pos", _orchid_id) != Vector3.INF
				_check("respawn", mint_back and orchid_still and orchid_back and PartyState.count("orchid") >= 1,
					"mint_back=%s orchid_still=%s orchid_back=%s orchid=%d" % [mint_back, orchid_still, orchid_back, PartyState.count("orchid")])
				_next()
		3: # ④ 냄비 곁에서만
			if _frame == 1:
				PartyState.add_items({"honey_flower": 6, "apple": 3})
				_sc.call("open_screen")
				_sc.call("select", "honey_cake")
				_v = String(_sc.call("cook_block"))
				_sc.call("close_screen")
				var pot: Vector3 = (_ki.call("pots") as Array)[0]
				_stand(pot + Vector3(1.2, 0.0, 0.0))
			if _frame == 4:
				_sc.call("open_screen")
				var near := String(_sc.call("cook_block"))
				_check("pot_only", String(_v) != "" and near == "" and bool(_ki.call("near_pot")), "far='%s' near='%s'" % [_v, near])
				_next()
		4: # ⑤ 불 끄기 → 품질
			var z: float = Cooking.RECIPES.honey_cake.zone
			var qs: Array = []
			for needle in [z, z + 0.15, 0.0]:
				_sc.call("start_cook")
				_sc.set("cook_t", float(needle) * Cooking.NEEDLE_SEC * 0.5)
				qs.append(_sc.call("stop_cook"))
			var ok: bool = qs == [2, 1, 0] and PartyState.count(Cooking.dish_id("honey_cake", 2)) == 1 \
				and PartyState.count(Cooking.dish_id("honey_cake", 1)) == 1 and PartyState.count(Cooking.dish_id("honey_cake", 0)) == 1 \
				and PartyState.count("honey_flower") == 0 and PartyState.count("apple") == 0 and int(PartyState.cook_prof.honey_cake) == 3 \
				and not bool(_sc.call("start_cook"))
			_check("quality", ok, "q=%s honey=%d prof=%s" % [qs, PartyState.count("honey_flower"), PartyState.cook_prof.get("honey_cake")])
			_next()
		5: # ⑥ 자동 조리
			PartyState.add_items({"mushroom": 4, "mint": 2})
			var early: int = _ki.call("auto_cook", "mush_skewer", 2)
			PartyState.cook_prof["mush_skewer"] = Cooking.PROF_MAX
			var made: int = _ki.call("auto_cook", "mush_skewer", 3)
			_check("auto_cook", early == 0 and made == 2 and PartyState.count(Cooking.dish_id("mush_skewer", 1)) == 2 and PartyState.count("mushroom") == 0,
				"early=%d made=%d" % [early, made])
			## 되살리기·버프 재료도 여기서 만들어 둔다(냄비 곁일 때).
			PartyState.add_items({"meat": 3, "apple": 1, "mint": 2, "orchid": 1, "honey_flower": 2, "conch": 1, "clam": 1})
			for pair in [["meat_stew", 2], ["mint_stirfry", 2], ["orchid_tea", 1], ["conch_grill", 2]]:
				_ki.call("cook", pair[0], pair[1])
			_sc.call("close_screen")
			_next()
		6: # ⑦ 한 인물 회복·포만감 — 신상 회복이 안 닿는 들판에서
			if _frame == 1:
				_park()
			if _frame == 4:
				var m: float = _fc.call("max_hp_of", "self")
				(_fc.get("_hp") as Dictionary)["self"] = 50.0
				var msg: String = _ki.call("eat", Cooking.dish_id("honey_cake", 2), "self")
				var hp: float = _fc.call("hp_of", "self")
				var want := minf(50.0 + m * 0.26 + 80.0, m)
				_check("heal", msg != "" and absf(hp - want) < 0.5 and is_equal_approx(float(_ki.call("full_of", "self")), Cooking.FULL_PER_DISH),
					"hp=%.1f want=%.1f full=%.1f" % [hp, want, _ki.call("full_of", "self")])
				_next()
		7: # ⑧ 배부름
			(_ki.get("fullness") as Dictionary)["self"] = 70.0
			(_fc.get("_hp") as Dictionary)["self"] = 30.0
			var why: String = _ki.call("eat_block", Cooking.dish_id("honey_cake", 1), "self")
			var buff_ok: String = _ki.call("eat_block", Cooking.dish_id("mint_stirfry", 2), "self")
			(_ki.get("fullness") as Dictionary).erase("self")
			_check("full_block", why == "배부름" and buff_ok == "", "why='%s' buff='%s'" % [why, buff_ok])
			_next()
		8: # ⑨ 되살리기 — 명단에 동료 하나를 잠깐 넣는다
			PartyState.members.append("probe_mate")
			(_fc.get("_hp") as Dictionary)["probe_mate"] = 0.0
			var heal_why: String = _ki.call("eat_block", Cooking.dish_id("honey_cake", 1), "probe_mate")
			var self_why: String = _ki.call("eat_block", Cooking.dish_id("meat_stew", 2), "self")
			var msg: String = _ki.call("eat", Cooking.dish_id("meat_stew", 2), "probe_mate")
			var hp: float = _fc.call("hp_of", "probe_mate")
			var want: float = float(_fc.call("max_hp_of", "probe_mate")) * 0.2
			_check("revive", heal_why == "쓰러짐" and self_why == "쓰러진 인물만" and msg != "" and absf(hp - want) < 0.5,
				"heal_why='%s' self_why='%s' hp=%.1f want=%.1f" % [heal_why, self_why, hp, want])
			PartyState.members.erase("probe_mate")
			(_fc.get("_hp") as Dictionary).erase("probe_mate")
			_next()
		9: # ⑩ 공격 계열 — 공격 +24 → 청하란 차로 갈아 끼움(치명 +8%) → 끝남
			var atk0 := PartyState.char_atk("self")
			var cr0 := PartyState.crit_rate("self")
			_ki.call("eat", Cooking.dish_id("mint_stirfry", 2), "self")
			var atk1 := PartyState.char_atk("self")
			_ki.call("eat", Cooking.dish_id("orchid_tea", 1), "self")
			var atk2 := PartyState.char_atk("self")
			var cr2 := PartyState.crit_rate("self")
			var swapped: bool = PartyState.food_buffs.has("attack") and PartyState.food_buffs.attack.recipe == "orchid_tea"
			PartyState.tick_food(Cooking.BUFF_SEC + 1.0)
			var ok: bool = absf(atk1 - (atk0 + 24.0 * PartyState.atk_mul())) < 0.01 and is_equal_approx(atk2, atk0) and swapped \
				and absf(cr2 - (cr0 + 0.08)) < 0.001 and is_equal_approx(PartyState.crit_rate("self"), cr0) and PartyState.food_buffs.is_empty()
			_check("atk_buff", ok, "atk %.2f→%.2f→%.2f crit %.3f→%.3f→%.3f" % [atk0, atk1, atk2, cr0, cr2, PartyState.crit_rate("self")])
			_next()
		10: # ⑪ 모험 요리 — 스태미나 소모 ×0.76
			if _frame == 1:
				_v = float(_p.get("stamina_cost_mul"))
				_ki.call("eat", Cooking.dish_id("conch_grill", 2), "self")
			if _frame == 3:
				var now := float(_p.get("stamina_cost_mul"))
				_check("stamina_buff", absf(now - float(_v) * 0.76) < 0.001, "mul %.3f→%.3f" % [_v, now])
				PartyState.food_buffs.clear()
				_next()
		11: # ⑫ 돌파 특산물
			var c := Growth.ascend_cost("self", 0)
			var kinds := {}
			for h in Characters.HEROES.slice(0, 40):
				kinds[Growth.specialty_of(String(h.id))] = true
			var last := Growth.ascend_cost("self", 5)
			_check("ascend_special", int(c.get("orchid", 0)) == 3 and kinds.size() == 3 and int(last.get("orchid", 0)) == 60 \
				and int(Growth.KILL_DROPS.wolf.get("meat", 0)) == 1 and not kinds.has("snow_bloom") \
				and Growth.specialty_of("story_haram") == "snow_bloom" and int(Growth.ascend_cost("story_haram", 0).get("snow_bloom", 0)) == 3,
				"cost=%s kinds=%s haram=%s" % [c, kinds.keys(), Growth.specialty_of("story_haram")])
			_next()
		12: # ⑬ restore_cooking
			var gt := PartyState.gather_t.duplicate()
			var cp := PartyState.cook_prof.duplicate()
			PartyState.set_food_buff("defense", "clam_soup", 1, "def", 15.0, 10.0)
			PartyState.restore_cooking(gt, cp)
			var ok: bool = PartyState.gather_t == gt and PartyState.cook_prof == cp and PartyState.food_buffs.is_empty() \
				and int(PartyState.cook_prof.get("mush_skewer", 0)) == Cooking.PROF_MAX
			_check("restore", ok, "gather=%d prof=%s" % [PartyState.gather_t.size(), PartyState.cook_prof])
			Cooking.time_offset = 0.0
			_next()
		13:
			print("COOK_PROBE_DONE fails=%d" % _fails)
			get_tree().quit()

func _stand(at: Vector3) -> void:
	_p.global_position = at + Vector3.UP * 0.3
	_p.velocity = Vector3.ZERO

## 신상·채집 무리에서 먼 마을 들판.
func _park() -> void:
	var at := TestMap.world_pos(4.0, 4.0, "village")
	at.y = TerrainBuilder.height_at("village", at) + 0.5
	_p.global_position = at
	_p.velocity = Vector3.ZERO

func _check(name: String, ok: bool, detail: String) -> void:
	if not ok:
		_fails += 1
	print("COOK_PROBE %s %s %s" % [name, "ok" if ok else "FAIL", detail])

func _next() -> void:
	_step += 1
	_frame = 0
