extends RefCounted

## PLAN 106장 ㉔ — 인물별 고유 스킬(원신은 인물마다 E·Q 가 다르다). 표만 — 쓰는 곳은 combat/field_combat.gd `_kit_skill`·`_kit_burst`.
## 고유(KITS) 대표 다섯: 주인공 · 마을·폐허에 서 있는 역사 인물 셋(현책·해장·결사) · 도적 두목(습격 사건 등용).
##   + 106장 ㉛ 이야기로 만나는 동료 둘(data/story.gd MEMBERS — 학자 은비 2장·가면 쓴 나그네 5장 보상).
##   + 106장 ㉟ 둘 더(촌장 누리 6장·늙은 사공 버들 7장 보상) — 치유(누리)·협동 공격(버들), 명단에 없던 역할.
##   + 106장 ㊳ 해솔(9장 보상, ★5 뇌·양손검) — 있는 틀(shells·infuse)로, 벼락 셋 + 뇌 부여.
##   + 106장 ㊺-4 하람(12장 보상, ★4 화·활) — 있는 틀(zone·rally)로, 발밑 관측기가 신호탄을 쏘고 폭발은 맑음 예보(명단 공격 +).
##   + 106장 ㊼-3 달음(15장 보상, ★4 암·장병기) — 있는 틀(dash·guard)로, 말 달리듯 돌진하고 폭발은 마패 호령(명단 받는 피해 -).
##   + 106장 ㊽-4 도담(18장 보상, ★4 뇌·양손검) — 있는 틀(wave·haste)로, 선로 따라 전류를 곧게 흘리고 폭발은 막차 출발 신호(명단 스킬 재사용 두 배).
##   + 106장 ㊾-3 한별(20장 보상, ★5 풍·활) — 있는 틀(updraft·vortex)로, 별배 견인줄로 둘레 적을 끌어 솟구치고(활공·낙하로 잇는다) 폭발은 틈 닫기 소용돌이.
##   + 106장 ㊿-4 물새(23장 보상, ★4 수·한손검) — 있는 틀(blink·feast)로, 자맥질하듯 적 뒤로 파고들어 표식을 남기고 폭발은 숨비소리 회복 자리.
## 그 밖의 도감 인물은 **갈래 스킬**(FAMILIES) — 인물 trait 가 틀(무용 돌격·통솔 호령·인덕 방패), 원소가 이름·덧붙는 것(ELEMENT_EXTRA).
##   사당 시련이 ★3~4 187명 중 아무나 주므로 몇 명만 손으로 짜면 거의 안 만난다 — 갈래×원소 21칸이면 명단 넷이 거의 안 겹친다.
##   지략(wisdom) 인물은 원소를 그대로 다루는 이들이라 지금처럼 원소마다 같은 스킬(field_combat 원소 표) — 이름·설명은 ELEMENT_NAMES·ELEMENT_TEXTS.
##   도감에 없는 id(점검용 등)도 원소 기본.
## 원소·무기는 그대로 id 해시(elements.gd·weapons.gd). 특성 배율·운명의 자리(1 스킬 쿨 -20%)는 고유 스킬에도 똑같이 든다.
##
## 스킬 type: dash(앞으로 돌진하며 지나간 길) · zone(발밑 진 — 인물을 바꿔도 남아 몇 초마다 가까운 적을 친다) ·
##   shells(앞 적 몇에 늦게 떨어지는 포탄) · guard(명단 보호막 + 둘레) · updraft(위로 솟구침 + 둘레 끌어올림 — 활공·낙하로 잇는다)
## 폭발 type(모두 먼저 둘레 radius 에 mul 한 번): infuse(그 인물 기본 공격에 원소 부여) · haste(명단 스킬 재사용이 두 배로 돎 + 다른 인물 기력) ·
##   rally(명단 공격 +) · guard(명단이 받는 피해 -) · vortex(앞 지점에 적을 빨아들이는 소용돌이)
## 106장 ㉛: 스킬 blink(가까운 적 뒤로 파고드는 돌진 + 표식 — 표식 난 적은 누구에게든 피해 +) ·
##   폭발 echo(표식 난 적마다 메아리 베기 몇 번) · lore(명단 원소 반응 피해 +)
## 106장 ㉟: 스킬 gust(앞 부채꼴을 치고 밀어냄 — heal 칸으로 명단 회복) · wave(앞으로 곧게 물결, 길 위 적을 앞으로 밀어냄) ·
##   폭발 feast(그 자리에 바람 자리 — tick 마다 안에 선 지금 인물 회복·안의 적 원소 피해) ·
##   rain(sec 동안 명단 누구든 기본·강·낙하 공격이 맞으면 every 초에 한 번 가까운 적 count 에 원소 따라 치기 — 협동 공격)
## 이름·수치는 이 판 것(원작 스킬 이름을 옮기지 않는다).

