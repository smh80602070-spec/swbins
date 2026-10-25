extends RefCounted

## G-0400 1만리 고유 보패(디아블로 고유 — 구조만) — 웹 saga-web/saga-go/js/artifact-unique.js(W-0438 ②) 짝, 수치 그대로.
##   ★5 가 나올 때 CHANCE(8%)로 고유(art.uq = key, 순수 추가 — 세이브 버전 그대로).
##   고정   그 고유의 능력치 한 줄(stats → PartyState.stat) + 4 세트급 효과 한 줄(four → PartyState.set4)을 세트와 따로 더한다
##   이름   보패 이름 앞에 「⭐ <고유 이름> · 」
##   굴림   보패 씨앗에서 따로 뽑는 난수(seed × 7 + 3) — 다른 굴림(주·부옵션)은 그대로라 같은 씨앗이면 늘 같다(고돗 RNG 라 웹과 같은 씨앗이 같은 결과는 아님)
## UQ 표는 대역 넷 — K 생성기 표(W-0435: 고유 보패 40)가 오면 줄만 늘린다. SAGA_ART_UNIQUE=0 이면 끔.

const CHANCE := 0.08
const UQ := {
	"uq_mugwang": {"name": "무광 비녀", "stats": {"atk_pct": 0.12}, "four": {"normal_melee": 0.2}, "desc": "공격력 +12% · 칼·대도·창 기본 공격 피해 +20%"},
	"uq_pungnyu": {"name": "풍류 피리", "stats": {"energy": 0.2}, "four": {"react_swirl": 0.3}, "desc": "기력 획득 +20% · 회오리 피해 +30%"},
	"uq_ilgwang": {"name": "일광 가락지", "stats": {"crit_rate": 0.08}, "four": {"skill_dmg": 0.15}, "desc": "치명 확률 +8% · 원소 스킬 피해 +15%"},
	"uq_hwaseong": {"name": "화성 향낭", "stats": {"elem_fire": 0.15}, "four": {"react_fire": 0.2}, "desc": "화 피해 +15% · 물안개·녹임·터짐·들불 피해 +20%"},
}
const KEYS := ["uq_mugwang", "uq_pungnyu", "uq_ilgwang", "uq_hwaseong"]


static func on() -> bool:
	return OS.get_environment("SAGA_ART_UNIQUE") != "0"


## 새 보패 굴림 — ★5 만, 씨앗으로 정해짐. 고유 key 또는 ""
static func roll(seed_value: int, rarity: int) -> String:
	if not on() or rarity < 5:
		return ""
	var r := RandomNumberGenerator.new()
	r.seed = (seed_value * 7 + 3) & 0x7fffffff
	if r.randf() >= CHANCE:
		return ""
	return String(KEYS[r.randi() % KEYS.size()])


static func _uq(art: Dictionary) -> Dictionary:
	var k := String(art.get("uq", ""))
	return UQ.get(k, {}) if on() and k != "" else {}


## 고유 능력치 한 줄(그 key 만)
static func stat(art: Dictionary, key: String) -> float:
	return float((_uq(art).get("stats", {}) as Dictionary).get(key, 0.0))


## 고유 4 세트급 효과(그 key 만)
static func four(art: Dictionary, key: String) -> float:
	return float((_uq(art).get("four", {}) as Dictionary).get(key, 0.0))


static func name_prefix(art: Dictionary) -> String:
	var u := _uq(art)
	return "⭐ %s · " % String(u.name) if not u.is_empty() else ""
