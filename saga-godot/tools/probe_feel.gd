extends Node
## G-0018 단계 1 — 사가고 전투·이동 "손맛" 기준선 측정(밸런스 검사가 아니다). 평소엔 안 붙는다. test_village.gd 가 SAGA_FEEL_PROBE 가 있을 때만 단다.
##
##   SAGA_FEEL_PROBE=1 "$GODOT" --headless --path saga-godot res://games/saga_go/world/TestVillage.tscn   → "FEEL name=값 …" 줄들 + "FEEL_PROBE_DONE fails=N"
##
## ① 공격 입력 → 피해가 들어가는 지연(프레임)  ② 연타 시 받아들여지는 간격(후딜)  ③ 후딜 중 누른 입력이 쌓이는지 버려지는지
## ④ 적을 때리면 CombatFeel 5요소(히트스톱·흔들림·플래시·팝·소리)가 나가는지  ⑤ 회피 시작 지연·거리  ⑥ 점프 정점·체공
## fails 는 "측정을 못 했다"(적/플레이어 못 찾음 등)일 때만 센다. 값이 좋고 나쁨은 사람이 보고 정한다(티켓 메모 기준선 표).

const TestMap := preload("res://games/saga_go/data/test_map.gd")
const FeelTuning := preload("res://games/saga_go/combat/feel_tuning.gd")

var _p: CharacterBody3D
var _fc: Node
var _frame := 0
var _step := 0
var _fails := 0
var _target: Node
var _accept: Array[int] = []
var _sig := {"hitstop": 0, "shake": 0, "flash": 0, "popup": 0, "sound": 0}
var _y0 := 0.0
var _ymax := 0.0
var _air := 0
var _pos0 := Vector3.ZERO
var _dodge_start := -1
var _frozen := false
var _t := 0.0
var _t1 := 0.0
var _prev_at := 0.0
var _atk_count := 0
var _late_ok := false
var _phase := 0
var _ki := 0
var _kphase := 0
var _last_stop := -1
var _last_amp := -1.0
var _kind_rows: Array[String] = []
var _ok1 := false
var _hp_a := 0.0
var _rejected := false
var _dt := 1.0 / 60.0

func _ready() -> void:
	Weather.force("clear")
	_p = get_tree().get_first_node_in_group("player")
	_dt = 1.0 / float(Engine.physics_ticks_per_second)
	CombatFeel.hitstop_triggered.connect(func(d: int) -> void:
		_sig.hitstop += 1
		_last_stop = d)
	CombatFeel.shake_triggered.connect(func(a: float, _d: int) -> void:
		_sig.shake += 1
		_last_amp = a)
	CombatFeel.flash_triggered.connect(func(_t: Node) -> void: _sig.flash += 1)
	CombatFeel.popup_triggered.connect(func(_a: float, _c: bool) -> void: _sig.popup += 1)
	CombatFeel.sound_triggered.connect(func(_i: int) -> void: _sig.sound += 1)

func _m(name: String, val: String) -> void:
	print("FEEL ", name, "=", val)

func _next() -> void:
	_step += 1
	_frame = 0

func _fail(why: String) -> void:
	_fails += 1
	print("FEEL 측정 실패: ", why)
	_next()

func _enemy_near(pos: Vector3) -> Node:
	var best: Node = null
	var best_d := 1e9
	for e in get_tree().get_nodes_in_group("field_enemy"):
		if e.call("is_dead"):
			continue
		var d := ((e as Node3D).global_position - pos).length()
		if d < best_d:
			best_d = d
			best = e
	return best

func _place_facing(e: Node, dist := 1.6) -> void:
	var ep: Vector3 = (e as Node3D).global_position
	_p.global_position = ep + Vector3(0, 0.3, dist)
	_p.velocity = Vector3.ZERO
	_p.call("face_toward", ep)

