extends "res://games/saga_go/player/player.gd"

## 2026-09-23 — 원신 기준 이동(사용자 "원신 같아야 해", PLAN 106장 ①).
## GO 전용이다. player.gd 는 DUNGEON·FOREST 도 같이 쓰므로 거기엔 손대지
## 않고 상속으로만 얹는다(GO Player.tscn 만 이 스크립트를 쓴다).
##
## 상태 여섯: 땅 · 공중 · 활공 · 등반 · 수영 · 넘어오르기(mantle).
##   점프      Space(모바일 "점프" 버튼) — 땅에서 뛰기, 공중에서 한 번 더 = 활공 펼치기/접기
##   달리기    Shift — 스태미나를 쓴다. 다 쓰면 30 까지 찰 때까지 못 달린다
##   등반      절벽·건물 벽으로 계속 밀면 붙는다. 앞=위, 점프=도약(스태미나 15),
##             뒤로 당기며 점프 = 벽 차고 뒤로, L(회피) = 손 놓기. 꼭대기에 닿으면 넘어오른다
##   수영      물(terrain_builder.gd WaterVolume)에 들어가면 저절로. Shift = 빠른 헤엄
##             스태미나가 다 떨어지면 마지막으로 딛은 땅으로 떠밀려 온다
## 동작 클립은 아직 등반·활공·수영 전용이 없다(Mixamo 로그인 필요) — 지금은
## 있는 idle/walk 를 몸 기울기(_pose_pitch)와 재생 속도로 흉내 낸다.

const Toast := preload("res://saga_core/ui/toast.gd")
const FieldCombat := preload("res://games/saga_go/combat/field_combat.gd")
const TerrainBuilder := preload("res://games/saga_go/world/terrain_builder.gd")

enum Mode { GROUND, AIR, GLIDE, CLIMB, SWIM, MANTLE, FLY }

const JUMP_VELOCITY := 7.5          # 정점 약 1.4m (중력 20)
const COYOTE_SEC := 0.1
const JUMP_BUFFER_SEC := 0.12
const MAX_FALL_SPEED := 30.0

const STAMINA_MAX := 100.0
const STAMINA_REGEN := 25.0          # /초, 땅에서 안 달릴 때
const STAMINA_REGEN_DELAY := 0.8
const STAMINA_EXHAUST_RECOVER := 30.0
const COST_SPRINT := 8.0             # /초
const COST_CLIMB_MOVE := 6.0
const COST_CLIMB_IDLE := 1.5
const COST_CLIMB_JUMP := 15.0        # 한 번
const COST_GLIDE := 5.0
const COST_SWIM_IDLE := 2.0
const COST_SWIM_MOVE := 4.0
const COST_SWIM_FAST := 12.0

const CLIMB_SPEED := 2.4
const CLIMB_JUMP_SPEED := 7.0
const CLIMB_JUMP_SEC := 0.3
const CLIMB_GRAB_SEC := 0.15         # 땅에서 벽으로 이만큼 밀어야 붙는다(스치기만 해선 안 붙게)
const CLIMB_MAX_NORMAL_Y := 0.5      # 법선 y 가 이보다 작아야(60°보다 가파름) 벽
const CLIMB_REGRAB_SEC := 0.4
const WALL_GAP := 0.5                # 캡슐 반지름 0.45 + 여유

const GLIDE_SPEED := 7.5
const GLIDE_FALL := 2.2
const GLIDE_MIN_CLEARANCE := 2.0

const SWIM_SPEED := 3.0
const SWIM_FAST_SPEED := 5.5
const SWIM_ENTER_DEPTH := 1.1        # 수면이 발보다 이만큼 위면 헤엄친다
const SWIM_FLOAT := 1.25             # 헤엄칠 때 발 = 수면 - 이 값(가슴이 수면)

const VAULT_MAX := 1.3               # 이 높이까지의 턱은 매달리지 않고 곧장 넘어오른다
const MANTLE_SEC := 0.28
const CHEST := 0.9
## 지면은 두께 없는 trimesh 라 무언가에 끼여 밑으로 빠질 수 있다 — 강바닥(-3)·
## 절벽 치마(-8)보다 한참 아래로 떨어지면 마지막으로 딛은 땅으로 되돌린다.
const OUT_OF_WORLD_Y := -15.0

## PLAN 106장 ③ 들판 전투용 — 회피(L)는 짧은 미끄러짐 + 무적.
const DODGE_COST := 15.0
const DODGE_SEC := 0.3
const DODGE_SPEED := 16.0
## 106장 ⑧ 낙하 공격 — 발밑이 이만큼 이상 비었을 때(점프 꼭대기·활공 중) 공격을 누르면
## 곧장 내리꽂고, 땅에 닿는 순간 field_combat.plunge_land(떨어진 높이) 가 둘레를 친다.
const PLUNGE_SPEED := 26.0
const PLUNGE_MIN_CLEARANCE := 2.5

