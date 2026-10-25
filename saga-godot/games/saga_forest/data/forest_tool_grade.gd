extends RefCounted

## G-0401 3마을 도구 등급·채집꾼 한 벌(디아블로 등급 색·세트 결을 채집에 — 구조만) — 웹 saga-web/saga-forest/js/tool-grade.js(W-0439) 짝, 수치 그대로.
##   등급   Lv1 일반 · Lv2 고급 · Lv3 희귀 · Lv4 영웅 · Lv5 전설 — 잠자리채·삽은 이번에 Lv4·Lv5 새 단(레시피 넷 — forest_craft.gd, 바구니는 Lv3 그대로)
##   한 벌  잠자리채·삽이 다 희귀(Lv3) 이상 = 「채집꾼 한 벌」 그 두 도구 채집에 덤 확률 +SET_P(수확 축과 따로) · 다 전설(Lv5) = 풍성 확률 ×SET_RARE 도
##          (웹은 희귀 무게 ×1.25 — 고돗 3마을엔 희귀 등급이 없어 풍성(셋 더) 확률에, forest_craft 머리말의 축 재해석과 같은 자리)
## 세이브 안 바뀜(tool_lv 에서 셈). SAGA_TOOL_SET=0 이면 한 벌 효과 끔(등급 이름은 늘 보인다).

const GRADES := ["", "일반", "고급", "희귀", "영웅", "전설"]
const GRADE_COLORS := [Color.WHITE, Color("c8c8c8"), Color("7fd07f"), Color("6aa8ff"), Color("c27fff"), Color("ffb347")]
const SET_TOOLS := ["net", "spade"]
const SET_P := 0.1
const SET_RARE := 1.25
const LV_MAX := {"basket": 3, "net": 5, "spade": 5}


static func on() -> bool:
	return OS.get_environment("SAGA_TOOL_SET") != "0"


static func label(lv: int) -> String:
	return String(GRADES[clampi(lv, 1, 5)])


static func color(lv: int) -> Color:
	return GRADE_COLORS[clampi(lv, 1, 5)]


## 한 벌 단계 — 0 없음 · 1 희귀 한 벌 · 2 전설 한 벌 (lvs = 잠자리채·삽 Lv)
static func set_tier_of(lvs: Array) -> int:
	if not on() or lvs.is_empty():
		return 0
	var m := 99
	for v: Variant in lvs:
		m = mini(m, int(v))
	return 2 if m >= 5 else (1 if m >= 3 else 0)


static func set_tier(F: Node) -> int:
	var Craft: GDScript = load("res://games/saga_forest/data/forest_craft.gd")
	var lvs: Array = []
	for t: String in SET_TOOLS:
		lvs.append(Craft.tool_lv(F, t))
	return set_tier_of(lvs)


## 그 도구 채집에 얹을 덤 {harvest_add, bounty_mul} — 한 벌 도구가 아니거나 한 벌이 없으면 {0, 1}
static func fx(F: Node, tool: String) -> Dictionary:
	if not SET_TOOLS.has(tool):
		return {"harvest_add": 0.0, "bounty_mul": 1.0}
	var t := set_tier(F)
	return {"harvest_add": SET_P if t >= 1 else 0.0, "bounty_mul": SET_RARE if t >= 2 else 1.0}


## 제작대 머리줄 꼬리 — 한 벌이 섰을 때만
static func set_text(F: Node) -> String:
	match set_tier(F):
		1:
			return " · 🧰 채집꾼 한 벌(희귀) 덤 +%d%%" % int(SET_P * 100.0)
		2:
			return " · 🧰 채집꾼 한 벌(전설) 덤 +%d%%·풍성 ×%.2f" % [int(SET_P * 100.0), SET_RARE]
	return ""
