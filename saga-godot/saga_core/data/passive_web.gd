extends RefCounted

## G-0213 공용 패시브 그물(PoE식 광범위 패시브 나무) — 웹 saga-web/shared/js/passive-web.js(W-0179) make() 를 그대로 옮긴 규칙·세이브 층.
## 화면은 saga_core/ui/passive_web_screen.gd, 판별 정의는 games/<판>/data/passive_def.json(tools/passive_from_web.mjs 가 웹 생성물에서 옮김).
##
## 정의 def = {v, seed, starts:[{key,name,x,y,color}], nodes:[{id,k,x,y,name,stats,rule?,desc?,s?,t?}], edges:[[i,j]]}
##   k = "s" 작은 · "n" 이름난 · "k" 규칙 · "o" 시작점(s = 시작점 key). 좌표는 −1~1 정규화.
## store = {start, taken:[]} — 판 세이브 안 사전을 **참조로** 받아 고친다(복사하면 세이브에 안 남는다).
## 찍기 규칙: 시작점은 공짜, 나머지 한 마디 1점 · 이미 찍은 마디(또는 고른 시작점)에 이웃해야 찍힌다 · 다른 시작점은 지나가지 못한다.
## 점수는 판이 Callable(→ int)로 준다. 바뀌면 changed 신호.

signal changed

var def: Dictionary
var store: Dictionary
var _points_fn: Callable
var _nodes: Array = []
var _adj: Array = []          # 번호 → [이웃 번호]
var _by_id: Dictionary = {}   # id → 번호
var _start_of: Dictionary = {}  # 시작점 key → 번호
var _taken_set: Dictionary = {}
var _sums = null


## 정의 JSON 을 읽는다(간선 번호는 JSON 에서 실수로 오니 정수로). 없으면 빈 사전.
static func load_def(path: String) -> Dictionary:
	var f := FileAccess.open(path, FileAccess.READ)
	if f == null:
		return {}
	var d: Variant = JSON.parse_string(f.get_as_text())
	if typeof(d) != TYPE_DICTIONARY:
		return {}
	var edges: Array = []
	for e: Array in d.get("edges", []):
		edges.append([int(e[0]), int(e[1])])
	d["edges"] = edges
	return d


func _init(p_def: Dictionary, p_store: Dictionary, points_fn: Callable = Callable()) -> void:
	def = p_def
	store = p_store
	_points_fn = points_fn
	_nodes = def.get("nodes", [])
	for i in _nodes.size():
		_adj.append([])
		var nd: Dictionary = _nodes[i]
		_by_id[String(nd.id)] = i
		if String(nd.k) == "o":
			_start_of[String(nd.get("s", ""))] = i
	for e: Array in def.get("edges", []):
		_adj[int(e[0])].append(int(e[1]))
		_adj[int(e[1])].append(int(e[0]))
	if not store.has("taken") or typeof(store.taken) != TYPE_ARRAY:
		store["taken"] = []
	if not store.has("start"):
		store["start"] = null
	sanitize()


func points() -> int:
	var p: int = int(_points_fn.call()) if _points_fn.is_valid() else 0
	return maxi(p, 0)


func used() -> int:
	return (store.taken as Array).size()


func left() -> int:
	return points() - used()


func _start_idx() -> int:
	if store.start == null:
		return -1
	return int(_start_of.get(String(store.start), -1))


func _rebuild() -> void:
	_taken_set = {}
	for id in store.taken:
		_taken_set[String(id)] = true
	_sums = null


func is_taken(id: String) -> bool:
	return _taken_set.has(id) or (_by_id.has(id) and int(_by_id[id]) == _start_idx())


func _fire() -> void:
	_rebuild()
	changed.emit()


## 시작점에서 찍은 마디만 밟아 닿는 곳(번호 → true). skip = 빼 보고 셀 번호
func _reach(skip: int) -> Dictionary:
	var s := _start_idx()
	var seen := {}
	if s < 0:
		return seen
	seen[s] = true
	var q: Array = [s]
	var head := 0
	while head < q.size():
		var i: int = q[head]
		head += 1
		for j: int in _adj[i]:
			if seen.has(j) or j == skip or not _taken_set.has(String(_nodes[j].id)):
				continue
			seen[j] = true
			q.append(j)
	return seen


## 정의가 바뀌었거나 세이브가 낡았을 때: 모르는 id·시작점과 끊긴 마디를 걸러 낸다
func sanitize() -> void:
	if store.start != null and not _start_of.has(String(store.start)):
		store.start = null
	var keep: Array = []
	for id in store.taken:
		var sid := String(id)
		if _by_id.has(sid) and String(_nodes[_by_id[sid]].k) != "o" and not keep.has(sid):
			keep.append(sid)
	if store.start == null:
		keep = []
	store.taken = keep
	_rebuild()
	var r := _reach(-1)
	store.taken = keep.filter(func(sid): return r.has(_by_id[sid]))
	_rebuild()


