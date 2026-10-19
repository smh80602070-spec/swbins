extends RefCounted

## G-0219 5천하 AI 세력 경륜도 — 웹 saga-web/saga-realm/js/statecraft.js aiSpend(W-0182)의 고돗판. 플레이어 경륜도는 realm_statecraft.gd(G-0216).
## AI 세력마다 한 장(RealmSaveState.ai_passive {세력: {start, taken, won}}), 달 넘김마다 쌓인 점수를 성향(RealmCities.CREED)대로 찍는다 —
## 시작점 = CREED_START[성향][hash%2], 길 = 시작점 테마 능력치를 가진 이름난 마디 중 가장 가까운 것, 20마디 넘고 규칙이 없으면 CREED_KEY[성향][hash%2].
## 굴림 없음(결정적) — 전쟁 난수(_rng) 차례를 안 바꾼다.
## 재해석(고돗 AI 는 성을 못 빼앗고 금·인구·군량·외교·계략 행동이 없다):
##   점수 = 1 + 이긴 출병 수(won) + ⌊지난 달/6⌋(상한 56) · 출병 give = pct(atkPct)·야전 철기 1.4×공성 전문 0.85·공성 철기 0.8(싸움이 정함), take = max(0.5, 1−defPct/100), chip = 공성 전문 2 ·
##   수비(플레이어가 칠 때) = 내 give ×AI take×(AI 청야 0.8), 내 take ×pct(AI atkPct) · 성장 보안·기술 = pct(govPct)×(무위 2)×(청야 0.8)×(둔전 1.5),
##   성벽 = pct(wallPct), 훈련 = pct(troopPct)×(둔전 0.7) · 일인지하 = 그 세력 군의 으뜸 통솔·무력 ×1.5 · 원교근공·화공 = AI 행동이 없어 효과 없음.
## autoload 이름을 직접 쓰지 않는다(rs 를 받는다) · static 엔 객체 말고 값만(세력별 효과 캐시는 api id·rev 와 사전).

const SC := preload("res://games/saga_realm/data/realm_statecraft.gd")
const RealmCities := preload("res://games/saga_realm/data/realm_cities.gd")
const Wonder := preload("res://games/saga_realm/data/realm_wonder.gd")   # G-0243 불가사의 %
const AI_ON := true   # 점검(골든)이 끄고 옛 값을 재현한다
const CAP := 56
const KEY_AT := 20
const GUARD := 80
const THEME := {"mokmin": ["goldPct", "foodPct", "govPct"], "general": ["atkPct", "defPct", "troopPct"], "diplomat": ["diploPct", "plotPct", "goldPct"],
	"talent": ["hirePct", "expPct", "govPct"], "schemer": ["plotPct", "atkPct", "expPct"], "builder": ["wallPct", "defPct", "troopPct"]}
const CREED_START := {"aggressive": ["general", "schemer"], "balanced": ["mokmin", "talent"], "turtle": ["builder", "diplomat"]}
const CREED_KEY := {"aggressive": ["k_gongseong", "k_cheolgi"], "balanced": ["k_tunjeon", "k_ilin"], "turtle": ["k_cheongya", "k_wongyo"]}
const TUNJEON_GOV := 1.5
const ILIN_BEST := 1.5
const RULE_NAMES := {"tunjeon": "둔전", "cheolgi": "철기", "wongyo": "원교근공", "ilin": "일인지하", "gongseong": "공성 전문", "muwi": "무위", "hwagong": "화공", "cheongya": "청야"}

static var _fx: Dictionary = {}   # 세력 → {id, rev, fx}


## 웹 hashOf — h = h*31 + 글자(32비트 부호 정수) → 절댓값
static func hash_of(s: String) -> int:
	var h := 0
	for i in s.length():
		h = (h * 31 + s.unicode_at(i)) & 0xFFFFFFFF
	if h >= 0x80000000:
		h -= 0x100000000
	return absi(h)


static func creed_start(fid: String) -> String:
	var l: Array = CREED_START.get(RealmCities.creed_of(fid), CREED_START.balanced)
	return String(l[hash_of(fid) % l.size()])


static func creed_key(fid: String) -> String:
	var l: Array = CREED_KEY.get(RealmCities.creed_of(fid), CREED_KEY.balanced)
	return String(l[hash_of(fid) % l.size()])


static func store(rs: Object, fid: String) -> Dictionary:
	var all: Dictionary = rs.get("ai_passive")
	if typeof(all.get(fid)) != TYPE_DICTIONARY:
		all[fid] = {"start": null, "taken": [], "won": 0}
	return all[fid]


static func points_total(rs: Object, fid: String) -> int:
	return mini(CAP, 1 + int(store(rs, fid).get("won", 0)) + SC.months_played(rs) / 6)


static func api(rs: Object, fid: String) -> RefCounted:
	return rs.call("ai_passive_api", fid)


