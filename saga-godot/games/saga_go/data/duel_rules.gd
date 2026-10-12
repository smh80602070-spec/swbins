class_name DuelRules
extends RefCounted

## VERTICAL_SLICE.md 34절 — "duel.js를 그대로 재구현한다, 새로 설계하지 않는다".
## saga-go/js/duel.js의 판정 층(create/step/act)을 상수 하나 안 바꾸고 그대로
## 옮긴 것이다. 화면만 다르다 — 카드 무대가 아니라 실제 3D 인물이 맞붙는다
## (games/saga_go/world/bandit_encounter.gd).

const TIME_SEC := 60.0
const QUICK_CD := 0.35
const QUICK_MUL := 0.10
const QUICK_KI := 9.0
const ULT_MUL := 0.62
const KI_MAX := 100.0

const FOE_GAP := 2.6
const FOE_HEAVY := 3
const TELL_SEC := 1.1
const HEAVY_MUL := 2.4
const DODGE_CUT := 0.15
const MORALE_MUL := 3.0

## PLAN.md 101-2 GO ⑥"75초 토벌"(표준 C) — 웹판 PLAN.md §5-③ "저스트
## 회피"만 옮긴다("부위 3 파괴"는 새 부위 조준 UI가 필요해 이번 범위
## 밖으로 뺀다, 105 장에 열어 둘 것). 예고(tell)가 끝나기 직전
## JUST_DODGE_WINDOW 안에 회피하면 완전 회피(기존 DODGE_CUT 15%가 아니라
## 0%) + 기(氣) 즉시 +30% — 그보다 일찍 누른 "그냥 회피"는 기존 그대로
## DODGE_CUT만 적용된다(추가만 있고 기존 동작은 안 바뀐다, 회귀 걱정
## 없음).
const JUST_DODGE_WINDOW := 0.25
const JUST_DODGE_KI_BONUS := 0.30 # KI_MAX의 비율

## 2026-09-21 — 위 주석의 "부위 3 파괴"를 이제 옮긴다. 3D PLAN 101-2 의
## 2026-09-20 결정("Target 버튼으로 갑주→병장→기마 순환 선택")은 웹
## 실제 구현(saga-web/saga-go/PLAN.md §5-③ "구현(2026-09-17)")과 다른
## 걸 새로 설계한 것이었다 — 웹은 자리를 나누지 않고 같은 기세 풀을
## 25%/50%/75% 누적 문턱으로 읽어 파괴마다 스태거를 강제한다. "새로
## 설계하지 않는다" 원칙대로 새 조준 UI가 아니라 이 방식을 그대로
## 옮긴다. is_raid(웹의 create({raid:true}))가 꺼져 있으면(기본값,
## 산적·늑대 무리·정찰병) 전혀 안 걸린다 — "도적 두목"(토벌)만 켠다.
const STAGGER_THRESHOLDS := [0.75, 0.50, 0.25] # foe_hp 대비 남은 비율, 높은 것부터

var foe_hp := 0.0
var hp := 0.0
var foe_atk := 0.0
var my_atk := 0.0
var morale := 0.0
var morale_max := 0.0
var left := 0.0
var ki := 0.0
var cd := 0.0
var foe_t := 0.0
var foe_n := 0
var tell := 0.0
var dodged := false
var just_dodged := false
var is_raid := false
var stagger_count := 0
var _stagger_next_idx := 0

var dealt := 0.0
var hits := 0
var ults := 0
var dodge_try := 0
var dodge_ok := 0
var just_dodge_ok := 0
var taken := 0.0

var over := false
var cleared := false
var fled := false

static func create(foe_hp_in: float, my_atk_in: float, my_def_in: float, time_sec: float = TIME_SEC, is_raid_in: bool = false) -> DuelRules:
	var s := DuelRules.new()
	s.foe_hp = maxf(1.0, roundf(foe_hp_in))
	s.hp = s.foe_hp
	s.foe_atk = maxf(1.0, roundf(s.foe_hp * 0.010))
	s.my_atk = maxf(1.0, roundf(my_atk_in))
	s.morale = maxf(200.0, roundf(my_def_in * MORALE_MUL))
	s.morale_max = s.morale
	s.left = time_sec
	s.foe_t = FOE_GAP
	s.is_raid = is_raid_in
	return s

## 웹판 winChance(foeId, mine) 그대로 — 0.12~0.88 사이로 눌러 둔다.
## 이 판(3D 실시간)에서는 승패를 주사위가 아니라 실제로 기세를 다 깎았는지로
## 가르므로 전투 중에는 안 쓰인다 — 사건에 맞설지 고를 때 참고용으로만 남긴다.
static func win_chance(mine: float, foe_power: float) -> float:
	return clampf(mine / (mine + foe_power), 0.12, 0.88)

