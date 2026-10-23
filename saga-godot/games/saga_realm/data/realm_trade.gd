extends RefCounted

## G-0310 5천하 교역로 — 웹 saga-web/saga-realm/js/traderoute.js(W-0301) 이식, 수치 그대로(💰300·12달·둘까지·상업 합 × 0.1).
##   상단  우리 성(from)에서 우리 성 또는 화친 중인 세력의 성(to)까지 길이 있으면 금 300 을 내고 띄운다(12달, 둘까지).
##   길    우리 땅·화친 세력 땅만, 적 진이 선 성은 못 지난다 — 보급선(realm_supply.gd)과 같은 성 이웃 그래프 BFS.
##   한 달 이어지면 (상업 from + 상업 to) × 0.1 × 경륜도 금 배율 · 끊기면 그 상단을 잃는다(돈 안 돌려줌) · 달이 다 되면 끝.
## 재해석: 고돗 천하 AI 는 금이 없어(realm_wonder.gd 머리말) AI 상단은 뺀다 · 호위 무장 묶기는 웹도 뺐다.
##   적 성 상업은 RealmCities 표의 comm_start(고돗 적 성엔 상업 값이 따로 없다).
## 상태 RealmSaveState.trade = [{from, to, left}](세이브 키 "trade", 24→25). autoload 이름을 직접 쓰지 않는다(rs 를 받는다).

const RealmCities := preload("res://games/saga_realm/data/realm_cities.gd")
const RealmSupply := preload("res://games/saga_realm/data/realm_supply.gd")

const COST := 300
const MONTHS := 12
const MAX_ROUTES := 2
const RATE := 0.1
const ME := "me"


static func on() -> bool:
	return OS.get_environment("SAGA_TRADE") != "0"


static func routes(rs: Object) -> Array:
	var t: Variant = rs.get("trade")
	if not (t is Array):
		t = []
		rs.set("trade", t)
	return t


## 화친 중인 세력(truce_months > 0)
static func friendly(rs: Object, force: String) -> bool:
	if force == ME:
		return true
	var dip: Dictionary = (rs.get("diplomacy") as Dictionary).get(force, {})
	return int(dip.get("truce_months", 0)) > 0


static func passable(rs: Object, id: String) -> bool:
	var f := RealmSupply.owner(rs, id)
	return f != "" and friendly(rs, f) and not RealmSupply.enemy_camp_at(rs, id, ME)


## from → to 길(성 id 배열, 끝 포함). 못 이으면 [].
static func path(rs: Object, from: String, to: String) -> Array:
	if from == to or RealmSupply.owner(rs, from) != ME or not passable(rs, from) or not passable(rs, to):
		return []
	var prev := {}
	var seen := {from: true}
	var q: Array = [from]
	while not q.is_empty():
		var cur: String = q.pop_front()
		if cur == to:
			var out: Array = []
			var k := cur
			while k != "":
				out.push_front(k)
				k = String(prev.get(k, ""))
			return out
		for n: String in RealmSupply.neighbors(cur):
			if seen.has(n) or not passable(rs, n):
				continue
			seen[n] = true
			prev[n] = cur
			q.append(n)
	return []


static func comm_of(rs: Object, id: String) -> int:
	var c: Dictionary = (rs.get("cities") as Dictionary).get(id, {})
	if not c.is_empty():
		return int(c.get("comm", 0))
	return int(RealmCities.any_by_id(id).get("comm_start", 0))


## 한 달 벌이(경륜도 배율 전) — (상업 from + 상업 to) × RATE
static func base_gold(rs: Object, from: String, to: String) -> int:
	return roundi(float(comm_of(rs, from) + comm_of(rs, to)) * RATE)


static func city_name(id: String) -> String:
	return String(RealmCities.any_by_id(id).get("name", id))


## 못 띄우는 까닭("" = 띄울 수 있음)
static func why(rs: Object, from: String, to: String) -> String:
	if not on():
		return "교역로가 꺼져 있다"
	if routes(rs).size() >= MAX_ROUTES:
		return "상단은 둘까지"
	for r: Dictionary in routes(rs):
		if (String(r.from) == from and String(r.to) == to) or (String(r.from) == to and String(r.to) == from):
			return "이미 다니는 길"
	if path(rs, from, to).is_empty():
		return "길이 없다(우리·화친 땅만, 적 진 못 지남)"
	if int(rs.get("gold")) < COST:
		return "금이 모자란다(💰%d)" % COST
	return ""


static func start(rs: Object, from: String, to: String) -> Dictionary:
	var w := why(rs, from, to)
	if w != "":
		return {"ok": false, "why": w}
	rs.set("gold", int(rs.get("gold")) - COST)
	routes(rs).append({"from": from, "to": to, "left": MONTHS})
	return {"ok": true, "gold": base_gold(rs, from, to)}


## from 에서 띄울 만한 곳 — 길이 있는 우리·화친 성, 벌이 큰 순 n 개 [{to, gold, hops}]
static func candidates(rs: Object, from: String, n: int = 3) -> Array:
	var out: Array = []
	if RealmSupply.owner(rs, from) != ME:
		return out
	var ids: Array = (rs.get("cities") as Dictionary).keys()
	for eid in (rs.get("enemies") as Dictionary):
		ids.append(String(eid))
	for id in ids:
		var p := path(rs, from, String(id))
		if not p.is_empty():
			out.append({"to": String(id), "gold": base_gold(rs, from, String(id)), "hops": p.size() - 1})
	out.sort_custom(func(a: Dictionary, b: Dictionary) -> bool: return int(a.gold) > int(b.gold) or (int(a.gold) == int(b.gold) and String(a.to) < String(b.to)))
	return out.slice(0, n)


## 한 달 — 이어진 상단은 금을 벌고, 끊긴 상단은 잃고, 다 된 상단은 끝. 알림 줄들을 돌려준다.
static func monthly(rs: Object) -> Array:
	var msgs: Array = []
	if not on():
		return msgs
	var keep: Array = []
	var earned := 0
	for r: Dictionary in routes(rs):
		var nm := "%s↔%s" % [city_name(String(r.from)), city_name(String(r.to))]
		if path(rs, String(r.from), String(r.to)).is_empty():
			msgs.append("🐫 %s 상단을 잃었다 — 길이 끊겼다" % nm)
			continue
		var g: int = int(rs.call("_sc_apply", base_gold(rs, String(r.from), String(r.to)), "gold"))
		earned += g
		r["left"] = int(r.left) - 1
		if int(r.left) <= 0:
			msgs.append("🐫 %s 상단이 일을 마쳤다" % nm)
		else:
			keep.append(r)
	if earned > 0:
		rs.set("gold", int(rs.get("gold")) + earned)
		msgs.append("🐫 교역 +💰%d" % earned)
	rs.set("trade", keep)
	return msgs