## 쌓인 점수를 다 찍는다 — 찍은 마디 수
static func spend(rs: Object, fid: String) -> int:
	var a := api(rs, fid)
	if a == null or a.left() <= 0:
		return 0
	if a.store.start == null:
		a.set_start(creed_start(fid))
	var theme: Array = THEME.get(String(a.store.start), [])
	var n := 0
	var guard := 0
	while a.left() > 0 and guard < GUARD:
		guard += 1
		var target: Dictionary = {}
		if a.used() >= KEY_AT and not _has_any_rule(a):
			var kp: Dictionary = a.path_to(creed_key(fid))
			if not kp.is_empty() and int(kp.cost) <= a.left():
				target = kp
		if target.is_empty():
			var best: Dictionary = {}
			var best_t: Dictionary = {}
			var costs: Dictionary = a.cost_map()   # 너비 우선 한 번(마디마다 path_to 면 달 넘김이 0.1~0.5초 멎는다)
			for nd: Dictionary in a.def.nodes:
				var nid := String(nd.id)
				if String(nd.k) != "n" or not costs.has(nid):
					continue
				var c := int(costs[nid])
				var themed := (nd.get("stats", {}) as Dictionary).keys().any(func(k): return theme.has(k))
				if themed and (best_t.is_empty() or c < int(best_t.cost)):
					best_t = {"id": nid, "cost": c}
				if best.is_empty() or c < int(best.cost):
					best = {"id": nid, "cost": c}
			var pick: Dictionary = best_t if not best_t.is_empty() else best
			target = a.path_to(String(pick.id)) if not pick.is_empty() else {}
		if target.is_empty() or (target.path as Array).is_empty():
			break
		var took := 0
		for id in target.path:
			if a.left() > 0 and a.take(String(id)):
				took += 1
		n += took
		if took == 0:
			break
	return n


static func _has_any_rule(a: RefCounted) -> bool:
	for nd: Dictionary in a.def.nodes:
		if String(nd.k) == "k" and a.is_taken(String(nd.id)):
			return true
	return false


## 찍은 규칙 이름("" = 없음) — 소식 글
static func rule_name(rs: Object, fid: String) -> String:
	var r: Dictionary = fx(rs, fid).get("rules", {})
	for k in r:
		if bool(r[k]):
			return String(RULE_NAMES.get(k, k))
	return ""


static func fx(rs: Object, fid: String) -> Dictionary:
	if not AI_ON or fid == "":
		return {}
	var all: Dictionary = rs.get("ai_passive")
	if not all.has(fid):
		return {}
	var a := api(rs, fid)
	var c: Dictionary = _fx.get(fid, {})
	if not c.is_empty() and int(c.id) == a.get_instance_id() and int(c.rev) == int(a.rev) and int(c.get("wrev", -1)) == Wonder.rev:
		return c.fx
	var pct := func(k: String) -> float: return 1.0 + (float(a.sum(k)) + Wonder.pct(fid, k, rs)) / 100.0   # G-0243 불가사의 % 도 같은 자리
	var r := {}
	for k in RULE_NAMES:
		r[k] = bool(a.has(k))
	var f := {
		"atk": pct.call("atkPct"),
		"field": (SC.CHEOLGI_FIELD if r.cheolgi else 1.0) * (SC.GONG_FIELD if r.gongseong else 1.0),
		"siege": SC.CHEOLGI_SIEGE if r.cheolgi else 1.0,
		"def_atk": pct.call("atkPct"),
		"take": maxf(0.5, 1.0 - (float(a.sum("defPct")) + Wonder.pct(fid, "defPct", rs)) / 100.0),
		"chip": SC.GONG_WALL if r.gongseong else 1.0,
		"hit_me": SC.CHEONGYA_ENEMY if r.cheongya else 1.0,
		"gov": pct.call("govPct") * (SC.MUWI_FOOD if r.muwi else 1.0) * (SC.CHEONGYA_SELF if r.cheongya else 1.0) * (TUNJEON_GOV if r.tunjeon else 1.0),
		"wall": pct.call("wallPct"),
		"train": pct.call("troopPct") * (SC.TUNJEON_DRAFT if r.tunjeon else 1.0),
		"best": ILIN_BEST if r.ilin else 1.0,
		"rules": r,
	}
	_fx[fid] = {"id": a.get_instance_id(), "rev": int(a.rev), "wrev": Wonder.rev, "fx": f}
	return f


static func mul(rs: Object, fid: String, key: String) -> float:
	return float(fx(rs, fid).get(key, 1.0))


## 성장 명령 하나의 배수(보안·기술 = gov · 성벽 = wall · 훈련 = train)
static func order_mul(rs: Object, fid: String, key: String) -> float:
	match key:
		"sec", "tech":
			return mul(rs, fid, "gov")
		"wall":
			return mul(rs, fid, "wall")
		"train":
			return mul(rs, fid, "train")
	return 1.0
