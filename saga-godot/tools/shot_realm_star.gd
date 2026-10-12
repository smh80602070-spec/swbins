extends RefCounted
## G-0216 촬영 도우미 — 5천하 경륜도: 메모리만(저장 안 함) 목민 시작에서 이름난 마디까지 찍고, HUD 「🧭 경륜」 단추로 연 뒤 규칙 마디(무위) 카드.


static func open(tree: SceneTree) -> void:
	var RS: Node = tree.root.get_node("RealmSaveState")
	RS.set("year", int(String(RS.get("scenario_id"))) + 4)
	RS.set("passive", {"start": null, "taken": []})
	var api: RefCounted = RS.call("passive_api")
	api.call("take", "o_mokmin")
	for nd: Dictionary in api.get("def").nodes:
		if String(nd.k) == "n" and int((api.call("path_to", String(nd.id)) as Dictionary).get("cost", 99)) <= 8:
			api.call("take_path", String(nd.id))
			break
	var btn := tree.current_scene.find_child("StatecraftButton", true, false)
	if btn == null:
		print("REALM_STAR 단추 없음")
		return
	## 시나리오 고르기 창은 앞 단계(free_modal)가 queue_free 해 이 프레임엔 아직 보인다 — 한 프레임 뒤에 연다
	var cb := [Callable()]
	cb[0] = func() -> void:
		tree.process_frame.disconnect(cb[0])
		var scr: CanvasLayer = btn.call("open_screen")
		if scr == null:
			print("REALM_STAR 화면 안 열림")
			return
		scr.call("select", "k_muwi")
		print("REALM_STAR 단추 「%s」 · 찍음 %d · 남은 %d" % [btn.get("text"), (RS.get("passive").taken as Array).size(), int(api.call("left"))])
	tree.process_frame.connect(cb[0])
