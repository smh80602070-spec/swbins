extends SceneTree

## 사가블로 연단·행상·투전(data/dungeon_materials_state.gd 룬·보석 합치기, dungeon_equipment_state.gd 수리·감정·소켓·닳기, dungeon_potion_state.gd 허리띠, dungeon_gold_state.gd 값 치르기) 자동 점검 — 화면 없는 순수 규칙. 씨앗 고정(20260824).
##   godot --headless --path saga-godot --script res://tools/probe_dungeon_shop.gd
## ① 연단: 룬 3개 → 다음 글자 1개(모자라면 mat·마지막 王 은 top)·보석 3개 → 한 등급 위(완(完)은 top)·take 가 0 이 되면 키를 지움·주옥 주머니 JEWEL_MAX·restore 가 일련번호를 이음·감정서
## ② 행상: 금이 모자라면 spend 거절(불변)·수리값 = 장비 수리값 합·수리하면 내구가 가득·부적은 안 닳음·감정은 미확인에만·허리띠 쌓기(STACK 4)·가득이면 full·약값이 수준에 늘어남
## ③ 투전: GAMBLE_W 로 굴린 것은 부위를 지키고 확인된 채로 오며 · 값을 치르고 장착하면 그 부위가 바뀜 · 평균 등급이 던전 드랍보다 높음
## ④ 닳기·소켓: wear_all 이 부서진 부위를 알려 주고 부서진 장비는 효과를 못 냄 · 소켓에 룬 셋을 순서대로 박으면 부문어 · 보석 박기·원소 저항 합산(상한 75).
## 상태(재료·장비·금·허리띠)는 끝에 되돌린다. 끝에 "PROBE dungeon_shop OK" 또는 "PROBE dungeon_shop FAIL n".

const Items := preload("res://games/saga_dungeon/data/dungeon_items.gd")

var fails := 0


func check(cond: bool, msg: String) -> void:
	if cond:
		print("  ok   ", msg)
	else:
		fails += 1
		print("  FAIL ", msg)


