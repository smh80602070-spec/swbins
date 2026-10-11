extends RefCounted
## G-0197 촬영 도우미 — 레벨업 3택 창을 바로 띄운다(메모리에서만, 저장 안 함): 무사 Lv12 · 지난 사냥 등급도 하나 남겨 둔다.

static func stage(tree: SceneTree) -> void:
	var S: Node = tree.root.get_node("StorySaveState")
	S.job = "warrior"
	S.level = 12
	S.skills = {"w_cut": 3}
	S.skill_offers = [{"lv": 12, "keys": S.offer3(12)}]
	S.last_run = {"rank": "A", "sec": 154.0, "hits": 2, "combo": 11}
	var p := tree.current_scene.find_children("*", "Node", true, false).filter(func(n): return n.has_method("open_first"))
	if not p.is_empty():
		p[0].call("open_first")
