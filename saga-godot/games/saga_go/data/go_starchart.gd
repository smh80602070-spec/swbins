extends RefCounted

## G-0215 1만리 성도(星圖) — PoE식 패시브 그물(웹 saga-web/saga-go/js/starchart.js W-0181 고돗판). 본보기 games/saga_story/data/story_constellation.gd(G-0214).
## 규칙·화면은 공용(saga_core/data/passive_web.gd·ui/passive_web_screen.gd), 정의는 data/passive_def.json(tools/passive_from_web.mjs saga-go),
## 찍은 것은 PartyState.passive {start, taken}(세이브 키 "passive").
##
## 점수(재해석) = 첫 별 1 + (모험 등급 − 1 = PartyState.level) + ⌊도감 종/10⌋, 상한 CAP 56 — 웹은 봉수대·사당 수지만 고돗은 둘 다 저장 안 한다.
## 효과(웹 61~89): pct(k) = 1 + 합/100. 귀한 조우(spawnRarePct)·큰 그물 조우 ×2 → 고돗엔 마구 깔리는 조우가 없어 알 얻을 확률로,
## 인연(bondPct) → 펫 우정 걸음으로 다시 읽는다. 되돌리기는 어디서나 한 마디 모라 DROP_COST.
## 이 파일은 점검(SceneTree)이 preload 하는 파일들(party_state·field_combat 등)이 부르므로 autoload 이름을 직접 쓰지 않는다(트리에서 찾는다).
## 효과 배수는 api.rev 가 바뀔 때만 다시 센다(static 엔 객체 말고 id 만 — 종료 segfault, G-0214).

const DEF_PATH := "res://games/saga_go/data/passive_def.json"
## 손잡이 — 웹 go.pw.* 기본값
const CAP := 56
const DROP_COST := 120
const BAREFOOT_MOVE := 1.25
const BAREFOOT_EGG := 0.7
const IRON_MOVE := 0.85
const IRON_TAKE := 0.7
const ONEPATH := 1.6
const NIGHT_UP := 1.4
const DAY_DOWN := 0.8
const BIGNET_RECRUIT := 0.75
const BIGNET_SPAWN := 2.0
const BLITZ_SEC := 45.0
const BLITZ_ATK := 1.35
const UNBOUND_HERB := 0.5
const UNBOUND_EXP := 50.0
const WIND_FLY := 1.3
const WIND_GROUND := 0.7
const LABEL := {"movePct": ["이동", "%"], "spawnRarePct": ["알 얻을 확률", "%"], "catchPct": ["포획", "%"], "hpPct": ["동료 체력", "%"],
	"atkPct": ["동료 공격", "%"], "recruitPct": ["설득", "%"], "eggPct": ["알 걸음 줄임", "%"], "herbPct": ["채집", "%"],
	"bondPct": ["펫 우정", "%"], "kiPct": ["결투 기", "%"], "expPct": ["경험", "%"]}

## 다시 해석한 규칙의 카드 글(웹 정의 desc 는 웹 기능 이름이라 덮어쓴다 — 정의 파일은 생성물이라 안 고침)
const DESC := {"barefoot": "탈것을 못 탄다, 걷기 +25% · 알 걸음 −30%", "bignet": "상자·비경에서 알 얻을 확률 두 배, 등용 설득 −25%",
	"onepath": "들판 싸움에 동행 한 명만 선다, 동료 공격·체력 +60%"}

static var _def: Dictionary = {}
static var _fx: Dictionary = {}
static var _fx_api_id := 0
static var _fx_rev := -1


static func _node(name: String) -> Node:
	var ml := Engine.get_main_loop() as SceneTree
	return ml.root.get_node_or_null(name) if ml != null else null


static func definition() -> Dictionary:
	if _def.is_empty():
		_def = (load("res://saga_core/data/passive_web.gd") as GDScript).call("load_def", DEF_PATH)
	return _def


## 도감 종 수(인물·펫만 — "kind:id" 키 중)
static func codex_species() -> int:
	var cs := _node("CodexState")
	if cs == null:
		return 0
	var n := 0
	for k in (cs.get("book") as Dictionary):
		if String(k).begins_with("pet:") or String(k).begins_with("char:"):
			n += 1
	return n


static func points_total() -> int:
	var ps := _node("PartyState")
	var lv: int = int(ps.get("level")) if ps != null else 0
	return mini(CAP, 1 + maxi(0, lv) + codex_species() / 10)


static func api() -> RefCounted:
	var ps := _node("PartyState")
	return ps.call("passive_api") if ps != null else null


