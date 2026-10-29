extends RefCounted

## G-0420 — W-0458 mid-battle reinforcements, rescue ally, deterministic dialogue.
const RealmTactics := preload("res://games/saga_realm/data/realm_tactics.gd")
const CampaignCommand := preload("res://games/saga_realm/data/realm_commander.gd")
const CampaignClass := preload("res://games/saga_realm/data/realm_class.gd")
const Characters := preload("res://saga_core/data/characters.gd")

const ALLY_TURN := 3
const ALLY_HP := 0.45
const SHOW_SECONDS := 2.0
const LINES := {
	"start": ["{f}: 「{m}, 여기가 너의 무덤이다!」", "{f}: 「겨우 그 병력으로 나를 막겠다고?」", "{f}: 「전군, 한 놈도 놓치지 마라!」", "{f}: 「길을 비켜라. 비키지 않으면 베고 지나간다!」"],
	"reinforce": ["{r}: 「늦지 않았군 — {f} 님, 돕겠습니다!」", "{r}: 「뒤는 내가 맡는다. 몰아쳐라!」"],
	"ally": ["{a}: 「{m}! 원군이 왔다, 버텨라!」", "{a}: 「이 몸이 왔으니 이제 걱정 마시오!」"],
	"low": ["{f}: 「크윽… 이대로 물러설 순 없다!」", "{f}: 「제법이로군… 하지만 아직이다!」"],
	"leaderDown": ["{f}: 「분하다… 여기까지인가…」"],
	"foeDown": ["{x}: 「으윽… 물러나라…!」"],
	"myDown": ["{x}: 「주공… 먼저 가겠습니다…」", "{x}: 「뒤를… 부탁합니다…」"]
}

static func enabled() -> bool:
	return OS.get_environment("SAGA_REALM_BATTLE_EVENT") != "0"

static func _hash(value: String) -> int:
	var h := 2166136261
	for byte: int in value.to_utf8_buffer(): h = int(((h ^ byte) * 16777619) & 0xffffffff)
	return h

static func _pick(b: Dictionary, key: String, salt := "") -> String:
	var lines: Array = LINES.get(key, [])
	return String(lines[_hash(String(b.get("seed", "")) + "|" + key + "|" + salt) % lines.size()]) if not lines.is_empty() else ""

static func _name(id: String) -> String:
	var person: Variant = Characters.find(id)
	return String(person.get("name", id)) if person is Dictionary else id

static func _leader(b: Dictionary, side: String) -> Dictionary:
	var first := {}
	for u: Dictionary in b.get("units", []):
		if String(u.get("side", "")) != side or String(u.get("kind", "")) != "officer": continue
		if first.is_empty(): first = u
		if side == "foe" and bool(u.get("leader", false)): return u
	return first

static func _fill(line: String, values: Dictionary) -> String:
	var out := line
	for key: String in values: out = out.replace("{" + key + "}", String(values[key]))
	return out

static func _say(b: Dictionary, kind: String, u: Dictionary, line: String, extra := {}) -> void:
	var me := _leader(b, "me")
	var foe := _leader(b, "foe")
	var who_id := String(u.get("id", ""))
	var values := {"m": _name(String(me.get("id", ""))), "f": _name(String(foe.get("id", ""))), "x": _name(who_id)}
	for key: String in extra: values[key] = extra[key]
	var speaker := String(extra.get("speaker", _name(who_id) if who_id != "" else "전장 소식"))
	var rendered := _fill(line, values)
	var prefix := speaker + ": "
	if rendered.begins_with(prefix): rendered = rendered.substr(prefix.length())
	(b.evLog as Array).append({"t":int(b.get("turn", 1)), "kind":kind, "who":String(u.get("uid", "")), "side":String(u.get("side", "")), "speaker":speaker, "text":prefix + rendered})

static func _script_lines(b: Dictionary, lines: Array, kind: String) -> void:
	for entry_v: Variant in lines:
		if not entry_v is Array or entry_v.size() < 2: continue
		var who := String(entry_v[0])
		var line := String(entry_v[1])
		if who == "n":
			var colon := line.find(": ")
			var speaker := line.substr(0, colon) if colon > 0 else "전장 소식"
			_say(b, "story", {}, line, {"speaker":speaker})
			continue
		var side := "me" if who == "m" else "foe"
		var actor := _leader(b, side)
		if actor.is_empty(): continue
		_say(b, kind, actor, "{%s}: %s" % [who, line])

static func setup(b: Dictionary, events: Dictionary = {}) -> void:
	b.evLog = []
	b.ev = null
	if not enabled() or not bool(b.get("campaign", false)) or not bool(b.get("srpg", false)): return
	b.ev = {"reinforce":events.get("reinforce", {}), "ally":events.get("ally", {}), "script":events.get("script", {}), "seen":{}}
	var foe := _leader(b, "foe")
	var script: Dictionary = b.ev.script
	if script.has("open"):
		_script_lines(b, script.open, "start")
	elif not foe.is_empty(): _say(b, "start", foe, _pick(b, "start"))

static func _cell_free(b: Dictionary, x: int, y: int) -> bool:
	var cell := RealmTactics.cell_at(b, x, y)
	if cell in ["", "river", "wall", "gate"]: return false
	return not RealmTactics.occupied(b, x, y)

