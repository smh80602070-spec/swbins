extends RefCounted
## G-0186 촬영 도우미 — shot_scene.gd 의 static 단계가 부른다. 꽃 둘을 들려 주고(메모리에서만, 저장 안 함)
## 플레이어 곁(앞 3·6m, 옆 3m)에 심은 꽃 셋 자리를 넣어 발밑 칸·둘레 격자가 찍히게 한다.

static func stage(tree: SceneTree) -> void:
	var F: Node = tree.root.get_node("ForestSaveState")
	var p := tree.get_first_node_in_group("player") as Node3D
	if p == null:
		return
	F.items = {"꽃": 2}
	var o := p.global_position
	F.planted = [{"x": o.x, "z": o.z - 3.0, "day": 0}, {"x": o.x + 3.0, "z": o.z - 3.0, "day": 0}, {"x": o.x, "z": o.z - 6.0, "day": 0}]
	var ov := tree.current_scene.find_child("PlantGridOverlay", true, false)
	if ov != null:
		ov.call("tick")
