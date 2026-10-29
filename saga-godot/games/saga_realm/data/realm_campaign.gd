extends RefCounted

## G-0413 — 5천하 장 흐름 규칙. 웹 W-0450의 카드·보상·배율을 옮기고 전술판은 RealmTactics 한 벌을 쓴다.
const Scenario := preload("res://games/saga_realm/data/scenario.gd")
const Characters := preload("res://saga_core/data/characters.gd")
const RealmTactics := preload("res://games/saga_realm/data/realm_tactics.gd")
const RealmWar := preload("res://games/saga_realm/data/realm_war.gd")
const Treasure := preload("res://games/saga_realm/data/realm_treasure.gd")
const Support := preload("res://games/saga_realm/data/realm_support.gd")
const CampaignGear := preload("res://games/saga_realm/data/realm_campaign_gear.gd")
const CampaignCommand := preload("res://games/saga_realm/data/realm_commander.gd")
const CampaignClass := preload("res://games/saga_realm/data/realm_class.gd")
const BattleScript := preload("res://games/saga_realm/data/realm_battle_script.gd")
const RealmSideGoal := preload("res://games/saga_realm/data/realm_side_goal.gd")

const MAIN := 16
const ALL := 19
const BATTLE := {
	"r1_start": ["plain", false, "rout", 0.00], "r1_rift_sign": ["hill", false, "leader", 0.06], "r1_first_ally": ["plain", false, "rout", 0.12],
	"r2_fallen": ["hill", false, "leader", 0.18], "r2_plains": ["plain", false, "rout", 0.26], "r2_debate": ["plain", true, "gate", 0.32],
	"r3_navigator": ["river", false, "leader", 0.38], "r3_river": ["river", false, "leader", 0.46], "r3_duel": ["mount", false, "leader", 0.52],
	"r4_rift": ["mount", true, "gate", 0.58], "r4_plague": ["hill", true, "hold", 0.64], "r4_tomb": ["mount", false, "leader", 0.70],
	"r5_silk": ["plain", false, "rout", 0.76], "r5_west": ["plain", true, "gate", 0.82], "r5_south": ["river", false, "leader", 0.88],
	"r6_end": ["plain", true, "rout", 1.00],
}
const MOVES := ["slash", "stab", "guard"]
const MOVE_NAME := {"slash": "베기", "stab": "찌르기", "guard": "막기"}


static func enabled() -> bool:
	return OS.get_environment("SAGA_REALM_CAMPAIGN") != "0"


static func defaults() -> Dictionary:
	return {"ch": 1, "step": "route", "party": [], "gold": 300, "bag": [], "cleared": {}, "bonus": {}, "tries": 0, "round": 0, "gear": {}, "gbag": ["gr_sword_n", "gr_hide_n"], "mercs": {}, "cls": {}}


static func data(S: Object = null) -> Dictionary:
	var owner := S if S != null else RealmSaveState
	var cp: Variant = owner.get("campaign")
	if not cp is Dictionary:
		cp = defaults()
		owner.set("campaign", cp)
	for k: String in ["ch", "step", "party", "gold", "bag", "cleared", "bonus", "tries", "round", "gear", "gbag", "mercs", "cls"]:
		if not (cp as Dictionary).has(k):
			(cp as Dictionary)[k] = defaults()[k]
	if not cp.party is Array: cp.party = []
	if not cp.bag is Array: cp.bag = []
	if not cp.cleared is Dictionary: cp.cleared = {}
	if not cp.bonus is Dictionary: cp.bonus = {}
	if not cp.gear is Dictionary: cp.gear = {}
	if not cp.gbag is Array: cp.gbag = []
	if not cp.mercs is Dictionary: cp.mercs = {}
	if not cp.cls is Dictionary: cp.cls = {}
	return cp


static func class_of(id: String, S: Object = null) -> String:
	return String(data(S).cls.get(id, ""))


