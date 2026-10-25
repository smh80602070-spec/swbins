extends RefCounted

## G-0410 5천하 민란(코에이 삼국지 반란·문명 불만 — 치안을 버려 두면 백성이 들고일어난다). 달 끝마다(realm_rules_month monthly 묶음):
##   누가  우리 성 가운데 치안 < SEC_LINE(가만두면 달마다 −1 이라 오래 버려 둔 성)
##   굴림  RealmTactics.hash01(시나리오|해|달|성, "revolt") < CHANCE — 결정적(같은 판 같은 달은 늘 같음, 골든 그대로 재현 · _rng 안 씀)
##   피해  병력 −TROOP_CUT(진압에 든 것) · 금 −GOLD_PER_POP × 인구/1000(불탄 장터) · 진압 뒤 치안 +SEC_AFTER(한동안 잠잠)
##   다스림 치안을 올리는 명(순찰·구휼)·소식 「민심」 갈래가 막는 길 — 이미 있는 것. AI 세력은 안 씀. SAGA_REVOLT=0 이면 끔.
## 메시지는 달 끝 토스트 묶음에 한 줄.

const RealmTactics := preload("res://games/saga_realm/data/realm_tactics.gd")
const RealmCities := preload("res://games/saga_realm/data/realm_cities.gd")

const SEC_LINE := 20
const CHANCE := 0.3
const TROOP_CUT := 0.2
const GOLD_PER_POP := 3
const SEC_AFTER := 15


static func on() -> bool:
	return OS.get_environment("SAGA_REVOLT") != "0"


## 이 성이 이 달 들고일어나나(순수)
static func rolls(scenario_id: String, year: int, month: int, city_id: String, sec: int) -> bool:
	return sec < SEC_LINE and RealmTactics.hash01("%s|%d|%d|%s" % [scenario_id, year, month, city_id], "revolt") < CHANCE


## 한 성에 민란을 친다 — 잃은 {troops, gold}(순수에 가깝게: 성 사전만 고침)
static func strike(c: Dictionary) -> Dictionary:
	var lost_t := roundi(float(c.get("troops", 0)) * TROOP_CUT)
	var lost_g := GOLD_PER_POP * int(c.get("pop", 0)) / 1000
	c.troops = int(c.get("troops", 0)) - lost_t
	c.sec = clampi(int(c.get("sec", 0)) + SEC_AFTER, 0, 100)
	return {"troops": lost_t, "gold": lost_g}


static func monthly(S: Object) -> Array:
	var msgs: Array = []
	if not on():
		return msgs
	for city_id: String in (S.cities as Dictionary).keys():
		var c: Dictionary = S.cities[city_id]
		if not rolls(String(S.scenario_id), int(S.year), int(S.month), city_id, int(c.get("sec", 100))):
			continue
		var lost := strike(c)
		S.gold = maxi(0, int(S.gold) - int(lost.gold))
		msgs.append("🔥 민란 — %s 백성이 들고일어났다(병력 −%d · 금 −%d · 진압 뒤 치안 +%d) — 치안을 돌보라" % [
			String(RealmCities.any_by_id(city_id).get("name", city_id)), int(lost.troops), int(lost.gold), SEC_AFTER])
	return msgs
