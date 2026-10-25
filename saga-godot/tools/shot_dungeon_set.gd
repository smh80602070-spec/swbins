extends RefCounted
## G-0398 촬영 도우미 — 2나락에서 철옹 세 점(메모리만, 저장 안 함)을 걸쳐 HUD 세트 무예 T 단추를 보이게 하고, 고유 하나를 가방 이름으로 찍는다.


static func open(tree: SceneTree) -> void:
	var ES: Node = tree.root.get_node("DungeonEquipmentState")
	for pair in [["armor", "a_jichap"], ["helm", "h_tumo"], ["neck", "n_geumpae"]]:
		ES.set(pair[0], {"base": pair[1], "tier": 3, "ilvl": 20, "main": 10.0, "aff": [], "sock": [], "set": "cheolong", "unid": false, "dur": 999})
	var c := tree.get_first_node_in_group("skill_caster")
	print("DG_SET 세트 %s · 무예 %s" % [ES.call("full_set_key"), str((c.call("set_skill") as Dictionary).get("name", "")) if c else "?"])
