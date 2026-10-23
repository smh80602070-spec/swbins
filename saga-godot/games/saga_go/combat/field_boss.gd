extends "res://games/saga_go/combat/field_enemy.gd"

## PLAN 106장 ㉑ — 원신식 주간 보스 "먹구름 이무기"(field_enemy 를 이어받아 패턴만 더한다). 주간 보스 비경(domains.gd)이 원판 가운데에 둔다.
##   패턴 셋을 차례로(재사용 3.5초, 2단계 2.4초):
##     내려찍기 — 보스 둘레 5m 붉은 원 1.2초 예고 → 안에 있으면 공격 ×1.6(원 밖으로 나가거나 대시로 피한다)
##     먹구름 벼락 — 플레이어 발밑과 양옆 3m 에 원 셋(반경 2.5m) 1.0초 예고 → 안이면 ×1.2(한 번만)
##     물기 — 들판 적과 같은 돌진(가까울 때)
##   체력 절반에서 2단계: 뇌 원소 방패(체력 배율 × 600, 불로 ×2.5 — elements.gd 상성) + 패턴이 빨라짐. 방패가 깨지면 2초 비틀거림.
## 106장 ㉓ 들판 보스 셋(world/field_bosses.gd)도 이 틀 — 2단계 방패 양·알림 글자는 KINDS 칸 phase_shield·phase_text,
## 방패 원소는 보스 원소. 집으로 돌아가 체력을 채우거나 되살아나면 1단계로 돌아간다(_on_reset).
## 이름은 이 판 것.

const BossToast := preload("res://saga_core/ui/toast.gd")
const Minion := preload("res://games/saga_go/combat/field_enemy.gd")

signal phase_changed(phase: int)

const ROTATION := ["slam", "storm", "bite"]
const SKILL_CD := 3.5
const SKILL_CD_P2 := 2.4
const SLAM := {"radius": 5.0, "tell": 1.2, "mul": 1.6}
const STORM := {"radius": 2.5, "tell": 1.0, "mul": 1.2, "side": 3.0}
const PHASE2_SHIELD := 600.0
const PHASE2_AT := 0.5
## 106장 ㉜ 그림자 — 플레이어 등 뒤 SHADOW.behind m 로 옮겨 붙어 둘레 radius 내려찍기(예고가 짧다, 대시로 피한다).
const SHADOW := {"behind": 2.2, "radius": 3.2, "tell": 0.8, "mul": 1.4}
const SUMMON_SPREAD := 4.0
## 106장 ㉞ 밀물 — 보스에서 플레이어 쪽으로 원 넷이 줄지어(first m 부터 step m 간격) 1.1초 예고. 옆으로 비켜 피한다.
const TIDE := {"count": 4, "first": 2.5, "step": 3.0, "radius": 2.0, "tell": 1.1, "mul": 1.3}
## 106장 ㊳ 고리 — 보스 둘레 inner~outer m 고리 1.3초 예고(먹구름 임금). 안쪽은 비어 있어 보스 곁으로 파고들거나 멀리 벗어나 피한다.
const HALO := {"inner": 3.0, "outer": 9.0, "tell": 1.3, "mul": 1.5}
## 106장 ㊺-4 틈새 질주 — 보스에서 플레이어 쪽으로(플레이어를 지나) 원 다섯 1.0초 예고 → 보스가 줄 끝으로 옮겨 나타난다(틈새 서리 구미호).
## 줄 끝 땅 높이가 RIFT.climb m 넘게 다르면(벽·바위 위) 옮기지 않고 원만 친다.
const RIFT := {"count": 5, "first": 2.0, "step": 2.6, "radius": 1.8, "tell": 1.0, "mul": 1.4, "climb": 1.5}

## G-0342 약점 부수기(호라이즌 — 구조만): 머리 쪽 빛나는 약점(표식) — 조준 급소 화살(aimed_shot 급소)이 맞힌 피해만큼 약점 체력이 깎이고,
## 0 이면 부서짐: 예고 끊고 PART_STAGGER 초 비틀 · 그 뒤 이 보스 공격 ×PART_WEAKEN · 표식 꺼짐. 집으로 돌아가거나 되살아나면(_on_reset) 다시 선다.
## SAGA_WEAKPART=0 이면 표식·약점 없음(옛 길).
const PART_FRAC := 0.12
const PART_STAGGER := 2.5
const PART_WEAKEN := 0.85
const PART_COLOR := Color(1.0, 0.5, 0.15)
var part_hp := -1.0   # 처음 맞을 때 max_hp × PART_FRAC 로 채움
var part_broken := false
var _part_mark: MeshInstance3D = null
var _part_tried := false