const BORDER_LAYER := TerrainBuilder.BORDER_LAYER
const WATER_LAYER := TerrainBuilder.WATER_LAYER

var mode := Mode.GROUND
var stamina := STAMINA_MAX
## 106장 ⑪ — 신상에 별조각을 바칠수록 늘어난다(star_shards.gd 가 앉힌다). STAMINA_MAX 는 처음 값.
var stamina_max := STAMINA_MAX
## 106장 ⑭ 풍 공명 — field_combat 이 매 프레임 앉힌다(스태미나 소모 배율).
var stamina_cost_mul := 1.0

var _exhausted := false
var _regen_wait := 0.0
var _coyote := 0.0
var _jump_buffer := 0.0
var _grab_t := 0.0
var _regrab_wait := 0.0
var _climb_jump_t := 0.0
var _wall_normal := Vector3.BACK
var _mantle_from := Vector3.ZERO
var _mantle_to := Vector3.ZERO
var _mantle_t := 0.0
var _water_y := NAN
var _last_safe := Vector3.ZERO
var _safe_t := 0.0
var _yaw := 0.0
var _pose_pitch := 0.0
var _consuming := false
var _dodge_t := 0.0
var _dodge_dir := Vector3.FORWARD
var _dodge_speed := DODGE_SPEED # 106장 ㉔ 돌진 스킬이 잠깐 바꾼다
var _last_move_dir := Vector3.ZERO
var _action_t := 0.0
var _action_move := 1.0
var _plunge := false
var _plunge_from_y := 0.0
## 106장 ㊳ 바람 기둥(world/sky_isle.gd 가 기둥 안이면 매 프레임 updraft 를 부른다) — 남은 초·솟는 속도·
## 기둥 안에서 스스로 활공을 접었으면 기둥을 나갈 때까지 다시 펴지 않는다.
var _updraft_t := 0.0
var _updraft_vy := 0.0
var _updraft_skip := false
const UPDRAFT_MIN_CLEARANCE := 1.0 # 이보다 낮은 턱에서 발이 떨어진 건 활공으로 안 친다
## 2026-09-30 탈것(player/mount.gd 가 앉힌다) — data/mounts.gd.
const FLY_RISE := 9.0            # 점프를 누르는 동안 오르는 속도
const FLY_SINK := 0.6            # 손을 떼면 제자리에서 아주 천천히 가라앉는다(떠 있기)
const FLY_DIVE := 11.0           # 달리기(Shift)로 내려간다
const FLY_MAX_CLEARANCE := 45.0  # 땅 위 고도 상한
const FLY_TAKEOFF := 8.5         # 탈것에 오르는 순간 솟는 속도
const FLY_TURN := 5.0
var combat: Node = null
var aiming := false # 106장 ㊵ 활 조준 중(combat/aimed_shot.gd 가 켜고 끈다)

var _glider: MeshInstance3D = null
var _ring: StaminaRing = null

func _ready() -> void:
	super._ready()
	collision_mask = 1 | BORDER_LAYER
	floor_snap_length = 0.35
	_last_safe = global_position
	_yaw = visual.rotation.y
	_glider = _build_glider()
	visual.add_child(_glider)
	_glider.visible = false
	_build_hud()
	combat = FieldCombat.new()
	combat.name = "FieldCombat"
	add_child(combat)
	if camera_rig:
		camera_rig.set("mouse_look", true) # 106장 ⑧ 원신 PC 시점

func _physics_process(delta: float) -> void:
	if frozen or dash_speed > 0.0:
		_set_mode(Mode.GROUND)
		super._physics_process(delta)
		return

	if global_position.y < OUT_OF_WORLD_Y:
		global_position = _last_safe + Vector3.UP * 0.3
		velocity = Vector3.ZERO
		_set_mode(Mode.AIR)
		return

	_consuming = false
	_regrab_wait = maxf(_regrab_wait - delta, 0.0)
	_jump_buffer = maxf(_jump_buffer - delta, 0.0)
	if Input.is_action_just_pressed("jump"):
		_jump_buffer = JUMP_BUFFER_SEC

	_action_t = maxf(_action_t - delta, 0.0)
	_updraft_t = maxf(_updraft_t - delta, 0.0)
	if _updraft_t <= 0.0:
		_updraft_skip = false
	var input_dir := _movement_input()
	var move_dir := _world_direction(input_dir)
	if move_dir.length() > 0.05:
		_last_move_dir = move_dir.normalized()
	_water_y = _water_surface()

	match mode:
		Mode.GROUND: _tick_ground(delta, move_dir)
		Mode.AIR: _tick_air(delta, move_dir)
		Mode.GLIDE: _tick_glide(delta, move_dir)
		Mode.CLIMB: _tick_climb(delta, input_dir)
		Mode.SWIM: _tick_swim(delta, move_dir)
		Mode.MANTLE: _tick_mantle(delta)
		Mode.FLY: _tick_fly(delta, move_dir)

	_tick_stamina(delta)
	_apply_pose(delta)

