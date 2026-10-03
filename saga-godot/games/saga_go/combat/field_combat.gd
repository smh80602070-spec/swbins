extends "res://games/saga_go/combat/field_combat_ui.gd"

## PLAN 106장 ③·⑧ — 원신식 들판 전투의 플레이어 쪽. go_player.gd 의 자식으로 붙는다
## (GO 만). 옛 사건 결투(bandit_encounter·shrine_trial, duel_rules.gd)는 그대로
## 두고, 결투가 열려 있는 동안엔 이 노드가 입력을 안 받는다(그룹 "duel_active").
##
##   마우스 왼쪽 / J  기본 공격 3타 · 길게 누르면 강공격(스태미나 20) · 공중에서 누르면 낙하 공격
##   E / K            원소 스킬 — 원소마다 모양이 다르다(아래 KIT), 인물마다 쿨 6초
##   Q                원소 폭발 — 그 인물의 기력 100 을 모아 큰 한 방 + 남는 효과
##   Shift / 오른쪽 / L  대시(회피) — 무적 0.3초, 스태미나 15 (Shift 는 계속 누르면 달리기)
##   1~4              인물 교체 — 나 + 등용한 동료 앞 셋(쿨 1초). 인물마다 원소가 정해져 있다
##   R                활 조준 켜고 끔(106장 ㊵, combat/aimed_shot.gd) — 활 인물은 공격을 길게 눌러도 조준 사격
## 체력·기력은 인물마다 따로(원신과 같다). 지금 인물이 쓰러지면 다음 인물로 저절로 바뀌고,
## 다 쓰러지면 마지막으로 딛은 땅에서 모두 가득 차서 일어난다. 명단에 같은 원소가 둘 이상이면
## 원소 공명(화 공격 +25% · 수 최대 체력 +25% · 뇌 기력 +50%). 공격·방어·체력은 인물마다 레벨·돌파로
## 정해진다(106장 ⑩, PartyState.char_atk/char_def) — 옛 부대 전투력(PartyState.atk)은 사건 결투만 쓴다.
## 106장 ⑫: 기본 공격·스킬·폭발 피해에 그 인물 특성 레벨 배율(PartyState.talent_mul), 운명의 자리 여섯 효과
## (1 스킬 쿨 -20% · 2 반응 피해 +15% · 3/5 특성 +3 · 4 체력 +20% · 6 폭발 뒤 10초 공격 +25%).
## 106장 ⑭: 원소 일곱(풍·빙·암·초 추가)과 반응(elements.gd), 명단 전체 보호막(결정·암 폭발 — 받는 피해를 먼저 막고
## 원소 효과도 막는다), 쇄빙(얼어 있는 적을 강공격·낙하로).
## 106장 ⑯: 무기 종류마다 기본 공격 모양(WEAPON_KIT — 양손검은 무거운 타격이라 쇄빙·바위 방패에 세고, 법구는
## 인물 원소로, 활은 멀리 한 대씩), 치명타(인물 확률·피해 — 무기 부옵션, 씨앗 고정 난수), 무기 효과(기본 공격·스킬·
## 폭발·반응 피해), 기력 획득·체력 부옵션.
## 106장 ⑰: 성유물 — 원소(물리) 피해 보너스(치는 인물이 있을 때만, 치명타와 같은 경계)·고정 체력·세트 4 반응 보너스.

const Characters := preload("res://saga_core/data/characters.gd")
const Story := preload("res://games/saga_go/data/story.gd")
const Toast := preload("res://saga_core/ui/toast.gd")
const Growth := preload("res://games/saga_go/data/growth.gd")
const Weapons := preload("res://games/saga_go/data/weapons.gd")
const Kits := preload("res://games/saga_go/data/kits.gd")
const FieldEnemy := preload("res://games/saga_go/combat/field_enemy.gd")
const AimedShot := preload("res://games/saga_go/combat/aimed_shot.gd")
const FeelTuning := preload("res://games/saga_go/combat/feel_tuning.gd")

const COMBO_MUL := [0.35, 0.4, 0.6]
const COMBO_SEC := [0.32, 0.32, 0.45]
const COMBO_LINK_SEC := 0.9
const ATTACK_REACH := 2.6
const ATTACK_ARC_DOT := 0.25
## 106장 ⑯ — 무기 종류마다 기본 공격 3타(mul 은 공격 배율, sec 은 한 타 시간). 한손검이 옛 값 그대로.
##   reach/arc: 앞 부채꼴 · range: 그 거리 안 가장 가까운 적 하나(법구는 인물 원소, 활은 물리) · heavy: 무거운 타격
const WEAPON_KIT := {
	"sword": {"mul": [0.35, 0.4, 0.6], "sec": [0.32, 0.32, 0.45], "reach": 2.6, "arc": 0.25},
	"claymore": {"mul": [0.6, 0.7, 1.0], "sec": [0.55, 0.55, 0.75], "reach": 3.0, "arc": 0.0, "heavy": true},
	"polearm": {"mul": [0.3, 0.35, 0.5], "sec": [0.26, 0.26, 0.38], "reach": 3.4, "arc": 0.55},
	"catalyst": {"mul": [0.3, 0.35, 0.5], "sec": [0.34, 0.34, 0.45], "range": 7.0, "elemental": true},
	"bow": {"mul": [0.3, 0.3, 0.45], "sec": [0.3, 0.3, 0.4], "range": 14.0},
}
const AUTO_AIM_RANGE := 7.0

## 106장 ⑧ 강공격·낙하 공격(둘 다 물리).
const CHARGE_SEC := 0.4
const CHARGE_COST := 20.0
const CHARGE_MUL := 1.3
const CHARGE_REACH := 3.2
const PLUNGE_RADIUS := 3.5
const PLUNGE_MUL := 1.2
const PLUNGE_MUL_PER_M := 0.1
const PLUNGE_MAX_M := 15.0

const SKILL_MUL := 0.9
const SKILL_RADIUS := 4.0
const SKILL_CD := 6.0
const BURST_MUL := 2.4
const BURST_RADIUS := 7.0
const ENERGY_MAX := 100.0
const ENERGY_PER_HIT := 5.0
const ENERGY_PER_SKILL_HIT := 12.0
const ENERGY_OFF_FIELD := 0.6 # 대기 중인 인물이 받는 몫
const KIT_SHELL_ENERGY := 0.35 # 106장 ㉔ 포탄 하나가 맞힐 때 스킬 기력 몫

## 106장 ⑧ — 원소마다 스킬·폭발 모양. 수치는 atk 배율.
##   화 스킬: 앞 부채꼴 5m 한 번 ×1.1          화 폭발: 둘레 7m ×2.4 + 3초 불 고리(0.5초마다 ×0.25)
##   수 스킬: 둘레 4m ×0.9 + 살아 있는 인물 모두 체력 8% 회복
##   수 폭발: 둘레 7m ×1.6 + 8초 동안 1초마다 지금 인물 체력 5% 회복
##   뇌 스킬: 8m 안 가까운 적 셋에 낙뢰 ×1.0    뇌 폭발: 둘레 7m ×1.2 + 6초 동안 0.6초마다 가까운 적 하나에 낙뢰 ×0.7
const FIRE_SKILL := {"reach": 5.0, "dot": 0.3, "mul": 1.1}
const FIRE_BURST_RING := {"sec": 3.0, "tick": 0.5, "mul": 0.25, "radius": 5.0}
const WATER_SKILL_HEAL := 0.08
const WATER_BURST := {"mul": 1.6, "sec": 8.0, "tick": 1.0, "heal": 0.05}
const THUNDER_SKILL := {"reach": 8.0, "targets": 3, "mul": 1.0}
const THUNDER_BURST := {"mul": 1.2, "sec": 6.0, "tick": 0.6, "bolt": 0.7, "reach": 9.0}
## 106장 ⑭ — 새 원소 넷.
##   풍 스킬: 둘레 5m ×1.0 + 끌어당김          풍 폭발: 둘레 7m ×1.0 + 6초 소용돌이(0.5초마다 5m ×0.3, 가운데로 당김)
##   빙 스킬: 앞 부채꼴 6m ×1.2                빙 폭발: 둘레 7m ×1.4 + 6초 눈보라(0.5초마다 인물 둘레 4.5m ×0.3)
##   암 스킬: 앞 2.5m 바위 기둥 둘레 3m ×1.3    암 폭발: 둘레 7m ×2.0 + 보호막(지금 인물 최대 체력 30%, 15초)
##   초 스킬: 둘레 4m ×1.0                     초 폭발: 둘레 7m ×1.2 + 8초 가시덤불(1초마다 5m ×0.35)
const WIND_SKILL := {"reach": 5.0, "mul": 1.0, "pull": 8.0}
const WIND_BURST := {"mul": 1.0, "sec": 6.0, "tick": 0.5, "radius": 5.0, "bolt": 0.3, "pull": 4.0}
const ICE_SKILL := {"reach": 6.0, "dot": 0.2, "mul": 1.2}
const ICE_BURST := {"mul": 1.4, "sec": 6.0, "tick": 0.5, "radius": 4.5, "bolt": 0.3}
const ROCK_SKILL := {"ahead": 2.5, "radius": 3.0, "mul": 1.3}
const ROCK_BURST := {"mul": 2.0, "shield": 0.3}
const GRASS_SKILL := {"radius": 4.0, "mul": 1.0}
const GRASS_BURST := {"mul": 1.2, "sec": 8.0, "tick": 1.0, "radius": 5.0, "bolt": 0.35}

