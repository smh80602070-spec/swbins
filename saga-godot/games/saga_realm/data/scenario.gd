extends RefCounted
## G-0088 — 사가천하 이야기 표(정본 `scenario/saga-realm.md` "천하와 균열"). 1막 · 군웅 세 카드 + G-0092 2막 · 대전 세 카드.
## 글·고르기·결과는 웹 구현(saga-web/saga-realm/js/data-scenario.js CARDS·STAGES)과 같다. 사가천하의 이야기는 줄로 가는 퀘스트가 아니라
## **때가 되면 터지는 사건 카드**다 — 표 순서대로 하나씩, 그 카드의 때(when)가 되면 뜬다.
## 엔진은 world/scenario_runner.gd, 진행은 RealmSaveState.story(fresh() 모양). 인물은 칸({책사}·{이웃})으로만 — 도감 가명이 들어간다.
##
## 한 카드 = {id, no, act, title, emoji, when{minTurn, orCities?}, mix{past,now,future}, text, choices[{k, label, hint, cost?, fx[{t, n}], text}]}
##   fx.t  gold(금) · food(수도 군량) · sec(수도 치안) · train(수도 훈련) · loyal({책사} 충성) · rel({이웃} 세력과 우호)
##         recruitFree(재야 중 가장 귀한 이 하나를 바로 등용, bonus = 시작 충성 +) · quiz(문화 승리 문답 정답 +n)
## STAGES[id] = 그 카드 뒤 단계 — {kind, on: 고른 k 또는 "*"(아무 답), title, intro?, months?, win{text, hint, fx}, lose{…}}
##   kind debate — 설전 세 문답, 둘 이상 맞히면 이김 · kind own — months 달 안에 성을 하나 더 편입하면 이김(웹 "목표 성 차지"를 고돗은 성 수로)
##   단계가 열려 있는 동안 다음 카드는 쉰다(웹과 같음).
## G-0092 — 고돗엔 시간 틈 사람(강서·도하·명변…)이 인물 표에 없다(정본 트랙 메모 "인물 표를 더한 뒤") — 그 사람을 등용하는 고르기는
##   "그 사람이 데려온 재야 인재 합류"(recruitFree)로, 그 사람 충성(loyalId)은 {책사} 충성으로 바꿨다.

