extends SceneTree

## 동행 실루엣(101-3 G: saga_core/world/companion_follow.gd — 등용 인원 수만큼 뒤따르는 장식용 그림자) 자동 점검 — 화면·씬 없이 돈다.
##   godot --headless --path saga-godot --script res://tools/probe_companions.gd
## ① set_count: 늘리고 줄여도 개수가 맞고 이름이 겹치지 않는다(줄이면 실제로 지워짐) ② 순수 시각: 충돌 몸이 하나도 없고 반투명·무음영 캡슐 ③ 처음엔 이끄는 이의 자리에서 선다
## ④ 따라가기: 한 프레임 이동이 속도 한도(3.2m/s) 안 · 이끄는 이가 20m 떨어져도 따라잡아 서로 겹치지 않는 자리에 선다 · 방향을 돌리면 다시 자리를 잡음
## ⑤ 이끄는 이가 없으면 아무 일도 안 한다. 끝에 "PROBE companions OK" 또는 "PROBE companions FAIL n".

const CompanionFollow := preload("res://saga_core/world/companion_follow.gd")
const DELTA := 1.0 / 60.0

var fails := 0


func check(cond: bool, msg: String) -> void:
	if cond:
		print("  ok   ", msg)
	else:
		fails += 1
		print("  FAIL ", msg)


func _names(c: Node) -> Array:
	var out := []
	for ch in c.get_children():
		if String(ch.name).begins_with("Companion") and not ch.is_queued_for_deletion():
			out.append(String(ch.name))
	return out


func _bodies(c: Node) -> Array:
	var out := []
	for ch in c.get_children():
		if String(ch.name).begins_with("Companion") and not ch.is_queued_for_deletion():
			out.append(ch)
	return out


func _initialize() -> void:
	await process_frame
	var leader := Node3D.new()
	root.add_child(leader)
	var c: Node3D = CompanionFollow.new()
	root.add_child(c)
	c.setup(leader)
	c.set_process(false)  # 점검이 _process 를 직접 부른다(프레임 간격을 정확히)

	# ① 개수
	var ok_counts := true
	var shown := ""
	for n in [0, 3, 5, 2, 0, 4]:
		c.set_count(n)
		await process_frame
		var names := _names(c)
		var uniq := {}
		for nm in names:
			uniq[nm] = true
		ok_counts = ok_counts and names.size() == n and uniq.size() == n
		shown += " %d" % names.size()
	check(ok_counts, "set_count 0→3→5→2→0→4 : 개수·이름 유일" + shown)

	# ② 순수 시각
	var bodies := _bodies(c)
	var coll := c.find_children("*", "CollisionObject3D", true, false).size() + c.find_children("*", "CollisionShape3D", true, false).size()
	var vis_ok := true
	for b in bodies:
		var meshes: Array = b.find_children("*", "MeshInstance3D", true, false)
		vis_ok = vis_ok and meshes.size() == 1
		var m := (meshes[0] as MeshInstance3D).material_override as StandardMaterial3D
		vis_ok = vis_ok and m != null and m.shading_mode == BaseMaterial3D.SHADING_MODE_UNSHADED and m.transparency == BaseMaterial3D.TRANSPARENCY_ALPHA and m.albedo_color.a < 1.0
	check(coll == 0 and vis_ok and bodies.size() == 4, "충돌 몸 %d · 반투명 무음영 캡슐 %d개" % [coll, bodies.size()])

	# ③ 처음 자리
	leader.global_position = Vector3(10, 0, 5)
	c.set_count(0)
	await process_frame
	c.set_count(1)
	var f0: Node3D = _bodies(c)[0]
	check(f0.global_position.is_equal_approx(Vector3(10, 0, 5)), "처음엔 이끄는 이의 자리에서 선다")

	# ④ 따라가기
	c.set_count(4)
	var bs := _bodies(c)
	var max_step := 0.0
	var prev: Array = []
	for b in bs:
		prev.append(b.global_position)
	leader.global_position = Vector3(30, 0, 5)  # 20m 떨어짐
	for i in 720:
		c._process(DELTA)
		for k in bs.size():
			max_step = maxf(max_step, bs[k].global_position.distance_to(prev[k]))
			prev[k] = bs[k].global_position
	check(max_step <= CompanionFollow.FOLLOW_SPEED * DELTA + 0.0001, "한 프레임 최대 이동 %.4fm ≤ 속도 한도 %.4fm" % [max_step, CompanionFollow.FOLLOW_SPEED * DELTA])
	var near := true
	var max_gap := 0.0
	for b in bs:
		var d: float = b.global_position.distance_to(leader.global_position)
		max_gap = maxf(max_gap, d)
		near = near and d < 8.0
	check(near, "12초 뒤 모두 따라잡음 (가장 먼 동행 %.1fm)" % max_gap)
	var apart := true
	var min_pair := INF
	for i in bs.size():
		for j in range(i + 1, bs.size()):
			var d: float = bs[i].global_position.distance_to(bs[j].global_position)
			min_pair = minf(min_pair, d)
			apart = apart and d >= 0.6
	check(apart, "서로 겹치지 않는 자리 (가장 가까운 둘 %.2fm)" % min_pair)
	var before_turn: Array = []
	for b in bs:
		before_turn.append(b.global_position)
	leader.rotate_y(PI * 0.5)
	for i in 600:
		c._process(DELTA)
	var moved := 0
	for k in bs.size():
		if bs[k].global_position.distance_to(before_turn[k]) > 0.3:
			moved += 1
	check(moved >= 2, "이끄는 이가 방향을 돌리면 다시 자리를 잡는다 (%d명 움직임)" % moved)

	# ⑤ 이끄는 이 없음
	var c2: Node3D = CompanionFollow.new()
	root.add_child(c2)
	c2.setup(null)
	c2.set_count(2)
	c2._process(DELTA)
	check(not c2.is_processing() and _names(c2).size() == 2, "이끄는 이가 없으면 처리를 멈추고 아무 일도 안 한다")

	print("PROBE companions ", "OK" if fails == 0 else "FAIL %d" % fails)
	quit(1 if fails > 0 else 0)
