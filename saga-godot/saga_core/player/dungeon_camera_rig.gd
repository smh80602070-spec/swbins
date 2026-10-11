extends Node3D

## VERTICAL_SLICE_DUNGEON.md 2절 — 회전·줌 없는 고정 카메라. GO의
## camera_rig.gd(드래그 회전·핀치 줌)와 요구사항이 정반대라 재사용하지
## 않고 새로 짰다 — 2026-09-06 사용자 요청("디아블로4랑 완전 비슷하면
## 좋겠음", "디아블로처럼 화면을 고정 가능해")으로 웹판이 회전 카메라
## (`camAim3rd`)를 전부 지우고 고정 카메라(`camAim`)만 남긴 이력과 같은
## 결정. Player의 자식이라 위치는 저절로 따라온다(GO의 CameraRig와 같은
## 구조) — 이 스크립트는 각도·거리를 한 번 고정하는 것 말고는 아무
## 입력도 안 받는다.

@export var pitch_deg := 55.0
@export var spring_length := 12.0
## G-0185 — 2나락 벨트 카메라(던파·드래곤즈 크라운 3D, 웹 W-0158 의 고돗 짝). 켜면 리그가 플레이어를 떠나(top_level) 방 옆(+x)에서
## 3/4(BELT_PITCH)로 본다 — 방이 −z 로 이어지니 화면에선 왼→오. 플레이어를 화면 가로(월드 z)로만 따라가되 방 안에선 방 가운데 ±BELT_ROOM_PLAY 에서 멈추고,
## 통로에선 그대로 따라가며 BELT_LERP 로 부드럽게 옮긴다(방 넘어갈 때 약 0.4초). 깊이(월드 x)는 방 가운데에 고정.
## 3마을(ForestPlayer.tscn)도 이 스크립트를 쓰지만 belt=false 그대로 — 예전 동작. 환경변수 SAGA_DG_CAM=diablo 면 끈다(옛 시점 비교용).
@export var belt := false
const BELT_PITCH := 42.0
const BELT_YAW := 90.0
const BELT_ROOM_PLAY := 2.5
const BELT_LERP := 8.0
var _rooms: Array = []   # [{z0, z1, cx}] — z0 > z1(방은 −z 로 이어진다). test_room.gd 가 set_rooms 로 넣는다
var _belt_on := false
var _belt_z := 0.0
var _belt_focus := Vector3.ZERO

@onready var _arm: SpringArm3D = $SpringArm3D

const CameraNearFade := preload("res://saga_core/world/camera_near_fade.gd")
var _visual_meshes: Array[GeometryInstance3D] = []

## PLAN 101-2 DUNGEON ③(손맛 2차, 2026-09-17) — saga_core/combat_feel.gd
## ②가 "camera_rig" 그룹의 첫 노드를 찾아 shake()를 부른다. SpringArm3D
## 자체가 아니라 그 부모(이 노드)의 `position`을 흔든다 — PLAN 101-3
## "카메라 SpringArm3D 부모에 노이즈" 그대로.
var _shake_amp_m := 0.0
var _shake_until_msec := 0
## 2026-09-29 — 흔들림이 끝나면 position 을 Vector3.ZERO 로 돌려 리그가 플레이어 허리(씬에 적힌 +0.85m)에서 발밑으로 떨어졌다.
## 첫 피격 뒤로 카메라 끈이 발밑에서 출발해 울퉁불퉁한 땅에 걸리면 카메라가 발끝까지 당겨졌다(GO 창 모드 x_swing, 끈 길이 0.02m).
## 쉼 자리를 기억해 그 둘레로 흔들고 그리로 돌아간다.
var _rest_pos := Vector3.ZERO

func _ready() -> void:
	_rest_pos = position
	rotation_degrees.x = -pitch_deg
	_arm.spring_length = spring_length
	_belt_on = belt and OS.get_environment("SAGA_DG_CAM") != "diablo"
	if _belt_on:
		set_as_top_level(true)
		rotation_degrees = Vector3(-BELT_PITCH, BELT_YAW, 0.0)
		_arm.collision_mask = 0   # 방 옆 벽(보이지 않는 충돌 상자)에 끈이 걸려 카메라가 방 안으로 당겨지지 않게
		var p := get_parent() as Node3D
		if p != null:
			_belt_z = p.global_position.z
			_belt_focus = p.global_position + _rest_pos
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


## G-0185 — 방 z 범위를 넣는다. rooms = [{z0, z1, cx}] (z0 > z1).
func set_rooms(rooms: Array) -> void:
	_rooms = rooms


## G-0185 — 벨트 카메라가 볼 자리(초점). 순수 함수: 방 안이면 방 가운데 ±play 로 z 를 묶고 x 는 방 가운데, 통로(어느 방도 아님)면 z 그대로·x 는 가까운 방 가운데.
static func belt_focus(player_pos: Vector3, rooms: Array, play: float = BELT_ROOM_PLAY) -> Vector3:
	var z := player_pos.z
	var cx := 0.0
	var best := INF
	for r: Dictionary in rooms:
		var z0 := float(r.z0)
		var z1 := float(r.z1)
		var mid := (z0 + z1) * 0.5
		if z <= z0 and z >= z1:
			return Vector3(float(r.get("cx", 0.0)), player_pos.y, clampf(z, mid - play, mid + play))
		var d := absf(z - mid)
		if d < best:
			best = d
			cx = float(r.get("cx", 0.0))
	return Vector3(cx, player_pos.y, z)


func _process(delta: float) -> void:
	if _belt_on:
		var p := get_parent() as Node3D
		if p != null:
			var want := belt_focus(p.global_position, _rooms) + Vector3(0, _rest_pos.y, 0)
			_belt_focus = _belt_focus.lerp(want, clampf(BELT_LERP * delta, 0.0, 1.0))
		var shake := Vector3.ZERO
		if Time.get_ticks_msec() < _shake_until_msec:
			shake = Vector3(randf_range(-_shake_amp_m, _shake_amp_m), randf_range(-_shake_amp_m, _shake_amp_m), 0.0)
		else:
			_shake_amp_m = 0.0
		global_position = _belt_focus + shake
		if not _visual_meshes.is_empty():
			var bc: Camera3D = _arm.get_node("Camera3D")
			CameraNearFade.apply(_visual_meshes, bc.global_position, (get_parent() as Node3D).global_position + _rest_pos)
		return
	if Time.get_ticks_msec() < _shake_until_msec:
		position = _rest_pos + Vector3(
			randf_range(-_shake_amp_m, _shake_amp_m),
			randf_range(-_shake_amp_m, _shake_amp_m),
			0.0)
	elif position != _rest_pos:
		position = _rest_pos
		_shake_amp_m = 0.0
	if not _visual_meshes.is_empty():
		var cam: Camera3D = _arm.get_node("Camera3D")
		CameraNearFade.apply(_visual_meshes, cam.global_position, global_position)


## combat_feel.gd::_do_shake()가 부른다 — 겹치면(연타) 더 세거나 더 긴
## 쪽을 유지한다(dungeon_run_state.gd _temp_buffs와 같은 결).
func shake(amp_m: float, dur_sec: float) -> void:
	var until := Time.get_ticks_msec() + int(dur_sec * 1000.0)
	_shake_until_msec = maxi(_shake_until_msec, until)
	_shake_amp_m = maxf(_shake_amp_m, amp_m)
