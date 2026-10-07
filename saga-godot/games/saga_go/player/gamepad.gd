extends Node
## G-0033 — 사가만리 게임패드(엑스박스식 배치, 0번 패드). 동작마다 고치지 않고, 시작 직후(모든 기능이 동작을 만든 뒤) InputMap 을 훑어
## 대응표의 키에 묶인 동작에 패드 입력을 덧붙인다(키보드·마우스 묶음은 그대로). 같은 키를 쓰는 동작 여럿(F 상호작용 등)에 한 번에 붙는다.
##   왼쪽 스틱 이동 · 오른쪽 스틱 카메라(camera_rig.gd) · A 점프 · X 공격 · B 대시·달리기 · Y 상호작용 · RB 원소 스킬 · RT 원소 폭발
##   LT 활 조준 · LB 원소 시야 · 십자키 편성 1~4 · L3 탈것 · Back 지도 · Start 인물 화면.
## 창(ui_modal)이 보이면 B 는 Esc 로 바꿔 넣고(화면마다 Esc 키를 직접 본다), 초점이 없으면 그 창의 첫 단추에 초점을 준다(십자키·A 로 고르기).

const SETUP_FRAMES := 2

## 키(physical_keycode 또는 keycode) → 패드 입력. [종류, 번호, 축 값]. 종류 "b" 단추 · "a" 축 · "t" 트리거
## (아날로그라 누르는 동안 눌림이 거듭 오므로 InputMap 에 안 넣고, 반 넘을 때 한 번 누름·돌아올 때 한 번 뗌으로 바꿔 넣는다).
const BY_KEY := {
	KEY_SPACE: ["b", JOY_BUTTON_A, 0.0],
	KEY_J: ["b", JOY_BUTTON_X, 0.0],
	KEY_SHIFT: ["b", JOY_BUTTON_B, 0.0],
	KEY_F: ["b", JOY_BUTTON_Y, 0.0],
	KEY_E: ["b", JOY_BUTTON_RIGHT_SHOULDER, 0.0],
	KEY_Q: ["t", JOY_AXIS_TRIGGER_RIGHT, 0.0],
	KEY_R: ["t", JOY_AXIS_TRIGGER_LEFT, 0.0],
	KEY_1: ["b", JOY_BUTTON_DPAD_LEFT, 0.0],
	KEY_2: ["b", JOY_BUTTON_DPAD_UP, 0.0],
	KEY_3: ["b", JOY_BUTTON_DPAD_RIGHT, 0.0],
	KEY_4: ["b", JOY_BUTTON_DPAD_DOWN, 0.0],
	KEY_M: ["b", JOY_BUTTON_BACK, 0.0],
	KEY_C: ["b", JOY_BUTTON_START, 0.0],
}
## 키가 겹치는 동작(시야·탈것은 둘 다 V)과 축으로 움직이는 것은 이름으로.
const BY_ACTION := {
	"move_left": ["a", JOY_AXIS_LEFT_X, -1.0],
	"move_right": ["a", JOY_AXIS_LEFT_X, 1.0],
	"move_forward": ["a", JOY_AXIS_LEFT_Y, -1.0],
	"move_back": ["a", JOY_AXIS_LEFT_Y, 1.0],
	"go_sight": ["b", JOY_BUTTON_LEFT_SHOULDER, 0.0],
	"go_mount": ["b", JOY_BUTTON_LEFT_STICK, 0.0],
}
## 패드 단추를 안 붙이는 동작(키 대응표에 걸려도) — 이름으로 정한 것들.
const SKIP_KEY_MAP := ["go_sight", "go_mount", "move_left", "move_right", "move_forward", "move_back"]

var mapped := {}   # 동작 → 붙인 패드 입력 수(점검용)
var triggers := {}   # 트리거 축 → 그 키에 묶인 동작들
var _trigger_down := {}
const TRIGGER_ON := 0.5
var _frame := 0

func _ready() -> void:
	add_to_group("go_gamepad")

