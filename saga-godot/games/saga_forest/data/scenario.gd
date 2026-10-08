extends RefCounted
## G-0086 — 사가마을 이야기 표(정본 `scenario/saga-forest.md` "하늘 금 우체통"). 봄 · 옛 우체통 네 장 + G-0090 여름 · 금으로 온 손님들 네 장 + G-0094 가을 · 앞날의 기록 네 장 + G-0099 겨울 · 이어진 숲 네 장(결말 — 가을 고르기 crack 로 갈림) + G-0103 둘째 해 봄 · 우체통의 답장 네 장 + G-0107 둘째 해 여름 · 사진첩의 답장 네 장.
## 대사·고르기는 웹 구현(saga-web/saga-forest/js/data-scenario.js SCENES)과 같다. 단계는 고돗 사가마을(바이옴 넷·주민 여섯·
## 집 가구·박물관, 택배·폐허·행사 놀이 없음)에 맞춰 바꿨다 — 까닭은 티켓 G-0086 "단계 바꿈".
## 엔진은 world/scenario_runner.gd, 진행은 ForestSaveState.scenario(fresh() 모양). 인물은 전부 가상(이름 정책). 싸움·실패 없음.
##
## 한 장 = {id, no, season, title, stage, mix{past,now,future}, steps, gold, blurb}
##   steps 차례대로:
##     {"t": "talk", "scene": id}                대화(고르기가 있으면 답이 choices[고르기 id])
##     {"t": "place", "n": n}                    집에 놓인 가구 n 이상
##     {"t": "visit", "npc": 주민 id, "why": 글}  그 주민 곁(4m)에 간다
##     {"t": "biome", "key": 바이옴 키}          그 바이옴(meadow 꽃밭·dark 어둑숲·mush 버섯숲·rocky 바위 지대)에 든다
##     {"t": "spot", "key": 명소 id, "label": 표지, "shape"?: "postbox"|"cave"}  그 명소 곁(4m) — 이 단계 동안만 표지(코드 도형)가 선다
##     {"t": "gather", "cat": 이름, "n": n}      이 단계 시작 뒤 그 갈래를 n 번 채집(채집 신호 "꽃 +1" 을 엔진이 센다 — 물고기는 신호가 없어 보유 수가 는 만큼)
##     {"t": "fest", "key": 행사 키, "npc": 주민 id}  그 주민 곁에 가면 기념 놀이를 연다(그날이 아니어도 — 정본 "기념 놀이")
##     {"t": "heart", "n": n, "who"?: m}         주민 m 명(없으면 1)이 하트 n 이상
##     {"t": "donate", "cat": 이름, "n": n}      사고에 그 갈래를 n 점 이상 기증
##     {"t": "rounds", "n": n, "why": 글}         이 단계 동안 서로 다른 주민 n 명 곁(4m)에 간다(G-0099 — 편지 전하기·세배 돌기, st.rounds 에 id)
##   talk 의 "by": 고르기 id — 장면 id 는 scene + "_" + 그 답(없으면 그 고르기의 첫 답, G-0099 대보름 결말)
## 장면 = {"lines": [[누가, 말]…], "choice": {id, prompt, options:[{key,label}]}?} — 누가 = "me"(나) 또는 CAST 키.

const CAST := {
	"keeper": {"name": "숲지기 솔바람", "emoji": "🌲"},
	"dareum": {"name": "택배 기사 달음", "emoji": "📦"},
	"hoyeon": {"name": "여우 화상 호연", "emoji": "🦊"},
	"k7": {"name": "시간 여행자 K-7", "emoji": "⌛"},
	"pungnang": {"name": "난파 선원 풍랑", "emoji": "⚓"},
	"chalna": {"name": "사진작가 찰나", "emoji": "📷"},
	"explorer": {"name": "탐험가", "emoji": "🧭"},
	"bandi": {"name": "도깨비불 반디", "emoji": "🔥"},
	"dudu": {"name": "도깨비 대장 두두", "emoji": "👹"},
	"rumi": {"name": "불시착 탐사원 루미", "emoji": "🧑‍🚀"},
	"nabi": {"name": "곤충 박사 나비", "emoji": "🦋"},
}

