extends Node

## VERTICAL_SLICE_DUNGEON.md 3절 — 실시간 근접 공격. GO의 duel_rules.gd
## (턴형 선택지 판정, 화면이 멈추고 버튼을 고른다)와는 완전히 다른 모델이라
## 새로 짰다 — 이동하며 버튼 한 번으로 때리는 실시간 액션. 웹판
## `dungeon.js`의 BASE_ATK_CD(0.55초)를 그대로 이식했다(새 수치를 만들지
## 않는다). 기본 데미지(9)는 맨손 기준으로 직접 정한 값이다(장비 등급+
## 접사가 없던 시절 — 잡졸(HP≈24)을 세 대 안에 눕히는 감각을 노렸다).
## 장비를 주우면 아래처럼 이 기본값에 배율·flat이 더 붙는다.
##
## Player의 자식 컴포넌트로 붙는다(player_health.gd와 같은 경계) — 이
## 스크립트가 곧 "공격 입력을 받는 자리"다. HUD의 공격 버튼도 이 노드를
## "melee_attack" 그룹으로 찾아 같은 진입점(`try_attack()`)을 부른다.
##
## 은사(DungeonRunState) 적용 — 웹판 dungeon.js strike()/atkCdOf()/reachOf()
## 그대로: 공격력·공격 속도·사거리는 배율, 치명타는 1.85배(crit 확률은
## critPct 합), 분신(echoPct)은 같은 대상을 한 번 더 때린다, 흡혈(drainPct)은
## 그 타격으로 죽였을 때 최대 체력의 %만큼 회복한다.
##
## "제외" 목록 3번(장비 등급+접사) — item.js 주석의 순서(기본치 × 성장배율
## × (1 + 장비 pct) + 펫 + 장비 flat)를 그대로 따른다: 은사 배율에 장비의
## might/allPct(atk_pct_bonus)까지 곱한 뒤, 장비의 main+might/allstat
## flat(atk_flat_bonus)을 마지막에 더한다.
##
## "제외" 목록 4번(원소 6결+저항) — dungeon.js strike()가 물리 타격 뒤
## `applyElem(e, mul)`을 부르는 것과 같은 자리. **결마다 저항이 따로**고
## (DungeonEquipmentState.elem_damage()가 결별로 이미 더해 준다), 크리티컬은
## 안 탄다(웹판도 mul만 받지 crit 배율은 안 넘긴다). 빙은 느려짐, 독은
## dot으로 나눠 문다 — DungeonEnemy.apply_elem_slow()/apply_elem_dot()가 받는다.
##
## PLAN 101-2 DUNGEON ③(손맛 2차, 2026-09-17) — `_strike()`가 유일한
## "타격 한 곳"이라 `saga_core/combat_feel.gd`의 5요소(hitstop·흔들림·
## 플래시·숫자 팝·타격음)를 여기서 잇는다(`CombatFeel.hit()`).

const Voice := preload("res://saga_core/audio/voice.gd")   # G-0111 대사 음성
const ATK_COOLDOWN := 0.55 # 웹판 BASE_ATK_CD 그대로
const ATK_DAMAGE := 9.0
const ATK_RANGE := 2.4
const CRIT_MULT := 1.85 # 웹판 dungeon.js strike()의 "dmg *= 1.85" 그대로

var _cooldown_left := 0.0
@onready var _player: Node3D = get_parent()


func _ready() -> void:
	add_to_group("melee_attack")


func _process(delta: float) -> void:
	_cooldown_left = maxf(0.0, _cooldown_left - delta)
	if Input.is_action_pressed("dungeon_attack"):
		try_attack()


## HUD의 공격 버튼도 이 진입점을 그대로 부른다(키보드/버튼 두 입력이
## 같은 판정을 타게 해 중복 로직이 안 생긴다).
func try_attack() -> void:
	if _cooldown_left > 0.0:
		return
	_cooldown_left = ATK_COOLDOWN / DungeonRunState.atk_speed_mult()
	var range_now: float = ATK_RANGE * DungeonRunState.reach_mult()
	for enemy in get_tree().get_nodes_in_group("dungeon_enemy"):
		if not is_instance_valid(enemy):
			continue
		if enemy.global_position.distance_to(_player.global_position) <= range_now:
			if enemy.has_method("take_damage"):
				_strike(enemy)
				if is_instance_valid(enemy) and randf() * 100.0 < DungeonRunState.echo_pct():
					_strike(enemy)