# ---------------------------------------------------------------- 상태별

func _tick_ground(delta: float, move_dir: Vector3) -> void:
	if _in_deep_water():
		_set_mode(Mode.SWIM)
		return
	if _dodge_t > 0.0:
		_dodge_t -= delta
		velocity.x = _dodge_dir.x * _dodge_speed
		velocity.z = _dodge_dir.z * _dodge_speed
		velocity.y = -1.0 if is_on_floor() else velocity.y - GRAVITY * delta
		move_and_slide()
		return
	## 106장 ⑧ — 원신처럼 Shift 를 누르는 순간 한 번 대시(회피와 같은 무적·스태미나),
	## 계속 누르고 있으면 그대로 달리기.
	if Input.is_action_just_pressed("run") and start_dodge():
		return
	## 106장 ㊵ 조준 중엔 제자리(방향은 aimed_shot.gd 가 카메라 쪽으로 돌린다).
	if aiming:
		move_dir = Vector3.ZERO
	var running := Input.is_action_pressed("run") and not _exhausted and stamina > 0.0 and move_dir.length() > 0.05
	var speed := (RUN_SPEED if running else WALK_SPEED) * speed_mult * mount_speed_mul
	if _action_t > 0.0:
		speed *= _action_move
		running = false
	velocity.x = move_dir.x * speed
	velocity.z = move_dir.z * speed
	if running and not mounted:
		_spend(COST_SPRINT * delta)

	if move_dir.length() > 0.05:
		_face(move_dir, delta)
		_play_anim("idle" if mounted else ("sprint" if running else "walk"))
		if not mounted and _try_wall(move_dir, delta, true):
			return
	else:
		_grab_t = 0.0
		_play_anim("idle")

	if _jump_buffer > 0.0:
		_jump_buffer = 0.0
		velocity.y = JUMP_VELOCITY * mount_jump_mul
		_set_mode(Mode.AIR)
		move_and_slide()
		return

	velocity.y = -1.0 if is_on_floor() else velocity.y - GRAVITY * delta
	move_and_slide()

	if is_on_floor():
		_coyote = COYOTE_SEC
		_safe_t += delta
		if _safe_t > 0.5:
			_safe_t = 0.0
			_last_safe = global_position
	else:
		_coyote -= delta
		if _coyote <= 0.0:
			_set_mode(Mode.AIR)

func _tick_air(delta: float, move_dir: Vector3) -> void:
	if _in_deep_water():
		_set_mode(Mode.SWIM)
		return
	if _plunge:
		_tick_plunge()
		return
	## 발 떼고 코요테 시간 안에 누른 점프는 땅 점프로 친다.
	if _jump_buffer > 0.0 and _coyote > 0.0:
		_jump_buffer = 0.0
		_coyote = 0.0
		velocity.y = JUMP_VELOCITY
	elif not mounted and _jump_buffer > 0.0 and velocity.y < 1.0 and stamina > 0.0 and _clearance() >= GLIDE_MIN_CLEARANCE:
		_jump_buffer = 0.0
		_set_mode(Mode.GLIDE)
		return
	elif not mounted and _updraft_t > 0.0 and not _updraft_skip and stamina > 0.0 and not _exhausted \
			and (velocity.y > 0.5 or _clearance() >= UPDRAFT_MIN_CLEARANCE):
		_set_mode(Mode.GLIDE) # 바람 기둥 안 공중(뛰어올랐거나 발밑이 떴다) — 저절로 활공
		return
	_coyote -= delta

	var speed := WALK_SPEED * speed_mult
	var hv := Vector2(velocity.x, velocity.z)
	if hv.length() > speed:
		speed = hv.length() # 달리다 뛰면 그 속도를 이어 간다
	velocity.x = move_dir.x * speed
	velocity.z = move_dir.z * speed
	velocity.y = maxf(velocity.y - GRAVITY * delta, -MAX_FALL_SPEED)
	if move_dir.length() > 0.05:
		_face(move_dir, delta)
		if _try_wall(move_dir, delta, false):
			return
	_play_anim("idle")
	move_and_slide()
	if is_on_floor():
		_set_mode(Mode.GROUND)