const SCENES := {
	"move1": {"lines": [
		["keeper", "이사 온 첫 밤이 저물었구려. 짐은 다 풀었소? 이 숲은 초가 지붕 사이로 별이 잘 들어오는 곳이라오."],
		["me", "짐을 풀다 보니 저 하늘에 가느다란 금이 하나 보입니다. 별똥별이 지나간 자국인가요?"],
		["keeper", "금이라니… 이 늙은이는 처음 보오. 우선 집에 가구 하나라도 놓고 보시오. 집이 서야 마음이 놓이지."],
	]},
	"move2": {"lines": [
		["dareum", "으아아! 여기가 어디죠? 택배 기사 달음입니다! 금이 쫙 갈라지더니 이 소포와 함께 떨어졌어요."],
		["dareum", "받는 이가 \"이 마을 새 이웃\"인데, 보낸 날짜가 먼 앞날이에요. 상자 속에서 빛 편지가 새어 나오고요."],
		["keeper", "먼 앞날에서 온 소포라니. 접수대에 알려 배달 일부터 해 보시오. 그 길에 뭔가 보일 게요."],
	]},
	"post1": {"lines": [
		["keeper", "빛 편지가 가리키는 곳이 있소 — 탑성 폐허의 옛 우체통이오. 오래전 이곳을 오가던 편지가 지금도 쌓여 있다 하오."],
		["dareum", "억새 바람벌을 지나서 폐허까지 가면 된대요! 폐허 옆에는 오래된 공중전화가 서 있다던데, 우체통이 왜 전화 곁에 있을까요."],
	]},
	"post2": {"lines": [
		["me", "우체통이 정말 있었습니다. 안에는 붓글씨 편지, 택배 송장, 빛나는 홀로그램 도장이 찍힌 편지까지 섞여 있어요."],
		["keeper", "여러 시대의 편지가 한 통에 쌓였구려. 이 우체통이 버려진 채 오래 되어 시대 사이 우체통이 된 모양이오."],
		["dareum", "그럼 하늘의 금은 이 우체통이 부른 길이에요? 이 편지들을 마을로 배달해 봐요!"],
	]},
	"fox1": {"lines": [
		["hoyeon", "어이쿠, 금 사이로 넘어와 버렸군. 여우 화상 호연이오. 시대를 잃은 물건을 파는 장사꾼이지. 이 빛 부채는 앞날 것이고, 저 옛 방울은 이 땅 것이오."],
		["me", "삼짇날 꽃놀이를 연다는 소문이 있던데요, 장터를 그날 맞춰 열 수 있을까요?"],
		["hoyeon", "꽃 다섯 송이만 모아 오시오. 꽃놀이에 쓸 꽃 좌판을 내가 펼치겠소."],
	]},
	"fox2": {"lines": [
		["hoyeon", "꽃놀이 안내판 곁에 좌판을 폈소. 확성기가 딸린 장터라 소리가 멀리 가지. 꽃놀이를 마치면 이 마을에서 장사를 해도 되겠소?"],
		["keeper", "이 마을에는 새 이웃이 반갑소. 호연 좌판은 마을 상점 칸에 내주지."],
	]},
	"fox3": {"lines": [
		["hoyeon", "꽃놀이가 끝났구려. 빛 부채가 한 자루 남았소, 선물로 받아 두시오."],
		["me", "한 주민과 마음이 통했습니다. 이 마을이 좋아지고 있어요."],
	]},
	"mus1": {"lines": [
		["k7", "…착륙 성공. 시간 여행자 K-7, 기록원입니다. 저는 앞날의 기록을 들고 왔어요. 이 숲의 기록 칸은 \"사라진 숲\"입니다."],
		["me", "사라진 숲이라니요? 이 마을이 없어진다는 뜻입니까?"],
		["k7", "잊힌 곳은 앞날에서 지워집니다. 사고에 화석을 채우면 그 줄이 흐려지는 걸 확인했어요. 화석 다섯 점만 넣어 보시겠습니까?"],
	]},
	"mus2": {"lines": [
		["k7", "기록판의 \"사라진 숲\"이 한 줄 흐려졌습니다! 이 마을이 기억되기 시작했다는 뜻이에요. 그런데 부탁이 하나 있습니다."],
		["k7", "앞날 기록에 이 마을 이름을 적어 두고 싶습니다. 알려 주시겠어요?"],
		["me", "마을 이름을 알려 주는 건 이 마을의 미래를 맡기는 일이지요. 정하겠습니다."],
	], "choice": {"id": "name", "prompt": "K-7 에게 마을 이름을 알려 줄까", "options": [{"key": "tell", "label": "알려 준다"}, {"key": "secret", "label": "비밀로 한다"}]}},
	"sail1": {"lines": [
		["pungnang", "으으… 하늘이 갈라져 배째로 떨어졌소. 난파 선원 풍랑이오. 보시오, 호수에 옛 돛배가 박혀 버렸소. 뱃밑에는 빛나는 닻이 달려 있고."],
		["me", "수리하려면 삯이 꽤 들겠군요. 낚시로 물고기를 몇 마리 잡아다 드리면 도움이 될까요?"],
		["pungnang", "고맙소! 낚시라면 이 몸이 가르치리다. 요즘 낚시 명인의 릴이라는 신기한 물건이 저자에 돈다지. 우선 물고기 세 마리만."],
	]},
	"sail2": {"lines": [
		["pungnang", "단오 창포못 낚시가 끝났구려! 그 값으로 뱃널 몇 장은 사겠소. 이 삯을 뱃길 손님에게 전해 주시겠소?"],
		["me", "낚시꾼 어르신 편에 전하면 되겠지요. 잠시 다녀오겠습니다."],
	]},
	"sail3": {"lines": [
		["pungnang", "삯이 닿았소! 뱃전에 평상 하나를 짜서 호숫가에 놓아 드리리다. 낚시 손님이 앉아 쉬어 가시오."],
		["me", "박힌 배가 이 마을 호수의 풍경이 되겠군요. 빛나는 닻은 밤에 보면 더 아름다울 것 같습니다."],
	]},
	"photo1": {"lines": [
		["chalna", "안녕하세요! 사진작가 찰나예요. 앞날 기록에서 이 숲은 \"사라진 숲\"이라고 하더라고요. 사라지기 전에 찍어 두려고요."],
		["chalna", "숲을 다 돌 순 없으니 세 곳만요 — 버섯숲, 바위 지대, 마지막으로 어둑숲의 반딧불 사진이요."],
		["me", "바위 지대의 선돌은 아주 오래된 것이라 들었습니다. 같이 가 봅시다."],
	]},
	"photo2": {"lines": [
		["chalna", "반딧불 사이에서 작은 드론이 떠다니는 게 찍혔어요! 다른 시대 것이 이 숲을 기록하고 있나 봐요."],
		["me", "찰나 씨의 사진기와 드론이 같은 곳을 찍고 있었군요. 이 숲이 기억되고 있다는 뜻일지도요."],
		["chalna", "사진 액자를 만들어 드릴게요. 마을 벽에 걸어 두면 숲이 사라지지 않을 거예요."],
	]},
	"fall1": {"lines": [
		["explorer", "폭포 너머엔 뭐가 있는지 아무도 몰라. 이 폭포 뒤엔 굴이 있고 굴 벽에는 옛 글씨가, 바닥에는 미래의 발자국이 있다는 소문이 있지."],
		["me", "손전등은 제가 준비하겠습니다. 굴 입구부터 가 보지요."],
	]},
	"fall2": {"lines": [
		["explorer", "굴 벽에 옛 글씨가 가득이더군. 발자국 옆에는 빛 표식까지. 여러 시대 사람이 같은 굴을 지나갔다는 뜻이야."],
		["me", "편지 다발도 벽 틈에 꽂혀 있었습니다. 옛 우체통과 이어진 길일지도 모르겠어요."],
		["explorer", "도감에 \"폭포 뒤 굴\"을 적어 두자고. 또 새 수수께끼를 찾아 떠나야겠군."],
	]},
	"rumi1": {"lines": [
		["rumi", "탐사원 루미예요. 우주기지에 불시착했는데, 구조 신호가 닿으려면 300년이 걸린대요. 무전기는 이 땅 것이라 옛 봉투에 넣어야 신호가 가고."],
		["me", "봉투에 신호를? 옛 우체통이 신호를 앞날로 부치는 길이라는 말씀이지요?"],
		["rumi", "네! 우선 광석 세 개로 송신기를 고치고 싶어요. 도와주실 수 있어요?"],
	]},
	"rumi2": {"lines": [
		["rumi", "신호가 우체통으로 들어갔어요! 옛 봉투에 담긴 신호가 300년 뒤에 닿는다니… 이제 기다릴 수 있어요."],
		["me", "편지로 소식을 전해 주세요. 우체통이 이어 줄 겁니다."],
	]},
	"ins1": {"lines": [
		["nabi", "곤충 박사 나비예요! 반딧불이가 해마다 줄어드는 까닭을 찾고 있어요. 금 너머에서 새는 빛이 밤을 밝혀서 짝짓기를 방해하는 것 같아요."],
		["me", "채집망을 빌려 주시면 곤충을 다섯 마리 잡아 보겠습니다."],
		["nabi", "기록용으로 사고에도 기증해 주세요. 옛 정원 돌담 곁에서 반딧불이 정원을 다시 만들어 볼게요."],
	]},
	"ins2": {"lines": [
		["nabi", "기증하신 곤충 덕에 빛 공해의 가설이 맞는지 확인했어요. 금에서 새는 빛이 문제였네요."],
		["me", "금을 닫을 수는 없어도 빛이 덜 새게 할 수는 있겠군요."],
	]},
	"har1": {"lines": [
		["keeper", "한가위라오. 주민과 손님을 두 편으로 갈라 줄다리기를 하고 달 아래서 송편을 나눕시다."],
		["chalna", "단체 사진을 찍어 드릴게요! 저기 K-7 씨가 잔치를 기록하러 오셨네요."],
		["k7", "기록 중입니다. 이 마을의 밤이 앞날 기록에 또렷이 남고 있어요."],
	]},
	"har2": {"lines": [
		["k7", "기록판의 \"사라진 숲\"이 거의 다 지워졌습니다. 이 마을을 기억하는 이들이 늘었어요."],
		["keeper", "잔치가 끝났으니 북쪽 동굴 부탁이나 살펴보시오. 동굴 끝에 이상한 빛 조각이 있다 하오."],
	]},
	"cave1": {"lines": [
		["keeper", "북쪽 동굴 끝까지 가 보시오. 벽화가 있고 그 끝에 빛나는 결정이 박혀 있다 하오."],
		["explorer", "밧줄은 내가 걸어 두었지. 조심해서 들어가 봐."],
	]},
	"cave2": {"lines": [
		["k7", "이 결정은 금의 조각입니다. 금은 우체통이 부르는 길이었어요. 결정을 만지면 금이 더 벌어질 수도, 잠잠해질 수도 있습니다."],
		["me", "금을 활짝 열어 두면 여러 시대 손님이 더 올 것이고, 조용히 해 달라면 밤이 고요해지겠지요."],
	], "choice": {"id": "crack", "prompt": "금을 어떻게 할 것인가", "options": [{"key": "open", "label": "금을 활짝 열어 둔다"}, {"key": "quiet", "label": "조용히 해 달라 한다"}]}},
	"star1": {"lines": [
		["bandi", "칠석이라고 별에 소원 빌러 몰려왔어! 나는 도깨비불 반디야. 밤길 안내는 내가 할게."],
		["dudu", "도깨비 대장 두두다! 오작교 등도 달고 주운 손전등도 켜 놓았지. 꼬마들아 줄 서라!"],
		["me", "이 밤에 별에 소원을 빌고 나면 그 소원이 금으로 올라간다지요. 저도 빌어 보겠습니다."],
	]},
	"star2": {"lines": [
		["dudu", "소원이 하늘 금으로 스르르 올라갔어! 재밌다! 이 마을 정말 살아 볼 만하겠는데?"],
		["bandi", "두두는 말썽만 피워서 걱정이야. 대신 내가 잘 이끌게. 이 마을에 살아도 될까?"],
		["me", "함께 지낼 이웃이 있으면 마을이 더 밝아지겠지요. 주민들과도 벌써 정이 들었으니까요."],
	]},
}

