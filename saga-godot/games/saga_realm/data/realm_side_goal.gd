extends RefCounted

## G-0422 — W-0460 treasure chests and villages on campaign battle boards.
const GOLD := {"chest":70, "village":40, "all_villages":120}
const CHEST_GEAR := 3
const LURE_RADIUS := 5
const ICON := {"chest":"📦", "open":"✨", "village":"🏘️", "burnt":"🔥"}

static func _hash01(seed: String, salt: String) -> float:
	var h := 2166136261
	var value := seed + "|" + salt
	for i in value.length():
		h = h ^ value.unicode_at(i)
		h = (h * 16777619) & 0xffffffff
	h = h ^ (h >> 13)
	h = (h * 1274126177) & 0xffffffff
	h = h ^ (h >> 16)
	return float(h) / 4294967296.0

static func _cell(b: Dictionary, x: int, y: int) -> String:
	var cols := int(b.get("cols", 0)); var rows := int(b.get("rows", 0))
	if x < 0 or y < 0 or x >= cols or y >= rows: return ""
	return String((b.get("cells", []) as Array)[y * cols + x])

static func _free(b: Dictionary, x: int, y: int) -> bool:
	var cell := _cell(b, x, y)
	if cell not in ["plain", "forest", "hill"]: return false
	for unit: Dictionary in b.get("units", []):
		if float(unit.get("hp", 0.0)) > 0.0 and int(unit.get("x", -1)) == x and int(unit.get("y", -1)) == y: return false
	return true

static func _place(b: Dictionary, count: int, x0: int, x1: int, salt: String, taken: Dictionary) -> Array:
	var out: Array = []
	for attempt in 200:
		if out.size() >= count: break
		var x := x0 + int(floor(_hash01(String(b.seed), salt + "x" + str(attempt)) * float(x1 - x0 + 1)))
		var y := int(floor(_hash01(String(b.seed), salt + "y" + str(attempt)) * float(b.rows)))
		var key := "%d,%d" % [x, y]
		if bool(taken.get(key, false)) or not _free(b, x, y): continue
		var far := true
		for prior: Dictionary in out:
			if absi(int(prior.x) - x) + absi(int(prior.y) - y) < 3: far = false; break
		if not far: continue
		taken[key] = true
		out.append({"x":x, "y":y})
	return out

static func setup(b: Dictionary, events: Dictionary) -> void:
	b.sg = null
	var side: Dictionary = events.get("side", {})
	if not bool(b.get("campaign", false)) or not bool(b.get("srpg", false)) or side.is_empty(): return
	var middle := int(floor(float(b.cols) * 0.5))
	var taken := {}
	var chests: Array = _place(b, int(side.get("chests", 0)), middle, int(b.cols) - 3, "side-chest-", taken)
	var villages: Array = _place(b, int(side.get("villages", 0)), maxi(0, middle - 1), middle, "side-village-", taken)
	for chest: Dictionary in chests: chest.got = false
	for village: Dictionary in villages: village.burnt = false
	b.sg = {"chests":chests, "villages":villages, "loot":0}

static func _near(b: Dictionary, point: Dictionary, side: String) -> bool:
	for unit: Dictionary in b.get("units", []):
		if float(unit.get("hp", 0.0)) <= 0.0 or String(unit.get("side", "")) != side: continue
		if absi(int(unit.x) - int(point.x)) + absi(int(unit.y) - int(point.y)) <= 1: return true
	return false

static func _note(b: Dictionary, kind: String, line: String) -> void:
	(b.evLog as Array).append({"t":int(b.get("turn", 1)), "kind":kind, "who":"", "side":"", "speaker":"", "text":line})

static func scan(b: Dictionary) -> void:
	var side: Variant = b.get("sg", null)
	if not side is Dictionary: return
	for chest: Dictionary in side.chests:
		if bool(chest.get("got", false)): continue
		for unit: Dictionary in b.units:
			if float(unit.get("hp", 0.0)) > 0.0 and String(unit.get("side", "")) == "me" and int(unit.x) == int(chest.x) and int(unit.y) == int(chest.y):
				chest.got = true
				side.loot = int(side.loot) + 1
				_note(b, "loot", "보물 상자: 「금 %d을 챙겼다!」" % int(GOLD.chest))
				break

static func foe_turn_end(b: Dictionary) -> void:
	var side: Variant = b.get("sg", null)
	if not side is Dictionary: return
	for village: Dictionary in side.villages:
		if not bool(village.get("burnt", false)) and _near(b, village, "foe") and not _near(b, village, "me"):
			village.burnt = true
			_note(b, "burn", "마을 사람들: 「마을이… 마을이 불탄다!」")

## The closest eligible enemy troop in range is drawn toward an unguarded village.
static func lure(b: Dictionary, u: Dictionary) -> Dictionary:
	var side: Variant = b.get("sg", null)
	if not side is Dictionary or String(u.get("side", "")) != "foe" or String(u.get("kind", "")) != "troop": return {}
	var best := {}
	var best_distance := LURE_RADIUS + 1
	for village: Dictionary in side.villages:
		if bool(village.get("burnt", false)) or _near(b, village, "me"): continue
		var distance := absi(int(u.x) - int(village.x)) + absi(int(u.y) - int(village.y))
		if distance > LURE_RADIUS or distance >= best_distance: continue
		var closer := false
		for other: Dictionary in b.get("units", []):
			if other == u or float(other.get("hp", 0.0)) <= 0.0 or String(other.get("side", "")) != "foe" or String(other.get("kind", "")) != "troop": continue
			var other_distance := absi(int(other.x) - int(village.x)) + absi(int(other.y) - int(village.y))
			if other_distance < distance:
				closer = true
				break
		if not closer:
			best = {"x":int(village.x), "y":int(village.y), "village":true}
			best_distance = distance
	return best

static func result(b: Dictionary) -> Dictionary:
	var side: Variant = b.get("sg", null)
	if not side is Dictionary: return {}
	var kept := 0
	for village: Dictionary in side.villages:
		if not bool(village.get("burnt", false)): kept += 1
	return {"loot":int(side.loot), "chests":side.chests.size(), "kept":kept, "total":side.villages.size()}

static func cells(b: Dictionary) -> Dictionary:
	var out := {}
	var side: Variant = b.get("sg", null)
	if not side is Dictionary: return out
	for chest: Dictionary in side.chests: out["%d,%d" % [int(chest.x), int(chest.y)]] = "open" if bool(chest.got) else "chest"
	for village: Dictionary in side.villages: out["%d,%d" % [int(village.x), int(village.y)]] = "burnt" if bool(village.burnt) else "village"
	return out
