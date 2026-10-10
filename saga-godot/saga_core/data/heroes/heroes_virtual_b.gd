extends RefCounted

## characters.gd HEROES 의 한 조각 — 가상 시대 뒤 다섯(막북(가상)·임읍(가상)·균열(가상)·폐허(가상)·묘역(가상)) 45명(R-4 10-10 주제별로 나눔, 순서·내용 그대로).
## 필드·이름 정책은 characters.gd 머리말. 고칠 때는 이 파일을 고친다.

const LIST := [
	{
		"id": "mb_cheolgak",
		"name": "철각",
		"era": "막북(가상)",
		"faction": "운중",
		"rarity": 4,
		"trait": "might",
		"stats": {
			"might": 88,
			"wisdom": 40,
			"command": 76
		},
		"hanja": "鐵角",
		"emoji": "🐎",
		"quote": "초원의 말은 지치는 법을 모릅니다."
	},
	{
		"id": "mb_hoja",
		"name": "호자",
		"era": "막북(가상)",
		"faction": "운중",
		"rarity": 3,
		"trait": "might",
		"stats": {
			"might": 82,
			"wisdom": 42,
			"command": 68
		},
		"hanja": "胡刺",
		"emoji": "🏹",
		"quote": "활은 말 위에서 쏘아야 제맛입니다."
	},
	{
		"id": "mb_baekwoon",
		"name": "백운",
		"era": "막북(가상)",
		"faction": "안문",
		"rarity": 3,
		"trait": "wisdom",
		"stats": {
			"might": 44,
			"wisdom": 78,
			"command": 62
		},
		"hanja": "白雲",
		"emoji": "🖋️",
		"quote": "기러기 넘는 고개, 봉화가 늦으면 안 됩니다."
	},
	{
		"id": "mb_hanpung",
		"name": "한풍",
		"era": "막북(가상)",
		"faction": "정양",
		"rarity": 3,
		"trait": "might",
		"stats": {
			"might": 80,
			"wisdom": 38,
			"command": 64
		},
		"hanja": "寒風",
		"emoji": "❄️",
		"quote": "찬바람이 부는 쪽에서 적이 옵니다."
	},
	{
		"id": "mb_hwangto",
		"name": "황토",
		"era": "막북(가상)",
		"faction": "상군",
		"rarity": 4,
		"trait": "command",
		"stats": {
			"might": 72,
			"wisdom": 58,
			"command": 84
		},
		"hanja": "黃土",
		"emoji": "🏜️",
		"quote": "고원의 흙바람은 성벽보다 오래 버팁니다."
	},
	{
		"id": "mb_gangho",
		"name": "강호",
		"era": "막북(가상)",
		"faction": "북지",
		"rarity": 3,
		"trait": "wisdom",
		"stats": {
			"might": 46,
			"wisdom": 76,
			"command": 60
		},
		"hanja": "羌胡",
		"emoji": "🐑",
		"quote": "강족과 흉노가 뒤섞여도 셈은 하나입니다."
	},
	{
		"id": "mb_hanam",
		"name": "하남",
		"era": "막북(가상)",
		"faction": "삭방",
		"rarity": 3,
		"trait": "wisdom",
		"stats": {
			"might": 40,
			"wisdom": 74,
			"command": 58
		},
		"hanja": "河南",
		"emoji": "🌊",
		"quote": "황하가 크게 굽이치는 곳, 여기가 하남지입니다."
	},
	{
		"id": "mb_janggwang",
		"name": "장광",
		"era": "막북(가상)",
		"faction": "오원",
		"rarity": 3,
		"trait": "might",
		"stats": {
			"might": 76,
			"wisdom": 40,
			"command": 62
		},
		"hanja": "長光",
		"emoji": "🌌",
		"quote": "가장 먼 북쪽, 겨울밤이 유난히 깁니다."
	},
	{
		"id": "mb_seonwoo",
		"name": "선우",
		"era": "막북(가상)",
		"faction": "운중",
		"rarity": 4,
		"trait": "command",
		"boss": true,
		"stats": {
			"might": 78,
			"wisdom": 56,
			"command": 90
		},
		"hanja": "單于",
		"emoji": "👑",
		"quote": "초원의 여러 부족이 제 깃발 아래 모입니다."
	},
	{
		"id": "ly_sangnim",
		"name": "상님",
		"era": "임읍(가상)",
		"faction": "상림",
		"rarity": 4,
		"trait": "might",
		"stats": {
			"might": 82,
			"wisdom": 48,
			"command": 78
		},
		"hanja": "象林",
		"emoji": "🐘",
		"quote": "임읍이 일어난 땅, 이 현을 지키는 것이 곧 나라를 지키는 일입니다."
	},
	{
		"id": "ly_uhwa",
		"name": "우화",
		"era": "임읍(가상)",
		"faction": "상림",
		"rarity": 3,
		"trait": "wisdom",
		"stats": {
			"might": 38,
			"wisdom": 80,
			"command": 60
		},
		"hanja": "雨花",
		"emoji": "🌧️",
		"quote": "우기가 오면 벼가 두 번 여뭅니다."
	},
	{
		"id": "ly_nogyong",
		"name": "노경",
		"era": "임읍(가상)",
		"faction": "노용",
		"rarity": 3,
		"trait": "might",
		"stats": {
			"might": 76,
			"wisdom": 44,
			"command": 66
		},
		"hanja": "盧景",
		"emoji": "🌾",
		"quote": "들이 기름지면 지킬 값어치도 큽니다."
	},
	{
		"id": "ly_jinju",
		"name": "진주",
		"era": "임읍(가상)",
		"faction": "비경",
		"rarity": 3,
		"trait": "wisdom",
		"stats": {
			"might": 40,
			"wisdom": 78,
			"command": 62
		},
		"hanja": "眞珠",
		"emoji": "🦪",
		"quote": "바다가 내어 주는 것은 진주만이 아닙니다."
	},
	{
		"id": "ly_juoh",
		"name": "주오",
		"era": "임읍(가상)",
		"faction": "주오",
		"rarity": 3,
		"trait": "virtue",
		"stats": {
			"might": 42,
			"wisdom": 70,
			"command": 58
		},
		"hanja": "朱吾",
		"emoji": "🌊",
		"quote": "기록이 끝나는 곳에서도 사람은 삽니다."
	},
	{
		"id": "ly_sanga",
		"name": "산아",
		"era": "임읍(가상)",
		"faction": "서권",
		"rarity": 3,
		"trait": "might",
		"stats": {
			"might": 78,
			"wisdom": 42,
			"command": 64
		},
		"hanja": "山牙",
		"emoji": "🐆",
		"quote": "코끼리가 못 오르는 산도 사람은 오릅니다."
	},
	{
		"id": "ly_jeonchung",
		"name": "전충",
		"era": "임읍(가상)",
		"faction": "전충",
		"rarity": 4,
		"trait": "command",
		"boss": true,
		"stats": {
			"might": 74,
			"wisdom": 60,
			"command": 88
		},
		"hanja": "典沖",
		"emoji": "🏯",
		"quote": "벽돌로 쌓은 성벽은 불에도 잘 안 무너집니다."
	},
	{
		"id": "ly_byeokjeon",
		"name": "벽전",
		"era": "임읍(가상)",
		"faction": "전충",
		"rarity": 3,
		"trait": "wisdom",
		"stats": {
			"might": 44,
			"wisdom": 76,
			"command": 64
		},
		"hanja": "甓塼",
		"emoji": "🧱",
		"quote": "벽돌 굽는 가마 불은 밤에도 꺼지지 않습니다."
	},
	{
		"id": "ly_heuksang",
		"name": "흑상",
		"era": "임읍(가상)",
		"faction": "구속",
		"rarity": 3,
		"trait": "might",
		"stats": {
			"might": 76,
			"wisdom": 38,
			"command": 60
		},
		"hanja": "黑象",
		"emoji": "🌑",
		"quote": "지도 위 가장 남쪽, 기록도 여기서 흐려집니다."
	},
	{
		"id": "fu_seonghon",
		"name": "성혼",
		"era": "균열(가상)",
		"faction": "천궤",
		"rarity": 4,
		"trait": "wisdom",
		"stats": {
			"might": 50,
			"wisdom": 88,
			"command": 70
		},
		"hanja": "星魂",
		"emoji": "👽",
		"quote": "별 사이를 건너온 자리, 이 관문부터 지킵니다."
	},
	{
		"id": "fu_yuseong",
		"name": "유성",
		"era": "균열(가상)",
		"faction": "천궤",
		"rarity": 3,
		"trait": "wisdom",
		"stats": {
			"might": 46,
			"wisdom": 80,
			"command": 62
		},
		"hanja": "流星",
		"emoji": "☄️",
		"quote": "떨어지는 것은 다 여기로 떨어집니다."
	},
	{
		"id": "fu_noejang",
		"name": "뇌장",
		"era": "균열(가상)",
		"faction": "뇌성",
		"rarity": 3,
		"trait": "might",
		"stats": {
			"might": 78,
			"wisdom": 44,
			"command": 66
		},
		"hanja": "雷將",
		"emoji": "⚡",
		"quote": "번개가 치기 전에 이미 우리가 먼저 움직입니다."
	},
	{
		"id": "fu_gangma",
		"name": "강마",
		"era": "균열(가상)",
		"faction": "강철",
		"rarity": 3,
		"trait": "might",
		"stats": {
			"might": 80,
			"wisdom": 40,
			"command": 60
		},
		"hanja": "鋼魔",
		"emoji": "🔩",
		"quote": "쇠는 부러지지 않습니다, 휘어질 뿐입니다."
	},
	{
		"id": "fu_yugwi",
		"name": "유귀",
		"era": "균열(가상)",
		"faction": "유리",
		"rarity": 3,
		"trait": "command",
		"stats": {
			"might": 52,
			"wisdom": 58,
			"command": 82
		},
		"hanja": "琉鬼",
		"emoji": "💎",
		"quote": "투명한 벽 안에서는 숨을 곳이 없습니다 — 지키는 저희도 마찬가지입니다."
	},
	{
		"id": "fu_hwanryeong",
		"name": "환령",
		"era": "균열(가상)",
		"faction": "환영",
		"rarity": 3,
		"trait": "wisdom",
		"stats": {
			"might": 42,
			"wisdom": 78,
			"command": 56
		},
		"hanja": "幻靈",
		"emoji": "👻",
		"quote": "보이는 것을 믿지 마십시오, 저부터가 그렇습니다."
	},
	{
		"id": "fu_janhon",
		"name": "잔혼",
		"era": "균열(가상)",
		"faction": "잔영",
		"rarity": 3,
		"trait": "might",
		"stats": {
			"might": 76,
			"wisdom": 40,
			"command": 58
		},
		"hanja": "殘魂",
		"emoji": "❄️",
		"quote": "허물어진 것도 끝까지 버티면 성벽입니다."
	},
	{
		"id": "fu_jongwang",
		"name": "종왕",
		"era": "균열(가상)",
		"faction": "종말",
		"rarity": 4,
		"trait": "command",
		"boss": true,
		"stats": {
			"might": 80,
			"wisdom": 70,
			"command": 92
		},
		"hanja": "終末王",
		"emoji": "🐲",
		"quote": "이 자리가 끝이라면, 지키는 것도 제가 마지막입니다."
	},
	{
		"id": "fu_myeongje",
		"name": "명제",
		"era": "균열(가상)",
		"faction": "종말",
		"rarity": 3,
		"trait": "might",
		"stats": {
			"might": 82,
			"wisdom": 42,
			"command": 64
		},
		"hanja": "冥帝",
		"emoji": "👹",
		"quote": "겹친 시간 속에서는 죽는 것도 순서가 없습니다."
	},
	{
		"id": "ru_busaeng",
		"name": "부생",
		"era": "폐허(가상)",
		"faction": "폐도",
		"rarity": 3,
		"trait": "might",
		"stats": {
			"might": 74,
			"wisdom": 30,
			"command": 52
		},
		"hanja": "腐生",
		"emoji": "🧟",
		"quote": "죽어도 멈추지 않습니다."
	},
	{
		"id": "ru_geohae",
		"name": "거해",
		"era": "폐허(가상)",
		"faction": "폐도",
		"rarity": 4,
		"trait": "might",
		"boss": true,
		"stats": {
			"might": 88,
			"wisdom": 34,
			"command": 66
		},
		"hanja": "巨骸",
		"emoji": "🗿",
		"quote": "이 폐허에서 가장 큰 그림자는 저입니다."
	},
	{
		"id": "ru_gogol",
		"name": "고골",
		"era": "폐허(가상)",
		"faction": "잔재",
		"rarity": 3,
		"trait": "might",
		"stats": {
			"might": 70,
			"wisdom": 42,
			"command": 58
		},
		"hanja": "枯骨",
		"emoji": "💀",
		"quote": "살은 다 떨어져 나갔지만, 자리는 지킵니다."
	},
	{
		"id": "ru_mangdok",
		"name": "망독",
		"era": "폐허(가상)",
		"faction": "잔재",
		"rarity": 3,
		"trait": "wisdom",
		"stats": {
			"might": 48,
			"wisdom": 76,
			"command": 50
		},
		"hanja": "網毒",
		"emoji": "🕷️",
		"quote": "걸리면 빠져나갈 길이 없습니다."
	},
	{
		"id": "ru_sanaek",
		"name": "산액",
		"era": "폐허(가상)",
		"faction": "오염",
		"rarity": 3,
		"trait": "command",
		"stats": {
			"might": 40,
			"wisdom": 60,
			"command": 78
		},
		"hanja": "酸液",
		"emoji": "🧪",
		"quote": "베어도 갈라질 뿐, 죽지 않습니다."
	},
	{
		"id": "ru_sayeong",
		"name": "사영",
		"era": "폐허(가상)",
		"faction": "침묵",
		"rarity": 3,
		"trait": "wisdom",
		"stats": {
			"might": 50,
			"wisdom": 80,
			"command": 48
		},
		"hanja": "蛇影",
		"emoji": "🐍",
		"quote": "소리 없이 다가섭니다, 이 침묵과 같이."
	},
	{
		"id": "ru_seogun",
		"name": "서군",
		"era": "폐허(가상)",
		"faction": "회곡",
		"rarity": 3,
		"trait": "command",
		"stats": {
			"might": 44,
			"wisdom": 52,
			"command": 74
		},
		"hanja": "鼠群",
		"emoji": "🐀",
		"quote": "하나씩은 약해도, 무리는 다릅니다."
	},
	{
		"id": "ru_wadok",
		"name": "와독",
		"era": "폐허(가상)",
		"faction": "역병",
		"rarity": 3,
		"trait": "wisdom",
		"stats": {
			"might": 46,
			"wisdom": 72,
			"command": 54
		},
		"hanja": "蛙毒",
		"emoji": "🐸",
		"quote": "병이 지나간 자리에 저희가 남았습니다."
	},
	{
		"id": "ru_doksi",
		"name": "독시",
		"era": "폐허(가상)",
		"faction": "잔향",
		"rarity": 3,
		"trait": "command",
		"stats": {
			"might": 58,
			"wisdom": 46,
			"command": 72
		},
		"hanja": "毒翅",
		"emoji": "🐝",
		"quote": "메아리처럼, 떼로 몰려옵니다."
	},
	{
		"id": "tb_baekgi",
		"name": "백기",
		"era": "묘역(가상)",
		"faction": "묘문",
		"rarity": 4,
		"trait": "might",
		"boss": true,
		"stats": {
			"might": 86,
			"wisdom": 38,
			"command": 70
		},
		"hanja": "白騎",
		"emoji": "💀",
		"quote": "이 무덤 앞에서는 산 것도 죽은 것도 다 같은 손님입니다."
	},
	{
		"id": "tb_ganghae",
		"name": "강해",
		"era": "묘역(가상)",
		"faction": "백골",
		"rarity": 3,
		"trait": "might",
		"stats": {
			"might": 78,
			"wisdom": 32,
			"command": 56
		},
		"hanja": "强骸",
		"emoji": "🦴",
		"quote": "부러진 뼈로도 창은 들 수 있습니다."
	},
	{
		"id": "tb_gojeon",
		"name": "고전",
		"era": "묘역(가상)",
		"faction": "침관",
		"rarity": 3,
		"trait": "might",
		"stats": {
			"might": 74,
			"wisdom": 36,
			"command": 60
		},
		"hanja": "古戰",
		"emoji": "⚔️",
		"quote": "옛 싸움을 기억하는 건 이제 저희뿐입니다."
	},
	{
		"id": "tb_amseup",
		"name": "암습",
		"era": "묘역(가상)",
		"faction": "혼로",
		"rarity": 3,
		"trait": "wisdom",
		"stats": {
			"might": 56,
			"wisdom": 70,
			"command": 52
		},
		"hanja": "暗襲",
		"emoji": "🗡️",
		"quote": "그림자가 길어질 때, 저도 함께 깁니다."
	},
	{
		"id": "tb_jamhon",
		"name": "잠혼",
		"era": "묘역(가상)",
		"faction": "진혼",
		"rarity": 3,
		"trait": "wisdom",
		"stats": {
			"might": 52,
			"wisdom": 74,
			"command": 50
		},
		"hanja": "潛魂",
		"emoji": "👤",
		"quote": "혼은 몸이 없어도 숨을 곳을 압니다."
	},
	{
		"id": "tb_saryeong",
		"name": "사령",
		"era": "묘역(가상)",
		"faction": "유골",
		"rarity": 3,
		"trait": "wisdom",
		"stats": {
			"might": 38,
			"wisdom": 84,
			"command": 58
		},
		"hanja": "死靈",
		"emoji": "🔮",
		"quote": "죽음을 부리는 건 죽은 자가 제일 잘합니다."
	},
	{
		"id": "tb_heukju",
		"name": "흑주",
		"era": "묘역(가상)",
		"faction": "심연",
		"rarity": 3,
		"trait": "wisdom",
		"stats": {
			"might": 36,
			"wisdom": 82,
			"command": 62
		},
		"hanja": "黑呪",
		"emoji": "🕯️",
		"quote": "저주는 말보다 오래 남습니다."
	},
	{
		"id": "tb_japgol",
		"name": "잡골",
		"era": "묘역(가상)",
		"faction": "백골",
		"rarity": 3,
		"trait": "might",
		"stats": {
			"might": 60,
			"wisdom": 34,
			"command": 44
		},
		"hanja": "雜骨",
		"emoji": "💀",
		"quote": "이름은 잊었지만, 자리는 안 잊었습니다."
	},
	{
		"id": "tb_jongja",
		"name": "종자",
		"era": "묘역(가상)",
		"faction": "침관",
		"rarity": 3,
		"trait": "command",
		"stats": {
			"might": 58,
			"wisdom": 36,
			"command": 46
		},
		"hanja": "從者",
		"emoji": "⛓️",
		"quote": "누군가는 앞에 서야 합니다, 저는 그게 익숙합니다."
	},
]
