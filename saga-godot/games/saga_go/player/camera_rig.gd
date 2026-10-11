extends Node3D

## VERTICAL_SLICE.md Phase 5 — 55~57절. Player의 자식으로 붙어 위치는
## 저절로 따라오고(Camera Follow), 회전·줌만 이 스크립트가 다룬다.
## 웹판 사가만리 README "끌면 카메라가 돈다"와 같은 조작 감각 —
## 10px을 넘게 끌어야 돌기 시작한다(탭과 구분).

@onready var spring_arm: SpringArm3D = $SpringArm3D

const CameraNearFade := preload("res://saga_core/world/camera_near_fade.gd")
const FeelTuning := preload("res://games/saga_go/combat/feel_tuning.gd")
var _visual_meshes: Array[GeometryInstance3D] = []

const ROTATE_SPEED := 0.006
## PLAN 102-1·105 Q-h(c, 2026-09-19) — 1.7m 표준 캐릭터 기준 거리 8m,
## 줌 범위 6~11m(옛 4~16m는 3.4m 거인 기준이었다).
const MIN_ZOOM := 6.0
const MAX_ZOOM := 11.0
const ZOOM_STEP := 1.0
const DEFAULT_ZOOM := 8.0
const MIN_PITCH := 15.0
const MAX_PITCH := 70.0
const DRAG_THRESHOLD := 10.0

var _dragging := false
var _drag_start := Vector2.ZERO
var _drag_confirmed := false
## G-0184 — 끌어서 멀리(기본보다 얕게) 본 시점은 손을 떼면 PITCH_RETURN_SEC 에 기본 각으로 돌아온다(야숨식 낮은 카메라 유지, 웹 W-0162).
## 더 내려다본 쪽(가파름)은 그대로 둔다 — 일부러 고른 시점을 빼앗지 않게. 마우스 시점(갇힌 커서)·조준·대화 샷엔 안 건다.
const REST_PITCH := -35.0
const PITCH_RETURN_SEC := 0.6
const PITCH_RETURN_MARGIN := 6.0
var _pitch_tw: Tween

## PLAN 101-2 GO(2026-09-18, combat_feel.gd 연결) — dungeon_camera_rig.gd
## shake()와 같은 결. 이 노드의 `position`만 흔든다(rotation_degrees는
## 위 드래그 조작이 쓰니 건드리지 않는다) — SpringArm3D가 자식이라 흔들림이
## 저절로 카메라까지 전해진다.
var _shake_amp_m := 0.0
var _shake_until_msec := 0
## 2026-09-29 — 흔들림이 끝나면 position 을 Vector3.ZERO 로 돌려 리그가 플레이어 허리(씬에 적힌 +0.85m)에서 발밑으로 떨어졌다.
## 첫 피격 뒤로 카메라 끈이 발밑에서 출발해 울퉁불퉁한 땅에 걸리면 카메라가 발끝까지 당겨졌다(GO 창 모드 x_swing, 끈 길이 0.02m).
## 쉼 자리를 기억해 그 둘레로 흔들고 그리로 돌아간다.
var _rest_pos := Vector3.ZERO

## PLAN 106장 ⑧ — 원신 PC 시점. 마우스를 창에 가둬 두고 움직이기만 하면 돈다(끌 필요
## 없음). Alt 를 누르는 동안·Esc 로 푼 뒤·선택지 창(그룹 "ui_modal")·옛 결투
## ("duel_active")·사진 모드(frozen)가 열린 동안엔 커서를 풀어 준다. Esc 로 풀었으면
## 화면을 한 번 누를 때 다시 가둔다. go_player.gd 만 켠다 — 이 씬을 빌려 쓰는 곳
## (REALM 초상 등)은 옛 끌기 그대로. 터치 화면·헤드리스에선 안 켜진다.
const LOOK_SPEED := 0.0032
const LOOK_UP_PITCH := 8.0
var mouse_look := false
var _look_released := false

