extends RefCounted

## G-0340 동료 우정(공용, 원신 호감도·스타듀 하트 — 구조만) — 추천 표 "④ 동료 호감·대사 분기 공용(3마을 하트 → 다섯 판)".
##   단계   점수 → Lv 0~10(NEED 누적) · 넷 묶음: 낯섦(0~2)·친근(3~5)·신뢰(6~8)·지기(9~10).
##   대사   인물 성향(characters trait: might·wisdom·command·virtue)마다 단계 대사 셋(낯섦·친근·신뢰) — 지기면 그 인물의 한마디(quote).
##          성향을 모르면 virtue 줄. 이름은 쓰지 않는다(대사에 실명 없음 — 이름 정책).
##   판     점수를 언제 주고 어디 쌓는지는 판 어댑터(1만리 games/saga_go/data/go_bond.gd). 이 파일은 셈·글만.
##   SAGA_BOND=0 이면 판 어댑터가 점수를 안 준다(이 파일은 꺼짐 표시만).

const NEED := [0, 20, 50, 90, 140, 200, 270, 350, 440, 540, 650]   # Lv n 에 닿는 누적 점수
const MAX_LV := 10
const TIERS := [
	{"name": "낯섦", "emoji": "🤝", "from": 0},
	{"name": "친근", "emoji": "😊", "from": 3},
	{"name": "신뢰", "emoji": "💛", "from": 6},
	{"name": "지기", "emoji": "💞", "from": 9},
]
const LINES := {
	"might": ["싸움터에서 등을 맡길 만한지는 아직 모르겠군.", "그대 칼끝이 제법 매섭더군. 다음에도 앞장서지.", "그대와 함께라면 어떤 적진이든 베고 들어가겠다."],
	"wisdom": ["서로를 더 지켜본 뒤에 판단해도 늦지 않겠지요.", "그대의 길 고르는 눈이 예사롭지 않군요.", "그대의 뜻이라면 계책을 아끼지 않겠습니다."],
	"command": ["대열에 선 이상 명은 따르겠소. 그 이상은 두고 봅시다.", "그대와 발을 맞추니 무리가 한결 가볍소.", "그대가 깃발을 들면 내가 그 뒤를 지키겠소."],
	"virtue": ["함께 걷게 되었군요. 잘 부탁드립니다.", "그대 곁에 있으면 마음이 놓입니다.", "그대를 위해서라면 무엇이든 나누겠습니다."],
}


## 이름 뒤 와/과(받침 있으면 과)
static func with_wa(nm: String) -> String:
	if nm.is_empty():
		return nm
	var c := nm.unicode_at(nm.length() - 1)
	return nm + ("과" if c >= 0xAC00 and c <= 0xD7A3 and (c - 0xAC00) % 28 != 0 else "와")


static func on() -> bool:
	return OS.get_environment("SAGA_BOND") != "0"


static func level_of(pts: float) -> int:
	var lv := 0
	for i in NEED.size():
		if pts >= float(NEED[i]):
			lv = i
	return mini(lv, MAX_LV)


static func tier_of(lv: int) -> int:
	var t := 0
	for i in TIERS.size():
		if lv >= int(TIERS[i].from):
			t = i
	return t


static func tier_text(lv: int) -> String:
	var d: Dictionary = TIERS[tier_of(lv)]
	return "%s %s" % [d.emoji, d.name]


## 다음 Lv 까지 남은 점수(끝이면 0)
static func to_next(pts: float) -> int:
	var lv := level_of(pts)
	return 0 if lv >= MAX_LV else ceili(float(NEED[lv + 1]) - pts)


## 그 단계의 대사 — 지기면 인물 한마디(quote), 없으면 성향 신뢰 줄
static func line(trait_key: String, lv: int, quote: String = "") -> String:
	var t := tier_of(lv)
	var arr: Array = LINES.get(trait_key, LINES.virtue)
	if t >= 3:
		return quote if quote != "" else String(arr[2])
	return String(arr[t])