const Characters := preload("res://saga_core/data/characters.gd")
const Elements := preload("res://games/saga_go/combat/elements.gd")

const KITS := {
	"self": {
		"skill": {"name": "불꽃 돌진", "type": "dash", "cd": 6.0, "sec": 0.25, "speed": 18.0, "width": 2.0, "mul": 1.3,
			"text": "앞으로 4.5m 돌진하며 지나간 길의 적을 벤다(돌진 중 무적)"},
		"burst": {"name": "불새 깃", "type": "infuse", "radius": 6.0, "mul": 2.0, "sec": 8.0, "normal_mul": 1.2,
			"text": "둘레 6m 를 태우고, 8초 동안 기본 공격·강공격·낙하 공격이 화 원소(피해 ×1.2)"},
	},
	"sg_zhugeliang": {
		"skill": {"name": "팔괘진", "type": "zone", "cd": 12.0, "radius": 4.5, "sec": 10.0, "tick": 1.5, "targets": 2, "mul": 0.45, "energy": 2.0,
			"text": "발밑에 10초 진 — 1.5초마다 안의 가까운 적 둘에 낙뢰, 맞힐 때마다 명단 기력. 인물을 바꿔도 남는다"},
		"burst": {"name": "천기 뇌우", "type": "haste", "radius": 7.0, "mul": 1.4, "sec": 12.0, "energy": 15.0,
			"text": "둘레 7m 낙뢰, 12초 동안 명단 원소 스킬 재사용이 두 배로 돌고 다른 인물 기력 +15"},
	},
	"kr_yisunsin": {
		"skill": {"name": "일제 포격", "type": "shells", "cd": 7.0, "reach": 12.0, "count": 3, "delay": 0.6, "radius": 2.5, "mul": 1.0,
			"text": "12m 안 적 셋 자리에 0.6초 뒤 포탄(둘레 2.5m) — 적이 없으면 앞 8m 에 하나"},
		"burst": {"name": "학날개 진", "type": "rally", "radius": 8.0, "mul": 1.8, "sec": 10.0, "atk": 1.2,
			"text": "둘레 8m 포화, 10초 동안 명단 공격 +20%"},
	},
	"kr_gyebaek": {
		"skill": {"name": "결사 방진", "type": "guard", "cd": 12.0, "radius": 3.5, "mul": 0.8, "shield": 0.25, "sec": 12.0,
			"text": "둘레 3.5m 를 치고, 명단에 보호막(지금 인물 최대 체력 25%, 12초)"},
		"burst": {"name": "오천의 맹세", "type": "guard", "radius": 7.0, "mul": 1.6, "sec": 10.0, "taken": 0.7,
			"text": "둘레 7m 번개, 10초 동안 명단이 받는 피해 -30%"},
	},
	"story_scholar": {
		"skill": {"name": "비문 탁본", "type": "zone", "cd": 10.0, "radius": 4.5, "sec": 9.0, "tick": 1.5, "targets": 4, "mul": 0.35, "energy": 1.5,
			"text": "발밑에 9초 비문 — 1.5초마다 안의 적 넷까지 덩굴 글자를 새겨 초 원소를 붙인다(맞힐 때마다 명단 기력). 인물을 바꿔도 남는다"},
		"burst": {"name": "옛 글자 풀이", "type": "lore", "radius": 7.5, "mul": 1.3, "sec": 12.0, "react": 1.4,
			"text": "둘레 7.5m 를 치고, 12초 동안 명단의 원소 반응 피해 +40%"},
	},
	"story_wanderer": {
		"skill": {"name": "그림자 걸음", "type": "blink", "cd": 7.0, "reach": 10.0, "speed": 30.0, "behind": 1.5, "radius": 2.5, "mul": 1.5,
			"mark_sec": 8.0, "mark_mul": 1.25,
			"text": "10m 안 가까운 적 뒤로 파고들며 둘레 2.5m 를 벤다(무적) — 그 적에 8초 표식, 표식 난 적은 명단 누구에게든 피해 +25%"},
		"burst": {"name": "가면 벗기", "type": "echo", "radius": 6.0, "mul": 1.6, "reach": 15.0, "hits": 3, "tick": 0.3, "echo_mul": 0.7,
			"text": "둘레 6m 를 베고, 15m 안 표식 난 적마다 0.3초 간격 메아리 베기 셋(×0.7) — 표식 난 적이 없으면 가까운 적 둘에"},
	},
	"story_elder": {
		"skill": {"name": "부채 바람", "type": "gust", "cd": 8.0, "reach": 6.0, "arc": 0.2, "mul": 1.1, "push": 7.0, "heal": 0.06,
			"text": "앞 6m 부채꼴을 쳐 적을 밀어내고, 명단 모두 체력 6% 회복"},
		"burst": {"name": "잔칫날 순풍", "type": "feast", "radius": 6.0, "mul": 1.2, "sec": 10.0, "tick": 1.0, "heal": 0.05, "bolt": 0.25,
			"text": "둘레 6m 를 치고 10초 바람 자리 — 1초마다 안에 선 지금 인물 체력 5% 회복, 안의 적에 풍(×0.25)"},
	},
	"story_ferryman": {
		"skill": {"name": "노 물결", "type": "wave", "cd": 9.0, "length": 9.0, "width": 2.0, "mul": 1.4, "push": 6.0,
			"text": "앞으로 9m 곧게 물결 — 길 위 적을 치고 앞으로 밀어낸다(수 부착)"},
		"burst": {"name": "뱃노래", "type": "rain", "radius": 5.0, "mul": 1.1, "sec": 15.0, "every": 1.0, "count": 2, "reach": 8.0, "bolt": 0.4,
			"text": "둘레 5m 를 치고, 15초 동안 명단 누구든 기본·강·낙하 공격이 맞으면 1초에 한 번 8m 안 가까운 적 둘에 물 노(×0.4, 수)"},
	},
	"story_haesol": {
		"skill": {"name": "먹구름 벼락", "type": "shells", "cd": 8.0, "reach": 12.0, "count": 3, "delay": 0.5, "radius": 2.5, "mul": 1.1,
			"text": "12m 안 적 셋 자리에 0.5초 뒤 벼락(둘레 2.5m, 뇌) — 적이 없으면 앞 8m 에 하나"},
		"burst": {"name": "가면 없는 노래", "type": "infuse", "radius": 6.5, "mul": 2.2, "sec": 10.0, "normal_mul": 1.25,
			"text": "둘레 6.5m 를 내리치고, 10초 동안 기본 공격·강공격·낙하 공격이 뇌 원소(피해 ×1.25)"},
	},
	"story_haram": {
		"skill": {"name": "휴대 관측기", "type": "zone", "cd": 11.0, "radius": 5.0, "sec": 10.0, "tick": 1.2, "targets": 2, "mul": 0.4, "energy": 1.5,
			"text": "발밑에 10초 관측기 — 1.2초마다 5m 안 가까운 적 둘에 신호탄(화, 맞힐 때마다 명단 기력). 인물을 바꿔도 남는다"},
		"burst": {"name": "맑음 예보", "type": "rally", "radius": 7.0, "mul": 1.6, "sec": 12.0, "atk": 1.25,
			"text": "둘레 7m 에 신호탄 비, 12초 동안 명단 공격 +25%"},
	},
	"story_dareum": {
		"skill": {"name": "파발 질주", "type": "dash", "cd": 7.0, "sec": 0.3, "speed": 20.0, "width": 2.2, "mul": 1.4,
			"text": "말 달리듯 앞으로 6m 돌진 — 지나간 길의 적을 친다(암)"},
		"burst": {"name": "마패 호령", "type": "guard", "radius": 7.0, "mul": 1.8, "sec": 10.0, "taken": 0.75,
			"text": "둘레 7m 에 바위를 내리찍고, 10초 동안 명단이 받는 피해 -25%"},
	},
	"story_dodam": {
		"skill": {"name": "선로 전류", "type": "wave", "cd": 8.0, "length": 10.0, "width": 2.2, "mul": 1.4, "push": 4.0,
			"text": "앞으로 10m 곧게 선로 전류 — 길 위 적을 치고 앞으로 밀어낸다(뇌 부착)"},
		"burst": {"name": "막차 출발 신호", "type": "haste", "radius": 7.0, "mul": 1.6, "sec": 10.0, "energy": 12.0,
			"text": "둘레 7m 에 기적과 번개, 10초 동안 명단 원소 스킬 재사용이 두 배로 돌고 다른 인물 기력 +12"},
	},
	"story_hanbyeol": {
		"skill": {"name": "별배 견인줄", "type": "updraft", "cd": 9.0, "radius": 4.5, "mul": 1.3, "lift": 15.0, "pull": 6.0,
			"text": "둘레 4.5m 적을 견인줄로 끌어 치고 위로 솟구친다(풍) — 그대로 활공하거나 낙하 공격"},
		"burst": {"name": "틈 닫기", "type": "vortex", "radius": 6.0, "mul": 1.8, "ahead": 8.0, "sec": 8.0, "tick": 0.5, "bolt": 0.35, "pull": 7.0,
			"text": "둘레 6m 를 치고, 앞 8m 에 8초 틈 닫기 소용돌이 — 적을 빨아들이며 0.5초마다 풍(×0.35, 확산)"},
	},
	"story_mulsae": {
		"skill": {"name": "자맥질", "type": "blink", "cd": 7.0, "reach": 9.0, "speed": 26.0, "behind": 1.4, "radius": 2.5, "mul": 1.4,
			"mark_sec": 8.0, "mark_mul": 1.2,
			"text": "9m 안 가까운 적 뒤로 물질하듯 파고들며 둘레 2.5m 를 빗창으로 벤다(무적, 수) — 그 적에 8초 표식, 표식 난 적은 명단 누구에게든 피해 +20%"},
		"burst": {"name": "숨비소리", "type": "feast", "radius": 6.0, "mul": 1.3, "sec": 10.0, "tick": 1.0, "heal": 0.05, "bolt": 0.3,
			"text": "둘레 6m 를 치고 10초 숨비소리 자리 — 1초마다 안에 선 지금 인물 체력 5% 회복, 안의 적에 수(×0.3)"},
	},
	"도적_두목": {
		"skill": {"name": "회오리 도약", "type": "updraft", "cd": 8.0, "radius": 3.5, "mul": 1.2, "lift": 14.0, "pull": 5.0,
			"text": "둘레 3.5m 적을 끌어 치고 위로 솟구친다 — 그대로 활공하거나 낙하 공격"},
		"burst": {"name": "돌개바람 올가미", "type": "vortex", "radius": 5.0, "mul": 1.0, "ahead": 7.0, "sec": 8.0, "tick": 0.5, "bolt": 0.3, "pull": 6.0,
			"text": "앞 7m 에 8초 소용돌이 — 적을 빨아들이며 0.5초마다 풍(확산)"},
	},
}