## G-0099 겨울 — 웹 대사 그대로, dong2 첫 줄만 고침(고돗엔 "살러 온 손님"이 없어 주민 정으로).
const SCENES_WINTER := {
	"let1": {"lines": [
		["keeper", "옛 우체통에 앞날의 답장이 쌓였다오. 고맙다는 편지를 주민마다 전해 주시겠소?"],
		["dareum", "붓글씨 편지에 택배 상자에 빛 편지까지, 한 상자에 세 시대가 담겼어요! 제가 나눠 실을게요."],
	]},
	"let2": {"lines": [
		["keeper", "주민들이 편지를 읽고 웃었소. 편지꽂이 하나를 마련해 드리리다."],
		["me", "앞날의 이웃이 이 마을을 기억하고 있다는 편지였습니다."],
	]},
	"dong1": {"lines": [
		["keeper", "동지 팥죽을 쑬 때가 되었소. 팥죽 솥 곁에 주민과 손님이 모이면 잔치가 차오르오."],
		["rumi", "온열 장치도 가져왔어요! 팥죽이 식지 않게요."],
	]},
	"dong2": {"lines": [
		["keeper", "주민들과 정이 깊어지니 잔치가 찼구려. 이 마을이 참 따뜻해졌소."],
	]},
	"ny1": {"lines": [
		["keeper", "설날이오. 한복 입은 주민마다 세배를 돌아 새해 인사를 나누시오. 복주머니를 드리겠소."],
		["k7", "새해 기록도 남기겠습니다. 이 마을의 새해 인사가 앞날 기록에 들어가요."],
	]},
	"moon1": {"lines": [
		["keeper", "대보름이오. 달집에 불을 놓으면 하늘 금이 옛 우체통 위로 내려온다는 말이 있소."],
		["chalna", "마지막 사진을 찍을게요. 달집 불빛이 금에 닿는 순간이요!"],
		["k7", "기록판이 바뀌고 있습니다… \"사라진 숲\" 글자가 흐려지고 있어요."],
	]},
	"moon2_open": {"lines": [
		["k7", "\"이어진 숲\"! 기록판 글자가 바뀌었습니다. 금이 열려 있어서 여러 시대 손님이 모두 모였고, 별 우체통이 되어 하늘에 걸렸어요."],
		["keeper", "이제 이 마을은 잊히지 않소. 별 우체통을 마을 명소로 삼읍시다. 그대는 이어진 숲의 이웃이오."],
	]},
	"moon2_quiet": {"lines": [
		["k7", "\"이어진 숲\"! 기록판 글자가 바뀌었습니다. 금이 조용히 내려앉아 별 우체통이 고요한 밤에 걸렸어요."],
		["keeper", "조용한 밤이 이 마을에 어울리오. 별 우체통은 마을 명소요. 그대는 이어진 숲의 이웃이오."],
	]},
}

