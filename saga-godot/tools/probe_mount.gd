extends Node
## GO 탈것(player/mount.gd · data/mounts.gd · go_player.gd Mode.FLY) 자동 점검 — 평소엔 안 붙는다.
##   SAGA_MOUNT_PROBE=1 "$GODOT" --headless --path saga-godot res://games/saga_go/world/TestVillage.tscn
## ① 이야기 장에 맞춰 잠금(장 0 = 없음, 장 2 = 말) ② 땅 탈것 타면 달리기가 빠르다·스태미나 안 씀
## ③ 공격을 누르면 내린다 ④ 나는 탈것: 떠오르고 점프로 더 오르고 고도 상한 ⑤ 손 떼면 내려앉아 땅에 서고 걷는다
## ⑥ 내리면 원래 속도. 끝에 MOUNT_PROBE_DONE 한 줄. 저장은 안 한다.

const TestMap := preload("res://games/saga_go/data/test_map.gd")
const Mounts := preload("res://saga_core/data/mounts.gd")

var _p: CharacterBody3D
var _m: Node
var _frame := 0
var _step := 0
var _fails := 0
var _x0 := 0.0
var _v_walk := 0.0
var _y_peak := 0.0
var _s0 := 0.0

func _ready() -> void:
	_p = get_tree().get_first_node_in_group("player")

func _physics_process(_delta: float) -> void:
	_frame += 1
	match _step:
		0: # ① 잠금
			if _frame == 1:
				_m = _p.get_node_or_null("Mount")
				_check("node", _m != null, "")
				_check("locked_ch0", Mounts.unlocked(0).is_empty() or OS.get_environment("SAGA_MOUNT_ALL") != "", str(Mounts.unlocked(0)))
				_check("locked_ch2", Mounts.unlocked(2).has("pt_jeolyeong") and not Mounts.unlocked(2).has("pt_samjogo") or OS.get_environment("SAGA_MOUNT_ALL") != "", str(Mounts.unlocked(2)))
				_check("locked_ch26", Mounts.unlocked(26).has("pt_cheongryong"), "")
				_m.call("_build_touch") # 터치 화면이 아니라 안 만들어지므로 직접 — 단추 둘이 생기는지
				_check("touch_buttons", _m.find_child("MountButton", true, false) != null and _m.find_child("MountDownButton", true, false) != null, "")
				_teleport(TestMap.world_pos(5, 4) + Vector3(0, 1.0, 0))
			if _frame == 30:
				_next()
		1: # 맨몸 달리기 속도
			if _frame == 1:
				Input.action_press("move_right")
				_x0 = _p.global_position.x
			if _frame == 30:
				_v_walk = (_p.global_position.x - _x0) / (30.0 / 60.0)
				Input.action_release("move_right")
				_next()
		2: # ② 말 타고 달리기
			if _frame == 1:
				_teleport(TestMap.world_pos(5, 4) + Vector3(0, 1.0, 0))
				_m.call("mount", "pt_jeolyeong")
			if _frame == 20:
				_check("mounted", bool(_p.mounted) and _m.call("is_riding") and _p.ride_height > 0.5, "ride=%.2f" % _p.ride_height)
				Input.action_press("move_right")
				_x0 = _p.global_position.x
			if _frame == 50:
				var v: float = (_p.global_position.x - _x0) / (30.0 / 60.0)
				_check("ground_speed", v > _v_walk * 1.5, "walk=%.1f mounted=%.1f" % [_v_walk, v])
				Input.action_press("run")
			if _frame == 70:
				_s0 = _p.stamina
			if _frame == 110:
				_check("no_stamina", _p.stamina >= _s0 - 0.5, "s0=%.1f s1=%.1f" % [_s0, _p.stamina])
				Input.action_release("move_right")
				Input.action_release("run")
				_next()
		3: # ③ 공격 = 내림
			if _frame == 1:
				var ev := InputEventAction.new()
				ev.action = "combat_quick"
				ev.pressed = true
				_m.call("_unhandled_input", ev)
			if _frame == 5:
				_check("attack_dismount", not bool(_p.mounted) and not _m.call("is_riding"), "")
				_check("speed_reset", is_equal_approx(float(_p.mount_speed_mul), 1.0) and is_equal_approx(float(_p.ride_height), 0.0), "")
				_next()
		4: # ④ 나는 탈것
			if _frame == 1:
				_teleport(TestMap.world_pos(5, 4) + Vector3(0, 1.0, 0))
				_m.call("mount", "pt_samjogo")
				_y_peak = _p.global_position.y
			if _frame > 1:
				_y_peak = maxf(_y_peak, _p.global_position.y)
			if _frame == 20:
				_check("fly_mode", int(_p.mode) == 6, "mode=%d y=%.1f" % [int(_p.mode), _p.global_position.y])
				Input.action_press("jump")
				var ap: AnimationPlayer = _m.get("_anim")
				_check("wing_flap", ap != null and ap.current_animation == "walk", "anim=%s" % (ap.current_animation if ap else "null"))
			if _frame == 120:
				_check("fly_rise", _y_peak > 8.0, "peak=%.1f" % _y_peak)
				Input.action_release("jump")
				Input.action_press("run")
				_next()
		5: # ⑤ 손 떼면 내려앉아 땅에 선다
			if _frame == 260:
				Input.action_release("run")
				_check("fly_land", int(_p.mode) == 0 and _p.is_on_floor(), "mode=%d y=%.1f" % [int(_p.mode), _p.global_position.y])
				_check("still_mounted", bool(_p.mounted), "")
				_next()
		6: # ⑥ 내리면 원래
			if _frame == 1:
				_m.call("dismount", "")
			if _frame == 5:
				_check("dismounted", not bool(_p.mounted) and int(_p.mode) != 6, "mode=%d" % int(_p.mode))
				var cf := ConfigFile.new()
				_check("last_saved", cf.load("user://mount.cfg") == OK and String(cf.get_value("mount", "last", "")) == "pt_samjogo", "")
				_next()
		7:
			print("MOUNT_PROBE_DONE fails=%d" % _fails)
			get_tree().quit()

func _teleport(pos: Vector3) -> void:
	_p.global_position = pos
	_p.velocity = Vector3.ZERO

func _check(name: String, ok: bool, detail: String) -> void:
	if not ok:
		_fails += 1
	print("MOUNT_PROBE %s %s %s" % [name, "ok" if ok else "FAIL", detail])

func _next() -> void:
	_step += 1
	_frame = 0
