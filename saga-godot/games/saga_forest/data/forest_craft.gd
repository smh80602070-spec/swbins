extends RefCounted

## G-0196 — 3마을 제작대(웹 W-0103 · craft.js 의 고돗 짝, 마인크래프트 참고 · 재미 표준 D "성장 선택"). 채집물이 재료가 되어
## 도구를 승급하고 가구를 짓는다. 승급마다 세 갈래 — 서로 다른 축 하나씩(같은 축 둘이 한 화면에 안 나온다 — 축이 셋이라 늘 셋 다), 거절하면 💰100.
## **고돗 재해석**: 이 판 채집은 하루 한 번·늘 +1 이라 웹의 "속도(채집 시간 −20%)" 축이 들어갈 자리가 없다 — 축을 이 판에 맞게:
##   수확(harvest) = 30% 확률로 하나 더 · 풍성(bounty) = 8% 확률로 셋 더(웹 "희귀 ×1.5" 자리 — 이 판엔 희귀 등급이 없다) · 손재주(knack) = 25% 확률로 그 자리가 오늘 한 번 더 참(웹 "속도" 자리).
##   같은 축을 거듭 고르면 확률이 겹쳐 오른다(상한 HARVEST_MAX 등). 굴림은 결정적 해시(날·자리·축) — 같은 날 같은 자리는 같은 결과.
## 도구 셋: 바구니(과일·솔방울·꽃·조개·약초) · 잠자리채(곤충) · 삽(광석·화석 — 삽은 사야 생긴다, 산 뒤 Lv1). Lv1 → 3.
## 레시피 12 = 도구 승급 6(셋 × Lv2·3) + 가구 짓기 6(forest_home.gd FURNITURE 중 여섯 — 사는 길은 그대로). 재료는 전부 지금 채집되는 품목만.
## 웹과 다른 것: 울타리·징검다리 둘은 고돗 마을에 바깥 놓기 자리가 없어 가구 둘로 바꿨다.

const AXES := ["harvest", "bounty", "knack"]
const AXIS_NAMES := {"harvest": "수확 — 30% 확률로 하나 더", "bounty": "풍성 — 8% 확률로 셋 더", "knack": "손재주 — 25% 확률로 그 자리가 오늘 한 번 더"}
const AXIS_SHORT := {"harvest": "수확", "bounty": "풍성", "knack": "손재주"}
const HARVEST_P := 0.3
const HARVEST_MAX := 0.6
const BOUNTY_P := 0.08
const BOUNTY_MAX := 0.16
const KNACK_P := 0.25
const KNACK_MAX := 0.5
const DECLINE_GOLD := 100
const MAX_LV := 3

const TOOLS := {"basket": "바구니", "net": "잠자리채", "spade": "삽"}
## 채집 자리 → 도구(world/gatherable_builder.gd DEFS id)
const GATHER_TOOL := {"gather_tree": "basket", "gather_pine": "basket", "gather_flower": "basket", "gather_shell": "basket", "gather_herb": "basket",
	"gather_bug": "net", "gather_rock": "spade", "gather_fossil": "spade"}
## 채집되는 품목(점검 ① — 레시피 재료는 이 안에서만)
const GATHER_LABELS := ["과일", "솔방울", "광석", "꽃", "곤충", "조개", "화석", "약초", "물고기"]

const RECIPES := [
	{"key": "up_basket_2", "kind": "tool", "tool": "basket", "lv": 2, "need": {"솔방울": 3, "꽃": 2}},
	{"key": "up_basket_3", "kind": "tool", "tool": "basket", "lv": 3, "need": {"솔방울": 5, "과일": 3, "약초": 2}},
	{"key": "up_net_2", "kind": "tool", "tool": "net", "lv": 2, "need": {"곤충": 2, "솔방울": 2}},
	{"key": "up_net_3", "kind": "tool", "tool": "net", "lv": 3, "need": {"곤충": 4, "약초": 3}},
	{"key": "up_spade_2", "kind": "tool", "tool": "spade", "lv": 2, "need": {"광석": 3, "화석": 1}},
	{"key": "up_spade_3", "kind": "tool", "tool": "spade", "lv": 3, "need": {"광석": 5, "화석": 2, "조개": 2}},
	{"key": "make_bangseok", "kind": "furn", "furn": "bangseok", "need": {"꽃": 3, "솔방울": 1}},
	{"key": "make_hwabun", "kind": "furn", "furn": "hwabun", "need": {"꽃": 2, "광석": 2}},
	{"key": "make_soban", "kind": "furn", "furn": "soban", "need": {"솔방울": 4, "과일": 2}},
	{"key": "make_mulhang", "kind": "furn", "furn": "mulhang", "need": {"광석": 3, "조개": 2}},
	{"key": "make_jokja", "kind": "furn", "furn": "jokja", "need": {"약초": 2, "꽃": 2, "솔방울": 2}},
	{"key": "make_hwaro", "kind": "furn", "furn": "hwaro", "need": {"광석": 4, "화석": 1}},
]