## G-0103 둘째 해 봄 — 웹 대사 그대로.
const SCENES_Y2 := {
	"rep1": {"lines": [
		["keeper", "눈 녹은 아침에 별 우체통이 저 혼자 덜컹거렸소. 지난겨울 부친 편지에 답이 온 모양이오."],
		["dareum", "배달 왔습니다! 소인이 찍힌 데가 한 곳이 아니에요. 붓글씨 봉투, 택배 영수증 도장, 빛 도장까지 세 시대 답장이 한꺼번에요."],
		["me", "이걸 마을 사람들에게 하나씩 전해 드리면 되겠군요."],
	]},
	"rep2": {"lines": [
		["dareum", "전해 주셔서 고맙습니다. 받은 분들 얼굴이 봄꽃 같더군요. 아직 우체통 안쪽에 답장이 한 통 더 남았는데 — 겉에 여우 그림이 그려져 있어요."],
		["keeper", "여우 그림이라면 호연이오. 그 사람 답장은 직접 받으러 가는 게 예의라오."],
	]},
	"hoy1": {"lines": [
		["hoyeon", "답장은 우체통에 넣기 전에 얼굴 보고 전하는 게 장사꾼 예의요. 지난해 좌판을 내주어 고마웠소. 올해는 내가 대접하겠소."],
		["me", "대접이라니요. 저야 꽃 몇 송이 모았을 뿐인데요."],
		["hoyeon", "꽃 다섯 송이만 더 모아 오시오. 시대를 잃은 물건 중에 이 마을에 어울리는 걸 하나 골라 두었소."],
	]},
	"hoy2": {"lines": [
		["hoyeon", "꽃이 곱구려. 이 옛 방울에 꽃잎을 달아 두면 봄바람에 절로 울지. 마을 이웃 마음이 이만큼 통하면 방울도 제 소리를 낸다오."],
		["keeper", "마을 사람과 정이 여섯 하트쯤 쌓이면 방울이 제 목소리를 낼 게요."],
	]},
	"hoy3": {"lines": [
		["hoyeon", "방울이 우는구려! 옛 땅 방울 소리와 앞날 빛 부채 바람이 한자리에서 섞였소. 이게 답장이오. 이 마을은 시대가 오가는 길목이 되었소."],
		["me", "아직 모자란 이웃인데도 답장을 이렇게 받아도 되나요?"],
		["hoyeon", "답장은 받는 이가 아니라 부친 이가 정하는 법이오. 부친 이는 그대였소."],
	]},
	"reb1": {"lines": [
		["k7", "기록판이 갱신됐어요. \"이어진 숲\" 밑에 새 줄이 생겼는데 — \"옛 우체통 복원 미완\"."],
		["keeper", "탑성 폐허의 옛 우체통은 별 우체통과 한 쌍이오. 한쪽만 서 있으면 답장이 길을 잃는다오."],
		["me", "폐허에 가서 무너진 자리를 살펴보겠습니다."],
	]},
	"reb2": {"lines": [
		["dareum", "폐허 돌 위에 안전모 하나가 놓여 있었죠? 현대 공사장 물건이에요. 누군가 이미 쌓기 시작했다는 뜻이에요."],
		["k7", "설계도 홀로그램 조각도 나왔어요. 앞날 사람과 옛사람이 함께 쌓는 우체통이라니, 기록에 없던 일입니다."],
		["me", "편지 한 통만 더 배달하면 첫 돌을 놓을 수 있겠어요."],
	]},
	"ans1": {"lines": [
		["keeper", "옛 우체통에 첫 돌이 놓였소. 이제 삼짇날 꽃놀이를 열어 새 우체통을 알리면 좋겠구려."],
		["hoyeon", "방울을 꽃가지에 달고 나가겠소. 이번 꽃전은 내가 빚소."],
		["dareum", "저는 답장 엽서를 한 장씩 돌리겠습니다. 이 마을 소인이 찍힌 엽서예요!"],
	]},
	## G-0107 둘째 해 여름 — 웹 대사 그대로.
	"sal1": {"lines": [
		["chalna", "여름 소나기가 막 그쳤어요. 별 우체통으로 부친 제 사진, 답장이 왔더라고요 — 옛 화공이 그림으로, 앞날 사람이 빛으로 답을 그려 보냈어요."],
		["me", "사진 한 장에 시대마다 다른 답이 붙는군요."],
		["chalna", "사진첩을 채울 물고기 세 마리만 낚아 주세요. 물고기가 물 위로 튀는 순간이 첫 장면이에요."],
	]},
	"sal2": {"lines": [
		["chalna", "찰칵! 튀어 오른 물고기와 무지개가 한 장에 담겼어요. 옛 화공 답장에는 붓으로 그린 물고기가, 빛 답장에는 움직이는 물방울이 붙었고요."],
		["keeper", "마을 여름이 이렇게 남는구려. 사진은 사라지는 것을 붙잡는 일이라 했소."],
	]},
	"lens1": {"lines": [
		["chalna", "제 카메라를 잠깐 빌려 드릴게요. 솔숲과 요정골, 두 숲의 여름을 찍어 오시면 답장 사진첩이 완성돼요."],
		["me", "카메라는 처음인데요. 어디를 찍으면 좋을까요?"],
		["chalna", "눈에 띄는 것 말고, 제일 조용한 곳을 찍으세요. 조용한 곳에 시대가 겹쳐 보여요."],
	]},
	"lens2": {"lines": [
		["chalna", "솔숲의 그늘, 요정골의 버섯 불빛… 잘 찍으셨네요! 이 그늘 속에 옛 나무꾼이 지나가고, 저 불빛 속에 앞날 사람의 손전등이 겹쳐 있어요."],
		["pungnang", "허허, 내 젊은 날 뱃전에서 보던 등대불도 사진 한 장으로 남을 수 있소? 다음엔 나도 찍어 주오."],
	]},
	"night1": {"lines": [
		["chalna", "여름 사진의 마지막은 밤이에요. 반딧불 참나무숲의 불빛은 오래 노출해야 찍혀요. 반딧불이 세 마리만 앞에 앉히면 돼요."],
		["dareum", "저는 삼각대를 들게요! 배달 짐 중에 가장 가벼운 짐이 제일 든든하지요."],
	]},
	"night2": {"lines": [
		["chalna", "한 장 찍는 데 밤이 다 갔네요. 그런데 인화해 보니 반딧불 사이에 낯선 작은 불빛들이 줄지어 있어요 — 여러 시대가 보낸 답장 불빛 같아요."],
		["me", "반딧불과 답장이 한 장에 담겼군요."],
	]},
	"end1": {"lines": [
		["keeper", "칠석날 밤에는 견우직녀가 하늘 금을 건넌다고들 하오. 사진첩을 별 우체통 앞에 펼쳐 놓읍시다."],
		["chalna", "답장 사진첩 마지막 장은 마을 사람 모두가 등불을 들고 서는 사진이에요. 함께 찍어요!"],
	]},
	"end2": {"lines": [
		["chalna", "찍었어요! 등불 든 사람들 사이에 옛 화공도, 앞날 사람도 서 있는 것 같지 않나요? 이 사진이 이 여름의 답장이에요."],
		["k7", "기록판이 갱신됐어요. \"사진으로 남은 숲\" — 앞날 기록에 사진 한 줄이 새로 생겼습니다."],
		["keeper", "그대는 이 마을의 사진 이웃이오. 사진첩은 마을 서고에 꽂아 두겠소."],
	]},
	"ans2": {"lines": [
		["k7", "꽃놀이가 끝났군요. 기록판 새 줄이 바뀌었어요 — \"복원 미완\"이 \"이어 쌓는 중\"으로요."],
		["keeper", "이 마을은 이제 편지를 받기만 하는 곳이 아니라 답장을 보내는 곳이오. 그대는 답장을 받는 이웃이오."],
		["me", "내년에도, 그다음에도 이 마을에서 편지를 부치겠습니다."],
	]},
}

