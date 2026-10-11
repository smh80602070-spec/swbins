extends RefCounted
## G-0185 촬영 도우미 — shot_scene.gd 의 static 단계가 부른다. 출사표 창을 닫은 뒤 플레이어를 첫 방 가운데(z 0) 또는 첫 통로(z −10)에 세운다.

static func stage(tree: SceneTree, z: float) -> void:
	var p := tree.get_first_node_in_group("player") as Node3D
	if p == null:
		return
	p.global_position = Vector3(0.0, p.global_position.y, z)
