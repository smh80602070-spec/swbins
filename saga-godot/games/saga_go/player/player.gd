extends CharacterBody3D

## VERTICAL_SLICE.md Phase 5 — 51~54절.
## 2026-09-11 — 51절(3D 모델 연결)·52절(Idle/Walk/Run) GLB 교체.
## Visual은 이제 캡슐이 아니라 assets/characters/character-a.glb
## (CC0 Kenney Blocky Characters, ASSET_GUIDE.md 참고) — 안에 idle·walk·
## sprint 애니메이션이 이미 들어 있어서 그걸 그대로 재생만 한다.

const VroidBody := preload("res://saga_core/world/vroid_body.gd")
const CelShaderApply := preload("res://saga_core/shaders/cel_shader_apply.gd")
const BlobShadow := preload("res://saga_core/world/blob_shadow.gd")

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
## 미는 것과 같은 일방 통행(games/saga_dungeon/player/skill_dash.gd 참고).
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

const CLOTH_BOOST := 1.7
var _joystick: Control = null
var _current_anim := ""

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
	## 2026-09-30 — 공방 옷 그림이 어두운 가죽이라 주인공만 칙칙했다(마을 사람은 vroid_body boost). 옷 재질 빛을 올려 초록 조끼가 산다.
	for mi in visual.find_children("*", "MeshInstance3D", true, false):
		var m := (mi as MeshInstance3D).mesh
		if m == null:
			continue
		for i in m.get_surface_count():
			var src := m.surface_get_material(i)
			var over := (mi as MeshInstance3D).get_surface_override_material(i) as ShaderMaterial
			if src != null and over != null and src.resource_name.to_lower().contains("cloth"):
				var base: Color = over.get_shader_parameter("albedo_tint")
				over.set_shader_parameter("albedo_tint", Color(base.r * CLOTH_BOOST, base.g * CLOTH_BOOST, base.b * CLOTH_BOOST, base.a))
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
		_base_fly(delta)
		return

	visual.position.y = ride_height
	if not is_on_floor():
		velocity.y -= GRAVITY * delta
	else:
		velocity.y = 0.0

	if frozen:
		velocity.x = 0.0
		velocity.z = 0.0
		_play_anim("idle")
		move_and_slide()
		return

	var input_dir := _movement_input()
	var move_dir := _world_direction(input_dir)

	var running := Input.is_action_pressed("run")
	var speed := (RUN_SPEED if running else WALK_SPEED) * speed_mult * mount_speed_mul
	velocity.x = move_dir.x * speed
	velocity.z = move_dir.z * speed

	if move_dir.length() > 0.05:
		var target_yaw := atan2(move_dir.x, move_dir.z)
		visual.rotation.y = lerp_angle(visual.rotation.y, target_yaw, TURN_RATE * delta)
		_play_anim("idle" if mounted else ("sprint" if running else "walk"))
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

func _play_anim(anim_name: String) -> void:
	if _anim == null or not _anim.has_animation(anim_name):
		return
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