const CHAPTERS := [
	{"id": "sp_move", "no": 1, "season": "spring", "title": "이사 오던 날", "stage": "마을 · 접수대",
		"blurb": "짐을 풀던 밤, 하늘에 금이 가고 택배 기사 달음이 소포와 함께 떨어진다.",
		"mix": {"past": "초가·숲지기", "now": "달음·택배 상자", "future": "소포 속 빛 편지"},
		"steps": [{"t": "talk", "scene": "move1"}, {"t": "place", "n": 1}, {"t": "talk", "scene": "move2"},
			{"t": "visit", "npc": "npc_keeper", "why": "숲지기에게 소포를 알리기"}],
		"gold": 300},
	{"id": "sp_postbox", "no": 2, "season": "spring", "title": "폐허의 옛 우체통", "stage": "꽃밭 → 옛 돌사당",
		"blurb": "빛 편지가 가리키는 곳 — 옛 우체통. 안에 여러 시대 편지가 쌓여 있다.",
		"mix": {"past": "옛 돌사당·옛 우체통", "now": "우체통 옆 공중전화", "future": "편지 속 홀로그램 도장"},
		"steps": [{"t": "talk", "scene": "post1"}, {"t": "biome", "key": "meadow"},
			{"t": "spot", "key": "forest_shrine_stone", "label": "📮 옛 우체통"}, {"t": "talk", "scene": "post2"},
			{"t": "visit", "npc": "npc_keeper", "why": "편지를 마을 숲지기에게"}],
		"gold": 400},
	{"id": "sp_fox", "no": 3, "season": "spring", "title": "여우 화상의 봄 장터", "stage": "꽃밭 · 마을",
		"blurb": "호연이 금으로 넘어와 \"시대를 잃은 물건\"을 판다. 삼짇날 꽃놀이로 장터를 연다.",
		"mix": {"past": "여우 화상·꽃놀이", "now": "장터 확성기", "future": "호연 좌판의 빛 부채"},
		"steps": [{"t": "talk", "scene": "fox1"}, {"t": "gather", "cat": "꽃", "n": 5}, {"t": "talk", "scene": "fox2"},
			{"t": "fest", "key": "samjin", "npc": "npc_keeper"}, {"t": "heart", "n": 1}, {"t": "talk", "scene": "fox3"}],
		"gold": 500},
	{"id": "sp_museum", "no": 4, "season": "spring", "title": "사고를 채우다", "stage": "사고",
		"blurb": "K-7 이 떨어져 \"사라진 숲\" 기록을 보인다. 사고에 화석을 채우면 기록 한 줄이 흐려진다.",
		"mix": {"past": "화석·석비", "now": "사고 전시 조명", "future": "K-7 기록판"},
		"steps": [{"t": "talk", "scene": "mus1"}, {"t": "donate", "cat": "화석", "n": 5}, {"t": "talk", "scene": "mus2"}],
		"gold": 600},
	## G-0090 여름 — 고돗엔 손님·폭포·굴·이름 있는 숲 여덟이 없어: 풍랑 배달 = 낚시꾼 곁, 숲 넷 = 바이옴 셋(정본 트랙 메모의 대응),
	## 폭포 뒤 굴 = 나무뿌리 명소 곁 굴 표지, 손님 눌러앉히기 = 주민 하트 3, 행사 = 숲지기 기념 놀이.
	{"id": "su_sailor", "no": 5, "season": "summer", "title": "호수에 박힌 배", "stage": "낚시터 · 마을",
		"blurb": "옛 배와 함께 떨어진 선원 풍랑 — 단오 창포못 낚시로 배 수리 값을 번다.",
		"mix": {"past": "옛 돛배·풍랑", "now": "낚시 명인의 릴", "future": "배 밑의 빛 닻"},
		"steps": [{"t": "talk", "scene": "sail1"}, {"t": "gather", "cat": "물고기", "n": 3}, {"t": "fest", "key": "dano", "npc": "npc_keeper"},
			{"t": "talk", "scene": "sail2"}, {"t": "visit", "npc": "npc_angler", "why": "낚시꾼에게 배 삯 전하기"}, {"t": "talk", "scene": "sail3"}],
		"gold": 700},
	{"id": "su_photo", "no": 6, "season": "summer", "title": "숲 여덟의 사진", "stage": "버섯숲 · 바위 지대 · 어둑숲",
		"blurb": "찰나가 \"사라지기 전에 찍어 두자\"며 숲을 돈다. 어둑숲 반딧불 사진이 마지막.",
		"mix": {"past": "바위 지대 선돌", "now": "찰나·사진기", "future": "반딧불 사이 떠도는 드론"},
		"steps": [{"t": "talk", "scene": "photo1"}, {"t": "biome", "key": "mush"}, {"t": "biome", "key": "rocky"}, {"t": "biome", "key": "dark"}, {"t": "talk", "scene": "photo2"}],
		"gold": 800},
	{"id": "su_waterfall", "no": 7, "season": "summer", "title": "폭포 너머", "stage": "폭포 뒤 굴",
		"blurb": "탐험가의 수수께끼 — 폭포 뒤 굴에 옛 편지 다발과 미래의 발자국.",
		"mix": {"past": "굴 벽 옛 글씨", "now": "탐험가 손전등", "future": "발자국 옆 빛 표식"},
		"steps": [{"t": "talk", "scene": "fall1"}, {"t": "spot", "key": "forest_root", "label": "🕳️ 폭포 뒤 굴", "shape": "cave"}, {"t": "talk", "scene": "fall2"}],
		"gold": 900},
	{"id": "su_star", "no": 8, "season": "summer", "title": "칠석, 별에 소원", "stage": "마을",
		"blurb": "도깨비불 반디와 두두 패가 칠석 밤에 몰려온다. 마을에 정을 붙인다.",
		"mix": {"past": "칠석 오작교 등", "now": "두두가 주운 손전등", "future": "소원이 금으로 올라가는 빛"},
		"steps": [{"t": "talk", "scene": "star1"}, {"t": "fest", "key": "chilseok", "npc": "npc_keeper"}, {"t": "heart", "n": 3}, {"t": "talk", "scene": "star2"}],
		"gold": 1000},
	## G-0094 가을 — 우주기지 → 옛 우체통으로 신호 부치기(봄의 돌사당 곁 표지), 반딧불 참나무숲·사고 → 곤충 채집·기증, 한가위 = 숲지기 기념 놀이,
	## 주민 둘 하트 3, 북쪽 동굴 끝 = 북쪽 돌무더기(forest_cairn_ne) 곁 굴 표지, 끝 고르기 crack(open/quiet — 정본: 겨울 결말이 갈림).
	{"id": "au_rumi", "no": 9, "season": "autumn", "title": "우주기지의 불시착", "stage": "마을 · 옛 우체통",
		"blurb": "탐사원 루미 — 구조 신호가 300년 뒤에 닿는다. 옛 우체통으로 신호를 \"부치자\".",
		"mix": {"past": "우체통 봉투에 넣은 신호", "now": "무전기", "future": "우주기지·루미"},
		"steps": [{"t": "talk", "scene": "rumi1"}, {"t": "gather", "cat": "광석", "n": 3},
			{"t": "spot", "key": "forest_shrine_stone", "label": "📮 옛 우체통에 신호 부치기"}, {"t": "talk", "scene": "rumi2"}],
		"gold": 1100},
	{"id": "au_insect", "no": 10, "season": "autumn", "title": "반딧불이 정원", "stage": "숲 · 사고",
		"blurb": "곤충 박사 나비가 반딧불이가 줄어드는 까닭을 찾는다 — 금 너머 빛 공해.",
		"mix": {"past": "옛 정원 돌담", "now": "나비·채집망", "future": "금에서 새는 빛"},
		"steps": [{"t": "talk", "scene": "ins1"}, {"t": "gather", "cat": "곤충", "n": 5}, {"t": "donate", "cat": "곤충", "n": 5}, {"t": "talk", "scene": "ins2"}],
		"gold": 1200},
	{"id": "au_harvest", "no": 11, "season": "autumn", "title": "한가위 줄다리기", "stage": "마을",
		"blurb": "주민·손님 모두 두 편으로 — 줄다리기 뒤 달 아래 잔치.",
		"mix": {"past": "줄다리기·송편", "now": "찰나의 단체 사진", "future": "K-7이 잔치를 기록"},
		"steps": [{"t": "talk", "scene": "har1"}, {"t": "fest", "key": "chuseok", "npc": "npc_keeper"}, {"t": "heart", "n": 3, "who": 2}, {"t": "talk", "scene": "har2"}],
		"gold": 1300},
	{"id": "au_cave", "no": 12, "season": "autumn", "title": "북쪽 동굴의 조각", "stage": "북쪽 동굴",
		"blurb": "숲지기 부탁 — 동굴 끝에 금의 조각. K-7: \"금은 우체통이 부르는 길\".",
		"mix": {"past": "동굴 벽화", "now": "탐험가 밧줄", "future": "금 조각 결정"},
		"steps": [{"t": "talk", "scene": "cave1"}, {"t": "spot", "key": "forest_cairn_ne", "label": "🕳️ 북쪽 동굴 끝", "shape": "cave"}, {"t": "talk", "scene": "cave2"}],
		"gold": 1400},
	## G-0099 겨울 — 편지 다섯 배달 = 주민 다섯 곁(rounds), 살러 온 손님 둘 = 주민 셋 하트 3(여름·가을 대응과 같은 결), 설날 세배 = 기념 놀이 + 주민 여섯 곁,
	## 달집 뒤 우체통 = 봄의 옛 돌사당 곁 "별 우체통" 표지, 결말 대화는 가을 고르기 crack(open/quiet) 로 갈림.
	{"id": "wi_letters", "no": 13, "season": "winter", "title": "편지가 쌓이는 겨울", "stage": "마을 · 옛 우체통",
		"blurb": "앞날의 주민들에게서 답장이 온다 — 고맙다는 편지를 주민마다 전한다.",
		"mix": {"past": "붓글씨 편지", "now": "택배 상자", "future": "빛 편지"},
		"steps": [{"t": "talk", "scene": "let1"}, {"t": "rounds", "n": 5, "why": "주민에게 편지 전하기"}, {"t": "heart", "n": 5}, {"t": "talk", "scene": "let2"}],
		"gold": 1500},
	{"id": "wi_dongji", "no": 14, "season": "winter", "title": "동지 팥죽 나눔", "stage": "마을",
		"blurb": "팥죽을 쑤어 주민과 나눈다 — 마을 정이 깊어야 잔치가 찬다.",
		"mix": {"past": "팥죽 솥", "now": "보온 도시락", "future": "루미의 온열 장치"},
		"steps": [{"t": "talk", "scene": "dong1"}, {"t": "fest", "key": "dongji", "npc": "npc_keeper"}, {"t": "heart", "n": 3, "who": 3}, {"t": "talk", "scene": "dong2"}],
		"gold": 1600},
	{"id": "wi_newyear", "no": 15, "season": "winter", "title": "설날 세배 돌기", "stage": "마을 전체",
		"blurb": "주민 모두에게 세배.",
		"mix": {"past": "세배·한복", "now": "새해 문자", "future": "K-7의 새해 기록"},
		"steps": [{"t": "talk", "scene": "ny1"}, {"t": "fest", "key": "seollal", "npc": "npc_keeper"}, {"t": "rounds", "n": 6, "why": "주민 모두에게 세배"}],
		"gold": 1700},
	{"id": "wi_moon", "no": 16, "season": "winter", "title": "대보름, 별 우체통", "stage": "달집 · 옛 우체통",
		"blurb": "달집을 태우는 밤, 하늘 금이 우체통 위로 내려와 별 우체통이 된다. \"사라진 숲\"이 \"이어진 숲\"으로.",
		"mix": {"past": "달집", "now": "찰나의 마지막 사진", "future": "기록판 글자가 바뀜"},
		"steps": [{"t": "talk", "scene": "moon1"}, {"t": "fest", "key": "daeborum", "npc": "npc_keeper"},
			{"t": "spot", "key": "forest_shrine_stone", "label": "✨ 별 우체통(옛 우체통)"}, {"t": "talk", "scene": "moon2", "by": "crack"}],
		"gold": 3000},
	## G-0103 둘째 해 봄(결말 뒤) — 답장 배달 = 주민 곁 돌기(rounds), 탑성 폐허의 옛 우체통 = 봄부터 쓰던 옛 돌사당 곁 표지, 삼짇날 = 숲지기 기념 놀이.
	{"id": "y2_reply", "no": 17, "season": "spring2", "title": "별 우체통의 첫 답장", "stage": "마을 · 별 우체통",
		"blurb": "눈 녹은 아침, 지난겨울 부친 편지에 세 시대의 답장이 한꺼번에 도착한다.",
		"mix": {"past": "붓글씨 봉투", "now": "택배 영수증 도장", "future": "빛 도장 답신"},
		"steps": [{"t": "talk", "scene": "rep1"}, {"t": "rounds", "n": 2, "why": "주민에게 답장 전하기"}, {"t": "talk", "scene": "rep2"}],
		"gold": 800},
	{"id": "y2_hoyeon", "no": 18, "season": "spring2", "title": "호연의 답장", "stage": "꽃밭 · 마을",
		"blurb": "여우 화상 호연이 지난해 좌판의 답례로 옛 방울을 내놓는다. 이웃과 정이 쌓여야 방울이 운다.",
		"mix": {"past": "호연의 옛 방울", "now": "호연이 배운 택배 송장", "future": "빛 부채 바람"},
		"steps": [{"t": "talk", "scene": "hoy1"}, {"t": "gather", "cat": "꽃", "n": 5}, {"t": "talk", "scene": "hoy2"}, {"t": "heart", "n": 6}, {"t": "talk", "scene": "hoy3"}],
		"gold": 900},
	{"id": "y2_ruin", "no": 19, "season": "spring2", "title": "다시 쌓는 옛 우체통", "stage": "옛 돌사당",
		"blurb": "기록판에 \"옛 우체통 복원 미완\" 줄이 생긴다. 무너진 자리에서 옛사람과 앞날 사람이 함께 쌓은 흔적을 찾는다.",
		"mix": {"past": "무너진 탑성 돌", "now": "공사용 안전모", "future": "설계도 홀로그램"},
		"steps": [{"t": "talk", "scene": "reb1"}, {"t": "spot", "key": "forest_shrine_stone", "label": "🧱 옛 우체통 무너진 자리"}, {"t": "talk", "scene": "reb2"},
			{"t": "rounds", "n": 1, "why": "편지 한 통 배달"}],
		"gold": 1000},
	{"id": "y2_bloom", "no": 20, "season": "spring2", "title": "답장이 온 봄", "stage": "마을 광장",
		"blurb": "옛 우체통에 첫 돌이 놓인 날, 삼짇날 꽃놀이로 새 우체통을 알린다. 기록판 줄이 \"이어 쌓는 중\"으로.",
		"mix": {"past": "삼짇날 꽃전", "now": "마을 소인 답장 엽서", "future": "기록판 새 줄"},
		"steps": [{"t": "talk", "scene": "ans1"}, {"t": "fest", "key": "samjin", "npc": "npc_keeper"}, {"t": "talk", "scene": "ans2"}],
		"gold": 3500},
	## G-0107 둘째 해 여름 — 물고기·곤충 = 채집, 푸른 솔숲 = 꽃밭, 버섯 요정골 = 버섯숲, 반딧불 참나무숲 = 어둑숲(첫해 여름 사진 장과 같은 대응), 칠석 = 기념 놀이.
	{"id": "y2_album", "no": 21, "season": "summer2", "title": "찰나의 사진첩", "stage": "낚시터",
		"blurb": "소나기가 그친 여름, 찰나가 부친 사진에 옛 화공은 그림으로, 앞날 사람은 빛으로 답장한다. 사진첩을 채울 물고기를 낚는다.",
		"mix": {"past": "옛 화공의 붓 답장", "now": "찰나의 사진첩", "future": "빛 물방울 답장"},
		"steps": [{"t": "talk", "scene": "sal1"}, {"t": "gather", "cat": "물고기", "n": 3}, {"t": "talk", "scene": "sal2"}],
		"gold": 1100},
	{"id": "y2_lens", "no": 22, "season": "summer2", "title": "빌려 준 카메라", "stage": "꽃밭 · 버섯숲",
		"blurb": "찰나가 카메라를 빌려 준다. 조용한 두 숲의 여름을 찍는다.",
		"mix": {"past": "솔숲의 나무꾼 그림자", "now": "빌린 카메라", "future": "요정골의 손전등 불빛"},
		"steps": [{"t": "talk", "scene": "lens1"}, {"t": "biome", "key": "meadow"}, {"t": "biome", "key": "mush"}, {"t": "talk", "scene": "lens2"}],
		"gold": 1200},
	{"id": "y2_night", "no": 23, "season": "summer2", "title": "반딧불 야간 촬영", "stage": "어둑숲",
		"blurb": "오래 노출해서 찍은 반딧불 사진에 여러 시대가 보낸 답장 불빛이 줄지어 선다.",
		"mix": {"past": "반딧불과 옛 등불", "now": "달음이 든 삼각대", "future": "답장 불빛 줄"},
		"steps": [{"t": "talk", "scene": "night1"}, {"t": "biome", "key": "dark"}, {"t": "gather", "cat": "곤충", "n": 3}, {"t": "talk", "scene": "night2"}],
		"gold": 1300},
	{"id": "y2_star", "no": 24, "season": "summer2", "title": "칠석, 한여름의 답장", "stage": "마을 · 별 우체통",
		"blurb": "칠석날 밤 등불 든 마을 사람들이 별 우체통 앞에서 함께 찍는 사진이 이 여름의 답장이 된다.",
		"mix": {"past": "칠석 등불", "now": "단체 사진", "future": "기록판의 사진 한 줄"},
		"steps": [{"t": "talk", "scene": "end1"}, {"t": "fest", "key": "chilseok", "npc": "npc_keeper"}, {"t": "talk", "scene": "end2"}],
		"gold": 3800},
]

