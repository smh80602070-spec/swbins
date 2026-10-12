extends RefCounted
## G-0215 촬영 도우미 — 1만리 성도: 등급 30·나그네 시작에서 이름난 마디까지 찍고(메모리만) 메뉴 입구(그룹 go_starchart)로 연 뒤 규칙 마디(맨발) 카드.


static func open(tree: SceneTree) -> void:
	var PS: Node = tree.root.get_node("PartyState")
	PS.set("level", 30)
	PS.set("passive", {"start": null, "taken": []})
	var api: RefCounted = PS.call("passive_api")
	api.call("take", "o_wayfarer")
	for nd: Dictionary in api.get("def").nodes:
		if String(nd.k) == "n" and int((api.call("path_to", String(nd.id)) as Dictionary).get("cost", 99)) <= 9:
			api.call("take_path", String(nd.id))
			break
	var entry := tree.get_first_node_in_group("go_starchart")
	if entry == null:
		print("GO_STAR 입구 없음")
		return
	var scr: CanvasLayer = entry.call("open_screen")
	if scr != null:
		scr.call("select", "k_barefoot")
	else:
		print("GO_STAR 화면 안 열림")
	print("GO_STAR 찍음 %d · 남은 %d" % [(PS.get("passive").taken as Array).size(), int(api.call("left"))])
