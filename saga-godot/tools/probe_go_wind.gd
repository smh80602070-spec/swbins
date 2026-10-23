extends SceneTree

## G-0318 1만리 바람 길잡이 점검 —
##   godot --headless --path saga-godot --script res://tools/probe_go_wind.gd   → "PROBE go_wind OK" / "FAIL n"
## ① 방향: 목표 쪽 수평 단위 · 가깝거나 목표 없으면 ZERO ② 때: 1.5초 가만히 · 6초 쉼 · 바람만 모드면 움직여도 12초마다
## ③ 실제 틱: 가짜 나·가짜 임무로 가만히 서면 한 번 불고 줄 일곱 · 움직이면 안 붊 ④ 줄은 사라짐 ⑤ SAGA_WIND_GUIDE=0 → 안 붊 · SAGA_WIND_ONLY=1
## ⑥ 배선(test_village 붙이기 · story_quest 기둥 끄기).

var fails := 0


func check(cond: bool, msg: String) -> void:
	if cond:
		print("  ok   ", msg)
	else:
		fails += 1
		print("  FAIL ", msg)


func _streaks(host: Node) -> int:
	var n := 0
	for c in host.get_children():
		if String(c.name).begins_with("WindStreak"):
			n += 1
	return n


func _initialize() -> void:
	await process_frame
	var W: GDScript = load("res://games/saga_go/world/wind_guide.gd")

	# ①
	var d: Vector3 = W.dir_to(Vector3(0, 5, 0), Vector3(30, 0, 40))
	check(d.is_equal_approx(Vector3(0.6, 0, 0.8)) and W.dir_to(Vector3.ZERO, Vector3(1, 0, 1)) == Vector3.ZERO and W.dir_to(Vector3.ZERO, Vector3.INF) == Vector3.ZERO, "① 방향 %s · 가까움·목표 없음 ZERO" % str(d))

	# ②
	check(not W.due(1.4, 99.0, false) and W.due(1.5, 99.0, false) and not W.due(5.0, 5.9, false) and not W.due(0.0, 13.0, false) and W.due(0.0, 13.0, true), "② 때: 1.5초 · 6초 쉼 · 바람만 모드 12초")

	# ③
	var host := Node3D.new()
	root.add_child(host)
	var pl := Node3D.new()
	pl.add_to_group("player")
	host.add_child(pl)
	var sq_src := GDScript.new()
	sq_src.source_code = "extends Node\nfunc target_pos() -> Vector3:\n\treturn Vector3(0, 0, -50)\n"
	sq_src.reload()
	var sq := Node.new()
	sq.set_script(sq_src)
	sq.add_to_group("go_story")
	host.add_child(sq)
	var g: Node = W.attach(host)
	for i in 120:
		pl.global_position += Vector3(0.05, 0, 0)   # 3 m/s 걷기
		g._process(1.0 / 60.0)
	var moving: int = g.gusts
	for i in 100:
		g._process(1.0 / 60.0)
	check(moving == 0 and g.gusts == 1 and _streaks(host) == 7 and (g.last_dir as Vector3).z < -0.95, "③ 걷는 동안 0번 · 서면 %d번 · 줄 %d · 방향 %s" % [g.gusts, _streaks(host), str(g.last_dir)])

	# ④
	await create_timer(2.2).timeout
	check(_streaks(host) == 0, "④ 줄은 사라짐(남은 %d)" % _streaks(host))

	# ⑤
	OS.set_environment("SAGA_WIND_GUIDE", "0")
	var before: int = g.gusts
	for i in 600:
		g._process(1.0 / 60.0)
	var off_ok: bool = g.gusts == before and not W.wind_only()
	OS.set_environment("SAGA_WIND_GUIDE", "")
	OS.set_environment("SAGA_WIND_ONLY", "1")
	var only_ok: bool = W.wind_only()
	OS.set_environment("SAGA_WIND_ONLY", "")
	check(off_ok and only_ok and not W.wind_only(), "⑤ SAGA_WIND_GUIDE=0 → 안 붊 · SAGA_WIND_ONLY=1 → 바람만")

	# ⑥
	var tv := FileAccess.get_file_as_string("res://games/saga_go/world/test_village.gd")
	var sqf := FileAccess.get_file_as_string("res://games/saga_go/world/story_quest.gd")
	check(tv.contains("wind_guide.gd\").attach(self)") and sqf.contains("wind_guide.gd\").wind_only()"), "⑥ 배선 둘")

	host.queue_free()
	await process_frame
	print("PROBE go_wind ", "OK" if fails == 0 else "FAIL %d" % fails)
	quit(1 if fails > 0 else 0)