## 효과 배수 묶음 — 성도가 비면 전부 1(또는 0)이라 기존 수치 그대로
static func fx() -> Dictionary:
	var a := api()
	if a == null:
		return {}
	if a.get_instance_id() == _fx_api_id and int(a.rev) == _fx_rev:
		return _fx
	_fx_api_id = a.get_instance_id()
	_fx_rev = int(a.rev)
	var pct := func(k: String) -> float: return 1.0 + float(a.sum(k)) / 100.0
	var r := {}
	for k in ["onepath", "barefoot", "nightowl", "blitz", "unbound", "ironwall", "bignet", "windroad"]:
		r[k] = bool(a.has(k))
	_fx = {
		"move": pct.call("movePct") * (BAREFOOT_MOVE if r.barefoot else 1.0) * (IRON_MOVE if r.ironwall else 1.0),
		"atk": pct.call("atkPct") * (ONEPATH if r.onepath else 1.0),
		"hp": pct.call("hpPct") * (ONEPATH if r.onepath else 1.0),
		"take": IRON_TAKE if r.ironwall else 1.0,
		"recruit": pct.call("recruitPct") * (BIGNET_RECRUIT if r.bignet else 1.0),
		"egg_walk": maxf(0.4, 1.0 - float(a.sum("eggPct")) / 100.0) * (BAREFOOT_EGG if r.barefoot else 1.0),
		"egg_find": pct.call("spawnRarePct") * (BIGNET_SPAWN if r.bignet else 1.0),
		"herb": pct.call("herbPct") * (UNBOUND_HERB if r.unbound else 1.0),
		"bond": pct.call("bondPct"),
		"catch": pct.call("catchPct"),
		"exp": 1.0 + (float(a.sum("expPct")) + (UNBOUND_EXP if r.unbound else 0.0)) / 100.0,
		"ki": pct.call("kiPct"),
		"raid_atk": pct.call("atkPct") * (BLITZ_ATK if r.blitz else 1.0),
		"rules": r,
	}
	return _fx


static func mul(key: String) -> float:
	return float(fx().get(key, 1.0))


static func has_rule(rule: String) -> bool:
	return bool((fx().get("rules", {}) as Dictionary).get(rule, false))


## 설득 — 야행은 밤(21~4시)에 ×1.4, 낮 ×0.8
static func recruit_mul() -> float:
	var m := mul("recruit")
	if has_rule("nightowl"):
		var night: bool = bool((load("res://games/saga_go/data/time_of_day.gd") as GDScript).call("is_night"))
		m *= NIGHT_UP if night else DAY_DOWN
	return m


## 토벌 제한 시간(속전이면 45초)
static func raid_sec(base: float) -> float:
	return BLITZ_SEC if has_rule("blitz") else base


## 탈것 속도 배수(바람길: 날 때 ×1.3, 땅 ×0.7)
static func mount_mul(flying: bool) -> float:
	if not has_rule("windroad"):
		return 1.0
	return WIND_FLY if flying else WIND_GROUND


## 들판에 함께 서는 동료 수 상한(외길이면 1)
static func party_cap(n: int) -> int:
	return 1 if has_rule("onepath") else n


## 채집 수 — 배수의 소수는 확률로 한 개 더(기존 굴림 뒤에 따로 굴린다)
static func herb_count(base: int) -> int:
	var m := float(base) * mul("herb")
	var n := int(floor(m))
	if randf() < m - float(n):
		n += 1
	return n


## 화면 막음 — "" 면 됨. 되돌리기는 모라 DROP_COST
static func gate(id: String) -> String:
	var a := api()
	if a == null or a.node(id).is_empty():
		return ""
	if a.state(id) == "taken" and String(a.node(id).k) != "o":
		var ps := _node("PartyState")
		if ps != null and not bool(ps.call("has_items", {"mora": DROP_COST})):
			return "되돌리기 모라 %d 이 모자란다" % DROP_COST
	return ""


static func pay_drop() -> void:
	var ps := _node("PartyState")
	if ps != null:
		ps.call("spend_items", {"mora": DROP_COST})


static func desc(nd: Dictionary) -> String:
	return String(DESC.get(String(nd.get("rule", "")), nd.get("desc", "")))


static func fmt(stats: Dictionary) -> String:
	var parts: Array = []
	for k in stats:
		var lab: Array = LABEL.get(k, [k, ""])
		var v := float(stats[k])
		parts.append("%s %s%s%s" % [lab[0], "+" if v >= 0.0 else "", str(snappedf(v, 0.1)).trim_suffix(".0"), lab[1]])
	return " · ".join(parts)