const BIOME_NAMES := {"meadow": "꽃밭", "dark": "어둑숲", "mush": "버섯숲", "rocky": "바위 지대"}
const FEST_NAMES := {"samjin": "삼짇날 꽃놀이", "dano": "단오 창포못 낚시", "chilseok": "칠석 별에 소원", "chuseok": "한가위 줄다리기",
	"dongji": "동지 팥죽 나눔", "seollal": "설날 세배", "daeborum": "대보름 달집 태우기"}
const FEST_TOASTS := {"samjin": "호연이 꽃 좌판을 펼친다.", "dano": "창포못에 낚싯대가 줄지어 섰다.", "chilseok": "오작교 등 아래로 소원이 하늘 금으로 오른다.", "chuseok": "두 편이 줄을 당기고 달 아래 송편을 나눈다.",
	"dongji": "팥죽 솥에서 김이 오르고 루미의 온열 장치가 반짝인다.", "seollal": "복주머니를 받고 새해 인사를 돌 차례.", "daeborum": "달집이 타오르고 하늘 금이 우체통 쪽으로 내려온다."}
const SEASON_NAMES := {"spring": "봄", "summer": "여름", "autumn": "가을", "winter": "겨울", "spring2": "둘째 해 봄", "summer2": "둘째 해 여름"}
## 신호 없이 보유 수가 는 만큼 채집으로 세는 갈래(낚시는 채집 신호가 없다).
const POLL_CATS := ["물고기"]