func _initialize() -> void:
	await process_frame
	seed(20260824)
	var M: Node = root.get_node("DungeonMaterialsState")
	var E: Node = root.get_node("DungeonEquipmentState")
	var G: Node = root.get_node("DungeonGoldState")
	var P: Node = root.get_node("DungeonPotionState")
	var saved := {
		"runes": M.rune_counts.duplicate(), "scrolls": M.scrolls, "gems": M.gem_counts.duplicate(), "jewels": M.jewels.duplicate(true), "seq": M._jewel_seq,
		"gold": G.gold, "belt": P.belt.duplicate(true),
	}
	var saved_equip := {}
	for s in E.SLOT_NAMES:
		saved_equip[s] = (E.item_for(s) as Dictionary).duplicate(true)

	# ① 연단
	M.restore({}, 0, {}, [])
	check(not M.combine_rune("cheon").ok and M.combine_rune("cheon").reason == "mat", "룬 합치기: 없으면 mat")
	M.add_rune("cheon", 2)
	check(M.combine_rune("cheon").reason == "mat" and M.count("cheon") == 2, "룬 2개로는 모자람(mat) · 불변")
	M.add_rune("cheon", 7)  # 9
	var r1: Dictionary = M.combine_rune("cheon")
	M.combine_rune("cheon")
	M.combine_rune("cheon")
	check(r1.ok and r1.next_key == "ji" and M.count("cheon") == 0 and M.count("ji") == 3 and not M.rune_counts.has("cheon"), "룬 9개 → 천 3번 합쳐 지 3개 · 0 이 된 키는 지워짐")
	var r2: Dictionary = M.combine_rune("ji")
	check(r2.ok and r2.next_key == "in" and M.count("in") == 1 and not M.rune_counts.has("ji"), "지 3개 → 인 1개")
	M.add_rune("wang", 3)
	check(M.combine_rune("wang").reason == "top" and M.count("wang") == 3, "마지막 글자(王)는 더 못 올림(top) · 불변")
	check(M.take_rune("in") and not M.take_rune("in") and M.count("in") == 0 and not M.rune_counts.has("in") and M.take_rune("wang") and M.count("wang") == 2, "take_rune: 하나 빼고 0 이면 지우고 없으면 false")
	M.add_gem("agate", 0, 3)
	var g1: Dictionary = M.combine_gem("agate", 0)
	check(g1.ok and g1.next_grade == 1 and M.gem_count("agate", 0) == 0 and M.gem_count("agate", 1) == 1 and M.combine_gem("agate", 1).reason == "mat", "보석 3개(조) → 한 등급 위(양) 1개 · 모자라면 mat")
	M.add_gem("pearl", 4, 5)
	check(M.combine_gem("pearl", 4).reason == "top" and M.gem_count("pearl", 4) == 5, "완(完) 등급은 더 못 올림(top)")
	check(M.take_gem("pearl", 4) and M.gem_count("pearl", 4) == 4 and not M.take_gem("jade", 2), "take_gem")
	M.add_scroll(2)
	check(M.take_scroll() and M.take_scroll() and not M.take_scroll() and M.scrolls == 0, "감정서: 쓰면 줄고 0 이면 못 씀")
	check(M.add_jewel({}).reason == "bad" and M.add_jewel({"x": 1}).reason == "bad", "주옥: 접사가 없으면 bad")
	var jw: Dictionary = Items.roll_jewel(5)
	var made: Dictionary = M.add_jewel(jw)
	check(made.ok and made.jewel.id == "j1" and M.add_jewel(jw).jewel.id == "j2" and not M.remove_jewel("j1").is_empty() and M.remove_jewel("j1").is_empty() and M.jewels.size() == 1, "주옥: 일련번호 j1·j2 · 빼기는 한 번만")
	while M.jewels.size() < Items.JEWEL_MAX:
		M.add_jewel(jw)
	check(M.jewels.size() == Items.JEWEL_MAX and M.add_jewel(jw).reason == "full", "주옥 주머니가 JEWEL_MAX(%d)면 full" % Items.JEWEL_MAX)
	M.restore({"cheon": "4"}, -5, {"agate:2": 3}, [{"id": "j7", "aff": []}, {"bad": 1}])
	var next_j: Dictionary = M.add_jewel(jw)
	check(M.count("cheon") == 4 and M.scrolls == 0 and M.gem_count("agate", 2) == 3 and M.jewels.size() == 2 and next_j.jewel.id == "j8", "restore: 문자열 개수·음수 감정서를 바로잡고 · 깨진 주옥은 거르고 · 일련번호를 이어(j8)")

	# ② 행상
	for s in E.SLOT_NAMES:
		E.equip(s, {})
	G.gold = 10
	var broke_ok: bool = not G.spend(50) and G.gold == 10 and not G.spend(0) and G.spend(10) and G.gold == 0
	check(broke_ok, "값 치르기: 모자라면 거절(금 불변) · 0 이하 거절 · 딱 맞으면 0")
	var worn: Dictionary = Items.roll(10, "weapon", 3, true)
	worn["dur"] = 0.0
	var amulet: Dictionary = Items.roll(10, "charm", 4, true)
	var armor: Dictionary = Items.roll(10, "armor", 2, true)
	armor["dur"] = Items.dur_max_of(armor) / 2.0
	E.equip("weapon", worn)
	E.equip("charm", amulet)
	E.equip("armor", armor)
	var expect: int = Items.repair_cost(worn) + Items.repair_cost(armor)
	check(E.repair_all_cost() == expect and expect > 0 and Items.repair_cost(amulet) == 0, "수리 값 = 닳은 장비 수리값의 합(%d) · 부적은 0" % expect)
	E.repair_all()
	check(E.item_for("weapon").dur == Items.dur_max_of(worn) and E.item_for("armor").dur == Items.dur_max_of(armor) and E.repair_all_cost() == 0, "수리하면 내구가 가득 · 수리 값 0")
	var unid: Dictionary = Items.roll(5, "helm", 2)
	E.equip("helm", unid)
	check(E.identify("helm") and not E.item_for("helm").unid and not E.identify("helm") and not E.identify("ring"), "감정: 미확인에만 · 이미 확인됐거나 빈 부위는 false")
	P.restore([])
	var a1: Dictionary = P.add(0)
	var stack_ok: bool = a1.ok and a1.slot == 0
	for i in 3:
		stack_ok = stack_ok and P.add(0).slot == 0
	var a5: Dictionary = P.add(0)
	check(stack_ok and a5.ok and a5.slot == 1 and P.belt[0].n == 4 and P.total() == 5, "허리띠: 같은 약은 STACK(4)까지 쌓고 넘치면 다음 칸")
	for i in 3:
		P.add(0)
	P.add(1)
	P.add(2)
	check(not P.add(0).ok and P.add(0).reason == "full" and P.add(1).ok, "허리띠 네 칸이 다 차면 새 쌓을 자리가 없을 때 full(남는 쌓임 칸이 있으면 계속 들어감)")
	check(P.use(3).reason == "off" or P.use(3).reason == "empty", "플레이어 체력 노드가 없으면 약을 못 씀")
	check(P.price(0, 1) < P.price(0, 10) and P.price(0, 1) < P.price(1, 1) and P.price(1, 1) < P.price(2, 1), "약값: 수준·등급에 따라 늘어남")
	P.restore([{"g": 1, "n": 2}, {}, "junk"])
	check(P.belt[0].g == 1 and P.belt[0].n == 2 and P.belt[1].is_empty() and P.belt[2].is_empty() and P.total() == 2, "restore: 깨진 칸은 비우고 값은 정수로")

	# ③ 투전
	var gam_rank := 0
	var drop_rank := 0
	var gam_ok := true
	for n in 600:
		var slot: String = E.SLOT_NAMES[n % 8]
		var t: int = Items.roll_tier_gamble()
		var it: Dictionary = Items.roll(8, slot, t, true)
		gam_ok = gam_ok and Items.base_by_key(String(it.base)).slot == slot and not it.unid and int(it.tier) == t
		gam_rank += t
		drop_rank += int(Items.roll(8, slot).tier)
	check(gam_ok and gam_rank > drop_rank * 1.5, "투전: 부위·등급 그대로 확인된 채로 오고 평균 등급이 던전 드랍보다 높음(%d vs %d / 600)" % [gam_rank, drop_rank])
	G.gold = 1000
	var price: int = Items.gamble_price("ring", 5)
	var before_ring: Dictionary = E.item_for("ring")
	var paid: bool = G.spend(price)
	var bought: Dictionary = Items.roll(5, "ring", Items.roll_tier_gamble(), true)
	E.equip("ring", bought)
	check(paid and G.gold == 1000 - price and E.item_for("ring") == bought and before_ring.is_empty() and price == int(roundf(150.0 * 3.75)), "산 것은 값을 치르고 그 부위에 장착됨(반지 5수준 = %d금)" % price)
	G.gold = 0
	check(not G.spend(Items.gamble_price("weapon", 1)) and E.item_for("ring") == bought, "금이 없으면 못 사고 장비 불변")

	# ④ 닳기·소켓
	for s in E.SLOT_NAMES:
		E.equip(s, {})
	var sword: Dictionary = Items.roll(5, "weapon", 0, true)
	sword["sock"] = [null, null, null]
	sword["aff"] = []
	sword["dur"] = 2.0
	sword["base"] = "w_changj"
	sword["main"] = 20.0
	var charm2: Dictionary = {"base": "c_hopae", "tier": 1, "ilvl": 3, "main": 5.0, "aff": [], "sock": [], "set": "", "unid": false}
	E.equip("weapon", sword)
	E.equip("charm", charm2)
	var flat_before: float = E.atk_flat_bonus()
	var broke1: Array = E.wear_all(1.0)
	var broke2: Array = E.wear_all(5.0)
	var flat_after: float = E.atk_flat_bonus()
	check(broke1.is_empty() and broke2 == ["weapon"] and E.item_for("weapon").dur == 0.0 and not E.item_for("charm").has("dur") and flat_before >= 20.0 and flat_after < flat_before, "닳기: 부서질 때 한 번만 알려 주고 · 부적은 안 닳음 · 부서진 무기는 공격 보너스를 못 냄(%.0f→%.0f)" % [flat_before, flat_after])
	E.repair_all()
	check(E.first_socketable_slot() == "weapon" and E.socket_rune("weapon", "cheon").is_empty() and E.socket_rune("weapon", "ji").is_empty(), "소켓: 빈 구멍이 있는 첫 부위 · 룬 둘째까지는 부문어 아님")
	var word: Dictionary = E.socket_rune("weapon", "in")
	check(word.key == "cheonjiin" and E.socket_rune("weapon", "in").is_empty() and E.first_socketable_slot() == "", "셋째 룬(천→지→인)이 부문어 천지인을 이룸 · 구멍이 다 차면 더 못 박음")
	var armor2: Dictionary = {"base": "a_dujeong", "tier": 1, "ilvl": 1, "main": 5.0, "aff": [], "sock": [null, null, null], "set": "", "unid": false, "dur": 34.0}
	E.equip("armor", armor2)
	E.socket_gem("armor", "agate", 0)
	E.socket_gem("armor", "agate", 4)
	check(E.elem_resist("fire") == 8.0 + 56.0 and E.elem_resist("cold") == 0.0, "갑주 보석: 화 저항 8+56(완 등급 ×7) — 저항 합산")
	E.socket_gem("armor", "agate", 4)
	check(E.elem_resist("fire") == Items.RESIST_CAP and E.first_socketable_slot() == "", "화 저항은 상한 75 에서 멈춤")
	E.equip("weapon", {"base": "w_changj", "tier": 1, "ilvl": 1, "main": 5.0, "aff": [], "sock": [{"t": "gem", "key": "agate", "g": 1}, {"t": "gem", "key": "pearl", "g": 0}], "set": "", "unid": false, "dur": 34.0})
	var ed: Dictionary = E.elem_damage()
	check(ed.get("fire", 0.0) == 11.0 and ed.get("cold", 0.0) == 5.0 and not ed.has("lit"), "무기 보석: 화 6×1.8≈11 · 빙 5 → 원소 피해 합산")

	# 되돌리기
	M.rune_counts = saved.runes
	M.scrolls = saved.scrolls
	M.gem_counts = saved.gems
	M.jewels.assign(saved.jewels)
	M._jewel_seq = saved.seq
	G.gold = saved.gold
	P.belt.assign(saved.belt)
	for s in E.SLOT_NAMES:
		E.equip(s, saved_equip[s])
	print("PROBE dungeon_shop ", "OK" if fails == 0 else "FAIL %d" % fails)
	quit(1 if fails > 0 else 0)