## 찍을 수 없는 까닭 — "" 면 찍힌다(none·taken·start·nostart·points·far)
func why(id: String) -> String:
	if not _by_id.has(id):
		return "none"
	if is_taken(id):
		return "taken"
	var i: int = _by_id[id]
	if String(_nodes[i].k) == "o":
		return "" if store.start == null else "start"
	if store.start == null:
		return "nostart"
	if left() < 1:
		return "points"
	var s := _start_idx()
	for j: int in _adj[i]:
		if j == s or _taken_set.has(String(_nodes[j].id)):
			return ""
	return "far"


func can_take(id: String) -> bool:
	return why(id) == ""


func take(id: String) -> bool:
	if not can_take(id):
		return false
	var nd: Dictionary = _nodes[_by_id[id]]
	if String(nd.k) == "o":
		store.start = String(nd.s)
		store.taken = []
	else:
		(store.taken as Array).append(id)
	_fire()
	return true


func can_drop(id: String) -> bool:
	if not _taken_set.has(id):
		return false
	var r := _reach(int(_by_id[id]))
	for tid in store.taken:
		if String(tid) != id and not r.has(_by_id[String(tid)]):
			return false
	return true


func drop(id: String) -> bool:
	if not can_drop(id):
		return false
	(store.taken as Array).erase(id)
	_fire()
	return true


## 찍은 곳에서 id 까지 가장 짧은 길 — {path:[아직 안 찍은 id…], cost} · 못 닿으면 빈 사전
func path_to(id: String) -> Dictionary:
	if not _by_id.has(id):
		return {}
	if is_taken(id):
		return {"path": [], "cost": 0}
	var t: int = _by_id[id]
	if String(_nodes[t].k) == "o":
		return {"path": [id], "cost": 0} if store.start == null else {}
	var s := _start_idx()
	if s < 0:
		return {}
	var prev := {s: -1}
	var q: Array = [s]
	for tid in store.taken:
		var b: int = _by_id[String(tid)]
		prev[b] = -1
		q.append(b)
	var head := 0
	while head < q.size():
		var i: int = q[head]
		head += 1
		if i == t:
			break
		for nb: int in _adj[i]:
			if prev.has(nb) or String(_nodes[nb].k) == "o":
				continue
			prev[nb] = i
			q.append(nb)
	if not prev.has(t):
		return {}
	var path: Array = []
	var k := t
	while int(prev[k]) != -1:
		path.push_front(String(_nodes[k].id))
		k = prev[k]
	return {"path": path, "cost": path.size()}


## 길째 찍기 — 점수가 모자라면 아무것도 안 찍는다
func take_path(id: String) -> bool:
	var p := path_to(id)
	if p.is_empty() or (p.path as Array).is_empty():
		return false
	if String(_nodes[_by_id[id]].k) == "o":
		return take(id)
	if int(p.cost) > left():
		return false
	for pid in p.path:
		(store.taken as Array).append(pid)
	_fire()
	return true


func _each_taken() -> Array:
	var out: Array = []
	var s := _start_idx()
	if s >= 0:
		out.append(_nodes[s])
	for id in store.taken:
		out.append(_nodes[_by_id[String(id)]])
	return out


func sum(key: String) -> float:
	if _sums == null:
		_sums = {}
		for nd: Dictionary in _each_taken():
			var st: Dictionary = nd.get("stats", {})
			for k in st:
				if typeof(st[k]) == TYPE_FLOAT or typeof(st[k]) == TYPE_INT:
					_sums[k] = float(_sums.get(k, 0.0)) + float(st[k])
	return float(_sums.get(key, 0.0))


func has(rule: String) -> bool:
	for nd: Dictionary in _each_taken():
		if String(nd.get("rule", "")) == rule:
			return true
	return false


## 전부 되돌리기 — all 이면 시작점도 비운다
func reset(all := false) -> void:
	store.taken = []
	if all:
		store.start = null
	_fire()


func set_start(key: String) -> bool:
	if not _start_of.has(key):
		return false
	if store.start != key:
		store.start = key
		store.taken = []
		_fire()
	return true


## 화면용 상태: "taken" · "can"(지금 찍힘) · "no"
func state(id: String) -> String:
	if is_taken(id):
		return "taken"
	return "can" if can_take(id) else "no"


func neighbors(id: String) -> Array:
	if not _by_id.has(id):
		return []
	return (_adj[_by_id[id]] as Array).map(func(j): return String(_nodes[j].id))


func node(id: String) -> Dictionary:
	return _nodes[_by_id[id]] if _by_id.has(id) else {}


func index_of(id: String) -> int:
	return int(_by_id.get(id, -1))


func adjacency() -> Array:
	return _adj
