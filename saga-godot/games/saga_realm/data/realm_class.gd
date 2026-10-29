extends RefCounted

## G-0419 — W-0457 campaign class changes. Class choices live in the existing
## campaign save dictionary, so older saves receive an empty choice map.
const LV1 := 5
const LV2 := 12
const T2 := ["overlord", "bulwark", "raider", "marshal", "sage", "healer"]
const T1 := ["brave", "rider", "tactic"]
const CLS := {
	"brave": {"name":"맹장", "emoji":"🪓", "fav":"spear", "desc":"공 +4 · 체력 +15 · 창병 덤", "fx":{"atk":4, "hp":15}},
	"rider": {"name":"기장", "emoji":"🐎", "fav":"cav", "desc":"이동 +1 · 뒤치기 명중 +10%p · 기병 덤", "fx":{"mov":1, "back":10}},
	"tactic": {"name":"군사", "emoji":"📜", "fav":"bow", "desc":"사거리 2 이상 · 책략 +1 · 궁병 덤", "fx":{"rng2":1, "plots":1}},
	"overlord": {"name":"패왕", "emoji":"👹", "fav":"spear", "desc":"공 +6 · 체력 +25 · 필살 피해 ×1.3", "fx":{"atk":6, "hp":25, "ultMul":1.3}, "from":"brave"},
	"bulwark": {"name":"철벽장", "emoji":"🛡️", "fav":"spear", "desc":"방 +4 · 적 명중 −8%p · 휘하 체력 +25%", "fx":{"def":4, "guard":8, "mercHp":0.25}, "from":"brave"},
	"raider": {"name":"비장", "emoji":"🦅", "fav":"cav", "desc":"이동 +1 · 뒤치기 +10%p · 원거리 공격에 반격 안 받음", "fx":{"mov":1, "back":10, "noCounter":1}, "from":"rider"},
	"marshal": {"name":"대장군", "emoji":"🚩", "fav":"cav", "desc":"지휘 +1칸 · 지휘 명중 +5%p · 휘하 기병 이동 +1", "fx":{"cmdR":1, "cmdA":5, "cavMov":1}, "from":"rider"},
	"sage": {"name":"귀모", "emoji":"🌀", "fav":"bow", "desc":"사거리 2 이상 · 책략 +1 · 천뢰 ×1.3·4칸", "fx":{"rng2":1, "plots":1, "boltMul":1.3, "boltR":4}, "from":"tactic"},
	"healer": {"name":"현자", "emoji":"🌿", "fav":"bow", "desc":"사거리 2 이상 · 턴마다 곁 아군 +12 · 회복 ×1.5", "fx":{"rng2":1, "plots":1, "aura":12, "healMul":1.5}, "from":"tactic"}
}

static func choices(lv: int, cur: String) -> Array:
	if cur == "": return T1.duplicate() if lv >= LV1 else []
	if T1.has(cur) and lv >= LV2:
		var out: Array = []
		for k: String in CLS:
			if String(CLS[k].get("from", "")) == cur: out.append(k)
		return out
	if T2.has(cur): return []
	return []

static func line(key: String) -> String:
	var d: Dictionary = CLS.get(key, {})
	return "%s %s — %s" % [String(d.get("emoji", "")), String(d.get("name", "")), String(d.get("desc", ""))] if not d.is_empty() else "직업 없음"

static func _effects(key: String) -> Dictionary:
	var d: Dictionary = CLS.get(key, {})
	if d.is_empty(): return {}
	var result: Dictionary = {}
	var parent_key := String(d.get("from", ""))
	if parent_key != "": result = _effects(parent_key)
	for field: String in d.get("fx", {}):
		var value: Variant = d.fx[field]
		if value is int or value is float:
			if field in ["ultMul", "boltMul", "healMul"]: result[field] = float(value)
			else: result[field] = float(result.get(field, 0)) + float(value)
		else: result[field] = value
	return result

static func foe_class(seed: String, id: String, tier: float) -> String:
	if tier < 0.3: return ""
	var h := hash(seed + "|" + id) & 0x7fffffff
	var first := String(T1[h % 3])
	if tier < 0.6: return first
	var next: Array = []
	for k: String in CLS:
		if String(CLS[k].get("from", "")) == first: next.append(k)
	return String(next[(h >> 3) % next.size()]) if not next.is_empty() else first

static func apply(b: Dictionary, classes: Dictionary) -> void:
	var plots := 0
	for u: Dictionary in b.units:
		if String(u.get("kind", "")) != "officer": continue
		var key := String(classes.get(String(u.get("id", "")), ""))
		if not CLS.has(key): continue
		var d: Dictionary = CLS[key]
		var fx := _effects(key)
		u.cls = key
		u.atk = int(u.atk) + int(fx.get("atk", 0))
		u.def = int(u.def) + int(fx.get("def", 0))
		u.mov = int(u.mov) + int(fx.get("mov", 0))
		var hp_add := int(fx.get("hp", 0))
		u.hp = float(u.hp) + hp_add
		u.max = float(u.max) + hp_add
		if int(fx.get("rng2", 0)) > 0: u.rng = maxi(2, int(u.rng))
		if int(fx.get("cmdR", 0)) > 0:
			u.cmdR = int(u.get("cmdR", 0)) + int(fx.cmdR)
			u.cmdA = int(u.get("cmdA", 0)) + int(fx.get("cmdA", 0))
		for field: String in ["back", "guard", "ultMul", "boltMul", "boltR", "aura", "healMul", "noCounter"]:
			if fx.has(field): u[field] = fx[field]
		if String(u.side) == "me": plots += int(fx.get("plots", 0))
		for m: Dictionary in b.units:
			if String(m.get("cmd", "")) != String(u.uid): continue
			var arm := String(m.get("arm", ""))
			var mul := 1.0 + (0.2 if arm == String(d.fav) else 0.0) + float(fx.get("mercHp", 0.0))
			m.max = roundi(float(m.max) * mul)
			m.hp = roundi(float(m.hp) * mul)
			if arm == String(d.fav): m.atk = int(m.atk) + 1
			if arm == "cav": m.mov = int(m.mov) + int(fx.get("cavMov", 0))
	if plots > 0: b.plots = int(b.get("plots", 0)) + plots

static func turn_start(b: Dictionary) -> void:
	for u: Dictionary in b.units:
		var aura := int(u.get("aura", 0))
		if aura <= 0 or float(u.hp) <= 0.0: continue
		for ally: Dictionary in b.units:
			if ally == u or String(ally.side) != String(u.side) or float(ally.hp) <= 0.0: continue
			if abs(int(ally.x) - int(u.x)) + abs(int(ally.y) - int(u.y)) == 1:
				ally.hp = minf(float(ally.max), float(ally.hp) + aura)

static func mods(_b: Dictionary, att: Dictionary, tgt: Dictionary, out: Array) -> void:
	var dx := int(att.x) - int(tgt.x)
	var dy := int(att.y) - int(tgt.y)
	var is_back := dx * int(tgt.get("fx", 0)) + dy * int(tgt.get("fy", 0)) < 0
	if int(att.get("back", 0)) > 0 and is_back: out.append([String(CLS.get(String(att.get("cls", "")), {}).get("name", "뒤치기")), int(att.back)])
	if int(tgt.get("guard", 0)) > 0: out.append([String(CLS.get(String(tgt.get("cls", "")), {}).get("name", "철벽")), -int(tgt.guard)])
