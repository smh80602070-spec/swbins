extends Node3D

## PLAN.md 51장 "장비→빌드" — 무예 "summon"(분신술 등)이 세우는 분신 하나.
## dungeon_skills.gd 헤더 참고 — `CharacterBody3D`가 아니라 맨 `Node3D`다
## (물리 충돌 없음, `global_position`을 직접 옮긴다 — 원작 분신도 몸통
## 충돌이 없다, dash가 겪은 문제를 아예 피한다). 적이 이 분신을 공격하지
## 않는다(원작 그대로) — hp도, 죽음도 없다. `life_left`가 다 되면 스스로
## `queue_free()`한다.
##
## 원작 dungeon.js updateMinions() 그대로: 가장 가까운 적을 쫓다가 닿으면
## 멈춰 서서 주기적으로 때리고, 적이 없으면 플레이어 곁으로 돌아온다.
##
## G-0202 — 몸이 없어 보이지 않는 것이 때렸다(웹도 몸 없음). 무예 키(kind_key, 시전기가 add_child 전에 넣음)마다 몸 하나:
## saga_core 코드 짐승(creature_builder) 또는 플레이어 몸(Visual) 복제 반투명. 때릴 때 한 걸음 내딛고 불꽃 + 숫자(멈칫·흔들림·소리 없음).

const MeleeAttack := preload("res://games/saga_dungeon/player/melee_attack.gd")
const CreatureBuilder := preload("res://saga_core/world/creature_builder.gd")
const CombatFx := preload("res://saga_core/combat_fx.gd")
## 무예 키 → [모양, 몸색, 둘째색, 셋째색, opts, 키(m), 뜬 높이(m)] · ["self"] = 플레이어 몸 복제.
const BODY := {
	"w_hound": ["wolf", Color(0.45, 0.33, 0.22), Color(0.82, 0.72, 0.58), Color(0.2, 0.15, 0.1), {}, 0.9, 0.0],
	"a_hawk": ["bird", Color(0.42, 0.3, 0.2), Color(0.95, 0.93, 0.88), Color(0.95, 0.75, 0.25), {}, 0.6, 1.1],
	"s_spirit": ["fox9", Color(0.72, 0.88, 1.0), Color(0.95, 0.98, 1.0), Color(0.45, 0.75, 1.0), {"element": "ice"}, 1.0, 0.0],
	"y_golem": ["bear", Color(0.55, 0.4, 0.28), Color(0.38, 0.27, 0.18), Color(0.85, 0.6, 0.3), {}, 1.6, 0.0],
	"y_horde": ["goblin", Color(0.55, 0.55, 0.5), Color(0.3, 0.3, 0.32), Color(0.85, 0.85, 0.75), {"enemy": true}, 1.2, 0.0],
	"y_shade": ["self"],
	"m_reserve": ["self"],
}
const FALLBACK := ["goblin", Color(0.55, 0.55, 0.5), Color(0.3, 0.3, 0.32), Color(0.85, 0.85, 0.75), {}, 1.2, 0.0]
const SELF_MAX := 4 # 사람 몸 복제는 동시에 넷까지(VRoid 비용) — 넘으면 FALLBACK
const SELF_ALPHA := 0.45
const HIT_COLOR := Color("#d0c8b8") # dungeon_items ELEMENTS phys
const HIT_TUNE := {"stop_ms": 0, "shake_mul": 0.0, "quiet": true} # 곁다리 타격 — 숫자·번쩍임만(치명이면 +50ms 는 남는다)
const LUNGE_M := 0.3
const LUNGE_SEC := 0.15
const CHASE_SPEED := 110.0 * (6.0 / 148.0) # ≈4.46m/s — dungeon_skills.gd 헤더 참고
const RETURN_SPEED := 90.0 * (6.0 / 148.0) # ≈3.65m/s
const ATTACK_RANGE := 2.4 # melee_attack.gd ATK_RANGE 재사용(위 헤더 참고)
const ATTACK_COOLDOWN := 0.7 # 원작 "mn.cd = big ? 1.1 : 0.7" 그대로(big 없음)
const RETURN_DEADZONE := 40.0 * (6.0 / 148.0) # 원작 "pd > 40"의 그 40px

var life_left := 12.0
var mul := 0.5
var _atk_cd := 0.0
var _player: Node3D
var kind_key := ""
var _body: Node3D
var _body_rest := Vector3.ZERO
var _anim: AnimationPlayer
var _anim_now := ""


func _ready() -> void:
	add_to_group("dungeon_minion")
	_player = get_tree().get_first_node_in_group("player")
	_build_body()


