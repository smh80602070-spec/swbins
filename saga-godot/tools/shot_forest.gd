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


## G-0391 — 집 앞 밭 네 칸을 씨·싹·자람·다 자람으로(메모리만 — 저장 안 함) 세우고 그 앞에 선다.
static func show_crops(tree: SceneTree) -> void:
	var F: Node = tree.root.get_node("ForestSaveState")
	F.crops = {"field": true, "roll": ForestDay.epoch_day_index(), "plots": [{"st": 0, "wet": true}, {"st": 1, "wet": false}, {"st": 2, "wet": true}, {"st": 3, "wet": false}]}
	var view := tree.current_scene.find_child("CropView", true, false)
	var p := tree.get_first_node_in_group("player") as Node3D
	if view == null:
		print("FS_CROPS 밭 없음")
		return
	view.call("sync")
	if p != null:
		p.global_position = (view as Node3D).global_position + Vector3(0, 0.3, 3.2)
	print("FS_CROPS 작물 %d" % int(view.call("sync")))


## G-0396 — 작은 우리에 꼬꼬·매매(메모리만 — 저장 안 함)를 넣고 그 앞에 선다(닭·염소 GLB 몸 확인).
## G-0404 — 사고 다 모음 깃발(메모리만 세움) 앞에 선다.
static func show_grand_flag(tree: SceneTree) -> void:
	var mu := tree.current_scene.find_child("Museum", true, false) as Node3D
	var p := tree.get_first_node_in_group("player") as Node3D
	if mu == null:
		print("FS_FLAG 사고 없음")
		return
	if mu.find_child("BundleGrandFlag", false, false) == null:
		mu.call("_spawn_grand_flag")
	print("FS_FLAG %s" % str((mu.find_child("BundleGrandFlag", false, false) as MeshInstance3D).mesh))
	if p != null:
		p.global_position = mu.global_position + Vector3(0, 0.3, 12.0)


static func show_pen(tree: SceneTree) -> void:
	var F: Node = tree.root.get_node("ForestSaveState")
	F.livestock = {"pen": true, "roll": ForestDay.epoch_day_index(), "list": [{"kind": "chick", "name": "꼬꼬", "fed": false, "petted": false, "heart": 3, "hungry": 0},
		{"kind": "goat", "name": "매매", "fed": false, "petted": false, "heart": 2, "hungry": 0}, {"kind": "chick", "name": "꼬꼬2", "fed": false, "petted": false, "heart": 0, "hungry": 0}]}
	var view := tree.current_scene.find_child("LivestockView", true, false)
	var p := tree.get_first_node_in_group("player") as Node3D
	if view == null:
		print("FS_PEN 우리 없음")
		return
	print("FS_PEN 짐승 %d" % int(view.call("sync")))
	if p != null:
		p.global_position = (view as Node3D).global_position + Vector3(0, 0.3, 4.0)


## G-0401 — 잠자리채·삽 전설(메모리만)로 「채집꾼 한 벌」이 선 제작대 화면(머리줄 등급·한 벌 · 레시피 Lv4·5 등급 이름).
static func open_bench_tools(tree: SceneTree) -> void:
	var F: Node = tree.root.get_node("ForestSaveState")
	F.tool_lv = {"basket": 3, "net": 5, "spade": 5}
	F.items = {"곤충": 9, "광석": 9, "화석": 4, "조개": 4}
	var bench := tree.current_scene.find_child("CraftBench", true, false)
	var p := tree.get_first_node_in_group("player") as Node3D
	if bench == null:
		return
	if p != null:
		p.global_position = (bench as Node3D).global_position + Vector3(0, 0.3, 2.2)
	bench.call("open_menu")
