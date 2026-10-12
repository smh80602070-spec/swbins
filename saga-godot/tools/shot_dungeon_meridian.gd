extends RefCounted
## G-0217 촬영 도우미 — 2나락 경락도: 메모리만(저장 안 함) 무장 점수 20 을 주고 무장의 문에서 일격까지 찍은 뒤, 무예 창 단추(SkillButton)의 경락도를 열어 일격 카드.


static func open(tree: SceneTree) -> void:
	var SS: Node = tree.root.get_node("DungeonSkillState")
	var points: Dictionary = SS.get("points")
	points["warrior"] = 20
	var SV: Node = tree.root.get_node("DungeonSaveState")
	SV.set("passive", {})
	var api: RefCounted = SV.call("passive_api", "warrior")
	api.call("take", "o_warrior")
	api.call("take_path", "k_onecut")
	tree.node_added.connect(func(n: Node) -> void:
		var s: Script = n.get_script()
		if s != null and s.resource_path.ends_with("talk_box.gd"):
			n.queue_free.call_deferred())
	var btn := tree.current_scene.find_child("SkillButton", true, false)
	if btn == null:
		print("DG_MERIDIAN 단추 없음")
		return
	## 출사표 창은 앞 단계(free_modal)가 queue_free 해 이 프레임엔 아직 보인다 — 한 프레임 뒤에 연다
	var cb := [Callable()]
	cb[0] = func() -> void:
		tree.process_frame.disconnect(cb[0])
		var scr: CanvasLayer = btn.call("open_meridian")
		if scr == null:
			print("DG_MERIDIAN 화면 안 열림")
			return
		scr.call("select", "k_onecut")
		print("DG_MERIDIAN 찍음 %d · 남은 %d / %d" % [int(api.call("used")), int(api.call("left")), int(api.call("points"))])
	tree.process_frame.connect(cb[0])