## PLAN 106장 ㉗ — 이야기 대화 구도(world/story_quest.gd 가 말하는 이가 바뀔 때마다 talk_shot).
## 말하는 이 얼굴(TALK_EYE_H)을 중심에 두고, 듣는 이 어깨 너머(옆으로 TALK_SIDE_DEG·위로 TALK_UP_DEG)에서 잡는다 —
## 팔 길이 = 두 사람 거리 + TALK_BACK. 부드럽게 옮겨 가고(TALK_BLEND), end_talk 면 원래 시점으로 돌아온다(TALK_RETURN_SEC).
## 대화 중엔 끌기·마우스 시점·흔들림을 안 받는다. 팔이 내 몸에 걸려 짧아지지 않게 대화 동안만 내 몸을 뺀다.
const TALK_EYE_H := 1.45
const TALK_SIDE_DEG := 22.0
const TALK_UP_DEG := 9.0
const TALK_BACK := 1.7
const TALK_BLEND := 7.0
const TALK_RETURN_SEC := 0.45
var _talk_on := false
var _talk_to := Transform3D()
var _talk_len := 0.0
var _saved_basis := Basis()
var _saved_len := 0.0
var _return_left := 0.0
var _return_from := Transform3D()
var _return_from_len := 0.0

## PLAN 106장 ㊵ — 활 조준 시점(combat/aimed_shot.gd 가 set_aim). 오른 어깨 너머 AIM_OFFSET 에서 AIM_LEN 뒤,
## 화각을 AIM_FOV 로 좁힌다. 위아래는 AIM_PITCH_DOWN~AIM_PITCH_UP(위로도 쏘게), 마우스·끌기는 AIM_LOOK_MUL 배로 곱게.
## 터치는 조준 중에 어느 손가락으로 끌어도(공격 단추를 누른 채 다른 손가락으로) 돈다. 끝나면 옛 팔 길이·화각으로.
const AIM_LEN := 2.4
const AIM_OFFSET := Vector3(0.62, 0.55, 0.0)
const AIM_FOV := 40.0
const AIM_PITCH_DOWN := -60.0
const AIM_PITCH_UP := 50.0
const AIM_LOOK_MUL := 0.6
const AIM_BLEND := 12.0
var aiming := false
var _pre_aim_len := DEFAULT_ZOOM
var _base_fov := 50.0

func set_aim(on: bool) -> void:
	if on == aiming:
		return
	aiming = on
	var cam := spring_arm.get_node("Camera3D") as Camera3D
	var body := get_parent() as CollisionObject3D
	if on:
		_pre_aim_len = spring_arm.spring_length
		_base_fov = cam.fov + _punch_applied   # G-0118 — 타격 당김(좁힌 만큼)을 빼고 잰 원래 시야각
		if body:
			spring_arm.add_excluded_object(body.get_rid())
	else:
		rotation_degrees.x = clamp(rotation_degrees.x, -MAX_PITCH, LOOK_UP_PITCH)
		if body and not _talk_on:
			spring_arm.remove_excluded_object(body.get_rid())

func _process_aim(delta: float) -> void:
	var cam := spring_arm.get_node("Camera3D") as Camera3D
	var k := 1.0 - exp(-AIM_BLEND * delta)
	var want_len := AIM_LEN if aiming else _pre_aim_len
	var want_off := AIM_OFFSET if aiming else Vector3.ZERO
	var want_fov := AIM_FOV if aiming else _base_fov - _punch_applied
	spring_arm.spring_length = lerpf(spring_arm.spring_length, want_len, k)
	spring_arm.position = spring_arm.position.lerp(want_off, k)
	cam.fov = lerpf(cam.fov, want_fov, k)
	if not aiming and spring_arm.position.length() < 0.01:
		spring_arm.position = Vector3.ZERO
		spring_arm.spring_length = _pre_aim_len
		cam.fov = _base_fov - _punch_applied   # G-0118 — 당김 중이면 그만큼 뺀 자리(_apply_punch 가 되돌림)

func _aim_settled() -> bool:
	return not aiming and spring_arm.position == Vector3.ZERO

func _ready() -> void:
	_rest_pos = position
	spring_arm.spring_length = DEFAULT_ZOOM
	rotation_degrees.x = REST_PITCH
	add_to_group("camera_rig")
	var visual := get_parent().get_node_or_null("Visual")
	if visual:
		_visual_meshes = CameraNearFade.collect_meshes(visual)


## G-0118 — 플레이어가 몸을 갈아 끼우면(player.swap_body) 가까이 흐림 대상을 새 몸으로 다시 모은다.
func refresh_visual_meshes() -> void:
	var visual := get_parent().get_node_or_null("Visual")
	if visual:
		_visual_meshes = CameraNearFade.collect_meshes(visual)
	else:
		_visual_meshes.clear()


