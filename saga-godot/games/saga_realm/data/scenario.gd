extends RefCounted
## G-0088 — 사가천하 이야기 표(정본 `scenario/saga-realm.md` "천하와 균열"). 1막 · 군웅 세 카드.
## 글·고르기·결과는 웹 구현(saga-web/saga-realm/js/data-scenario.js CARDS·STAGES)과 같다. 사가천하의 이야기는 줄로 가는 퀘스트가 아니라
## **때가 되면 터지는 사건 카드**다 — 표 순서대로 하나씩, 그 카드의 때(when)가 되면 뜬다.
## 엔진은 world/scenario_runner.gd, 진행은 RealmSaveState.story(fresh() 모양). 인물은 칸({책사}·{이웃})으로만 — 도감 가명이 들어간다.
##
## 한 카드 = {id, no, act, title, emoji, when{minTurn, orCities?}, mix{past,now,future}, text, choices[{k, label, hint, cost?, fx[{t, n}], text}]}
##   fx.t  gold(금) · food(수도 군량) · sec(수도 치안) · train(수도 훈련) · loyal({책사} 충성) · rel({이웃} 세력과 우호)
## STAGES[id] = 그 카드 뒤 단계 — {kind: "debate", on: 고른 k, title, intro, win{text, hint, fx}, lose{…}} (설전 세 문답, 둘 이상 맞히면 이김)

const ACT_NAMES := {1: "1막 · 군웅"}

const CARDS := [
	{"id": "r1_start", "no": 1, "act": 1, "title": "첫 성의 밤", "emoji": "🗺️", "when": {"minTurn": 0},
		"mix": {"past": "{책사}·천하 지도", "now": "지도 위에 떨어진 볼펜", "future": "지도 가장자리의 빛 얼룩"},
		"text": "{책사} 이(가) 천하 지도를 펴고 첫 목표를 묻는다. 지도 끝에는 어제까지 없던 땅이 희미하게 그려져 있다. 지도 위에는 이 시대 것이 아닌 볼펜 한 자루가 떨어져 있고, 가장자리로 빛 얼룩이 번져 간다.",
		"choices": [
			{"k": "atk", "label": "이웃 땅으로 넓히자", "hint": "수도 군량 +1500 · 훈련 +5", "fx": [{"t": "food", "n": 1500}, {"t": "train", "n": 5}], "text": "{책사} 이(가) 첫 출정 길을 그었다 — 곳간이 든든해졌다"},
			{"k": "def", "label": "성부터 다지자", "hint": "수도 치안 +8 · 책사 충성 +3", "fx": [{"t": "sec", "n": 8}, {"t": "loyal", "n": 3}], "text": "성문과 곳간을 손보았다 — {책사} 이(가) 믿음을 얻었다"},
			{"k": "util", "label": "빛 얼룩부터 살핀다", "hint": "금 +500", "fx": [{"t": "gold", "n": 500}], "text": "얼룩 근처에서 옛 주화 꾸러미가 나왔다"},
		]},
	{"id": "r1_rift_sign", "no": 2, "act": 1, "title": "균열의 울림", "emoji": "🌌", "when": {"minTurn": 12},
		"mix": {"past": "봉화대", "now": "금 아래 떨어진 자동차", "future": "금에서 새는 빛"},
		"text": "북쪽 하늘에 가느다란 금이 갔다. 봉화대 병사가 금 아래에서 낯선 수레를 보았다 — 쇠 껍질에 바퀴가 달렸고 안은 비어 있다. 금에서는 옅은 빛이 새어 나오며, 바람이 그쪽으로 빨려 든다.",
		"choices": [
			{"k": "atk", "label": "봉화를 올려 널리 알린다", "hint": "수도 훈련 +8", "fx": [{"t": "train", "n": 8}], "text": "봉화가 이어 오르자 군사의 기세가 올랐다"},
			{"k": "def", "label": "성문을 닫고 살핀다", "hint": "수도 치안 +8", "fx": [{"t": "sec", "n": 8}], "text": "성문을 닫고 지켜보니 백성이 안심했다"},
			{"k": "util", "label": "척후를 금 아래로 보낸다", "hint": "금 +300 · 책사 충성 +3", "fx": [{"t": "gold", "n": 300}, {"t": "loyal", "n": 3}], "text": "척후가 수레 안에서 쓸 만한 것을 가져왔다"},
		]},
	{"id": "r1_first_ally", "no": 3, "act": 1, "title": "첫 화친", "emoji": "🕊️", "when": {"minTurn": 24, "orCities": 5},
		"mix": {"past": "사신·예물", "now": "재야 논객의 설전", "future": "예물 속 빛 부적"},
		"text": "{이웃} 의 사신이 예물을 들고 왔다. 예물 속에는 빛나는 부적이 섞여 있고, 재야의 한 논객이 끼어들어 \"손잡는 편이 덜 잃는다\" 며 설전을 청한다. 싸울지 손잡을지 정해야 한다.",
		"choices": [
			{"k": "atk", "label": "선전 포고로 답한다", "hint": "이웃 우호 -20 · 수도 훈련 +8", "fx": [{"t": "rel", "n": -20}, {"t": "train", "n": 8}], "text": "예물을 돌려보냈다 — 국경에 긴장이 돈다"},
			{"k": "def", "label": "화친을 받아들인다", "hint": "이웃 우호 +25 · 설전", "fx": [{"t": "rel", "n": 25}], "text": "화친을 받아들였다 — 논객이 설전을 청한다"},
			{"k": "util", "label": "예물을 더해 우호를 산다", "hint": "금 300 · 이웃 우호 +12", "cost": 300, "fx": [{"t": "rel", "n": 12}], "text": "예물을 더해 보내니 사신이 웃었다"},
		]},
]

