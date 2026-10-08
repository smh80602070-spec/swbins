extends RefCounted
## G-0087 — 사가종횡 이야기 표(정본 `scenario/saga-story.md` "이름 없는 떠돌이"). 1부 · 무명 네 장 + G-0091 2부 · 갈래 네 장 + G-0095 3부 · 불길 네 장 + G-0100 4부 · 이름 네 장(문 고르기·칭호 고르기) + G-0104 5부 · 문 너머 세 장.
## 대사는 웹 구현(saga-web/saga-story/js/data-scenario.js SCENES)과 같다(감정 칸만 뺌). 단계는 웹과 거의 같다 — 고돗에도 신야성·허도·
## 허창 들판 장면과 사명 q_first·q_gear1·q_field·q_boss1, 1차 전직이 그대로 있다.
## 엔진은 world/scenario_runner.gd(장면마다 새로 뜬다), 진행은 StorySaveState.scenario(fresh() 모양). 인물은 가상, {스승}은 도감 가명.
##
## 한 장 = {id, no, title, stage, need(열리는 레벨), mix{past,now,future}, steps, exp, gold, blurb}
##   steps 차례대로:
##     {"t": "stage", "stage": 장면 키}           그 장면에 들어선다(키 = SCENE_KEYS 값)
##     {"t": "talk", "scene": id, "at"?: 장면 키}  대화(at 이 있으면 그 장면에서만 뜬다)
##     {"t": "mission", "quest": 사명 key}         그 사명을 완수했다(StorySaveState.quests_done)
##     {"t": "job", "tier": n}                     n차 전직을 했다
##     {"t": "gate"}                               관문 대장(사냥터 주간 챔피언)을 한 번이라도 이겼다(웹 gate — 이긴 적이 있으면 그것으로 됨)
##     {"t": "stagekill", "stage": 키, "n": n}     그 사냥터 처치 수(stage_kills) n 이상(G-0095 — 고돗에 호로곡 사명이 없어서)
##     {"t": "boss", "n": n}                       이 단계가 시작된 뒤 보스 n(StorySaveState.bosses 차이)
##     {"t": "rift", "n": n}                       이 단계가 시작된 뒤 비경을 n 번 끝까지 깸(story_labyrinth 가 st.rifts 를 올림)
##     {"t": "bond", "n": n}                       지금 스승과 사제 유대(mentor_bond) n 이상 — 전직하면 0 부터
##   talk 의 "by": 고르기 id — 장면 id 는 scene + "_" + 그 답(G-0100 이름 장 끝, 답 없으면 그 고르기의 첫 답)
##   장면 끝 고르기는 CHOICES(장면 id → {id, prompt, options[{key, label}]}) — 답은 st.choices[id](G-0100 문·칭호)
## 장 보상 "frags": n = 기억 조각 n(add_memory_fragments). 말한 이 "mentor+" = 다음 전직 단의 스승.
## 장마다 "part"(부)·"legacy"{level, tier}(옛 세이브 — 그만큼 왔으면 보상 없이 지나온 길).
## 장면 한 줄 = [누가, 말] — 누가 = "me"(나) · "mentor"(지금 갈래 스승) · CAST 키.

const CAST := {
	"deokbo": {"name": "신야성 촌로 덕보", "emoji": "🧓"},
	"courier": {"name": "택배 기사", "emoji": "📦"},
	"sori": {"name": "척후병 소리", "emoji": "🐎"},
	"hankeot": {"name": "여행자 한컷", "emoji": "📷"},
	"wanderer": {"name": "나그네", "emoji": "🥾"},
	"townsman": {"name": "남정성 사람", "emoji": "🏮"},
	"ieum": {"name": "탐사 대원 이음", "emoji": "🧭"},
	"guard": {"name": "산채 아래 경비병", "emoji": "🛡️"},
	"ashen": {"name": "잿빛 사자", "emoji": "🌫️"},
	"yakson": {"name": "의원 약손", "emoji": "⚕️"},
	"gwijang": {"name": "암굴 귀장", "emoji": "👹"},
	"lamp": {"name": "길잡이 등불이", "emoji": "🏮"},
}

## 장면 루트 이름 → 장면 키(웹 사냥터·마을 key).
const SCENE_KEYS := {"SinyaField": "sinya", "HeodoField": "heodo", "TestField": "field", "GangneungjinField": "port",
	"ForestHuntGround": "forest", "NamjeongseongField": "namjeong", "CaveHuntGround": "cave", "GisanchaeField": "gisan", "GorgeHuntGround": "gorge"}
const STAGE_NAMES := {"sinya": "신야성", "heodo": "허도", "field": "허창 들판", "port": "강릉진", "forest": "오림 숲", "namjeong": "남정성", "cave": "한중 굴혈", "gisan": "기산채", "gorge": "호로곡"}