## 갈래 스킬 — trait → 틀. 수치는 고유 다섯보다 한 단 낮게(고유가 그 갈래의 "대표"). text 의 %s 자리에 원소 이름.
const FAMILIES := {
	"might": {"label": "무용",
		"skill": {"noun": "돌격", "type": "dash", "cd": 7.0, "sec": 0.22, "speed": 16.0, "width": 1.8, "mul": 1.15,
			"text": "앞으로 3.5m 돌진하며 지나간 길의 적을 %s 원소로 벤다(돌진 중 무적)"},
		"burst": {"noun": "검기", "type": "infuse", "radius": 5.5, "mul": 1.8, "sec": 8.0, "normal_mul": 1.15,
			"text": "둘레 5.5m 를 치고, 8초 동안 기본 공격·강공격·낙하 공격이 %s 원소(피해 ×1.15)"}},
	"command": {"label": "통솔",
		"skill": {"noun": "호령", "type": "shells", "cd": 8.0, "reach": 10.0, "count": 2, "delay": 0.6, "radius": 2.2, "mul": 0.95,
			"text": "10m 안 적 둘 자리에 0.6초 뒤 %s 원소 탄(둘레 2.2m) — 적이 없으면 앞 8m 에 하나"},
		"burst": {"noun": "군기", "type": "rally", "radius": 7.0, "mul": 1.5, "sec": 10.0, "atk": 1.15,
			"text": "둘레 7m 를 %s 원소로 치고, 10초 동안 명단 공격 +15%%"}},
	"virtue": {"label": "인덕",
		"skill": {"noun": "방패", "type": "guard", "cd": 12.0, "radius": 3.0, "mul": 0.7, "shield": 0.2, "sec": 12.0,
			"text": "둘레 3m 를 %s 원소로 치고, 명단에 보호막(지금 인물 최대 체력 20%%, 12초)"},
		"burst": {"noun": "맹세", "type": "guard", "radius": 6.5, "mul": 1.4, "sec": 10.0, "taken": 0.8,
			"text": "둘레 6.5m 를 %s 원소로 치고, 10초 동안 명단이 받는 피해 -20%%"}},
}

