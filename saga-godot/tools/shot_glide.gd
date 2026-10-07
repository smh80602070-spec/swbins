extends RefCounted
## G-0072 촬영 도우미 — shot_scene.gd 의 static 단계가 부른다. 플레이어를 15m 띄워 활공으로 바꾼다(저장 안 함).

static func lift(tree: SceneTree) -> void:
	var p := tree.get_first_node_in_group("player") as CharacterBody3D
	if p == null:
		return
	p.global_position += Vector3(0.0, 15.0, 0.0)
	p.velocity = Vector3.ZERO
	p.call("_set_mode", 2) # Mode.GLIDE