static func fresh() -> Dictionary:
	return {"ch": 0, "step": 0, "base": 0, "gathered": {}, "done": [], "choices": {}, "rounds": []}


static func normalize(st: Variant) -> Dictionary:
	var out := fresh()
	if st is Dictionary:
		for k in out:
			if (st as Dictionary).has(k):
				out[k] = (st as Dictionary)[k]
	out.done = (out.done as Array).duplicate()
	out.gathered = (out.gathered as Dictionary).duplicate() if out.gathered is Dictionary else {}
	out.choices = (out.choices as Dictionary).duplicate() if out.choices is Dictionary else {}
	out.rounds = (out.rounds as Array).duplicate() if out.rounds is Array else []
	return out


## 장면 정의(봄~가을 SCENES + 겨울 SCENES_WINTER + 둘째 해 SCENES_Y2).
static func scene_def(id: String) -> Dictionary:
	return SCENES.get(id, SCENES_WINTER.get(id, SCENES_Y2.get(id, {})))


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


static func pending_scene(st: Dictionary) -> String:
	var s := step(st)
	if String(s.get("t", "")) != "talk":
		return ""
	if s.has("by"):
		var ans := String((st.get("choices", {}) as Dictionary).get(String(s.by), ""))
		if ans == "":
			ans = first_answer(String(s.by))
		return "%s_%s" % [String(s.scene), ans]
	return String(s.scene)