func _tick_glide(delta: float, move_dir: Vector3) -> void:
	if _in_deep_water():
		_set_mode(Mode.SWIM)
		return
	if _jump_buffer > 0.0 or stamina <= 0.0:
		if _jump_buffer > 0.0 and _updraft_t > 0.0:
			_updraft_skip = true
		_jump_buffer = 0.0
		_set_mode(Mode.AIR)
		return
	var fwd := _facing()
	## 바람 기둥 안에선 손을 떼면 앞으로 흐르지 않고 제자리에서 솟는다(기둥 밖으로 밀려나지 않게).
	var dir := move_dir if move_dir.length() > 0.05 else (Vector3.ZERO if _updraft_t > 0.0 else fwd * 0.6)
	if move_dir.length() > 0.05:
		_face(move_dir, delta * 0.5)
	velocity.x = lerpf(velocity.x, dir.x * GLIDE_SPEED, 3.0 * delta)
	velocity.z = lerpf(velocity.z, dir.z * GLIDE_SPEED, 3.0 * delta)
	velocity.y = lerpf(velocity.y, _updraft_vy if _updraft_t > 0.0 else -GLIDE_FALL, 5.0 * delta)
	_spend(COST_GLIDE * delta)
	_play_anim("idle")
	var hit := _wall_ahead(fwd)
	if not hit.is_empty() and stamina > 0.0:
		_start_climb(hit)
		return
	move_and_slide()
	if is_on_floor():
		_set_mode(Mode.GROUND)

## 나는 탈것 — 중력 없이 난다. 점프 = 오르기, 손 떼면 천천히 내려앉기, 달리기(Shift) = 급강하. 땅에 닿으면 땅 탈것처럼 걷는다.
func begin_fly() -> void:
	fly_on = true
	velocity.y = FLY_TAKEOFF
	_set_mode(Mode.FLY)

func end_fly() -> void:
	fly_on = false
	_set_mode(Mode.AIR)

func is_flying_now() -> bool:
	return mode == Mode.FLY

## 탈것 잠금 — 이야기 장(PartyState.story.ch).
func mount_chapter() -> int:
	return int(PartyState.story.get("ch", 0))

func _tick_fly(delta: float, move_dir: Vector3) -> void:
	if not mounted:
		_set_mode(Mode.AIR)
		return
	var fspeed := mount_fly_speed if mount_fly_speed > 0.0 else 14.0
	if move_dir.length() > 0.05:
		_face(move_dir, delta * FLY_TURN * 0.25)
	var dir := move_dir if move_dir.length() > 0.05 else Vector3.ZERO
	velocity.x = lerpf(velocity.x, dir.x * fspeed, 3.0 * delta)
	velocity.z = lerpf(velocity.z, dir.z * fspeed, 3.0 * delta)
	var want_y := -FLY_SINK
	if Input.is_action_pressed("jump") and _clearance() < FLY_MAX_CLEARANCE:
		want_y = FLY_RISE
	elif Input.is_action_pressed("run"):
		want_y = -FLY_DIVE
	velocity.y = lerpf(velocity.y, want_y, 4.0 * delta)
	_jump_buffer = 0.0
	_play_anim("idle")
	move_and_slide()
	if is_on_floor() and velocity.y <= 0.5:
		_set_mode(Mode.GROUND)

func _tick_climb(delta: float, input_dir: Vector2) -> void:
	if stamina <= 0.0 or Input.is_action_just_pressed("combat_dodge"):
		_let_go(1.0 if stamina <= 0.0 else CLIMB_REGRAB_SEC)
		return
	var n := _wall_normal
	var right := (-n).cross(Vector3.UP).normalized()

	if _jump_buffer > 0.0:
		_jump_buffer = 0.0
		if input_dir.y < -0.5:
			## 벽을 차고 뒤로 — 원신의 "등반 중 뒤로 점프".
			velocity = n * 6.0 + Vector3.UP * 4.0
			_regrab_wait = CLIMB_REGRAB_SEC
			_face(n, 1.0)
			_set_mode(Mode.AIR)
			move_and_slide()
			return
		if stamina >= COST_CLIMB_JUMP * 0.5:
			_spend(COST_CLIMB_JUMP)
			_climb_jump_t = CLIMB_JUMP_SEC

	var up := input_dir.y
	var side := input_dir.x
	var moving := absf(up) > 0.1 or absf(side) > 0.1
	if _climb_jump_t > 0.0:
		_climb_jump_t -= delta
		velocity = Vector3.UP * CLIMB_JUMP_SPEED
	else:
		velocity = (Vector3.UP * up + right * side) * CLIMB_SPEED
	velocity += -n * 1.0 # 벽에 붙여 둔다
	_spend((COST_CLIMB_MOVE if moving or _climb_jump_t > 0.0 else COST_CLIMB_IDLE) * delta)

	## 벽 법선을 매 프레임 다시 잰다 — 굽은 면·모서리를 따라 돈다.
	var hit := _ray(global_position + Vector3.UP * CHEST, global_position + Vector3.UP * CHEST - n * 1.2)
	if hit.is_empty() or (hit.normal as Vector3).y >= 0.75:
		## 가슴 앞 벽이 끝났다 — 꼭대기면 넘어오르고, 아니면 손을 놓는다.
		var top: Variant = _ledge_top(-n, 2.4)
		if top != null:
			_start_mantle(top)
		else:
			_let_go(CLIMB_REGRAB_SEC)
		return
	_wall_normal = _flat_normal(hit.normal)
	var want := (hit.position as Vector3) + _wall_normal * WALL_GAP
	global_position.x = lerpf(global_position.x, want.x, 10.0 * delta)
	global_position.z = lerpf(global_position.z, want.z, 10.0 * delta)

	_anim_scale(1.0 if moving or _climb_jump_t > 0.0 else 0.0)
	_play_anim("walk")
	move_and_slide()
	if up < -0.1 and is_on_floor():
		_set_mode(Mode.GROUND)

