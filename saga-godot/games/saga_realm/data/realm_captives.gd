extends RefCounted

## G-0375 5천하 포로 처리(삼국지 — 사로잡은 적장을 어떻게 하나). 성을 뺏을 때 사로잡힌 수비 장수는 원래대로 재야(found)에 들어가고,
## 여기 captives {장수 id: 옛 세력 id} 에도 적힌다. ☰ 「🔒 포로」 창에서 하나씩:
##   등용 권유  포로 표시만 지운다 — 재야에 그대로 남아 평소 등용 명령으로 데려온다(옛 길 그대로)
##   풀어 줌    재야에서 빼 돌려보낸다 — 옛 세력과 우호 +RELEASE_REL(화친이 쉬워짐)
##   몸값       재야에서 빼고 금 RANSOM_BASE + 무력(might)·지력(wisdom) 합 × RANSOM_PER · 옛 세력 우호 RANSOM_REL(내려감)
##   등용·전사 등으로 재야에서 빠지면 포로 표시도 저절로 사라진다(prune — 창 열 때).
##   저장    RealmSaveState.captives(30→31). AI 세력은 안 씀. SAGA_CAPTIVES=0 이면 안 적음(옛 길만).

const Characters := preload("res://saga_core/data/characters.gd")
const RealmDiplo := preload("res://games/saga_realm/data/realm_diplo.gd")

const RELEASE_REL := 15
const RANSOM_REL := -10
const RANSOM_BASE := 200
const RANSOM_PER := 2


static func on() -> bool:
	return OS.get_environment("SAGA_CAPTIVES") != "0"


## 사로잡음 — _capture_city 가 재야에 넣을 때 같이 부른다.
static func record(S: Object, oid: String, force_id: String) -> void:
	if not on() or force_id == "":
		return
	(S.get("captives") as Dictionary)[oid] = force_id


## 재야에 없는 포로 표시를 지운다(등용·전사 등).
static func prune(S: Object) -> void:
	var cap: Dictionary = S.get("captives")
	var found: Array = S.get("found")
	for oid: String in cap.keys():
		if not found.has(oid):
			cap.erase(oid)


static func ids(S: Object) -> Array:
	prune(S)
	return (S.get("captives") as Dictionary).keys()


static func ransom_of(oid: String) -> int:
	var h = Characters.find(oid)
	if h == null:
		return RANSOM_BASE
	var stats: Dictionary = h.stats
	return RANSOM_BASE + (int(stats.get("might", 0)) + int(stats.get("wisdom", 0))) * RANSOM_PER


static func _rel(S: Object, force_id: String, by: int) -> int:
	var dip_all: Dictionary = S.get("diplomacy")
	var dip: Dictionary = dip_all.get(force_id, {"relation": RealmDiplo.DEFAULT_RELATION, "truce_months": 0})
	dip.relation = RealmDiplo.clamp_relation(int(dip.get("relation", RealmDiplo.DEFAULT_RELATION)) + by)
	dip_all[force_id] = dip
	return int(dip.relation)


## act = "recruit" | "release" | "ransom" → {ok, msg}
static func act(S: Object, oid: String, what: String) -> Dictionary:
	var cap: Dictionary = S.get("captives")
	if not cap.has(oid):
		return {"ok": false, "msg": "포로가 아닙니다"}
	var fid := String(cap[oid])
	var nm := name_of(oid)
	cap.erase(oid)
	match what:
		"recruit":
			return {"ok": true, "msg": "🔒 %s — 재야에 두었다(등용 명령으로 데려온다)" % nm}
		"release":
			(S.get("found") as Array).erase(oid)
			var r := _rel(S, fid, RELEASE_REL)
			return {"ok": true, "msg": "🕊️ %s 을(를) 풀어 보냈다 — 우호 %d" % [nm, r]}
		"ransom":
			(S.get("found") as Array).erase(oid)
			var g := ransom_of(oid)
			S.set("gold", int(S.get("gold")) + g)
			var r2 := _rel(S, fid, RANSOM_REL)
			return {"ok": true, "msg": "💰 %s 몸값 금 +%d — 우호 %d" % [nm, g, r2]}
	cap[oid] = fid
	return {"ok": false, "msg": "모르는 처분"}


static func name_of(oid: String) -> String:
	var h = Characters.find(oid)
	return String(h.get("name", oid)) if h != null else oid


static func restore(v: Variant) -> Dictionary:
	var out := {}
	if typeof(v) == TYPE_DICTIONARY:
		for k: Variant in (v as Dictionary):
			out[String(k)] = String((v as Dictionary)[k])
	return out