static func class_choices(id: String, S: Object = null) -> Array:
	var owner := S if S != null else RealmSaveState
	var growth: Dictionary = owner._growth(id)
	return CampaignClass.choices(int(growth.get("lv", 1)), class_of(id, S))


static func choose_class(id: String, key: String, S: Object = null) -> Dictionary:
	var cp := data(S)
	if not roster(S).has(id) or not class_choices(id, S).has(key): return {"ok": false, "why": "현재 레벨에서 고를 수 없는 직업입니다"}
	cp.cls[id] = key
	_save(S)
	return {"ok": true, "class": key}


static func gear_stock(S: Object = null) -> Array:
	var cp := data(S)
	return CampaignGear.stock(int(cp.ch), int(cp.round))


static func buy_gear(item_id: String, S: Object = null) -> Dictionary:
	var cp := data(S)
	var it := CampaignGear.item(item_id)
	if it.is_empty(): return {"ok": false, "why": "없는 장비입니다"}
	var in_stock := false
	for offered: Dictionary in gear_stock(S):
		if String(offered.id) == item_id: in_stock = true; break
	if not in_stock: return {"ok": false, "why": "이번 장 상점 진열품이 아닙니다"}
	var p := CampaignGear.price(it)
	if int(cp.gold) < p: return {"ok": false, "why": "금이 모자랍니다"}
	cp.gold = int(cp.gold) - p
	cp.gbag.append(item_id)
	_save(S)
	return {"ok": true, "price": p}


static func gear_of(officer_id: String, S: Object = null) -> Dictionary:
	var cp := data(S)
	var got: Dictionary = cp.gear.get(officer_id, {})
	return {"w": String(got.get("w", "")), "a": String(got.get("a", "")), "c": String(got.get("c", ""))}


static func equip_gear(officer_id: String, item_id: String, S: Object = null) -> Dictionary:
	var cp := data(S)
	if not roster(S).has(officer_id): return {"ok": false, "why": "합류한 장수만 장비를 낄 수 있습니다"}
	var item := CampaignGear.item(item_id)
	var index: int = cp.gbag.find(item_id)
	if item.is_empty() or index < 0: return {"ok": false, "why": "가방에 없는 장비입니다"}
	var slots: Dictionary = cp.gear.get(officer_id, {"w":"", "a":"", "c":""})
	var slot := String(item.slot)
	var old := String(slots.get(slot, ""))
	cp.gbag.remove_at(index)
	if old != "": cp.gbag.append(old)
	slots[slot] = item_id
	cp.gear[officer_id] = slots
	_save(S)
	return {"ok": true, "old": old}


static func unequip_gear(officer_id: String, slot: String, S: Object = null) -> bool:
	var cp := data(S)
	if not ["w", "a", "c"].has(slot): return false
	var slots: Dictionary = cp.gear.get(officer_id, {})
	var old := String(slots.get(slot, ""))
	if old == "": return false
	slots[slot] = ""
	cp.gear[officer_id] = slots
	cp.gbag.append(old)
	_save(S)
	return true


## Equip the highest-grade bag item for each party member and slot, keeping the old item.
static func auto_equip(S: Object = null) -> Dictionary:
	var cp := data(S)
	var changed := 0
	var party_ids: Array = party(S)
	for officer_id_v: Variant in party_ids:
		var officer_id := String(officer_id_v)
		var slots: Dictionary = cp.gear.get(officer_id, {"w":"", "a":"", "c":""}).duplicate(true)
		for slot in ["w", "a", "c"]:
			var current_id := String(slots.get(slot, ""))
			var current := CampaignGear.item(current_id)
			var grade := int(current.get("grade", -1))
			var best_index := -1
			var best_grade := grade
			for index in cp.gbag.size():
				var candidate := CampaignGear.item(String(cp.gbag[index]))
				if String(candidate.get("slot", "")) == slot and int(candidate.get("grade", -1)) > best_grade:
					best_index = index
					best_grade = int(candidate.grade)
			if best_index < 0: continue
			var next_id := String(cp.gbag[best_index])
			cp.gbag.remove_at(best_index)
			if current_id != "": cp.gbag.append(current_id)
			slots[slot] = next_id
			changed += 1
		cp.gear[officer_id] = slots
	if changed > 0: _save(S)
	return {"ok": true, "changed": changed}


