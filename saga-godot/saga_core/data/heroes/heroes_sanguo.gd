extends RefCounted

## characters.gd HEROES 의 한 조각 — 삼국지 66명(R-4 10-10 주제별로 나눔, 순서·내용 그대로).
## 필드·이름 정책은 characters.gd 머리말. 고칠 때는 이 파일을 고친다.

const LIST := [
	{
		"id": "sg_guanyu",
		"name": "명운",
		"era": "삼국지",
		"faction": "촉",
		"rarity": 5,
		"trait": "virtue",
		"stats": {
			"might": 97,
			"wisdom": 75,
			"command": 95
		},
		"hanja": "明雲",
		"emoji": "🗡️",
		"quote": "의(義)를 아는 이와 함께라면 어디든 가겠소."
	},
	{
		"id": "sg_zhangfei",
		"name": "뇌호",
		"era": "삼국지",
		"faction": "촉",
		"rarity": 4,
		"trait": "might",
		"stats": {
			"might": 98,
			"wisdom": 45,
			"command": 80
		},
		"hanja": "雷虎",
		"emoji": "🍶",
		"quote": "술이나 한잔 하며 이야기하세!"
	},
	{
		"id": "sg_zhaoyun",
		"name": "은창",
		"era": "삼국지",
		"faction": "촉",
		"rarity": 5,
		"trait": "virtue",
		"stats": {
			"might": 96,
			"wisdom": 76,
			"command": 91
		},
		"hanja": "銀槍",
		"emoji": "🐎",
		"quote": "한 몸 바쳐 주공을 지키겠습니다."
	},
	{
		"id": "sg_zhugeliang",
		"name": "현책",
		"era": "삼국지",
		"faction": "촉",
		"rarity": 5,
		"trait": "wisdom",
		"stats": {
			"might": 38,
			"wisdom": 100,
			"command": 92
		},
		"hanja": "玄策",
		"emoji": "📜",
		"quote": "삼고초려의 뜻, 잊지 않겠습니다."
	},
	{
		"id": "sg_liubei",
		"name": "인형",
		"era": "삼국지",
		"faction": "촉",
		"rarity": 5,
		"trait": "virtue",
		"stats": {
			"might": 72,
			"wisdom": 78,
			"command": 90
		},
		"hanja": "仁衡",
		"emoji": "👑",
		"quote": "백성을 생각하는 마음이 같구려."
	},
	{
		"id": "sg_machao",
		"name": "서풍",
		"era": "삼국지",
		"faction": "촉",
		"rarity": 4,
		"trait": "might",
		"stats": {
			"might": 97,
			"wisdom": 44,
			"command": 87
		},
		"hanja": "西風",
		"emoji": "🏇",
		"quote": "서량의 창끝을 빌려주겠다."
	},
	{
		"id": "sg_huangzhong",
		"name": "노궁",
		"era": "삼국지",
		"faction": "촉",
		"rarity": 4,
		"trait": "might",
		"stats": {
			"might": 93,
			"wisdom": 62,
			"command": 85
		},
		"hanja": "老弓",
		"emoji": "🏹",
		"quote": "늙었다 얕보지 마라!"
	},
	{
		"id": "sg_caocao",
		"name": "패헌",
		"era": "삼국지",
		"faction": "위",
		"rarity": 5,
		"trait": "wisdom",
		"stats": {
			"might": 72,
			"wisdom": 96,
			"command": 98
		},
		"hanja": "霸軒",
		"emoji": "⚔️",
		"quote": "내가 천하를 저버릴지언정, 천하가 나를 저버리게 두지 않는다."
	},
	{
		"id": "sg_simayi",
		"name": "은인",
		"era": "삼국지",
		"faction": "위",
		"rarity": 5,
		"trait": "wisdom",
		"stats": {
			"might": 63,
			"wisdom": 98,
			"command": 94
		},
		"hanja": "隱忍",
		"emoji": "🕸️",
		"quote": "때를 기다릴 줄 아는 자가 이깁니다."
	},
	{
		"id": "sg_xiahoudun",
		"name": "언무",
		"era": "삼국지",
		"faction": "위",
		"rarity": 4,
		"trait": "might",
		"stats": {
			"might": 92,
			"wisdom": 58,
			"command": 88
		},
		"hanja": "彦武",
		"emoji": "🩹",
		"quote": "이 한쪽 눈으로도 적은 충분히 보인다."
	},
	{
		"id": "sg_zhangliao",
		"name": "철벽",
		"era": "삼국지",
		"faction": "위",
		"rarity": 4,
		"trait": "might",
		"stats": {
			"might": 94,
			"wisdom": 78,
			"command": 93
		},
		"hanja": "鐵壁",
		"emoji": "🛡️",
		"quote": "팔백으로 십만을 막아 보이겠소."
	},
	{
		"id": "sg_xunyu",
		"name": "청안",
		"era": "삼국지",
		"faction": "위",
		"rarity": 4,
		"trait": "wisdom",
		"stats": {
			"might": 30,
			"wisdom": 96,
			"command": 70
		},
		"hanja": "淸眼",
		"emoji": "📜",
		"quote": "왕좌지재(王佐之才)라 불러주시니 부끄럽습니다."
	},
	{
		"id": "sg_sunquan",
		"name": "벽해",
		"era": "삼국지",
		"faction": "오",
		"rarity": 4,
		"trait": "virtue",
		"stats": {
			"might": 70,
			"wisdom": 86,
			"command": 89
		},
		"hanja": "碧海",
		"emoji": "🔷",
		"quote": "강동은 손을 잡을 줄 아는 자를 반깁니다."
	},
	{
		"id": "sg_zhouyu",
		"name": "화풍",
		"era": "삼국지",
		"faction": "오",
		"rarity": 5,
		"trait": "wisdom",
		"stats": {
			"might": 71,
			"wisdom": 96,
			"command": 97
		},
		"hanja": "火風",
		"emoji": "🔥",
		"quote": "동남풍이 불면, 그때가 우리의 때입니다."
	},
	{
		"id": "sg_luxun",
		"name": "담연",
		"era": "삼국지",
		"faction": "오",
		"rarity": 4,
		"trait": "wisdom",
		"stats": {
			"might": 66,
			"wisdom": 95,
			"command": 94
		},
		"hanja": "淡然",
		"emoji": "🌊",
		"quote": "서두르지 않는 것이 제 병법입니다."
	},
	{
		"id": "sg_taishici",
		"name": "궁성",
		"era": "삼국지",
		"faction": "오",
		"rarity": 4,
		"trait": "might",
		"stats": {
			"might": 93,
			"wisdom": 66,
			"command": 82
		},
		"hanja": "弓星",
		"emoji": "🎯",
		"quote": "활 솜씨를 보여드리지요."
	},
	{
		"id": "sg_ganning",
		"name": "영진",
		"era": "삼국지",
		"faction": "오",
		"rarity": 3,
		"trait": "might",
		"stats": {
			"might": 94,
			"wisdom": 60,
			"command": 79
		},
		"hanja": "鈴陣",
		"emoji": "🔔",
		"quote": "방울 소리가 들리면 이미 늦은 것이다."
	},
	{
		"id": "sg_lubu",
		"name": "패창",
		"era": "삼국지",
		"faction": "군웅",
		"rarity": 5,
		"trait": "might",
		"stats": {
			"might": 100,
			"wisdom": 26,
			"command": 88
		},
		"hanja": "霸槍",
		"emoji": "🐉",
		"quote": "천하무쌍! 나를 막을 자가 있나?"
	},
	{
		"id": "sg_diaochan",
		"name": "월영",
		"era": "삼국지",
		"faction": "군웅",
		"rarity": 5,
		"trait": "virtue",
		"stats": {
			"might": 20,
			"wisdom": 88,
			"command": 40
		},
		"hanja": "月影",
		"emoji": "🌙",
		"quote": "이 몸이 도움이 된다면요."
	},
	{
		"id": "sg_pangtong",
		"name": "봉래",
		"era": "삼국지",
		"faction": "촉",
		"rarity": 4,
		"trait": "wisdom",
		"stats": {
			"might": 40,
			"wisdom": 97,
			"command": 80
		},
		"hanja": "鳳來",
		"emoji": "🦅",
		"quote": "봉래가 여기 있습니다."
	},
	{
		"id": "sg_huatuo",
		"name": "신침",
		"era": "삼국지",
		"faction": "재야",
		"rarity": 4,
		"trait": "virtue",
		"stats": {
			"might": 15,
			"wisdom": 92,
			"command": 20
		},
		"hanja": "神鍼",
		"emoji": "💊",
		"quote": "사람을 살리는 일이라면 함께하지요."
	},
	{
		"id": "sg_menghuo",
		"name": "만왕",
		"era": "삼국지",
		"faction": "남만",
		"rarity": 3,
		"trait": "might",
		"stats": {
			"might": 88,
			"wisdom": 40,
			"command": 76
		},
		"hanja": "蠻王",
		"emoji": "🐘",
		"quote": "일곱 번 져도 여덟 번 일어난다!"
	},
	{
		"id": "rf_mizhu",
		"name": "창윤",
		"era": "삼국지",
		"faction": "촉",
		"rarity": 3,
		"trait": "wisdom",
		"stats": {
			"might": 26,
			"wisdom": 84,
			"command": 62
		},
		"hanja": "倉潤",
		"emoji": "💰",
		"quote": "집안의 재물을 다 내어 군자금에 보태겠습니다."
	},
	{
		"id": "rf_jianyong",
		"name": "언유",
		"era": "삼국지",
		"faction": "촉",
		"rarity": 2,
		"trait": "wisdom",
		"stats": {
			"might": 30,
			"wisdom": 80,
			"command": 55
		},
		"hanja": "言柔",
		"emoji": "🗣️",
		"quote": "말로 푸는 일이라면 제가 가지요."
	},
	{
		"id": "rf_chengong",
		"name": "현모",
		"era": "삼국지",
		"faction": "군웅",
		"rarity": 4,
		"trait": "wisdom",
		"stats": {
			"might": 45,
			"wisdom": 92,
			"command": 80
		},
		"hanja": "玄謀",
		"emoji": "🕳️",
		"quote": "제 계책을 들었다면 이리 되지 않았습니다."
	},
	{
		"id": "rf_gaoshun",
		"name": "진위",
		"era": "삼국지",
		"faction": "군웅",
		"rarity": 4,
		"trait": "command",
		"stats": {
			"might": 87,
			"wisdom": 66,
			"command": 90
		},
		"hanja": "陣威",
		"emoji": "🛡️",
		"quote": "함진영(陷陣營)은 물러선 적이 없습니다."
	},
	{
		"id": "rf_yuanshao",
		"name": "패항",
		"era": "삼국지",
		"faction": "군웅",
		"rarity": 4,
		"trait": "command",
		"stats": {
			"might": 73,
			"wisdom": 74,
			"command": 88
		},
		"hanja": "霸恒",
		"emoji": "🏆",
		"quote": "사대(四代)에 삼공을 낸 집안이오."
	},
	{
		"id": "rf_yanliang",
		"name": "위창",
		"era": "삼국지",
		"faction": "군웅",
		"rarity": 4,
		"trait": "might",
		"stats": {
			"might": 92,
			"wisdom": 40,
			"command": 76
		},
		"hanja": "威槍",
		"emoji": "⚔️",
		"quote": "하북에 나만 한 창이 또 있겠는가."
	},
	{
		"id": "rf_wenchou",
		"name": "노창",
		"era": "삼국지",
		"faction": "군웅",
		"rarity": 4,
		"trait": "might",
		"stats": {
			"might": 91,
			"wisdom": 38,
			"command": 74
		},
		"hanja": "怒槍",
		"emoji": "🗡️",
		"quote": "안량의 원수를 갚겠다!"
	},
	{
		"id": "rf_jushou",
		"name": "명책",
		"era": "삼국지",
		"faction": "군웅",
		"rarity": 4,
		"trait": "wisdom",
		"stats": {
			"might": 40,
			"wisdom": 93,
			"command": 82
		},
		"hanja": "明策",
		"emoji": "🧭",
		"quote": "천자를 받들면 명분이 우리에게 옵니다."
	},
	{
		"id": "rf_tianfeng",
		"name": "강간",
		"era": "삼국지",
		"faction": "군웅",
		"rarity": 4,
		"trait": "wisdom",
		"stats": {
			"might": 35,
			"wisdom": 94,
			"command": 68
		},
		"hanja": "剛諫",
		"emoji": "⛓️",
		"quote": "옳은 말을 하고 옥에 갇히는 것이 신하의 팔자입니다."
	},
	{
		"id": "rf_shenpei",
		"name": "수성",
		"era": "삼국지",
		"faction": "군웅",
		"rarity": 3,
		"trait": "command",
		"stats": {
			"might": 62,
			"wisdom": 82,
			"command": 84
		},
		"hanja": "守城",
		"emoji": "🏯",
		"quote": "성이 무너져도 북쪽을 보고 죽겠소."
	},
	{
		"id": "rf_zhanghe",
		"name": "운략",
		"era": "삼국지",
		"faction": "위",
		"rarity": 5,
		"trait": "command",
		"stats": {
			"might": 89,
			"wisdom": 82,
			"command": 91
		},
		"hanja": "雲略",
		"emoji": "🌀",
		"quote": "지형을 읽는 것이 곧 병법입니다."
	},
	{
		"id": "rf_gaolan",
		"name": "사주",
		"era": "삼국지",
		"faction": "군웅",
		"rarity": 3,
		"trait": "might",
		"stats": {
			"might": 84,
			"wisdom": 55,
			"command": 76
		},
		"hanja": "四柱",
		"emoji": "🛡️",
		"quote": "하북 사정주(四庭柱)의 하나요."
	},
	{
		"id": "rf_gongsunzan",
		"name": "연변",
		"era": "삼국지",
		"faction": "군웅",
		"rarity": 3,
		"trait": "might",
		"stats": {
			"might": 84,
			"wisdom": 60,
			"command": 82
		},
		"hanja": "燕邊",
		"emoji": "🐎",
		"quote": "백마의천(白馬義從)을 아느냐."
	},
	{
		"id": "rf_yangang",
		"name": "선기",
		"era": "삼국지",
		"faction": "군웅",
		"rarity": 2,
		"trait": "might",
		"stats": {
			"might": 72,
			"wisdom": 42,
			"command": 66
		},
		"hanja": "先旗",
		"emoji": "🏳️",
		"quote": "선봉은 백마가 맡습니다."
	},
	{
		"id": "rf_kongrong",
		"name": "관빈",
		"era": "삼국지",
		"faction": "군웅",
		"rarity": 3,
		"trait": "wisdom",
		"stats": {
			"might": 24,
			"wisdom": 87,
			"command": 58
		},
		"hanja": "款賓",
		"emoji": "🍐",
		"quote": "자리에 손님이 늘 가득하고 잔이 비지 않으면 족하오."
	},
	{
		"id": "rf_wuanguo",
		"name": "역완",
		"era": "삼국지",
		"faction": "군웅",
		"rarity": 2,
		"trait": "might",
		"stats": {
			"might": 74,
			"wisdom": 38,
			"command": 60
		},
		"hanja": "力椀",
		"emoji": "🔨",
		"quote": "철퇴로 여포를 맞겠소!"
	},
	{
		"id": "rf_yuanshu",
		"name": "옥운",
		"era": "삼국지",
		"faction": "군웅",
		"rarity": 3,
		"trait": "command",
		"stats": {
			"might": 60,
			"wisdom": 58,
			"command": 72
		},
		"hanja": "玉運",
		"emoji": "🍯",
		"quote": "옥새가 내게 왔으니 하늘의 뜻이 아니겠는가."
	},
	{
		"id": "rf_jiling",
		"name": "예도",
		"era": "삼국지",
		"faction": "군웅",
		"rarity": 3,
		"trait": "might",
		"stats": {
			"might": 85,
			"wisdom": 52,
			"command": 78
		},
		"hanja": "銳刀",
		"emoji": "🌙",
		"quote": "삼첨도(三尖刀)의 무게를 견뎌 보아라."
	},
	{
		"id": "rf_yanghong",
		"name": "개창",
		"era": "삼국지",
		"faction": "군웅",
		"rarity": 2,
		"trait": "wisdom",
		"stats": {
			"might": 30,
			"wisdom": 74,
			"command": 58
		},
		"hanja": "開倉",
		"emoji": "📜",
		"quote": "창고를 열어 인심을 사시지요."
	},
	{
		"id": "rf_liubiao",
		"name": "온형",
		"era": "삼국지",
		"faction": "군웅",
		"rarity": 3,
		"trait": "wisdom",
		"stats": {
			"might": 45,
			"wisdom": 80,
			"command": 76
		},
		"hanja": "溫荊",
		"emoji": "🌾",
		"quote": "형주를 조용히 지키는 것도 공(功)이오."
	},
	{
		"id": "rf_caimao",
		"name": "함선",
		"era": "삼국지",
		"faction": "위",
		"rarity": 3,
		"trait": "command",
		"stats": {
			"might": 70,
			"wisdom": 72,
			"command": 82
		},
		"hanja": "艦船",
		"emoji": "⛵",
		"quote": "수군은 형주의 자랑입니다."
	},
	{
		"id": "rf_kuailiang",
		"name": "유호",
		"era": "삼국지",
		"faction": "위",
		"rarity": 3,
		"trait": "wisdom",
		"stats": {
			"might": 28,
			"wisdom": 88,
			"command": 70
		},
		"hanja": "柔豪",
		"emoji": "🖋️",
		"quote": "형주의 호족을 달래는 일부터 하십시오."
	},
	{
		"id": "rf_huangzu",
		"name": "강수",
		"era": "삼국지",
		"faction": "군웅",
		"rarity": 2,
		"trait": "command",
		"stats": {
			"might": 70,
			"wisdom": 50,
			"command": 72
		},
		"hanja": "江戍",
		"emoji": "🏹",
		"quote": "강하는 내가 지킨다."
	},
	{
		"id": "rf_wenpin",
		"name": "북관",
		"era": "삼국지",
		"faction": "위",
		"rarity": 3,
		"trait": "command",
		"stats": {
			"might": 82,
			"wisdom": 66,
			"command": 85
		},
		"hanja": "北關",
		"emoji": "🚩",
		"quote": "북쪽 국경은 제가 맡겠습니다."
	},
	{
		"id": "rf_lijue",
		"name": "화탈",
		"era": "삼국지",
		"faction": "군웅",
		"rarity": 3,
		"trait": "might",
		"stats": {
			"might": 84,
			"wisdom": 56,
			"command": 76
		},
		"hanja": "火奪",
		"emoji": "🔥",
		"quote": "장안은 우리 것이다."
	},
	{
		"id": "rf_guosi",
		"name": "낭칭",
		"era": "삼국지",
		"faction": "군웅",
		"rarity": 3,
		"trait": "might",
		"stats": {
			"might": 82,
			"wisdom": 52,
			"command": 74
		},
		"hanja": "狼稱",
		"emoji": "🐺",
		"quote": "천자를 끼고 있으면 누가 뭐라 하겠나."
	},
	{
		"id": "rf_zhangji",
		"name": "량행",
		"era": "삼국지",
		"faction": "군웅",
		"rarity": 2,
		"trait": "might",
		"stats": {
			"might": 76,
			"wisdom": 50,
			"command": 70
		},
		"hanja": "糧行",
		"emoji": "🏚️",
		"quote": "군량만 있으면 어디든 갑니다."
	},
	{
		"id": "rf_jiaxu",
		"name": "생계",
		"era": "삼국지",
		"faction": "위",
		"rarity": 5,
		"trait": "wisdom",
		"stats": {
			"might": 40,
			"wisdom": 99,
			"command": 78
		},
		"hanja": "生計",
		"emoji": "🦊",
		"quote": "살아남는 계책만 말씀드립니다."
	},
	{
		"id": "rf_mateng",
		"name": "은마",
		"era": "삼국지",
		"faction": "촉",
		"rarity": 3,
		"trait": "might",
		"stats": {
			"might": 86,
			"wisdom": 60,
			"command": 82
		},
		"hanja": "銀馬",
		"emoji": "🐫",
		"quote": "서량의 말은 바람을 탄다."
	},
	{
		"id": "rf_pangde",
		"name": "치명",
		"era": "삼국지",
		"faction": "촉",
		"rarity": 4,
		"trait": "might",
		"stats": {
			"might": 92,
			"wisdom": 60,
			"command": 84
		},
		"hanja": "致命",
		"emoji": "⚰️",
		"quote": "관을 지고 나왔으니 살아 돌아갈 뜻이 없소."
	},
	{
		"id": "rf_hansui",
		"name": "맹약",
		"era": "삼국지",
		"faction": "촉",
		"rarity": 3,
		"trait": "command",
		"stats": {
			"might": 74,
			"wisdom": 74,
			"command": 84
		},
		"hanja": "盟約",
		"emoji": "🤝",
		"quote": "동맹은 오래갈 때만 동맹이오."
	},
	{
		"id": "rf_zhanglu",
		"name": "선치",
		"era": "삼국지",
		"faction": "군웅",
		"rarity": 3,
		"trait": "wisdom",
		"stats": {
			"might": 50,
			"wisdom": 78,
			"command": 74
		},
		"hanja": "仙治",
		"emoji": "☯️",
		"quote": "오두미(五斗米)면 병도 고치고 나라도 다스리오."
	},
	{
		"id": "rf_yangren",
		"name": "산로",
		"era": "삼국지",
		"faction": "군웅",
		"rarity": 2,
		"trait": "might",
		"stats": {
			"might": 76,
			"wisdom": 52,
			"command": 70
		},
		"hanja": "山路",
		"emoji": "⛰️",
		"quote": "한중의 산길은 제가 압니다."
	},
	{
		"id": "rf_yangsong",
		"name": "금문",
		"era": "삼국지",
		"faction": "군웅",
		"rarity": 1,
		"trait": "wisdom",
		"stats": {
			"might": 20,
			"wisdom": 62,
			"command": 30
		},
		"hanja": "金門",
		"emoji": "💰",
		"quote": "금이면 열리지 않는 문이 없지요."
	},
	{
		"id": "rf_liuzhang",
		"name": "안민",
		"era": "삼국지",
		"faction": "군웅",
		"rarity": 2,
		"trait": "wisdom",
		"stats": {
			"might": 30,
			"wisdom": 62,
			"command": 55
		},
		"hanja": "安民",
		"emoji": "🍚",
		"quote": "백성을 싸움에 몰아넣고 싶지 않소."
	},
	{
		"id": "rf_zhangren",
		"name": "충절",
		"era": "삼국지",
		"faction": "군웅",
		"rarity": 4,
		"trait": "command",
		"stats": {
			"might": 87,
			"wisdom": 74,
			"command": 88
		},
		"hanja": "忠節",
		"emoji": "🏹",
		"quote": "충신은 두 주인을 섬기지 않소."
	},
	{
		"id": "rf_yanyan",
		"name": "불항",
		"era": "삼국지",
		"faction": "군웅",
		"rarity": 4,
		"trait": "might",
		"stats": {
			"might": 86,
			"wisdom": 68,
			"command": 84
		},
		"hanja": "不降",
		"emoji": "🧓",
		"quote": "목을 벨 장수는 있어도 항복할 장수는 없다."
	},
	{
		"id": "rf_fazheng",
		"name": "촉로",
		"era": "삼국지",
		"faction": "군웅",
		"rarity": 5,
		"trait": "wisdom",
		"stats": {
			"might": 42,
			"wisdom": 95,
			"command": 76
		},
		"hanja": "蜀路",
		"emoji": "🗺️",
		"quote": "촉으로 드는 길을 그려 드리지요."
	},
	{
		"id": "rf_wuyi",
		"name": "익병",
		"era": "삼국지",
		"faction": "군웅",
		"rarity": 3,
		"trait": "command",
		"stats": {
			"might": 80,
			"wisdom": 66,
			"command": 82
		},
		"hanja": "益兵",
		"emoji": "⚖️",
		"quote": "익주의 병사는 아직 쓸 만합니다."
	},
	{
		"id": "rf_sunce",
		"name": "강모",
		"era": "삼국지",
		"faction": "오",
		"rarity": 5,
		"trait": "might",
		"stats": {
			"might": 93,
			"wisdom": 72,
			"command": 92
		},
		"hanja": "江牟",
		"emoji": "🐅",
		"quote": "강동은 젊은 손으로 여는 것이오."
	},
	{
		"id": "rf_chengpu",
		"name": "삼세",
		"era": "삼국지",
		"faction": "오",
		"rarity": 4,
		"trait": "command",
		"stats": {
			"might": 84,
			"wisdom": 72,
			"command": 88
		},
		"hanja": "三世",
		"emoji": "🔱",
		"quote": "삼대를 섬긴 늙은 신하올시다."
	},
	{
		"id": "rf_huanggai",
		"name": "화신",
		"era": "삼국지",
		"faction": "오",
		"rarity": 4,
		"trait": "command",
		"stats": {
			"might": 85,
			"wisdom": 68,
			"command": 86
		},
		"hanja": "火身",
		"emoji": "🔥",
		"quote": "이 늙은 몸을 태워서라도 이기겠소."
	},
	{
		"id": "rf_handang",
		"name": "주궁",
		"era": "삼국지",
		"faction": "오",
		"rarity": 3,
		"trait": "might",
		"stats": {
			"might": 83,
			"wisdom": 58,
			"command": 80
		},
		"hanja": "舟弓",
		"emoji": "🏹",
		"quote": "활이든 창이든 배 위에서라면 지지 않소."
	},
	{
		"id": "rf_zhoutai",
		"name": "다흔",
		"era": "삼국지",
		"faction": "오",
		"rarity": 4,
		"trait": "might",
		"stats": {
			"might": 89,
			"wisdom": 48,
			"command": 78
		},
		"hanja": "多痕",
		"emoji": "🩸",
		"quote": "이 흉터 하나하나가 주공을 지킨 자립니다."
	},
]
