extends Node
## G-0176 이동 소리(games/saga_go/player/move_sounds.gd) 자동 점검 — 평소엔 안 붙는다.
##   SAGA_MOVESND_PROBE=1 "$GODOT" --headless --path saga-godot res://games/saga_go/world/TestVillage.tscn
## 넓은 마을 땅에서 ① 2초 걷기 → 발소리 3~7번 ② 점프 → 점프 1·착지 1 ③ 대시 → 대시 1 ④ 서 있기 1초 → 발소리 안 늘어남.
## ⑤ G-0368 땅을 적시고(WeatherFall.wet 1) 2초 걷기 → 물 튐 = 발소리 수 · 마른 ① 에선 물 튐 0.
## 헤드리스라 소리는 안 들리고 move_sounds.counts 만 센다. 끝에 "MOVESND_PROBE_DONE fails=N".

const TestMap := preload("res://games/saga_go/data/test_map.gd")

var _frame := 0
var _fails := 0
var _p: CharacterBody3D
var _ms: Node
var _base := {}


func _check(name: String, ok: bool, info := "") -> void:
	print("MOVESND_PROBE %s %s %s" % [name, "ok" if ok else "FAIL", info])
	if not ok:
		_fails += 1


func _physics_process(_delta: float) -> void:
	_frame += 1
	if _frame == 10:
		_p = get_tree().get_first_node_in_group("player") as CharacterBody3D
		_ms = _p.get_node_or_null("MoveSounds") if _p else null
		_check("node", _ms != null)
		if _ms:
			var loaded := (_ms.get("_streams") as Dictionary).size()
			_check("loaded", loaded == 16, "streams=%d (발소리 12 + 점프·착지·대시·물 튐)" % loaded)
		var wf := get_tree().current_scene.find_child("WeatherFall", true, false)
		if wf:
			wf.set("wet", 0.0)
			wf.set("key", "clear")
		if _ms == null:
			_finish()
			return
		_p.global_position = TestMap.world_pos(1, 4) + Vector3(0, 0.3, 6.0)
		_p.velocity = Vector3.ZERO
	elif _frame == 30:
		_base = (_ms.get("counts") as Dictionary).duplicate()
		Input.action_press("move_forward")
	elif _frame == 150:
		Input.action_release("move_forward")
		var n := _d("step")
		_check("walk_steps", n >= 3 and n <= 7, "steps=%d (2초)" % n)
		_check("dry_no_splash", _d("splash") == 0, "splash=%d (마름)" % _d("splash"))
	elif _frame == 170:
		_base = (_ms.get("counts") as Dictionary).duplicate()
		Input.action_press("jump")
	elif _frame == 172:
		Input.action_release("jump")
	elif _frame == 240:
		_check("jump", _d("jump") == 1, "jump=%d" % _d("jump"))
		_check("land", _d("land") >= 1, "land=%d" % _d("land"))
		_base = (_ms.get("counts") as Dictionary).duplicate()
		_p.call("start_dodge")
	elif _frame == 270:
		_check("dodge", _d("dodge") == 1, "dodge=%d" % _d("dodge"))
		_base = (_ms.get("counts") as Dictionary).duplicate()
	elif _frame == 330:
		_check("idle_quiet", _d("step") == 0, "steps=%d (서 있음)" % _d("step"))
		var wf := get_tree().current_scene.find_child("WeatherFall", true, false)
		_check("wet_node", wf != null)
		if wf == null:
			_finish()
			return
		wf.set("key", "rain")
		wf.set("wet", 1.0)
		_p.global_position = TestMap.world_pos(1, 4) + Vector3(0, 0.3, 6.0)
		_p.velocity = Vector3.ZERO
	elif _frame == 350:
		_base = (_ms.get("counts") as Dictionary).duplicate()
		Input.action_press("move_forward")
	elif _frame == 470:
		Input.action_release("move_forward")
		_check("wet_splash", _d("splash") >= 3 and _d("splash") == _d("step"), "splash=%d steps=%d (젖음)" % [_d("splash"), _d("step")])
		_finish()


func _d(k: String) -> int:
	return int((_ms.get("counts") as Dictionary).get(k, 0)) - int(_base.get(k, 0))


func _finish() -> void:
	Input.action_release("move_forward")
	print("MOVESND_PROBE_DONE fails=%d" % _fails)
	get_tree().quit()
