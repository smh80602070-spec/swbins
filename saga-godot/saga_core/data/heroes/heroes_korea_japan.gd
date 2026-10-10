extends RefCounted

## characters.gd HEROES 의 한 조각 — 한국사·일본사 46명(R-4 10-10 주제별로 나눔, 순서·내용 그대로).
## 필드·이름 정책은 characters.gd 머리말. 고칠 때는 이 파일을 고친다.

const LIST := [
	{
		"id": "kr_yisunsin",
		"name": "해장",
		"era": "한국사",
		"faction": "조선",
		"rarity": 5,
		"trait": "virtue",
		"stats": {
			"might": 92,
			"wisdom": 98,
			"command": 100
		},
		"hanja": "海將",
		"emoji": "🚢",
		"quote": "아직 신에게는 열두 척의 배가 남아 있사옵니다."
	},
	{
		"id": "kr_euljimundeok",
		"name": "현묘",
		"era": "한국사",
		"faction": "고구려",
		"rarity": 5,
		"trait": "wisdom",
		"stats": {
			"might": 88,
			"wisdom": 97,
			"command": 98
		},
		"hanja": "玄妙",
		"emoji": "🌊",
		"quote": "만족함을 알고 그만두기를 권하노라."
	},
	{
		"id": "kr_ganggamchan",
		"name": "강우",
		"era": "한국사",
		"faction": "고려",
		"rarity": 5,
		"trait": "wisdom",
		"stats": {
			"might": 80,
			"wisdom": 96,
			"command": 97
		},
		"hanja": "江雨",
		"emoji": "⛰️",
		"quote": "강물을 터뜨릴 준비는 끝났소."
	},
	{
		"id": "kr_kimyusin",
		"name": "화랑준",
		"era": "한국사",
		"faction": "신라",
		"rarity": 5,
		"trait": "might",
		"stats": {
			"might": 95,
			"wisdom": 88,
			"command": 96
		},
		"hanja": "花郞俊",
		"emoji": "🗡️",
		"quote": "삼한을 하나로 잇겠소."
	},
	{
		"id": "kr_gyebaek",
		"name": "결사",
		"era": "한국사",
		"faction": "백제",
		"rarity": 4,
		"trait": "might",
		"stats": {
			"might": 94,
			"wisdom": 70,
			"command": 90
		},
		"hanja": "決死",
		"emoji": "🛡️",
		"quote": "오천으로 오만을 맞겠다."
	},
	{
		"id": "kr_yeongaesomun",
		"name": "철령",
		"era": "한국사",
		"faction": "고구려",
		"rarity": 5,
		"trait": "might",
		"stats": {
			"might": 96,
			"wisdom": 82,
			"command": 95
		},
		"hanja": "鐵嶺",
		"emoji": "🪓",
		"quote": "요동의 성벽은 무너지지 않는다."
	},
	{
		"id": "kr_gwanggaeto",
		"name": "정복왕",
		"era": "한국사",
		"faction": "고구려",
		"rarity": 5,
		"trait": "might",
		"stats": {
			"might": 97,
			"wisdom": 85,
			"command": 99
		},
		"hanja": "征服王",
		"emoji": "🏇",
		"quote": "북으로, 더 북으로 나아가자."
	},
	{
		"id": "kr_sejong",
		"name": "훈민",
		"era": "한국사",
		"faction": "조선",
		"rarity": 5,
		"trait": "wisdom",
		"stats": {
			"might": 40,
			"wisdom": 100,
			"command": 95
		},
		"hanja": "訓民",
		"emoji": "📖",
		"quote": "백성이 쉽게 익혀 날로 쓰게 하고자 함이라."
	},
	{
		"id": "kr_jangyeongsil",
		"name": "성시",
		"era": "한국사",
		"faction": "조선",
		"rarity": 4,
		"trait": "wisdom",
		"stats": {
			"might": 25,
			"wisdom": 97,
			"command": 45
		},
		"hanja": "星時",
		"emoji": "⏱️",
		"quote": "해 그림자로 시간을 재어 보이겠습니다."
	},
	{
		"id": "kr_choemuseon",
		"name": "화포공",
		"era": "한국사",
		"faction": "고려",
		"rarity": 4,
		"trait": "wisdom",
		"stats": {
			"might": 55,
			"wisdom": 94,
			"command": 70
		},
		"hanja": "火砲工",
		"emoji": "🧨",
		"quote": "화약이라면 제게 맡기시지요."
	},
	{
		"id": "kr_daejoyeong",
		"name": "요동패",
		"era": "한국사",
		"faction": "발해",
		"rarity": 5,
		"trait": "command",
		"stats": {
			"might": 90,
			"wisdom": 88,
			"command": 96
		},
		"hanja": "遼東覇",
		"emoji": "🌅",
		"quote": "고구려의 뒤를 잇겠소."
	},
	{
		"id": "kr_wanggeon",
		"name": "통합공",
		"era": "한국사",
		"faction": "고려",
		"rarity": 5,
		"trait": "virtue",
		"stats": {
			"might": 82,
			"wisdom": 88,
			"command": 94
		},
		"hanja": "統合公",
		"emoji": "👑",
		"quote": "흩어진 것을 다시 모으는 일이오."
	},
	{
		"id": "kr_jeongyakyong",
		"name": "만기",
		"era": "한국사",
		"faction": "조선",
		"rarity": 4,
		"trait": "wisdom",
		"stats": {
			"might": 20,
			"wisdom": 98,
			"command": 60
		},
		"hanja": "萬機",
		"emoji": "🏗️",
		"quote": "거중기로 백성의 짐을 덜겠습니다."
	},
	{
		"id": "kr_heojun",
		"name": "활인",
		"era": "한국사",
		"faction": "조선",
		"rarity": 4,
		"trait": "virtue",
		"stats": {
			"might": 15,
			"wisdom": 95,
			"command": 40
		},
		"hanja": "活人",
		"emoji": "🌿",
		"quote": "병 앞에 귀천이 어디 있겠습니까."
	},
	{
		"id": "kr_sinsaimdang",
		"name": "초충당",
		"era": "한국사",
		"faction": "조선",
		"rarity": 4,
		"trait": "virtue",
		"stats": {
			"might": 12,
			"wisdom": 92,
			"command": 55
		},
		"hanja": "草蟲堂",
		"emoji": "🎨",
		"quote": "붓끝에 마음을 담을 뿐입니다."
	},
	{
		"id": "kr_ahnjunggeun",
		"name": "동양평",
		"era": "한국사",
		"faction": "대한제국",
		"rarity": 5,
		"trait": "virtue",
		"stats": {
			"might": 88,
			"wisdom": 90,
			"command": 85
		},
		"hanja": "東洋平",
		"emoji": "🕊️",
		"quote": "하루라도 글을 읽지 않으면 입에 가시가 돋는다."
	},
	{
		"id": "kr_yugwansun",
		"name": "소녀화",
		"era": "한국사",
		"faction": "일제강점기",
		"rarity": 5,
		"trait": "virtue",
		"stats": {
			"might": 60,
			"wisdom": 80,
			"command": 88
		},
		"hanja": "少女花",
		"emoji": "🔔",
		"quote": "나라에 바칠 목숨이 하나뿐인 것이 슬플 따름입니다."
	},
	{
		"id": "kr_kimgu",
		"name": "자강",
		"era": "한국사",
		"faction": "일제강점기",
		"rarity": 5,
		"trait": "virtue",
		"stats": {
			"might": 70,
			"wisdom": 92,
			"command": 94
		},
		"hanja": "自强",
		"emoji": "🇰🇷",
		"quote": "나의 소원은 오직 완전한 자주독립이오."
	},
	{
		"id": "kr_wonhyo",
		"name": "각원",
		"era": "한국사",
		"faction": "신라",
		"rarity": 4,
		"trait": "wisdom",
		"stats": {
			"might": 30,
			"wisdom": 96,
			"command": 50
		},
		"hanja": "覺圓",
		"emoji": "🌸",
		"quote": "모든 것은 마음이 짓는 것이오."
	},
	{
		"id": "kr_kimjeongho",
		"name": "방각",
		"era": "한국사",
		"faction": "조선",
		"rarity": 4,
		"trait": "wisdom",
		"stats": {
			"might": 35,
			"wisdom": 93,
			"command": 40
		},
		"hanja": "方刻",
		"emoji": "🗺️",
		"quote": "이 땅을 한 장에 담아보겠습니다."
	},
	{
		"id": "kr_gwakjaeu",
		"name": "초모의",
		"era": "한국사",
		"faction": "조선",
		"rarity": 4,
		"trait": "might",
		"stats": {
			"might": 89,
			"wisdom": 80,
			"command": 88
		},
		"hanja": "草募義",
		"emoji": "🔴",
		"quote": "홍의(紅衣)를 보면 왜적이 달아난다 하더이다."
	},
	{
		"id": "kr_nongae",
		"name": "화영",
		"era": "한국사",
		"faction": "조선",
		"rarity": 4,
		"trait": "virtue",
		"stats": {
			"might": 55,
			"wisdom": 70,
			"command": 50
		},
		"hanja": "花影",
		"emoji": "🌸",
		"quote": "남강의 물결을 기억해 주십시오."
	},
	{
		"id": "kr_yihwang",
		"name": "경헌",
		"era": "한국사",
		"faction": "조선",
		"rarity": 3,
		"trait": "wisdom",
		"stats": {
			"might": 15,
			"wisdom": 95,
			"command": 55
		},
		"hanja": "敬軒",
		"emoji": "📚",
		"quote": "경(敬)으로써 마음을 바로 합니다."
	},
	{
		"id": "kr_yii",
		"name": "문형",
		"era": "한국사",
		"faction": "조선",
		"rarity": 3,
		"trait": "wisdom",
		"stats": {
			"might": 20,
			"wisdom": 96,
			"command": 65
		},
		"hanja": "文衡",
		"emoji": "✒️",
		"quote": "십만 양병이 늦지 않았기를 바랍니다."
	},
	{
		"id": "kr_hwanghui",
		"name": "균형공",
		"era": "한국사",
		"faction": "조선",
		"rarity": 3,
		"trait": "virtue",
		"stats": {
			"might": 18,
			"wisdom": 90,
			"command": 75
		},
		"hanja": "均衡公",
		"emoji": "⚖️",
		"quote": "네 말도 옳고, 네 말도 옳다."
	},
	{
		"id": "kr_jeongmongju",
		"name": "청죽",
		"era": "한국사",
		"faction": "고려",
		"rarity": 4,
		"trait": "virtue",
		"stats": {
			"might": 35,
			"wisdom": 93,
			"command": 68
		},
		"hanja": "靑竹",
		"emoji": "🌉",
		"quote": "일백 번 고쳐 죽어도 마음은 하나입니다."
	},
	{
		"id": "jp_himiko",
		"name": "여왕영",
		"era": "일본사",
		"faction": "야마타이",
		"rarity": 5,
		"trait": "wisdom",
		"stats": {
			"might": 20,
			"wisdom": 98,
			"command": 80
		},
		"hanja": "女王影",
		"emoji": "🔮",
		"quote": "귀도(鬼道)로 백성의 마음을 다스리오."
	},
	{
		"id": "jp_taira",
		"name": "평가주",
		"era": "일본사",
		"faction": "다이라가",
		"rarity": 4,
		"trait": "wisdom",
		"stats": {
			"might": 70,
			"wisdom": 80,
			"command": 92
		},
		"hanja": "平家主",
		"emoji": "⚓",
		"quote": "헤이케(平家) 아니면 사람이 아니다."
	},
	{
		"id": "jp_yoritomo",
		"name": "막부조",
		"era": "일본사",
		"faction": "가마쿠라막부",
		"rarity": 5,
		"trait": "wisdom",
		"stats": {
			"might": 65,
			"wisdom": 90,
			"command": 97
		},
		"hanja": "幕府祖",
		"emoji": "🏯",
		"quote": "무사의 세상을 열겠다."
	},
	{
		"id": "jp_yoshitsune",
		"name": "비장군",
		"era": "일본사",
		"faction": "겐지가",
		"rarity": 5,
		"trait": "might",
		"stats": {
			"might": 95,
			"wisdom": 80,
			"command": 88
		},
		"hanja": "悲將軍",
		"emoji": "⚔️",
		"quote": "형의 그늘 아래서도 활은 빗나가지 않았다."
	},
	{
		"id": "jp_murasaki",
		"name": "원씨필",
		"era": "일본사",
		"faction": "헤이안",
		"rarity": 4,
		"trait": "wisdom",
		"stats": {
			"might": 10,
			"wisdom": 99,
			"command": 40
		},
		"hanja": "源氏筆",
		"emoji": "🖋️",
		"quote": "덧없는 세상, 이야기로 남기겠소."
	},
	{
		"id": "jp_seishonagon",
		"name": "침초필",
		"era": "일본사",
		"faction": "헤이안",
		"rarity": 3,
		"trait": "wisdom",
		"stats": {
			"might": 8,
			"wisdom": 96,
			"command": 35
		},
		"hanja": "枕草筆",
		"emoji": "📝",
		"quote": "봄은 새벽이 가장 좋습니다."
	},
	{
		"id": "jp_tomoegozen",
		"name": "여무연",
		"era": "일본사",
		"faction": "겐지가",
		"rarity": 4,
		"trait": "might",
		"stats": {
			"might": 90,
			"wisdom": 60,
			"command": 78
		},
		"hanja": "女武蓮",
		"emoji": "🗡️",
		"quote": "여인이라 활을 못 당길 이유가 없소."
	},
	{
		"id": "jp_nobunaga",
		"name": "화천마",
		"era": "일본사",
		"faction": "오다가",
		"rarity": 5,
		"trait": "might",
		"stats": {
			"might": 88,
			"wisdom": 90,
			"command": 97
		},
		"hanja": "火天魔",
		"emoji": "🔥",
		"quote": "울지 않는 새는 베어버린다."
	},
	{
		"id": "jp_hideyoshi",
		"name": "태합원",
		"era": "일본사",
		"faction": "도요토미가",
		"rarity": 5,
		"trait": "wisdom",
		"stats": {
			"might": 60,
			"wisdom": 96,
			"command": 96
		},
		"hanja": "太閤猿",
		"emoji": "🐒",
		"quote": "천하는 재주로도 쥘 수 있소."
	},
	{
		"id": "jp_ieyasu",
		"name": "인내옹",
		"era": "일본사",
		"faction": "도쿠가와막부",
		"rarity": 5,
		"trait": "virtue",
		"stats": {
			"might": 70,
			"wisdom": 94,
			"command": 98
		},
		"hanja": "忍耐翁",
		"emoji": "🐢",
		"quote": "두견새는 울 때까지 기다리면 되오."
	},
	{
		"id": "jp_shingen",
		"name": "풍림화",
		"era": "일본사",
		"faction": "다케다가",
		"rarity": 5,
		"trait": "might",
		"stats": {
			"might": 90,
			"wisdom": 88,
			"command": 95
		},
		"hanja": "風林火",
		"emoji": "⛰️",
		"quote": "바람처럼 빠르고 숲처럼 고요하게."
	},
	{
		"id": "jp_kenshin",
		"name": "군신아",
		"era": "일본사",
		"faction": "우에스기가",
		"rarity": 5,
		"trait": "virtue",
		"stats": {
			"might": 93,
			"wisdom": 85,
			"command": 94
		},
		"hanja": "軍神牙",
		"emoji": "❄️",
		"quote": "적에게 소금을 보내지 않을 이유가 없소."
	},
	{
		"id": "jp_masamune",
		"name": "독안룡",
		"era": "일본사",
		"faction": "다테가",
		"rarity": 4,
		"trait": "might",
		"stats": {
			"might": 91,
			"wisdom": 82,
			"command": 90
		},
		"hanja": "獨眼龍",
		"emoji": "🐉",
		"quote": "한쪽 눈으로도 천하는 다 보인다."
	},
	{
		"id": "jp_yukimura",
		"name": "일번창",
		"era": "일본사",
		"faction": "사나다가",
		"rarity": 5,
		"trait": "might",
		"stats": {
			"might": 96,
			"wisdom": 75,
			"command": 89
		},
		"hanja": "日番槍",
		"emoji": "🔴",
		"quote": "오사카의 마지막 창은 내가 쥐겠소."
	},
	{
		"id": "jp_musashi",
		"name": "이도인",
		"era": "일본사",
		"faction": "낭인",
		"rarity": 4,
		"trait": "might",
		"stats": {
			"might": 97,
			"wisdom": 70,
			"command": 60
		},
		"hanja": "二刀人",
		"emoji": "🗡️",
		"quote": "천 일의 연습, 만 일의 단련."
	},
	{
		"id": "jp_hanzo",
		"name": "암영조",
		"era": "일본사",
		"faction": "이가",
		"rarity": 4,
		"trait": "wisdom",
		"stats": {
			"might": 75,
			"wisdom": 88,
			"command": 65
		},
		"hanja": "暗影祖",
		"emoji": "🗡️",
		"quote": "그림자는 소리를 남기지 않는다."
	},
	{
		"id": "jp_mitsukuni",
		"name": "천하부",
		"era": "일본사",
		"faction": "도쿠가와막부",
		"rarity": 3,
		"trait": "wisdom",
		"stats": {
			"might": 30,
			"wisdom": 92,
			"command": 75
		},
		"hanja": "天下副",
		"emoji": "📖",
		"quote": "이 나라의 역사를 편찬하겠소."
	},
	{
		"id": "jp_naosuke",
		"name": "개항로",
		"era": "일본사",
		"faction": "도쿠가와막부",
		"rarity": 3,
		"trait": "wisdom",
		"stats": {
			"might": 25,
			"wisdom": 90,
			"command": 80
		},
		"hanja": "開港老",
		"emoji": "⚓",
		"quote": "문을 여는 것도 나라를 지키는 길이오."
	},
	{
		"id": "jp_saigo",
		"name": "최후향",
		"era": "일본사",
		"faction": "메이지유신",
		"rarity": 5,
		"trait": "virtue",
		"stats": {
			"might": 85,
			"wisdom": 80,
			"command": 92
		},
		"hanja": "最後鄕",
		"emoji": "🐕",
		"quote": "경천애인(敬天愛人), 하늘을 공경하고 사람을 사랑하라."
	},
	{
		"id": "jp_ryoma",
		"name": "해원랑",
		"era": "일본사",
		"faction": "메이지유신",
		"rarity": 4,
		"trait": "wisdom",
		"stats": {
			"might": 55,
			"wisdom": 92,
			"command": 85
		},
		"hanja": "海援郞",
		"emoji": "⛵",
		"quote": "세상을 다시 씻어내야 하오."
	},
]
