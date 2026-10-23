extends RefCounted

## G-0332 5천하 혼인 동맹 — 무장 하나를 다른 세력과 맺어 오래 정전(크루세이더 킹즈 3 혼인 — 구조만). 고돗이 먼저(웹·유니티 짝 없음, 장부 realm.md 우선 3 "계승 축의 밖").
##   맺기   외교 창 「💍 혼인」 — 그 세력 우호 NEED_REL 이상 · 금 COST · 우리 무장 하나(이미 맺은 이 말고) · 동맹 MAX 까지.
##          맺으면 우호 +BOND_UP · 맺은 무장 충성 +LOYAL_UP.
##   이음   달마다(realm_rules_month) 맺은 세력 정전을 KEEP_TRUCE 달 이상으로 채움(혼인이 있는 동안 서로 못 침) · 우호 +MONTH_UP(100 까지).
##   얽힘   맺은 무장이 우리 무장이 아니게 되면(전술판 전사·이탈·계승 변고) 혼인이 깨진다 — 우호 −BREAK_HIT · 정전 0 · 알림.
##   저장   RealmSaveState.marriages = {세력 id: 무장 id} (28→29). AI 세력끼리는 안 맺는다(고돗 AI 는 금이 없다). SAGA_MARRIAGE=0 이면 끔.
## S = RealmSaveState(realm_trade.gd 와 같은 꼴).

const Characters := preload("res://saga_core/data/characters.gd")

const NEED_REL := 70
const COST := 1500
const MAX := 2
const BOND_UP := 15
const LOYAL_UP := 10
const KEEP_TRUCE := 2
const MONTH_UP := 1
const BREAK_HIT := 30


static func on() -> bool:
	return OS.get_environment("SAGA_MARRIAGE") != "0"


static func st(S: Object) -> Dictionary:
	if typeof(S.marriages) != TYPE_DICTIONARY or (S.marriages as Dictionary).is_read_only():
		S.marriages = (S.marriages as Dictionary).duplicate() if typeof(S.marriages) == TYPE_DICTIONARY else {}
	return S.marriages


static func _dip(S: Object, fid: String) -> Dictionary:
	if not (S.diplomacy as Dictionary).has(fid):
		S.diplomacy[fid] = {"relation": 40, "truce_months": 0}
	return S.diplomacy[fid]


static func married_officer(S: Object, fid: String) -> String:
	return String(st(S).get(fid, ""))


static func taken(S: Object, oid: String) -> bool:
	return st(S).values().has(oid)


static func why(S: Object, fid: String, oid: String) -> String:
	if not on():
		return "꺼져 있다"
	if fid == "":
		return "없는 세력"
	if st(S).has(fid):
		return "이미 혼인으로 맺은 세력이다"
	if st(S).size() >= MAX:
		return "혼인 동맹은 %d까지다" % MAX
	if int(_dip(S, fid).relation) < NEED_REL:
		return "우호가 모자란다(%d/%d)" % [int(_dip(S, fid).relation), NEED_REL]
	if int(S.gold) < COST:
		return "금이 모자란다(%d/%d)" % [int(S.gold), COST]
	if not (S.roster as Array).has(oid):
		return "우리 무장이 아니다"
	if taken(S, oid):
		return "이미 혼인한 무장이다"
	return ""


static func marry(S: Object, fid: String, oid: String) -> Dictionary:
	var w := why(S, fid, oid)
	if w != "":
		return {"ok": false, "why": w}
	S.gold = int(S.gold) - COST
	st(S)[fid] = oid
	var d := _dip(S, fid)
	d.relation = mini(100, int(d.relation) + BOND_UP)
	d.truce_months = maxi(int(d.truce_months), KEEP_TRUCE)
	S.officer_loyal[oid] = clampi(int(S.officer_loyal.get(oid, 50)) + LOYAL_UP, 0, 100)
	return {"ok": true, "relation": int(d.relation)}


## 달 끝 — 정전 잇기·우호 · 맺은 무장이 사라졌으면 깨짐. 알림 글 배열.
static func monthly(S: Object) -> Array:
	var msgs: Array = []
	if not on():
		return msgs
	for fid: String in st(S).keys():
		var oid := String(st(S)[fid])
		var d := _dip(S, fid)
		if not (S.roster as Array).has(oid):
			st(S).erase(fid)
			d.relation = maxi(0, int(d.relation) - BREAK_HIT)
			d.truce_months = 0
			msgs.append("💔 %s 이(가) 없어져 혼인 동맹이 깨졌다 — 우호 −%d · 정전 끝" % [_nm(oid), BREAK_HIT])
			continue
		d.truce_months = maxi(int(d.truce_months), KEEP_TRUCE)
		d.relation = mini(100, int(d.relation) + MONTH_UP)
	return msgs


static func _nm(id: String) -> String:
	var h = Characters.find(id)
	return String(h.name) if h != null else id