## G-0100 4부 — 웹 대사 그대로(감정 칸만 뺌). 첫 발 장면 luoyang1·depth1 은 웹 data-side.js STORY.ruin·deepcave(입장 대사)를 장면으로,
## luoyang1 첫 줄만 "잿더미가 된 산채" 로(고돗엔 낙양 옛터가 없어 기산채 잿더미로), name1 끝 줄 "무예창에서" → "허도의 수련장에서"(3부와 같다).
const SCENES_P4 := {
	"luoyang1": [
		["me", "한때 도읍을 지키던 산채가 잿더미가 되었구나."],
		["wanderer", "잿더미에도 주인은 있소. 흉장이 이곳을 쥐고 있다오."],
		["me", "그 주인부터 바꾸겠소."],
	],
	"luoyang2": [
		["ashen", "…도포가 걸리적거리는군. 어차피 이 땅에서 오래 못 입을 옷이었다."],
		["me", "당신이 폐도 흉장이었습니까! 무너진 궁궐 한복판에서 전철 소리가 났던 까닭이군요."],
		["ashen", "병기를 대 준 것은 나요. 문이 열려 있는 한 어느 시대 물건이든 흘러오지. 잿더미 위 기계 갑주는 덤이었소."],
		["me", "그럼 문 앞에서 다시 만납시다. 문을 닫으려는 사람이 여기 있으니까요."],
	],
	"depth1": [
		["me", "빛이 닿지 않는 깊이다…"],
		["me", "여기까지 왔다. 끝을 보고 나가겠다."],
	],
	"depth2": [
		["ieum", "여기부터는 빛이 안 닿습니다. 제 탐사 등을 앞세울게요."],
		["hankeot", "조명은 제가 맡을게요! 암굴 석벽에 이 땅 것이 아닌 색이 번져 있어요. 사진 한 장만!"],
		["me", "석벽이 점점 따뜻해집니다. 문이 가까운가 봅니다."],
		["ieum", "문 앞엔 귀장이 서 있을 거예요. 전쟁이 끝나지 않게 문을 연 자입니다."],
	],
	"gate1": [
		["gwijang", "전쟁이 끝나면 문도 닫히지… 그러니 끝나지 않게 했다. 옛 갑옷 속에 든 것은 사람이 아니다."],
		["me", "그 때문에 수많은 시대가 이 땅에 새어 들었습니다. 이제 끝입니다."],
		["gwijang", "문이 흔들린다…! 문 둘레의 전선이 무너진다. 이제 문은 네가 정해라."],
	],
	"gate2": [
		["ieum", "문이 흔들리며 빛 소용돌이가 일어요. 닫으면 새어 드는 시대도 멎지만 저는 제 시대로 돌아가야 해요."],
		["ieum", "지키면 당신이 문지기가 됩니다. 문은 열린 채, 새어 드는 것을 막는 쪽이에요."],
		["me", "이름 없는 제가, 이 문 앞에서 정합니다."],
	],
	"name1": [
		["mentor+", "이름 없이 여기까지 왔구나. 마지막 자리다. 한컷의 사진 속 너는 이 땅의 사람이 아니더구나."],
		["mentor+", "이음이 돌아갈 빛이 문 앞에서 기다린다. 서둘러 마지막 전직을 마쳐라."],
		["mentor+", "🥋 허도의 수련장에서 4차 전직을 하여라."],
	],
	"name2": [
		["mentor", "넷째 자리에 올랐다. 이제 이름을 붙일 때다. 남이 붙여 준 것 말고, 네가 붙이는 이름."],
		["me", "문 너머에 두고 온 이름은 잃었지만, 이 땅에서 걸어온 길이 이름이 되겠습니다."],
	],
	"name3_close": [
		["ieum", "문이 닫혔으니 저는 제 시대로 돌아갑니다. 이 시대에 새어 든 것들은 남겠지만, 더는 늘지 않을 거예요."],
		["hankeot", "마지막 사진이에요. 이름 없던 분이 웃고 있네요."],
		["me", "이름은 얻었으니 남은 길은 제 발로 걷겠습니다. 고맙습니다, 두 분."],
	],
	## G-0104 5부 — 첫 발 장면은 웹 data-side.js STORY.beyond_past·now·future 첫 줄 앞에 "문 너머가 겹쳐 비친다"는 한 줄을 더함
	## (고돗엔 문 너머 땅이 없어 이쪽 들판·항구·비경에 저편이 겹쳐 보이는 것으로).
	"bp1": [
		["me", "들판 위로 문 저편 땅이 겹쳐 비친다…"],
		["me", "깃발이 무덤처럼 꽂혀 있다… 어느 시대 것인지 알 수 없다."],
		["me", "문 너머에도 싸움이 있었구나. 걸어서 확인하겠다."],
	],
	"beyond1": [
		["lamp", "문 저편 땅이 온통 깃발 무덤이오. 어느 시대의 전장인지 표지 하나 없소."],
		["hankeot", "사진기 초점이 자꾸 나가요. 여긴 시간이 겹쳐 찍혀요. 창 든 그림자와 총 든 그림자가 한자리에…"],
		["me", "문을 지키는 것은 문 이쪽만이 아니었군요. 넘어온 것이 있으면 넘어간 자리도 있겠지요."],
		["lamp", "다음은 무너진 도시 쪽이오. 전철 소리 같은 것이 들리오."],
	],
	"bn1": [
		["me", "항구 거리 위로 문 저편 도시가 겹쳐 비친다…"],
		["me", "간판 글자가 거꾸로다. 신호등은 저 혼자 켜진다."],
		["me", "이 도시가 왜 무너졌는지 끝까지 보겠다."],
	],
	"beyond2": [
		["hankeot", "여기가… 도시였어요? 간판은 남았는데 글자가 다 거꾸로예요."],
		["lamp", "신호등이 켜질 때마다 옛 전장에서 넘어온 그림자가 길을 건너오. 문이 이쪽과 저쪽을 자꾸 섞어 놓소."],
		["me", "문이 열려 있는 한 섞임은 멈추지 않겠군요."],
		["hankeot", "마지막 신호는 하늘에서 와요. 궤도 기지가 아직 깨어 있대요."],
	],
	"bf1": [
		["me", "비경 문 너머로 하늘 위 성이 비친다…"],
		["me", "하늘 위에 지은 성이라니… 등불이 아직 켜져 있다."],
		["me", "문 너머의 끝이다. 여기서 세 시대를 다 보겠다."],
	],
	"beyond3_close": [
		["ieum", "(기지 통신) 제 시대에서도 이 기지 불빛이 보여요! 문이 닫혔는데도 신호가 남아 있었어요."],
		["me", "이곳에서 문 너머의 전부가 보입니다 — 옛 전장, 무너진 도시, 그리고 저 별."],
		["hankeot", "찍었어요. 세 시대가 한 장에 담겼어요. 문 이쪽 사람들에게 보여 줄 거예요."],
		["me", "닫은 문 저편이라도 잊지는 않겠습니다. 다음 길로 가지요."],
	],
	"beyond3_keep": [
		["ieum", "기지 등불이 켜졌어요! 제가 나고 자란 곳의 등불과 같은 색이에요. 문지기님, 여기까지 오셨군요."],
		["me", "이곳에서 문 너머의 전부가 보입니다 — 옛 전장, 무너진 도시, 그리고 저 별."],
		["hankeot", "찍었어요. 세 시대가 한 장에 담겼어요. 문 이쪽 사람들에게 보여 줄 거예요."],
		["me", "문을 지키려면 저쪽을 알아야 하지요. 이제 알았습니다. 다음 길로 가지요."],
	],
	"name3_keep": [
		["ieum", "문지기가 되신다니… 저는 이 시대 소식을 문 너머에 전하겠습니다. 문은 열린 채, 당신이 지켜 주세요."],
		["hankeot", "문 너머엔 다른 하늘이 있대요. 다음에 오면 사진 한 장만 부탁해요!"],
		["me", "이름은 얻었습니다. 문 너머 층이 열리는 날까지 이 자리를 지키겠습니다."],
	],
}

