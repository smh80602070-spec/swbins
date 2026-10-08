extends RefCounted
## G-0088 — 사가천하 이야기 표(정본 `scenario/saga-realm.md` "천하와 균열"). 1막 · 군웅 세 카드 + G-0092 2막 · 대전 세 카드 + G-0096 3막 · 강 위 세 카드 + G-0101 4막 · 삼계 균열 세 카드 + G-0105 5막 · 먼 길 세 카드 + G-0110 6막 · 천하의 끝(승리하면 뜨는 결말 카드).
## 글·고르기·결과는 웹 구현(saga-web/saga-realm/js/data-scenario.js CARDS·STAGES)과 같다. 사가천하의 이야기는 줄로 가는 퀘스트가 아니라
## **때가 되면 터지는 사건 카드**다 — 표 순서대로 하나씩, 그 카드의 때(when)가 되면 뜬다.
## 엔진은 world/scenario_runner.gd, 진행은 RealmSaveState.story(fresh() 모양). 인물은 칸({책사}·{이웃})으로만 — 도감 가명이 들어간다.
##
## 한 카드 = {id, no, act, title, emoji, when{minTurn, orCities?}, mix{past,now,future}, text, choices[{k, label, hint, cost?, fx[{t, n}], text}]}
##   fx.t  gold(금) · food(수도 군량) · sec(수도 치안) · train(수도 훈련) · loyal({책사} 충성) · rel({이웃} 세력과 우호)
##         recruitFree(재야 중 가장 귀한 이 하나를 바로 등용, bonus = 시작 충성 +) · quiz(문화 승리 문답 정답 +n)
## STAGES[id] = 그 카드 뒤 단계 — {kind, on: 고른 k 또는 "*"(아무 답), title, intro?, months?, win{text, hint, fx}, lose{…}}
##   kind debate — 설전 세 문답, 둘 이상 맞히면 이김 · kind own — months 달 안에 성을 하나 더 편입하면 이김(웹 "목표 성 차지"를 고돗은 성 수로)
##   kind duel — {맹장}(무력 으뜸) 대 foe 이름, 베기·찌르기·막기 한 수씩(RealmWar.duel_round_result) 승부가 날 때까지(DUEL_MAX 수, 다 비기면 짐)
## when.victory = true 카드(G-0110 6막)는 달·성이 아니라 승리(RealmSaveState.result 가 "win…")로 뜬다. textBy[승리 종류] 가 있으면 그 글.
## when.allTime = true(G-0117 7막)는 승리 + 시간 틈 사람 아홉이 다 우리 사람일 때. textByK = {from: 앞 카드 id, 고른 k: 글} — 그 답의 글.
##   on 은 k 하나·"*"·k 배열(예 ["atk", "def"] — 3막 일기토는 예물을 고르면 안 열림)
##   단계가 열려 있는 동안 다음 카드는 쉰다(웹과 같음).
## G-0092 — 고돗엔 시간 틈 사람(강서·도하·명변…)이 인물 표에 없다(정본 트랙 메모 "인물 표를 더한 뒤") — 그 사람을 등용하는 고르기는
##   "그 사람이 데려온 재야 인재 합류"(recruitFree)로, 그 사람 충성(loyalId)은 {책사} 충성으로 바꿨다.

