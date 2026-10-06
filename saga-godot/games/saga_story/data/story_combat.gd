class_name StoryCombat
extends StoryCombatBase

## 사가스토리 전투 표의 뒤쪽 절반 — 무예 수치·거리 환산(전사·궁수·협객·방사 1~4차, 직업 16개).
## 앞쪽 절반(전투 공식·장비·사명·업적·직업 표·무예 표)은 story_combat_base.gd(StoryCombatBase)에 있고,
## 이 파일이 그걸 상속해 `StoryCombat.<이름>` 으로 둘 다 읽힌다(R-4, 파일 줄 수 상한 1,500줄 — 호출부 변경 0).

const WARRIOR_CUT_COST := 6.0
const WARRIOR_CUT_CD := 0.5
const WARRIOR_CUT_BASE := 1.15
const WARRIOR_CUT_PER := 0.09  # 레벨10에서 2.05

const WARRIOR_WHIRL_COST := 20.0
const WARRIOR_WHIRL_CD := 3.6
const WARRIOR_WHIRL_BASE := 1.6
const WARRIOR_WHIRL_PER := 0.14
const WARRIOR_WHIRL_RANGE_MUL := 128.0 / 78.0

const WARRIOR_RUSH_COST := 24.0
const WARRIOR_RUSH_CD := 6.0
const WARRIOR_RUSH_BASE := 1.8
const WARRIOR_RUSH_PER := 0.16
const WARRIOR_RUSH_DIST_PX := 210.0
const WARRIOR_RUSH_SCALE := 0.02  # field_map.gd SCALE과 같다

const WARRIOR_IRON_COST := 28.0
const WARRIOR_IRON_CD := 16.0
const WARRIOR_IRON_SEC := 9.0
const WARRIOR_IRON_ATK_MUL := 1.2
const WARRIOR_IRON_GUARD := 0.35


static func warrior_rush_dist_m() -> float:
	return WARRIOR_RUSH_DIST_PX * WARRIOR_RUSH_SCALE


## G-0036 — 사냥터 쓰러짐(재미 표준 F). side.js die()의 `goldKept =
## round(run.gold * 0.5)` 그대로: 이번 사냥터에서 주운 금의 절반만 남는다.
## 경험치·장비·도감은 그대로(죽어도 남는 것). 비경은 따로(패퇴).
const FALL_GOLD_KEEP := 0.5


static func fall_gold_lost(gained: int) -> int:
	var g := maxi(0, gained)
	return g - roundi(g * FALL_GOLD_KEEP)


## **2026-09-13 추가(같은 날 더 더 더) — 무사 다섯째·여섯째 무예
## (파공검·생기결).** data-job.js SKILLS job:'warrior' 나머지 둘 —
## w_edge는 원문 effect가 이미 'bolt'(기탄과 같은 재해석, 사거리 2배).
## w_vital은 이 포트에 tier1 최초의 heal(치유는 mage 몫이었는데, 무사도
## 자가 치유를 갖는다 — mage m_heal과 같은 공식을 그대로 재사용).
const WARRIOR_EDGE_COST := 18.0
const WARRIOR_EDGE_CD := 5.0
const WARRIOR_EDGE_BASE := 1.6
const WARRIOR_EDGE_PER := 0.14
const WARRIOR_EDGE_RANGE_MUL := 2.0  # BOLT_RANGE_MUL과 같은 재해석, warrior 몫

const WARRIOR_VITAL_COST := 24.0
const WARRIOR_VITAL_CD := 18.0
const WARRIOR_VITAL_BASE := 0.14
const WARRIOR_VITAL_PER := 0.016


## **2026-09-13 추가(같은 날 더) — 전직 트리 다음 걸음: 궁수(archer)
## 무예 넷.** data-job.js SKILLS job:'archer' 넷(a_shot/a_double/
## a_pierce/a_eye) — 무사와 같은 FIXED_SKILL_LEVEL(5)로 mul 고정.
##
## effect 문자열이 무사 넷과 다르다('arrow'/'volley'는 이 포트에 처음
## 등장) — 둘 다 원문에 사거리(r/dist)가 없어(무사 참격과 같은 자리)
## **정면 판정+ATTACK_RANGE**로 좁힌다(활이라고 사거리를 늘리는 건 새
## 숫자를 상상하는 것이라 안 한다). a_pierce는 원문 effect가 이미
## 'bolt'라 기탄(BOLT_RANGE_MUL)과 같은 결로 사거리를 2배 늘린다 — 새
## 상수가 아니라 같은 재해석을 archer 몫으로 하나 더 둔 것뿐.
const ARCHER_SHOT_COST := 8.0
const ARCHER_SHOT_CD := 0.6
const ARCHER_SHOT_BASE := 1.3
const ARCHER_SHOT_PER := 0.11

## a_double(연사) — 원문 effect:'volley', shots:3(화살 셋을 잇달아).
## 투사체가 없어 "정면 판정을 세 번 잇달아 적용"으로 재해석(w_whirl이
## aoe를 한 번 도는 것과 같은 결 — 여러 번의 개별 roll_damage를 그대로
## 잇는다, 새 효과를 안 만든다).
const ARCHER_DOUBLE_COST := 22.0
const ARCHER_DOUBLE_CD := 3.4
const ARCHER_DOUBLE_BASE := 1.1
const ARCHER_DOUBLE_PER := 0.08
const ARCHER_DOUBLE_SHOTS := 3

