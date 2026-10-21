extends CharacterBody3D

## VERTICAL_SLICE.md Phase 5 — 51~54절.
## 2026-09-11 — 51절(3D 모델 연결)·52절(Idle/Walk/Run) GLB 교체.
## G-0030 — 장면의 Visual 은 빈 자리이고, 시작할 때 body_id 의 새 인물 몸(characters_dex)으로 갈아 끼운다(동작은 몸에 붙은 공용 라이브러리).

const VroidBody := preload("res://saga_core/world/vroid_body.gd")
const CelShaderApply := preload("res://saga_core/shaders/cel_shader_apply.gd")
const BlobShadow := preload("res://saga_core/world/blob_shadow.gd")
const FootLock := preload("res://saga_core/player/foot_lock.gd")   # G-0264 걸음새·디딘 발 잠금
const LifePose := preload("res://saga_core/world/life_pose.gd")    # G-0265 쉬면 앉기·둘러보기

const WALK_SPEED := 6.0
const RUN_SPEED := 10.0
const GRAVITY := 20.0
const TURN_RATE := 12.0

## GO는 이 값을 모른 채 항상 1.0으로 지나간다 — DUNGEON의 "질주" 은사가
## boon_speed_sync.gd를 통해 이 필드만 밀어 넣는다(player.gd 자체는
## DungeonRunState를 모른다, games/saga_dungeon/player/boon_speed_sync.gd 참고).
var speed_mult := 1.0

## VERTICAL_SLICE.md 26절 "제외" 목록의 "사진 모드"(2026-09-14) —
## `photo_mode_button.gd`가 켜고 끈다. 켜져 있는 동안은 이동 입력을 그냥
## 무시한다(조이스틱/키보드 값을 읽지도 않는다) — camera_rig.gd는 이
## 값과 무관하게 계속 입력을 받으므로 카메라 회전/줌은 그대로 된다.
var frozen := false

## DUNGEON의 무예 "돌진"(dash) 전용 훅 — boon_speed_sync.gd가 speed_mult를
## 미는 것과 같은 일방 통행(games/saga_dungeon/player/skill_caster.gd 의 dash 참고).
## dash_speed가 0이면(기본값) 아무 영향이 없다 — GO는 이 필드를 안 건드린다.
## player.gd 자체는 여전히 DungeonRunState를 모른다.
var dash_dir := Vector3.ZERO
var dash_speed := 0.0

## 2026-09-30 탈것(player/mount.gd 가 앉힌다, data/mounts.gd) — 다섯 판 공용. GO 는 go_player.gd 가 이동을 통째로 다시 써서
## mount_speed_mul 등을 직접 쓰고, DUNGEON·FOREST 는 이 파일의 이동에서 배율·나는 탈것(fly_on)을 쓴다.
var mounted := false
var mount_speed_mul := 1.0
var mount_jump_mul := 1.0
var ride_height := 0.0
var mount_fly_speed := 0.0
var fly_on := false

@onready var camera_rig: Node3D = $CameraRig
@onready var visual: Node3D = $Visual
@onready var _anim: AnimationPlayer = visual.find_child("AnimationPlayer", true, false)

