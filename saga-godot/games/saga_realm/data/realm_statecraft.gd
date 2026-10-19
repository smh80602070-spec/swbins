extends RefCounted

## G-0216 5천하 경륜도(經綸圖) — 플레이어 세력의 PoE식 패시브 그물(웹 saga-web/saga-realm/js/statecraft.js W-0182 고돗판). 본보기 games/saga_go/data/go_starchart.gd.
## 규칙·화면은 공용(saga_core/data/passive_web.gd·ui/passive_web_screen.gd), 정의는 data/passive_def.json(tools/passive_from_web.mjs saga-realm),
## 찍은 것은 RealmSaveState.passive {start, taken}(세이브 키 "passive", 19→20).
## 고돗 천하의 AI 세력은 금·인구가 없어(성마다 기록만) 이 티켓은 플레이어 세력만 — AI 경륜도는 다음 후보.
##
## 점수(재해석) = 첫 별 1 + 빼앗은 성 수(enemies[].captured) + ⌊지난 달 수/6⌋, 상한 CAP 56 — 웹의 이정표가 고돗엔 없다.
## 재해석 셋 더: 철기 = 기병 구분이 없어 야전 ×1.4·공성 ×0.8 · 청야 = 사기·진이 없어 내 성을 치는 AI 군 공격 ×0.8 ·
## 되돌리기(금 DROP_GOLD) = 원정이 바로 끝나 "이번 달 아무 명령 전"에만.
## 빈 경륜도는 곱이 전부 1 이라 realm_golden md5 가 비트 그대로다(곱하는 자리는 값이 1 이 아닐 때만 손댄다).
## autoload 이름을 직접 쓰지 않는다(점검이 이 파일을 부르는 규칙 파일을 preload) · static 엔 객체 말고 id 만.

const DEF_PATH := "res://games/saga_realm/data/passive_def.json"
## 손잡이 — 웹 rk.pw.* 기본값
const CAP := 56
const DROP_GOLD := 150
const TUNJEON_EAT := 0.5
const TUNJEON_DRAFT := 0.7
const CHEOLGI_FIELD := 1.4
const CHEOLGI_SIEGE := 0.8
const WONGYO_FAR := 1.5
const WONGYO_NEAR := 0.6
const ILIN_TOP := 1.5
const ILIN_REST := 0.9
const GONG_WALL := 2.0
const GONG_FIELD := 0.85
const MUWI_FOOD := 2.0
const HWAGONG_FIRE := 2.0
const CHEONGYA_ENEMY := 0.8
const CHEONGYA_SELF := 0.8
const LABEL := {"foodPct": ["수확", "%"], "goldPct": ["금 수입", "%"], "govPct": ["개간·상업", "%"], "atkPct": ["출병 공격", "%"],
	"defPct": ["받는 피해 줄임", "%"], "wallPct": ["축성", "%"], "plotPct": ["계략", "%"], "diploPct": ["외교", "%"],
	"hirePct": ["등용", "%"], "expPct": ["무장 경험", "%"], "troopPct": ["징병", "%"]}
const DESC := {"cheolgi": "야전 공격 +40%, 성을 칠 때 −20%(고돗엔 기병 구분이 없다)",
	"cheongya": "내 성을 치러 온 적 공격 −20%, 내 금·수확 −20%",
	"muwi": "금 수입 0, 수확·개간·상업 두 배",
	"hwagong": "화계 불 두 배, 6·7월·수해 든 달엔 화계를 못 놓는다"}

static var _def: Dictionary = {}
static var _fx: Dictionary = {}
static var _fx_api_id := 0
static var _fx_rev := -1
static var _fx_tech_rev := -1   # G-0234 기술 나무를 연구하면 다시 셈
static var _fx_wonder_rev := -1   # G-0243 불가사의가 완공되면 다시 셈
const Tech := preload("res://games/saga_realm/data/realm_tech.gd")
const Wonder := preload("res://games/saga_realm/data/realm_wonder.gd")


static func _rs() -> Node:
	var ml := Engine.get_main_loop() as SceneTree
	return ml.root.get_node_or_null("RealmSaveState") if ml != null else null


static func definition() -> Dictionary:
	if _def.is_empty():
		_def = (load("res://saga_core/data/passive_web.gd") as GDScript).call("load_def", DEF_PATH)
	return _def


## 지난 달 수 — 시나리오 id 가 시작 해(예 "194")라 그 해 1월부터 센다
static func months_played(rs: Object) -> int:
	var start := int(String(rs.get("scenario_id")))
	if start <= 0:
		return 0
	return maxi(0, (int(rs.get("year")) - start) * 12 + int(rs.get("month")) - 1)


static func points_total() -> int:
	var rs := _rs()
	if rs == null:
		return 0
	var captured := 0
	for e in (rs.get("enemies") as Dictionary).values():
		if bool((e as Dictionary).get("captured", false)):
			captured += 1
	return mini(CAP, 1 + captured + months_played(rs) / 6)


static func api() -> RefCounted:
	var rs := _rs()
	return rs.call("passive_api") if rs != null else null


