extends RefCounted

## G-0234 5천하 기술 나무 — 세력 연구 네 갈래(농·상·군·학) × 여섯 마디(웹 W-0290 data-tech.js·tech.js 이식, 표·수치 그대로).
##   갈래 안에서는 차례대로만(앞 마디가 문). 달마다 연구점 = 1 + 지력 85 이상 무장 수(넷까지) + 「글 모으기」 1.
##   효과 세 길: stats → 경륜도 합산 자리(realm_statecraft.gd fx 의 pct)에 더한다 · cost → 내정 명령 금(조선·훈련 −20%) · rule → study·wonder.
##   불가사의(W-0279)는 이 판에 없어 「큰 도면」(학 3마디)은 wonder_open() 플래그만 남긴다. 웹 표에 진형 해금은 없다(티켓 예시 — 안 지어냄).
##   AI 세력은 연구하지 않는다(고돗 천하 AI 는 금·인구가 없다 — 경륜도 G-0219 와 같은 경계). 플레이어 세력 하나만.
##   상태 RealmSaveState.tech = {"pts": int, "done": [마디 id…]}(세이브 키 "tech", 21→22) · 빈 나무는 배수가 다 1 이라 golden 그대로.
## autoload 이름을 직접 쓰지 않는다(realm_statecraft.gd 와 같은 규칙 — 점검이 규칙 파일을 preload).

const PTS := [6, 9, 12, 16, 20, 25]
const BRANCHES := [
	{"key": "farm", "name": "농", "emoji": "🌾", "desc": "군량과 백성", "nodes": [
		{"id": "f1", "name": "물꼬 트기", "desc": "군량 +5%", "stats": {"foodPct": 5}},
		{"id": "f2", "name": "두벌 갈이", "desc": "군량 +5%", "stats": {"foodPct": 5}},
		{"id": "f3", "name": "둔전 두기", "desc": "징병 성과 +5%", "stats": {"troopPct": 5}},
		{"id": "f4", "name": "큰 곳간", "desc": "군량 +10%", "stats": {"foodPct": 10}},
		{"id": "f5", "name": "향약 세우기", "desc": "내정 +5%", "stats": {"govPct": 5}},
		{"id": "f6", "name": "물레방아", "desc": "군량 +10%", "stats": {"foodPct": 10}},
	]},
	{"key": "trade", "name": "상", "emoji": "🪙", "desc": "금과 길", "nodes": [
		{"id": "t1", "name": "저자 열기", "desc": "금 수입 +5%", "stats": {"goldPct": 5}},
		{"id": "t2", "name": "나루 짓기", "desc": "조선 비용 -20%", "cost": {"order": "ships", "mul": 0.8}},
		{"id": "t3", "name": "되 맞추기", "desc": "금 수입 +5%", "stats": {"goldPct": 5}},
		{"id": "t4", "name": "객주 두기", "desc": "등용 +10%", "stats": {"hirePct": 10}},
		{"id": "t5", "name": "소금 길", "desc": "금 수입 +10%", "stats": {"goldPct": 10}},
		{"id": "t6", "name": "먼 장사", "desc": "외교 +10%", "stats": {"diploPct": 10}},
	]},
	{"key": "mil", "name": "군", "emoji": "⚔️", "desc": "창과 성벽", "nodes": [
		{"id": "m1", "name": "창 갈기", "desc": "공격 +4%", "stats": {"atkPct": 4}},
		{"id": "m2", "name": "돌 성벽", "desc": "축성 성과 +10%", "stats": {"wallPct": 10}},
		{"id": "m3", "name": "조련 틀", "desc": "훈련 비용 -20%", "cost": {"order": "train", "mul": 0.8}},
		{"id": "m4", "name": "방패 벽", "desc": "수비 +5%", "stats": {"defPct": 5}},
		{"id": "m5", "name": "쇠뇌 틀", "desc": "공격 +6%", "stats": {"atkPct": 6}},
		{"id": "m6", "name": "군적 정리", "desc": "징병 성과 +10%", "stats": {"troopPct": 10}},
	]},
	{"key": "learn", "name": "학", "emoji": "📜", "desc": "글과 꾀", "nodes": [
		{"id": "l1", "name": "서당 열기", "desc": "내정 +5%", "stats": {"govPct": 5}},
		{"id": "l2", "name": "글 모으기", "desc": "연구점 +1/달", "rule": "study"},
		{"id": "l3", "name": "큰 도면", "desc": "불가사의를 지을 수 있다", "rule": "wonder"},
		{"id": "l4", "name": "꾀주머니", "desc": "계략 성공률 +5%", "stats": {"plotPct": 5}},
		{"id": "l5", "name": "무장 교습", "desc": "경험 +10%", "stats": {"expPct": 10}},
		{"id": "l6", "name": "태학 세우기", "desc": "내정 +10% · 계략 +5%", "stats": {"govPct": 10, "plotPct": 5}},
	]},
]
const BASE_PTS := 1
const SCHOLAR_WIS := 85
const SCHOLAR_MAX := 4

