extends RefCounted

## W-0456 — campaign SRPG ultimate rules. The legacy non-campaign board stays untouched.
const FULL := 100
const ATTACK_GAIN := 30
const HIT_GAIN := 20
const LOSS_GAIN := 20
const BOLT_RANGE := 3
const RALLY_HEAL := 0.4
const RALLY_HIT := 25
const KIND_NAME := {"musang": "무쌍", "cheonroe": "천뢰", "chonggong": "총공격"}
const KIND_ICON := {"musang": "⚔", "cheonroe": "⚡", "chonggong": "🚩"}


static func kind_of(u: Dictionary) -> String:
	if String(u.get("kind", "")) != "officer": return ""
	var group := String(u.get("skill", {}).get("group", ""))
	if group == "":
		var might := (float(u.get("atk", 10.0)) - 10.0) * 5.0
		var wisdom := float(u.get("wis", 0.0))
		group = "wisdom" if wisdom >= might else "might"
	return "cheonroe" if group == "wisdom" else ("chonggong" if group == "command" else "musang")


static func gauge(u: Dictionary) -> int:
	if not u.has("sp"):
		u.sp = 30 if String(u.get("side", "")) == "me" else 0
	return int(u.sp)


static func _unit(b: Dictionary, uid: String) -> Dictionary:
	for u: Dictionary in b.get("units", []):
		if String(u.get("uid", "")) == uid: return u
	return {}


static func _foes(b: Dictionary, u: Dictionary) -> Array:
	var side := "foe" if String(u.get("side", "")) == "me" else "me"
	return (b.get("units", []) as Array).filter(func(t: Dictionary) -> bool: return String(t.get("side", "")) == side and float(t.get("hp", 0.0)) > 0.0)


static func ready(b: Dictionary, uid: String) -> bool:
	var u := _unit(b, uid)
	return bool(b.get("campaign", false)) and bool(b.get("srpg", false)) and not u.is_empty() and String(u.get("kind", "")) == "officer" and float(u.get("hp", 0.0)) > 0.0 and not bool(u.get("acted", false)) and String(b.get("done", "")) == "" and String(u.get("side", "")) == String(b.get("side", "")) and gauge(u) >= FULL


static func cells(b: Dictionary, uid: String) -> Array:
	if not ready(b, uid): return []
	var u := _unit(b, uid)
	var kind := kind_of(u)
	var out: Array = []
	if kind == "musang":
		for t: Dictionary in _foes(b, u):
			if absi(int(t.x) - int(u.x)) + absi(int(t.y) - int(u.y)) <= int(u.get("rng", 1)):
				out.append(Vector2i(int(t.x), int(t.y)))
	elif kind == "cheonroe":
		for y in int(b.get("rows", 0)):
			for x in int(b.get("cols", 0)):
				if absi(x - int(u.x)) + absi(y - int(u.y)) <= int(u.get("boltR", BOLT_RANGE)):
					out.append(Vector2i(x, y))
	else:
		out.append(Vector2i(int(u.x), int(u.y)))
	return out


static func _append_hit(b: Dictionary, a: Dictionary, t: Dictionary, damage: int, kind: String, hits: Array) -> void:
	t.hp = maxf(0.0, float(t.hp) - float(damage))
	var entry := {"t": int(b.get("turn", 1)), "a": String(a.uid), "to": String(t.uid), "hit": true, "dmg": damage, "ch": 100, "ult": kind}
	(b.log as Array).append(entry)
	hits.append({"uid": String(t.uid), "dmg": damage, "killed": float(t.hp) <= 0.0})