var phase := 1
var skill := ""

## G-0161 — 화면 위 보스 바(ui/boss_bar.gd)가 이 그룹에서 가까운 보스를 고른다.
func _enter_tree() -> void:
	add_to_group("go_boss")

var skill_t := 0.0
var skill_cd := 2.0
var hits_taken := 0 # 점검용 — 패턴에 맞은 번수
var _rot := 0
var _marks: Array = [] # [{pos, radius, node}]
var summoned: Array = [] # 2단계에 부른 졸개(def.summon) — 보스가 쓰러지거나 되돌아가면 흩어진다

func _physics_process(delta: float) -> void:
	if not _part_tried:
		ensure_part_mark()   # G-0342 약점 표식(한 번)
	if ai == AI.DEAD:
		_clear_marks()
		_clear_summons()
		super(delta)
		return
	_check_phase()
	if skill != "":
		_tick_status(delta)
		if ai == AI.DEAD:
			_clear_marks()
			return
		velocity = Vector3(0.0, -1.0 if is_on_floor() else velocity.y - GRAVITY * delta, 0.0)
		move_and_slide()
		## 빙결이면 예고가 멈춘다(원신도 얼리면 끊긴다) — 시간만 안 흐르게.
		if frozen_t > 0.0:
			return
		skill_t -= delta
		if skill_t <= 0.0:
			_fire()
		return
	skill_cd -= delta
	if skill_cd <= 0.0 and frozen_t <= 0.0 and (ai == AI.CHASE or ai == AI.RECOVER):
		var player := get_tree().get_first_node_in_group("player") as Node3D
		if _player_can_fight(player):
			var rot: Array = def.get("rotation", ROTATION)
			begin_skill(String(rot[_rot % rot.size()]), player)
			_rot += 1
			return
	super(delta)

## 패턴 시작(점검이 바로 부를 수 있다). bite 는 들판 적 돌진에 맡긴다.
func begin_skill(which: String, player: Node3D) -> void:
	skill_cd = SKILL_CD if phase == 1 else SKILL_CD_P2
	if which == "bite" or player == null:
		return
	skill = which
	var to_p := player.global_position - global_position
	to_p.y = 0.0
	if to_p.length() > 0.1:
		_face(to_p, 1.0)
	match which:
		"slam":
			skill_t = SLAM.tell
			_mark(global_position, SLAM.radius)
		"storm":
			skill_t = STORM.tell
			var side := to_p.normalized().cross(Vector3.UP) if to_p.length() > 0.1 else Vector3.RIGHT
			for off in [Vector3.ZERO, side * STORM.side, -side * STORM.side]:
				_mark(player.global_position + off, STORM.radius)
		"shadow":
			skill_t = SHADOW.tell
			var back: Vector3 = -(player.call("facing") as Vector3) if player.has_method("facing") else -to_p.normalized()
			back.y = 0.0
			if back.length() < 0.01:
				back = Vector3.BACK
			global_position = player.global_position + back.normalized() * SHADOW.behind
			velocity = Vector3.ZERO
			_face(player.global_position - global_position, 1.0)
			_mark(global_position, SHADOW.radius)
		"tide":
			skill_t = TIDE.tell
			var fwd := to_p.normalized() if to_p.length() > 0.1 else _facing()
			for i in int(TIDE.count):
				_mark(global_position + fwd * (float(TIDE.first) + float(TIDE.step) * i), float(TIDE.radius))
		"halo":
			skill_t = HALO.tell
			_mark(global_position, float(HALO.outer), float(HALO.inner))
		"rift":
			skill_t = RIFT.tell
			var lane := to_p.normalized() if to_p.length() > 0.1 else _facing()
			for i in int(RIFT.count):
				_mark(global_position + lane * (float(RIFT.first) + float(RIFT.step) * i), float(RIFT.radius))
	_set_tell(true)

