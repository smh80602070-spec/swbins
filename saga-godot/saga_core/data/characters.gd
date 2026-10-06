extends RefCounted

## saga_core — 다섯 판(GO/DUNGEON/FOREST/STORY/REALM 예정) Godot 포트가 공유하는
## 인물 데이터. LEGACY_FEATURE_AUDIT.md 6장 결정(2026-08-31) — id는 기존 다섯
## 웹 프로젝트(saga-go 등)의 js/data.js HEROES와 완전히 동일하게 유지한다(그
## 다섯 곳은 서로 md5로 동일함을 확인하며 유지되는 한 벌이라, 여기 옮긴 것도
## 그 한 벌에서 그대로 가져온 것 — 새 id 체계를 만들지 않았다).
##
## 2026-09-11 시점 105명(삼국지 22·한국사 26·일본사 20·세계사 37,
## 2026-09-12 rf_mizhu·rf_jianyong 추가로 107명·삼국지 24,
## 2026-09-13 rf_chengong·rf_gaoshun 추가로 109명·삼국지 26). REALM
## 전용 무장(js/data-force.js, 130명+)은 이번에 포함하지 않았다 — LEGACY_
## FEATURE_AUDIT.md는 REALM 것도 통합하기로 했지만, REALM Godot 포트는
## 39장 순서상(Core→Vertical Slice→GO→DUNGEON→FOREST→STORY→REALM) 아직
## 멀었고 그때까지 REALM 쪽 웹판 데이터가 계속 바뀔 수 있어, 지금 당장
## 쓰는 GO부터 먼저 옮기고 REALM은 그 차례가 왔을 때 다시 최신본을 옮기는
## 쪽이 낫다고 판단했다(추측성 선작업 방지). id·이름 정책(가명, 루트
## CLAUDE.md "이름 정책")은 원본에서 이미 지켜진 상태 그대로 옮겼다 —
## name·hanja만 가명, BIOS(열전)는 옮기지 않았다(정책 미준수 상태라 그대로
## 들고 오면 saga_core에도 같은 문제가 생긴다 — 옮기지 않는 것이 맞다).
##
## **2026-09-12 추가 — rf_mizhu·rf_jianyong(사용자 승인, 소패 수비
## 완전화 목적)만 예외로 앞당겨 옮겼다.** 나머지 REALM 무장 130명+은
## 여전히 REALM 차례(위 이유)까지 안 옮긴다. **주의 — 이 둘의 원본
## (js/data-force.js)은 name·hanja가 가명화가 안 된 실명(미축/麋竺·
## 간옹/簡雍) 상태다** — 105명과 달리 "원본에서 이미 지켜진 상태를
## 그대로 옮긴" 것이 아니라, **이 파일에서 처음으로 가명(창윤/倉潤·
## 언유/言柔)을 새로 지어 넣었다.** era·faction·rarity·trait·stats·
## emoji·quote는 원본 그대로(quote는 이름을 드러내지 않아 정책에 안
## 걸린다). 나중에 REALM 무장 전체를 옮길 때 이 둘도 다시 마주칠 텐데,
## 그때 다른 이름으로 또 바뀌지 않도록 이 가명을 그대로 이어 쓸 것.
##
## **2026-09-13 추가 — rf_chengong·rf_gaoshun(같은 이유, 하비/여포군
## 성 추가 목적).** 원본(진궁/陳宮·고순/高順) 역시 가명화가 안 된
## 실명 상태였다 — 이번에 새로 가명을 지었다: 진궁→**현모(玄謀)**,
## 고순→**진위(陣威)**. faction은 위/오/촉 어디에도 안 속하는 여포
## 세력이라 이미 있던 "군웅"(원소·원술 등이 쓰던 값)을 그대로 썼다.
## era·rarity·trait·stats·emoji·quote는 원본 그대로(고순 quote의
## "함진영"은 부대 이름이지 인물 실명이 아니라 정책에 안 걸린다).
##
## **2026-09-14 추가 — REALM "전체 107개 성" 확장(사용자 지시 "다해
## 순서대로"/"묻지말고 최대한해")으로 삼국지 나머지 9개 세력의 무장 40명을
## 한 번에 들였다(109명→149명, 삼국지 26→66).** 원소·공손찬·공융·원술·
## 유표·이각·마등·장로·유장군 소속(`js/data-force.js` FORCES_194 그대로).
## 전부 이번에 처음 가명을 지었다(원본은 전부 실명 상태). name·hanja만
## 새로 지었고 era/rarity/trait/stats/emoji/quote는 원본 그대로(quote는
## 이름을 직접 안 드러내 정책에 안 걸린다). **faction — 위/오/촉 어느
## 정사(定史) 세력에도 정식으로 안 속한 채 끝난 사람은 "군웅"(원소·
## 공손찬·공융·원술·유표(형주)·이각·장로·유장 소속 대부분)을 그대로
## 썼다.** 예외 — `data-force.js`의 200/208년 표까지 대조해 실제로 다른
## 세력에 편입되는 게 확인된 사람만 그 세력으로: 장합·채모·괴량·문빙·
## 가후(FORCES_208에서 조조군 소속으로 재등장) → "위", 마등·방덕·한수
## (마초의 세력에 계속 묶여 있고 마초 본인은 이미 "촉"으로 가명화돼
## 있다) → "촉", 손책·정보·황개·한당·주태(손책→손권으로 이어지는 오의
## 창업 무리, `ce`→`quan` 세력이 세 시나리오 내내 이들을 그대로 간다)
## → "오". **황조(黃祖)만 예외적으로 "군웅"** — 강하에서 전사해(원작
## 그대로) 어느 표에도 재등장하지 않는다.
##
## **2026-09-14 추가(같은 날 이어서) — "전체 107개 성" 나머지 77개
## (한국·일본·교주·서역·남중·천축·막북·임읍·균열·폐허·묘역, 사용자 지시
## "77개 마저 이어해")의 수비 무장 99명.** `js/data-force.js`의
## `KOREA_OFFICERS`~`TOMB_OFFICERS` 11개 표 그대로 — **이 사람들은
## 가명을 새로 지을 필요가 없었다.** 원본부터 `era`가 전부 "OO(가상)"
## 이고 실존 인물이 아닌 지어낸 이름이라(예: kr2_pasodan/파소단, fu_
## seonghon/성혼) 원작 이름 정책 문제가 없다 — name·hanja를 원본 그대로
## 옮겼다. `faction` 필드는 위/오/촉이 아니라 **그 무장이 지키는 성의
## 이름**(원본 관례 그대로, 예: kr2_pasodan의 faction은 "양평"). 원본의
## `boss: true`(원본은 천축·막북·임읍·균열·폐허·묘역 여섯 지역 허브
## 하나씩 — 이 머리말이 처음 적혔을 때 천축을 빠뜨렸었다, 2026-09-14
## "보스전 보상" 절에서 바로잡음)와 `monster`(균열·폐허·묘역, `asset3d.js`
## 가 읽는 실제 3D 모델 경로)는 이 스키마에 없는 필드라 그때는 옮기지
## 않았다.
##
## **2026-09-14 추가 — 보스전 보상.** `boss: true` 여섯 개(tz_beonwang·
## mb_seonwoo·ly_jeonchung·fu_jongwang·ru_geohae·tb_baekgi)를 원본
## 그대로 얹었다 — `realm_save_state.gd attack()`이 함락 직전 수비
## 명단에서 이 값을 읽어 보스 보너스(금+유물)를 준다. `monster`(3D 모델
## 경로)는 여전히 안 옮겼다 — REALM에 3D 몬스터 렌더링 자체가 아직
## 없어서다(다음 자리).
##
## 필드: id(불변 고유키) · name(표시 이름, 가명) · era(시대 그룹) ·
## faction(세력) · rarity(1~5) · trait(might/wisdom/virtue, 설득 어필 방향) ·
## stats(might/wisdom/command) · hanja(표시용 가명 한자) · emoji · quote(대사).
##
## find(id)로 하나 찾는다 — 없으면 null.

const HEROES := [
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
	}
]


static func find(id: String) -> Variant:
	for h in HEROES:
		if h.id == id:
			return h
	return null