static func cards() -> Array:
	var out: Array = []
	for i in range(mini(ALL, Scenario.CARDS.size())):
		var card: Dictionary = (Scenario.CARDS[i] as Dictionary).duplicate(true)
		var setup: Array = BATTLE.get(String(card.id), ["plain", false, "rout", float(i) / float(MAIN)])
		card["chapter"] = i + 1
		card["land"] = setup[0]
		card["siege"] = setup[1]
		card["goal"] = setup[2]
		card["tier"] = setup[3]
		card["foe_n"] = 2 if float(setup[3]) < 0.15 else 3
		card["epilogue"] = i >= MAIN
		out.append(card)
	return out


static func card(no: int) -> Dictionary:
	var all := cards()
	return all[no - 1] if no > 0 and no <= all.size() else {}


static func is_unlocked(no: int, S: Object = null) -> bool:
	return no > 0 and no <= int(data(S).ch)


static func roster(S: Object = null) -> Array:
	var owner := S if S != null else RealmSaveState
	var ids: Array = []
	for v: Variant in owner.roster:
		var id := String(v)
		if Characters.find(id) == null or int(owner.officer_hurt.get(id, 0)) > 0:
			continue
		ids.append(id)
	ids.sort_custom(func(a: String, b: String) -> bool: return _power(a, owner) > _power(b, owner))
	return ids


static func party(S: Object = null) -> Array:
	var cp := data(S)
	var available := roster(S)
	var out: Array = []
	for id_v: Variant in cp.party:
		var id := String(id_v)
		if available.has(id) and not out.has(id) and out.size() < 3: out.append(id)
	if out.is_empty(): out = available.slice(0, mini(3, available.size()))
	return out


static func set_party(ids: Array, S: Object = null) -> bool:
	var cp := data(S)
	var available := roster(S)
	var out: Array = []
	for id_v: Variant in ids:
		var id := String(id_v)
		if available.has(id) and not out.has(id) and out.size() < 3: out.append(id)
	if out.is_empty(): return false
	cp.party = out
	_save(S)
	return true


static func merc_count(no: int) -> int:
	return 3 if no >= 9 else 2


static func merc_arms(id: String, S: Object = null) -> Array:
	var cp := data(S)
	return CampaignCommand.arms_for(id, party(S).find(id), cp, merc_count(int(cp.ch)))


static func cycle_merc(id: String, slot: int, S: Object = null) -> Array:
	var cp := data(S)
	var changed := CampaignCommand.cycle_arm(cp, id, party(S).find(id), slot)
	_save(S)
	return changed


static func choose(no: int, key: String, S: Object = null) -> Dictionary:
	var owner := S if S != null else RealmSaveState
	var cp := data(owner)
	if int(cp.ch) != no or String(cp.step) != "story": return {"ok": false, "why": "지금 고를 수 없는 장입니다"}
	var ch := card(no)
	var selected: Dictionary = {}
	for option: Dictionary in ch.get("choices", []):
		if String(option.get("k", "")) == key: selected = option
	if selected.is_empty(): return {"ok": false, "why": "없는 선택입니다"}
	if bool(ch.epilogue):
		cp.gold = int(cp.gold) + 300
		cp.cleared[no] = int(cp.cleared.get(no, 0)) + 1
		if no < ALL: cp.ch = no + 1
		cp.step = "route"
		_save(S)
		return {"ok": true, "epilogue": true, "end": no == ALL}
	cp.bonus = {"ch": no, "k": key}
	if key == "util": cp.gold = int(cp.gold) + 200
	cp.step = "camp"
	_save(S)
	return {"ok": true, "choice": selected}


