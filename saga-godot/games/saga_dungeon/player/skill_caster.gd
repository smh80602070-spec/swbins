extends Node

## G-0198 — 무예 넉 자리(Z·X·C·V) 공용 시전기. 웹 skill.js `equipped()`·dungeon.js `SKILL_SLOTS = 4` 짝.
## 예전엔 활성 무예 76개마다 사본 스크립트 하나(skill_<모양>_<직업>.gd)·HUD 단추 하나·입력 하나(dungeon_skill_1~77)였다 —
## 사본끼리 다른 건 SKILL_KEY·입력 이름뿐이라 모양(shape) 아홉 갈래 판정을 여기 하나로 모았다. 무예마다 달랐던 둘은 표 필드로:
##   bolt  `shots`(a_multi 3 — 가까운 적 최대 shots명, 없으면 1) · dash `far`(w_leap 1.8 — 돌진 시간 0.2×far, 없으면 1).
## 지금 직업(장착 무기, DungeonItems.class_key_for_weapon)의 넉 자리(DungeonSkillState.equipped)에 걸린 무예만 나간다.
## 자리 넷을 노드 하나가 맡는다 — 쿨다운을 무예 키별로 한 곳에 두려고(자리를 맞바꿔도 쿨다운이 무예를 따라간다).
## 판정·피해식은 옛 사본 그대로(아래 상수 이름·값도 옛 사본의 것):
##   bolt 가까운 적(12m 안) · swing 반경 r×사거리 배율 · nova 반경 r · dash 0.2초×far 돌진, 지나는 적 2.4m · buff 임시 은사
##   heal 최대 체력 % · curse 반경 r 느려짐 0.35+약화 · summon 분신 round(값)기 · chain 3번 튐(한 번마다 12% 덜) 7.65m.
## 기력(mp)은 이 슬라이스에 없어 sk.cost 는 안 쓴다(쿨다운만). 단이 0이면 아무 일도 안 한다.
## G-0200 — 시전 손맛: 모양마다 원소 색 그림(saga_core/combat_fx.gd, 1만리와 같은 것) + 맞은 적마다 CombatFeel.hit(숫자·번쩍임).
##   한 번 시전에 여럿을 맞히면 멈칫·흔들림·타격음은 첫 적 한 번만(나머지는 HIT_QUIET). 색은 DungeonItems.ELEMENTS color 그대로.

const Meridian := preload("res://games/saga_dungeon/data/dungeon_meridian.gd")   # G-0217 경락도
const SkillTree := preload("res://games/saga_dungeon/data/dungeon_skill_tree.gd")   # G-0241 무예별 작은 나무
const Toast := preload("res://saga_core/ui/toast.gd")
const MeleeAttack := preload("res://games/saga_dungeon/player/melee_attack.gd")
const DungeonMinion := preload("res://games/saga_dungeon/world/dungeon_minion.gd")
const CombatFx := preload("res://saga_core/combat_fx.gd")
## 원소 키(ELEMENTS) → combat_fx PARTICLES 키. 독은 초록 방울(water), 전자는 분홍 지지직(thunder).
const EL_PARTICLE := {"phys": "", "fire": "fire", "cold": "ice", "lit": "thunder", "pois": "water", "chi": "wind", "emp": "thunder"}
const RING_SEC := 0.55 # 웹 applyShapeSkill fx ring life
const SELF_BURST_R := 1.2 # buff·heal 은 제 자리에 작게
const HIT_QUIET := {"stop_ms": 0, "shake_mul": 0.0, "quiet": true}
const SLOT_ACTIONS: Array[String] = ["dungeon_slot_1", "dungeon_slot_2", "dungeon_slot_3", "dungeon_slot_4"]
const SET_ACTION := "dungeon_set_skill"   # G-0398 세트 무예(T) — 세 점을 다 걸쳤을 때만
const BOLT_RANGE := 12.0
const DASH_SPEED := 620.0 * (6.0 / 148.0) # 웹 BASE_SPD(148px/s)→WALK_SPEED(6.0m/s) 환산
const DASH_DURATION := 0.2 # 원작 "0.2 * (sk.far||1)"
const DASH_HIT_RADIUS := 2.4 # melee_attack.gd ATK_RANGE
const CHAIN_HOPS := 3
const CHAIN_RANGE := 7.65 # 원작 chainR 기본값 260px ÷ BASE_REACH(34)
const CHAIN_FALLOFF := 0.12
const CURSE_SLOW := 0.35 # 원작 "ce.slowMul = 0.35", 단 무관
const SCATTER_X := 40.0 * (6.0 / 148.0) / 2.0 # ≈0.81m — 웹 "(Math.random()-0.5)*40"의 절반
const SCATTER_Z := 30.0 * (6.0 / 148.0) / 2.0 # ≈0.61m

