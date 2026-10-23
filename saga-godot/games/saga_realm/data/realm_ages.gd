extends RefCounted

## G-0329 5천하 국세(國勢) 올리기 — 세력 단계를 금으로 올리는 문턱(AoE 시대 올리기 — 구조만). 고돗이 먼저(웹·유니티 짝 없음, 장부 realm.md 우선 3).
##   이름  장부 메모 "시대 퓨전과 이름 겹침" — "시대"(인물 시대·시간 틈)와 안 겹치게 국세: 난세 → 기틀 → 치세 → 성세.
##   문턱  다음 단계 = 우리 성 수 + 연구한 기술 마디 수(realm_tech done) + 금. 셋을 다 채우면 「🏯 국세 올리기」(금을 낸다).
##   덤    단계마다 금 수입·수확 ×1.05(겹쳐 곱) · 성세는 무장 경험 ×1.1 더 — 경륜도 배수 자리(realm_state._sc)에 곱(난세면 1, golden 그대로).
##   창    법령 창(ui/realm_law_button.gd) 맨 위 줄 — 새 HUD 단추 없음.
##   저장  RealmSaveState.age(int, 27→28). AI 세력은 안 씀(고돗 AI 는 금이 없다). SAGA_AGES=0 이면 끔.

const LEVELS := [
	{"name": "난세", "emoji": "🌫️", "cities": 0, "techs": 0, "gold": 0},
	{"name": "기틀", "emoji": "🧱", "cities": 4, "techs": 4, "gold": 1500},
	{"name": "치세", "emoji": "🏯", "cities": 7, "techs": 9, "gold": 3000},
	{"name": "성세", "emoji": "🌅", "cities": 12, "techs": 15, "gold": 6000},
]
const STEP := 1.05
const TOP_EXP := 1.1


static func on() -> bool:
	return OS.get_environment("SAGA_AGES") != "0"


static func level(S: Object) -> int:
	return clampi(int(S.age), 0, LEVELS.size() - 1) if on() else 0


static func name_of(lv: int) -> String:
	var d: Dictionary = LEVELS[clampi(lv, 0, LEVELS.size() - 1)]
	return "%s %s" % [d.emoji, d.name]


static func mul(S: Object, key: String) -> float:
	if S == null:
		return 1.0
	var lv := level(S)
	if lv <= 0:
		return 1.0
	if key == "gold" or key == "food":
		return pow(STEP, lv)
	if key == "exp" and lv >= LEVELS.size() - 1:
		return TOP_EXP
	return 1.0


## 다음 단계로 못 가는 까닭("" 이면 됨) — techs 는 부르는 쪽이 센다(realm_tech 은 autoload 를 읽는다)
static func why(S: Object, techs: int) -> String:
	if not on():
		return "꺼져 있다"
	var lv := level(S)
	if lv >= LEVELS.size() - 1:
		return "이미 성세다"
	var n: Dictionary = LEVELS[lv + 1]
	var miss: Array = []
	if (S.cities as Dictionary).size() < int(n.cities):
		miss.append("성 %d/%d" % [(S.cities as Dictionary).size(), int(n.cities)])
	if techs < int(n.techs):
		miss.append("기술 %d/%d" % [techs, int(n.techs)])
	if int(S.gold) < int(n.gold):
		miss.append("금 %d/%d" % [int(S.gold), int(n.gold)])
	return "" if miss.is_empty() else "모자람 — " + " · ".join(miss)


static func advance(S: Object, techs: int) -> Dictionary:
	var w := why(S, techs)
	if w != "":
		return {"ok": false, "why": w}
	var lv := level(S) + 1
	S.gold = int(S.gold) - int(LEVELS[lv].gold)
	S.age = lv
	return {"ok": true, "level": lv, "name": name_of(lv)}


## 창 줄 하나
static func line(S: Object, techs: int) -> String:
	var lv := level(S)
	var head := "🏯 국세 %s · 금·수확 ×%.2f%s" % [name_of(lv), pow(STEP, lv), " · 경험 ×1.1" if lv >= LEVELS.size() - 1 else ""]
	if lv >= LEVELS.size() - 1:
		return head
	var n: Dictionary = LEVELS[lv + 1]
	var w := why(S, techs)
	return "%s\n▶ %s 올리기 — 성 %d · 기술 %d · 금 %d%s" % [head, name_of(lv + 1), int(n.cities), int(n.techs), int(n.gold), "" if w == "" else "  (%s)" % w]