## 106장 ⑭ 반응 수치(표는 elements.gd 머리말).
const FREEZE_SEC := 2.5
const SUPERCONDUCT_RADIUS := 3.0
const SUPERCONDUCT_MUL := 0.5
const PHYS_VULN_SEC := 8.0
const PHYS_VULN_MUL := 1.4
const SWIRL_RADIUS := 4.0
const SWIRL_MUL := 0.6
const CRYSTAL_SHIELD := 0.2
const SHIELD_SEC := 15.0
const BLOOM_DELAY := 1.5
const BLOOM_RADIUS := 3.0
const BLOOM_MUL := 1.5
const BURNING := {"ticks": 8, "every": 0.5, "mul": 0.2}
const QUICKEN_SEC := 8.0

## 원소 공명 — 명단(2명 이상)에 같은 원소가 둘 이상이면.
const RESONANCE_FIRE_ATK := 1.25
const RESONANCE_WATER_HP := 1.25
const RESONANCE_THUNDER_ENERGY := 1.5
## 106장 ⑭ — 풍 스태미나 소모 -15% · 빙 부착·빙결된 적에게 +15% · 암 보호막 있는 동안 +15% · 초 반응 피해 +20%.
const RESONANCE_WIND_STAMINA := 0.85
const RESONANCE_ICE_DMG := 1.15
const RESONANCE_ROCK_DMG := 1.15
const RESONANCE_GRASS_REACTION := 1.2

const SWITCH_CD := 1.0
const ROSTER_MAX := 4

const HP_BASE := 200.0
const HP_PER_DEF := 2.0
const REGEN_DELAY := 8.0
const REGEN_PER_SEC := 0.05 # 최대 체력 비율

const OVERLOAD_RADIUS := 4.0
const ELECTRO_SPREAD := 3.0

## PLAN 106장 ⑦ — 원소 쓰는 적에게 맞았을 때 덧붙는 효과.
##   화 → 화상: 1초마다 맞은 피해 ×BURN_MUL, BURN_TICKS 번
##   수 → 젖음: 스태미나 -SOAK_STAMINA
##   뇌 → 감전: 폭발 기력 -SHOCK_ENERGY
const BURN_TICKS := 3
const BURN_MUL := 0.2
const SOAK_STAMINA := 25.0
const SHOCK_ENERGY := 25.0
## 106장 ⑮ — 새 원소 괴물에게 맞았을 때.
##   풍 → 휘말림: 지금 인물 스킬 재사용 대기 +TANGLE_CD 초
##   빙 → 한기: 스태미나 회복이 CHILL_SEC 초 멈춤
##   암 → 짓눌림: 맞은 피해 ×CRUSH_MUL 만큼 더(이것만으로는 안 쓰러짐)
##   초 → 중독: 1초마다 맞은 피해 ×POISON_MUL, POISON_TICKS 번(화상과 같은 자리 — 겹치면 새것으로)
const TANGLE_CD := 2.0
const CHILL_SEC := 3.0
const CRUSH_MUL := 0.3
const POISON_TICKS := 4
const POISON_MUL := 0.15

## 인물마다 체력·기력(없는 칸 = 체력 가득·기력 0). hp·energy 는 지금 인물 것.
var _hp: Dictionary = {}
var _energy: Dictionary = {}
var hp: float:
	get: return hp_of(active_id())
	set(v): _hp[active_id()] = v
var energy: float:
	get: return float(_energy.get(active_id(), 0.0))
	set(v): _energy[active_id()] = v
var max_hp: float:
	get: return max_hp_of(active_id())
var active := 0
var last_reaction := ""
signal reacted(reaction: String) # 106장 ⑲ 의뢰(원소 수련)가 센다
signal party_wiped() # 106장 ⑳ 비경 — 명단이 다 쓰러지면 도전 실패

var _combo := 0
var _combo_link := 0.0
var _buf_action := "" # G-0018 입력 선행 — 후딜 중에 눌린 단추 하나
var _buf_t := 0.0
var _attack_t := 0.0
var _charge_armed := false
var _charge_hold := 0.0
var _skill_cd: Dictionary = {}
var _switch_cd := 0.0
var _since_hurt := 99.0
var _burn_left := 0
var _burn_t := 0.0
var _burn_amount := 0.0
var _effects: Array = [] # 폭발이 남기는 효과 {kind, center, left, tick, t, base}
var _c6_left: Dictionary = {} # 운명의 자리 6 — 인물 id → 남은 초
## 106장 ㉔ 고유 스킬이 남기는 것(data/kits.gd) — 원소 부여(인물 id → {el, left, mul}) · 명단 공격 + · 받는 피해 - · 스킬 재사용 가속.
var _infuse: Dictionary = {}
var _rally_t := 0.0
var _rally_mul := 1.0
var _guard_t := 0.0
var _guard_mul := 1.0
var _haste_t := 0.0
## 106장 ㉛ 이야기 동료 — 반응 피해 +(학자 옛 글자 풀이) · 표식(나그네 그림자 걸음, 적 instance id → {left, mul}).
var _lore_t := 0.0
var _lore_mul := 1.0
var _marks: Dictionary = {}
## 106장 ㉟ 뱃노래(사공 버들 폭발) — 남은 초·다음 따라 치기까지·수치 {every, count, reach, bolt, base, el, owner}.
var _rain_t := 0.0
var _rain_cd := 0.0
var _rain: Dictionary = {}
## 106장 ⑭ 명단 전체 보호막(결정·암 폭발). 원소는 표시용.
var shield_hp := 0.0
var shield_element := ""
var _shield_t := 0.0
var _heavy := false # 지금 치는 게 강공격·낙하·양손검인가(쇄빙)
var _crit_id := "" # 지금 치는 인물(치명타 굴림) — 비었으면 치명타 없음(점검이 _deal 을 바로 부를 때)
var force_crit := false # 106장 ㊵ 급소 화살 — 이 한 방은 반드시 치명타
var aim: Node = null # 106장 ㊵ 활 조준 사격(combat/aimed_shot.gd)
var _rng := RandomNumberGenerator.new()

func _ready() -> void:
	add_to_group("go_field_combat")
	_player = get_parent() as CharacterBody3D
	_rng.seed = 20260824
	_ensure_actions()
	PartyState.power_changed.connect(func(_a: float, _d: float) -> void: _refresh_hud())
	_build_hud()
	aim = AimedShot.new()
	aim.name = "AimedShot"
	add_child(aim)
	_refresh_hud()

## 새 입력 액션·키는 project.godot 를 고치지 않고 여기서 등록한다(GO 만 — 다른 판엔 안 샌다).
## 106장 ⑧: 원신 PC 배치(마우스 왼쪽 공격·E 스킬·오른쪽 대시)를 옛 J/K/L 옆에 더한다.
func _ensure_actions() -> void:
	var keys := {"combat_burst": KEY_Q, "go_aim": KEY_R, "party_1": KEY_1, "party_2": KEY_2, "party_3": KEY_3, "party_4": KEY_4}
	for action in keys:
		if InputMap.has_action(action):
			continue
		InputMap.add_action(action)
		var ev := InputEventKey.new()
		ev.physical_keycode = keys[action]
		InputMap.action_add_event(action, ev)
	var extra_keys := {"combat_ult": KEY_E}
	for action in extra_keys:
		if InputMap.has_action(action) and not _has_key(action, extra_keys[action]):
			var ev := InputEventKey.new()
			ev.physical_keycode = extra_keys[action]
			InputMap.action_add_event(action, ev)
	var buttons := {"combat_quick": MOUSE_BUTTON_LEFT, "combat_dodge": MOUSE_BUTTON_RIGHT}
	for action in buttons:
		if InputMap.has_action(action) and not _has_button(action, buttons[action]):
			var mb := InputEventMouseButton.new()
			mb.button_index = buttons[action]
			InputMap.action_add_event(action, mb)

func _has_key(action: String, key: int) -> bool:
	for ev in InputMap.action_get_events(action):
		if ev is InputEventKey and (ev as InputEventKey).physical_keycode == key:
			return true
	return false

func _has_button(action: String, button: int) -> bool:
	for ev in InputMap.action_get_events(action):
		if ev is InputEventMouseButton and (ev as InputEventMouseButton).button_index == button:
			return true
	return false

# ---------------------------------------------------------------- 인물

func roster() -> Array[String]:
	## 106장 ㉝ 편성 — 나 + PartyState.party()(members 앞 party_size 명).
	var r: Array[String] = ["self"]
	for id in PartyState.party():
		if r.size() >= ROSTER_MAX:
			break
		if not r.has(id):
			r.append(id)
	return r

func active_id() -> String:
	var r := roster()
	return r[clampi(active, 0, r.size() - 1)]

func active_element() -> String:
	return Elements.element_of(active_id())

func display_name(id: String) -> String:
	if id == "self":
		return "나"
	var h: Variant = _hero_of(id)
	return h.name if h != null else id

## 도감 인물, 아니면 이야기 동료(data/story.gd MEMBERS) — 둘 다 name·rarity 를 읽는다.
static func _hero_of(id: String) -> Variant:
	var h: Variant = Characters.find(id)
	return h if h != null else Story.member(id)

func hp_of(id: String) -> float:
	var m := max_hp_of(id)
	return minf(float(_hp.get(id, m)), m)

## 인물 최대 체력 — 그 인물 방어(레벨·돌파) × 2 + 200, 수 공명 +25%.
func max_hp_of(id: String) -> float:
	var m := HP_BASE + PartyState.char_def(id) * HP_PER_DEF
	if resonance() == "water":
		m *= RESONANCE_WATER_HP
	if PartyState.constellation(id) >= 4:
		m *= Growth.C4_HP_MUL
	return m * (1.0 + PartyState.stat(id, "hp_pct")) + PartyState.stat(id, "hp")

## 인물 공격 — 레벨·돌파(PartyState) × 희귀도·화 공명(_power_mul) × 운명의 자리 6(폭발 뒤 10초).
func char_atk(id: String) -> float:
	var a := PartyState.char_atk(id) * _power_mul(id)
	if float(_c6_left.get(id, 0.0)) > 0.0:
		a *= Growth.C6_ATK_MUL
	if _rally_t > 0.0:
		a *= _rally_mul
	return a