## 2026-09-29 — 카메라 끈(SpringArm3D, collision_mask 1)이 적 몸(CharacterBody3D, 같은 층)에도 걸려, 적이 플레이어와 카메라
## 사이에 서면 카메라가 플레이어 발밑까지 당겨졌다(창 모드 x_swing_late). 원신처럼 적 몸은 카메라가 지나간다 —
## 들판 적(보스 포함, "field_enemy" 무리)을 0.5초마다 훑어 끈 판정에서 뺀다. 땅·벽·건물엔 그대로 걸린다.
const EXCLUDE_SCAN_SEC := 0.5
var _excl_left := 0.0
var _excluded := {}

func _exclude_enemies(delta: float) -> void:
	_excl_left -= delta
	if _excl_left > 0.0:
		return
	_excl_left = EXCLUDE_SCAN_SEC
	for e in get_tree().get_nodes_in_group("field_enemy"):
		if e is CollisionObject3D:
			var rid := (e as CollisionObject3D).get_rid()
			if not _excluded.has(rid):
				_excluded[rid] = true
				spring_arm.add_excluded_object(rid)

## 타격 당김(G-0018 단계 4) — 흔들림이 날 때마다 시야각(FOV)을 잠깐 좁혔다 되돌려 화면이 살짝 다가오는 느낌을 준다. 겨누기·대화 중엔 안 쓴다.
## 이미 적용한 만큼(_punch_applied)만 되돌리며 더하고 빼서, 다른 FOV 처리(겨누기 lerp)와 부딪치지 않게 한다.
var _punch := 0.0
var _punch_applied := 0.0

func _apply_punch(delta: float) -> void:
	var cam := spring_arm.get_node("Camera3D") as Camera3D
	_punch = move_toward(_punch, 0.0, FeelTuning.CAM_PUNCH_RECOVER_DEG_PER_SEC * delta)
	var want := _punch if (not aiming and not _talk_on and _return_left <= 0.0) else 0.0
	if not is_equal_approx(want, _punch_applied):
		cam.fov += _punch_applied - want
		_punch_applied = want

func _process(delta: float) -> void:
	_apply_punch(delta)
	_exclude_enemies(delta)
	if mouse_look:
		_update_capture()
	_pad_look(delta)
	if not _aim_settled():
		_process_aim(delta)
	if _talk_on or _return_left > 0.0:
		_process_talk(delta)
	elif Time.get_ticks_msec() < _shake_until_msec:
		position = _rest_pos + Vector3(
			randf_range(-_shake_amp_m, _shake_amp_m),
			randf_range(-_shake_amp_m, _shake_amp_m),
			0.0)
	elif position != _rest_pos:
		position = _rest_pos
		_shake_amp_m = 0.0
	if not _visual_meshes.is_empty():
		var cam: Camera3D = spring_arm.get_node("Camera3D")
		CameraNearFade.apply(_visual_meshes, cam.global_position, global_position)


## 말하는 이(speaker)를 듣는 이(listener) 어깨 너머로 잡는다 — 둘 다 발 자리.
func talk_shot(speaker: Vector3, listener: Vector3) -> void:
	if not _talk_on:
		if _return_left <= 0.0:
			_saved_basis = transform.basis
			_saved_len = spring_arm.spring_length
		_return_left = 0.0
		_talk_on = true
		var body := get_parent() as CollisionObject3D
		if body:
			spring_arm.add_excluded_object(body.get_rid())
	var eye := speaker + Vector3.UP * TALK_EYE_H
	var back := listener - speaker
	back.y = 0.0
	var dist := back.length()
	if dist < 0.1:
		back = global_transform.basis.z
		back.y = 0.0
	back = back.normalized().rotated(Vector3.UP, deg_to_rad(TALK_SIDE_DEG))
	var up := deg_to_rad(TALK_UP_DEG)
	var to_cam := (back * cos(up) + Vector3.UP * sin(up)).normalized()
	_talk_to = Transform3D(Basis.looking_at(-to_cam, Vector3.UP), eye)
	_talk_len = dist + TALK_BACK

