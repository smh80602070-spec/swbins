extends RefCounted

## G-0231 2나락 전리품 거르기 — 규칙 목록으로 바닥 장비를 보이기·숨기기·빛기둥(웹 W-0287 loot-filter.js 이식).
##   규칙 꼴  {"when": {"min_tier", "slot", "elem", "my_class"}, "do": "show"|"hide"|"beam", "off": bool}
##   판정     위에서부터 **처음 맞는 규칙**의 do — 아무것도 안 맞으면 보이기. 장비만 거른다(금·단약·재료·감정서는 늘 보임).
##   저장     DungeonSaveState.loot_filter = {"rules": [], "hinted": bool} — 순수 추가 칸(버전 안 올림), 없으면 기본 셋.
##   기본 셋  ① 전설 빛기둥 ② 보물 빛기둥 ③ 내 직업 무기 빛기둥 — 숨기기는 기본에 없다(처음부터 숨기면 "안 떨어진다" 고 느낀다).
##   추천     4층부터 "상품 숨기기" 를 한 번 권한다(hinted).
## 이 판 장비엔 원소 칸이 없어(웹은 고유 효과의 원소) elem 조건은 지금 아무것과도 안 맞는다 — 칸만 웹과 같게 둔다.

const TIER_NAMES := ["상품", "양품", "명품", "보물", "전설"]
const SLOT_NAMES := {"weapon": "무기", "armor": "갑주", "charm": "부적"}
const DO_NAMES := {"show": "보이기", "hide": "숨기기", "beam": "빛기둥"}
const MAX_RULES := 12
const HINT_FLOOR := 4
## 빠른 추가 넷(웹 PRESET) — "hide1" 은 두 줄(명품 이상 보이기 + 전부 숨기기, 첫 일치라 순서가 뜻).
const PRESETS := [
	{"key": "hide0", "label": "상품 숨기기"},
	{"key": "hide1", "label": "양품 이하 숨기기"},
	{"key": "beamw", "label": "내 직업 무기 빛기둥"},
	{"key": "beam2", "label": "명품 이상 빛기둥"},
]


static func defaults() -> Array:
	return [
		{"when": {"min_tier": 4}, "do": "beam"},
		{"when": {"min_tier": 3}, "do": "beam"},
		{"when": {"slot": "weapon", "my_class": true}, "do": "beam"},
	]


## 세이브 칸 — 비었거나 깨졌으면 기본 셋으로 채운다.
static func store() -> Dictionary:
	var st: Dictionary = DungeonSaveState.loot_filter
	if not (st.get("rules") is Array):
		st["rules"] = defaults()
		st["hinted"] = bool(st.get("hinted", false))
	return st


static func rules() -> Array:
	return store().rules


static func class_of_item(it: Dictionary) -> String:
	var b := DungeonItems.base_by_key(str(it.get("base", "")))
	if b.is_empty() or str(b.get("slot", "")) != "weapon":
		return ""
	return str(DungeonItems.WEAPON_CLASS.get(b.get("look"), ""))


static func matches(when: Dictionary, it: Dictionary, my_class: String) -> bool:
	if when.has("min_tier") and int(it.get("tier", 0)) < int(when.min_tier):
		return false
	if when.has("slot") and str(DungeonItems.base_by_key(str(it.get("base", ""))).get("slot", "")) != str(when.slot):
		return false
	if when.has("elem") and str(it.get("elem", "")) != str(when.elem):
		return false
	if bool(when.get("my_class", false)) and (my_class == "" or class_of_item(it) != my_class):
		return false
	return true


## 장비 하나의 판정(순수) — {"show", "pillar", "rule"(맞은 규칙 칸, 없으면 -1)}.
static func decide(it: Dictionary, rule_list: Array, my_class: String) -> Dictionary:
	for i in rule_list.size():
		var r: Variant = rule_list[i]
		if not (r is Dictionary) or bool(r.get("off", false)):
			continue
		var when: Variant = r.get("when", {})
		if matches(when if when is Dictionary else {}, it, my_class):
			var d := str(r.get("do", "show"))
			return {"show": d != "hide", "pillar": d == "beam", "rule": i}
	return {"show": true, "pillar": false, "rule": -1}


## 지금 낀 무기의 직업으로 판정.
static func judge(it: Dictionary) -> Dictionary:
	return decide(it, rules(), DungeonItems.class_key_for_weapon(DungeonEquipmentState.weapon))


static func describe(r: Dictionary) -> String:
	var w: Dictionary = r.get("when", {})
	var parts: Array[String] = []
	if w.has("min_tier"):
		var t := int(w.min_tier)
		parts.append((TIER_NAMES[t] if t >= 0 and t < TIER_NAMES.size() else str(t)) + " 이상")
	if w.has("slot"):
		parts.append(str(SLOT_NAMES.get(w.slot, w.slot)))
	if w.has("elem"):
		parts.append(DungeonItems.elem_name(str(w.elem)) + " 원소")
	if bool(w.get("my_class", false)):
		parts.append("내 직업 무기")
	return " · ".join(parts) if not parts.is_empty() else "모든 물건"


# ---------------------------------------------------------------- 규칙 손질(맨 위에 넣는다 — 웹과 같다)

static func add(rule: Dictionary) -> bool:
	var rs := rules()
	if rs.size() >= MAX_RULES:
		return false
	var d := str(rule.get("do", "show"))
	rs.push_front({"when": (rule.get("when", {}) as Dictionary).duplicate(), "do": d if DO_NAMES.has(d) else "show"})
	return true


static func add_preset(key: String) -> bool:
	match key:
		"hide0":
			return add({"when": {"min_tier": 0}, "do": "hide"})
		"hide1":
			if rules().size() + 2 > MAX_RULES:
				return false
			add({"when": {}, "do": "hide"})
			return add({"when": {"min_tier": 2}, "do": "show"})
		"beamw":
			return add({"when": {"slot": "weapon", "my_class": true}, "do": "beam"})
		"beam2":
			return add({"when": {"min_tier": 2}, "do": "beam"})
	return false


static func remove(i: int) -> bool:
	var rs := rules()
	if i < 0 or i >= rs.size():
		return false
	rs.remove_at(i)
	return true


static func move(i: int, d: int) -> bool:
	var rs := rules()
	var j := i + d
	if i < 0 or i >= rs.size() or j < 0 or j >= rs.size():
		return false
	var t: Variant = rs[i]
	rs[i] = rs[j]
	rs[j] = t
	return true


static func toggle(i: int) -> bool:
	var rs := rules()
	if i < 0 or i >= rs.size():
		return false
	rs[i]["off"] = not bool(rs[i].get("off", false))
	return true


static func cycle_do(i: int) -> bool:
	var rs := rules()
	if i < 0 or i >= rs.size():
		return false
	var order := ["show", "hide", "beam"]
	rs[i]["do"] = order[(order.find(str(rs[i].get("do", "show"))) + 1) % order.size()]
	return true


static func reset() -> void:
	store()["rules"] = defaults()


## 4층부터 한 번 — 바닥이 어지러우면 "상품 숨기기" 를 권한다. 권했으면 true.
static func hint_if_deep(node: Node, floor_num: int) -> bool:
	var st := store()
	if bool(st.get("hinted", false)) or floor_num < HINT_FLOOR:
		return false
	st["hinted"] = true
	preload("res://saga_core/ui/toast.gd").show(node, "🧹 바닥이 어지러우면 🧹 단추(전리품 거르기)에서 \"상품 숨기기\" 를 켜 보세요", 5.0)
	return true
