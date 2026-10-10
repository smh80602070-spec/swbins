extends RefCounted

## characters.gd HEROES 의 한 조각 — 세계사 37명(R-4 10-10 주제별로 나눔, 순서·내용 그대로).
## 필드·이름 정책은 characters.gd 머리말. 고칠 때는 이 파일을 고친다.

const LIST := [
	{
		"id": "eu_caesar",
		"name": "발레리안",
		"era": "세계사",
		"faction": "로마",
		"rarity": 5,
		"trait": "wisdom",
		"stats": {
			"might": 78,
			"wisdom": 92,
			"command": 98
		},
		"hanja": "Valerian",
		"emoji": "🏛️",
		"quote": "왔노라, 보았노라, 그리고 함께 가겠노라."
	},
	{
		"id": "eu_alexander",
		"name": "카시안더",
		"era": "세계사",
		"faction": "마케도니아",
		"rarity": 5,
		"trait": "might",
		"stats": {
			"might": 94,
			"wisdom": 88,
			"command": 97
		},
		"hanja": "Kassiander",
		"emoji": "🐎",
		"quote": "세상의 끝까지 가 보고 싶지 않은가."
	},
	{
		"id": "eu_hannibal",
		"name": "마그나로",
		"era": "세계사",
		"faction": "카르타고",
		"rarity": 5,
		"trait": "wisdom",
		"stats": {
			"might": 85,
			"wisdom": 95,
			"command": 94
		},
		"hanja": "Magnaro",
		"emoji": "🐘",
		"quote": "길이 없다면 알프스를 넘어 만들면 된다."
	},
	{
		"id": "eu_charlemagne",
		"name": "로타리안",
		"era": "세계사",
		"faction": "프랑크",
		"rarity": 5,
		"trait": "virtue",
		"stats": {
			"might": 85,
			"wisdom": 82,
			"command": 95
		},
		"hanja": "Lotharian",
		"emoji": "👑",
		"quote": "검과 글을 함께 쥔 나라를 세우려 하오."
	},
	{
		"id": "eu_joan",
		"name": "셀렌느",
		"era": "세계사",
		"faction": "프랑스",
		"rarity": 5,
		"trait": "virtue",
		"stats": {
			"might": 78,
			"wisdom": 70,
			"command": 92
		},
		"hanja": "Selenne",
		"emoji": "⚜️",
		"quote": "두려움은 제 것이 아닙니다. 깃발을 드십시오."
	},
	{
		"id": "eu_napoleon",
		"name": "발데나르",
		"era": "세계사",
		"faction": "프랑스",
		"rarity": 5,
		"trait": "wisdom",
		"stats": {
			"might": 80,
			"wisdom": 96,
			"command": 99
		},
		"hanja": "Baldenar",
		"emoji": "🎖️",
		"quote": "불가능이라는 말은 겁쟁이의 변명이오."
	},
	{
		"id": "eu_davinci",
		"name": "마라노",
		"era": "세계사",
		"faction": "이탈리아",
		"rarity": 5,
		"trait": "wisdom",
		"stats": {
			"might": 25,
			"wisdom": 100,
			"command": 58
		},
		"hanja": "Marano",
		"emoji": "🖋️",
		"quote": "아직 그리지 못한 것이 너무 많소."
	},
	{
		"id": "eu_augustus",
		"name": "세레누스",
		"era": "세계사",
		"faction": "로마",
		"rarity": 4,
		"trait": "wisdom",
		"stats": {
			"might": 55,
			"wisdom": 94,
			"command": 92
		},
		"hanja": "Serenus",
		"emoji": "🦅",
		"quote": "벽돌의 도시를 대리석으로 바꾸겠소."
	},
	{
		"id": "eu_scipio",
		"name": "코르비날",
		"era": "세계사",
		"faction": "로마",
		"rarity": 4,
		"trait": "might",
		"stats": {
			"might": 82,
			"wisdom": 88,
			"command": 90
		},
		"hanja": "Corvinal",
		"emoji": "🛡️",
		"quote": "마그나로를 이기는 법은 마그나로에게 배웠소."
	},
	{
		"id": "eu_leonidas",
		"name": "테살로르",
		"era": "세계사",
		"faction": "스파르타",
		"rarity": 4,
		"trait": "might",
		"stats": {
			"might": 92,
			"wisdom": 60,
			"command": 86
		},
		"hanja": "Thessalor",
		"emoji": "🔺",
		"quote": "와서 가져가라."
	},
	{
		"id": "eu_aurelius",
		"name": "베렌델",
		"era": "세계사",
		"faction": "로마",
		"rarity": 4,
		"trait": "virtue",
		"stats": {
			"might": 58,
			"wisdom": 96,
			"command": 84
		},
		"hanja": "Verendel",
		"emoji": "📖",
		"quote": "오늘 할 수 있는 선(善)을 미루지 마시오."
	},
	{
		"id": "eu_richard",
		"name": "코드윈",
		"era": "세계사",
		"faction": "잉글랜드",
		"rarity": 4,
		"trait": "might",
		"stats": {
			"might": 93,
			"wisdom": 65,
			"command": 86
		},
		"hanja": "Cordwin",
		"emoji": "🦁",
		"quote": "사자의 심장은 물러서는 법을 모른다."
	},
	{
		"id": "eu_william",
		"name": "펜드릭",
		"era": "세계사",
		"faction": "노르만",
		"rarity": 4,
		"trait": "might",
		"stats": {
			"might": 88,
			"wisdom": 78,
			"command": 90
		},
		"hanja": "Fendric",
		"emoji": "🏹",
		"quote": "바다를 건넜으면 배는 태워야 하오."
	},
	{
		"id": "eu_harald",
		"name": "오스트바르드",
		"era": "세계사",
		"faction": "노르웨이",
		"rarity": 4,
		"trait": "might",
		"stats": {
			"might": 95,
			"wisdom": 62,
			"command": 84
		},
		"hanja": "Ostvard",
		"emoji": "🪓",
		"quote": "북쪽에서 왔다. 노를 저을 줄 아는가."
	},
	{
		"id": "eu_frederick",
		"name": "바실로른",
		"era": "세계사",
		"faction": "프로이센",
		"rarity": 4,
		"trait": "wisdom",
		"stats": {
			"might": 78,
			"wisdom": 93,
			"command": 95
		},
		"hanja": "Vasilorn",
		"emoji": "🎼",
		"quote": "왕은 나라의 첫째 종복이오."
	},
	{
		"id": "eu_peter",
		"name": "볼카노프",
		"era": "세계사",
		"faction": "러시아",
		"rarity": 4,
		"trait": "might",
		"stats": {
			"might": 82,
			"wisdom": 90,
			"command": 93
		},
		"hanja": "Volkanov",
		"emoji": "⚓",
		"quote": "바다로 나가는 창을 열어야 하오."
	},
	{
		"id": "eu_elizabeth",
		"name": "코리넬레",
		"era": "세계사",
		"faction": "잉글랜드",
		"rarity": 4,
		"trait": "wisdom",
		"stats": {
			"might": 25,
			"wisdom": 95,
			"command": 90
		},
		"hanja": "Corinelle",
		"emoji": "💍",
		"quote": "나는 이 나라와 혼인했소."
	},
	{
		"id": "eu_nelson",
		"name": "애쉬그레이브",
		"era": "세계사",
		"faction": "잉글랜드",
		"rarity": 4,
		"trait": "might",
		"stats": {
			"might": 85,
			"wisdom": 88,
			"command": 92
		},
		"hanja": "Ashgrave",
		"emoji": "🔭",
		"quote": "나라가 각자의 본분을 기대하고 있다."
	},
	{
		"id": "eu_machiavelli",
		"name": "반토렐리",
		"era": "세계사",
		"faction": "이탈리아",
		"rarity": 4,
		"trait": "wisdom",
		"stats": {
			"might": 22,
			"wisdom": 96,
			"command": 70
		},
		"hanja": "Vantorelli",
		"emoji": "🖋️",
		"quote": "사랑받기 어렵다면, 적어도 얕보이지는 마시오."
	},
	{
		"id": "eu_newton",
		"name": "할베린",
		"era": "세계사",
		"faction": "잉글랜드",
		"rarity": 3,
		"trait": "wisdom",
		"stats": {
			"might": 15,
			"wisdom": 100,
			"command": 48
		},
		"hanja": "Halberin",
		"emoji": "🍎",
		"quote": "거인의 어깨에 올라섰을 뿐이오."
	},
	{
		"id": "eu_michelangelo",
		"name": "첼로리니",
		"era": "세계사",
		"faction": "이탈리아",
		"rarity": 3,
		"trait": "wisdom",
		"stats": {
			"might": 32,
			"wisdom": 94,
			"command": 54
		},
		"hanja": "Cellorini",
		"emoji": "🗿",
		"quote": "돌 안에 이미 있는 것을 꺼낼 뿐이오."
	},
	{
		"id": "eu_eleanor",
		"name": "바엘린",
		"era": "세계사",
		"faction": "프랑스",
		"rarity": 3,
		"trait": "virtue",
		"stats": {
			"might": 20,
			"wisdom": 90,
			"command": 78
		},
		"hanja": "Vaellyn",
		"emoji": "🌹",
		"quote": "두 왕국의 왕비였으니, 셈은 제가 하겠소."
	},
	{
		"id": "wd_ashoka",
		"name": "법륜왕",
		"era": "세계사",
		"faction": "마우리아",
		"rarity": 5,
		"trait": "virtue",
		"stats": {
			"might": 60,
			"wisdom": 92,
			"command": 90
		},
		"hanja": "Dharmandra",
		"emoji": "☸️",
		"quote": "칼로 얻은 땅을 이제 법으로 다스리겠다."
	},
	{
		"id": "wd_akbar",
		"name": "관용제",
		"era": "세계사",
		"faction": "무굴",
		"rarity": 5,
		"trait": "wisdom",
		"stats": {
			"might": 75,
			"wisdom": 93,
			"command": 95
		},
		"hanja": "Akbaran",
		"emoji": "🕌",
		"quote": "믿음은 강요로 얻어지지 않는다."
	},
	{
		"id": "wd_saladin",
		"name": "의검주",
		"era": "세계사",
		"faction": "아이유브",
		"rarity": 5,
		"trait": "virtue",
		"stats": {
			"might": 88,
			"wisdom": 90,
			"command": 96
		},
		"hanja": "Salahin",
		"emoji": "🌙",
		"quote": "예루살렘의 문은 자비로도 열린다."
	},
	{
		"id": "wd_suleiman",
		"name": "장려제",
		"era": "세계사",
		"faction": "오스만",
		"rarity": 5,
		"trait": "wisdom",
		"stats": {
			"might": 80,
			"wisdom": 95,
			"command": 97
		},
		"hanja": "Suleyman",
		"emoji": "🕌",
		"quote": "법과 영광을 함께 세우겠다."
	},
	{
		"id": "wd_ibnsina",
		"name": "의철인",
		"era": "세계사",
		"faction": "페르시아",
		"rarity": 4,
		"trait": "wisdom",
		"stats": {
			"might": 10,
			"wisdom": 99,
			"command": 40
		},
		"hanja": "Sinardo",
		"emoji": "📗",
		"quote": "몸의 이치를 책 한 권에 담겠소."
	},
	{
		"id": "wd_genghis",
		"name": "초원패",
		"era": "세계사",
		"faction": "몽골제국",
		"rarity": 5,
		"trait": "might",
		"stats": {
			"might": 96,
			"wisdom": 85,
			"command": 99
		},
		"hanja": "Tengoran",
		"emoji": "🏹",
		"quote": "세상의 끝까지 말을 달리겠다."
	},
	{
		"id": "wd_khubilai",
		"name": "대원조",
		"era": "세계사",
		"faction": "원",
		"rarity": 5,
		"trait": "wisdom",
		"stats": {
			"might": 75,
			"wisdom": 90,
			"command": 95
		},
		"hanja": "Khuvilan",
		"emoji": "🐎",
		"quote": "초원과 중원을 하나로 잇겠다."
	},
	{
		"id": "wd_mansamusa",
		"name": "황금왕",
		"era": "세계사",
		"faction": "말리제국",
		"rarity": 5,
		"trait": "virtue",
		"stats": {
			"might": 55,
			"wisdom": 88,
			"command": 90
		},
		"hanja": "Mansaren",
		"emoji": "💰",
		"quote": "금은 나눌수록 내 것이 된다."
	},
	{
		"id": "wd_shaka",
		"name": "창군왕",
		"era": "세계사",
		"faction": "줄루왕국",
		"rarity": 4,
		"trait": "might",
		"stats": {
			"might": 94,
			"wisdom": 75,
			"command": 92
		},
		"hanja": "Shakandu",
		"emoji": "🛡️",
		"quote": "짧은 창이 긴 창을 이긴다."
	},
	{
		"id": "wd_cleopatra",
		"name": "나일화",
		"era": "세계사",
		"faction": "프톨레마이오스",
		"rarity": 5,
		"trait": "wisdom",
		"stats": {
			"might": 30,
			"wisdom": 95,
			"command": 88
		},
		"hanja": "Cleonara",
		"emoji": "🐍",
		"quote": "나일강은 아직 나의 편이오."
	},
	{
		"id": "wd_pachacuti",
		"name": "태양개",
		"era": "세계사",
		"faction": "잉카제국",
		"rarity": 4,
		"trait": "wisdom",
		"stats": {
			"might": 65,
			"wisdom": 88,
			"command": 93
		},
		"hanja": "Pachaneth",
		"emoji": "🏔️",
		"quote": "세상을 뒤바꾸는 자, 그것이 나의 이름이다."
	},
	{
		"id": "wd_moctezuma",
		"name": "독수리주",
		"era": "세계사",
		"faction": "아즈텍",
		"rarity": 4,
		"trait": "virtue",
		"stats": {
			"might": 60,
			"wisdom": 82,
			"command": 85
		},
		"hanja": "Moctezan",
		"emoji": "🦅",
		"quote": "별들이 낯선 자들의 도착을 알렸다."
	},
	{
		"id": "wd_ibnbattuta",
		"name": "천리객",
		"era": "세계사",
		"faction": "여행자",
		"rarity": 3,
		"trait": "wisdom",
		"stats": {
			"might": 20,
			"wisdom": 90,
			"command": 50
		},
		"hanja": "Battutan",
		"emoji": "🧭",
		"quote": "길이 있는 한 걸음을 멈추지 않겠소."
	},
	{
		"id": "wd_hammurabi",
		"name": "율법석",
		"era": "세계사",
		"faction": "바빌로니아",
		"rarity": 4,
		"trait": "virtue",
		"stats": {
			"might": 50,
			"wisdom": 92,
			"command": 88
		},
		"hanja": "Hammuran",
		"emoji": "🗿",
		"quote": "눈에는 눈, 이에는 이, 돌에 새겨 두겠다."
	},
	{
		"id": "wd_attila",
		"name": "재앙편",
		"era": "세계사",
		"faction": "훈제국",
		"rarity": 5,
		"trait": "might",
		"stats": {
			"might": 95,
			"wisdom": 78,
			"command": 94
		},
		"hanja": "Attilan",
		"emoji": "🐎",
		"quote": "신의 채찍이 여기 있다."
	},
]
