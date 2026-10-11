extends Node

## G-0184 1만리 젤다 읽힘새 자동 점검 — 평소엔 안 붙는다. test_village.gd 가 SAGA_LANDMARK_PROBE 가 있을 때만 단다.
##   SAGA_LANDMARK_PROBE=1 "$GODOT" --headless --path saga-godot res://games/saga_go/world/TestVillage.tscn
## ① 열 지역 모두 이름표 하나 · 높이 18m 이상 실루엣(새로 세운 여덟 + 있는 성루·다층탑) ② 거리 글 400m 경계(399 → 이름만 · 401 → "· 0.4km")
## ③ 시점: 손 뗀 pitch 가 기본보다 6° 넘게 얕으면 기본(−35)으로, 아니면 그대로 · 실제 리그를 끌고 놓으면 0.6초 뒤 −35 · 끌어도 −70~−15 밖으로 못 나감
## ④ 그리기: 새 실루엣은 한 메시씩(지역당 실루엣 1 + 이름표 1). 끝에 LANDMARK_PROBE_DONE fails=N.

const Reads := preload("res://games/saga_go/world/landmark_reads.gd")
const Rig := preload("res://games/saga_go/player/camera_rig.gd")

var _fails := 0
var _frame := 0
var _started := false


func check(cond: bool, msg: String) -> void:
	if cond:
		print("  ok   ", msg)
	else:
		_fails += 1
		print("  FAIL ", msg)


func _process(_delta: float) -> void:
	_frame += 1
	if _frame < 8 or _started:
		return
	_started = true
	_run()


func _run() -> void:
	var lr := get_parent().get_node_or_null("LandmarkReads")
	check(lr != null, "LandmarkReads 노드가 섰다")
	if lr == null:
		_done()
		return
	# ①
	var regions := {}
	for e: Dictionary in Reads.READS:
		regions[String(e.region)] = true
	var tall_ok := true
	for e: Dictionary in Reads.READS:
		if e.has("node"):
			var host := get_parent().find_child(String(e.node), true, false)
			tall_ok = tall_ok and host != null and float(e.top) >= 18.0
		else:
			tall_ok = tall_ok and float(e.h) >= 18.0
	check(regions.size() == 10 and (lr.labels as Array).size() == 10 and tall_ok, "열 지역(%d) · 이름표 %d · 모두 18m 이상(있는 성루·다층탑은 노드로 찾음)" % [regions.size(), (lr.labels as Array).size()])
	var sil_ok := true
	for mi: MeshInstance3D in lr.silhouettes:
		var aabb := mi.get_aabb()
		sil_ok = sil_ok and mi.mesh.get_surface_count() == 1 and aabb.size.y >= 18.0
	check((lr.silhouettes as Array).size() == 8 and sil_ok, "새 실루엣 여덟 — 한 메시(면 묶음 1)·높이 18m 이상")
	# ②
	check(Reads.label_text("갈무리 첨탑", 399.0) == "갈무리 첨탑" and Reads.label_text("갈무리 첨탑", 401.0) == "갈무리 첨탑 · 0.4km" and Reads.label_text("x", 1234.0) == "x · 1.2km", "거리 글: 400m 안 이름만 · 밖 '· n.nkm'")
	# ③
	check(is_equal_approx(Rig.pitch_return_target(-20.0), -35.0) and is_equal_approx(Rig.pitch_return_target(-30.0), -30.0) and is_equal_approx(Rig.pitch_return_target(-55.0), -55.0), "손 뗀 pitch: −20 → −35 · −30(6° 안) 그대로 · −55(더 내려봄) 그대로")
	var rig := get_tree().get_first_node_in_group("camera_rig") as Node3D
	if rig != null and rig.get_script() == Rig:
		rig.rotation_degrees.x = -20.0
		rig.set("_dragging", true)
		rig.set("_drag_confirmed", true)
		rig.call("_begin_drag", false, Vector2.ZERO)
		await get_tree().create_timer(Rig.PITCH_RETURN_SEC + 0.3).timeout
		var back := rig.rotation_degrees.x
		rig.call("_begin_drag", true, Vector2.ZERO)
		rig.set("_drag_confirmed", true)
		rig.call("_apply_drag", Vector2(0, -100000), Vector2(500, 500))
		var lo := rig.rotation_degrees.x
		rig.call("_apply_drag", Vector2(0, 100000), Vector2(500, 500))
		var hi := rig.rotation_degrees.x
		rig.call("_begin_drag", false, Vector2.ZERO)
		rig.rotation_degrees.x = Rig.REST_PITCH
		check(absf(back - Rig.REST_PITCH) < 0.5 and lo >= -70.01 and lo <= -14.99 and hi >= -70.01 and hi <= -14.99, "실제 리그: 끌고 놓으면 %.1f → −35 · 끌기 끝값 %.1f / %.1f 가 −70~−15 안" % [back, lo, hi])
	else:
		check(false, "카메라 리그(camera_rig.gd)를 못 찾음")
	_done()


func _done() -> void:
	print("LANDMARK_PROBE_DONE fails=%d" % _fails)
	get_tree().quit()
