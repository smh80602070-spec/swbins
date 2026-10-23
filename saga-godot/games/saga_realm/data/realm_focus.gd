extends RefCounted

## G-0336 5천하 국가 방침 나무(HOI 국가 방침 — 구조만). 고돗이 먼저(웹·유니티 짝 없음, 장부 realm.md 우선 3 "시나리오 단계와 겹침").
##   겹침    장부 메모 — 시나리오 단계(이야기 카드)는 정해진 길, 방침은 내가 고르는 몇 달짜리 국책. 법령(즉시·득실)·국세(금 문턱)와도 따로.
##   나무    🏯 나라의 근본 → 💰 부국 → 🌾 둔전 확장 / ⚔️ 강병 → 🎯 조련 — 부국·강병은 갈림길(하나 고르면 다른 쪽 닫힘)
##           → 🤝 인재 등용(둔전 확장 또는 조련 뒤) → 🐉 천하의 대계.
##   진행    한 번에 하나. 고르면 그 달 수만큼 달 끝(realm_rules_month)마다 1 씩 줄고 0 이 되면 끝 — 덤은 끝난 뒤부터, 영구.
##   덤      경륜도 배수 자리(realm_state._sc)에 곱(끝낸 방침 없으면 1, realm_golden 그대로) · 근본·대계는 금 한 번 더.
##   저장    RealmSaveState.focus = {done: [id…], cur: id, left: 달}(29→30). AI 세력은 안 씀. SAGA_FOCUS=0 이면 끔(곱 1·못 고름).

const FOCI := {
	"root": {"name": "나라의 근본", "emoji": "🏯", "months": 3, "need": [], "mul": {}, "gold": 300, "text": "금 300"},
	"rich": {"name": "부국", "emoji": "💰", "months": 4, "need": ["root"], "lock": "army", "mul": {"gold": 1.1}, "text": "금 수입 +10%"},
	"farm": {"name": "둔전 확장", "emoji": "🌾", "months": 4, "need": ["rich"], "mul": {"food": 1.1}, "text": "수확 +10%"},
	"army": {"name": "강병", "emoji": "⚔️", "months": 4, "need": ["root"], "lock": "rich", "mul": {"draft": 1.15}, "text": "징병 +15%"},
	"drill": {"name": "조련", "emoji": "🎯", "months": 4, "need": ["army"], "mul": {"exp": 1.1}, "text": "무장 경험 +10%"},
	"talent": {"name": "인재 등용", "emoji": "🤝", "months": 4, "need": ["farm|drill"], "mul": {"hire": 1.15}, "text": "등용 +15%"},
	"grand": {"name": "천하의 대계", "emoji": "🐉", "months": 6, "need": ["talent"], "mul": {"gold": 1.05, "food": 1.05, "plot": 1.1}, "gold": 1000, "text": "금·수확 +5% · 계략 +10% · 금 1000"},
}
const ORDER := ["root", "rich", "farm", "army", "drill", "talent", "grand"]
const MAX_DONE := 5   # 근본·갈림길 한쪽 둘·인재·대계


static func on() -> bool:
	return OS.get_environment("SAGA_FOCUS") != "0"


static func st(S: Object) -> Dictionary:
	if typeof(S.focus) != TYPE_DICTIONARY:
		S.focus = {}
	var F: Dictionary = S.focus
	if typeof(F.get("done")) != TYPE_ARRAY:
		F["done"] = []
	if not F.has("cur"):
		F["cur"] = ""
	if not F.has("left"):
		F["left"] = 0
	return F


static func done(S: Object) -> Array:
	return st(S).done


## 끝낸 방침 곱 — 없거나 꺼짐이면 1
static func mul(S: Object, key: String) -> float:
	if not on() or S == null:
		return 1.0
	var m := 1.0
	for id in done(S):
		m *= float((FOCI.get(String(id), {}).get("mul", {}) as Dictionary).get(key, 1.0))
	return m


static func locked(S: Object, id: String) -> bool:
	for d in done(S):
		if String(FOCI.get(String(d), {}).get("lock", "")) == id:
			return true
	var cur := String(st(S).cur)
	return cur != "" and String(FOCI.get(cur, {}).get("lock", "")) == id


static func why(S: Object, id: String) -> String:
	if not on():
		return "꺼져 있다"
	if not FOCI.has(id):
		return "없는 방침"
	if done(S).has(id):
		return "이미 끝냈다"
	if String(st(S).cur) == id:
		return "진행 중"
	if locked(S, id):
		return "갈림길 — 닫힘"
	for n: String in FOCI[id].need:
		var ok := false
		for alt in n.split("|"):
			ok = ok or done(S).has(alt)
		if not ok:
			var names: Array = []
			for alt in n.split("|"):
				names.append(String(FOCI[alt].name))
			return "%s 먼저" % " 또는 ".join(names)
	if String(st(S).cur) != "":
		return "다른 방침 진행 중(%s %d달)" % [String(FOCI[String(st(S).cur)].name), int(st(S).left)]
	return ""


static func pick(S: Object, id: String) -> Dictionary:
	var w := why(S, id)
	if w != "":
		return {"ok": false, "why": w}
	var F := st(S)
	F.cur = id
	F.left = int(FOCI[id].months)
	return {"ok": true, "name": FOCI[id].name, "months": F.left}


## 달 끝 — 진행 중 방침 한 달. 끝나면 알림 줄
static func monthly(S: Object) -> Array:
	if not on():
		return []
	var F := st(S)
	var cur := String(F.cur)
	if cur == "" or not FOCI.has(cur):
		return []
	F.left = int(F.left) - 1
	if int(F.left) > 0:
		return []
	(F.done as Array).append(cur)
	F.cur = ""
	F.left = 0
	var d: Dictionary = FOCI[cur]
	var g := int(d.get("gold", 0))
	if g > 0:
		S.gold = int(S.gold) + g
	return ["%s 방침 「%s」 완수 — %s" % [d.emoji, d.name, d.text]]


## 창 줄 — [{id, label}]
static func lines(S: Object) -> Array:
	var out: Array = []
	for id: String in ORDER:
		var d: Dictionary = FOCI[id]
		var w := why(S, id)
		var mark := "✓ 완수" if done(S).has(id) else ("⏳ %d달 남음" % int(st(S).left) if String(st(S).cur) == id else ("▶ %d달" % int(d.months) if w == "" else "(%s)" % w))
		var indent := "" if id == "root" else ("  └ " if (d.need as Array).size() > 0 else "")
		out.append({"id": id, "label": "%s%s %s — %s  %s" % [indent, d.emoji, d.name, d.text, mark]})
	return out


static func restore(saved: Variant) -> Dictionary:
	if typeof(saved) != TYPE_DICTIONARY:
		return {}
	var d: Dictionary = saved
	var dn: Array = []
	for x in (d.get("done", []) if d.get("done") is Array else []):
		if FOCI.has(String(x)):
			dn.append(String(x))
	var cur := String(d.get("cur", ""))
	return {"done": dn, "cur": cur if FOCI.has(cur) else "", "left": int(d.get("left", 0)) if FOCI.has(cur) else 0}