const ARCHER_PIERCE_COST := 26.0
const ARCHER_PIERCE_CD := 6.0
const ARCHER_PIERCE_BASE := 2.0
const ARCHER_PIERCE_PER := 0.18
const ARCHER_PIERCE_RANGE_MUL := 2.0  # BOLT_RANGE_MUL과 같은 재해석, archer 몫

## a_eye(응안) — buff. sec:9·atk×1.4 원문 그대로(레벨로 안 오르는 buff
## 필드, 철갑과 같은 결 — WARRIOR_IRON_ATK_MUL도 FIXED_SKILL_LEVEL을
## 안 곱한다). guard 성분은 원문에 없다(철갑만의 것).
const ARCHER_EYE_COST := 30.0
const ARCHER_EYE_CD := 16.0
const ARCHER_EYE_SEC := 9.0
const ARCHER_EYE_ATK_MUL := 1.4


## **2026-09-13 추가(같은 날 더 더 더) — 궁수 다섯째·여섯째 무예
## (퇴보사·환시).** a_retreat는 dash지만 원문 자체가 "뒤로 물러나며"라
## _cast_archer_retreat()가 이동 방향을 반대로 뒤집는다(다른 dash류는
## 전부 전진). a_burst는 원문 effect가 이미 'aoe'(선풍각과 같은 재해석).
const ARCHER_RETREAT_COST := 20.0
const ARCHER_RETREAT_CD := 6.0
const ARCHER_RETREAT_BASE := 1.3
const ARCHER_RETREAT_PER := 0.11
const ARCHER_RETREAT_DIST_PX := 180.0

const ARCHER_BURST_COST := 20.0
const ARCHER_BURST_CD := 5.0
const ARCHER_BURST_BASE := 1.4
const ARCHER_BURST_PER := 0.12
const ARCHER_BURST_RANGE_MUL := 110.0 / 78.0


static func archer_retreat_dist_m() -> float:
	return ARCHER_RETREAT_DIST_PX * WARRIOR_RUSH_SCALE


## **2026-09-13 추가(같은 날 더) — 전직 트리 다음 걸음: 협객(rogue)
## 무예 넷.** data-job.js SKILLS job:'rogue' 넷(r_twin/r_knife/r_step/
## r_vital) — 같은 FIXED_SKILL_LEVEL(5).
##
## r_twin은 원문 effect가 이미 'melee'에 hits:2 — a_double(volley)과
## 같은 재해석(정면 판정을 그 횟수만큼 잇달아 적용)을 그대로 재사용,
## 새 효과를 안 만든다.
const ROGUE_TWIN_COST := 7.0
const ROGUE_TWIN_CD := 0.42
const ROGUE_TWIN_BASE := 0.72
const ROGUE_TWIN_PER := 0.06
const ROGUE_TWIN_HITS := 2

const ROGUE_KNIFE_COST := 18.0
const ROGUE_KNIFE_CD := 2.6
const ROGUE_KNIFE_BASE := 1.0
const ROGUE_KNIFE_PER := 0.09
const ROGUE_KNIFE_SHOTS := 2

## r_step(은신보) — dash, dist:260px + **invuln:0.7(이 포트에 처음
## 등장)**. side.js dash 처리(`p.invuln = Math.max(p.invuln, sk.invuln)`,
## hurtMe()가 invuln>0이면 피해를 통째로 무시)를 story_player.gd의 공용
## `_invuln_time_left`로 옮긴다 — take_damage()가 그 값이 0보다 크면
## 방어 컷 계산 전에 그냥 무시한다. dist는 WARRIOR_RUSH_SCALE(0.02, 같은
## field_map.gd SCALE)로 미터 환산.
const ROGUE_STEP_COST := 22.0
const ROGUE_STEP_CD := 7.0
const ROGUE_STEP_BASE := 1.2
const ROGUE_STEP_PER := 0.1
const ROGUE_STEP_DIST_PX := 260.0
const ROGUE_STEP_INVULN_SEC := 0.7

const ROGUE_VITAL_COST := 26.0
const ROGUE_VITAL_CD := 15.0
const ROGUE_VITAL_SEC := 8.0
const ROGUE_VITAL_ATK_MUL := 1.55


## **2026-09-13 추가(같은 날 더 더 더) — 협객 다섯째·여섯째 무예
## (선풍각·관통표).** r_whirl은 원문 effect가 이미 'aoe'(선풍과 같은
## 재해석), r_dart는 이미 'bolt'(기탄과 같은 재해석, 사거리 2배).
const ROGUE_WHIRL_COST := 20.0
const ROGUE_WHIRL_CD := 5.0
const ROGUE_WHIRL_BASE := 1.4
const ROGUE_WHIRL_PER := 0.12
const ROGUE_WHIRL_RANGE_MUL := 110.0 / 78.0

const ROGUE_DART_COST := 18.0
const ROGUE_DART_CD := 5.0
const ROGUE_DART_BASE := 1.6
const ROGUE_DART_PER := 0.14
const ROGUE_DART_RANGE_MUL := 2.0  # BOLT_RANGE_MUL과 같은 재해석, rogue 몫


static func rogue_step_dist_m() -> float:
	return ROGUE_STEP_DIST_PX * WARRIOR_RUSH_SCALE


