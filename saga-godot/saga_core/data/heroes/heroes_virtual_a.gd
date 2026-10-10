extends RefCounted

## characters.gd HEROES 의 한 조각 — 가상 시대 앞 여섯(한국(가상)·일본(가상)·교주(가상)·서역(가상)·남중(가상)·천축(가상)) 54명(R-4 10-10 주제별로 나눔, 순서·내용 그대로).
## 필드·이름 정책은 characters.gd 머리말. 고칠 때는 이 파일을 고친다.

const LIST := [
	{
		"id": "kr2_pasodan",
		"name": "파소단",
		"era": "한국(가상)",
		"faction": "양평",
		"rarity": 4,
		"trait": "might",
		"stats": {
			"might": 80,
			"wisdom": 50,
			"command": 75
		},
		"hanja": "波蘇丹",
		"emoji": "⚔️",
		"quote": "여기가 뚫리면 그다음은 없다."
	},
	{
		"id": "kr2_dokgaru",
		"name": "독가루",
		"era": "한국(가상)",
		"faction": "국내성",
		"rarity": 4,
		"trait": "might",
		"stats": {
			"might": 88,
			"wisdom": 55,
			"command": 82
		},
		"hanja": "禿加婁",
		"emoji": "🛡️",
		"quote": "산성은 무너지지 않는다. 오르는 자가 지칠 뿐이다."
	},
	{
		"id": "kr2_sogaram",
		"name": "소가람",
		"era": "한국(가상)",
		"faction": "국내성",
		"rarity": 3,
		"trait": "wisdom",
		"stats": {
			"might": 40,
			"wisdom": 90,
			"command": 70
		},
		"hanja": "蘇加藍",
		"emoji": "📿",
		"quote": "성 안에서는 곳간이 곧 무기다."
	},
	{
		"id": "kr2_mokrihae",
		"name": "목리해",
		"era": "한국(가상)",
		"faction": "낙랑",
		"rarity": 4,
		"trait": "command",
		"stats": {
			"might": 60,
			"wisdom": 65,
			"command": 84
		},
		"hanja": "木利海",
		"emoji": "🏺",
		"quote": "저자를 지키는 것도 싸움이다."
	},
	{
		"id": "kr2_ajinsa",
		"name": "아진사",
		"era": "한국(가상)",
		"faction": "대방",
		"rarity": 3,
		"trait": "wisdom",
		"stats": {
			"might": 45,
			"wisdom": 85,
			"command": 68
		},
		"hanja": "阿珍思",
		"emoji": "🗺️",
		"quote": "경계란 두려워할 것이 아니라 살필 것이다."
	},
	{
		"id": "kr2_yeonuru",
		"name": "연우루",
		"era": "한국(가상)",
		"faction": "위례성",
		"rarity": 4,
		"trait": "wisdom",
		"stats": {
			"might": 60,
			"wisdom": 90,
			"command": 78
		},
		"hanja": "延于婁",
		"emoji": "📜",
		"quote": "한강은 누구의 편도 아니다 — 다스리는 자의 편일 뿐."
	},
	{
		"id": "kr2_jimasol",
		"name": "지마솔",
		"era": "한국(가상)",
		"faction": "위례성",
		"rarity": 4,
		"trait": "might",
		"stats": {
			"might": 86,
			"wisdom": 48,
			"command": 80
		},
		"hanja": "支麻率",
		"emoji": "🏹",
		"quote": "강을 낀 성은 활로 지킨다."
	},
	{
		"id": "kr2_umorin",
		"name": "우모린",
		"era": "한국(가상)",
		"faction": "금성",
		"rarity": 4,
		"trait": "command",
		"stats": {
			"might": 82,
			"wisdom": 58,
			"command": 88
		},
		"hanja": "于牟隣",
		"emoji": "🗻",
		"quote": "산이 세 겹이면 군사는 반으로 줄어도 된다."
	},
	{
		"id": "kr2_seolharan",
		"name": "설하란",
		"era": "한국(가상)",
		"faction": "김해",
		"rarity": 3,
		"trait": "command",
		"stats": {
			"might": 65,
			"wisdom": 60,
			"command": 80
		},
		"hanja": "薛河蘭",
		"emoji": "⛵",
		"quote": "바다는 넓어서 누구든 받아준다 — 지키는 자만 있다면."
	},
	{
		"id": "jp_umihiko",
		"name": "우미히코",
		"era": "일본(가상)",
		"faction": "대마도",
		"rarity": 3,
		"trait": "might",
		"stats": {
			"might": 78,
			"wisdom": 42,
			"command": 70
		},
		"hanja": "海彦",
		"emoji": "🌊",
		"quote": "섬은 작아도 물길을 아는 자가 지킨다."
	},
	{
		"id": "jp_shioji",
		"name": "시오지",
		"era": "일본(가상)",
		"faction": "일기도",
		"rarity": 3,
		"trait": "wisdom",
		"stats": {
			"might": 40,
			"wisdom": 80,
			"command": 60
		},
		"hanja": "潮路",
		"emoji": "🐚",
		"quote": "다음 섬이 보이지 않아도 물때는 안다."
	},
	{
		"id": "jp_taketsumi",
		"name": "다케쓰미",
		"era": "일본(가상)",
		"faction": "축자",
		"rarity": 4,
		"trait": "command",
		"stats": {
			"might": 82,
			"wisdom": 55,
			"command": 88
		},
		"hanja": "武積",
		"emoji": "⚓",
		"quote": "대륙에서 오는 것은 다 이 나루를 거친다."
	},
	{
		"id": "jp_himetsu",
		"name": "히메쓰",
		"era": "일본(가상)",
		"faction": "축자",
		"rarity": 3,
		"trait": "wisdom",
		"stats": {
			"might": 38,
			"wisdom": 84,
			"command": 65
		},
		"hanja": "姫津",
		"emoji": "📿",
		"quote": "저자가 흔들리면 나루도 흔들립니다."
	},
	{
		"id": "jp_hikoyama",
		"name": "히코야마",
		"era": "일본(가상)",
		"faction": "일향",
		"rarity": 4,
		"trait": "might",
		"stats": {
			"might": 86,
			"wisdom": 45,
			"command": 74
		},
		"hanja": "彦山",
		"emoji": "🏹",
		"quote": "산에서 나고 자란 활을 당해낼 자 없다."
	},
	{
		"id": "jp_kazenari",
		"name": "가제나리",
		"era": "일본(가상)",
		"faction": "출운",
		"rarity": 3,
		"trait": "wisdom",
		"stats": {
			"might": 42,
			"wisdom": 82,
			"command": 68
		},
		"hanja": "風成",
		"emoji": "⛩️",
		"quote": "바람이 이는 쪽에 언제나 답이 있다."
	},
	{
		"id": "jp_asahime",
		"name": "아사히메",
		"era": "일본(가상)",
		"faction": "길비",
		"rarity": 4,
		"trait": "command",
		"stats": {
			"might": 58,
			"wisdom": 68,
			"command": 84
		},
		"hanja": "旭姫",
		"emoji": "🌾",
		"quote": "곡식이 마르지 않는 한 이 땅은 지지 않습니다."
	},
	{
		"id": "jp_wakahiko",
		"name": "와카히코",
		"era": "일본(가상)",
		"faction": "야마토",
		"rarity": 4,
		"trait": "command",
		"stats": {
			"might": 84,
			"wisdom": 58,
			"command": 90
		},
		"hanja": "若彦",
		"emoji": "🗡️",
		"quote": "분지 안쪽까지 들어온 적은 아직 없다."
	},
	{
		"id": "jp_tamakiri",
		"name": "다마키리",
		"era": "일본(가상)",
		"faction": "야마토",
		"rarity": 3,
		"trait": "wisdom",
		"stats": {
			"might": 40,
			"wisdom": 86,
			"command": 70
		},
		"hanja": "玉切",
		"emoji": "🔮",
		"quote": "중심을 지키는 것도 변경을 지키는 것만큼 무겁다."
	},
	{
		"id": "jiao_luyan",
		"name": "노언",
		"era": "교주(가상)",
		"faction": "남해",
		"rarity": 4,
		"trait": "command",
		"stats": {
			"might": 78,
			"wisdom": 58,
			"command": 86
		},
		"hanja": "盧彦",
		"emoji": "⚓",
		"quote": "강남에서 온 배는 다 이 나루를 거칩니다."
	},
	{
		"id": "jiao_hoangmi",
		"name": "황미",
		"era": "교주(가상)",
		"faction": "남해",
		"rarity": 3,
		"trait": "wisdom",
		"stats": {
			"might": 38,
			"wisdom": 82,
			"command": 62
		},
		"hanja": "黃眉",
		"emoji": "📜",
		"quote": "영남의 물목은 제가 압니다."
	},
	{
		"id": "jiao_madang",
		"name": "마당",
		"era": "교주(가상)",
		"faction": "창오",
		"rarity": 3,
		"trait": "might",
		"stats": {
			"might": 82,
			"wisdom": 44,
			"command": 72
		},
		"hanja": "馬棠",
		"emoji": "🐘",
		"quote": "코끼리가 지나가면 길이 저절로 열립니다."
	},
	{
		"id": "jiao_dinggo",
		"name": "정고",
		"era": "교주(가상)",
		"faction": "울림",
		"rarity": 3,
		"trait": "might",
		"stats": {
			"might": 80,
			"wisdom": 40,
			"command": 68
		},
		"hanja": "丁高",
		"emoji": "🏹",
		"quote": "숲에서는 활을 쏘는 자가 임자입니다."
	},
	{
		"id": "jiao_botran",
		"name": "보진",
		"era": "교주(가상)",
		"faction": "합포",
		"rarity": 3,
		"trait": "wisdom",
		"stats": {
			"might": 42,
			"wisdom": 80,
			"command": 66
		},
		"hanja": "寶陳",
		"emoji": "🦪",
		"quote": "진주보다 귀한 건 그걸 지킬 배입니다."
	},
	{
		"id": "jiao_riquan",
		"name": "이권",
		"era": "교주(가상)",
		"faction": "교지",
		"rarity": 4,
		"trait": "command",
		"stats": {
			"might": 76,
			"wisdom": 62,
			"command": 88
		},
		"hanja": "李權",
		"emoji": "🐉",
		"quote": "삼각주를 쥔 자가 교주를 쥡니다."
	},
	{
		"id": "jiao_jinja",
		"name": "진자",
		"era": "교주(가상)",
		"faction": "교지",
		"rarity": 3,
		"trait": "wisdom",
		"stats": {
			"might": 36,
			"wisdom": 84,
			"command": 64
		},
		"hanja": "陳梓",
		"emoji": "🌾",
		"quote": "벼가 두 번 여무는 땅은 굶지 않습니다."
	},
	{
		"id": "jiao_muya",
		"name": "무아",
		"era": "교주(가상)",
		"faction": "구진",
		"rarity": 3,
		"trait": "might",
		"stats": {
			"might": 79,
			"wisdom": 42,
			"command": 70
		},
		"hanja": "武牙",
		"emoji": "🗡️",
		"quote": "남쪽 끝까지 밀려도 물러설 곳은 없습니다."
	},
	{
		"id": "jiao_banrok",
		"name": "반록",
		"era": "교주(가상)",
		"faction": "일남",
		"rarity": 2,
		"trait": "command",
		"stats": {
			"might": 62,
			"wisdom": 50,
			"command": 74
		},
		"hanja": "潘祿",
		"emoji": "🚩",
		"quote": "한(漢)의 이름이 여기서 끝나지 않게 하겠습니다."
	},
	{
		"id": "xiyu_talban",
		"name": "탈반",
		"era": "서역(가상)",
		"faction": "돈황",
		"rarity": 3,
		"trait": "might",
		"stats": {
			"might": 80,
			"wisdom": 46,
			"command": 72
		},
		"hanja": "脫槃",
		"emoji": "🏜️",
		"quote": "사막을 아는 자만이 사막에서 이깁니다."
	},
	{
		"id": "xiyu_yeoje",
		"name": "여저",
		"era": "서역(가상)",
		"faction": "돈황",
		"rarity": 3,
		"trait": "wisdom",
		"stats": {
			"might": 40,
			"wisdom": 80,
			"command": 64
		},
		"hanja": "黎且",
		"emoji": "🐫",
		"quote": "대상(隊商)의 길목을 쥔 자가 금을 쥡니다."
	},
	{
		"id": "xiyu_mokjil",
		"name": "목질",
		"era": "서역(가상)",
		"faction": "누란",
		"rarity": 3,
		"trait": "might",
		"stats": {
			"might": 78,
			"wisdom": 42,
			"command": 68
		},
		"hanja": "木質",
		"emoji": "🧂",
		"quote": "소금 호수 곁에서는 물러설 곳이 없습니다."
	},
	{
		"id": "xiyu_dansu",
		"name": "단수",
		"era": "서역(가상)",
		"faction": "언기",
		"rarity": 3,
		"trait": "wisdom",
		"stats": {
			"might": 38,
			"wisdom": 82,
			"command": 62
		},
		"hanja": "檀須",
		"emoji": "🎶",
		"quote": "북쪽 길의 오아시스는 노래로 손님을 붙듭니다."
	},
	{
		"id": "xiyu_gumo",
		"name": "구모",
		"era": "서역(가상)",
		"faction": "구자",
		"rarity": 4,
		"trait": "command",
		"stats": {
			"might": 74,
			"wisdom": 60,
			"command": 86
		},
		"hanja": "龜牟",
		"emoji": "🏺",
		"quote": "악사도 상인도 다 이 나라를 거칩니다."
	},
	{
		"id": "xiyu_ochi",
		"name": "오지",
		"era": "서역(가상)",
		"faction": "우전",
		"rarity": 3,
		"trait": "wisdom",
		"stats": {
			"might": 42,
			"wisdom": 84,
			"command": 66
		},
		"hanja": "烏支",
		"emoji": "💎",
		"quote": "강바닥의 옥은 캐는 자가 임자입니다."
	},
	{
		"id": "xiyu_sarim",
		"name": "사림",
		"era": "서역(가상)",
		"faction": "소륵",
		"rarity": 4,
		"trait": "command",
		"stats": {
			"might": 76,
			"wisdom": 58,
			"command": 88
		},
		"hanja": "莎林",
		"emoji": "🗺️",
		"quote": "두 길이 다시 만나는 곳을 지키는 것이 제 일입니다."
	},
	{
		"id": "xiyu_banwol",
		"name": "반월",
		"era": "서역(가상)",
		"faction": "소륵",
		"rarity": 3,
		"trait": "wisdom",
		"stats": {
			"might": 36,
			"wisdom": 80,
			"command": 60
		},
		"hanja": "半月",
		"emoji": "🌙",
		"quote": "파미르 너머 소식도 여기선 반나절이면 옵니다."
	},
	{
		"id": "xiyu_cheonma",
		"name": "천마",
		"era": "서역(가상)",
		"faction": "대완",
		"rarity": 4,
		"trait": "might",
		"stats": {
			"might": 82,
			"wisdom": 50,
			"command": 70
		},
		"hanja": "天馬",
		"emoji": "🐎",
		"quote": "한혈마는 하루에 천 리를 달립니다."
	},
	{
		"id": "nz_soman",
		"name": "소만",
		"era": "남중(가상)",
		"faction": "주제",
		"rarity": 3,
		"trait": "might",
		"stats": {
			"might": 80,
			"wisdom": 44,
			"command": 70
		},
		"hanja": "蘇蠻",
		"emoji": "🗡️",
		"quote": "산길을 막으면 코끼리도 못 지나갑니다."
	},
	{
		"id": "nz_ahyang",
		"name": "아향",
		"era": "남중(가상)",
		"faction": "주제",
		"rarity": 3,
		"trait": "wisdom",
		"stats": {
			"might": 40,
			"wisdom": 82,
			"command": 60
		},
		"hanja": "阿香",
		"emoji": "🌿",
		"quote": "독풀을 아는 자가 이 길의 주인입니다."
	},
	{
		"id": "nz_mokro",
		"name": "목로",
		"era": "남중(가상)",
		"faction": "건녕",
		"rarity": 4,
		"trait": "command",
		"stats": {
			"might": 76,
			"wisdom": 58,
			"command": 88
		},
		"hanja": "木老",
		"emoji": "🐘",
		"quote": "코끼리 부대는 산을 오르는 법을 압니다."
	},
	{
		"id": "nz_eunga",
		"name": "은가",
		"era": "남중(가상)",
		"faction": "건녕",
		"rarity": 3,
		"trait": "wisdom",
		"stats": {
			"might": 38,
			"wisdom": 80,
			"command": 64
		},
		"hanja": "銀珂",
		"emoji": "🥁",
		"quote": "북소리 하나로 부족 셋을 모읍니다."
	},
	{
		"id": "nz_jeokpyo",
		"name": "적표",
		"era": "남중(가상)",
		"faction": "월수",
		"rarity": 3,
		"trait": "might",
		"stats": {
			"might": 80,
			"wisdom": 42,
			"command": 68
		},
		"hanja": "赤豹",
		"emoji": "🐆",
		"quote": "표범처럼 능선을 타면 매복은 실패하지 않습니다."
	},
	{
		"id": "nz_hyeoncheon",
		"name": "현천",
		"era": "남중(가상)",
		"faction": "장가",
		"rarity": 3,
		"trait": "wisdom",
		"stats": {
			"might": 42,
			"wisdom": 78,
			"command": 62
		},
		"hanja": "玄泉",
		"emoji": "💧",
		"quote": "협곡의 샘을 막으면 군대는 목이 마릅니다."
	},
	{
		"id": "nz_unhwa",
		"name": "운화",
		"era": "남중(가상)",
		"faction": "운남",
		"rarity": 3,
		"trait": "wisdom",
		"stats": {
			"might": 36,
			"wisdom": 80,
			"command": 58
		},
		"hanja": "雲花",
		"emoji": "🌸",
		"quote": "구름 남쪽 호수는 봄마다 꽃빛으로 물듭니다."
	},
	{
		"id": "nz_geumsang",
		"name": "금상",
		"era": "남중(가상)",
		"faction": "영창",
		"rarity": 4,
		"trait": "command",
		"stats": {
			"might": 70,
			"wisdom": 62,
			"command": 84
		},
		"hanja": "金商",
		"emoji": "💰",
		"quote": "천축(天竺)의 물건도 이 길을 거쳐 옵니다."
	},
	{
		"id": "nz_heukwol",
		"name": "흑월",
		"era": "남중(가상)",
		"faction": "흥고",
		"rarity": 3,
		"trait": "might",
		"stats": {
			"might": 78,
			"wisdom": 40,
			"command": 66
		},
		"hanja": "黑月",
		"emoji": "🌑",
		"quote": "가장 먼 변경일수록 밤이 깁니다."
	},
	{
		"id": "tz_beonwang",
		"name": "번왕",
		"era": "천축(가상)",
		"faction": "신독",
		"rarity": 4,
		"trait": "command",
		"boss": true,
		"stats": {
			"might": 74,
			"wisdom": 60,
			"command": 86
		},
		"hanja": "番王",
		"emoji": "🐘",
		"quote": "코끼리 부대 앞에서는 어떤 성벽도 오래 못 버팁니다."
	},
	{
		"id": "tz_hyanggae",
		"name": "향개",
		"era": "천축(가상)",
		"faction": "신독",
		"rarity": 3,
		"trait": "wisdom",
		"stats": {
			"might": 40,
			"wisdom": 82,
			"command": 62
		},
		"hanja": "香蓋",
		"emoji": "🕉️",
		"quote": "항하의 물은 마르지 않듯, 이 땅의 셈도 끝이 없습니다."
	},
	{
		"id": "tz_seoksang",
		"name": "석상",
		"era": "천축(가상)",
		"faction": "건타라",
		"rarity": 3,
		"trait": "wisdom",
		"stats": {
			"might": 38,
			"wisdom": 80,
			"command": 60
		},
		"hanja": "石像",
		"emoji": "🗿",
		"quote": "돌에 새긴 얼굴은 세월이 지나도 웃고 있습니다."
	},
	{
		"id": "tz_ganda",
		"name": "간다",
		"era": "천축(가상)",
		"faction": "건타라",
		"rarity": 3,
		"trait": "might",
		"stats": {
			"might": 78,
			"wisdom": 46,
			"command": 68
		},
		"hanja": "干陀",
		"emoji": "⚔️",
		"quote": "동서의 상단이 다 이 저자를 거쳐 갑니다."
	},
	{
		"id": "tz_seolsan",
		"name": "설산",
		"era": "천축(가상)",
		"faction": "계빈",
		"rarity": 4,
		"trait": "might",
		"stats": {
			"might": 84,
			"wisdom": 48,
			"command": 74
		},
		"hanja": "雪山",
		"emoji": "🏔️",
		"quote": "눈 덮인 고개를 넘어 본 자만이 이 땅을 지킬 자격이 있습니다."
	},
	{
		"id": "tz_daehacheon",
		"name": "대하천",
		"era": "천축(가상)",
		"faction": "대하",
		"rarity": 3,
		"trait": "wisdom",
		"stats": {
			"might": 44,
			"wisdom": 78,
			"command": 66
		},
		"hanja": "大夏泉",
		"emoji": "🐎",
		"quote": "대월지가 남긴 말과 활은 아직 녹슬지 않았습니다."
	},
	{
		"id": "tz_sanri",
		"name": "산리",
		"era": "천축(가상)",
		"faction": "오익산리",
		"rarity": 3,
		"trait": "wisdom",
		"stats": {
			"might": 36,
			"wisdom": 76,
			"command": 58
		},
		"hanja": "山離",
		"emoji": "🏛️",
		"quote": "먼 서쪽 나라의 돌기둥을 본 적이 있습니다."
	},
	{
		"id": "tz_hangha",
		"name": "항하",
		"era": "천축(가상)",
		"faction": "마게타",
		"rarity": 4,
		"trait": "command",
		"stats": {
			"might": 68,
			"wisdom": 64,
			"command": 84
		},
		"hanja": "恒河",
		"emoji": "🌊",
		"quote": "강이 곧 길이고, 강이 곧 국경입니다."
	},
	{
		"id": "tz_sawi",
		"name": "사위",
		"era": "천축(가상)",
		"faction": "사위",
		"rarity": 3,
		"trait": "virtue",
		"stats": {
			"might": 42,
			"wisdom": 74,
			"command": 60
		},
		"hanja": "舍衛",
		"emoji": "🌸",
		"quote": "순례자를 막지 않는 것이 이 저자의 오랜 법입니다."
	},
]