func _fire() -> void:
	_set_tell(false)
	var player := get_tree().get_first_node_in_group("player") as Node3D
	var mul: float = {"slam": SLAM.mul, "shadow": SHADOW.mul, "tide": TIDE.mul, "halo": HALO.mul, "rift": RIFT.mul}.get(skill, STORM.mul)
	var hit := false
	if player:
		for m in _marks:
			var d: Vector3 = player.global_position - m.pos
			d.y = 0.0
			if d.length() <= float(m.radius) and d.length() >= float(m.get("inner", 0.0)):
				hit = true
				break
	if hit:
		var fc := get_tree().get_first_node_in_group("go_field_combat")
		if fc and fc.call("can_be_targeted"):
			fc.call("take_damage", def.atk * mul * dmg_mul * part_dmg_mul, self)   # G-0342 약점 부서지면 약해짐
			hits_taken += 1
	if skill == "rift" and not _marks.is_empty():
		_rift_to(_marks[_marks.size() - 1].pos)
	var rig := get_tree().get_first_node_in_group("camera_rig")
	if rig and skill == "slam":
		rig.call("shake", 0.18, 0.3)
	_flash_marks()
	skill = ""
	ai = AI.RECOVER
	_t = 0.6

## 틈새 질주 끝 — 줄 끝 땅(레이어 1, 나·적 빼고)에 나타난다. 높이가 크게 다르면 제자리.
func _rift_to(pos: Vector3) -> void:
	var q := PhysicsRayQueryParameters3D.create(Vector3(pos.x, global_position.y + 10.0, pos.z), Vector3(pos.x, global_position.y - 10.0, pos.z), 1)
	var skip: Array[RID] = [get_rid()]
	for n in get_tree().get_nodes_in_group("player") + get_tree().get_nodes_in_group("field_enemy"):
		if n is CollisionObject3D:
			skip.append((n as CollisionObject3D).get_rid())
	q.exclude = skip
	var hit := get_world_3d().direct_space_state.intersect_ray(q)
	if hit.is_empty() or absf(float((hit.position as Vector3).y) - global_position.y) > float(RIFT.climb):
		return
	global_position = Vector3(pos.x, float((hit.position as Vector3).y) + 0.3, pos.z)
	velocity = Vector3.ZERO

func _check_phase() -> void:
	if phase == 1 and hp <= max_hp * PHASE2_AT:
		phase = 2
		max_shield = _phase_shield()
		shield = max_shield
		skill_cd = minf(skill_cd, 1.0)
		_refresh_bar()
		BossToast.show(self, String(def.get("phase_text", "먹구름 이무기가 번개를 두른다 — 불로 방패를 깨라")), 3.0)
		_summon()
		phase_changed.emit(phase)

## 2단계 졸개(def.summon) — 보스 둘레에, 되살아나지 않고 전리품 없음, 보스와 같은 세계 등급.
func _summon() -> void:
	var kinds: Array = def.get("summon", [])
	for i in kinds.size():
		var a := TAU * float(i) / float(kinds.size())
		var p := global_position + Vector3(cos(a), 0.0, sin(a)) * SUMMON_SPREAD
		var m: CharacterBody3D = Minion.new()
		m.name = "%s_Summon_%d" % [name, i]
		m.setup(String(kinds[i]), p + Vector3.UP * 0.3, 20260824 + 700 + i)
		m.respawns = false
		m.drops = false
		if world_lv >= 0:
			m.apply_world_level(world_lv)
		get_parent().add_child(m)
		m.global_position = p + Vector3.UP * 0.3
		summoned.append(m)

func _clear_summons() -> void:
	for m in summoned:
		if is_instance_valid(m):
			(m as Node).queue_free()
	summoned.clear()

## 2단계 방패 — 체력 배율(비경 단계·세계 등급)을 그대로 따른다.
func _phase_shield() -> float:
	return float(def.get("phase_shield", PHASE2_SHIELD)) * (max_hp / float(def.hp))

## 들판 보스 — 끌려 나갔다 집에서 체력을 채우거나 되살아나면 1단계부터.
func _on_reset() -> void:
	var was := phase
	part_broken = false   # G-0342 약점 다시 선다
	part_hp = -1.0
	part_dmg_mul = 1.0
	if _part_mark != null and is_instance_valid(_part_mark):
		_part_mark.visible = true
	phase = 1
	_rot = 0
	skill_cd = 2.0
	_set_tell(false)
	_clear_marks()
	_clear_summons()
	max_shield = float(def.get("shield", 0.0)) * (max_hp / float(def.hp))
	shield = max_shield
	if was != 1:
		phase_changed.emit(phase)

## 세계 등급이 싸우는 중에 바뀌어도 2단계 방패는 깎인 비율 그대로.
func apply_world_level(wl: int) -> void:
	var ratio := shield / max_shield if max_shield > 0.0 else 1.0
	super(wl)
	if phase == 2:
		max_shield = _phase_shield()
		shield = max_shield * ratio
		if is_inside_tree():
			_refresh_bar()

