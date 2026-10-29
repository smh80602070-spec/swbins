extends RefCounted

## G-0417 — W-0455 지휘관·용병 규칙. 기존 SRPG가 campaign=true일 때만 호출한다.
const ARMS := ["spear", "cav", "bow"]
const ARM_NAME := {"spear":"창", "cav":"기", "bow":"궁"}
const PER := 2
const COUNTER_MUL := 0.5
const RESUPPLY := 0.25


static func arm_names(arms: Array) -> String:
	var names: Array[String] = []
	for arm_v: Variant in arms:
		names.append(String(ARM_NAME.get(String(arm_v), "창")))
	return "·".join(names)


static func arms_for(id: String, order: int, state: Dictionary, count: int = 3) -> Array:
	var defaults := [ARMS[posmod(order, 3)], ARMS[posmod(order + 1, 3)], ARMS[posmod(order + 2, 3)]]
	var all: Array = defaults
	var mercs: Variant = state.get("mercs", {})
	if mercs is Dictionary and (mercs as Dictionary).get(id, null) is Array:
		var saved: Array = (mercs as Dictionary)[id]
		for i in mini(3, saved.size()):
			if ARMS.has(String(saved[i])): all[i] = String(saved[i])
	while all.size() < 3: all.append(ARMS[all.size() % 3])
	return all.slice(0, clampi(count, 0, 3))


static func cycle_arm(state: Dictionary, id: String, order: int, slot: int) -> Array:
	var all := arms_for(id, order, state, 3)
	if slot < 0 or slot >= all.size(): return all
	all[slot] = ARMS[(ARMS.find(String(all[slot])) + 1) % ARMS.size()]
	if not state.get("mercs", null) is Dictionary: state["mercs"] = {}
	(state.mercs as Dictionary)[id] = all
	return all


static func _hash(seed: String, salt: String) -> float:
	var h := 2166136261
	var source := seed + "|" + salt
	for i in source.length():
		h = h ^ source.unicode_at(i)
		h = (h * 16777619) & 0xFFFFFFFF
	h = h ^ (h >> 13)
	h = (h * 1274126177) & 0xFFFFFFFF
	h = h ^ (h >> 16)
	return float(h) / 4294967296.0


static func _roll(b: Dictionary, salt: String) -> float:
	b.n = int(b.get("n", 0)) + 1
	return _hash(String(b.get("seed", "")), salt + "#" + str(b.n))


static func foe_arms(seed: String, foes: Array) -> Dictionary:
	var out := {}
	for i in foes.size():
		var first := mini(2, int(floor(_hash(seed, "ma%d" % i) * 3.0)))
		var second := (first + 1 + int(floor(_hash(seed, "mb%d" % i) * 2.0))) % 3
		out[String(foes[i])] = [ARMS[first], ARMS[second]]
	return out


static func _dist(a: Dictionary, b: Dictionary) -> int:
	return absi(int(a.x) - int(b.x)) + absi(int(a.y) - int(b.y))


static func _unit(b: Dictionary, uid: String) -> Dictionary:
	for u: Dictionary in b.get("units", []):
		if String(u.get("uid", "")) == uid: return u
	return {}


static func _free(b: Dictionary, x: int, y: int) -> bool:
	var cols := int(b.cols)
	var rows := int(b.rows)
	if x < 0 or y < 0 or x >= cols or y >= rows: return false
	var cell := String(b.cells[y * cols + x])
	if cell in ["river", "wall", "gate"]: return false
	for u: Dictionary in b.units:
		if float(u.get("hp", 0.0)) > 0.0 and int(u.get("x", -1)) == x and int(u.get("y", -1)) == y: return false
	return true


static func _spot(b: Dictionary, officer: Dictionary) -> Vector2i:
	var best := Vector2i(-1, -1)
	var best_score := 1.0e9
	var toward_mid := -1 if String(officer.side) == "me" else 1
	for y in int(b.rows):
		for x in int(b.cols):
			if not _free(b, x, y): continue
			var dx := x - int(officer.x)
			var score := float(absi(dx) + absi(y - int(officer.y)))
			if dx * toward_mid > 0: score += 0.3
			if dx == 0: score += 0.1
			if score < best_score:
				best_score = score
				best = Vector2i(x, y)
	return best