## **2026-09-13 추가(같은 날 더) — 전직 트리 다음 걸음: 방사(mage)
## 무예 넷.** data-job.js SKILLS job:'mage' 넷(m_fire/m_bolt/m_heal/
## m_talis) — 같은 FIXED_SKILL_LEVEL(5).
##
## m_fire는 원문 effect가 이미 'bolt' — 기탄·관통시와 같은 재해석(사거리
## 2배). m_bolt(aoe, r:165px)는 선풍(w_whirl)과 같은 결로 REACH(78px)비를
## 옮긴다(165/78).
const MAGE_FIRE_COST := 12.0
const MAGE_FIRE_CD := 0.9
const MAGE_FIRE_BASE := 1.5
const MAGE_FIRE_PER := 0.13
const MAGE_FIRE_RANGE_MUL := 2.0  # BOLT_RANGE_MUL과 같은 재해석, mage 몫

const MAGE_BOLT_COST := 26.0
const MAGE_BOLT_CD := 4.0
const MAGE_BOLT_BASE := 1.9
const MAGE_BOLT_PER := 0.17
const MAGE_BOLT_RANGE_MUL := 165.0 / 78.0

## m_heal(치유) — **이 포트에 처음 등장하는 effect:'heal'.** side.js
## heal 처리(`pct = heal[0] + heal[1]*max(0,lv-1); hp = min(hpMax, hp +
## round(hpMax*pct))`) 그대로 옮기되, mul과 같은 결로 레벨을 직접 곱한다
## (skill_mul()과 같은 공식 — heal도 새 규칙을 따로 안 만든다).
const MAGE_HEAL_COST := 34.0
const MAGE_HEAL_CD := 11.0
const MAGE_HEAL_BASE := 0.18
const MAGE_HEAL_PER := 0.022

## m_talis(부적) — buff, sec:10·atk×1.25·**regen:2.6(이 포트에 처음
## 등장 — MP 회복 속도 배율)** 원문 그대로. side.js MP_REGEN*bf.regen과
## 같은 자리를 story_player.gd `_physics_process()`의 mp 회복 줄에 얹는다.
const MAGE_TALIS_COST := 30.0
const MAGE_TALIS_CD := 16.0
const MAGE_TALIS_SEC := 10.0
const MAGE_TALIS_ATK_MUL := 1.25
const MAGE_TALIS_REGEN_MUL := 2.6


## **2026-09-13 추가(같은 날 더 더 더) — 방사 다섯째·여섯째 무예
## (축지·마탄).** m_step은 dash+invuln:0.5(은신보와 같은 구조). m_orb는
## 원문 effect가 이미 'volley'(연사와 같은 재해석).
const MAGE_STEP_COST := 22.0
const MAGE_STEP_CD := 7.0
const MAGE_STEP_BASE := 1.2
const MAGE_STEP_PER := 0.1
const MAGE_STEP_DIST_PX := 220.0
const MAGE_STEP_INVULN_SEC := 0.5

const MAGE_ORB_COST := 22.0
const MAGE_ORB_CD := 3.4
const MAGE_ORB_BASE := 1.1
const MAGE_ORB_PER := 0.08
const MAGE_ORB_SHOTS := 3


static func mage_step_dist_m() -> float:
	return MAGE_STEP_DIST_PX * WARRIOR_RUSH_SCALE


## **2026-09-13 추가(같은 날 더 더) — tier2 무예 열둘.** SKILL_NEED 머리말
## 참고. 사거리 배율(r/dist px → 배율)은 위 tier1과 같은 방식으로
## REACH(78px)비·WARRIOR_RUSH_SCALE(0.02)을 그대로 재사용한다 — job마다
## 새 환산 규칙을 만들지 않는다.

## 패왕격(g_smash) — melee, hits:2. 참격(w_cut)과 같은 정면 판정.
const GENERAL_SMASH_COST := 40.0
const GENERAL_SMASH_CD := 9.0
const GENERAL_SMASH_BASE := 3.4
const GENERAL_SMASH_PER := 0.3
const GENERAL_SMASH_HITS := 2

## 함성(g_roar) — aoe, r:190px.
const GENERAL_ROAR_COST := 34.0
const GENERAL_ROAR_CD := 14.0
const GENERAL_ROAR_BASE := 2.4
const GENERAL_ROAR_PER := 0.2
const GENERAL_ROAR_RANGE_MUL := 190.0 / 78.0

## 철벽(g_wall) — buff. sec:11·atk×1.15·guard0.5 원문 그대로.
const GENERAL_WALL_COST := 38.0
const GENERAL_WALL_CD := 20.0
const GENERAL_WALL_SEC := 11.0
const GENERAL_WALL_ATK_MUL := 1.15
const GENERAL_WALL_GUARD := 0.5

## 전우(s_rain) — 원문 effect:'rain'. 원문에 별도 사거리·반경이 없어(rain
## 류 공통 — data-job.js 어느 rain 항목도 r/dist가 없다) 사격(a_shot)과
## 같은 단순 정면 판정으로 재해석.
const SNIPER_RAIN_COST := 42.0
const SNIPER_RAIN_CD := 10.0
const SNIPER_RAIN_BASE := 2.6
const SNIPER_RAIN_PER := 0.24

## 일점사(s_snipe) — bolt. 관통시(a_pierce)와 같은 재해석(사거리 2배).
const SNIPER_SNIPE_COST := 36.0
const SNIPER_SNIPE_CD := 8.0
const SNIPER_SNIPE_BASE := 4.0
const SNIPER_SNIPE_PER := 0.34
const SNIPER_SNIPE_RANGE_MUL := 2.0

