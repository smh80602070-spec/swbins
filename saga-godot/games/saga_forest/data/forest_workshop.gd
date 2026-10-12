extends RefCounted

## G-0218 3마을 솜씨도 — PoE식 패시브 그물(웹 saga-web/saga-forest/js/workshop.js W-0184 고돗판). 본보기 games/saga_dungeon/data/dungeon_meridian.gd(G-0217).
## 규칙·화면은 공용(saga_core/data/passive_web.gd·ui/passive_web_screen.gd), 정의는 data/passive_def.json(tools/passive_from_web.mjs saga-forest),
## 찍은 것은 ForestSaveState.passive {start, taken, freeDay}. 싸움 수치 없이 하루 손만 바뀐다.
##
## 점수(재해석 — 고돗 3마을엔 종 도감이 없다) = 첫 날 1 + Σ(도구 Lv−1)(최대 6) + ⌊기증 수/5⌋(상한 22) + 주민마다 하트 3·5·7·10 문턱 넘은 수, 상한 CAP 56.
## 효과: chance(k) = 합/100 확률로 +1 — **기존 굴림 뒤에 따로 굴린다**(빈 솜씨도면 굴림 순서·수치 그대로).
## 다시 읽기: 시간대가 없어 밤 = 시스템 시각 20~4시·새벽 = 4~7시 · 새벽형 → 순무 오전이 14시까지 · 올빼미 → 밤 낚시·벌레 두 배, 새벽엔 가구 진열 없음 ·
## 드문 것 무게가 없어 rarePct → 풍성(+3) 확률 + 8%×합/100(풍성 갈래가 없어도 산다) · 한 우물 → 낚시 한 번에 두 마리, 낚시 말고 채집 절반(최소 1) ·
## 택배가 없어 마을 사랑 → 하트 두 배, 하루 상한 +4 는 그대로. 되돌리기 = 집 안에서만, 하루 한 번 무료, 그 뒤 한 마디 DROP_GOLD.
## 이 파일은 점검(SceneTree)이 preload 하는 파일들이 부르므로 autoload 이름을 직접 쓰지 않는다(트리에서 찾는다). 효과 묶음은 api.rev 가 바뀔 때만 다시 센다.

const DEF_PATH := "res://games/saga_forest/data/passive_def.json"
## 손잡이 — 웹 st.ws.* 기본값
const CAP := 56
const DONATE_PER := 5
const DONATE_CAP := 22
const HEART_STEPS := [3, 5, 7, 10]
const DROP_GOLD := 300
const DAWN_SHIFT := 2
const OWL_MUL := 2
const BARE_WALK := 0.85
const ONEWELL_CUT := 0.5
const BIGHAND_NEED := 0.7
const BIGHAND_FEE := 200
const MISER := 1.25
const LOVE_MUL := 2
const GARDENER_MUL := 2.0
const BOUNTY_P := 0.08
const NIGHT_FROM := 20
const NIGHT_TO := 4
const DAWN_TO := 7
const LABEL := {"gatherPct": ["채집 하나 더", "%"], "fishPct": ["입질 창", "%"], "bugPct": ["벌레 하나 더", "%"], "rarePct": ["풍성(셋 더)", "%"],
	"sellPct": ["파는 값", "%"], "buyPct": ["사는 값 줄임", "%"], "heartPct": ["하트 하나 더", "%"], "walkPct": ["걸음", "%"],
	"craftPct": ["재료 아낌", "%"], "flowerPct": ["꽃 교배", "%"]}
## 다시 해석한 규칙 글(정의 파일은 생성물이라 안 고침)
const DESC := {"dawn": "아침 장이 2시간 길다(순무 오전이 14시까지)",
	"owl": "밤(20~4시)에 잡은 벌레·물고기가 두 마리씩, 대신 새벽(4~7시)엔 가구 진열이 없다",
	"barehand": "삽 없이도 캐고 판다, 대신 걸음 −15%",
	"onewell": "낚시 한 번에 두 마리, 낚시 말고 채집은 절반(최소 1)",
	"villagelove": "이웃 하트가 두 배로 오른다(하루 상한 +4 는 그대로)"}
