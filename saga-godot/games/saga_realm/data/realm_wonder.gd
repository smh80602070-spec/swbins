extends RefCounted

## G-0243 5천하 불가사의 경쟁 — 웹 saga-web/saga-realm/js/wonder.js(W-0279) 이식, 표 여섯·REFUND 0.5·문턱 2.5 그대로.
##   세상에 하나뿐인 큰 건축 여섯. 금과 인부(그 성 병력)를 들여 짓기 시작하고, **먼저 다 지은 세력만** 효과(세력 전체 배율)를 갖는다.
##   같은 것을 짓던 다른 세력은 들인 금의 반을 돌려받고 인부도 돌아온다(성을 잃었으면 인부도 잃는다). 한 세력은 한 번에 하나만.
##   효과는 경륜도 합산 자리에 더한다 — 우리 = realm_statecraft.gd fx 의 pct·take, AI = realm_ai_statecraft.gd fx 의 pct·take.
## 재해석(고돗 천하 AI 는 금이 없다 — 성마다 병력만):
##   인부 = 웹 men × MEN_SCALE 0.25 — 고돗 천하 병력은 웹의 약 1/4(AI 성 800~2267, 웹 그대로 1500~3000 이면 AI 가 영영 못 짓는다, 10-19 측정).
##   AI 문턱 = 병력이 가장 많은 성 troops ≥ 인부 × AI_MEN(웹 "금 ≥ 비용 × 2.5" 의 자리) · 금을 안 내고 환급도 금 없이 인부만 ·
##   AI 병력은 달마다 늘지 않아 문턱만으론 첫 달에 다 착공한다 → 웹에서 금을 모으는 시간 자리에 AI_FROM 12달(둘째 해부터) + 세력마다 hash 로 AI_EVERY 달에 한 번만 본다 ·
##   고르기 = 웹 hashOf(세력 + 달 수) % 남은 것(굴림 없음 — 전쟁 난수 차례를 안 바꾼다) · AI 는 기술 문이 없다(웹도 AI 는 문 안 봄 — 연구를 안 해서).
##   AI 는 금·군량·계략 행동이 없어 물길·장원·별 보는 대는 AI 에겐 빈 효과(수비·공격·내정만 걸린다).
##   우리 세력은 고돗 천하에 세력 id 가 없어 realm_supply.ME("me"). 같은 달 둘이 끝나면 먼저 센 쪽(세력 id 정렬).
## 상태 RealmSaveState.wonders = {built: {id: {by, at, city}}, jobs: {세력: {id, city, left, gold, men}}}(세이브 키 "wonders", 23→24).
## autoload 이름을 직접 쓰지 않는다(rs 를 받는다 — realm_statecraft.gd 와 같은 규칙).

const Tech := preload("res://games/saga_realm/data/realm_tech.gd")
const RealmCities := preload("res://games/saga_realm/data/realm_cities.gd")
const Characters := preload("res://saga_core/data/characters.gd")

const WONDERS := [
	{"id": "wall", "name": "만리 장벽", "emoji": "🧱", "months": 12, "gold": 4000, "men": 3000, "key": "defPct", "pct": 10, "desc": "세력 전체 수비 +10%"},
	{"id": "canal", "name": "큰 물길", "emoji": "🛶", "months": 10, "gold": 3600, "men": 2500, "key": "goldPct", "pct": 8, "desc": "세력 전체 금 수입 +8%"},
	{"id": "star", "name": "별 보는 대", "emoji": "🔭", "months": 8, "gold": 3000, "men": 1500, "key": "plotPct", "pct": 10, "desc": "계략 성공률 +10%"},
	{"id": "school", "name": "큰 배움터", "emoji": "📚", "months": 9, "gold": 3200, "men": 1500, "key": "govPct", "pct": 8, "desc": "내정(개간·상업·기술·치안) +8%"},
	{"id": "farm", "name": "너른 장원", "emoji": "🌾", "months": 7, "gold": 2600, "men": 2000, "key": "foodPct", "pct": 10, "desc": "세력 전체 군량 +10%"},
	{"id": "bridge", "name": "큰 다리", "emoji": "🌉", "months": 6, "gold": 2400, "men": 2000, "key": "atkPct", "pct": 6, "desc": "세력 전체 공격 +6%"},
]
const REFUND := 0.5
const AI_MEN := 2.5
const MEN_SCALE := 0.25   # 고돗 병력 척도(위 머리말)
const SPARE := 500   # 웹 why — 인부를 빼고도 성에 이만큼(× MEN_SCALE)은 남아야 한다
const AI_FROM := 12   # AI 는 둘째 해부터 착공(지난 달 수)
const AI_EVERY := 6   # AI 세력마다 hash(세력+달) % 6 == 0 인 달에만 착공을 본다
const AI_BUILD := true   # false 면 AI 가 안 짓는다 — 골든 옛 값 확인용 손잡이(realm_supply CAMP_ON 과 같은 결)
const ME := "me"

## 완공·불러오기·새 판마다 오른다 — 두 경륜도 fx 캐시가 이 값도 본다.
static var rev := 0