const ACT_NAMES := {1: "1막 · 군웅", 2: "2막 · 대전", 3: "3막 · 강 위", 4: "4막 · 삼계 균열", 5: "5막 · 먼 길", 6: "6막 · 천하", 7: "7막 · 틈의 끝"}

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
	## G-0096 3막 · 강 위 — 성연·궤도·영점(시간 틈 사람)은 2막처럼 "데려온 재야 인재"로, 성연 충성은 {책사} 충성으로.
	{"id": "r3_navigator", "no": 7, "act": 3, "title": "항법사가 본 강", "emoji": "🧭", "when": {"minTurn": 72, "orCities": 15},
		"mix": {"past": "강가 수채", "now": "도하가 기록을 해독", "future": "성연·항법 판"},
		"text": "항법사 성연이 항법 판을 들고 찾아왔다. \"이 강의 바람이 사흘 뒤에 바뀝니다. 미래 기록에 그렇게 남아 있습니다.\" 도하가 기록을 해독해 보니 정말로 같은 말이 적혀 있었다. 강가 수채화 같은 풍경 위에 항법 판의 빛이 겹친다.",
		"choices": [
			{"k": "atk", "label": "성연의 말을 군략에 쓴다", "hint": "금 300 · 성연이 데려온 재야 인재 합류", "cost": 300, "fx": [{"t": "recruitFree", "bonus": 10}], "text": "성연이 항법 판을 펴 강의 바람을 손가락으로 짚고, 강가에 숨어 살던 인재를 데려왔다"},
			{"k": "def", "label": "기록을 고이 간직한다", "hint": "수도 치안 +5 · 책사 충성 +3", "fx": [{"t": "sec", "n": 5}, {"t": "loyal", "n": 3}], "text": "기록을 서고에 넣어 두고 바람이 바뀌길 기다렸다"},
			{"k": "util", "label": "궤도에게도 사람을 보낸다", "hint": "금 300 · 궤도가 찾은 재야 인재 합류", "cost": 300, "fx": [{"t": "recruitFree", "bonus": 5}], "text": "궤도가 탐사 장비를 메고 성 문을 두드렸다 — 장비로 찾은 재야 하나를 데려왔다"},
		]},
	{"id": "r3_river", "no": 8, "act": 3, "title": "적벽 강 위", "emoji": "🌊", "when": {"minTurn": 84, "orCities": 18},
		"mix": {"past": "수군·화공", "now": "공석의 구조선", "future": "성연의 바람 예보"},
		"text": "강 위에서 큰 싸움이 다가온다. 성연이 \"사흘 뒤 바람이 바뀌니 그때 불을 쓰라\" 하고, 공석은 구조선을 끌어와 강가를 지키자 한다. 바람 예보를 믿을지, 수군과 화공으로 정면을 택할지 정해야 한다.",
		"choices": [
			{"k": "atk", "label": "바람 예보를 믿고 화공을 쓴다", "hint": "수도 훈련 +10 · 책사 충성 +3 · 결전", "fx": [{"t": "train", "n": 10}, {"t": "loyal", "n": 3}], "text": "바람이 예보대로 바뀌어 불길이 적선을 삼켰다"},
			{"k": "def", "label": "구조선으로 강가를 지킨다", "hint": "수도 치안 +8 · 결전", "fx": [{"t": "sec", "n": 8}], "text": "구조선이 강가 백성을 실어 나르니 성 안이 든든해졌다"},
			{"k": "util", "label": "수군을 늘려 정면으로 간다", "hint": "금 300 · 수도 훈련 +6 · 결전", "cost": 300, "fx": [{"t": "train", "n": 6}], "text": "수군을 늘려 정면에서 맞서니 적이 물러갔다"},
		]},
	{"id": "r3_duel", "no": 9, "act": 3, "title": "의체 무사의 일기토", "emoji": "🦾", "when": {"minTurn": 96, "orCities": 20},
		"mix": {"past": "{맹장}", "now": "구경꾼의 휴대폰 불빛", "future": "영점의 의체"},
		"text": "의체 무사 영점이 성 앞 공터에 서서 \"나보다 강한 장수 밑에만 서겠다\" 한다. 구경꾼들이 휴대폰 불빛을 켜 들고 모여들었다. 영점의 팔이 기계 소리를 낸다. 누가 이 일기토를 받겠는가.",
		"choices": [
			{"k": "atk", "label": "{맹장}이 직접 받아 친다", "hint": "수도 훈련 +5 · 일기토가 이어진다", "fx": [{"t": "train", "n": 5}], "text": "{맹장} 이(가) 창을 들고 나서자 함성이 일었다"},
			{"k": "def", "label": "구경꾼을 물리고 정중히 청한다", "hint": "수도 치안 +5 · 일기토가 이어진다", "fx": [{"t": "sec", "n": 5}], "text": "구경꾼을 물리니 영점이 한 걸음 물러섰다"},
			{"k": "util", "label": "예물과 술로 마음을 산다", "hint": "금 400 · 영점이 데려온 재야 인재 합류(일기토는 없다)", "cost": 400, "fx": [{"t": "recruitFree", "bonus": 0}], "text": "술잔 앞에서 영점이 기계 팔을 내려놓고, 함께 떠돌던 이를 소개했다"},
		]},
	## G-0101 4막 · 삼계 균열 — 은하(시간 틈 사람)는 "데려온 재야 인재"로, 강서 충성은 {책사} 충성으로(2·3막과 같다).
	## 웹 일기토 상대 "백기"는 실존 장수 이름이라(이름 정책) "묘역의 망장"으로.
	{"id": "r4_rift", "no": 10, "act": 4, "title": "균열의 왕", "emoji": "🌌", "when": {"minTurn": 108, "orCities": 25},
		"mix": {"past": "성벽 수비", "now": "강서 특공대", "future": "궤도의 탐사 장비·이계 성혼"},
		"text": "균열의 문이 활짝 열렸다. 종왕이 성혼과 유성 무리를 이끌고 내려온다. 성벽 위에는 강서의 특공대가 서 있고, 궤도의 탐사 장비가 이계 성혼의 정체를 알아낸다. 세 시대가 한 성벽에 모였다.",
		"choices": [
			{"k": "atk", "label": "성문 밖에서 맞받는다", "hint": "수도 훈련 +12 · 문 곁의 성", "fx": [{"t": "train", "n": 12}], "text": "성문 밖에서 맞받으니 성혼의 기세가 꺾였다"},
			{"k": "def", "label": "성벽을 걸고 지킨다", "hint": "수도 치안 +10 · 군량 +1500 · 문 곁의 성", "fx": [{"t": "sec", "n": 10}, {"t": "food", "n": 1500}], "text": "성벽이 버티니 유성 무리가 흩어졌다"},
			{"k": "util", "label": "궤도의 장비로 성혼을 읽는다", "hint": "금 300 · 책사 충성 +5 · 문 곁의 성", "cost": 300, "fx": [{"t": "loyal", "n": 5}], "text": "장비가 성혼의 약한 자리를 짚어 주었다"},
		]},
	{"id": "r4_plague", "no": 11, "act": 4, "title": "역병의 근원", "emoji": "🧫", "when": {"minTurn": 120, "orCities": 27},
		"mix": {"past": "의원·약재", "now": "금담의 백신 공장", "future": "은하의 방호복·이계 부생"},
		"text": "폐허에서 번지는 역병의 근원이 드러났다. 금담이 백신 공장을 세우자 하고, 의원들은 약재를 모아 왔다. 은하가 방호복을 입고 이계 부생의 정체를 확인했다. 성 안 백성이 기다리고 있다.",
		"choices": [
			{"k": "atk", "label": "거해의 근원을 직접 친다", "hint": "수도 훈련 +8 · 치안 +4 · 폐허 곁의 성", "fx": [{"t": "train", "n": 8}, {"t": "sec", "n": 4}], "text": "방호복 부대가 근원을 봉쇄하니 역병이 잦아들었다"},
			{"k": "def", "label": "백신 공장을 세운다", "hint": "수도 치안 +10 · 폐허 곁의 성", "fx": [{"t": "sec", "n": 10}], "text": "공장이 백신을 쏟아내 성 안이 나았다"},
			{"k": "util", "label": "은하에게 방호를 맡긴다", "hint": "금 300 · 은하가 데려온 재야 인재 합류 · 폐허 곁의 성", "cost": 300, "fx": [{"t": "recruitFree", "bonus": 5}], "text": "은하가 방호복을 입고 성 문 앞에 섰다 — 함께 온 재야 하나가 곁에 남았다"},
		]},
	{"id": "r4_tomb", "no": 12, "act": 4, "title": "망자의 맹세", "emoji": "🔔", "when": {"minTurn": 132, "orCities": 30},
		"mix": {"past": "{맹장}·종소리", "now": "공석이 망자 명부를 정리", "future": "영점 의체의 반응·이계 강해"},
		"text": "묘역의 종소리가 멎지 않는다. 묘역의 망장이 이계 군세를 걸고 일기토를 청했다. 공석은 망자 명부를 정리해 이름을 대조하고, 영점의 의체는 망자 기운에 반응해 삐걱댄다. 이긴 뒤 이계 장수를 어떻게 할지도 정해야 한다.",
		"choices": [
			{"k": "atk", "label": "{맹장}이 일기토를 받는다", "hint": "수도 훈련 +10 · 일기토", "fx": [{"t": "train", "n": 10}], "text": "{맹장} 의 칼이 종소리를 갈랐다"},
			{"k": "def", "label": "망자를 봉인한다", "hint": "수도 치안 +8 · 일기토", "fx": [{"t": "sec", "n": 8}], "text": "봉인비가 세워지니 종소리가 잦아들었다"},
			{"k": "util", "label": "이계 장수를 등용한다", "hint": "금 300 · 책사 충성 +3 · 일기토", "cost": 300, "fx": [{"t": "loyal", "n": 3}], "text": "이질의 장수가 무릎을 꿇었다(충성은 낮다)"},
		]},
	## G-0105 5막 · 먼 길 — 웹 글 그대로. 오아시스·포구의 목표 성 차지(열두 달) → 열두 달 안 성 하나 더, 성연 충성 → {책사} 충성(앞 막들과 같다).
	{"id": "r5_silk", "no": 13, "act": 5, "title": "실크로드 대상", "emoji": "🐫", "when": {"minTurn": 144, "orCities": 32},
		"mix": {"past": "대상·낙타", "now": "사막 트럭", "future": "궤도 탐사 드론"},
		"text": "서쪽에서 대상 행렬이 길을 열어 달라 청한다. 사막 트럭이 낙타 곁을 달리고, 궤도의 탐사 드론이 모래 밑 옛 도시를 찾고 있다. 길을 열면 교역이 들어오지만 관문을 지킬 병사가 든다.",
		"choices": [
			{"k": "atk", "label": "관문을 열고 병사를 보낸다", "hint": "수도 훈련 +6 · 금 +400 · 오아시스의 성", "fx": [{"t": "train", "n": 6}, {"t": "gold", "n": 400}], "text": "병사가 관문을 지키니 대상이 줄을 이었다"},
			{"k": "def", "label": "길을 열되 통행세를 받는다", "hint": "금 +600 · 오아시스의 성", "fx": [{"t": "gold", "n": 600}], "text": "통행세가 곳간을 채웠다"},
			{"k": "util", "label": "드론에게 길 안내를 맡긴다", "hint": "금 200 · 군량 +1500 · 오아시스의 성", "cost": 200, "fx": [{"t": "food", "n": 1500}], "text": "드론이 길을 비추니 짐이 하나도 잃지 않고 닿았다"},
		]},
	{"id": "r5_west", "no": 14, "act": 5, "title": "대진의 사신", "emoji": "📜", "when": {"minTurn": 156, "orCities": 34},
		"mix": {"past": "사신", "now": "도하의 번역기", "future": "은하가 본 별 지도"},
		"text": "서쪽 끝 나라의 사신이 이르렀다. 도하가 번역기를 들어 말을 옮기고, 은하가 본 별 지도에 그 나라가 표시되어 있다. 화친할지, 싸울지, 교역할지 정해야 한다.",
		"choices": [
			{"k": "atk", "label": "군세를 보여 위세를 세운다", "hint": "수도 훈련 +8 · 이웃 우호 -10 · 설전", "fx": [{"t": "train", "n": 8}, {"t": "rel", "n": -10}], "text": "위세에 눌린 사신이 조용해졌다"},
			{"k": "def", "label": "화친을 청한다", "hint": "이웃 우호 +20 · 설전", "fx": [{"t": "rel", "n": 20}], "text": "화친 조약이 맺어졌다"},
			{"k": "util", "label": "교역을 튼다", "hint": "금 300 · 금 +900 · 설전", "cost": 300, "fx": [{"t": "gold", "n": 900}], "text": "별 지도를 따라 교역이 열렸다"},
		]},
	{"id": "r5_south", "no": 15, "act": 5, "title": "남해의 배", "emoji": "⛵", "when": {"minTurn": 168, "orCities": 36},
		"mix": {"past": "목선", "now": "공석의 구조선", "future": "성연의 항법"},
		"text": "남해의 섬들이 이어 보인다. 목선이 늘어선 포구에서 공석이 구조선을 띄우고, 성연이 항법으로 항로를 연다. 섬마다 다른 시대의 것들이 표류해 왔다는 소문이 있다.",
		"choices": [
			{"k": "atk", "label": "수군을 보내 섬을 살핀다", "hint": "수도 훈련 +8 · 포구의 성", "fx": [{"t": "train", "n": 8}], "text": "수군이 섬을 살피니 표류물에서 병기가 나왔다"},
			{"k": "def", "label": "포구를 다진다", "hint": "수도 치안 +8 · 포구의 성", "fx": [{"t": "sec", "n": 8}], "text": "포구가 다져져 배가 안전히 드나들었다"},
			{"k": "util", "label": "항로를 열어 교역한다", "hint": "금 300 · 금 +800 · 포구의 성", "cost": 300, "fx": [{"t": "gold", "n": 800}], "text": "성연의 항법으로 남해 교역이 열렸다"},
		]},
	## G-0110 6막 · 천하 — 웹 r6_end. 승리 종류 글은 고돗 판정(realm_rules_war.check_result: 통일 win·문화 win_culture·화친 win_diplomacy)에 있는 셋만
	## (웹의 패권·생존은 고돗 판정에 없음 — 그 판이면 기본 글).
	{"id": "r6_end", "no": 16, "act": 6, "title": "천하의 끝", "emoji": "🎆", "when": {"minTurn": 0, "victory": true},
		"mix": {"past": "잔치", "now": "도하가 찍은 기록 영상", "future": "성연의 귀환 항로"},
		"text": "천하의 끝이 다가왔다. 잔치의 등불 아래 도하가 기록 영상을 찍고, 성연이 귀환 항로를 펼쳐 보인다. 시간 틈 사람들은 제 시대로 돌아갈지 남을지 저마다 고민한다. 이 판의 이야기는 여기서 매듭짓는다.",
		"textBy": {
			"win": "천하가 하나가 되었다. 통일 잔치의 등불 아래 도하가 기록 영상을 찍고, 성연이 귀환 항로를 펼쳐 보인다. 시간 틈 사람들은 제 시대로 돌아갈지 남을지 저마다 고민한다.",
			"win_culture": "서고에 세 시대의 책이 나란히 꽂혔다. 도하가 기록 영상을 찍고 성연이 귀환 항로를 그려 넣었다. 시간 틈 사람들은 책 곁에 남을지 고민한다.",
			"win_diplomacy": "화친의 잔치가 열렸다. 도하가 기록 영상을 찍고 성연이 귀환 항로를 펼친다. 이웃 나라 사신과 시간 틈 사람들이 한 자리에 앉았다.",
		},
		"choices": [
			{"k": "atk", "label": "돌아가는 이를 배웅한다", "hint": "금 +2000 · 책사 충성 +5", "fx": [{"t": "gold", "n": 2000}, {"t": "loyal", "n": 5}], "text": "귀환 항로에 등불이 켜졌고 시간 틈 사람들이 손을 흔들었다"},
			{"k": "def", "label": "남는 이와 함께 지낸다", "hint": "수도 치안 +15 · 책사 충성 +5", "fx": [{"t": "sec", "n": 15}, {"t": "loyal", "n": 5}], "text": "남은 이들이 성 안에 눌러앉아 이 시대의 이웃이 되었다"},
			{"k": "util", "label": "기록 영상을 서고에 남긴다", "hint": "금 +1000 · 군량 +3000", "fx": [{"t": "gold", "n": 1000}, {"t": "food", "n": 3000}], "text": "기록 영상은 서고에서 세 시대를 잇는 책이 되었다"},
		]},
	## G-0117 7막 · 틈의 끝 — 웹 r7_gather·r7_after·r7_end. 결말 뒤, 시간 틈 사람 아홉(realm_officer_pool TIME_FOLK)이 모두 roster 에 있어야 첫 카드가 뜬다(when.allTime).
	## 뒤 두 카드 글은 r7_gather 에서 고른 답(textByK.from)으로 갈린다.
	{"id": "r7_gather", "no": 17, "act": 7, "title": "틈 아래 모인 아홉", "emoji": "🌀", "when": {"minTurn": 0, "victory": true, "allTime": true},
		"mix": {"past": "{책사}·옛 성터의 시간 기둥", "now": "도하의 관측 기록", "future": "성연의 귀환 항로"},
		"text": "결말의 잔치가 끝난 뒤, 시간 틈 사람 아홉이 성 앞 옛 성터에 모였다. 하늘의 금은 아직 아물지 않았다. {책사} 이(가) 시간 기둥의 그림자를 재고, 도하는 관측 기록을 펼치고, 성연은 귀환 항로의 마지막 눈금을 짚는다. 틈을 닫을지, 그대로 둘지, 길로 쓸지 — 이 성의 주인이 정할 차례다.",
		"choices": [
			{"k": "atk", "label": "틈을 닫는다", "hint": "수도 치안 +10 · 책사 충성 +5", "fx": [{"t": "sec", "n": 10}, {"t": "loyal", "n": 5}], "text": "시간 기둥에 마지막 쐐기를 박았다 — 하늘의 금이 소리 없이 아물기 시작한다"},
			{"k": "def", "label": "틈을 그대로 둔다", "hint": "금 +800 · 수도 군량 +2000", "fx": [{"t": "gold", "n": 800}, {"t": "food", "n": 2000}], "text": "틈은 그대로 두기로 했다 — 아홉이 번갈아 지켜보기로 약속했다"},
			{"k": "util", "label": "틈을 길로 쓴다", "hint": "금 +1500 · 수도 훈련 +5", "fx": [{"t": "gold", "n": 1500}, {"t": "train", "n": 5}], "text": "성연이 항로에 첫 등불을 걸었다 — 틈이 세 시대를 잇는 길이 되었다"},
		]},
	{"id": "r7_after", "no": 18, "act": 7, "title": "틈이 남긴 것", "emoji": "🌠", "when": {"minTurn": 0, "victory": true},
		"mix": {"past": "성터의 비석·{책사}", "now": "도하의 새 관측 기록", "future": "성연이 그은 새 항로"},
		"text": "틈이 남긴 것을 살필 때가 왔다. {책사} 이(가) 성터에서 소식을 모아 왔다.",
		"textByK": {
			"from": "r7_gather",
			"atk": "틈이 닫히고 열두 달이 지났다. 하늘의 금은 흔적도 없고 귀환 항로는 사라졌다. 아홉은 이 시대에 남기로 했고, 도하는 새 관측 기록에 \"이곳의 하늘\" 이라 적었다. 성연은 항로 대신 성벽 위 별자리를 그린다. {책사} 이(가) 성터에 비석을 세우자고 한다.",
			"def": "틈을 두고 열두 달이 지났다. 하늘의 금은 조금 넓어졌다 줄었다를 되풀이한다. 아홉은 번갈아 성터를 지키고, 도하의 관측 기록은 벌써 한 권을 채웠다. 성연은 흔들리는 항로를 손보며 \"이대로 두어도 좋겠다\" 고 웃는다.",
			"util": "틈을 길로 쓰고 열두 달이 지났다. 세 시대의 물자와 소식이 성터를 오간다. 도하는 새 관측 기록에 오가는 이를 세고, 성연은 항로에 등불을 하나씩 더 건다. {책사} 이(가) 오가는 것들을 어떻게 다스릴지 묻는다.",
		},
		"choices": [
			{"k": "atk", "label": "아홉을 장수로 세워 나아간다", "hint": "수도 훈련 +10 · 책사 충성 +5", "fx": [{"t": "train", "n": 10}, {"t": "loyal", "n": 5}], "text": "아홉이 각자 제 시대의 솜씨로 군사를 가르쳤다"},
			{"k": "def", "label": "성터를 성벽으로 둘러 지킨다", "hint": "수도 치안 +12 · 군량 +2000", "fx": [{"t": "sec", "n": 12}, {"t": "food", "n": 2000}], "text": "성터 둘레에 낮은 성벽이 올라 백성이 마음을 놓았다"},
			{"k": "util", "label": "틈에서 나온 것을 거둔다", "hint": "금 +1200", "fx": [{"t": "gold", "n": 1200}], "text": "성터에서 세 시대의 쓸 만한 것들이 나왔다"},
		]},
	{"id": "r7_end", "no": 19, "act": 7, "title": "틈의 끝", "emoji": "🌅", "when": {"minTurn": 0, "victory": true},
		"mix": {"past": "{책사}의 붓·성터 잔치", "now": "도하가 찍은 마지막 영상", "future": "성연의 마지막 항로 기록"},
		"text": "틈의 이야기가 매듭지어질 때가 왔다. 성터에 잔치가 차려진다.",
		"textByK": {
			"from": "r7_gather",
			"atk": "닫힌 하늘 아래 마지막 잔치가 열렸다. 성터 비석 옆에서 아홉이 잔을 든다. 도하가 마지막 영상을 찍고, 성연이 항로 대신 별자리를 새겼다. 돌아갈 길은 없어도 갈 곳은 이곳이라고, {책사} 이(가) 비문에 적었다. 틈의 이야기는 여기서 끝난다.",
			"def": "틈이 흔들리는 하늘 아래 마지막 잔치가 열렸다. 번갈아 지키던 아홉이 오랜만에 한자리에 앉았다. 도하가 마지막 영상을 찍고, 성연이 흔들리는 항로를 잔에 비춘다. 열린 채로 두는 것도 하나의 끝이라고, {책사} 이(가) 붓을 든다. 틈의 이야기는 여기서 끝난다.",
			"util": "길이 된 하늘 아래 마지막 잔치가 열렸다. 세 시대의 손님이 성터에 모였다. 도하가 마지막 영상을 찍고, 성연이 항로 끝에 마지막 등불을 걸었다. 오가는 길이 곧 이 성의 이름이라고, {책사} 이(가) 붓을 든다. 틈의 이야기는 여기서 끝난다.",
		},
		"choices": [
			{"k": "atk", "label": "아홉과 함께 잔을 든다", "hint": "금 +2500 · 책사 충성 +8", "fx": [{"t": "gold", "n": 2500}, {"t": "loyal", "n": 8}], "text": "아홉과 이 성의 사람들이 함께 잔을 들었다 — 웃음이 성터를 채웠다"},
			{"k": "def", "label": "이 성을 모두의 고향으로 삼는다", "hint": "수도 치안 +20 · 책사 충성 +8", "fx": [{"t": "sec", "n": 20}, {"t": "loyal", "n": 8}], "text": "아홉이 이 성을 고향이라 불렀다 — 성 안 골목마다 등불이 켜졌다"},
			{"k": "util", "label": "틈의 기록을 서고에 남긴다", "hint": "금 +1200 · 군량 +4000", "fx": [{"t": "gold", "n": 1200}, {"t": "food", "n": 4000}], "text": "마지막 기록이 서고에 꽂혔다 — 세 시대가 한 책장에서 만난다"},
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
	"r3_river": {"kind": "own", "on": "*", "months": 10, "title": "적벽 강 위 · 강가의 성",
		"intro": "강 위의 결전이 열렸다 — 열 달 안에 성을 하나 더 손에 넣어라.",
		"win": {"text": "강가의 성을 얻었다 — 성연의 바람 기록이 그날 밤 정확히 들어맞았다", "hint": "책사 충성 +8 · 금 +600 · 수도 치안 +5", "fx": [{"t": "loyal", "n": 8}, {"t": "gold", "n": 600}, {"t": "sec", "n": 5}]},
		"lose": {"text": "강 위의 싸움을 끝내 못 이겼다 — 성연이 조용히 기록을 접었다", "hint": "책사 충성 -4", "fx": [{"t": "loyal", "n": -4}]}},
	"r3_duel": {"kind": "duel", "on": ["atk", "def"], "foe": "의체 무사 영점", "title": "의체 무사의 일기토",
		"intro": "영점이 의체 팔로 창을 세웠다. \"나보다 강한 장수 밑에만 선다.\" {맹장} 이(가) 마당에 나선다 — 세 수 가운데 하나씩, 승부가 날 때까지.",
		"win": {"text": "{맹장} 이(가) 영점을 꺾었다 — 영점이 창을 거두고 함께 떠돌던 장수를 소개했다", "hint": "재야 인재 합류", "fx": [{"t": "recruitFree", "bonus": 10}]},
		"lose": {"text": "{맹장} 이(가) 밀렸다 — 영점이 코웃음 치며 {이웃} 에게로 떠났다", "hint": "영점이 이웃 세력으로", "fx": []}},
	## G-0101 4막 — 웹 "목표 성(prov fu·pf) 차지 열두 달"을 고돗은 2·3막처럼 열두 달 안에 성 하나 더. 일기토는 웹처럼 어떤 답이든(상대가 우리 편이 아니므로).
	"r4_rift": {"kind": "own", "on": "*", "months": 12, "title": "균열의 왕 · 문 곁의 성",
		"intro": "균열의 문이 열렸다 — 열두 달 안에 성을 하나 더 손에 넣어 문을 눌러라.",
		"win": {"text": "균열 곁의 성을 빼앗아 문을 눌렀다 — 성벽 위에서 강서의 특공대가 함성을 올렸다", "hint": "수도 훈련 +8 · 책사 충성 +5 · 금 +600", "fx": [{"t": "train", "n": 8}, {"t": "loyal", "n": 5}, {"t": "gold", "n": 600}]},
		"lose": {"text": "열두 달이 지나도록 문 곁의 성을 못 얻었다 — 성혼의 기세가 성벽을 갉았다", "hint": "수도 치안 -6", "fx": [{"t": "sec", "n": -6}]}},
	"r4_plague": {"kind": "own", "on": "*", "months": 12, "title": "역병의 근원 · 폐허 곁의 성",
		"intro": "역병의 근원이 드러났다 — 열두 달 안에 성을 하나 더 손에 넣어 근원을 막아라.",
		"win": {"text": "폐허 곁의 성을 얻어 근원을 막았다 — 금담의 백신 공장이 성 안까지 이어졌다", "hint": "수도 치안 +8 · 군량 +1000 · 금 +500", "fx": [{"t": "sec", "n": 8}, {"t": "food", "n": 1000}, {"t": "gold", "n": 500}]},
		"lose": {"text": "근원을 못 막은 채 열두 달이 갔다 — 역병이 곳간까지 번졌다", "hint": "수도 군량 -1200", "fx": [{"t": "food", "n": -1200}]}},
	"r4_tomb": {"kind": "duel", "on": "*", "foe": "묘역의 망장", "title": "망자의 맹세 · 묘문의 일기토",
		"intro": "망장이 묘역 종소리 속에서 창을 세웠다. \"이기는 쪽이 이 밤을 갖는다.\" {맹장} 이(가) 나선다 — 세 수 가운데 하나씩, 승부가 날 때까지.",
		"win": {"text": "{맹장} 이(가) 망장을 꺾었다 — 종소리가 멎고 망자 명부에 이름이 하나 지워졌다", "hint": "수도 치안 +8 · 금 +600 · 책사 충성 +3", "fx": [{"t": "sec", "n": 8}, {"t": "gold", "n": 600}, {"t": "loyal", "n": 3}]},
		"lose": {"text": "{맹장} 이(가) 밀렸다 — 망장이 웃으며 물러났고 종소리가 밤새 이어졌다", "hint": "수도 훈련 -6 · 치안 -4", "fx": [{"t": "train", "n": -6}, {"t": "sec", "n": -4}]}},
	## G-0105 5막
	"r5_silk": {"kind": "own", "on": "*", "months": 12, "title": "실크로드 대상 · 오아시스의 성",
		"intro": "대상 길이 열렸다 — 열두 달 안에 성을 하나 더 손에 넣어 관문을 세워라.",
		"win": {"text": "오아시스의 성을 얻어 관문을 세웠다 — 궤도의 드론이 모래 밑 옛 도시를 하나 찾았다", "hint": "금 +800 · 군량 +1000", "fx": [{"t": "gold", "n": 800}, {"t": "food", "n": 1000}]},
		"lose": {"text": "길을 지킬 성을 못 얻었다 — 대상이 다른 길로 돌아갔다", "hint": "금 -300", "fx": [{"t": "gold", "n": -300}]}},
	"r5_west": {"kind": "debate", "on": "*", "title": "대진의 사신 · 통역의 설전",
		"intro": "도하의 번역기가 사신의 말을 옮긴다. 문답 세 개 — 두 개 이상 맞히면 사신이 조건을 낮춘다.",
		"win": {"text": "사신이 설전에 웃으며 조건을 낮췄다 — 별 지도에 새 길이 그어졌다", "hint": "이웃 우호 +15 · 금 +700", "fx": [{"t": "rel", "n": 15}, {"t": "gold", "n": 700}]},
		"lose": {"text": "말이 어긋나 사신이 불쾌해했다 — 번역기가 조용해졌다", "hint": "이웃 우호 -5", "fx": [{"t": "rel", "n": -5}]}},
	"r5_south": {"kind": "own", "on": "*", "months": 12, "title": "남해의 배 · 포구의 성",
		"intro": "남해 항로가 보인다 — 열두 달 안에 성을 하나 더 손에 넣어 포구를 열어라.",
		"win": {"text": "포구의 성을 얻어 항로를 열었다 — 성연의 항법이 섬마다 표류물을 짚어 냈다", "hint": "책사 충성 +5 · 금 +700 · 수도 훈련 +6", "fx": [{"t": "loyal", "n": 5}, {"t": "gold", "n": 700}, {"t": "train", "n": 6}]},
		"lose": {"text": "포구를 얻지 못한 채 계절이 갔다 — 표류물은 다른 이의 것이 되었다", "hint": "금 -300", "fx": [{"t": "gold", "n": -300}]}},
	"r2_debate": {"kind": "debate", "on": "*", "title": "논객의 설전 · 재야 학자",
		"intro": "명변이 이름난 재야 학자를 마주 앉혔다. 문답 세 개 — 두 개 이상 맞히면 학자가 스스로 곁으로 온다.",
		"win": {"text": "학자가 설전에 무릎을 꿇고 스스로 곁에 섰다 — 서당에 문답 소리가 커졌다", "hint": "재야 학자 합류 · 문화 문답 +20", "fx": [{"t": "recruitFree", "bonus": 5}, {"t": "quiz", "n": 20}]},
		"lose": {"text": "학자가 웃으며 돌아섰다 — 그래도 서당엔 토론 소리가 남았다", "hint": "문화 문답 +5", "fx": [{"t": "quiz", "n": 5}]}},
}

const FX_KINDS := ["gold", "food", "sec", "train", "loyal", "rel", "recruitFree", "quiz"]
const DEBATE_WIN := 2
const DUEL_MAX := 5   # 일기토 최대 수 — 다 비기면 짐


static func fresh() -> Dictionary:
	return {"next": 0, "done": [], "picks": {}, "debate": {}, "stage": {}, "own": {}, "duel": {}}


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
	out.duel = (out.duel as Dictionary).duplicate() if out.duel is Dictionary else {}
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
static func due(st: Dictionary, months: int, cities: int, result := "", all_time := false) -> bool:
	var c := next_card(st)
	if c.is_empty() or not (st.get("stage", {}) as Dictionary).is_empty():
		return false
	var w: Dictionary = c.when
	if bool(w.get("allTime", false)) and not all_time:   # G-0117 7막 — 아홉이 다 모여야
		return false
	if bool(w.get("victory", false)):   # G-0110 결말 카드 — 이겼을 때만
		return result.begins_with("win")
	return months >= int(w.get("minTurn", 0)) or (w.has("orCities") and cities >= int(w.orCities))


## 카드 글 — textByK 면 앞 카드에서 고른 답의 글(G-0117), textBy 에 그 승리 종류가 있으면 그 글(G-0110), 아니면 text.
static func card_text(c: Dictionary, result := "", picks := {}) -> String:
	if c.has("textByK"):
		var tk: Dictionary = c.textByK
		var pk := String(picks.get(String(tk.get("from", "")), ""))
		return String(tk.get(pk, c.get("text", ""))) if pk != "" and pk != "from" else String(c.get("text", ""))
	return String((c.get("textBy", {}) as Dictionary).get(result, c.get("text", "")))


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
	var on: Variant = stage.get("on", "")
	var opens := on is Array and (on as Array).has(String(ch.k)) or (not (on is Array) and (String(on) == "*" or String(on) == String(ch.k)))
	return {"choice": ch, "stage": stage if not stage.is_empty() and opens else {}}


## 일기토 결과(이겼나) → win/lose 칸. duel[id] 에 결과.
static func duel_outcome(st: Dictionary, card_id: String, won: bool) -> Dictionary:
	if not st.has("duel") or not (st.duel is Dictionary):
		st.duel = {}
	(st.duel as Dictionary)[card_id] = "win" if won else "lose"
	return (STAGES.get(card_id, {}) as Dictionary).get("win" if won else "lose", {})


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
	return text.replace("{책사}", String(names.get("책사", "책사"))).replace("{이웃}", String(names.get("이웃", "이웃 군주"))).replace("{맹장}", String(names.get("맹장", "맹장")))


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
