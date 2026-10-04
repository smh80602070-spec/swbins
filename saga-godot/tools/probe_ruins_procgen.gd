extends SceneTree
## R-3(gd.go.ruins-procgen) 폐허 procgen 배선 점검 — godot --headless --path saga-godot --script res://tools/probe_ruins_procgen.gd → "PROBE ruins_procgen OK" / "FAIL n"
## 폐허(ruins) 지역에 식생 빌더를 지으면 ① 비석(RuinsDebris) ② 돌무더기(RuinsRubble) ③ 담장·울타리(RuinsWallFence) MultiMesh 가 각각 하나 이상 생기고 메시가 있다
## ④ 폐허 나무(고목)가 선다(Trees…) ⑤ 마을(village)엔 이 장식이 없다(폐허 전용)

const VB := preload("res://games/saga_go/world/vegetation_builder.gd")

var fails := 0


func _fail(msg: String) -> void:
	fails += 1
	print("  FAIL ", msg)


func _count(node: Node, prefix: String) -> int:
	var n := 0
	for c in node.get_children():
		if c is MultiMeshInstance3D and String(c.name).begins_with(prefix) and (c as MultiMeshInstance3D).multimesh != null and (c as MultiMeshInstance3D).multimesh.mesh != null and (c as MultiMeshInstance3D).multimesh.instance_count > 0:
			n += 1
	return n


func _build(region: String) -> Node:
	var b := VB.new()
	b.region_id = region
	b.name = "Veg_" + region
	root.add_child(b)
	return b


func _initialize() -> void:
	await process_frame
	var ruins := _build("ruins")
	await process_frame
	for pair in [["RuinsDebris", "비석"], ["RuinsRubble", "돌무더기"], ["RuinsWallFence", "담장·울타리"], ["Trees", "폐허 나무"]]:
		if _count(ruins, pair[0]) < 1:
			_fail("폐허에 %s(%s) MultiMesh 가 없다" % [pair[1], pair[0]])
	var village := _build("village")
	await process_frame
	for prefix in ["RuinsDebris", "RuinsRubble", "RuinsWallFence"]:
		if _count(village, prefix) > 0:
			_fail("마을에 폐허 장식 %s 가 생겼다" % prefix)
	print("PROBE ruins_procgen ", "OK" if fails == 0 else "FAIL %d" % fails)
	quit(1 if fails > 0 else 0)