## 원소가 갈래 스킬에 붙이는 이름 앞말과 덧붙는 것 — 같은 갈래라도 원소마다 쓰임이 갈린다.
##   heal 명단 체력 회복(비율) · bonus_shield 보호막(지금 인물 최대 체력 비율, 방패 틀이면 그 보호막에 더함) · team_energy 다른 인물 기력 ·
##   cd_add 재사용 대기 더하기 · mul_mul 스킬 피해 곱 · burst_mul_mul 폭발 피해 곱 · sec_add 폭발 효과 시간 더하기.
const ELEMENT_EXTRA := {
	"fire": {"word": "불꽃", "burst_mul_mul": 1.15, "note_burst": "폭발 피해 ×1.15"},
	"water": {"word": "물결", "skill": {"heal": 0.04}, "burst": {"heal": 0.08}, "note_skill": "명단 체력 4% 회복", "note_burst": "명단 체력 8% 회복"},
	"thunder": {"word": "번개", "skill": {"team_energy": 3.0}, "burst": {"team_energy": 10.0}, "note_skill": "다른 인물 기력 +3", "note_burst": "다른 인물 기력 +10"},
	"wind": {"word": "바람", "cd_add": -1.5, "note_skill": "재사용 대기 1.5초 짧음"},
	"ice": {"word": "서리", "mul_mul": 1.15, "note_skill": "스킬 피해 ×1.15"},
	"rock": {"word": "바위", "skill": {"bonus_shield": 0.12}, "note_skill": "보호막 +12%"},
	"grass": {"word": "덩굴", "sec_add": 3.0, "note_burst": "폭발 효과 3초 더 길게"},
}