static func price(item_id: String) -> int:
	var it := Treasure.item(item_id)
	return 120 + int(it.get("bonus", 0)) * 45 if not it.is_empty() else 0


static func buy(item_id: String, S: Object = null) -> Dictionary:
	var cp := data(S)
	var p := price(item_id)
	if p <= 0: return {"ok": false, "why": "없는 보물입니다"}
	if int(cp.gold) < p: return {"ok": false, "why": "금이 모자랍니다"}
	cp.gold = int(cp.gold) - p
	cp.bag.append(item_id)
	_save(S)
	return {"ok": true, "price": p}


static func equip(officer_id: String, item_id: String, S: Object = null) -> Dictionary:
	var owner := S if S != null else RealmSaveState
	var cp := data(owner)
	var idx: int = cp.bag.find(item_id)
	if idx < 0 or not party(owner).has(officer_id): return {"ok": false, "why": "출진 장수의 가방 보물만 장착할 수 있습니다"}
	if Treasure.item(item_id).is_empty(): return {"ok": false, "why": "없는 보물입니다"}
	cp.bag.remove_at(idx)
	var old := String(owner.officer_item.get(officer_id, ""))
	if old != "": cp.bag.append(old)
	owner.officer_item[officer_id] = item_id
	_save(S)
	return {"ok": true}


static func unequip(officer_id: String, S: Object = null) -> bool:
	var owner := S if S != null else RealmSaveState
	var cp := data(owner)
	var old := String(owner.officer_item.get(officer_id, ""))
	if old == "": return false
	owner.officer_item.erase(officer_id)
	cp.bag.append(old)
	_save(S)
	return true


static func battle_board(no: int, S: Object = null) -> Dictionary:
	var owner := S if S != null else RealmSaveState
	var cp := data(owner)
	var ch := card(no)
	if ch.is_empty() or no > MAIN or no != int(cp.ch): return {"ok": false, "why": "출진할 수 없는 장입니다"}
	var mine := party(owner)
	if mine.is_empty(): return {"ok": false, "why": "출진할 장수가 없습니다"}
	var foes := _foes(ch, owner)
	if foes.is_empty(): return {"ok": false, "why": "맞설 장수가 없습니다"}
	var bonus: Dictionary = cp.bonus if int(cp.bonus.get("ch", -1)) == no else {}
	var my_troops := roundi((2400.0 + 520.0 * no) * (1.15 if String(bonus.get("k", "")) == "atk" else 1.0))
	var foe_troops := roundi((2000.0 + 640.0 * no) * (0.9 if String(bonus.get("k", "")) == "def" else 1.0) * (1.0 + 0.15 * int(cp.round)) * (1.2 if no == MAIN else 1.0))
	var goal := String(ch.goal)
	var board := RealmTactics.make_board_srpg("campaign|%d|%d|%d" % [int(cp.round), no, int(cp.tries)], String(ch.land), bool(ch.siege), goal)
	board.campaign = true
	board.command = true
	board.mercs = cp.mercs
	board.classes = cp.cls.duplicate(true)
	for foe_id: String in foes:
		var enemy_class := CampaignClass.foe_class(String(board.seed), foe_id, float(ch.tier))
		if enemy_class != "": board.classes[foe_id] = enemy_class
	board.merc_n = 3 if no >= 9 else 2
	board.merc_mul = 1.2
	var stats := {}
	for id: String in mine + foes:
		stats[id] = {"might": owner._effective_stat(id, "might"), "wisdom": owner._effective_stat(id, "wisdom"), "command": owner._effective_stat(id, "command")}
	var events := {}
	if [4, 7, 10, 13, 16].has(no):
		var reserve_foe := _event_foe(ch, foes, owner)
		if reserve_foe != "":
			stats[reserve_foe] = {"might": owner._effective_stat(reserve_foe, "might"), "wisdom": owner._effective_stat(reserve_foe, "wisdom"), "command": owner._effective_stat(reserve_foe, "command")}
			events.reinforce = {"turn":3, "id":reserve_foe, "arms":["cav", "spear"], "hp":maxi(20, roundi(18.0 + float(foe_troops) * 0.15 / 50.0)), "cls":CampaignClass.foe_class(String(board.seed), reserve_foe, float(ch.tier))}
	var reserve_ally := ""
	for id: String in roster(owner):
		if not mine.has(id): reserve_ally = id; break
	if reserve_ally != "":
		stats[reserve_ally] = {"might": owner._effective_stat(reserve_ally, "might"), "wisdom": owner._effective_stat(reserve_ally, "wisdom"), "command": owner._effective_stat(reserve_ally, "command")}
		events.ally = {"id":reserve_ally, "arms":["spear", "bow"], "hp":maxi(20, roundi(18.0 + float(my_troops) * 0.15 / 50.0)), "cls":class_of(reserve_ally, owner)}
	var battle_script := BattleScript.of(String(ch.id))
	if not battle_script.is_empty(): events.script = battle_script
	events.side = {"chests":1 if no % 2 == 1 else 2, "villages":2 if [3, 5, 11, 13].has(no) else 0}
	board.battle_stats = stats.duplicate(true)
	board.events = events
	RealmTactics.units_of_srpg(board, mine, foes, [foe_troops], stats, [my_troops])
	if not owner.support.is_empty(): owner.call("_put_support", board, mine)
	return {"ok": true, "board": board, "foes": foes, "mine": mine, "enemy_id": "campaign_%d" % no}