## G-0030 — 이 판 주인공 몸(새 인물 몸 id, "self" = VroidBody.DEX_SELF_ID). 장면 뿌리 노드에 적는다.
@export var body_id := ""
var _joystick: Control = null
var _current_anim := ""
var _life: Node = null   # G-0265 생활 몸짓(life_pose) — 2나락·3마을(1만리는 G-0266)
var _gait_scaled := false   # G-0264 — 걸음새가 speed_scale 을 바꿨으면 다른 클립으로 갈 때 1.0 으로
## G-0284 한 번짜리 동작(2나락 공격·무예가 부름 — 1만리는 go_player.play_action, 4종횡은 story_player_base._skill_pose 가 따로).
## 클립의 동작 구간(ONCE_WINDOW 초)만 sec 에 맞춰 한 번 틀고, 그동안(물리 프레임 — 헤드리스는 실시간보다 빠름) 걸음새가 안 덮는다.
## 창은 G-0283 자세 시트(cast 손 뻗기 앞 0.8초 · strong 들어 올려 내리찍기 0.35~0.75초). 손잡이 SAGA_ACTION_MOCAP=0 이면 안 튼다(옛 길 — 몸 그대로).
const ONCE_WINDOW := {"attack": [0.30, 0.95], "strong": [0.35, 0.75], "cast": [0.0, 0.8], "skill": [0.0, 0.53], "burst": [0.0, 1.13], "dodge": [0.05, 0.85]}
var _once_until := 0
var _once_scaled := false   # 한 번짜리 동작이 빠르기를 바꿨으면 잠금 뒤 첫 _play_anim 이 1 로(walk·sprint 로 가도 — R-5)

func _ready() -> void:
	var found := get_tree().get_nodes_in_group("virtual_joystick")
	if found.size() > 0:
		_joystick = found[0]
	_play_anim("idle")
	CelShaderApply.apply_to(visual)
	if get_node_or_null("Mount") == null:
		var mount_node := Node3D.new()
		mount_node.set_script(load("res://saga_core/player/mount.gd"))
		add_child(mount_node)
	## 2026-09-24 — FOREST 아바타(saga_forest_avatar_01)는 뼈대 공간 앞이 -Z 라, 아래 target_yaw = atan2(x, z)(앞 = +Z)로
	## 돌리면 등을 앞으로 한 채 달렸다. world/vroid_body.gd 와 같게 Visual 안쪽을 Y축 180° 돌려 앞을 +Z 로(앞이 +Z 인 GO·DUNGEON 몸은 그대로).
	var skels := visual.find_children("*", "Skeleton3D", true, false)
	if not skels.is_empty() and VroidBody.front_sign(skels[0]) < 0.0:
		for c in visual.get_children():
			if c is Node3D:
				(c as Node3D).transform = Transform3D(Basis(Vector3.UP, PI), Vector3.ZERO) * (c as Node3D).transform
	var shadow := BlobShadow.make_decal()
	shadow.position = Vector3(0, 0.15, 0)
	add_child(shadow)
	## G-0030 — 새 몸은 VroidBody 가 앞(+Z)·셀 셰이더·동작까지 맞춰 주므로 위 회전·셰이더 손질 뒤에 끼운다.
	if body_id != "":
		swap_body(VroidBody.build_hero(body_id))
	else:
		_attach_foot_lock()

## G-0024 — Visual 을 새 몸으로 통째 바꾼다(편성원 전환·주인공 몸). 이름·위치·회전을 이어받고, 옛 몸에 얹힌 부속(글라이더 등)은
## keep 으로 넘긴 것만 새 몸으로 옮긴다. 새 몸은 VroidBody 가 셀 셰이더·동작 라이브러리까지 입혀 준 것.
func swap_body(body: Node3D, keep: Array = []) -> void:
	if body == null or body == visual:
		return
	var old := visual
	_once_until = 0   # 새 몸은 바로 서기(G-0284 R-5)
	_once_scaled = false
	body.position = old.position
	body.rotation = old.rotation
	for k in keep:
		if is_instance_valid(k) and k is Node and k.get_parent() == old: # 해제된 객체에 is 를 쓰면 오류라 먼저(G-0081)
			old.remove_child(k)
			body.add_child(k)
	remove_child(old)
	old.queue_free()
	body.name = "Visual"
	add_child(body)
	move_child(body, 1)
	visual = body
	for c in get_children():   # G-0118 — 카메라 가까이 흐림이 옛 몸(해제됨)을 들고 있지 않게
		if c.has_method("refresh_visual_meshes"):
			c.call("refresh_visual_meshes")
	_anim = visual.find_child("AnimationPlayer", true, false)
	_current_anim = ""
	_play_anim("idle")
	_attach_foot_lock()