const RULES := ["dawn", "owl", "barehand", "onewell", "bighand", "miser", "villagelove", "gardener"]
const SUM_KEYS := ["gatherPct", "fishPct", "bugPct", "rarePct", "sellPct", "buyPct", "heartPct", "walkPct", "craftPct", "flowerPct"]

static var _def: Dictionary = {}
static var _fx: Dictionary = {}
static var _fx_api_id := 0
static var _fx_rev := -1
static var forced_hour = null   # 점검이 시각을 붙든다(null = 시스템 시각)


static func _node(name: String) -> Node:
	var ml := Engine.get_main_loop() as SceneTree
	return ml.root.get_node_or_null(name) if ml != null else null


static func definition() -> Dictionary:
	if _def.is_empty():
		_def = (load("res://saga_core/data/passive_web.gd") as GDScript).call("load_def", DEF_PATH)
	return _def


## 점수 내역 — 첫 날 · 도구 승급 · 기증 · 이웃 하트
static func parts() -> Dictionary:
	var F := _node("ForestSaveState")
	if F == null:
		return {"first": 1, "tool": 0, "donate": 0, "heart": 0}
	var tool := 0
	for k in (F.get("tool_lv") as Dictionary):
		tool += maxi(0, int(F.tool_lv[k]) - 1)
	var heart := 0
	for k in (F.get("affinity") as Dictionary):
		for at: int in HEART_STEPS:
			if int(F.affinity[k]) >= at:
				heart += 1
	return {"first": 1, "tool": tool, "donate": mini(DONATE_CAP, int(F.get("museum_donated")) / DONATE_PER), "heart": heart}


static func points_total() -> int:
	var p := parts()
	return mini(CAP, int(p.first) + int(p.tool) + int(p.donate) + int(p.heart))


static func api() -> RefCounted:
	var F := _node("ForestSaveState")
	return F.call("passive_api") if F != null else null


static func fx() -> Dictionary:
	var a := api()
	if a == null:
		return {}
	if a.get_instance_id() == _fx_api_id and int(a.rev) == _fx_rev:
		return _fx
	_fx_api_id = a.get_instance_id()
	_fx_rev = int(a.rev)
	var r := {}
	for k in RULES:
		r[k] = bool(a.has(k))
	var s := {}
	for k in SUM_KEYS:
		s[k] = float(a.sum(k))
	_fx = {"rules": r, "sums": s}
	return _fx


static func has_rule(rule: String) -> bool:
	return bool((fx().get("rules", {}) as Dictionary).get(rule, false))


static func sum(key: String) -> float:
	return float((fx().get("sums", {}) as Dictionary).get(key, 0.0))


## 합/100 확률로 1 — 합이 0 이면 굴리지 않는다(빈 솜씨도면 난수를 안 쓴다)
static func chance(key: String) -> int:
	var p := sum(key) / 100.0
	return 1 if p > 0.0 and randf() < p else 0


static func hour() -> int:
	return int(forced_hour) if forced_hour != null else int(Time.get_time_dict_from_system()["hour"])


static func is_night() -> bool:
	var h := hour()
	return h >= NIGHT_FROM or h < NIGHT_TO


static func is_dawn() -> bool:
	var h := hour()
	return h >= NIGHT_TO and h < DAWN_TO


## ---- 판 파일이 묻는 것 ----

## 채집 수(덤 굴림 뒤) — 작은 마디 +1 확률(풀숲은 벌레) · 올빼미 밤 벌레 두 배 · 한 우물 절반 · 정원사 나무 열매 −1
static func gather_n(id: String, n: int) -> int:
	if fx().is_empty():
		return n
	var bug := id == "gather_bug"
	n += chance("bugPct" if bug else "gatherPct")
	if bug and has_rule("owl") and is_night():
		n *= OWL_MUL
	if has_rule("onewell"):
		n = maxi(1, roundi(n * ONEWELL_CUT))
	if has_rule("gardener") and (id == "gather_tree" or id == "gather_pine"):
		n = maxi(1, n - 1)
	return n


## 낚은 수 — 한 우물 두 마리 · 올빼미 밤 두 배
static func fish_n() -> int:
	var n := 2 if has_rule("onewell") else 1
	return n * OWL_MUL if has_rule("owl") and is_night() else n


