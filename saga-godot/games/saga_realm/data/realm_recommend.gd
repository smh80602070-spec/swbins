extends RefCounted

## G-0383 5천하 인재 천거(삼국지 — 장수가 아는 인재를 추천한다). 달 끝마다(realm_rules_month monthly 묶음):
##   굴림  RealmTactics.hash01(시나리오|해|달, "recommend") < CHANCE — 결정적(같은 판 같은 달은 늘 같음, 골든 그대로 재현)
##   누가  로스터에서 지력 으뜸(같으면 id 차례) · 충성 MIN_LOYAL 이상만 — 충성 낮은 장수는 천거 안 함
##   무엇  _reveal_free() — 숨은 재야 하나가 드러난다(수색으로 찾는 것과 같은 풀). 없으면 아무 일 없음
##   덤    천거한 장수 충성 +LOYAL_GAIN(사람을 알아봐 준 데 대한 보람)
## 메시지는 달 끝 토스트 묶음에 한 줄. AI 세력은 안 씀. SAGA_RECOMMEND=0 이면 끔.

const RealmTactics := preload("res://games/saga_realm/data/realm_tactics.gd")
const Characters := preload("res://saga_core/data/characters.gd")

const CHANCE := 0.12
const MIN_LOYAL := 60
const LOYAL_GAIN := 5


static func on() -> bool:
	return OS.get_environment("SAGA_RECOMMEND") != "0"


static func _wisdom(oid: String) -> int:
	var h = Characters.find(oid)
	return int(h.stats.get("wisdom", 0)) if h != null else 0


## 천거할 장수 — 지력 으뜸·충성 문턱(순수).
static func recommender(roster: Array, loyal: Dictionary) -> String:
	var best := ""
	var bw := -1
	var ids := roster.duplicate()
	ids.sort()
	for oid: String in ids:
		if int(loyal.get(oid, 50)) < MIN_LOYAL:
			continue
		var w := _wisdom(oid)
		if w > bw:
			bw = w
			best = oid
	return best


static func rolls(scenario_id: String, year: int, month: int) -> bool:
	return RealmTactics.hash01("%s|%d|%d" % [scenario_id, year, month], "recommend") < CHANCE


static func monthly(S: Object) -> Array:
	var msgs: Array = []
	if not on() or not rolls(String(S.scenario_id), int(S.year), int(S.month)):
		return msgs
	var who := recommender(S.roster, S.officer_loyal)
	if who == "":
		return msgs
	var got: String = S.call("_reveal_free")
	if got == "":
		return msgs
	S.officer_loyal[who] = clampi(int(S.officer_loyal.get(who, 50)) + LOYAL_GAIN, 0, 100)
	msgs.append("📜 천거 — %s 이(가) %s 을(를) 추천했다(재야에 드러남 · %s 충성 +%d)" % [_name(who), _name(got), _name(who), LOYAL_GAIN])
	return msgs


static func _name(oid: String) -> String:
	var h = Characters.find(oid)
	return String(h.name) if h != null else oid
