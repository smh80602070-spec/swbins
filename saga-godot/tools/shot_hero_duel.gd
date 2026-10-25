extends RefCounted
## G-0397 촬영 도우미 — 1만리 첫 역사 인물 곁에 서서 설득 창을 열고 「⚔️ 무로 겨루자」를 고른다(결투 판이 선 화면). 저장 안 함.


static func open(tree: SceneTree) -> void:
	var enc := tree.get_first_node_in_group("go_heroes") as Node3D
	var p := tree.get_first_node_in_group("player") as Node3D
	if enc == null or p == null:
		print("GO_DUEL 인물·플레이어 없음")
		return
	p.global_position = enc.global_position + Vector3(0, 0.5, 6.0)
	enc.call("_on_body_entered", p)
	enc.call("_do_appeal", "might")
	print("GO_DUEL 판 %d" % int(enc.call("duel_count")))