func _tick_swim(delta: float, move_dir: Vector3) -> void:
	if is_nan(_water_y):
		_set_mode(Mode.AIR)
		return
	if stamina <= 0.0:
		_drown()
		return
	var fast := Input.is_action_pressed("run") and move_dir.length() > 0.05
	var speed := SWIM_FAST_SPEED if fast else SWIM_SPEED
	velocity.x = lerpf(velocity.x, move_dir.x * speed, 4.0 * delta)
	velocity.z = lerpf(velocity.z, move_dir.z * speed, 4.0 * delta)
	var target_y := _water_y - SWIM_FLOAT
	velocity.y = clampf((target_y - global_position.y) * 4.0, -4.0, 3.0)
	var cost := COST_SWIM_IDLE
	if move_dir.length() > 0.05:
		cost = COST_SWIM_FAST if fast else COST_SWIM_MOVE
		_face(move_dir, delta)
		## 물가 둑으로 헤엄쳐 가면 넘어오른다.
		var top: Variant = _ledge_top(move_dir.normalized(), SWIM_FLOAT + 1.2)
		if top != null and not _wall_ahead(move_dir.normalized()).is_empty():
			_start_mantle(top)
			return
	_spend(cost * delta)
	_anim_scale(1.6 if fast else (1.0 if move_dir.length() > 0.05 else 0.35))
	_play_anim("walk")
	move_and_slide()
	## 얕은 곳(발이 닿음)으로 나오면 걷는다.
	if not _in_deep_water() and is_on_floor():
		_set_mode(Mode.GROUND)

func _tick_mantle(delta: float) -> void:
	_mantle_t += delta / MANTLE_SEC
	var t := clampf(_mantle_t, 0.0, 1.0)
	## 먼저 위로, 나중에 앞으로 — 손 짚고 몸을 끌어올리는 모양.
	var up_t := smoothstep(0.0, 0.7, t)
	var fwd_t := smoothstep(0.4, 1.0, t)
	var p := _mantle_from
	p.y = lerpf(_mantle_from.y, _mantle_to.y, up_t)
	p.x = lerpf(_mantle_from.x, _mantle_to.x, fwd_t)
	p.z = lerpf(_mantle_from.z, _mantle_to.z, fwd_t)
	global_position = p
	velocity = Vector3.ZERO
	_play_anim("idle")
	if t >= 1.0:
		_set_mode(Mode.GROUND)

# ---------------------------------------------------------------- 전이

func _set_mode(m: Mode) -> void:
	if m == mode:
		return
	mode = m
	_grab_t = 0.0
	_climb_jump_t = 0.0
	_anim_scale(1.0)
	if _glider:
		_glider.visible = m == Mode.GLIDE
	if m == Mode.GROUND:
		_coyote = COYOTE_SEC
	if m != Mode.AIR:
		_plunge = false

## 벽 앞에서: 낮은 턱이면 넘어오르고, 높으면 매달린다(땅에선 잠깐 밀어야).
func _try_wall(move_dir: Vector3, delta: float, grounded: bool) -> bool:
	if _regrab_wait > 0.0:
		return false
	var dir := move_dir.normalized()
	var hit := _wall_ahead(dir)
	if hit.is_empty() or dir.dot(-(hit.normal as Vector3)) < 0.5:
		_grab_t = 0.0
		return false
	var low: Variant = _ledge_top(dir, VAULT_MAX)
	if low != null:
		_start_mantle(low)
		return true
	if stamina <= 0.0:
		return false
	if grounded:
		_grab_t += delta
		if _grab_t < CLIMB_GRAB_SEC:
			return false
	_start_climb(hit)
	return true