const ACT_NAMES := {1: "1막 · 군웅", 2: "2막 · 대전"}

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
	{"id": "r2_fallen", "no": 4, "act": 2, "title": "하늘에서 떨어진 사람들", "emoji": "🪂", "when": {"minTurn": 36, "orCities": 8},
		"mix": {"past": "재야 촌락", "now": "강서·공석·금담·명변·도하", "future": "도하 노트북 속 앞날 지도"},
		"text": "재야를 탐색하던 척후가 이상한 소문을 물어 왔다. 현대 옷차림의 사람 다섯이 하늘에서 떨어졌다는 것이다. 그중 강서라는 이는 특공대장이었다고 하고, 노트북을 든 도하의 화면에는 아직 그려지지 않은 앞날의 지도가 떠 있다 한다. {책사} 이(가) 한 사람부터 찾자고 한다.",
		"choices": [
			{"k": "atk", "label": "강서를 직접 찾아 나선다", "hint": "금 300 · 강서가 데려온 재야 인재 합류", "cost": 300, "fx": [{"t": "recruitFree", "bonus": 10}], "text": "강서가 특공대 제복 그대로 찾아와 절도 있게 인사하고, 숨어 있던 인재를 데려왔다"},
			{"k": "def", "label": "소문을 더 모은다", "hint": "수도 치안 +5 · 책사 충성 +3", "fx": [{"t": "sec", "n": 5}, {"t": "loyal", "n": 3}], "text": "소문을 모아 지도에 표시하니 성 안이 술렁임을 그쳤다"},
			{"k": "util", "label": "도하의 노트북부터 산다", "hint": "금 400 · 노트북 지도로 찾은 재야 인재 합류", "cost": 400, "fx": [{"t": "recruitFree", "bonus": 5}], "text": "도하가 값을 치른 노트북 앞에서 앞날 지도를 펼쳐 보였다 — 지도 위의 재야 하나를 찾아냈다"},
		]},
	{"id": "r2_plains", "no": 5, "act": 2, "title": "관도 결전", "emoji": "⚔️", "when": {"minTurn": 48, "orCities": 10},
		"mix": {"past": "대군·군량", "now": "강서 특공대", "future": "금담이 가져온 태양광 등"},
		"text": "{이웃} 의 대군이 큰 들판에 진을 쳤다. 강서가 특공대를 이끌고 밤에 야습하자고 제안하고, 금담은 태양광 등을 내밀며 \"밤을 낮처럼 쓰자\" 한다. 대군과 군량을 두고 한 판을 정해야 한다.",
		"choices": [
			{"k": "atk", "label": "강서의 야습을 허락한다", "hint": "수도 훈련 +10 · 결전", "fx": [{"t": "train", "n": 10}], "text": "야습이 적진의 곳간을 태우자 군사의 기세가 하늘을 찔렀다"},
			{"k": "def", "label": "성 안에서 버틴다", "hint": "수도 치안 +8 · 군량 +1000 · 결전", "fx": [{"t": "sec", "n": 8}, {"t": "food", "n": 1000}], "text": "태양광 등이 성벽 위를 환히 밝히니 적이 다가오지 못했다"},
			{"k": "util", "label": "금담의 등을 큰 값에 산다", "hint": "금 300 · 군량 +2000 · 결전", "cost": 300, "fx": [{"t": "food", "n": 2000}], "text": "등불로 밤 수레길이 열려 군량이 넉넉히 들어왔다"},
		]},
	{"id": "r2_debate", "no": 6, "act": 2, "title": "논객의 설전", "emoji": "🎙️", "when": {"minTurn": 60, "orCities": 12},
		"mix": {"past": "학자·서당", "now": "명변·확성기", "future": "퀴즈 판이 빛 판"},
		"text": "논객 명변이 확성기를 들고 찾아왔다. \"이름난 재야 학자를 설전으로 불러 옵시다. 서당에 사람이 모이면 성이 밝아집니다.\" 퀴즈 판이 빛 판으로 바뀐 서고 앞에서 {책사} 도 고개를 끄덕인다.",
		"choices": [
			{"k": "atk", "label": "명변을 앞세운다", "hint": "금 300 · 명변이 데려온 재야 인재 합류 · 설전", "cost": 300, "fx": [{"t": "recruitFree", "bonus": 10}], "text": "명변이 확성기를 들고 서당 앞에서 큰 설전을 벌였다"},
			{"k": "def", "label": "서고를 정비한다", "hint": "수도 치안 +8 · 설전", "fx": [{"t": "sec", "n": 8}], "text": "서고가 정돈되니 배우러 오는 이가 늘었다"},
			{"k": "util", "label": "학자에게 예물을 보낸다", "hint": "금 200 · 책사 충성 +5 · 설전", "cost": 200, "fx": [{"t": "loyal", "n": 5}], "text": "학자가 예물에 감복해 서고에 이름을 올렸다"},
		]},
]

const STAGES := {
	"r1_first_ally": {"kind": "debate", "on": "def", "title": "화친의 설전",
		"intro": "{이웃} 의 사신 앞에 재야 논객이 서서 설전을 청한다. 문답 세 개 — 두 개 이상 맞히면 화친 조건을 더 얻어 낸다.",
		"win": {"text": "{책사} 이(가) 지켜보는 가운데 설전에서 이겨 화친 조건을 더 얻어 냈다", "hint": "이웃 우호 +15 · 금 +300", "fx": [{"t": "rel", "n": 15}, {"t": "gold", "n": 300}]},
		"lose": {"text": "말문이 막혀 조건을 못 얻었다 — 사신이 어색하게 돌아갔다", "hint": "이웃 우호 -5", "fx": [{"t": "rel", "n": -5}]}},
	"r2_plains": {"kind": "own", "on": "*", "months": 10, "title": "관도 결전 · 들판의 성",
		"intro": "결전이 열렸다 — 열 달 안에 성을 하나 더 손에 넣어라.",
		"win": {"text": "들판의 성을 손에 넣었다 — 강서의 특공대가 야습을 해냈다는 소문이 돈다", "hint": "수도 훈련 +8 · 책사 충성 +5 · 금 +500", "fx": [{"t": "train", "n": 8}, {"t": "loyal", "n": 5}, {"t": "gold", "n": 500}]},
		"lose": {"text": "열 달이 지나도록 들판을 얻지 못했다 — 대군을 먹인 군량만 줄었다", "hint": "수도 군량 -800", "fx": [{"t": "food", "n": -800}]}},
	"r2_debate": {"kind": "debate", "on": "*", "title": "논객의 설전 · 재야 학자",
		"intro": "명변이 이름난 재야 학자를 마주 앉혔다. 문답 세 개 — 두 개 이상 맞히면 학자가 스스로 곁으로 온다.",
		"win": {"text": "학자가 설전에 무릎을 꿇고 스스로 곁에 섰다 — 서당에 문답 소리가 커졌다", "hint": "재야 학자 합류 · 문화 문답 +20", "fx": [{"t": "recruitFree", "bonus": 5}, {"t": "quiz", "n": 20}]},
		"lose": {"text": "학자가 웃으며 돌아섰다 — 그래도 서당엔 토론 소리가 남았다", "hint": "문화 문답 +5", "fx": [{"t": "quiz", "n": 5}]}},
}