## 분시(s_split) — volley(shots:4). 연사(a_double)와 같은 재해석(정면
## 판정을 그 횟수만큼 잇달아 적용).
const SNIPER_SPLIT_COST := 34.0
const SNIPER_SPLIT_CD := 5.0
const SNIPER_SPLIT_BASE := 1.5
const SNIPER_SPLIT_PER := 0.12
const SNIPER_SPLIT_SHOTS := 4

## 난무(x_storm) — melee, hits:4.
const ASSASSIN_STORM_COST := 38.0
const ASSASSIN_STORM_CD := 8.0
const ASSASSIN_STORM_BASE := 1.5
const ASSASSIN_STORM_PER := 0.13
const ASSASSIN_STORM_HITS := 4

## 만천화우(x_fan) — volley(shots:5).
const ASSASSIN_FAN_COST := 40.0
const ASSASSIN_FAN_CD := 9.0
const ASSASSIN_FAN_BASE := 1.4
const ASSASSIN_FAN_PER := 0.12
const ASSASSIN_FAN_SHOTS := 5

## 그림자밟기(x_shadow) — dash, dist:300px + invuln:0.9. 은신보(r_step)와
## 같은 순서(경로 판정 → 순간이동, 무적시간 포함).
const ASSASSIN_SHADOW_COST := 32.0
const ASSASSIN_SHADOW_CD := 6.0
const ASSASSIN_SHADOW_BASE := 2.0
const ASSASSIN_SHADOW_PER := 0.17
const ASSASSIN_SHADOW_DIST_PX := 300.0
const ASSASSIN_SHADOW_INVULN_SEC := 0.9


static func assassin_shadow_dist_m() -> float:
	return ASSASSIN_SHADOW_DIST_PX * WARRIOR_RUSH_SCALE


## 지진(p_quake) — aoe, r:230px.
const SAGE_QUAKE_COST := 44.0
const SAGE_QUAKE_CD := 10.0
const SAGE_QUAKE_BASE := 3.2
const SAGE_QUAKE_PER := 0.28
const SAGE_QUAKE_RANGE_MUL := 230.0 / 78.0

## 천뢰(p_beam) — 원문 effect:'rain'. s_rain과 같은 단순 정면 재해석.
const SAGE_BEAM_COST := 40.0
const SAGE_BEAM_CD := 9.0
const SAGE_BEAM_BASE := 3.0
const SAGE_BEAM_PER := 0.26

## 호신부(p_ward) — buff. sec:12·atk×1.1·guard0.4·regen3.2 원문 그대로.
const SAGE_WARD_COST := 36.0
const SAGE_WARD_CD := 18.0
const SAGE_WARD_SEC := 12.0
const SAGE_WARD_ATK_MUL := 1.1
const SAGE_WARD_GUARD := 0.4
const SAGE_WARD_REGEN_MUL := 3.2


## **2026-09-13 추가(같은 날 더 더 더) — tier2 나머지 여덟(SKILL_NEED
## 머리말 참고).** 이걸로 data-job.js tier2 스물(4갈래×5개)이 전부
## 옮겨졌다.

## 벽공검(g_edge) — bolt. 파공검(w_edge)과 같은 재해석(사거리 2배).
const GENERAL_EDGE_COST := 32.0
const GENERAL_EDGE_CD := 7.0
const GENERAL_EDGE_BASE := 2.8
const GENERAL_EDGE_PER := 0.24
const GENERAL_EDGE_RANGE_MUL := 2.0

## 회천결(g_vital) — heal. 생기결(w_vital)과 같은 공식.
const GENERAL_VITAL_COST := 36.0
const GENERAL_VITAL_CD := 20.0
const GENERAL_VITAL_BASE := 0.26
const GENERAL_VITAL_PER := 0.024

## 활보사(s_retreat) — dash, dist:240px. 퇴보사(a_retreat)와 같은
## 재해석(뒤로 물러난다).
const SNIPER_RETREAT_COST := 34.0
const SNIPER_RETREAT_CD := 7.0
const SNIPER_RETREAT_BASE := 2.3
const SNIPER_RETREAT_PER := 0.2
const SNIPER_RETREAT_DIST_PX := 240.0


static func sniper_retreat_dist_m() -> float:
	return SNIPER_RETREAT_DIST_PX * WARRIOR_RUSH_SCALE


## 광환시(s_burst) — aoe, r:140px. 환시(a_burst)와 같은 재해석.
const SNIPER_BURST_COST := 34.0
const SNIPER_BURST_CD := 6.0
const SNIPER_BURST_BASE := 2.4
const SNIPER_BURST_PER := 0.21
const SNIPER_BURST_RANGE_MUL := 140.0 / 78.0

## 질풍각(x_whirl) — aoe, r:140px. 선풍각(r_whirl)과 같은 재해석.
const ASSASSIN_WHIRL_COST := 34.0
const ASSASSIN_WHIRL_CD := 6.0
const ASSASSIN_WHIRL_BASE := 2.4
const ASSASSIN_WHIRL_PER := 0.21
const ASSASSIN_WHIRL_RANGE_MUL := 140.0 / 78.0

## 암습표(x_dart) — bolt. 관통표(r_dart)와 같은 재해석(사거리 2배).
const ASSASSIN_DART_COST := 32.0
const ASSASSIN_DART_CD := 7.0
const ASSASSIN_DART_BASE := 2.8
const ASSASSIN_DART_PER := 0.24
const ASSASSIN_DART_RANGE_MUL := 2.0

