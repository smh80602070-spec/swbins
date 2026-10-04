extends SceneTree
## R-3(gd.st.background) 사가스토리 배경 점검 — godot --headless --path saga-godot --script res://tools/probe_story_background.gd → "PROBE story_background OK" / "FAIL n"
## ① 배경 나무 14·언덕 5 MultiMesh 가 만들어진다(메시 있음) ② 단색 실루엣 재질(비조명)과 재질 감사 예외 메타 ③ 두 번 지어도 개수가 같다
## (헤드리스 더미 렌더러는 MultiMesh 인스턴스 변환을 항등으로 돌려줘 자리는 못 본다 — 자리는 창 모드 촬영으로)

const BG := preload("res://games/saga_story/world/story_background.gd")

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
	print("PROBE story_background ", "OK" if fails == 0 else "FAIL %d" % fails)
	quit(1 if fails > 0 else 0)