const FX_KINDS := ["gold", "food", "sec", "train", "loyal", "rel", "recruitFree", "quiz"]
const DEBATE_WIN := 2


static func fresh() -> Dictionary:
	return {"next": 0, "done": [], "picks": {}, "debate": {}, "stage": {}, "own": {}}


static func normalize(st: Variant) -> Dictionary:
	var out := fresh()
	if st is Dictionary:
		for k in out:
			if (st as Dictionary).has(k):
				out[k] = (st as Dictionary)[k]
	out.done = (out.done as Array).duplicate()
	out.picks = (out.picks as Dictionary).duplicate() if out.picks is Dictionary else {}
	out.debate = (out.debate as Dictionary).duplicate() if out.debate is Dictionary else {}
	out.stage = (out.stage as Dictionary).duplicate() if out.stage is Dictionary else {}
	out.own = (out.own as Dictionary).duplicate() if out.own is Dictionary else {}
	return out


## 시작한 뒤 지난 달 수(시나리오 해 1월 = 0).
static func elapsed(scenario_id: String, year: int, month: int) -> int:
	return maxi(0, (year - int(scenario_id)) * 12 + month - 1)


static func next_card(st: Dictionary) -> Dictionary:
	var i := int(st.get("next", 0))
	return CARDS[i] if i >= 0 and i < CARDS.size() else {}


static func finished(st: Dictionary) -> bool:
	return next_card(st).is_empty()


## 다음 카드가 지금 뜰 때인가(성 차지 단계가 열려 있으면 쉰다).
static func due(st: Dictionary, months: int, cities: int) -> bool:
	var c := next_card(st)
	if c.is_empty() or not (st.get("stage", {}) as Dictionary).is_empty():
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
	var on := String(stage.get("on", ""))
	return {"choice": ch, "stage": stage if not stage.is_empty() and (on == "*" or on == String(ch.k)) else {}}


## 성 차지 단계 열기 — 지금 달·성 수를 적어 둔다.
static func start_own(st: Dictionary, card_id: String, months: int, cities: int) -> void:
	var sg: Dictionary = STAGES.get(card_id, {})
	st.stage = {"id": card_id, "kind": "own", "start": months, "base": cities, "months": int(sg.get("months", 10))}


## 성 차지 단계 판정 — "win"(성이 늘었다) · "lose"(기한이 지났다) · ""(아직). 끝나면 단계를 닫고 own[id] 에 결과.
static func own_status(st: Dictionary, months: int, cities: int) -> String:
	var sg: Dictionary = st.get("stage", {})
	if String(sg.get("kind", "")) != "own":
		return ""
	var res := ""
	if cities > int(sg.base):
		res = "win"
	elif months - int(sg.start) >= int(sg.months):
		res = "lose"
	if res != "":
		(st.own as Dictionary)[String(sg.id)] = res
		st.stage = {}
	return res


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
	var sg: Dictionary = st.get("stage", {})
	if String(sg.get("kind", "")) == "own":
		var left_m := int(sg.months) - (months - int(sg.start))
		return "📜 %s — 성 하나 더 편입(%d/%d · %d달 남음)" % [String(STAGES.get(String(sg.id), {}).get("title", "")), cities, int(sg.base) + 1, maxi(0, left_m)]
	var c := next_card(st)
	if c.is_empty():
		return ""
	var w: Dictionary = c.when
	var left := int(w.get("minTurn", 0)) - months
	var when_txt := "곧" if left <= 0 else "%d달 뒤" % left
	if w.has("orCities") and left > 0:
		when_txt += " 또는 성 %d" % int(w.orCities)
	return "📜 %s 다음: %s %s (%s)" % [ACT_NAMES.get(int(c.act), ""), String(c.emoji), String(c.title), when_txt]