func _physics_process(delta: float) -> void:
	_frame += 1
	if _fc == null:
		_fc = get_tree().get_first_node_in_group("go_field_combat")
		_frame = 0
		return
	match _step:
		0: # ① ② ③ 공격
			if _frame == 1:
				_target = _enemy_near(TestMap.world_pos(1, 4))
				if _target == null:
					_fail("적을 못 찾음")
					return
				_target.set("hp", 99999.0)
				_place_facing(_target)
				var hp0 := float(_target.get("hp"))
				var ok: bool = _fc.call("attack")
				var changed := float(_target.get("hp")) < hp0
				var an: AnimationPlayer = _p.find_child("AnimationPlayer", true, false)
				_m("attack_anim_speed_scale", "%.2f" % an.speed_scale) # 클립 창 0.30~0.95s 를 후딜 0.32s 에 맞춤 → 약 2.03
				_m("attack_anim_start_pos", "%.2f" % an.current_animation_position)
				_m("attack_accepted_first", str(ok))
				_m("attack_damage_same_frame", str(changed)) # true = 입력 프레임에 바로 피해(선딜 0)
				_m("attack_recovery_first_sec", "%.2f" % float(_fc.get("_attack_t")))
				_accept.clear()
			elif _frame <= 400:
				_target.set("hp", 99999.0)
				_place_facing(_target)
				var acc: bool = _fc.call("attack") # 매 프레임 누르는 연타
				if acc:
					_accept.append(_frame)
				if _accept.size() >= 6:
					var gaps: Array[String] = []
					for i in range(1, _accept.size()):
						gaps.append("%dms" % roundi(float(_accept[i] - _accept[i - 1]) * _dt * 1000.0))
					_m("attack_spam_gaps", ",".join(gaps)) # 연타 시 공격 사이 간격(후딜+연결)
					_next()
			else:
				_fail("연타가 6번 받아들여지지 않음")
		1: # ③ 입력 선행 — 후딜 끝 0.12초 전에 누르면 나가고(0.15초 창 안), 0.27초 전에 누르면 버려져야 한다. 시간은 물리 delta 합(히트스톱 영향 없이 게임 시간).
			_t += delta
			if _frame == 1:
				_t = 0.0
				_phase = 0
				_target = _enemy_near(TestMap.world_pos(1, 4))
				_target.set("hp", 99999.0)
				for en in get_tree().get_nodes_in_group("field_enemy"):
					if en != _target:
						en.process_mode = Node.PROCESS_MODE_DISABLED # 다른 적의 타격이 시간·체력 측정에 끼지 않게
				_frozen = true
			if _target != null:
				_place_facing(_target)
			var at_now := float(_fc.get("_attack_t"))
			if at_now > _prev_at + 0.05:
				_atk_count += 1 # 공격이 새로 시작됐다(후딜이 다시 0.3초대로 올라감)
			_prev_at = at_now
			match _phase:
				0: # 콤보가 풀리도록 1.1초 쉰다
					if _t >= 1.1 and Engine.time_scale > 0.99:
						_fc.call("_act", "combat_quick", true) # 첫 공격 — 후딜 0.32초가 시작된다
						_fc.call("_act", "combat_quick", false) # 탭: 바로 뗀다(안 떼면 강공격 충전이 저절로 완료돼 측정이 틀어진다)
						_atk_count = 0
						_prev_at = float(_fc.get("_attack_t")) # 방금 낸 첫 공격은 세지 않는다
						_t1 = _t
						_phase = 1
				1:
					if _t >= _t1 + 0.20: # 후딜 끝 0.12초 전
						_fc.call("_act", "combat_quick", true)
						_fc.call("_act", "combat_quick", false) # 탭: 바로 뗀다(안 떼면 강공격 충전이 저절로 완료돼 측정이 틀어진다)
						_phase = 2
				2:
					if _t >= _t1 + 1.0:
						_late_ok = _atk_count >= 1
						_m("input_buffer_late_press", str(_late_ok)) # true = 후딜 끝 0.12초 전 입력이 후딜 직후 공격으로 나갔다 (첫 공격은 카운트 전)
						_phase = 3
						_t1 = _t
				3: # 콤보가 풀리도록 다시 쉰다
					if _t >= _t1 + 1.3 and Engine.time_scale > 0.99:
						_fc.call("_act", "combat_quick", true)
						_fc.call("_act", "combat_quick", false) # 탭: 바로 뗀다(안 떼면 강공격 충전이 저절로 완료돼 측정이 틀어진다)
						_atk_count = 0
						_prev_at = float(_fc.get("_attack_t")) # 방금 낸 첫 공격은 세지 않는다
						_t1 = _t
						_phase = 4
				4:
					if _t >= _t1 + 0.05: # 후딜 끝 0.27초 전
						_fc.call("_act", "combat_quick", true)
						_fc.call("_act", "combat_quick", false) # 탭: 바로 뗀다(안 떼면 강공격 충전이 저절로 완료돼 측정이 틀어진다)
						_phase = 5
				5:
					if _t >= _t1 + 1.0:
						_m("input_buffer_early_press_dropped", str(_atk_count == 0))
						if not FeelTuning.old_style and not (_late_ok and _atk_count == 0):
							_fails += 1 # 새 방식인데 입력 선행이 기대대로가 아니다(늦은 입력 나감 + 이른 입력 버려짐) # true = 너무 이른 입력은 버려졌다
						for en in get_tree().get_nodes_in_group("field_enemy"):
							en.process_mode = Node.PROCESS_MODE_INHERIT
						_frozen = false
						_next()
		2: # ④ 적을 때리면 CombatFeel 5요소가 나가나
			if _frame == 1:
				_target = _enemy_near(TestMap.world_pos(1, 4))
				_target.set("hp", 99999.0)
				for k in _sig:
					_sig[k] = 0
				_fc.call("_deal", _target, 20.0, "", Vector3.FORWARD)
			elif _frame == 3:
				_m("enemy_hit_feel_signals", JSON.stringify(_sig)) # 0 이면 사가고는 적 타격에 손맛 5요소를 안 쓴다
				_m("time_scale_after_hit", "%.2f" % Engine.time_scale)
				_next()
		3: # ④b 공격 종류별 타격감 — 표(FeelTuning.KINDS)대로 히트스톱·흔들림이 나가는지
			var kinds: Array = FeelTuning.KINDS.keys()
			if not _frozen:
				for en in get_tree().get_nodes_in_group("field_enemy"):
					en.process_mode = Node.PROCESS_MODE_DISABLED # 적이 플레이어를 때리는 타격(70ms)이 측정 창에 끼지 않게 격리
				_frozen = true
			if _ki >= kinds.size():
				for en in get_tree().get_nodes_in_group("field_enemy"):
					en.process_mode = Node.PROCESS_MODE_INHERIT
				_frozen = false
				for row in _kind_rows:
					print(row)
				_next()
				return
			if Engine.time_scale < 0.99:
				return # 직전 히트스톱이 풀릴 때까지 기다린다
			var kd: String = kinds[_ki]
			if _kphase == 0:
				_target = _enemy_near(TestMap.world_pos(1, 4))
				_target.set("hp", 99999.0)
				_last_stop = 0
				_last_amp = 0.0
				for k in _sig:
					_sig[k] = 0
				FeelTuning.kind = kd
				_fc.call("_deal", _target, 20.0, "", Vector3.FORWARD)
				_kphase = 1
			else:
				var want: Dictionary = FeelTuning.KINDS[kd]
				var ok := _last_stop == int(want.stop_ms) and is_equal_approx(_last_amp, 0.06 * float(want.shake_mul))
				if int(want.stop_ms) == 0:
					ok = _sig.hitstop == 0 and _sig.shake == 0
				if kd == "normal" and _last_stop != 70: # 기준선은 옛 값(70ms)과 같아야 한다
					ok = false
				if not ok:
					_fails += 1
				_kind_rows.append("FEEL hit_kind %s stop_ms=%d shake_amp=%.3f popup=%d sound=%d %s" % [kd, _last_stop, _last_amp, _sig.popup, _sig.sound, "OK" if ok else "어긋남"])
				_ki += 1
				_kphase = 0
		4: # ⑤ 회피 — 직전 타격의 히트스톱(time_scale 0.05)이 풀린 뒤에 누른다
			if _frame == 1:
				_dodge_start = -1
				_p.set("stamina", 100.0)
				_p.global_position = TestMap.world_pos(1, 4) + Vector3(0, 0.3, 6.0)
				_p.velocity = Vector3.ZERO
			elif _dodge_start < 0 and _frame >= 30 and Engine.time_scale > 0.99:
				_pos0 = _p.global_position
				_dodge_start = _frame
				_m("dodge_started", str(bool(_p.call("start_dodge"))))
			elif _dodge_start > 0:
				if _frame == _dodge_start + 1:
					_m("dodge_speed_next_frame", "%.1f" % Vector2(_p.velocity.x, _p.velocity.z).length())
				elif _frame == _dodge_start + 30: # 0.3초 + 여유
					_m("anim_speed_after_dodge", "%.2f" % (_p.find_child("AnimationPlayer", true, false) as AnimationPlayer).speed_scale) # 동작이 끝나면 1.00 으로 돌아와야 한다
					_m("dodge_distance_m", "%.1f" % Vector2(_p.global_position.x - _pos0.x, _p.global_position.z - _pos0.z).length())
					_next()
			elif _frame > 400:
				_fail("회피 시작 못 함")
		5: # ⑥ 점프
			if _frame == 1:
				_p.global_position = TestMap.world_pos(1, 4) + Vector3(0, 0.3, 9.0)
				_p.velocity = Vector3.ZERO
			elif _frame == 20 and _p.is_on_floor():
				_y0 = _p.global_position.y
				_ymax = _y0
				_air = 0
				var ev := InputEventAction.new()
				ev.action = "jump"
				ev.pressed = true
				Input.parse_input_event(ev)
			elif _frame > 20 and _y0 != 0.0:
				if _frame == 22:
					var ev2 := InputEventAction.new()
					ev2.action = "jump"
					ev2.pressed = false
					Input.parse_input_event(ev2)
				_ymax = maxf(_ymax, _p.global_position.y)
				if not _p.is_on_floor():
					_air += 1
				if _frame > 40 and _p.is_on_floor():
					_m("jump_apex_m", "%.2f" % (_ymax - _y0))
					_m("jump_airtime_ms", "%d" % roundi(float(_air) * _dt * 1000.0))
					_next()
				elif _frame > 240:
					_fail("점프가 끝나지 않음")
			elif _frame > 80:
				_fail("점프 시작 못 함(바닥에 안 섬)")
		_:
			print("FEEL_PROBE_DONE fails=", _fails)
			get_tree().quit()