func _start_climb(hit: Dictionary) -> void:
	_wall_normal = _flat_normal(hit.normal)
	velocity = Vector3.ZERO
	_set_mode(Mode.CLIMB)
	_face(-_wall_normal, 1.0)

func _let_go(regrab: float) -> void:
	_regrab_wait = regrab
	velocity = _wall_normal * 1.5
	_set_mode(Mode.AIR)

func _start_mantle(top: Vector3) -> void:
	_mantle_from = global_position
	_mantle_to = top + Vector3.UP * 0.05
	_mantle_t = 0.0
	_set_mode(Mode.MANTLE)

## 물에 빠져 기력이 다하면 마지막으로 딛은 땅으로(원신의 익수 복귀).
func _drown() -> void:
	respawn_safe()
	stamina = stamina_max
	_exhausted = false
	Toast.show(self, "기력이 다해 물가로 떠밀려 왔다", 3.0)

# ---------------------------------------------------------------- 전투 쪽 손잡이(field_combat.gd)

func respawn_safe() -> void:
	global_position = _last_safe + Vector3.UP * 0.3
	velocity = Vector3.ZERO
	_dodge_t = 0.0
	_set_mode(Mode.GROUND)

## 땅이나 공중(점프 중)일 때만 싸운다 — 등반·활공·수영 중엔 안 된다(원신과 같다).
func can_act() -> bool:
	return mode == Mode.GROUND or mode == Mode.AIR

## 106장 ㊵ 활 조준 — 땅에 서서만(대시·낙하 중엔 풀린다).
func can_aim() -> bool:
	return mode == Mode.GROUND and _dodge_t <= 0.0 and not _plunge and is_on_floor()

func start_dodge() -> bool:
	if mode != Mode.GROUND or _dodge_t > 0.0 or stamina < DODGE_COST:
		return false
	_spend(DODGE_COST)
	_dodge_t = DODGE_SEC
	_dodge_speed = DODGE_SPEED
	_dodge_dir = _last_move_dir if _movement_input().length() > 0.05 else _facing()
	_face(_dodge_dir, 1.0)
	play_action("dodge", DODGE_SEC, 1.0)
	return true

## 106장 ㉔ 고유 스킬 돌진(주인공 불꽃 돌진) — 대시와 같은 틀(무적), 스태미나는 안 쓴다. 땅에서만.
func skill_dash(dir: Vector3, sec: float, speed: float) -> bool:
	if mode != Mode.GROUND:
		return false
	dir.y = 0.0
	if dir.length() < 0.01:
		return false
	_dodge_dir = dir.normalized()
	_dodge_t = sec
	_dodge_speed = speed
	_face(_dodge_dir, 1.0)
	return true

## 106장 ㉔ 고유 스킬 솟구침(도적 두목 회오리 도약) — 위로 vy 로 띄운다. 그 뒤는 보통 공중(활공·낙하 공격).
func launch_up(vy: float) -> void:
	if mode == Mode.CLIMB or mode == Mode.SWIM:
		return
	_dodge_t = 0.0
	_coyote = 0.0
	_set_mode(Mode.AIR)
	velocity.y = vy

## 106장 ㊳ 바람 기둥 안(world/sky_isle.gd 가 매 프레임) — 공중이면 활공으로, 활공이면 vy 로 솟는다. 땅에선 뛰어야 뜬다.
func updraft(vy: float) -> void:
	_updraft_t = 0.15
	_updraft_vy = vy

func in_updraft() -> bool:
	return _updraft_t > 0.0

func can_plunge() -> bool:
	return not _plunge and (mode == Mode.AIR or mode == Mode.GLIDE) and _clearance() >= PLUNGE_MIN_CLEARANCE

func start_plunge() -> bool:
	if not can_plunge():
		return false
	_set_mode(Mode.AIR)
	_plunge = true
	_plunge_from_y = global_position.y
	velocity = Vector3(0.0, -PLUNGE_SPEED, 0.0)
	play_action("attack", 0.8, 0.0)
	return true

func is_plunging() -> bool:
	return _plunge

func _tick_plunge() -> void:
	velocity = Vector3(0.0, -PLUNGE_SPEED, 0.0)
	move_and_slide()
	if is_on_floor():
		var fell := _plunge_from_y - global_position.y
		_set_mode(Mode.GROUND)
		if combat:
			combat.call("plunge_land", fell)

func is_invulnerable() -> bool:
	return _dodge_t > 0.0

func facing() -> Vector3:
	return _facing()

