extends SceneTree

## G-0314 4종횡 띄우기·공중 콤보(웹 W-0345 짝) 점검 —
##   godot --headless --path saga-godot --script res://tools/probe_story_launch.gd   → "PROBE story_launch OK" / "FAIL n"
## ① 실제 잡졸: 띄우면 떠오름(최고 약 1.5m)·떠 있는 동안 AI 건너뜀 · 내려와 닿으면 떨어짐 피해 = 마지막 힘 × 0.5 · 제자리 높이
## ② 저글 상한 4(다섯째는 안 튕김) ③ 면역: 보스·관문 대장·탱커 ④ on_strike: ↑ 없으면 안 뜸 · 떠 있으면 ↑ 없어도 저글
## ⑤ SAGA_LAUNCH=0 → 안 뜸 ⑥ 배선(_melee_hit on_strike · 적 _physics_process 첫머리 tick)

var fails := 0


func check(cond: bool, msg: String) -> void:
	if cond:
		print("  ok   ", msg)
	else:
		fails += 1
		print("  FAIL ", msg)


func _foe() -> Node3D:
	var e: Node3D = (load("res://games/saga_story/world/story_enemy.gd") as GDScript).new()
	e.set("role", "melee")
	root.add_child(e)
	e.global_position = Vector3(500, 2.0, 0)
	return e


func _initialize() -> void:
	await process_frame
	var L: GDScript = load("res://games/saga_story/data/story_launch.gd")

	# ①
	var e := _foe()
	await process_frame
	e.set("hp", 1000.0)
	e.set("max_hp", 1000.0)
	check(L.launch(e, 40.0) and L.airborne(e), "① 띄움")
	var top := 0.0
	var landed_at := -1
	for i in 240:
		var still: bool = L.tick(e, 1.0 / 60.0)
		top = maxf(top, e.global_position.y - 2.0)
		if not still:
			landed_at = i
			break
	check(top > 1.2 and top < 1.8 and landed_at > 20 and not L.airborne(e) and is_equal_approx(e.global_position.y, 2.0) and is_equal_approx(float(e.get("hp")), 980.0),
		"① 최고 %.2fm · %d틱에 닿음 · 제자리 높이 · 떨어짐 피해 20(hp %.0f)" % [top, landed_at, float(e.get("hp"))])

	# ②
	L.launch(e, 10.0)
	var bounced := 0
	for i in 5:
		if L.juggle(e, 10.0):
			bounced += 1
	check(bounced == 4 and int(e.get("launch_hits")) == 4, "② 저글 상한 4(다섯째 안 튕김)")

	# ③
	var b := _foe()
	b.set("is_boss", true)
	var c := _foe()
	c.set("is_champion", true)
	var t := _foe()
	t.set("role", "tank")
	await process_frame
	check(not L.launch(b, 10.0) and not L.launch(c, 10.0) and not L.launch(t, 10.0), "③ 보스·관문 대장·탱커는 안 뜸")

	# ④
	var d := _foe()
	await process_frame
	check(not L.on_strike(d, false, 10.0) and not L.airborne(d), "④ ↑ 없으면 안 뜸")
	check(L.on_strike(d, true, 10.0) and L.airborne(d) and L.on_strike(d, false, 12.0) and int(d.get("launch_hits")) == 1 and is_equal_approx(float(d.get("launch_dmg")), 12.0), "④ ↑ 치기 → 뜸 · 떠 있으면 ↑ 없어도 저글")

	# ⑤
	var f := _foe()
	await process_frame
	OS.set_environment("SAGA_LAUNCH", "0")
	check(not L.on_strike(f, true, 10.0) and not L.airborne(f), "⑤ SAGA_LAUNCH=0 → 안 뜸")
	OS.set_environment("SAGA_LAUNCH", "")

	# ⑥
	var pb := FileAccess.get_file_as_string("res://games/saga_story/player/story_player_base.gd")
	var en := FileAccess.get_file_as_string("res://games/saga_story/world/story_enemy.gd")
	check(pb.contains("story_launch.gd\").on_strike(e, Input.is_action_pressed(\"move_forward\"), float(roll.dmg))") and en.contains("story_launch.gd\").tick(self, delta):"), "⑥ 배선 둘")

	for n in [e, b, c, t, d, f]:
		n.queue_free()
	await process_frame
	print("PROBE story_launch ", "OK" if fails == 0 else "FAIL %d" % fails)
	quit(1 if fails > 0 else 0)