static func bump() -> void:
	rev += 1


static func _rs() -> Node:
	var ml := Engine.get_main_loop() as SceneTree
	return ml.root.get_node_or_null("RealmSaveState") if ml != null else null


## 고돗 인부 수(웹 men × MEN_SCALE)
static func men(w: Dictionary) -> int:
	return roundi(float(w.men) * MEN_SCALE)


static func by_id(id: String) -> Dictionary:
	for w: Dictionary in WONDERS:
		if String(w.id) == id:
			return w
	return {}


static func state(rs: Object) -> Dictionary:
	if rs == null:
		return {"built": {}, "jobs": {}}
	var w: Variant = rs.get("wonders")
	if not (w is Dictionary):
		w = {}
		rs.set("wonders", w)
	if not ((w as Dictionary).get("built") is Dictionary):
		w["built"] = {}
	if not ((w as Dictionary).get("jobs") is Dictionary):
		w["jobs"] = {}
	return w


## 그 세력이 가진 불가사의의 그 키 합(%). rs 를 안 주면 autoload.
static func pct(fid: String, key: String, rs: Object = null) -> float:
	var r := rs if rs != null else _rs()
	if r == null or fid == "":
		return 0.0
	var built: Variant = (r.get("wonders") as Dictionary).get("built", {}) if r.get("wonders") is Dictionary else {}
	var n := 0.0
	for id in built:
		if String((built[id] as Dictionary).get("by", "")) == fid:
			var w := by_id(String(id))
			if not w.is_empty() and String(w.key) == key:
				n += float(w.pct)
	return n


static func built_by(rs: Object, id: String) -> String:
	return String((state(rs).built as Dictionary).get(id, {}).get("by", ""))


static func job_of(rs: Object, fid: String) -> Dictionary:
	return (state(rs).jobs as Dictionary).get(fid, {})


## 이 불가사의를 짓는 중인 세력들 [{force, left, months}]
static func racers(rs: Object, id: String) -> Array:
	var out: Array = []
	var jobs: Dictionary = state(rs).jobs
	var ks := jobs.keys()
	ks.sort()
	for f in ks:
		if String(jobs[f].id) == id:
			out.append({"force": String(f), "left": int(jobs[f].left), "months": int(by_id(id).months)})
	return out


## 세력이 지금 가진 성 id(우리 = cities, AI = 안 함락된 적 성 중 그 세력)
static func cities_of(rs: Object, fid: String) -> Array:
	if fid == ME:
		return (rs.get("cities") as Dictionary).keys()
	var out: Array = []
	var en: Dictionary = rs.get("enemies")
	for eid in en:
		if not bool((en[eid] as Dictionary).get("captured", false)) and String(rs.call("force_of", String(eid))) == fid:
			out.append(String(eid))
	out.sort()
	return out


static func owns(rs: Object, fid: String, cid: String) -> bool:
	return cities_of(rs, fid).has(cid)


static func _city(rs: Object, fid: String, cid: String) -> Dictionary:
	return (rs.get("cities") if fid == ME else rs.get("enemies")).get(cid, {})


static func force_name(fid: String) -> String:
	if fid == ME:
		return "우리"
	var h = Characters.find(String(RealmCities.FORCE_LORD.get(fid, "")))
	return String(h.name) if h != null else fid


static func city_name(cid: String) -> String:
	return String(RealmCities.any_by_id(cid).get("name", cid))


## 시작할 수 있나 — 못 하면 까닭(빈 글 = 됨). AI 는 금·기술 문을 안 본다.
static func why(rs: Object, fid: String, id: String, cid: String) -> String:
	var w := by_id(id)
	if w.is_empty():
		return "없는 불가사의"
	var by := built_by(rs, id)
	if by != "":
		return "이미 %s 이(가) 지었다" % force_name(by)
	if fid == ME and not Tech.wonder_open():
		return "학 갈래 「큰 도면」을 먼저 연구해야 한다"
	var j := job_of(rs, fid)
	if not j.is_empty():
		return "이미 %s 을(를) 짓는 중" % String(by_id(String(j.id)).get("name", ""))
	if not owns(rs, fid, cid):
		return "우리 성에서만 짓는다"
	if fid == ME and int(rs.get("gold")) < int(w.gold):
		return "금이 모자란다(💰%d)" % int(w.gold)
	if int(_city(rs, fid, cid).get("troops", 0)) < men(w) + roundi(SPARE * MEN_SCALE):
		return "인부(병력 %d + 남길 %d)가 모자란다" % [men(w), roundi(SPARE * MEN_SCALE)]
	return ""


## 짓기 시작 — {ok, why} 또는 {ok, months}
static func start(rs: Object, fid: String, id: String, cid: String) -> Dictionary:
	var reason := why(rs, fid, id, cid)
	if reason != "":
		return {"ok": false, "why": reason}
	var w := by_id(id)
	var gold := int(w.gold) if fid == ME else 0
	if fid == ME:
		rs.set("gold", int(rs.get("gold")) - gold)
	var c := _city(rs, fid, cid)
	c["troops"] = int(c.troops) - men(w)
	state(rs).jobs[fid] = {"id": id, "city": cid, "left": int(w.months), "gold": gold, "men": men(w)}
	return {"ok": true, "months": int(w.months)}


