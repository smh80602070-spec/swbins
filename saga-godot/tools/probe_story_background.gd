extends SceneTree
## R-3(gd.st.background) 사가종횡 배경 점검 — godot --headless --path saga-godot --script res://tools/probe_story_background.gd → "PROBE story_background OK" / "FAIL n"
## ① 배경 나무 14·언덕 5 MultiMesh 가 만들어진다(메시 있음) ② 단색 실루엣 재질(비조명)과 재질 감사 예외 메타 ③ 두 번 지어도 개수가 같다
## G-0187 ④ 층 z 순서 능선 < 언덕 < 나무 < 0 < 앞 층 < 카메라 · 앞 층 풀·바위 MultiMesh 둘(그리기 ≤2) ⑤ 인물 그림 배율 1.6(판정 캡슐 그대로) · 화면 높이 비율 ≈ 1/7
## (헤드리스 더미 렌더러는 MultiMesh 인스턴스 변환을 항등으로 돌려줘 자리는 못 본다 — 자리는 창 모드 촬영으로)

const BG := preload("res://games/saga_story/world/story_background.gd")
const Look := preload("res://games/saga_story/data/story_look.gd")
const Cam := preload("res://games/saga_story/world/story_camera.gd")

var fails := 0


func _fail(msg: String) -> void:
	fails += 1
	print("  FAIL ", msg)


func _build() -> Node:
	var n := BG.new()
	n.name = "Background"
	root.add_child(n)
	return n


func _layer(bg: Node, layer_name: String, count: int) -> Array:
	var mmi := bg.get_node_or_null(layer_name) as MultiMeshInstance3D
	if mmi == null:
		_fail(layer_name + " 없음")
		return []
	var mm := mmi.multimesh
	if mm == null or mm.mesh == null:
		_fail(layer_name + " 메시 없음")
		return []
	if mm.instance_count != count:
		_fail("%s 개수 %d (기대 %d)" % [layer_name, mm.instance_count, count])
	var mat := mmi.material_override as BaseMaterial3D
	if mat == null or mat.shading_mode != BaseMaterial3D.SHADING_MODE_UNSHADED:
		_fail(layer_name + " 단색 비조명 재질이 아님")
	if not mmi.has_meta("flat_silhouette"):
		_fail(layer_name + " flat_silhouette 메타 없음(재질 감사 예외)")
	return [mm.instance_count]


func _initialize() -> void:
	await process_frame
	var a := _build()
	await process_frame
	var trees := _layer(a, "BackgroundTrees", BG.TREE_COUNT)
	var hills := _layer(a, "BackgroundHills", BG.HILL_COUNT)
	root.remove_child(a)
	a.free()
	var b := _build()
	await process_frame
	if _layer(b, "BackgroundTrees", BG.TREE_COUNT) != trees or _layer(b, "BackgroundHills", BG.HILL_COUNT) != hills:
		_fail("두 번 지었더니 개수가 다름")
	# G-0187 ④
	var ridge_max := -1.0e9
	for r: Array in BG.RIDGES:
		ridge_max = maxf(ridge_max, float(r[0]))
	if not (ridge_max < BG.HILL_Z and BG.HILL_Z < BG.TREE_Z and BG.TREE_Z < 0.0 and 0.0 < Look.FG_Z0 and Look.FG_Z1 < Cam.Z_DISTANCE - 2.0):
		_fail("층 z 순서가 어긋남(능선 %.0f · 언덕 %.0f · 나무 %.0f · 앞 %.1f~%.1f · 카메라 %.1f)" % [ridge_max, BG.HILL_Z, BG.TREE_Z, Look.FG_Z0, Look.FG_Z1, Cam.Z_DISTANCE])
	var fg_n := 0
	for c in b.get_children():
		if String(c.name).begins_with("Foreground"):
			fg_n += 1
			if not (c is MultiMeshInstance3D) or (c as MultiMeshInstance3D).multimesh.instance_count < 10:
				_fail("%s 가 MultiMesh 가 아니거나 너무 적음" % c.name)
	if fg_n != 2:
		_fail("앞 층 노드 %d (기대 2: 풀·바위)" % fg_n)
	else:
		print("  ok   앞 층 둘(풀·바위 MultiMesh) · z 순서 능선 < 언덕 < 나무 < 0 < 앞 층 < 카메라")
	# G-0187 ⑤
	var player: Node = (load("res://games/saga_story/player/StoryPlayer.tscn") as PackedScene).instantiate()
	root.add_child(player)
	await process_frame
	var vis := player.get_node_or_null("Visual") as Node3D
	var cap := (player.get_node("CollisionShape3D") as CollisionShape3D).shape as CapsuleShape3D
	var frac := 1.7 * Look.BODY_SCALE / (2.0 * Cam.Z_DISTANCE * tan(deg_to_rad(37.5)))
	if vis == null or vis.scale.y < 1.0 or not is_equal_approx(cap.height, 1.8) or not is_equal_approx(cap.radius, 0.6) or frac < 1.0 / 7.6 or frac > 1.0 / 6.4:
		_fail("인물 배율·판정 캡슐·화면 비율(배율 %.2f · 캡슐 %.1f/%.1f · 1/%.1f)" % [vis.scale.y if vis != null else 0.0, cap.height, cap.radius, 1.0 / frac])
	else:
		print("  ok   인물 그림 배율 %.2f(Visual) · 판정 캡슐 1.8/0.6 그대로 · 화면 높이 약 1/%.1f" % [vis.scale.y, 1.0 / frac])
	player.queue_free()
	print("PROBE story_background ", "OK" if fails == 0 else "FAIL %d" % fails)
	quit(1 if fails > 0 else 0)