## 축지술(p_step) — dash, dist:280px + invuln:0.7. 축지(m_step)와 같은
## 재해석(더 크게 나아간다).
const SAGE_STEP_COST := 36.0
const SAGE_STEP_CD := 8.0
const SAGE_STEP_BASE := 2.0
const SAGE_STEP_PER := 0.17
const SAGE_STEP_DIST_PX := 280.0
const SAGE_STEP_INVULN_SEC := 0.7


static func sage_step_dist_m() -> float:
	return SAGE_STEP_DIST_PX * WARRIOR_RUSH_SCALE


## 연환탄(p_orb) — volley(shots:4). 마탄(m_orb)과 같은 재해석.
const SAGE_ORB_COST := 34.0
const SAGE_ORB_CD := 5.0
const SAGE_ORB_BASE := 1.5
const SAGE_ORB_PER := 0.12
const SAGE_ORB_SHOTS := 4


## **2026-09-13 추가(같은 날 더 더 더 더) — tier3 무예 스물넷(원수·비장·
## 귀영·진인 각 여섯).** SKILL_NEED 머리말 참고 — tier1·tier2가 전부
## 있어 갈래마다 여섯 개 전부(원문 그대로) 채웠다. `f_focus`(원문
## speed:1.15)가 이 포트 job 버프 중 처음으로 이동속도 배율을 갖는다 —
## `_job_buff_speed_mul`(story_player.gd 신규, 기본 1.0)을 추가해 `_walk()`
## 속도 계산에 곱한다(BRACE_SPEED_MUL과 같은 자리, 별도 곱).

## 천붕격(n_heaven) — melee, hits:3.
const MARSHAL_HEAVEN_COST := 58.0
const MARSHAL_HEAVEN_CD := 11.0
const MARSHAL_HEAVEN_BASE := 4.6
const MARSHAL_HEAVEN_PER := 0.42
const MARSHAL_HEAVEN_HITS := 3

## 진각(n_quake) — aoe, r:264px.
const MARSHAL_QUAKE_COST := 52.0
const MARSHAL_QUAKE_CD := 12.0
const MARSHAL_QUAKE_BASE := 3.6
const MARSHAL_QUAKE_PER := 0.32
const MARSHAL_QUAKE_RANGE_MUL := 264.0 / 78.0

## 철기돌격(n_charge) — dash, dist:330px.
const MARSHAL_CHARGE_COST := 48.0
const MARSHAL_CHARGE_CD := 9.0
const MARSHAL_CHARGE_BASE := 3.2
const MARSHAL_CHARGE_PER := 0.28
const MARSHAL_CHARGE_DIST_PX := 330.0


static func marshal_charge_dist_m() -> float:
	return MARSHAL_CHARGE_DIST_PX * WARRIOR_RUSH_SCALE


## 대장기(n_banner) — buff. sec:13·atk×1.55·guard0.45·regen1.8 원문 그대로.
const MARSHAL_BANNER_COST := 56.0
const MARSHAL_BANNER_CD := 24.0
const MARSHAL_BANNER_SEC := 13.0
const MARSHAL_BANNER_ATK_MUL := 1.55
const MARSHAL_BANNER_GUARD := 0.45
const MARSHAL_BANNER_REGEN_MUL := 1.8

## 천단검(n_edge) — bolt. 벽공검(g_edge)과 같은 재해석(사거리 2배).
const MARSHAL_EDGE_COST := 44.0
const MARSHAL_EDGE_CD := 9.0
const MARSHAL_EDGE_BASE := 4.0
const MARSHAL_EDGE_PER := 0.35
const MARSHAL_EDGE_RANGE_MUL := 2.0

## 불사결(n_vital) — heal.
const MARSHAL_VITAL_COST := 48.0
const MARSHAL_VITAL_CD := 22.0
const MARSHAL_VITAL_BASE := 0.4
const MARSHAL_VITAL_PER := 0.034

## 시우(f_storm) — 원문 effect:'rain', 전우(s_rain)와 같은 단순 정면 재해석.
const FLIER_STORM_COST := 60.0
const FLIER_STORM_CD := 12.0
const FLIER_STORM_BASE := 4.2
const FLIER_STORM_PER := 0.38

## 파천시(f_pierce) — bolt. 일점사(s_snipe)와 같은 재해석(사거리 2배).
const FLIER_PIERCE_COST := 54.0
const FLIER_PIERCE_CD := 9.0
const FLIER_PIERCE_BASE := 6.4
const FLIER_PIERCE_PER := 0.55
const FLIER_PIERCE_RANGE_MUL := 2.0

## 만시(f_volley) — volley(shots:8). 분시(s_split)와 같은 재해석.
const FLIER_VOLLEY_COST := 50.0
const FLIER_VOLLEY_CD := 7.0
const FLIER_VOLLEY_BASE := 1.9
const FLIER_VOLLEY_PER := 0.16
const FLIER_VOLLEY_SHOTS := 8

## 정심(f_focus) — buff. sec:12·atk×1.75·**speed×1.15(job 버프 최초의
## 이동속도 배율)** 원문 그대로.
const FLIER_FOCUS_COST := 46.0
const FLIER_FOCUS_CD := 22.0
const FLIER_FOCUS_SEC := 12.0
const FLIER_FOCUS_ATK_MUL := 1.75
const FLIER_FOCUS_SPEED_MUL := 1.15

