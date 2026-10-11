extends RefCounted
## G-0185 촬영 도우미 — shot_scene.gd 의 static 단계가 부른다. 출사표 창을 닫은 뒤 플레이어를 첫 방 가운데(z 0) 또는 첫 통로(z −10)에 세운다.

static func stage(tree: SceneTree, z: float) -> void:
	var p := tree.get_first_node_in_group("player") as Node3D
	if p == null:
		return
	p.global_position = Vector3(0.0, p.global_position.y, z)


## G-0193 — 둘째 방에서 적에게 맞아 쓰러진다(메모리에서만 — 금·장비는 촬영 뒤 씬과 함께 버려진다). 사망 카드와 은총 자리(첫 방 금빛 기둥)가 찍힌다.
static func die(tree: SceneTree) -> void:
	var p := tree.get_first_node_in_group("player") as Node3D
	var ph := tree.get_first_node_in_group("player_health")
	var g := tree.get_first_node_in_group("dungeon_grace")
	if p == null or ph == null or g == null:
		return
	p.global_position = Vector3(1.5, p.global_position.y, float(g.origins[1]) + 1.0)
	ph.call("take_damage", 9999.0, tree.get_first_node_in_group("dungeon_enemy"))