static func fx() -> Dictionary:
	var a := api()
	if a == null:
		return {}
	if a.get_instance_id() == _fx_api_id and int(a.rev) == _fx_rev and Tech.rev == _fx_tech_rev and Wonder.rev == _fx_wonder_rev:
		return _fx
	_fx_api_id = a.get_instance_id()
	_fx_rev = int(a.rev)
	_fx_tech_rev = Tech.rev
	_fx_wonder_rev = Wonder.rev
	var pct := func(k: String) -> float: return 1.0 + (float(a.sum(k)) + Tech.pct(k) + Wonder.pct(Wonder.ME, k)) / 100.0   # G-0234 기술 나무 % · G-0243 불가사의 % 도 같은 자리(웹 statecraft.sum 이 tech.pct·wonder.pct 를 더하는 꼴)
	var r := {}
	for k in ["tunjeon", "cheolgi", "wongyo", "ilin", "gongseong", "muwi", "hwagong", "cheongya"]:
		r[k] = bool(a.has(k))
	_fx = {
		"gold": pct.call("goldPct") * (0.0 if r.muwi else 1.0) * (CHEONGYA_SELF if r.cheongya else 1.0),
		"food": pct.call("foodPct") * (MUWI_FOOD if r.muwi else 1.0) * (CHEONGYA_SELF if r.cheongya else 1.0),
		"eat": TUNJEON_EAT if r.tunjeon else 1.0,
		"gov": pct.call("govPct") * (MUWI_FOOD if r.muwi else 1.0),
		"wall": pct.call("wallPct"),
		"draft": pct.call("troopPct") * (TUNJEON_DRAFT if r.tunjeon else 1.0),
		"hire": pct.call("hirePct"),
		"diplo": pct.call("diploPct"),
		"plot": pct.call("plotPct"),
		"fire": HWAGONG_FIRE if r.hwagong else 1.0,
		"atk": pct.call("atkPct"),
		"take": maxf(0.5, 1.0 - (float(a.sum("defPct")) + Tech.pct("defPct") + Wonder.pct(Wonder.ME, "defPct")) / 100.0),   # G-0243 만리 장벽 · G-0244 방패 벽
		"field": (CHEOLGI_FIELD if r.cheolgi else 1.0) * (GONG_FIELD if r.gongseong else 1.0),
		"siege": CHEOLGI_SIEGE if r.cheolgi else 1.0,
		"chip": GONG_WALL if r.gongseong else 1.0,
		"exp": pct.call("expPct"),
		"enemy_atk": CHEONGYA_ENEMY if r.cheongya else 1.0,
		"rules": r,
	}
	return _fx


static func mul(key: String) -> float:
	return float(fx().get(key, 1.0))


static func has_rule(rule: String) -> bool:
	return bool((fx().get("rules", {}) as Dictionary).get(rule, false))


## 명령 하나의 배수(개간·상업 = gov · 축성 = wall · 징병 = draft · 나머지 1)
static func order_mul(key: String) -> float:
	match key:
		"agri", "comm":
			return mul("gov")
		"wall":
			return mul("wall")
		"draft":
			return mul("draft")
	return 1.0


## 외교 배수 — 원교근공은 맞닿은 세력 ×0.6, 안 맞닿은 ×1.5
static func diplo_mul(touching: bool) -> float:
	var m := mul("diplo")
	if has_rule("wongyo"):
		m *= WONGYO_NEAR if touching else WONGYO_FAR
	return m


## 일인지하 — 으뜸 무장(군주 빼고 능력 합이 가장 높은 사람) ×1.5, 나머지 ×0.9
static func officer_mul(rs: Object, id: String) -> float:
	if not has_rule("ilin"):
		return 1.0
	return ILIN_TOP if id == top_officer(rs) else ILIN_REST


static var _top_cache := ""
static var _top_rev := -1


static func top_officer(rs: Object) -> String:
	var a := api()
	var key := int(a.rev) * 1000 + (rs.get("roster") as Array).size()
	if key == _top_rev:
		return _top_cache
	var Ch: GDScript = load("res://saga_core/data/characters.gd")
	var best := ""
	var best_v := -1.0
	for id in rs.get("roster"):
		var h = Ch.call("find", String(id))
		if h == null:
			continue
		var v := 0.0
		for k in ["might", "wisdom", "command"]:
			v += float(h.stats.get(k, 0))
		if v > best_v:
			best_v = v
			best = String(id)
	_top_cache = best
	_top_rev = key
	return best


## 화공 — 비 오는 달(6·7월)이나 그 성에 수해가 들었으면 화계 막음
static func fire_blocked(month: int, flood: bool) -> bool:
	return has_rule("hwagong") and (month == 6 or month == 7 or flood)


## 화면 막음 — "" 면 됨. 되돌리기는 이번 달 아무 명령 전에만·금 DROP_GOLD
static func gate(id: String) -> String:
	var a := api()
	var rs := _rs()
	if a == null or rs == null or a.node(id).is_empty():
		return ""
	if a.state(id) == "taken" and String(a.node(id).k) != "o":
		if not (rs.get("_done_this_month") as Dictionary).is_empty():
			return "되돌리기는 이번 달 명령 전에만"
		if int(rs.get("gold")) < DROP_GOLD:
			return "되돌리기 금 %d 이 모자란다" % DROP_GOLD
	return ""


static func pay_drop() -> void:
	var rs := _rs()
	if rs != null:
		rs.set("gold", int(rs.get("gold")) - DROP_GOLD)


static func desc(nd: Dictionary) -> String:
	return String(DESC.get(String(nd.get("rule", "")), nd.get("desc", "")))


static func fmt(stats: Dictionary) -> String:
	var parts: Array = []
	for k in stats:
		var lab: Array = LABEL.get(k, [k, ""])
		var v := float(stats[k])
		parts.append("%s %s%s%s" % [lab[0], "+" if v >= 0.0 else "", str(snappedf(v, 0.1)).trim_suffix(".0"), lab[1]])
	return " · ".join(parts)
