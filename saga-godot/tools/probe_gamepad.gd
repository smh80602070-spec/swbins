extends Node
## G-0033 사가고 게임패드(player/gamepad.gd·camera_rig 오른쪽 스틱) 자동 점검 — 평소엔 안 붙는다. test_village.gd 가 SAGA_GAMEPAD_PROBE 가 있을 때만 단다.
##
##   SAGA_GAMEPAD_PROBE=1 "$GODOT" --headless --path saga-godot res://games/saga_go/world/TestVillage.tscn
##
## ① 대응표가 동작에 붙음(점프·공격·대시·스킬·이동·시야·탈것·편성 넷·지도·인물·상호작용, 트리거 폭발·조준) ② A→jump · X→combat_quick
## ③ 왼쪽 스틱 위→move_forward ④ RT 반 넘김→combat_burst 한 번 누름·돌아오면 뗌 ⑤ 오른쪽 스틱→카메라가 돈다
## ⑥ 창(도감)을 열면 단추 초점 · B 로 닫힘. 패드는 Input.parse_input_event 로 흉내 낸다. 저장은 안 한다.

var _gp: Node
var _p: Node3D
var _rig: Node3D
var _frame := 0
var _step := 0
var _fails := 0
var _v := {}

func _ready() -> void:
	_p = get_tree().get_first_node_in_group("player")

func _check(name: String, ok: bool, info := "") -> void:
	print("GAMEPAD_PROBE %s %s %s" % [name, "ok" if ok else "FAIL", info])
	if not ok:
		_fails += 1

func _btn(b: JoyButton, down: bool) -> void:
	var e := InputEventJoypadButton.new()
	e.device = 0
	e.button_index = b
	e.pressed = down
	Input.parse_input_event(e)

func _axis(a: JoyAxis, v: float) -> void:
	var e := InputEventJoypadMotion.new()
	e.device = 0
	e.axis = a
	e.axis_value = v
	Input.parse_input_event(e)

func _has_pad(action: String, kind: String) -> bool:
	if not InputMap.has_action(action):
		return false
	for ev in InputMap.action_get_events(action):
		if (kind == "b" and ev is InputEventJoypadButton) or (kind == "a" and ev is InputEventJoypadMotion):
			return true
	return false

func _physics_process(_delta: float) -> void:
	_frame += 1
	if _gp == null:
		_gp = get_tree().get_first_node_in_group("go_gamepad")
		_rig = get_tree().get_first_node_in_group("camera_rig") as Node3D
		_frame = 0
		return
	if _frame < 8 or (_gp.get("mapped") as Dictionary).is_empty():   # 시작 직후엔 물리 프레임이 앞서 돈다 — 대응표가 붙을 때까지
		return
	match _step:
		0:
			var miss := []
			for a in ["jump", "combat_quick", "run", "combat_ult", "go_sight", "go_mount", "party_1", "party_2", "party_3", "party_4", "go_map", "go_character", "go_dispatch"]:
				if not _has_pad(a, "b"):
					miss.append(a)
			for a in ["move_forward", "move_back", "move_left", "move_right"]:
				if not _has_pad(a, "a"):
					miss.append(a)
			var trig: Dictionary = _gp.get("triggers")
			var tr_ok := (trig.get(JOY_AXIS_TRIGGER_RIGHT, []) as Array).has("combat_burst") and (trig.get(JOY_AXIS_TRIGGER_LEFT, []) as Array).has("go_aim")
			_check("mapped", miss.is_empty() and tr_ok, "miss=%s triggers=%s" % [miss, trig])
			_p.set("frozen", false)
			_btn(JOY_BUTTON_A, true)
			_btn(JOY_BUTTON_X, true)
			_step = 1
			_frame = 0
		1:
			_v.jump = Input.is_action_pressed("jump")
			_v.atk = Input.is_action_pressed("combat_quick")
			_btn(JOY_BUTTON_A, false)
			_btn(JOY_BUTTON_X, false)
			_check("buttons", bool(_v.jump) and bool(_v.atk), "jump=%s atk=%s" % [_v.jump, _v.atk])
			_axis(JOY_AXIS_LEFT_Y, -1.0)
			_step = 2
			_frame = 0
		2:
			var s := Input.get_action_strength("move_forward")
			_axis(JOY_AXIS_LEFT_Y, 0.0)
			_check("left_stick", s > 0.9, "forward=%.2f" % s)
			_axis(JOY_AXIS_TRIGGER_RIGHT, 1.0)
			_step = 3
			_frame = 0
		3:
			var down := Input.is_action_pressed("combat_burst")
			_axis(JOY_AXIS_TRIGGER_RIGHT, 0.0)
			_v.burst_down = down
			_step = 4
			_frame = 0
		4:
			if _frame < 3:
				return
			_check("trigger", bool(_v.burst_down) and not Input.is_action_pressed("combat_burst"), "down=%s after=%s" % [_v.burst_down, Input.is_action_pressed("combat_burst")])
			_v.yaw0 = _rig.global_rotation.y
			_axis(JOY_AXIS_RIGHT_X, 1.0)
			_step = 5
			_frame = 0
		5:
			if _frame < 20:
				return
			var dy := absf(angle_difference(float(_v.yaw0), _rig.global_rotation.y))
			_axis(JOY_AXIS_RIGHT_X, 0.0)
			_check("right_stick", dy > 0.1, "dyaw=%.2f" % dy)
			var cs := get_tree().get_first_node_in_group("go_codex")
			_p.set("frozen", false)
			cs.call("open_screen")
			_gp.call("focus_now")
			var f := get_viewport().gui_get_focus_owner()
			_check("focus", f is BaseButton and (cs as Node).is_ancestor_of(f), "focus=%s" % f)
			_btn(JOY_BUTTON_B, true)
			_btn(JOY_BUTTON_B, false)
			_step = 6
			_frame = 0
		6:
			if _frame < 4:
				return
			var cs := get_tree().get_first_node_in_group("go_codex")
			_check("b_close", not bool(cs.get("is_open")) and not bool(_p.get("frozen")))
			print("GAMEPAD_PROBE_DONE fails=%d" % _fails)
			get_tree().quit()
			_step = 7