const STAGES := {
	"r1_first_ally": {"kind": "debate", "on": "def", "title": "화친의 설전",
		"intro": "{이웃} 의 사신 앞에 재야 논객이 서서 설전을 청한다. 문답 세 개 — 두 개 이상 맞히면 화친 조건을 더 얻어 낸다.",
		"win": {"text": "{책사} 이(가) 지켜보는 가운데 설전에서 이겨 화친 조건을 더 얻어 냈다", "hint": "이웃 우호 +15 · 금 +300", "fx": [{"t": "rel", "n": 15}, {"t": "gold", "n": 300}]},
		"lose": {"text": "말문이 막혀 조건을 못 얻었다 — 사신이 어색하게 돌아갔다", "hint": "이웃 우호 -5", "fx": [{"t": "rel", "n": -5}]}},
}

const FX_KINDS := ["gold", "food", "sec", "train", "loyal", "rel"]
const DEBATE_WIN := 2


static func fresh() -> Dictionary:
	return {"next": 0, "done": [], "picks": {}, "debate": {}}


static func normalize(st: Variant) -> Dictionary:
	var out := fresh()
	if st is Dictionary:
		for k in out:
			if (st as Dictionary).has(k):
				out[k] = (st as Dictionary)[k]
	out.done = (out.done as Array).duplicate()
	out.picks = (out.picks as Dictionary).duplicate() if out.picks is Dictionary else {}
	out.debate = (out.debate as Dictionary).duplicate() if out.debate is Dictionary else {}
	return out


## 시작한 뒤 지난 달 수(시나리오 해 1월 = 0).
static func elapsed(scenario_id: String, year: int, month: int) -> int:
	return maxi(0, (year - int(scenario_id)) * 12 + month - 1)


static func next_card(st: Dictionary) -> Dictionary:
	var i := int(st.get("next", 0))
	return CARDS[i] if i >= 0 and i < CARDS.size() else {}


static func finished(st: Dictionary) -> bool:
	return next_card(st).is_empty()


## 다음 카드가 지금 뜰 때인가.
static func due(st: Dictionary, months: int, cities: int) -> bool:
	var c := next_card(st)
	if c.is_empty():
		return false
	var w: Dictionary = c.when
	return months >= int(w.get("minTurn", 0)) or (w.has("orCities") and cities >= int(w.orCities))


## 고른 답을 적고 다음 카드로. 그 고르기 사전(fx 를 엔진이 적용)과 이어질 단계(없으면 {})를 돌려준다.
static func pick(st: Dictionary, k: String) -> Dictionary:
	var c := next_card(st)
	if c.is_empty():
		return {}
	var ch: Dictionary = {}
	for o: Dictionary in c.choices:
		if String(o.k) == k:
			ch = o
	if ch.is_empty():
		ch = c.choices[0]
	(st.picks as Dictionary)[String(c.id)] = String(ch.k)
	(st.done as Array).append(String(c.id))
	st.next = int(st.next) + 1
	var stage: Dictionary = STAGES.get(String(c.id), {})
	return {"choice": ch, "stage": stage if not stage.is_empty() and String(stage.get("on", "")) == String(ch.k) else {}}


## 설전 결과(맞힌 수) → win/lose 칸.
static func debate_outcome(st: Dictionary, card_id: String, correct: int) -> Dictionary:
	(st.debate as Dictionary)[card_id] = correct
	var stage: Dictionary = STAGES.get(card_id, {})
	return stage.get("win" if correct >= DEBATE_WIN else "lose", {})


## {책사}·{이웃} 칸 채우기.
static func fill(text: String, names: Dictionary) -> String:
	return text.replace("{책사}", String(names.get("책사", "책사"))).replace("{이웃}", String(names.get("이웃", "이웃 군주")))


## 목표판 한 줄. 다 끝났으면 "".
static func objective(st: Dictionary, months: int, cities: int) -> String:
	var c := next_card(st)
	if c.is_empty():
		return ""
	var w: Dictionary = c.when
	var left := int(w.get("minTurn", 0)) - months
	var when_txt := "곧" if left <= 0 else "%d달 뒤" % left
	if w.has("orCities") and left > 0:
		when_txt += " 또는 성 %d" % int(w.orCities)
	return "📜 %s 다음: %s %s (%s)" % [ACT_NAMES.get(int(c.act), ""), String(c.emoji), String(c.title), when_txt]