## 연구할 때마다 오른다 — 경륜도 fx 캐시가 이 값도 본다.
static var rev := 0


static func bump() -> void:
	rev += 1


static func _rs() -> Node:
	var ml := Engine.get_main_loop() as SceneTree
	return ml.root.get_node_or_null("RealmSaveState") if ml != null else null


static func state() -> Dictionary:
	var rs := _rs()
	if rs == null:
		return {"pts": 0, "done": []}
	var t: Variant = rs.get("tech")
	if not (t is Dictionary):
		t = {}
		rs.set("tech", t)
	if not (t as Dictionary).has("pts"):
		t["pts"] = 0
	if not ((t as Dictionary).get("done") is Array):
		t["done"] = []
	return t


static func branch(key: String) -> Dictionary:
	for b: Dictionary in BRANCHES:
		if String(b.key) == key:
			return b
	return {}


static func node(id: String) -> Dictionary:
	for b: Dictionary in BRANCHES:
		for i in (b.nodes as Array).size():
			var n: Dictionary = b.nodes[i]
			if String(n.id) == id:
				var out := n.duplicate()
				out["branch"] = b.key
				out["pts"] = PTS[i]
				out["idx"] = i
				return out
	return {}


static func done_count(key: String, t: Dictionary = {}) -> int:
	var st := t if not t.is_empty() else state()
	var n := 0
	for id in st.done:
		if String(node(String(id)).get("branch", "")) == key:
			n += 1
	return n


## 갈래의 다음 마디(다 끝났으면 {}).
static func next_of(key: String, t: Dictionary = {}) -> Dictionary:
	var b := branch(key)
	if b.is_empty():
		return {}
	var n := done_count(key, t)
	return node(String(b.nodes[n].id)) if n < (b.nodes as Array).size() else {}


## 연구한 마디의 그 키 합(%).
static func pct(key: String, t: Dictionary = {}) -> float:
	var st := t if not t.is_empty() else state()
	var n := 0.0
	for id in st.done:
		var s: Variant = node(String(id)).get("stats", {})
		n += float((s as Dictionary).get(key, 0))
	return n


## 명령 금 — 연구한 cost 마디를 곱한다(없으면 그대로).
static func cost(order_key: String, gold: int, t: Dictionary = {}) -> int:
	var st := t if not t.is_empty() else state()
	var m := 1.0
	for id in st.done:
		var c: Variant = node(String(id)).get("cost", {})
		if String((c as Dictionary).get("order", "")) == order_key:
			m *= float(c.mul)
	return gold if m == 1.0 else roundi(float(gold) * m)


static func has_rule(rule: String, t: Dictionary = {}) -> bool:
	var st := t if not t.is_empty() else state()
	for id in st.done:
		if String(node(String(id)).get("rule", "")) == rule:
			return true
	return false


static func wonder_open() -> bool:
	return has_rule("wonder")


static func pts_per_month(scholars: int, t: Dictionary = {}) -> int:
	return BASE_PTS + mini(SCHOLAR_MAX, scholars) + (1 if has_rule("study", t) else 0)


## 한 달 — realm_rules_month.next_month 가 학자 수를 넘겨 부른다.
static func monthly(scholars: int) -> int:
	var st := state()
	var add := pts_per_month(scholars, st)
	st["pts"] = int(st.pts) + add
	return add


static func why(key: String) -> String:
	var nd := next_of(key)
	if nd.is_empty():
		return "이 갈래는 다 연구했다"
	if int(state().pts) < int(nd.pts):
		return "연구점이 모자란다(%d/%d)" % [int(state().pts), int(nd.pts)]
	return ""


## 다음 마디를 산다 — {ok, why} 또는 {ok, node}.
static func research(key: String) -> Dictionary:
	var w := why(key)
	if w != "":
		return {"ok": false, "why": w}
	var nd := next_of(key)
	var st := state()
	st["pts"] = int(st.pts) - int(nd.pts)
	(st.done as Array).append(String(nd.id))
	rev += 1
	return {"ok": true, "node": nd}