## 장면 끝 고르기(웹 SCENES.choice) — 답은 st.choices[id]. 칭호는 고돗에 칭호 칸이 없어 답만 적고 알림으로 보인다.
const CHOICES := {
	"gate2": {"id": "gate", "prompt": "난세의 문을 어떻게 할 것인가", "options": [
		{"key": "close", "label": "문을 닫는다"}, {"key": "keep", "label": "문을 지킨다"}]},
	"name2": {"id": "name", "prompt": "스스로 붙일 칭호", "options": [
		{"key": "found", "label": "이름을 되찾은 자"}, {"key": "wander", "label": "문 너머의 나그네"}, {"key": "none", "label": "이름 없이 걷는 자"}]},
}

const SCENES := {
	"sinya1": [
		["deokbo", "성 밖이 도적 천지라네. 그런데 자네, 이름이 어떻게 되나?"],
		["me", "…기억나지 않습니다. 서쪽에서 걸어왔다는 것밖에는."],
		["deokbo", "이름 없는 떠돌이라. 요즘은 그런 사람이 많지. 성 밖에서 주운 건데, 이 네모난 판이 자네 것인가? 만지면 불이 들어와."],
		["me", "처음 봅니다. 그런데… 손에 익습니다."],
		["deokbo", "도적 하나는 칼 대신 푸른 빛이 나는 검을 들었다더군. 예삿놈들이 아닐세."],
		["me", "그럼 길부터 트겠습니다. 들판에서 열을 베고 오지요."],
	],
	"sinya2": [
		["deokbo", "벌써 열을 베고 왔나! 이름 없는 손이 제일 빠르다더니."],
		["deokbo", "허도로 가게. 장터에 없는 것이 없어. 신야성 밖 소식도 그리로 모이지."],
	],
	"heodo1": [
		["courier", "저기요! 이 짐, 주소가 없어요. 받는 이 칸에 옛 땅 이름만 잔뜩이고…"],
		["courier", "상자를 흔들면 푸른 빛이 지도처럼 펼쳐져요. 이런 길은 어디에도 없는데."],
		["me", "길이 없어도 짐은 어디론가 가려던 것이겠지요. 저도 몸부터 갖춰야겠습니다."],
	],
	"heodo2": [
		["courier", "든든해 보이시네요! 저자가 이 근방에서 제일 큽니다. 부족하면 언제든 들르세요."],
		["courier", "짐은… 제가 좀 더 헤매 보겠습니다. 들판 소식이 궁금하시면 척후병을 찾으세요."],
	],
	"field1": [
		["sori", "황건 두목의 진에 요즘 못 보던 병기가 들어갔소. 잿빛 떼쥐가 뛰고, 하늘엔 작은 눈알 같은 것이 뜨오."],
		["me", "눈알 같은 것이라니, 정찰 짐승입니까?"],
		["sori", "짐승이 아니라 날아다니는 쇠붙이요. 들판을 비우지 않고는 두목 근처에도 못 가오."],
		["me", "먼저 들판을 비우고, 그다음에 두목의 목을 보겠습니다."],
	],
	"field2": [
		["sori", "두목이 쓰러졌소! 진 한복판에서 푸른 빛 조각이 나왔는데, 누가 남긴 건지 모르겠소."],
		["me", "누가 대 주지 않고서야 도적이 저런 병기를 가질 수 없지요."],
		["sori", "이제 허도의 스승을 찾아가 보시오. 열 번은 넘게 해가 진 자라면 배울 자격이 있소."],
	],
	"job1": [
		["mentor", "이름 없는 자가 제일 빨리 배운다. 이름에 매여 있지 않으니까."],
		["mentor", "저 표적지를 보아라. 누가 세웠는지 모르나, 이 땅의 것이 아닌 나무로 만들었다. 내 무기도 그렇다. 어느 시대 것인지 나도 모른다."],
		["mentor", "🥋 허도의 수련장에서 네 길을 골라라. 무사·궁수·협객·방사 — 고른 길이 네 첫 이름이 된다."],
	],
	"job2": [
		["mentor", "골랐구나. 이제 너는 이름 없는 채로 한 갈래를 얻었다."],
		["mentor", "동쪽 강릉진 부두에 쇠로 된 배가 걸려 있다더라. 그 배의 사진을 찍는 여행자가 있다지 — 만나 보아라."],
		["me", "가겠습니다. 이름은 가는 길에서 찾지요."],
	],
	"port1": [
		["hankeot", "아, 마침 잘 오셨어요! 이 사진 좀 보세요. 부두에 쇠 화물선이 걸려 있는데, 배 뒤로 바다가 안 찍혀요. 텅 빈 하늘만요."],
		["me", "옛 나루에 쇠로 된 배라니… 실물은 더 기이하겠군요."],
		["hankeot", "조종실엔 푸른 빛 판이 깜박여요. 그 배를 차지한 게 왜구 선장인데, 사냥터 관문 대장 노릇을 하죠."],
		["me", "선장부터 만나 보겠습니다. 문이 그 사람 손에 있다면요."],
	],
	"port2": [
		["hankeot", "선장이 쓰러졌어요! 쇠배 조종실 판에서 지도 같은 게 나왔는데요."],
		["me", "이 나루도, 이 바다도 아닌 물길이 그려져 있습니다. 없는 바다의 지도군요."],
		["hankeot", "지도 끝이 오림 숲 쪽을 가리켜요. 거기서 발소리가 자기 것만 들리지 않는다는 말이 돌고요."],
	],
	"forest1": [
		["wanderer", "숲 그늘에선 발소리가 제 것만 들리지 않소. 그림자를 조심하시오."],
		["me", "그림자가 짙을수록 눈을 크게 뜨면 됩니다."],
	],
	"forest2": [
		["wanderer", "그림자의 정체가 벼락 말벌 떼였다니… 나무에 박혀 서 있던 쇠 보행기도 봤소?"],
		["me", "경비를 서듯 서 있었습니다. 지키는 것이 무엇인지는 알 수 없고요."],
		["wanderer", "남정성으로 가 보시오. 성 사람들이 무슨 소문을 알고 있소."],
	],
	"nam2": [
		["townsman", "밤마다 굴 쪽에서 빛이 샌다오. 가로등 하나 없는 골목에 하나만 켜져 있고, 그 불빛이 굴 입구와 똑같은 색이오."],
		["me", "가로등과 굴 입구의 빛이 한 줄기라는 말씀이십니까?"],
		["townsman", "위군 도독이 굴혈에 진을 친 뒤로 시작된 일이오. 누가 가서 좀 봐 주시오."],
		["me", "길을 정했습니다. 굴혈로 가겠습니다."],
	],
	"cave1": [
		["ieum", "살았다… 도독 진 깊은 곳에 묶여 있었습니다. 저는 탐사 대원 이음, 먼 시대에서 문을 쫓아 왔습니다."],
		["ieum", "이 땅의 전쟁에 다른 시대 병기가 섞이는 건 새어 든 것입니다. 동쪽 끝에 난세의 문이 있어요."],
		["me", "문이라. 그렇다면 이름 없는 제 손에도 할 일이 있겠군요."],
		["ieum", "마을마다 서 있겠습니다. 소식이 닿으면 어디서든 말을 거세요. 우선 둘째 스승부터 찾으세요."],
	],
	"gisan1": [
		["guard", "산채 두령이 요즘 빛이 나는 병기를 쥐고 있소. 창고엔 쇠 대롱이 쌓였는데, 그게 불을 뿜으면 활이 무슨 소용이오."],
		["ashen", "…좋은 물건이오. 값만 치르면 누구 손에든 가지. 시대가 무슨 상관이겠소."],
		["me", "잠깐! 방금 그 도포 차림이 발소리도 없이 사라졌습니다."],
		["guard", "잿빛 사자라고들 하오. 두령이 누구에게 병기를 받는지 이제 알겠소."],
	],
	"gisan2": [
		["guard", "군자금이 모였소! 이걸로 산채 아래 길을 열 병량을 사겠소."],
		["me", "잿빛 사자가 그 병기를 어디서 가져오는지 알아야 합니다. 이대로면 전쟁이 끝나지 않아요."],
		["guard", "호로곡 쪽에서 불길이 올랐소. 그쪽이 더 급하오."],
	],
	"gorge1": [
		["me", "골짜기 전체가 타오른다…"],
		["yakson", "불길 속에 오래 서 있지 마시오. 탕약을 넉넉히. 부상병은 내가 옮길 테니 골짜기를 비워 주시오."],
		["me", "이 불을 넘어야 다음 길이 열린다."],
	],
	"gorge2": [
		["yakson", "부상병을 다 옮겼소. 이상한 일이 있었소 — 불길 속에서 강철 거인이 걸어 나왔는데 불이 붙지 않더이다."],
		["me", "진압 특공대 같은 것들도 보았습니다. 이 땅의 전쟁이 아닙니다."],
		["yakson", "적국 대장군의 갑주에도 푸른 빛 판이 박혀 있었소. 이음이라는 대원을 찾아가시오. 문 이야기를 아는 이요."],
	],
	"lab1": [
		["ieum", "제 탐사 등으로 비경을 엽니다. 이 층들은 문이 남긴 기억의 껍질이에요. 돌 발판에 박힌 표지판이 보이면 다른 시대의 흔적입니다."],
		["ieum", "허도의 비경 문으로 들어가 끝의 수호장을 쓰러뜨리면 잃어버린 조각이 나올지도 몰라요. 도중에 나가도 얻은 조각은 남습니다."],
		["me", "제 이름이 없는 까닭이 거기 있다면 가야지요."],
	],
	"lab2": [
		["me", "…기억났습니다. 저는 문 너머에서 왔어요. 문이 열릴 때 떨어져 이 땅에 나왔습니다."],
		["ieum", "그래서 이름이 없었던 거군요. 문 너머에 두고 온 이름이 있을 겁니다."],
		["me", "그 이름을 찾으러 문까지 가겠습니다. 잿빛 사자보다 먼저요."],
	],
	"job31": [
		["mentor+", "네 이름은 문 너머에 두고 왔구나. 내 방 벽의 이 오래된 사진을 보아라 — 이 땅에서 찍을 수 없는 색이다."],
		["mentor+", "내 칼날에 비친 것이 무엇이냐. 나도 오래 전에 문을 본 적이 있다. 이제 셋째 자리를 열어 주마."],
		["mentor+", "🥋 허도의 수련장에서 3차 전직을 하여라. 그리고 내 곁에서 손을 맞춰 보자."],
	],
	"job32": [
		["mentor", "셋째 자리에 올랐다. 손도 맞았다. 이제 네 손은 이름 없는 채로도 이 땅에서 가장 빠르다."],
		["mentor", "잿빛 사자가 옛 도읍 낙양으로 갔다는 소문이다. 도포를 벗게 될 것이다 — 가서 확인하여라."],
		["me", "다녀오겠습니다. 이름을 찾는 길이 그쪽에 있습니다."],
	],
	"cave2": [
		["mentor", "이름 없는 채로 둘째 자리에 올랐구나. 이름이 없으니 남의 시대 기술도 그대로 배우는군."],
		["mentor", "더 큰 불길이 기산채 쪽에서 오른다 한다. 다음 길은 스스로 정하되, 잿빛 자를 조심하라."],
		["me", "명심하겠습니다. 이름을 얻을 때까지 걷겠습니다."],
	],
}

