extends SceneTree

## G-0382 4종횡 룬(world/story_rune.gd) 점검 —
##   godot --headless --path saga-godot --script res://tools/probe_story_rune.gd   → "PROBE story_rune OK" / "FAIL n"
## ① judge: 맞으면 next·마지막이면 done·틀리면 wrong ② 사냥터에 붙음(적 생성기) ③ 룬 서고 닿으면 화살표 넷 · 차례로 맞히면 경험치 ×2
## ④ 틀리면 흩어짐·버프 그대로 ⑤ 처치 경험치 곱 배선 ⑥ 손잡이. 버프 시각은 되돌린다.

var fails := 0


func check(cond: bool, msg: String) -> void:
	if cond:
		print("  ok   ", msg)
	else:
		fails += 1
		print("  FAIL ", msg)


func _initialize() -> void:
	await process_frame
	var RU: GDScript = load("res://games/saga_story/world/story_rune.gd")
	check(RU.judge(["←", "↑"], 0, "←") == "next" and RU.judge(["←", "↑"], 1, "↑") == "done" and RU.judge(["←", "↑"], 0, "→") == "wrong", "① 차례 맞히기")

	var sc := (load("res://games/saga_story/world/TestField.tscn") as PackedScene).instantiate()
	root.add_child(sc)
	current_scene = sc
	for i in 5:
		await process_frame
	paused = false
	var r := sc.find_child("StoryRune", true, false)
	check(r != null, "② 사냥터에 룬 노드")
	if r == null:
		print("PROBE story_rune FAIL %d" % fails)
		quit(1)
		return
	RU.set("buff_until_ms", 0)
	r.call("spawn_rune")
	var rune := r.get("_rune") as Node3D
	var p := get_first_node_in_group("player") as Node3D
	p.global_position = rune.global_position
	for i in 3:
		await process_frame
	var seq: Array = r.get("_seq")
	var got4: bool = seq.size() == RU.ARROWS
	for a in seq.duplicate():
		r.call("press", String(a))
	check(got4 and (r.get("_seq") as Array).is_empty() and RU.exp_mul() == RU.BUFF_MUL, "③ 닿으면 화살표 %d · 다 맞히면 경험치 ×%.0f" % [seq.size(), RU.exp_mul()])

	RU.set("buff_until_ms", 0)
	r.call("start_input")
	var s2: Array = r.get("_seq")
	var wrong := "←" if String(s2[0]) != "←" else "→"
	r.call("press", wrong)
	check((r.get("_seq") as Array).is_empty() and RU.exp_mul() == 1.0, "④ 틀리면 흩어짐·버프 없음")

	var src := FileAccess.get_file_as_string("res://games/saga_story/world/story_enemy.gd")
	check(src.contains("story_rune.gd\").exp_mul()"), "⑤ 처치 경험치 곱 배선")

	OS.set_environment("SAGA_RUNE", "0")
	var off: Node = RU.attach(Node.new())
	OS.set_environment("SAGA_RUNE", "")
	check(off == null, "⑥ 끄면 안 섬")

	RU.set("buff_until_ms", 0)
	print("PROBE story_rune ", "OK" if fails == 0 else "FAIL %d" % fails)
	quit(1 if fails > 0 else 0)
