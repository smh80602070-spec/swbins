extends RefCounted

## G-0239 5천하 진(陣)·보급선 — 웹 W-0278 supplyline.js(path·ok·monthly·campsVia·cutVia) + war.js 진 상수(CAMP_DECAY·QUIT·MIN) 이식, 수치 그대로.
##   진    출진이 비기면(이기지도 무너지지도 않음) 물러나지 않고 성 밖에 남는다(RealmSaveState.camps). 다음 달마다
##         치중 한 달치를 먹고(모자라면 20% 흩어지고 물러남) → 보급 판정 → 사기 ×0.94 → 0.60 미만·500 미만이면 물러남 → 한 번 더 싸움.
##   이어짐 출진 성이 아직 그 세력 것이고 적 진에 에워싸이지 않았으며, 거기서 그 세력 성만 밟아(적 진이 선 성은 못 지남)
##         진이 에워싼 성에 맞닿은 그 세력 성까지 갈 수 있다 — 성 이웃 그래프(RealmCities.ADJ + 적 성 from_city 간선) BFS.
##   끊김  위가 안 되거나 계략 ✂️ 보급 끊기(cut_t 달 남음) → 그 달 사기 ×0.85 · 병력 −5%.
##   우리 세력은 고돗 천하에 세력 id 가 없어 ME("me"), 적 진은 force_of(출진 성). AI 는 끊기 계략을 안 쓴다(웹도 안 쓴다).
## 판정은 상태를 읽기만 하고, 바꾸는 것은 진의 morale·troops·cut_t 뿐(monthly·cut_via). 싸움·물러남·입성은 realm_rules_war.gd.

const RealmCities := preload("res://games/saga_realm/data/realm_cities.gd")

const CAMP_ON := true      # false 면 비김 = 예전처럼 그냥 돌아간다(골든 옛 값 확인용 손잡이, realm_ai_statecraft AI_ON 과 같은 결)
const CAMP_DECAY := 0.94   # war.js — 한 달 더 진을 치면 사기가 이만큼 남는다
const CAMP_QUIT := 0.60    # 사기가 이보다 낮으면 군이 지쳐 물러난다
const CAMP_MIN := 500      # 이보다 적게 남으면 군대라 할 수 없다
const STARVE := 0.2        # 치중이 떨어지면 이만큼 흩어지고 물러난다
const MORALE := 0.85       # supplyline.js — 끊긴 달 사기
const TROOPS := 0.05       # 끊긴 달 병력
const CUT_MONTHS := 2      # 계략 「보급 끊기」 가 끊는 달
const ME := "me"

static var _adj: Dictionary = {}


## 성 이웃 — 상수 표에서 한 번만 짓는다(is_adjacent 를 BFS 마디마다 훑으면 107 × 107 이라 느리다).
static func neighbors(id: String) -> Array:
	if _adj.is_empty():
		for pair: Array in RealmCities.ADJ:
			_link(String(pair[0]), String(pair[1]))
		for e: Dictionary in RealmCities.ENEMY_CITIES:
			var f := String(e.get("from_city", ""))
			if f != "":
				_link(String(e.id), f)
	return _adj.get(id, [])


static func _link(a: String, b: String) -> void:
	if not _adj.has(a):
		_adj[a] = []
	if not _adj.has(b):
		_adj[b] = []
	if not (b in _adj[a]):
		(_adj[a] as Array).append(b)
	if not (a in _adj[b]):
		(_adj[b] as Array).append(a)


## 그 성의 지금 주인 — 우리 성이면 ME, 안 함락된 적 성이면 그 세력, 재야 성·모르는 성이면 "".
static func owner(S: Object, id: String) -> String:
	if (S.cities as Dictionary).has(id):
		return ME
	var e: Dictionary = (S.enemies as Dictionary).get(id, {})
	if e.is_empty() or bool(e.get("captured", false)):
		return ""
	return String(S.force_of(id))


static func enemy_camp_at(S: Object, city_id: String, force: String) -> bool:
	for cp: Dictionary in S.camps:
		if String(cp.to) == city_id and String(cp.force) != force:
			return true
	return false


