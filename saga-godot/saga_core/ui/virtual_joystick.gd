extends Control

## VERTICAL_SLICE.md Phase 5 — 58절. 왼쪽 아래 가상 조이스틱.
## value: Vector2 — x=오른쪽(+), y=앞(+). player.gd가 매 프레임 읽는다.

@export var radius := 60.0
@onready var knob: Control = $Knob

var value := Vector2.ZERO

var _active_index := -2  # -2 = 아무도 안 쥠, -1 = 마우스, 0+ = 터치 index

func _ready() -> void:
	_center_knob()
	## G-0138 — 터치 화면이 없으면(PC 마우스·키보드) 숨긴다. 다른 터치 전용 UI(field_combat_ui·go_player 조준)와 같은 기준.
	## 헤드리스 점검은 그대로 둔다. 숨긴 동안 value 는 0 이라 player.gd 는 키보드 입력만 쓴다.
	if DisplayServer.get_name() != "headless" and not DisplayServer.is_touchscreen_available():
		visible = false

func _center_knob() -> void:
	knob.position = size * 0.5 - knob.size * 0.5

func _gui_input(event: InputEvent) -> void:
	if event is InputEventScreenTouch:
		var st := event as InputEventScreenTouch
		if st.pressed and _active_index == -2:
			_active_index = st.index
			_update(st.position)
		elif not st.pressed and st.index == _active_index:
			_active_index = -2
			_reset()
	elif event is InputEventScreenDrag:
		var sd := event as InputEventScreenDrag
		if sd.index == _active_index:
			_update(sd.position)
	elif event is InputEventMouseButton:
		var mb := event as InputEventMouseButton
		if mb.button_index == MOUSE_BUTTON_LEFT:
			if mb.pressed and _active_index == -2:
				_active_index = -1
				_update(mb.position)
			elif not mb.pressed and _active_index == -1:
				_active_index = -2
				_reset()
	elif event is InputEventMouseMotion and _active_index == -1:
		_update((event as InputEventMouseMotion).position)

func _update(pos: Vector2) -> void:
	var center := size * 0.5
	var offset := pos - center
	if offset.length() > radius:
		offset = offset.normalized() * radius
	knob.position = center + offset - knob.size * 0.5
	value = Vector2(offset.x / radius, -offset.y / radius)

func _reset() -> void:
	_center_knob()
	value = Vector2.ZERO
