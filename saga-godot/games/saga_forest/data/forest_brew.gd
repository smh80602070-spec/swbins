extends RefCounted

## G-0320 3마을 물약 양조 — 섞어서 찾는 물약(포션 크래프트 — 구조만). 고돗이 먼저(웹·유니티 짝 없음, 장부 forest.md 우선 3 "약초꾼과 엮으면").
##   달이기  제작대 「⚗️ 물약 달이기」 — 약초 1 + 다른 재료 1(MIXES 다섯 중). 처음엔 무엇이 될지 모른다(?), 한 번 달이면 이름이 밝혀진다.
##   마시기  달인 물약은 곧바로 마신다 — 오늘 하루(ForestDay.today_key) 효과 하나. 새로 마시면 바뀐다(하나만).
##           🍯 기운 물약(과일) 채집 +1 · 🐚 물빛 물약(조개) 낚시 입질 창 ×1.5 · 🌸 꽃향 물약(꽃) 주민 하트 오를 때 +1(하루 상한 그대로)
##           💧 탁한 물약(곤충·광석) 효과 없음 — 섞어 보기의 헛방.
##   저장   ForestSaveState.brew = {found: [재료…], drunk: 재료, day: 날} — 순수 추가 칸(버전 안 올림).
## F = ForestSaveState(forest_livestock.gd 와 같은 꼴). SAGA_BREW=0 이면 끔.

const BASE := "약초"
const MIXES := {
	"과일": {"name": "기운 물약", "emoji": "🍯", "fx": "gather", "text": "오늘 채집 +1"},
	"조개": {"name": "물빛 물약", "emoji": "🐚", "fx": "fish", "text": "오늘 낚시 입질 창 ×1.5"},
	"꽃": {"name": "꽃향 물약", "emoji": "🌸", "fx": "heart", "text": "오늘 주민 하트 오를 때 +1"},
	"곤충": {"name": "탁한 물약", "emoji": "💧", "fx": "", "text": "아무 일도 없다"},
	"광석": {"name": "탁한 물약", "emoji": "💧", "fx": "", "text": "아무 일도 없다"},
}
const FISH_MUL := 1.5


static func on() -> bool:
	return OS.get_environment("SAGA_BREW") != "0"


static func st(F: Node) -> Dictionary:
	if typeof(F.brew) != TYPE_DICTIONARY:
		F.brew = {}
	var B: Dictionary = F.brew
	if typeof(B.get("found")) != TYPE_ARRAY:
		B["found"] = []
	if not B.has("drunk"):
		B["drunk"] = ""
	if not B.has("day"):
		B["day"] = -1
	return B


static func found(F: Node, mix: String) -> bool:
	return (st(F).found as Array).has(mix)


static func why_not(F: Node, mix: String) -> String:
	if not on():
		return "꺼져 있다"
	if not MIXES.has(mix):
		return "섞을 수 없다"
	if F.item_count(BASE) < 1:
		return "%s 이 없다" % BASE
	if F.item_count(mix) < 1:
		return "%s 이 없다" % mix
	return ""


## 달여 마시기 — {ok, why, name, emoji, text, fresh}
static func brew(F: Node, mix: String, day: int) -> Dictionary:
	var why := why_not(F, mix)
	if why != "":
		return {"ok": false, "why": why}
	F.add_item(BASE, -1)
	F.add_item(mix, -1)
	var B := st(F)
	var fresh := not (B.found as Array).has(mix)
	if fresh:
		(B.found as Array).append(mix)
	B.drunk = mix
	B.day = day
	var m: Dictionary = MIXES[mix]
	return {"ok": true, "fresh": fresh, "name": m.name, "emoji": m.emoji, "text": m.text}


## 오늘 마신 물약 효과 키 — 없으면 ""
static func fx_today(F: Node, day: int) -> String:
	if not on():
		return ""
	var B := st(F)
	if int(B.day) != day or String(B.drunk) == "":
		return ""
	return String((MIXES.get(String(B.drunk), {}) as Dictionary).get("fx", ""))


static func gather_add(F: Node, day: int) -> int:
	return 1 if fx_today(F, day) == "gather" else 0


static func fish_mul(F: Node, day: int) -> float:
	return FISH_MUL if fx_today(F, day) == "fish" else 1.0


static func heart_add(F: Node, day: int, amount: int) -> int:
	return 1 if amount > 0 and fx_today(F, day) == "heart" else 0


## 제작대 창 줄 — [{mix, label}]
static func lines(F: Node) -> Array:
	var out: Array = []
	for mix: String in MIXES:
		var m: Dictionary = MIXES[mix]
		var known := found(F, mix)
		var why := why_not(F, mix)
		out.append({"mix": mix, "label": "%s + %s → %s%s" % [BASE, mix, "%s %s (%s)" % [m.emoji, m.name, m.text] if known else "❔ 무엇이 될까", "" if why == "" else "  (%s)" % why]})
	return out