static func _make_merc(b: Dictionary, officer: Dictionary, index: int, arm: String, hp: int) -> Dictionary:
	var at := _spot(b, officer)
	if at.x < 0: return {}
	var merc := {"uid":"%s:merc:%s#%d" % [String(officer.side), String(officer.id), index], "id":"", "kind":"troop", "merc":true,
		"cmd":String(officer.uid), "side":String(officer.side), "hp":float(hp), "max":float(hp), "atk":9.0, "def":1.0, "mov":2, "rng":1,
		"x":at.x, "y":at.y, "moved":false, "acted":false, "fx":int(officer.get("fx", 1)), "fy":0, "arm":arm, "fled":false}
	match arm:
		"cav": merc.mov = 3
		"bow": merc.rng = 2
		"spear": merc.def = float(merc.def) + 2.0
	return merc


static func setup(b: Dictionary, stats: Dictionary, my_troops: Array, foe_troops: Array, state: Dictionary, merc_n: int, merc_mul: float = 1.2) -> void:
	if not bool(b.get("srpg", false)): return
	var seed := String(b.get("seed", ""))
	var foe_ids: Array[String] = []
	for u: Dictionary in b.units:
		if String(u.get("side", "")) == "foe" and String(u.get("kind", "")) == "officer": foe_ids.append(String(u.id))
	var foe_choice := foe_arms(seed, foe_ids)
	for side in ["me", "foe"]:
		var officers: Array = []
		for u: Dictionary in b.units:
			if String(u.get("side", "")) == String(side) and String(u.get("kind", "")) == "officer": officers.append(u)
		if officers.is_empty(): continue
		var pool: Array = my_troops if String(side) == "me" else foe_troops
		var total := 0
		for amount_v: Variant in pool: total += maxi(0, int(amount_v))
		if total <= 0: total = 3000 * officers.size()
		var hp := clampi(int(floor(18.0 + float(total) / float(officers.size() * PER) / 50.0 + 0.5)), 20, 60)
		if String(side) == "me": hp = int(floor(float(hp) * merc_mul + 0.5))
		var retained: Array = []
		for u: Dictionary in b.units:
			if not (String(u.get("side", "")) == String(side) and String(u.get("kind", "")) == "troop"): retained.append(u)
		b.units = retained
		for i in officers.size():
			var officer: Dictionary = officers[i]
			var st: Dictionary = stats.get(String(officer.id), {})
			var command := float(st.get("command", 60))
			officer.cmdR = 2 + int(floor(command / 45.0))
			officer.cmdA = int(floor(6.0 + command / 10.0 + 0.5))
			officer.squad = i + 1
			var arms: Array = arms_for(String(officer.id), i, state, merc_n) if String(side) == "me" else (foe_choice.get(String(officer.id), ["spear", "cav"]) as Array)
			for k in mini(merc_n if String(side) == "me" else PER, arms.size()):
				var merc := _make_merc(b, officer, k, String(arms[k]), hp)
				if not merc.is_empty(): merc.squad = i + 1; b.units.append(merc)
	b.command = true


## G-0420 — an officer joining mid-battle receives their own commander stats and squad.
static func squad(b: Dictionary, officer: Dictionary, arms: Array, hp: int) -> Array:
	var command_stats: Dictionary = b.get("battle_stats", {}).get(String(officer.get("id", "")), {})
	var command := float(command_stats.get("command", 60.0))
	officer.cmdR = 2 + int(floor(command / 45.0))
	officer.cmdA = int(floor(6.0 + command / 10.0 + 0.5))
	officer.squad = 1
	for unit: Dictionary in b.units:
		if String(unit.get("side", "")) == String(officer.get("side", "")) and String(unit.get("kind", "")) == "officer": officer.squad = maxi(int(officer.squad), int(unit.get("squad", 0)) + 1)
	var made: Array = []
	var index := 0
	for unit: Dictionary in b.units:
		if String(unit.get("cmd", "")) == String(officer.get("uid", "")): index += 1
	for arm_v: Variant in arms:
		var arm := String(arm_v)
		if not ARMS.has(arm): arm = "spear"
		var merc := _make_merc(b, officer, index, arm, maxi(1, hp))
		index += 1
		if merc.is_empty(): continue
		merc.squad = int(officer.squad)
		b.units.append(merc)
		made.append(merc)
	return made