## 대화가 끝남 — 대화 전 시점(각도·팔 길이)으로 돌아간다.
func end_talk() -> void:
	if not _talk_on:
		return
	_talk_on = false
	_return_left = TALK_RETURN_SEC
	_return_from = transform
	_return_from_len = spring_arm.spring_length

func in_talk() -> bool:
	return _talk_on

## 대화 구도의 목표(점검용) — 중심 자리·팔 길이.
func talk_target() -> Dictionary:
	return {"eye": _talk_to.origin, "len": _talk_len, "on": _talk_on}

func _process_talk(delta: float) -> void:
	if _talk_on:
		var k := 1.0 - exp(-TALK_BLEND * delta)
		global_transform = global_transform.interpolate_with(_talk_to, k)
		spring_arm.spring_length = lerpf(spring_arm.spring_length, _talk_len, k)
		return
	_return_left = maxf(_return_left - delta, 0.0)
	var t := 1.0 - _return_left / TALK_RETURN_SEC
	t = t * t * (3.0 - 2.0 * t)
	transform = _return_from.interpolate_with(Transform3D(_saved_basis, _rest_pos), t) # 09-29 원점(발밑) 아닌 쉼 자리로
	spring_arm.spring_length = lerpf(_return_from_len, _saved_len, t)
	if _return_left <= 0.0:
		transform = Transform3D(_saved_basis, _rest_pos)
		spring_arm.spring_length = _saved_len
		var body := get_parent() as CollisionObject3D
		if body:
			spring_arm.remove_excluded_object(body.get_rid())

func shake(amp_m: float, dur_sec: float) -> void:
	_punch = maxf(_punch, minf(amp_m * FeelTuning.CAM_PUNCH_DEG_PER_M, FeelTuning.CAM_PUNCH_MAX_DEG) * FeelTuning.cam_punch_mul)
	var until := Time.get_ticks_msec() + int(dur_sec * 1000.0)
	_shake_until_msec = maxi(_shake_until_msec, until)
	_shake_amp_m = maxf(_shake_amp_m, amp_m)

func _look_active() -> bool:
	return mouse_look and DisplayServer.get_name() != "headless" and not DisplayServer.is_touchscreen_available()

func _modal_open() -> bool:
	var tree := get_tree()
	if tree.get_nodes_in_group("duel_active").size() > 0:
		return true
	## 선택지 창(choice_prompt)은 한 번 지어 두고 숨겼다 보였다 한다 — 숨은 창도 그룹에 남아 있어서
	## 보이는 것만 센다(안 그러면 마을에 사건이 하나만 있어도 커서가 한 번도 안 갇힌다).
	for n in tree.get_nodes_in_group("ui_modal"):
		if n.get("visible") != false:
			return true
	return bool(get_parent().get("frozen"))

func _update_capture() -> void:
	if not _look_active():
		return
	var want := not _look_released and not Input.is_key_pressed(KEY_ALT) and not _modal_open() 		and get_window().has_focus()
	var m := Input.MOUSE_MODE_CAPTURED if want else Input.MOUSE_MODE_VISIBLE
	if Input.mouse_mode != m:
		Input.mouse_mode = m

func _unhandled_input(event: InputEvent) -> void:
	if _talk_on or _return_left > 0.0:
		return
	if _look_active():
		_look_input(event)
		return
	if event is InputEventMouseButton:
		var mb := event as InputEventMouseButton
		if mb.button_index == MOUSE_BUTTON_LEFT:
			_begin_drag(mb.pressed, mb.position)
		elif mb.button_index == MOUSE_BUTTON_WHEEL_UP and mb.pressed:
			_zoom(-ZOOM_STEP)
		elif mb.button_index == MOUSE_BUTTON_WHEEL_DOWN and mb.pressed:
			_zoom(ZOOM_STEP)
	elif event is InputEventMouseMotion and _dragging:
		_apply_drag((event as InputEventMouseMotion).relative, (event as InputEventMouseMotion).position)
	elif event is InputEventScreenTouch:
		var st := event as InputEventScreenTouch
		if st.index == 0:
			_begin_drag(st.pressed, st.position)
	elif event is InputEventScreenDrag:
		var sd := event as InputEventScreenDrag
		if aiming:
			_aim_turn(sd.relative * (ROTATE_SPEED / LOOK_SPEED))
		elif sd.index == 0:
			_apply_drag(sd.relative, sd.position)

