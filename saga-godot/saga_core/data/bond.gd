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


## G-0341 판 어댑터 공용 — store(판 세이브의 bond 사전)에 점수를 더하고 단이 올랐으면 {lv, first_top, msg}, 아니면 {}.
##   first_top = 지기에 처음 닿음(store "_knot" 에 id 를 적는다 — 덤은 판이 준다). msg = "💛 명운과의 우정 Lv.7 · 신뢰 — "대사"".
##   hero 는 characters 한 줄(name·trait·quote, 없으면 {}). 꺼짐·"self"·0 이하면 {}.
static func gain(store: Dictionary, id: String, amount: float, hero: Dictionary) -> Dictionary:
	if not on() or id == "" or id == "self" or amount <= 0.0:
		return {}
	var lv0 := level_of(float(store.get(id, 0.0)))
	store[id] = float(store.get(id, 0.0)) + amount
	var lv1 := level_of(float(store[id]))
	if lv1 <= lv0:
		return {}
	var t: Dictionary = TIERS[tier_of(lv1)]
	var ln := line(String(hero.get("trait", "virtue")), lv1, String(hero.get("quote", "")))
	var got: Array = store.get("_knot", [])
	var first := tier_of(lv1) >= 3 and not got.has(id)
	if first:
		got.append(id)
		store["_knot"] = got
	return {"lv": lv1, "first_top": first, "msg": "%s %s의 우정 Lv.%d · %s — \"%s\"" % [t.emoji, with_wa(String(hero.get("name", id))), lv1, t.name, ln]}


## 짧은 꼬리표 — "💛7"
static func tag(pts: float) -> String:
	var lv := level_of(pts)
	return "%s%d" % [TIERS[tier_of(lv)].emoji, lv]
