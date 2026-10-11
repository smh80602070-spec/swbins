extends RefCounted
## G-0064 촬영 도우미 — shot_scene.gd 의 static 단계가 부른다. 상인 관계 메뉴를 연다(숲지기는 고를 거리가 없을 때가 많다)(친밀도는 메모리에서만 3 으로).

static func open_keeper_menu(tree: SceneTree) -> void:
	var v := tree.current_scene.get_node_or_null("Villager")
	if v == null:
		return
	ForestSaveState.affinity["npc_merchant"] = 3
	v.call("_open_interact_menu", v.VILLAGERS[2])


## G-0196 — 제작대 앞에 서서 화면을 연다(재료는 메모리에서만 — 저장 안 함). 바구니 Lv2 는 만들 수 있게, 나머지는 까닭이 보이게.
static func open_bench(tree: SceneTree) -> void:
	var F: Node = tree.root.get_node("ForestSaveState")
	F.items = {"솔방울": 4, "꽃": 3, "광석": 2, "곤충": 1}
	var bench := tree.current_scene.find_child("CraftBench", true, false)
	var p := tree.get_first_node_in_group("player") as Node3D
	if bench == null:
		return
	if p != null:
		p.global_position = (bench as Node3D).global_position + Vector3(0, 0.3, 2.2)
	bench.call("open_menu")