# ---------------------------------------------------------------- 예고 원

## inner > 0 이면 가운데가 빈 고리(halo) — 납작한 도넛으로 그린다.
func _mark(pos: Vector3, radius: float, inner := 0.0) -> void:
	var mi := MeshInstance3D.new()
	if inner > 0.0:
		var tm := TorusMesh.new()
		tm.inner_radius = inner
		tm.outer_radius = radius
		tm.rings = 40
		mi.mesh = tm
		mi.scale = Vector3(1.0, 0.02, 1.0)
	else:
		var cm := CylinderMesh.new()
		cm.top_radius = radius
		cm.bottom_radius = radius
		cm.height = 0.04
		cm.radial_segments = 28
		mi.mesh = cm
	var mat := StandardMaterial3D.new()
	mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	mat.albedo_color = Color(1.0, 0.25, 0.2, 0.35)
	mi.material_override = mat
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	get_parent().add_child(mi)
	mi.global_position = Vector3(pos.x, global_position.y + 0.05, pos.z)
	_marks.append({"pos": pos, "radius": radius, "inner": inner, "node": mi})

func _flash_marks() -> void:
	for m in _marks:
		var mi: MeshInstance3D = m.node
		if not is_instance_valid(mi):
			continue
		(mi.material_override as StandardMaterial3D).albedo_color = Color(0.9, 0.8, 1.0, 0.7)
		var tw := mi.create_tween()
		tw.tween_property(mi, "scale", Vector3(1.15, mi.scale.y, 1.15), 0.2)
		tw.tween_callback(mi.queue_free)
	_marks.clear()

func _clear_marks() -> void:
	for m in _marks:
		if is_instance_valid(m.node):
			(m.node as Node).queue_free()
	_marks.clear()
	skill = ""

func _exit_tree() -> void:
	_clear_marks()
	_clear_summons()


## G-0342 약점 표식 — 몸 높이 0.85 자리 빛나는 공(급소 띠 WEAK_FRAC 0.7 위). 처음 보이는 프레임에 단다.
func ensure_part_mark() -> void:
	if _part_tried or not is_inside_tree():
		return
	_part_tried = true
	if OS.get_environment("SAGA_WEAKPART") == "0":
		return
	var m := MeshInstance3D.new()
	m.name = "WeakPart"
	var sm := SphereMesh.new()
	var h := float(def.get("height", 2.0))
	sm.radius = clampf(h * 0.07, 0.18, 0.45)
	sm.height = sm.radius * 2.0
	m.mesh = sm
	var mat := StandardMaterial3D.new()
	mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	mat.albedo_color = PART_COLOR
	mat.emission_enabled = true
	mat.emission = PART_COLOR
	mat.emission_energy_multiplier = 2.5
	m.material_override = mat
	m.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(m)
	m.position = Vector3(0.0, h * 0.85, 0.0)
	m.visible = not part_broken
	_part_mark = m


## 급소 화살이 맞힘(aimed_shot) — 부서졌으면 true
func part_hit(dealt: float) -> bool:
	if OS.get_environment("SAGA_WEAKPART") == "0" or part_broken or dealt <= 0.0 or ai == AI.DEAD:
		return false
	if part_hp < 0.0:
		part_hp = max_hp * PART_FRAC
	part_hp -= dealt
	if part_hp > 0.0:
		return false
	part_broken = true
	part_dmg_mul = PART_WEAKEN
	skill = ""
	skill_cd = maxf(skill_cd, PART_STAGGER)   # R-5 패턴 사이(쿨 0)에 부서지면 다음 프레임 새 패턴이 비틀을 먹던 것 막음
	_clear_marks()
	stagger(PART_STAGGER)
	if _part_mark != null and is_instance_valid(_part_mark):
		_part_mark.visible = false
	var fc := get_tree().get_first_node_in_group("go_field_combat")
	if fc != null:
		fc.call("_reaction_text", self, "약점 파괴!", PART_COLOR)
		fc.call("_ring_fx", global_position + Vector3.UP * float(def.get("height", 2.0)) * 0.85, 1.2, PART_COLOR, 0.35)
	var rig := get_tree().get_first_node_in_group("camera_rig")
	if rig != null and rig.has_method("shake"):
		rig.call("shake", 0.12, 0.25)
	return true