const CHAPTERS := [
	{"id": "p1_sinya", "no": 1, "title": "서막 · 신야성", "stage": "신야성", "need": 1,
		"blurb": "이름을 묻는 촌로 앞에서 대답하지 못한다. 성 밖은 도적 천지다.",
		"mix": {"past": "성문·촌로", "now": "성 밖에서 주운 휴대폰", "future": "도적이 든 빛 칼"},
		"steps": [{"t": "stage", "stage": "sinya"}, {"t": "talk", "scene": "sinya1", "at": "sinya"}, {"t": "mission", "quest": "q_first"}, {"t": "talk", "scene": "sinya2"}],
		"exp": 80, "gold": 300},
	{"id": "p1_heodo", "no": 2, "title": "허도 가는 길", "stage": "허도", "need": 1,
		"blurb": "허도 장터의 택배 기사가 주소 없는 짐을 들고 헤맨다.",
		"mix": {"past": "허도 장터", "now": "택배 기사", "future": "짐 속 빛 지도"},
		"steps": [{"t": "stage", "stage": "heodo"}, {"t": "talk", "scene": "heodo1", "at": "heodo"}, {"t": "mission", "quest": "q_gear1"}, {"t": "talk", "scene": "heodo2"}],
		"exp": 150, "gold": 500},
	{"id": "p1_field", "no": 3, "title": "허창 들판의 두목", "stage": "허창 들판", "need": 1,
		"blurb": "척후병과 들판을 정찰한다. 황건 두목의 진에 다른 시대의 병기가 섞였다.",
		"mix": {"past": "황건적", "now": "잿빛 떼쥐", "future": "정찰 드론"},
		"steps": [{"t": "stage", "stage": "field"}, {"t": "talk", "scene": "field1", "at": "field"}, {"t": "mission", "quest": "q_field"},
			{"t": "mission", "quest": "q_boss1"}, {"t": "talk", "scene": "field2"}],
		"exp": 400, "gold": 1200},
	{"id": "p1_job", "no": 4, "title": "첫 스승", "stage": "허도", "need": 10,
		"blurb": "허도의 스승에게 첫 전직을 배운다. \"이름 없는 자가 제일 빨리 배운다.\"",
		"mix": {"past": "스승 도장", "now": "연습용 표적지", "future": "스승이 가진 시대 모를 무기"},
		"steps": [{"t": "talk", "scene": "job1", "at": "heodo"}, {"t": "job", "tier": 1}, {"t": "talk", "scene": "job2"}],
		"exp": 600, "gold": 2000},
	## G-0091 2부 · 갈래(현대 중심) — 웹 단계 그대로(관문 대장 = 사냥터 주간 챔피언 아무 곳이나 한 번, 오림 숲 첫 장면 forest1 은 웹의 첫 발 장면 대사).
	{"id": "p2_port", "no": 5, "part": 2, "title": "강릉진 부두", "stage": "강릉진", "need": 10, "legacy": {"level": 25, "tier": 2},
		"blurb": "부두에 쇠 화물선이 걸려 있다. 여행자 한컷의 사진 속 배는 \"없는 바다\"에 떠 있다.",
		"mix": {"past": "옛 나루", "now": "쇠 화물선·한컷", "future": "화물선 조종실 빛 판"},
		"steps": [{"t": "stage", "stage": "port"}, {"t": "talk", "scene": "port1", "at": "port"}, {"t": "gate"}, {"t": "talk", "scene": "port2"}],
		"exp": 1200, "gold": 3000},
	{"id": "p2_forest", "no": 6, "part": 2, "title": "오림의 그늘", "stage": "오림 숲", "need": 10, "legacy": {"level": 25, "tier": 2},
		"blurb": "나그네 \"그림자를 조심하라\". 그림자는 벼락 말벌 떼.",
		"mix": {"past": "숲 사당", "now": "벼락 말벌(변이 곤충)", "future": "나무에 박힌 경비 보행기"},
		"steps": [{"t": "stage", "stage": "forest"}, {"t": "talk", "scene": "forest1", "at": "forest"}, {"t": "mission", "quest": "q_forest"}, {"t": "mission", "quest": "q_gather1"}, {"t": "talk", "scene": "forest2"}],
		"exp": 1500, "gold": 3000},
	{"id": "p2_namjeong", "no": 7, "part": 2, "title": "민심을 살핀다", "stage": "남정성", "need": 12, "legacy": {"level": 25, "tier": 2},
		"blurb": "성 사람들이 \"밤마다 굴에서 빛이 샌다\"고 한다.",
		"mix": {"past": "성 민가", "now": "가로등 하나가 켜진 골목", "future": "굴 입구 빛"},
		"steps": [{"t": "stage", "stage": "namjeong"}, {"t": "mission", "quest": "q_talk1"}, {"t": "mission", "quest": "q_job"}, {"t": "talk", "scene": "nam2"}],
		"exp": 2000, "gold": 4000},
	{"id": "p2_cave", "no": 8, "part": 2, "title": "한중 굴혈", "stage": "한중 굴혈", "need": 25, "legacy": {"level": 25, "tier": 2},
		"blurb": "위군 도독의 진 깊은 곳에서 탐사 대원 이음을 구한다. 둘째 스승.",
		"mix": {"past": "위군 진", "now": "굴 속 발전기", "future": "이음·탐사 장비"},
		"steps": [{"t": "stage", "stage": "cave"}, {"t": "mission", "quest": "q_cave"}, {"t": "talk", "scene": "cave1"}, {"t": "job", "tier": 2}, {"t": "talk", "scene": "cave2"}],
		"exp": 4000, "gold": 8000},
	## G-0095 3부 · 불길(미래 중심) — 고돗엔 q_gorge·q_cinder·q_gorge_boss 사명이 없어 호로곡 = 그 사냥터 처치 60 + 보스 하나(그은 돌은 뺌),
	## 비경 = 끝까지 한 번(st.rifts), 셋째 스승은 정본대로 사제 유대 20(웹은 유대가 없어 뺐던 칸)까지.
	{"id": "p3_gisan", "no": 9, "part": 3, "title": "기산채의 사자", "stage": "기산채", "need": 25, "legacy": {"level": 45, "tier": 3},
		"blurb": "산채 두령에게 빛 병기를 대 주는 잿빛 사자가 처음 나타났다 사라진다.",
		"mix": {"past": "산채", "now": "산채 창고 기관총", "future": "빛 병기·잿빛 사자"},
		"steps": [{"t": "stage", "stage": "gisan"}, {"t": "talk", "scene": "gisan1", "at": "gisan"}, {"t": "mission", "quest": "q_gold1"}, {"t": "talk", "scene": "gisan2"}],
		"exp": 8000, "gold": 10000},
	{"id": "p3_gorge", "no": 10, "part": 3, "title": "호로곡의 불길", "stage": "호로곡", "need": 25, "legacy": {"level": 45, "tier": 3},
		"blurb": "골짜기 전체가 탄다. 의원 약손과 부상병을 옮기고 적국 대장군을 친다.",
		"mix": {"past": "의원·약초", "now": "진압 특공대", "future": "불길 속 강철 거신"},
		"steps": [{"t": "stage", "stage": "gorge"}, {"t": "talk", "scene": "gorge1", "at": "gorge"}, {"t": "stagekill", "stage": "gorge", "n": 60},
			{"t": "boss", "n": 1}, {"t": "talk", "scene": "gorge2"}],
		"exp": 20000, "gold": 15000},
	{"id": "p3_labyrinth", "no": 11, "part": 3, "title": "비경의 기억", "stage": "비경", "need": 30, "legacy": {"level": 45, "tier": 3},
		"blurb": "이음이 여는 비경 — 수호장을 치면 떠돌이가 잃은 기억 조각: 자신도 문에서 떨어졌다.",
		"mix": {"past": "비경 돌 발판", "now": "발판에 박힌 표지판", "future": "기억 조각 홀로그램"},
		"steps": [{"t": "talk", "scene": "lab1"}, {"t": "rift", "n": 1}, {"t": "talk", "scene": "lab2"}],
		"exp": 30000, "gold": 20000, "frags": 3},
	{"id": "p3_job", "no": 12, "part": 3, "title": "셋째 스승", "stage": "허도", "need": 45, "legacy": {"level": 45, "tier": 3},
		"blurb": "{스승}이 \"네 이름은 문 너머에 두고 왔구나\".",
		"mix": {"past": "스승", "now": "스승의 오래된 사진", "future": "스승의 칼에 비친 문"},
		"steps": [{"t": "talk", "scene": "job31", "at": "heodo"}, {"t": "job", "tier": 3}, {"t": "bond", "n": 20}, {"t": "talk", "scene": "job32"}],
		"exp": 40000, "gold": 30000},
	## G-0100 4부 · 이름 — 고돗엔 낙양 옛터·검각 암굴(21~25층 급 사냥터)이 없어: 낙양 = 잿더미가 된 기산채(그곳 처치 150 + 단계 뒤 보스 1),
	## 검각 깊이 = 한중 굴혈에 들어선 뒤 허도 비경을 끝까지 한 번 더(빛이 안 닿는 깊이), 귀장 = 단계 뒤 보스 둘, 사명 q_ruin·q_deep 은 고돗에 없어 뺌.
	{"id": "p4_luoyang", "no": 13, "part": 4, "title": "옛 도읍의 잿더미", "stage": "기산채 잿더미", "need": 45, "legacy": {"level": 70, "tier": 4},
		"blurb": "잿더미 위 흉장 — 잿빛 사자가 정체를 드러낸다: 병기를 댄 자.",
		"mix": {"past": "무너진 궁궐", "now": "잿더미 속 전철", "future": "흉장의 기계 갑주"},
		"steps": [{"t": "stage", "stage": "gisan"}, {"t": "talk", "scene": "luoyang1", "at": "gisan"}, {"t": "stagekill", "stage": "gisan", "n": 150},
			{"t": "boss", "n": 1}, {"t": "talk", "scene": "luoyang2"}],
		"exp": 40000, "gold": 30000},
	{"id": "p4_depth", "no": 14, "part": 4, "title": "검각 깊이", "stage": "한중 굴혈 · 비경", "need": 70, "legacy": {"level": 70, "tier": 4},
		"blurb": "빛이 안 닿는 깊이 — 이음의 탐사 등과 한컷의 조명을 앞세운다.",
		"mix": {"past": "암굴 석벽", "now": "한컷의 조명", "future": "이음의 탐사 등"},
		"steps": [{"t": "stage", "stage": "cave"}, {"t": "talk", "scene": "depth1", "at": "cave"}, {"t": "rift", "n": 1}, {"t": "talk", "scene": "depth2"}],
		"exp": 70000, "gold": 50000},
	{"id": "p4_gate", "no": 15, "part": 4, "title": "난세의 문", "stage": "어느 사냥터든 · 보스 둘", "need": 70, "legacy": {"level": 70, "tier": 4},
		"blurb": "전쟁이 끝나지 않게 문을 연 귀장 — 문을 닫을지 지킬지 고른다.",
		"mix": {"past": "귀장의 옛 갑옷", "now": "문 둘레 전선", "future": "문의 빛 소용돌이"},
		"steps": [{"t": "boss", "n": 2}, {"t": "talk", "scene": "gate1"}, {"t": "talk", "scene": "gate2"}],
		"exp": 120000, "gold": 100000},
	{"id": "p4_name", "no": 16, "part": 4, "title": "이름", "stage": "허도", "need": 70, "legacy": {"level": 70, "tier": 4},
		"blurb": "{스승}과 마지막 전직, 스스로 붙이는 이름 — 문 고르기에 따라 이음이 돌아가거나 남는다.",
		"mix": {"past": "스승", "now": "한컷의 마지막 사진", "future": "이음이 돌아가는 빛"},
		"steps": [{"t": "talk", "scene": "name1", "at": "heodo"}, {"t": "job", "tier": 4}, {"t": "talk", "scene": "name2"}, {"t": "talk", "scene": "name3", "by": "gate"}],
		"exp": 200000, "gold": 150000},
	## G-0104 5부 · 문 너머 — 고돗엔 문 너머 세 땅(옛 전장·무너진 도심·궤도 기지)과 사명 q_beyond1~3(+보스)이 없어: 옛 전장 = 허창 들판,
	## 무너진 도심 = 강릉진(들어서서 단계 뒤 보스 하나씩), 궤도 기지 = 허도 비경 끝까지 한 번. 마지막 대화는 4부 문 고르기(gate)로 갈림.
## legacy 는 레벨 76 만(전직은 4차가 끝이라 tier 5 = 없는 단 — 4차만으로 5부를 건너뛰지 않게).
	{"id": "p5_past", "no": 17, "part": 5, "title": "문 너머 옛 전장", "stage": "허창 들판", "need": 72, "legacy": {"level": 76, "tier": 5},
		"blurb": "문 저편 첫째 땅 — 깃발 무덤 위에 창 든 그림자와 총 든 그림자가 겹쳐 선다.",
		"mix": {"past": "깃발 무덤의 옛 창병", "now": "한컷의 초점 나간 사진기", "future": "그림자 속 총 든 병사"},
		"steps": [{"t": "stage", "stage": "field"}, {"t": "talk", "scene": "bp1", "at": "field"}, {"t": "boss", "n": 1}, {"t": "talk", "scene": "beyond1"}],
		"exp": 300000, "gold": 220000},
	{"id": "p5_now", "no": 18, "part": 5, "title": "문 너머 무너진 도심", "stage": "강릉진", "need": 74, "legacy": {"level": 76, "tier": 5},
		"blurb": "문 저편 둘째 땅 — 거꾸로 쓴 간판 아래 신호등이 켜질 때마다 그림자가 길을 건넌다.",
		"mix": {"past": "건너오는 옛 그림자", "now": "거꾸로 쓴 간판과 신호등", "future": "하늘에서 오는 마지막 신호"},
		"steps": [{"t": "stage", "stage": "port"}, {"t": "talk", "scene": "bn1", "at": "port"}, {"t": "boss", "n": 1}, {"t": "talk", "scene": "beyond2"}],
		"exp": 400000, "gold": 280000},
	{"id": "p5_future", "no": 19, "part": 5, "title": "문 너머 궤도 기지", "stage": "허도 비경", "need": 76, "legacy": {"level": 76, "tier": 5},
		"blurb": "문 저편 마지막 땅 — 깨어 있는 궤도 기지에서 세 시대가 한 장에 담긴다.",
		"mix": {"past": "기지 창밖의 옛 전장", "now": "한컷이 찍은 한 장", "future": "이음이 나고 자란 기지 등불"},
		"steps": [{"t": "talk", "scene": "bf1", "at": "heodo"}, {"t": "rift", "n": 1}, {"t": "talk", "scene": "beyond3", "by": "gate"}],
		"exp": 600000, "gold": 400000},
]