static func _event_foe(ch: Dictionary, already_used: Array, S: Object) -> String:
	var all: Array = []
	for city_id: Variant in S.enemies:
		var enemy: Dictionary = S.enemies[city_id]
		if bool(enemy.get("captured", false)) or String(S.force_of(String(city_id))) == "": continue
		for id_v: Variant in enemy.get("officers", []):
			var id := String(id_v)
			if Characters.find(id) != null and not already_used.has(id) and not all.has(id): all.append(id)
	all.sort_custom(func(a: String, b: String) -> bool: return _power(a, S) < _power(b, S))
	if all.is_empty(): return ""
	var at := mini(all.size() - 1, int(floor(float(ch.get("tier", 0.0)) * float(all.size() - 1))))
	return String(all[maxi(0, at)])


static func apply_result(no: int, result: Dictionary, S: Object = null) -> Dictionary:
	var owner := S if S != null else RealmSaveState
	var cp := data(owner)
	if no != int(cp.ch) or String(cp.step) != "battle": return {"ok": false, "why": "결과가 이미 반영됐습니다"}
	if result.is_empty():
		cp.step = "camp"
		_save(S)
		return {"ok": true, "cancelled": true}
	cp.tries = int(cp.tries) + 1
	for w_v: Variant in result.get("wounded", []):
		var id := String(w_v.get("id", "")) if w_v is Dictionary else String(w_v)
		if id != "": owner.officer_hurt[id] = maxi(1, int(owner.officer_hurt.get(id, 0)))
	for id_v: Variant in result.get("fallen", []):
		var id := String(id_v)
		owner.roster.erase(id)
		owner.officer_city.erase(id)
		owner.officer_hurt.erase(id)
		owner.annals[id] = {"year": owner.year, "month": owner.month, "where": "5천하 %d장" % no, "by": ""}
	var kind := String(result.get("kind", ""))
	var won := ["win", "rout", "leader", "gate", "hold"].has(kind) or bool(result.get("win", false))
	var side_result: Dictionary = result.get("side", {})
	var side_gold := maxi(0, int(side_result.get("loot", 0))) * int(RealmSideGoal.GOLD.chest)
	var chest_gear: Array[Dictionary] = []
	for ci in int(side_result.get("loot", 0)):
		if (no * 7 + int(cp.tries) * 3 + ci) % RealmSideGoal.CHEST_GEAR != 0: continue
		var chest_item := CampaignGear.drop(no, "chest%d:%d:%d" % [ci, int(cp.round), int(cp.tries)], int(cp.round))
		if chest_item.is_empty(): continue
		cp.gbag.append(String(chest_item.id))
		chest_gear.append(chest_item)
	if won:
		side_gold += maxi(0, int(side_result.get("kept", 0))) * int(RealmSideGoal.GOLD.village)
		if int(side_result.get("total", 0)) > 0 and int(side_result.get("kept", 0)) == int(side_result.get("total", 0)):
			side_gold += int(RealmSideGoal.GOLD.all_villages)
	if result.has("sup"):
		Support.on_end(owner, result.get("sup", []))
	if won:
		var gold := 150 + 40 * no
		cp.gold = int(cp.gold) + gold + side_gold
		var exp := 60 + 15 * no
		for id: String in party(owner): owner.gain_exp(id, exp)
		for id_v: Variant in owner.roster:
			var id := String(id_v)
			if int(owner.officer_hurt.get(id, 0)) > 0: owner.officer_hurt.erase(id)
		var item_id := ""
		if no == 1 or (no * 7 + int(cp.tries)) % 3 == 0:
			item_id = String(Treasure.ITEMS[(no * 7 + int(cp.tries)) % Treasure.ITEMS.size()].id)
			cp.bag.append(item_id)
		var gear := CampaignGear.drop(no, "%d:%d" % [int(cp.round), int(cp.tries)], int(cp.round))
		if not gear.is_empty(): cp.gbag.append(String(gear.id))
		cp.last_gear = gear.duplicate(true)
		cp.cleared[no] = int(cp.cleared.get(no, 0)) + 1
		cp.ch = mini(ALL + 1, no + 1)
		cp.bonus = {}
		cp.tries = 0
		cp.step = "result"
		_save(S)
		return {"ok": true, "win": true, "gold": gold + side_gold, "sideGold":side_gold, "side":side_result, "chestGear":chest_gear, "exp": exp, "item": item_id, "gear": gear, "next": int(cp.ch)}
	cp.gold = int(cp.gold) + side_gold
	cp.step = "camp"
	_save(S)
	return {"ok": true, "win": false, "kind": kind, "sideGold":side_gold, "side":side_result, "chestGear":chest_gear}