func _begin_drag(pressed: bool, pos: Vector2) -> void:
	var was_drag := _dragging and _drag_confirmed
	_dragging = pressed
	if pressed:
		_drag_start = pos
		_drag_confirmed = false
		if _pitch_tw != null and _pitch_tw.is_valid():
			_pitch_tw.kill()
	elif was_drag and not aiming and not _talk_on:
		var to := pitch_return_target(rotation_degrees.x)
		if to != rotation_degrees.x:
			_pitch_tw = create_tween()
			_pitch_tw.tween_property(self, "rotation_degrees:x", to, PITCH_RETURN_SEC).set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_OUT)


## G-0184 — 손을 뗀 pitch 가 어디로 갈지(순수 함수, 점검 대상). 기본보다 MARGIN 넘게 얕으면 기본으로, 아니면 그대로.
static func pitch_return_target(cur: float) -> float:
	return REST_PITCH if cur > REST_PITCH + PITCH_RETURN_MARGIN else cur

func _apply_drag(relative: Vector2, pos: Vector2) -> void:
	if not _drag_confirmed:
		if pos.distance_to(_drag_start) < DRAG_THRESHOLD:
			return
		_drag_confirmed = true
	rotate_y(-relative.x * ROTATE_SPEED)
	var pitch: float = clamp(rotation_degrees.x - relative.y * ROTATE_SPEED * 57.3, -MAX_PITCH, -MIN_PITCH)
	rotation_degrees.x = pitch

func _look_input(event: InputEvent) -> void:
	if event is InputEventMouseMotion and Input.mouse_mode == Input.MOUSE_MODE_CAPTURED:
		var rel := (event as InputEventMouseMotion).relative
		if aiming:
			_aim_turn(rel)
			return
		rotate_y(-rel.x * LOOK_SPEED)
		rotation_degrees.x = clamp(rotation_degrees.x - rel.y * LOOK_SPEED * 57.3, -MAX_PITCH, LOOK_UP_PITCH)
	elif event is InputEventMouseButton:
		var mb := event as InputEventMouseButton
		if mb.pressed and mb.button_index == MOUSE_BUTTON_WHEEL_UP:
			_zoom(-ZOOM_STEP)
		elif mb.pressed and mb.button_index == MOUSE_BUTTON_WHEEL_DOWN:
			_zoom(ZOOM_STEP)
		elif mb.pressed and _look_released:
			_look_released = false
			get_viewport().set_input_as_handled()
	elif event is InputEventKey and (event as InputEventKey).pressed and (event as InputEventKey).keycode == KEY_ESCAPE:
		_look_released = true

## G-0033 — 오른쪽 스틱(0번 패드)으로 돌린다. 마우스 픽셀로 바꿔(초당 PAD_LOOK_PX) 마우스 시점·조준과 같은 길로. 대화·창(플레이어 멈춤) 중엔 안 돈다.
const PAD_DEADZONE := 0.18
const PAD_LOOK_PX := 900.0
func _pad_look(delta: float) -> void:
	var v := Vector2(Input.get_joy_axis(0, JOY_AXIS_RIGHT_X), Input.get_joy_axis(0, JOY_AXIS_RIGHT_Y))
	if v.length() < PAD_DEADZONE or _talk_on or bool(get_parent().get("frozen")):
		return
	var rel := v * PAD_LOOK_PX * delta
	if aiming:
		_aim_turn(rel)
		return
	rotate_y(-rel.x * LOOK_SPEED)
	rotation_degrees.x = clamp(rotation_degrees.x - rel.y * LOOK_SPEED * 57.3, -MAX_PITCH, LOOK_UP_PITCH)

## 조준 중 돌리기 — rel 은 마우스 픽셀 단위(LOOK_SPEED 기준).
func _aim_turn(rel: Vector2) -> void:
	rotate_y(-rel.x * LOOK_SPEED * AIM_LOOK_MUL)
	rotation_degrees.x = clamp(rotation_degrees.x - rel.y * LOOK_SPEED * AIM_LOOK_MUL * 57.3, AIM_PITCH_DOWN, AIM_PITCH_UP)

func _zoom(delta: float) -> void:
	if aiming:
		return
	spring_arm.spring_length = clamp(spring_arm.spring_length + delta, MIN_ZOOM, MAX_ZOOM)