## 이 인물 스킬 재사용 대기 — 고유 스킬이면 그 표 값(106장 ㉔), 운명의 자리 1 이면 -20%.
func skill_cd_of(id: String) -> float:
	var base := float(Kits.skill_of(id).get("cd", SKILL_CD))
	return base * (Growth.C1_SKILL_CD_MUL if PartyState.constellation(id) >= 1 else 1.0)

func energy_of(id: String) -> float:
	return float(_energy.get(id, 0.0))

## 명단에 같은 원소가 둘 이상인 원소(없으면 ""). 명단이 한 명이면 공명 없음.
func resonance() -> String:
	var r := roster()
	if r.size() < 2:
		return ""
	var count := {}
	for id in r:
		var el := Elements.element_of(id)
		count[el] = int(count.get(el, 0)) + 1
	for el in Elements.ORDER:
		if int(count.get(el, 0)) >= 2:
			return el
	return ""

## 인물 공격 배율 — 희귀도 1~5 → 0.95~1.15. 도감에 없는 이(산적 등)는 1.0. 화 공명 +25%.
func _power_mul(id: String) -> float:
	var mul := 1.0
	if id != "self":
		var h: Variant = _hero_of(id)
		if h != null:
			mul = 0.9 + 0.05 * float(h.get("rarity", 2))
	if resonance() == "fire":
		mul *= RESONANCE_FIRE_ATK
	elif resonance() == "rock" and shield_hp > 0.0:
		mul *= RESONANCE_ROCK_DMG
	return mul

func switch_to(index: int, forced := false) -> bool:
	var r := roster()
	if index < 0 or index >= r.size() or index == active:
		return false
	if not forced and _switch_cd > 0.0:
		return false
	if hp_of(r[index]) <= 0.0:
		return false
	active = index
	_switch_cd = SWITCH_CD
	_ring_fx(_player.global_position, 1.6, Elements.color_of(active_element()), 0.35)
	CombatFeel.ui()
	_refresh_hud()
	return true

## 쓰러진 인물까지 모두 가득(쓰러져 안전한 곳에서 일어날 때 — 순간이동 지점도 부른다).
func revive_all() -> void:
	_hp.clear()
	_burn_left = 0

# ---------------------------------------------------------------- 입력

## 106장 ㊱ 싸우는 중인가 — 쫓거나 치는 적(쉬는 적·제단만 치는 적 빼고)이 IN_COMBAT_M 안에 있으면. 원신처럼 이때는 편성을 못 바꾼다.
const IN_COMBAT_M := 30.0
func in_combat() -> bool:
	if _player == null:
		return false
	for e in get_tree().get_nodes_in_group("field_enemy"):
		if e.call("is_dead") or bool(e.get("asleep")):
			continue
		var a := int(e.get("ai"))
		if a != FieldEnemy.AI.CHASE and a != FieldEnemy.AI.WINDUP and a != FieldEnemy.AI.LUNGE and a != FieldEnemy.AI.RECOVER:
			continue
		if is_instance_valid(e.get("siege")):
			continue
		var d: Vector3 = (e as Node3D).global_position - _player.global_position
		if Vector2(d.x, d.z).length() <= IN_COMBAT_M:
			return true
	return false

func _duel_open() -> bool:
	return get_tree().get_nodes_in_group("duel_active").size() > 0

func can_be_targeted() -> bool:
	return not _duel_open() and hp > 0.0

## 마우스 시점(camera_rig mouse_look)을 쓰는 PC 에선 커서가 풀려 있는 동안 마우스 단추를
## 전투로 안 친다(Alt·선택지 창에서 누른 게 공격으로 새지 않게).
func _mouse_blocked(event: InputEvent) -> bool:
	if not (event is InputEventMouseButton):
		return false
	if DisplayServer.get_name() == "headless" or DisplayServer.is_touchscreen_available():
		return false
	return Input.mouse_mode != Input.MOUSE_MODE_CAPTURED

const INPUT_ACTIONS := ["combat_quick", "combat_ult", "combat_burst", "combat_dodge", "go_aim", "party_1", "party_2", "party_3", "party_4"]

func _unhandled_input(event: InputEvent) -> void:
	if _duel_open() or _player == null or _player.get("frozen") or _mouse_blocked(event):
		return
	## 탈것을 타는 동안엔 전투 입력을 받지 않는다(mount.gd 가 공격을 누르면 내려 준다).
	if bool(_player.get("mounted")):
		return
	for action in INPUT_ACTIONS:
		if event.is_action_pressed(action):
			_act(action, true)
			return
		if event.is_action_released(action):
			_act(action, false)
			return

## 키·마우스(_unhandled_input)와 터치 단추가 같이 쓰는 입구. 터치 단추가 예전엔 Input.action_press 만 불러
## _unhandled_input 이 안 불렸다(그 함수는 입력 이벤트를 만들지 않는다) — 폰에서 공격·스킬·폭발·대시가 안 먹던 까닭.
func _act(action: String, pressed: bool) -> void:
	if _duel_open() or _player == null or _player.get("frozen"):
		return
	match action:
		"combat_quick":
			if pressed:
				if not press_attack() and _attack_t > 0.0 and FeelTuning.input_buffer_sec() > 0.0:
					_buf_action = action # 후딜 때문에 못 나갔다 — 곧 끝나면 낸다
					_buf_t = FeelTuning.input_buffer_sec()
			else:
				release_attack()
		"combat_ult":
			if pressed:
				skill()
		"combat_burst":
			if pressed:
				burst()
		"combat_dodge":
			if pressed:
				_player.call("start_dodge")
		"go_aim":
			if pressed:
				aim.toggle()
		_:
			if pressed and action.begins_with("party_"):
				switch_to(int(action.substr(6)) - 1)

## 공격 단추를 눌렀을 때 — 공중이면 낙하 공격, 조준 중이면 충전, 아니면 기본 공격 한 타 + 강공격 대기.
func press_attack() -> bool:
	if aim.active:
		return aim.begin_charge()
	if _player.call("start_plunge"):
		return true
	_charge_armed = true
	_charge_hold = 0.0
	return attack()

## 공격 단추를 뗌 — 강공격 대기를 풀고, 조준 충전 중이면 쏜다(106장 ㊵).
func release_attack() -> bool:
	_charge_armed = false
	return aim.release()

func _physics_process(delta: float) -> void:
	FeelTuning.kind = "normal" # G-0018 — 이번 프레임에 시작하는 공격이 자기 종류로 바꾼다
	_combo_link = maxf(_combo_link - delta, 0.0)
	_attack_t = maxf(_attack_t - delta, 0.0)
	if _buf_action != "":
		_buf_t -= delta
		if _attack_t <= 0.0:
			var buffered := _buf_action
			var fresh := _buf_t > -delta # 후딜이 끝나는 이 틱까지 창이 남아 있었나
			_buf_action = ""
			_buf_t = 0.0
			if fresh and not _duel_open() and _player != null and not _player.get("frozen"):
				## 이미 단추를 뗐으면 충전(강공격) 대기를 새로 걸지 않고 일반 공격만 낸다 — 안 그러면 뗀 단추가 영원히 눌린 채로 남아 강공격이 저절로 나간다.
				if Input.is_action_pressed(buffered):
					_act(buffered, true)
				else:
					attack()
		elif _buf_t <= 0.0:
			_buf_action = "" # 창이 지나도록 후딜이 안 끝났다 — 예전처럼 버린다
	_switch_cd = maxf(_switch_cd - delta, 0.0)
	## 106장 ㉔ 천기 뇌우(스킬 가속) 동안 재사용 대기가 두 배로 돈다.
	var cd_step := delta * (2.0 if _haste_t > 0.0 else 1.0)
	for k in _skill_cd.keys():
		_skill_cd[k] = maxf(_skill_cd[k] - cd_step, 0.0)
	for k in _c6_left.keys():
		_c6_left[k] = maxf(_c6_left[k] - delta, 0.0)
	_rally_t = maxf(_rally_t - delta, 0.0)
	_guard_t = maxf(_guard_t - delta, 0.0)
	_haste_t = maxf(_haste_t - delta, 0.0)
	_lore_t = maxf(_lore_t - delta, 0.0)
	_rain_t = maxf(_rain_t - delta, 0.0)
	_rain_cd = maxf(_rain_cd - delta, 0.0)
	for k in _marks.keys():
		_marks[k].left = float(_marks[k].left) - delta
		if float(_marks[k].left) <= 0.0:
			_marks.erase(k)
	for k in _infuse.keys():
		_infuse[k].left = maxf(float(_infuse[k].left) - delta, 0.0)
	if _shield_t > 0.0:
		_shield_t -= delta
		if _shield_t <= 0.0:
			shield_hp = 0.0
	## 풍 공명 × 모험 요리(106장 ⑱ 스태미나 소모 감소).
	var st_mul := RESONANCE_WIND_STAMINA if resonance() == "wind" else 1.0
	_player.set("stamina_cost_mul", st_mul * (1.0 - clampf(PartyState.food_stat("stamina_save"), 0.0, 0.9)))
	if _combo_link <= 0.0:
		_combo = 0
	if _charge_armed:
		_charge_hold += delta
		if _charge_hold >= CHARGE_SEC:
			_charge_armed = false
			## 106장 ㊵ — 활의 강공격은 조준 사격(길게 누른 채 조준으로 들어가 떼면 쏜다).
			if not (Weapons.type_of(active_id()) == "bow" and aim.enter(true)):
				charged_attack()
	_since_hurt += delta
	if _burn_left > 0 and hp > 0.0:
		_burn_t -= delta
		if _burn_t <= 0.0:
			_burn_t = 1.0
			_burn_left -= 1
			hp = maxf(hp - _burn_amount, 1.0) # 화상만으로는 쓰러지지 않는다
			_since_hurt = 0.0
	if _since_hurt > REGEN_DELAY:
		for id in roster():
			var h := hp_of(id)
			var m := max_hp_of(id)
			if h > 0.0 and h < m:
				_hp[id] = minf(h + m * REGEN_PER_SEC * delta, m)
	_tick_effects(delta)
	_refresh_hud()

