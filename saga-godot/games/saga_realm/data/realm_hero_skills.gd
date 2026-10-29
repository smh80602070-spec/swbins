extends RefCounted

## G-0416 — 캠페인 전술판 장수별 결정적 고유 기술(W-0453 수치).
const Characters := preload("res://saga_core/data/characters.gd")
const Tactics := preload("res://games/saga_realm/data/realm_tactics.gd")
const SKILLS := {
	"ilgyeok": {"name":"일격", "group":"might", "p":22, "desc":"공격 22% 확률로 피해 1.6배"},
	"yeongyeok": {"name":"연격", "group":"might", "p":28, "desc":"공격 뒤 28% 확률로 한 번 더 친다"},
	"dolpa": {"name":"돌파", "group":"might", "p":30, "desc":"부대를 칠 때 피해 +30%"},
	"bangyeok": {"name":"반격", "group":"might", "p":60, "desc":"맞고 버티면 사거리 안의 공격자에게 60% 힘으로 되받아친다"},
	"maengjin": {"name":"맹진", "group":"might", "p":1, "desc":"이동 +1"},
	"heupyeol": {"name":"흡혈", "group":"might", "p":35, "desc":"준 피해의 35% 만큼 체력 회복"},
	"cheodan": {"name":"처단", "group":"might", "p":1, "desc":"적을 쓰러뜨리면 한 턴에 한 번 다시 움직인다"},
	"myeonggung": {"name":"명궁", "group":"wisdom", "p":15, "desc":"두 칸 떨어진 적을 칠 때 명중 +15%p"},
	"myochaek": {"name":"묘책", "group":"wisdom", "p":1, "desc":"책략 한 판 +1번"},
	"ganpa": {"name":"간파", "group":"wisdom", "p":10, "desc":"모든 공격 명중 +10%p"},
	"jinbeop": {"name":"진법", "group":"wisdom", "p":8, "desc":"곁 아군을 노리는 적 명중 −8%p"},
	"chiyu": {"name":"치유", "group":"wisdom", "p":10, "desc":"내 턴이 열릴 때 곁 아군 체력 +10"},
	"sageori": {"name":"원사", "group":"wisdom", "p":1, "desc":"사거리 +1(최대 3)"},
	"cheolbyeok": {"name":"철벽", "group":"command", "p":25, "desc":"받는 피해 −25%"},
	"horyeong": {"name":"호령", "group":"command", "p":15, "desc":"곁 아군이 주는 피해 +15%"},
	"indeok": {"name":"인덕", "group":"command", "p":8, "desc":"내 턴이 열릴 때 자기 체력 +8"},
	"suho": {"name":"수호", "group":"command", "p":10, "desc":"나를 노리는 적 명중 −10%p"},
	"gima": {"name":"기마", "group":"command", "p":10, "desc":"이동 +1 · 뒤치기 명중 +10%p"},
	"bulgul": {"name":"불굴", "group":"command", "p":1, "desc":"쓰러질 피해를 한 판 한 번 체력 1로 버틴다"},
	"seonbong": {"name":"선봉", "group":"command", "p":50, "desc":"그 판 첫 공격 피해 +50%"},
}
const GROUP_NAMES := {"might":"무", "wisdom":"지", "command":"통"}
const GROUP_KEYS := {
	"might":["ilgyeok", "yeongyeok", "dolpa", "bangyeok", "maengjin", "heupyeol", "cheodan"],
	"wisdom":["myeonggung", "myochaek", "ganpa", "jinbeop", "chiyu", "sageori"],
	"command":["cheolbyeok", "horyeong", "indeok", "suho", "gima", "bulgul", "seonbong"]
}

static func of(id: String) -> Dictionary:
	var h: Variant = Characters.find(id)
	if not h is Dictionary: return {}
	var st: Dictionary = h.get("stats", {})
	var group := "command" if String(h.get("trait", "")) == "virtue" else ("wisdom" if float(st.get("wisdom", 0)) >= float(st.get("might", 0)) and float(st.get("wisdom", 0)) >= float(st.get("command", 0)) else ("might" if float(st.get("might", 0)) >= float(st.get("command", 0)) else "command"))
	var keys: Array = GROUP_KEYS[group]
	var idx := 2166136261
	for byte: int in id.to_utf8_buffer(): idx = int(((idx ^ byte) * 16777619) & 0xffffffff)
	var key: String = String(keys[idx % keys.size()])
	var data: Dictionary = SKILLS[key].duplicate(true)
	data.key = key
	data.group_name = GROUP_NAMES[group]
	data.k = 1.5 if int(h.get("rarity", 0)) >= 5 else 1.0
	if data.k > 1.0: data.name += "·극"; data.desc += " (극 — 1.5배)"
	return data

static func attach(u: Dictionary) -> Dictionary:
	if String(u.get("kind", "")) != "officer": return u
	var s := of(String(u.get("id", "")))
	if s.is_empty(): return u
	u.skill = s
	if String(s.key) in ["maengjin", "gima"]: u.mov = int(u.mov) + 1
	if String(s.key) == "sageori": u.rng = mini(3, int(u.rng) + 1)
	return u

static func _power(u: Dictionary, key: String) -> float:
	var s: Dictionary = u.get("skill", {})
	return float(SKILLS.get(key, {}).get("p", 0)) * float(s.get("k", 1.0)) if String(s.get("key", "")) == key else 0.0