## 답공사(f_retreat) — dash, dist:300px. 활보사(s_retreat)와 같은
## 재해석(뒤로 물러난다).
const FLIER_RETREAT_COST := 46.0
const FLIER_RETREAT_CD := 8.0
const FLIER_RETREAT_BASE := 3.5
const FLIER_RETREAT_PER := 0.3
const FLIER_RETREAT_DIST_PX := 300.0


static func flier_retreat_dist_m() -> float:
	return FLIER_RETREAT_DIST_PX * WARRIOR_RUSH_SCALE


## 천환시(f_burst) — aoe, r:175px. 광환시(s_burst)와 같은 재해석.
const FLIER_BURST_COST := 46.0
const FLIER_BURST_CD := 7.0
const FLIER_BURST_BASE := 3.6
const FLIER_BURST_PER := 0.31
const FLIER_BURST_RANGE_MUL := 175.0 / 78.0

## 잔영(v_blur) — melee, hits:6.
const WRAITH_BLUR_COST := 52.0
const WRAITH_BLUR_CD := 8.0
const WRAITH_BLUR_BASE := 2.2
const WRAITH_BLUR_PER := 0.19
const WRAITH_BLUR_HITS := 6

## 낙화(v_petal) — volley(shots:7). 만천화우(x_fan)와 같은 재해석.
const WRAITH_PETAL_COST := 54.0
const WRAITH_PETAL_CD := 9.0
const WRAITH_PETAL_BASE := 1.8
const WRAITH_PETAL_PER := 0.15
const WRAITH_PETAL_SHOTS := 7

## 허공답보(v_void) — dash, dist:360px + invuln:1.2. 그림자밟기(x_shadow)와
## 같은 재해석(더 크게 나아가고 무적도 길다).
const WRAITH_VOID_COST := 44.0
const WRAITH_VOID_CD := 7.0
const WRAITH_VOID_BASE := 3.0
const WRAITH_VOID_PER := 0.26
const WRAITH_VOID_DIST_PX := 360.0
const WRAITH_VOID_INVULN_SEC := 1.2


static func wraith_void_dist_m() -> float:
	return WRAITH_VOID_DIST_PX * WARRIOR_RUSH_SCALE


## 사혼(v_mark) — buff. sec:10·atk×1.95 원문 그대로.
const WRAITH_MARK_COST := 48.0
const WRAITH_MARK_CD := 20.0
const WRAITH_MARK_SEC := 10.0
const WRAITH_MARK_ATK_MUL := 1.95

## 광풍각(v_whirl) — aoe, r:175px. 질풍각(x_whirl)과 같은 재해석.
const WRAITH_WHIRL_COST := 46.0
const WRAITH_WHIRL_CD := 7.0
const WRAITH_WHIRL_BASE := 3.6
const WRAITH_WHIRL_PER := 0.31
const WRAITH_WHIRL_RANGE_MUL := 175.0 / 78.0

## 귀표(v_dart) — bolt. 암습표(x_dart)와 같은 재해석(사거리 2배).
const WRAITH_DART_COST := 44.0
const WRAITH_DART_CD := 9.0
const WRAITH_DART_BASE := 4.0
const WRAITH_DART_PER := 0.35
const WRAITH_DART_RANGE_MUL := 2.0

## 유성(i_meteor) — 원문 effect:'rain', 천뢰(p_beam)와 같은 단순 정면 재해석.
const IMMORTAL_METEOR_COST := 64.0
const IMMORTAL_METEOR_CD := 12.0
const IMMORTAL_METEOR_BASE := 4.8
const IMMORTAL_METEOR_PER := 0.42

## 천붕지열(i_abyss) — aoe, r:300px. 지진(p_quake)과 같은 재해석.
const IMMORTAL_ABYSS_COST := 68.0
const IMMORTAL_ABYSS_CD := 14.0
const IMMORTAL_ABYSS_BASE := 5.0
const IMMORTAL_ABYSS_PER := 0.44
const IMMORTAL_ABYSS_RANGE_MUL := 300.0 / 78.0

## 회춘(i_mend) — heal. 치유(m_heal)와 같은 공식.
const IMMORTAL_MEND_COST := 50.0
const IMMORTAL_MEND_CD := 13.0
const IMMORTAL_MEND_BASE := 0.42
const IMMORTAL_MEND_PER := 0.035

## 태극(i_tao) — buff. sec:14·atk×1.5·guard0.3·regen4.0 원문 그대로.
const IMMORTAL_TAO_COST := 58.0
const IMMORTAL_TAO_CD := 22.0
const IMMORTAL_TAO_SEC := 14.0
const IMMORTAL_TAO_ATK_MUL := 1.5
const IMMORTAL_TAO_GUARD := 0.3
const IMMORTAL_TAO_REGEN_MUL := 4.0

## 이형보(i_step) — dash, dist:340px + invuln:0.9. 축지술(p_step)과 같은
## 재해석(더 크게 나아간다).
const IMMORTAL_STEP_COST := 48.0
const IMMORTAL_STEP_CD := 9.0
const IMMORTAL_STEP_BASE := 3.0
const IMMORTAL_STEP_PER := 0.26
const IMMORTAL_STEP_DIST_PX := 340.0
const IMMORTAL_STEP_INVULN_SEC := 0.9


static func immortal_step_dist_m() -> float:
	return IMMORTAL_STEP_DIST_PX * WARRIOR_RUSH_SCALE


