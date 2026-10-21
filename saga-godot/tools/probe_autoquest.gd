extends SceneTree

## G-0298 자동 퀘스트 자동 점검(웹 W-0337 짝) —
##   godot --headless --path saga-godot --script res://tools/probe_autoquest.gd   → "PROBE autoquest OK" / "FAIL n"
## ① 공용 상태 기계(가짜 어댑터): 목표 없음 → 안 켜짐 · 목표 id 가 바뀌면 done+1 · 서 있으면 STUCK_SEC 마다 unstick, STUCK_MAX 넘으면 "막힘" · pause 글 → 멈춤
## ② 1만리 씬: ▶ 단추·첫 목표 · 켜면 주인공이 목표 쪽으로 걸어가 거리가 줆(실제 시간 3초) · 이동 키 = 멈춤·auto_dir 0
## ③ SAGA_AUTOQUEST=0 이면 안 붙음

const AQ := preload("res://saga_core/data/autoquest.gd")

var fails := 0


func _fail(msg: String) -> void:
	fails += 1
	print("  FAIL ", msg)


func _init() -> void:
	await process_frame
	## ①
	var gid := ["a"]
	var unst := [0]
	var pz := [""]
	var ad := {"goals": func() -> Array: return [] if gid[0] == "" else [{"id": gid[0], "label": gid[0]}],
		"run": func(_g, _dt) -> String: return "run", "pos": func() -> Vector3: return Vector3.ZERO,
		"busy": func() -> bool: return false, "pause": func() -> String: return pz[0],
		"unstick": func(_n, _g) -> void: unst[0] += 1}
	gid[0] = ""
	var q := AQ.new(ad)
	if q.start() or q.why != "목표 없음":
		_fail("① 목표 없는데 켜짐")
	gid[0] = "a"
	q.start()
	q.tick(0.1)
	gid[0] = "b"
	q.tick(0.1)
	if q.done != 1:
		_fail("① 목표 바뀌어도 done %d" % q.done)
	for _i in int(AQ.STUCK_SEC * (AQ.STUCK_MAX + 1) / 1.0) + 5:
		q.tick(1.0)
	if q.on or not String(q.why).begins_with("막힘") or unst[0] != AQ.STUCK_MAX:
		_fail("① 막힘 처리 on=%s why=%s unstick=%d" % [q.on, q.why, unst[0]])
	q.start()
	pz[0] = "체력 낮음"
	q.tick(0.1)
	if q.on or q.why != "체력 낮음":
		_fail("① pause 글로 안 멈춤")
	## ③
	OS.set_environment("SAGA_AUTOQUEST", "0")
	if load("res://games/saga_go/world/auto_quest_go.gd").call("attach", Node.new()) != null:
		_fail("③ 꺼도 붙음")
	OS.set_environment("SAGA_AUTOQUEST", "")
	## ②
	var sc := (load("res://games/saga_go/world/TestVillage.tscn") as PackedScene).instantiate()
	root.add_child(sc)
	current_scene = sc
	for _i in 40:
		await process_frame
	for m in get_nodes_in_group("ui_modal"):   # 첫 안내 — 지우면 붙잡은 노드(봉화대 안내)가 깨져 숨기기만(probe_menu_screen 과 같게)
		if m.has_method("close"):
			m.call("close")
		if m.get("visible") != null:
			m.set("visible", false)
		m.remove_from_group("ui_modal")
	paused = false
	var aq := get_first_node_in_group("go_autoquest")
	if aq == null or aq.find_child("AutoQuestButton", true, false) == null:
		_fail("② 1만리 자동 퀘스트 단추 없음")
	else:
		var gs: Array = aq.call("goals")
		var pl := get_first_node_in_group("player") as Node3D
		print("AQ goals %s" % [gs])
		if gs.is_empty():
			_fail("② 첫 목표 없음")
		else:
			var target: Vector3 = gs[0].pos
			var d0 := Vector2(target.x - pl.global_position.x, target.z - pl.global_position.z).length()
			if not aq.call("toggle"):
				_fail("② 켜지지 않음: %s" % aq.get("q").why)
			await create_timer(3.0).timeout
			var d1 := Vector2(target.x - pl.global_position.x, target.z - pl.global_position.z).length()
			var st: Dictionary = aq.get("q").call("status")
			print("AQ %s d %.1f → %.1f · %s · %s" % [gs[0].type, d0, d1, st.doing, st.why])
			if d0 > 4.0 and d1 >= d0 - 1.0 and bool(st.on):
				_fail("② 3초 걸어도 안 가까워짐 %.1f → %.1f" % [d0, d1])
			if bool(st.on):
				var ev := InputEventAction.new()
				ev.action = "move_forward"
				ev.pressed = true
				aq.call("_input", ev)
				if bool(aq.get("q").on) or (pl.get("auto_dir") as Vector3) != Vector3.ZERO:
					_fail("② 이동 키에 안 멈춤")
	print("PROBE autoquest ", "OK" if fails == 0 else "FAIL %d" % fails)
	quit(1 if fails > 0 else 0)