static func recipe(key: String) -> Dictionary:
	for r: Dictionary in RECIPES:
		if String(r.key) == key:
			return r
	return {}


static func hash01(seed: String, salt: String) -> float:
	var h := 2166136261
	var s := seed + "|" + salt
	for i in s.length():
		h = h ^ s.unicode_at(i)
		h = (h * 16777619) & 0xFFFFFFFF
	h = h ^ (h >> 13)
	h = (h * 1274126177) & 0xFFFFFFFF
	h = h ^ (h >> 16)
	return float(h) / 4294967296.0


## 도구 단계 — 바구니·잠자리채는 처음부터 Lv1, 삽은 산 뒤 Lv1(F = ForestSaveState)
static func tool_lv(F: Node, tool: String) -> int:
	var lv := int((F.tool_lv as Dictionary).get(tool, 0))
	if lv <= 0:
		if tool == "spade":
			return 1 if F.has_tool("spade") else 0
		return 1
	return lv


static func perks(F: Node, tool: String) -> Array:
	return (F.tool_perks as Dictionary).get(tool, [])


## 만들 수 없는 까닭("" = 만들 수 있다)
static func why_not(F: Node, r: Dictionary) -> String:
	if r.is_empty():
		return "없는 레시피"
	if String(r.kind) == "tool":
		var cur := tool_lv(F, String(r.tool))
		if cur <= 0:
			return "%s이(가) 없다" % TOOLS[r.tool]
		if cur != int(r.lv) - 1:
			return "지금 Lv%d" % cur
	for label: String in (r.need as Dictionary).keys():
		if F.item_count(label) < int(r.need[label]):
			return "%s 모자람(%d/%d)" % [label, F.item_count(label), int(r.need[label])]
	return ""


## 만든다 — 재료를 쓰고 도구는 한 단계·가구는 집 창고로. 돌려줌 {ok, why, tool(승급이면 그 도구 — 곧 세 갈래를 고른다)}
static func make(F: Node, key: String) -> Dictionary:
	var r := recipe(key)
	var why := why_not(F, r)
	if why != "":
		return {"ok": false, "why": why, "tool": ""}
	for label: String in (r.need as Dictionary).keys():
		F.items[label] = F.item_count(label) - int(r.need[label])
		if int(F.items[label]) <= 0:
			F.items.erase(label)
	if String(r.kind) == "tool":
		F.tool_lv[String(r.tool)] = int(r.lv)
		return {"ok": true, "why": "", "tool": String(r.tool)}
	F.home_stock_add(String(r.furn), 1)
	return {"ok": true, "why": "", "tool": ""}


## 세 갈래 — 축이 셋이라 늘 셋 다(서로 다른 축)
static func offer3() -> Array:
	return AXES.duplicate()


static func pick(F: Node, tool: String, axis: String) -> void:
	var p: Array = (F.tool_perks as Dictionary).get(tool, []).duplicate()
	p.append(axis)
	F.tool_perks[tool] = p


static func decline(F: Node) -> void:
	F.add_gold(DECLINE_GOLD)


## 채집 한 번의 덤 — {extra, again}. seed = "날|자리"(같은 날 같은 자리는 같은 결과)
static func gather_roll(p: Array, seed: String) -> Dictionary:
	var h := p.count("harvest")
	var b := p.count("bounty")
	var k := p.count("knack")
	var extra := 0
	if h > 0 and hash01(seed, "harvest") < minf(HARVEST_P * h, HARVEST_MAX):
		extra += 1
	if b > 0 and hash01(seed, "bounty") < minf(BOUNTY_P * b, BOUNTY_MAX):
		extra += 3
	var again := k > 0 and hash01(seed, "knack") < minf(KNACK_P * k, KNACK_MAX)
	return {"extra": extra, "again": again}
