extends RefCounted
## G-0218 촬영 도우미 — 3마을 솜씨도: 메모리만(저장 안 함) 도구·하트로 점수를 주고 장인에서 손 큰 장인까지 찍은 뒤, HUD 「🌿 솜씨」 단추로 연 화면의 손 큰 장인 카드.


static func open(tree: SceneTree) -> void:
	var F: Node = tree.root.get_node("ForestSaveState")
	F.set("tool_lv", {"basket": 3, "net": 3})
	F.set("affinity", {"a": 10, "b": 10, "c": 10, "d": 10, "e": 10, "f": 7})
	F.set("museum_donated", 110)
	F.set("passive", {"start": null, "taken": []})
	var api: RefCounted = F.call("passive_api")
	api.call("take", "o_artisan")
	api.call("take_path", "k_bighand")
	tree.node_added.connect(func(n: Node) -> void:
		var s: Script = n.get_script()
		if s != null and s.resource_path.ends_with("talk_box.gd"):
			n.queue_free.call_deferred())
	var btn := tree.current_scene.find_child("WorkshopButton", true, false)
	if btn == null:
		print("FS_WORKSHOP 단추 없음")
		return
	## 앞 단계(free_modal)가 queue_free 한 창은 이 프레임엔 아직 보인다 — 한 프레임 뒤에 연다
	var cb := [Callable()]
	cb[0] = func() -> void:
		tree.process_frame.disconnect(cb[0])
		var scr: CanvasLayer = btn.call("open_screen")
		if scr == null:
			print("FS_WORKSHOP 화면 안 열림")
			return
		scr.call("select", "k_bighand")
		print("FS_WORKSHOP 찍음 %d · 남은 %d / %d" % [int(api.call("used")), int(api.call("left")), int(api.call("points"))])
	tree.process_frame.connect(cb[0])