static var _family_cache := {}

## 지략 인물·도감 밖 id 가 쓰는 원소 기본 스킬의 이름(인물 화면 표시).
const ELEMENT_NAMES := {
	"fire": ["불꽃 부채", "불꽃 고리"], "water": ["물결 치유", "치유의 비"], "thunder": ["낙뢰 셋", "뇌운"],
	"wind": ["바람 끌기", "소용돌이"], "ice": ["얼음 부채", "눈보라"], "rock": ["바위 기둥", "바위 방패"], "grass": ["덩굴 가시", "가시덤불"],
}

## 원소 기본 스킬 설명(지략 인물·도감 밖 id) — field_combat 원소 표 수치 그대로.
const ELEMENT_TEXTS := {
	"fire": ["앞 5m 부채꼴을 불꽃으로 벤다", "둘레 7m 폭발 뒤 3초 불꽃 고리(둘레 5m)"],
	"water": ["둘레 4m 물결 + 명단 체력 8% 회복", "둘레 7m 뒤 8초 동안 1초마다 체력 5% 회복"],
	"thunder": ["8m 안 가까운 적 셋에 낙뢰", "둘레 7m 뒤 6초 동안 가까운 적에 낙뢰"],
	"wind": ["둘레 5m 적을 끌어당기며 친다", "둘레 7m 뒤 6초 소용돌이(둘레 5m, 끌어당김)"],
	"ice": ["앞 6m 부채꼴을 얼린다", "둘레 7m 뒤 6초 눈보라가 나를 따라다닌다"],
	"rock": ["앞 2.5m 에 바위 기둥(둘레 3m)", "둘레 7m + 명단 보호막(최대 체력 30%)"],
	"grass": ["둘레 4m 덩굴 가시", "둘레 7m 뒤 8초 가시덤불(둘레 5m)"],
}