var _cd: Dictionary = {} # 무예 키 -> 남은 쿨다운(초)
var _dash_left := 0.0
var _dash_hit: Array = []
var _dash_sk: Dictionary = {}
var _dash_rank := 0
var _hits := 0 # 이번 시전에서 맞힌 수 — 첫 적만 멈칫·흔들림
## G-0284 무예 모양 → 몸짓 클립(saga_core player.play_once). 쏘기·저주·사슬 = 손 뻗어 시전(모캡 cast) · 휘두르기 = 내리찍기(모캡 strong)
## · 터뜨리기·부르기 = burst · 돌진 = 구르기 · 몸 북돋기·회복 = skill.
const SHAPE_POSE := {"bolt": "cast", "curse": "cast", "chain": "cast", "swing": "strong", "nova": "burst", "summon": "burst", "dash": "dodge", "buff": "skill", "heal": "skill"}
@onready var _player: Node3D = get_parent()


func _ready() -> void:
	add_to_group("skill_caster")


func _process(delta: float) -> void:
	for k in _cd.keys():
		_cd[k] = float(_cd[k]) - delta
		if float(_cd[k]) <= 0.0:
			_cd.erase(k)
	for i in SLOT_ACTIONS.size():
		if Input.is_action_just_pressed(SLOT_ACTIONS[i]):
			try_slot(i)
	if InputMap.has_action(SET_ACTION) and Input.is_action_just_pressed(SET_ACTION):
		try_set_skill()


## 지금 직업의 i번째 자리에 걸린 무예 키("" = 빈 칸). HUD 단추가 이모지·쿨다운을 그릴 때도 읽는다.
func slot_key(i: int) -> String:
	var cls := DungeonItems.class_key_for_weapon(DungeonEquipmentState.weapon)
	var eq: Array = DungeonSkillState.equipped(cls)
	return str(eq[i]) if i >= 0 and i < eq.size() else ""


func cooldown_left(skill_key: String) -> float:
	return float(_cd.get(skill_key, 0.0))


## 키보드(Z·X·C·V)와 HUD 자리 단추가 같은 진입점을 부른다.
func try_slot(i: int) -> bool:
	var k := slot_key(i)
	return k != "" and try_cast(k)


func try_cast(skill_key: String) -> bool:
	if cooldown_left(skill_key) > 0.0:
		return false
	var rank := DungeonSkillState.rank_of(skill_key)
	if rank <= 0:
		return false
	var sk := DungeonSkills.skill_by_key(skill_key)
	if not DungeonSkills.is_active(sk):
		return false
	sk = SkillTree.mods(sk)   # G-0241 나무 — 복제본에 r·el·shots·hops·tree_* (원본 표는 그대로)
	var blood := Meridian.blood_cost(get_tree())   # G-0217 혈공(경락 규칙) — 무예마다 최대 체력 5%, 모자라면 못 쓴다
	var ph: Node = get_tree().get_first_node_in_group("player_health") if blood > 0.0 else null
	if ph != null and float(ph.hp) <= blood:
		return false
	_hits = 0
	var ok := _cast_shape(sk, rank)
	if ok and _player.has_method("play_once"):   # G-0284 무예 몸짓 — 모양별(SHAPE_POSE)
		_player.call("play_once", String(SHAPE_POSE.get(str(sk.shape), "skill")), 0.4)
	if ok:
		_cd[skill_key] = float(sk.cd) * Meridian.mul("cd") * float(sk.get("tree_cd", 1.0))   # G-0217 기력·혈공·무심(경락) × G-0241 나무(재냉각·기력, 하한 ×0.3)
		if float(sk.get("tree_drain", 0.0)) > 0.0:   # G-0241 나무 흡수 — 시전 때 6초 흡혈
			DungeonRunState.add_temp_buff("drainPct", float(sk.tree_drain), SkillTree.DRAIN_SEC)
		var g := SkillTree.gain(skill_key)   # G-0241 시전 1 = 경험 1 (ok 일 때만)
		if bool(g.up) and is_inside_tree():
			Toast.show(self, "🌱 %s %s 무예 레벨 %d — 나무에 점 하나" % [str(sk.get("icon", "")), str(sk.name), int(g.lv)], 2.5)
		if ph != null:
			ph.hp = maxf(1.0, float(ph.hp) - blood)
			ph.hp_changed.emit(ph.hp, ph.max_hp)
	return ok