func _process(_delta: float) -> void:
	_frame += 1
	if _frame == SETUP_FRAMES:
		map_all()
	elif _frame > SETUP_FRAMES and not Input.get_connected_joypads().is_empty():
		_focus_modal()

## InputMap 을 훑어 패드 입력을 덧붙인다. 두 번 불러도 같은 입력을 두 번 넣지 않는다.
func map_all() -> void:
	for action in InputMap.get_actions():
		var a := String(action)
		if a.begins_with("ui_") or a.begins_with("dungeon_") or a.begins_with("story_") or a.begins_with("forest_") or a.begins_with("realm_"):
			continue   # 다른 판 동작(project.godot 에 같이 있다)은 사가만리에서 안 쓴다
		var spec: Variant = BY_ACTION.get(a, null)
		if spec != null:
			_add(a, spec)
			continue
		if SKIP_KEY_MAP.has(a):
			continue
		for ev in InputMap.action_get_events(action):
			if ev is InputEventKey:
				var k := ev as InputEventKey
				var code: int = k.physical_keycode if k.physical_keycode != KEY_NONE else k.keycode
				if BY_KEY.has(code):
					_add(a, BY_KEY[code])
					break

func _add(action: String, spec: Array) -> void:
	if String(spec[0]) == "t":
		var list: Array = triggers.get(int(spec[1]), [])
		if not list.has(action):
			list.append(action)
		triggers[int(spec[1])] = list
		mapped[action] = int(mapped.get(action, 0)) + 1
		return
	var ev: InputEvent
	if String(spec[0]) == "b":
		var jb := InputEventJoypadButton.new()
		jb.button_index = int(spec[1]) as JoyButton
		ev = jb
	else:
		var jm := InputEventJoypadMotion.new()
		jm.axis = int(spec[1]) as JoyAxis
		jm.axis_value = float(spec[2])
		ev = jm
	ev.device = -1   # 어느 패드든
	for old in InputMap.action_get_events(action):
		if old.is_match(ev, true):
			return
	InputMap.action_add_event(action, ev)
	mapped[action] = int(mapped.get(action, 0)) + 1

## 보이는 창(ui_modal) 하나 — 없으면 null.
func _open_modal() -> Node:
	for n in get_tree().get_nodes_in_group("ui_modal"):
		if n.get("visible") != false:
			return n
	return null

func _input(event: InputEvent) -> void:
	if event is InputEventJoypadMotion and triggers.has(int((event as InputEventJoypadMotion).axis)):
		var ax := int((event as InputEventJoypadMotion).axis)
		var down := (event as InputEventJoypadMotion).axis_value >= TRIGGER_ON
		if down != bool(_trigger_down.get(ax, false)):
			_trigger_down[ax] = down
			for a in triggers[ax]:
				var ia := InputEventAction.new()
				ia.action = a
				ia.pressed = down
				Input.parse_input_event(ia)
		return
	if event is InputEventJoypadButton and (event as InputEventJoypadButton).pressed \
			and (event as InputEventJoypadButton).button_index == JOY_BUTTON_B and _open_modal() != null:
		get_viewport().set_input_as_handled()
		for pressed in [true, false]:
			var k := InputEventKey.new()
			k.keycode = KEY_ESCAPE
			k.physical_keycode = KEY_ESCAPE
			k.pressed = pressed
			Input.parse_input_event(k)

## 창이 열렸는데 초점이 없으면 그 창의 첫 단추에 — 십자키(ui_up/down)·A(ui_accept)로 고른다.
func _focus_modal() -> void:
	var m := _open_modal()
	if m == null or get_viewport().gui_get_focus_owner() != null:
		return
	for b in m.find_children("*", "BaseButton", true, false):
		var bb := b as BaseButton
		if bb.is_visible_in_tree() and not bb.disabled and bb.focus_mode != Control.FOCUS_NONE:
			bb.grab_focus()
			return

## 점검용 — 초점 맞추기를 패드 없이도 한 번.
func focus_now() -> void:
	_focus_modal()
