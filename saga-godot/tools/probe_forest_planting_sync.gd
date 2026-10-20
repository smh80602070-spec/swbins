extends SceneTree

## G-0263 3마을 심은 꽃 자리 노드 ↔ ForestSaveState.planted 맞추기 자동 점검(games/saga_forest/world/forest_planting.gd).
##   godot --headless --path saga-godot --script res://tools/probe_forest_planting_sync.gd
## ⓪ 씬 열 때 부모 try_load 뒤 planted 대로 세움 ① 셋 심은 상태로 다시 세움 → 노드 3 ② planted 를 하나짜리 새 배열로 바꿈 → 남은 자리(2) 진입·나감·꺾기가 범위 밖 오류 없이 무시되고
##    다음 유휴에 노드 1 ③ 다시 셋 → 진입 한 번으로 노드 3·_in_range 키 3 ④ 꺾기 인덱스: 2번(진교배꽃) 꺾으면 진교배꽃 +1·planted_2 표시.
## 세이브는 안 건드린다(items·planted·used 되돌림). 끝에 "PROBE forest_planting_sync OK|FAIL n".

const SCENE := "res://games/saga_forest/world/TestVillageForest.tscn"
const PLANTING := "res://games/saga_forest/world/forest_planting.gd"

var fails := 0


func check(cond: bool, msg: String) -> void:
	if cond:
		print("  ok   ", msg)
	else:
		fails += 1
		print("  FAIL ", msg)


func _frames(n: int) -> void:
	for i in n:
		await process_frame


func _three() -> Array:
	return [{"x": 0.0, "z": 0.0, "day": 0, "tier": 0}, {"x": 6.0, "z": 0.0, "day": 0, "tier": 1}, {"x": 20.0, "z": 9.0, "day": 0, "tier": 2}]


func _find_planting(n: Node) -> Node:
	var s: Script = n.get_script()
	if s != null and s.resource_path == PLANTING:
		return n
	for c in n.get_children():
		var r := _find_planting(c)
		if r != null:
			return r
	return null


func _initialize() -> void:
	var F: Node = root.get_node("ForestSaveState")
	var saved_items: Dictionary = (F.items as Dictionary).duplicate(true)
	var saved_planted: Array = (F.planted as Array).duplicate(true)
	var saved_used: Dictionary = (F.used as Dictionary).duplicate(true)
	F.items = {}
	F.planted = []

	var scene: Node = (load(SCENE) as PackedScene).instantiate()
	root.add_child(scene)
	current_scene = scene
	await _frames(10)
	var pl := _find_planting(scene)
	var player := get_first_node_in_group("player") as Node3D
	if pl == null or player == null:
		check(false, "forest_planting 노드·플레이어를 못 찾음")
	else:
		# ⓪ 씬 열 때: 부모 _ready 의 try_load 가 planted 를 바꾼 뒤에 세웠는가(노드 수 = 불러온 planted 수 · 같은 배열)
		check((pl.get("_nodes") as Array).size() == (F.planted as Array).size() and not pl.call("is_stale"), "씬 열 때 불러온 planted(%d)대로 세움" % (F.planted as Array).size())
		# ①
		F.planted = _three()
		check(pl.call("is_stale"), "planted 를 새 배열로 바꾸면 is_stale")
		pl.call("resync")
		check((pl.get("_nodes") as Array).size() == 3 and not pl.call("is_stale"), "셋 → 다시 세움 → 노드 3")
		# ②
		F.planted = [{"x": 0.0, "z": 0.0, "day": 0, "tier": 0}]
		pl.call("_on_entered", player, 2)   # 옛 자리 2 — 고치기 전엔 planted[2] 범위 밖
		pl.call("_on_exited", player, 2)
		pl.call("_gather", 2)
		check(not bool((pl.get("_in_range") as Dictionary).get(2, false)), "남은 자리 2 진입·나감·꺾기 무시(범위 밖 없음)")
		await _frames(3)
		check((pl.get("_nodes") as Array).size() == 1 and (pl.get("_in_range") as Dictionary).size() == 1 and not pl.call("is_stale"), "하나짜리 → 진입 한 번으로 노드 1 · _in_range 키 1")
		# ③
		F.planted = _three()
		pl.call("_on_entered", player, 0)
		await _frames(3)
		var nodes: Array = pl.get("_nodes")
		var pos_ok := nodes.size() == 3
		for i in mini(nodes.size(), 3):
			var e: Dictionary = F.planted[i]
			pos_ok = pos_ok and is_equal_approx((nodes[i] as Node3D).position.x, float(e.x)) and is_equal_approx((nodes[i] as Node3D).position.z, float(e.z)) and String((nodes[i] as Node3D).name) == "Planted_%d" % i
		check(pos_ok and (pl.get("_in_range") as Dictionary).size() == 3, "다시 셋 → 노드 3 · 이름·자리 인덱스대로 · _in_range 키 3")
		# ④
		F.used.erase("planted_2")
		pl.call("_gather", 2)
		check(int(F.items.get("진교배꽃", 0)) == 1 and int(F.items.get("교배꽃", 0)) == 0 and not F.can_gather("planted_2"), "꺾기 인덱스: 2번 → 진교배꽃 +1 · planted_2 오늘 씀")
	scene.queue_free()
	await _frames(3)
	F.items = saved_items
	F.planted = saved_planted
	F.used = saved_used
	print("PROBE forest_planting_sync ", "OK" if fails == 0 else "FAIL %d" % fails)
	quit(1 if fails > 0 else 0)