## G-0398 — 지금 세 점을 다 걸친 세트의 무예(없으면 {}). HUD T 단추도 읽는다.
func set_skill() -> Dictionary:
	var k: String = DungeonEquipmentState.full_set_key()
	return DungeonItems.set_skill(k) if k != "" else {}


## G-0398 세트 무예 — 단 1 고정(배우지 않음)·나무·혈공·경락 재냉각 없음(웹 "세트를 맞춘 보상" — 쿨다운만).
func try_set_skill() -> bool:
	var sk := set_skill()
	if sk.is_empty() or cooldown_left(String(sk.key)) > 0.0:
		return false
	_hits = 0
	var ok := _cast_shape(sk, 1)
	if ok:
		_cd[String(sk.key)] = float(sk.cd)
		if _player.has_method("play_once"):
			_player.call("play_once", String(SHAPE_POSE.get(str(sk.shape), "skill")), 0.4)
	return ok


## 모양별 판정(무예 표·세트 무예 공용 — 옛 try_cast 안 match 를 옮김)
func _cast_shape(sk: Dictionary, rank: int) -> bool:
	var ok := false
	match str(sk.shape):
		"bolt": ok = _cast_bolt(sk, rank)
		"swing": ok = _cast_area(sk, rank, float(sk.r) * DungeonRunState.reach_mult() * (1.0 + Meridian.add("swingRangePct") / 100.0))
		"nova": ok = _cast_area(sk, rank, float(sk.r))
		"dash": ok = _cast_dash(sk, rank)
		"buff":
			DungeonRunState.add_temp_buff(str(sk.buff_eff), DungeonSkills.value_at(sk, rank), float(sk.sec) * (1.0 + Meridian.add("buffDurPct") / 100.0))
			_burst(sk, SELF_BURST_R)
			ok = true
		"heal":
			ok = _cast_heal(sk, rank)
			if ok:
				_burst(sk, SELF_BURST_R)
		"curse": ok = _cast_curse(sk, rank)
		"summon": ok = _cast_summon(sk, rank)
		"chain": ok = _cast_chain(sk, rank)
	return ok


func _cast_bolt(sk: Dictionary, rank: int) -> bool:
	var candidates: Array = []
	for enemy in get_tree().get_nodes_in_group("dungeon_enemy"):
		if not is_instance_valid(enemy):
			continue
		var d: float = enemy.global_position.distance_to(_player.global_position)
		if d <= BOLT_RANGE:
			candidates.append([d, enemy])
	if candidates.is_empty():
		return false
	candidates.sort_custom(func(a, b): return a[0] < b[0])
	var value := DungeonSkills.value_at(sk, rank)
	var col := el_color(sk)
	for i in range(mini(int(sk.get("shots", 1)) + int(Meridian.add("boltShotAdd")), candidates.size())):
		var enemy: Node3D = candidates[i][1]
		var to := enemy.global_position - _player.global_position
		CombatFx.slash(_player, to, minf(to.length(), 3.0), col, i)
		CombatFx.spark(_player, enemy.global_position + Vector3.UP * 0.9, col)
		_strike(enemy, sk, value)
	return true


