extends RefCounted

## G-0321 5천하 법령 — 한 번 내리면 거둘 수 없는 법(프로스트펑크 법전 — 구조만). 고돗이 먼저(웹·유니티 짝 없음, 장부 realm.md 우선 3 "관직과 엮음").
##   법령 넷  득과 실이 함께 — 경륜도 배수 자리(realm_state._sc)에 곱으로 더한다(빈 법전이면 1, realm_golden 비트 그대로).
##            상업령 금 ×1.15·수확 ×0.9 · 둔전령 군량 먹음 ×0.8·금 ×0.9 · 징병령 징병 ×1.25·등용 ×0.85 · 엄법령 무장 이탈 ×0.5·경험 ×0.9
##   관직     내릴 수 있는 법령 수 = 1 + 우리 무장 최고 관직 단계(officer_growth rank, 최대 MAX) — 승진이 법전을 넓힌다.
##   틈       한 번 내리면 GAP_MONTHS 달 뒤에야 다음 법령. 되돌리기 없음.
##   저장     RealmSaveState.laws = {list: [key…], next: 해×12+달} (26→27). SAGA_LAWS=0 이면 끔(곱 1·못 내림).
## 창은 ui/realm_law_button.gd(☰ 「📜 법령」). AI 세력은 안 씀(고돗 AI 는 금·인구가 없다).

const GAP_MONTHS := 6
const MAX := 4
const LAWS := {
	"commerce": {"name": "상업령", "emoji": "🏪", "mul": {"gold": 1.15, "food": 0.9}, "text": "금 수입 +15% · 수확 −10%"},
	"tuntian": {"name": "둔전령", "emoji": "🌾", "mul": {"eat": 0.8, "gold": 0.9}, "text": "군량 먹음 −20% · 금 수입 −10%"},
	"conscript": {"name": "징병령", "emoji": "🛡️", "mul": {"draft": 1.25, "hire": 0.85}, "text": "징병 +25% · 등용 −15%"},
	"strict": {"name": "엄법령", "emoji": "⚖️", "mul": {"defect": 0.5, "exp": 0.9}, "text": "무장 이탈 −50% · 무장 경험 −10%"},
}
const ORDER := ["commerce", "tuntian", "conscript", "strict"]


static func on() -> bool:
	return OS.get_environment("SAGA_LAWS") != "0"


static func st(S: Object) -> Dictionary:
	if typeof(S.laws) != TYPE_DICTIONARY:
		S.laws = {}
	var L: Dictionary = S.laws
	if typeof(L.get("list")) != TYPE_ARRAY:
		L["list"] = []
	if not L.has("next"):
		L["next"] = 0
	return L


static func enacted(S: Object) -> Array:
	return st(S).list


static func now_idx(S: Object) -> int:
	return int(S.year) * 12 + int(S.month)


static func cap(S: Object) -> int:
	var best := 0
	for id: String in S.roster:
		best = maxi(best, int((S.officer_growth.get(id, {}) as Dictionary).get("rank", 0)))
	return mini(MAX, 1 + best)


## 이 키의 곱(법령 모두) — 빈 법전·꺼짐이면 1
static func mul(S: Object, key: String) -> float:
	if not on() or S == null:
		return 1.0
	var m := 1.0
	for k: String in enacted(S):
		m *= float((LAWS.get(k, {}).get("mul", {}) as Dictionary).get(key, 1.0))
	return m


static func why(S: Object, key: String) -> String:
	if not on():
		return "꺼져 있다"
	if not LAWS.has(key):
		return "없는 법령"
	if enacted(S).has(key):
		return "이미 내렸다"
	if enacted(S).size() >= cap(S):
		return "관직이 낮아 더 못 내린다(%d/%d — 무장을 승진시키면 는다)" % [enacted(S).size(), cap(S)]
	var left := int(st(S).next) - now_idx(S)
	if left > 0:
		return "지난 법령이 자리 잡는 중 — %d달 뒤" % left
	return ""


static func enact(S: Object, key: String) -> Dictionary:
	var w := why(S, key)
	if w != "":
		return {"ok": false, "why": w}
	var L := st(S)
	(L.list as Array).append(key)
	L.next = now_idx(S) + GAP_MONTHS
	return {"ok": true, "name": LAWS[key].name, "text": LAWS[key].text}


## 창 줄 — [{key, label}] (내린 것 ✓, 못 내리면 까닭)
static func lines(S: Object) -> Array:
	var out: Array = []
	for k: String in ORDER:
		var d: Dictionary = LAWS[k]
		var w := why(S, k)
		var mark := "✓ 시행 중" if enacted(S).has(k) else ("▶ 내리기" if w == "" else "(%s)" % w)
		out.append({"key": k, "label": "%s %s — %s  %s" % [d.emoji, d.name, d.text, mark]})
	return out
