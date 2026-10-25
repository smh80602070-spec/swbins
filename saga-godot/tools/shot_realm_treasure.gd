extends RefCounted
## G-0402 촬영 도우미 — 5천하 우리 장수 셋에게 무장의 채비 조각을 나눠 쥐여(메모리만, 저장 안 함) 전임 창(무장 줄에 보물·세트)을 연다.


static func open(tree: SceneTree) -> void:
	var RS: Node = tree.root.get_node("RealmSaveState")
	var ids: Array = (RS.get("roster") as Array).slice(0, 3)
	var pieces := ["itm_ironblade", "itm_warhorse", "itm_armor"]
	var oi := {}
	for i in ids.size():
		oi[String(ids[i])] = pieces[i]
	RS.set("officer_item", oi)
	var btn := tree.current_scene.find_child("TransferButton", true, false)
	if btn == null:
		for n in tree.current_scene.find_children("*", "Button", true, false):
			if n.get_script() != null and String(n.get_script().resource_path).ends_with("realm_transfer_button.gd"):
				btn = n
				break
	print("RT_TREASURE 장수 %d · 단추 %s" % [ids.size(), btn != null])
	if btn != null:
		btn.call("_on_pressed")