## 한 수 둔다. kind: "quick" | "ult" | "dodge"
func act(kind: String) -> Dictionary:
	if over:
		return {"ok": false, "reason": "over"}

	if kind == "dodge":
		dodge_try += 1
		if tell > 0.0:
			dodged = true
			dodge_ok += 1
			just_dodged = tell <= JUST_DODGE_WINDOW
			if just_dodged:
				just_dodge_ok += 1
			return {"ok": true, "kind": "dodge", "just": just_dodged}
		return {"ok": false, "kind": "dodge", "reason": "notell"}

	if kind == "ult":
		if ki < KI_MAX:
			return {"ok": false, "kind": "ult", "reason": "noki"}
		var big := roundf(my_atk * ULT_MUL)
		ki = 0.0
		hp -= big
		dealt += big
		ults += 1
		var staggers := _check_stagger()
		_finish_if_done()
		return {"ok": true, "kind": "ult", "dmg": big, "stagger": staggers > 0}

	if kind != "quick":
		return {"ok": false, "reason": "what"}
	if cd > 0.0:
		return {"ok": false, "kind": "quick", "reason": "cd"}
	var dmg := roundf(my_atk * QUICK_MUL * (0.9 + randf() * 0.2))
	cd = QUICK_CD
	ki = minf(KI_MAX, ki + QUICK_KI * preload("res://games/saga_go/data/go_starchart.gd").mul("ki"))   # G-0215 성도 기
	hp -= dmg
	dealt += dmg
	hits += 1
	var staggers := _check_stagger()
	_finish_if_done()
	return {"ok": true, "kind": "quick", "dmg": dmg, "stagger": staggers > 0}

## 웹 saga-web/saga-go/PLAN.md §5-③ 실제 구현 그대로 — is_raid 인스턴스만
## 남은 기세(hp/foe_hp)가 75%/50%/25% 문턱을 지날 때마다 스태거 1회씩
## 강제한다(부위 "파괴" 3회를 같은 기세 풀의 누적 문턱으로 재현). 큰 필살
## 한 번에 문턱 두 개를 넘으면 그만큼 겹쳐 돌려준다(호출부가 보상·연출을
## 문턱 수만큼 준다).
func _check_stagger() -> int:
	if not is_raid:
		return 0
	var n := 0
	while _stagger_next_idx < STAGGER_THRESHOLDS.size() and hp <= foe_hp * STAGGER_THRESHOLDS[_stagger_next_idx]:
		_stagger_next_idx += 1
		n += 1
	stagger_count += n
	return n

func _finish_if_done() -> void:
	if hp <= 0.0:
		over = true
		cleared = true

## 시간을 흘린다. 적의 차례(강타 예고 포함)도 여기서 온다 — 이게 "적 AI"다.
func step(dt: float) -> Array:
	var ev: Array = []
	if over:
		return ev

	if cd > 0.0:
		cd = maxf(0.0, cd - dt)
	left -= dt

	if tell > 0.0:
		tell -= dt
		if tell <= 0.0:
			tell = 0.0
			var heavy := roundf(foe_atk * HEAVY_MUL)
			if dodged:
				if just_dodged:
					heavy = 0.0
					ki = minf(KI_MAX, ki + KI_MAX * JUST_DODGE_KI_BONUS * preload("res://games/saga_go/data/go_starchart.gd").mul("ki"))
				else:
					heavy = roundf(heavy * DODGE_CUT)
			morale -= heavy
			taken += heavy
			ev.append({"t": "heavy", "dmg": heavy, "dodged": dodged, "just": just_dodged})
			dodged = false
			just_dodged = false
			foe_t = FOE_GAP
	else:
		foe_t -= dt
		if foe_t <= 0.0:
			foe_n += 1
			if foe_n % FOE_HEAVY == 0:
				tell = TELL_SEC
				dodged = false
				ev.append({"t": "tell"})
			else:
				var d := roundf(foe_atk * (0.85 + randf() * 0.3))
				morale -= d
				taken += d
				ev.append({"t": "hit", "dmg": d})
				foe_t = FOE_GAP

	if morale <= 0.0:
		morale = 0.0
		over = true
		cleared = false
		ev.append({"t": "rout"})
	elif left <= 0.0:
		left = 0.0
		over = true
		cleared = hp <= 0.0
		ev.append({"t": "time"})
	return ev

## 물러난다 — 그때까지 낸 만큼만 인정된다(한 대도 못 때렸으면 패배로 안 친다).
func flee() -> void:
	over = true
	fled = true
	cleared = false