static func use(b: Dictionary, uid: String, cell: Vector2i) -> Dictionary:
	if not cells(b, uid).has(cell): return {"ok": false}
	var u := _unit(b, uid)
	var kind := kind_of(u)
	var hits: Array = []
	var heal := 0
	var foes := _foes(b, u)
	if kind == "musang":
		var target: Dictionary = foes.filter(func(t: Dictionary) -> bool: return int(t.x) == cell.x and int(t.y) == cell.y)[0]
		var base := maxi(1, roundi(float(u.atk) * 2.0 * float(u.get("ultMul", 1.0))))
		_append_hit(b, u, target, base * 2, kind, hits)
		for other: Dictionary in foes:
			if other != target and absi(int(other.x) - cell.x) + absi(int(other.y) - cell.y) == 1:
				_append_hit(b, u, other, roundi(float(base) * 0.5), kind, hits)
	elif kind == "cheonroe":
		var bolt := maxi(1, roundi((14.0 + float(u.get("wis", 0.0)) / 4.0) * 2.0 * float(u.get("boltMul", 1.0)) * float(u.get("ultMul", 1.0))))
		for target: Dictionary in foes:
			if absi(int(target.x) - cell.x) + absi(int(target.y) - cell.y) <= 1:
				_append_hit(b, u, target, bolt, kind, hits)
	else:
		var radius := int(u.get("cmdR", 3))
		for ally: Dictionary in b.get("units", []):
			if String(ally.get("side", "")) != String(u.side) or float(ally.get("hp", 0.0)) <= 0.0 or String(ally.get("kind", "")) != "troop": continue
			if absi(int(ally.x) - int(u.x)) + absi(int(ally.y) - int(u.y)) > radius: continue
			var healed := mini(int(ally.max - ally.hp), roundi(float(ally.max) * RALLY_HEAL))
			ally.hp = float(ally.hp) + float(healed)
			ally.rallyT = int(b.get("turn", 1))
			heal += healed
			hits.append({"uid": String(ally.uid), "dmg": -healed, "killed": false})
	u.sp = 0
	u.acted = true
	u.moved = true
	var record := {"t": int(b.get("turn", 1)), "a": uid, "kind": kind, "name": String(KIND_NAME[kind]), "x": cell.x, "y": cell.y, "hits": hits, "heal": heal}
	var history: Array = b.get("ultLog", [])
	history.append(record)
	b.ultLog = history
	return {"ok": true, "kind": kind, "name": String(KIND_NAME[kind]), "hits": hits, "heal": heal}


static func charge(u: Dictionary, amount: int) -> void:
	if String(u.get("kind", "")) != "officer" or float(u.get("hp", 0.0)) <= 0.0: return
	var multiplier := 1.0 if String(u.get("side", "")) == "me" else 0.75
	u.sp = mini(FULL, gauge(u) + roundi(float(amount) * multiplier))


static func on_attack(b: Dictionary, attacker: Dictionary, target: Dictionary, hit: bool) -> void:
	if not bool(b.get("campaign", false)) or not bool(b.get("srpg", false)): return
	charge(attacker, ATTACK_GAIN)
	if hit: charge(target, HIT_GAIN)
	if float(target.get("hp", 0.0)) <= 0.0 and bool(target.get("merc", false)):
		var leader := _unit(b, String(target.get("cmd", "")))
		charge(leader, LOSS_GAIN)


static func mods(b: Dictionary, attacker: Dictionary, _target: Dictionary, out: Array) -> void:
	if attacker.has("rallyT") and int(attacker.rallyT) == int(b.get("turn", 1)):
		out.append(["총공격", RALLY_HIT])


static func ai(b: Dictionary, u: Dictionary) -> bool:
	if not ready(b, String(u.get("uid", ""))): return false
	var kind := kind_of(u)
	var choices := cells(b, String(u.uid))
	var best := Vector2i(-1, -1)
	var best_score := 0.0
	for cell: Vector2i in choices:
		var score := 0.0
		if kind == "musang":
			for foe: Dictionary in _foes(b, u):
				if int(foe.x) == cell.x and int(foe.y) == cell.y: score += 3.0 if String(foe.kind) == "officer" else 2.0
				elif absi(int(foe.x) - cell.x) + absi(int(foe.y) - cell.y) == 1: score += 1.0
		elif kind == "cheonroe":
			for foe: Dictionary in _foes(b, u):
				if absi(int(foe.x) - cell.x) + absi(int(foe.y) - cell.y) <= 1: score += 1.5 if String(foe.kind) == "officer" else 1.0
			if score < 2.0: score = 0.0
		else:
			for ally: Dictionary in b.get("units", []):
				if String(ally.get("side", "")) == String(u.side) and String(ally.get("kind", "")) == "troop" and float(ally.get("hp", 0.0)) > 0.0 and absi(int(ally.x) - int(u.x)) + absi(int(ally.y) - int(u.y)) <= int(u.get("cmdR", 3)): score += 1.0
			if score < 2.0: score = 0.0
		if score > best_score:
			best_score = score
			best = cell
	return bool(use(b, String(u.uid), best).get("ok", false)) if best_score > 0.0 else false
