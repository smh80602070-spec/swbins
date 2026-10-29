extends RefCounted

## G-0416 — 5천하 장 진행 전용 장비 3칸(웹 W-0453 표·수치).
const GRADES := [
	{"key":"n", "name":"일반", "prefix":"낡은", "mul":1.0}, {"key":"u", "name":"고급", "prefix":"단단한", "mul":1.7},
	{"key":"r", "name":"희귀", "prefix":"명장의", "mul":2.5}, {"key":"e", "name":"영웅", "prefix":"용장의", "mul":3.5}, {"key":"l", "name":"전설", "prefix":"천하의", "mul":5.0}
]
const KINDS := [
	{"key":"sword", "slot":"w", "name":"검", "emoji":"🗡️", "atk":2.6}, {"key":"spear", "slot":"w", "name":"창", "emoji":"🔱", "atk":3.0}, {"key":"blade", "slot":"w", "name":"대도", "emoji":"⚔️", "atk":3.6, "hit":-2}, {"key":"bow", "slot":"w", "name":"활", "emoji":"🏹", "atk":2.0, "hit":3},
	{"key":"hide", "slot":"a", "name":"가죽 갑옷", "emoji":"🦺", "def":4, "hp":4}, {"key":"scale", "slot":"a", "name":"비늘 갑옷", "emoji":"🛡️", "def":5, "hp":6}, {"key":"plate", "slot":"a", "name":"판갑", "emoji":"🪖", "def":6.5, "hp":3}, {"key":"robe", "slot":"a", "name":"비단 전포", "emoji":"👘", "def":2.5, "hp":9},
	{"key":"stirrup", "slot":"c", "name":"등자", "emoji":"🐎", "mov":1, "hp":2}, {"key":"feather", "slot":"c", "name":"매 깃", "emoji":"🪶", "hit":3}, {"key":"charm", "slot":"c", "name":"호부", "emoji":"🧧", "crit":4}, {"key":"belt", "slot":"c", "name":"옥 띠", "emoji":"💠", "hp":7}
]
const SLOT_NAMES := {"w":"무기", "a":"방어구", "c":"장신구"}
const GRADE_COLORS := [Color("#c9c2ad"), Color("#7fd06a"), Color("#5fb0ff"), Color("#c07bff"), Color("#ffb340")]

static func items() -> Array:
	var out: Array = []
	for kind: Dictionary in KINDS:
		for grade in GRADES.size():
			var g: Dictionary = GRADES[grade]
			var it := {"id":"gr_%s_%s" % [kind.key, g.key], "kind":kind.key, "slot":kind.slot, "grade":grade, "name":"%s %s" % [g.prefix, kind.name], "emoji":kind.emoji, "atk":roundi(float(kind.get("atk", 0)) * float(g.mul)), "def":roundi(float(kind.get("def", 0)) * float(g.mul)), "hp":roundi(float(kind.get("hp", 0)) * float(g.mul)), "hit":roundi(float(kind.get("hit", 0)) * float(g.mul)), "crit":roundi(float(kind.get("crit", 0)) * float(g.mul)), "mov":int(kind.get("mov", 0)) if grade >= 2 else 0}
			out.append(it)
	return out

static func item(id: String) -> Dictionary:
	for it: Dictionary in items():
		if String(it.id) == id: return it
	return {}

static func price(it: Dictionary) -> int:
	return [80, 170, 340, 620, 1100][clampi(int(it.get("grade", 0)), 0, 4)] if not it.is_empty() else 0

static func line_of(it: Dictionary) -> String:
	var parts: Array[String] = []
	if int(it.get("atk", 0)) != 0: parts.append("공 %+d" % int(it.atk))
	if int(it.get("def", 0)) != 0: parts.append("받는 피해 −%d%%" % int(it.def))
	if int(it.get("hp", 0)) != 0: parts.append("체력 +%d" % int(it.hp))
	if int(it.get("hit", 0)) != 0: parts.append("명중 %+d%%p" % int(it.hit))
	if int(it.get("crit", 0)) != 0: parts.append("치명 %d%%" % int(it.crit))
	if int(it.get("mov", 0)) != 0: parts.append("이동 +1")
	return " · ".join(parts)

static func top_grade(ch: int, round: int) -> int:
	return mini(4, (4 if ch >= 13 else (3 if ch >= 8 else (2 if ch >= 4 else 1))) + (1 if round > 0 else 0))

static func _hash_s(value: String) -> int:
	var h: int = 2166136261
	for byte: int in value.to_utf8_buffer(): h = int(((h ^ byte) * 16777619) & 0xffffffff)
	return h

static func stock(ch: int, round: int) -> Array:
	var all := items(); var chosen: Dictionary = {}
	for k in 9:
		var kind: Dictionary = KINDS[_hash_s("st%d:%d:%d" % [ch, round, k]) % KINDS.size()]
		var grade := maxi(0, top_grade(ch, round) - (_hash_s("sg%d%d" % [ch, k]) % 3))
		var key := "gr_%s_%s" % [kind.key, GRADES[grade].key]
		if not chosen.has(key):
			for it: Dictionary in all:
				if String(it.id) == key: chosen[key] = it
	var out: Array = chosen.values()
	out.sort_custom(func(a: Dictionary, b: Dictionary) -> bool: return String(a.slot) < String(b.slot) or (String(a.slot) == String(b.slot) and int(a.grade) > int(b.grade)))
	return out

static func drop(ch: int, salt: String, round: int) -> Dictionary:
	var h := _hash_s("dr%d:%s" % [ch, salt])
	var kind: Dictionary = KINDS[h % KINDS.size()]
	var roll := (h >> 8) % 100
	var top := top_grade(ch, round)
	var grade := mini(4, top + 1) if roll < 8 else (top if roll < 45 else maxi(0, top - 1))
	var id := "gr_%s_%s" % [kind.key, GRADES[grade].key]
	return item(id)

static func apply(u: Dictionary, S: Object = null) -> Dictionary:
	if String(u.get("kind", "")) != "officer" or String(u.get("side", "")) != "me": return u
	var owner: Object = S
	if owner == null:
		var tree := Engine.get_main_loop() as SceneTree
		owner = tree.root.get_node_or_null("RealmSaveState") if tree != null else null
	if owner == null: return u
	var cp: Dictionary = owner.get("campaign")
	var slots: Dictionary = cp.get("gear", {}).get(String(u.get("id", "")), {})
	for slot: String in ["w", "a", "c"]:
		var it := item(String(slots.get(slot, "")))
		if it.is_empty(): continue
		u.atk = float(u.atk) + int(it.atk)
		u.max = float(u.max) + int(it.hp); u.hp = float(u.hp) + int(it.hp)
		u.mov = int(u.mov) + int(it.mov)
		u.gearDef = int(u.get("gearDef", 0)) + int(it.def); u.gearHit = int(u.get("gearHit", 0)) + int(it.hit); u.gearCrit = int(u.get("gearCrit", 0)) + int(it.crit)
	return u