static func commander(b: Dictionary, u: Dictionary) -> Dictionary:
	if u.is_empty(): return {}
	if String(u.get("kind", "")) == "officer" and u.has("cmdR"): return u
	if bool(u.get("merc", false)): return _unit(b, String(u.get("cmd", "")))
	return {}


static func in_command(b: Dictionary, u: Dictionary) -> bool:
	var boss := commander(b, u)
	return not boss.is_empty() and float(boss.get("hp", 0.0)) > 0.0 and _dist(boss, u) <= int(boss.get("cmdR", 0))


static func range(b: Dictionary, uid: String) -> Dictionary:
	var out := {}
	var u := _unit(b, uid)
	var boss := commander(b, u)
	if boss.is_empty() or float(boss.get("hp", 0.0)) <= 0.0: return out
	for y in int(b.rows):
		for x in int(b.cols):
			if absi(x - int(boss.x)) + absi(y - int(boss.y)) <= int(boss.cmdR): out["%d,%d" % [x, y]] = true
	return out


static func hit_mods(b: Dictionary, att: Dictionary, tgt: Dictionary, out: Array) -> void:
	if not bool(b.get("command", false)): return
	if bool(att.get("merc", false)) and in_command(b, att):
		var a_boss := commander(b, att)
		out.append(["지휘", int(a_boss.cmdA)])
	if bool(tgt.get("merc", false)) and in_command(b, tgt):
		var t_boss := commander(b, tgt)
		out.append(["지휘", -int(t_boss.cmdA)])


static func counter(b: Dictionary, a: Dictionary, t: Dictionary, chance: int, damage_mul: float) -> Dictionary:
	if not bool(b.get("command", false)) or float(t.get("hp", 0.0)) <= 0.0 or float(a.get("hp", 0.0)) <= 0.0 or bool(t.get("confused", false)) or _dist(a, t) != 1 or bool(a.get("noCounter", false)):
		return {}
	var skill: Dictionary = t.get("skill", {})
	if String(skill.get("key", "")) == "bangyeok": return {}
	var hit := _roll(b, "ct") * 100.0 < float(chance)
	var dmg := 0
	if hit:
		dmg = maxi(1, int(floor(float(t.atk) * damage_mul * COUNTER_MUL * (0.8 + _roll(b, "cd") * 0.4) + 0.5)))
		a.hp = maxf(0.0, float(a.hp) - float(dmg))
	(b.log as Array).append({"t":int(b.turn), "a":String(t.uid), "to":String(a.uid), "hit":hit, "dmg":dmg, "ch":chance, "counter":true})
	return {"hit":hit, "dmg":dmg, "killed":float(a.hp) <= 0.0}


static func sweep(b: Dictionary) -> void:
	if not bool(b.get("command", false)): return
	if not b.has("fled"): b.fled = []
	for merc: Dictionary in b.units:
		if not bool(merc.get("merc", false)) or float(merc.get("hp", 0.0)) <= 0.0: continue
		var boss := _unit(b, String(merc.get("cmd", "")))
		if not boss.is_empty() and float(boss.get("hp", 0.0)) <= 0.0:
			merc.hp = 0.0
			merc.fled = true
			(b.fled as Array).append(String(merc.uid))
			(b.log as Array).append({"t":int(b.turn), "to":String(merc.uid), "fled":true})


static func turn_start(b: Dictionary) -> void:
	if not bool(b.get("command", false)): return
	for merc: Dictionary in b.units:
		if not bool(merc.get("merc", false)) or float(merc.get("hp", 0.0)) <= 0.0: continue
		var boss := commander(b, merc)
		if not boss.is_empty() and _dist(boss, merc) == 1: merc.hp = minf(float(merc.max), float(merc.hp) + roundi(float(merc.max) * RESUPPLY))


static func unacted_mercs(b: Dictionary) -> Array:
	if not bool(b.get("command", false)) or String(b.get("done", "")) != "": return []
	return (b.units as Array).filter(func(u: Dictionary) -> bool: return bool(u.get("merc", false)) and String(u.get("side", "")) == String(b.get("side", "")) and float(u.get("hp", 0.0)) > 0.0 and not bool(u.get("moved", false)) and not bool(u.get("acted", false)))