func _cast_area(sk: Dictionary, rank: int, radius: float) -> bool:
	var targets := _enemies_in_radius(radius)
	if targets.is_empty():
		return false
	var value := DungeonSkills.value_at(sk, rank)
	_burst(sk, radius)
	for enemy in targets:
		_strike(enemy, sk, value)
	return true


func _cast_dash(sk: Dictionary, rank: int) -> bool:
	if _dash_left > 0.0:
		return false
	_dash_left = DASH_DURATION * float(sk.get("far", 1.0)) * Meridian.mul("dash")   # G-0217 유수(경락) ×1.5
	_dash_hit.clear()
	_dash_sk = sk
	_dash_rank = rank
	var visual := _player.get_node_or_null("Visual") as Node3D
	var dir: Vector3 = -visual.global_transform.basis.z if visual else Vector3.FORWARD
	dir.y = 0.0
	if dir.length() < 0.001:
		dir = Vector3.FORWARD
	_player.dash_dir = dir.normalized()
	_player.dash_speed = DASH_SPEED
	CombatFx.slash(_player, dir, DASH_HIT_RADIUS, el_color(sk), 3, true)
	return true


func _physics_process(delta: float) -> void:
	if _dash_left <= 0.0:
		return
	_dash_left -= delta
	if _dash_left <= 0.0:
		_player.dash_speed = 0.0
	for enemy in get_tree().get_nodes_in_group("dungeon_enemy"):
		if not is_instance_valid(enemy) or _dash_hit.has(enemy):
			continue
		if enemy.global_position.distance_to(_player.global_position) <= DASH_HIT_RADIUS:
			_dash_hit.append(enemy)
			CombatFx.spark(_player, enemy.global_position + Vector3.UP * 0.9, el_color(_dash_sk))
			_strike(enemy, _dash_sk, DungeonSkills.value_at(_dash_sk, _dash_rank))


func _cast_heal(sk: Dictionary, rank: int) -> bool:
	var found := get_tree().get_nodes_in_group("player_health")
	if found.is_empty():
		return false
	var ph: Node = found[0]
	ph.heal_by(float(ph.max_hp) * DungeonSkills.value_at(sk, rank) / 100.0 * (1.0 + Meridian.add("healBonusPct") / 100.0))
	return true


func _cast_curse(sk: Dictionary, rank: int) -> bool:
	var targets := _enemies_in_radius(float(sk.r))
	if targets.is_empty():
		return false
	var value := DungeonSkills.value_at(sk, rank)
	_burst(sk, float(sk.r))
	for enemy in targets:
		var sec := float(sk.sec) * (1.0 + Meridian.add("curseDurPct") / 100.0)   # G-0217 저주 길이
		enemy.apply_elem_slow(CURSE_SLOW, sec)
		enemy.apply_hex(value, sec)
	return true


func _cast_summon(sk: Dictionary, rank: int) -> bool:
	if Meridian.has_rule("lone"):   # G-0217 독행(경락 규칙) — 분신 없음
		return false
	var parent := get_tree().current_scene
	if parent == null:
		parent = _player.get_parent()
	for i in range(roundi(DungeonSkills.value_at(sk, rank)) + int(Meridian.add("summonCountAdd")) + int(sk.get("summon_add", 0))):
		var m: Node3D = DungeonMinion.new()
		m.kind_key = str(sk.key) # G-0202 몸 고르기 — _ready 전에
		parent.add_child(m)
		m.life_left = float(sk.sec)
		m.mul = 0.5 * float(sk.get("str", 1.0))
		m.global_position = _player.global_position + Vector3(
			(randf() - 0.5) * SCATTER_X * 2.0, 0.0, (randf() - 0.5) * SCATTER_Z * 2.0)
		CombatFx.spark(_player, m.global_position + Vector3.UP * 0.6, el_color(sk))
	return true