func face_toward(pos: Vector3) -> void:
	var d := pos - global_position
	d.y = 0.0
	if d.length() > 0.01:
		_face(d, 1.0)

## 공격·피격 같은 한 번짜리 동작. dur 동안 걷기/서기 애니가 덮어쓰지 않고,
## 이동 속도는 move_scale 배.
func play_action(anim_name: String, dur: float, move_scale: float) -> void:
	_action_t = dur
	_action_move = move_scale
	if _anim and _anim.has_animation(anim_name):
		_anim.speed_scale = 1.0
		_anim.play(anim_name)
		_anim.seek(0.0, true)
		_current_anim = anim_name

func _play_anim(anim_name: String) -> void:
	if _action_t > 0.0:
		return
	super._play_anim(anim_name)

# ---------------------------------------------------------------- 스태미나

func _spend(amount: float) -> void:
	if amount <= 0.0:
		return
	amount *= stamina_cost_mul
	_consuming = true
	stamina = maxf(stamina - amount, 0.0)
	_regen_wait = STAMINA_REGEN_DELAY
	if stamina <= 0.0:
		_exhausted = true

func _tick_stamina(delta: float) -> void:
	if not _consuming and (mode == Mode.GROUND or mode == Mode.MANTLE):
		_regen_wait -= delta
		if _regen_wait <= 0.0:
			stamina = minf(stamina + STAMINA_REGEN * delta, stamina_max)
	if _exhausted and stamina >= STAMINA_EXHAUST_RECOVER:
		_exhausted = false
	if _ring:
		_ring.update_from(stamina / stamina_max, _exhausted, _consuming,
			global_position + Vector3.UP * 1.3, delta)

# ---------------------------------------------------------------- 판정

func _ray(from: Vector3, to: Vector3, mask: int = 1) -> Dictionary:
	var q := PhysicsRayQueryParameters3D.create(from, to, mask, [get_rid()])
	return get_world_3d().direct_space_state.intersect_ray(q)

## 가슴 높이 앞 벽. 오를 수 있는 건 정적 몸체(지형·건물·바위)뿐 — 사람·짐승은 안 탄다.
func _wall_ahead(dir: Vector3) -> Dictionary:
	var from := global_position + Vector3.UP * CHEST
	var hit := _ray(from, from + dir * 0.9)
	if hit.is_empty() or not (hit.collider is StaticBody3D):
		return {}
	if (hit.normal as Vector3).y >= CLIMB_MAX_NORMAL_Y:
		return {}
	return hit

## dir 쪽 0.7m 앞, 발 위 max_up 안에 딛을 수 있는 윗면이 있고 머리 위가
## 비었으면 그 자리를 돌려준다.
func _ledge_top(dir: Vector3, max_up: float) -> Variant:
	var from := global_position + dir * 0.7 + Vector3.UP * (max_up + 0.3)
	var hit := _ray(from, global_position + dir * 0.7 + Vector3.UP * 0.25)
	if hit.is_empty() or (hit.normal as Vector3).y < 0.7:
		return null
	## 캡슐(반지름 0.45)이 모서리에 걸리지 않게 조금 더 안쪽에 내려선다.
	var top: Vector3 = (hit.position as Vector3) + dir * 0.35
	if top.y - global_position.y < 0.3:
		return null
	if not _ray(top + Vector3.UP * 0.1, top + Vector3.UP * 1.8).is_empty():
		return null
	return top

func _clearance() -> float:
	var hit := _ray(global_position, global_position + Vector3.DOWN * 50.0)
	return 50.0 if hit.is_empty() else global_position.y - (hit.position as Vector3).y

func _water_surface() -> float:
	var q := PhysicsPointQueryParameters3D.new()
	q.position = global_position + Vector3.UP * CHEST
	q.collide_with_areas = true
	q.collide_with_bodies = false
	q.collision_mask = WATER_LAYER
	var hits := get_world_3d().direct_space_state.intersect_point(q, 1)
	if hits.is_empty():
		return NAN
	return float((hits[0].collider as Node).get_meta("surface_y", 0.0))

func _in_deep_water() -> bool:
	return not is_nan(_water_y) and _water_y - global_position.y > SWIM_ENTER_DEPTH

func _flat_normal(n: Vector3) -> Vector3:
	var f := Vector3(n.x, 0.0, n.z)
	return f.normalized() if f.length() > 0.01 else Vector3.BACK

# ---------------------------------------------------------------- 모양

func _facing() -> Vector3:
	return Vector3(sin(_yaw), 0.0, cos(_yaw))

func _face(dir: Vector3, weight_delta: float) -> void:
	var target := atan2(dir.x, dir.z)
	_yaw = lerp_angle(_yaw, target, clampf(TURN_RATE * weight_delta, 0.0, 1.0))