static func fish_win_mul() -> float:
	return 1.0 + sum("fishPct") / 100.0


## 풍성 확률에 더할 몫(forest_craft.gather_roll)
static func bounty_add() -> float:
	return BOUNTY_P * sum("rarePct") / 100.0


static func sell_unit(unit: int) -> int:
	if fx().is_empty():
		return unit
	return roundi(unit * (1.0 + sum("sellPct") / 100.0) * (MISER if has_rule("miser") else 1.0))


## 사는 값 — 알뜰(최대 −50%) · 구두쇠 +25%
static func cost(price: int) -> int:
	if fx().is_empty():
		return price
	return roundi(price * maxf(0.5, 1.0 - sum("buyPct") / 100.0) * (MISER if has_rule("miser") else 1.0))


## 하트 오름(내림은 그대로) — 마을 사랑 두 배 · 작은 마디 +1 확률
static func heart(delta: int) -> int:
	if delta <= 0 or fx().is_empty():
		return delta
	return delta * (LOVE_MUL if has_rule("villagelove") else 1) + chance("heartPct")


static func walk() -> float:
	return (1.0 + sum("walkPct") / 100.0) * (BARE_WALK if has_rule("barehand") else 1.0)


static func no_tool() -> bool:
	return has_rule("barehand")


## 교배 문턱 — m 배만큼 넓힌다(0.45 → 웹 0.45−0.55(m−1), 0.7 도 같은 식)
static func hybrid_cut(cut: float) -> float:
	if fx().is_empty():
		return cut
	var m := (1.0 + sum("flowerPct") / 100.0) * (GARDENER_MUL if has_rule("gardener") else 1.0)
	return maxf(0.02, cut - (1.0 - cut) * (m - 1.0))


## 제작 재료 수 — 손 큰 장인 ×0.7(최소 1)
static func need(n: int) -> int:
	return maxi(1, roundi(n * BIGHAND_NEED)) if has_rule("bighand") else n


static func craft_fee() -> int:
	return BIGHAND_FEE if has_rule("bighand") else 0


static func refund() -> int:
	return chance("craftPct")


## 새벽형 — 오전 끝 시각(순무)
static func morning_end() -> int:
	return 12 + (DAWN_SHIFT if has_rule("dawn") else 0)


static func shop_closed() -> bool:
	return has_rule("owl") and is_dawn()


## ---- 되돌리기 — 집 안에서만, 하루 한 번 무료 ----

static func in_home(tree: SceneTree) -> bool:
	var h := tree.get_first_node_in_group("forest_house")
	return h != null and bool(h.call("is_player_indoors"))


static func free_today() -> bool:
	var F := _node("ForestSaveState")
	return F == null or int((F.get("passive") as Dictionary).get("freeDay", -1)) != ForestDay.today_key()


static func gate(tree: SceneTree, id: String) -> String:
	var a := api()
	if a == null or a.node(id).is_empty():
		return ""
	if a.state(id) == "taken" and String(a.node(id).k) != "o":
		if not in_home(tree):
			return "되돌리기는 집 안에서만"
		var F := _node("ForestSaveState")
		if not free_today() and (F == null or int(F.get("gold")) < DROP_GOLD):
			return "되돌리기 벨 %d 이 모자란다(오늘 무료는 썼다)" % DROP_GOLD
	return ""


static func pay_drop() -> void:
	var F := _node("ForestSaveState")
	if F == null:
		return
	if free_today():
		(F.get("passive") as Dictionary)["freeDay"] = ForestDay.today_key()
	else:
		F.set("gold", int(F.get("gold")) - DROP_GOLD)


static func desc(nd: Dictionary) -> String:
	return String(DESC.get(String(nd.get("rule", "")), nd.get("desc", "")))


static func fmt(stats: Dictionary) -> String:
	var parts_s: Array = []
	for k in stats:
		var lab: Array = LABEL.get(k, [k, ""])
		var v := float(stats[k])
		parts_s.append("%s %s%s%s" % [lab[0], "+" if v >= 0.0 else "", str(snappedf(v, 0.1)).trim_suffix(".0"), lab[1]])
	return " · ".join(parts_s)