# ---------------------------------------------------------------- 행동

func _grounded_ok() -> bool:
	return _player.call("can_act")

func attack() -> bool:
	if _attack_t > 0.0 or not _grounded_ok():
		return false
	var kit: Dictionary = WEAPON_KIT[Weapons.type_of(active_id())]
	var step := _combo
	_combo = (_combo + 1) % (kit.mul as Array).size()
	_combo_link = COMBO_LINK_SEC
	_attack_t = kit.sec[step]
	FeelTuning.kind = "finisher" if step > 0 and step == (kit.mul as Array).size() - 1 else "normal"
	_aim_at_nearest()
	_player.call("play_action", "attack", kit.sec[step], 0.25)
	var amount: float = _normal_atk() * float(kit.mul[step])
	var hits := 0
	_crit_id = active_id()
	if kit.has("range"):
		## 법구·활 — 멀리 있는 적 하나. 법구는 인물 원소로 친다(원신 법구 기본 공격 문법).
		var target := _nearest(_player.global_position, float(kit.range), 1)
		if not target.is_empty():
			var e: Node3D = target[0]
			_player.call("face_toward", e.global_position)
			var el := active_element() if kit.get("elemental", false) else _normal_el()
			_shot_fx(e.global_position, Elements.color_of(el) if el != "" else Color(0.95, 0.9, 0.7))
			_deal(e, amount, el, e.global_position - _player.global_position)
			hits = 1
		else:
			## 106장 ㊵ — 둘레에 적이 없으면 사거리 안 가장 가까운 과녁을 친다(과녁 퍼즐을 법구로도).
			var t := nearest_target(float(kit.range))
			if t:
				_player.call("face_toward", t.global_position)
				var tel := active_element() if kit.get("elemental", false) else _normal_el()
				_shot_fx(t.call("center") - Vector3.UP * 0.8, Elements.color_of(tel) if tel != "" else Color(0.95, 0.9, 0.7))
				t.call("strike", tel)
	else:
		_heavy = kit.get("heavy", false)
		## 09-28 베기 궤적(combat_fx.gd) — 원소가 붙은 공격이면 그 원소 색.
		var nel := _normal_el()
		CombatFx.slash(_player, _player.call("facing"), float(kit.reach), Elements.color_of(nel) if nel != "" else CombatFx.PHYSICAL, step, _heavy)
		hits = _hit_front(float(kit.reach), float(kit.arc), amount, nel)
		_heavy = false
	_crit_id = ""
	if hits > 0:
		_gain_energy(ENERGY_PER_HIT * hits)
		_rain_follow()
	return true

## 강공격 — 기본 공격 단추를 CHARGE_SEC 넘게 누르고 있으면. 앞쪽 넓게 한 번, 스태미나를 쓴다.
func charged_attack() -> bool:
	FeelTuning.kind = "heavy"
	if not _grounded_ok() or float(_player.get("stamina")) < CHARGE_COST:
		return false
	_player.call("_spend", CHARGE_COST)
	_combo = 0
	_attack_t = 0.5
	_aim_at_nearest()
	_player.call("play_action", "attack", 0.5, 0.0)
	_ring_fx(_player.global_position + _player.call("facing") * 1.2, 1.8, Color(0.95, 0.95, 0.85), 0.3)
	_heavy = true
	_crit_id = active_id()
	var cel := _normal_el()
	CombatFx.slash(_player, _player.call("facing"), CHARGE_REACH, Elements.color_of(cel) if cel != "" else CombatFx.PHYSICAL, 3, true)
	var hits := _hit_front(CHARGE_REACH, -0.2, _normal_atk() * CHARGE_MUL, cel)
	_crit_id = ""
	_heavy = false
	if hits > 0:
		_gain_energy(ENERGY_PER_HIT * hits)
		_rain_follow()
	return true

## 낙하 공격이 땅에 닿았을 때 go_player.gd 가 부른다 — 높이 떨어질수록 세다.
func plunge_land(fell_m: float) -> int:
	FeelTuning.kind = "plunge"
	var mul := PLUNGE_MUL + PLUNGE_MUL_PER_M * clampf(fell_m, 0.0, PLUNGE_MAX_M)
	var center := _player.global_position
	_ring_fx(center, PLUNGE_RADIUS, Color(0.95, 0.9, 0.75), 0.4)
	var rig := get_tree().get_first_node_in_group("camera_rig")
	if rig:
		rig.call("shake", 0.14, 0.3)
	var hits := 0
	_heavy = true
	_crit_id = active_id()
	for e in _enemies_near(center, PLUNGE_RADIUS):
		var to_e: Vector3 = (e as Node3D).global_position - center
		_deal(e, _normal_atk() * mul, _normal_el(), to_e)
		hits += 1
	_crit_id = ""
	_heavy = false
	if hits > 0:
		_gain_energy(ENERGY_PER_HIT * hits)
		_rain_follow()
	return hits

## 기본 공격·강공격·낙하 공격 한 방의 바탕 — 지금 인물 공격 × 기본 공격 특성(× 원소 부여 배율, 106장 ㉔).
func _normal_atk() -> float:
	return char_atk(active_id()) * PartyState.talent_mul(active_id(), "normal") * PartyState.passive_mul(active_id(), "normal") * _infuse_mul()

## 지금 인물의 원소 부여(불새 깃 등) — 켜져 있으면 그 원소, 아니면 ""(물리).
func _normal_el() -> String:
	var inf: Dictionary = _infuse.get(active_id(), {})
	return String(inf.el) if float(inf.get("left", 0.0)) > 0.0 else ""

func _infuse_mul() -> float:
	var inf: Dictionary = _infuse.get(active_id(), {})
	return float(inf.mul) if float(inf.get("left", 0.0)) > 0.0 else 1.0

func infusion_of(id: String) -> String:
	var inf: Dictionary = _infuse.get(id, {})
	return String(inf.el) if float(inf.get("left", 0.0)) > 0.0 else ""

func skill() -> bool:
	FeelTuning.kind = "skill"
	var id := active_id()
	if _skill_cd.get(id, 0.0) > 0.0 or not _grounded_ok():
		return false
	_skill_cd[id] = skill_cd_of(id)
	var el := active_element()
	var atk := char_atk(id) * PartyState.talent_mul(id, "skill") * PartyState.passive_mul(id, "skill")
	_player.call("play_action", "attack", 0.4, 0.0)
	var hits := 0
	_crit_id = id
	## 106장 ㉔ — 고유·갈래 스킬이 있는 인물은 그것, 없으면(지략 인물) 원소마다 같은 스킬.
	var kit := Kits.skill_of(id)
	if not kit.is_empty():
		hits = _kit_skill(id, kit, atk, el)
	match "" if not kit.is_empty() else el:
		"fire":
			_aim_at_nearest()
			var fwd: Vector3 = _player.call("facing")
			_ring_fx(_player.global_position + fwd * 2.5, 2.5, Elements.color_of(el), 0.35)
			hits = _hit_front(FIRE_SKILL.reach, FIRE_SKILL.dot, atk * FIRE_SKILL.mul, el)
		"water":
			_ring_fx(_player.global_position, SKILL_RADIUS, Elements.color_of(el), 0.45)
			for e in _enemies_near(_player.global_position, SKILL_RADIUS):
				_deal(e, atk * SKILL_MUL, el, (e as Node3D).global_position - _player.global_position)
				hits += 1
			_heal_all(WATER_SKILL_HEAL)
		"thunder":
			var targets := _nearest(_player.global_position, THUNDER_SKILL.reach, THUNDER_SKILL.targets)
			for e in targets:
				_bolt(e, atk * THUNDER_SKILL.mul)
			hits = targets.size()
		"wind":
			var c := _player.global_position
			_ring_fx(c, WIND_SKILL.reach, Elements.color_of(el), 0.45)
			for e in _enemies_near(c, WIND_SKILL.reach):
				var to_e: Vector3 = (e as Node3D).global_position - c
				_deal(e, atk * WIND_SKILL.mul, el, to_e)
				e.call("knockback", -to_e, WIND_SKILL.pull)
				hits += 1
		"ice":
			_aim_at_nearest()
			var fwd_i: Vector3 = _player.call("facing")
			_ring_fx(_player.global_position + fwd_i * 3.0, 3.0, Elements.color_of(el), 0.35)
			hits = _hit_front(ICE_SKILL.reach, ICE_SKILL.dot, atk * ICE_SKILL.mul, el)
		"rock":
			_aim_at_nearest()
			var at: Vector3 = _player.global_position + (_player.call("facing") as Vector3) * ROCK_SKILL.ahead
			_ring_fx(at, ROCK_SKILL.radius, Elements.color_of(el), 0.5)
			for e in _enemies_near(at, ROCK_SKILL.radius):
				_deal(e, atk * ROCK_SKILL.mul, el, (e as Node3D).global_position - at)
				hits += 1
		"grass":
			_ring_fx(_player.global_position, GRASS_SKILL.radius, Elements.color_of(el), 0.45)
			for e in _enemies_near(_player.global_position, GRASS_SKILL.radius):
				_deal(e, atk * GRASS_SKILL.mul, el, (e as Node3D).global_position - _player.global_position)
				hits += 1
	_crit_id = ""
	_gain_energy(ENERGY_PER_SKILL_HIT * hits)
	## 106장 ⑥ 원소 석등(treasure_chest.gd) — 스킬을 쓴 자리 둘레 4m 석등을 밝힌다(원소마다 같게).
	get_tree().call_group("element_receiver", "receive_element", _player.global_position, SKILL_RADIUS, el)
	return true

