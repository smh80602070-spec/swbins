extends RefCounted
## G-0399 촬영 도우미 — 4종횡 사냥터에서 흑룡 채비 네 점(메모리만, 저장 안 함)을 끼고 몰이 파도를 바로 시작(세트 무예는 점검 몫 — 쓰면 처치 알림이 몰이 띠를 덮는다).


static func open(tree: SceneTree) -> void:
	var S: Node = tree.root.get_node("StorySaveState")
	S.set("level", maxi(int(S.get("level")), 20))
	S.set("equipped", {"shoes": "shoe4", "glove": "glv4", "cape": "cap4", "ring": "ring4"})
	var hw := tree.current_scene.find_child("StoryHuntWave", true, false)
	if hw != null:
		hw.call("start")
	print("ST_WAVE 몰이 %s · 몰이 몹 %d" % [hw != null, int(hw.call("alive_count")) if hw != null else 0])
