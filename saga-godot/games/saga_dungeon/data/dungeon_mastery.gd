extends RefCounted

## G-0317 2나락 장비 숙련 — 써서 오르는 장비(크로니콘 — 구조만, 수치는 우리 것). 고돗이 먼저(웹·유니티 짝 없음, 장부 dungeon.md 우선 3).
##   무기 🗡️   든 무기(갑)가 처치마다 숙련 +1 → 단계마다 공격 +ATK_PCT%(atk_pct_bonus 에 더함).
##   갑주 🛡️   입은 갑주가 맞을 때마다 숙련 +1 → 단계마다 받는 피해 −GUARD_PCT%(player_health take_damage).
##   단계     숙련 STEPS 문턱(10·30·60·100·150) — 최고 5단. 단계는 물건 자체에 붙는다(it["mxp"], 저장은 장비 칸 그대로 — 버전 안 올림).
##   교체     장부 메모 "교체 동기와 부딪힘" — 무기 말고 다른 부위를 새 것으로 갈면 옛 것 숙련 절반을 물려받는다(INHERIT).
##            무기는 줍기가 옛 무기를 을로 내리므로(pick_weapon) 숙련이 그대로 남아 물려받기 없음.
## SAGA_MASTERY=0 이면 끔(쌓기·효과 둘 다).

const STEPS := [10, 30, 60, 100, 150]
const ATK_PCT := 3.0
const GUARD_PCT := 2.0
const INHERIT := 0.5


static func on() -> bool:
	return OS.get_environment("SAGA_MASTERY") != "0"


static func xp(it: Dictionary) -> int:
	return int(it.get("mxp", 0))


static func level_of(n: int) -> int:
	var lv := 0
	for s: int in STEPS:
		if n >= s:
			lv += 1
	return lv


static func level(it: Dictionary) -> int:
	return level_of(xp(it)) if on() else 0


## 숙련 +n — 단계가 올랐으면 새 단계, 아니면 0. 빈 칸(맨손·갑주 없음)은 안 쌓는다.
static func gain(it: Dictionary, n: int = 1) -> int:
	if not on() or it.is_empty() or n <= 0:
		return 0
	var before := level_of(xp(it))
	it["mxp"] = mini(xp(it) + n, int(STEPS[STEPS.size() - 1]))
	var after := level_of(xp(it))
	return after if after > before else 0


static func atk_pct(weapon: Dictionary) -> float:
	return ATK_PCT * level(weapon)


static func guard_mul(armor: Dictionary) -> float:
	return 1.0 - GUARD_PCT * level(armor) / 100.0


## 무기 말고 다른 부위 교체 — 새 것이 옛 것 숙련 절반을 물려받는다(더 높으면 그대로).
static func inherit(slot_name: String, old: Dictionary, it: Dictionary) -> void:
	if not on() or slot_name == "weapon" or old.is_empty() or it.is_empty() or old == it:
		return
	it["mxp"] = maxi(xp(it), int(xp(old) * INHERIT))


## 알림 글 — 단계가 오른 순간
static func up_text(what: String, lv: int) -> String:
	if what == "weapon":
		return "🗡️ 무기가 손에 익었다 — 숙련 %d단 (공격 +%d%%)" % [lv, int(ATK_PCT * lv)]
	return "🛡️ 갑주가 몸에 익었다 — 숙련 %d단 (받는 피해 −%d%%)" % [lv, int(GUARD_PCT * lv)]


## 무장 줄·「내 정보」 꼬리 — 숙련 없으면 ""
static func tag(it: Dictionary) -> String:
	var lv := level(it)
	return "" if lv <= 0 else " ★%d" % lv