func burst() -> bool:
	FeelTuning.kind = "burst"
	if energy < ENERGY_MAX or not _grounded_ok():
		return false
	energy = 0.0
	var el := active_element()
	var atk := char_atk(active_id()) * PartyState.talent_mul(active_id(), "burst") * PartyState.passive_mul(active_id(), "burst")
	if PartyState.constellation(active_id()) >= 6:
		_c6_left[active_id()] = Growth.C6_BUFF_SEC
	var kb := Kits.burst_of(active_id())
	if not kb.is_empty():
		_kit_burst(active_id(), kb, atk, el)
		get_tree().call_group("element_receiver", "receive_element", _player.global_position, float(kb.radius), el)
		return true
	var center := _player.global_position
	_player.call("play_action", "attack", 0.6, 0.0)
	_ring_fx(center, BURST_RADIUS, Elements.color_of(el), 0.7)
	var rig := get_tree().get_first_node_in_group("camera_rig")
	if rig:
		rig.call("shake", 0.18, 0.35)
	var mul: float = BURST_MUL
	match el:
		"water": mul = WATER_BURST.mul
		"thunder": mul = THUNDER_BURST.mul
		"wind": mul = WIND_BURST.mul
		"ice": mul = ICE_BURST.mul
		"rock": mul = ROCK_BURST.mul
		"grass": mul = GRASS_BURST.mul
	_crit_id = active_id()
	for e in _enemies_near(center, BURST_RADIUS):
		_deal(e, atk * mul, el, (e as Node3D).global_position - center)
	_crit_id = ""
	match el:
		"fire":
			_effects.append({"kind": "fire_ring", "center": center, "left": FIRE_BURST_RING.sec, "tick": FIRE_BURST_RING.tick, "t": FIRE_BURST_RING.tick, "base": atk})
		"water":
			_effects.append({"kind": "water_heal", "center": center, "left": WATER_BURST.sec, "tick": WATER_BURST.tick, "t": WATER_BURST.tick, "base": atk})
		"thunder":
			_effects.append({"kind": "thunder_bolts", "center": center, "left": THUNDER_BURST.sec, "tick": THUNDER_BURST.tick, "t": THUNDER_BURST.tick, "base": atk})
		"wind":
			_effects.append({"kind": "wind_vortex", "center": center, "left": WIND_BURST.sec, "tick": WIND_BURST.tick, "t": WIND_BURST.tick, "base": atk})
		"ice":
			_effects.append({"kind": "ice_storm", "center": center, "left": ICE_BURST.sec, "tick": ICE_BURST.tick, "t": ICE_BURST.tick, "base": atk})
		"rock":
			grant_shield(max_hp * ROCK_BURST.shield, "rock")
		"grass":
			_effects.append({"kind": "grass_thorns", "center": center, "left": GRASS_BURST.sec, "tick": GRASS_BURST.tick, "t": GRASS_BURST.tick, "base": atk})
	get_tree().call_group("element_receiver", "receive_element", center, BURST_RADIUS, el)
	return true

# ---------------------------------------------------------------- 고유 스킬(106장 ㉔, data/kits.gd)

## 고유 원소 스킬 — 곧바로 맞힌 적 수(진·포탄은 나중에 맞히며 그때 기력).
func _kit_skill(id: String, kit: Dictionary, atk: float, el: String) -> int:
	var pos := _player.global_position
	var col := Elements.color_of(el)
	var hits := 0
	match String(kit.type):
		"dash":
			_aim_at_nearest()
			var fwd: Vector3 = _player.call("facing")
			var length := float(kit.sec) * float(kit.speed)
			var width := float(kit.width)
			_player.call("skill_dash", fwd, float(kit.sec), float(kit.speed))
			for e in _enemies_near(pos + fwd * length * 0.5, length * 0.5 + width):
				var rel: Vector3 = (e as Node3D).global_position - pos
				rel.y = 0.0
				var along := clampf(rel.dot(fwd), 0.0, length)
				if (rel - fwd * along).length() > width:
					continue
				_deal(e, atk * float(kit.mul), el, fwd)
				hits += 1
			_ring_fx(pos + fwd * length, 1.6, col, 0.35)
		"zone":
			_ring_fx(pos, float(kit.radius), col, 0.6)
			_effects.append({"kind": "kit_zone", "center": pos, "left": float(kit.sec), "tick": float(kit.tick), "t": float(kit.tick), "base": atk,
				"radius": float(kit.radius), "targets": int(kit.targets), "mul": float(kit.mul), "energy": float(kit.energy), "el": el, "owner": id})
		"shells":
			var points: Array = []
			for e in _nearest(pos, float(kit.reach), int(kit.count)):
				points.append((e as Node3D).global_position)
			if points.is_empty():
				points.append(pos + (_player.call("facing") as Vector3) * 8.0)
			for sp in points:
				_ring_fx(sp, float(kit.radius), col, float(kit.delay))
				_effects.append({"kind": "kit_shell", "center": sp, "left": float(kit.delay), "tick": float(kit.delay), "t": float(kit.delay), "base": atk,
					"radius": float(kit.radius), "mul": float(kit.mul), "el": el, "owner": id})
		"guard":
			_ring_fx(pos, float(kit.radius), col, 0.45)
			for e in _enemies_near(pos, float(kit.radius)):
				_deal(e, atk * float(kit.mul), el, (e as Node3D).global_position - pos)
				hits += 1
			grant_shield(max_hp * float(kit.shield), el)
			_shield_t = float(kit.sec)
		"blink":
			## 106장 ㉛ 그림자 걸음 — 가까운 적을 지나 그 뒤 behind m 까지 돌진(충돌·무적은 skill_dash 그대로), 그 둘레를 베고 표식.
			var tgt := _nearest(pos, float(kit.reach), 1)
			var fwd_b: Vector3 = _player.call("facing")
			var dist := 3.0
			var at := pos + fwd_b * dist
			if not tgt.is_empty():
				var tp: Vector3 = (tgt[0] as Node3D).global_position
				var flat := Vector3(tp.x - pos.x, 0.0, tp.z - pos.z)
				if flat.length() > 0.05:
					fwd_b = flat.normalized()
				dist = flat.length() + float(kit.behind)
				at = tp
			var speed := float(kit.speed)
			_player.call("skill_dash", fwd_b, dist / speed, speed)
			_ring_fx(at, float(kit.radius), col, 0.4)
			for e in _enemies_near(at, float(kit.radius)):
				_deal(e, atk * float(kit.mul), el, fwd_b)
				hits += 1
			if not tgt.is_empty():
				_marks[(tgt[0] as Node).get_instance_id()] = {"left": float(kit.mark_sec), "mul": float(kit.mark_mul)}
				_reaction_text(tgt[0] as Node3D, "표식", Color(0.85, 0.9, 1.0))
		"gust":
			## 106장 ㉟ 부채 바람 — 앞 부채꼴을 치고 밀어낸다(회복은 _kit_extras heal).
			_aim_at_nearest()
			var fwd_g: Vector3 = _player.call("facing")
			_ring_fx(pos + fwd_g * float(kit.reach) * 0.5, float(kit.reach) * 0.5, col, 0.4)
			for e in _enemies_near(pos, float(kit.reach) + 0.5):
				var to_g: Vector3 = (e as Node3D).global_position - pos
				to_g.y = 0.0
				if to_g.length() > 0.3 and fwd_g.dot(to_g.normalized()) < float(kit.arc):
					continue
				_deal(e, atk * float(kit.mul), el, to_g)
				e.call("knockback", to_g if to_g.length() > 0.3 else fwd_g, float(kit.push))
				hits += 1
		"wave":
			## 106장 ㉟ 노 물결 — 앞으로 곧게, 길 위 적을 앞으로 밀어낸다(나는 제자리).
			_aim_at_nearest()
			var fwd_w: Vector3 = _player.call("facing")
			var ln := float(kit.length)
			var wd := float(kit.width)
			for i in 3:
				_ring_fx(pos + fwd_w * ln * (0.25 + 0.3 * i), wd, col, 0.3 + 0.1 * i)
			for e in _enemies_near(pos + fwd_w * ln * 0.5, ln * 0.5 + wd):
				var rel_w: Vector3 = (e as Node3D).global_position - pos
				rel_w.y = 0.0
				var along_w := clampf(rel_w.dot(fwd_w), 0.0, ln)
				if (rel_w - fwd_w * along_w).length() > wd:
					continue
				_deal(e, atk * float(kit.mul), el, fwd_w)
				e.call("knockback", fwd_w, float(kit.push))
				hits += 1
		"updraft":
			_ring_fx(pos, float(kit.radius), col, 0.45)
			for e in _enemies_near(pos, float(kit.radius)):
				var to_e: Vector3 = (e as Node3D).global_position - pos
				_deal(e, atk * float(kit.mul), el, to_e)
				e.call("knockback", -to_e, float(kit.pull))
				hits += 1
			_player.call("launch_up", float(kit.lift))
	_kit_extras(id, kit, el)
	return hits