## 고유든 갈래든 스킬 표가 있는가(없으면 원소 기본 — 지략 인물·도감 밖 id).
static func has_kit(id: String) -> bool:
	return not kit_of(id).is_empty()

## 손으로 짠 고유 다섯인가(갈래 스킬은 false).
static func is_signature(id: String) -> bool:
	return KITS.has(id)

## {skill, burst}(고유 → 갈래 → 빈 값). 갈래는 trait·원소로 한 번 만들어 둔다.
static func kit_of(id: String) -> Dictionary:
	if KITS.has(id):
		return KITS[id]
	if _family_cache.has(id):
		return _family_cache[id]
	var kit := {}
	var h: Variant = Characters.find(id)
	if h != null and FAMILIES.has(String(h.trait)):
		kit = family_kit(String(h.trait), Elements.element_of(id))
	_family_cache[id] = kit
	return kit

## 갈래 × 원소 한 칸 — FAMILIES 틀에 ELEMENT_EXTRA 를 얹는다.
static func family_kit(trait_id: String, element: String) -> Dictionary:
	var fam: Dictionary = FAMILIES[trait_id]
	var ex: Dictionary = ELEMENT_EXTRA[element]
	var el_name := Elements.name_of(element)
	var out := {"family": trait_id}
	for which in ["skill", "burst"]:
		var d: Dictionary = (fam[which] as Dictionary).duplicate()
		d.name = "%s %s" % [ex.word, d.noun]
		d.erase("noun")
		d.text = String(d.text) % el_name
		for key in (ex.get(which, {}) as Dictionary):
			if key == "bonus_shield" and d.type == "guard":
				d.shield = float(d.shield) + float(ex[which][key])
			else:
				d[key] = ex[which][key]
		if which == "skill":
			d.cd = float(d.cd) + float(ex.get("cd_add", 0.0))
			d.mul = float(d.mul) * float(ex.get("mul_mul", 1.0))
		else:
			d.mul = float(d.mul) * float(ex.get("burst_mul_mul", 1.0))
			d.sec = float(d.sec) + float(ex.get("sec_add", 0.0))
		var note := String(ex.get("note_" + which, ""))
		if note != "":
			d.text = "%s · %s" % [d.text, note]
		out[which] = d
	return out

static func skill_of(id: String) -> Dictionary:
	return kit_of(id).get("skill", {})

static func burst_of(id: String) -> Dictionary:
	return kit_of(id).get("burst", {})

## 갈래 이름("무용" 등) — 고유면 "고유", 원소 기본이면 "지략"(도감 밖 id 는 "").
static func family_label(id: String) -> String:
	if KITS.has(id):
		return "고유"
	var fam := String(kit_of(id).get("family", ""))
	if fam != "":
		return String(FAMILIES[fam].label)
	return "지략" if Characters.find(id) != null else ""

## "skill"·"burst" 이름(표가 없으면 원소 기본 이름).
static func name_of(id: String, which: String, element: String) -> String:
	var kit := kit_of(id)
	if not kit.is_empty():
		return String(kit[which].name)
	var pair: Array = ELEMENT_NAMES.get(element, ["원소 스킬", "원소 폭발"])
	return String(pair[0 if which == "skill" else 1])

static func text_of(id: String, which: String) -> String:
	var kit := kit_of(id)
	if not kit.is_empty():
		return String(kit[which].text)
	var pair: Array = ELEMENT_TEXTS.get(Elements.element_of(id), ["원소마다 같은 기본 스킬", "원소마다 같은 기본 폭발"])
	return String(pair[0 if which == "skill" else 1])