func _cast_chain(sk: Dictionary, rank: int) -> bool:
	var enemies := get_tree().get_nodes_in_group("dungeon_enemy")
	var cur: Node = _nearest_to(_player.global_position, enemies, [])
	if cur == null:
		return false
	var value := DungeonSkills.value_at(sk, rank)
	var chain_r: float = float(sk.get("r", CHAIN_RANGE))
	var hops: int = int(sk.get("hops", CHAIN_HOPS)) + int(Meridian.add("chainHopsAdd"))
	var hit: Array = []
	var hop := 0
	var col := el_color(sk)
	while cur != null and hop < hops:
		CombatFx.spark(_player, (cur as Node3D).global_position + Vector3.UP * 0.9, col, hop == hops - 1)
		_strike(cur, sk, value * (1.0 - hop * CHAIN_FALLOFF))
		hit.append(cur)
		cur = _nearest_to(cur.global_position, enemies, hit, chain_r)
		hop += 1
	return true


func _nearest_to(from: Vector3, candidates: Array, exclude: Array, max_range: float = INF) -> Node:
	var best: Node = null
	var best_d := max_range
	for enemy in candidates:
		if not is_instance_valid(enemy) or enemy.hp <= 0.0 or exclude.has(enemy):
			continue
		var d: float = enemy.global_position.distance_to(from)
		if d <= best_d:
			best_d = d
			best = enemy
	return best


func _enemies_in_radius(radius: float) -> Array:
	var out: Array = []
	for enemy in get_tree().get_nodes_in_group("dungeon_enemy"):
		if not is_instance_valid(enemy):
			continue
		if enemy.global_position.distance_to(_player.global_position) <= radius:
			out.append(enemy)
	return out


## dungeon.js strike() 그대로(옛 사본 _strike_<이름>() 아홉 벌이 같던 식) — 공격력×배수×무예 배율, 치명, 원소 저항, 최소 1.
func _strike(enemy: Node, sk: Dictionary, mult: float) -> void:
	DungeonSaveState.tutorial_action("skill")
	var pct_mult: float = DungeonRunState.atk_mult() + DungeonEquipmentState.atk_pct_bonus() / 100.0
	var base: float = MeleeAttack.ATK_DAMAGE * pct_mult + DungeonEquipmentState.atk_flat_bonus()
	var dmg: float = base * mult * DungeonRunState.skill_mul() * float(sk.get("tree_dmg", 1.0))   # G-0241 나무 위력
	var is_crit := randf() * 100.0 < DungeonRunState.crit_chance()
	if is_crit and Meridian.has_rule("onecut"):   # G-0217 일격 — 치명 없음(굴림 순서는 그대로)
		is_crit = false
	if is_crit:
		dmg *= MeleeAttack.CRIT_MULT
	var first_mul: float = DungeonEquipmentState.take_first_hit()   # G-0236 바꿔 든 직후 첫 타 ×1.15(한 번)
	dmg *= first_mul
	dmg *= Meridian.hit_mul(get_tree(), enemy, _player) * Meridian.mul("skill")   # G-0217 경락 규칙(무심 무예 ×0.7)
	var el: String = str(sk.get("el", "phys"))
	var res: float = float(enemy.resist_pct(el)) if enemy.has_method("resist_pct") else 0.0
	if res > 0.0:
		dmg *= 1.0 - res / 100.0
	dmg = maxf(1.0, roundf(dmg))
	if enemy.has_method("take_damage"):
		enemy.take_damage(dmg)
		preload("res://games/saga_dungeon/data/dungeon_rank.gd").hit()   # G-0312 한 판 등급 — 연속
	if enemy is Node3D:
		CombatFeel.hit(enemy, dmg, is_crit, DungeonEquipmentState.FIRST_HIT_TUNE if first_mul > 1.0 else ({} if _hits == 0 else HIT_QUIET))
		_hits += 1


## 무예의 원소 색(ELEMENTS color, 없으면 phys).
static func el_color(sk: Dictionary) -> Color:
	var e := DungeonItems.elem_by_key(str(sk.get("el", "phys")))
	return Color(str(e.get("color", "#d0c8b8")))


static func el_particle(sk: Dictionary) -> String:
	return str(EL_PARTICLE.get(str(sk.get("el", "phys")), ""))


## 제 자리 원소 원환·입자(swing·nova·curse 는 판정 반경, buff·heal 은 작게).
func _burst(sk: Dictionary, radius: float) -> void:
	CombatFx.element_burst(_player, _player.global_position, radius, el_color(sk), RING_SEC, el_particle(sk), false)