static func _edge(b: Dictionary, side: String) -> Vector2i:
	var edge_x := int(b.cols) - 1 if side == "foe" else 0
	var inward := -1 if side == "foe" else 1
	var mid := int(floor(float(b.rows) * 0.5))
	for col in 3:
		for k in int(b.rows):
			var offset := int(ceil(float(k) * 0.5)) * (-1 if k % 2 == 1 else 1)
			var y := posmod(mid + offset, int(b.rows))
			var x := edge_x + inward * col
			if _cell_free(b, x, y): return Vector2i(x, y)
	return Vector2i(-1, -1)

static func _arrive(b: Dictionary, side: String, spec: Dictionary) -> Dictionary:
	var id := String(spec.get("id", ""))
	if id == "": return {}
	for u: Dictionary in b.units:
		if String(u.get("id", "")) == id and String(u.get("side", "")) == side: return {}
	var spot := _edge(b, side)
	if spot.x < 0: return {}
	var stats: Dictionary = b.get("battle_stats", {}).get(id, {})
	var officer := RealmTactics.officer_unit(id, side, stats)
	officer.x = spot.x
	officer.y = spot.y
	officer.fx = 1 if side == "me" else -1
	officer.fy = 0
	officer.arm = ""
	officer.arrived = int(b.get("turn", 1))
	var command := float(stats.get("command", 60.0))
	officer.cmdR = 2 + int(floor(command / 45.0))
	officer.cmdA = int(floor(6.0 + command / 10.0 + 0.5))
	officer.squad = 1
	b.units.append(officer)
	var arms: Array = spec.get("arms", ["spear", "bow"])
	var squad := CampaignCommand.squad(b, officer, arms, int(spec.get("hp", 30))) if bool(b.get("command", false)) else []
	for merc: Dictionary in squad:
		merc.moved = side == "me"
		merc.acted = side == "me"
	var class_key := String(spec.get("cls", ""))
	if class_key != "":
		var class_map := {id:class_key}
		CampaignClass.apply(b, class_map)
		(b.classes as Dictionary)[id] = class_key
	return officer

static func _fraction(b: Dictionary, side: String) -> float:
	var hp := 0.0
	var max_hp := 0.0
	for u: Dictionary in b.units:
		if String(u.get("side", "")) != side: continue
		hp += maxf(0.0, float(u.get("hp", 0.0)))
		max_hp += float(u.get("max", 0.0))
	return hp / max_hp if max_hp > 0.0 else 0.0

static func turn_start(b: Dictionary) -> void:
	var ev: Variant = b.get("ev", null)
	if not ev is Dictionary or String(b.get("done", "")) != "": return
	var seen: Dictionary = ev.seen
	var script: Dictionary = ev.script
	var reinf: Dictionary = ev.reinforce
	if not reinf.is_empty() and not bool(seen.get("reinforce", false)) and int(b.get("turn", 1)) >= int(reinf.get("turn", 3)):
		seen.reinforce = true
		var foe := _arrive(b, "foe", reinf)
		if not foe.is_empty():
			var reinf_line := String(script.get("reinf", ""))
			_say(b, "reinforce", foe, "{r}: " + reinf_line if reinf_line != "" else _pick(b, "reinforce"), {"r":_name(String(foe.id))})
	var ally_spec: Dictionary = ev.ally
	if not ally_spec.is_empty() and not bool(seen.get("ally", false)) and int(b.get("turn", 1)) >= ALLY_TURN and _fraction(b, "me") < ALLY_HP:
		seen.ally = true
		var ally := _arrive(b, "me", ally_spec)
		if not ally.is_empty():
			ally.moved = false
			ally.acted = false
			for u: Dictionary in b.units:
				if String(u.get("cmd", "")) == String(ally.uid): u.moved = false; u.acted = false
			_say(b, "ally", ally, _pick(b, "ally"), {"a":_name(String(ally.id))})
	var turns: Dictionary = script.get("turns", {})
	var turn_no := int(b.get("turn", 1))
	var turn_key := str(turn_no)
	if turns.has(turn_no) and not bool(seen.get("turn:" + turn_key, false)):
		seen["turn:" + turn_key] = true
		_script_lines(b, turns[turn_no], "talk")

static func scan(b: Dictionary) -> void:
	var ev: Variant = b.get("ev", null)
	if not ev is Dictionary: return
	var seen: Dictionary = ev.seen
	var script: Dictionary = ev.script
	for u: Dictionary in b.units:
		if String(u.get("kind", "")) != "officer" or String(u.get("id", "")) == "": continue
		var uid := String(u.uid)
		if float(u.hp) <= 0.0 and not bool(seen.get("down:" + uid, false)):
			seen["down:" + uid] = true
			var kind := "myDown" if String(u.side) == "me" else ("leaderDown" if bool(u.get("leader", false)) else "foeDown")
			var line := String(script.get("down", "")) if kind == "leaderDown" else ""
			_say(b, kind, u, "{x}: " + line if line != "" else _pick(b, kind, uid))
		elif bool(u.get("leader", false)) and float(u.hp) > 0.0 and float(u.hp) < float(u.max) * 0.5 and not bool(seen.get("low:" + uid, false)):
			seen["low:" + uid] = true
			var low_line := String(script.get("low", ""))
			_say(b, "low", u, "{x}: " + low_line if low_line != "" else _pick(b, "low", uid))
