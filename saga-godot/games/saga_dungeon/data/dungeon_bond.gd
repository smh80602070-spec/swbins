extends RefCounted

## G-0341 2나락 부대 우정 — 공용 saga_core/data/bond.gd(G-0340) 어댑터. 부대원은 늘 같이 내려가므로(능력치 보탬, dungeon_party_state.gd) 방 단위로 센다.
##   점수   방을 깨고 나갈 때(test_room _finish_exit) 부대 전원 +ROOM · 마지막 방(한 판 완주)이면 +RUN 더.
##   단이 오름  알림(공용 글) · 지기에 처음 닿으면 금 +TOP_GOLD(한 번).
##   글     HUD 부대 줄 "🛡️ 부대 2명 (명운 💛7·뇌호 🤝1)".
##   저장   DungeonSaveState.bond = {id: 점수, "_knot": [지기 덤 받은 id…]}(순수 추가, 버전 그대로). SAGA_BOND=0 이면 점수 없음.

const Bond := preload("res://saga_core/data/bond.gd")
const Characters := preload("res://saga_core/data/characters.gd")
const Toast := preload("res://saga_core/ui/toast.gd")

const ROOM := 5.0
const RUN := 10.0
const TOP_GOLD := 500


static func store() -> Dictionary:
	if typeof(DungeonSaveState.bond) != TYPE_DICTIONARY:
		DungeonSaveState.bond = {}
	return DungeonSaveState.bond


static func pts(id: String) -> float:
	return float(store().get(id, 0.0))


static func add(id: String, amount: float, host: Node = null) -> String:
	var h: Variant = Characters.find(id)
	var r: Dictionary = Bond.gain(store(), id, amount, h if typeof(h) == TYPE_DICTIONARY else {})
	if r.is_empty():
		return ""
	var msg := String(r.msg)
	if bool(r.first_top):
		DungeonGoldState.add(TOP_GOLD)
		msg += " · 💰 +%d" % TOP_GOLD
	if host != null and host.is_inside_tree():
		Toast.show(host, msg, 4.0)
	return msg


## 방을 깨고 나갈 때 — 부대 전원
static func on_room(is_final: bool, host: Node = null) -> Array:
	var out: Array = []
	for id in DungeonPartyState.members:
		var m := add(String(id), ROOM + (RUN if is_final else 0.0), host)
		if m != "":
			out.append(m)
	if host != null and host.is_inside_tree():
		host.get_tree().call_group("dungeon_party_label", "_refresh")
	return out


## HUD 부대 줄 이름 꼬리 — "명운 💛7"(꺼짐이면 이름만)
static func name_tag(id: String, nm: String) -> String:
	return "%s %s" % [nm, Bond.tag(pts(id))] if Bond.on() else nm
