extends RefCounted

## G-0373 3마을 낚시 대회(동물의숲 — 정해진 날 큰 고기 겨루기). 고돗 3마을 물고기는 종·크기 없이 "물고기" 한 가지라 대회 날에만 크기를 잰다:
##   날     일요일(ForestDay.epoch_day_index — 1970-01-01 목요일 기준 (날+4)%7 == 0, 순무 시세와 같은 셈)
##   크기   낚을 때 입질 창 안에서 얼마나 빨리 당겼나(quality 1 = 입질 곧바로) — BASE_CM + SPAN_CM×quality + 운 0~LUCK_CM
##   상     그날 큰 셋의 합이 TIERS 문턱을 넘을 때마다 금(PRIZES) — 그 자리에서. 날이 바뀌면 새 대회.
##   저장   ForestSaveState.contest = {day, sizes:[…], tier} — 순수 추가 칸(버전 안 올림, forest_brew 와 같은 꼴). SAGA_CONTEST=0 이면 끔.
## F = ForestSaveState.

const BASE_CM := 15
const SPAN_CM := 40
const LUCK_CM := 15
const KEEP := 3
const TIERS := [90, 120, 150]
const PRIZES := [300, 800, 2000]
const TIER_NAMES := ["동상", "은상", "금상"]


static func on() -> bool:
	return OS.get_environment("SAGA_CONTEST") != "0"


static func is_day(epoch_day: int) -> bool:
	return on() and posmod(epoch_day + 4, 7) == 0


static func days_until(epoch_day: int) -> int:
	return posmod(-(epoch_day + 4), 7)


## 오늘 대회 상태 — 다른 날 것이면 새로.
static func st(F: Node, epoch_day: int) -> Dictionary:
	var c: Variant = F.get("contest")
	if typeof(c) != TYPE_DICTIONARY or int((c as Dictionary).get("day", -1)) != epoch_day:
		c = {"day": epoch_day, "sizes": [], "tier": 0}
		F.set("contest", c)
	return c


static func size_of(quality: float, luck: float) -> int:
	return BASE_CM + roundi(SPAN_CM * clampf(quality, 0.0, 1.0)) + roundi(LUCK_CM * clampf(luck, 0.0, 1.0))


static func total(sizes: Array) -> int:
	var s := sizes.duplicate()
	s.sort()
	s.reverse()
	var t := 0
	for i in mini(KEEP, s.size()):
		t += int(s[i])
	return t


## 대회 날 한 마리 — {size, total, prize, tier_name}(상 없으면 prize 0). 대회 날이 아니면 {}.
static func on_catch(F: Node, epoch_day: int, quality: float, luck: float) -> Dictionary:
	if not is_day(epoch_day):
		return {}
	var c := st(F, epoch_day)
	var sz := size_of(quality, luck)
	(c.sizes as Array).append(sz)
	var t := total(c.sizes)
	var prize := 0
	var nm := ""
	while int(c.tier) < TIERS.size() and t >= int(TIERS[int(c.tier)]):
		prize += int(PRIZES[int(c.tier)])
		nm = String(TIER_NAMES[int(c.tier)])
		c.tier = int(c.tier) + 1
	if prize > 0:
		F.call("add_gold", prize)
	return {"size": sz, "total": t, "prize": prize, "tier_name": nm}


static func toast_text(r: Dictionary) -> String:
	if r.is_empty():
		return ""
	var s := "🏆 낚시 대회 — %dcm! (큰 셋 합 %dcm)" % [int(r.size), int(r.total)]
	if int(r.prize) > 0:
		s += " · %s 금 +%d" % [String(r.tier_name), int(r.prize)]
	return s


## 「오늘」 창 줄 — 대회 날이면 합/다음 문턱, 아니면 며칠 뒤.
static func row(F: Node, epoch_day: int) -> Dictionary:
	if not on():
		return {}
	if not is_day(epoch_day):
		return {"label": "낚시 대회 — %d일 뒤 일요일" % days_until(epoch_day), "cur": 0, "max": 0, "done": false}
	var c := st(F, epoch_day) if F != null else {"sizes": [], "tier": 0}
	var t := total(c.sizes)
	var tier := int(c.tier)
	if tier >= TIERS.size():
		return {"label": "🏆 낚시 대회 금상 — 큰 셋 합 %dcm" % t, "cur": t, "max": t, "done": true}
	return {"label": "🏆 낚시 대회 — 큰 셋 합(%s %dcm)" % [String(TIER_NAMES[tier]), int(TIERS[tier])], "cur": t, "max": int(TIERS[tier]), "done": false}
