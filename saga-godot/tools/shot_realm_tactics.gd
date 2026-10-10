extends RefCounted
## G-0183 촬영 도우미 — shot_scene.gd 의 static 단계가 부른다. 새 판 194 에 장수 둘(하후·장료 — 메모리에서만, 저장 안 함)을 허창에 더하고
## 병력 3000 으로 소패 전술판을 연다. pick 이 참이면 앞장 장수를 골라 이동 칸(파랑)·명중률 글을 띄운 채 찍힌다.

static func stage(tree: SceneTree, pick := true) -> void:
	var S: Node = tree.root.get_node("RealmSaveState")
	S.start_scenario("194")
	for id in ["sg_xiahoudun", "sg_zhangliao"]:
		if not (id in S.roster):
			S.roster.append(id)
		S.officer_city[id] = "xuchang"
	S.cities.xuchang.troops = 3000
	S.cities.xuchang.food = maxi(int(S.cities.xuchang.food), 30000)
	var btn := tree.current_scene.get_node_or_null("RealmHUD/AttackButton")
	if btn == null:
		return
	btn.call("_open_tactics", "xiaopei", {})
	if not pick:
		return
	var view := tree.current_scene.get_node_or_null("TacticsView")
	if view == null:
		return
	for u: Dictionary in view.board.units:
		if u.side == "me":
			view.call("pick_cell", int(u.x), int(u.y))
			break