## 고유 원소 폭발 — 모두 먼저 둘레 radius 에 mul 한 번, 그 뒤 type 마다 남는 것.
func _kit_burst(id: String, kb: Dictionary, atk: float, el: String) -> void:
	var center := _player.global_position
	var radius := float(kb.radius)
	var sec := float(kb.get("sec", 0.0))
	_player.call("play_action", "attack", 0.6, 0.0)
	_ring_fx(center, radius, Elements.color_of(el), 0.7)
	var rig := get_tree().get_first_node_in_group("camera_rig")
	if rig:
		rig.call("shake", 0.18, 0.35)
	_crit_id = id
	for e in _enemies_near(center, radius):
		_deal(e, atk * float(kb.mul), el, (e as Node3D).global_position - center)
	_crit_id = ""
	match String(kb.type):
		"infuse":
			_infuse[id] = {"el": el, "left": sec, "mul": float(kb.normal_mul)}
		"haste":
			_haste_t = sec
			for other in roster():
				if other != id:
					_energy[other] = minf(energy_of(other) + float(kb.energy), ENERGY_MAX)
		"rally":
			_rally_t = sec
			_rally_mul = float(kb.atk)
		"guard":
			_guard_t = sec
			_guard_mul = float(kb.taken)
		"lore":
			_lore_t = sec
			_lore_mul = float(kb.react)
		"echo":
			## 106장 ㉛ 가면 벗기 — 표식 난 적마다 메아리 베기(없으면 가까운 둘). 적을 따라가며 친다.
			var marked: Array = []
			for e in _enemies_near(center, float(kb.reach)):
				if is_marked(e):
					marked.append(e)
			if marked.is_empty():
				marked = _nearest(center, radius, 2)
			for e in marked:
				_effects.append({"kind": "kit_echo", "target": e, "center": center, "left": float(kb.tick) * float(kb.hits) + 0.01,
					"tick": float(kb.tick), "t": float(kb.tick), "base": atk, "mul": float(kb.echo_mul), "el": el, "owner": id})
		"feast":
			_effects.append({"kind": "kit_feast", "center": center, "left": sec, "tick": float(kb.tick), "t": float(kb.tick), "base": atk,
				"radius": radius, "heal": float(kb.heal), "bolt": float(kb.bolt), "el": el, "owner": id})
		"rain":
			_rain_t = sec
			_rain_cd = 0.0
			_rain = {"every": float(kb.every), "count": int(kb.count), "reach": float(kb.reach), "bolt": float(kb.bolt), "base": atk, "el": el, "owner": id}
		"vortex":
			var at: Vector3 = center + (_player.call("facing") as Vector3) * float(kb.ahead)
			_ring_fx(at, radius, Elements.color_of(el), 0.5)
			_effects.append({"kind": "kit_vortex", "center": at, "left": sec, "tick": float(kb.tick), "t": float(kb.tick), "base": atk,
				"radius": radius, "bolt": float(kb.bolt), "pull": float(kb.pull), "el": el, "owner": id})
	_kit_extras(id, kb, el)

## 갈래 스킬(data/kits.gd FAMILIES)에 원소가 덧붙이는 것 — 명단 회복·보호막·다른 인물 기력. 고유 다섯은 이 칸이 없다.
func _kit_extras(id: String, d: Dictionary, el: String) -> void:
	if d.has("heal"):
		_heal_all(float(d.heal))
	if d.has("bonus_shield") and String(d.type) != "guard":
		grant_shield(max_hp * float(d.bonus_shield), el)
	if d.has("team_energy"):
		for other in roster():
			if other != id:
				_energy[other] = minf(energy_of(other) + float(d.team_energy), ENERGY_MAX)

## 지금 켜진 고유 폭발 효과(왼쪽 위 상태 줄).
func buff_text() -> String:
	var parts: Array[String] = []
	var inf := infusion_of(active_id())
	if inf != "":
		parts.append("%s 부여 %d초" % [Elements.name_of(inf), ceili(float(_infuse[active_id()].left))])
	if _rally_t > 0.0:
		parts.append("공격 +%d%% %d초" % [roundi((_rally_mul - 1.0) * 100.0), ceili(_rally_t)])
	if _guard_t > 0.0:
		parts.append("받는 피해 -%d%% %d초" % [roundi((1.0 - _guard_mul) * 100.0), ceili(_guard_t)])
	if _haste_t > 0.0:
		parts.append("스킬 가속 %d초" % ceili(_haste_t))
	if _lore_t > 0.0:
		parts.append("반응 +%d%% %d초" % [roundi((_lore_mul - 1.0) * 100.0), ceili(_lore_t)])
	if not _marks.is_empty():
		parts.append("표식 %d" % _marks.size())
	if _rain_t > 0.0:
		parts.append("뱃노래 %d초" % ceili(_rain_t))
	return " · ".join(parts)

## 106장 ㉟ 뱃노래 — 기본·강·낙하 공격이 맞은 뒤 부른다. 켜져 있고 쉬는 틈이 지났으면 가까운 적 몇에 물 노(버들 치명타로).
## 따라 친 적 수.
func _rain_follow() -> int:
	if _rain_t <= 0.0 or _rain_cd > 0.0:
		return 0
	_rain_cd = float(_rain.every)
	var was := _crit_id
	_crit_id = String(_rain.owner)
	var n := 0
	for e in _nearest(_player.global_position, float(_rain.reach), int(_rain.count)):
		var ep: Vector3 = (e as Node3D).global_position
		_shot_fx(ep, Elements.color_of(String(_rain.el)))
		_deal(e, float(_rain.base) * float(_rain.bolt), String(_rain.el), ep - _player.global_position)
		n += 1
	_crit_id = was
	return n

## 표식(그림자 걸음)이 남은 적인가.
func is_marked(enemy: Node) -> bool:
	return is_instance_valid(enemy) and _marks.has(enemy.get_instance_id())

func lore_mul() -> float:
	return _lore_mul if _lore_t > 0.0 else 1.0

func _tick_effects(delta: float) -> void:
	var prev_kind: String = FeelTuning.kind
	FeelTuning.kind = "skill" # 스킬·폭발이 늦게 터뜨리는 후속 타격(개화 씨앗은 따로 "reaction"). 끝나면 원래 종류로
	_crit_id = active_id()
	for fx in _effects:
		fx.left -= delta
		fx.t -= delta
		if fx.t > 0.0:
			continue
		fx.t += fx.tick
		_crit_id = String(fx.get("owner", active_id()))
		match fx.kind:
			"fire_ring":
				_ring_fx(fx.center, FIRE_BURST_RING.radius, Elements.color_of("fire"), 0.3)
				for e in _enemies_near(fx.center, FIRE_BURST_RING.radius):
					_deal(e, fx.base * FIRE_BURST_RING.mul, "fire", (e as Node3D).global_position - fx.center)
			"water_heal":
				if hp > 0.0:
					hp = minf(hp + max_hp * WATER_BURST.heal, max_hp)
			"thunder_bolts":
				for e in _nearest(_player.global_position, THUNDER_BURST.reach, 1):
					_bolt(e, fx.base * THUNDER_BURST.bolt)
			"wind_vortex":
				_ring_fx(fx.center, WIND_BURST.radius, Elements.color_of("wind"), 0.3)
				for e in _enemies_near(fx.center, WIND_BURST.radius):
					var to_e: Vector3 = (e as Node3D).global_position - fx.center
					_deal(e, fx.base * WIND_BURST.bolt, "wind", to_e)
					e.call("knockback", -to_e, WIND_BURST.pull)
			"ice_storm":
				var pc := _player.global_position
				_ring_fx(pc, ICE_BURST.radius, Elements.color_of("ice"), 0.3)
				for e in _enemies_near(pc, ICE_BURST.radius):
					_deal(e, fx.base * ICE_BURST.bolt, "ice", (e as Node3D).global_position - pc)
			"grass_thorns":
				_ring_fx(fx.center, GRASS_BURST.radius, Elements.color_of("grass"), 0.3)
				for e in _enemies_near(fx.center, GRASS_BURST.radius):
					_deal(e, fx.base * GRASS_BURST.bolt, "grass", (e as Node3D).global_position - fx.center)
			"bloom_seed":
				## 개화 씨앗이 터짐 — 원소 없는 반응 피해(방패엔 초로 친다).
				var info: Dictionary = Elements.REACTION_INFO["bloom"]
				_ring_fx(fx.center, BLOOM_RADIUS, info.color, 0.4)
				for e in _enemies_near(fx.center, BLOOM_RADIUS):
					var push: Vector3 = (e as Node3D).global_position - fx.center
					FeelTuning.kind = "reaction"
					e.call("apply_damage", fx.base * BLOOM_MUL * _reaction_mul("bloom"), true, push, "grass")
					FeelTuning.kind = "skill"
			## 106장 ㉔ 고유 스킬 — 진(가까운 적 몇에 낙뢰, 맞히면 명단 기력) · 포탄(늦게 떨어짐) · 소용돌이(빨아들임).
			"kit_zone":
				var col_z := Elements.color_of(String(fx.el))
				_ring_fx(fx.center, float(fx.radius), col_z, 0.25)
				var zn := 0
				for e in _nearest(fx.center, float(fx.radius), int(fx.targets)):
					var zp: Vector3 = (e as Node3D).global_position
					_bolt_fx(zp)
					_deal(e, fx.base * float(fx.mul), String(fx.el), zp - fx.center)
					zn += 1
				if zn > 0:
					_gain_energy(float(fx.energy) * zn)
			"kit_shell":
				_ring_fx(fx.center, float(fx.radius), Elements.color_of(String(fx.el)), 0.3)
				var sn := 0
				for e in _enemies_near(fx.center, float(fx.radius)):
					_deal(e, fx.base * float(fx.mul), String(fx.el), (e as Node3D).global_position - fx.center)
					sn += 1
				if sn > 0:
					_gain_energy(ENERGY_PER_SKILL_HIT * KIT_SHELL_ENERGY * sn)
			"kit_echo":
				var tg: Variant = fx.target
				if is_instance_valid(tg) and not (tg as Node).call("is_dead"):
					var ep: Vector3 = (tg as Node3D).global_position
					_ring_fx(ep, 1.2, Elements.color_of(String(fx.el)), 0.2)
					_deal(tg, fx.base * float(fx.mul), String(fx.el), ep - _player.global_position)
			"kit_feast":
				## 106장 ㉟ 잔칫날 순풍 — 안에 선 지금 인물 회복, 안의 적 원소 피해.
				_ring_fx(fx.center, float(fx.radius), Elements.color_of(String(fx.el)), 0.3)
				var to_me: Vector3 = _player.global_position - fx.center
				to_me.y = 0.0
				if to_me.length() <= float(fx.radius):
					heal_member(active_id(), float(fx.heal))
				for e in _enemies_near(fx.center, float(fx.radius)):
					_deal(e, fx.base * float(fx.bolt), String(fx.el), (e as Node3D).global_position - fx.center)
			"kit_vortex":
				_ring_fx(fx.center, float(fx.radius), Elements.color_of(String(fx.el)), 0.3)
				for e in _enemies_near(fx.center, float(fx.radius)):
					var to_v: Vector3 = (e as Node3D).global_position - fx.center
					_deal(e, fx.base * float(fx.bolt), String(fx.el), to_v)
					e.call("knockback", -to_v, float(fx.pull))
	_crit_id = ""
	_effects = _effects.filter(func(fx: Dictionary) -> bool: return fx.left > 0.0)
	FeelTuning.kind = prev_kind

