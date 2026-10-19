extends RefCounted

## saga_core — GO PLAN.md 51장 확장 축("월드 확장→탐험→지역→이벤트→
## 수집→희귀 몬스터")의 마지막 항목. `characters.gd`(HEROES)와 같은
## 경계 — 다섯 판이 공유할 수 있는 자리에 saga_core로 둔다(웹판 다섯
## data.js 전부에 PETS가 있다, `saga-web/saga-dungeon`·`saga-forest`·
## `saga-story`·`saga-realm`은 md5로 동일하지만 `saga-go`만 2026-09-09
## GLB 자산 확장으로 64종까지 늘어 다르다 — 이 파일은 saga-go 쪽
## 목록에서 옮긴다).
##
## **id·수치는 원작(`saga-web/saga-go/js/data.js` PETS) 그대로** — 가명
## 정책은 "실존 역사 인물"(HEROES)에만 해당하고, 이 11종은 삼족오·해태
## 등 한국 설화 속 신수라 정책 대상이 아니다(새 이름을 짓지 않았다).
##
## **2026-09-14, GO 51장 "희귀 몬스터" 첫 걸음 — 신수(divine) 11종 전부.**
## 웹판 PETS은 신수 11 + 동물 50여 종(동물은 이미 animal_builder.gd가
## 관찰용 beast 넷으로 옮겨 뒀다, 새 시스템이 아니다)로 나뉜다. "희귀
## 몬스터"라는 51장 문구에 가장 정직하게 들어맞는 건 rarity 4~5뿐인
## 신수 쪽이라 그것부터 전부 옮겼다(동물 쪽 catchBase가 낮은 개체들은
## 다음 몫).
##
## `bonus`(stat/value) 필드는 원작 그대로 갖고 있지만 **이 슬라이스는
## 아직 안 쓴다** — party_state.gd에 might/wisdom/command/virtue 같은
## 결별 스탯 자체가 없다(§15 "무기+장비+기본 옵션까지만" 원칙과 같은
## 이유로 이번 슬라이스가 안 만든 시스템). 포획 보상은 다른 사건들과
## 같은 채널(CodexState "pet" 갈래 → PartyState.add_exp)로 대신한다 —
## 새 보상 경로를 안 만들고 기존 것을 재사용했다. `bonus`는 값을 버리지
## 않기 위해서만 들고 있는다(나중에 스탯 시스템이 생기면 그때 쓴다).

## G-0230 `temper` — 들켰을 때: "timid" 달아나 사라짐 · "fierce" 덤빔(pet_encounter.gd). 웹 stealth.js 는
## "신수·희귀 4 이상 = 사나움" 한 줄이라 열하나가 다 사나워진다 → 날짐승·여우·말은 겁 많은 쪽으로 갈랐다.
const PETS := [
	{"id": "pt_samjogo", "temper": "timid", "name": "삼족오", "kind": "divine", "rarity": 5, "emoji": "🐦‍⬛",
		"catch_base": 0.24, "bonus": {"stat": "wisdom", "value": 12},
		"desc": "고구려 벽화의 세 발 까마귀. 해를 품고 난다."},
	{"id": "pt_haetae", "temper": "fierce", "name": "해태", "kind": "divine", "rarity": 5, "emoji": "🦁",
		"catch_base": 0.24, "bonus": {"stat": "command", "value": 12},
		"desc": "시비와 선악을 가리는 상상의 짐승."},
	{"id": "pt_cheongryong", "temper": "fierce", "name": "청룡", "kind": "divine", "rarity": 5, "emoji": "🐉",
		"catch_base": 0.20, "bonus": {"stat": "might", "value": 14},
		"desc": "동방을 지키는 사신(四神)."},
	{"id": "pt_baekho", "temper": "fierce", "name": "백호", "kind": "divine", "rarity": 5, "emoji": "🐅",
		"catch_base": 0.20, "bonus": {"stat": "might", "value": 13},
		"desc": "서방을 지키는 흰 범."},
	{"id": "pt_jujak", "temper": "fierce", "name": "주작", "kind": "divine", "rarity": 5, "emoji": "🔥",
		"catch_base": 0.20, "bonus": {"stat": "wisdom", "value": 13},
		"desc": "남방을 지키는 붉은 새."},
	{"id": "pt_hyeonmu", "temper": "fierce", "name": "현무", "kind": "divine", "rarity": 5, "emoji": "🐢",
		"catch_base": 0.20, "bonus": {"stat": "command", "value": 13},
		"desc": "북방을 지키는 거북과 뱀."},
	{"id": "pt_gumiho", "temper": "timid", "name": "구미호", "kind": "divine", "rarity": 4, "emoji": "🦊",
		"catch_base": 0.30, "bonus": {"stat": "wisdom", "value": 9},
		"desc": "꼬리 아홉의 여우. 사람 말을 알아듣는다."},
	{"id": "pt_dokkaebi", "temper": "fierce", "name": "도깨비", "kind": "divine", "rarity": 4, "emoji": "👹",
		"catch_base": 0.32, "bonus": {"stat": "might", "value": 9},
		"desc": "방망이 하나로 뭐든 만들어낸다."},
	{"id": "pt_bulgasari", "temper": "fierce", "name": "불가사리", "kind": "divine", "rarity": 4, "emoji": "🐻‍❄️",
		"catch_base": 0.30, "bonus": {"stat": "command", "value": 9},
		"desc": "쇠를 먹고 자라는 짐승."},
	{"id": "pt_jeoktoma", "temper": "timid", "name": "홍염마", "kind": "divine", "rarity": 5, "emoji": "🐴",
		"catch_base": 0.22, "bonus": {"stat": "might", "value": 11},
		"desc": "하루에 천 리를 달린다는 전설의 명마."},
	{"id": "pt_jeolyeong", "temper": "timid", "name": "섬영마", "kind": "divine", "rarity": 4, "emoji": "🐎",
		"catch_base": 0.30, "bonus": {"stat": "command", "value": 8},
		"desc": "위기에 빠진 주인을 태우고 홀로 달아났다는 준마."},
]


static func find(id: String) -> Variant:
	for p in PETS:
		if p.id == id:
			return p
	return null