## 옛 세이브(웹 legacy {level 10, tier 1}) — 이만큼 왔으면 1부는 지나온 길.
const LEGACY_LEVEL := 10
const LEGACY_TIER := 1


static func fresh() -> Dictionary:
	return {"ch": 0, "step": 0, "done": [], "legacy": false, "base": 0, "base_set": false, "rifts": 0, "choices": {}}


static func normalize(st: Variant) -> Dictionary:
	var out := fresh()
	if st is Dictionary:
		for k in out:
			if (st as Dictionary).has(k):
				out[k] = (st as Dictionary)[k]
	out.done = (out.done as Array).duplicate()
	out.choices = (out.choices as Dictionary).duplicate() if out.choices is Dictionary else {}
	return out


## 장면 줄(1~3부 SCENES + 4부 SCENES_P4).
static func lines_of(scene: String) -> Array:
	return SCENES.get(scene, SCENES_P4.get(scene, []))


## 고르기 id 의 첫 답(답이 없는 옛 세이브).
static func first_answer(choice_id: String) -> String:
	for k in CHOICES:
		if String(CHOICES[k].id) == choice_id:
			return String(CHOICES[k].options[0].key)
	return ""


## 옛 세이브 — 빈 칸(scenario 없는 세이브)이거나 이미 legacy 로 건너뛴 진행이면, 지금 장부터 차례로 그 장의 legacy 문턱
## (없으면 1부 문턱 Lv10·1차)을 넘은 장을 보상 없이 끝낸 것으로. 건너뛴 장 수.
static func apply_legacy(st: Dictionary, raw_was_empty: bool, level: int, tier: int) -> int:
	if not raw_was_empty and not bool(st.get("legacy", false)):
		return 0
	if int(st.get("step", 0)) != 0:
		return 0
	var n := 0
	while not finished(st):
		var c := chapter(st)
		var lg: Dictionary = c.get("legacy", {"level": LEGACY_LEVEL, "tier": LEGACY_TIER})
		if level < int(lg.level) and tier < int(lg.tier):
			break
		(st.done as Array).append(String(c.id))
		st.ch = int(st.ch) + 1
		n += 1
	if n > 0:
		st.legacy = true
	return n


