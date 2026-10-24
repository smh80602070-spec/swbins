extends SceneTree

## G-0381 3마을 별똥별 소원(world/forest_stars.gd) 점검 —
##   godot --headless --path saga-godot --script res://tools/probe_forest_stars.gd   → "PROBE forest_stars OK" / "FAIL n"
## ① 소원: 하룻밤 5 까지 · 다른 날이면 새로 ② 답례: 날이 바뀌면 소원 수만큼 별 조각·상태 비움 · 같은 날·빈 상태면 0
## ③ 마을에 붙음 · 밤에 fall() 이면 단추가 보이고 누르면 소원 +1 ④ 별 조각이 상인 값표에 ⑤ 세이브 칸·손잡이. 상태·가방은 되돌린다.

var fails := 0


func check(cond: bool, msg: String) -> void:
	if cond:
		print("  ok   ", msg)
	else:
		fails += 1
		print("  FAIL ", msg)


func _initialize() -> void:
	await process_frame
	var ST: GDScript = load("res://games/saga_forest/world/forest_stars.gd")
	var F: Node = root.get_node("ForestSaveState")
	var saved := {"stars": (F.get("stars") as Dictionary).duplicate(), "items": (F.get("items") as Dictionary).duplicate()}
	var d := 20261025

	# ① 소원
	F.set("stars", {})
	var w: Array = []
	for i in 7:
		w.append(ST.wish(F, d))
	var other: int = ST.wish(F, d + 1)
	check(w == [1, 2, 3, 4, 5, 5, 5] and other == 1, "① 하룻밤 5 까지 %s · 다른 날 새로 %d" % [w, other])

	# ② 답례
	F.set("stars", {"day": d, "wishes": 3})
	var before := int((F.get("items") as Dictionary).get(ST.ITEM, 0))
	var same: int = ST.redeem(F, d)
	var got: int = ST.redeem(F, d + 1)
	var after := int((F.get("items") as Dictionary).get(ST.ITEM, 0))
	var again: int = ST.redeem(F, d + 2)
	check(same == 0 and got == 3 and after == before + 3 and (F.get("stars") as Dictionary).is_empty() and again == 0, "② 같은 날 0 · 이튿날 조각 %d · 비움 · 다시 0" % got)

	# ③ 마을
	var sc := (load("res://games/saga_forest/world/TestVillageForest.tscn") as PackedScene).instantiate()
	root.add_child(sc)
	current_scene = sc
	for i in 5:
		await process_frame
	paused = false
	var node := sc.get_node_or_null("ForestStars")
	var ok3 := node != null
	if ok3:
		F.set("stars", {})
		node.call("fall")
		var btn := node.get("_btn") as Button
		var vis := btn.visible
		btn.emit_signal("pressed")
		ok3 = vis and not btn.visible and ST.wishes_on(F.get("stars"), ForestDay.today_key()) == 1 and int(node.get("shown")) == 1
	check(ok3, "③ 마을에 붙음 · 별 → 단추 → 소원 1")

	# ④ 값표
	var VB: GDScript = load("res://games/saga_forest/world/villager_builder.gd")
	check(int((VB.SELL_BASE_PRICE as Dictionary).get(ST.ITEM, 0)) == 500, "④ 별 조각 값 500")

	# ⑤ 세이브·손잡이
	var src := FileAccess.get_file_as_string("res://games/saga_forest/data/forest_save_state.gd")
	OS.set_environment("SAGA_STARS", "0")
	var off: Node = ST.attach(Node.new())
	OS.set_environment("SAGA_STARS", "")
	check(src.contains("\"stars\": stars") and src.contains("data.get(\"stars\", {})") and off == null, "⑤ 세이브 칸 · 끄면 안 붙음")

	F.set("stars", saved.stars)
	F.set("items", saved.items)
	print("PROBE forest_stars ", "OK" if fails == 0 else "FAIL %d" % fails)
	quit(1 if fails > 0 else 0)