func _strike(enemy: Node) -> void:
	var was_alive: bool = enemy.hp > 0.0
	var pct_mult: float = DungeonRunState.atk_mult() + DungeonEquipmentState.atk_pct_bonus() / 100.0
	var dmg: float = ATK_DAMAGE * pct_mult + DungeonEquipmentState.atk_flat_bonus()
	var is_crit := randf() * 100.0 < DungeonRunState.crit_chance()
	if is_crit:
		dmg *= CRIT_MULT
	## dungeon.js strike()의 "res = resistOf(e,'phys'); if (res>0) dmg *= 1-res/100"
	## 그대로 — 정예 "철갑 두른"이 붙기 전엔 어떤 몬스터에도 resist.phys가
	## 없어(0으로 조회됨) 지금까지는 이 자리를 안 타도 결과가 같았다.
	var phys_res: float = float(enemy.resist_pct("phys")) if enemy.has_method("resist_pct") else 0.0
	if phys_res > 0.0:
		dmg *= 1.0 - phys_res / 100.0
	enemy.take_damage(dmg)
	## PLAN 101-2 DUNGEON ③(손맛 2차, 2026-09-17) — saga_core/combat_feel.gd
	## 헤더 참고. 유일한 "타격 한 곳"(melee_attack.gd) 에서만 이번에 잇는다
	## — 무예 스크립트 80여 개는 범위 밖(다음 세션).
	if enemy is Node3D:
		CombatFeel.hit(enemy, dmg, is_crit)
		Voice.say("shout")   # G-0111 — 가끔 외침(말하는 이 = Voice.speaker)
	if is_instance_valid(enemy) and enemy.hp > 0.0:
		_apply_elemental(enemy)
		## dungeon.js strike()의 "가시 돋친" 반사 — 죽이지 못했을 때만 되받는다
		## (원작도 e.hp>0 조건).
		if enemy.has_method("thorn_reflect"):
			var reflect: float = enemy.thorn_reflect(dmg)
			if reflect > 0.0:
				var ph := get_tree().get_nodes_in_group("player_health")
				if not ph.is_empty():
					ph[0].take_damage(reflect)
	var drain: float = DungeonRunState.drain_pct()
	if was_alive and drain > 0.0 and (not is_instance_valid(enemy) or enemy.hp <= 0.0):
		var found := get_tree().get_nodes_in_group("player_health")
		if not found.is_empty():
			found[0].heal_by(found[0].max_hp * drain / 100.0)


## dungeon.js applyElem() — 무기(+부적)에 박은 보석·주옥이 얹는 원소 피해.
## 결마다 저항이 따로다. 빙은 느려짐, 독은 dot, 뇌는 편차(spread)가 크다.
##
## 2026-09-17, PLAN 101-2 DUNGEON ①(축복 3택) 세계 축 — 이 함수가 이미
## "여러 결을 한 번에 순회"하는 유일한 자리라 원소 시너지(dungeon_boons.gd
## SYNERGIES)를 여기 얹었다. dmgs.is_empty() 가드는 시너지 검사가 젬을 하나도
## 안 박은 채로도 매 타격 돌게 하지 않으려는 것뿐(기존 동작은 그대로).
func _apply_elemental(enemy: Node) -> void:
	var dmgs := DungeonEquipmentState.elem_damage()
	if dmgs.is_empty():
		return
	var death_pos: Vector3 = enemy.global_position
	for el in dmgs:
		var def := DungeonItems.elem_by_key(str(el))
		if def.is_empty():
			continue
		var v: float = float(dmgs[el])
		var spread: float = float(def.get("spread", 0.0))
		if spread > 0.0:
			v *= 1.0 - spread / 2.0 + randf() * spread
		var er: float = float(enemy.resist_pct(str(el))) if enemy.has_method("resist_pct") else 0.0
		v *= 1.0 - er / 100.0
		v = maxf(1.0, roundf(v))
		var dot: float = float(def.get("dot", 0.0))
		if dot > 0.0:
			if enemy.has_method("apply_elem_dot"):
				enemy.apply_elem_dot(v / dot, dot)
		elif is_instance_valid(enemy):
			enemy.take_damage(v)
		var slow: float = float(def.get("slow", 0.0))
		if slow > 0.0 and is_instance_valid(enemy) and enemy.has_method("apply_elem_slow"):
			enemy.apply_elem_slow(slow, float(def.get("slow_sec", 1.0)))
	_check_elem_synergy(dmgs, enemy, death_pos)


## dungeon_boons.gd SYNERGIES 참고 — "처치 시" 그대로: 이 타격(물리+원소)이
## 그 적을 눕히지 못했으면 시너지는 안 뜬다. `dmgs`(이번 타격에 실제로
## 박혀 있던 결)에 그 쌍이 둘 다 있어야 하고, 그 쌍의 은사(syn_*)를 이미
## 골랐어야 한다. skill_nova.gd 등이 이미 쓰는 "반경 안 적 순회" 판정을
## 그대로 재사용한다 — 새 판정 로직 없음.
func _check_elem_synergy(dmgs: Dictionary, enemy: Node, pos: Vector3) -> void:
	if is_instance_valid(enemy) and enemy.hp > 0.0:
		return
	for syn: Dictionary in DungeonBoons.SYNERGIES:
		if not DungeonRunState.boons.has(str(syn.key)):
			continue
		if not (dmgs.has(syn.a) and dmgs.has(syn.b)):
			continue
		for other in get_tree().get_nodes_in_group("dungeon_enemy"):
			if not is_instance_valid(other) or other == enemy:
				continue
			if other.global_position.distance_to(pos) <= DungeonBoons.SYN_RADIUS:
				other.take_damage(DungeonBoons.SYN_DAMAGE)
