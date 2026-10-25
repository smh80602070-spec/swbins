extends SceneTree
## G-0403 4종횡 발판·사다리 GLB(K-0193) 점검 — godot --headless --path saga-godot --script res://tools/probe_story_plat_kit.gd → "PROBE story_plat_kit OK" / "FAIL n"
## ① 키트 다섯 임포트 여부(없으면 옛 상자 길만 보고 OK) ② 나무 6m 발판 = 가운데 5 + 끝 2, x −3..3 · 윗면 0 · 두께 0.4 · 그림 깊이 1.6
## (끝 조각은 x 로 0.03m 입술 — 범위 허용 0.05) ③ 짧은 발판(1.2m·0.8m)도 빈틈·넘침 없음 · 왼끝은 x 거울 ④ 바닥 결 → 돌/나무 ⑤ 사다리 3.4m = 마디 4, y 0..3.4
## ⑥ SAGA_STORY_PLAT_GLB=0 이면 꺼짐 ⑦ 동굴 사냥터 지형을 실제로 지으면 발판마다 PlatKit·상자 그림 없음·충돌 그대로, 사다리에 LadderKit

var fails := 0
var TB: GDScript


func _fail(msg: String) -> void:
	fails += 1
	print("  FAIL ", msg)


## 뿌리 기준 AABB(트리 밖이라 global_transform 대신 변환을 손으로 곱한다)
func _bounds(root: Node3D) -> AABB:
	var out := AABB()
	var first := true
	for mi: Node in root.find_children("*", "MeshInstance3D", true, false):
		var t := Transform3D.IDENTITY
		var n: Node = mi
		while n != root and n != null:
			t = (n as Node3D).transform * t
			n = n.get_parent()
		var a: AABB = t * (mi as MeshInstance3D).get_aabb()
		out = a if first else out.merge(a)
		first = false
	return out


func _near(a: float, b: float, tol := 0.03) -> bool:
	return absf(a - b) <= tol


func _check_plat(w: float, kind: String, want_children: int) -> void:
	var k: Node3D = TB.build_plat_kit(w, kind)
	if k.get_child_count() != want_children:
		_fail("%s %.1fm 조각 %d (기대 %d)" % [kind, w, k.get_child_count(), want_children])
	var b := _bounds(k)
	if not (_near(b.position.x, -w * 0.5, 0.05) and _near(b.end.x, w * 0.5, 0.05)):
		_fail("%s %.1fm x 범위 %.3f..%.3f" % [kind, w, b.position.x, b.end.x])
	if not (_near(b.end.y, 0.0, 0.08) and _near(b.size.y, TB.PLATFORM_THICKNESS, 0.08)):
		_fail("%s %.1fm 윗면 %.3f 두께 %.3f" % [kind, w, b.end.y, b.size.y])
	if not _near(b.size.z, TB.PLAT_VIS_DEPTH, 0.05):
		_fail("%s %.1fm 깊이 %.3f" % [kind, w, b.size.z])
	var left := k.get_child(k.get_child_count() - 2) as Node3D
	if left.scale.x >= 0.0:
		_fail("왼끝이 거울이 아님")
	k.free()


## 발판 = 두께 0.4 충돌 상자(벽은 높이 20, 바닥은 y<0)
func _is_plat(c: Node) -> bool:
	for cc: Node in c.get_children():
		if cc is CollisionShape3D and (cc as CollisionShape3D).shape is BoxShape3D:
			return absf(((cc as CollisionShape3D).shape as BoxShape3D).size.y - 0.4) < 0.01
	return false


func _initialize() -> void:
	await process_frame
	TB = load("res://games/saga_story/world/story_terrain_builder.gd")
	# ①
	var ready: bool = TB.plat_glb_ready()
	print("  키트 임포트 ", ready)
	# ④
	if TB.plat_kind(Color(0.2353, 0.1922, 0.2706)) != "stone" or TB.plat_kind(Color(0.435, 0.686, 0.333)) != "wood" or TB.plat_kind(Color(0.478, 0.353, 0.188)) != "wood":
		_fail("바닥 결 → 돌/나무 고르기")
	# ⑥
	OS.set_environment("SAGA_STORY_PLAT_GLB", "0")
	if TB.plat_glb_ready():
		_fail("SAGA_STORY_PLAT_GLB=0 인데 켜짐")
	OS.set_environment("SAGA_STORY_PLAT_GLB", "")
	if ready:
		# ②③
		_check_plat(6.0, "wood", 7)
		_check_plat(6.0, "stone", 7)
		_check_plat(1.2, "wood", 3)
		_check_plat(0.8, "stone", 2)
		# ⑤
		var l: Node3D = TB.build_ladder_kit(3.4)
		var lb := _bounds(l)
		if l.get_child_count() != 4 or not _near(lb.position.y, 0.0) or not _near(lb.end.y, 3.4):
			_fail("사다리 마디 %d y %.3f..%.3f" % [l.get_child_count(), lb.position.y, lb.end.y])
		l.free()
	# ⑦ 실제 지형(동굴 — 돌 발판·사다리 있음)
	var tb: Node3D = TB.new()
	tb.map_path = "res://games/saga_story/data/cave_map.gd"
	tb.ground_color = Color(0.2353, 0.1922, 0.2706)
	root.add_child(tb)
	await process_frame
	await process_frame
	var plats := 0
	for c: Node in tb.get_children():
		if c is StaticBody3D and (c as Node3D).position.y > 0.0 and c.get_child_count() > 0 and _is_plat(c):
			plats += 1
			var kit := c.get_node_or_null("PlatKit")
			var box := 0
			var col := 0
			for cc: Node in c.get_children():
				if cc is MeshInstance3D:
					box += 1
				if cc is CollisionShape3D:
					col += 1
			if col != 1:
				_fail("%s 충돌 %d" % [c.name, col])
			if ready and (kit == null or box != 0):
				_fail("%s 키트 %s 상자 그림 %d" % [c.name, kit != null, box])
			if not ready and box != 1:
				_fail("%s 옛 상자 %d" % [c.name, box])
	if plats == 0:
		_fail("동굴 발판 0")
	var lad := tb.find_child("Ladder*", false, false)
	if lad != null and ready and lad.get_node_or_null("LadderKit") == null:
		_fail("사다리 LadderKit 없음")
	print("  동굴 발판 %d · 사다리 %s" % [plats, lad != null])
	print("PROBE story_plat_kit ", "OK" if fails == 0 else "FAIL %d" % fails)
	quit(1 if fails > 0 else 0)