## 유성탄(i_orb) — volley(shots:6). 연환탄(p_orb)과 같은 재해석.
const IMMORTAL_ORB_COST := 50.0
const IMMORTAL_ORB_CD := 7.0
const IMMORTAL_ORB_BASE := 1.9
const IMMORTAL_ORB_PER := 0.16
const IMMORTAL_ORB_SHOTS := 6


## **2026-09-13 추가(같은 날 더×5) — tier4 무예 스물넷(전신·궁성·명왕·
## 천존 각 여섯, 갈래의 끝).** SKILL_NEED 머리말 참고 — 전부 바로 아래
## tier3을 가리켜(원문에 예외가 없다) 모두 갈래마다 여섯 개 전부 채웠다.
## h_zenith(원문 speed:1.2)가 f_focus에 이어 두 번째로 이동속도 배율을
## 갖는 job 버프다.

## 파멸격(o_ruin) — melee, hits:4.
const WARLORD_RUIN_COST := 62.0
const WARLORD_RUIN_CD := 12.0
const WARLORD_RUIN_BASE := 6.2
const WARLORD_RUIN_PER := 0.57
const WARLORD_RUIN_HITS := 4

## 지열(o_tremor) — aoe, r:340px.
const WARLORD_TREMOR_COST := 58.0
const WARLORD_TREMOR_CD := 14.0
const WARLORD_TREMOR_BASE := 4.9
const WARLORD_TREMOR_PER := 0.44
const WARLORD_TREMOR_RANGE_MUL := 340.0 / 78.0

## 벽력돌(o_smite) — dash, dist:410px.
const WARLORD_SMITE_COST := 54.0
const WARLORD_SMITE_CD := 10.0
const WARLORD_SMITE_BASE := 4.5
const WARLORD_SMITE_PER := 0.4
const WARLORD_SMITE_DIST_PX := 410.0


static func warlord_smite_dist_m() -> float:
	return WARLORD_SMITE_DIST_PX * WARRIOR_RUSH_SCALE


## 패천기(o_conquer) — buff. sec:15·atk×1.8·guard0.5·regen2.4 원문 그대로.
const WARLORD_CONQUER_COST := 62.0
const WARLORD_CONQUER_CD := 26.0
const WARLORD_CONQUER_SEC := 15.0
const WARLORD_CONQUER_ATK_MUL := 1.8
const WARLORD_CONQUER_GUARD := 0.5
const WARLORD_CONQUER_REGEN_MUL := 2.4

## 파천검(o_edge) — bolt. 천단검(n_edge)과 같은 재해석(사거리 2배).
const WARLORD_EDGE_COST := 58.0
const WARLORD_EDGE_CD := 11.0
const WARLORD_EDGE_BASE := 5.6
const WARLORD_EDGE_PER := 0.5
const WARLORD_EDGE_RANGE_MUL := 2.0

## 재생결(o_vital) — heal.
const WARLORD_VITAL_COST := 60.0
const WARLORD_VITAL_CD := 24.0
const WARLORD_VITAL_BASE := 0.58
const WARLORD_VITAL_PER := 0.048

## 천사우(h_tempest) — 원문 effect:'rain', 시우(f_storm)와 같은 단순
## 정면 재해석.
const FALCON_TEMPEST_COST := 66.0
const FALCON_TEMPEST_CD := 13.0
const FALCON_TEMPEST_BASE := 5.6
const FALCON_TEMPEST_PER := 0.5

## 광시(h_ray) — bolt. 파천시(f_pierce)와 같은 재해석(사거리 2배).
const FALCON_RAY_COST := 60.0
const FALCON_RAY_CD := 10.0
const FALCON_RAY_BASE := 8.4
const FALCON_RAY_PER := 0.7
const FALCON_RAY_RANGE_MUL := 2.0

## 십이시(h_swarm) — volley(shots:12). 만시(f_volley)와 같은 재해석.
const FALCON_SWARM_COST := 56.0
const FALCON_SWARM_CD := 8.0
const FALCON_SWARM_BASE := 2.4
const FALCON_SWARM_PER := 0.2
const FALCON_SWARM_SHOTS := 12

## 궁천합(h_zenith) — buff. sec:14·atk×2.0·**speed×1.2** 원문 그대로.
const FALCON_ZENITH_COST := 52.0
const FALCON_ZENITH_CD := 24.0
const FALCON_ZENITH_SEC := 14.0
const FALCON_ZENITH_ATK_MUL := 2.0
const FALCON_ZENITH_SPEED_MUL := 1.2

## 익보사(h_retreat) — dash, dist:360px. 답공사(f_retreat)와 같은
## 재해석(뒤로 물러난다).
const FALCON_RETREAT_COST := 58.0
const FALCON_RETREAT_CD := 9.0
const FALCON_RETREAT_BASE := 5.0
const FALCON_RETREAT_PER := 0.44
const FALCON_RETREAT_DIST_PX := 360.0


static func falcon_retreat_dist_m() -> float:
	return FALCON_RETREAT_DIST_PX * WARRIOR_RUSH_SCALE


## 극환시(h_burst) — aoe, r:210px. 천환시(f_burst)와 같은 재해석.
const FALCON_BURST_COST := 58.0
const FALCON_BURST_CD := 8.0
const FALCON_BURST_BASE := 5.2
const FALCON_BURST_PER := 0.44
const FALCON_BURST_RANGE_MUL := 210.0 / 78.0