static func mods(b: Dictionary, att: Dictionary, tgt: Dictionary, out: Array) -> void:
	var d := Tactics.dist(att, tgt)
	var v := _power(att, "myeonggung")
	if v > 0 and d >= 2: out.append([att.skill.name, roundi(v)])
	v = _power(att, "ganpa")
	if v > 0: out.append([att.skill.name, roundi(v)])
	v = _power(att, "gima")
	if v > 0 and Tactics.is_back(att, tgt): out.append([att.skill.name, roundi(v)])
	v = _power(tgt, "suho")
	if v > 0: out.append([tgt.skill.name, -roundi(v)])
	for ally: Dictionary in Tactics.alive(b, String(tgt.side)):
		if ally != tgt and Tactics.dist(ally, tgt) == 1:
			v = _power(ally, "jinbeop")
			if v > 0: out.append([ally.skill.name, -roundi(v)])
	if int(att.get("gearHit", 0)) != 0: out.append(["장비", int(att.gearHit)])

static func _roll(b: Dictionary, salt: String) -> float:
	var n := int(b.get("hsN", 0)) + 1
	b.hsN = n
	return Tactics.hash01(String(b.seed), "hs" + salt + "#" + str(n))

static func _proc(b: Dictionary, u: Dictionary) -> void:
	if not b.has("hsProc"): b.hsProc = []
	if u.has("skill"): b.hsProc.append(String(u.skill.name))

static func damage(b: Dictionary, a: Dictionary, t: Dictionary, amount: int) -> int:
	var x := float(amount)
	var v := _power(a, "ilgyeok")
	if v > 0 and _roll(b, "crit") * 100.0 < v: x *= 1.6; _proc(b, a)
	v = _power(a, "dolpa")
	if v > 0 and String(t.kind) == "troop": x *= 1.0 + v / 100.0; _proc(b, a)
	v = _power(a, "seonbong")
	if v > 0 and not bool(a.get("hsFirst", false)): a.hsFirst = true; x *= 1.0 + v / 100.0; _proc(b, a)
	if int(a.get("gearCrit", 0)) > 0 and _roll(b, "gcrit") * 100.0 < int(a.gearCrit): x *= 1.5; _proc(b, a)
	for ally: Dictionary in Tactics.alive(b, String(a.side)):
		if ally != a and Tactics.dist(ally, a) == 1:
			v = _power(ally, "horyeong")
			if v > 0: x *= 1.0 + v / 100.0
	v = _power(t, "cheolbyeok")
	if v > 0: x *= maxf(0.3, 1.0 - v / 100.0); _proc(b, t)
	if int(t.get("gearDef", 0)) > 0: x *= maxf(0.4, 1.0 - float(t.gearDef) / 100.0)
	x = maxf(1.0, x)
	v = _power(t, "bulgul")
	if v > 0 and not bool(t.get("hsUg", false)) and float(t.hp) - x <= 0 and float(t.hp) > 1.0:
		t.hsUg = true; x = float(t.hp) - 1.0; _proc(b, t)
	return roundi(x)

static func after(b: Dictionary, a: Dictionary, t: Dictionary, hit: bool, amount: int) -> Array:
	var out: Array = b.get("hsProc", []).duplicate()
	b.hsProc = []
	if hit and amount > 0:
		var v := _power(a, "heupyeol")
		if v > 0: a.hp = minf(float(a.max), float(a.hp) + roundi(amount * v / 100.0)); out.append(a.skill.name)
	if float(t.hp) > 0 and _power(t, "bangyeok") > 0 and Tactics.dist(a, t) <= int(t.rng):
		out.append(t.skill.name)
		_strike(b, t, a, _power(t, "bangyeok") / 100.0, "cnt")
	if float(t.hp) > 0 and float(a.hp) > 0:
		var v := _power(a, "yeongyeok")
		if v > 0 and _roll(b, "dbl") * 100.0 < v:
			out.append(a.skill.name); _strike(b, a, t, 1.0, "dbl")
	if float(t.hp) <= 0 and float(a.hp) > 0 and _power(a, "cheodan") > 0 and int(a.get("hsAgain", -1)) != int(b.turn):
		a.hsAgain = int(b.turn); a.acted = false; a.moved = false; out.append(a.skill.name)
	for proc_name: String in b.get("hsProc", []):
		if not out.has(proc_name): out.append(proc_name)
	b.hsProc = []
	return out

static func _strike(b: Dictionary, a: Dictionary, t: Dictionary, mul: float, tag: String) -> void:
	var chance := Tactics.hit_chance_b(b, a, t)
	var hit := _roll(b, tag + "h") * 100.0 < chance
	var dmg := 0
	if hit:
		dmg = damage(b, a, t, maxi(1, roundi(float(a.atk) * Tactics.dmg_mul * (0.8 + _roll(b, tag + "d") * 0.4) * mul)))
		t.hp = maxf(0.0, float(t.hp) - dmg)
	(b.log as Array).append({"t":b.turn, "a":a.uid, "to":t.uid, "hit":hit, "dmg":dmg, "ch":chance, "skill":a.get("skill", {}).get("name", "")})

static func turn_start(b: Dictionary) -> void:
	for u: Dictionary in Tactics.alive(b, "me") + Tactics.alive(b, "foe"):
		var heal := int(_power(u, "indeok"))
		for ally: Dictionary in Tactics.alive(b, String(u.side)):
			if ally != u and Tactics.dist(ally, u) == 1: heal += roundi(_power(ally, "chiyu"))
		if heal > 0: u.hp = minf(float(u.max), float(u.hp) + heal)

static func plots_bonus(b: Dictionary) -> int:
	for u: Dictionary in Tactics.alive(b, "me"):
		if String(u.get("skill", {}).get("key", "")) == "myochaek": return 1
	return 0