static func continue_after_result(S: Object = null) -> void:
	var cp := data(S)
	if int(cp.ch) > ALL:
		cp.step = "round_end"
	else:
		cp.step = "route"
	_save(S)


static func new_round(S: Object = null) -> void:
	var cp := data(S)
	cp.round = int(cp.round) + 1
	cp.ch = 1
	cp.step = "route"
	cp.cleared = {}
	cp.tries = 0
	_save(S)


static func _foes(ch: Dictionary, S: Object) -> Array:
	var all: Array = []
	for city_id: Variant in S.enemies:
		var enemy: Dictionary = S.enemies[city_id]
		if bool(enemy.get("captured", false)) or String(S.force_of(String(city_id))) == "": continue
		for id_v: Variant in enemy.get("officers", []):
			var id := String(id_v)
			if Characters.find(id) != null and not all.has(id): all.append(id)
	all.sort_custom(func(a: String, b: String) -> bool: return _power(a, S) < _power(b, S))
	if all.is_empty(): return []
	var count := mini(int(ch.foe_n), all.size())
	var start := mini(all.size() - count, int(floor(float(ch.tier) * float(all.size() - count))))
	var out: Array = all.slice(start, start + count)
	out.reverse()
	return out


static func _power(id: String, S: Object) -> float:
	return S._effective_stat(id, "might") + S._effective_stat(id, "command") + S._effective_stat(id, "wisdom") * 0.5


static func _save(S: Object = null) -> void:
	var owner := S if S != null else RealmSaveState
	if owner.has_method("save"): owner.save()