func _anim_scale(s: float) -> void:
	if _anim:
		_anim.speed_scale = s

## 몸 기울기 — 활공 55°, 수영 72°. 발이 아니라 가슴을 축으로 돌린다.
func _apply_pose(delta: float) -> void:
	var target := 0.0
	if mode == Mode.GLIDE:
		target = deg_to_rad(55.0)
	elif mode == Mode.SWIM:
		target = deg_to_rad(72.0)
	_pose_pitch = lerpf(_pose_pitch, target, clampf(8.0 * delta, 0.0, 1.0))
	var b := Basis.from_euler(Vector3(_pose_pitch, _yaw, 0.0))
	visual.rotation = Vector3(_pose_pitch, _yaw, 0.0)
	visual.position = Vector3.UP * CHEST - b * (Vector3.UP * CHEST) + Vector3.UP * ride_height

## 활공 날개 — 어깨 위로 펼친 연 모양 천 두 장(코드로 그린다, 원작 에셋 아님).
func _build_glider() -> MeshInstance3D:
	var l := Vector3(-1.35, 1.42, -0.35)
	var r := Vector3(1.35, 1.42, -0.35)
	var top := Vector3(0.0, 1.72, 0.22)
	var back := Vector3(0.0, 1.55, -0.6)
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	for tri in [[l, top, back], [top, r, back]]:
		var n: Vector3 = ((tri[1] - tri[0]) as Vector3).cross(tri[2] - tri[0]).normalized()
		for v in tri:
			st.set_normal(n)
			st.add_vertex(v)
	var mi := MeshInstance3D.new()
	mi.name = "Glider"
	mi.mesh = st.commit()
	var mat := StandardMaterial3D.new()
	mat.albedo_color = Color(0.86, 0.32, 0.26)
	mat.cull_mode = BaseMaterial3D.CULL_DISABLED
	mat.roughness = 0.9
	mi.material_override = mat
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_ON
	return mi

func _build_hud() -> void:
	var layer := CanvasLayer.new()
	layer.name = "TraversalHUD"
	add_child(layer)
	_ring = StaminaRing.new()
	_ring.name = "StaminaRing"
	layer.add_child(_ring)
	## 모바일 "점프" — 키보드가 있는 PC 에선 안 보인다.
	if DisplayServer.is_touchscreen_available():
		var b := Button.new()
		b.name = "JumpButton"
		b.text = "점프"
		b.custom_minimum_size = Vector2(120, 120)
		b.anchor_left = 1.0
		b.anchor_right = 1.0
		b.anchor_top = 1.0
		b.anchor_bottom = 1.0
		b.offset_left = -300
		b.offset_right = -180
		b.offset_top = -170
		b.offset_bottom = -50
		b.button_down.connect(func(): Input.action_press("jump"))
		b.button_up.connect(func(): Input.action_release("jump"))
		layer.add_child(b)


## 원신처럼 캐릭터 옆에 뜨는 초록 고리. 쓰는 중이거나 덜 찼을 때만 보이고,
## 가득 차면 잠시 뒤 사라진다.
class StaminaRing extends Control:
	const RADIUS := 16.0
	const WIDTH := 5.0
	var _ratio := 1.0
	var _alpha := 0.0
	var _exhausted := false

	func _ready() -> void:
		mouse_filter = Control.MOUSE_FILTER_IGNORE
		size = Vector2(RADIUS * 2 + WIDTH * 2, RADIUS * 2 + WIDTH * 2)

	func update_from(ratio: float, exhausted: bool, consuming: bool, anchor: Vector3, delta: float) -> void:
		_ratio = ratio
		_exhausted = exhausted
		var want := _ratio < 0.999 or consuming
		_alpha = move_toward(_alpha, 1.0 if want else 0.0, delta * (4.0 if want else 1.2))
		var cam := get_viewport().get_camera_3d()
		if cam == null:
			return
		if cam.is_position_behind(anchor):
			_alpha = 0.0
		else:
			position = cam.unproject_position(anchor) + Vector2(44, -24) - size * 0.5
		queue_redraw()

	func _draw() -> void:
		if _alpha <= 0.01:
			return
		var c := size * 0.5
		draw_arc(c, RADIUS, 0.0, TAU, 40, Color(0, 0, 0, 0.45 * _alpha), WIDTH + 2.0, true)
		var col := Color(0.95, 0.35, 0.25) if _exhausted else Color(0.55, 0.92, 0.35)
		col.a = _alpha
		if _ratio > 0.001:
			draw_arc(c, RADIUS, -PI * 0.5, -PI * 0.5 + TAU * _ratio, 40, col, WIDTH, true)
