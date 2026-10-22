extends SceneTree

## G-0309 4종횡 지도 조각·지름길(웹 W-0305 짝) 점검 —
##   godot --headless --path saga-godot --script res://tools/probe_story_stagemap.gd   → "PROBE story_stagemap OK" / "FAIL n"
## ① 사냥터 넷마다 조각 셋 — x 오름·사냥터 안·발판 위 ② 줍기: 같은 것 두 번 안 셈 · 셋 = 완성
## ③ 지름길 x: 완성 전 -1 · 가운데 = 둘째 조각 · 끝 = 셋째 · 들판(사냥터 아님) -1 · SAGA_STAGEMAP=0 → -1
## ④ 사냥터 씬에 남은 조각만 섬 · 줍기(pick) 알림·지움 ⑤ 저장 왕복·옛 세이브(23) 빈 칸 · 판 24
## ⑥ 배선: story_field attach · 문 _offer_shortcut · 자동 퀘스트 켜져 있으면 안 물음. 진짜 세이브는 안 건드린다.

const SAVED_VARS := ["stage_maps", "path_override", "has_pending_spawn", "pending_spawn_x"]

var fails := 0


func check(cond: bool, msg: String) -> void:
	if cond:
		print("  ok   ", msg)
	else:
		fails += 1
		print("  FAIL ", msg)


func _init() -> void:
	await process_frame
	var S: Node = root.get_node("StorySaveState")
	var SM: GDScript = load("res://games/saga_story/data/story_stagemap.gd")
	var Piece: GDScript = load("res://games/saga_story/world/story_map_piece.gd")
	var saved := {}
	for v in SAVED_VARS:
		saved[v] = S.get(v)
		if saved[v] is Dictionary:
			saved[v] = (saved[v] as Dictionary).duplicate(true)

	# ①
	for scene in SM.SCENES:
		var map: GDScript = SM.map_of_scene(scene)
		var ps: Array = SM.pieces(map)
		var ok: bool = ps.size() == 3
		for i in range(ps.size()):
			var p: Vector3 = ps[i]
			ok = ok and p.x > 0.5 and p.x < float(map.width_m()) - 0.5 and p.y > SM.PIECE_LIFT
			if i > 0:
				ok = ok and p.x > (ps[i - 1] as Vector3).x
		check(ok, "① %s 조각 셋 %s" % [String(map.stage_key()), str(ps.map(func(v: Vector3) -> String: return "%.1f,%.1f" % [v.x, v.y]))])

	# ②③
	var maps := {}
	var cave: GDScript = SM.map_of_scene("res://games/saga_story/world/CaveHuntGround.tscn")
	check(SM.add(maps, "cave", 0) and not SM.add(maps, "cave", 0) and not SM.add(maps, "cave", 3), "② 같은 조각 두 번 안 셈 · 번호 밖 거절")
	SM.add(maps, "cave", 2)
	check(not SM.done(maps, "cave") and SM.start_x(maps, cave, "mid") < 0.0, "③ 둘만 → 완성 아님 · 지름길 없음")
	SM.add(maps, "cave", 1)
	var cps: Array = SM.pieces(cave)
	check(SM.done(maps, "cave") and is_equal_approx(SM.start_x(maps, cave, "mid"), (cps[1] as Vector3).x) and is_equal_approx(SM.start_x(maps, cave, "end"), (cps[2] as Vector3).x) and SM.start_x(maps, cave, "gate") < 0.0,
		"③ 셋 → 완성 · 가운데 %.1f · 끝 %.1f" % [SM.start_x(maps, cave, "mid"), SM.start_x(maps, cave, "end")])
	check(SM.map_of_scene("res://games/saga_story/world/HeodoField.tscn") == null and SM.start_x(maps, null, "mid") < 0.0, "③ 마을(사냥터 아님)은 지름길 없음")
	OS.set_environment("SAGA_STAGEMAP", "0")
	check(SM.start_x(maps, cave, "mid") < 0.0, "③ SAGA_STAGEMAP=0 → 지름길 없음")
	OS.set_environment("SAGA_STAGEMAP", "")

	# ④ 사냥터 씬 — 남은 조각만 · 줍기
	S.stage_maps = {"cave": [1]}
	S.has_pending_spawn = true   # 세이브를 안 불러오게(문으로 온 것처럼)
	S.pending_spawn_x = 3.0
	var sc: Node = (load("res://games/saga_story/world/CaveHuntGround.tscn") as PackedScene).instantiate()
	root.add_child(sc)
	for _i in 3:
		await process_frame
	var nodes: Array = get_nodes_in_group("story_map_piece")
	var names: Array = nodes.map(func(n: Node) -> String: return String(n.name))
	check(nodes.size() == 2 and names.has("MapPiece0") and names.has("MapPiece2"), "④ 굴혈: 주운 1 빼고 둘 섬 %s" % str(names))
	var p0: Node = sc.get_node_or_null("MapPiece0")
	check(p0 != null and Piece.pick(p0, "cave", 0) and S.stage_maps.cave == [0, 1], "④ 줍기 → stage_maps.cave %s" % str(S.stage_maps.get("cave")))
	sc.queue_free()
	await process_frame

	# ⑤ 저장 왕복·옛 세이브
	var dummy := Node3D.new()
	dummy.add_to_group("player")
	root.add_child(dummy)
	S.path_override = "user://probe_story_stagemap_rt.json"
	S.stage_maps = {"cave": [0, 1, 2], "forest": [2]}
	var sv: bool = S.save()
	S.stage_maps = {}
	var ld: bool = S.try_load()
	check(sv and ld and SM.done(S.stage_maps, "cave") and SM.got(S.stage_maps, "forest").has(2) and not SM.add(S.stage_maps, "cave", 0), "⑤ 저장 왕복(번호 정수) %s" % str(S.stage_maps))
	DirAccess.remove_absolute(ProjectSettings.globalize_path(S.path_override))
	S.path_override = "user://probe_story_stagemap_old.json"
	var f := FileAccess.open(S.path_override, FileAccess.WRITE)
	f.store_string(JSON.stringify({"version": 23, "level": 5, "exp": 0, "gold": 10, "player_pos": [0.0, 0.1, 0.0]}))
	f.close()
	S.stage_maps = {"x": [0]}
	var ld_old: bool = S.try_load()
	check(ld_old and S.stage_maps.is_empty() and S.save_version() >= 24, "⑤ 옛 23 세이브 → stage_maps 빈 칸 · 판 24 이상")
	DirAccess.remove_absolute(ProjectSettings.globalize_path(S.path_override))
	dummy.queue_free()

	# ⑥ 배선
	var fd := FileAccess.get_file_as_string("res://games/saga_story/world/story_field.gd")
	var pt := FileAccess.get_file_as_string("res://games/saga_story/world/story_portal.gd")
	check(fd.contains("story_map_piece.gd\").attach(self)") and pt.contains("_offer_shortcut()") and pt.contains("\"autoquest\""), "⑥ 사냥터 attach · 문 고르기 · 자동 퀘스트 땐 안 물음(배선)")

	for v in SAVED_VARS:
		S.set(v, saved[v])
	await process_frame
	print("PROBE story_stagemap ", "OK" if fails == 0 else "FAIL %d" % fails)
	quit(1 if fails > 0 else 0)
