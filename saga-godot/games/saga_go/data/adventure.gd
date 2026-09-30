extends RefCounted

## PLAN 106장 ㉒ — 원신식 모험 등급·세계 등급(표·계산만). 상태는 PartyState.level(옛 부대 레벨)·wl_lowered·ar_paid.
##   모험 등급 = 옛 부대 레벨 + 1(경험 100 마다 1 — 사건·상자·들판 적·의뢰·비경이 주는 부대 경험 그대로).
##   세계 등급 0~8 — 모험 등급 5·10·15·20·25·30·35·40 에 하나씩 열린다(원신의 20·25…55 를 이 판 경험 속도에 맞춰 당김).
##   세계 등급마다 들판 적 체력 +35%·공격 +22%·냥 전리품 +25%, 3 단계마다 냥 밖의 전리품 +1. 적 머리 위에 Lv 표시.
##   한 단계 낮출 수 있다(되돌리기도 — 원신처럼). 모험 등급이 오를 때마다 보상, 5 의 배수면 인연 매듭 1 더.
##   비경 단계 잠금도 모험 등급으로(domains.gd LEVELS "ar").

const WL_AR := [1, 5, 10, 15, 20, 25, 30, 35, 40]
const WL_MAX := 8
const HP_PER_WL := 0.35
const ATK_PER_WL := 0.22
const MORA_PER_WL := 0.25
const EXTRA_ITEM_EVERY := 3
const ENEMY_LV := [8, 20, 26, 36, 45, 54, 63, 72, 85, 90, 95, 100, 105, 110, 115, 120, 125, 130, 135]
## 회차(data/cycle.gd)로 여는 세계 등급 9~18 — 모험 등급 45·50·…·90 에 하나씩. 회차 하나가 둘을 연다.
const WL_AR_EXTRA := [45, 50, 55, 60, 65, 70, 75, 80, 85, 90]
const CYCLE_WL := 2
const AR_REWARD := {"mora": 2000, "book_s": 3, "ore_s": 2}
const AR_REWARD_5 := {"fate_knot": 1}

static func ar() -> int:
	return PartyState.level + 1

## 지금 모험 등급까지 쌓인 경험 / 다음 등급까지(표시).
static func ar_progress() -> Vector2:
	var per: float = PartyState.EXP_PER_LEVEL
	return Vector2(fposmod(PartyState.exp, per), per)

static func max_world_level() -> int:
	var a := ar()
	var wl := 0
	for i in WL_AR.size():
		if a >= int(WL_AR[i]):
			wl = i
	wl = mini(wl, WL_MAX)
	if wl >= WL_MAX:
		var extra := 0
		for a2 in WL_AR_EXTRA:
			if a >= int(a2):
				extra += 1
		wl += mini(extra, CYCLE_WL * PartyState.cycle)
	return wl

## 세계 등급 n 이 열리는 모험 등급(회차가 모자라 못 열면 -1).
static func ar_for_wl(n: int) -> int:
	if n < WL_AR.size():
		return int(WL_AR[n])
	var i := n - WL_AR.size()
	if i >= WL_AR_EXTRA.size() or i >= CYCLE_WL * PartyState.cycle:
		return -1
	return int(WL_AR_EXTRA[i])

static func world_level() -> int:
	return maxi(max_world_level() - (1 if PartyState.wl_lowered else 0), 0)

static func can_lower() -> bool:
	return max_world_level() > 0

static func hp_mul(wl: int) -> float:
	return 1.0 + HP_PER_WL * float(wl)

static func atk_mul(wl: int) -> float:
	return 1.0 + ATK_PER_WL * float(wl)

static func enemy_level(wl: int) -> int:
	return ENEMY_LV[clampi(wl, 0, ENEMY_LV.size() - 1)]

## 들판 적 전리품을 세계 등급만큼 불린다(냥 비율, 그 밖은 3 단계마다 +1).
static func scale_loot(loot: Dictionary, wl: int) -> Dictionary:
	if wl <= 0:
		return loot
	var out := {}
	var extra := floori(float(wl) / EXTRA_ITEM_EVERY)
	for item in loot:
		if item == "mora":
			out[item] = roundi(float(loot[item]) * (1.0 + MORA_PER_WL * wl))
		else:
			out[item] = int(loot[item]) + extra
	return out

## 모험 등급 a 에 오를 때 받는 것.
static func reward_for(a: int) -> Dictionary:
	var r := AR_REWARD.duplicate()
	if a % 5 == 0:
		for k in AR_REWARD_5:
			r[k] = AR_REWARD_5[k]
	return r
