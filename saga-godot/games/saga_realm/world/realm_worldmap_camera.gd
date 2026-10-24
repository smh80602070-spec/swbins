extends Camera3D

## realm3d.js "드래그로 돌리고 · 휠/핀치로 당긴다"는 궤도 카메라를 옮긴 것
## (2026-09-12, "saga-godot 이어해" — 2-8/2-9절이 "다음에 볼 자리"로 미뤄
## 온 마지막 조각). 이전엔 realm_camera.gd(디오라마)와 같은 WASD 재사용
## 요령을 썼는데, **월드맵은 지도라 자유로이 돌려 보는 게 더 자연스럽고
## 원작이 실제로 드래그 조작**이라 이번엔 `games/saga_go/player/
## camera_rig.gd`의 드래그 판정(마우스 버튼+모션, 터치+드래그, 10px
## 문지방으로 탭과 구분)을 그대로 옮겨 썼다. 새 입력 액션을 project.godot
## 에 안 늘려도 되는 길인 것도 같다(camera_rig.gd처럼 raw InputEvent를
## 직접 받는다) — 디오라마 카메라(realm_camera.gd)는 이 변경과 무관하게
## 그대로 WASD를 쓴다.
##
## 궤도는 realm3d.js처럼 완전한 구면 좌표(yaw+pitch+radius)다 — 이전
## 버전은 yaw와 radius만 돌리고 높이(HEIGHT)를 고정값으로 뒀는데, 드래그의
## 세로 성분을 pitch에 태우려니 구면 좌표가 자연스럽다. pitch 범위는
## realm3d.js `PITCH_MIN()`/`PITCH_MAX()`의 라디안 값(0.35~1.3)을 그대로
## 썼다 — 각도라 지도 크기(WORLD_SCALE)와 무관하게 그대로 옮길 수 있다.
## radius(중심까지 거리) 범위만 이 슬라이스의 지도 크기(GROUND_SPAN=260)
## 에 맞게 새로 골랐다.
##
## **하지 않은 것(다음에 볼 자리)** — 핀치(두 손가락) 줌. 마우스 휠 줌은
## camera_rig.gd와 같은 방식으로 옮겼지만, 두 손가락 거리를 추적하는
## 멀티터치 핀치는 스코프 밖으로 남겨 뒀다(이 지도 크기에서 휠·드래그
## 확대만으로도 아쉽지 않다고 보고 좁혔다).
##
## **2026-09-14 정정 — LOOK_AT을 원점 고정에서 "지금 조망 중인 성"으로
## 바꿨다("월드맵 좌표계 몰아서 말고 지금 바로 확인해줘"로 발견).** 16·
## 17절에서 107성을 다 채우고 보니, 처음 3성 클러스터의 원점을 축으로 한
## RADIUS_MAX(420)로는 애초에 갈 수 있는 범위가 반경 420뿐이라 대부분의
## 성(원점에서 최대 2679 단위, 중앙값도 985)에 카메라가 닿지 않았다.
## **다행히 이웃 성끼리(from_city 간선)의 실제 거리는 전부 420 안쪽이다**
## (임시 스크립트로 106개 간선을 다 재 봄 — 가장 먼 것도 367 — 인접한
## 성끼리는 원래 걸어서/말타고 오갈 거리로 잡혀 있어서다). 그래서 원점을
## 고정하는 대신 **"지금 조망 중인 성"을 축으로 삼으면**, 정복해 나가며
## 조망 대상을 옆 성으로 옮길 때마다 축이 따라와 매번 반경 420 안에서
## 다음 이웃 성이 보인다 — 카메라를 다시 설계하지 않고 축만 성 하나
## 따라가게 바꾼 것으로 전체 지도를 커버한다. GROUND_SPAN(바닥, 카메라와
## 무관하게 고정된 평면)은 `realm_worldmap.gd`에서 따로 키웠다 — 이 정정과
## 짝을 이룬다(둘 다 안 고치면 축만 따라가도 바닥이 안 보인다).

const RealmCities := preload("res://games/saga_realm/data/realm_cities.gd")

const ROTATE_SPEED := 0.006   # camera_rig.gd와 같은 감도
const ZOOM_STEP := 14.0
const DRAG_THRESHOLD := 10.0  # camera_rig.gd와 같음 — 탭(마커 선택)과 구분
const RADIUS_MIN := 120.0
const RADIUS_MAX := 420.0
const PITCH_MIN := 0.35       # realm3d.js PITCH_MIN() 그대로
const PITCH_MAX := 1.3        # realm3d.js PITCH_MAX() 그대로

var _yaw := 0.6
var _pitch := 0.9
var _radius := 260.0
var _look_at := Vector3.ZERO
var _dragging := false
var _drag_start := Vector2.ZERO
var _drag_confirmed := false


## realm_camera.gd와 같은 손잡이(RealmSaveState.viewing_map)로 켜고 끈다 —
## 두 카메라가 동시에 current=true가 될 일은 없다(불리언 하나로 갈린다).
func _process(_delta: float) -> void:
	current = RealmSaveState.viewing_map
	if current:
		var rv := get_tree().get_first_node_in_group("realm_region_view")   # G-0347 지역 단위 — 지금 성이 다른 지역이면 그 지역 가운데
		_look_at = rv.call("focus") if rv != null else RealmCities.world_pos(RealmSaveState.current_city)
		_apply_transform()


func _unhandled_input(event: InputEvent) -> void:
	if not RealmSaveState.viewing_map:
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
		var mm := event as InputEventMouseMotion
		_apply_drag(mm.relative, mm.position)
	elif event is InputEventScreenTouch:
		var st := event as InputEventScreenTouch
		if st.index == 0:
			_begin_drag(st.pressed, st.position)
	elif event is InputEventScreenDrag:
		var sd := event as InputEventScreenDrag
		if sd.index == 0:
			_apply_drag(sd.relative, sd.position)


func _begin_drag(pressed: bool, pos: Vector2) -> void:
	_dragging = pressed
	if pressed:
		_drag_start = pos
		_drag_confirmed = false


func _apply_drag(relative: Vector2, pos: Vector2) -> void:
	if not _drag_confirmed:
		if pos.distance_to(_drag_start) < DRAG_THRESHOLD:
			return
		_drag_confirmed = true
	_yaw -= relative.x * ROTATE_SPEED
	_pitch = clampf(_pitch - relative.y * ROTATE_SPEED, PITCH_MIN, PITCH_MAX)


func _zoom(amount: float) -> void:
	_radius = clampf(_radius + amount, RADIUS_MIN, RADIUS_MAX)


func _apply_transform() -> void:
	var height := _radius * sin(_pitch)
	var flat := _radius * cos(_pitch)
	global_position = Vector3(sin(_yaw) * flat, height, cos(_yaw) * flat) + _look_at
	look_at(_look_at, Vector3.UP)
