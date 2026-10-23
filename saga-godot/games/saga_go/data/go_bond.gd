extends RefCounted

## G-0340 1만리 동료 우정 어댑터(공용 셈·글 saga_core/data/bond.gd) — 등용한 동료가 들판 명단에서 함께 싸우고 탐사를 다녀올수록 Lv 이 오른다.
##   점수   적이 쓰러질 때(achievements died) 지금 앞에 선 동료 +2 · 명단의 다른 동료 +1 · 탐사 돌아옴(dispatch claim) 그 동료 +15. "나"는 안 셈.
##   단이 오름  알림 "💛 <이름>와의 우정 Lv.n · 신뢰 — "대사"" · 지기(Lv 9)에 처음 닿으면 인연 매듭 1(한 번).
##   글     인물 창(C) 능력치 아랫줄 "💞 우정 Lv.n 지기 · 다음까지 m — "대사"".
##   저장   PartyState.bond = {id: 점수, "_knot": [지기 매듭 받은 id…]}(SaveState "bond", 없으면 빈 것). SAGA_BOND=0 이면 점수 없음.

const Bond := preload("res://saga_core/data/bond.gd")
const Characters := preload("res://saga_core/data/characters.gd")
const Toast := preload("res://saga_core/ui/toast.gd")

const KILL_ACTIVE := 2.0
const KILL_PARTY := 1.0
const DISPATCH := 15.0
const KNOT_TIER := 3   # 지기


static func pts(id: String) -> float:
	return float(PartyState.bond.get(id, 0.0)) if typeof(PartyState.bond) == TYPE_DICTIONARY else 0.0


static func level(id: String) -> int:
	return Bond.level_of(pts(id))


static func _hero(id: String) -> Dictionary:
	var h: Variant = Characters.find(id)
	if h == null:
		h = preload("res://games/saga_go/data/story.gd").member(id)
	return h if typeof(h) == TYPE_DICTIONARY else {}


static func line_of(id: String) -> String:
	var h := _hero(id)
	return Bond.line(String(h.get("trait", "virtue")), level(id), String(h.get("quote", "")))


## 점수를 더한다 — 단이 오르면 알림 글(없으면 "")
static func add(id: String, amount: float, host: Node = null) -> String:
	if not Bond.on() or id == "" or id == "self" or amount <= 0.0:
		return ""
	if typeof(PartyState.bond) != TYPE_DICTIONARY:
		PartyState.bond = {}
	var lv0 := level(id)
	PartyState.bond[id] = pts(id) + amount
	var lv1 := level(id)
	if lv1 <= lv0:
		return ""
	var h := _hero(id)
	var nm := String(h.get("name", id))
	var msg := "%s %s의 우정 Lv.%d · %s — \"%s\"" % [Bond.TIERS[Bond.tier_of(lv1)].emoji, Bond.with_wa(nm), lv1, Bond.TIERS[Bond.tier_of(lv1)].name, line_of(id)]
	var got: Array = PartyState.bond.get("_knot", [])
	if Bond.tier_of(lv1) >= KNOT_TIER and not got.has(id):
		got.append(id)
		PartyState.bond["_knot"] = got
		PartyState.add_items({"fate_knot": 1})
		msg += " · 인연 매듭 +1"
	if host != null and host.is_inside_tree():
		Toast.show(host, msg, 4.0)
	return msg


## 적이 쓰러질 때 — 앞에 선 동료 +2, 명단 다른 동료 +1
static func on_kill(tree: SceneTree, host: Node = null) -> void:
	if not Bond.on():
		return
	var fc := tree.get_first_node_in_group("go_field_combat")
	var active := String(fc.call("active_id")) if fc != null else ""
	var roster: Array = fc.call("roster") if fc != null else ["self"] + PartyState.party()
	for id in roster:
		add(String(id), KILL_ACTIVE if String(id) == active else KILL_PARTY, host)


## 인물 창 한 줄
static func screen_line(id: String) -> String:
	if not Bond.on() or id == "self":
		return ""
	var lv := level(id)
	var nx := Bond.to_next(pts(id))
	return "%s 우정 Lv.%d %s%s — \"%s\"" % [Bond.TIERS[Bond.tier_of(lv)].emoji, lv, Bond.TIERS[Bond.tier_of(lv)].name,
		(" · 다음까지 %d" % nx) if nx > 0 else "", line_of(id)]