## 고르기 id 의 첫 답(답이 없는 옛 세이브·건너뛴 판).
static func first_answer(choice_id: String) -> String:
	for k in SCENES:
		var c: Dictionary = (SCENES[k] as Dictionary).get("choice", {})
		if String(c.get("id", "")) == choice_id and not (c.options as Array).is_empty():
			return String(c.options[0].key)
	return ""


static func gathered(st: Dictionary, cat: String) -> int:
	return int((st.get("gathered", {}) as Dictionary).get(cat, 0))


## 채집 하나(엔진이 채집 신호마다 부른다).
static func add_gather(st: Dictionary, cat: String, n := 1) -> void:
	var g: Dictionary = st.get("gathered", {})
	g[cat] = int(g.get(cat, 0)) + n
	st.gathered = g


## ctx(엔진이 모은 지금 모습): home_items:int · near:{주민·명소 id: bool} · biome:String · max_heart:int · donated:{갈래: n}
static func step_met(st: Dictionary, ctx: Dictionary) -> bool:
	var s := step(st)
	var near: Dictionary = ctx.get("near", {})
	match String(s.get("t", "")):
		"place":
			return int(ctx.get("home_items", 0)) >= int(s.n)
		"visit", "fest":
			return bool(near.get(String(s.npc), false))
		"spot":
			return bool(near.get(String(s.key), false))
		"biome":
			return String(ctx.get("biome", "")) == String(s.key)
		"gather":
			return gathered(st, String(s.cat)) - int(st.get("base", 0)) >= int(s.n)
		"heart":
			if int(s.get("who", 1)) <= 1:
				return int(ctx.get("max_heart", 0)) >= int(s.n)
			var cnt := 0
			for h in ctx.get("hearts", []):
				if int(h) >= int(s.n):
					cnt += 1
			return cnt >= int(s.who)
		"donate":
			return int((ctx.get("donated", {}) as Dictionary).get(String(s.cat), 0)) >= int(s.n)
		"rounds":
			return (st.get("rounds", []) as Array).size() >= int(s.n)
	return false


## rounds 단계면 지금 곁에 있는 주민을 st.rounds 에 더한다(엔진이 ctx.near 에 주민 여섯을 넣는다).
static func note_rounds(st: Dictionary, ctx: Dictionary) -> void:
	if String(step(st).get("t", "")) != "rounds":
		return
	var got: Array = st.get("rounds", [])
	for id in ctx.get("near", {}):
		if bool(ctx.near[id]) and String(id).begins_with("npc_") and not got.has(String(id)):
			got.append(String(id))
	st.rounds = got


## 다음 단계로. {"chapter": 장, "fest": 키} 중 해당하는 것(보상·알림은 엔진이).
static func advance(st: Dictionary) -> Dictionary:
	var ch := chapter(st)
	if ch.is_empty():
		return {}
	var out := {}
	var cur := step(st)
	if String(cur.get("t", "")) == "fest":
		out.fest = String(cur.key)
	st.step = int(st.step) + 1
	if int(st.step) >= (ch.steps as Array).size():
		(st.done as Array).append(String(ch.id))
		st.ch = int(st.ch) + 1
		st.step = 0
		out.chapter = ch
	var nxt := step(st)
	st.base = gathered(st, String(nxt.cat)) if String(nxt.get("t", "")) == "gather" else 0
	st.rounds = []
	return out


## talk 아닌 단계를 끝난 만큼 넘긴다. advance 결과 목록.
static func check(st: Dictionary, ctx: Dictionary) -> Array:
	var out: Array = []
	var guard := 0
	note_rounds(st, ctx)
	while not finished(st) and pending_scene(st) == "" and step_met(st, ctx) and guard < 32:
		out.append(advance(st))
		note_rounds(st, ctx)
		guard += 1
	return out


## 대화를 다 읽었다(답 = 고르기 key 또는 "") → 다음 단계. advance 결과 목록.
static func finish_talk(st: Dictionary, ctx: Dictionary, answer := "") -> Array:
	var scene := pending_scene(st)
	if scene == "":
		return []
	var ch_def: Dictionary = scene_def(scene).get("choice", {})
	if not ch_def.is_empty() and answer != "":
		(st.choices as Dictionary)[String(ch_def.id)] = answer
	return [advance(st)] + check(st, ctx)


static func objective(st: Dictionary) -> String:
	var ch := chapter(st)
	if ch.is_empty():
		return ""
	var s := step(st)
	var what := ""
	match String(s.get("t", "")):
		"talk":
			what = "이야기"
		"place":
			what = "집에 가구 %d개 놓기" % int(s.n)
		"visit":
			what = String(s.get("why", "주민 만나기"))
		"biome":
			what = "%s에 들기" % BIOME_NAMES.get(String(s.key), String(s.key))
		"spot":
			what = "%s 찾기" % String(s.label)
		"gather":
			what = "%s 채집 %d/%d" % [String(s.cat), mini(gathered(st, String(s.cat)) - int(st.get("base", 0)), int(s.n)), int(s.n)]
		"fest":
			what = "숲지기에게 가 %s 열기" % FEST_NAMES.get(String(s.key), String(s.key))
		"heart":
			what = "주민 하트 %d 이상" % int(s.n) if int(s.get("who", 1)) <= 1 else "주민 %d명 하트 %d 이상" % [int(s.who), int(s.n)]
		"donate":
			what = "사고에 %s %d점 기증" % [String(s.cat), int(s.n)]
		"rounds":
			what = "%s %d/%d" % [String(s.why), mini((st.get("rounds", []) as Array).size(), int(s.n)), int(s.n)]
	return "📜 %s %d장 %s — %s" % [season(ch), int(ch.no), String(ch.title), what]


static func season(ch: Dictionary) -> String:
	return String(SEASON_NAMES.get(String(ch.get("season", "spring")), ""))


static func speaker(who: String) -> String:
	if who == "me":
		return "나"
	var c: Dictionary = CAST.get(who, {})
	return "%s %s" % [String(c.get("emoji", "")), String(c.get("name", who))]
