extends RefCounted

## G-0241 2나락 무예별 작은 나무(웹 saga-web/saga-dungeon/js/skill-tree.js W-0280 고돗판) — 같은 무예는 누가 써도 같았다 →
## 무예가 쓰일 때마다(시전 성공 1 = 경험 1) 무예 Lv 1~20(Lv→+1 에 Lv×8), 레벨마다 점 1 을 그 무예만의 나무(마디 8, 갈래 가/나)에 찍는다.
## 마디는 앞 마디에 점 1 이 있어야 열림 · 한 마디 최대 3점(결·연타 1점) · 고른 갈래는 되돌리기 전엔 못 바꿈 · 되돌리기 금 200(경험은 남음).
## 나무는 무예(key)마다 하나 — 직업·인물 아님. passive(모양 없음)는 시전이 없어 나무도 없다.
## 저장: DungeonSkillState.tree = {무예 key: {xp, pts: [마디마다 +n(가)/-n(나)]}} — 세이브 "skill_tree"(순수 추가, 없으면 {}).
## 고돗 2나락엔 기력이 없다 → 기력(cost) 축은 재냉각과 같은 %(경락 mpRegen 과 같은 다시 읽기), 하한 ×0.3.
## mods(sk) 는 원본 무예를 안 건드리고 복제본에 r·el·shots·hops 와 tree_dmg·tree_cd·tree_drain·summon_add 를 얹는다 — skill_caster 가 읽는다.
## 경락 Meridian.mul("cd")·reach_mult 등 기존 배수와는 곱한다(덮지 않음). 점검 preload 경로라 autoload 이름은 트리에서 찾는다.

const MAX_LV := 20
const NODES := 8
const NODE_MAX := 3
const RESET_GOLD := 200
const FLOOR := 0.3
const DRAIN_SEC := 6.0
## 웹 TREE 수치 그대로 — per = 점 하나당
const TREE := [
	{"a": {"k": "dmg", "n": "위력", "per": 4}, "b": {"k": "cost", "n": "기력", "per": 6}},
	{"a": {"k": "cd", "n": "재냉각", "per": 4}, "b": {"k": "range", "n": "범위", "per": 6}},
	{"a": {"k": "dmg", "n": "위력", "per": 5}, "b": {"k": "drain", "n": "흡수", "per": 3}},
	{"a": {"k": "fire", "n": "불 결", "per": 1, "max": 1}, "b": {"k": "cold", "n": "한기 결", "per": 1, "max": 1}},
	{"a": {"k": "cost", "n": "기력", "per": 5}, "b": {"k": "cd", "n": "재냉각", "per": 3}},
	{"a": {"k": "dmg", "n": "위력", "per": 6}, "b": {"k": "range", "n": "범위", "per": 8}},
	{"a": {"k": "multi", "n": "연타", "per": 1, "max": 1}, "b": {"k": "cd", "n": "재냉각", "per": 5}},
	{"a": {"k": "dmg", "n": "위력", "per": 8}, "b": {"k": "cost", "n": "기력", "per": 8}},
]


static func _node(name: String) -> Node:
	var ml := Engine.get_main_loop() as SceneTree
	return ml.root.get_node_or_null(name) if ml != null else null


static func _all() -> Dictionary:
	var s := _node("DungeonSkillState")
	return s.tree if s != null else {}


static func _of(key: String) -> Dictionary:
	var all := _all()
	if not all.has(key) or typeof(all[key]) != TYPE_DICTIONARY:
		all[key] = {"xp": 0, "pts": []}
	var t: Dictionary = all[key]
	if not t.has("pts") or not (t.pts is Array):
		t["pts"] = []
	return t


static func _peek(key: String) -> Dictionary:
	var v: Variant = _all().get(key, null)
	return v if typeof(v) == TYPE_DICTIONARY else {}


static func _pt(t: Dictionary, i: int) -> int:
	var p: Array = t.get("pts", [])
	return int(p[i]) if i < p.size() and p[i] != null else 0


static func max_of(opt: Dictionary) -> int:
	return int(opt.get("max", NODE_MAX))


static func label(opt: Dictionary) -> String:
	var k := str(opt.k)
	if k == "fire" or k == "cold":
		return "%s 덧붙임" % opt.n
	if k == "multi":
		return "연타 +1(화살·연환·부르기)"
	return "%s %s%d%%%s" % [opt.n, "-" if k == "cost" or k == "cd" else "+", int(opt.per), "p" if k == "drain" else ""]


## 레벨 L → L+1 에 드는 경험(시전 1 = 1) · 20 까지 누적 1520
static func need(lv: int) -> int:
	return lv * 8


## {lv, xp(이 레벨 안), need(최고면 0)}
static func progress(key: String) -> Dictionary:
	var xp := int(_peek(key).get("xp", 0))
	var lv := 1
	while lv < MAX_LV and xp >= need(lv):
		xp -= need(lv)
		lv += 1
	return {"lv": lv, "xp": xp, "need": need(lv) if lv < MAX_LV else 0}


