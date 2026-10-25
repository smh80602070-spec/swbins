extends SceneTree

## G-0385 1만리 지역 나눔(world/go_zone_gate.gd) 점검 —
##   godot --headless --path saga-godot --script res://tools/probe_go_zone_gate.gd   → "PROBE go_zone_gate OK" / "FAIL n"
## ① 이웃 표: 변을 맞댄 지역만(대각선 아님) ② 마을에 서면 켜진 지역 ≤ 4(일곱 중) ③ 서리봉으로 걸어가면 넘김 막 덮이고 서리봉·이웃 켬, 먼 곳 끔
## ④ 끈 지역은 숨김만(스크립트·충돌 그대로) ⑤ 순간이동 sync_to — 옮기기 전에 도착 지역 켬 ⑥ 손잡이 0 = 다 켬.

const TM := preload("res://games/saga_go/data/test_map.gd")
const Gate := preload("res://games/saga_go/world/go_zone_gate.gd")

var fails := 0


func check(cond: bool, msg: String) -> void:
	if cond:
		print("  ok   ", msg)
	else:
		fails += 1
		print("  FAIL ", msg)


func _wait(sec: float) -> void:
	await create_timer(sec).timeout


func _initialize() -> void:
	await process_frame
	var nb_v: Array = Gate.neighbors("village")
	var nb_f: Array = Gate.neighbors("frost")
	check(nb_v.has("frost") and nb_v.has("coast") and not nb_v.has("amber") and not nb_v.has("sunken"), "① 마을 이웃 %s" % str(nb_v))
	check(nb_f.has("village") and nb_f.has("fork") and not nb_f.has("sunken"), "① 서리봉 이웃 %s" % str(nb_f))

	var sc := (load("res://games/saga_go/world/TestVillage.tscn") as PackedScene).instantiate()
	root.add_child(sc)
	current_scene = sc
	for i in 8:
		await process_frame
	paused = false
	var gate := sc.get_node_or_null("ZoneGate")
	var pl := get_first_node_in_group("player") as Node3D
	check(gate != null and pl != null, "② 마을에 붙음")
	if gate == null or pl == null:
		print("PROBE go_zone_gate FAIL %d" % fails)
		quit(1)
		return
	pl.global_position = TM.origin_of("village") + Vector3(0, 2, 0)
	await _wait(0.6)
	var n_v: int = gate.live_count()
	check(gate.current() == "village" and n_v <= 4 and not gate.is_live("sunken"), "② 마을에서 켜진 지역 %d/7" % n_v)

	pl.global_position = TM.origin_of("frost") + Vector3(0, 2, 0)
	var cut_seen := false
	for i in 30:
		await process_frame
		var zc := root.get_node_or_null("ZoneCut")
		if zc and zc.is_covered():
			cut_seen = true
		if gate.current() == "frost":
			break
	await _wait(0.1)
	check(gate.current() == "frost" and gate.is_live("frost") and gate.is_live("fork") and not gate.is_live("sunken"), "③ 서리봉 — 서리봉·세갈래 켬, 잠긴 도읍 끔")
	check(cut_seen, "③ 넘김 막 덮임")

	var sunk := sc.get_node_or_null("Region7Sunken") as Node3D
	check(sunk != null and not sunk.visible and sunk.process_mode == Node.PROCESS_MODE_INHERIT and sunk.is_processing(), "④ 끈 지역은 숨김만 — 스크립트·충돌 그대로(process_mode 그대로)")

	gate.sync_to(TM.origin_of("sunken"))
	check(gate.is_live("sunken") and gate.current() == "sunken", "⑤ sync_to 로 도착 지역 먼저 켬")
	var wp_src := FileAccess.get_file_as_string("res://games/saga_go/world/waypoints.gd")
	check(wp_src.contains("gate.sync_to(target)"), "⑤ waypoints.teleport 배선")

	OS.set_environment("SAGA_ZONE_SPLIT", "0")
	await _wait(0.4)
	check(gate.live_count() == 7, "⑥ 0 = 다 켬(%d)" % gate.live_count())
	OS.set_environment("SAGA_ZONE_SPLIT", "")

	print("PROBE go_zone_gate ", "OK" if fails == 0 else "FAIL %d" % fails)
	quit(1 if fails > 0 else 0)