## 팔도(d_carve) — melee, hits:8.
const REAPER_CARVE_COST := 60.0
const REAPER_CARVE_CD := 9.0
const REAPER_CARVE_BASE := 3.0
const REAPER_CARVE_PER := 0.26
const REAPER_CARVE_HITS := 8

## 구화만개(d_bloom) — volley(shots:9). 낙화(v_petal)와 같은 재해석.
const REAPER_BLOOM_COST := 62.0
const REAPER_BLOOM_CD := 10.0
const REAPER_BLOOM_BASE := 2.2
const REAPER_BLOOM_PER := 0.18
const REAPER_BLOOM_SHOTS := 9

## 명계보(d_veil) — dash, dist:420px + invuln:1.5. 허공답보(v_void)와
## 같은 재해석(가장 크게 나아가고 무적도 가장 길다).
const REAPER_VEIL_COST := 50.0
const REAPER_VEIL_CD := 8.0
const REAPER_VEIL_BASE := 3.8
const REAPER_VEIL_PER := 0.32
const REAPER_VEIL_DIST_PX := 420.0
const REAPER_VEIL_INVULN_SEC := 1.5


static func reaper_veil_dist_m() -> float:
	return REAPER_VEIL_DIST_PX * WARRIOR_RUSH_SCALE


## 명왕부(d_curse) — buff. sec:12·atk×2.3 원문 그대로.
const REAPER_CURSE_COST := 56.0
const REAPER_CURSE_CD := 22.0
const REAPER_CURSE_SEC := 12.0
const REAPER_CURSE_ATK_MUL := 2.3

## 절명풍(d_whirl) — aoe, r:210px. 광풍각(v_whirl)과 같은 재해석.
const REAPER_WHIRL_COST := 58.0
const REAPER_WHIRL_CD := 8.0
const REAPER_WHIRL_BASE := 5.2
const REAPER_WHIRL_PER := 0.44
const REAPER_WHIRL_RANGE_MUL := 210.0 / 78.0

## 명표(d_dart) — bolt. 귀표(v_dart)와 같은 재해석(사거리 2배).
const REAPER_DART_COST := 58.0
const REAPER_DART_CD := 11.0
const REAPER_DART_BASE := 5.6
const REAPER_DART_PER := 0.5
const REAPER_DART_RANGE_MUL := 2.0

## 낙성우(z_starfall) — 원문 effect:'rain', 유성(i_meteor)과 같은 단순
## 정면 재해석.
const ASCENDANT_STARFALL_COST := 70.0
const ASCENDANT_STARFALL_CD := 13.0
const ASCENDANT_STARFALL_BASE := 6.5
const ASCENDANT_STARFALL_PER := 0.56

## 건곤붕(z_collapse) — aoe, r:330px. 천붕지열(i_abyss)과 같은 재해석.
const ASCENDANT_COLLAPSE_COST := 74.0
const ASCENDANT_COLLAPSE_CD := 15.0
const ASCENDANT_COLLAPSE_BASE := 6.8
const ASCENDANT_COLLAPSE_PER := 0.58
const ASCENDANT_COLLAPSE_RANGE_MUL := 330.0 / 78.0

## 환생(z_rebirth) — heal. 회춘(i_mend)과 같은 공식.
const ASCENDANT_REBIRTH_COST := 58.0
const ASCENDANT_REBIRTH_CD := 14.0
const ASCENDANT_REBIRTH_BASE := 0.65
const ASCENDANT_REBIRTH_PER := 0.05

## 무극(z_eternity) — buff. sec:16·atk×1.65·guard0.35·regen4.8 원문 그대로.
const ASCENDANT_ETERNITY_COST := 64.0
const ASCENDANT_ETERNITY_CD := 24.0
const ASCENDANT_ETERNITY_SEC := 16.0
const ASCENDANT_ETERNITY_ATK_MUL := 1.65
const ASCENDANT_ETERNITY_GUARD := 0.35
const ASCENDANT_ETERNITY_REGEN_MUL := 4.8

## 신행보(z_step) — dash, dist:400px + invuln:1.1. 이형보(i_step)와 같은
## 재해석(더 크게 나아간다).
const ASCENDANT_STEP_COST := 62.0
const ASCENDANT_STEP_CD := 10.0
const ASCENDANT_STEP_BASE := 4.2
const ASCENDANT_STEP_PER := 0.36
const ASCENDANT_STEP_DIST_PX := 400.0
const ASCENDANT_STEP_INVULN_SEC := 1.1


static func ascendant_step_dist_m() -> float:
	return ASCENDANT_STEP_DIST_PX * WARRIOR_RUSH_SCALE


## 성라탄(z_orb) — volley(shots:8). 유성탄(i_orb)과 같은 재해석.
const ASCENDANT_ORB_COST := 56.0
const ASCENDANT_ORB_CD := 8.0
const ASCENDANT_ORB_BASE := 2.4
const ASCENDANT_ORB_PER := 0.2
const ASCENDANT_ORB_SHOTS := 8


## side.js 883줄대 hit() 그대로: atk*(mul||1)*(0.88~1.12)*(crit?1.6:1).
static func roll_damage(atk: float, mul: float = 1.0) -> Dictionary:
	var crit: bool = randf() < CRIT_RATE
	var variance: float = 0.88 + randf() * 0.24
	var dmg: float = atk * mul * variance * (CRIT_MUL if crit else 1.0)
	return {"dmg": dmg, "crit": crit}