static func passable(S: Object, city_id: String, force: String) -> bool:
	return force != "" and owner(S, city_id) == force and not enemy_camp_at(S, city_id, force)


## 보급 길 — [출진 성 … 맞닿은 그 세력 성, 진이 에워싼 성]. 못 이으면 빈 배열(계략 끊김은 여기서 안 본다 — ok() 가 본다).
static func path(S: Object, cp: Dictionary) -> Array:
	var f := String(cp.get("force", ""))
	var start := String(cp.get("from", ""))
	var to := String(cp.get("to", ""))
	if start == "" or not passable(S, start, f):
		return []
	var goal := {}
	for n: String in neighbors(to):
		goal[n] = true
	var prev := {}
	var seen := {start: true}
	var q: Array = [start]
	while not q.is_empty():
		var cur: String = q.pop_front()
		if goal.has(cur):
			var out: Array = [to]
			var k := cur
			while k != "":
				out.push_front(k)
				k = String(prev.get(k, ""))
			return out
		for n: String in neighbors(cur):
			if seen.has(n) or not passable(S, n, f):
				continue
			seen[n] = true
			prev[n] = cur
			q.append(n)
	return []


static func ok(S: Object, cp: Dictionary) -> bool:
	return int(cp.get("cut_t", 0)) <= 0 and not path(S, cp).is_empty()


## 한 달 — 치중을 먹은 뒤 부른다. 끊겼으면 사기 ×0.85·병력 −5%. {"cut": bool, "lost": int}
static func monthly(S: Object, cp: Dictionary) -> Dictionary:
	var cut := not ok(S, cp)
	if int(cp.get("cut_t", 0)) > 0:
		cp["cut_t"] = int(cp.cut_t) - 1
	if not cut:
		return {"cut": false, "lost": 0}
	var lost := roundi(float(cp.troops) * TROOPS)
	cp["morale"] = float(cp.get("morale", 1.0)) * MORALE
	cp["troops"] = maxi(0, int(cp.troops) - lost)
	return {"cut": true, "lost": lost}


## 계략 「보급 끊기」 의 표적 — 그 적 성에서 나갔거나 그 성을 지나 보급받는 그 성 주인의 진.
static func camps_via(S: Object, city_id: String) -> Array:
	var f := owner(S, city_id)
	var out: Array = []
	if f == "" or f == ME:
		return out
	for cp: Dictionary in S.camps:
		if String(cp.force) != f:
			continue
		var p: Array = [city_id] if String(cp.from) == city_id else path(S, cp)
		if city_id in p:
			out.append(cp)
	return out


static func cut_via(S: Object, city_id: String) -> int:
	var cs := camps_via(S, city_id)
	for cp: Dictionary in cs:
		cp["cut_t"] = maxi(int(cp.get("cut_t", 0)), CUT_MONTHS)
	return cs.size()


static func camp_at(S: Object, city_id: String, force: String) -> Dictionary:
	for cp: Dictionary in S.camps:
		if String(cp.to) == city_id and String(cp.force) == force:
			return cp
	return {}


## 진을 친다 — 병력·치중은 부른 쪽이 이미 성에서 뺐다.
static func encamp(S: Object, force: String, src: String, from: String, to: String, troops: int, train: int, tech: int, food: int, officer: String) -> Dictionary:
	var cp := {"force": force, "src": src, "from": from, "to": to, "troops": troops, "train": train, "tech": tech,
		"morale": 1.0, "months": 1, "food": food, "cut_t": 0, "officer": officer}
	(S.camps as Array).append(cp)
	return cp


## 지도 선 — 진 하나의 보급 길 마디 [[성 a, 성 b], …]와 이어짐 여부. 길이 없으면 출진 성 → 진 한 마디(빨강).
static func segs(S: Object, cp: Dictionary) -> Dictionary:
	var p := path(S, cp)
	var good := not p.is_empty() and int(cp.get("cut_t", 0)) <= 0
	if p.is_empty():
		p = [String(cp.from), String(cp.to)]
	var out: Array = []
	for k in p.size() - 1:
		out.append([String(p[k]), String(p[k + 1])])
	return {"good": good, "segs": out}