func _physics_process(delta: float) -> void:
	## 돌진 중엔 move_and_slide()를 안 쓴다 — CharacterBody3D끼리(플레이어
	## vs 적) 충돌 판정에 걸려 옆으로 밀려나 버리는 걸 실측으로 확인했다
	## (원작 dungeon.js도 돌진은 p.x/p.y를 직접 더할 뿐 몸통 충돌이 없다,
	## games/saga_dungeon/data/dungeon_skills.gd 헤더 참고). 중력도 이
	## 프레임엔 같이 쉰다 — 돌진이 끝나면 다음 프레임부터 정상 재개된다.
	if dash_speed > 0.0:
		global_position += dash_dir * dash_speed * delta
		return

	if fly_on:
		_tick_life(delta, false)
		_base_fly(delta)
		return

	visual.position.y = ride_height
	if not is_on_floor():
		velocity.y -= GRAVITY * delta
	else:
		velocity.y = 0.0

	if frozen:
		_tick_life(delta, false)
		velocity.x = 0.0
		velocity.z = 0.0
		_play_anim("idle")
		move_and_slide()
		return

	var input_dir := _movement_input()
	var move_dir := _world_direction(input_dir)
	_tick_life(delta, move_dir.length() <= 0.05 and is_on_floor() and not mounted and not Input.is_anything_pressed())

	var running := Input.is_action_pressed("run")
	var speed := (RUN_SPEED if running else WALK_SPEED) * speed_mult * mount_speed_mul
	velocity.x = move_dir.x * speed
	velocity.z = move_dir.z * speed

	if move_dir.length() > 0.05:
		var target_yaw := atan2(move_dir.x, move_dir.z)
		visual.rotation.y = lerp_angle(visual.rotation.y, target_yaw, TURN_RATE * delta)
		if mounted:
			_play_anim("idle")
		else:
			_play_gait(Vector2(velocity.x, velocity.z).length())
	else:
		_play_anim("idle")

	move_and_slide()

## character-a.glb 안의 이름 그대로 재생한다(idle/walk/sprint) — 같은 걸
## 다시 요청하면 매 프레임 play()를 다시 걸지 않는다(안 그러면 블렌드가
## 매번 처음으로 튄다).
## 나는 탈것(DUNGEON·FOREST) — 점프 = 오르기, 손 떼면 내려앉기, 달리기 = 급강하. GO 는 go_player.gd 의 Mode.FLY 가 따로 한다.
func begin_fly() -> void:
	fly_on = true
	velocity.y = 8.5

func end_fly() -> void:
	fly_on = false

func is_flying_now() -> bool:
	return fly_on

func _base_fly(delta: float) -> void:
	var dir := _world_direction(_movement_input())
	var fspeed := mount_fly_speed if mount_fly_speed > 0.0 else 14.0
	velocity.x = lerpf(velocity.x, dir.x * fspeed, 3.0 * delta)
	velocity.z = lerpf(velocity.z, dir.z * fspeed, 3.0 * delta)
	var want_y := -0.6 # 떠 있기
	if Input.is_action_pressed("jump") and global_position.y < 40.0:
		want_y = 9.0
	elif Input.is_action_pressed("run"):
		want_y = -11.0
	velocity.y = lerpf(velocity.y, want_y, 4.0 * delta)
	if dir.length() > 0.05:
		visual.rotation.y = lerp_angle(visual.rotation.y, atan2(dir.x, dir.z), TURN_RATE * delta)
	visual.position.y = ride_height
	_play_anim("idle")
	move_and_slide()
	if is_on_floor() and velocity.y <= 0.5:
		fly_on = false

## G-0264 걸음새 — 실제 수평 속도(m/s) → walk/sprint·클립 빠르기(디딘 발이 몸과 같은 빠르기로 뒤로 가게, foot_lock.gd gait).
func _play_gait(h_speed: float) -> void:
	if _anim == null:
		return
	var g: Array = FootLock.gait(h_speed, visual.scale.y, _current_anim == "sprint")
	_play_anim(String(g[0]))
	if _current_anim == String(g[0]):
		_anim.speed_scale = float(g[1])
		_gait_scaled = true

