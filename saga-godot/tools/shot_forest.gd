extends RefCounted
## G-0064 촬영 도우미 — shot_scene.gd 의 static 단계가 부른다. 상인 관계 메뉴를 연다(숲지기는 고를 거리가 없을 때가 많다)(친밀도는 메모리에서만 3 으로).

static func open_keeper_menu(tree: SceneTree) -> void:
	var v := tree.current_scene.get_node_or_null("Villager")
	if v == null:
		return
	ForestSaveState.affinity["npc_merchant"] = 3
	v.call("_open_interact_menu", v.VILLAGERS[2])