static func chapter(st: Dictionary) -> Dictionary:
	var i := int(st.get("ch", 0))
	return CHAPTERS[i] if i >= 0 and i < CHAPTERS.size() else {}


static func step(st: Dictionary) -> Dictionary:
	var ch := chapter(st)
	if ch.is_empty():
		return {}
	var steps: Array = ch.steps
	var i := int(st.get("step", 0))
	return steps[i] if i < steps.size() else {}


static func finished(st: Dictionary) -> bool:
	return chapter(st).is_empty()


## ctx: level:int · stage:String(지금 장면 키) · quests:{key: true} · tier:int
static func locked(st: Dictionary, ctx: Dictionary) -> bool:
	return int(ctx.get("level", 1)) < int(chapter(st).get("need", 1))


## 지금 띄울 대화 장면 id(at 장면이 아니거나 레벨이 모자라면 "").
static func pending_scene(st: Dictionary, ctx: Dictionary) -> String:
	var s := step(st)
	if String(s.get("t", "")) != "talk" or locked(st, ctx):
		return ""
	if s.has("at") and String(s.at) != String(ctx.get("stage", "")):
		return ""
	if s.has("by"):
		var ans := String((st.get("choices", {}) as Dictionary).get(String(s.by), ""))
		return "%s_%s" % [String(s.scene), ans if ans != "" else first_answer(String(s.by))]
	return String(s.scene)