## 반응이 둘레 적에게 옮겨 입히는 피해 — 주 타격보다 약한 손맛(종류 "reaction")으로, 끝나면 원래 종류로 되돌린다.
func _splash_damage(other: Node, amount: float, push: Vector3, element: String = "") -> void:
	var prev: String = FeelTuning.kind
	FeelTuning.kind = "reaction"
	other.call("apply_damage", amount, false, push, element)
	FeelTuning.kind = prev

func _hit_front(reach: float, arc_dot: float, amount: float, element: String) -> int:
	var fwd: Vector3 = _player.call("facing")
	var hits := 0
	for e in _enemies_near(_player.global_position, reach + 0.5):
		var to_e: Vector3 = (e as Node3D).global_position - _player.global_position
		to_e.y = 0.0
		if to_e.length() > 0.3 and fwd.dot(to_e.normalized()) < arc_dot:
			continue
		_deal(e, amount, element, to_e)
		hits += 1
	return hits

func _bolt(e: Node, amount: float) -> void:
	var pos: Vector3 = (e as Node3D).global_position
	_bolt_fx(pos)
	_deal(e, amount, "thunder", pos - _player.global_position)

## 106장 ⑱ 요리 — 살아 있는 한 인물 회복(비율 + 고정). 실제로 오른 양(쓰러졌거나 명단에 없으면 -1).
func heal_member(id: String, ratio: float, flat: float = 0.0) -> float:
	if not roster().has(id) or hp_of(id) <= 0.0:
		return -1.0
	var before := hp_of(id)
	_hp[id] = minf(before + max_hp_of(id) * ratio + flat, max_hp_of(id))
	_refresh_hud()
	return hp_of(id) - before

## 쓰러진 인물을 되살린다(체력 비율). 쓰러지지 않았거나 명단에 없으면 false.
func revive_member(id: String, ratio: float) -> bool:
	if not roster().has(id) or hp_of(id) > 0.0:
		return false
	_hp[id] = maxf(max_hp_of(id) * ratio, 1.0)
	_refresh_hud()
	return true

## 요리로 명단 모두 회복(쓰러진 인물은 빼고) — 공개 이름.
func heal_all(ratio: float) -> void:
	_heal_all(ratio)
	_refresh_hud()

func _heal_all(ratio: float) -> void:
	for id in roster():
		var h := hp_of(id)
		if h > 0.0:
			_hp[id] = minf(h + max_hp_of(id) * ratio, max_hp_of(id))

## 명단 전원이 기력을 받는다 — 지금 인물은 다, 대기 인물은 ENERGY_OFF_FIELD 몫(원신과 같다). 뇌 공명 +50%.
func _gain_energy(amount: float) -> void:
	if resonance() == "thunder":
		amount *= RESONANCE_THUNDER_ENERGY
	var now := active_id()
	for id in roster():
		var got := amount if id == now else amount * ENERGY_OFF_FIELD
		got *= 1.0 + PartyState.stat(id, "energy")
		_energy[id] = minf(energy_of(id) + got, ENERGY_MAX)

func _aim_at_nearest() -> void:
	var best := _nearest(_player.global_position, AUTO_AIM_RANGE, 1)
	if not best.is_empty():
		_player.call("face_toward", (best[0] as Node3D).global_position)

func _nearest(pos: Vector3, radius: float, count: int) -> Array:
	var list := _enemies_near(pos, radius)
	list.sort_custom(func(a: Node3D, b: Node3D) -> bool:
		return a.global_position.distance_squared_to(pos) < b.global_position.distance_squared_to(pos))
	return list.slice(0, count)

## 106장 ㊵ 아직 안 켜진 과녁 중 가장 가까운 것(적 셈과 같게 높이는 반만 친다) — 없으면 null.
func nearest_target(radius: float) -> Node3D:
	var best: Node3D = null
	var best_d := radius
	for t in get_tree().get_nodes_in_group("shoot_target"):
		if t.call("is_lit"):
			continue
		var d: Vector3 = (t.call("center") as Vector3) - (_player.global_position + Vector3.UP * 1.2)
		d.y *= 0.5
		if d.length() <= best_d:
			best_d = d.length()
			best = t
	return best

func _enemies_near(pos: Vector3, radius: float) -> Array:
	var out: Array = []
	for e in get_tree().get_nodes_in_group("field_enemy"):
		if e.call("is_dead"):
			continue
		var d: Vector3 = (e as Node3D).global_position - pos
		d.y *= 0.5
		if d.length() <= radius:
			out.append(e)
	return out

# ---------------------------------------------------------------- 피해·반응

## 한 번의 타격. 원소가 있으면 적의 부착 원소와 반응을 본다. 실제 준 피해를 돌려준다.
func _deal(enemy: Node, base: float, element: String, dir: Vector3) -> float:
	## 원소 방패가 있으면 반응·부착 없이 방패만 깎는다(106장 ⑦).
	if enemy.call("is_shielded"):
		last_reaction = ""
		var shield_el: String = enemy.get("element")
		var mul := Elements.shield_mul(shield_el, element)
		var dealt: float = enemy.call("apply_damage", base, false, dir, element)
		if mul == 0.0:
			_reaction_text(enemy as Node3D, "면역", Color(0.75, 0.75, 0.75))
		elif mul > 1.0:
			_reaction_text(enemy as Node3D, "약점!", Elements.color_of(element))
		if not enemy.call("is_shielded"):
			_reaction_text(enemy as Node3D, "방패 깨짐", Elements.color_of(shield_el))
			var rig := get_tree().get_first_node_in_group("camera_rig")
			if rig:
				rig.call("shake", 0.12, 0.25)
		return dealt
	var amount := base
	## 106장 ㉛ 표식 난 적 — 명단 누구에게든 피해 +.
	if _marks.has(enemy.get_instance_id()):
		amount *= float(_marks[enemy.get_instance_id()].mul)
	## 초전도가 남은 적 — 물리 피해 ×1.4. 빙 공명 — 빙이 붙었거나 얼어 있는 적에게 +15%.
	if element == "" and float(enemy.get("phys_vuln_t")) > 0.0:
		amount *= PHYS_VULN_MUL
	if resonance() == "ice" and (enemy.get("aura") == "ice" or enemy.call("is_frozen")):
		amount *= RESONANCE_ICE_DMG
	## 쇄빙 — 얼어 있는 적을 강공격·낙하로 치면 크게 들어가고 풀린다.
	if _heavy and enemy.call("is_frozen"):
		var sh: Dictionary = Elements.REACTION_INFO["shatter"]
		amount *= float(sh.mul) * _reaction_mul("shatter")
		last_reaction = "shatter"
		_reaction_text(enemy as Node3D, sh.name, sh.color)
		reacted.emit("shatter")
		enemy.call("unfreeze")
		return enemy.call("apply_damage", amount * _crit_roll() * _dmg_bonus(element), true, dir)
	## 촉진이 남은 적 — 뇌는 활성, 초는 발산(×1.25).
	var bonus := ""
	if float(enemy.get("quicken_t")) > 0.0 and (element == "thunder" or element == "grass"):
		bonus = "aggravate" if element == "thunder" else "spread"
		var bi: Dictionary = Elements.REACTION_INFO[bonus]
		amount *= float(bi.mul) * _reaction_mul(bonus)
		_reaction_text(enemy as Node3D, bi.name, bi.color)
		reacted.emit(bonus)
	var aura: String = enemy.get("aura")
	var reaction := Elements.reaction_of(aura, element)
	last_reaction = reaction if reaction != "" else bonus
	if reaction != "":
		var info: Dictionary = Elements.REACTION_INFO[reaction]
		amount *= float(info.mul) * _reaction_mul(reaction)
		_reaction_text(enemy as Node3D, info.name, info.color)
		reacted.emit(reaction)
		enemy.call("set_aura", "")
		match reaction:
			"overload":
				var center: Vector3 = (enemy as Node3D).global_position
				_ring_fx(center, OVERLOAD_RADIUS, info.color, 0.35)
				for other in _enemies_near(center, OVERLOAD_RADIUS):
					var push: Vector3 = (other as Node3D).global_position - center
					other.call("knockback", push if push.length() > 0.1 else dir, 7.0)
					if other != enemy:
						_splash_damage(other, base, push)
			"electro":
				enemy.call("add_dot", 4, 0.5, base * 0.3)
				for other in _enemies_near((enemy as Node3D).global_position, ELECTRO_SPREAD):
					if other != enemy and other.get("aura") == "water":
						other.call("add_dot", 4, 0.5, base * 0.3)
			"frozen":
				enemy.call("freeze", FREEZE_SEC)
			"superconduct":
				var sc_center: Vector3 = (enemy as Node3D).global_position
				_ring_fx(sc_center, SUPERCONDUCT_RADIUS, info.color, 0.35)
				for other in _enemies_near(sc_center, SUPERCONDUCT_RADIUS):
					other.set("phys_vuln_t", PHYS_VULN_SEC)
					if other != enemy:
						_splash_damage(other, base * SUPERCONDUCT_MUL, (other as Node3D).global_position - sc_center, "ice")
			"swirl":
				## 확산 — 둘레 적에게 빨아올린 원소를 옮겨 붙이고 그 원소로 조금 친다(옮겨 붙은 원소로 또 반응은 안 한다).
				var sw_center: Vector3 = (enemy as Node3D).global_position
				_ring_fx(sw_center, SWIRL_RADIUS, Elements.color_of(aura), 0.4)
				for other in _enemies_near(sw_center, SWIRL_RADIUS):
					if other == enemy:
						continue
					if not other.call("is_shielded") and other.get("aura") == "":
						other.call("set_aura", aura)
					_splash_damage(other, base * SWIRL_MUL * _reaction_mul("swirl"), (other as Node3D).global_position - sw_center, aura)
			"crystallize":
				grant_shield(max_hp * CRYSTAL_SHIELD, aura)
			"bloom":
				_effects.append({"kind": "bloom_seed", "center": (enemy as Node3D).global_position, "left": BLOOM_DELAY, "tick": BLOOM_DELAY, "t": BLOOM_DELAY, "base": base})
			"burning":
				enemy.call("add_dot", BURNING.ticks, BURNING.every, base * BURNING.mul)
			"quicken":
				enemy.set("quicken_t", QUICKEN_SEC)
	elif Elements.attaches(element):
		enemy.call("set_aura", element)
	var crit := _crit_roll()
	## 09-28 맞은 자리 불꽃(combat_fx.gd) — 원소 색, 치명타·반응이면 크게.
	CombatFx.spark(self, (enemy as Node3D).global_position + Vector3.UP * 0.9, Elements.color_of(element) if element != "" else CombatFx.PHYSICAL, crit > 1.0 or reaction != "")
	return enemy.call("apply_damage", amount * crit * _dmg_bonus(element), reaction != "" or bonus != "" or crit > 1.0, dir)