func _build_body() -> void:
	var spec: Array = BODY.get(kind_key, FALLBACK)
	if String(spec[0]) == "self":
		spec = FALLBACK
		var vis: Node3D = _player.get_node_or_null("Visual") as Node3D if is_instance_valid(_player) else null
		if vis != null and get_tree().get_nodes_in_group("dungeon_minion_self").size() < SELF_MAX:
			_body = vis.duplicate() as Node3D
			_body.transform = Transform3D.IDENTITY
			add_to_group("dungeon_minion_self")
			for g in _body.find_children("*", "GeometryInstance3D", true, false):
				(g as GeometryInstance3D).transparency = SELF_ALPHA
	if _body == null:
		_body = CreatureBuilder.build(String(spec[0]), [spec[1], spec[2], spec[3]], spec[4])
		CreatureBuilder._fit(_body, String(spec[0]), float(spec[5]))
		_body.position.y = float(spec[6])
	_body.name = "Body"
	add_child(_body)
	_body_rest = _body.position
	_anim = _body.find_child("AnimationPlayer", true, false) as AnimationPlayer
	_play("idle")


func _play(anim_name: String) -> void:
	if _anim == null or _anim_now == anim_name or not _anim.has_animation(anim_name):
		return
	_anim_now = anim_name
	_anim.play(anim_name)


## 몸을 dir 쪽(앞 = +Z)으로 돌린다.
func _face(dir: Vector3) -> void:
	if _body != null and Vector2(dir.x, dir.z).length() > 0.01:
		_body.rotation.y = atan2(dir.x, dir.z)


func _physics_process(delta: float) -> void:
	life_left -= delta
	if life_left <= 0.0:
		queue_free()
		return
	_atk_cd = maxf(0.0, _atk_cd - delta)

	var target := _nearest_enemy()
	if target == null:
		_return_to_player(delta)
		return

	var to_target: Vector3 = target.global_position - global_position
	to_target.y = 0.0
	var dist := to_target.length()
	_face(to_target)
	if dist > ATTACK_RANGE:
		global_position += to_target.normalized() * CHASE_SPEED * delta
		_play("walk")
		return
	_play("idle")
	if _atk_cd <= 0.0:
		_atk_cd = ATTACK_COOLDOWN
		_strike(target)


func _return_to_player(delta: float) -> void:
	if not is_instance_valid(_player):
		return
	var to_player: Vector3 = _player.global_position - global_position
	to_player.y = 0.0
	if to_player.length() > RETURN_DEADZONE:
		global_position += to_player.normalized() * RETURN_SPEED * delta
		_face(to_player)
		_play("walk")
	else:
		_play("idle")


func _nearest_enemy() -> Node:
	var best: Node = null
	var best_d := INF
	for enemy in get_tree().get_nodes_in_group("dungeon_enemy"):
		if not is_instance_valid(enemy):
			continue
		var d: float = enemy.global_position.distance_to(global_position)
		if d < best_d:
			best_d = d
			best = enemy
	return best


## dungeon.js "strike(best, mn.mul, 4, 'phys')" 그대로 — skill_nova.gd
## 등과 같은 계산이지만 `value_at(rank)` 대신 고정 `mul`을 쓴다(랭크는
## 데미지가 아니라 분신 개체 수를 늘린다, 위 헤더 참고).
func _strike(enemy: Node) -> void:
	var pct_mult: float = DungeonRunState.atk_mult() + DungeonEquipmentState.atk_pct_bonus() / 100.0
	var base: float = MeleeAttack.ATK_DAMAGE * pct_mult + DungeonEquipmentState.atk_flat_bonus()
	var dmg: float = base * mul
	var crit := randf() * 100.0 < DungeonRunState.crit_chance()
	if crit:
		dmg *= MeleeAttack.CRIT_MULT
	var res: float = float(enemy.resist_pct("phys")) if enemy.has_method("resist_pct") else 0.0
	if res > 0.0:
		dmg *= 1.0 - res / 100.0
	dmg = maxf(1.0, roundf(dmg))
	if enemy.has_method("take_damage"):
		enemy.take_damage(dmg)
	if is_instance_valid(enemy) and enemy is Node3D:
		var at: Vector3 = (enemy as Node3D).global_position
		CombatFx.spark(self, at + Vector3.UP * 0.9, HIT_COLOR, crit)
		CombatFeel.hit(enemy, dmg, crit, HIT_TUNE)
		_lunge(at - global_position)


## 한 걸음 내딛었다 돌아온다(히트스톱에도 끝까지).
func _lunge(dir: Vector3) -> void:
	if _body == null:
		return
	dir.y = 0.0
	if dir.length() < 0.01:
		return
	var tw := _body.create_tween()
	tw.set_ignore_time_scale(true)
	tw.tween_property(_body, "position", _body_rest + dir.normalized() * LUNGE_M, LUNGE_SEC * 0.4)
	tw.tween_property(_body, "position", _body_rest, LUNGE_SEC * 0.6)
