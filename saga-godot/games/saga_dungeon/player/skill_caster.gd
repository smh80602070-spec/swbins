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

const MeleeAttack := preload("res://games/saga_dungeon/player/melee_attack.gd")
const DungeonMinion := preload("res://games/saga_dungeon/world/dungeon_minion.gd")
const SLOT_ACTIONS: Array[String] = ["dungeon_slot_1", "dungeon_slot_2", "dungeon_slot_3", "dungeon_slot_4"]
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
	var ok := false
	match str(sk.shape):
		"bolt": ok = _cast_bolt(sk, rank)
		"swing": ok = _cast_area(sk, rank, float(sk.r) * DungeonRunState.reach_mult())
		"nova": ok = _cast_area(sk, rank, float(sk.r))
		"dash": ok = _cast_dash(sk, rank)
		"buff":
			DungeonRunState.add_temp_buff(str(sk.buff_eff), DungeonSkills.value_at(sk, rank), float(sk.sec))
			ok = true
		"heal": ok = _cast_heal(sk, rank)
		"curse": ok = _cast_curse(sk, rank)
		"summon": ok = _cast_summon(sk, rank)
		"chain": ok = _cast_chain(sk, rank)
	if ok:
		_cd[skill_key] = float(sk.cd)
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
	for i in range(mini(int(sk.get("shots", 1)), candidates.size())):
		_strike(candidates[i][1], sk, value)
	return true


func _cast_area(sk: Dictionary, rank: int, radius: float) -> bool:
	var targets := _enemies_in_radius(radius)
	if targets.is_empty():
		return false
	var value := DungeonSkills.value_at(sk, rank)
	for enemy in targets:
		_strike(enemy, sk, value)
	return true


func _cast_dash(sk: Dictionary, rank: int) -> bool:
	if _dash_left > 0.0:
		return false
	_dash_left = DASH_DURATION * float(sk.get("far", 1.0))
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
			_strike(enemy, _dash_sk, DungeonSkills.value_at(_dash_sk, _dash_rank))


func _cast_heal(sk: Dictionary, rank: int) -> bool:
	var found := get_tree().get_nodes_in_group("player_health")
	if found.is_empty():
		return false
	var ph: Node = found[0]
	ph.heal_by(float(ph.max_hp) * DungeonSkills.value_at(sk, rank) / 100.0)
	return true


func _cast_curse(sk: Dictionary, rank: int) -> bool:
	var targets := _enemies_in_radius(float(sk.r))
	if targets.is_empty():
		return false
	var value := DungeonSkills.value_at(sk, rank)
	for enemy in targets:
		enemy.apply_elem_slow(CURSE_SLOW, float(sk.sec))
		enemy.apply_hex(value, float(sk.sec))
	return true


func _cast_summon(sk: Dictionary, rank: int) -> bool:
	var parent := get_tree().current_scene
	if parent == null:
		parent = _player.get_parent()
	for i in range(roundi(DungeonSkills.value_at(sk, rank))):
		var m: Node3D = DungeonMinion.new()
		parent.add_child(m)
		m.life_left = float(sk.sec)
		m.mul = 0.5 * float(sk.get("str", 1.0))
		m.global_position = _player.global_position + Vector3(
			(randf() - 0.5) * SCATTER_X * 2.0, 0.0, (randf() - 0.5) * SCATTER_Z * 2.0)
	return true


func _cast_chain(sk: Dictionary, rank: int) -> bool:
	var enemies := get_tree().get_nodes_in_group("dungeon_enemy")
	var cur: Node = _nearest_to(_player.global_position, enemies, [])
	if cur == null:
		return false
	var value := DungeonSkills.value_at(sk, rank)
	var chain_r: float = float(sk.get("r", CHAIN_RANGE))
	var hops: int = int(sk.get("hops", CHAIN_HOPS))
	var hit: Array = []
	var hop := 0
	while cur != null and hop < hops:
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
	var pct_mult: float = DungeonRunState.atk_mult() + DungeonEquipmentState.atk_pct_bonus() / 100.0
	var base: float = MeleeAttack.ATK_DAMAGE * pct_mult + DungeonEquipmentState.atk_flat_bonus()
	var dmg: float = base * mult * DungeonRunState.skill_mul()
	if randf() * 100.0 < DungeonRunState.crit_chance():
		dmg *= MeleeAttack.CRIT_MULT
	var el: String = str(sk.get("el", "phys"))
	var res: float = float(enemy.resist_pct(el)) if enemy.has_method("resist_pct") else 0.0
	if res > 0.0:
		dmg *= 1.0 - res / 100.0
	dmg = maxf(1.0, roundf(dmg))
	if enemy.has_method("take_damage"):
		enemy.take_damage(dmg)