static func step_met(st: Dictionary, ctx: Dictionary) -> bool:
	if locked(st, ctx):
		return false
	var s := step(st)
	match String(s.get("t", "")):
		"stage":
			return String(ctx.get("stage", "")) == String(s.stage)
		"mission":
			return bool((ctx.get("quests", {}) as Dictionary).get(String(s.quest), false))
		"gate":
			return int(ctx.get("champions", 0)) >= 1
		"job":
			return int(ctx.get("tier", 0)) >= int(s.tier)
		"stagekill":
			return int((ctx.get("stage_kills", {}) as Dictionary).get(String(s.stage), 0)) >= int(s.n)
		"boss", "rift":
			return counter(st, ctx, String(s.t)) - int(st.get("base", 0)) >= int(s.n)
		"bond":
			return int(ctx.get("bond", 0)) >= int(s.n)
	return false


## 단계 시작 뒤를 세는 단계의 지금 합계(boss = ctx.bosses, rift = st.rifts).
static func counter(st: Dictionary, ctx: Dictionary, t: String) -> int:
	return int(ctx.get("bosses", 0)) if t == "boss" else int(st.get("rifts", 0))


## 세는 단계에 처음 닿으면 그때 합계를 기준(base)으로 적는다.
static func _arm_base(st: Dictionary, ctx: Dictionary) -> void:
	var t := String(step(st).get("t", ""))
	if (t == "boss" or t == "rift") and not bool(st.get("base_set", false)):
		st.base = counter(st, ctx, t)
		st.base_set = true