static func _give_back(rs: Object, fid: String, job: Dictionary, frac: float) -> void:
	if fid == ME and frac > 0.0:
		rs.set("gold", int(rs.get("gold")) + roundi(float(job.gold) * frac))
	if owns(rs, fid, String(job.city)):   # 성을 잃었으면 인부도 잃는다
		var c := _city(rs, fid, String(job.city))
		c["troops"] = int(c.troops) + int(job.men)


## 한 달 — realm_rules_month.next_month 가 부른다. 알림 글 목록(빈 것 = 조용).
static func monthly(rs: Object) -> Array:
	var st := state(rs)
	var jobs: Dictionary = st.jobs
	var done: Array = []
	var ks := jobs.keys()
	ks.sort()
	for f in ks:
		if f != ME and cities_of(rs, String(f)).is_empty():   # 망한 세력
			jobs.erase(f)
			continue
		jobs[f]["left"] = int(jobs[f].left) - 1
		if int(jobs[f].left) <= 0:
			done.append(String(f))
	var msgs: Array = []
	for f: String in done:
		if not jobs.has(f):
			continue
		var j: Dictionary = jobs[f]
		jobs.erase(f)
		var w := by_id(String(j.id))
		if (st.built as Dictionary).has(String(j.id)):   # 같은 달 둘이 끝나면 먼저 센 쪽이 갖는다
			_give_back(rs, f, j, REFUND)
			continue
		st.built[String(j.id)] = {"by": f, "at": "%d.%d" % [int(rs.get("year")), int(rs.get("month"))], "city": String(j.city)}
		rev += 1
		_give_back(rs, f, j, 0.0)
		msgs.append("%s %s 이(가) %s 을(를) 다 지었다 — %s" % [String(w.emoji), force_name(f), String(w.name), String(w.desc)])
		var losers := jobs.keys()
		losers.sort()
		for k in losers:
			if String(jobs[k].id) == String(j.id):
				_give_back(rs, String(k), jobs[k], REFUND)
				if k == ME:
					msgs.append("😞 %s — %s 이(가) 먼저 지었다. 들인 금의 반을 돌려받았다" % [String(w.name), force_name(f)])
				jobs.erase(k)
	return msgs


static func hash_of(s: String) -> int:
	var h := 0
	for i in s.length():
		h = (h * 31 + s.unicode_at(i)) & 0xFFFFFFFF
	if h >= 0x80000000:
		h -= 0x100000000
	return absi(h)


## 지난 달 수 — realm_statecraft.months_played 와 같은 셈(시나리오 id = 시작 해). 서로 preload 하지 않으려고 따로 둔다.
static func months_played(rs: Object) -> int:
	var start := int(String(rs.get("scenario_id")))
	return 0 if start <= 0 else maxi(0, (int(rs.get("year")) - start) * 12 + int(rs.get("month")) - 1)


## AI 한 세력 — 둘째 해부터, 제 차례 달에, 짓는 중이 아니고 병력이 가장 많은 성 troops ≥ 인부 × 2.5 인 남은 것 중 하나를(굴림 없음). 착공한 id 또는 "".
static func ai_step(rs: Object, fid: String) -> String:
	if not AI_BUILD or fid == "" or fid == ME or not job_of(rs, fid).is_empty():
		return ""
	var turn := int(rs.get("year")) * 12 + int(rs.get("month"))
	if months_played(rs) < AI_FROM or hash_of(fid + "@" + str(turn)) % AI_EVERY != 0:
		return ""
	var best := ""
	for cid: String in cities_of(rs, fid):
		if best == "" or int(_city(rs, fid, cid).troops) > int(_city(rs, fid, best).troops):
			best = cid
	if best == "":
		return ""
	var top := int(_city(rs, fid, best).troops)
	var free: Array = []
	for w: Dictionary in WONDERS:
		if built_by(rs, String(w.id)) == "" and float(top) >= float(men(w)) * AI_MEN:
			free.append(w)
	if free.is_empty():
		return ""
	var w: Dictionary = free[hash_of(fid + str(turn)) % free.size()]
	return String(w.id) if bool(start(rs, fid, String(w.id), best).ok) else ""


## AI 세력 전부(세력 id 정렬) — 알림 글 목록
static func ai_all(rs: Object) -> Array:
	var forces: Array = []
	var en: Dictionary = rs.get("enemies")
	for eid in en:
		var fid := String(rs.call("force_of", String(eid)))
		if fid != "" and not bool((en[eid] as Dictionary).get("captured", false)) and not forces.has(fid):
			forces.append(fid)
	forces.sort()
	var msgs: Array = []
	for fid: String in forces:
		var id := ai_step(rs, fid)
		if id != "":
			var w := by_id(id)
			msgs.append("%s %s 세력이 %s 을(를) 짓기 시작했다(%d달)" % [String(w.emoji), force_name(fid), String(w.name), int(w.months)])
	return msgs