static func lv_of(key: String) -> int:
	return int(progress(key).lv)


static func spent(key: String) -> int:
	var t := _peek(key)
	var n := 0
	for v in t.get("pts", []):
		n += absi(int(v) if v != null else 0)
	return n


static func points_left(key: String) -> int:
	return maxi(0, lv_of(key) - 1 - spent(key))


## 무예가 쓰였다 — skill_caster 가 시전 성공(ok) 때만 부른다. {lv, up(레벨이 올랐나)}
static func gain(key: String, n: int = 1) -> Dictionary:
	if key == "":
		return {"lv": 0, "up": false}
	var before := lv_of(key)
	var t := _of(key)
	t["xp"] = int(t.get("xp", 0)) + n
	var after := lv_of(key)
	return {"lv": after, "up": after > before}


## 이 마디에 이 갈래로 찍을 수 있나 — 못 하면 이유(arg·prereq·side·max·point), 되면 ""
static func why(key: String, i: int, side: String) -> String:
	if i < 0 or i >= NODES or (side != "a" and side != "b"):
		return "arg"
	var t := _peek(key)
	var cur := _pt(t, i)
	if i > 0 and _pt(t, i - 1) == 0:
		return "prereq"
	if (side == "a" and cur < 0) or (side == "b" and cur > 0):
		return "side"
	if absi(cur) >= max_of(TREE[i][side]):
		return "max"
	if points_left(key) < 1:
		return "point"
	return ""


static func put(key: String, i: int, side: String) -> Dictionary:
	var w := why(key, i, side)
	if w != "":
		return {"ok": false, "reason": w}
	var t := _of(key)
	var p: Array = t.pts
	while p.size() <= i:
		p.append(0)
	p[i] = int(p[i]) + (1 if side == "a" else -1)
	return {"ok": true, "pts": p.duplicate()}


## 되돌리기 — 금 200, 경험은 그대로
static func reset(key: String) -> Dictionary:
	if spent(key) == 0:
		return {"ok": false, "reason": "empty"}
	var g := _node("DungeonGoldState")
	if g == null or not bool(g.spend(RESET_GOLD)):
		return {"ok": false, "reason": "gold", "need": RESET_GOLD}
	_of(key)["pts"] = []
	return {"ok": true}


## 찍은 점 → 축마다 합
static func sums(key: String) -> Dictionary:
	var out := {"dmg": 0.0, "cost": 0.0, "cd": 0.0, "range": 0.0, "drain": 0.0, "fire": 0.0, "cold": 0.0, "multi": 0.0}
	var t := _peek(key)
	for i in NODES:
		var v := _pt(t, i)
		if v == 0:
			continue
		var opt: Dictionary = TREE[i]["a" if v > 0 else "b"]
		out[str(opt.k)] = float(out[str(opt.k)]) + float(opt.per) * absi(v)
	return out


## 원본 무예는 그대로, 복제본에 나무를 얹어 돌려준다(나무가 없으면 원본 그대로 — 배수 키 없음 = 1).
static func mods(sk: Dictionary) -> Dictionary:
	var key := str(sk.get("key", ""))
	if key == "" or spent(key) == 0:
		return sk
	var s := sums(key)
	var c := sk.duplicate()
	var dmg := 1.0 + float(s.dmg) / 100.0
	var cd := maxf(FLOOR, (1.0 - float(s.cd) / 100.0) * (1.0 - float(s.cost) / 100.0))
	if float(s.range) > 0.0:
		if c.has("r"):
			c["r"] = float(c.r) * (1.0 + float(s.range) / 100.0)
		else:
			dmg *= 1.0 + float(s.range) / 200.0
	if float(s.fire) > 0.0 or float(s.cold) > 0.0:
		if not c.has("el"):
			c["el"] = "fire" if float(s.fire) > 0.0 else "cold"
		else:
			dmg *= 1.05
	if float(s.multi) > 0.0:
		match str(c.get("shape", "")):
			"bolt": c["shots"] = int(c.get("shots", 1)) + 1
			"chain": c["hops"] = int(c.get("hops", 3)) + 1
			"summon": c["summon_add"] = 1
			_: dmg *= 1.06
	c["tree_dmg"] = dmg
	c["tree_cd"] = cd
	c["tree_drain"] = float(s.drain)
	return c


## 무예 창 한 줄 글 — "🌳 나무 Lv n · xp/need · 점 k"
static func line(key: String) -> String:
	var pr := progress(key)
	return "🌳 나무 Lv %d%s · 점 %d" % [int(pr.lv), (" · %d/%d" % [int(pr.xp), int(pr.need)]) if int(pr.need) > 0 else " · 끝", points_left(key)]