## 다음 단계로. 장이 끝나면 {"chapter": 장}.
static func advance(st: Dictionary) -> Dictionary:
	var ch := chapter(st)
	if ch.is_empty():
		return {}
	st.step = int(st.step) + 1
	st.base_set = false
	if int(st.step) >= (ch.steps as Array).size():
		(st.done as Array).append(String(ch.id))
		st.ch = int(st.ch) + 1
		st.step = 0
		return {"chapter": ch}
	return {}


static func check(st: Dictionary, ctx: Dictionary) -> Array:
	var out: Array = []
	var guard := 0
	_arm_base(st, ctx)
	while not finished(st) and String(step(st).get("t", "")) != "talk" and step_met(st, ctx) and guard < 32:
		out.append(advance(st))
		_arm_base(st, ctx)
		guard += 1
	return out


## 대화를 다 읽었다(answer = 그 장면 고르기 답, 없으면 "") → 다음 단계.
static func finish_talk(st: Dictionary, ctx: Dictionary, answer := "") -> Array:
	if String(step(st).get("t", "")) != "talk":
		return []
	var scene := String(step(st).scene)
	if CHOICES.has(scene) and answer != "":
		if not (st.get("choices") is Dictionary):
			st.choices = {}
		(st.choices as Dictionary)[String(CHOICES[scene].id)] = answer
	return [advance(st)] + check(st, ctx)


static func objective(st: Dictionary, ctx: Dictionary, quest_names: Dictionary = {}) -> String:
	var ch := chapter(st)
	if ch.is_empty():
		return ""
	var what := ""
	if locked(st, ctx):
		what = "Lv %d 되면" % int(ch.need)
	else:
		var s := step(st)
		match String(s.get("t", "")):
			"stage":
				what = "%s(으)로" % STAGE_NAMES.get(String(s.stage), String(s.stage))
			"talk":
				what = "이야기" if not s.has("at") or String(s.at) == String(ctx.get("stage", "")) else "%s에서 이야기" % STAGE_NAMES.get(String(s.at), String(s.at))
			"mission":
				what = "사명 「%s」" % String(quest_names.get(String(s.quest), String(s.quest)))
			"job":
				what = "%d차 전직(허도 수련장)" % int(s.tier)
			"gate":
				what = "사냥터 관문 대장을 한 번 이기기"
			"stagekill":
				what = "%s 처치 %d/%d" % [STAGE_NAMES.get(String(s.stage), String(s.stage)), mini(int((ctx.get("stage_kills", {}) as Dictionary).get(String(s.stage), 0)), int(s.n)), int(s.n)]
			"boss":
				what = "보스 처치 %d/%d(%s)" % [mini(maxi(counter(st, ctx, "boss") - int(st.get("base", 0)), 0), int(s.n)), int(s.n), String(chapter(st).get("stage", ""))]
			"rift":
				what = "허도 비경을 끝까지 깨기"
			"bond":
				what = "스승과 사제 유대 %d/%d" % [mini(int(ctx.get("bond", 0)), int(s.n)), int(s.n)]
	return "📜 %d부 %d장 %s — %s" % [part(ch), int(ch.no), String(ch.title), what]


static func part(ch: Dictionary) -> int:
	return int(ch.get("part", 1))


## 말한 이 표시 — mentor 는 부르는 쪽이 넘긴 스승 이름.
static func speaker(who: String, mentor_name: String) -> String:
	if who == "me":
		return "나 · 무명"
	if who == "mentor" or who == "mentor+":
		return "🥋 " + (mentor_name if mentor_name != "" else "스승")
	var c: Dictionary = CAST.get(who, {})
	return "%s %s" % [String(c.get("emoji", "")), String(c.get("name", who))]