## 원소(물리) 피해 보너스 — 치는 인물(_crit_id)이 있을 때만.
func _dmg_bonus(element: String) -> float:
	return PartyState.dmg_bonus(_crit_id, element) if _crit_id != "" else 1.0

## 치명타 — 치는 인물(_crit_id)이 있을 때만 굴린다. 배율(1 또는 1 + 치명타 피해).
func _crit_roll() -> float:
	if _crit_id == "":
		return 1.0
	if force_crit: # 106장 ㊵ 급소를 맞힌 화살
		return 1.0 + PartyState.crit_dmg(_crit_id)
	if _rng.randf() < PartyState.crit_rate(_crit_id):
		return 1.0 + PartyState.crit_dmg(_crit_id)
	return 1.0

## 반응 피해 배율 — 초 공명 +20% · 운명의 자리 2 +15% · 무기 효과·성유물 4 세트(PartyState.react_mul).
func _reaction_mul(reaction: String = "") -> float:
	var m := 1.0
	if resonance() == "grass":
		m *= RESONANCE_GRASS_REACTION
	if PartyState.constellation(active_id()) >= 2:
		m *= Growth.C2_REACTION_MUL
	return m * lore_mul() * PartyState.react_mul(active_id(), reaction)

## 명단 전체 보호막 — 더 큰 쪽으로 갈고 시간은 새로.
func grant_shield(amount: float, element: String) -> void:
	shield_hp = maxf(shield_hp, amount)
	shield_element = element
	_shield_t = SHIELD_SEC
	_ring_fx(_player.global_position, 1.3, Elements.color_of(element), 0.5)

func take_damage(amount: float, source: Node) -> void:
	if hp <= 0.0 or _duel_open():
		return
	if _player.call("is_invulnerable"):
		return
	var d := PartyState.char_def(active_id())
	var dmg := amount * (1.0 - d / (d + 120.0))
	if _guard_t > 0.0:
		dmg *= _guard_mul # 106장 ㉔ 오천의 맹세
	## 보호막이 먼저 받는다 — 다 막으면 원소 효과(화상·젖음·감전)도 안 든다.
	if shield_hp > 0.0:
		var absorbed := minf(shield_hp, dmg)
		shield_hp -= absorbed
		dmg -= absorbed
		if dmg <= 0.0:
			_reaction_text(_player, "막음", Elements.color_of(shield_element))
			_refresh_hud()
			return
	hp = maxf(hp - dmg, 0.0)
	_since_hurt = 0.0
	CombatFeel.hit(_player.get_node("Visual"), dmg, false)
	_player.call("play_action", "hit", 0.3, 0.0)
	if hp <= 0.0:
		_down()
	elif source != null and source.get("element") != null:
		_elemental_hit(String(source.get("element")), dmg)
	_refresh_hud()

func _elemental_hit(el: String, dmg: float) -> void:
	match el:
		"fire":
			_burn_left = BURN_TICKS
			_burn_t = 1.0
			_burn_amount = dmg * BURN_MUL
			_reaction_text(_player, "화상", Elements.color_of(el))
		"water":
			_player.set("stamina", maxf(float(_player.get("stamina")) - SOAK_STAMINA, 0.0))
			_reaction_text(_player, "젖음", Elements.color_of(el))
		"thunder":
			energy = maxf(energy - SHOCK_ENERGY, 0.0)
			_reaction_text(_player, "감전", Elements.color_of(el))
		"wind":
			var id := active_id()
			_skill_cd[id] = float(_skill_cd.get(id, 0.0)) + TANGLE_CD
			_reaction_text(_player, "휘말림", Elements.color_of(el))
		"ice":
			_player.set("_regen_wait", maxf(float(_player.get("_regen_wait")), CHILL_SEC))
			_reaction_text(_player, "한기", Elements.color_of(el))
		"rock":
			hp = maxf(hp - dmg * CRUSH_MUL, 1.0)
			_reaction_text(_player, "짓눌림", Elements.color_of(el))
		"grass":
			_burn_left = POISON_TICKS
			_burn_t = 1.0
			_burn_amount = dmg * POISON_MUL
			_reaction_text(_player, "중독", Elements.color_of(el))

## 지금 인물이 쓰러짐 — 살아 있는 다음 인물로 바로 바뀐다. 다 쓰러졌으면 원신처럼 잃는 것 없이
## 마지막으로 딛은 땅에서 모두 가득 차서 다시 일어난다.
func _down() -> void:
	var fallen := display_name(active_id())
	_burn_left = 0
	var r := roster()
	for step in range(1, r.size()):
		var i := (active + step) % r.size()
		if hp_of(r[i]) > 0.0:
			switch_to(i, true)
			Toast.show(_player, "%s 쓰러짐 — %s 교체" % [fallen, display_name(r[i])], 2.5)
			return
	_player.call("respawn_safe")
	revive_all()
	shield_hp = 0.0
	energy = 0.0
	Toast.show(_player, "쓰러졌다 — 정신을 차려 보니 안전한 곳이다", 3.0)
	party_wiped.emit()

func _refresh_hud() -> void:
	if _hud == null:
		return
	var r := roster()
	var sig := ",".join(r)
	if sig != _roster_sig:
		_roster_sig = sig
		_rebuild_roster(r)
	_hp_bar.max_value = max_hp
	_hp_bar.value = hp
	for i in r.size():
		var row: Dictionary = _roster_rows[i]
		var el := Elements.element_of(r[i])
		var mark := "▶ " if i == active else "   "
		var down := " (쓰러짐)" if hp_of(r[i]) <= 0.0 else ""
		(row.label as Label).text = "%s%d %s Lv.%d [%s]%s" % [mark, i + 1, display_name(r[i]), PartyState.char_level(r[i]), Elements.name_of(el), down]
		var bar: ProgressBar = row.bar
		bar.max_value = max_hp_of(r[i])
		bar.value = hp_of(r[i])
	var cd: float = _skill_cd.get(active_id(), 0.0)
	var el_now := active_element()
	var res := resonance()
	var res_text := " · 공명 %s" % Elements.name_of(res) if res != "" else ""
	if shield_hp > 0.0:
		res_text += " · 보호막 %d" % int(shield_hp)
	var bt := buff_text()
	if bt != "":
		res_text += " · " + bt
	_status_label.text = "%s HP %d/%d%s" % [display_name(active_id()), int(hp), int(max_hp), res_text]
	if _skill_orb:
		_skill_orb.color = Elements.color_of(el_now)
		_skill_orb.ratio = 1.0 - cd / skill_cd_of(active_id())
		_skill_orb.glow = cd <= 0.0
		_skill_orb.sub_text = "" if cd <= 0.0 else "%.1f" % cd
		_skill_orb.queue_redraw()
		_burst_orb.color = Elements.color_of(el_now)
		_burst_orb.ratio = energy / ENERGY_MAX
		_burst_orb.glow = energy >= ENERGY_MAX
		_burst_orb.sub_text = "" if energy >= ENERGY_MAX else "%d%%" % int(energy)
		_burst_orb.queue_redraw()
	var bow := Weapons.type_of(active_id()) == "bow"
	if _aim_hint:
		_aim_hint.visible = bow
		_aim_hint.text = "R 조준 끝" if aim and aim.active else "R 조준"
	if _touch_buttons.has("go_aim"):
		(_touch_buttons.go_aim as Button).visible = bow
		(_touch_buttons.go_aim as Button).text = "조준 끝" if aim and aim.active else "조준"
	if _touch_buttons.has("combat_ult"):
		(_touch_buttons.combat_ult as Button).text = "스킬" if cd <= 0.0 else "%.1f" % cd
		(_touch_buttons.combat_burst as Button).text = "폭발!" if energy >= ENERGY_MAX else "폭발 %d%%" % int(energy)
