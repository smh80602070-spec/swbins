extends RefCounted
## G-0060 촬영 도우미 — shot_scene.gd 의 static 단계가 부른다. 지금 인물에게 성유물을 메모리에서만 끼우거나 뺀다(저장 안 함).

static func dress(tree: SceneTree, full: bool) -> void:
	var p := tree.get_first_node_in_group("player")
	if p == null:
		return
	var id := String(p.get("_body_id"))
	for slot in ["flower", "plume", "sands", "goblet", "circlet"]:
		PartyState.unequip_artifact(id, slot)
		if full:
			var u: String = PartyState.add_artifact(5, "", slot)
			PartyState.artifacts[u].lv = 20
			PartyState.equip_artifact(id, u)