## G-0264 디딘 발 잠금(나만) — 몸이 바뀔 때마다 새 뼈대에 붙인다. SAGA_FOOT_LOCK=0 이면 안 붙는다.
func _attach_foot_lock() -> void:
	for s in visual.find_children("*", "Skeleton3D", true, false):
		if FootLock.attach(s as Skeleton3D) != null:
			break
	_life = LifePose.attach(visual) if _life_pose_on() else null

## G-0265 — 생활 몸짓을 붙이는 판(1만리 go_player 는 G-0266 까지 false).
func _life_pose_on() -> bool:
	return true

## G-0265 — 가만히(입력 없음·땅·탈것 아님) SIT_AFTER 초 → 앉기, 그 사이 3~5초마다 둘러보기·체중. 움직이면·frozen·공중·탈것이면 일어남.
func _tick_life(delta: float, still: bool) -> void:
	if _life != null and is_instance_valid(_life):
		_life.call("tick_still", delta, still)

## foot_lock.gd 가 묻는다 — 탈것·나는 중·돌진 중엔 끔(공중·동작 클립은 foot_lock 이 스스로 본다).
func foot_lock_allowed() -> bool:
	return not mounted and not fly_on and dash_speed <= 0.0 and not frozen

## G-0284 — 한 번짜리 동작(위 ONCE_WINDOW). 클립이 없거나 손잡이 0 이면 false.
func play_once(clip: String, sec: float) -> bool:
	if OS.get_environment("SAGA_ACTION_MOCAP") == "0" or _anim == null or not _anim.has_animation(clip) or not ONCE_WINDOW.has(clip):
		return false
	var w: Array = ONCE_WINDOW[clip]
	_once_until = Engine.get_physics_frames() + int(sec * Engine.physics_ticks_per_second)
	_anim.speed_scale = (float(w[1]) - float(w[0])) / sec
	_once_scaled = true
	_anim.play(clip)
	_anim.seek(float(w[0]), true)   # 같은 클립 연타도 매번 구간 시작부터
	_current_anim = clip
	return true

func _play_anim(anim_name: String) -> void:
	if _anim == null or not _anim.has_animation(anim_name):
		return
	if Engine.get_physics_frames() < _once_until:
		return
	if _once_scaled:
		_anim.speed_scale = 1.0
		_once_scaled = false
	if _gait_scaled and anim_name != "walk" and anim_name != "sprint":
		_anim.speed_scale = 1.0
		_gait_scaled = false
	if _current_anim == anim_name:
		return
	_current_anim = anim_name
	_anim.play(anim_name)

## 조이스틱이 있으면 그걸 우선한다(모바일) — 없거나 안 밀었으면 키보드로 되돈다.
func _movement_input() -> Vector2:
	if _joystick and "value" in _joystick and (_joystick.value as Vector2).length() > 0.05:
		return _joystick.value
	var dir := Vector2.ZERO
	dir.x = Input.get_axis("move_left", "move_right")
	dir.y = Input.get_axis("move_back", "move_forward")
	return dir

## 입력(x=오른쪽, y=앞)을 카메라가 보는 방향 기준 월드 벡터로 바꾼다 —
## 카메라를 돌리면 "앞으로"가 그 방향을 따라간다(3인칭 액션 RPG 감각).
func _world_direction(input_dir: Vector2) -> Vector3:
	if input_dir.length() < 0.001:
		return Vector3.ZERO
	var cam_basis := camera_rig.global_transform.basis if camera_rig else global_transform.basis
	var forward := -cam_basis.z
	forward.y = 0.0
	forward = forward.normalized()
	var right := cam_basis.x
	right.y = 0.0
	right = right.normalized()
	var dir := forward * input_dir.y + right * input_dir.x
	if dir.length() > 1.0:
		dir = dir.normalized()
	return dir
